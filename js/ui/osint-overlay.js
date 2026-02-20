// =============================================================================
// TALOS 2.0 - OSINT Overlay Renderer
// Renders real-time OSINT data on both canvas (directional indicators)
// and DOM (weather widget, aircraft feed, OSINT panel)
// =============================================================================

const AIRCRAFT_COLOR = '#00ffcc';
const MILITARY_COLOR = '#ff3333';
const EMERGENCY_COLOR = '#ffaa00';

export class OSINTOverlay {
  constructor() {
    this.osintData = null;
    this.tacticalSummary = null;
    this._visible = true;
    this._operatorHeading = 0;
    this._panelVisible = false;
    this._lastDomUpdate = 0;
    this._domThrottleMs = 2000; // Only update DOM every 2 seconds
    // Cached DOM refs
    this._elWeather = null;
    this._elAircraft = null;
    this._elOsintDot = null;
    this._elFeedCount = null;
    this._elPanelContent = null;
    this._elPanel = null;
  }

  update(osintData, tacticalSummary) {
    this.osintData = osintData;
    this.tacticalSummary = tacticalSummary;
    // Throttle DOM updates to prevent layout thrashing
    const now = Date.now();
    if (now - this._lastDomUpdate > this._domThrottleMs) {
      this._lastDomUpdate = now;
      this._updateDOM();
    }
  }

  setOperatorHeading(heading) {
    this._operatorHeading = heading || 0;
  }

  toggle() {
    this._visible = !this._visible;
    return this._visible;
  }

  _getPanel() {
    if (!this._elPanel) this._elPanel = document.getElementById('osint-panel');
    return this._elPanel;
  }

  togglePanel() {
    this._panelVisible = !this._panelVisible;
    const panel = this._getPanel();
    if (panel) {
      panel.classList.toggle('visible', this._panelVisible);
    }
    if (this._panelVisible) {
      this._updatePanelContent();
    }
    return this._panelVisible;
  }

  hidePanel() {
    this._panelVisible = false;
    const panel = this._getPanel();
    if (panel) panel.classList.remove('visible');
  }

  isPanelVisible() {
    return this._panelVisible;
  }

  // ===========================================================================
  // Canvas Rendering - Aircraft directional arrows on screen edges
  // ===========================================================================

  render(ctx, w, h, timestamp) {
    if (!this._visible || !this.osintData) return;
    ctx.save();
    this._renderAircraftArrows(ctx, w, h, timestamp);
    ctx.restore();
  }

  _renderAircraftArrows(ctx, w, h, timestamp) {
    const aircraft = this.osintData.aircraft;
    if (!aircraft || aircraft.status !== 'ACTIVE' || !aircraft.entries.length) return;

    const maxShow = 10;
    const entries = aircraft.entries.slice(0, maxShow);

    for (const ac of entries) {
      if (ac.bearing == null || ac.distance == null) continue;

      const relativeBearing = ((ac.bearing - this._operatorHeading) + 360) % 360;
      const pos = this._bearingToEdge(relativeBearing, w, h);

      const isMilitary = ac.category === 'MILITARY' || ac.category === 'POSSIBLE_MIL';
      const isEmergency = ac.category === 'EMERGENCY' || ac.category === 'HIJACK' || ac.category === 'COMMS_FAILURE';
      const color = isEmergency ? EMERGENCY_COLOR : isMilitary ? MILITARY_COLOR : AIRCRAFT_COLOR;

      ctx.save();

      // Pulsing for military/emergency
      if (isMilitary || isEmergency) {
        ctx.globalAlpha = 0.7 + 0.3 * Math.sin(timestamp / 300);
      } else {
        ctx.globalAlpha = 0.65;
      }

      // Arrow pointing inward
      this._drawArrow(ctx, pos.x, pos.y, pos.angle, color, isMilitary || isEmergency ? 10 : 8);

      // Dark background behind label
      ctx.globalAlpha = 0.85;
      const callsign = ac.callsign !== 'NO CALL' ? ac.callsign : ac.icao24?.toUpperCase();
      const distStr = ac.distance < 1 ? `${(ac.distance * 1000).toFixed(0)}m` : `${ac.distance.toFixed(1)}km`;
      const altStr = ac.altitudeFt != null ? `${(ac.altitudeFt / 1000).toFixed(1)}K` : '---';
      const label1 = callsign || '???';
      const label2 = `${altStr}ft ${distStr}`;

      ctx.font = "bold 9px 'Courier New', monospace";
      const tw1 = ctx.measureText(label1).width;
      ctx.font = "8px 'Courier New', monospace";
      const tw2 = ctx.measureText(label2).width;
      const maxTw = Math.max(tw1, tw2);

      const lx = pos.labelX;
      const ly = pos.labelY;
      const isRight = pos.textAlign === 'right';
      const bgX = isRight ? lx - maxTw - 4 : lx - 2;

      // Background
      ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
      ctx.fillRect(bgX, ly - 10, maxTw + 6, 24);

      // Left border accent
      ctx.fillStyle = color;
      ctx.fillRect(bgX, ly - 10, 2, 24);

      // Text
      ctx.textAlign = pos.textAlign;
      ctx.font = "bold 9px 'Courier New', monospace";
      ctx.fillStyle = color;
      ctx.fillText(label1, lx, ly);

      ctx.font = "8px 'Courier New', monospace";
      ctx.fillStyle = '#aaaaaa';
      ctx.fillText(label2, lx, ly + 11);

      // MIL badge
      if (isMilitary || isEmergency) {
        const badge = isMilitary ? 'MIL' : 'EMRG';
        ctx.font = "bold 7px 'Courier New', monospace";
        const bw = ctx.measureText(badge).width + 4;
        const bx = isRight ? lx - bw : lx;
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.9;
        ctx.fillRect(bx, ly + 14, bw, 10);
        ctx.fillStyle = '#000000';
        ctx.textAlign = 'left';
        ctx.fillText(badge, bx + 2, ly + 22);
      }

      ctx.restore();
    }
  }

