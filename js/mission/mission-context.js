// =============================================================================
// TALOS 2.0 - Mission Context Manager
// Stores current mission configuration with preset tactical scenarios
// =============================================================================

/**
 * ROE levels.
 */
export const ROE_LEVELS = Object.freeze({
    WEAPONS_HOLD: 'WEAPONS_HOLD',
    WEAPONS_TIGHT: 'WEAPONS_TIGHT',
    WEAPONS_FREE: 'WEAPONS_FREE'
});

/**
 * Mission types.
 */
export const MISSION_TYPES = Object.freeze({
    AREA_DEFENSE: 'AREA_DEFENSE',
    MOVEMENT_TO_CONTACT: 'MOVEMENT_TO_CONTACT',
    STABILITY_OPS: 'STABILITY_OPS',
    ATTACK: 'ATTACK',
    DELAY: 'DELAY',
    RECONNAISSANCE: 'RECONNAISSANCE'
});

/**
 * Predefined scenario database.
 */
const SCENARIOS = Object.freeze({

    AREA_DEFENSE: {
        missionType: MISSION_TYPES.AREA_DEFENSE,
        taskAndPurpose: 'Defend OBJ ALPHA in sector in order to deny enemy access to MSR TAMPA and protect friendly logistics corridor.',
        commandersIntent: {
            purpose: 'Deny the enemy the ability to interdict MSR TAMPA.',
            keyTasks: [
                'Establish mutually supporting defensive positions on OBJ ALPHA.',
                'Emplace obstacles to canalize enemy into engagement areas.',
                'Maintain a platoon reserve for counter-attack.',
                'Maintain continuous observation of Avenues of Approach 1 and 2.',
                'Coordinate indirect fire plan to disrupt enemy formations before they reach the EA.'
            ],
            endState: 'Enemy attack defeated with a minimum force ratio of 3:1 in our favor on decisive terrain. MSR TAMPA remains open. Friendly forces retain OBJ ALPHA with combat power to sustain defense for 72 hours.'
        },
        phase: 'PHASE_1_PREPARE',
        phases: [
            { name: 'PHASE_0_PLAN', description: 'Planning and coordination' },
            { name: 'PHASE_1_PREPARE', description: 'Occupy and prepare defensive positions' },
            { name: 'PHASE_2_DEFEND', description: 'Active defense against enemy attack' },
            { name: 'PHASE_3_COUNTERATTACK', description: 'Counter-attack to restore positions' },
            { name: 'PHASE_4_CONSOLIDATE', description: 'Consolidate and reorganize' }
        ],
        PIRs: [
            {
                id: 'PIR-1',
                question: 'What is the enemy composition and strength approaching from the NE?',
                indicators: ['vehicle', 'truck', 'person_group'],
                bearing: { min: 20, max: 70 },
                priority: 1,
                lastUpdate: null
            },
            {
                id: 'PIR-2',
                question: 'When will the enemy reach EA STEEL (2km NE of OBJ ALPHA)?',
                indicators: ['vehicle', 'truck'],
                bearing: { min: 30, max: 60 },
                rangeThreshold: 2000,
                priority: 1,
                lastUpdate: null
            },
            {
                id: 'PIR-3',
                question: 'Is the enemy employing reconnaissance or advance guard elements?',
                indicators: ['person', 'car'],
                bearing: { min: 10, max: 80 },
                priority: 2,
                lastUpdate: null
            },
            {
                id: 'PIR-4',
                question: 'Are there enemy indirect fire positions establishing to support the attack?',
                indicators: ['truck'],
                bearing: { min: 40, max: 90 },
                rangeThreshold: 6000,
                priority: 2,
                lastUpdate: null
            },
            {
                id: 'PIR-5',
                question: 'Is the enemy attempting to bypass OBJ ALPHA through alternate avenues?',
                indicators: ['vehicle', 'truck', 'person'],
                bearing: { min: 0, max: 180 },
                priority: 3,
                lastUpdate: null
            }
        ],
        ROE: {
            level: ROE_LEVELS.WEAPONS_TIGHT,
            rules: [
                'PID required before engagement.',
                'Engage only positively identified hostile forces.',
                'Escalation of force procedures apply to all unknown persons.',
                'No fires within 200m of marked protected structures without CDR approval.',
                'Indirect fire requires CDR approval in built-up areas.',
                'Drone strikes require confirmation of hostile act/intent.',
                'Minimize collateral damage at all times.'
            ],
            specialInstructions: [
                'Hospital at grid 38SKU4535068200 is a protected structure - 500m no-fire radius.',
                'Mosque at grid 38SKU4518067700 is a protected structure - 200m no-fire radius.',
                'Civilian evacuation corridor runs N-S along Phase Line BLUE.',
                'ROE escalation to WEAPONS_FREE requires Battalion CDR approval.'
            ]
        },
        CCIR: {
            FFIR: [
                'Can we sustain defense for 72 hours with current ammunition and supply levels?',
                'Are all defensive positions manned and obstacle systems complete?',
                'Is the reserve force postured for counter-attack?'
            ],
            EEFI: [
                'Friendly defensive positions and obstacle locations.',
                'Counter-attack plan and triggers.',
                'Drone capabilities and fleet status.'
            ]
        },
        engagementAreas: [
            { name: 'EA STEEL', bearing: 45, range: 2000, width: 500 },
            { name: 'EA IRON', bearing: 30, range: 1500, width: 400 }
        ]
    },

    MOVEMENT_TO_CONTACT: {
        missionType: MISSION_TYPES.MOVEMENT_TO_CONTACT,
        taskAndPurpose: 'Advance to contact along Axis LION in order to locate, fix, and destroy enemy forces and seize OBJ BRAVO.',
        commandersIntent: {
            purpose: 'Destroy enemy forces in zone and seize OBJ BRAVO to enable follow-on operations.',
            keyTasks: [
                'Maintain security in all directions during movement.',
                'Establish contact with enemy with the smallest element possible.',
                'Rapidly develop the situation upon contact.',
                'Seize OBJ BRAVO no later than H+4.',
                'Maintain momentum - do not become decisively engaged on unfavorable terrain.'
            ],
            endState: 'OBJ BRAVO secured. Enemy forces in zone destroyed or rendered combat ineffective. Friendly forces postured for follow-on operations with at least 70% combat power.'
        },
        phase: 'PHASE_1_MOVEMENT',
        phases: [
            { name: 'PHASE_0_PLAN', description: 'Planning and rehearsal' },
            { name: 'PHASE_1_MOVEMENT', description: 'Movement to contact along Axis LION' },
            { name: 'PHASE_2_CONTACT', description: 'Develop the situation at point of contact' },
            { name: 'PHASE_3_ASSAULT', description: 'Assault OBJ BRAVO' },
            { name: 'PHASE_4_CONSOLIDATE', description: 'Consolidate on OBJ BRAVO' }
        ],
        PIRs: [
            {
                id: 'PIR-1',
                question: 'Where is the enemy main defense along Axis LION?',
                indicators: ['person', 'truck', 'car'],
                bearing: { min: 0, max: 360 },
                priority: 1,
                lastUpdate: null
            },
            {
                id: 'PIR-2',
                question: 'What is the enemy strength and composition on OBJ BRAVO?',
                indicators: ['person', 'truck', 'car'],
                bearing: { min: 330, max: 30 },
                priority: 1,
                lastUpdate: null
            },
            {
                id: 'PIR-3',
                question: 'Are there obstacles or IEDs along Axis LION?',
                indicators: [],
                bearing: { min: 340, max: 20 },
                priority: 2,
                lastUpdate: null
            },
            {
                id: 'PIR-4',
                question: 'Does the enemy have a reserve force that could counter-attack?',
                indicators: ['truck', 'car'],
                bearing: { min: 0, max: 360 },
                priority: 2,
                lastUpdate: null
            }
        ],
        ROE: {
            level: ROE_LEVELS.WEAPONS_TIGHT,
            rules: [
                'PID required before engagement.',
                'Engage positively identified hostile forces.',
                'Return fire immediately if fired upon.',
                'Crew-served weapons require squad leader approval.',
                'Drone strikes require platoon leader approval.',
                'Minimize collateral damage.',
                'Civilian evacuation takes priority when feasible.'
            ],
            specialInstructions: [
                'School complex near OBJ BRAVO at grid 38SKU5000070000 - 300m no-fire radius.',
                'Known civilian population in village along Axis LION.',
                'Upon escalation to WEAPONS_FREE, engage all hostile forces without further clearance.'
            ]
        },
        CCIR: {
            FFIR: [
                'Is the lead element maintaining rate of advance?',
                'Are flank security elements in position?',
                'What is current ammunition status?'
            ],
            EEFI: [
                'Friendly axis of advance and timeline.',
                'Location and composition of lead element.',
                'Drone reconnaissance pattern.'
            ]
        },
        engagementAreas: []
    },

    STABILITY_OPS: {
        missionType: MISSION_TYPES.STABILITY_OPS,
        taskAndPurpose: 'Provide area security in sector in order to protect the civilian population and enable governance and essential services.',
        commandersIntent: {
            purpose: 'Establish a secure environment that enables legitimate governance and protects the civilian population.',
            keyTasks: [
                'Conduct presence patrols in all neighborhoods on 4-hour cycle.',
                'Establish and man checkpoints on key intersections.',
                'Engage key leaders weekly to assess population needs.',
                'Respond to security incidents within 15 minutes.',
                'Coordinate with host nation security forces for joint operations.'
            ],
            endState: 'Sector secure with zero civilian casualties from friendly operations. Host nation security forces capable of independent operations. Population confidence in security increased.'
        },
        phase: 'PHASE_2_PRESENCE',
        phases: [
            { name: 'PHASE_0_ASSESSMENT', description: 'Sector assessment and key leader engagement' },
            { name: 'PHASE_1_ESTABLISH', description: 'Establish checkpoints and patrol bases' },
            { name: 'PHASE_2_PRESENCE', description: 'Continuous presence patrols and engagement' },
            { name: 'PHASE_3_TRANSITION', description: 'Transition security to host nation forces' }
        ],
        PIRs: [
            {
                id: 'PIR-1',
                question: 'Are there armed groups operating in sector?',
                indicators: ['person'],
                bearing: { min: 0, max: 360 },
                priority: 1,
                lastUpdate: null
            },
            {
                id: 'PIR-2',
                question: 'Is the civilian population supportive, neutral, or hostile to friendly forces?',
                indicators: ['person'],
                bearing: { min: 0, max: 360 },
                priority: 2,
                lastUpdate: null
            },
            {
                id: 'PIR-3',
                question: 'Are there IED or explosive threats along patrol routes?',
                indicators: [],
                bearing: { min: 0, max: 360 },
                priority: 1,
                lastUpdate: null
            },
            {
                id: 'PIR-4',
                question: 'Are host nation security forces reliable and effective?',
                indicators: [],
                bearing: { min: 0, max: 360 },
                priority: 3,
                lastUpdate: null
            }
        ],
        ROE: {
            level: ROE_LEVELS.WEAPONS_HOLD,
            rules: [
                'Engage ONLY in response to a hostile act or demonstrated hostile intent.',
                'Escalation of force required: shout, show, shove, shoot.',
                'Warning shots authorized only with squad leader approval.',
                'Lethal force is a last resort.',
                'All engagements will be investigated and reported.',
                'Drone surveillance requires platoon leader approval.',
                'No offensive drone strikes without company CDR approval and JAG review.'
            ],
            specialInstructions: [
                'Market area (grid 38SKU4500067500) is a no-fire zone during market hours (0600-1800).',
                'Hospital, mosque, and school are permanent no-fire zones.',
                'All use of force incidents require immediate reporting.',
                'Detainees must be processed IAW detention SOP within 12 hours.',
                'Proportionality is paramount - minimize all use of force.'
            ]
        },
        CCIR: {
            FFIR: [
                'Are patrol routes compromised?',
                'Is host nation partnership effective?',
                'Are there signs of population turning hostile?'
            ],
            EEFI: [
                'Patrol routes and schedules.',
                'Checkpoint locations and manning.',
                'Intelligence sources and methods.'
            ]
        },
        engagementAreas: []
    }
});

