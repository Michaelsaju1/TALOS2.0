// TALOS 2.0 - Drone Command Panel
// Interface for directly tasking drones via the HUD

import { getDroneTypeColor, getDroneStatusColor, getAvailableTasks } from '../drones/drone-types.js';

export class DroneCommandPanel {
  constructor() {
    this.panel = null;
    this.droneList = null;
    this.visible = false;
    this.selectedTarget = null;
    this.taskCallback = null;
  }

  init() {
    this.panel = document.getElementById('drone-command-panel');
    this.droneList = document.getElementById('drone-list');

    // Close on click outside
    document.addEventListener('touchstart', (e) => {
      if (this.visible && this.panel && !this.panel.contains(e.target)) {
        const fleetBar = document.getElementById('drone-fleet-bar');
        if (!fleetBar || !fleetBar.contains(e.target)) {
          this.hide();
        }
      }
    });
  }

  show(fleetData) {
    if (!this.panel || !this.droneList || !fleetData) return;
    this.visible = true;
    this._renderDroneList(fleetData);
    this.panel.classList.add('visible');
  }

  hide() {
    if (this.panel) this.panel.classList.remove('visible');
    this.visible = false;
  }

  toggle(fleetData) {
    if (this.visible) {
      this.hide();
    } else {
      this.show(fleetData);
    }
  }

  onTaskAssigned(callback) {
    this.taskCallback = callback;
  }

  setSelectedTarget(trackId, position) {
    this.selectedTarget = { trackId, position };
  }

  _renderDroneList(fleetData) {
    if (!this.droneList) return;

    let html = '';
    for (const drone of fleetData.fleet) {
      const typeColor = getDroneTypeColor(drone.type);
      const statusColor = getDroneStatusColor(drone.status);
      const batColor = drone.battery > 50 ? '#00ff66' : drone.battery > 20 ? '#ffaa00' : '#ff3333';
      const tasks = getAvailableTasks(drone.type);

      html += `<div class="drone-item" style="flex-wrap:wrap;gap:4px;">
        <div style="display:flex;justify-content:space-between;width:100%;">
          <div>
            <span style="color:${statusColor};">\u25CF</span>
            <span style="color:${typeColor};font-weight:bold;">${drone.callsign}</span>
            <span style="opacity:0.5;font-size:8px;">${drone.type}</span>
          </div>
          <div style="display:flex;align-items:center;gap:6px;">
            <div class="drone-battery">
              <div class="drone-battery-fill" style="width:${drone.battery}%;background:${batColor}"></div>
            </div>
            <span style="font-size:8px;">${drone.battery}%</span>
          </div>
        </div>
        <div style="width:100%;font-size:8px;opacity:0.6;margin:-2px 0 2px 12px;">
          ${drone.currentTask || 'IDLE'} | ${drone.status}
        </div>
        <div style="width:100%;display:flex;flex-wrap:wrap;gap:3px;margin-left:12px;">
          ${this._renderTaskButtons(drone, tasks)}
        </div>
      </div>`;
    }

    this.droneList.innerHTML = html;

    // Attach click handlers
    this.droneList.querySelectorAll('.task-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const droneId = btn.dataset.droneId;
        const taskType = btn.dataset.taskType;
        if (this.taskCallback) {
          this.taskCallback({
            droneId,
            taskType,
            targetTrackId: this.selectedTarget?.trackId || null,
            targetPosition: this.selectedTarget?.position || null
          });
        }
        // Visual feedback
        btn.style.background = 'var(--hud-primary)';
        btn.style.color = '#000';
        setTimeout(() => {
          btn.style.background = 'none';
          btn.style.color = 'var(--hud-primary)';
        }, 300);
      });
    });
  }

  _renderTaskButtons(drone, tasks) {
    if (drone.status === 'LOST' || drone.status === 'OFFLINE' || drone.status === 'CHARGING') {
      return '<span style="font-size:8px;opacity:0.4;">UNAVAILABLE</span>';
    }

    return tasks.map(task => {
      const shortLabel = task.id.length > 8 ? task.id.substring(0, 8) : task.id;
      return `<button class="task-btn" data-drone-id="${drone.id}" data-task-type="${task.id}">${shortLabel}</button>`;
    }).join('');
  }
}

export const droneCommandPanel = new DroneCommandPanel();
