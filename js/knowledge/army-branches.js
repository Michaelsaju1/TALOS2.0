// =============================================================================
// TALOS 2.0 - Army Branch Doctrine Knowledge Base
// Full 24-branch Army doctrine database with capabilities, equipment,
// strengths/weaknesses, counter-tactics, and terrain modifiers
// =============================================================================

/**
 * Branch category constants.
 */
export const BranchCategory = Object.freeze({
    COMBAT_ARMS: 'COMBAT_ARMS',
    COMBAT_SUPPORT: 'COMBAT_SUPPORT',
    CSS: 'CSS', // Combat Service Support
    SPECIAL: 'SPECIAL'
});

/**
 * Full 24-branch Army doctrine database.
 * Each entry contains realistic doctrine-accurate data for threat assessment,
 * detection classification, and tactical recommendation generation.
 *
 * Equipment threatRating: 0.0 (minimal) to 1.0 (extreme lethality)
 * Equipment range: effective range in meters
 * Terrain effectiveness: 0.0 (unable) to 1.0 (optimal)
 */
export const ARMY_BRANCHES = Object.freeze({

    // =========================================================================
    // COMBAT ARMS
    // =========================================================================

    INFANTRY: {
        name: 'Infantry',
        category: BranchCategory.COMBAT_ARMS,
        capabilities: [
            'Close combat operations',
            'Urban warfare',
            'Dismounted patrols',
            'Area defense',
            'Ambush and raid',
            'Reconnaissance in force',
            'Cordon and search',
            'Key leader engagement'
        ],
        equipment: [
            { name: 'M4A1', type: 'rifle', threatRating: 0.3, range: 300 },
            { name: 'M249 SAW', type: 'lmg', threatRating: 0.5, range: 800 },
            { name: 'M240B', type: 'mmg', threatRating: 0.6, range: 1100 },
            { name: 'M320 GLM', type: 'grenade_launcher', threatRating: 0.4, range: 400 },
            { name: 'M136 AT4', type: 'anti_armor', threatRating: 0.7, range: 300 },
            { name: 'FGM-148 Javelin', type: 'anti_armor', threatRating: 0.9, range: 2500 },
            { name: 'M18 Claymore', type: 'mine', threatRating: 0.5, range: 50 },
            { name: 'M67 Fragmentation Grenade', type: 'grenade', threatRating: 0.3, range: 35 }
        ],
        offensiveStrengths: [
            'Flexible close-range firepower',
            'Can seize and hold terrain',
            'Effective in restricted terrain',
            'Can clear buildings room by room',
            'Maneuver through terrain impassable to vehicles'
        ],
        defensiveStrengths: [
            'Can occupy and fortify positions',
            'Excellent use of cover and concealment',
            'Interlocking fields of fire',
            'Obstacle integration',
            'Reverse slope defense'
        ],
        weaknesses: [
            'Vulnerable in open terrain without cover',
            'Limited mobility compared to mounted forces',
            'Susceptible to indirect fire',
            'Limited organic anti-armor capability at range',
            'Fatigue degrades effectiveness over time'
        ],
        counterTactics: [
            'Engage at standoff range beyond small arms',
            'Use indirect fire to suppress fixed positions',
            'Employ armor to exploit open terrain gaps',
            'Isolate with obstacles and deny resupply',
            'Use smoke to degrade their observation',
            'Flank to avoid interlocking fires'
        ],
        detectionSignatures: ['person'],
        terrainModifiers: {
            urban: { effectiveness: 0.9, description: 'Excels in close quarters and building-to-building' },
            open: { effectiveness: 0.5, description: 'Vulnerable without cover, suppressed by direct fire' },
            wooded: { effectiveness: 0.8, description: 'Good concealment, effective ambush terrain' },
            mountain: { effectiveness: 0.7, description: 'Capable but limited mobility and resupply' }
        }
    },

    ARMOR: {
        name: 'Armor',
        category: BranchCategory.COMBAT_ARMS,
        capabilities: [
            'Mounted offensive operations',
            'Breakthrough attacks',
            'Exploitation and pursuit',
            'Mobile defense',
            'Overwatch by fire',
            'Combined arms maneuver',
            'Counter-attack force',
            'Armored reconnaissance'
        ],
        equipment: [
            { name: 'M1A2 Abrams', type: 'mbt', threatRating: 1.0, range: 4000 },
            { name: 'M2A3 Bradley', type: 'ifv', threatRating: 0.8, range: 3000 },
            { name: 'M3A3 Bradley CFV', type: 'cfv', threatRating: 0.8, range: 3000 },
            { name: 'M240C Coaxial MG', type: 'mmg', threatRating: 0.5, range: 900 },
            { name: 'M2 .50 Cal HMG', type: 'hmg', threatRating: 0.6, range: 1800 },
            { name: 'TOW Missile', type: 'anti_armor', threatRating: 0.9, range: 3750 },
            { name: '25mm M242 Bushmaster', type: 'autocannon', threatRating: 0.7, range: 2500 },
            { name: '120mm Smoothbore', type: 'tank_gun', threatRating: 1.0, range: 4000 }
        ],
        offensiveStrengths: [
            'Devastating direct fire at range',
            'Shock effect on enemy morale',
            'Rapid exploitation of breakthroughs',
            'Can breach obstacles with engineer support',
            'Survivable against most threats'
        ],
        defensiveStrengths: [
            'Long-range overwatch from hull-down positions',
            'Rapid counter-attack capability',
            'Can create engagement areas with kill zones',
            'Thermal/night vision superiority',
            'Mobile reserve force'
        ],
        weaknesses: [
            'Restricted in urban and dense terrain',
            'High logistical burden (fuel, ammo, maintenance)',
            'Vulnerable to top-attack munitions',
            'Noise and dust signature aids detection',
            'Vulnerable to anti-armor teams in close terrain',
            'Cannot hold terrain without infantry support'
        ],
        counterTactics: [
            'Engage flanks and rear with anti-armor weapons',
            'Canalize into kill zones with obstacles',
            'Use terrain to deny long-range fields of fire',
            'Employ top-attack munitions (Javelin, drone strike)',
            'Attack logistics to immobilize through fuel/ammo denial',
            'IED/mine emplacement on likely avenues'
        ],
        detectionSignatures: ['car', 'truck', 'bus'],
        terrainModifiers: {
            urban: { effectiveness: 0.4, description: 'Restricted maneuver, vulnerable to close attack' },
            open: { effectiveness: 1.0, description: 'Dominant - maximum fields of fire and maneuver' },
            wooded: { effectiveness: 0.5, description: 'Canalized, limited observation, ambush risk' },
            mountain: { effectiveness: 0.3, description: 'Severely restricted by slope and narrow roads' }
        }
    },

    FIELD_ARTILLERY: {
        name: 'Field Artillery',
        category: BranchCategory.COMBAT_ARMS,
        capabilities: [
            'Indirect fire support',
            'Counter-battery fire',
            'Suppression of enemy air defense (SEAD)',
            'Smoke and illumination',
            'Precision strike (Excalibur, GMLRS)',
            'Area suppression',
            'Fire support coordination',
            'Deep fires'
        ],
        equipment: [
            { name: 'M109A7 Paladin', type: 'sp_howitzer', threatRating: 0.9, range: 30000 },
            { name: 'M777A2 Howitzer', type: 'towed_howitzer', threatRating: 0.8, range: 24000 },
            { name: 'M270A1 MLRS', type: 'rocket_launcher', threatRating: 0.95, range: 70000 },
            { name: 'M142 HIMARS', type: 'rocket_launcher', threatRating: 0.95, range: 70000 },
            { name: 'M1156 PGK', type: 'precision_fuse', threatRating: 0.85, range: 30000 },
            { name: 'M982 Excalibur', type: 'precision_munition', threatRating: 0.9, range: 40000 },
            { name: 'AN/TPQ-53 Radar', type: 'counter_battery_radar', threatRating: 0.0, range: 60000 }
        ],
        offensiveStrengths: [
            'Devastating area and precision fires',
            'Engages targets beyond line of sight',
            'Rapid response to calls for fire',
            'Can shape the battlefield before maneuver',
            'Counter-battery capability neutralizes enemy fires'
        ],
        defensiveStrengths: [
            'Final protective fires break enemy assaults',
            'Smoke screens friendly movement',
            'Illumination enables night observation',
            'Can slow enemy advance through suppression',
            'Priority targets pre-registered for rapid engagement'
        ],
        weaknesses: [
            'Requires forward observers for accuracy',
            'Vulnerable during displacement',
            'Counter-battery threat if position compromised',
            'Ammunition resupply intensive',
            'Minimum engagement range creates dead space',
            'Collateral damage risk in populated areas'
        ],
        counterTactics: [
            'Locate and destroy with counter-battery fire',
            'Attack during displacement when most vulnerable',
            'Close distance rapidly to get inside minimum range',
            'Destroy forward observers to blind fires',
            'EW jamming of fire control communications',
            'Air attack on firing positions'
        ],
        detectionSignatures: ['truck'],
        terrainModifiers: {
            urban: { effectiveness: 0.4, description: 'Collateral damage limits employment, masking by structures' },
            open: { effectiveness: 1.0, description: 'Maximum effectiveness with clear observation' },
            wooded: { effectiveness: 0.7, description: 'Canopy reduces effect, observation limited' },
            mountain: { effectiveness: 0.6, description: 'Dead space in valleys, limited positions' }
        }
    },

    AIR_DEFENSE_ARTILLERY: {
        name: 'Air Defense Artillery',
        category: BranchCategory.COMBAT_ARMS,
        capabilities: [
            'Short-range air defense (SHORAD)',
            'Counter-UAS operations',
            'Theater missile defense',
            'Integrated air and missile defense',
            'Early warning',
            'Airspace management',
            'Point and area defense'
        ],
        equipment: [
            { name: 'FIM-92 Stinger', type: 'manpad', threatRating: 0.7, range: 4800 },
            { name: 'M-SHORAD (Stryker)', type: 'mobile_ad', threatRating: 0.8, range: 8000 },
            { name: 'AN/TWQ-1 Avenger', type: 'mobile_ad', threatRating: 0.7, range: 5500 },
            { name: 'MIM-104 Patriot', type: 'sam', threatRating: 0.95, range: 160000 },
            { name: 'THAAD', type: 'sam', threatRating: 0.95, range: 200000 },
            { name: 'Counter-UAS EW System', type: 'ew', threatRating: 0.3, range: 3000 },
            { name: 'Directed Energy C-UAS', type: 'laser', threatRating: 0.5, range: 2000 }
        ],
        offensiveStrengths: [
            'Denies enemy air superiority',
            'Counter-UAS capability protects ground forces',
            'Engages aerial threats at standoff distances',
            'Integrated sensor network provides early warning'
        ],
        defensiveStrengths: [
            'Creates air defense umbrella over friendly forces',
            'Forces enemy aircraft to fly low or avoid area',
            'Passive detection reduces own vulnerability',
            'Layered defense with overlapping coverage'
        ],
        weaknesses: [
            'Limited ground self-defense capability',
            'Dependent on radar which can be jammed or targeted',
            'Requires clear skyline for engagement',
            'Ammunition expensive and limited',
            'Fratricide risk requires strict airspace control'
        ],
        counterTactics: [
            'SEAD missions to destroy radar and launchers',
            'Electronic warfare to jam acquisition radars',
            'Saturate with multiple simultaneous threats',
            'Low-altitude terrain masking approach',
            'Decoys to deplete missile stocks',
            'Ground attack on AD positions'
        ],
        detectionSignatures: ['truck'],
        terrainModifiers: {
            urban: { effectiveness: 0.5, description: 'Reduced radar coverage, limited fields of fire' },
            open: { effectiveness: 1.0, description: 'Maximum radar coverage and engagement envelope' },
            wooded: { effectiveness: 0.6, description: 'Canopy masks low-altitude threats' },
            mountain: { effectiveness: 0.7, description: 'Terrain masking creates gaps but hilltops ideal' }
        }
    },

    AVIATION: {
        name: 'Aviation',
        category: BranchCategory.COMBAT_ARMS,
        capabilities: [
            'Attack helicopter operations',
            'Air assault insertion',
            'Aerial reconnaissance',
            'Medical evacuation (MEDEVAC)',
            'Air movement of troops and supplies',
            'Command and control platform',
            'Deep strike',
            'Security and screening operations'
        ],
        equipment: [
            { name: 'AH-64E Apache', type: 'attack_helo', threatRating: 0.95, range: 8000 },
            { name: 'UH-60M Black Hawk', type: 'utility_helo', threatRating: 0.3, range: 600 },
            { name: 'CH-47F Chinook', type: 'cargo_helo', threatRating: 0.2, range: 500 },
            { name: 'AGM-114 Hellfire', type: 'atgm', threatRating: 0.95, range: 8000 },
            { name: '30mm M230 Chain Gun', type: 'autocannon', threatRating: 0.7, range: 1500 },
            { name: 'Hydra 70 Rocket', type: 'rocket', threatRating: 0.6, range: 4000 },
            { name: 'RQ-7 Shadow UAS', type: 'uas', threatRating: 0.0, range: 125000 },
            { name: 'MQ-1C Gray Eagle', type: 'uas', threatRating: 0.7, range: 250000 }
        ],
        offensiveStrengths: [
            'Rapid concentration of firepower',
            'Standoff anti-armor capability',
            'Vertical envelopment of enemy positions',
            'Deep strike behind enemy lines',
            'Air assault seizes key terrain rapidly'
        ],
        defensiveStrengths: [
            'Rapid reaction force for counter-attack',
            'Aerial observation extends battlefield awareness',
            'MEDEVAC preserves combat power',
            'Can reposition forces rapidly',
            'Screen large frontages'
        ],
        weaknesses: [
            'Weather dependent operations',
            'Vulnerable to air defense systems',
            'High maintenance and fuel requirements',
            'Limited loiter time',
            'Requires secure FARP (forward arming and refueling point)',
            'Acoustic and visual signature detectable'
        ],
        counterTactics: [
            'Employ SHORAD and MANPADS aggressively',
            'Use terrain masking to limit approach corridors',
            'Target FARPs to deny refuel/rearm',
            'EW to degrade targeting systems',
            'Disperse forces to reduce helicopter effectiveness',
            'Night operations to reduce visual acquisition'
        ],
        detectionSignatures: ['airplane'],
        terrainModifiers: {
            urban: { effectiveness: 0.6, description: 'Wires and structures limit low-level flight' },
            open: { effectiveness: 0.9, description: 'Excellent fields of fire but exposure to AD' },
            wooded: { effectiveness: 0.7, description: 'Canopy limits observation, masking available' },
            mountain: { effectiveness: 0.6, description: 'Altitude limits performance, turbulence risk' }
        }
    },

    ENGINEERS: {
        name: 'Engineers',
        category: BranchCategory.COMBAT_ARMS,
        capabilities: [
            'Mobility operations (breaching, route clearance)',
            'Counter-mobility (obstacle emplacement)',
            'Survivability (fortification construction)',
            'General engineering (construction)',
            'Route clearance and IED defeat',
            'Bridge construction',
            'Demolition operations',
            'Terrain analysis'
        ],
        equipment: [
            { name: 'M9 ACE', type: 'combat_earthmover', threatRating: 0.1, range: 0 },
            { name: 'AVLB (Bridge Layer)', type: 'bridge', threatRating: 0.0, range: 0 },
            { name: 'M58 MICLIC', type: 'mine_clearing', threatRating: 0.6, range: 100 },
            { name: 'ABV (Assault Breacher)', type: 'breacher', threatRating: 0.5, range: 100 },
            { name: 'M2 .50 Cal HMG', type: 'hmg', threatRating: 0.6, range: 1800 },
            { name: 'C4/TNT Demolitions', type: 'demolition', threatRating: 0.7, range: 0 },
            { name: 'Husky VMMD', type: 'mine_detector', threatRating: 0.0, range: 0 }
        ],
        offensiveStrengths: [
            'Breach complex obstacle systems',
            'Create assault lanes through minefields',
            'Demolish enemy fortifications',
            'Reduce wire and barrier obstacles',
            'Enable maneuver force mobility'
        ],
        defensiveStrengths: [
            'Construct fighting positions and bunkers',
            'Emplace wire, mines, and barriers',
            'Create complex obstacle systems',
            'Route denial through demolition',
            'Survivability positions reduce casualties'
        ],
        weaknesses: [
            'Vulnerable during breaching operations',
            'Equipment is large and slow',
            'Operations are time-intensive',
            'Limited direct combat capability',
            'Requires security during construction'
        ],
        counterTactics: [
            'Engage during breaching when forces are concentrated',
            'Target bridge-laying and breaching assets first',
            'Use direct fire to cover obstacles',
            'Counter-mine faster than they can clear',
            'Destroy engineering equipment to deny capability'
        ],
        detectionSignatures: ['truck', 'car'],
        terrainModifiers: {
            urban: { effectiveness: 0.8, description: 'Urban breaching and fortification expertise' },
            open: { effectiveness: 0.9, description: 'Rapid obstacle emplacement on approaches' },
            wooded: { effectiveness: 0.7, description: 'Abatis and log obstacles effective' },
            mountain: { effectiveness: 0.6, description: 'Limited equipment mobility, hand-emplaced obstacles' }
        }
    },

    SPECIAL_FORCES: {
        name: 'Special Forces',
        category: BranchCategory.COMBAT_ARMS,
        capabilities: [
            'Unconventional warfare',
            'Foreign internal defense',
            'Special reconnaissance',
            'Direct action',
            'Counter-terrorism',
            'Counter-proliferation of WMD',
            'Information operations',
            'Civil-military operations'
        ],
        equipment: [
            { name: 'HK416', type: 'rifle', threatRating: 0.4, range: 400 },
            { name: 'Mk 17 SCAR-H', type: 'rifle', threatRating: 0.5, range: 600 },
            { name: 'M110 SASS', type: 'sniper', threatRating: 0.7, range: 800 },
            { name: 'Mk 48 LMG', type: 'lmg', threatRating: 0.5, range: 800 },
            { name: 'M3 MAAWS', type: 'recoilless', threatRating: 0.7, range: 500 },
            { name: 'AN/PEQ-15 ATPIAL', type: 'laser', threatRating: 0.0, range: 2000 },
            { name: 'SATCOM Terminal', type: 'comms', threatRating: 0.0, range: 0 }
        ],
        offensiveStrengths: [
            'Precision raids on high-value targets',
            'Operate behind enemy lines for extended periods',
            'Train and lead indigenous forces',
            'Exceptional marksmanship and CQB',
            'Integrated joint fires coordination'
        ],
        defensiveStrengths: [
            'Superior fieldcraft and concealment',
            'Early warning through deep reconnaissance',
            'Can establish stay-behind networks',
            'Resilient small-unit operations',
            'Self-sufficient for extended operations'
        ],
        weaknesses: [
            'Small unit size limits sustained combat',
            'Dependent on external fire support for large engagements',
            'Requires extensive planning and rehearsal',
            'Limited anti-armor capability',
            'Compromise can be catastrophic'
        ],
        counterTactics: [
            'Dense pattern-of-life monitoring',
            'Counter-intelligence screening',
            'Area saturation to overwhelm small teams',
            'Deny communication links',
            'Rapid QRF response to contact',
            'Thermal/NVG surveillance of likely approaches'
        ],
        detectionSignatures: ['person'],
        terrainModifiers: {
            urban: { effectiveness: 0.9, description: 'CQB expertise, surgical operations' },
            open: { effectiveness: 0.6, description: 'Limited concealment, small teams exposed' },
            wooded: { effectiveness: 0.95, description: 'Optimal concealment and ambush terrain' },
            mountain: { effectiveness: 0.85, description: 'Mountain warfare training, altitude acclimatized' }
        }
    },

    // =========================================================================
    // COMBAT SUPPORT
    // =========================================================================

    MILITARY_INTELLIGENCE: {
        name: 'Military Intelligence',
        category: BranchCategory.COMBAT_SUPPORT,
        capabilities: [
            'SIGINT collection and analysis',
            'HUMINT operations',
            'GEOINT/IMINT analysis',
            'All-source intelligence fusion',
            'Counter-intelligence',
            'Interrogation and debriefing',
            'Threat assessment production',
            'Intelligence preparation of the battlefield (IPB)'
        ],
        equipment: [
            { name: 'Prophet SIGINT System', type: 'sigint', threatRating: 0.0, range: 40000 },
            { name: 'AN/TLQ-17A Counter-IED', type: 'ew', threatRating: 0.0, range: 100 },
            { name: 'DCGS-A Workstation', type: 'analysis', threatRating: 0.0, range: 0 },
            { name: 'RQ-7 Shadow', type: 'uas', threatRating: 0.0, range: 125000 },
            { name: 'LLVI (Low Level Voice Intercept)', type: 'sigint', threatRating: 0.0, range: 5000 },
            { name: 'M4A1', type: 'rifle', threatRating: 0.3, range: 300 }
        ],
        offensiveStrengths: [
            'Enables precision targeting through intelligence',
            'Identifies enemy command and control nodes',
            'Predicts enemy courses of action',
            'Finds and fixes high-value targets'
        ],
        defensiveStrengths: [
            'Early warning of enemy attack',
            'Identifies enemy reconnaissance efforts',
            'Counter-intelligence protects friendly plans',
            'Continuous threat assessment updating'
        ],
        weaknesses: [
            'Minimal self-defense capability',
            'Intelligence can be wrong or stale',
            'Collection assets vulnerable to EW',
            'Processing time can delay decisions',
            'Requires security element for protection'
        ],
        counterTactics: [
            'Communications security (minimize emissions)',
            'Deception operations to provide false indicators',
            'Destroy collection platforms (UAS, SIGINT vehicles)',
            'Camouflage and concealment discipline',
            'Vary patterns to defeat analysis'
        ],
        detectionSignatures: ['truck', 'person'],
        terrainModifiers: {
            urban: { effectiveness: 0.8, description: 'Dense signal environment, good HUMINT' },
            open: { effectiveness: 0.9, description: 'Clear SIGINT/IMINT collection' },
            wooded: { effectiveness: 0.6, description: 'Canopy limits aerial collection' },
            mountain: { effectiveness: 0.7, description: 'Elevation aids SIGINT, limits HUMINT access' }
        }
    },

    SIGNAL_CORPS: {
        name: 'Signal Corps',
        category: BranchCategory.COMBAT_SUPPORT,
        capabilities: [
            'Tactical communications network',
            'Satellite communications',
            'Network operations and defense',
            'Radio retransmission',
            'Command post node operations',
            'Information systems management',
            'Spectrum management',
            'Cyber defense support'
        ],
        equipment: [
            { name: 'AN/TRC-170 Troposcatter', type: 'comms', threatRating: 0.0, range: 200000 },
            { name: 'JNN (Joint Network Node)', type: 'network', threatRating: 0.0, range: 0 },
            { name: 'Harris AN/PRC-163', type: 'radio', threatRating: 0.0, range: 30000 },
            { name: 'SATCOM Terminal', type: 'comms', threatRating: 0.0, range: 0 },
            { name: 'STT (Satellite Transportable Terminal)', type: 'comms', threatRating: 0.0, range: 0 },
            { name: 'M4A1', type: 'rifle', threatRating: 0.3, range: 300 }
        ],
        offensiveStrengths: [
            'Enables command and control for offensive operations',
            'Provides beyond-line-of-sight communications',
            'Network superiority enables faster decision cycles'
        ],
        defensiveStrengths: [
            'Redundant communications ensure continuity',
            'Encrypted networks protect information',
            'Can extend communications to isolated positions',
            'Early warning dissemination across network'
        ],
        weaknesses: [
            'Communication nodes are high-value targets',
            'Electromagnetic emissions enable direction finding',
            'Equipment is sensitive and bulky',
            'Dependent on power generation',
            'Vulnerable to EW and cyber attack'
        ],
        counterTactics: [
            'Electronic warfare to jam communications',
            'Direction finding to locate nodes',
            'Physical attack on antenna farms and relay sites',
            'Cyber attack on network infrastructure',
            'Destroy power generation'
        ],
        detectionSignatures: ['truck'],
        terrainModifiers: {
            urban: { effectiveness: 0.7, description: 'Multipath interference, but infrastructure available' },
            open: { effectiveness: 0.9, description: 'Clear line-of-sight for radio relay' },
            wooded: { effectiveness: 0.6, description: 'Canopy attenuates signals' },
            mountain: { effectiveness: 0.8, description: 'Hilltop relay sites excellent, valleys shadowed' }
        }
    },

    CHEMICAL_CORPS: {
        name: 'Chemical Corps',
        category: BranchCategory.COMBAT_SUPPORT,
        capabilities: [
            'CBRN reconnaissance and detection',
            'Decontamination operations',
            'Smoke operations',
            'Flame operations',
            'WMD threat assessment',
            'Hazard prediction and modeling',
            'CBRN defense planning',
            'Technical escort of CBRN materials'
        ],
        equipment: [
            { name: 'M93A1 Fox NBCRV', type: 'recon_vehicle', threatRating: 0.2, range: 0 },
            { name: 'M26 JDCC (Decon)', type: 'decon', threatRating: 0.0, range: 0 },
            { name: 'M56 Smoke Generator', type: 'smoke', threatRating: 0.0, range: 0 },
            { name: 'M4 JCAD (Detector)', type: 'detector', threatRating: 0.0, range: 0 },
            { name: 'AN/VDR-2 Radiac', type: 'detector', threatRating: 0.0, range: 0 },
            { name: 'M4A1', type: 'rifle', threatRating: 0.3, range: 300 }
        ],
        offensiveStrengths: [
            'Smoke screens enable maneuver',
            'CBRN reconnaissance enables safe advance',
            'Can mark contaminated areas for bypass'
        ],
        defensiveStrengths: [
            'Large area smoke screen concealment',
            'Decontamination restores combat power',
            'Early warning of CBRN attack',
            'Hazard prediction enables force protection'
        ],
        weaknesses: [
            'Smoke is weather dependent',
            'Decontamination is time-consuming',
            'Limited direct combat capability',
            'Specialized equipment requires maintenance',
            'Vulnerable during decon operations'
        ],
        counterTactics: [
            'Use wind to dissipate smoke screens',
            'Attack during decontamination operations',
            'Target specialized CBRN vehicles',
            'Overwhelm detection capability with false alarms'
        ],
        detectionSignatures: ['truck'],
        terrainModifiers: {
            urban: { effectiveness: 0.7, description: 'Smoke effective in canalized streets' },
            open: { effectiveness: 0.8, description: 'Smoke screens require more generators' },
            wooded: { effectiveness: 0.6, description: 'Smoke trapped by canopy, limited dispersion' },
            mountain: { effectiveness: 0.5, description: 'Wind unpredictable, smoke dissipates rapidly' }
        }
    },

    MILITARY_POLICE: {
        name: 'Military Police',
        category: BranchCategory.COMBAT_SUPPORT,
        capabilities: [
            'Area security operations',
            'Maneuver and mobility support (route security)',
            'Law enforcement',
            'Internment and resettlement operations',
            'Police intelligence operations',
            'Convoy security',
            'Traffic control',
            'Detainee operations'
        ],
        equipment: [
            { name: 'M4A1', type: 'rifle', threatRating: 0.3, range: 300 },
            { name: 'M9 Pistol', type: 'pistol', threatRating: 0.2, range: 50 },
            { name: 'M240B', type: 'mmg', threatRating: 0.6, range: 1100 },
            { name: 'M1151 HMMWV (Armored)', type: 'utility_vehicle', threatRating: 0.4, range: 0 },
            { name: 'MWD (Military Working Dog)', type: 'detection', threatRating: 0.1, range: 0 },
            { name: 'Non-Lethal Weapons Kit', type: 'non_lethal', threatRating: 0.1, range: 30 }
        ],
        offensiveStrengths: [
            'Rapid response security patrols',
            'Route clearance and reconnaissance',
            'Cordon and search operations',
            'Checkpoint and access control'
        ],
        defensiveStrengths: [
            'Area security and response force',
            'Traffic control enables rapid movement',
            'Presence deters criminal/enemy activity',
            'Rear area security frees combat forces'
        ],
        weaknesses: [
            'Lightly armed compared to infantry',
            'Small unit operations limit combat power',
            'Dual law enforcement/combat role creates tension',
            'Spread thin across large areas'
        ],
        counterTactics: [
            'Overwhelm with superior numbers',
            'Avoid checkpoints through alternate routes',
            'IED on patrol routes',
            'Target isolated patrols',
            'Use civilian cover to bypass'
        ],
        detectionSignatures: ['person', 'car'],
        terrainModifiers: {
            urban: { effectiveness: 0.9, description: 'Primary operating environment for law enforcement' },
            open: { effectiveness: 0.6, description: 'Route security on MSRs' },
            wooded: { effectiveness: 0.5, description: 'Limited observation for security ops' },
            mountain: { effectiveness: 0.4, description: 'Restricted mobility and coverage' }
        }
    },

    PSYOP: {
        name: 'Psychological Operations',
        category: BranchCategory.COMBAT_SUPPORT,
        capabilities: [
            'Military information support operations (MISO)',
            'Tactical loudspeaker operations',
            'Leaflet production and dissemination',
            'Social media operations',
            'Target audience analysis',
            'Propaganda counter-measures',
            'Civil-military messaging',
            'Surrender appeal operations'
        ],
        equipment: [
            { name: 'TPMS (Tactical PSYOP Media System)', type: 'broadcast', threatRating: 0.0, range: 0 },
            { name: 'LRAD (Long Range Acoustic Device)', type: 'loudspeaker', threatRating: 0.0, range: 300 },
            { name: 'Leaflet Dissemination System', type: 'dissemination', threatRating: 0.0, range: 0 },
            { name: 'M4A1', type: 'rifle', threatRating: 0.3, range: 300 },
            { name: 'M1151 HMMWV', type: 'utility_vehicle', threatRating: 0.3, range: 0 }
        ],
        offensiveStrengths: [
            'Degrades enemy morale and will to fight',
            'Encourages surrender and defection',
            'Shapes population support for friendly forces',
            'Non-kinetic effects minimize casualties'
        ],
        defensiveStrengths: [
            'Counter-propaganda protects friendly narrative',
            'Crowd control through messaging',
            'Can de-escalate situations before combat',
            'Builds population resistance to enemy influence'
        ],
        weaknesses: [
            'Effects are difficult to measure',
            'Requires deep cultural knowledge',
            'Minimal self-defense capability',
            'Equipment requires security',
            'Messaging can backfire if poorly executed'
        ],
        counterTactics: [
            'Counter-messaging to neutralize PSYOP themes',
            'Jam broadcast frequencies',
            'Physical attack on loudspeaker teams',
            'Information control to limit access',
            'Intimidation of local population'
        ],
        detectionSignatures: ['person', 'truck'],
        terrainModifiers: {
            urban: { effectiveness: 1.0, description: 'Maximum population density and reach' },
            open: { effectiveness: 0.4, description: 'Few targets for influence operations' },
            wooded: { effectiveness: 0.3, description: 'Limited access and population' },
            mountain: { effectiveness: 0.4, description: 'Isolated populations, limited reach' }
        }
    },

    CIVIL_AFFAIRS: {
        name: 'Civil Affairs',
        category: BranchCategory.COMBAT_SUPPORT,
        capabilities: [
            'Civil-military cooperation',
            'Civil reconnaissance',
            'Populace and resources control',
            'Foreign humanitarian assistance',
            'Nation assistance',
            'Civil information management',
            'Infrastructure assessment',
            'Key leader engagement'
        ],
        equipment: [
            { name: 'M4A1', type: 'rifle', threatRating: 0.3, range: 300 },
            { name: 'M1151 HMMWV', type: 'utility_vehicle', threatRating: 0.3, range: 0 },
            { name: 'Civil Assessment Tools', type: 'assessment', threatRating: 0.0, range: 0 },
            { name: 'Humanitarian Supplies', type: 'supply', threatRating: 0.0, range: 0 }
        ],
        offensiveStrengths: [
            'Civil reconnaissance provides population intelligence',
            'Key leader engagement can turn populations',
            'Infrastructure knowledge enables targeting decisions'
        ],
        defensiveStrengths: [
            'Population support denies enemy safe haven',
            'Civil infrastructure management supports operations',
            'Humanitarian assistance builds legitimacy',
            'Reduces civilian interference with operations'
        ],
        weaknesses: [
            'Very limited combat capability',
            'Effectiveness depends on population cooperation',
            'Requires extensive area knowledge',
            'Small teams are vulnerable'
        ],
        counterTactics: [
            'Intimidate local population against cooperation',
            'Attack civil affairs teams during engagements',
            'Counter-narrative undermining humanitarian efforts',
            'Target infrastructure projects'
        ],
        detectionSignatures: ['person', 'car'],
        terrainModifiers: {
            urban: { effectiveness: 1.0, description: 'Maximum population interaction' },
            open: { effectiveness: 0.4, description: 'Rural agricultural communities' },
            wooded: { effectiveness: 0.3, description: 'Limited population presence' },
            mountain: { effectiveness: 0.5, description: 'Isolated mountain communities' }
        }
    },

    // =========================================================================
    // COMBAT SERVICE SUPPORT (CSS)
    // =========================================================================

    TRANSPORTATION: {
        name: 'Transportation',
        category: BranchCategory.CSS,
        capabilities: [
            'Motor transport operations',
            'Terminal operations (ports/airfields)',
            'Movement control',
            'Convoy operations',
            'Watercraft operations',
            'Aerial delivery support',
            'Container management',
            'Route planning and management'
        ],
        equipment: [
            { name: 'M915 Tractor', type: 'truck', threatRating: 0.1, range: 0 },
            { name: 'PLS (Palletized Load System)', type: 'truck', threatRating: 0.1, range: 0 },
            { name: 'HEMTT', type: 'truck', threatRating: 0.1, range: 0 },
            { name: 'M1075 PLS Trailer', type: 'trailer', threatRating: 0.0, range: 0 },
            { name: 'M2 .50 Cal (mounted)', type: 'hmg', threatRating: 0.5, range: 1800 },
            { name: 'M4A1', type: 'rifle', threatRating: 0.3, range: 300 }
        ],
        offensiveStrengths: [
            'Enables offensive operations through continuous supply',
            'Rapid repositioning of supplies and equipment',
            'Sustains tempo of offensive operations'
        ],
        defensiveStrengths: [
            'Maintains defensive supplies (ammo, barriers)',
            'Evacuation of casualties and equipment',
            'Alternate supply routes ensure resilience'
        ],
        weaknesses: [
            'Convoys are vulnerable to ambush and IED',
            'Limited combat capability',
            'Dependent on route availability',
            'Large signature on roads',
            'Fuel-intensive operations'
        ],
        counterTactics: [
            'Ambush convoys at choke points',
            'IED emplacement on supply routes',
            'Destroy bridges to cut supply lines',
            'Air attack on logistics convoys',
            'Target fuel and ammo vehicles first'
        ],
        detectionSignatures: ['truck', 'bus'],
        terrainModifiers: {
            urban: { effectiveness: 0.7, description: 'Congestion but road network available' },
            open: { effectiveness: 0.9, description: 'Good road movement, exposed to observation' },
            wooded: { effectiveness: 0.6, description: 'Limited routes, ambush risk' },
            mountain: { effectiveness: 0.4, description: 'Restricted roads, slow movement, vulnerability' }
        }
    },

    ORDNANCE: {
        name: 'Ordnance',
        category: BranchCategory.CSS,
        capabilities: [
            'Ammunition supply operations',
            'Weapons maintenance and repair',
            'Explosive ordnance disposal (EOD)',
            'Missile maintenance',
            'Small arms repair',
            'Vehicle maintenance support',
            'Ammunition surveillance',
            'Captured enemy ammunition handling'
        ],
        equipment: [
            { name: 'EOD Robot (PackBot)', type: 'robot', threatRating: 0.0, range: 0 },
            { name: 'EOD Bomb Suit', type: 'protection', threatRating: 0.0, range: 0 },
            { name: 'M12 Ammo Trailer', type: 'trailer', threatRating: 0.0, range: 0 },
            { name: 'Contact Maintenance Truck', type: 'maintenance', threatRating: 0.0, range: 0 },
            { name: 'M4A1', type: 'rifle', threatRating: 0.3, range: 300 }
        ],
        offensiveStrengths: [
            'Ammunition resupply sustains offensive fires',
            'Weapons repair restores combat power',
            'EOD clears routes of IED threats'
        ],
        defensiveStrengths: [
            'Maintains defensive ammunition stocks',
            'Equipment repair reduces combat losses',
            'EOD protects forces from explosive threats'
        ],
        weaknesses: [
            'Ammunition storage points are high-value targets',
            'Limited self-defense capability',
            'EOD operations are slow and dangerous',
            'Requires forward positioning to be effective'
        ],
        counterTactics: [
            'Target ammunition supply points',
            'IED to overwhelm EOD capability',
            'Attack maintenance sites to deny repair',
            'Interdict resupply routes'
        ],
        detectionSignatures: ['truck'],
        terrainModifiers: {
            urban: { effectiveness: 0.7, description: 'Facilities available but IED threat high' },
            open: { effectiveness: 0.8, description: 'Good dispersal for ammunition storage' },
            wooded: { effectiveness: 0.6, description: 'Concealment for supply points' },
            mountain: { effectiveness: 0.4, description: 'Difficult to position forward' }
        }
    },

    QUARTERMASTER: {
        name: 'Quartermaster',
        category: BranchCategory.CSS,
        capabilities: [
            'Supply operations (Class I, II, III, IV)',
            'Petroleum operations',
            'Water purification',
            'Field feeding operations',
            'Aerial delivery/airdrop',
            'Laundry and bath operations',
            'Mortuary affairs',
            'General supply management'
        ],
        equipment: [
            { name: 'TWPS (Tactical Water Purification)', type: 'water', threatRating: 0.0, range: 0 },
            { name: 'FSSP (Fuel System Supply Point)', type: 'fuel', threatRating: 0.0, range: 0 },
            { name: 'Container Kitchen', type: 'kitchen', threatRating: 0.0, range: 0 },
            { name: 'M969 Fuel Tanker', type: 'tanker', threatRating: 0.0, range: 0 },
            { name: 'M4A1', type: 'rifle', threatRating: 0.3, range: 300 }
        ],
        offensiveStrengths: [
            'Sustains forces through continuous supply',
            'Fuel distribution enables mobile operations',
            'Airdrop resupply bypasses ground threats'
        ],
        defensiveStrengths: [
            'Water and food supply maintains morale and strength',
            'Fuel reserves enable counterattack mobility',
            'Mortuary affairs preserves unit morale'
        ],
        weaknesses: [
            'Supply points are large and visible targets',
            'Fuel operations create fire hazards',
            'Dependent on transportation for distribution',
            'Stockpiles take time to establish'
        ],
        counterTactics: [
            'Target fuel and water supply points',
            'Interdict supply lines',
            'Contaminate water sources',
            'Air attack on logistics bases',
            'Deny territory for supply positioning'
        ],
        detectionSignatures: ['truck'],
        terrainModifiers: {
            urban: { effectiveness: 0.7, description: 'Infrastructure supports supply ops' },
            open: { effectiveness: 0.8, description: 'Easy to establish supply points' },
            wooded: { effectiveness: 0.5, description: 'Concealment but access limited' },
            mountain: { effectiveness: 0.3, description: 'Very difficult resupply, relies on air' }
        }
    },

    ADJUTANT_GENERAL: {
        name: 'Adjutant General',
        category: BranchCategory.CSS,
        capabilities: [
            'Personnel management and accountability',
            'Postal operations',
            'Casualty operations',
            'Morale welfare and recreation',
            'Band operations',
            'Administrative support',
            'Human resources support'
        ],
        equipment: [
            { name: 'DCIPS Workstation', type: 'computer', threatRating: 0.0, range: 0 },
            { name: 'M4A1', type: 'rifle', threatRating: 0.3, range: 300 }
        ],
        offensiveStrengths: [
            'Personnel replacement sustains combat strength',
            'Casualty tracking enables accurate status reporting'
        ],
        defensiveStrengths: [
            'Mail and MWR sustain morale during static defense',
            'Personnel accountability in mass casualty events'
        ],
        weaknesses: [
            'No combat capability',
            'Dependent on communications for operations',
            'Rear-area operations vulnerable to deep attacks'
        ],
        counterTactics: [
            'Target personnel centers to degrade accountability',
            'Attack rear area support facilities',
            'Disrupt postal/communication to reduce morale'
        ],
        detectionSignatures: ['person'],
        terrainModifiers: {
            urban: { effectiveness: 0.9, description: 'Best facilities in urban environment' },
            open: { effectiveness: 0.6, description: 'Requires setup of field facilities' },
            wooded: { effectiveness: 0.5, description: 'Limited space for operations' },
            mountain: { effectiveness: 0.4, description: 'Difficult to reach and establish' }
        }
    },

    FINANCE: {
        name: 'Finance',
        category: BranchCategory.CSS,
        capabilities: [
            'Financial management operations',
            'Disbursing operations',
            'Commercial vendor services',
            'Contract payment',
            'Currency exchange',
            'Resource management',
            'Travel and per diem processing'
        ],
        equipment: [
            { name: 'Finance Workstation', type: 'computer', threatRating: 0.0, range: 0 },
            { name: 'M4A1', type: 'rifle', threatRating: 0.3, range: 300 }
        ],
        offensiveStrengths: [
            'Funds local contracts to support operations',
            'Commander emergency response program (CERP) for quick projects'
        ],
        defensiveStrengths: [
            'Contract payments sustain local support',
            'Financial operations enable host nation assistance'
        ],
        weaknesses: [
            'No combat capability',
            'High-value target for theft',
            'Requires secure rear area'
        ],
        counterTactics: [
            'Target finance operations for funds capture',
            'Corruption and bribery to subvert programs',
            'Intimidate local vendors against cooperation'
        ],
        detectionSignatures: ['person'],
        terrainModifiers: {
            urban: { effectiveness: 0.9, description: 'Banking infrastructure available' },
            open: { effectiveness: 0.5, description: 'Field operations limited' },
            wooded: { effectiveness: 0.3, description: 'Not applicable' },
            mountain: { effectiveness: 0.3, description: 'Not applicable' }
        }
    },

    AMEDD: {
        name: 'Army Medical Department',
        category: BranchCategory.CSS,
        capabilities: [
            'Tactical combat casualty care (TCCC)',
            'Forward surgical capability',
            'Medical evacuation (ground and air)',
            'Hospitalization',
            'Preventive medicine',
            'Dental services',
            'Veterinary services',
            'Medical logistics'
        ],
        equipment: [
            { name: 'M997 Ambulance (HMMWV)', type: 'ambulance', threatRating: 0.0, range: 0 },
            { name: 'Forward Surgical Team Kit', type: 'medical', threatRating: 0.0, range: 0 },
            { name: 'MEDEVAC HH-60M', type: 'helicopter', threatRating: 0.0, range: 0 },
            { name: 'M4A1', type: 'rifle', threatRating: 0.3, range: 300 }
        ],
        offensiveStrengths: [
            'Medical support sustains offensive momentum',
            'Rapid CASEVAC preserves combat power',
            'Forward surgical capability saves lives'
        ],
        defensiveStrengths: [
            'Casualty collection and treatment under fire',
            'Mass casualty management',
            'Preventive medicine reduces non-battle injuries'
        ],
        weaknesses: [
            'Protected status requires clear marking (vulnerability)',
            'Medical facilities are fixed and visible',
            'Limited self-defense',
            'Resource-intensive operations'
        ],
        counterTactics: [
            'Note: Attacking medical facilities violates Law of Armed Conflict',
            'Target MEDEVAC helicopters (if armed/escorted)',
            'Overwhelm medical capacity through mass casualties',
            'Interdict evacuation routes'
        ],
        detectionSignatures: ['truck', 'car'],
        terrainModifiers: {
            urban: { effectiveness: 0.8, description: 'Hospital infrastructure available' },
            open: { effectiveness: 0.7, description: 'Good MEDEVAC access' },
            wooded: { effectiveness: 0.5, description: 'Limited vehicle access for evacuation' },
            mountain: { effectiveness: 0.4, description: 'Evacuation extremely difficult, air dependent' }
        }
    },

    JAG: {
        name: 'Judge Advocate General',
        category: BranchCategory.CSS,
        capabilities: [
            'Legal advice on rules of engagement',
            'Law of armed conflict compliance',
            'Military justice administration',
            'Contract and fiscal law',
            'Claims processing',
            'Legal assistance',
            'Operational law support',
            'Targeting review and advice'
        ],
        equipment: [
            { name: 'Legal Workstation', type: 'computer', threatRating: 0.0, range: 0 },
            { name: 'M4A1', type: 'rifle', threatRating: 0.3, range: 300 }
        ],
        offensiveStrengths: [
            'ROE advice enables timely engagement decisions',
            'Targeting legality review prevents war crimes',
            'Operational law supports complex operations'
        ],
        defensiveStrengths: [
            'Legal framework protects Soldiers and commanders',
            'Claims processing maintains population support',
            'LOAC compliance maintains legitimacy'
        ],
        weaknesses: [
            'No combat capability',
            'Legal processes can slow decision-making',
            'Requires communication to provide timely advice'
        ],
        counterTactics: [
            'Exploit ROE restrictions with human shields',
            'Create legal ambiguity through hybrid warfare',
            'Use lawfare to constrain operations'
        ],
        detectionSignatures: ['person'],
        terrainModifiers: {
            urban: { effectiveness: 0.9, description: 'Most complex legal environment' },
            open: { effectiveness: 0.7, description: 'Clearer legal situation in conventional combat' },
            wooded: { effectiveness: 0.7, description: 'Standard operational law applies' },
            mountain: { effectiveness: 0.7, description: 'Standard operational law applies' }
        }
    },

    CHAPLAIN: {
        name: 'Chaplain Corps',
        category: BranchCategory.CSS,
        capabilities: [
            'Religious support',
            'Counseling and morale support',
            'Ethical advisement to commanders',
            'Memorial ceremonies',
            'Humanitarian liaison',
            'Religious leader engagement',
            'Moral injury intervention',
            'Suicide prevention outreach'
        ],
        equipment: [
            { name: 'Chaplain Kit', type: 'religious', threatRating: 0.0, range: 0 }
        ],
        offensiveStrengths: [
            'Morale and spiritual resilience sustains will to fight',
            'Religious leader engagement builds population rapport'
        ],
        defensiveStrengths: [
            'Counseling mitigates combat stress casualties',
            'Moral guidance maintains unit cohesion',
            'Memorial services honor sacrifice and sustain morale'
        ],
        weaknesses: [
            'Non-combatant status (Geneva Conventions)',
            'Requires chaplain assistant for security',
            'Must be accessible to Soldiers under any conditions'
        ],
        counterTactics: [
            'Note: Targeting chaplains violates Geneva Conventions',
            'Propaganda to undermine morale',
            'Religious manipulation against foreign chaplains'
        ],
        detectionSignatures: ['person'],
        terrainModifiers: {
            urban: { effectiveness: 0.8, description: 'Access to religious sites and populations' },
            open: { effectiveness: 0.7, description: 'Field services at unit locations' },
            wooded: { effectiveness: 0.6, description: 'Limited access to dispersed units' },
            mountain: { effectiveness: 0.5, description: 'Difficult to reach remote positions' }
        }
    },

    // =========================================================================
    // SPECIAL / EMERGING BRANCHES
    // =========================================================================

    CYBER: {
        name: 'Cyber',
        category: BranchCategory.SPECIAL,
        capabilities: [
            'Offensive cyberspace operations (OCO)',
            'Defensive cyberspace operations (DCO)',
            'Network warfare',
            'Cyberspace intelligence collection',
            'Vulnerability assessment',
            'Incident response',
            'Electromagnetic spectrum operations',
            'Cyber-electromagnetic activities (CEMA)'
        ],
        equipment: [
            { name: 'Cyber Warfare Kit', type: 'cyber', threatRating: 0.0, range: 0 },
            { name: 'EW Jamming Suite', type: 'ew', threatRating: 0.0, range: 10000 },
            { name: 'Network Analysis Tools', type: 'analysis', threatRating: 0.0, range: 0 },
            { name: 'SIGINT Collection Platform', type: 'sigint', threatRating: 0.0, range: 50000 },
            { name: 'M4A1', type: 'rifle', threatRating: 0.3, range: 300 }
        ],
        offensiveStrengths: [
            'Disrupts enemy C2 networks before engagement',
            'Degrades enemy situational awareness',
            'Can disable enemy systems without kinetic effects',
            'EW jamming neutralizes communications'
        ],
        defensiveStrengths: [
            'Protects friendly networks from intrusion',
            'Detects enemy cyber reconnaissance',
            'Hardens communications against EW attack',
            'Counter-UAS electronic attack capability'
        ],
        weaknesses: [
            'Effects can be temporary if enemy restores systems',
            'Collateral damage to civilian infrastructure',
            'Requires detailed target development',
            'Attribution is difficult',
            'Limited physical defense capability'
        ],
        counterTactics: [
            'Air-gapped systems resist cyber attack',
            'Frequency hopping defeats simple jamming',
            'Redundant communications via multiple means',
            'Physical attack on cyber/EW positions',
            'Passive operations (no emissions to jam)'
        ],
        detectionSignatures: ['truck', 'person'],
        terrainModifiers: {
            urban: { effectiveness: 1.0, description: 'Dense network infrastructure to exploit' },
            open: { effectiveness: 0.7, description: 'Limited infrastructure but EW effective' },
            wooded: { effectiveness: 0.6, description: 'Limited infrastructure, EW range reduced' },
            mountain: { effectiveness: 0.6, description: 'Elevation aids EW, limited networks' }
        }
    },

    SPACE_OPS: {
        name: 'Space Operations',
        category: BranchCategory.SPECIAL,
        capabilities: [
            'Space situational awareness',
            'Satellite communications management',
            'GPS operations and protection',
            'Missile warning',
            'Space-based ISR integration',
            'Space control operations',
            'Position, navigation, and timing (PNT)',
            'Environmental monitoring from space'
        ],
        equipment: [
            { name: 'AEHF SATCOM Terminal', type: 'comms', threatRating: 0.0, range: 0 },
            { name: 'GPS Receiver (DAGR)', type: 'navigation', threatRating: 0.0, range: 0 },
            { name: 'Space Control Node', type: 'control', threatRating: 0.0, range: 0 },
            { name: 'Satellite Imagery Terminal', type: 'isr', threatRating: 0.0, range: 0 },
            { name: 'M4A1', type: 'rifle', threatRating: 0.3, range: 300 }
        ],
        offensiveStrengths: [
            'Precision PNT enables precision munitions',
            'Satellite imagery supports targeting',
            'Space-based early warning enables preemptive action',
            'SATCOM enables long-range C2'
        ],
        defensiveStrengths: [
            'Missile warning provides early detection',
            'GPS enables precise navigation in any terrain',
            'SATCOM provides assured communications',
            'Environmental monitoring supports planning'
        ],
        weaknesses: [
            'Space assets vulnerable to anti-satellite weapons',
            'GPS can be jammed or spoofed',
            'Satellite passes are predictable',
            'Space weather can degrade capabilities',
            'No direct combat capability'
        ],
        counterTactics: [
            'GPS jamming and spoofing',
            'Anti-satellite weapons (kinetic/directed energy)',
            'Operate during satellite gaps in coverage',
            'Cyber attack on ground control stations',
            'Dazzle/blind imaging satellites with lasers'
        ],
        detectionSignatures: [],
        terrainModifiers: {
            urban: { effectiveness: 0.7, description: 'Urban canyon limits GPS, SATCOM access' },
            open: { effectiveness: 1.0, description: 'Clear sky access for all space services' },
            wooded: { effectiveness: 0.7, description: 'Canopy limits GPS accuracy and SATCOM' },
            mountain: { effectiveness: 0.6, description: 'Terrain masking limits satellite visibility' }
        }
    },

    AI_ML: {
        name: 'Artificial Intelligence / Machine Learning',
        category: BranchCategory.SPECIAL,
        capabilities: [
            'Autonomous threat detection and classification',
            'Predictive intelligence analysis',
            'Automated sensor fusion',
            'Decision support systems',
            'Autonomous vehicle/drone operations',
            'Pattern-of-life analysis',
            'Natural language processing for HUMINT',
            'Computer vision for GEOINT'
        ],
        equipment: [
            { name: 'AI Processing Node', type: 'compute', threatRating: 0.0, range: 0 },
            { name: 'Edge AI Inference Engine', type: 'compute', threatRating: 0.0, range: 0 },
            { name: 'Autonomous Ground Vehicle', type: 'ugv', threatRating: 0.3, range: 0 },
            { name: 'Autonomous Drone Swarm Controller', type: 'control', threatRating: 0.0, range: 0 },
            { name: 'Sensor Fusion Platform', type: 'analysis', threatRating: 0.0, range: 0 }
        ],
        offensiveStrengths: [
            'Accelerates targeting cycle (sensor-to-shooter)',
            'Drone swarm coordination overwhelms defenses',
            'Predictive analysis anticipates enemy actions',
            'Automated battle damage assessment'
        ],
        defensiveStrengths: [
            'Automated threat detection reduces reaction time',
            'Pattern analysis identifies threats before attack',
            'Sensor fusion provides comprehensive picture',
            'Decision support enables faster OODA loop'
        ],
        weaknesses: [
            'Dependent on data quality and quantity',
            'Adversarial attacks can fool AI systems',
            'Requires computational infrastructure',
            'Ethics and oversight requirements limit autonomy',
            'System failures can cascade'
        ],
        counterTactics: [
            'Adversarial inputs to deceive AI classifiers',
            'Jamming of data links to autonomous systems',
            'Destroy computing infrastructure',
            'Unpredictable behavior to defeat pattern analysis',
            'EMP to disable electronic systems'
        ],
        detectionSignatures: [],
        terrainModifiers: {
            urban: { effectiveness: 0.9, description: 'Rich data environment, many sensors' },
            open: { effectiveness: 0.9, description: 'Clear sensor data, good drone operations' },
            wooded: { effectiveness: 0.6, description: 'Sensor degradation under canopy' },
            mountain: { effectiveness: 0.5, description: 'Communication gaps limit data flow' }
        }
    }
});

