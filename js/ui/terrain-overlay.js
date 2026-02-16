// TALOS 2.0 - Terrain OAKOC Overlay
// Renders terrain analysis visualization: cover, avenues, key terrain, obstacles, dead space

const PRIMARY = '#00ffcc';
const THREAT_RED = '#ff3333';
const FRIENDLY_BLUE = '#3399ff';
const CAUTION_AMBER = '#ffaa00';

export class TerrainOverlay {
  constructor() {
    this.visible = false;
    this.terrainData = null;
  }

  setVisible(v) { this.visible = v; }
  isVisible() { return this.visible; }
  toggle() { this.visible = !this.visible; return this.visible; }

  update(terrainData) {
    this.terrainData = terrainData;
  }

  render(ctx, w, h) {
    if (!this.visible || !this.terrainData?.oakoc) return;
    ctx.save();

    const oakoc = this.terrainData.oakoc;

    this._renderDeadSpace(ctx, w, h, oakoc.observation?.deadSpace);
    this._renderConcealmentZones(ctx, w, h, oakoc.coverAndConcealment?.concealmentZones);
    this._renderAvenues(ctx, w, h, oakoc.avenues);
    this._renderObstacles(ctx, w, h, oakoc.obstacles);
    this._renderCoverPositions(ctx, w, h, oakoc.coverAndConcealment?.coverPositions);
    this._renderKeyTerrain(ctx, w, h, oakoc.keyTerrain);
    this._renderFieldsOfFire(ctx, w, h, oakoc.observation?.fieldsOfFire);
    this._renderObservationPoints(ctx, w, h, oakoc.observation?.bestObservationPoints);
    this._renderChokepoints(ctx, w, h, oakoc.avenues);

    ctx.restore();
  }

