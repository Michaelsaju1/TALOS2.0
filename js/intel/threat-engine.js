// TALOS 2.0 - Threat Analysis Engine (METT-TC Integrated)
// The brain. All METT-TC factors feed into threat scoring and COA generation.
// Every COA is drone-centric, mission-aligned, terrain-informed, time-feasible, and civil-checked.

import { enemyAnalyzer } from './enemy-analyzer.js';
import { civilAnalyzer } from './civil-analyzer.js';
import { terrainAnalyzer } from './terrain-analyzer.js';
import { sceneClassifier } from './scene-classifier.js';
import { droneManager } from '../drones/drone-manager.js';
import { timeManager } from '../mission/time-manager.js';
import { ARMY_BRANCHES } from '../knowledge/army-branches.js';

// Scoring weights for threat calculation
const WEIGHTS = {
  classification: 0.15,
  proximity: 0.20,
  behavior: 0.15,
  intelCorrelation: 0.10,
  exposure: 0.05,
  terrainAdvantage: 0.10,
  avenueControl: 0.08,
  keyTerrainProximity: 0.05,
  missionRelevance: 0.07,
  timeUrgency: 0.05
};

class ThreatEngine {
  constructor() {
    this.assessments = new Map(); // trackId → full assessment
    this.missionContext = null;
    this.lastMavenIntel = null;
    this.osintData = null;       // Raw OSINT feed data (weather, aircraft, etc.)
    this.osintSummary = null;    // Tactical summary of OSINT
  }

  setMissionContext(context) {
    this.missionContext = context;
  }

  /**
   * Receive OSINT data for integration into threat analysis and COA generation.
   * Weather affects drone ops feasibility. Aircraft affects air threat assessment.
   */
  setOSINTData(data, summary) {
    this.osintData = data;
    this.osintSummary = summary;
  }

  // Main analysis entry point - processes all tracked entities
  analyze(trackedEntities, depthMap, depthWidth, depthHeight, mavenIntel) {
    this.lastMavenIntel = mavenIntel;

    if (!trackedEntities || trackedEntities.length === 0) {
      this.assessments.clear();
      return [];
    }

    // Run sub-analyzers
    const scene = sceneClassifier.getCurrentScene();
    const terrainData = terrainAnalyzer.getLastAnalysis();
    const enemyAnalyses = enemyAnalyzer.analyze(
      trackedEntities, terrainData, mavenIntel, this.missionContext
    );
    const civilData = civilAnalyzer.analyze(
      trackedEntities, mavenIntel, this.missionContext
    );

    // Update time manager with entity ETAs
    timeManager.updateEnemyETAs(trackedEntities, depthMap);
    const timeData = timeManager.getTimeData();

    // Generate full assessments for each tracked entity
    const results = [];
    for (const entity of trackedEntities) {
      if (entity.class === 'person' && entity.threatLevel < 0.1 && entity.classification === 'CIVILIAN') {
        continue; // Skip low-threat civilians
      }

      const enemyAnalysis = enemyAnalyses.find(a => a.entityId === entity.id);
      const assessment = this._assessEntity(entity, enemyAnalysis, terrainData, civilData, timeData, mavenIntel, scene);
      this.assessments.set(entity.id, assessment);
      results.push(assessment);
    }

    // Sort by threat level descending
    results.sort((a, b) => b.threatLevel - a.threatLevel);
    return results;
  }

  getAssessment(trackId) {
    return this.assessments.get(trackId) || null;
  }

  getAllAssessments() {
    return Array.from(this.assessments.values());
  }

  // --- Private: Full METT-TC Entity Assessment ---

