// =============================================================================
// TALOS 2.0 - Maven Smart System (Simulated Intelligence Feed)
// Generates realistic mock intelligence data at operationally-paced intervals
// Scenario: Enemy mechanized element approaching from NE along primary avenue
// =============================================================================

let _nextId = 1;
function genId(prefix) {
    return `${prefix}-${String(_nextId++).padStart(4, '0')}`;
}

function randomInRange(min, max) {
    return Math.random() * (max - min) + min;
}

function randomInt(min, max) {
    return Math.floor(randomInRange(min, max + 1));
}

function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function generateGridCoord() {
    // MGRS-like grid: zone 38S, 100km square KU, easting/northing
    const easting = String(randomInt(10000, 99999)).padStart(5, '0');
    const northing = String(randomInt(10000, 99999)).padStart(5, '0');
    return `38SKU${easting}${northing}`;
}

function timestamp() {
    return new Date().toISOString();
}

// ---- Scenario Narrative State ----
// Enemy mechanized element approaching from NE along primary avenue (MSR TAMPA).
// Over time, SIGINT shows increasing radio chatter, GEOINT picks up vehicle staging,
// and HUMINT sources report enemy movement. Tempo escalates.

const SCENARIO = {
    enemyBearing: 45, // NE
    approachAxis: 'MSR TAMPA',
    enemyComposition: 'Mechanized Infantry Company (BTR-82A)',
    friendlyPosition: '38SKU4523067890',
    phaseIndex: 0, // increases over time: 0=initial, 1=buildup, 2=advance, 3=contact
    phaseLabels: ['INITIAL INDICATORS', 'BUILDUP', 'ENEMY ADVANCE', 'IMMINENT CONTACT'],
    distanceKm: 15, // enemy distance, decreases over time
    lastPhaseChange: Date.now()
};

/**
 * Simulated Maven Smart System.
 * Generates realistic mock intelligence data at operationally-paced intervals.
 *
 * Data types: SIGINT, GEOINT, HUMINT, threatAssessment, forceDisposition, environment
 */
export class MavenMock {
    constructor(config = {}) {
        /** @type {number} Base update interval in ms */
        this._baseInterval = config.interval || 10000;

        /** @type {boolean} Running state */
        this._running = false;

        /** @type {number|null} Main timer ID */
        this._timerId = null;

        /** @type {Object} Timer IDs for each data type */
        this._typeTimers = {};

        /** @type {Function[]} Update callbacks */
        this._callbacks = [];

        /** @type {Object} Latest data for each type */
        this._latest = {
            sigint: null,
            geoint: null,
            humint: null,
            threatAssessment: null,
            forceDisposition: null,
            environment: null
        };

        /** @type {Object[]} Full history of all intel */
        this._history = [];

        /** @type {number} Scenario start time */
        this._scenarioStart = Date.now();

        console.log('[MAVEN] Maven Smart System initialized (SIMULATED)');
    }

    /**
     * Start intelligence generation.
     * SIGINT: every 5-15s, GEOINT: every 20-40s, HUMINT: every 30-60s,
     * threatAssessment: every 15-25s, forceDisposition: every 20-30s,
     * environment: every 45-90s
     */
    start() {
        if (this._running) {
            console.warn('[MAVEN] Already running');
            return;
        }
        this._running = true;
        this._scenarioStart = Date.now();
        SCENARIO.phaseIndex = 0;
        SCENARIO.distanceKm = 15;
        SCENARIO.lastPhaseChange = Date.now();

        console.log('[MAVEN] Intelligence feed ACTIVE');
        console.log('[MAVEN] Scenario: Enemy mechanized element (BTR-82A company) approaching from NE along MSR TAMPA');

        // Generate initial data for all types
        this._generateSigint();
        this._generateGeoint();
        this._generateHumint();
        this._generateThreatAssessment();
        this._generateForceDisposition();
        this._generateEnvironment();

        // Schedule recurring generation at realistic operational tempo
        this._scheduleType('sigint', 5000, 15000, () => this._generateSigint());
        this._scheduleType('geoint', 20000, 40000, () => this._generateGeoint());
        this._scheduleType('humint', 30000, 60000, () => this._generateHumint());
        this._scheduleType('threatAssessment', 15000, 25000, () => this._generateThreatAssessment());
        this._scheduleType('forceDisposition', 20000, 30000, () => this._generateForceDisposition());
        this._scheduleType('environment', 45000, 90000, () => this._generateEnvironment());

        // Scenario progression timer
        this._timerId = setInterval(() => this._advanceScenario(), 5000);
    }

