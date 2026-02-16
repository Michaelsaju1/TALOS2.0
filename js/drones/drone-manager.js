// TALOS 2.0 - Drone Fleet Manager
// Tracks entire drone fleet: positions, status, battery, health, tasking
// "Troops Available" in METT-TC - the operator's combat power is DRONES

import { DRONE_TYPES, getDroneStatusColor } from './drone-types.js';

class DroneManager {
  constructor() {
    this.fleet = [];
    this.fleetSummary = {
      total: 0, active: 0, ready: 0, tasked: 0,
      charging: 0, lost: 0, returning: 0,
      totalStrikesRemaining: 0, avgBattery: 0
    };
    this.callbacks = { onFleetUpdate: [], onDroneLost: [], onLowBattery: [], onTaskComplete: [] };
    this.updateInterval = null;
    this.simTime = 0;
  }

  // Initialize fleet from mission composition
  initFleet(composition) {
    this.fleet = [];
    let droneIndex = 1;
    const callsigns = {
      ISR: 'HAWK', STRIKE: 'VIPER', EW: 'SPECTRE', CARGO: 'MULE', SCREEN: 'SENTRY'
    };

    for (const [type, count] of Object.entries(composition)) {
      for (let i = 0; i < count; i++) {
        const typeData = DRONE_TYPES[type];
        if (!typeData) continue;

        this.fleet.push({
          id: `DRONE-${String(droneIndex).padStart(2, '0')}`,
          type,
          callsign: `${callsigns[type] || 'UNIT'}-${i + 1}`,
          status: 'READY',
          battery: 85 + Math.floor(Math.random() * 15), // 85-100%
          position: { bearing: 0, range: 0, altitude: 0 },
          currentTask: null,
          currentTaskType: null,
          targetTrackId: null,
          targetPosition: null,
          timeOnStation: typeData.endurance,
          sensorFeed: false,
          sensorCoverage: type !== 'CARGO' ? {
            bearing: 0, arc: typeData.sensorArc, range: typeData.sensorRange / 3000
          } : null,
          health: {
            comms: 'GREEN', motors: 'GREEN',
            sensors: type !== 'CARGO' ? 'GREEN' : 'N/A',
            payload: typeData.payload ? 'GREEN' : 'N/A'
          },
          payload: typeData.payload ? { ...typeData.payload, remaining: typeData.payload.count || 1 } : null,
          specs: typeData
        });
        droneIndex++;
      }
    }

    this._updateSummary();
    this._emit('onFleetUpdate');
  }

  // Assign task to drone
  assignTask(droneId, taskType, options = {}) {
    const drone = this.getDrone(droneId);
    if (!drone) return { success: false, reason: 'Drone not found' };
    if (drone.status === 'LOST' || drone.status === 'OFFLINE') {
      return { success: false, reason: `Drone ${drone.callsign} is ${drone.status}` };
    }
    if (drone.battery < 10) {
      return { success: false, reason: `Drone ${drone.callsign} battery critical (${drone.battery}%)` };
    }

    // Check if task requires payload
    if (taskType === 'ENGAGE' && drone.type === 'STRIKE') {
      if (!drone.payload || drone.payload.remaining <= 0) {
        return { success: false, reason: `${drone.callsign} has no munitions remaining` };
      }
    }

    drone.status = 'TASKED';
    drone.currentTask = options.taskLabel || taskType;
    drone.currentTaskType = taskType;
    drone.targetTrackId = options.targetTrackId || null;
    drone.targetPosition = options.targetPosition || null;
    drone.sensorFeed = ['OVERWATCH', 'RECON', 'TRACK', 'BDA'].includes(taskType);

    // Simulate drone moving to position
    if (options.targetPosition) {
      drone.position = {
        bearing: Math.atan2(options.targetPosition[0] - 0.5, 0.5 - options.targetPosition[1]) * 180 / Math.PI,
        range: Math.random() * 200 + 50,
        altitude: drone.specs.altitude.optimal
      };
      if (drone.sensorCoverage) {
        drone.sensorCoverage.bearing = drone.position.bearing;
      }
    }

    this._updateSummary();
    this._emit('onFleetUpdate');
    return { success: true, drone: drone.callsign, task: taskType };
  }

  // Recall drone to base
  recallDrone(droneId) {
    const drone = this.getDrone(droneId);
    if (!drone) return;
    drone.status = 'RETURNING';
    drone.currentTask = 'RTB';
    drone.currentTaskType = 'RTB';
    drone.targetTrackId = null;
    drone.targetPosition = null;
    drone.sensorFeed = false;
    this._updateSummary();
    this._emit('onFleetUpdate');
  }

  // Get specific drone
  getDrone(droneId) {
    return this.fleet.find(d => d.id === droneId);
  }

  // Get best available drone for a task type
  getBestDroneForTask(taskType, targetPosition) {
    const typeForTask = {
      OVERWATCH: ['ISR'], RECON: ['ISR'], TRACK: ['ISR'],
      ENGAGE: ['STRIKE'], DESIGNATE: ['ISR', 'STRIKE'], BDA: ['ISR'],
      JAM: ['EW'], COUNTER_UAS: ['EW', 'STRIKE'], RELAY: ['EW'],
      RESUPPLY: ['CARGO'], MEDEVAC_SUPPLY: ['CARGO'],
      SCREEN: ['SCREEN'], PERIMETER: ['SCREEN'], EARLY_WARNING: ['SCREEN'],
      SIGINT: ['EW', 'ISR']
    };

    const validTypes = typeForTask[taskType] || [];
    const candidates = this.fleet.filter(d =>
      validTypes.includes(d.type) &&
      (d.status === 'READY' || d.status === 'ACTIVE') &&
      d.battery > 20
    );

    if (candidates.length === 0) return null;

    // Sort by battery (highest first)
    candidates.sort((a, b) => b.battery - a.battery);
    return candidates[0];
  }