  _renderDeadSpace(ctx, w, h, deadSpaces) {
    if (!deadSpaces) return;
    ctx.save();
    ctx.globalAlpha = 0.15;
    ctx.fillStyle = '#333333';

    for (const ds of deadSpaces) {
      const [rx, ry, rw, rh] = ds.region;
      const x = rx * w, y = ry * h;
      const dw = rw * w, dh = rh * h;

      // Diagonal hatching pattern
      ctx.beginPath();
      ctx.rect(x, y, dw, dh);
      ctx.fill();

      ctx.strokeStyle = 'rgba(100,100,100,0.3)';
      ctx.lineWidth = 1;
      for (let i = -dh; i < dw; i += 8) {
        ctx.beginPath();
        ctx.moveTo(x + i, y);
        ctx.lineTo(x + i + dh, y + dh);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  _renderConcealmentZones(ctx, w, h, zones) {
    if (!zones) return;
    ctx.save();
    ctx.globalAlpha = 0.1;
    ctx.fillStyle = '#336633';

    for (const zone of zones) {
      const [rx, ry, rw, rh] = zone.region;
      ctx.fillRect(rx * w, ry * h, rw * w, rh * h);
    }
    ctx.restore();
  }

  _renderAvenues(ctx, w, h, avenues) {
    if (!avenues) return;

    for (const ave of avenues) {
      const color = ave.threatAxis ? THREAT_RED : FRIENDLY_BLUE;
      const cx = ave.center[0] * w;
      const cy = ave.center[1] * h;
      const angle = (ave.bearing - 90) * Math.PI / 180;

      // Dashed arrow line
      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 6]);

      const len = Math.min(w, h) * 0.2;
      const endX = cx + Math.cos(angle) * len;
      const endY = cy + Math.sin(angle) * len;
      const startX = cx - Math.cos(angle) * len;
      const startY = cy - Math.sin(angle) * len;

      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.stroke();

      // Arrowhead
      ctx.setLineDash([]);
      const headLen = 10;
      ctx.beginPath();
      ctx.moveTo(endX, endY);
      ctx.lineTo(endX - headLen * Math.cos(angle - 0.4), endY - headLen * Math.sin(angle - 0.4));
      ctx.moveTo(endX, endY);
      ctx.lineTo(endX - headLen * Math.cos(angle + 0.4), endY - headLen * Math.sin(angle + 0.4));
      ctx.stroke();

      // Label
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = color;
      ctx.font = "9px 'Courier New', monospace";
      ctx.fillText(`${ave.id} (${ave.type})`, cx + 5, cy - 5);

      ctx.restore();
    }
  }

  _renderObstacles(ctx, w, h, obstacles) {
    if (!obstacles) return;

    for (const obs of obstacles) {
      const [ox, oy, ow, oh] = obs.position;
      const x = ox * w, y = oy * h;

      ctx.save();
      ctx.globalAlpha = 0.4;
      ctx.strokeStyle = THREAT_RED;
      ctx.lineWidth = 2;

      // X mark
      const size = 8;
      ctx.beginPath();
      ctx.moveTo(x - size, y - size);
      ctx.lineTo(x + size, y + size);
      ctx.moveTo(x + size, y - size);
      ctx.lineTo(x - size, y + size);
      ctx.stroke();

      if (obs.breachable) {
        ctx.fillStyle = PRIMARY;
        ctx.font = "8px 'Courier New', monospace";
        ctx.fillText('BREACH', x + size + 2, y + 3);
      }

      ctx.restore();
    }
  }

  _renderCoverPositions(ctx, w, h, positions) {
    if (!positions) return;

    for (const cover of positions) {
      const x = cover.position[0] * w;
      const y = cover.position[1] * h;

      ctx.save();
      ctx.globalAlpha = 0.45;

      // Shield icon
      ctx.strokeStyle = '#00ff66';
      ctx.fillStyle = 'rgba(0, 255, 102, 0.15)';
      ctx.lineWidth = 1.5;

      const size = 8;
      ctx.beginPath();
      ctx.moveTo(x, y - size);
      ctx.lineTo(x + size, y - size * 0.3);
      ctx.lineTo(x + size * 0.8, y + size);
      ctx.lineTo(x, y + size * 0.7);
      ctx.lineTo(x - size * 0.8, y + size);
      ctx.lineTo(x - size, y - size * 0.3);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Score label
      ctx.fillStyle = '#00ff66';
      ctx.font = "8px 'Courier New', monospace";
      ctx.fillText(cover.survivabilityScore.toFixed(2), x + size + 3, y + 3);

      ctx.restore();
    }
  }

  _renderKeyTerrain(ctx, w, h, keyTerrainList) {
    if (!keyTerrainList) return;

    for (const kt of keyTerrainList) {
      const x = kt.position[0] * w;
      const y = kt.position[1] * h;
      const brightness = 0.3 + kt.tacticalValue * 0.5;

      ctx.save();
      ctx.globalAlpha = brightness;

      // Diamond marker (rotated square)
      const size = 10;
      ctx.strokeStyle = PRIMARY;
      ctx.fillStyle = `rgba(0, 255, 204, 0.1)`;
      ctx.lineWidth = 1.5;

      ctx.beginPath();
      ctx.moveTo(x, y - size);
      ctx.lineTo(x + size, y);
      ctx.lineTo(x, y + size);
      ctx.lineTo(x - size, y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Label
      ctx.fillStyle = PRIMARY;
      ctx.font = "8px 'Courier New', monospace";
      const label = kt.type === 'CHOKEPOINT' ? 'CP' : 'KT';
      ctx.fillText(`${label} ${kt.tacticalValue.toFixed(1)}`, x + size + 3, y + 3);

      ctx.restore();
    }
  }

  _renderFieldsOfFire(ctx, w, h, fof) {
    if (!fof) return;

    ctx.save();
    ctx.globalAlpha = 0.12;

    const centerX = w / 2;
    const centerY = h * 0.9;

    for (const field of fof) {
      if (field.clearance !== 'CLEAR') continue;

      const angle = (field.bearing - 90) * Math.PI / 180;
      const range = field.range * Math.min(w, h) * 0.8;
      const spread = 0.15; // ~17 degree spread

      ctx.fillStyle = 'rgba(0, 255, 204, 0.08)';
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, range, angle - spread, angle + spread);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  }

  _renderObservationPoints(ctx, w, h, points) {
    if (!points) return;

    for (const op of points) {
      const x = op.position[0] * w;
      const y = op.position[1] * h;

      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = PRIMARY;
      ctx.lineWidth = 1.5;

      // Eye icon (oval + circle)
      const ew = 10, eh = 6;
      ctx.beginPath();
      ctx.ellipse(x, y, ew, eh, 0, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = PRIMARY;
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();

      ctx.font = "7px 'Courier New', monospace";
      ctx.fillText(op.advantage.toFixed(1), x + ew + 3, y + 3);

      ctx.restore();
    }
  }

  _renderChokepoints(ctx, w, h, avenues) {
    if (!avenues) return;

    for (const ave of avenues) {
      for (const cp of (ave.chokePoints || [])) {
        const x = cp.position[0] * w;
        const y = cp.position[1] * h;

        ctx.save();
        ctx.globalAlpha = 0.4;
        ctx.strokeStyle = CAUTION_AMBER;
        ctx.lineWidth = 1.5;

        // Hourglass icon
        const size = 7;
        ctx.beginPath();
        ctx.moveTo(x - size, y - size);
        ctx.lineTo(x + size, y - size);
        ctx.lineTo(x, y);
        ctx.lineTo(x + size, y + size);
        ctx.lineTo(x - size, y + size);
        ctx.lineTo(x, y);
        ctx.closePath();
        ctx.stroke();

        ctx.restore();
      }
    }
  }
}

export const terrainOverlay = new TerrainOverlay();