/**
 * Mission context manager.
 * Stores and manages current mission configuration with preset scenarios.
 */
export class MissionContext {
    constructor() {
        /** @type {Object|null} Current mission data */
        this._mission = null;

        /** @type {string|null} Current scenario name */
        this._scenarioName = null;

        console.log('[MISSION] Mission context manager initialized');
    }

    /**
     * Load a preset scenario by name.
     *
     * @param {string} name - 'AREA_DEFENSE', 'MOVEMENT_TO_CONTACT', or 'STABILITY_OPS'
     * @returns {boolean} True if scenario loaded successfully
     */
    loadScenario(name) {
        const scenario = SCENARIOS[name];
        if (!scenario) {
            console.error(`[MISSION] Unknown scenario: ${name}. Available: ${Object.keys(SCENARIOS).join(', ')}`);
            return false;
        }

        // Deep clone to allow mutation
        this._mission = JSON.parse(JSON.stringify(scenario));
        this._scenarioName = name;

        console.log(`[MISSION] Scenario loaded: ${name}`);
        console.log(`[MISSION] Type: ${this._mission.missionType}`);
        console.log(`[MISSION] Task: ${this._mission.taskAndPurpose}`);
        console.log(`[MISSION] Phase: ${this._mission.phase}`);
        console.log(`[MISSION] ROE: ${this._mission.ROE.level}`);
        console.log(`[MISSION] PIRs: ${this._mission.PIRs.length}`);

        return true;
    }

