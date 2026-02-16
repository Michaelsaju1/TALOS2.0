// TALOS 2.0 - Enemy Analyzer (E in METT-TC)
// Goes beyond detection to perform enemy analysis:
// Composition, disposition, MPCOA, MDCOA, HVTs, decision points

import { ARMY_BRANCHES } from '../knowledge/army-branches.js';

class EnemyAnalyzer {
  constructor() {
    this.enemyUnits = new Map();   // trackId → analysis
    this.groupings = [];           // detected tactical groupings
    this.overallAssessment = null;
  }

  // Analyze all tracked entities
  analyze(trackedEntities, terrainData, mavenIntel, missionContext) {
    if (!trackedEntities || trackedEntities.length === 0) {
      this.overallAssessment = null;
      return [];
    }

    // Filter to hostile/unknown entities
    const threats = trackedEntities.filter(e =>
      e.classification === 'HOSTILE' || e.classification === 'UNKNOWN'
    );

    // Group entities into tactical units
    this.groupings = this._groupEntities(threats);

    // Analyze each entity
    const analyses = threats.map(entity => {
      const analysis = this._analyzeEntity(entity, terrainData, mavenIntel, missionContext);
      this.enemyUnits.set(entity.id, analysis);
      return analysis;
    });

    // Generate overall enemy assessment
    this.overallAssessment = this._generateOverallAssessment(analyses, missionContext, mavenIntel);

    return analyses;
  }

  getEntityAnalysis(trackId) {
    return this.enemyUnits.get(trackId) || null;
  }

  getOverallAssessment() {
    return this.overallAssessment;
  }

  // --- Private Methods ---

  _analyzeEntity(entity, terrainData, mavenIntel, missionContext) {
    const branchMatch = this._matchBranch(entity);
    const terrainContext = this._assessTerrainPosition(entity, terrainData);
    const groupInfo = this._getGroupInfo(entity);

    // Determine composition
    const composition = this._assessComposition(entity, groupInfo, branchMatch);

    // Assess disposition (what they're doing)
    const disposition = this._assessDisposition(entity, terrainContext);

    // Strength assessment
    const strength = this._assessStrength(entity, groupInfo, branchMatch);

    // Predict enemy courses of action
    const mpcoa = this._predictMPCOA(entity, terrainContext, disposition, missionContext);
    const mdcoa = this._predictMDCOA(entity, terrainContext, missionContext);

    // Identify HVTs
    const hvts = this._identifyHVTs(entity, groupInfo);

    // Decision points
    const decisionPoints = this._identifyDecisionPoints(entity, terrainContext, missionContext);

    return {
      entityId: entity.id,
      trackId: entity.trackId,
      composition,
      disposition,
      strength,
      mpcoa,
      mdcoa,
      hvts,
      decisionPoints,
      branchAssessment: branchMatch,
      terrainPosition: terrainContext
    };
  }

  _matchBranch(entity) {
    // Map detection class to most likely Army branch
    const classMapping = {
      PERSONNEL: ['INFANTRY', 'SPECIAL_FORCES'],
      VEHICLE: ['ARMOR', 'CAVALRY'],
      LIGHT_VEHICLE: ['CAVALRY', 'MILITARY_POLICE'],
      AIRCRAFT: ['AVIATION'],
      COMMS_EQUIPMENT: ['SIGNAL'],
      SUPPLY: ['QUARTERMASTER', 'TRANSPORTATION']
    };

    const possibleBranches = classMapping[entity.tacticalClass] || ['INFANTRY'];
    const primaryBranch = possibleBranches[0];

    // Look up doctrine
    const doctrine = ARMY_BRANCHES ? ARMY_BRANCHES[primaryBranch] : null;
    return {
      primaryBranch,
      possibleBranches,
      doctrine: doctrine || null,
      confidence: 0.6 // Without more intel, confidence is moderate
    };
  }

  _groupEntities(entities) {
    // Group nearby entities into tactical units
    const groups = [];
    const assigned = new Set();

    for (const entity of entities) {
      if (assigned.has(entity.id)) continue;

      const group = [entity];
      assigned.add(entity.id);

      // Find nearby entities (within ~20% screen distance)
      for (const other of entities) {
        if (assigned.has(other.id)) continue;
        if (!entity.bbox || !other.bbox) continue;

        const dist = Math.sqrt(
          Math.pow((entity.bbox[0] + entity.bbox[2] / 2) - (other.bbox[0] + other.bbox[2] / 2), 2) +
          Math.pow((entity.bbox[1] + entity.bbox[3] / 2) - (other.bbox[1] + other.bbox[3] / 2), 2)
        );

        if (dist < 0.15) { // Within 15% of screen = probably same unit
          group.push(other);
          assigned.add(other.id);
        }
      }

      if (group.length > 1) {
        const unitType = group.length <= 5 ? 'FIRE_TEAM' :
                         group.length <= 13 ? 'SQUAD' :
                         group.length <= 40 ? 'PLATOON' : 'COMPANY';
        groups.push({
          id: `GRP-${groups.length + 1}`,
          type: unitType,
          members: group.map(e => e.id),
          size: group.length,
          hasVehicles: group.some(e => e.tacticalClass === 'VEHICLE'),
          center: this._groupCenter(group)
        });
      }
    }

    return groups;
  }

