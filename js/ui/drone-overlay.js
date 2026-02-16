// TALOS 2.0 - Drone Fleet Overlay
// Renders drone positions, sensor coverage fans, active tasking lines

import { getDroneTypeColor, getDroneStatusColor } from '../drones/drone-types.js';

export class DroneOverlay {
  constructor() {
    this.fleetData = null;
    this.taskingData = null;
  }

  update(fleetData, taskingData) {
    this.fleetData = fleetData;
    this.taskingData = taskingData;
  }

  render(ctx, w, h, timestamp) {
    if (!this.fleetData?.fleet) return;
    ctx.save();

    // Center of screen = operator position
    const opX = w / 2, opY = h * 0.85;

    this._renderSensorCoverage(ctx, w, h, opX, opY);
    this._renderTaskingLines(ctx, w, h, opX, opY, timestamp);
    this._renderDronePositions(ctx, w, h, opX, opY, timestamp);

    ctx.restore();
  }

  _bearingToScreen(bearing, range, opX, opY, w, h) {
    // Convert bearing (degrees from north) + range to screen position
    // bearing 0 = top, 90 = right, etc.
    const maxRange = 500; // max range in meters for display scaling
    const maxScreenDist = Math.min(w, h) * 0.4;
    const screenDist = Math.min(maxScreenDist, (range / maxRange) * maxScreenDist);
    const rad = (bearing - 90) * Math.PI / 180;
    return {
      x: opX + Math.cos(rad) * screenDist,
      y: opY + Math.sin(rad) * screenDist
    };
  }

  _renderDronePositions(ctx, w, h, opX, opY, timestamp) {
    for (const drone of this.fleetData.fleet) {
      if (drone.status === 'LOST' || drone.status === 'OFFLINE') continue;
      if (drone.position.range === 0 && drone.status === 'READY') continue; // At operator, not deployed

      const pos = this._bearingToScreen(drone.position.bearing, drone.position.range, opX, opY, w, h);
      const typeColor = getDroneTypeColor(drone.type);
      const statusColor = getDroneStatusColor(drone.status);

      ctx.save();
      ctx.globalAlpha = 0.7;

      // Draw drone icon by type
      this._drawDroneIcon(ctx, pos.x, pos.y, drone.type, typeColor);

      // Status ring
      ctx.strokeStyle = statusColor;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 12, 0, Math.PI * 2);
      ctx.stroke();

      // Callsign label
      ctx.fillStyle = typeColor;
      ctx.font = "8px 'Courier New', monospace";
      ctx.textAlign = 'center';
      ctx.fillText(drone.callsign, pos.x, pos.y + 20);

      // Battery bar under callsign
      const barW = 20, barH = 3;
      const barX = pos.x - barW / 2;
      const barY = pos.y + 22;
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      ctx.fillRect(barX, barY, barW, barH);

      const batColor = drone.battery > 50 ? '#00ff66' : drone.battery > 20 ? '#ffaa00' : '#ff3333';
      ctx.fillStyle = batColor;
      ctx.fillRect(barX, barY, barW * (drone.battery / 100), barH);

      ctx.restore();
    }
  }

  _renderSensorCoverage(ctx, w, h, opX, opY) {
    for (const drone of this.fleetData.fleet) {
      if (!drone.sensorCoverage || drone.status === 'LOST') continue;
      if (drone.position.range === 0 && drone.status === 'READY') continue;

      const pos = this._bearingToScreen(drone.position.bearing, drone.position.range, opX, opY, w, h);
      const sc = drone.sensorCoverage;
      const typeColor = getDroneTypeColor(drone.type);

      const sensorRange = sc.range * Math.min(w, h) * 0.5;
      const halfArc = (sc.arc / 2) * Math.PI / 180;
      const centerAngle = (sc.bearing - 90) * Math.PI / 180;

      ctx.save();
      ctx.globalAlpha = 0.08;
      ctx.fillStyle = typeColor;
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
      ctx.arc(pos.x, pos.y, sensorRange, centerAngle - halfArc, centerAngle + halfArc);
      ctx.closePath();
      ctx.fill();

      ctx.globalAlpha = 0.2;
      ctx.strokeStyle = typeColor;
      ctx.lineWidth = 0.5;
      ctx.stroke();
      ctx.restore();
    }
  }

  _renderTaskingLines(ctx, w, h, opX, opY, timestamp) {
    if (!this.taskingData?.activeTasks) return;

    for (const task of this.taskingData.activeTasks) {
      const drone = this.fleetData.fleet.find(d => d.id === task.droneId);
      if (!drone || drone.status === 'LOST') continue;

      const dronePos = this._bearingToScreen(drone.position.bearing, drone.position.range, opX, opY, w, h);

      let targetX, targetY;
      if (task.targetPosition) {
        targetX = task.targetPosition[0] * w;
        targetY = task.targetPosition[1] * h;
      } else {
        continue;
      }

      // Task line color by type
      const lineColor = task.taskType === 'ENGAGE' ? '#ff3333' :
                         task.taskType === 'OVERWATCH' || task.taskType === 'RECON' ? '#00ffcc' :
                         task.taskType === 'JAM' ? '#ffaa00' : '#ffffff';

      ctx.save();
      ctx.globalAlpha = 0.4;
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = 1;

      // Animated dash offset
      const dashOffset = (timestamp / 100) % 20;
      ctx.setLineDash([8, 6]);
      ctx.lineDashOffset = -dashOffset;

      ctx.beginPath();
      ctx.moveTo(dronePos.x, dronePos.y);
      ctx.lineTo(targetX, targetY);
      ctx.stroke();

      // Task type label at midpoint
      const midX = (dronePos.x + targetX) / 2;
      const midY = (dronePos.y + targetY) / 2;
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      const label = task.taskType;
      ctx.font = "7px 'Courier New', monospace";
      const tw = ctx.measureText(label).width + 4;
      ctx.fillRect(midX - tw / 2, midY - 5, tw, 10);
      ctx.fillStyle = lineColor;
      ctx.textAlign = 'center';
      ctx.fillText(label, midX, midY + 3);

      ctx.restore();
    }
  }

  _drawDroneIcon(ctx, x, y, type, color) {
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;

    switch (type) {
      case 'ISR':
        // Eye icon
        ctx.beginPath();
        ctx.ellipse(x, y, 7, 4, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x, y, 2, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'STRIKE':
        // Crosshair
        ctx.beginPath();
        ctx.moveTo(x - 6, y); ctx.lineTo(x + 6, y);
        ctx.moveTo(x, y - 6); ctx.lineTo(x, y + 6);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.stroke();
        break;
      case 'EW':
        // Lightning bolt
        ctx.beginPath();
        ctx.moveTo(x + 2, y - 7);
        ctx.lineTo(x - 3, y);
        ctx.lineTo(x + 1, y);
        ctx.lineTo(x - 2, y + 7);
        ctx.stroke();
        break;
      case 'CARGO':
        // Box
        ctx.strokeRect(x - 5, y - 4, 10, 8);
        ctx.beginPath();
        ctx.moveTo(x - 5, y); ctx.lineTo(x + 5, y);
        ctx.stroke();
        break;
      case 'SCREEN':
        // Radar sweep
        ctx.beginPath();
        ctx.arc(x, y, 6, -Math.PI * 0.7, -Math.PI * 0.3);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x, y, 3, -Math.PI * 0.7, -Math.PI * 0.3);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x, y, 1.5, 0, Math.PI * 2);
        ctx.fill();
        break;
      default:
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
    }
  }
}

export const droneOverlay = new DroneOverlay();
