// TALOS 2.0 - Drone Type Definitions
// Defines capabilities, specs, and roles for each drone platform in the fleet

export const DRONE_TYPES = {
  ISR: {
    name: 'Reconnaissance Drone',
    role: 'WfF2_INTELLIGENCE',
    icon: 'EYE',
    capabilities: ['Video feed', 'Thermal imaging', 'Signal intercept', 'Laser designation'],
    endurance: 45,        // minutes
    range: 5000,          // meters
    speed: 15,            // m/s max
    cruiseSpeed: 10,      // m/s normal
    payload: null,
    signature: 'LOW',
    tasks: ['OVERWATCH', 'RECON', 'DESIGNATE', 'TRACK', 'RTB'],
    sensorArc: 60,        // degrees field of view
    sensorRange: 500,     // meters effective sensor range
    altitude: { min: 20, max: 120, optimal: 50 },
    noise: 'LOW',
    cost: 'MEDIUM'
  },

  STRIKE: {
    name: 'Strike Drone',
    role: 'WfF3_FIRES',
    icon: 'CROSSHAIR',
    capabilities: ['Precision strike', 'Laser designation', 'Battle damage assessment'],
    endurance: 30,
    range: 3000,
    speed: 20,
    cruiseSpeed: 15,
    payload: { type: 'LOITERING_MUNITION', count: 1, blastRadius: 5 },
    signature: 'MEDIUM',
    tasks: ['ENGAGE', 'DESIGNATE', 'BDA', 'RTB'],
    sensorArc: 45,
    sensorRange: 300,
    altitude: { min: 30, max: 200, optimal: 80 },
    noise: 'MEDIUM',
    cost: 'HIGH'
  },

  EW: {
    name: 'Electronic Warfare Drone',
    role: 'WfF5_PROTECTION',
    icon: 'LIGHTNING',
    capabilities: ['Jamming', 'Signal detection', 'Comms relay', 'Counter-UAS', 'Direction finding'],
    endurance: 40,
    range: 4000,
    speed: 12,
    cruiseSpeed: 8,
    payload: { type: 'JAMMER', modes: ['COMMS', 'GPS', 'RADAR', 'DRONE_LINK'] },
    signature: 'HIGH',
    tasks: ['JAM', 'COUNTER_UAS', 'RELAY', 'SIGINT', 'RTB'],
    sensorArc: 360,
    sensorRange: 1000,
    altitude: { min: 30, max: 150, optimal: 60 },
    noise: 'LOW',
    cost: 'HIGH'
  },

  CARGO: {
    name: 'Resupply Drone',
    role: 'WfF4_SUSTAINMENT',
    icon: 'BOX',
    capabilities: ['Payload delivery', 'Medical resupply', 'Ammo resupply', 'Water resupply'],
    endurance: 20,
    range: 2000,
    speed: 8,
    cruiseSpeed: 6,
    payload: { type: 'CARGO', capacity: 5, unit: 'kg' },
    signature: 'MEDIUM',
    tasks: ['RESUPPLY', 'MEDEVAC_SUPPLY', 'RTB'],
    sensorArc: 0,
    sensorRange: 0,
    altitude: { min: 5, max: 50, optimal: 15 },
    noise: 'HIGH',
    cost: 'LOW'
  },

  SCREEN: {
    name: 'Screening Drone',
    role: 'WfF1_MANEUVER',
    icon: 'RADAR',
    capabilities: ['Perimeter security', 'Trip-wire detection', 'Early warning', 'Acoustic sensing'],
    endurance: 60,
    range: 1000,
    speed: 5,
    cruiseSpeed: 3,
    payload: { type: 'ACOUSTIC_SENSOR', detection_range: 200 },
    signature: 'VERY_LOW',
    tasks: ['PERIMETER', 'SCREEN', 'EARLY_WARNING', 'RTB'],
    sensorArc: 360,
    sensorRange: 200,
    altitude: { min: 1, max: 20, optimal: 5 },
    noise: 'VERY_LOW',
    cost: 'LOW'
  }
};

// Task definitions with WfF alignment
export const TASK_DEFINITIONS = {
  // WfF1 - Movement & Maneuver
  MOVE_TO:        { wff: 'MOVEMENT_AND_MANEUVER', label: 'Move To Position', requiresTarget: false, requiresPosition: true },
  SCREEN:         { wff: 'MOVEMENT_AND_MANEUVER', label: 'Screen Area', requiresTarget: false, requiresPosition: true },
  PERIMETER:      { wff: 'MOVEMENT_AND_MANEUVER', label: 'Establish Perimeter', requiresTarget: false, requiresPosition: false },
  EARLY_WARNING:  { wff: 'MOVEMENT_AND_MANEUVER', label: 'Early Warning Station', requiresTarget: false, requiresPosition: true },

  // WfF2 - Intelligence
  OVERWATCH:      { wff: 'INTELLIGENCE', label: 'Overwatch Position', requiresTarget: false, requiresPosition: true },
  RECON:          { wff: 'INTELLIGENCE', label: 'Reconnaissance', requiresTarget: false, requiresPosition: true },
  TRACK:          { wff: 'INTELLIGENCE', label: 'Track Target', requiresTarget: true, requiresPosition: false },
  SIGINT:         { wff: 'INTELLIGENCE', label: 'Signal Intelligence', requiresTarget: false, requiresPosition: true },

  // WfF3 - Fires
  ENGAGE:         { wff: 'FIRES', label: 'Engage Target', requiresTarget: true, requiresPosition: false },
  DESIGNATE:      { wff: 'FIRES', label: 'Laser Designate', requiresTarget: true, requiresPosition: false },
  BDA:            { wff: 'FIRES', label: 'Battle Damage Assessment', requiresTarget: false, requiresPosition: true },

  // WfF4 - Sustainment
  RESUPPLY:       { wff: 'SUSTAINMENT', label: 'Resupply Delivery', requiresTarget: false, requiresPosition: true },
  MEDEVAC_SUPPLY: { wff: 'SUSTAINMENT', label: 'Medical Resupply', requiresTarget: false, requiresPosition: true },
  RTB:            { wff: 'SUSTAINMENT', label: 'Return to Base', requiresTarget: false, requiresPosition: false },

  // WfF5 - Protection
  JAM:            { wff: 'PROTECTION', label: 'Jam Communications', requiresTarget: false, requiresPosition: true },
  COUNTER_UAS:    { wff: 'PROTECTION', label: 'Counter-UAS Intercept', requiresTarget: true, requiresPosition: false },
  RELAY:          { wff: 'PROTECTION', label: 'Communications Relay', requiresTarget: false, requiresPosition: true }
};

// Get available tasks for a drone type
export function getAvailableTasks(droneType) {
  const type = DRONE_TYPES[droneType];
  if (!type) return [];
  return type.tasks.map(taskId => ({
    id: taskId,
    ...TASK_DEFINITIONS[taskId]
  }));
}

// Get drone type color for HUD rendering
export function getDroneTypeColor(type) {
  const colors = {
    ISR: '#00ffcc',
    STRIKE: '#ff3333',
    EW: '#ffaa00',
    CARGO: '#33ff66',
    SCREEN: '#00aaff'
  };
  return colors[type] || '#ffffff';
}

// Get status color
export function getDroneStatusColor(status) {
  const colors = {
    ACTIVE: '#00ff66',
    TASKED: '#00ffcc',
    READY: '#00aaff',
    RETURNING: '#ffaa00',
    CHARGING: '#ffaa00',
    LOW_BATTERY: '#ff6600',
    OFFLINE: '#666666',
    LOST: '#ff3333'
  };
  return colors[status] || '#ffffff';
}