  _assessEntity(entity, enemyAnalysis, terrainData, civilData, timeData, mavenIntel, scene) {
    // Calculate composite threat score
    const scores = this._calculateScores(entity, enemyAnalysis, terrainData, mavenIntel, scene);
    const threatLevel = Object.entries(scores).reduce(
      (sum, [key, val]) => sum + (WEIGHTS[key] || 0) * val, 0
    );

    // Determine classification
    const classification = threatLevel > 0.7 ? 'HOSTILE' :
                           threatLevel > 0.3 ? 'UNKNOWN' :
                           entity.classification || 'UNKNOWN';

    // Mission impact
    const missionImpact = this._assessMissionImpact(entity, enemyAnalysis, terrainData);

    // Terrain context
    const terrainContext = this._assessTerrainContext(entity, terrainData);

    // Strengths and weaknesses from doctrine + terrain + intel
    const analysis = this._buildAnalysis(entity, enemyAnalysis, terrainData, scene, mavenIntel);

    // Generate COAs (drone-centric, all constraints applied)
    const coursesOfAction = this._generateCOAs(
      entity, classification, threatLevel, terrainData, civilData, timeData, enemyAnalysis, scene
    );

    // Civil warnings
    const civilWarnings = this._getCivilWarnings(entity, civilData);

    // Intel correlation
    const intelCorrelation = this._correlateIntel(entity, mavenIntel);

    // Distance and movement
    const distance = entity.distance || { meters: 0, confidence: 0.5, zone: 'UNKNOWN' };
    const movement = entity.movement || {};

    // Build OSINT context for this assessment
    const osintContext = this._buildOSINTContext();

    return {
      id: entity.id,
      trackId: entity.trackId,
      threatLevel: Math.min(1, Math.max(0, threatLevel)),
      classification,
      category: enemyAnalysis?.composition?.label || entity.tacticalClass || 'UNKNOWN',
      bbox: entity.bbox,

      missionImpact,
      osintContext,

      enemy: enemyAnalysis ? {
        composition: enemyAnalysis.composition.label,
        disposition: `${enemyAnalysis.disposition.posture}, ${enemyAnalysis.disposition.formation}`,
        strength: enemyAnalysis.strength.assessment,
        mpcoa: enemyAnalysis.mpcoa,
        mdcoa: enemyAnalysis.mdcoa,
        hvts: enemyAnalysis.hvts,
        decisionPoints: enemyAnalysis.decisionPoints
      } : {
        composition: entity.tacticalClass || 'UNKNOWN',
        disposition: 'UNKNOWN',
        strength: 'UNKNOWN',
        mpcoa: 'Insufficient data',
        mdcoa: 'Insufficient data',
        hvts: [],
        decisionPoints: []
      },

      terrain: terrainContext,

      distance: {
        meters: Math.round(distance.meters),
        confidence: distance.confidence,
        zone: distance.zone
      },
      movement: {
        speed: movement.speed ? `${movement.speed.toFixed(1)} m/s` : '--',
        heading: movement.heading || 'UNKNOWN',
        bearing: movement.bearing || 0,
        onAvenue: entity.onAvenue || null,
        etaToUs: timeData.enemyETAs[entity.id]?.toOurPosition || '--'
      },

      analysis,
      coursesOfAction,
      civilWarnings,
      intelCorrelation
    };
  }

  // --- Score Calculations ---

  _calculateScores(entity, enemyAnalysis, terrainData, mavenIntel, scene) {
    return {
      classification: this._scoreClassification(entity),
      proximity: this._scoreProximity(entity),
      behavior: this._scoreBehavior(entity),
      intelCorrelation: this._scoreIntelCorrelation(entity, mavenIntel),
      exposure: this._scoreExposure(entity),
      terrainAdvantage: this._scoreTerrainAdvantage(entity, terrainData),
      avenueControl: this._scoreAvenueControl(entity, terrainData),
      keyTerrainProximity: this._scoreKeyTerrainProximity(entity, terrainData),
      missionRelevance: this._scoreMissionRelevance(entity),
      timeUrgency: this._scoreTimeUrgency(entity)
    };
  }

  _scoreClassification(entity) {
    const threatMap = {
      PERSONNEL: 0.6, VEHICLE: 0.85, LIGHT_VEHICLE: 0.5,
      AIRCRAFT: 0.9, COMMS_EQUIPMENT: 0.3, SUPPLY: 0.2
    };
    return threatMap[entity.tacticalClass] || 0.4;
  }

  _scoreProximity(entity) {
    const dist = entity.distance?.meters || 200;
    if (dist < 25) return 1.0;
    if (dist < 50) return 0.85;
    if (dist < 100) return 0.6;
    if (dist < 200) return 0.4;
    return 0.2;
  }

  _scoreBehavior(entity) {
    const speed = entity.movement?.speed || 0;
    const heading = entity.movement?.heading || '';
    let score = 0.3;
    if (heading === 'APPROACHING') score += 0.4;
    if (speed > 2) score += 0.2;
    if (speed > 4) score += 0.1;
    return Math.min(1, score);
  }

