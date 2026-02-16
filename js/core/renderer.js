// =============================================================================
// TALOS 2.0 - Main Render Loop & Compositor
// Composites camera feed + all overlay layers onto the HUD canvas at 30 FPS
// =============================================================================

import { PerformanceMonitor, QualityLevel } from './performance.js';

/** @type {PerformanceMonitor} Singleton performance monitor shared with renderer */
const performanceManager = new PerformanceMonitor();
export { performanceManager };

// Target frame interval for 30 FPS (ms)
const TARGET_FRAME_MS = 1000 / 30;

// Minimum frame interval clamp (don't go faster than 60 FPS even if rAF fires faster)
const MIN_FRAME_MS = 1000 / 60;

class Renderer {
    constructor() {
        /** @type {HTMLCanvasElement|null} */
        this.canvas = null;

        /** @type {CanvasRenderingContext2D|null} */
        this.ctx = null;

        /** @type {HTMLVideoElement|null} */
        this.video = null;

        /** @type {Array<{name: string, render: Function, zOrder: number}>} */
        this.overlays = [];

        /** @type {boolean} */
        this.running = false;

        /** @type {number} Current measured FPS */
        this.fps = 0;

        /** @type {number} Frames counted in current second */
        this.frameCount = 0;

        /** @type {number} Timestamp of last FPS calculation */
        this.lastFpsUpdate = 0;

        /** @type {number} Last frame timestamp for delta time */
        this.lastFrameTime = 0;

        /** @type {number} rAF handle for cancellation */
        this._rafId = 0;

        /** @type {number} Detection count exposed for DOM update */
        this.detectionCount = 0;

        /** @type {Function|null} Bound render callback (cached to avoid allocation per frame) */
        this._boundRender = null;

        /** @type {Function|null} Bound resize handler */
        this._boundResize = null;

        console.log('[RENDERER] Renderer module loaded');
    }

    /**
     * Initialize the renderer with a video element.
     * Sets up the canvas to match the video's native resolution.
     *
     * @param {HTMLVideoElement} video - The video element providing camera frames
     */
    init(video) {
        this.video = video;
        this.canvas = document.getElementById('hud-canvas');

        if (!this.canvas) {
            console.error('[RENDERER] #hud-canvas element not found in DOM');
            throw new Error('#hud-canvas element not found');
        }

        this.ctx = this.canvas.getContext('2d', {
            alpha: false,           // Opaque canvas for performance
            desynchronized: true    // Hint: reduce latency by decoupling from DOM
        });

        if (!this.ctx) {
            throw new Error('Failed to get 2D rendering context');
        }

        // Match canvas to video resolution
        this._resizeCanvas();

        // Cache bound callbacks
        this._boundRender = this._renderFrame.bind(this);
        this._boundResize = this._resizeCanvas.bind(this);

        // Listen for orientation/resize changes
        window.addEventListener('resize', this._boundResize);
        window.addEventListener('orientationchange', () => {
            // Delay slightly so the browser has updated layout values
            setTimeout(this._boundResize, 100);
        });

        // Also re-check when video dimensions become available or change
        this.video.addEventListener('loadedmetadata', this._boundResize);
        this.video.addEventListener('resize', this._boundResize);

        console.log(`[RENDERER] Initialized - canvas: ${this.canvas.width}x${this.canvas.height}`);
    }

    /**
     * Register an overlay renderer to be called each frame.
     * Overlays are drawn in ascending zOrder (lower = drawn first = behind).
     *
     * Standard zOrder assignments:
     *   depth(1) -> terrain(2) -> detections(3) -> civilians(4) ->
     *   drones(5) -> suit(6) -> hud(7)
     *
     * @param {string} name - Unique name for this overlay
     * @param {Function} renderFn - Function(ctx, width, height, timestamp)
     * @param {number} zOrder - Drawing order (lower = behind)
     */
    registerOverlay(name, renderFn, zOrder) {
        // Remove existing overlay with same name to allow re-registration
        this.removeOverlay(name);

        this.overlays.push({
            name,
            render: renderFn,
            zOrder
        });

        // Sort ascending by zOrder so lowest draws first
        this.overlays.sort((a, b) => a.zOrder - b.zOrder);

        console.log(`[RENDERER] Overlay registered: "${name}" (z=${zOrder}), total: ${this.overlays.length}`);
    }

    /**
     * Remove a registered overlay by name.
     *
     * @param {string} name - The overlay name to remove
     */
    removeOverlay(name) {
        const idx = this.overlays.findIndex(o => o.name === name);
        if (idx !== -1) {
            this.overlays.splice(idx, 1);
            console.log(`[RENDERER] Overlay removed: "${name}"`);
        }
    }

    /**
     * Start the render loop.
     */
    start() {
        if (this.running) {
            console.warn('[RENDERER] Already running');
            return;
        }

        if (!this.canvas || !this.ctx || !this.video) {
            console.error('[RENDERER] Cannot start - not initialized. Call init(video) first.');
            return;
        }

        this.running = true;
        this.lastFrameTime = 0;
        this.lastFpsUpdate = 0;
        this.frameCount = 0;
        this.fps = 0;

        performanceManager.reset();

        console.log('[RENDERER] Render loop STARTED');
        this._rafId = requestAnimationFrame(this._boundRender);
    }

    /**
     * Stop the render loop.
     */
    stop() {
        this.running = false;

        if (this._rafId) {
            cancelAnimationFrame(this._rafId);
            this._rafId = 0;
        }

        console.log('[RENDERER] Render loop STOPPED');
    }