    /**
     * Get the full mission configuration.
     *
     * @returns {Object|null}
     */
    getMission() {
        return this._mission;
    }

    /**
     * Get the current ROE configuration.
     *
     * @returns {{ level: string, rules: string[], specialInstructions: string[] } | null}
     */
    getROE() {
        return this._mission ? this._mission.ROE : null;
    }

    /**
     * Get the current priority intelligence requirements.
     *
     * @returns {Object[] | null}
     */
    getPIRs() {
        return this._mission ? this._mission.PIRs : null;
    }

    /**
     * Get the current mission phase.
     *
     * @returns {string | null}
     */
    getPhase() {
        return this._mission ? this._mission.phase : null;
    }

    /**
     * Set the current mission phase.
     *
     * @param {string} phase - Phase name to set
     * @returns {boolean} True if phase exists in the scenario
     */
    setPhase(phase) {
        if (!this._mission) {
            console.error('[MISSION] No mission loaded');
            return false;
        }

        const validPhase = this._mission.phases.find(p => p.name === phase);
        if (!validPhase) {
            console.error(`[MISSION] Invalid phase: ${phase}. Valid phases: ${this._mission.phases.map(p => p.name).join(', ')}`);
            return false;
        }

        const oldPhase = this._mission.phase;
        this._mission.phase = phase;
        console.log(`[MISSION] Phase changed: ${oldPhase} -> ${phase} (${validPhase.description})`);
        return true;
    }

