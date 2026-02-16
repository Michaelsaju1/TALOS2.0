// TALOS 2.0 - Suit Status Overlay
// Renders suit armor silhouette, threat warnings, system alerts

export class SuitOverlay {
  constructor() {
    this.suitData = null;
    this.threatFlashStart = 0;
  }

  update(suitData) {
    this.suitData = suitData;
  }

  render(ctx, w, h, timestamp) {
    if (!this.suitData) return;
    ctx.save();

    this._renderArmorSilhouette(ctx, w, h);
    this._renderThreatWarnings(ctx, w, h, timestamp);
    this._renderSystemAlerts(ctx, w, h);

    ctx.restore();
  }

  _renderArmorSilhouette(ctx, w, h) {
    const armor = this.suitData.armor;
    if (!armor) return;

    // Position: bottom-left corner
    const baseX = 18;
    const baseY = h - 80;
    const scale = 0.8;

    ctx.save();
    ctx.globalAlpha = 0.5;

    // Head (circle)
    ctx.fillStyle = this._armorColor(armor.helmet);
    ctx.strokeStyle = this._armorColor(armor.helmet);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(baseX, baseY, 5 * scale, 0, Math.PI * 2);
    ctx.stroke();

    // Torso front
    ctx.strokeStyle = this._armorColor(armor.front);
    ctx.fillStyle = this._armorColor(armor.front) + '22';
    ctx.beginPath();
    ctx.rect(baseX - 8 * scale, baseY + 7 * scale, 16 * scale, 22 * scale);
    ctx.fill();
    ctx.stroke();

    // Left arm
    ctx.strokeStyle = this._armorColor(armor.left);
    ctx.beginPath();
    ctx.rect(baseX - 13 * scale, baseY + 8 * scale, 4 * scale, 18 * scale);
    ctx.stroke();

    // Right arm
    ctx.strokeStyle = this._armorColor(armor.right);
    ctx.beginPath();
    ctx.rect(baseX + 9 * scale, baseY + 8 * scale, 4 * scale, 18 * scale);
    ctx.stroke();

    // Legs
    ctx.strokeStyle = this._armorColor(Math.min(armor.left, armor.right));
    ctx.beginPath();
    ctx.rect(baseX - 6 * scale, baseY + 31 * scale, 5 * scale, 20 * scale);
    ctx.rect(baseX + 1 * scale, baseY + 31 * scale, 5 * scale, 20 * scale);
    ctx.stroke();

    // Overall status label
    ctx.fillStyle = armor.overall === 'GREEN' ? '#00ff66' :
                    armor.overall === 'AMBER' ? '#ffaa00' : '#ff3333';
    ctx.font = "7px 'Courier New', monospace";
    ctx.textAlign = 'center';
    ctx.fillText('ARMOR', baseX, baseY + 58 * scale);

    ctx.restore();
  }

  _renderThreatWarnings(ctx, w, h, timestamp) {
    const threats = this.suitData.threats;
    if (!threats) return;

    // INCOMING FIRE - flash screen edges RED
    if (threats.incomingFire) {
      const flash = Math.sin(timestamp / 80) > 0;
      if (flash) {
        ctx.save();
        ctx.globalAlpha = 0.3;

        // Red gradient at all edges
        const grad = ctx.createLinearGradient(0, 0, 30, 0);
        grad.addColorStop(0, '#ff3333');
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 30, h);

        const grad2 = ctx.createLinearGradient(w, 0, w - 30, 0);
        grad2.addColorStop(0, '#ff3333');
        grad2.addColorStop(1, 'transparent');
        ctx.fillStyle = grad2;
        ctx.fillRect(w - 30, 0, 30, h);

        // INCOMING warning text
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = '#ff3333';
        ctx.font = "bold 16px 'Courier New', monospace";
        ctx.textAlign = 'center';
        ctx.fillText('!! INCOMING FIRE !!', w / 2, h * 0.15);

        ctx.restore();
      }
    }

    // ENEMY DRONE NEARBY - amber triangle
    if (threats.enemyDroneNearby) {
      const pulse = 0.5 + 0.5 * Math.sin(timestamp / 300);
      ctx.save();
      ctx.globalAlpha = pulse;

      // Warning triangle at top center
      const tx = w / 2, ty = 70;
      ctx.fillStyle = '#ffaa00';
      ctx.beginPath();
      ctx.moveTo(tx, ty - 12);
      ctx.lineTo(tx + 12, ty + 8);
      ctx.lineTo(tx - 12, ty + 8);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#000';
      ctx.font = "bold 10px 'Courier New', monospace";
      ctx.textAlign = 'center';
      ctx.fillText('!', tx, ty + 5);

      ctx.fillStyle = '#ffaa00';
      ctx.font = "9px 'Courier New', monospace";
      ctx.fillText('ENEMY DRONE', tx, ty + 22);

      ctx.restore();
    }

    // ELECTRONIC ATTACK - flashing EW text
    if (threats.electronicAttack) {
      const flash = Math.sin(timestamp / 150) > 0;
      if (flash) {
        ctx.save();
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = '#ff6600';
        ctx.font = "bold 14px 'Courier New', monospace";
        ctx.textAlign = 'center';
        ctx.fillText('EW ATTACK DETECTED', w / 2, h * 0.25);
        ctx.restore();
      }
    }
  }

  _renderSystemAlerts(ctx, w, h) {
    const systems = this.suitData.systems;
    if (!systems) return;

    const degraded = Object.entries(systems).filter(([, v]) => v !== 'OPERATIONAL' && v !== 'STANDBY' && v !== 'N/A');
    if (degraded.length === 0) return;

    ctx.save();
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = '#ffaa00';
    ctx.font = "8px 'Courier New', monospace";
    ctx.textAlign = 'left';

    let y = h - 90;
    for (const [name, status] of degraded) {
      ctx.fillText(`\u26A0 ${name.toUpperCase()}: ${status}`, 20, y);
      y -= 12;
    }

    ctx.restore();
  }

  _armorColor(value) {
    if (value >= 75) return '#00ff66';
    if (value >= 50) return '#ffaa00';
    if (value >= 25) return '#ff6600';
    return '#ff3333';
  }
}

export const suitOverlay = new SuitOverlay();