  _scoreIntelCorrelation(entity, mavenIntel) {
    let score = 0.3;

    // Maven intel correlation
    if (mavenIntel) {
      const threat = mavenIntel.threat;
      if (threat && threat.area_threat_level === 'HIGH') score = 0.8;
      else if (threat && threat.area_threat_level === 'MEDIUM') score = 0.5;
    }

    // OSINT: Military aircraft nearby elevates area threat
    if (this.osintSummary) {
      if (this.osintSummary.militaryAircraft > 0) {
        score = Math.min(1, score + 0.15); // Military air activity = elevated threat
      }
      if (this.osintSummary.emergencyAircraft > 0) {
        score = Math.min(1, score + 0.1);  // Emergency aircraft = heightened awareness
      }
      // Poor visibility from weather = harder to detect threats = higher risk
      if (this.osintSummary.tacticalImpact === 'SEVERE') {
        score = Math.min(1, score + 0.1);
      }
    }

    return score;
  }

  _scoreExposure(entity) {
    // Without segmentation data, use bbox size as proxy
    if (!entity.bbox) return 0.5;
    const area = entity.bbox[2] * entity.bbox[3];
    return Math.min(1, area * 10); // Larger = more exposed
  }

  _scoreTerrainAdvantage(entity, terrainData) {
    if (!terrainData?.oakoc?.coverAndConcealment) return 0.5;
    // Check if entity is in a strong terrain position
    const ex = entity.bbox ? entity.bbox[0] + entity.bbox[2] / 2 : 0.5;
    const ey = entity.bbox ? entity.bbox[1] + entity.bbox[3] / 2 : 0.5;

    for (const cover of terrainData.oakoc.coverAndConcealment.coverPositions) {
      const dist = Math.sqrt(Math.pow(ex - cover.position[0], 2) + Math.pow(ey - cover.position[1], 2));
      if (dist < 0.08) return 0.8; // In cover = higher threat (harder to neutralize)
    }
    return 0.3;
  }

  _scoreAvenueControl(entity, terrainData) {
    if (!entity.onAvenue || !terrainData?.oakoc?.avenues) return 0.3;
    const avenue = terrainData.oakoc.avenues.find(a => a.id === entity.onAvenue);
    if (avenue?.threatAxis) return 0.9;
    return 0.5;
  }

  _scoreKeyTerrainProximity(entity, terrainData) {
    if (!terrainData?.oakoc?.keyTerrain || !entity.bbox) return 0.3;
    const ex = entity.bbox[0] + entity.bbox[2] / 2;
    const ey = entity.bbox[1] + entity.bbox[3] / 2;

    for (const kt of terrainData.oakoc.keyTerrain) {
      const dist = Math.sqrt(Math.pow(ex - kt.position[0], 2) + Math.pow(ey - kt.position[1], 2));
      if (dist < 0.15) return kt.tacticalValue;
    }
    return 0.2;
  }

  _scoreMissionRelevance(entity) {
    if (!this.missionContext) return 0.5;
    const heading = entity.movement?.heading || '';
    const mission = this.missionContext.missionType;

    if (mission === 'DEFENSE' && heading === 'APPROACHING') return 0.9;
    if (mission === 'OFFENSE' && entity.tacticalClass === 'VEHICLE') return 0.8;
    if (mission === 'STABILITY') return 0.4; // Lower base threat in stability ops
    return 0.5;
  }

  _scoreTimeUrgency(entity) {
    const eta = timeManager.enemyETAs[entity.id];
    if (!eta) return 0.3;
    if (eta.etaSeconds < 30) return 1.0;
    if (eta.etaSeconds < 120) return 0.7;
    return 0.4;
  }

  // --- Mission Impact ---

  _assessMissionImpact(entity, enemyAnalysis, terrainData) {
    if (!this.missionContext) {
      return { pir: null, threatToMission: 'UNKNOWN', commanderActionRequired: false };
    }

    // Check PIR match
    let pirMatch = null;
    for (const pir of (this.missionContext.priorityIntelRequirements || [])) {
      const pirLower = pir.toLowerCase();
      if (pirLower.includes('armor') && entity.tacticalClass === 'VEHICLE') {
        pirMatch = `PIR MET: ${pir}`;
      }
      if (pirLower.includes('movement') && entity.movement?.heading === 'APPROACHING') {
        pirMatch = `PIR MET: ${pir}`;
      }
      if (pirLower.includes('recon') && entity.movement?.speed > 1) {
        pirMatch = `PIR MET: ${pir}`;
      }
    }

    const threatToMission = entity.movement?.heading === 'APPROACHING' && entity.threatLevel > 0.5
      ? 'HIGH - Directly threatens mission objective'
      : entity.threatLevel > 0.3
        ? 'MEDIUM - Potential threat to mission'
        : 'LOW';

    return { pir: pirMatch, threatToMission, commanderActionRequired: pirMatch !== null };
  }

