// TALOS 2.0 - Drone Tasking Engine
// Translates COAs into drone tasks. Aligned to Warfighting Functions.
// The execution arm: operator decides, this engine makes it happen.

import { droneManager } from './drone-manager.js';
import { TASK_DEFINITIONS } from './drone-types.js';

class DroneTaskingEngine {
  constructor() {
    this.taskLog = [];
    this.maxLogEntries = 50;
    this.callbacks = { onTaskIssued: [], onTaskComplete: [], onTaskFailed: [] };
  }

  // Issue a task to a specific drone
  issueTask(droneId, taskType, options = {}) {
    const taskDef = TASK_DEFINITIONS[taskType];
    if (!taskDef) return { success: false, reason: `Unknown task type: ${taskType}` };

    const result = droneManager.assignTask(droneId, taskType, {
      taskLabel: taskDef.label,
      targetTrackId: options.targetTrackId || null,
      targetPosition: options.targetPosition || null
    });

    if (result.success) {
      const entry = {
        timestamp: Date.now(),
        droneId,
        callsign: result.drone,
        taskType,
        wff: taskDef.wff,
        label: taskDef.label,
        targetTrackId: options.targetTrackId,
        targetPosition: options.targetPosition,
        status: 'ISSUED'
      };
      this.taskLog.unshift(entry);
      if (this.taskLog.length > this.maxLogEntries) this.taskLog.pop();
      this._emit('onTaskIssued', entry);
    }

    return result;
  }

  // Auto-assign best drone for a task
  autoAssign(taskType, options = {}) {
    const drone = droneManager.getBestDroneForTask(taskType, options.targetPosition);
    if (!drone) {
      return { success: false, reason: `No available drone for ${taskType}` };
    }
    return this.issueTask(drone.id, taskType, options);
  }

  // Execute a COA from the threat engine
  executeCOA(coa) {
    if (!coa.droneAsset) return { success: false, reason: 'COA has no drone asset' };

    // Map COA action to task type
    let taskType = 'OVERWATCH';
    const action = coa.action.toLowerCase();
    if (action.includes('engage')) taskType = 'ENGAGE';
    else if (action.includes('recon')) taskType = 'RECON';
    else if (action.includes('overwatch')) taskType = 'OVERWATCH';
    else if (action.includes('jam')) taskType = 'JAM';
    else if (action.includes('counter')) taskType = 'COUNTER_UAS';
    else if (action.includes('resupply')) taskType = 'RESUPPLY';
    else if (action.includes('screen')) taskType = 'SCREEN';
    else if (action.includes('designate')) taskType = 'DESIGNATE';
    else if (action.includes('relay')) taskType = 'RELAY';
    else if (action.includes('track')) taskType = 'TRACK';

    return this.issueTask(coa.droneAsset.id, taskType, {
      targetTrackId: coa.targetTrackId,
      targetPosition: coa.targetPosition
    });
  }

  // Generate recommended drone taskings based on current situation
  generateRecommendations(threats, terrainData, missionContext) {
    const recommendations = [];
    const fleet = droneManager.getFleetData();
    const availableDrones = fleet.fleet.filter(d =>
      d.status === 'READY' || d.status === 'ACTIVE'
    );

    if (availableDrones.length === 0) return recommendations;

    // If threats exist, recommend ISR overwatch
    if (threats && threats.length > 0) {
      const highThreats = threats.filter(t => t.threatLevel > 0.6);
      if (highThreats.length > 0) {
        const isrDrone = availableDrones.find(d => d.type === 'ISR');
        if (isrDrone) {
          recommendations.push({
            priority: 'HIGH',
            taskType: 'OVERWATCH',
            droneId: isrDrone.id,
            callsign: isrDrone.callsign,
            reason: `${highThreats.length} high-priority threat(s) detected`,
            targetPosition: highThreats[0].bbox ? [
              highThreats[0].bbox[0] + highThreats[0].bbox[2] / 2,
              highThreats[0].bbox[1] + highThreats[0].bbox[3] / 2
            ] : null
          });
        }

        // Recommend strike if threat is hostile
        const hostileThreats = highThreats.filter(t => t.classification === 'HOSTILE');
        if (hostileThreats.length > 0) {
          const strikeDrone = availableDrones.find(d => d.type === 'STRIKE');
          if (strikeDrone) {
            recommendations.push({
              priority: 'HIGH',
              taskType: 'ENGAGE',
              droneId: strikeDrone.id,
              callsign: strikeDrone.callsign,
              reason: `Hostile target: ${hostileThreats[0].category || 'UNKNOWN'}`,
              targetTrackId: hostileThreats[0].id
            });
          }
        }
      }
    }

    // If terrain has avenues, recommend screening
    if (terrainData && terrainData.oakoc && terrainData.oakoc.avenues) {
      const threatAxes = terrainData.oakoc.avenues.filter(a => a.threatAxis);
      if (threatAxes.length > 0) {
        const screenDrone = availableDrones.find(d => d.type === 'SCREEN');
        if (screenDrone) {
          recommendations.push({
            priority: 'MEDIUM',
            taskType: 'SCREEN',
            droneId: screenDrone.id,
            callsign: screenDrone.callsign,
            reason: `${threatAxes.length} threat avenue(s) unscreened`
          });
        }
      }
    }

    // If mission is defense, recommend early warning
    if (missionContext && missionContext.missionType === 'DEFENSE') {
      const ewDrone = availableDrones.find(d => d.type === 'EW');
      if (ewDrone && !fleet.fleet.some(d => d.type === 'EW' && d.status === 'TASKED')) {
        recommendations.push({
          priority: 'MEDIUM',
          taskType: 'SIGINT',
          droneId: ewDrone.id,
          callsign: ewDrone.callsign,
          reason: 'Defense posture - SIGINT collection recommended'
        });
      }
    }

    return recommendations.sort((a, b) => {
      const p = { HIGH: 3, MEDIUM: 2, LOW: 1 };
      return (p[b.priority] || 0) - (p[a.priority] || 0);
    });
  }

  // Get task log
  getTaskLog() {
    return [...this.taskLog];
  }

  on(event, callback) {
    if (this.callbacks[event]) this.callbacks[event].push(callback);
  }

  _emit(event, data) {
    if (this.callbacks[event]) {
      this.callbacks[event].forEach(cb => cb(data));
    }
  }
}

export const droneTasking = new DroneTaskingEngine();
