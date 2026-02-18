// =============================================================================
// TALOS 2.0 - YOLO11n Object Detector via ONNX Runtime Web
// Real-time tactical object detection with COCO-to-tactical class mapping
// =============================================================================

/**
 * Tactical classification mapping from COCO class IDs.
 */
const TACTICAL_MAP = {
    0:  'PERSONNEL',
    1:  'LIGHT_VEHICLE',
    3:  'LIGHT_VEHICLE',
    2:  'VEHICLE',
    5:  'VEHICLE',
    7:  'VEHICLE',
    4:  'AIRCRAFT',
    8:  'WATERCRAFT',
    63: 'COMMS_EQUIPMENT',
    67: 'COMMS_EQUIPMENT',
    24: 'SUPPLY_PACK',
    28: 'SUPPLY_PACK',
    43: 'EDGED_WEAPON',
    76: 'EDGED_WEAPON'
};

/**
 * COCO class names (80 classes).
 */
const COCO_CLASSES = [
    'person', 'bicycle', 'car', 'motorcycle', 'airplane', 'bus', 'train', 'truck',
    'boat', 'traffic light', 'fire hydrant', 'stop sign', 'parking meter', 'bench',
    'bird', 'cat', 'dog', 'horse', 'sheep', 'cow', 'elephant', 'bear', 'zebra',
    'giraffe', 'backpack', 'umbrella', 'handbag', 'tie', 'suitcase', 'frisbee',
    'skis', 'snowboard', 'sports ball', 'kite', 'baseball bat', 'baseball glove',
    'skateboard', 'surfboard', 'tennis racket', 'bottle', 'wine glass', 'cup',
    'fork', 'knife', 'spoon', 'bowl', 'banana', 'apple', 'sandwich', 'orange',
    'broccoli', 'carrot', 'hot dog', 'pizza', 'donut', 'cake', 'chair', 'couch',
    'potted plant', 'bed', 'dining table', 'toilet', 'tv', 'laptop', 'mouse',
    'remote', 'keyboard', 'cell phone', 'microwave', 'oven', 'toaster', 'sink',
    'refrigerator', 'book', 'clock', 'vase', 'scissors', 'teddy bear', 'hair drier',
    'toothbrush'
];

export class Detector {
    constructor() {
        /** @type {ort.InferenceSession|null} */
        this._session = null;

        /** @type {boolean} */
        this._ready = false;

        /** @type {string} */
        this._backend = 'unknown';

        /** @type {number} NMS IoU threshold */
        this._iouThreshold = 0.45;

        /** @type {number} Confidence threshold */
        this._confThreshold = 0.25;
    }

    /**
     * Initialize the YOLO11n model.
     * Tries WebGPU backend first, falls back to WASM.
     *
     * @returns {Promise<boolean>} True if model loaded successfully
     */
    async init() {
        console.log('[DETECTOR] Initializing YOLO11n object detection...');

        const modelPath = 'https://huggingface.co/deepghs/yolos/resolve/main/yolo11n/model.onnx';

        // Try WebGPU first for maximum performance
        const backends = ['webgpu', 'wasm'];

        for (const backend of backends) {
            try {
                console.log(`[DETECTOR] Attempting ${backend.toUpperCase()} backend...`);

                const options = {
                    executionProviders: [backend],
                    graphOptimizationLevel: 'all'
                };

                this._session = await ort.InferenceSession.create(modelPath, options);
                this._backend = backend;
                this._ready = true;

                console.log(`[DETECTOR] YOLO11n loaded successfully (${backend.toUpperCase()})`);
                console.log(`[DETECTOR] Input: ${JSON.stringify(this._session.inputNames)}`);
                console.log(`[DETECTOR] Output: ${JSON.stringify(this._session.outputNames)}`);

                return true;
            } catch (err) {
                console.warn(`[DETECTOR] ${backend.toUpperCase()} backend failed:`, err.message);
            }
        }

        console.error('[DETECTOR] All backends failed. Detection unavailable.');
        this._ready = false;
        return false;
    }

