// TALOS 2.0 - Time Manager (T - Time Available in METT-TC)
// Mission timeline, decision points, ETA calculations, time-feasibility filtering

class TimeManager {
  constructor() {
    this.missionTime = {
      hHour: null,
      startTime: null,
      currentPhase: 'PLANNING',
      phaseLines: [],
      elapsedSeconds: 0
    };
    this.decisionPoints = [];
    this.enemyETAs = {};
    this.coaTimeEstimates = {
      DRONE_STRIKE: 55,         // seconds (transit + engagement)
      DRONE_OVERWATCH: 30,      // seconds to get on station
      DRONE_RECON: 45,          // seconds
      DRONE_JAM: 15,            // seconds to activate
      DRONE_SCREEN: 40,         // seconds to establish
      OPERATOR_REPOSITION: 20,  // seconds (short move to cover)
      CALL_FOR_FIRE: 480,       // 3-8 minutes
      CAS_REQUEST: 1200,        // 15-25 minutes
      OBSTACLE_EMPLACE: 1800,   // 15-30 minutes
      POSITION_CHANGE: 600      // 5-10 minutes
    };
    this.updateInterval = null;
  }

  // Initialize from mission context
  init(missionConfig) {
    this.missionTime.startTime = Date.now();
    this.missionTime.hHour = new Date(this.missionTime.startTime);
    this.missionTime.currentPhase = missionConfig.phase || 'PREPARATION';
    this.missionTime.elapsedSeconds = 0;

    // Set up phase lines based on mission type
    const phaseConfigs = {
      OFFENSE: [
        { name: 'PL_BLUE', offsetMin: 15, status: 'UPCOMING' },
        { name: 'PL_RED', offsetMin: 30, status: 'UPCOMING' },
        { name: 'PL_BLACK', offsetMin: 45, status: 'UPCOMING' },
        { name: 'OBJ_ALPHA', offsetMin: 60, status: 'UPCOMING' }
      ],
      DEFENSE: [
        { name: 'STAND_TO', offsetMin: 0, status: 'PASSED' },
        { name: 'EA_ACTIVE', offsetMin: 10, status: 'UPCOMING' },
        { name: 'FALLBACK', offsetMin: 45, status: 'UPCOMING' },
        { name: 'CONSOLIDATE', offsetMin: 60, status: 'UPCOMING' }
      ],
      STABILITY: [
        { name: 'SP', offsetMin: 0, status: 'PASSED' },
        { name: 'CP_1', offsetMin: 20, status: 'UPCOMING' },
        { name: 'CP_2', offsetMin: 40, status: 'UPCOMING' },
        { name: 'CP_3', offsetMin: 60, status: 'UPCOMING' }
      ],
      RECON: [
        { name: 'SP', offsetMin: 0, status: 'PASSED' },
        { name: 'RP_1', offsetMin: 15, status: 'UPCOMING' },
        { name: 'RP_2', offsetMin: 30, status: 'UPCOMING' },
        { name: 'ORP', offsetMin: 45, status: 'UPCOMING' }
      ]
    };

    const mtype = missionConfig.missionType || 'DEFENSE';
    this.missionTime.phaseLines = (phaseConfigs[mtype] || phaseConfigs.DEFENSE).map(pl => ({
      ...pl,
      time: `H+${pl.offsetMin}`,
      absoluteTime: new Date(this.missionTime.startTime + pl.offsetMin * 60000)
    }));

    // Set up decision points
    this.decisionPoints = [
      {
        description: `Commit reserve if enemy breaches ${this.missionTime.phaseLines[1]?.name || 'PL'}`,
        triggerCondition: `Enemy past ${this.missionTime.phaseLines[1]?.name || 'PL'}`,
        timeWindow: `H+${(this.missionTime.phaseLines[1]?.offsetMin || 10) - 5} to H+${(this.missionTime.phaseLines[1]?.offsetMin || 10) + 5}`,
        status: 'PENDING'
      },
      {
        description: 'Request external fires support if enemy strength exceeds 2:1',
        triggerCondition: 'Force ratio unfavorable',
        timeWindow: 'Any time',
        status: 'PENDING'
      }
    ];
  }

  // Update enemy ETAs from tracker data
  updateEnemyETAs(trackedEntities, depthData) {
    this.enemyETAs = {};
    if (!trackedEntities) return;

    for (const entity of trackedEntities) {
      if (!entity.movement || !entity.distance) continue;
      if (entity.classification !== 'HOSTILE' && entity.classification !== 'UNKNOWN') continue;

      const speed = entity.movement.speed || 0;
      const dist = entity.distance.meters || 0;
      const heading = entity.movement.heading || '';

      if (speed > 0.5 && heading === 'APPROACHING') {
        const etaSeconds = dist / speed;
        this.enemyETAs[entity.id] = {
          toOurPosition: this._formatETA(etaSeconds),
          etaSeconds,
          speed: speed.toFixed(1) + ' m/s',
          urgency: etaSeconds < 30 ? 'CRITICAL' : etaSeconds < 120 ? 'HIGH' : 'MEDIUM'
        };
      }
    }
  }

  // Check if a COA is time-feasible
  isTimeFeasible(coaType, urgentThreatETA) {
    const estimatedTime = this.coaTimeEstimates[coaType];
    if (!estimatedTime) return { feasible: true, reason: 'Unknown time estimate' };
    if (!urgentThreatETA) return { feasible: true, timeToExecute: estimatedTime };

    const feasible = estimatedTime < urgentThreatETA * 0.8; // 80% safety margin
    return {
      feasible,
      timeToExecute: estimatedTime,
      threatArrival: urgentThreatETA,
      reason: feasible
        ? `Completes in ${this._formatETA(estimatedTime)} (threat arrives ${this._formatETA(urgentThreatETA)})`
        : `Takes ${this._formatETA(estimatedTime)} but threat arrives in ${this._formatETA(urgentThreatETA)}`
    };
  }

  // Get most urgent enemy ETA
  getMostUrgentETA() {
    let minEta = Infinity;
    let urgentEntity = null;
    for (const [id, eta] of Object.entries(this.enemyETAs)) {
      if (eta.etaSeconds < minEta) {
        minEta = eta.etaSeconds;
        urgentEntity = { id, ...eta };
      }
    }
    return urgentEntity;
  }

  // Get current mission time data
  getTimeData() {
    const elapsed = (Date.now() - (this.missionTime.startTime || Date.now())) / 1000;
    this.missionTime.elapsedSeconds = elapsed;

    // Update phase line statuses
    const now = Date.now();
    for (const pl of this.missionTime.phaseLines) {
      if (pl.absoluteTime && now >= pl.absoluteTime.getTime()) {
        pl.status = 'PASSED';
      }
    }

    return {
      missionTime: { ...this.missionTime },
      enemyETAs: { ...this.enemyETAs },
      decisionPoints: [...this.decisionPoints],
      mostUrgentThreat: this.getMostUrgentETA(),
      missionElapsed: this._formatETA(elapsed)
    };
  }

  // Start update loop
  startUpdates() {
    this.updateInterval = setInterval(() => {
      // Phase line updates happen in getTimeData()
    }, 5000);
  }

  stopUpdates() {
    if (this.updateInterval) clearInterval(this.updateInterval);
  }

  _formatETA(seconds) {
    if (seconds < 60) return `~${Math.round(seconds)}s`;
    if (seconds < 3600) return `~${Math.round(seconds / 60)}min`;
    const h = Math.floor(seconds / 3600);
    const m = Math.round((seconds % 3600) / 60);
    return `~${h}h ${m}m`;
  }
}

export const timeManager = new TimeManager();
