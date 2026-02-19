// =============================================================================
// TALOS 2.0 - Depth Anything V2 Small Monocular Depth Estimator
// Relative depth estimation with optional metric calibration via known objects
// =============================================================================

/**
 * Known real-world sizes (meters) for metric depth calibration.
 * Used to convert relative depth to absolute distance when known objects are detected.
 */
const KNOWN_SIZES = {
    person:     1.7,
    car:        4.5,
    truck:      6.0,
    bicycle:    1.8
};

/**
 * ImageNet normalization constants used by Depth Anything V2.
 */
const IMAGENET_MEAN = [0.485, 0.456, 0.406];
const IMAGENET_STD  = [0.229, 0.224, 0.225];

/**
 * Default model input resolution for Depth Anything V2 Small.
 */
const MODEL_INPUT_SIZE = 518;

export class DepthEstimator {
    constructor() {
        /** @type {ort.InferenceSession|null} */
        this._session = null;

        /** @type {boolean} */
        this._ready = false;

        /** @type {string} */
        this._backend = 'unknown';

        /** @type {number} Current meters-per-unit calibration factor */
        this._metersPerUnit = 1.0;

        /** @type {boolean} Whether depth output needs inversion (lower=farther -> higher=farther) */
        this._invertDepth = true;
    }