    /**
     * Stop intelligence generation and clear all timers.
     */
    stop() {
        this._running = false;
        if (this._timerId) {
            clearInterval(this._timerId);
            this._timerId = null;
        }
        for (const key of Object.keys(this._typeTimers)) {
            clearTimeout(this._typeTimers[key]);
            delete this._typeTimers[key];
        }
        console.log('[MAVEN] Intelligence feed STOPPED');
    }

    /**
     * Get the latest data for all or a specific type.
     *
     * @param {string} [type] - Optional: 'sigint', 'geoint', 'humint', 'threatAssessment', 'forceDisposition', 'environment'
     * @returns {Object} Latest intel data
     */
    getLatest(type) {
        if (type) {
            return this._latest[type] || null;
        }
        return { ...this._latest };
    }

    /**
     * Register a callback for intel updates.
     *
     * @param {Function} callback - Called with (type: string, data: Object)
     */
    onUpdate(callback) {
        if (typeof callback === 'function') {
            this._callbacks.push(callback);
        }
    }

    /**
     * Remove an update callback.
     *
     * @param {Function} callback
     */
    offUpdate(callback) {
        this._callbacks = this._callbacks.filter(cb => cb !== callback);
    }

    /**
     * Get intel history, optionally filtered by type.
     *
     * @param {string} [type]
     * @param {number} [limit=50]
     * @returns {Object[]}
     */
    getHistory(type, limit = 50) {
        let filtered = type
            ? this._history.filter(h => h.type === type)
            : this._history;
        return filtered.slice(-limit);
    }

    /**
     * Get current scenario phase info.
     *
     * @returns {{ phase: number, label: string, enemyDistance: number, elapsed: number }}
     */
    getScenarioStatus() {
        return {
            phase: SCENARIO.phaseIndex,
            label: SCENARIO.phaseLabels[SCENARIO.phaseIndex] || 'UNKNOWN',
            enemyDistance: SCENARIO.distanceKm,
            elapsed: Math.floor((Date.now() - this._scenarioStart) / 1000)
        };
    }

    // ---- Private Methods ----

    _scheduleType(typeName, minMs, maxMs, generator) {
        if (!this._running) return;
        const delay = randomInRange(minMs, maxMs);
        this._typeTimers[typeName] = setTimeout(() => {
            if (!this._running) return;
            generator();
            this._scheduleType(typeName, minMs, maxMs, generator);
        }, delay);
    }

    _emit(type, data) {
        this._latest[type] = data;
        this._history.push({ type, data, received: Date.now() });
        // Keep history bounded
        if (this._history.length > 500) {
            this._history = this._history.slice(-300);
        }
        for (const cb of this._callbacks) {
            try {
                cb(type, data);
            } catch (err) {
                console.error('[MAVEN] Callback error:', err);
            }
        }
    }

    _advanceScenario() {
        const elapsed = (Date.now() - this._scenarioStart) / 1000;

        // Decrease enemy distance over time (approach speed ~3-5 km per real-minute for simulation)
        SCENARIO.distanceKm = Math.max(0.5, 15 - (elapsed / 60) * randomInRange(3, 5));

        // Advance phases based on distance
        const prevPhase = SCENARIO.phaseIndex;
        if (SCENARIO.distanceKm < 2) {
            SCENARIO.phaseIndex = 3;
        } else if (SCENARIO.distanceKm < 6) {
            SCENARIO.phaseIndex = 2;
        } else if (SCENARIO.distanceKm < 10) {
            SCENARIO.phaseIndex = 1;
        } else {
            SCENARIO.phaseIndex = 0;
        }

        if (SCENARIO.phaseIndex !== prevPhase) {
            SCENARIO.lastPhaseChange = Date.now();
            console.log(`[MAVEN] Scenario phase: ${SCENARIO.phaseLabels[SCENARIO.phaseIndex]} (enemy at ${SCENARIO.distanceKm.toFixed(1)} km)`);
        }
    }

