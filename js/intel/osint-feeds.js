// =============================================================================
// TALOS 2.0 - Open Source Intelligence (OSINT) Feed Aggregator
// Pulls REAL data from free public APIs based on operator GPS position.
// Runs alongside the simulated Maven Smart System - does NOT replace it.
// =============================================================================

// --- Feed Configuration ---
const FEED_CONFIG = {
  aircraft: {
    name: 'OpenSky Network',
    type: 'ADS-B',
    url: 'https://opensky-network.org/api/states/all',
    intervalMs: 15000,
    radiusKm: 50,
    enabled: true
  },
  weather: {
    name: 'Open-Meteo',
    type: 'ENV',
    url: 'https://api.open-meteo.com/v1/forecast',
    intervalMs: 300000,
    enabled: true
  },
  // --- API KEY REQUIRED FEEDS ---
  wigle: {
    name: 'WiGLE',
    type: 'SIGINT',
    url: 'https://api.wigle.net/api/v2/network/search',
    intervalMs: 60000,
    enabled: false,
    apiKey: null
  },
  shodan: {
    name: 'Shodan',
    type: 'SIGINT',
    url: 'https://api.shodan.io/shodan/host/search',
    intervalMs: 60000,
    enabled: false,
    apiKey: null
  },
  otx: {
    name: 'AlienVault OTX',
    type: 'THREAT',
    url: 'https://otx.alienvault.com/api/v1/indicators/export',
    intervalMs: 120000,
    enabled: false,
    apiKey: null
  }
};

// Military callsign prefixes (US + NATO)
const MIL_CALLSIGN_PATTERNS = [
  /^RCH/i,     // Air Mobility Command (Reach)
  /^EVAC/i,    // Medevac
  /^DUKE/i,    // Special Ops
  /^REACH/i,   // AMC
  /^KING/i,    // CSAR
  /^PEDRO/i,   // CSAR helo
  /^DUSTOFF/i, // Army medevac
  /^TOPCAT/i,  // Refueling
  /^HAVOC/i,   // Attack helo
  /^UGLY/i,    // British Apache
  /^CHAOS/i,   // Marine
  /^KNIFE/i,   // Special Ops
  /^MAGMA/i,   // Air Force
  /^SLAM/i,    // Strike
  /^VIPER/i,   // Marine Cobra/Viper
  /^RAGE/i,    // Fighter
  /^HAWK/i,    // Surveillance
  /^FORTE/i,   // Global Hawk (ISR)
  /^HOMER/i,   // P-8 Poseidon
  /^JAKE/i,    // P-8 Poseidon
  /^NCHO/i,    // Nightwatch (E-6B)
  /^SNTRY/i,   // AWACS
  /^IRON/i,    // Military misc
  /^SKULL/i,   // VFA squadrons
  /^REAPER/i,  // MQ-9
  /^DOOM/i,    // Fighter
  /^WOLF/i,    // Special Ops
  /^JEDI/i,    // Air Force
  /^SAM\d/i,   // Special Air Mission (VIP)
  /^AF[12]/i,  // Air Force One/Two
  /^EXEC/i,    // Executive flight
  /^PAT\d/i,   // Patriot Express
  /^PACK/i,    // Wolfpack
  /^CNV/i,     // Convoy
  /^GORDO/i,   // C-17
];

// Weather code descriptions (WMO standard)
const WMO_CODES = {
  0: 'CLEAR SKY', 1: 'MAINLY CLEAR', 2: 'PARTLY CLOUDY', 3: 'OVERCAST',
  45: 'FOG', 48: 'RIME FOG',
  51: 'LIGHT DRIZZLE', 53: 'MOD DRIZZLE', 55: 'HEAVY DRIZZLE',
  61: 'LIGHT RAIN', 63: 'MOD RAIN', 65: 'HEAVY RAIN',
  71: 'LIGHT SNOW', 73: 'MOD SNOW', 75: 'HEAVY SNOW',
  77: 'SNOW GRAINS', 80: 'LIGHT SHOWERS', 81: 'MOD SHOWERS', 82: 'HEAVY SHOWERS',
  85: 'LIGHT SNOW SHOWERS', 86: 'HEAVY SNOW SHOWERS',
  95: 'THUNDERSTORM', 96: 'TSTORM W/ HAIL', 99: 'TSTORM W/ HEAVY HAIL'
};