  // --- Terrain Context ---

  _assessTerrainContext(entity, terrainData) {
    if (!terrainData?.oakoc) {
      return {
        theirPosition: 'UNKNOWN', ourAdvantage: 'UNKNOWN',
        terrainFavors: 'UNKNOWN', engineer: null
      };
    }

    const inCover = this._isInCover(entity, terrainData);
    const onAvenue = entity.onAvenue || null;

    // Our advantage
    const bestPos = terrainData.survivability?.bestFightingPositions?.[0];
    const ourAdvantage = bestPos
      ? `${bestPos.coverQuality > 0.7 ? 'HARD_COVER' : 'PARTIAL_COVER'} at recommended position`
      : 'No optimal position identified';

    const terrainFavors = inCover ? 'CONTESTED' :
      (terrainData.survivability?.bestFightingPositions?.length > 0) ? 'DEFENDER' : 'NEUTRAL';

    return {
      theirPosition: `${onAvenue ? 'ON_AVENUE' : 'OFF_AVENUE'}, ${inCover ? 'IN_COVER' : 'EXPOSED'}`,
      ourAdvantage,
      terrainFavors,
      engineer: {
        mobility: terrainData.mobility?.breachSites?.length > 0
          ? `Breach available: ${terrainData.mobility.breachSites[0].obstacle}`
          : 'No breach required',
        countermobility: terrainData.countermobility?.recommendedObstacles?.length > 0
          ? terrainData.countermobility.recommendedObstacles[0].reason
          : 'No obstacle recommendation',
        survivability: bestPos
          ? `Position at [${bestPos.position.map(p => p.toFixed(2)).join(',')}], score: ${bestPos.coverQuality.toFixed(2)}`
          : 'No optimal fighting position identified'
      }
    };
  }

  _isInCover(entity, terrainData) {
    if (!entity.bbox || !terrainData?.oakoc?.coverAndConcealment) return false;
    const ex = entity.bbox[0] + entity.bbox[2] / 2;
    const ey = entity.bbox[1] + entity.bbox[3] / 2;
    for (const cover of terrainData.oakoc.coverAndConcealment.coverPositions) {
      const dist = Math.sqrt(Math.pow(ex - cover.position[0], 2) + Math.pow(ey - cover.position[1], 2));
      if (dist < 0.08) return true;
    }
    return false;
  }

  // --- Strengths & Weaknesses ---

  _buildAnalysis(entity, enemyAnalysis, terrainData, scene, mavenIntel) {
    const strengths = [];
    const weaknesses = [];

    // Doctrine-based
    if (enemyAnalysis?.branchAssessment?.doctrine) {
      const doc = enemyAnalysis.branchAssessment.doctrine;
      if (doc.offensiveStrengths) strengths.push(...doc.offensiveStrengths.slice(0, 2));
      if (doc.vulnerabilities) weaknesses.push(...doc.vulnerabilities.slice(0, 2));
    }

    // Terrain-based
    if (enemyAnalysis?.terrainPosition) {
      if (enemyAnalysis.terrainPosition.hasHighGround) strengths.push('Occupies high ground');
      if (enemyAnalysis.terrainPosition.inCover) strengths.push('In cover/concealment');
      if (!enemyAnalysis.terrainPosition.inCover) weaknesses.push('Exposed position');
    }

    // Movement-based
    if (entity.movement?.heading === 'APPROACHING') {
      strengths.push('Advancing aggressively');
      weaknesses.push('Moving = detectable');
    }

    // Scene-based
    if (scene.type === 'URBAN' && entity.tacticalClass === 'VEHICLE') {
      weaknesses.push('Vehicle in urban terrain - restricted maneuver');
    }
    if (scene.type === 'OPEN_TERRAIN' && entity.tacticalClass === 'PERSONNEL') {
      weaknesses.push('Dismounted in open - vulnerable');
    }

    // Vehicle specifics
    if (entity.tacticalClass === 'VEHICLE') {
      strengths.push('Armored protection', 'Mounted firepower');
      weaknesses.push('Top-attack vulnerable (drone strike)', 'Limited visibility');
    }

    return {
      strengths: [...new Set(strengths)].slice(0, 5),
      weaknesses: [...new Set(weaknesses)].slice(0, 5),
      coverAssessment: enemyAnalysis?.terrainPosition?.inCover
        ? 'In cover - reduced exposure'
        : 'Exposed - full engagement possible'
    };
  }