    /**
     * Initialize the Depth Anything V2 Small model.
     * Tries WebGPU first, falls back to WASM.
     *
     * @returns {Promise<boolean>} True if loaded successfully
     */
    async init() {
        console.log('[DEPTH] Initializing Depth Anything V2 Small...');

        // Lazy-load ONNX Runtime if not already loaded
        if (typeof ort === 'undefined') {
            console.log('[DEPTH] Loading ONNX Runtime Web...');
            await new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.20.1/dist/ort.min.js';
                script.onload = resolve;
                script.onerror = reject;
                document.head.appendChild(script);
            });
        }

        const modelPath = 'https://huggingface.co/onnx-community/depth-anything-v2-small/resolve/main/onnx/model_quantized.onnx';
        const backends = ['webgpu', 'wasm'];

        for (const backend of backends) {
            try {
                console.log(`[DEPTH] Attempting ${backend.toUpperCase()} backend...`);

                const options = {
                    executionProviders: [backend],
                    graphOptimizationLevel: 'all'
                };

                this._session = await ort.InferenceSession.create(modelPath, options);
                this._backend = backend;
                this._ready = true;

                console.log(`[DEPTH] Depth Anything V2 loaded successfully (${backend.toUpperCase()})`);
                console.log(`[DEPTH] Input: ${JSON.stringify(this._session.inputNames)}`);
                console.log(`[DEPTH] Output: ${JSON.stringify(this._session.outputNames)}`);

                return true;
            } catch (err) {
                console.warn(`[DEPTH] ${backend.toUpperCase()} backend failed:`, err.message);
            }
        }

        console.error('[DEPTH] All backends failed. Depth estimation unavailable.');
        this._ready = false;
        return false;
    }

    /**
     * Estimate depth from a camera frame.
     *
     * @param {ImageData} imageData - Raw pixel data from canvas
     * @param {Array} [detections] - Optional detections for metric calibration.
     *   Each should have { class: string, bbox: [x,y,w,h] }
     * @returns {Promise<{depthMap: Float32Array, width: number, height: number, metersPerUnit: number}|null>}
     */
    async estimate(imageData, detections) {
        if (!this._ready || !this._session) {
            return null;
        }

        try {
            const { width, height } = imageData;

            // Preprocess: resize to 518x518, normalize with ImageNet stats, NCHW
            const inputTensor = this._preprocess(imageData);

            // Run inference
            const feeds = {};
            feeds[this._session.inputNames[0]] = inputTensor;
            const results = await this._session.run(feeds);

            // Get output
            const output = results[this._session.outputNames[0]];
            const rawDepth = output.data;
            const outDims = output.dims;

            // Output is typically [1, 518, 518] or [1, 1, 518, 518]
            const depthH = outDims.length === 4 ? outDims[2] : outDims[1];
            const depthW = outDims.length === 4 ? outDims[3] : outDims[2];

            // Normalize raw depth to 0-1 range
            const normalizedDepth = this._normalizeDepth(rawDepth);

            // Resize depth map to original camera resolution
            const resizedDepth = this._resizeDepthMap(normalizedDepth, depthW, depthH, width, height);

            // Metric calibration if detections with known sizes are available
            if (detections && detections.length > 0) {
                this._calibrateMetric(resizedDepth, width, height, detections);
            }

            return {
                depthMap: resizedDepth,
                width,
                height,
                metersPerUnit: this._metersPerUnit
            };
        } catch (err) {
            console.error('[DEPTH] Estimation error:', err);
            return null;
        }
    }

    /**
     * Preprocess image for Depth Anything V2.
     * Resize to 518x518, normalize with ImageNet mean/std, NCHW layout.
     *
     * @param {ImageData} imageData
     * @returns {ort.Tensor}
     * @private
     */
    _preprocess(imageData) {
        const { data, width, height } = imageData;

        // Create source canvas
        const srcCanvas = new OffscreenCanvas(width, height);
        const srcCtx = srcCanvas.getContext('2d');
        srcCtx.putImageData(imageData, 0, 0);

        // Resize to model input size
        const dstCanvas = new OffscreenCanvas(MODEL_INPUT_SIZE, MODEL_INPUT_SIZE);
        const dstCtx = dstCanvas.getContext('2d');
        dstCtx.drawImage(srcCanvas, 0, 0, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE);

        const resized = dstCtx.getImageData(0, 0, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE);
        const pixels = resized.data;
        const numPixels = MODEL_INPUT_SIZE * MODEL_INPUT_SIZE;
        const float32Data = new Float32Array(3 * numPixels);

        // Normalize to ImageNet stats: (pixel/255 - mean) / std, NCHW
        for (let i = 0; i < numPixels; i++) {
            const srcIdx = i * 4;
            float32Data[i]                  = ((pixels[srcIdx]     / 255.0) - IMAGENET_MEAN[0]) / IMAGENET_STD[0]; // R
            float32Data[i + numPixels]      = ((pixels[srcIdx + 1] / 255.0) - IMAGENET_MEAN[1]) / IMAGENET_STD[1]; // G
            float32Data[i + 2 * numPixels]  = ((pixels[srcIdx + 2] / 255.0) - IMAGENET_MEAN[2]) / IMAGENET_STD[2]; // B
        }

        return new ort.Tensor('float32', float32Data, [1, 3, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE]);
    }

    /**
     * Normalize raw depth output to 0-1 range.
     * Convention: higher value = farther away.
     *
     * @param {Float32Array|number[]} rawDepth
     * @returns {Float32Array}
     * @private
     */
    _normalizeDepth(rawDepth) {
        let min = Infinity;
        let max = -Infinity;

        for (let i = 0; i < rawDepth.length; i++) {
            if (rawDepth[i] < min) min = rawDepth[i];
            if (rawDepth[i] > max) max = rawDepth[i];
        }

        const range = max - min;
        const normalized = new Float32Array(rawDepth.length);

        if (range < 1e-6) {
            // Uniform depth - fill with 0.5
            normalized.fill(0.5);
            return normalized;
        }

        for (let i = 0; i < rawDepth.length; i++) {
            let val = (rawDepth[i] - min) / range;

            // Depth Anything typically outputs lower values for farther objects.
            // Invert so higher = farther (consistent with real-world distance).
            if (this._invertDepth) {
                val = 1.0 - val;
            }

            normalized[i] = val;
        }

        return normalized;
    }

    /**
     * Bilinear resize of a depth map from model output size to target size.
     *
     * @param {Float32Array} depthMap
     * @param {number} srcW
     * @param {number} srcH
     * @param {number} dstW
     * @param {number} dstH
     * @returns {Float32Array}
     * @private
     */
    _resizeDepthMap(depthMap, srcW, srcH, dstW, dstH) {
        const output = new Float32Array(dstW * dstH);

        const scaleX = srcW / dstW;
        const scaleY = srcH / dstH;

        for (let y = 0; y < dstH; y++) {
            for (let x = 0; x < dstW; x++) {
                // Map destination pixel to source coordinates
                const srcX = x * scaleX;
                const srcY = y * scaleY;

                // Bilinear interpolation
                const x0 = Math.floor(srcX);
                const y0 = Math.floor(srcY);
                const x1 = Math.min(x0 + 1, srcW - 1);
                const y1 = Math.min(y0 + 1, srcH - 1);

                const fx = srcX - x0;
                const fy = srcY - y0;

                const v00 = depthMap[y0 * srcW + x0];
                const v10 = depthMap[y0 * srcW + x1];
                const v01 = depthMap[y1 * srcW + x0];
                const v11 = depthMap[y1 * srcW + x1];

                const val = v00 * (1 - fx) * (1 - fy)
                          + v10 * fx * (1 - fy)
                          + v01 * (1 - fx) * fy
                          + v11 * fx * fy;

                output[y * dstW + x] = val;
            }
        }

        return output;
    }

    /**
     * Calibrate relative depth to metric depth using detected objects with known sizes.
     * Estimates metersPerUnit by comparing known object heights to their apparent
     * depth and bounding box size.
     *
     * @param {Float32Array} depthMap - Depth map at camera resolution
     * @param {number} mapWidth
     * @param {number} mapHeight
     * @param {Array} detections - Array of { class, bbox: [x,y,w,h] }
     * @private
     */
    _calibrateMetric(depthMap, mapWidth, mapHeight, detections) {
        const calibrationSamples = [];

        for (const det of detections) {
            const knownSize = KNOWN_SIZES[det.class];
            if (!knownSize) continue;

            const [bx, by, bw, bh] = det.bbox;

            // Sample depth at the center of the detection
            const cx = Math.round(Math.min(Math.max(bx + bw / 2, 0), mapWidth - 1));
            const cy = Math.round(Math.min(Math.max(by + bh / 2, 0), mapHeight - 1));
            const depthVal = depthMap[cy * mapWidth + cx];

            if (depthVal < 0.01) continue; // Skip very close objects (might be noise)

            // The apparent size in pixels relates to distance via:
            //   realSize / pixelSize ~ depth * focalLengthRelated
            // For calibration, we use the ratio: object height in pixels vs known height
            // Higher depth value + larger known object = larger metersPerUnit
            const pixelSize = bh; // Use height as it's more stable
            if (pixelSize < 10) continue; // Too small to calibrate from

            // Simple model: distance proportional to (known_size * image_height) / pixel_size
            // Then metersPerUnit = estimated_distance / depth_value
            const estimatedDistance = (knownSize * mapHeight) / pixelSize;
            const sample = estimatedDistance / Math.max(depthVal, 0.01);

            calibrationSamples.push(sample);
        }

        if (calibrationSamples.length > 0) {
            // Use median for robustness against outliers
            calibrationSamples.sort((a, b) => a - b);
            const median = calibrationSamples[Math.floor(calibrationSamples.length / 2)];

            // Exponential moving average to smooth calibration over time
            this._metersPerUnit = this._metersPerUnit * 0.7 + median * 0.3;
        }
    }

    /**
     * Get estimated distance in meters for a specific pixel.
     *
     * @param {Float32Array} depthMap
     * @param {number} x - Pixel X coordinate
     * @param {number} y - Pixel Y coordinate
     * @param {number} width - Depth map width
     * @returns {number} Estimated distance in meters
     */
    getDistanceAt(depthMap, x, y, width) {
        if (!depthMap) return -1;
        const idx = Math.round(y) * width + Math.round(x);
        if (idx < 0 || idx >= depthMap.length) return -1;
        return depthMap[idx] * this._metersPerUnit;
    }

    /**
     * Get average depth within a bounding box.
     *
     * @param {Float32Array} depthMap
     * @param {number[]} bbox - [x, y, w, h]
     * @param {number} mapWidth
     * @returns {number} Average depth value (raw, multiply by metersPerUnit for meters)
     */
    getAverageDepthInBox(depthMap, bbox, mapWidth) {
        if (!depthMap) return -1;

        const [bx, by, bw, bh] = bbox;
        const x0 = Math.max(0, Math.round(bx));
        const y0 = Math.max(0, Math.round(by));
        const x1 = Math.min(mapWidth - 1, Math.round(bx + bw));
        const mapHeight = depthMap.length / mapWidth;
        const y1 = Math.min(mapHeight - 1, Math.round(by + bh));

        let sum = 0;
        let count = 0;

        // Sample center region (avoid edges which may include background)
        const margin = Math.min(bw, bh) * 0.2;
        const sx0 = Math.round(x0 + margin);
        const sy0 = Math.round(y0 + margin);
        const sx1 = Math.round(x1 - margin);
        const sy1 = Math.round(y1 - margin);

        for (let y = sy0; y <= sy1; y++) {
            for (let x = sx0; x <= sx1; x++) {
                const idx = y * mapWidth + x;
                if (idx >= 0 && idx < depthMap.length) {
                    sum += depthMap[idx];
                    count++;
                }
            }
        }

        return count > 0 ? sum / count : -1;
    }

    /**
     * Check if the estimator is ready.
     * @returns {boolean}
     */
    isReady() {
        return this._ready;
    }

    /**
     * Get the backend being used.
     * @returns {string}
     */
    getBackend() {
        return this._backend;
    }

    /**
     * Destroy session and free resources.
     */
    async destroy() {
        if (this._session) {
            try {
                await this._session.release();
            } catch (err) {
                console.warn('[DEPTH] Error releasing session:', err);
            }
            this._session = null;
        }
        this._ready = false;
        console.log('[DEPTH] Depth estimator destroyed');
    }
}
