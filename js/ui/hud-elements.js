// TALOS 2.0 - HUD Chrome Elements
// Draws Iron Man-style HUD chrome on canvas: reticle, grid, edge ticks, detection overlays

const PRIMARY = 'rgba(0, 255, 204, ';
const HOSTILE = '#ff3333';
const CAUTION = '#ffaa00';
const FRIENDLY = '#3399ff';
const CIVILIAN_COLOR = '#6699ff';

// Center reticle - Iron Man style corner brackets
export function renderHudElements(ctx, w, h, timestamp) {
  ctx.save();

  // --- Subtle grid pattern ---
  ctx.strokeStyle = PRIMARY + '0.04)';
  ctx.lineWidth = 0.5;
  const gridSpacing = Math.max(50, Math.floor(w / 15));
  ctx.beginPath();
  for (let x = gridSpacing; x < w; x += gridSpacing) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
  }
  for (let y = gridSpacing; y < h; y += gridSpacing) {
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
  }
  ctx.stroke();

  // --- Edge tick marks ---
  ctx.strokeStyle = PRIMARY + '0.3)';
  ctx.lineWidth = 1;
  const tickLen = 10;
  const tickSpacing = Math.floor(w / 10);
  ctx.beginPath();
  for (let x = tickSpacing; x < w; x += tickSpacing) {
    // Top edge
    ctx.moveTo(x, 0); ctx.lineTo(x, tickLen);
    // Bottom edge
    ctx.moveTo(x, h); ctx.lineTo(x, h - tickLen);
  }
  for (let y = tickSpacing; y < h; y += tickSpacing) {
    // Left edge
    ctx.moveTo(0, y); ctx.lineTo(tickLen, y);
    // Right edge
    ctx.moveTo(w, y); ctx.lineTo(w - tickLen, y);
  }
  ctx.stroke();

  // --- Center reticle (corner brackets) ---
  const cx = w / 2, cy = h / 2;
  const reticleSize = Math.min(w, h) * 0.04;
  const gap = reticleSize * 0.3;

  ctx.strokeStyle = PRIMARY + '0.6)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();

  // Top-left corner
  ctx.moveTo(cx - reticleSize, cy - gap);
  ctx.lineTo(cx - reticleSize, cy - reticleSize);
  ctx.lineTo(cx - gap, cy - reticleSize);
  // Top-right corner
  ctx.moveTo(cx + gap, cy - reticleSize);
  ctx.lineTo(cx + reticleSize, cy - reticleSize);
  ctx.lineTo(cx + reticleSize, cy - gap);
  // Bottom-right corner
  ctx.moveTo(cx + reticleSize, cy + gap);
  ctx.lineTo(cx + reticleSize, cy + reticleSize);
  ctx.lineTo(cx + gap, cy + reticleSize);
  // Bottom-left corner
  ctx.moveTo(cx - gap, cy + reticleSize);
  ctx.lineTo(cx - reticleSize, cy + reticleSize);
  ctx.lineTo(cx - reticleSize, cy + gap);

  ctx.stroke();

  // Center dot
  ctx.fillStyle = PRIMARY + '0.4)';
  ctx.beginPath();
  ctx.arc(cx, cy, 2, 0, Math.PI * 2);
  ctx.fill();

  // --- Corner status indicators ---
  const cornerSize = 8;
  const cornerMargin = 20;
  ctx.fillStyle = PRIMARY + '0.3)';

  // Top-left diamond
  drawDiamond(ctx, cornerMargin, cornerMargin + 60, cornerSize);
  // Top-right diamond
  drawDiamond(ctx, w - cornerMargin, cornerMargin + 60, cornerSize);
  // Bottom-left diamond
  drawDiamond(ctx, cornerMargin + 15, h - cornerMargin - 60, cornerSize);
  // Bottom-right diamond
  drawDiamond(ctx, w - cornerMargin - 15, h - cornerMargin - 60, cornerSize);

  ctx.restore();
}

function drawDiamond(ctx, x, y, size) {
  ctx.beginPath();
  ctx.moveTo(x, y - size);
  ctx.lineTo(x + size, y);
  ctx.lineTo(x, y + size);
  ctx.lineTo(x - size, y);
  ctx.closePath();
  ctx.fill();
}

