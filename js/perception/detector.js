// =============================================================================
// TALOS 2.0 - Object Detector via MediaPipe Tasks Vision
// Dynamically loaded, GPU-accelerated, synchronous detectForVideo()
// EfficientDet-Lite0: purpose-built for mobile real-time detection
// =============================================================================

const TACTICAL_MAP = {
    'person':       'PERSONNEL',
    'bicycle':      'LIGHT_VEHICLE',
    'car':          'VEHICLE',
    'motorcycle':   'LIGHT_VEHICLE',
    'airplane':     'AIRCRAFT',
    'bus':          'VEHICLE',
    'train':        'VEHICLE',
    'truck':        'VEHICLE',
    'boat':         'WATERCRAFT',
    'cell phone':   'COMMS_EQUIPMENT',
    'laptop':       'COMMS_EQUIPMENT',
    'backpack':     'SUPPLY_PACK',
    'suitcase':     'SUPPLY_PACK',
    'handbag':      'SUPPLY_PACK',
    'knife':        'EDGED_WEAPON',
    'scissors':     'EDGED_WEAPON'
};

const MEDIAPIPE_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float16/1/efficientdet_lite0.tflite';

export class Detector {
    constructor() {
        this._detector = null;
        this._ready = false;
        this._backend = 'unknown';
        this._confThreshold = 0.3;
    }

    /**
     * Initialize MediaPipe Object Detector.
     * Dynamically imports the library - no upfront script tag needed.
     */
    async init() {
        console.log('[DETECTOR] Loading MediaPipe Tasks Vision...');

        try {
            // Dynamically import MediaPipe (no script tag needed)
            const vision = await import(`${MEDIAPIPE_CDN}/vision_bundle.mjs`);
            const { ObjectDetector, FilesetResolver } = vision;

            console.log('[DETECTOR] Initializing WASM runtime...');
            const filesetResolver = await FilesetResolver.forVisionTasks(
                `${MEDIAPIPE_CDN}/wasm`
            );

            // Try GPU delegate first, fall back to CPU
            try {
                this._detector = await ObjectDetector.createFromOptions(filesetResolver, {
                    baseOptions: {
                        modelAssetPath: MODEL_URL,
                        delegate: 'GPU'
                    },
                    scoreThreshold: this._confThreshold,
                    maxResults: 20,
                    runningMode: 'VIDEO'
                });
                this._backend = 'GPU';
            } catch (gpuErr) {
                console.warn('[DETECTOR] GPU delegate failed, using CPU:', gpuErr.message);
                this._detector = await ObjectDetector.createFromOptions(filesetResolver, {
                    baseOptions: {
                        modelAssetPath: MODEL_URL
                    },
                    scoreThreshold: this._confThreshold,
                    maxResults: 20,
                    runningMode: 'VIDEO'
                });
                this._backend = 'CPU';
            }

            this._ready = true;
            console.log(`[DETECTOR] EfficientDet-Lite0 loaded (${this._backend})`);
            return true;
        } catch (err) {
            console.error('[DETECTOR] Failed to load:', err);
            this._ready = false;
            return false;
        }
    }

    /**
     * Run detection on video element.
     * detectForVideo is SYNCHRONOUS - fastest possible, no async overhead.
     *
     * @param {HTMLVideoElement} video
     * @returns {Array}
     */
    detect(video) {
        if (!this._ready || !this._detector) return [];
        if (!video || video.readyState < 2) return [];

        try {
            // Synchronous detection - no await needed
            const results = this._detector.detectForVideo(video, performance.now());

            if (!results || !results.detections) return [];

            return results.detections.map(d => {
                const cat = d.categories[0];
                const bb = d.boundingBox;
                return {
                    classId: cat.index,
                    class: cat.categoryName,
                    tacticalClass: TACTICAL_MAP[cat.categoryName] || 'OBJECT',
                    score: cat.score,
                    bbox: [bb.originX, bb.originY, bb.width, bb.height]
                };
            });
        } catch (err) {
            console.error('[DETECTOR] Detection error:', err);
            return [];
        }
    }

    isReady() { return this._ready; }
    getBackend() { return this._backend; }

    setThresholds(confidence) {
        if (confidence !== undefined) {
            this._confThreshold = Math.max(0, Math.min(1, confidence));
        }
    }

    async destroy() {
        if (this._detector) {
            this._detector.close();
            this._detector = null;
        }
        this._ready = false;
    }
}
