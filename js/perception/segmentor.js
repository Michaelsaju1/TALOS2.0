// =============================================================================
// TALOS 2.0 - MobileSAM On-Demand Segmentation
// Point-prompt segmentation using split encoder/decoder architecture
// =============================================================================

/**
 * SAM normalization constants.
 */
const SAM_MEAN = [123.675, 116.28, 103.53];  // RGB pixel means (0-255 scale)
const SAM_STD  = [58.395, 57.12, 57.375];    // RGB pixel stds (0-255 scale)

/**
 * SAM encoder input size.
 */
const ENCODER_SIZE = 1024;

export class Segmentor {
    constructor() {
        /** @type {ort.InferenceSession|null} */
        this._encoder = null;

        /** @type {ort.InferenceSession|null} */
        this._decoder = null;

        /** @type {boolean} */
        this._ready = false;

        /** @type {string} */
        this._backend = 'unknown';

        /** @type {ort.Tensor|null} Cached image embedding from encoder */
        this._cachedEmbedding = null;

        /** @type {number} Frame ID of cached embedding for invalidation */
        this._cachedFrameId = -1;

        /** @type {number} Monotonically increasing frame counter */
        this._frameCounter = 0;

        /** @type {number} Original image width when embedding was computed */
        this._origWidth = 0;

        /** @type {number} Original image height when embedding was computed */
        this._origHeight = 0;
    }

    /**
     * Initialize the MobileSAM encoder and decoder models.
     * Tries WebGPU first, falls back to WASM.
     *
     * @returns {Promise<boolean>} True if both models loaded successfully
     */
    async init() {
        console.log('[SEGMENT] Initializing MobileSAM segmentation...');

        const encoderPath = 'https://huggingface.co/Acly/MobileSAM/resolve/main/mobile_sam_image_encoder.onnx';
        const decoderPath = 'https://huggingface.co/Acly/MobileSAM/resolve/main/sam_mask_decoder_single.onnx';

        const backends = ['webgpu', 'wasm'];
        let loaded = false;

        for (const backend of backends) {
            try {
                console.log(`[SEGMENT] Attempting ${backend.toUpperCase()} backend...`);

                const options = {
                    executionProviders: [backend],
                    graphOptimizationLevel: 'all'
                };

                // Load encoder
                console.log('[SEGMENT] Loading encoder model...');
                this._encoder = await ort.InferenceSession.create(encoderPath, options);
                console.log(`[SEGMENT] Encoder loaded (${backend.toUpperCase()})`);
                console.log(`[SEGMENT] Encoder inputs: ${JSON.stringify(this._encoder.inputNames)}`);
                console.log(`[SEGMENT] Encoder outputs: ${JSON.stringify(this._encoder.outputNames)}`);

                // Load decoder
                console.log('[SEGMENT] Loading decoder model...');
                this._decoder = await ort.InferenceSession.create(decoderPath, options);
                console.log(`[SEGMENT] Decoder loaded (${backend.toUpperCase()})`);
                console.log(`[SEGMENT] Decoder inputs: ${JSON.stringify(this._decoder.inputNames)}`);
                console.log(`[SEGMENT] Decoder outputs: ${JSON.stringify(this._decoder.outputNames)}`);

                this._backend = backend;
                this._ready = true;
                loaded = true;

                console.log('[SEGMENT] MobileSAM fully initialized');
                break;
            } catch (err) {
                console.warn(`[SEGMENT] ${backend.toUpperCase()} backend failed:`, err.message);
                this._encoder = null;
                this._decoder = null;
            }
        }

        if (!loaded) {
            console.error('[SEGMENT] All backends failed. Segmentation unavailable.');
            this._ready = false;
            return false;
        }

        return true;
    }

    /**
     * Encode an image frame to produce an image embedding.
     * The embedding is cached so multiple segment() calls can reuse it.
     *
     * @param {ImageData} imageData - Raw pixel data from canvas
     * @returns {Promise<boolean>} True if encoding succeeded
     */
    async encode(imageData) {
        if (!this._ready || !this._encoder) {
            console.warn('[SEGMENT] Encoder not ready');
            return false;
        }

        try {
            this._frameCounter++;
            this._origWidth = imageData.width;
            this._origHeight = imageData.height;

            // Invalidate previous cache
            this._cachedEmbedding = null;
            this._cachedFrameId = -1;

            // Preprocess: resize to 1024x1024, normalize with SAM stats, NCHW
            const inputTensor = this._preprocessEncoder(imageData);

            // Run encoder
            const feeds = {};
            feeds[this._encoder.inputNames[0]] = inputTensor;
            const results = await this._encoder.run(feeds);

            // Cache the image embedding
            this._cachedEmbedding = results[this._encoder.outputNames[0]];
            this._cachedFrameId = this._frameCounter;

            console.log(`[SEGMENT] Frame encoded, embedding shape: ${JSON.stringify(this._cachedEmbedding.dims)}`);
            return true;
        } catch (err) {
            console.error('[SEGMENT] Encoding error:', err);
            this._cachedEmbedding = null;
            return false;
        }
    }