  // --- COA Generation (Drone-Centric) ---

  _generateCOAs(entity, classification, threatLevel, terrainData, civilData, timeData, enemyAnalysis, scene) {
    const coas = [];
    const fleet = droneManager.getFleetData();
    const urgentETA = timeManager.getMostUrgentETA();
    const targetPos = entity.bbox
      ? [entity.bbox[0] + entity.bbox[2] / 2, entity.bbox[1] + entity.bbox[3] / 2]
      : null;

    // Check ROE for this target
    const roeCheck = civilData ? civilAnalyzer.checkROE(targetPos, 'DIRECT_FIRE') : { clear: true, warnings: [] };

    // OSINT: Weather impact on drone operations
    const droneOpsStatus = this.osintSummary?.droneOps || 'GREEN';
    const weatherRestricted = droneOpsStatus === 'RED';
    const weatherDegraded = droneOpsStatus === 'AMBER';
    const wxDesc = this.osintSummary?.weatherCondition || null;
    const windSpeed = this.osintSummary?.windSpeed || 0;
    const visibility = this.osintSummary?.visibilityKm || null;

    // COA 1: Strike drone engagement (if hostile + strike available)
    if (classification === 'HOSTILE' && threatLevel > 0.5) {
      const strikeDrone = droneManager.getBestDroneForTask('ENGAGE', targetPos);
      if (strikeDrone) {
        const timeFeasible = timeManager.isTimeFeasible('DRONE_STRIKE', urgentETA?.etaSeconds);
        const civilImpact = roeCheck.clear ? 'NONE' : roeCheck.violations[0] || roeCheck.warnings[0] || 'CHECK ROE';

        // OSINT: Weather affects strike confidence
        let strikeConfidence = roeCheck.clear ? 0.92 : 0.4;
        let strikeRisk = roeCheck.clear ? 'LOW' : 'HIGH';
        let weatherWarning = null;
        if (weatherRestricted) {
          strikeConfidence *= 0.3;
          strikeRisk = 'HIGH';
          weatherWarning = `WEATHER RED: ${wxDesc || 'Severe conditions'} - Wind ${windSpeed}mph. Drone strike NOT recommended.`;
        } else if (weatherDegraded) {
          strikeConfidence *= 0.7;
          weatherWarning = `WEATHER AMBER: ${wxDesc || 'Degraded conditions'} - Wind ${windSpeed}mph. Reduced accuracy.`;
        }

        coas.push({
          action: `Task ${strikeDrone.callsign} (Strike) to engage target ${entity.id}`,
          confidence: strikeConfidence,
          risk: strikeRisk,
          droneAsset: {
            id: strikeDrone.id, callsign: strikeDrone.callsign,
            type: strikeDrone.type, battery: strikeDrone.battery,
            payload: strikeDrone.payload?.remaining || 0
          },
          wff: 'FIRES',
          missionAlignment: this._getMissionAlignment('ENGAGE', entity),
          fleetFeasibility: `${strikeDrone.callsign} ready, ${strikeDrone.battery}% battery`,
          timeToExecute: timeFeasible.timeToExecute ? `${timeFeasible.timeToExecute}s` : '~55s',
          terrainReasoning: 'Drone strike from altitude - terrain does not restrict',
          civilImpact,
          weatherImpact: weatherWarning || 'CLEAR - No weather restrictions',
          targetTrackId: entity.id,
          targetPosition: targetPos
        });
      }
    }

    // COA 2: ISR overwatch
    const isrDrone = droneManager.getBestDroneForTask('OVERWATCH', targetPos);
    if (isrDrone) {
      let isrConfidence = 0.88;
      let isrWeatherNote = 'CLEAR - No weather restrictions';
      if (weatherRestricted) {
        isrConfidence *= 0.4;
        isrWeatherNote = `WEATHER RED: ${wxDesc || 'Severe'} - ISR degraded. Consider ground observation.`;
      } else if (weatherDegraded) {
        isrConfidence *= 0.8;
        isrWeatherNote = `WEATHER AMBER: Reduced visibility ${visibility != null ? visibility + 'km' : ''} - ISR sensor degraded.`;
      }

      coas.push({
        action: `Task ${isrDrone.callsign} (ISR) to overwatch target ${entity.id}`,
        confidence: isrConfidence,
        risk: weatherRestricted ? 'MEDIUM' : 'LOW',
        droneAsset: {
          id: isrDrone.id, callsign: isrDrone.callsign,
          type: isrDrone.type, battery: isrDrone.battery
        },
        wff: 'INTELLIGENCE',
        missionAlignment: this._getMissionAlignment('OVERWATCH', entity),
        fleetFeasibility: `${isrDrone.callsign} available, ${isrDrone.battery}% battery`,
        timeToExecute: '~30s',
        terrainReasoning: 'ISR drone can observe from altitude above terrain obstacles',
        civilImpact: 'NONE',
        weatherImpact: isrWeatherNote,
        targetTrackId: entity.id,
        targetPosition: targetPos
      });
    }

    // COA 3: EW jamming (if hostile with comms)
    if (classification === 'HOSTILE' || threatLevel > 0.6) {
      const ewDrone = droneManager.getBestDroneForTask('JAM', targetPos);
      if (ewDrone) {
        let ewConfidence = 0.75;
        let ewWeatherNote = 'CLEAR - No weather restrictions';
        if (weatherRestricted) {
          ewConfidence *= 0.5;
          ewWeatherNote = `WEATHER RED: ${wxDesc || 'Severe'} - EW drone flight restricted.`;
        } else if (weatherDegraded) {
          ewConfidence *= 0.85;
          ewWeatherNote = `WEATHER AMBER: Wind ${windSpeed}mph - EW positioning may be degraded.`;
        }

        coas.push({
          action: `Task ${ewDrone.callsign} (EW) to jam enemy communications`,
          confidence: ewConfidence,
          risk: weatherRestricted ? 'MEDIUM' : 'LOW',
          droneAsset: {
            id: ewDrone.id, callsign: ewDrone.callsign,
            type: ewDrone.type, battery: ewDrone.battery
          },
          wff: 'PROTECTION',
          missionAlignment: 'Degrades enemy C2, prevents coordination',
          fleetFeasibility: `${ewDrone.callsign} available, jamming capable`,
          timeToExecute: '~15s',
          terrainReasoning: 'EW drone should position behind terrain mask for survivability',
          civilImpact: 'CAUTION: May affect civilian communications',
          weatherImpact: ewWeatherNote,
          targetPosition: targetPos
        });
      }
    }

    // COA 4: Operator reposition to cover
    if (terrainData?.survivability?.bestFightingPositions?.length > 0) {
      const bestPos = terrainData.survivability.bestFightingPositions[0];
      // In weather-restricted conditions where drones can't fly, operator maneuver becomes MORE important
      let repositionConfidence = 0.70;
      let repositionWeather = 'CLEAR';
      if (weatherRestricted) {
        repositionConfidence = 0.90; // Elevated: drones can't fly, operator must self-position
        repositionWeather = `WEATHER RED: Drones grounded - operator self-positioning critical`;
      } else if (weatherDegraded) {
        repositionConfidence = 0.80;
        repositionWeather = `WEATHER AMBER: Drone ops degraded - operator positioning more important`;
      }

      coas.push({
        action: `Reposition to fighting position at [${bestPos.position.map(p => p.toFixed(2))}]`,
        confidence: repositionConfidence,
        risk: 'MEDIUM',
        droneAsset: null,
        wff: 'MOVEMENT_AND_MANEUVER',
        missionAlignment: 'Positions operator for observation and engagement',
        fleetFeasibility: 'N/A - operator movement',
        timeToExecute: '~20s',
        terrainReasoning: `Position offers ${bestPos.coverQuality > 0.7 ? 'hard' : 'partial'} cover, covers ${bestPos.avenuesCovered.length} avenue(s)`,
        civilImpact: 'NONE',
        weatherImpact: repositionWeather
      });
    }

    // COA 5: Screen with screening drone
    if (threatLevel > 0.4) {
      const screenDrone = droneManager.getBestDroneForTask('SCREEN', targetPos);
      if (screenDrone) {
        let screenConfidence = 0.65;
        let screenWeatherNote = 'CLEAR - No weather restrictions';
        if (weatherRestricted) {
          screenConfidence *= 0.4;
          screenWeatherNote = `WEATHER RED: Screen drone flight restricted.`;
        } else if (weatherDegraded) {
          screenConfidence *= 0.8;
          screenWeatherNote = `WEATHER AMBER: Screen sensor range may be reduced.`;
        }

        coas.push({
          action: `Task ${screenDrone.callsign} (Screen) to establish early warning`,
          confidence: screenConfidence,
          risk: weatherRestricted ? 'MEDIUM' : 'LOW',
          droneAsset: {
            id: screenDrone.id, callsign: screenDrone.callsign,
            type: screenDrone.type, battery: screenDrone.battery
          },
          wff: 'MOVEMENT_AND_MANEUVER',
          missionAlignment: 'Early warning for approaching threats',
          fleetFeasibility: `${screenDrone.callsign} available, ${screenDrone.battery}% battery`,
          timeToExecute: '~40s',
          terrainReasoning: 'Screen drone operates low to ground, uses terrain for concealment',
          civilImpact: 'NONE',
          weatherImpact: screenWeatherNote,
          targetPosition: targetPos
        });
      }
    }

    // Filter by mission type preferences
    this._rankCOAsByMission(coas);

    // Filter by time feasibility
    if (urgentETA && urgentETA.etaSeconds < 60) {
      // Only keep fast COAs when time is critical
      for (const coa of coas) {
        const execTime = parseInt(coa.timeToExecute) || 60;
        if (execTime > urgentETA.etaSeconds) {
          coa.confidence *= 0.5;
          coa.timeWarning = `WARNING: May not complete before threat arrives (${urgentETA.toOurPosition})`;
        }
      }
    }

    // Sort by confidence
    coas.sort((a, b) => b.confidence - a.confidence);
    return coas.slice(0, 5);
  }