    /**
     * Get available scenario names.
     *
     * @returns {string[]}
     */
    getAvailableScenarios() {
        return Object.keys(SCENARIOS);
    }

    /**
     * Get the current scenario name.
     *
     * @returns {string|null}
     */
    getScenarioName() {
        return this._scenarioName;
    }

    /**
     * Get the mission type.
     *
     * @returns {string|null}
     */
    getMissionType() {
        return this._mission ? this._mission.missionType : null;
    }

    /**
     * Get the commander's intent.
     *
     * @returns {Object|null}
     */
    getCommandersIntent() {
        return this._mission ? this._mission.commandersIntent : null;
    }

    /**
     * Get engagement areas for the current mission.
     *
     * @returns {Object[]}
     */
    getEngagementAreas() {
        return this._mission ? this._mission.engagementAreas : [];
    }

    /**
     * Check if a detection matches any PIR.
     * A detection matches a PIR if:
     * 1. Its YOLO class is in the PIR's indicators list (or indicators list is empty and we check bearing only).
     * 2. Its bearing falls within the PIR's bearing range.
     * 3. If the PIR has a rangeThreshold, the detection's range must be within that threshold.
     *
     * @param {Object} detection - { class: string, bearing: number, range: number }
     * @param {Object} [terrain] - Optional terrain context { type: string }
     * @returns {{ matched: boolean, matchedPIRs: Object[] }}
     */
    checkPIR(detection, terrain) {
        const result = { matched: false, matchedPIRs: [] };

        if (!this._mission || !detection) {
            return result;
        }

        for (const pir of this._mission.PIRs) {
            let indicatorMatch = false;

            // Check if detection class matches any indicator
            if (pir.indicators.length === 0) {
                // PIR with no specific indicators matches on bearing/range only
                indicatorMatch = true;
            } else if (detection.class && pir.indicators.includes(detection.class)) {
                indicatorMatch = true;
            }

            if (!indicatorMatch) continue;

            // Check bearing range
            let bearingMatch = false;
            const detBearing = detection.bearing !== undefined ? detection.bearing : null;

            if (detBearing === null) {
                // No bearing info, accept based on indicator match alone
                bearingMatch = true;
            } else if (pir.bearing.min <= pir.bearing.max) {
                // Normal range (e.g., 20-70)
                bearingMatch = detBearing >= pir.bearing.min && detBearing <= pir.bearing.max;
            } else {
                // Wrapping range (e.g., 330-30 means 330-360 and 0-30)
                bearingMatch = detBearing >= pir.bearing.min || detBearing <= pir.bearing.max;
            }

            if (!bearingMatch) continue;

            // Check range threshold if defined
            if (pir.rangeThreshold !== undefined && detection.range !== undefined) {
                if (detection.range > pir.rangeThreshold) continue;
            }

            // Match found
            result.matched = true;
            result.matchedPIRs.push({
                pirId: pir.id,
                question: pir.question,
                priority: pir.priority,
                matchedBy: {
                    class: detection.class,
                    bearing: detBearing,
                    range: detection.range
                }
            });

            // Update PIR last update timestamp
            pir.lastUpdate = new Date().toISOString();
        }

        return result;
    }

