// =============================================================================
// TALOS 2.0 - YOLOv10n Object Detector via ONNX Runtime Web
// Quantized INT8 model (2.5MB) with built-in NMS for maximum mobile speed
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

        /** @type {number} Confidence threshold */
        this._confThreshold = 0.25;

        // Reusable preprocessing buffers to avoid GC pressure
        this._prepCanvas = null;
        this._prepCtx = null;
        this._lastInputSize = 0;
    }

    /**
     * Initialize the YOLOv10n quantized model.
     * Tries WebGPU backend first, falls back to WASM.
     */
    async init() {
        console.log('[DETECTOR] Initializing YOLOv10n (quantized, 2.5MB)...');

        // YOLOv10n quantized: 2.5MB, built-in NMS, COCO 80 classes
        const modelPath = 'https://huggingface.co/onnx-community/yolov10n/resolve/main/onnx/model_quantized.onnx';

        const backends = ['webgpu', 'wasm'];

        for (const backend of backends) {
            try {
                console.log(`[DETECTOR] Attempting ${backend.toUpperCase()} backend...`);
                this._session = await ort.InferenceSession.create(modelPath, {
                    executionProviders: [backend],
                    graphOptimizationLevel: 'all'
                });
                this._backend = backend;
                this._ready = true;
                console.log(`[DETECTOR] YOLOv10n loaded (${backend.toUpperCase()})`);
                return true;
            } catch (err) {
                console.warn(`[DETECTOR] ${backend.toUpperCase()} failed:`, err.message);
            }
        }

        console.error('[DETECTOR] All backends failed.');
        return false;
    }

    /**
     * Run detection on an image frame.
     * YOLOv10n output: [1, 300, 6] where each row is [x1, y1, x2, y2, score, classId]
     * No NMS needed - YOLOv10 has it built in.
     */
    async detect(imageData, inputSize = 256) {
        if (!this._ready || !this._session) return [];

        try {
            const inputTensor = this._preprocess(imageData, inputSize);

            const feeds = {};
            feeds[this._session.inputNames[0]] = inputTensor;
            const results = await this._session.run(feeds);

            const output = results[this._session.outputNames[0]];
            return this._postprocess(output, imageData.width, imageData.height, inputSize);
        } catch (err) {
            console.error('[DETECTOR] Inference error:', err);
            return [];
        }
    }

    /**
     * Preprocess: resize to inputSize x inputSize, normalize to [0,1], NCHW layout.
     * Reuses canvas buffers to minimize allocations.
     */
    _preprocess(imageData, inputSize) {
        // Reuse preprocessing canvas
        if (!this._prepCanvas || this._lastInputSize !== inputSize) {
            this._prepCanvas = new OffscreenCanvas(inputSize, inputSize);
            this._prepCtx = this._prepCanvas.getContext('2d', { willReadFrequently: true });
            this._lastInputSize = inputSize;
        }

        // If imageData is already the right size, use directly
        if (imageData.width === inputSize && imageData.height === inputSize) {
            const pixels = imageData.data;
            const numPixels = inputSize * inputSize;
            const float32Data = new Float32Array(3 * numPixels);
            for (let i = 0; i < numPixels; i++) {
                const si = i * 4;
                float32Data[i] = pixels[si] / 255.0;
                float32Data[i + numPixels] = pixels[si + 1] / 255.0;
                float32Data[i + 2 * numPixels] = pixels[si + 2] / 255.0;
            }
            return new ort.Tensor('float32', float32Data, [1, 3, inputSize, inputSize]);
        }

        // Resize via canvas
        const srcCanvas = new OffscreenCanvas(imageData.width, imageData.height);
        srcCanvas.getContext('2d').putImageData(imageData, 0, 0);
        this._prepCtx.drawImage(srcCanvas, 0, 0, inputSize, inputSize);
        const resized = this._prepCtx.getImageData(0, 0, inputSize, inputSize);

        const pixels = resized.data;
        const numPixels = inputSize * inputSize;
        const float32Data = new Float32Array(3 * numPixels);
        for (let i = 0; i < numPixels; i++) {
            const si = i * 4;
            float32Data[i] = pixels[si] / 255.0;
            float32Data[i + numPixels] = pixels[si + 1] / 255.0;
            float32Data[i + 2 * numPixels] = pixels[si + 2] / 255.0;
        }
        return new ort.Tensor('float32', float32Data, [1, 3, inputSize, inputSize]);
    }

    /**
     * Post-process YOLOv10 output.
     * Output shape: [1, 300, 6] = [x1, y1, x2, y2, score, classId] per detection.
     * NMS is built into YOLOv10 - no additional NMS step needed.
     */
    _postprocess(output, origWidth, origHeight, inputSize) {
        const data = output.data;
        const shape = output.dims;
        const results = [];

        // Determine layout
        let numDetections, numFields;
        if (shape.length === 3) {
            numDetections = shape[1];
            numFields = shape[2];
        } else if (shape.length === 2) {
            numDetections = shape[0];
            numFields = shape[1];
        } else {
            console.error('[DETECTOR] Unexpected output shape:', shape);
            return [];
        }

        const scaleX = origWidth / inputSize;
        const scaleY = origHeight / inputSize;

        for (let i = 0; i < numDetections; i++) {
            const base = i * numFields;
            const x1 = data[base + 0];
            const y1 = data[base + 1];
            const x2 = data[base + 2];
            const y2 = data[base + 3];
            const score = data[base + 4];
            const classId = Math.round(data[base + 5]);

            // Filter by confidence
            if (score < this._confThreshold) continue;
            // Skip padding (all zeros)
            if (x1 === 0 && y1 === 0 && x2 === 0 && y2 === 0) continue;

            // Scale to original image coordinates, convert to [x, y, w, h]
            const bx = x1 * scaleX;
            const by = y1 * scaleY;
            const bw = (x2 - x1) * scaleX;
            const bh = (y2 - y1) * scaleY;

            results.push({
                classId,
                class: COCO_CLASSES[classId] || `class_${classId}`,
                tacticalClass: TACTICAL_MAP[classId] || 'OBJECT',
                score,
                bbox: [bx, by, bw, bh]
            });
        }

        return results;
    }

    isReady() { return this._ready; }
    getBackend() { return this._backend; }

    setThresholds(confidence) {
        if (confidence !== undefined) {
            this._confThreshold = Math.max(0, Math.min(1, confidence));
        }
    }

    async destroy() {
        if (this._session) {
            try { await this._session.release(); } catch {}
            this._session = null;
        }
        this._ready = false;
    }
}