  _getGroupInfo(entity) {
    for (const group of this.groupings) {
      if (group.members.includes(entity.id)) return group;
    }
    return null;
  }

  _groupCenter(group) {
    let cx = 0, cy = 0;
    for (const e of group) {
      if (e.bbox) {
        cx += e.bbox[0] + e.bbox[2] / 2;
        cy += e.bbox[1] + e.bbox[3] / 2;
      }
    }
    return [cx / group.length, cy / group.length];
  }

  _assessComposition(entity, groupInfo, branchMatch) {
    if (groupInfo) {
      const hasArmor = groupInfo.hasVehicles;
      const label = hasArmor
        ? `MECH ${groupInfo.type} (~${groupInfo.size} PAX + VEH)`
        : `${groupInfo.type} (~${groupInfo.size} PAX)`;
      return { label, unitType: groupInfo.type, size: groupInfo.size, mechanized: hasArmor };
    }

    return {
      label: `INDIVIDUAL ${entity.tacticalClass || 'UNKNOWN'}`,
      unitType: 'INDIVIDUAL',
      size: 1,
      mechanized: entity.tacticalClass === 'VEHICLE'
    };
  }

  _assessDisposition(entity, terrainContext) {
    const movement = entity.movement || {};
    let posture = 'UNKNOWN';

    if (movement.speed > 1.5) posture = 'MOVING';
    else if (movement.speed > 0.5) posture = 'CREEPING';
    else posture = 'STATIONARY';

    let formation = 'UNKNOWN';
    // Single entity can't determine formation, but we can infer intent
    if (posture === 'MOVING' && movement.heading === 'APPROACHING') {
      formation = 'ADVANCING';
    } else if (posture === 'STATIONARY') {
      formation = terrainContext.inCover ? 'DEFENSIVE' : 'HALTED';
    }

    return {
      posture,
      formation,
      heading: movement.heading || 'UNKNOWN',
      speed: movement.speed || 0,
      bearing: movement.bearing || 0,
      onAvenue: entity.onAvenue || null
    };
  }

  _assessStrength(entity, groupInfo, branchMatch) {
    let strength = 'UNKNOWN';
    const size = groupInfo ? groupInfo.size : 1;
    const hasArmor = groupInfo ? groupInfo.hasVehicles : (entity.tacticalClass === 'VEHICLE');

    // Simple force ratio assessment
    if (size > 10 && hasArmor) strength = 'SUPERIOR';
    else if (size > 5) strength = 'EQUAL';
    else if (size > 2) strength = 'INFERIOR';
    else strength = 'MINIMAL';

    return {
      assessment: strength,
      size,
      hasArmor,
      equipment: branchMatch.doctrine ? branchMatch.doctrine.equipment || [] : [],
      threatCapability: hasArmor ? 'HIGH' : size > 5 ? 'MEDIUM' : 'LOW'
    };
  }

  _assessTerrainPosition(entity, terrainData) {
    const result = { inCover: false, onAvenue: false, hasHighGround: false, terrainAdvantage: 'NEUTRAL' };
    if (!terrainData || !terrainData.oakoc || !entity.bbox) return result;

    const ex = entity.bbox[0] + entity.bbox[2] / 2;
    const ey = entity.bbox[1] + entity.bbox[3] / 2;

    // Check if near cover
    if (terrainData.oakoc.coverAndConcealment) {
      for (const cover of terrainData.oakoc.coverAndConcealment.coverPositions || []) {
        const dist = Math.sqrt(Math.pow(ex - cover.position[0], 2) + Math.pow(ey - cover.position[1], 2));
        if (dist < 0.1) { result.inCover = true; break; }
      }
    }

    // Check if on avenue
    if (terrainData.oakoc.avenues) {
      for (const ave of terrainData.oakoc.avenues) {
        if (ave.id === entity.onAvenue) { result.onAvenue = true; break; }
      }
    }

    // Check key terrain proximity
    if (terrainData.oakoc.keyTerrain) {
      for (const kt of terrainData.oakoc.keyTerrain) {
        const dist = Math.sqrt(Math.pow(ex - kt.position[0], 2) + Math.pow(ey - kt.position[1], 2));
        if (dist < 0.15 && kt.type === 'HIGH_GROUND') { result.hasHighGround = true; break; }
      }
    }

    if (result.hasHighGround && result.inCover) result.terrainAdvantage = 'STRONG';
    else if (result.hasHighGround || result.inCover) result.terrainAdvantage = 'MODERATE';
    else result.terrainAdvantage = 'WEAK';

    return result;
  }