/**
 * Fetch with timeout to prevent hanging requests.
 */
function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(timer));
}

export class OSINTFeeds {
  constructor() {
    this.position = { lat: null, lon: null };
    this._positionSet = false;
    this.data = {
      aircraft: { lastUpdate: 0, entries: [], count: 0, status: 'STANDBY', error: null },
      weather:  { lastUpdate: 0, current: null, status: 'STANDBY', error: null },
      wigle:    { lastUpdate: 0, entries: [], count: 0, status: 'NO_KEY', error: null },
      shodan:   { lastUpdate: 0, entries: [], count: 0, status: 'NO_KEY', error: null },
      otx:      { lastUpdate: 0, entries: [], count: 0, status: 'NO_KEY', error: null }
    };
    this._intervals = {};
    this._running = false;
    this._callbacks = [];
  }

  /**
   * Set operator GPS position. Triggers immediate fetch on first position.
   */
  setPosition(lat, lon) {
    this.position.lat = lat;
    this.position.lon = lon;

    // On first GPS fix, immediately fetch all feeds
    if (!this._positionSet && this._running) {
      this._positionSet = true;
      console.log(`[OSINT] GPS acquired: ${lat.toFixed(4)}, ${lon.toFixed(4)} - fetching all feeds`);
      for (const [name, config] of Object.entries(FEED_CONFIG)) {
        if (config.enabled) this._fetchFeed(name);
      }
    }
  }

  /**
   * Set API key for premium feeds (wigle, shodan, otx).
   */
  setApiKey(feedName, key) {
    if (FEED_CONFIG[feedName]) {
      FEED_CONFIG[feedName].apiKey = key;
      FEED_CONFIG[feedName].enabled = true;
      this.data[feedName].status = 'READY';
      console.log(`[OSINT] ${FEED_CONFIG[feedName].name} API key set`);
      // Start interval for newly enabled feed
      if (this._running && !this._intervals[feedName]) {
        this._fetchFeed(feedName);
        this._intervals[feedName] = setInterval(() => this._fetchFeed(feedName), FEED_CONFIG[feedName].intervalMs);
      }
    }
  }

  onUpdate(callback) {
    this._callbacks.push(callback);
  }

  _notify() {
    for (const cb of this._callbacks) {
      try { cb(this.data); } catch (e) { console.error('[OSINT] Callback error:', e); }
    }
  }

  start() {
    if (this._running) return;
    this._running = true;
    console.log('[OSINT] Starting OSINT feed aggregation...');

    for (const [name, config] of Object.entries(FEED_CONFIG)) {
      if (!config.enabled) continue;

      // Initial fetch (will silently skip if no GPS yet)
      this._fetchFeed(name);

      this._intervals[name] = setInterval(() => {
        this._fetchFeed(name);
      }, config.intervalMs);
    }
  }

  stop() {
    this._running = false;
    for (const id of Object.values(this._intervals)) {
      clearInterval(id);
    }
    this._intervals = {};
    console.log('[OSINT] All feeds stopped');
  }

  getAllData() {
    return this.data;
  }

  getTacticalSummary() {
    const ac = this.data.aircraft;
    const wx = this.data.weather.current;

    return {
      aircraftNearby: ac.count,
      militaryAircraft: ac.entries.filter(a => a.category === 'MILITARY').length,
      possibleMilAircraft: ac.entries.filter(a => a.category === 'POSSIBLE_MIL').length,
      emergencyAircraft: ac.entries.filter(a => a.category === 'EMERGENCY' || a.category === 'HIJACK' || a.category === 'COMMS_FAILURE').length,
      closestAircraft: ac.entries.length > 0 ? ac.entries[0] : null,
      weatherCondition: wx ? (WMO_CODES[wx.weatherCode] || 'UNKNOWN') : 'NO DATA',
      visibility: wx ? wx.visibility : null,
      visibilityKm: wx ? wx.visibilityKm : null,
      windSpeed: wx ? wx.windSpeed : null,
      windDirection: wx ? wx.windDirection : null,
      temperature: wx ? wx.temperature : null,
      humidity: wx ? wx.humidity : null,
      tacticalImpact: wx ? wx.tacticalImpact : null,
      droneOps: wx ? wx.droneOps : null,
      cloudCover: wx ? wx.cloudCover : null,
      feedStatuses: {
        aircraft: this.data.aircraft.status,
        weather: this.data.weather.status,
        wigle: this.data.wigle.status,
        shodan: this.data.shodan.status,
        otx: this.data.otx.status
      },
      feedsActive: Object.values(this.data).filter(d => d.status === 'ACTIVE').length,
      feedsTotal: Object.keys(FEED_CONFIG).length
    };
  }

