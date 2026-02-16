// TALOS 2.0 - Civil Considerations Analyzer (C in METT-TC)
// ASCOPE analysis: Areas, Structures, Capabilities, Organizations, People, Events
// ROE enforcement, civilian detection, protected structures, collateral damage estimation

class CivilAnalyzer {
  constructor() {
    this.civilianEntities = [];
    this.protectedStructures = [];
    this.roeZones = [];
    this.currentROE = {
      level: 'WEAPONS_TIGHT',
      restrictions: [],
      escalationOfForce: ['SHOUT', 'SHOW', 'SHOVE', 'SHOOT']
    };
    this.civilianDensity = 'NONE';
    this.ascope = {
      areas: [],
      structures: [],
      capabilities: [],
      organizations: [],
      people: { detected: 0, civilian: 0, unknown: 0, combatant: 0 },
      events: []
    };
  }

  // Set ROE from mission context
  setROE(roe) {
    if (roe) {
      this.currentROE = { ...this.currentROE, ...roe };
    }
  }

  // Analyze civil considerations from detections + intel
  analyze(detections, mavenIntel, missionContext) {
    this._classifyCivilians(detections);
    this._identifyProtectedStructures(detections, mavenIntel);
    this._updateASCOPE(mavenIntel);
    this._calculateDensity();
    this._generateROEZones();

    if (missionContext?.rulesOfEngagement) {
      this.setROE(missionContext.rulesOfEngagement);
    }

    return this.getCivilData();
  }

  // Check if a proposed engagement violates ROE
  checkROE(targetPosition, engagementType) {
    const violations = [];
    const warnings = [];

    // Check civilian proximity
    for (const civ of this.civilianEntities) {
      if (!civ.position || !targetPosition) continue;
      const dist = Math.sqrt(
        Math.pow(civ.position[0] - targetPosition[0], 2) +
        Math.pow(civ.position[1] - targetPosition[1], 2)
      );

      if (dist < 0.05) {
        violations.push(`Civilian within immediate blast radius (${civ.classification})`);
      } else if (dist < 0.1) {
        warnings.push(`Civilian within 50m of target (${civ.classification})`);
      }
    }

    // Check protected structures
    for (const structure of this.protectedStructures) {
      if (!structure.position || !targetPosition) continue;
      const dist = Math.sqrt(
        Math.pow(structure.position[0] - targetPosition[0], 2) +
        Math.pow(structure.position[1] - targetPosition[1], 2)
      );

      if (dist < (structure.noFireRadius || 0.15)) {
        violations.push(`${structure.type} no-fire zone violation (${structure.label})`);
      }
    }

    // Check ROE level
    if (this.currentROE.level === 'WEAPONS_HOLD') {
      violations.push('ROE: WEAPONS HOLD - Engagement only in self-defense');
    }

    // Check engagement type vs density
    if (engagementType === 'INDIRECT_FIRE' && this.civilianDensity !== 'NONE') {
      if (this.civilianDensity === 'HIGH') {
        violations.push('Indirect fire in HIGH civilian density area - PROHIBITED');
      } else {
        warnings.push(`Indirect fire in ${this.civilianDensity} civilian density area - RESTRICTED`);
      }
    }

    // Collateral damage estimation
    const cde = this._estimateCollateralDamage(targetPosition, engagementType);

    return {
      clear: violations.length === 0,
      violations,
      warnings,
      collateralDamage: cde,
      roeLevel: this.currentROE.level,
      recommendation: violations.length > 0
        ? 'ENGAGEMENT RESTRICTED - ' + violations[0]
        : warnings.length > 0
          ? 'CAUTION - ' + warnings[0]
          : 'CLEAR TO ENGAGE'
    };
  }

