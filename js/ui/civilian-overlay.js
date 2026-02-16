// TALOS 2.0 - Civilian Overlay
// Renders civilian markers, protected structures, ROE zones, density warnings

const CIV_BLUE = '#3399ff';
const WARNING_AMBER = '#ffaa00';
const PROTECTED_YELLOW = '#ffcc00';

export class CivilianOverlay {
  constructor() {
    this.civilData = null;
  }

  update(civilData) {
    this.civilData = civilData;
  }

  render(ctx, w, h, timestamp) {
    if (!this.civilData) return;
    ctx.save();

    this._renderROEZones(ctx, w, h);
    this._renderProtectedStructures(ctx, w, h, timestamp);
    this._renderCivilians(ctx, w, h, timestamp);
    this._renderDensityWarning(ctx, w, h);

    ctx.restore();
  }

  _renderCivilians(ctx, w, h, timestamp) {
    const entities = this.civilData.civilianPresence?.entities;
    if (!entities) return;

    for (const entity of entities) {
      if (!entity.position) continue;
      const x = entity.position[0] * w;
      const y = entity.position[1] * h;
      const isUnknown = entity.classification === 'UNKNOWN';

      ctx.save();

      // Pulsing animation for UNKNOWN
      if (isUnknown) {
        ctx.globalAlpha = 0.4 + 0.3 * Math.sin(timestamp / 500);
      } else {
        ctx.globalAlpha = 0.6;
      }

      // Circle outline
      ctx.strokeStyle = isUnknown ? WARNING_AMBER : CIV_BLUE;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x, y, 14, 0, Math.PI * 2);
      ctx.stroke();

      // Inner small filled circle
      ctx.fillStyle = isUnknown ? 'rgba(255, 170, 0, 0.15)' : 'rgba(51, 153, 255, 0.1)';
      ctx.beginPath();
      ctx.arc(x, y, 12, 0, Math.PI * 2);
      ctx.fill();

      // Label
      ctx.fillStyle = isUnknown ? WARNING_AMBER : CIV_BLUE;
      ctx.font = "9px 'Courier New', monospace";
      ctx.textAlign = 'center';
      ctx.fillText(isUnknown ? 'UNK' : 'CIV', x, y + 3);

      ctx.restore();
    }
  }

  _renderProtectedStructures(ctx, w, h, timestamp) {
    const structures = this.civilData.protectedStructures;
    if (!structures) return;

    for (const structure of structures) {
      if (!structure.position) continue;
      const x = structure.position[0] * w;
      const y = structure.position[1] * h;
      const radius = (structure.noFireRadius || 0.1) * Math.min(w, h);

      ctx.save();

      // Dashed circle for no-fire radius
      ctx.globalAlpha = 0.3;
      ctx.strokeStyle = WARNING_AMBER;
      ctx.lineWidth = 1;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.stroke();

      // Fill
      ctx.fillStyle = 'rgba(255, 204, 0, 0.05)';
      ctx.fill();

      ctx.setLineDash([]);

      // Structure icon
      ctx.globalAlpha = 0.7;
      if (structure.type === 'MOSQUE') {
        this._drawCrescent(ctx, x, y, 10, PROTECTED_YELLOW);
      } else if (structure.type === 'HOSPITAL') {
        this._drawCross(ctx, x, y, 8, '#ff3333');
      } else if (structure.type === 'SCHOOL') {
        this._drawBook(ctx, x, y, 8, PROTECTED_YELLOW);
      } else {
        // Generic protected structure
        ctx.strokeStyle = PROTECTED_YELLOW;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, 8, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Label
      ctx.fillStyle = WARNING_AMBER;
      ctx.font = "8px 'Courier New', monospace";
      ctx.textAlign = 'center';
      ctx.fillText('NO FIRE', x, y + 20);

      ctx.restore();
    }
  }

  _renderROEZones(ctx, w, h) {
    const zones = this.civilData.roeZones;
    if (!zones) return;

    for (const zone of zones) {
      if (!zone.center) continue;
      const x = zone.center[0] * w;
      const y = zone.center[1] * h;
      const radius = (zone.radius || 0.1) * Math.min(w, h);

      ctx.save();
      ctx.globalAlpha = 0.1;
      ctx.fillStyle = zone.type === 'NO_FIRE' ? WARNING_AMBER : '#ff9900';
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = 0.25;
      ctx.strokeStyle = WARNING_AMBER;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.restore();
    }
  }

  _renderDensityWarning(ctx, w, h) {
    const density = this.civilData.civilianPresence?.density;
    if (!density || density === 'NONE') return;

    if (density === 'HIGH' || density === 'MODERATE') {
      ctx.save();
      ctx.globalAlpha = 0.8;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(w * 0.25, 4, w * 0.5, 18);

      ctx.fillStyle = density === 'HIGH' ? '#ff3333' : WARNING_AMBER;
      ctx.font = "bold 10px 'Courier New', monospace";
      ctx.textAlign = 'center';
      ctx.fillText(`CIV DENSITY: ${density}`, w / 2, 16);
      ctx.restore();
    }
  }

  _drawCrescent(ctx, x, y, size, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
    ctx.beginPath();
    ctx.arc(x + size * 0.35, y, size * 0.75, 0, Math.PI * 2);
    ctx.fill();
  }

  _drawCross(ctx, x, y, size, color) {
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.arc(x, y, size + 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = color;
    const t = size * 0.3;
    ctx.fillRect(x - t, y - size, t * 2, size * 2);
    ctx.fillRect(x - size, y - t, size * 2, t * 2);
  }

  _drawBook(ctx, x, y, size, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x, y - size);
    ctx.lineTo(x - size, y - size * 0.5);
    ctx.lineTo(x - size, y + size);
    ctx.lineTo(x, y + size * 0.5);
    ctx.lineTo(x + size, y + size);
    ctx.lineTo(x + size, y - size * 0.5);
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y - size);
    ctx.lineTo(x, y + size * 0.5);
    ctx.stroke();
  }
}

export const civilianOverlay = new CivilianOverlay();