  _getMissionAlignment(actionType, entity) {
    if (!this.missionContext) return 'Mission context not set';

    const mission = this.missionContext.missionType;
    const alignments = {
      DEFENSE: {
        ENGAGE: 'Destroys threat to defensive position',
        OVERWATCH: 'Maintains observation of engagement area',
        JAM: 'Degrades enemy assault coordination',
        SCREEN: 'Early warning of approaching forces'
      },
      OFFENSE: {
        ENGAGE: 'Eliminates obstacle to advance',
        OVERWATCH: 'Develops situation before contact',
        JAM: 'Disrupts enemy defensive coordination',
        SCREEN: 'Secures flank during movement'
      },
      STABILITY: {
        ENGAGE: 'Neutralizes confirmed hostile - PID verified',
        OVERWATCH: 'Continuous monitoring for escalation',
        JAM: 'Prevents hostile coordination',
        SCREEN: 'Monitors area for suspicious activity'
      },
      RECON: {
        ENGAGE: 'Self-defense engagement only in recon',
        OVERWATCH: 'Develops intelligence on target',
        JAM: 'Prevents detection of recon element',
        SCREEN: 'Provides security during reconnaissance'
      }
    };

    return alignments[mission]?.[actionType] || 'Supports mission execution';
  }

  // --- OSINT Context (for threat panel display) ---