  // ===========================================================================
  // Feed Fetchers
  // ===========================================================================

  async _fetchFeed(name) {
    if (!this.position.lat || !this.position.lon) return;

    try {
      switch (name) {
        case 'aircraft': await this._fetchAircraft(); break;
        case 'weather':  await this._fetchWeather(); break;
        case 'wigle':    await this._fetchWiGLE(); break;
        case 'shodan':   await this._fetchShodan(); break;
        case 'otx':      await this._fetchOTX(); break;
      }
    } catch (err) {
      const isAbort = err.name === 'AbortError';
      console.warn(`[OSINT] ${name} ${isAbort ? 'timeout' : 'error'}:`, err.message);
      this.data[name].status = 'ERROR';
      this.data[name].error = isAbort ? 'TIMEOUT' : err.message;
      this._notify();
    }
  }

  // ---------------------------------------------------------------------------
  // 1. OpenSky Network - Real-time ADS-B Aircraft Tracking
  // ---------------------------------------------------------------------------
  async _fetchAircraft() {
    const { lat, lon } = this.position;
    const r = FEED_CONFIG.aircraft.radiusKm / 111;

    const url = `${FEED_CONFIG.aircraft.url}?lamin=${(lat - r).toFixed(4)}&lomin=${(lon - r).toFixed(4)}&lamax=${(lat + r).toFixed(4)}&lomax=${(lon + r).toFixed(4)}`;

    const resp = await fetchWithTimeout(url);
    if (!resp.ok) {
      if (resp.status === 429) {
        this.data.aircraft.status = 'RATE_LIMITED';
        this.data.aircraft.error = 'Rate limited - retrying next interval';
        console.warn('[OSINT] OpenSky rate limited (429)');
      } else {
        this.data.aircraft.status = 'ERROR';
        this.data.aircraft.error = `HTTP ${resp.status}`;
      }
      this._notify();
      return;
    }

    const json = await resp.json();
    const states = json.states || [];

    this.data.aircraft.entries = states.map(s => {
      const callsign = (s[1] || '').trim();
      const country = s[2] || '';
      const altitude = s[7] !== null ? Math.round(s[7]) : null;
      const velocity = s[9] !== null ? Math.round(s[9] * 3.6) : null;
      const heading = s[10] !== null ? Math.round(s[10]) : null;
      const verticalRate = s[11] || 0;
      const squawk = s[14] ? String(s[14]) : '';

      // Categorize aircraft
      let category = 'CIVILIAN';
      if (squawk === '7700') category = 'EMERGENCY';
      else if (squawk === '7600') category = 'COMMS_FAILURE';
      else if (squawk === '7500') category = 'HIJACK';
      else if (callsign && MIL_CALLSIGN_PATTERNS.some(p => p.test(callsign))) category = 'MILITARY';
      else if (country === 'United States' && !callsign && altitude && altitude > 10000) category = 'POSSIBLE_MIL';

      const acLat = s[6];
      const acLon = s[5];
      let distance = null;
      if (acLat != null && acLon != null) {
        distance = this._haversine(lat, lon, acLat, acLon);
      }

      let trend = 'LEVEL';
      if (verticalRate > 1) trend = 'CLIMBING';
      else if (verticalRate < -1) trend = 'DESCENDING';

      return {
        icao24: s[0],
        callsign: callsign || 'NO CALL',
        country,
        latitude: acLat,
        longitude: acLon,
        altitude,
        altitudeFt: altitude != null ? Math.round(altitude * 3.281) : null,
        velocity,
        heading,
        verticalRate: Math.round(verticalRate),
        trend,
        squawk,
        onGround: s[8],
        category,
        distance: distance != null ? Math.round(distance * 10) / 10 : null,
        bearing: (acLat != null && acLon != null) ? Math.round(this._bearing(lat, lon, acLat, acLon)) : null
      };
    })
    // Filter out aircraft on ground and those without position
    .filter(a => !a.onGround && a.latitude != null);

    // Sort by distance
    this.data.aircraft.entries.sort((a, b) => (a.distance || 999) - (b.distance || 999));
    this.data.aircraft.count = this.data.aircraft.entries.length;
    this.data.aircraft.lastUpdate = Date.now();
    this.data.aircraft.status = 'ACTIVE';
    this.data.aircraft.error = null;

    console.log(`[OSINT] Aircraft: ${this.data.aircraft.count} tracked`);
    this._notify();
  }