    /**
     * Segment a region around a point prompt using the cached embedding.
     * Call encode() first for the current frame.
     *
     * @param {number} pointX - X coordinate in original image space
     * @param {number} pointY - Y coordinate in original image space
     * @returns {Promise<{mask: Uint8Array, width: number, height: number}|null>}
     */
    async segment(pointX, pointY) {
        if (!this._ready || !this._decoder) {
            console.warn('[SEGMENT] Decoder not ready');
            return null;
        }

        if (!this._cachedEmbedding) {
            console.warn('[SEGMENT] No cached embedding. Call encode() first.');
            return null;
        }

        try {
            // Scale point coordinates from original image space to encoder input space (1024x1024)
            const scaledX = (pointX / this._origWidth) * ENCODER_SIZE;
            const scaledY = (pointY / this._origHeight) * ENCODER_SIZE;

            // Build decoder inputs
            const feeds = this._buildDecoderFeeds(scaledX, scaledY);

            // Run decoder
            const results = await this._decoder.run(feeds);

            // Get the mask output (find the first output that looks like a mask)
            const outputNames = this._decoder.outputNames;
            let maskOutput = null;

            for (const name of outputNames) {
                const tensor = results[name];
                // The mask output is typically the largest spatial output
                if (tensor.dims.length >= 2) {
                    const totalSize = tensor.dims.reduce((a, b) => a * b, 1);
                    if (!maskOutput || totalSize > maskOutput.dims.reduce((a, b) => a * b, 1)) {
                        maskOutput = tensor;
                    }
                }
            }

            if (!maskOutput) {
                console.error('[SEGMENT] No mask output found');
                return null;
            }

            // Post-process mask: threshold and resize to original dimensions
            const mask = this._postprocessMask(maskOutput);

            return {
                mask,
                width: this._origWidth,
                height: this._origHeight
            };
        } catch (err) {
            console.error('[SEGMENT] Segmentation error:', err);
            return null;
        }
    }

    /**
     * Preprocess image for SAM encoder.
     * Resize to 1024x1024, normalize with SAM mean/std, NCHW layout.
     *
     * @param {ImageData} imageData
     * @returns {ort.Tensor}
     * @private
     */
    _preprocessEncoder(imageData) {
        const { data, width, height } = imageData;

        // Create source canvas
        const srcCanvas = new OffscreenCanvas(width, height);
        const srcCtx = srcCanvas.getContext('2d');
        srcCtx.putImageData(imageData, 0, 0);

        // Resize to encoder input size
        const dstCanvas = new OffscreenCanvas(ENCODER_SIZE, ENCODER_SIZE);
        const dstCtx = dstCanvas.getContext('2d');
        dstCtx.drawImage(srcCanvas, 0, 0, ENCODER_SIZE, ENCODER_SIZE);

        const resized = dstCtx.getImageData(0, 0, ENCODER_SIZE, ENCODER_SIZE);
        const pixels = resized.data;
        const numPixels = ENCODER_SIZE * ENCODER_SIZE;
        const float32Data = new Float32Array(3 * numPixels);

        // Normalize: (pixel - mean) / std (SAM uses 0-255 scale for mean/std)
        for (let i = 0; i < numPixels; i++) {
            const srcIdx = i * 4;
            float32Data[i]                  = (pixels[srcIdx]     - SAM_MEAN[0]) / SAM_STD[0]; // R
            float32Data[i + numPixels]      = (pixels[srcIdx + 1] - SAM_MEAN[1]) / SAM_STD[1]; // G
            float32Data[i + 2 * numPixels]  = (pixels[srcIdx + 2] - SAM_MEAN[2]) / SAM_STD[2]; // B
        }

        return new ort.Tensor('float32', float32Data, [1, 3, ENCODER_SIZE, ENCODER_SIZE]);
    }