  _buildOSINTContext() {
    if (!this.osintSummary) return null;

    const context = {
      weatherCondition: this.osintSummary.weatherCondition || 'NO DATA',
      droneOps: this.osintSummary.droneOps || 'UNKNOWN',
      tacticalImpact: this.osintSummary.tacticalImpact || 'UNKNOWN',
      windSpeed: this.osintSummary.windSpeed,
      visibility: this.osintSummary.visibilityKm,
      aircraftNearby: this.osintSummary.aircraftNearby || 0,
      militaryAircraft: this.osintSummary.militaryAircraft || 0,
      alerts: []
    };

    // Generate OSINT-driven tactical alerts
    if (this.osintSummary.militaryAircraft > 0) {
      context.alerts.push({
        level: 'WARNING',
        source: 'OSINT-AIR',
        message: `${this.osintSummary.militaryAircraft} military aircraft in AO - air threat elevated`
      });
    }
    if (this.osintSummary.emergencyAircraft > 0) {
      context.alerts.push({
        level: 'CAUTION',
        source: 'OSINT-AIR',
        message: `Emergency aircraft active - expect increased activity in area`
      });
    }
    if (this.osintSummary.droneOps === 'RED') {
      context.alerts.push({
        level: 'WARNING',
        source: 'OSINT-WX',
        message: `DRONE OPS RED: ${this.osintSummary.weatherCondition}. All drone COAs restricted.`
      });
    } else if (this.osintSummary.droneOps === 'AMBER') {
      context.alerts.push({
        level: 'CAUTION',
        source: 'OSINT-WX',
        message: `DRONE OPS AMBER: Degraded conditions. Drone effectiveness reduced.`
      });
    }
    if (this.osintSummary.tacticalImpact === 'SEVERE') {
      context.alerts.push({
        level: 'WARNING',
        source: 'OSINT-WX',
        message: `SEVERE weather: Visibility ${context.visibility || '?'}km, Wind ${context.windSpeed || '?'}mph. Limit exposure.`
      });
    }
    if (this.osintSummary.visibilityKm != null && this.osintSummary.visibilityKm < 1) {
      context.alerts.push({
        level: 'WARNING',
        source: 'OSINT-WX',
        message: `VISIBILITY <1km: Switch to thermal/IR sensors. Visual detection severely degraded.`
      });
    }

    return context;
  }

