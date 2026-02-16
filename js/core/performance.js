// =============================================================================
// TALOS 2.0 - Performance Monitor & Adaptive Quality Controller
// Tracks FPS and dynamically adjusts processing quality to maintain framerate
// =============================================================================

/**
 * Quality levels in descending order of computational cost.
 * Each level defines what subsystems are active.
 */
export const QualityLevel = Object.freeze({
    FULL:    'FULL',     // All models: YOLO + Depth + SAM ready + full HUD
    HIGH:    'HIGH',     // Depth runs every 5th frame only
    MEDIUM:  'MEDIUM',   // No depth estimation at all
    LOW:     'LOW',      // Reduced YOLO input (240x240), no depth
    MINIMAL: 'MINIMAL'   // Detection only, no HUD chrome overlays
});

// Ordered from highest to lowest quality for traversal
const QUALITY_ORDER = [
    QualityLevel.FULL,
    QualityLevel.HIGH,
    QualityLevel.MEDIUM,
    QualityLevel.LOW,
    QualityLevel.MINIMAL
];

// FPS thresholds: if FPS drops below this, downgrade TO this level
const DOWNGRADE_THRESHOLDS = {
    10: QualityLevel.HIGH,
    7:  QualityLevel.MEDIUM,
    5:  QualityLevel.LOW,
    3:  QualityLevel.MINIMAL
};

// Sorted descending so we check the highest threshold first
const THRESHOLD_VALUES = [10, 7, 5, 3];

// Hysteresis: must exceed threshold + this margin for sustained period to upgrade
const UPGRADE_HYSTERESIS = 3;

// Number of consecutive frames above threshold needed to trigger an upgrade
const UPGRADE_SUSTAIN_FRAMES = 60;

// Rolling average window size
const FPS_WINDOW_SIZE = 30;

export class PerformanceMonitor {
    constructor() {
        /** @type {number[]} Rolling frame time buffer (ms) */
        this._frameTimes = [];

        /** @type {string} Current quality level */
        this._quality = QualityLevel.FULL;

        /** @type {number} Last timestamp from tick() */
        this._lastTime = 0;

        /** @type {number} Frames spent above upgrade threshold */
        this._upgradeCounter = 0;

        /** @type {number} Total frames processed */
        this._totalFrames = 0;

        /** @type {number} Current computed FPS */
        this._fps = 0;

        /** @type {number} Minimum FPS observed */
        this._minFps = Infinity;

        /** @type {number} Maximum FPS observed */
        this._maxFps = 0;

        /** @type {number} Time of first tick (for uptime) */
        this._startTime = 0;

        /** @type {number} Count of quality downgrades */
        this._downgradeCount = 0;

        /** @type {number} Count of quality upgrades */
        this._upgradeCount = 0;

        console.log('[PERF] Performance monitor initialized');
    }

    /**
     * Call once per frame to record timing and adjust quality.
     * Should be called at the top of each render loop iteration.
     *
     * @param {number} [timestamp] - Optional timestamp (ms). If omitted, uses performance.now()
     */
    tick(timestamp) {
        const now = timestamp !== undefined ? timestamp : performance.now();

        if (this._totalFrames === 0) {
            this._startTime = now;
        }

        if (this._lastTime > 0) {
            const delta = now - this._lastTime;

            // Guard against anomalous deltas (tab hidden, debugger pause, etc.)
            if (delta > 0 && delta < 5000) {
                this._frameTimes.push(delta);

                // Keep rolling window
                if (this._frameTimes.length > FPS_WINDOW_SIZE) {
                    this._frameTimes.shift();
                }

                // Compute rolling average FPS
                this._computeFps();

                // Adaptive quality control
                this._adjustQuality();
            }
        }

        this._lastTime = now;
        this._totalFrames++;
    }

    /**
     * Compute FPS from rolling average of frame times.
     * @private
     */
    _computeFps() {
        if (this._frameTimes.length === 0) {
            this._fps = 0;
            return;
        }

        const sum = this._frameTimes.reduce((a, b) => a + b, 0);
        const avgFrameTime = sum / this._frameTimes.length;
        this._fps = avgFrameTime > 0 ? 1000 / avgFrameTime : 0;

        // Track min/max after initial warmup (ignore first 30 frames)
        if (this._totalFrames > FPS_WINDOW_SIZE) {
            if (this._fps < this._minFps) this._minFps = this._fps;
            if (this._fps > this._maxFps) this._maxFps = this._fps;
        }
    }