  // ---------------------------------------------------------------------------
  // 2. Open-Meteo - Real-time Weather & Tactical Environmental Data
  // ---------------------------------------------------------------------------
  async _fetchWeather() {
    const { lat, lon } = this.position;

    // FIXED: Single current= param with all fields comma-separated
    const currentFields = [
      'temperature_2m', 'relative_humidity_2m', 'apparent_temperature',
      'wind_speed_10m', 'wind_direction_10m', 'wind_gusts_10m',
      'weather_code', 'visibility', 'precipitation', 'cloud_cover',
      'surface_pressure', 'is_day'
    ].join(',');

    const url = `${FEED_CONFIG.weather.url}?latitude=${lat}&longitude=${lon}&current=${currentFields}&timezone=auto&temperature_unit=fahrenheit&wind_speed_unit=mph`;

    const resp = await fetchWithTimeout(url);
    if (!resp.ok) {
      this.data.weather.status = 'ERROR';
      this.data.weather.error = `HTTP ${resp.status}`;
      this._notify();
      return;
    }

    const json = await resp.json();
    const c = json.current || {};

    const visibility = c.visibility ?? 10000;
    const windSpeed = c.wind_speed_10m ?? 0;
    const precip = c.precipitation ?? 0;
    const cloudCover = c.cloud_cover ?? 0;

    // Tactical weather assessment
    let tacticalImpact = 'MINIMAL';
    if (visibility < 1000 || windSpeed > 40 || precip > 10) tacticalImpact = 'SEVERE';
    else if (visibility < 3000 || windSpeed > 25 || precip > 5) tacticalImpact = 'SIGNIFICANT';
    else if (visibility < 5000 || windSpeed > 15 || precip > 1) tacticalImpact = 'MODERATE';

    // Drone operations assessment
    let droneOps = 'GREEN';
    if (windSpeed > 35 || precip > 5) droneOps = 'RED';
    else if (windSpeed > 20 || precip > 2 || visibility < 2000) droneOps = 'AMBER';

    // Night vision assessment
    const isDay = c.is_day ?? true;

    // Ceiling estimate from cloud cover
    let ceiling = 'UNLIMITED';
    if (cloudCover > 90) ceiling = 'OVERCAST';
    else if (cloudCover > 70) ceiling = 'BROKEN';
    else if (cloudCover > 40) ceiling = 'SCATTERED';
    else if (cloudCover > 10) ceiling = 'FEW';

    this.data.weather.current = {
      temperature: c.temperature_2m,
      feelsLike: c.apparent_temperature,
      humidity: c.relative_humidity_2m,
      windSpeed: c.wind_speed_10m,
      windDirection: c.wind_direction_10m,
      windGusts: c.wind_gusts_10m,
      weatherCode: c.weather_code,
      weatherDesc: WMO_CODES[c.weather_code] || 'UNKNOWN',
      visibility,
      visibilityKm: Math.round(visibility / 100) / 10,
      visibilityMi: Math.round(visibility / 1609.34 * 10) / 10,
      precipitation: c.precipitation,
      cloudCover,
      ceiling,
      pressure: c.surface_pressure,
      pressureInHg: c.surface_pressure ? Math.round(c.surface_pressure * 0.02953 * 100) / 100 : null,
      isDay,
      tacticalImpact,
      droneOps
    };

    this.data.weather.lastUpdate = Date.now();
    this.data.weather.status = 'ACTIVE';
    this.data.weather.error = null;

    console.log(`[OSINT] Weather: ${this.data.weather.current.weatherDesc}, ${this.data.weather.current.temperature}°F`);
    this._notify();
  }

