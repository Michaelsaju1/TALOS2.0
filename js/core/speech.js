// =============================================================================
// TALOS 2.0 - Speech Engine (Zero-Latency Voice Command & Response)
// Uses Web Speech API - fully on-device, no network round-trip.
// SpeechRecognition for STT, SpeechSynthesis for TTS.
// =============================================================================

// Command definitions: keyword patterns → handler names
const COMMANDS = [
  // Status & Reports
  { patterns: ['status report', 'status', 'sitrep', 'sit rep'], handler: 'statusReport' },
  { patterns: ['weather report', 'weather', 'weather brief', 'wx'], handler: 'weatherReport' },
  { patterns: ['threat report', 'threat assessment', 'threats', 'threat brief'], handler: 'threatReport' },
  { patterns: ['drone status', 'drone report', 'fleet status', 'drones'], handler: 'droneReport' },
  { patterns: ['osint report', 'osint', 'intelligence', 'intel report', 'intel brief'], handler: 'osintReport' },
  { patterns: ['mission status', 'mission report', 'mission brief', 'mission'], handler: 'missionReport' },
  { patterns: ['suit status', 'suit report', 'armor status', 'suit'], handler: 'suitReport' },

  // Actions
  { patterns: ['scan area', 'scan', 'area scan'], handler: 'scanArea' },
  { patterns: ['terrain analysis', 'terrain', 'analyze terrain'], handler: 'terrainAnalysis' },
  { patterns: ['toggle terrain', 'show terrain', 'terrain overlay'], handler: 'toggleTerrain' },
  { patterns: ['show osint', 'open osint', 'osint panel'], handler: 'showOsint' },
  { patterns: ['recall drones', 'recall all', 'rtb all', 'return to base'], handler: 'recallDrones' },

  // Quick queries
  { patterns: ['how many threats', 'threat count', 'hostiles'], handler: 'threatCount' },
  { patterns: ['nearest threat', 'closest threat', 'closest hostile'], handler: 'nearestThreat' },
  { patterns: ['time check', 'what time', 'current time'], handler: 'timeCheck' },
  { patterns: ['battery', 'power level', 'suit power'], handler: 'batteryCheck' },
];

export class SpeechEngine {
  constructor() {
    this._recognition = null;
    this._synthesis = window.speechSynthesis || null;
    this._listening = false;
    this._available = false;
    this._voice = null;
    this._commandHandlers = {};
    this._onStatusChange = null;
    this._onTranscript = null;
    this._speakQueue = [];
    this._speaking = false;
    this._lastTranscript = '';
    this._gestureUnlocked = false; // TTS needs user gesture on iOS

    // Data providers - set by app.js
    this._getState = null;
    this._getOsint = null;
    this._getDrones = null;
    this._getSuit = null;
    this._getMission = null;
    this._getAssessments = null;
    this._getTerrain = null;

    this._init();
  }

  // =========================================================================
  // Initialization
  // =========================================================================

  _init() {
    // Check for Speech Recognition support
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('[SPEECH] SpeechRecognition not available');
      return;
    }

    this._recognition = new SpeechRecognition();
    this._recognition.continuous = false;     // Single utterance per push-to-talk
    this._recognition.interimResults = true;  // Show partial results for responsiveness
    this._recognition.lang = 'en-US';
    this._recognition.maxAlternatives = 1;

    this._recognition.onresult = (e) => this._handleResult(e);
    this._recognition.onerror = (e) => this._handleError(e);
    this._recognition.onend = () => this._handleEnd();
    this._recognition.onstart = () => {
      this._listening = true;
      this._notifyStatus('listening');
    };

    this._available = true;

    // Select voice for TTS
    this._selectVoice();

    // Voices may load async
    if (this._synthesis) {
      this._synthesis.onvoiceschanged = () => this._selectVoice();
    }

