// TALOS 2.0 - Depth Visualization + Segmentation Mask Overlays
// Renders depth maps and SAM masks as semi-transparent canvas overlays

// Cached depth visualization
let depthImageData = null;
let depthFrameId = -1;
let depthCanvas = null;
let depthCtx = null;

// Depth color palette (pre-computed for performance)
const DEPTH_PALETTE = new Uint8Array(256 * 3);
(function initPalette() {
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    // Close (warm/red) → Mid (yellow) → Far (cool/blue)
    if (t < 0.33) {
      const s = t / 0.33;
      DEPTH_PALETTE[i * 3] = Math.round(255 * (1 - s * 0.5));
      DEPTH_PALETTE[i * 3 + 1] = Math.round(80 * s);
      DEPTH_PALETTE[i * 3 + 2] = Math.round(30 * s);
    } else if (t < 0.66) {
      const s = (t - 0.33) / 0.33;
      DEPTH_PALETTE[i * 3] = Math.round(128 * (1 - s));
      DEPTH_PALETTE[i * 3 + 1] = Math.round(80 + 100 * s);
      DEPTH_PALETTE[i * 3 + 2] = Math.round(30 + 100 * s);
    } else {
      const s = (t - 0.66) / 0.34;
      DEPTH_PALETTE[i * 3] = Math.round(40 * (1 - s));
      DEPTH_PALETTE[i * 3 + 1] = Math.round(180 * (1 - s * 0.3));
      DEPTH_PALETTE[i * 3 + 2] = Math.round(130 + 125 * s);
    }
  }
})();

/**
 * Render depth map as color gradient overlay
 * @param {CanvasRenderingContext2D} ctx - Main canvas context
 * @param {number} w - Canvas width
 * @param {number} h - Canvas height
 * @param {Float32Array} depthMap - Normalized 0-1 depth values
 * @param {number} depthWidth - Depth map width
 * @param {number} depthHeight - Depth map height
 * @param {number} opacity - Overlay opacity (0.15-0.25 recommended)
 * @param {number} frameId - Frame counter to detect changes
 */
export function renderDepthOverlay(ctx, w, h, depthMap, depthWidth, depthHeight, opacity = 0.2, frameId = 0) {
  if (!depthMap || depthMap.length === 0) return;

  // Only regenerate colored image when depth data changes
  if (frameId !== depthFrameId || !depthCanvas) {
    depthFrameId = frameId;

    // Create/resize offscreen canvas
    if (!depthCanvas || depthCanvas.width !== depthWidth || depthCanvas.height !== depthHeight) {
      depthCanvas = new OffscreenCanvas(depthWidth, depthHeight);
      depthCtx = depthCanvas.getContext('2d');
      depthImageData = depthCtx.createImageData(depthWidth, depthHeight);
    }

    const data = depthImageData.data;
    for (let i = 0; i < depthMap.length; i++) {
      const v = Math.round(Math.max(0, Math.min(1, depthMap[i])) * 255);
      const pi = v * 3;
      const di = i * 4;
      data[di] = DEPTH_PALETTE[pi];
      data[di + 1] = DEPTH_PALETTE[pi + 1];
      data[di + 2] = DEPTH_PALETTE[pi + 2];
      data[di + 3] = 255;
    }

    depthCtx.putImageData(depthImageData, 0, 0);
  }

  // Draw scaled depth overlay
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.drawImage(depthCanvas, 0, 0, w, h);
  ctx.restore();
}

/**
 * Render segmentation mask as colored overlay
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} w - Canvas width
 * @param {number} h - Canvas height
 * @param {Float32Array} mask - Binary mask (0 or 1)
 * @param {number} maskWidth
 * @param {number} maskHeight
 * @param {Array} color - [r, g, b, a] where a is 0-1
 */
export function renderSegmentationMask(ctx, w, h, mask, maskWidth, maskHeight, color = [0, 255, 204, 0.3]) {
  if (!mask || mask.length === 0) return;

  const offscreen = new OffscreenCanvas(maskWidth, maskHeight);
  const offCtx = offscreen.getContext('2d');
  const imageData = offCtx.createImageData(maskWidth, maskHeight);
  const data = imageData.data;

  const [r, g, b, a] = color;
  const alpha = Math.round(a * 255);

  for (let i = 0; i < mask.length; i++) {
    const di = i * 4;
    if (mask[i] > 0.5) {
      data[di] = r;
      data[di + 1] = g;
      data[di + 2] = b;
      data[di + 3] = alpha;
    } else {
      data[di + 3] = 0;
    }
  }

  offCtx.putImageData(imageData, 0, 0);

  ctx.save();
  ctx.drawImage(offscreen, 0, 0, w, h);
  ctx.restore();
}