    _generateSigint() {
        const phase = SCENARIO.phaseIndex;
        const frequencies = [
            { freq: '148.500', type: 'VHF_FM', desc: 'Tactical net' },
            { freq: '225.000', type: 'UHF', desc: 'Command net' },
            { freq: '305.125', type: 'UHF', desc: 'Logistics net' },
            { freq: '462.750', type: 'UHF', desc: 'FRS channel activity' },
            { freq: '121.500', type: 'VHF_AM', desc: 'Guard frequency' },
            { freq: '38.200', type: 'HF', desc: 'HF tactical net' },
            { freq: '2.4GHz', type: 'WIFI', desc: 'Wireless data link' },
            { freq: '5.8GHz', type: 'DRONE_LINK', desc: 'UAS control link' }
        ];

        const phaseNarratives = [
            // Phase 0: Initial indicators
            [
                'Intermittent VHF transmissions detected, routine traffic pattern',
                'Brief HF check-in detected, standard communications check',
                'Low-power UHF burst detected, likely coordination message',
                'Encrypted data burst on tactical frequency, short duration'
            ],
            // Phase 1: Buildup
            [
                'Increased radio traffic volume on tactical net, multiple stations active',
                'Command net activation detected, authentication exchange observed',
                'Logistics coordination traffic detected, supply point references',
                'Multiple VHF stations conducting radio checks simultaneously',
                'UAS control link detected bearing NE, consistent with reconnaissance'
            ],
            // Phase 2: Enemy advance
            [
                'Heavy tactical radio traffic, movement coordination language detected',
                'Fire support coordination net activated, target reference points discussed',
                'Multiple UHF transmissions indicating unit movement orders',
                'Frequency changes detected - units shifting to alternate tactical nets',
                'Encrypted burst transmissions at 30-second intervals, movement updates'
            ],
            // Phase 3: Imminent contact
            [
                'FLASH traffic on command net - attack coordination orders detected',
                'Fire support net extremely active, fire mission coordination',
                'Short-range tactical communications indicate close proximity',
                'Radio discipline breaking down, plain-language transmissions intercepted',
                'Electronic attack preparations detected on friendly frequencies'
            ]
        ];

        const selectedFreq = pick(frequencies);
        const bearing = SCENARIO.enemyBearing + randomInRange(-15, 15);

        const data = {
            id: genId('SIG'),
            timestamp: timestamp(),
            frequency: selectedFreq.freq,
            type: selectedFreq.type,
            bearing: Math.round(bearing),
            contentSummary: pick(phaseNarratives[phase]),
            confidence: Math.min(0.5 + phase * 0.15 + randomInRange(-0.1, 0.1), 0.99),
            source: `SIGINT-${pick(['PROPHET', 'LLVI', 'COMINT', 'ELINT'])}`
        };

        this._emit('sigint', data);
    }