    /**
     * Build the feed dictionary for the MobileSAM decoder.
     *
     * @param {number} px - Point X in encoder space (0-1024)
     * @param {number} py - Point Y in encoder space (0-1024)
     * @returns {Object} Feed dictionary for decoder session
     * @private
     */
    _buildDecoderFeeds(px, py) {
        const feeds = {};

        // Image embedding from encoder
        // The decoder typically expects: image_embeddings, point_coords, point_labels,
        // mask_input, has_mask_input, orig_im_size

        // Try common input name patterns
        const inputNames = this._decoder.inputNames;

        for (const name of inputNames) {
            const lower = name.toLowerCase();

            if (lower.includes('image_embedding') || lower.includes('image_embed')) {
                feeds[name] = this._cachedEmbedding;
            } else if (lower.includes('point_coord') || lower.includes('points')) {
                // Point coordinates: [1, N, 2] where N = number of points
                // Include a background point as padding (SAM convention)
                feeds[name] = new ort.Tensor('float32', new Float32Array([px, py, 0, 0]), [1, 2, 2]);
            } else if (lower.includes('point_label') || lower.includes('labels')) {
                // Point labels: 1 = foreground, -1 = padding/background
                feeds[name] = new ort.Tensor('float32', new Float32Array([1, -1]), [1, 2]);
            } else if (lower.includes('mask_input') || lower === 'mask') {
                // No prior mask: zeros
                feeds[name] = new ort.Tensor('float32', new Float32Array(256 * 256).fill(0), [1, 1, 256, 256]);
            } else if (lower.includes('has_mask') || lower.includes('has_mask_input')) {
                // No prior mask flag
                feeds[name] = new ort.Tensor('float32', new Float32Array([0]), [1]);
            } else if (lower.includes('orig_im_size') || lower.includes('orig_size')) {
                // Original image size
                feeds[name] = new ort.Tensor('float32', new Float32Array([this._origHeight, this._origWidth]), [2]);
            }
        }

        // Fallback: if we didn't match some standard names, try positional assignment
        if (Object.keys(feeds).length < inputNames.length) {
            console.warn('[SEGMENT] Some decoder inputs not matched by name, attempting positional assignment');

            // Ensure embedding is assigned
            if (!feeds[inputNames[0]] && this._cachedEmbedding) {
                feeds[inputNames[0]] = this._cachedEmbedding;
            }
        }

        return feeds;
    }

    /**
     * Post-process decoder mask output.
     * Threshold logits to binary mask and resize to original image dimensions.
     *
     * @param {ort.Tensor} maskTensor
     * @returns {Uint8Array} Binary mask (0 or 255) at original resolution
     * @private
     */
    _postprocessMask(maskTensor) {
        const data = maskTensor.data;
        const dims = maskTensor.dims;

        // Mask shape could be [1, N, H, W] where N = number of mask options
        // We take the first (best) mask
        let maskH, maskW, offset;

        if (dims.length === 4) {
            maskH = dims[2];
            maskW = dims[3];
            offset = 0; // First mask
        } else if (dims.length === 3) {
            maskH = dims[1];
            maskW = dims[2];
            offset = 0;
        } else if (dims.length === 2) {
            maskH = dims[0];
            maskW = dims[1];
            offset = 0;
        } else {
            console.warn('[SEGMENT] Unexpected mask shape:', dims);
            return new Uint8Array(this._origWidth * this._origHeight);
        }

        // Threshold logits to binary at 0.0 (positive = foreground)
        const binaryMask = new Uint8Array(maskH * maskW);
        for (let i = 0; i < maskH * maskW; i++) {
            binaryMask[i] = data[offset + i] > 0.0 ? 255 : 0;
        }

        // Resize to original image dimensions using nearest neighbor
        // (for binary masks, nearest neighbor preserves sharp edges)
        if (maskH === this._origHeight && maskW === this._origWidth) {
            return binaryMask;
        }

        const resized = new Uint8Array(this._origWidth * this._origHeight);
        const scaleX = maskW / this._origWidth;
        const scaleY = maskH / this._origHeight;

        for (let y = 0; y < this._origHeight; y++) {
            const srcY = Math.min(Math.floor(y * scaleY), maskH - 1);
            for (let x = 0; x < this._origWidth; x++) {
                const srcX = Math.min(Math.floor(x * scaleX), maskW - 1);
                resized[y * this._origWidth + x] = binaryMask[srcY * maskW + srcX];
            }
        }

        return resized;
    }

    /**
     * Check if the segmentor is ready.
     * @returns {boolean}
     */
    isReady() {
        return this._ready;
    }

    /**
     * Check if there is a valid cached embedding for the current frame.
     * @returns {boolean}
     */
    hasEmbedding() {
        return this._cachedEmbedding !== null;
    }

    /**
     * Get the backend being used.
     * @returns {string}
     */
    getBackend() {
        return this._backend;
    }

    /**
     * Destroy sessions and free resources.
     */
    async destroy() {
        if (this._encoder) {
            try {
                await this._encoder.release();
            } catch (err) {
                console.warn('[SEGMENT] Error releasing encoder:', err);
            }
            this._encoder = null;
        }

        if (this._decoder) {
            try {
                await this._decoder.release();
            } catch (err) {
                console.warn('[SEGMENT] Error releasing decoder:', err);
            }
            this._decoder = null;
        }

        this._cachedEmbedding = null;
        this._ready = false;
        console.log('[SEGMENT] Segmentor destroyed');
    }
}