  // Get formatted civil data for overlays
  getCivilData() {
    return {
      civilianPresence: {
        detected: this.ascope.people.detected,
        entities: this.civilianEntities.map(e => ({
          position: e.position,
          classification: e.classification,
          confidence: e.confidence
        })),
        density: this.civilianDensity,
        classification: { ...this.ascope.people }
      },
      protectedStructures: this.protectedStructures.map(s => ({
        type: s.type,
        position: s.position,
        noFireRadius: s.noFireRadius,
        label: s.label
      })),
      roeZones: [...this.roeZones],
      roeLevel: this.currentROE.level,
      roeConstraints: this._generateROEConstraints(),
      ascope: { ...this.ascope }
    };
  }

  // --- Private Methods ---

  _classifyCivilians(detections) {
    this.civilianEntities = [];
    if (!detections) return;

    let civCount = 0, unknownCount = 0, combatantCount = 0;

    for (const det of detections) {
      if (det.class !== 'person') continue;

      // Classification logic: use multiple signals
      let classification = 'UNKNOWN';
      let confidence = 0.5;

      if (det.classification === 'CIVILIAN') {
        classification = 'CIVILIAN';
        confidence = 0.8;
      } else if (det.classification === 'HOSTILE') {
        classification = 'COMBATANT';
        confidence = 0.7;
      } else {
        // Heuristic: stationary persons not in tactical formations more likely civilian
        if (det.movement && det.movement.speed < 0.5 && det.threatLevel < 0.3) {
          classification = 'CIVILIAN';
          confidence = 0.6;
        }
      }

      if (classification === 'CIVILIAN') civCount++;
      else if (classification === 'COMBATANT') combatantCount++;
      else unknownCount++;

      if (classification !== 'COMBATANT') {
        this.civilianEntities.push({
          position: det.bbox ? [det.bbox[0] + det.bbox[2] / 2, det.bbox[1] + det.bbox[3] / 2] : null,
          classification,
          confidence,
          trackId: det.trackId
        });
      }
    }

    this.ascope.people = {
      detected: civCount + unknownCount + combatantCount,
      civilian: civCount,
      unknown: unknownCount,
      combatant: combatantCount
    };
  }

  _identifyProtectedStructures(detections, mavenIntel) {
    this.protectedStructures = [];

    // From Maven GEOINT data
    if (mavenIntel && mavenIntel.geoint) {
      const structures = mavenIntel.geoint.structures || [];
      for (const s of structures) {
        if (['mosque', 'hospital', 'school', 'church', 'refugee_camp'].includes(s.type)) {
          this.protectedStructures.push({
            type: s.type.toUpperCase(),
            position: s.position || [Math.random(), Math.random()],
            noFireRadius: s.type === 'hospital' ? 0.15 : 0.1,
            label: `${s.type.toUpperCase()} - NO FIRE ZONE`,
            source: 'GEOINT'
          });
        }
      }
    }

    // If no intel structures, add simulated ones for demo
    if (this.protectedStructures.length === 0 && Math.random() < 0.3) {
      this.protectedStructures.push({
        type: 'MOSQUE',
        position: [0.7, 0.6],
        noFireRadius: 0.12,
        label: 'MOSQUE - NO FIRE ZONE',
        source: 'SIMULATED'
      });
    }
  }

  _updateASCOPE(mavenIntel) {
    if (!mavenIntel) return;

    // Areas
    if (mavenIntel.geoint) {
      this.ascope.areas = [{
        type: mavenIntel.geoint.terrain_type || 'UNKNOWN',
        significance: 'Operational area',
        restrictions: []
      }];
    }

    // Structures
    this.ascope.structures = this.protectedStructures.map(s => ({
      type: s.type, status: 'ACTIVE', significance: 'PROTECTED'
    }));

    // Events from Maven
    if (mavenIntel.environment) {
      this.ascope.events = [];
      // Simulate time-based events
      const hour = new Date().getHours();
      if (hour >= 5 && hour <= 7) {
        this.ascope.events.push({ type: 'PRAYER_TIME', description: 'Morning prayer - increased foot traffic near mosques' });
      }
      if (hour >= 7 && hour <= 15) {
        this.ascope.events.push({ type: 'MARKET_HOURS', description: 'Market active - high civilian density in commercial areas' });
      }
    }
  }