  // Get fleet data for overlays
  getFleetData() {
    return {
      fleet: this.fleet.map(d => ({
        id: d.id, type: d.type, callsign: d.callsign,
        status: d.status, battery: d.battery,
        position: { ...d.position },
        currentTask: d.currentTask,
        sensorCoverage: d.sensorCoverage ? { ...d.sensorCoverage } : null
      })),
      summary: { ...this.fleetSummary }
    };
  }

  // Get active tasking data
  getTaskingData() {
    return {
      activeTasks: this.fleet
        .filter(d => d.currentTaskType && d.currentTaskType !== 'RTB')
        .map(d => ({
          droneId: d.id,
          callsign: d.callsign,
          taskType: d.currentTaskType,
          targetTrackId: d.targetTrackId,
          targetPosition: d.targetPosition
        }))
    };
  }

  // Start simulation loop
  startSimulation() {
    this.updateInterval = setInterval(() => this._simulationTick(), 2000);
  }

  stopSimulation() {
    if (this.updateInterval) clearInterval(this.updateInterval);
  }

  // Register callbacks
  on(event, callback) {
    if (this.callbacks[event]) this.callbacks[event].push(callback);
  }

  // Update DOM elements
  updateDOM() {
    const el = (id) => document.getElementById(id);
    const activeEl = el('fleet-active');
    const totalEl = el('fleet-total');
    const strikesEl = el('fleet-strikes');
    const batteryEl = el('fleet-battery');

    if (activeEl) activeEl.textContent = this.fleetSummary.active + this.fleetSummary.tasked;
    if (totalEl) totalEl.textContent = this.fleetSummary.total;
    if (strikesEl) strikesEl.textContent = this.fleetSummary.totalStrikesRemaining;
    if (batteryEl) batteryEl.textContent = this.fleetSummary.avgBattery + '%';

    // Color code active count
    if (activeEl) {
      const ratio = (this.fleetSummary.active + this.fleetSummary.tasked) / Math.max(1, this.fleetSummary.total);
      activeEl.className = 'drone-count' + (ratio < 0.3 ? ' critical' : ratio < 0.5 ? ' warning' : '');
    }
  }

  // --- Private ---

  _simulationTick() {
    this.simTime += 2;
    for (const drone of this.fleet) {
      if (drone.status === 'LOST' || drone.status === 'OFFLINE') continue;

      // Drain battery
      const drainRate = drone.status === 'TASKED' ? 0.4 : drone.status === 'RETURNING' ? 0.3 : 0.1;
      drone.battery = Math.max(0, drone.battery - drainRate);
      drone.timeOnStation = Math.max(0, drone.timeOnStation - (2 / 60));

      // Auto-recall on low battery
      if (drone.battery <= 20 && drone.status === 'TASKED') {
        this.recallDrone(drone.id);
        this._emit('onLowBattery', drone);
      }

      // Complete return
      if (drone.status === 'RETURNING') {
        drone.position.range = Math.max(0, drone.position.range - 10);
        if (drone.position.range <= 0) {
          drone.status = 'CHARGING';
          drone.currentTask = null;
          drone.currentTaskType = null;
        }
      }

      // Charge
      if (drone.status === 'CHARGING') {
        drone.battery = Math.min(100, drone.battery + 1.5);
        if (drone.battery >= 95) {
          drone.status = 'READY';
          drone.timeOnStation = drone.specs.endurance;
        }
      }

      // Simulate position drift for active drones
      if (drone.status === 'TASKED' || drone.status === 'ACTIVE') {
        drone.position.bearing += (Math.random() - 0.5) * 2;
        drone.position.range += (Math.random() - 0.5) * 5;
        if (drone.sensorCoverage) {
          drone.sensorCoverage.bearing = drone.position.bearing;
        }
      }

      // Random events (rare)
      if (Math.random() < 0.002 && drone.status === 'TASKED') {
        // Comms degradation
        drone.health.comms = 'AMBER';
      }
    }

    this._updateSummary();
    this._emit('onFleetUpdate');
  }

  _updateSummary() {
    const s = this.fleetSummary;
    s.total = this.fleet.length;
    s.active = this.fleet.filter(d => d.status === 'ACTIVE').length;
    s.tasked = this.fleet.filter(d => d.status === 'TASKED').length;
    s.ready = this.fleet.filter(d => d.status === 'READY').length;
    s.charging = this.fleet.filter(d => d.status === 'CHARGING').length;
    s.returning = this.fleet.filter(d => d.status === 'RETURNING').length;
    s.lost = this.fleet.filter(d => d.status === 'LOST').length;
    s.totalStrikesRemaining = this.fleet
      .filter(d => d.type === 'STRIKE' && d.payload && d.status !== 'LOST')
      .reduce((sum, d) => sum + (d.payload.remaining || 0), 0);
    const batteries = this.fleet.filter(d => d.status !== 'LOST').map(d => d.battery);
    s.avgBattery = batteries.length ? Math.round(batteries.reduce((a, b) => a + b, 0) / batteries.length) : 0;
  }

  _emit(event, data) {
    if (this.callbacks[event]) {
      this.callbacks[event].forEach(cb => cb(data || this.getFleetData()));
    }
  }
}

export const droneManager = new DroneManager();
