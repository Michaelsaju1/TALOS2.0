// TALOS 2.0 - Threat Detail Panel
// Slides up from bottom when user taps a detected entity
// Shows full METT-TC assessment with drone-centric COAs

export class ThreatPanel {
  constructor() {
    this.panel = null;
    this.selectedTrackId = null;
    this.visible = false;
  }

  init() {
    this.panel = document.getElementById('threat-panel');
  }

  show(threatData) {
    if (!this.panel || !threatData) return;
    this.selectedTrackId = threatData.id;
    this.visible = true;

    // Classification header
    const classEl = document.getElementById('tp-classification');
    if (classEl) {
      classEl.textContent = `${threatData.classification} | ${threatData.category}`;
      classEl.style.color = threatData.classification === 'HOSTILE' ? 'var(--hud-hostile)' :
                            threatData.classification === 'UNKNOWN' ? 'var(--hud-caution)' : 'var(--hud-primary)';
    }

    // Threat score
    const scoreEl = document.getElementById('tp-threat-level');
    if (scoreEl) {
      scoreEl.textContent = threatData.threatLevel.toFixed(2);
      scoreEl.style.color = threatData.threatLevel > 0.7 ? 'var(--hud-hostile)' :
                            threatData.threatLevel > 0.3 ? 'var(--hud-caution)' : 'var(--hud-primary)';
    }

    // Score bar
    const barEl = document.getElementById('tp-score-bar');
    if (barEl) {
      barEl.style.width = (threatData.threatLevel * 100) + '%';
      barEl.className = 'threat-score-fill ' +
        (threatData.threatLevel > 0.7 ? 'hostile' : threatData.threatLevel > 0.3 ? 'caution' : 'low');
    }

    // Mission impact
    const missionEl = document.getElementById('tp-mission-impact');
    if (missionEl && threatData.missionImpact) {
      let html = '';
      if (threatData.missionImpact.pir) {
        html += `<div style="color:var(--hud-hostile);font-weight:bold;">\u26A0 ${threatData.missionImpact.pir}</div>`;
      }
      html += `<div>Mission Threat: ${threatData.missionImpact.threatToMission}</div>`;
      missionEl.innerHTML = html;
    }

    // Enemy analysis
    const enemyEl = document.getElementById('tp-enemy-analysis');
    if (enemyEl && threatData.enemy) {
      const e = threatData.enemy;
      let html = `<div style="border-bottom:1px solid rgba(255,255,255,0.1);padding-bottom:4px;margin-bottom:4px;">
        <strong>COMPOSITION:</strong> ${e.composition}<br>
        <strong>DISPOSITION:</strong> ${e.disposition}<br>
        <strong>STRENGTH:</strong> ${e.strength}
      </div>`;
      html += `<div><strong style="color:var(--hud-caution);">MPCOA:</strong> ${e.mpcoa}</div>`;
      html += `<div><strong style="color:var(--hud-hostile);">MDCOA:</strong> ${e.mdcoa}</div>`;
      if (e.hvts && e.hvts.length > 0) {
        html += '<div style="margin-top:4px;"><strong>HVTs:</strong><ul style="margin:2px 0;padding-left:16px;">';
        for (const hvt of e.hvts) {
          html += `<li>${hvt.type} - ${hvt.reason} (${hvt.priority})</li>`;
        }
        html += '</ul></div>';
      }
      enemyEl.innerHTML = html;
    }

    // Terrain context
    const terrainEl = document.getElementById('tp-terrain-context');
    if (terrainEl && threatData.terrain) {
      const t = threatData.terrain;
      terrainEl.innerHTML = `
        <strong>THEIR POS:</strong> ${t.theirPosition}<br>
        <strong>OUR ADV:</strong> ${t.ourAdvantage}<br>
        <strong>FAVORS:</strong> <span style="color:${t.terrainFavors === 'DEFENDER' ? 'var(--hud-primary)' : 'var(--hud-caution)'}">${t.terrainFavors}</span>
        ${t.engineer ? `<div style="margin-top:4px;font-size:9px;opacity:0.8;">
          <div>\u2692 MOB: ${t.engineer.mobility}</div>
          <div>\u2692 CMOB: ${t.engineer.countermobility}</div>
          <div>\u2692 SURV: ${t.engineer.survivability}</div>
        </div>` : ''}
      `;
    }

    // Distance & movement
    const distEl = document.getElementById('tp-distance');
    if (distEl) {
      const d = threatData.distance;
      const m = threatData.movement;
      const zoneColor = d.zone === 'RED' ? 'var(--hud-hostile)' : d.zone === 'AMBER' ? 'var(--hud-caution)' : 'var(--hud-primary)';
      distEl.innerHTML = `
        <span style="color:${zoneColor};font-weight:bold;">${d.meters}m</span> (${d.confidence > 0.7 ? 'high' : 'moderate'} conf)
        | ${m.speed} ${m.heading} | BRG: ${m.bearing}\u00B0
        ${m.etaToUs !== '--' ? `| ETA: <span style="color:var(--hud-hostile)">${m.etaToUs}</span>` : ''}
        ${m.onAvenue ? `| <span style="color:var(--hud-caution)">[${m.onAvenue}]</span>` : ''}
      `;
    }

    // Strengths
    const strEl = document.getElementById('tp-strengths');
    if (strEl && threatData.analysis) {
      strEl.innerHTML = '<strong style="color:var(--hud-hostile);">STRENGTHS:</strong><br>' +
        threatData.analysis.strengths.map(s => `<span style="color:var(--hud-hostile);">\u2022</span> ${s}`).join('<br>');
    }

    // Weaknesses
    const weakEl = document.getElementById('tp-weaknesses');
    if (weakEl && threatData.analysis) {
      weakEl.innerHTML = '<strong style="color:var(--hud-primary);">WEAKNESSES:</strong><br>' +
        threatData.analysis.weaknesses.map(w => `<span style="color:var(--hud-primary);">\u2022</span> ${w}`).join('<br>');
    }

    // Courses of Action
    const coaEl = document.getElementById('tp-coas');
    if (coaEl && threatData.coursesOfAction) {
      let html = '<strong>COURSES OF ACTION:</strong>';
      for (const coa of threatData.coursesOfAction) {
        const riskColor = coa.risk === 'LOW' ? 'var(--hud-primary)' : coa.risk === 'MEDIUM' ? 'var(--hud-caution)' : 'var(--hud-hostile)';
        html += `<div class="coa-item">
          <div>${coa.action} <span class="confidence" style="color:var(--hud-primary);">${(coa.confidence * 100).toFixed(0)}%</span></div>
          <div style="font-size:9px;opacity:0.8;margin-top:3px;">
            <span style="color:${riskColor};">RISK: ${coa.risk}</span>
            ${coa.droneAsset ? ` | ${coa.droneAsset.callsign} (${coa.droneAsset.type}) ${coa.droneAsset.battery}%` : ''}
            | WfF: ${coa.wff}
          </div>
          <div style="font-size:9px;opacity:0.7;">${coa.missionAlignment}</div>
          <div style="font-size:9px;opacity:0.7;">TIME: ${coa.timeToExecute} | TERRAIN: ${coa.terrainReasoning}</div>
          ${coa.civilImpact && coa.civilImpact !== 'NONE' ? `<div style="color:var(--hud-caution);font-size:9px;">\u26A0 CIV: ${coa.civilImpact}</div>` : ''}
          ${coa.timeWarning ? `<div style="color:var(--hud-hostile);font-size:9px;">${coa.timeWarning}</div>` : ''}
        </div>`;
      }
      coaEl.innerHTML = html;
    }

    // Civil warnings
    const civEl = document.getElementById('tp-civil-warnings');
    if (civEl && threatData.civilWarnings && threatData.civilWarnings.length > 0) {
      civEl.innerHTML = threatData.civilWarnings
        .map(w => `<div class="civ-warning">\u26A0 ${w}</div>`)
        .join('');
    } else if (civEl) {
      civEl.innerHTML = '';
    }

    // Intel correlation
    const intelEl = document.getElementById('tp-intel');
    if (intelEl) {
      intelEl.textContent = threatData.intelCorrelation || '';
    }

    this.panel.classList.add('visible');
  }

  hide() {
    if (this.panel) {
      this.panel.classList.remove('visible');
    }
    this.visible = false;
    this.selectedTrackId = null;
  }

  isVisible() { return this.visible; }
  getSelectedTrackId() { return this.selectedTrackId; }
}

export const threatPanel = new ThreatPanel();