    /**
     * Run detection on an image frame.
     *
     * @param {ImageData} imageData - Raw pixel data from canvas
     * @param {number} [inputSize=640] - Model input size (square)
     * @returns {Promise<Array<{class: string, tacticalClass: string, score: number,
     *           bbox: number[], classId: number}>>}
     */
    async detect(imageData, inputSize = 320) {
        if (!this._ready || !this._session) {
            return [];
        }

        try {
            // Preprocess: resize, normalize, NCHW
            const inputTensor = this._preprocess(imageData, inputSize);

            // Run inference
            const feeds = {};
            feeds[this._session.inputNames[0]] = inputTensor;
            const results = await this._session.run(feeds);

            // Get output tensor
            const output = results[this._session.outputNames[0]];

            // Post-process: parse detections and apply NMS
            const detections = this._postprocess(
                output,
                imageData.width,
                imageData.height,
                inputSize
            );

            return detections;
        } catch (err) {
            console.error('[DETECTOR] Inference error:', err);
            return [];
        }
    }

    /**
     * Preprocess an ImageData into a normalized NCHW Float32 tensor.
     *
     * @param {ImageData} imageData
     * @param {number} inputSize
     * @returns {ort.Tensor}
     * @private
     */
    _preprocess(imageData, inputSize) {
        const { data, width, height } = imageData;

        // Use an offscreen canvas to resize
        const canvas = new OffscreenCanvas(inputSize, inputSize);
        const ctx = canvas.getContext('2d');

        // Create temporary canvas with the source image
        const srcCanvas = new OffscreenCanvas(width, height);
        const srcCtx = srcCanvas.getContext('2d');
        srcCtx.putImageData(imageData, 0, 0);

        // Draw resized (letterboxing could be added, but YOLO handles stretch)
        ctx.drawImage(srcCanvas, 0, 0, inputSize, inputSize);
        const resized = ctx.getImageData(0, 0, inputSize, inputSize);

        // Convert to NCHW float32 normalized to [0, 1]
        const pixels = resized.data;
        const numPixels = inputSize * inputSize;
        const float32Data = new Float32Array(3 * numPixels);

        for (let i = 0; i < numPixels; i++) {
            const srcIdx = i * 4;
            float32Data[i]                  = pixels[srcIdx]     / 255.0; // R
            float32Data[i + numPixels]      = pixels[srcIdx + 1] / 255.0; // G
            float32Data[i + 2 * numPixels]  = pixels[srcIdx + 2] / 255.0; // B
        }

        return new ort.Tensor('float32', float32Data, [1, 3, inputSize, inputSize]);
    }

    /**
     * Post-process YOLO output tensor into detection objects.
     * YOLO11 output shape: [1, 84, 8400] (transposed from older YOLO formats)
     *   - 84 = 4 bbox coords (cx, cy, w, h) + 80 class scores
     *   - 8400 = number of detection candidates
     *
     * @param {ort.Tensor} output
     * @param {number} origWidth - Original image width
     * @param {number} origHeight - Original image height
     * @param {number} inputSize - Model input size used
     * @returns {Array}
     * @private
     */
    _postprocess(output, origWidth, origHeight, inputSize) {
        const data = output.data;
        const shape = output.dims;

        // YOLO11 outputs [1, 84, 8400]
        // We need to handle both [1, 84, N] and [1, N, 84] formats
        let numDetections, numChannels;

        if (shape.length === 3) {
            if (shape[1] === 84) {
                // Shape: [1, 84, N] - standard YOLO11 format
                numChannels = shape[1];
                numDetections = shape[2];
            } else if (shape[2] === 84) {
                // Shape: [1, N, 84] - transposed format
                numChannels = shape[2];
                numDetections = shape[1];
            } else {
                // Try to figure it out: the smaller dim is likely channels
                if (shape[1] < shape[2]) {
                    numChannels = shape[1];
                    numDetections = shape[2];
                } else {
                    numChannels = shape[2];
                    numDetections = shape[1];
                }
            }
        } else {
            console.error('[DETECTOR] Unexpected output shape:', shape);
            return [];
        }

        const numClasses = numChannels - 4;
        const isTransposed = shape[1] === numChannels; // [1, 84, N] format

        const scaleX = origWidth / inputSize;
        const scaleY = origHeight / inputSize;

        const candidates = [];

        for (let i = 0; i < numDetections; i++) {
            // Extract bbox and class scores depending on layout
            let cx, cy, w, h;
            let maxScore = 0;
            let maxClassId = 0;

            if (isTransposed) {
                // [1, 84, N]: data[channel * N + detection]
                cx = data[0 * numDetections + i];
                cy = data[1 * numDetections + i];
                w  = data[2 * numDetections + i];
                h  = data[3 * numDetections + i];

                for (let c = 0; c < numClasses; c++) {
                    const score = data[(4 + c) * numDetections + i];
                    if (score > maxScore) {
                        maxScore = score;
                        maxClassId = c;
                    }
                }
            } else {
                // [1, N, 84]: data[detection * 84 + channel]
                const base = i * numChannels;
                cx = data[base + 0];
                cy = data[base + 1];
                w  = data[base + 2];
                h  = data[base + 3];

                for (let c = 0; c < numClasses; c++) {
                    const score = data[base + 4 + c];
                    if (score > maxScore) {
                        maxScore = score;
                        maxClassId = c;
                    }
                }
            }

            // Filter by confidence
            if (maxScore < this._confThreshold) continue;

            // Convert from center format to x,y,w,h and scale to original image
            const x = (cx - w / 2) * scaleX;
            const y = (cy - h / 2) * scaleY;
            const bw = w * scaleX;
            const bh = h * scaleY;

            candidates.push({
                classId: maxClassId,
                class: COCO_CLASSES[maxClassId] || `class_${maxClassId}`,
                tacticalClass: TACTICAL_MAP[maxClassId] || 'OBJECT',
                score: maxScore,
                bbox: [x, y, bw, bh]
            });
        }

        // Apply Non-Maximum Suppression per class
        return this._nms(candidates);
    }