    _generateGeoint() {
        const phase = SCENARIO.phaseIndex;

        const terrainTypes = ['URBAN_EDGE', 'ROAD_INTERSECTION', 'TREE_LINE', 'OPEN_FIELD', 'HILLTOP', 'RIVER_CROSSING'];
        const structuresByPhase = [
            // Phase 0
            [
                { type: 'building_cluster', count: randomInt(3, 8), assessment: 'Civilian structures, no military activity' },
                { type: 'road_intersection', count: 1, assessment: 'Key road junction along MSR TAMPA' }
            ],
            // Phase 1
            [
                { type: 'vehicle_staging', count: randomInt(4, 10), assessment: 'Vehicle congregation NE of AO, possible staging area' },
                { type: 'fighting_position', count: randomInt(2, 4), assessment: 'Earthworks detected, possible hasty fighting positions' }
            ],
            // Phase 2
            [
                { type: 'vehicle_column', count: randomInt(8, 15), assessment: 'Mechanized column moving SW along MSR TAMPA' },
                { type: 'support_position', count: randomInt(2, 5), assessment: 'Support vehicles establishing logistics point' }
            ],
            // Phase 3
            [
                { type: 'attack_formation', count: randomInt(10, 20), assessment: 'Vehicles in attack formation, assault imminent' },
                { type: 'mortar_position', count: randomInt(1, 3), assessment: 'Indirect fire positions identified' }
            ]
        ];

        const data = {
            id: genId('GEO'),
            timestamp: timestamp(),
            gridCoord: generateGridCoord(),
            terrainType: pick(terrainTypes),
            structures: structuresByPhase[phase],
            overheadTimestamp: new Date(Date.now() - randomInt(300, 7200) * 1000).toISOString(),
            resolution: pick(['0.3m', '0.5m', '1.0m', '2.0m'])
        };

        this._emit('geoint', data);
    }

    _generateHumint() {
        const phase = SCENARIO.phaseIndex;

        const sourceReliabilities = ['A', 'B', 'B', 'C', 'C', 'D', 'F'];
        const infoConfidences = ['1', '2', '2', '3', '3', '4', '5'];

        const narrativesByPhase = [
            // Phase 0
            [
                'Local source reports unusual military vehicle movement on roads NE of sector within last 48 hours.',
                'Market vendor states soldiers were buying supplies in village 12km NE two days ago.',
                'Shepherd reports hearing engine noise at night from NE direction.'
            ],
            // Phase 1
            [
                'Reliable source confirms mechanized infantry company staged at former factory complex NE of AO. BTR-type vehicles observed.',
                'Village elder reports soldiers establishing checkpoint on MSR TAMPA NE of sector.',
                'Source with access reports enemy unit received orders for offensive operation within 24 hours.',
                'Farmer displaced from NE area reports soldiers occupying his property, multiple armored vehicles.'
            ],
            // Phase 2
            [
                'Source reports enemy vehicles moving in column toward friendly positions. Estimated company-size element.',
                'Civilian fleeing area reports soldiers are advancing on foot alongside vehicles. Aggressive posture.',
                'Local police source confirms enemy forces passed through village 5km NE, heading SW on MSR TAMPA.',
                'NGO worker reports enemy soldiers warned civilians to evacuate area, suggesting imminent combat.'
            ],
            // Phase 3
            [
                'FLASH: Source in contact reports enemy assault imminent. Soldiers observed loading weapons and mounting vehicles.',
                'Civilian escaped from enemy formation reports orders to attack friendly positions at grid reference near OBJ ALPHA.',
                'Source reports enemy commander directing forces to bypass obstacles and attack from multiple directions.',
                'Multiple sources confirm enemy assault force within 2km of friendly positions, final coordination underway.'
            ]
        ];

        const data = {
            id: genId('HUM'),
            timestamp: timestamp(),
            sourceReliability: pick(sourceReliabilities),
            infoConfidence: pick(infoConfidences),
            narrative: pick(narrativesByPhase[phase]),
            location: generateGridCoord()
        };

        this._emit('humint', data);
    }

