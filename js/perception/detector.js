// =============================================================================
// TALOS 2.0 - Object Detector via TensorFlow.js COCO-SSD
// Uses WebGL backend for fast inference directly on video element
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

export class Detector {
    constructor() {
        this._model = null;
        this._ready = false;
        this._backend = 'unknown';
        this._confThreshold = 0.3;
    }

    /**
     * Initialize COCO-SSD model via TF.js.
     * Uses lite_mobilenet_v2 for maximum speed on mobile.
     */
    async init() {
        console.log('[DETECTOR] Initializing COCO-SSD (TF.js WebGL)...');

        try {
            // Set WebGL backend for Safari GPU acceleration
            await tf.setBackend('webgl');
            await tf.ready();
            this._backend = tf.getBackend();
            console.log(`[DETECTOR] TF.js backend: ${this._backend}`);

            // Load the lightweight model variant for speed
            this._model = await cocoSsd.load({
                base: 'lite_mobilenet_v2'
            });

            this._ready = true;
            console.log('[DETECTOR] COCO-SSD loaded successfully');
            return true;
        } catch (err) {
            console.error('[DETECTOR] Failed to load:', err.message);
            this._ready = false;
            return false;
        }
    }

    /**
     * Run detection directly on a video element or canvas.
     * TF.js COCO-SSD handles all preprocessing internally.
     * No getImageData needed - reads directly from GPU texture.
     *
     * @param {HTMLVideoElement|HTMLCanvasElement|ImageData} source
     * @returns {Promise<Array>}
     */
    async detect(source) {
        if (!this._ready || !this._model) return [];

        try {
            // COCO-SSD returns: [{ bbox: [x, y, w, h], class: string, score: number }]
            const predictions = await this._model.detect(source, 20, this._confThreshold);

            return predictions.map(p => ({
                classId: this._classNameToId(p.class),
                class: p.class,
                tacticalClass: TACTICAL_MAP[p.class] || 'OBJECT',
                score: p.score,
                bbox: p.bbox  // [x, y, width, height] in pixel coordinates
            }));
        } catch (err) {
            console.error('[DETECTOR] Inference error:', err);
            return [];
        }
    }

    _classNameToId(name) {
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
        return COCO_CLASSES.indexOf(name);
    }

    isReady() { return this._ready; }
    getBackend() { return this._backend; }

    setThresholds(confidence) {
        if (confidence !== undefined) {
            this._confThreshold = Math.max(0, Math.min(1, confidence));
        }
    }

    async destroy() {
        if (this._model) {
            this._model.dispose?.();
            this._model = null;
        }
        this._ready = false;
    }
}