    /**
     * Get the HUD canvas element.
     * @returns {HTMLCanvasElement|null}
     */
    getCanvas() {
        return this.canvas;
    }

    /**
     * Get the 2D rendering context.
     * @returns {CanvasRenderingContext2D|null}
     */
    getContext() {
        return this.ctx;
    }

    /**
     * Get the current measured FPS.
     * @returns {number}
     */
    getFps() {
        return this.fps;
    }

    /**
     * Update the detection count (called by detection overlay modules).
     * @param {number} count
     */
    setDetectionCount(count) {
        this.detectionCount = count;
    }

    // =========================================================================
    // Private methods
    // =========================================================================

    /**
     * Main render frame callback - called by requestAnimationFrame.
     * @param {number} timestamp - High-resolution timestamp from rAF
     * @private
     */
    _renderFrame(timestamp) {
        if (!this.running) return;

        // Schedule next frame immediately so timing is consistent
        this._rafId = requestAnimationFrame(this._boundRender);

        // --- Frame rate limiting ---
        // Skip this frame if not enough time has elapsed for our target FPS
        if (this.lastFrameTime > 0) {
            const elapsed = timestamp - this.lastFrameTime;

            if (elapsed < MIN_FRAME_MS) {
                // Too fast - skip this frame entirely
                return;
            }

            // For 30 FPS target, we might skip frames on 60Hz displays.
            // But if performance is suffering, we render every available frame.
            const quality = performanceManager.getQuality();
            if (quality === QualityLevel.FULL || quality === QualityLevel.HIGH) {
                if (elapsed < TARGET_FRAME_MS * 0.9) {
                    // Under target interval and quality is good - skip to maintain 30 FPS
                    return;
                }
            }
            // At MEDIUM/LOW/MINIMAL we render every frame rAF gives us to
            // maximize measured FPS and allow quality to recover upward.
        }

        // --- Tick performance monitor ---
        performanceManager.tick(timestamp);

        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;

        // 1. Draw camera frame as base layer
        if (this.video.readyState >= this.video.HAVE_CURRENT_DATA) {
            ctx.drawImage(this.video, 0, 0, w, h);
        } else {
            // No video data yet - draw black background
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, w, h);
        }

        // 2. Call registered overlay renderers in zOrder
        const quality = performanceManager.getQuality();
        for (const overlay of this.overlays) {
            // At MINIMAL quality, skip HUD chrome overlays (zOrder >= 6)
            if (quality === QualityLevel.MINIMAL && overlay.zOrder >= 6) {
                continue;
            }

            try {
                overlay.render(ctx, w, h, timestamp);
            } catch (err) {
                console.error(`[RENDERER] Error in overlay "${overlay.name}":`, err);
            }
        }

        // 3. Track FPS
        this.frameCount++;
        if (timestamp - this.lastFpsUpdate >= 1000) {
            this.fps = this.frameCount;
            this.frameCount = 0;
            this.lastFpsUpdate = timestamp;
        }

        // 4. Update DOM-based HUD elements (throttled to avoid layout thrashing)
        // Update DOM every ~250ms (not every frame)
        if (!this._lastDomUpdate || timestamp - this._lastDomUpdate > 250) {
            this._updateDomElements();
            this._lastDomUpdate = timestamp;
        }

        this.lastFrameTime = timestamp;
    }

    /**
     * Update DOM-based HUD elements (clock, FPS, detection count).
     * These are HTML elements overlaid on the canvas, not drawn on it.
     * @private
     */
    _updateDomElements() {
        // --- FPS display ---
        const fpsEl = document.getElementById('fps-display');
        if (fpsEl) {
            const quality = performanceManager.getQuality();
            fpsEl.textContent = `${this.fps} FPS | ${quality}`;
        }

        // --- Clock (HH:MM:SS) ---
        const clockEl = document.getElementById('clock');
        if (clockEl) {
            const now = new Date();
            const hh = String(now.getHours()).padStart(2, '0');
            const mm = String(now.getMinutes()).padStart(2, '0');
            const ss = String(now.getSeconds()).padStart(2, '0');
            clockEl.textContent = `${hh}:${mm}:${ss}`;
        }

        // --- Detection count ---
        const detEl = document.getElementById('detection-count');
        if (detEl) {
            detEl.textContent = `${this.detectionCount} TGT`;
        }
    }

    /**
     * Resize the canvas to match the video element's native resolution.
     * Called on init and whenever window/orientation changes.
     * @private
     */
    _resizeCanvas() {
        if (!this.canvas || !this.video) return;

        const vw = this.video.videoWidth;
        const vh = this.video.videoHeight;

        if (vw > 0 && vh > 0) {
            if (this.canvas.width !== vw || this.canvas.height !== vh) {
                this.canvas.width = vw;
                this.canvas.height = vh;
                console.log(`[RENDERER] Canvas resized to ${vw}x${vh}`);
            }
        } else {
            // Video dimensions not yet available - use fallback
            const fallbackW = window.innerWidth * (window.devicePixelRatio || 1);
            const fallbackH = window.innerHeight * (window.devicePixelRatio || 1);
            if (this.canvas.width !== fallbackW || this.canvas.height !== fallbackH) {
                this.canvas.width = fallbackW;
                this.canvas.height = fallbackH;
                console.log(`[RENDERER] Canvas set to fallback: ${fallbackW}x${fallbackH}`);
            }
        }
    }
}

export const renderer = new Renderer();