  _bearingToEdge(bearing, w, h) {
    const rad = (bearing - 90) * Math.PI / 180;
    const cosA = Math.cos(rad);
    const sinA = Math.sin(rad);

    const margin = 24;
    const left = margin;
    const right = w - margin;
    const top = margin + 76; // Below top bar + compass
    const bottom = h - margin - 60; // Above bottom bar

    const halfW = (right - left) / 2;
    const halfH = (bottom - top) / 2;
    const ecx = (left + right) / 2;
    const ecy = (top + bottom) / 2;

    const scaleX = cosA !== 0 ? Math.abs(halfW / cosA) : Infinity;
    const scaleY = sinA !== 0 ? Math.abs(halfH / sinA) : Infinity;
    const scale = Math.min(scaleX, scaleY);

    let x = Math.max(left, Math.min(right, ecx + cosA * scale));
    let y = Math.max(top, Math.min(bottom, ecy + sinA * scale));

    let textAlign = 'left';
    let labelX = x + 14;
    let labelY = y - 2;

    if (x >= right - 5) {
      textAlign = 'right';
      labelX = x - 14;
    } else if (y <= top + 5) {
      labelY = y + 18;
    } else if (y >= bottom - 5) {
      labelY = y - 16;
    }

    return { x, y, angle: rad, textAlign, labelX, labelY };
  }

