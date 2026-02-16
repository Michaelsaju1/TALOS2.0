// TALOS 2.0 - Suit Status Monitor
// Tracks exoskeleton suit systems: power, armor, sensors, protection
// The suit IS the operator's protection, mobility, and sensor platform

class SuitStatusMonitor {
  constructor() {
    this.status = {
      power: {
        battery: 82,
        consumption: 'NORMAL',
        estimatedRuntime: '4h 15m',
        chargingAvailable: false,
        drainRate: 0.02  // % per tick
      },
      armor: {
        overall: 'GREEN',
        front: 100, rear: 100, left: 100, right: 100, helmet: 100
      },
      systems: {
        cameras: 'OPERATIONAL',
        hud: 'OPERATIONAL',
        comms: 'OPERATIONAL',
        droneLink: 'OPERATIONAL',
        nightVision: 'STANDBY',
        thermalImaging: 'STANDBY',
        gps: 'OPERATIONAL',
        iff: 'OPERATIONAL'
      },
      mobility: {
        exoAssist: 'ACTIVE',
        mode: 'TACTICAL',
        speed: 'ENHANCED'
      },
      threats: {
        incomingFire: false,
        detectedLaserDesignation: false,
        enemyDroneNearby: false,
        electronicAttack: false
      }
    };
    this.callbacks = [];
    this.simInterval = null;
  }

  getStatus() {
    return JSON.parse(JSON.stringify(this.status));
  }

  // Simulate threat events
  simulateThreat(threatType, duration = 3000) {
    if (this.status.threats.hasOwnProperty(threatType)) {
      this.status.threats[threatType] = true;
      setTimeout(() => {
        this.status.threats[threatType] = false;
        this._notify();
      }, duration);
      this._notify();
    }
  }

  // Take damage to a zone
  takeDamage(zone, amount) {
    if (this.status.armor[zone] !== undefined) {
      this.status.armor[zone] = Math.max(0, this.status.armor[zone] - amount);
      this._updateArmorOverall();
      this._notify();
    }
  }

  // Set mobility mode
  setMobilityMode(mode) {
    const modes = {
      TACTICAL: { speed: 'ENHANCED', drain: 0.02 },
      SPRINT: { speed: 'MAXIMUM', drain: 0.08 },
      CARRY: { speed: 'REDUCED', drain: 0.05 },
      STEALTH: { speed: 'SLOW', drain: 0.01 }
    };
    if (modes[mode]) {
      this.status.mobility.mode = mode;
      this.status.mobility.speed = modes[mode].speed;
      this.status.power.drainRate = modes[mode].drain;
      this._notify();
    }
  }

  // Start simulation
  startSimulation() {
    this.simInterval = setInterval(() => this._simTick(), 3000);
  }

  stopSimulation() {
    if (this.simInterval) clearInterval(this.simInterval);
  }

  onChange(callback) {
    this.callbacks.push(callback);
  }

  // Update DOM suit power bar
  updateDOM() {
    const fill = document.getElementById('suit-power-fill');
    if (fill) {
      const pct = this.status.power.battery;
      fill.style.height = pct + '%';
      if (pct > 50) {
        fill.style.background = 'var(--hud-primary)';
        fill.style.boxShadow = '0 0 6px var(--hud-primary)';
      } else if (pct > 20) {
        fill.style.background = 'var(--hud-caution)';
        fill.style.boxShadow = '0 0 6px var(--hud-caution)';
      } else {
        fill.style.background = 'var(--hud-hostile)';
        fill.style.boxShadow = '0 0 6px var(--hud-hostile)';
      }
    }
  }

  // --- Private ---

  _simTick() {
    // Drain battery
    this.status.power.battery = Math.max(0, this.status.power.battery - this.status.power.drainRate);

    // Update consumption level
    if (this.status.power.battery < 15) {
      this.status.power.consumption = 'CRITICAL';
    } else if (this.status.power.battery < 30) {
      this.status.power.consumption = 'HIGH';
    } else {
      this.status.power.consumption = 'NORMAL';
    }

    // Update runtime estimate
    const hoursLeft = this.status.power.battery / (this.status.power.drainRate * 1200); // ticks per hour
    const h = Math.floor(hoursLeft);
    const m = Math.floor((hoursLeft - h) * 60);
    this.status.power.estimatedRuntime = `${h}h ${m}m`;

    // Random minor events
    if (Math.random() < 0.01) {
      this.simulateThreat('enemyDroneNearby', 5000);
    }

    this._notify();
  }

  _updateArmorOverall() {
    const a = this.status.armor;
    const min = Math.min(a.front, a.rear, a.left, a.right, a.helmet);
    const avg = (a.front + a.rear + a.left + a.right + a.helmet) / 5;
    if (min < 25 || avg < 40) a.overall = 'RED';
    else if (min < 50 || avg < 65) a.overall = 'AMBER';
    else a.overall = 'GREEN';
  }

  _notify() {
    const data = this.getStatus();
    this.callbacks.forEach(cb => cb(data));
  }
}

export const suitStatus = new SuitStatusMonitor();
