// =============================================================================
// TALOS 2.0 - OSINT Overlay Renderer
// Renders real-time OSINT data: aircraft tracks, weather panel, camera positions
// =============================================================================

const OSINT_CYAN = '#00ccff';
const AIRCRAFT_COLOR = '#00ffcc';
const MILITARY_COLOR = '#ff3333';
const EMERGENCY_COLOR = '#ffaa00';
const CAMERA_COLOR = '#ff6600';
const WEATHER_GREEN = '#00ff66';
const WEATHER_AMBER = '#ffaa00';
const WEATHER_RED = '#ff3333';

export class OSINTOverlay {
  constructor() {
    this.osintData = null;
    this.tacticalSummary = null;
    this._visible = true;
    this._showAircraft = true;
    this._showCameras = true;
    this._showWeather = true;
    this._operatorHeading = 0;
  }

  update(osintData, tacticalSummary) {
    this.osintData = osintData;
    this.tacticalSummary = tacticalSummary;
  }

  setOperatorHeading(heading) {
    this._operatorHeading = heading || 0;
  }

  toggle() {
    this._visible = !this._visible;
    return this._visible;
  }

  isVisible() {
    return this._visible;
  }

  render(ctx, w, h, timestamp) {
    if (!this._visible || !this.osintData) return;
    ctx.save();

    if (this._showAircraft) {
      this._renderAircraftTracks(ctx, w, h, timestamp);
    }
    if (this._showCameras) {
      this._renderCameraIndicators(ctx, w, h, timestamp);
    }
    if (this._showWeather) {
      this._renderWeatherPanel(ctx, w, h);
    }

    this._renderOSINTStatusBadge(ctx, w, h);

    ctx.restore();
  }

  // ---------------------------------------------------------------------------
  // Aircraft Tracks - Edge-of-screen bearing indicators
  // ---------------------------------------------------------------------------
  _renderAircraftTracks(ctx, w, h, timestamp) {
    const aircraft = this.osintData.aircraft;
    if (!aircraft || aircraft.status !== 'ACTIVE' || !aircraft.entries.length) return;

    // Show up to 8 nearest aircraft as edge indicators
    const maxShow = 8;
    const entries = aircraft.entries.slice(0, maxShow);

    for (let i = 0; i < entries.length; i++) {
      const ac = entries[i];
      if (ac.bearing === null || ac.distance === null) continue;

      // Calculate screen-edge position based on bearing relative to operator heading
      const relativeBearing = ((ac.bearing - this._operatorHeading) + 360) % 360;
      const pos = this._bearingToEdge(relativeBearing, w, h, 40);

      const isMilitary = ac.category === 'MILITARY' || ac.category === 'POSSIBLE_MIL';
      const isEmergency = ac.category === 'EMERGENCY' || ac.category === 'HIJACK' || ac.category === 'COMMS_FAILURE';
      const color = isEmergency ? EMERGENCY_COLOR : isMilitary ? MILITARY_COLOR : AIRCRAFT_COLOR;

      ctx.save();

      // Pulsing for military/emergency
      if (isMilitary || isEmergency) {
        ctx.globalAlpha = 0.6 + 0.3 * Math.sin(timestamp / 300);
      } else {
        ctx.globalAlpha = 0.5;
      }

      // Aircraft direction arrow
      this._drawAircraftArrow(ctx, pos.x, pos.y, pos.angle, color);

      // Info label
      ctx.globalAlpha = 0.75;
      ctx.font = "8px 'Courier New', monospace";
      ctx.fillStyle = color;
      ctx.textAlign = pos.textAlign;

      const callsign = ac.callsign !== 'UNKNOWN' ? ac.callsign : ac.icao24;
      const altStr = ac.altitudeFt ? `${(ac.altitudeFt / 1000).toFixed(1)}K` : '---';
      const distStr = ac.distance < 1 ? `${(ac.distance * 1000).toFixed(0)}m` : `${ac.distance.toFixed(1)}km`;

      const labelX = pos.labelX;
      const labelY = pos.labelY;

      ctx.fillText(callsign, labelX, labelY);
      ctx.fillText(`${altStr}ft ${distStr}`, labelX, labelY + 10);

      // Category badge for military/emergency
      if (isMilitary || isEmergency) {
        const badge = isMilitary ? 'MIL' : ac.category;
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        const badgeW = ctx.measureText(badge).width + 6;
        ctx.fillRect(labelX - (pos.textAlign === 'right' ? badgeW : 0), labelY + 12, badgeW, 11);
        ctx.fillStyle = color;
        ctx.font = "bold 7px 'Courier New', monospace";
        ctx.fillText(badge, labelX, labelY + 21);
      }

      ctx.restore();
    }

    // Aircraft count indicator in top area
    if (entries.length > 0) {
      ctx.save();
      ctx.globalAlpha = 0.6;
      ctx.font = "8px 'Courier New', monospace";
      ctx.fillStyle = AIRCRAFT_COLOR;
      ctx.textAlign = 'left';
      const milCount = entries.filter(a => a.category === 'MILITARY' || a.category === 'POSSIBLE_MIL').length;
      const label = milCount > 0
        ? `AIR: ${entries.length} TRK (${milCount} MIL)`
        : `AIR: ${entries.length} TRK`;
      ctx.fillText(label, 20, h - 46);
      ctx.restore();
    }
  }

