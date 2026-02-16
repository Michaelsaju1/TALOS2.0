// TALOS 2.0 - Mission Configuration Panel
// Pre-built mission scenarios for MVP. Operator selects mission → system reconfigures.

const MISSIONS = [
  {
    id: 'AREA_DEFENSE',
    label: 'AREA DEFENSE',
    description: 'Defend OBJ ALPHA, deny enemy access to MSR TAMPA',
    missionType: 'DEFENSE',
    taskAndPurpose: 'Defend OBJ ALPHA in order to deny enemy access to MSR TAMPA',
    commandersIntent: {
      purpose: 'Prevent enemy penetration of defensive line',
      keyTasks: ['Hold key terrain at Hill 205', 'Destroy enemy armor in EA LION', 'Maintain drone ISR on AVE-1'],
      endState: 'Enemy attack repelled, defensive positions intact, drone fleet at >50% capacity'
    },
    phase: 'PREPARATION',
    priorityIntelRequirements: [
      'Enemy armor movement along AVE-1',
      'Enemy reconnaissance elements within 1km',
      'Enemy electronic warfare activity'
    ],
    rulesOfEngagement: {
      level: 'WEAPONS_TIGHT',
      restrictions: ['PID required before engagement', 'No fires within 500m of mosque at grid XY4567'],
      escalationOfForce: ['SHOUT', 'SHOW', 'SHOVE', 'SHOOT']
    },
    fleetComposition: { ISR: 2, STRIKE: 2, EW: 1, CARGO: 1, SCREEN: 2 }
  },
  {
    id: 'MOVEMENT_TO_CONTACT',
    label: 'MOVEMENT TO CONTACT',
    description: 'Advance to OBJ BRAVO, destroy enemy forces en route',
    missionType: 'OFFENSE',
    taskAndPurpose: 'Advance to OBJ BRAVO in order to destroy enemy forces and seize objective',
    commandersIntent: {
      purpose: 'Destroy enemy forward elements and seize key terrain',
      keyTasks: ['Maintain advance along MSR TAMPA', 'Destroy enemy vehicles on contact', 'Secure OBJ BRAVO'],
      endState: 'OBJ BRAVO secured, enemy forces destroyed or displaced, LOC open'
    },
    phase: 'EXECUTION',
    priorityIntelRequirements: [
      'Enemy defensive positions along MSR TAMPA',
      'IED/obstacle indicators on route',
      'Enemy reinforcement routes'
    ],
    rulesOfEngagement: {
      level: 'WEAPONS_FREE',
      restrictions: ['Minimize collateral damage', 'Report all engagements'],
      escalationOfForce: ['SHOOT']
    },
    fleetComposition: { ISR: 3, STRIKE: 2, EW: 1, CARGO: 1, SCREEN: 1 }
  },
  {
    id: 'SECURITY_PATROL',
    label: 'SECURITY PATROL',
    description: 'Conduct security patrol in sector, protect civilian population',
    missionType: 'STABILITY',
    taskAndPurpose: 'Conduct security patrol in Sector 7 in order to protect civilian population and deter insurgent activity',
    commandersIntent: {
      purpose: 'Maintain security and build rapport with local population',
      keyTasks: ['Patrol all checkpoints', 'Identify suspicious activity', 'Respond to civilian reports'],
      endState: 'Sector secure, no insurgent activity, civilian population confident'
    },
    phase: 'EXECUTION',
    priorityIntelRequirements: [
      'IED indicators along patrol route',
      'Suspicious activity near checkpoints',
      'Changes in civilian pattern of life'
    ],
    rulesOfEngagement: {
      level: 'WEAPONS_HOLD',
      restrictions: ['Fire only in self-defense after hostile act', 'No indirect fire in populated areas', 'De-escalation required'],
      escalationOfForce: ['SHOUT', 'SHOW', 'SHOVE', 'SHOOT']
    },
    fleetComposition: { ISR: 2, STRIKE: 1, EW: 1, CARGO: 1, SCREEN: 3 }
  },
  {
    id: 'ROUTE_RECON',
    label: 'ROUTE RECONNAISSANCE',
    description: 'Recon MSR TAMPA from CP1 to CP3, report all activity',
    missionType: 'RECON',
    taskAndPurpose: 'Conduct route reconnaissance of MSR TAMPA from CP1 to CP3 in order to determine route trafficability and enemy presence',
    commandersIntent: {
      purpose: 'Develop intelligence on route conditions and enemy activity',
      keyTasks: ['Recon entire route', 'Identify obstacles and bypass routes', 'Locate enemy observation posts'],
      endState: 'Route assessed, obstacles mapped, enemy disposition reported'
    },
    phase: 'EXECUTION',
    priorityIntelRequirements: [
      'Obstacles and IEDs on MSR TAMPA',
      'Enemy observation posts along route',
      'Bridge/culvert conditions'
    ],
    rulesOfEngagement: {
      level: 'WEAPONS_TIGHT',
      restrictions: ['Avoid decisive engagement', 'Break contact if outnumbered', 'Stealth priority'],
      escalationOfForce: ['SHOUT', 'SHOW', 'SHOOT']
    },
    fleetComposition: { ISR: 3, STRIKE: 1, EW: 1, CARGO: 0, SCREEN: 3 }
  }
];