    /**
     * Evaluate whether to downgrade or upgrade quality based on FPS.
     * @private
     */
    _adjustQuality() {
        const fps = this._fps;
        const currentIndex = QUALITY_ORDER.indexOf(this._quality);

        // --- DOWNGRADE CHECK ---
        // Check thresholds from highest to lowest.
        // If FPS is below a threshold, set quality to at least that level.
        for (const threshold of THRESHOLD_VALUES) {
            if (fps < threshold) {
                const targetLevel = DOWNGRADE_THRESHOLDS[threshold];
                const targetIndex = QUALITY_ORDER.indexOf(targetLevel);

                if (targetIndex > currentIndex) {
                    const oldQuality = this._quality;
                    this._quality = targetLevel;
                    this._upgradeCounter = 0;
                    this._downgradeCount++;
                    console.warn(
                        `[PERF] Quality DOWNGRADE: ${oldQuality} -> ${this._quality} ` +
                        `(FPS: ${fps.toFixed(1)} < ${threshold})`
                    );
                }
                return; // Don't check upgrade if we're below any threshold
            }
        }

        // --- UPGRADE CHECK ---
        // Only upgrade if we're not already at FULL quality
        if (currentIndex <= 0) {
            this._upgradeCounter = 0;
            return;
        }

        // Find what threshold corresponds to current quality level
        // We need FPS to exceed (threshold + hysteresis) to upgrade
        const upgradeTarget = this._getUpgradeThreshold();

        if (upgradeTarget !== null && fps > upgradeTarget + UPGRADE_HYSTERESIS) {
            this._upgradeCounter++;

            if (this._upgradeCounter >= UPGRADE_SUSTAIN_FRAMES) {
                const oldQuality = this._quality;
                this._quality = QUALITY_ORDER[currentIndex - 1];
                this._upgradeCounter = 0;
                this._upgradeCount++;
                console.log(
                    `[PERF] Quality UPGRADE: ${oldQuality} -> ${this._quality} ` +
                    `(FPS: ${fps.toFixed(1)} sustained for ${UPGRADE_SUSTAIN_FRAMES} frames)`
                );
            }
        } else {
            // Reset counter if FPS drops below upgrade threshold
            this._upgradeCounter = 0;
        }
    }

    /**
     * Get the FPS threshold that, if exceeded, would justify upgrading from current level.
     * @private
     * @returns {number|null}
     */
    _getUpgradeThreshold() {
        // Map quality levels to the threshold that triggered them
        switch (this._quality) {
            case QualityLevel.HIGH:    return 10;
            case QualityLevel.MEDIUM:  return 7;
            case QualityLevel.LOW:     return 5;
            case QualityLevel.MINIMAL: return 3;
            default: return null;
        }
    }

    /**
     * Get the current quality level.
     * @returns {string} One of QualityLevel values
     */
    getQuality() {
        return this._quality;
    }

    /**
     * Get current FPS (rolling average).
     * @returns {number}
     */
    getFPS() {
        return this._fps;
    }

    /**
     * Get comprehensive performance statistics.
     * @returns {{fps: number, quality: string, minFps: number, maxFps: number,
     *            totalFrames: number, uptime: number, downgrades: number,
     *            upgrades: number, upgradeProgress: number}}
     */
    getStats() {
        const now = performance.now();
        return {
            fps: Math.round(this._fps * 10) / 10,
            quality: this._quality,
            minFps: this._minFps === Infinity ? 0 : Math.round(this._minFps * 10) / 10,
            maxFps: Math.round(this._maxFps * 10) / 10,
            totalFrames: this._totalFrames,
            uptime: this._startTime > 0 ? Math.round((now - this._startTime) / 1000) : 0,
            downgrades: this._downgradeCount,
            upgrades: this._upgradeCount,
            upgradeProgress: Math.min(this._upgradeCounter / UPGRADE_SUSTAIN_FRAMES, 1)
        };
    }

    /**
     * Force a specific quality level (e.g., for user override).
     * @param {string} level - One of QualityLevel values
     */
    forceQuality(level) {
        if (QUALITY_ORDER.includes(level)) {
            console.log(`[PERF] Quality forced to: ${level}`);
            this._quality = level;
            this._upgradeCounter = 0;
        } else {
            console.error(`[PERF] Unknown quality level: ${level}`);
        }
    }

    /**
     * Reset all statistics (e.g., after model loading completes).
     */
    reset() {
        this._frameTimes = [];
        this._lastTime = 0;
        this._totalFrames = 0;
        this._fps = 0;
        this._minFps = Infinity;
        this._maxFps = 0;
        this._startTime = 0;
        this._upgradeCounter = 0;
        this._downgradeCount = 0;
        this._upgradeCount = 0;
        this._quality = QualityLevel.FULL;
        console.log('[PERF] Performance monitor reset');
    }
}