  _rankCOAsByMission(coas) {
    if (!this.missionContext) return;

    const missionPriority = {
      DEFENSE: { FIRES: 1.1, INTELLIGENCE: 1.05, PROTECTION: 1.0, MOVEMENT_AND_MANEUVER: 0.95 },
      OFFENSE: { FIRES: 1.05, MOVEMENT_AND_MANEUVER: 1.1, INTELLIGENCE: 1.0, PROTECTION: 0.95 },
      STABILITY: { INTELLIGENCE: 1.15, PROTECTION: 1.05, FIRES: 0.7, MOVEMENT_AND_MANEUVER: 0.9 },
      RECON: { INTELLIGENCE: 1.2, MOVEMENT_AND_MANEUVER: 1.05, PROTECTION: 1.0, FIRES: 0.5 }
    };

    const priorities = missionPriority[this.missionContext.missionType] || {};
    for (const coa of coas) {
      const multiplier = priorities[coa.wff] || 1.0;
      coa.confidence *= multiplier;
    }
  }

  // --- Civil Warnings ---

  _getCivilWarnings(entity, civilData) {
    if (!civilData) return [];
    const warnings = [];

    // Unknown persons needing PID
    if (civilData.civilianPresence?.classification?.unknown > 0) {
      warnings.push(`${civilData.civilianPresence.classification.unknown} UNKNOWN person(s) - PID required before engagement`);
    }

    // Protected structures
    for (const structure of (civilData.protectedStructures || [])) {
      warnings.push(`${structure.type} no-fire zone: ${structure.label}`);
    }

    // Density warnings
    if (civilData.civilianPresence?.density === 'HIGH') {
      warnings.push('HIGH civilian density - indirect fire PROHIBITED');
    }

    return warnings;
  }

  // --- Intel Correlation (Maven + OSINT Fused) ---

  _correlateIntel(entity, mavenIntel) {
    const parts = [];

    // Maven intel
    if (mavenIntel) {
      if (mavenIntel.sigint) {
        parts.push(`SIGINT: ${mavenIntel.sigint.content_summary || 'Activity detected on monitored frequencies'}`);
      }
      if (mavenIntel.threat) {
        parts.push(`THREAT: Area threat level ${mavenIntel.threat.area_threat_level}`);
      }
      if (mavenIntel.humint) {
        parts.push(`HUMINT (${mavenIntel.humint.source_reliability}${mavenIntel.humint.info_confidence}): ${mavenIntel.humint.narrative || 'Report on file'}`);
      }
    }

    // OSINT correlation
    if (this.osintSummary) {
      // Military aircraft data
      if (this.osintSummary.militaryAircraft > 0) {
        const closest = this.osintSummary.closestAircraft;
        const closestInfo = closest ? ` (nearest: ${closest.callsign} ${closest.distance?.toFixed(1) || '?'}km BRG ${closest.bearing || '?'}°)` : '';
        parts.push(`OSINT-AIR: ${this.osintSummary.militaryAircraft} MIL aircraft tracked${closestInfo}`);
      }
      if (this.osintSummary.emergencyAircraft > 0) {
        parts.push(`OSINT-AIR: ${this.osintSummary.emergencyAircraft} EMERGENCY aircraft - area may be active`);
      }
      // Weather impact
      if (this.osintSummary.tacticalImpact && this.osintSummary.tacticalImpact !== 'MINIMAL') {
        parts.push(`OSINT-WX: Tactical impact ${this.osintSummary.tacticalImpact} (${this.osintSummary.weatherCondition})`);
      }
      // Drone ops status
      if (this.osintSummary.droneOps && this.osintSummary.droneOps !== 'GREEN') {
        parts.push(`OSINT-WX: Drone ops ${this.osintSummary.droneOps} - wind ${this.osintSummary.windSpeed || '?'}mph`);
      }
    }

    return parts.join(' | ') || 'No correlating intelligence';
  }
}

export const threatEngine = new ThreatEngine();