    _generateThreatAssessment() {
        const phase = SCENARIO.phaseIndex;
        const areaLevels = ['LOW', 'GUARDED', 'ELEVATED', 'HIGH', 'SEVERE'];
        const activityLevels = ['MINIMAL', 'ROUTINE', 'INCREASED', 'SIGNIFICANT', 'INTENSE'];

        const knownUnitsByPhase = [
            // Phase 0
            [
                { designation: 'UNKNOWN UNIT', type: 'UNKNOWN', size: 'UNKNOWN', confidence: 0.3 }
            ],
            // Phase 1
            [
                { designation: '3rd MR Company', type: 'MECHANIZED_INFANTRY', size: 'COMPANY', confidence: 0.5 },
                { designation: 'UNKNOWN RECON', type: 'RECONNAISSANCE', size: 'SECTION', confidence: 0.4 }
            ],
            // Phase 2
            [
                { designation: '3rd MR Company', type: 'MECHANIZED_INFANTRY', size: 'COMPANY', confidence: 0.75 },
                { designation: 'Mortar Section', type: 'INDIRECT_FIRE', size: 'SECTION', confidence: 0.6 },
                { designation: 'Recon Element', type: 'RECONNAISSANCE', size: 'SQUAD', confidence: 0.7 }
            ],
            // Phase 3
            [
                { designation: '3rd MR Company (-)', type: 'MECHANIZED_INFANTRY', size: 'COMPANY', confidence: 0.9 },
                { designation: 'Attached Mortar Plt', type: 'INDIRECT_FIRE', size: 'PLATOON', confidence: 0.8 },
                { designation: 'Lead Recon Squad', type: 'RECONNAISSANCE', size: 'SQUAD', confidence: 0.85 },
                { designation: 'AT Section', type: 'ANTI_ARMOR', size: 'SECTION', confidence: 0.6 }
            ]
        ];

        const data = {
            areaLevel: areaLevels[Math.min(phase + 1, areaLevels.length - 1)],
            knownUnits: knownUnitsByPhase[phase],
            forceRatio: parseFloat((1.0 + phase * 0.5 + randomInRange(-0.2, 0.3)).toFixed(2)),
            activityLevel: activityLevels[Math.min(phase + 1, activityLevels.length - 1)],
            lastUpdated: timestamp()
        };

        this._emit('threatAssessment', data);
    }