    /**
     * Non-Maximum Suppression: remove overlapping detections.
     * Applied per tactical class to allow overlapping boxes of different classes.
     *
     * @param {Array} detections
     * @returns {Array}
     * @private
     */
    _nms(detections) {
        if (detections.length === 0) return [];

        // Group by classId
        const groups = {};
        for (const det of detections) {
            if (!groups[det.classId]) groups[det.classId] = [];
            groups[det.classId].push(det);
        }

        const results = [];

        for (const classId in groups) {
            const dets = groups[classId];

            // Sort by score descending
            dets.sort((a, b) => b.score - a.score);

            const kept = [];
            const suppressed = new Set();

            for (let i = 0; i < dets.length; i++) {
                if (suppressed.has(i)) continue;
                kept.push(dets[i]);

                for (let j = i + 1; j < dets.length; j++) {
                    if (suppressed.has(j)) continue;
                    if (this._iou(dets[i].bbox, dets[j].bbox) > this._iouThreshold) {
                        suppressed.add(j);
                    }
                }
            }

            results.push(...kept);
        }

        // Sort all results by score descending
        results.sort((a, b) => b.score - a.score);
        return results;
    }

    /**
     * Compute Intersection over Union between two boxes [x, y, w, h].
     *
     * @param {number[]} a
     * @param {number[]} b
     * @returns {number}
     * @private
     */
    _iou(a, b) {
        const x1 = Math.max(a[0], b[0]);
        const y1 = Math.max(a[1], b[1]);
        const x2 = Math.min(a[0] + a[2], b[0] + b[2]);
        const y2 = Math.min(a[1] + a[3], b[1] + b[3]);

        const interW = Math.max(0, x2 - x1);
        const interH = Math.max(0, y2 - y1);
        const inter = interW * interH;

        const areaA = a[2] * a[3];
        const areaB = b[2] * b[3];
        const union = areaA + areaB - inter;

        return union > 0 ? inter / union : 0;
    }

    /**
     * Check if the detector is ready.
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
     * Update detection thresholds at runtime.
     * @param {number} [confidence] - Confidence threshold (0-1)
     * @param {number} [iou] - NMS IoU threshold (0-1)
     */
    setThresholds(confidence, iou) {
        if (confidence !== undefined) {
            this._confThreshold = Math.max(0, Math.min(1, confidence));
            console.log(`[DETECTOR] Confidence threshold set to ${this._confThreshold}`);
        }
        if (iou !== undefined) {
            this._iouThreshold = Math.max(0, Math.min(1, iou));
            console.log(`[DETECTOR] NMS IoU threshold set to ${this._iouThreshold}`);
        }
    }

    /**
     * Destroy session and free resources.
     */
    async destroy() {
        if (this._session) {
            try {
                await this._session.release();
            } catch (err) {
                console.warn('[DETECTOR] Error releasing session:', err);
            }
            this._session = null;
        }
        this._ready = false;
        console.log('[DETECTOR] Detector destroyed');
    }
}
