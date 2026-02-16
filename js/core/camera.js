// =============================================================================
// TALOS 2.0 - Camera Access Module
// iOS Safari compatible camera initialization with environment-facing preference
// =============================================================================

/**
 * Initialize the rear-facing camera and bind to #camera-feed video element.
 * Designed for iOS Safari: uses playsinline, handles permission prompts.
 *
 * @returns {Promise<{video: HTMLVideoElement, stream: MediaStream, width: number, height: number}>}
 */
export async function initCamera() {
    console.log('[CAMERA] Initializing camera subsystem...');

    // Verify getUserMedia support
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.error('[CAMERA] getUserMedia not supported on this browser');
        throw new Error('Camera API not available. Requires HTTPS and a modern browser.');
    }

    const video = document.getElementById('camera-feed');
    if (!video) {
        console.error('[CAMERA] #camera-feed element not found in DOM');
        throw new Error('Video element #camera-feed not found');
    }

    // Ensure playsinline is set (critical for iOS Safari - without this,
    // iOS will open video in fullscreen native player)
    video.setAttribute('playsinline', '');
    video.setAttribute('autoplay', '');
    video.setAttribute('muted', '');
    video.playsInline = true;
    video.muted = true;

    const constraints = {
        audio: false,
        video: {
            facingMode: 'environment',
            width: { ideal: 1280 },
            height: { ideal: 720 }
        }
    };

    let stream;
    try {
        console.log('[CAMERA] Requesting camera access (environment facing)...');
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        console.log('[CAMERA] Camera access granted');
    } catch (err) {
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
            console.error('[CAMERA] Permission denied by user');
            throw new Error('Camera permission denied. Please allow camera access and reload.');
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
            console.error('[CAMERA] No camera device found');
            throw new Error('No camera found. Ensure a camera is connected.');
        } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
            console.error('[CAMERA] Camera is in use by another application');
            throw new Error('Camera is in use by another application.');
        } else if (err.name === 'OverconstrainedError') {
            // Fallback: try without facingMode constraint (some desktop setups)
            console.warn('[CAMERA] Overconstrained, retrying without facingMode...');
            try {
                stream = await navigator.mediaDevices.getUserMedia({
                    audio: false,
                    video: {
                        width: { ideal: 1280 },
                        height: { ideal: 720 }
                    }
                });
                console.log('[CAMERA] Camera access granted (fallback constraints)');
            } catch (fallbackErr) {
                console.error('[CAMERA] Fallback also failed:', fallbackErr);
                throw new Error('Camera initialization failed: ' + fallbackErr.message);
            }
        } else {
            console.error('[CAMERA] Unexpected camera error:', err.name, err.message);
            throw new Error('Camera initialization failed: ' + err.message);
        }
    }

    // Bind stream to video element
    video.srcObject = stream;

    // Wait for video metadata to load so we know the actual resolution
    const dimensions = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            reject(new Error('Timed out waiting for camera metadata'));
        }, 10000);

        video.addEventListener('loadedmetadata', () => {
            clearTimeout(timeout);
            resolve({
                width: video.videoWidth,
                height: video.videoHeight
            });
        }, { once: true });
    });

    // Start playback (may require user gesture on some browsers)
    try {
        await video.play();
        console.log(`[CAMERA] Stream active: ${dimensions.width}x${dimensions.height}`);
    } catch (playErr) {
        console.warn('[CAMERA] Auto-play blocked, may need user gesture:', playErr.message);
        // On iOS, autoplay may be blocked until user interaction.
        // We still return successfully - the caller can retry play() on tap.
    }

    // Log track info
    const videoTrack = stream.getVideoTracks()[0];
    if (videoTrack) {
        const settings = videoTrack.getSettings();
        console.log(`[CAMERA] Track: ${videoTrack.label}`);
        console.log(`[CAMERA] Actual resolution: ${settings.width}x${settings.height}, FPS: ${settings.frameRate}`);
    }

    return {
        video,
        stream,
        width: dimensions.width,
        height: dimensions.height
    };
}

/**
 * Stop camera and release all resources.
 *
 * @param {MediaStream} stream - The stream returned by initCamera()
 */
export function stopCamera(stream) {
    if (!stream) {
        console.warn('[CAMERA] No stream to stop');
        return;
    }

    try {
        const tracks = stream.getTracks();
        tracks.forEach(track => {
            track.stop();
            console.log(`[CAMERA] Stopped track: ${track.label}`);
        });

        // Clear the video element
        const video = document.getElementById('camera-feed');
        if (video) {
            video.srcObject = null;
        }

        console.log('[CAMERA] Camera subsystem shut down');
    } catch (err) {
        console.error('[CAMERA] Error stopping camera:', err);
    }
}