    /**
     * Set the ROE level.
     *
     * @param {string} level - One of ROE_LEVELS values
     * @returns {boolean}
     */
    setROE(level) {
        if (!this._mission) {
            console.error('[MISSION] No mission loaded');
            return false;
        }
        if (!Object.values(ROE_LEVELS).includes(level)) {
            console.error(`[MISSION] Invalid ROE level: ${level}`);
            return false;
        }
        const oldLevel = this._mission.ROE.level;
        this._mission.ROE.level = level;
        console.log(`[MISSION] ROE changed: ${oldLevel} -> ${level}`);
        return true;
    }

    /**
     * Add a PIR to the current mission.
     *
     * @param {Object} pir - PIR object
     * @returns {boolean}
     */
    addPIR(pir) {
        if (!this._mission) {
            console.error('[MISSION] No mission loaded');
            return false;
        }
        if (!pir.id || !pir.question) {
            console.error('[MISSION] PIR must have id and question');
            return false;
        }
        pir.lastUpdate = null;
        this._mission.PIRs.push(pir);
        console.log(`[MISSION] PIR added: ${pir.id} - ${pir.question}`);
        return true;
    }

    /**
     * Get a summary of the current mission state.
     *
     * @returns {Object|null}
     */
    getSummary() {
        if (!this._mission) return null;
        return {
            scenario: this._scenarioName,
            missionType: this._mission.missionType,
            phase: this._mission.phase,
            roe: this._mission.ROE.level,
            pirCount: this._mission.PIRs.length,
            pirAnswered: this._mission.PIRs.filter(p => p.lastUpdate !== null).length,
            taskAndPurpose: this._mission.taskAndPurpose
        };
    }
}

console.log('[MISSION] Mission context module loaded');