  _bearingToEdge(bearing, w, h, margin) {
    // Convert bearing (0=ahead/top, 90=right, 180=behind/bottom, 270=left)
    // to a position on the screen edge
    const rad = (bearing - 90) * Math.PI / 180;
    const cx = w / 2;
    const cy = h / 2;

    // Project to edge
    const cosA = Math.cos(rad);
    const sinA = Math.sin(rad);

    // Find intersection with screen edges (inset by margin)
    const left = margin;
    const right = w - margin;
    const top = margin + 60; // Below top bar
    const bottom = h - margin - 50; // Above bottom bar

    let x, y;
    // Check which edge we hit first
    const halfW = (right - left) / 2;
    const halfH = (bottom - top) / 2;
    const ecx = (left + right) / 2;
    const ecy = (top + bottom) / 2;

    const scaleX = cosA !== 0 ? Math.abs(halfW / cosA) : Infinity;
    const scaleY = sinA !== 0 ? Math.abs(halfH / sinA) : Infinity;
    const scale = Math.min(scaleX, scaleY);

    x = ecx + cosA * scale;
    y = ecy + sinA * scale;

    // Clamp
    x = Math.max(left, Math.min(right, x));
    y = Math.max(top, Math.min(bottom, y));

    // Determine text alignment based on which side
    let textAlign = 'center';
    let labelX = x;
    let labelY = y;

    if (x <= left + 5) {
      textAlign = 'left';
      labelX = x + 14;
      labelY = y - 4;
    } else if (x >= right - 5) {
      textAlign = 'right';
      labelX = x - 14;
      labelY = y - 4;
    } else if (y <= top + 5) {
      labelY = y + 16;
    } else {
      labelY = y - 14;
    }

    return { x, y, angle: rad, textAlign, labelX, labelY };
  }