  _predictMPCOA(entity, terrainContext, disposition, missionContext) {
    // Most Probable Course of Action
    const isApproaching = disposition.heading === 'APPROACHING';
    const isMoving = disposition.posture === 'MOVING';
    const onAvenue = disposition.onAvenue;

    if (isMoving && isApproaching && onAvenue) {
      return `Continue advance along ${onAvenue} toward our position. Likely probing or assault.`;
    }
    if (isMoving && isApproaching) {
      return 'Continuing movement toward our position. Possible reconnaissance or advance element.';
    }
    if (isMoving && !isApproaching) {
      return `Moving ${disposition.heading}. Possible flanking maneuver or bypass.`;
    }
    if (disposition.posture === 'STATIONARY' && terrainContext.inCover) {
      return 'Established in defensive position. Likely observing or preparing for action.';
    }
    if (disposition.posture === 'STATIONARY') {
      return 'Halted in place. Possible rally point, assembly area, or waiting for orders.';
    }
    return 'Insufficient data to predict enemy course of action.';
  }

  _predictMDCOA(entity, terrainContext, missionContext) {
    // Most Dangerous Course of Action - what would hurt us the most
    const mission = missionContext?.missionType || 'DEFENSE';

    if (mission === 'DEFENSE') {
      return 'Coordinated assault with fixing element to our front while flanking force envelops via alternate avenue. Uses indirect fire to suppress our position.';
    }
    if (mission === 'OFFENSE') {
      return 'Prepared ambush at chokepoint with interlocking fires. Obstacles to channel our movement into kill zone.';
    }
    if (mission === 'STABILITY') {
      return 'IED/VBIED attack exploiting proximity to civilians to prevent return fire. Complex attack with secondary device targeting responders.';
    }
    return 'Concentrated attack at our weakest point with supporting fires and prepared withdrawal route.';
  }

  _identifyHVTs(entity, groupInfo) {
    const hvts = [];
    // Without more sophisticated analysis, flag potential HVTs by behavior
    if (entity.tacticalClass === 'COMMS_EQUIPMENT') {
      hvts.push({ type: 'RADIO_OPERATOR', reason: 'Communications equipment detected', priority: 'HIGH' });
    }
    if (entity.tacticalClass === 'VEHICLE') {
      hvts.push({ type: 'VEHICLE_COMMANDER', reason: 'Vehicle likely has command element', priority: 'HIGH' });
    }
    if (groupInfo && groupInfo.size > 3) {
      hvts.push({ type: 'UNIT_LEADER', reason: 'Group size suggests leadership present', priority: 'MEDIUM' });
    }
    return hvts;
  }

  _identifyDecisionPoints(entity, terrainContext, missionContext) {
    const dps = [];
    if (entity.onAvenue && terrainContext.onAvenue) {
      dps.push({
        description: `Enemy on ${entity.onAvenue} - will reach chokepoint. Must decide to engage or allow passage.`,
        urgency: entity.movement?.heading === 'APPROACHING' ? 'HIGH' : 'MEDIUM'
      });
    }
    return dps;
  }

  _generateOverallAssessment(analyses, missionContext, mavenIntel) {
    const totalHostile = analyses.filter(a => a.composition.size > 0).length;
    const totalStrength = analyses.reduce((sum, a) => sum + a.composition.size, 0);
    const hasArmor = analyses.some(a => a.strength.hasArmor);
    const approaching = analyses.filter(a => a.disposition.heading === 'APPROACHING').length;

    return {
      enemyCount: totalHostile,
      estimatedStrength: totalStrength,
      hasArmor,
      approachingCount: approaching,
      overallThreat: hasArmor && approaching > 0 ? 'HIGH' :
                     approaching > 2 ? 'HIGH' :
                     totalHostile > 3 ? 'MEDIUM' : 'LOW',
      summary: totalHostile > 0
        ? `${totalHostile} enemy element(s), ~${totalStrength} PAX${hasArmor ? ' (MECH)' : ''}. ${approaching} approaching.`
        : 'No enemy elements detected.'
    };
  }
}

export const enemyAnalyzer = new EnemyAnalyzer();