  _calculateDensity() {
    const civCount = this.ascope.people.civilian + this.ascope.people.unknown;
    if (civCount >= 7) this.civilianDensity = 'HIGH';
    else if (civCount >= 4) this.civilianDensity = 'MODERATE';
    else if (civCount >= 1) this.civilianDensity = 'LOW';
    else this.civilianDensity = 'NONE';
  }

  _generateROEZones() {
    this.roeZones = this.protectedStructures.map(s => ({
      center: s.position,
      radius: s.noFireRadius,
      type: 'NO_FIRE',
      label: s.label
    }));

    // Add general density-based zones
    if (this.civilianDensity === 'HIGH') {
      this.roeZones.push({
        center: [0.5, 0.5],
        radius: 0.3,
        type: 'RESTRICTED_FIRE',
        label: 'HIGH CIV DENSITY - RESTRICTED'
      });
    }
  }

  _generateROEConstraints() {
    const constraints = [];

    if (this.ascope.people.unknown > 0) {
      constraints.push(`PID required - ${this.ascope.people.unknown} UNKNOWN person(s) in area`);
    }

    if (this.civilianDensity !== 'NONE') {
      constraints.push(`Civilian density ${this.civilianDensity} - ${
        this.civilianDensity === 'HIGH' ? 'No indirect fire' : 'Indirect fire restricted'
      }`);
    }

    for (const s of this.protectedStructures) {
      constraints.push(`${s.type} no-fire zone active at ${s.label}`);
    }

    if (this.currentROE.level === 'WEAPONS_HOLD') {
      constraints.push('WEAPONS HOLD: Fire only in self-defense after hostile act');
    } else if (this.currentROE.level === 'WEAPONS_TIGHT') {
      constraints.push('WEAPONS TIGHT: Fire only at positively identified hostiles');
    }

    return constraints;
  }

  _estimateCollateralDamage(targetPosition, engagementType) {
    if (!targetPosition) return { level: 'UNKNOWN', details: 'No target position' };

    let nearCivs = 0;
    let nearStructures = 0;

    for (const civ of this.civilianEntities) {
      if (!civ.position) continue;
      const dist = Math.sqrt(
        Math.pow(civ.position[0] - targetPosition[0], 2) +
        Math.pow(civ.position[1] - targetPosition[1], 2)
      );
      const blastRadius = engagementType === 'INDIRECT_FIRE' ? 0.15 : 0.03;
      if (dist < blastRadius) nearCivs++;
    }

    for (const s of this.protectedStructures) {
      if (!s.position) continue;
      const dist = Math.sqrt(
        Math.pow(s.position[0] - targetPosition[0], 2) +
        Math.pow(s.position[1] - targetPosition[1], 2)
      );
      if (dist < 0.15) nearStructures++;
    }

    let level;
    if (nearCivs > 3 || nearStructures > 0) level = 'VERY_HIGH';
    else if (nearCivs > 1) level = 'HIGH';
    else if (nearCivs > 0) level = 'MODERATE';
    else level = 'LOW';

    const typeRecommendation = {
      LOW: 'Any engagement type authorized',
      MODERATE: 'DIRECT_FIRE_ONLY recommended',
      HIGH: 'PRECISION_ONLY - minimize blast radius',
      VERY_HIGH: 'ENGAGEMENT NOT RECOMMENDED - excessive collateral risk'
    };

    return {
      level,
      civiliansAtRisk: nearCivs,
      structuresAtRisk: nearStructures,
      recommendation: typeRecommendation[level] || 'Assess situation'
    };
  }
}

export const civilAnalyzer = new CivilAnalyzer();