  _drawAircraftArrow(ctx, x, y, angle, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle + Math.PI); // Point inward toward center

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(-4, 6);
    ctx.lineTo(0, 3);
    ctx.lineTo(4, 6);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  // ---------------------------------------------------------------------------
  // Camera Position Indicators
  // ---------------------------------------------------------------------------
  _renderCameraIndicators(ctx, w, h, timestamp) {
    const cameras = this.osintData.cameras;
    if (!cameras || cameras.status !== 'ACTIVE' || !cameras.entries.length) return;

    // Show up to 6 nearest cameras
    const maxShow = 6;
    const entries = cameras.entries.slice(0, maxShow);

    for (const cam of entries) {
      if (cam.bearing === undefined) continue;

      const relativeBearing = ((cam.bearing - this._operatorHeading) + 360) % 360;

      // Place cameras as small icons inside the screen (not edge - they're closer)
      const distScale = Math.min(1, cam.distance / 2); // Normalize distance (max 2km)
      const maxR = Math.min(w, h) * 0.35;
      const r = 60 + distScale * maxR;

      const rad = (relativeBearing - 90) * Math.PI / 180;
      const cx = w / 2 + Math.cos(rad) * r;
      const cy = h / 2 + Math.sin(rad) * r;

      // Clamp to viewable area
      const px = Math.max(30, Math.min(w - 30, cx));
      const py = Math.max(80, Math.min(h - 60, cy));

      ctx.save();
      ctx.globalAlpha = 0.35;

      // Camera icon (small eye/lens)
      ctx.strokeStyle = CAMERA_COLOR;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(px, py, 5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(px, py, 2, 0, Math.PI * 2);
      ctx.fillStyle = CAMERA_COLOR;
      ctx.fill();

      // Label
      ctx.font = "7px 'Courier New', monospace";
      ctx.textAlign = 'center';
      ctx.fillStyle = CAMERA_COLOR;
      ctx.globalAlpha = 0.3;
      ctx.fillText(`${(cam.distance * 1000).toFixed(0)}m`, px, py + 12);

      ctx.restore();
    }
  }

  // ---------------------------------------------------------------------------
  // Weather Panel - Compact tactical weather display
  // ---------------------------------------------------------------------------
  _renderWeatherPanel(ctx, w, h) {
    const weather = this.osintData.weather;
    if (!weather || weather.status !== 'ACTIVE' || !weather.current) return;

    const wx = weather.current;
    const panelX = 16;
    const panelY = h - 160;
    const panelW = 110;
    const panelH = 85;

    ctx.save();

    // Panel background
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(panelX, panelY, panelW, panelH);

    // Border
    ctx.strokeStyle = 'rgba(0, 204, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(panelX, panelY, panelW, panelH);

    ctx.globalAlpha = 0.85;
    const tx = panelX + 6;
    let ty = panelY + 12;

    // Header
    ctx.font = "bold 8px 'Courier New', monospace";
    ctx.fillStyle = OSINT_CYAN;
    ctx.textAlign = 'left';
    ctx.fillText('WX', tx, ty);

    // Tactical impact color
    const impactColor = wx.tacticalImpact === 'SEVERE' ? WEATHER_RED :
                        wx.tacticalImpact === 'SIGNIFICANT' ? WEATHER_AMBER :
                        wx.tacticalImpact === 'MODERATE' ? WEATHER_AMBER : WEATHER_GREEN;
    ctx.fillStyle = impactColor;
    ctx.textAlign = 'right';
    ctx.fillText(wx.tacticalImpact, panelX + panelW - 6, ty);

    // Weather data
    ctx.textAlign = 'left';
    ctx.font = "8px 'Courier New', monospace";
    ty += 13;

    ctx.fillStyle = '#cccccc';
    ctx.fillText(wx.weatherDesc || '---', tx, ty);
    ty += 11;

    ctx.fillStyle = OSINT_CYAN;
    ctx.fillText(`${wx.temperature !== null ? wx.temperature + '\u00B0F' : '---'}  ${wx.humidity || '--'}%`, tx, ty);
    ty += 11;

    // Wind
    const windDir = wx.windDirection !== null ? this._degreesToCardinal(wx.windDirection) : '--';
    ctx.fillText(`WND ${windDir} ${wx.windSpeed || '--'}mph`, tx, ty);
    ty += 11;

    // Visibility
    ctx.fillText(`VIS ${wx.visibilityKm || '--'}km`, tx, ty);
    ty += 11;

    // Drone ops status
    const droneOpsColor = wx.droneOps === 'RED' ? WEATHER_RED :
                          wx.droneOps === 'AMBER' ? WEATHER_AMBER : WEATHER_GREEN;
    ctx.fillStyle = droneOpsColor;
    ctx.fillText(`DRONE: ${wx.droneOps}`, tx, ty);

    ctx.restore();
  }

  // ---------------------------------------------------------------------------
  // OSINT Status Badge
  // ---------------------------------------------------------------------------
  _renderOSINTStatusBadge(ctx, w, h) {
    if (!this.tacticalSummary) return;

    const ts = this.tacticalSummary;
    const badgeX = 20;
    const badgeY = h - 32;

    ctx.save();
    ctx.globalAlpha = 0.6;
    ctx.font = "8px 'Courier New', monospace";
    ctx.fillStyle = OSINT_CYAN;
    ctx.textAlign = 'left';

    ctx.fillText(`OSINT ${ts.feedsActive}/${ts.feedsTotal} | CAM ${ts.nearbyCameras}`, badgeX, badgeY);

    ctx.restore();
  }

  // ---------------------------------------------------------------------------
  // Utility
  // ---------------------------------------------------------------------------
  _degreesToCardinal(deg) {
    const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    return dirs[Math.round(deg / 45) % 8];
  }
}

export const osintOverlay = new OSINTOverlay();