  // ---------------------------------------------------------------------------
  // 3. WiGLE - Wireless Network Intelligence (API KEY REQUIRED)
  // ---------------------------------------------------------------------------
  async _fetchWiGLE() {
    const key = FEED_CONFIG.wigle.apiKey;
    if (!key) return;

    const { lat, lon } = this.position;
    const url = `${FEED_CONFIG.wigle.url}?latrange1=${lat - 0.01}&latrange2=${lat + 0.01}&longrange1=${lon - 0.01}&longrange2=${lon + 0.01}&resultsPerPage=50`;

    const resp = await fetchWithTimeout(url, {
      headers: { 'Authorization': `Basic ${btoa(key + ':')}` }
    });
    if (!resp.ok) {
      this.data.wigle.error = `HTTP ${resp.status}`;
      return;
    }

    const json = await resp.json();
    this.data.wigle.entries = (json.results || []).map(r => ({
      ssid: r.ssid || '[HIDDEN]',
      type: r.type || 'wifi',
      encryption: r.encryption || 'unknown',
      channel: r.channel,
      latitude: r.trilat,
      longitude: r.trilong,
      firstSeen: r.firsttime,
      lastSeen: r.lasttime,
      distance: this._haversine(lat, lon, r.trilat, r.trilong)
    }));

    this.data.wigle.count = this.data.wigle.entries.length;
    this.data.wigle.lastUpdate = Date.now();
    this.data.wigle.status = 'ACTIVE';
    this.data.wigle.error = null;
    this._notify();
  }

  // ---------------------------------------------------------------------------
  // 4. Shodan - Exposed Device Intelligence (API KEY REQUIRED)
  // ---------------------------------------------------------------------------
  async _fetchShodan() {
    const key = FEED_CONFIG.shodan.apiKey;
    if (!key) return;

    const { lat, lon } = this.position;
    const url = `${FEED_CONFIG.shodan.url}?key=${key}&query=geo:${lat},${lon},5`;

    const resp = await fetchWithTimeout(url);
    if (!resp.ok) {
      this.data.shodan.error = `HTTP ${resp.status}`;
      return;
    }

    const json = await resp.json();
    this.data.shodan.entries = (json.matches || []).map(m => ({
      ip: m.ip_str,
      port: m.port,
      org: m.org || 'Unknown',
      product: m.product || 'Unknown',
      os: m.os || 'Unknown',
      vulns: m.vulns ? Object.keys(m.vulns).length : 0,
      latitude: m.location?.latitude,
      longitude: m.location?.longitude
    }));

    this.data.shodan.count = this.data.shodan.entries.length;
    this.data.shodan.lastUpdate = Date.now();
    this.data.shodan.status = 'ACTIVE';
    this.data.shodan.error = null;
    this._notify();
  }

  // ---------------------------------------------------------------------------
  // 5. AlienVault OTX - Threat Intelligence (API KEY REQUIRED)
  // ---------------------------------------------------------------------------
  async _fetchOTX() {
    const key = FEED_CONFIG.otx.apiKey;
    if (!key) return;

    const url = 'https://otx.alienvault.com/api/v1/pulses/subscribed?limit=10&modified_since=1d';

    const resp = await fetchWithTimeout(url, {
      headers: { 'X-OTX-API-KEY': key }
    });
    if (!resp.ok) {
      this.data.otx.error = `HTTP ${resp.status}`;
      return;
    }

    const json = await resp.json();
    this.data.otx.entries = (json.results || []).map(p => ({
      id: p.id,
      name: p.name,
      description: p.description?.substring(0, 200),
      tlp: p.tlp || 'white',
      adversary: p.adversary || 'Unknown',
      targetedCountries: p.targeted_countries || [],
      indicators: p.indicator_count || 0,
      created: p.created,
      modified: p.modified,
      tags: p.tags || []
    }));

    this.data.otx.count = this.data.otx.entries.length;
    this.data.otx.lastUpdate = Date.now();
    this.data.otx.status = 'ACTIVE';
    this.data.otx.error = null;
    this._notify();
  }

  // ===========================================================================
  // Utility Functions
  // ===========================================================================

  _haversine(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  _bearing(lat1, lon1, lat2, lon2) {
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const y = Math.sin(dLon) * Math.cos(lat2 * Math.PI / 180);
    const x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) -
              Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos(dLon);
    return ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360;
  }
}

export const osintFeeds = new OSINTFeeds();