export class MissionPanel {
  constructor() {
    this.panel = null;
    this.visible = false;
    this.selectedMission = null;
    this.missionCallback = null;
  }

  init() {
    // Create panel DOM element
    this.panel = document.createElement('div');
    this.panel.id = 'mission-config-panel';
    this.panel.style.cssText = `
      position:fixed; top:0; left:0; width:100%; height:100%; z-index:60;
      background:rgba(0,0,0,0.95); display:none; overflow-y:auto;
      font-family:'Courier New',monospace; color:#00ffcc; padding:20px 16px;
    `;
    this._render();
    document.body.appendChild(this.panel);
  }

  show() {
    if (this.panel) {
      this.panel.style.display = 'block';
      this.visible = true;
    }
  }

  hide() {
    if (this.panel) {
      this.panel.style.display = 'none';
      this.visible = false;
    }
  }

  toggle() {
    if (this.visible) this.hide();
    else this.show();
  }

  onMissionSelected(callback) {
    this.missionCallback = callback;
  }

  getCurrentMission() {
    return this.selectedMission;
  }

  _render() {
    let html = `
      <div style="text-align:center;margin-bottom:20px;">
        <div style="font-size:18px;font-weight:bold;letter-spacing:4px;text-shadow:0 0 10px rgba(0,255,204,0.5);">MISSION SELECT</div>
        <div style="font-size:10px;opacity:0.5;margin-top:4px;">TALOS 2.0 TACTICAL CONFIGURATION</div>
      </div>
    `;

    for (const mission of MISSIONS) {
      html += `
        <div class="mission-option" data-id="${mission.id}" style="
          border:1px solid rgba(0,255,204,0.3); padding:12px; margin:10px 0;
          cursor:pointer; transition:border-color 0.2s;
        ">
          <div style="font-size:12px;font-weight:bold;letter-spacing:2px;">${mission.label}</div>
          <div style="font-size:10px;color:#aaa;margin:4px 0;">${mission.description}</div>
          <div style="font-size:9px;opacity:0.6;">
            ROE: ${mission.rulesOfEngagement.level} | PHASE: ${mission.phase}
          </div>
          <div style="font-size:9px;opacity:0.5;margin-top:4px;">
            FLEET: ISR:${mission.fleetComposition.ISR} STK:${mission.fleetComposition.STRIKE}
            EW:${mission.fleetComposition.EW} CGO:${mission.fleetComposition.CARGO}
            SCR:${mission.fleetComposition.SCREEN}
          </div>
        </div>
      `;
    }

    html += `
      <div style="text-align:center;margin-top:20px;">
        <button id="mission-deploy-btn" style="
          background:none; border:2px solid #00ffcc; color:#00ffcc;
          padding:10px 30px; font-family:'Courier New',monospace;
          font-size:14px; letter-spacing:3px; cursor:pointer;
          text-transform:uppercase; opacity:0.4; pointer-events:none;
        ">DEPLOY</button>
      </div>
      <div style="text-align:center;margin-top:10px;">
        <button id="mission-cancel-btn" style="
          background:none; border:1px solid rgba(255,255,255,0.2); color:#666;
          padding:6px 20px; font-family:'Courier New',monospace;
          font-size:10px; cursor:pointer; letter-spacing:2px;
        ">CANCEL</button>
      </div>
    `;

    this.panel.innerHTML = html;

    // Attach event listeners
    this.panel.querySelectorAll('.mission-option').forEach(option => {
      option.addEventListener('click', () => {
        // Deselect all
        this.panel.querySelectorAll('.mission-option').forEach(o => {
          o.style.borderColor = 'rgba(0,255,204,0.3)';
          o.style.background = 'none';
        });
        // Select this one
        option.style.borderColor = '#00ffcc';
        option.style.background = 'rgba(0,255,204,0.08)';
        this.selectedMission = MISSIONS.find(m => m.id === option.dataset.id);

        // Enable deploy button
        const deployBtn = document.getElementById('mission-deploy-btn');
        if (deployBtn) {
          deployBtn.style.opacity = '1';
          deployBtn.style.pointerEvents = 'auto';
        }
      });
    });

    // Deploy button
    this.panel.querySelector('#mission-deploy-btn')?.addEventListener('click', () => {
      if (this.selectedMission && this.missionCallback) {
        this.missionCallback(this.selectedMission);
      }
      this.hide();
    });

    // Cancel button
    this.panel.querySelector('#mission-cancel-btn')?.addEventListener('click', () => {
      this.hide();
    });
  }
}

export const missionPanel = new MissionPanel();