  _drawArrow(ctx, x, y, angle, color, size) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle + Math.PI);

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, -size);
    ctx.lineTo(-size * 0.6, size * 0.6);
    ctx.lineTo(0, size * 0.2);
    ctx.lineTo(size * 0.6, size * 0.6);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  // ===========================================================================
  // DOM Updates - Weather widget, aircraft feed, OSINT status
  // ===========================================================================

  _updateDOM() {
    this._updateWeatherWidget();
    this._updateAircraftWidget();
    this._updateOSINTStatus();
    this._updateTacticalAlerts();
    if (this._panelVisible) {
      this._updatePanelContent();
    }
  }

  _updateWeatherWidget() {
    if (!this._elWeather) this._elWeather = document.getElementById('osint-weather');
    const el = this._elWeather;
    if (!el || !this.osintData?.weather?.current) {
      if (el) el.style.display = 'none';
      return;
    }

    el.style.display = 'block';
    const wx = this.osintData.weather.current;

    const impactColor = wx.tacticalImpact === 'SEVERE' ? 'var(--hud-hostile)' :
                        wx.tacticalImpact === 'SIGNIFICANT' ? 'var(--hud-caution)' :
                        wx.tacticalImpact === 'MODERATE' ? 'var(--hud-caution)' : 'var(--hud-primary)';

    const droneColor = wx.droneOps === 'RED' ? 'var(--hud-hostile)' :
                       wx.droneOps === 'AMBER' ? 'var(--hud-caution)' : 'var(--hud-primary)';

    const windDir = wx.windDirection != null ? this._degreesToCardinal(wx.windDirection) : '--';

    el.innerHTML = `
      <div class="osint-wx-header">WX <span style="color:${impactColor}">${wx.tacticalImpact}</span></div>
      <div class="osint-wx-condition">${wx.weatherDesc}</div>
      <div>${wx.temperature != null ? Math.round(wx.temperature) + '°F' : '--'} | ${wx.humidity || '--'}% | ${wx.cloudCover || '--'}%</div>
      <div>WND ${windDir} ${wx.windSpeed || '--'}mph G${wx.windGusts || '--'}</div>
      <div>VIS ${wx.visibilityMi || '--'}mi | ${wx.ceiling || '--'}</div>
      <div>DRONE OPS: <span style="color:${droneColor};font-weight:bold">${wx.droneOps}</span></div>
    `;
  }

  _updateAircraftWidget() {
    if (!this._elAircraft) this._elAircraft = document.getElementById('osint-aircraft');
    const el = this._elAircraft;
    if (!el) return;

    const ac = this.osintData?.aircraft;
    if (!ac || ac.status !== 'ACTIVE' || ac.count === 0) {
      el.style.display = 'none';
      return;
    }

    el.style.display = 'block';
    const milCount = ac.entries.filter(a => a.category === 'MILITARY').length;
    const top3 = ac.entries.slice(0, 3);

    let html = `<div class="osint-ac-header">AIR ${ac.count} TRK${milCount > 0 ? ` <span style="color:var(--hud-hostile)">${milCount} MIL</span>` : ''}</div>`;

    for (const a of top3) {
      const isMil = a.category === 'MILITARY' || a.category === 'POSSIBLE_MIL';
      const isEmrg = a.category === 'EMERGENCY' || a.category === 'HIJACK';
      const color = isEmrg ? 'var(--hud-caution)' : isMil ? 'var(--hud-hostile)' : 'var(--hud-primary)';
      const dist = a.distance < 1 ? `${(a.distance * 1000).toFixed(0)}m` : `${a.distance.toFixed(1)}km`;
      const alt = a.altitudeFt != null ? `${(a.altitudeFt / 1000).toFixed(1)}K` : '---';
      const cs = a.callsign !== 'NO CALL' ? a.callsign : a.icao24?.toUpperCase() || '???';
      const brg = a.bearing != null ? `${String(a.bearing).padStart(3, '0')}°` : '---';

      html += `<div class="osint-ac-entry" style="border-left-color:${color}">
        <span style="color:${color}">${cs}</span>
        <span>${brg} ${dist} ${alt}ft ${a.trend === 'CLIMBING' ? '\u2191' : a.trend === 'DESCENDING' ? '\u2193' : '\u2192'}</span>
      </div>`;
    }

    if (ac.count > 3) {
      html += `<div style="opacity:0.5;font-size:8px;margin-top:2px">+${ac.count - 3} MORE</div>`;
    }

    el.innerHTML = html;
  }

  _updateOSINTStatus() {
    if (!this._elOsintDot) this._elOsintDot = document.getElementById('osint-dot');
    if (!this._elFeedCount) this._elFeedCount = document.getElementById('osint-feed-count');
    const dot = this._elOsintDot;
    const statusEl = this._elFeedCount;
    if (!this.tacticalSummary) return;

    const ts = this.tacticalSummary;
    if (dot) {
      dot.className = ts.feedsActive > 0 ? 'status-dot green' : 'status-dot amber';
    }
    if (statusEl) {
      statusEl.textContent = `${ts.feedsActive}/${ts.feedsTotal}`;
    }
  }

  // ===========================================================================
  // Tactical Alerts - OSINT-driven decision support on HUD
  // ===========================================================================

  _updateTacticalAlerts() {
    if (!this._elAlertBar) {
      this._elAlertBar = document.getElementById('osint-alert-bar');
    }
    const el = this._elAlertBar;
    if (!el) return;

    if (!this.tacticalSummary) {
      el.style.display = 'none';
      return;
    }

    const alerts = [];
    const ts = this.tacticalSummary;

    // Military aircraft alert
    if (ts.militaryAircraft > 0) {
      alerts.push({ color: 'var(--hud-hostile)', text: `AIR THREAT: ${ts.militaryAircraft} MIL AIRCRAFT` });
    }
    // Drone ops restriction
    if (ts.droneOps === 'RED') {
      alerts.push({ color: 'var(--hud-hostile)', text: `DRONE OPS RED: ${ts.weatherCondition}` });
    } else if (ts.droneOps === 'AMBER') {
      alerts.push({ color: 'var(--hud-caution)', text: `DRONE OPS DEGRADED: ${ts.weatherCondition}` });
    }
    // Severe weather
    if (ts.tacticalImpact === 'SEVERE') {
      alerts.push({ color: 'var(--hud-hostile)', text: `SEVERE WX: VIS ${ts.visibilityKm || '?'}km WIND ${ts.windSpeed || '?'}mph` });
    }
    // Low visibility
    if (ts.visibilityKm != null && ts.visibilityKm < 1) {
      alerts.push({ color: 'var(--hud-caution)', text: `LOW VIS: SWITCH TO THERMAL` });
    }
    // Emergency aircraft
    if (ts.emergencyAircraft > 0) {
      alerts.push({ color: 'var(--hud-caution)', text: `EMRG AIRCRAFT: AREA ACTIVE` });
    }

    if (alerts.length === 0) {
      el.style.display = 'none';
      return;
    }

    // Show the most important alert (rotate if multiple)
    const idx = Math.floor(Date.now() / 3000) % alerts.length;
    const alert = alerts[idx];
    el.style.display = 'block';
    el.style.color = alert.color;
    el.style.borderColor = alert.color;
    el.textContent = `\u26A0 ${alert.text}`;
  }

  // ===========================================================================
  // Full OSINT Panel (slide-up detail view)
  // ===========================================================================

  _updatePanelContent() {
    if (!this._elPanelContent) this._elPanelContent = document.getElementById('osint-panel-content');
    const content = this._elPanelContent;
    if (!content || !this.osintData) return;

    let html = '';

    // Weather section
    const wx = this.osintData.weather?.current;
    if (wx) {
      const windDir = wx.windDirection != null ? this._degreesToCardinal(wx.windDirection) : '--';
      html += `
        <div class="osint-section">
          <div class="osint-section-title">WEATHER (Open-Meteo)</div>
          <div class="osint-row"><span>Conditions</span><span>${wx.weatherDesc}</span></div>
          <div class="osint-row"><span>Temperature</span><span>${Math.round(wx.temperature || 0)}°F (Feels ${Math.round(wx.feelsLike || 0)}°F)</span></div>
          <div class="osint-row"><span>Wind</span><span>${windDir} ${wx.windSpeed || '--'}mph Gusts ${wx.windGusts || '--'}mph</span></div>
          <div class="osint-row"><span>Visibility</span><span>${wx.visibilityMi || '--'}mi</span></div>
          <div class="osint-row"><span>Cloud Cover</span><span>${wx.cloudCover || '--'}% (${wx.ceiling})</span></div>
          <div class="osint-row"><span>Humidity</span><span>${wx.humidity || '--'}%</span></div>
          <div class="osint-row"><span>Pressure</span><span>${wx.pressureInHg || '--'} inHg</span></div>
          <div class="osint-row"><span>Tactical Impact</span><span style="color:${wx.tacticalImpact === 'SEVERE' ? 'var(--hud-hostile)' : wx.tacticalImpact !== 'MINIMAL' ? 'var(--hud-caution)' : 'var(--hud-primary)'}">${wx.tacticalImpact}</span></div>
          <div class="osint-row"><span>Drone Ops</span><span style="color:${wx.droneOps === 'RED' ? 'var(--hud-hostile)' : wx.droneOps === 'AMBER' ? 'var(--hud-caution)' : 'var(--hud-primary)'}">${wx.droneOps}</span></div>
          <div class="osint-row"><span>Light</span><span>${wx.isDay ? 'DAY' : 'NIGHT'}</span></div>
        </div>
      `;
    }

    // Aircraft section
    const ac = this.osintData.aircraft;
    if (ac && ac.entries.length > 0) {
      html += `
        <div class="osint-section">
          <div class="osint-section-title">AIRCRAFT (OpenSky ADS-B) - ${ac.count} TRACKED</div>
      `;
      for (const a of ac.entries.slice(0, 15)) {
        const isMil = a.category === 'MILITARY' || a.category === 'POSSIBLE_MIL';
        const isEmrg = a.category === 'EMERGENCY' || a.category === 'HIJACK';
        const catColor = isEmrg ? 'var(--hud-caution)' : isMil ? 'var(--hud-hostile)' : 'var(--hud-primary)';
        const dist = a.distance < 1 ? `${(a.distance * 1000).toFixed(0)}m` : `${a.distance.toFixed(1)}km`;
        const brg = a.bearing != null ? `${String(a.bearing).padStart(3, '0')}°` : '---';
        const spd = a.velocity != null ? `${a.velocity}km/h` : '---';
        html += `
          <div class="osint-ac-detail" style="border-left-color:${catColor}">
            <div><span style="color:${catColor};font-weight:bold">${a.callsign}</span> <span style="opacity:0.5">${a.icao24}</span> <span style="opacity:0.6">${a.country}</span></div>
            <div>BRG ${brg} | DST ${dist} | ALT ${a.altitudeFt != null ? a.altitudeFt.toLocaleString() + 'ft' : '---'} ${a.trend}</div>
            <div>SPD ${spd} | HDG ${a.heading != null ? a.heading + '°' : '---'} | SQK ${a.squawk || '----'}</div>
          </div>
        `;
      }
      html += '</div>';
    }

    // Decision Support section - how OSINT enables faster decisions
    if (this.tacticalSummary) {
      const ts = this.tacticalSummary;
      html += `
        <div class="osint-section">
          <div class="osint-section-title">DECISION SUPPORT</div>
          <div class="osint-row"><span>Drone Ops Status</span><span style="color:${ts.droneOps === 'RED' ? 'var(--hud-hostile)' : ts.droneOps === 'AMBER' ? 'var(--hud-caution)' : 'var(--hud-primary)'}; font-weight:bold">${ts.droneOps}</span></div>
          <div class="osint-row"><span>Tactical Weather</span><span style="color:${ts.tacticalImpact === 'SEVERE' ? 'var(--hud-hostile)' : ts.tacticalImpact !== 'MINIMAL' ? 'var(--hud-caution)' : 'var(--hud-primary)'}">${ts.tacticalImpact}</span></div>
          <div class="osint-row"><span>Air Threat</span><span style="color:${ts.militaryAircraft > 0 ? 'var(--hud-hostile)' : 'var(--hud-primary)'}">${ts.militaryAircraft > 0 ? `${ts.militaryAircraft} MIL TRACKED` : 'CLEAR'}</span></div>
          <div style="margin-top:6px;font-size:9px;opacity:0.8;border-top:1px solid rgba(255,255,255,0.1);padding-top:4px;">
            <div style="font-weight:bold;margin-bottom:3px;color:var(--hud-secondary)">HOW OSINT ACCELERATES DECISIONS:</div>
            ${ts.droneOps === 'RED' ? '<div style="color:var(--hud-hostile)">\u2022 WEATHER: All drone COAs auto-downranked. System recommends operator self-positioning.</div>' :
              ts.droneOps === 'AMBER' ? '<div style="color:var(--hud-caution)">\u2022 WEATHER: Drone COA confidence reduced 20-30%. Strike accuracy degraded.</div>' :
              '<div>\u2022 WEATHER: All drone platforms cleared for ops. Full COA suite available.</div>'}
            ${ts.militaryAircraft > 0 ? '<div style="color:var(--hud-hostile)">\u2022 AIR: Military aircraft detected - area threat score elevated 15%. Intel correlation enhanced.</div>' : '<div>\u2022 AIR: No military air activity. Ground threat assessment baseline.</div>'}
            ${ts.tacticalImpact === 'SEVERE' ? '<div style="color:var(--hud-hostile)">\u2022 VISIBILITY: Severe impact on detection range. Recommend thermal/IR sensors.</div>' :
              ts.visibilityKm != null && ts.visibilityKm < 3 ? '<div style="color:var(--hud-caution)">\u2022 VISIBILITY: Reduced. Detection confidence adjusted. ISR drone may need lower altitude.</div>' :
              '<div>\u2022 VISIBILITY: Good conditions. Full sensor effectiveness.</div>'}
            <div>\u2022 Wind ${ts.windSpeed || '--'}mph ${ts.windDirection != null ? this._degreesToCardinal(ts.windDirection) : '--'} factors into drone tasking time estimates and strike accuracy.</div>
          </div>
        </div>
      `;
    }

    // Feed status section
    const statuses = this.tacticalSummary?.feedStatuses;
    if (statuses) {
      html += `
        <div class="osint-section">
          <div class="osint-section-title">FEED STATUS</div>
          ${Object.entries(statuses).map(([name, status]) => {
            const color = status === 'ACTIVE' ? 'var(--hud-primary)' :
                          status === 'ERROR' || status === 'RATE_LIMITED' ? 'var(--hud-hostile)' :
                          status === 'NO_KEY' ? 'var(--hud-caution)' : '#666';
            return `<div class="osint-row"><span>${name.toUpperCase()}</span><span style="color:${color}">${status}</span></div>`;
          }).join('')}
        </div>
      `;
    }

    content.innerHTML = html;
  }

  // ===========================================================================
  // Utility
  // ===========================================================================

  _degreesToCardinal(deg) {
    const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    return dirs[Math.round(deg / 45) % 8];
  }
}

export const osintOverlay = new OSINTOverlay();