// Detection box overlays - tactical-style corner brackets
export function renderDetectionBoxes(ctx, w, h, detections) {
  if (!detections || detections.length === 0) return;

  ctx.save();
  const fontSize = Math.max(10, Math.floor(w / 80));
  ctx.font = `${fontSize}px 'Courier New', monospace`;

  for (const det of detections) {
    if (!det.bbox) continue;

    const [bx, by, bw, bh] = det.bbox;
    const x = bx * w, y = by * h;
    const boxW = bw * w, boxH = bh * h;

    // Color by classification
    const color = getDetectionColor(det);
    const cornerLen = Math.min(boxW, boxH) * 0.25;

    // Draw corner brackets
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();

    // Top-left
    ctx.moveTo(x, y + cornerLen);
    ctx.lineTo(x, y);
    ctx.lineTo(x + cornerLen, y);
    // Top-right
    ctx.moveTo(x + boxW - cornerLen, y);
    ctx.lineTo(x + boxW, y);
    ctx.lineTo(x + boxW, y + cornerLen);
    // Bottom-right
    ctx.moveTo(x + boxW, y + boxH - cornerLen);
    ctx.lineTo(x + boxW, y + boxH);
    ctx.lineTo(x + boxW - cornerLen, y + boxH);
    // Bottom-left
    ctx.moveTo(x + cornerLen, y + boxH);
    ctx.lineTo(x, y + boxH);
    ctx.lineTo(x, y + boxH - cornerLen);

    ctx.stroke();

    // Label background
    const label = det.tacticalClass || det.class?.toUpperCase() || 'UNKNOWN';
    const labelWidth = ctx.measureText(label).width + 8;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(x, y - fontSize - 6, labelWidth, fontSize + 4);

    // Label text
    ctx.fillStyle = color;
    ctx.fillText(label, x + 4, y - 6);

    // Track ID
    if (det.trackId !== undefined) {
      const trkLabel = `TRK-${String(det.trackId).padStart(4, '0')}`;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.font = `${fontSize - 2}px 'Courier New', monospace`;
      ctx.fillText(trkLabel, x + labelWidth + 4, y - 6);
      ctx.font = `${fontSize}px 'Courier New', monospace`;
    }

    // Distance + movement below box
    const bottomY = y + boxH + fontSize + 4;
    let infoText = '';
    if (det.distance?.meters) {
      infoText += `${Math.round(det.distance.meters)}m`;
    }
    if (det.movement?.heading) {
      const arrows = { APPROACHING: '\u2191', RETREATING: '\u2193', LATERAL_LEFT: '\u2190', LATERAL_RIGHT: '\u2192', STATIONARY: '\u2022' };
      infoText += ` ${arrows[det.movement.heading] || ''}`;
    }
    if (det.onAvenue) {
      infoText += ` [${det.onAvenue}]`;
    }

    if (infoText) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      const infoWidth = ctx.measureText(infoText).width + 8;
      ctx.fillRect(x, bottomY - fontSize, infoWidth, fontSize + 2);
      ctx.fillStyle = color;
      ctx.fillText(infoText, x + 4, bottomY - 2);
    }

    // Mini threat bar
    if (det.threatLevel !== undefined) {
      const barWidth = boxW * 0.6;
      const barHeight = 3;
      const barX = x + (boxW - barWidth) / 2;
      const barY = y + boxH + 2;

      ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.fillRect(barX, barY, barWidth, barHeight);

      ctx.fillStyle = color;
      ctx.fillRect(barX, barY, barWidth * det.threatLevel, barHeight);
    }
  }

  ctx.restore();
}

function getDetectionColor(det) {
  if (det.classification === 'FRIENDLY') return FRIENDLY;
  if (det.classification === 'CIVILIAN') return CIVILIAN_COLOR;
  if (det.threatLevel > 0.7) return HOSTILE;
  if (det.threatLevel > 0.3) return CAUTION;
  if (det.threatLevel !== undefined) return '#00ffcc';
  return '#cccccc';
}