    console.log('[SPEECH] Speech engine initialized');
  }

  _selectVoice() {
    if (!this._synthesis) return;
    const voices = this._synthesis.getVoices();
    if (voices.length === 0) return;

    // Prefer: compact English voice, not too slow
    // iOS Safari has good built-in voices
    const preferred = [
      'Samantha',     // iOS default
      'Karen',        // Australian English
      'Daniel',       // British English
      'Alex',         // macOS
      'Google US English',
      'Microsoft Zira',
    ];

    for (const name of preferred) {
      const found = voices.find(v => v.name.includes(name));
      if (found) {
        this._voice = found;
        console.log(`[SPEECH] Voice selected: ${found.name}`);
        return;
      }
    }

    // Fallback: first English voice
    const english = voices.find(v => v.lang.startsWith('en'));
    if (english) {
      this._voice = english;
      console.log(`[SPEECH] Voice fallback: ${english.name}`);
    }
  }

  // =========================================================================
  // Public API
  // =========================================================================

  /** Check if speech is available on this device */
  isAvailable() { return this._available; }

  /** Check if currently listening */
  isListening() { return this._listening; }

  /** Check if currently speaking */
  isSpeaking() { return this._speaking; }

  /**
   * Start listening for voice command (push-to-talk).
   * Must be called from user gesture (tap/click) on iOS.
   */
  startListening() {
    if (!this._available || this._listening) return;

    // Unlock TTS on first user gesture
    if (!this._gestureUnlocked && this._synthesis) {
      const unlock = new SpeechSynthesisUtterance('');
      unlock.volume = 0;
      this._synthesis.speak(unlock);
      this._gestureUnlocked = true;
    }

    try {
      this._recognition.start();
      console.log('[SPEECH] Listening started');
    } catch (e) {
      console.warn('[SPEECH] Start failed:', e.message);
      // May already be listening
    }
  }

  /** Stop listening */
  stopListening() {
    if (!this._available || !this._listening) return;
    try {
      this._recognition.stop();
    } catch (e) { /* ignore */ }
    this._listening = false;
    this._notifyStatus('idle');
  }

  /**
   * Speak text aloud. Priority levels: 'alert' (interrupts), 'normal', 'low'.
   */
  speak(text, priority = 'normal') {
    if (!this._synthesis) return;

    if (priority === 'alert') {
      // Cancel current speech and jump to front
      this._synthesis.cancel();
      this._speakQueue = [];
      this._speakNow(text);
    } else if (priority === 'low') {
      // Only speak if not already speaking or queued
      if (!this._speaking && this._speakQueue.length === 0) {
        this._speakNow(text);
      }
    } else {
      // Queue for normal priority
      if (this._speaking) {
        this._speakQueue.push(text);
      } else {
        this._speakNow(text);
      }
    }
  }

  /** Stop speaking immediately */
  stopSpeaking() {
    if (!this._synthesis) return;
    this._synthesis.cancel();
    this._speakQueue = [];
    this._speaking = false;
    this._notifyStatus(this._listening ? 'listening' : 'idle');
  }

  /** Set callback for status changes: 'idle' | 'listening' | 'processing' | 'speaking' */
  onStatusChange(cb) { this._onStatusChange = cb; }

  /** Set callback for transcript updates (interim and final) */
  onTranscript(cb) { this._onTranscript = cb; }

  /** Register data providers so speech engine can generate reports */
  setDataProviders({ getState, getOsint, getDrones, getSuit, getMission, getAssessments, getTerrain }) {
    this._getState = getState;
    this._getOsint = getOsint;
    this._getDrones = getDrones;
    this._getSuit = getSuit;
    this._getMission = getMission;
    this._getAssessments = getAssessments;
    this._getTerrain = getTerrain;
  }

  /** Announce a tactical alert (auto-spoken, high priority) */
  announceAlert(message) {
    this.speak(message, 'alert');
  }

  // =========================================================================
  // Speech Recognition Handlers
  // =========================================================================

  _handleResult(event) {
    let transcript = '';
    let isFinal = false;

    for (let i = event.resultIndex; i < event.results.length; i++) {
      transcript += event.results[i][0].transcript;
      if (event.results[i].isFinal) isFinal = true;
    }

    transcript = transcript.trim().toLowerCase();
    this._lastTranscript = transcript;

    // Show interim results for responsiveness
    if (this._onTranscript) {
      this._onTranscript(transcript, isFinal);
    }

    if (isFinal) {
      this._notifyStatus('processing');
      this._processCommand(transcript);
    }
  }

  _handleError(event) {
    console.warn('[SPEECH] Recognition error:', event.error);
    this._listening = false;

    if (event.error === 'not-allowed') {
      this._notifyStatus('denied');
    } else if (event.error === 'no-speech') {
      this._notifyStatus('idle');
    } else {
      this._notifyStatus('error');
    }
  }

  _handleEnd() {
    this._listening = false;
    if (!this._speaking) {
      this._notifyStatus('idle');
    }
  }

  // =========================================================================
  // Command Processing
  // =========================================================================

  _processCommand(transcript) {
    console.log(`[SPEECH] Processing: "${transcript}"`);

    // Match against command patterns
    for (const cmd of COMMANDS) {
      for (const pattern of cmd.patterns) {
        if (transcript.includes(pattern)) {
          console.log(`[SPEECH] Command matched: ${cmd.handler}`);
          this._executeCommand(cmd.handler, transcript);
          return;
        }
      }
    }

    // No command matched
    this.speak("Command not recognized. Say status report, weather, threats, drones, or osint.");
  }

  _executeCommand(handler, transcript) {
    switch (handler) {
      case 'statusReport':    this._cmdStatusReport(); break;
      case 'weatherReport':   this._cmdWeatherReport(); break;
      case 'threatReport':    this._cmdThreatReport(); break;
      case 'droneReport':     this._cmdDroneReport(); break;
      case 'osintReport':     this._cmdOsintReport(); break;
      case 'missionReport':   this._cmdMissionReport(); break;
      case 'suitReport':      this._cmdSuitReport(); break;
      case 'scanArea':        this._cmdScanArea(); break;
      case 'terrainAnalysis': this._cmdTerrainAnalysis(); break;
      case 'toggleTerrain':   this._cmdToggleTerrain(); break;
      case 'showOsint':       this._cmdShowOsint(); break;
      case 'recallDrones':    this._cmdRecallDrones(); break;
      case 'threatCount':     this._cmdThreatCount(); break;
      case 'nearestThreat':   this._cmdNearestThreat(); break;
      case 'timeCheck':       this._cmdTimeCheck(); break;
      case 'batteryCheck':    this._cmdBatteryCheck(); break;
      default:
        this.speak("Command acknowledged but no handler available.");
    }
  }

  // =========================================================================
  // Command Handlers - Generate voice responses from live data
  // =========================================================================

  _cmdStatusReport() {
    const parts = ['TALOS status report.'];

    // Suit
    const suit = this._getSuit?.();
    if (suit) {
      parts.push(`Suit power ${suit.power?.battery || 0} percent.`);
      parts.push(`Armor ${suit.armor?.overall || 'unknown'}.`);
    }

    // Threats
    const assessments = this._getAssessments?.() || [];
    const hostiles = assessments.filter(a => a.classification === 'HOSTILE').length;
    const unknowns = assessments.filter(a => a.classification === 'UNKNOWN').length;
    parts.push(`${hostiles} hostile${hostiles !== 1 ? 's' : ''} detected.`);
    if (unknowns > 0) parts.push(`${unknowns} unknown.`);

    // Drones
    const drones = this._getDrones?.();
    if (drones?.fleetSummary) {
      parts.push(`Drone fleet: ${drones.fleetSummary.active} active of ${drones.fleetSummary.total}.`);
    }

    // OSINT
    const osint = this._getOsint?.();
    if (osint) {
      if (osint.droneOps && osint.droneOps !== 'GREEN') {
        parts.push(`Warning: drone operations ${osint.droneOps}.`);
      }
      if (osint.militaryAircraft > 0) {
        parts.push(`${osint.militaryAircraft} military aircraft tracked.`);
      }
    }

    parts.push('Status report complete.');
    this.speak(parts.join(' '));
  }

  _cmdWeatherReport() {
    const osint = this._getOsint?.();
    if (!osint || !osint.weatherCondition || osint.weatherCondition === 'NO DATA') {
      this.speak('Weather data not available. Awaiting OSINT feed.');
      return;
    }

    const parts = ['Weather brief.'];
    parts.push(`Conditions: ${osint.weatherCondition}.`);
    if (osint.temperature != null) parts.push(`Temperature ${Math.round(osint.temperature)} degrees.`);
    if (osint.windSpeed != null) {
      const dir = osint.windDirection != null ? this._degreesToCardinal(osint.windDirection) : '';
      parts.push(`Wind ${dir} ${Math.round(osint.windSpeed)} miles per hour.`);
    }
    if (osint.visibilityKm != null) {
      const visMi = Math.round(osint.visibilityKm * 0.621);
      parts.push(`Visibility ${visMi} miles.`);
    }
    parts.push(`Tactical impact: ${osint.tacticalImpact}.`);
    parts.push(`Drone operations: ${osint.droneOps}.`);

    this.speak(parts.join(' '));
  }

  _cmdThreatReport() {
    const assessments = this._getAssessments?.() || [];
    if (assessments.length === 0) {
      this.speak('No threats detected. Area appears clear.');
      return;
    }

    const hostiles = assessments.filter(a => a.classification === 'HOSTILE');
    const unknowns = assessments.filter(a => a.classification === 'UNKNOWN');

    const parts = ['Threat assessment.'];
    parts.push(`${hostiles.length} hostile${hostiles.length !== 1 ? 's' : ''}, ${unknowns.length} unknown.`);

    // Top threat details
    if (assessments.length > 0) {
      const top = assessments[0];
      parts.push(`Priority threat: ${top.category}, threat level ${(top.threatLevel * 100).toFixed(0)} percent.`);
      if (top.distance?.meters) {
        parts.push(`Distance ${top.distance.meters} meters.`);
      }
      if (top.movement?.heading && top.movement.heading !== 'UNKNOWN') {
        parts.push(`${top.movement.heading}.`);
      }
      if (top.coursesOfAction?.length > 0) {
        parts.push(`Recommended: ${top.coursesOfAction[0].action}.`);
      }
    }

    this.speak(parts.join(' '));
  }

  _cmdDroneReport() {
    const drones = this._getDrones?.();
    if (!drones?.fleetSummary) {
      this.speak('Drone fleet not initialized. Select a mission first.');
      return;
    }

    const fs = drones.fleetSummary;
    const parts = ['Drone fleet status.'];
    parts.push(`${fs.active} active, ${fs.ready || 0} ready, ${fs.charging || 0} charging, of ${fs.total} total.`);
    if (fs.lost > 0) parts.push(`Warning: ${fs.lost} drone${fs.lost !== 1 ? 's' : ''} lost.`);
    parts.push(`Average battery ${fs.avgBattery} percent.`);
    if (fs.totalStrikesRemaining != null) {
      parts.push(`${fs.totalStrikesRemaining} strike${fs.totalStrikesRemaining !== 1 ? 's' : ''} remaining.`);
    }

    // Weather impact on drones
    const osint = this._getOsint?.();
    if (osint?.droneOps === 'RED') {
      parts.push('Warning: weather restricts all drone operations.');
    } else if (osint?.droneOps === 'AMBER') {
      parts.push('Caution: weather degrades drone performance.');
    }

    this.speak(parts.join(' '));
  }

  _cmdOsintReport() {
    const osint = this._getOsint?.();
    if (!osint) {
      this.speak('OSINT feeds not active. Awaiting GPS position.');
      return;
    }

    const parts = ['Open source intelligence brief.'];
    parts.push(`${osint.feedsActive} of ${osint.feedsTotal} feeds active.`);

    if (osint.aircraftNearby > 0) {
      parts.push(`${osint.aircraftNearby} aircraft tracked nearby.`);
      if (osint.militaryAircraft > 0) {
        parts.push(`${osint.militaryAircraft} military.`);
      }
    } else {
      parts.push('No aircraft in area.');
    }

    if (osint.weatherCondition && osint.weatherCondition !== 'NO DATA') {
      parts.push(`Weather: ${osint.weatherCondition}, ${osint.tacticalImpact} tactical impact.`);
    }

    this.speak(parts.join(' '));
  }

  _cmdMissionReport() {
    const mission = this._getMission?.();
    if (!mission) {
      this.speak('No mission loaded. Select a mission from the mission panel.');
      return;
    }

    const parts = ['Mission brief.'];
    if (mission.missionType) parts.push(`Mission type: ${mission.missionType}.`);
    if (mission.taskAndPurpose) parts.push(mission.taskAndPurpose);

    this.speak(parts.join(' '));
  }

  _cmdSuitReport() {
    const suit = this._getSuit?.();
    if (!suit) {
      this.speak('Suit status unavailable.');
      return;
    }

    const parts = ['Suit systems report.'];
    parts.push(`Power: ${suit.power?.battery || 0} percent.`);
    if (suit.power?.estimatedRuntime) parts.push(`Estimated runtime: ${suit.power.estimatedRuntime}.`);
    parts.push(`Armor: ${suit.armor?.overall || 'unknown'}.`);

    // Check for damage
    const armorSections = ['front', 'rear', 'left', 'right', 'helmet'];
    const damaged = armorSections.filter(s => suit.armor?.[s] < 100);
    if (damaged.length > 0) {
      parts.push(`Damage detected: ${damaged.join(', ')}.`);
    } else {
      parts.push('No damage detected.');
    }

    // Systems
    const systems = suit.systems || {};
    const offline = Object.entries(systems).filter(([k, v]) => v !== 'OPERATIONAL' && v !== 'STANDBY');
    if (offline.length > 0) {
      parts.push(`Warning: ${offline.map(([k]) => k).join(', ')} not operational.`);
    } else {
      parts.push('All systems operational.');
    }

    this.speak(parts.join(' '));
  }

  _cmdScanArea() {
    this.speak('Scanning area. All sensors active.');
    // The system is already continuously scanning - this is more of a UX acknowledgment
  }

  _cmdTerrainAnalysis() {
    const terrain = this._getTerrain?.();
    if (!terrain) {
      this.speak('Terrain analysis not available. Depth sensor may not be active.');
      return;
    }

    const parts = ['Terrain analysis.'];
    if (terrain.sceneType) parts.push(`Environment: ${terrain.sceneType}.`);
    if (terrain.mobility?.assessment) parts.push(`Mobility: ${terrain.mobility.assessment}.`);

    const avenues = terrain.oakoc?.avenues || [];
    if (avenues.length > 0) {
      const threatAvenues = avenues.filter(a => a.threatAxis);
      parts.push(`${avenues.length} avenue${avenues.length !== 1 ? 's' : ''} of approach identified.`);
      if (threatAvenues.length > 0) {
        parts.push(`${threatAvenues.length} threat axis.`);
      }
    }

    const cover = terrain.oakoc?.coverAndConcealment?.coverPositions || [];
    if (cover.length > 0) {
      parts.push(`${cover.length} cover position${cover.length !== 1 ? 's' : ''} identified.`);
    }

    this.speak(parts.join(' '));
  }

  _cmdToggleTerrain() {
    // Dispatched via callback set by app.js
    if (this._onToggleTerrain) {
      const visible = this._onToggleTerrain();
      this.speak(`Terrain overlay ${visible ? 'enabled' : 'disabled'}.`);
    } else {
      this.speak('Terrain overlay toggle not available.');
    }
  }

  _cmdShowOsint() {
    if (this._onShowOsint) {
      this._onShowOsint();
      this.speak('OSINT panel opened.');
    } else {
      this.speak('OSINT panel not available.');
    }
  }

  _cmdRecallDrones() {
    this.speak('Recalling all drones. Return to base.');
    if (this._onRecallDrones) this._onRecallDrones();
  }

  _cmdThreatCount() {
    const assessments = this._getAssessments?.() || [];
    const hostiles = assessments.filter(a => a.classification === 'HOSTILE').length;
    const total = assessments.length;
    this.speak(`${hostiles} hostile${hostiles !== 1 ? 's' : ''}, ${total} total tracked.`);
  }

  _cmdNearestThreat() {
    const assessments = this._getAssessments?.() || [];
    const withDist = assessments.filter(a => a.distance?.meters > 0);
    if (withDist.length === 0) {
      this.speak('No threats with distance data.');
      return;
    }
    withDist.sort((a, b) => a.distance.meters - b.distance.meters);
    const nearest = withDist[0];
    this.speak(`Nearest threat: ${nearest.category} at ${nearest.distance.meters} meters, ${nearest.movement?.heading || 'unknown heading'}. Threat level ${(nearest.threatLevel * 100).toFixed(0)} percent.`);
  }

  _cmdTimeCheck() {
    const now = new Date();
    const h = now.getHours();
    const m = now.getMinutes();
    const period = h >= 12 ? 'PM' : 'AM';
    const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
    this.speak(`Current time: ${h12} ${m.toString().padStart(2, '0')} ${period}.`);
  }

  _cmdBatteryCheck() {
    const suit = this._getSuit?.();
    if (suit?.power) {
      this.speak(`Suit power at ${suit.power.battery} percent. ${suit.power.estimatedRuntime || ''}.`);
    } else {
      this.speak('Suit power data unavailable.');
    }
  }

  // =========================================================================
  // Action callbacks (set by app.js)
  // =========================================================================

  onToggleTerrain(cb) { this._onToggleTerrain = cb; }
  onShowOsint(cb) { this._onShowOsint = cb; }
  onRecallDrones(cb) { this._onRecallDrones = cb; }

  // =========================================================================
  // TTS Engine
  // =========================================================================

  _speakNow(text) {
    if (!this._synthesis) return;

    // Stop recognition while speaking to prevent feedback
    if (this._listening) {
      try { this._recognition.stop(); } catch (e) { /* ignore */ }
    }

    const utterance = new SpeechSynthesisUtterance(text);
    if (this._voice) utterance.voice = this._voice;
    utterance.rate = 1.15;    // Slightly faster than normal - tactical pace
    utterance.pitch = 0.95;   // Slightly lower - authority
    utterance.volume = 1.0;

    utterance.onstart = () => {
      this._speaking = true;
      this._notifyStatus('speaking');
    };

    utterance.onend = () => {
      this._speaking = false;
      // Process queue
      if (this._speakQueue.length > 0) {
        const next = this._speakQueue.shift();
        this._speakNow(next);
      } else {
        this._notifyStatus('idle');
      }
    };

    utterance.onerror = (e) => {
      console.warn('[SPEECH] TTS error:', e.error);
      this._speaking = false;
      this._notifyStatus('idle');
    };

    this._synthesis.speak(utterance);
  }

  // =========================================================================
  // Utility
  // =========================================================================

  _notifyStatus(status) {
    if (this._onStatusChange) this._onStatusChange(status);
  }

  _degreesToCardinal(deg) {
    const dirs = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'];
    return dirs[Math.round(deg / 45) % 8];
  }
}

export const speechEngine = new SpeechEngine();