    _generateForceDisposition() {
        const phase = SCENARIO.phaseIndex;

        const friendly = [
            {
                unit: '1st PLT, A CO',
                type: 'INFANTRY',
                position: { grid: '38SKU4520067800', bearing: 0, range: 0 },
                strength: 'GREEN',
                status: 'DEFENDING',
                element: 'MAIN_BODY'
            },
            {
                unit: '2nd PLT, A CO',
                type: 'INFANTRY',
                position: { grid: '38SKU4530068100', bearing: 90, range: 200 },
                strength: 'GREEN',
                status: 'DEFENDING',
                element: 'SUPPORT'
            },
            {
                unit: 'Weapons SQD',
                type: 'WEAPONS',
                position: { grid: '38SKU4525067950', bearing: 45, range: 100 },
                strength: 'GREEN',
                status: 'OVERWATCH',
                element: 'SUPPORT'
            }
        ];

        const enemyByPhase = [
            // Phase 0
            [
                {
                    unit: 'UNKNOWN',
                    type: 'UNKNOWN',
                    position: { grid: generateGridCoord(), bearing: 45, range: 15000 },
                    strength: 'UNKNOWN',
                    status: 'UNKNOWN',
                    element: 'UNKNOWN'
                }
            ],
            // Phase 1
            [
                {
                    unit: '3rd MR CO (PROBABLE)',
                    type: 'MECHANIZED_INFANTRY',
                    position: { grid: generateGridCoord(), bearing: 42, range: 10000 },
                    strength: 'ESTIMATED 80-100 PAX, 10-12 VEH',
                    status: 'STAGING',
                    element: 'MAIN_BODY'
                },
                {
                    unit: 'RECON ELEMENT',
                    type: 'RECONNAISSANCE',
                    position: { grid: generateGridCoord(), bearing: 38, range: 7000 },
                    strength: 'ESTIMATED 4-6 PAX, 1-2 VEH',
                    status: 'MOVING',
                    element: 'ADVANCE_GUARD'
                }
            ],
            // Phase 2
            [
                {
                    unit: '3rd MR CO MAIN BODY',
                    type: 'MECHANIZED_INFANTRY',
                    position: { grid: generateGridCoord(), bearing: 44, range: 5000 },
                    strength: 'ESTIMATED 80-100 PAX, 10-12 BTR-82A',
                    status: 'ADVANCING',
                    element: 'MAIN_BODY'
                },
                {
                    unit: 'RECON SQUAD',
                    type: 'RECONNAISSANCE',
                    position: { grid: generateGridCoord(), bearing: 40, range: 3000 },
                    strength: 'ESTIMATED 6-8 PAX, 2 VEH',
                    status: 'SCREENING',
                    element: 'ADVANCE_GUARD'
                },
                {
                    unit: 'MORTAR SECTION',
                    type: 'INDIRECT_FIRE',
                    position: { grid: generateGridCoord(), bearing: 50, range: 6000 },
                    strength: 'ESTIMATED 8-10 PAX, 2-3 TUBES',
                    status: 'DISPLACING',
                    element: 'SUPPORT'
                }
            ],
            // Phase 3
            [
                {
                    unit: '3rd MR CO (-) ASSAULT',
                    type: 'MECHANIZED_INFANTRY',
                    position: { grid: generateGridCoord(), bearing: 43, range: 1500 },
                    strength: 'CONFIRMED 90+ PAX, 11 BTR-82A',
                    status: 'ATTACKING',
                    element: 'MAIN_BODY'
                },
                {
                    unit: 'LEAD RECON',
                    type: 'RECONNAISSANCE',
                    position: { grid: generateGridCoord(), bearing: 38, range: 800 },
                    strength: '6 PAX, 1 VEH',
                    status: 'IN_CONTACT',
                    element: 'ADVANCE_GUARD'
                },
                {
                    unit: 'MORTAR PLT',
                    type: 'INDIRECT_FIRE',
                    position: { grid: generateGridCoord(), bearing: 55, range: 4000 },
                    strength: '12 PAX, 4 TUBES',
                    status: 'FIRING',
                    element: 'SUPPORT'
                },
                {
                    unit: 'AT SECTION',
                    type: 'ANTI_ARMOR',
                    position: { grid: generateGridCoord(), bearing: 35, range: 2000 },
                    strength: '4 PAX, 2 ATGM',
                    status: 'SET',
                    element: 'SUPPORT'
                }
            ]
        ];

        const neutral = [
            {
                unit: 'CIVILIAN TRAFFIC',
                type: 'CIVILIAN',
                position: { grid: generateGridCoord(), bearing: randomInt(0, 359), range: randomInt(500, 3000) },
                strength: `${randomInt(5, 30)} PAX, ${randomInt(2, 10)} VEH`,
                status: phase >= 2 ? 'FLEEING' : 'NORMAL_ACTIVITY',
                element: 'N/A'
            }
        ];

        const data = {
            friendly,
            enemy: enemyByPhase[phase],
            neutral
        };

        this._emit('forceDisposition', data);
    }

    _generateEnvironment() {
        const weatherConditions = [
            'CLEAR', 'PARTLY_CLOUDY', 'OVERCAST', 'LIGHT_RAIN',
            'HAZE', 'FOG_PATCHES', 'DUST'
        ];

        const hour = new Date().getHours();
        const isNight = hour < 6 || hour >= 20;
        const isDusk = hour >= 18 && hour < 20;
        const isDawn = hour >= 5 && hour < 7;

        let visibility;
        if (isNight) {
            visibility = randomInt(50, 500) + 'm (night)';
        } else if (isDusk || isDawn) {
            visibility = randomInt(500, 2000) + 'm (twilight)';
        } else {
            visibility = randomInt(2000, 10000) + 'm';
        }

        const windDirections = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

        const data = {
            weather: pick(weatherConditions),
            visibility,
            wind: {
                direction: pick(windDirections),
                speed: randomInt(2, 25),
                unit: 'kph'
            },
            temperature: {
                current: randomInt(15, 38),
                unit: 'C'
            },
            moonIllum: randomInt(0, 100) + '%',
            terrainClass: pick(['SEMI_ARID', 'MIXED_URBAN_RURAL', 'ROLLING_TERRAIN', 'OPEN_DESERT']),
            lightConditions: isNight ? 'NIGHT' : isDusk || isDawn ? 'TWILIGHT' : 'DAY',
            timestamp: timestamp()
        };

        this._emit('environment', data);
    }
}

console.log('[MAVEN] Maven Mock module loaded');