/**
 * Look up branches by detection signature (YOLO COCO class name).
 * Returns an array of branch keys that could match the given detection class.
 *
 * @param {string} cocoClass - YOLO COCO class name (e.g., 'person', 'truck')
 * @returns {string[]} Array of ARMY_BRANCHES keys
 */
export function getBranchesByDetection(cocoClass) {
    const matches = [];
    for (const [key, branch] of Object.entries(ARMY_BRANCHES)) {
        if (branch.detectionSignatures.includes(cocoClass)) {
            matches.push(key);
        }
    }
    return matches;
}

/**
 * Look up branches by category.
 *
 * @param {string} category - One of BranchCategory values
 * @returns {Object[]} Array of { key, branch } objects
 */
export function getBranchesByCategory(category) {
    const matches = [];
    for (const [key, branch] of Object.entries(ARMY_BRANCHES)) {
        if (branch.category === category) {
            matches.push({ key, branch });
        }
    }
    return matches;
}

/**
 * Get terrain-adjusted effectiveness for a branch.
 *
 * @param {string} branchKey - Key from ARMY_BRANCHES
 * @param {string} terrainType - 'urban', 'open', 'wooded', or 'mountain'
 * @returns {{ effectiveness: number, description: string } | null}
 */
export function getTerrainEffectiveness(branchKey, terrainType) {
    const branch = ARMY_BRANCHES[branchKey];
    if (!branch || !branch.terrainModifiers[terrainType]) {
        return null;
    }
    return branch.terrainModifiers[terrainType];
}

console.log(`[DOCTRINE] Army branch knowledge base loaded: ${Object.keys(ARMY_BRANCHES).length} branches`);
