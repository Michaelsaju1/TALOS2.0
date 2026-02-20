// =============================================================================
// TALOS 2.0 - Main Application Bootstrap
// Initializes all systems, manages the perception→intelligence→display pipeline
// =============================================================================

// --- Core ---
import { initCamera } from './core/camera.js';
import { renderer, performanceManager } from './core/renderer.js';
import { QualityLevel } from './core/performance.js';

// --- Perception ---
import { Detector } from './perception/detector.js';
import { DepthEstimator } from './perception/depth.js';
import { Segmentor } from './perception/segmentor.js';
import { Tracker } from './perception/tracker.js';

// --- Intelligence ---
import { MavenMock } from './intel/maven-mock.js';
import { threatEngine } from './intel/threat-engine.js';
import { terrainAnalyzer } from './intel/terrain-analyzer.js';
import { sceneClassifier } from './intel/scene-classifier.js';
import { enemyAnalyzer } from './intel/enemy-analyzer.js';
import { civilAnalyzer } from './intel/civil-analyzer.js';

// --- Mission ---
import { MissionContext } from './mission/mission-context.js';
import { timeManager } from './mission/time-manager.js';

// --- Drones ---
import { droneManager } from './drones/drone-manager.js';
import { droneTasking } from './drones/drone-tasking.js';

// --- Suit ---
import { suitStatus } from './suit/suit-status.js';

// --- OSINT ---
import { osintFeeds } from './intel/osint-feeds.js';

// --- Speech ---
import { speechEngine } from './core/speech.js';

// --- UI ---
import { renderHudElements, renderDetectionBoxes } from './ui/hud-elements.js';
import { renderDepthOverlay } from './ui/hud-overlays.js';
import { terrainOverlay } from './ui/terrain-overlay.js';
import { civilianOverlay } from './ui/civilian-overlay.js';
import { droneOverlay } from './ui/drone-overlay.js';
import { suitOverlay } from './ui/suit-overlay.js';
import { osintOverlay } from './ui/osint-overlay.js';
import { threatPanel } from './ui/threat-panel.js';
import { droneCommandPanel } from './ui/drone-command-panel.js';
import { missionPanel } from './ui/mission-panel.js';
import { touchHandler, hitTestDetections } from './ui/touch-handler.js';

// =============================================================================
// Application State
// =============================================================================

const state = {
  // Perception instances
  detector: null,
  depth: null,
  segmentor: null,
  tracker: null,
  maven: null,
  missionContext: null,

  // Current frame data
  currentDetections: [],
  currentTracked: [],
  currentDepthMap: null,
  depthWidth: 0,
  depthHeight: 0,
  depthFrameId: 0,
  currentAssessments: [],

  // Frame counters for cadence control
  frameCount: 0,
  detectionCadence: 3,  // Detect every 3rd frame - tracker fills gaps
  depthCadence: 60,     // Run depth very infrequently (ONNX is slow)
  intelCadence: 30,     // Run full intel analysis every 30 frames (~1/sec at 30fps)

  // Flags
  modelsLoaded: { detector: false, depth: false, segmentor: false },
  missionActive: false,
  lockedTrackId: null,
  perceptionBusy: false, // Prevent frame overlap

  // Camera
  video: null,
  stream: null,

  // Cached image data to avoid redundant getImageData calls
  _cachedImageData: null,
  _captureCanvas: null,
  _captureCtx: null
};

// =============================================================================
// Boot Sequence
// =============================================================================

const bootLog = document.getElementById('boot-log');
const bootProgress = document.getElementById('boot-progress-bar');
const bootScreen = document.getElementById('boot-screen');

function logBoot(message, status = 'success') {
  if (bootLog) {
    const line = document.createElement('div');
    line.className = `boot-line ${status}`;
    line.textContent = `> ${message}`;
    bootLog.appendChild(line);
    bootLog.scrollTop = bootLog.scrollHeight;
  }
  console.log(`[BOOT] [${status.toUpperCase()}] ${message}`);
}

function setBootProgress(pct) {
  if (bootProgress) bootProgress.style.width = pct + '%';
}

async function boot() {
  try {
    logBoot('TALOS 2.0 INITIALIZING...', 'loading');
    setBootProgress(5);

    // --- Register Service Worker ---
    if ('serviceWorker' in navigator) {
      try {
        // Use relative path so it works on both localhost and GitHub Pages subdirectory
        await navigator.serviceWorker.register('./sw.js');
        logBoot('Service worker registered');
      } catch {
        logBoot('Service worker skipped', 'loading');
      }
    }
    setBootProgress(10);

    // --- Suit Systems ---
    logBoot('SUIT SYSTEMS...', 'loading');
    suitStatus.startSimulation();
    logBoot('Suit systems ONLINE');
    setBootProgress(15);

    // --- Camera ---
    logBoot('CAMERA ARRAY...', 'loading');
    try {
      const cam = await initCamera();
      state.video = cam.video;
      state.stream = cam.stream;
      logBoot(`Camera ONLINE (${cam.width}x${cam.height})`);
    } catch (err) {
      logBoot(`Camera FAILED: ${err.message}`, 'error');
      logBoot('Continuing without camera...', 'loading');
      state.video = document.getElementById('camera-feed');
    }
    setBootProgress(25);

    // --- Initialize Renderer ---
    renderer.init(state.video);
    logBoot('Renderer initialized');
    setBootProgress(30);

    // --- Perception Models ---
    // Detection loaded AFTER HUD is live for instant UI
    state.detector = new Detector();
    state.depth = new DepthEstimator();
    state.segmentor = new Segmentor();
    logBoot('Detection will load after HUD...');
    setBootProgress(50);

    // ByteTrack Tracker (no model needed)
    state.tracker = new Tracker();
    logBoot('ByteTrack tracker ONLINE');

    // Update model status display
    updateModelStatus();

    // --- Drone Fleet ---
    logBoot('DRONE FLEET...', 'loading');
    // Fleet will be initialized when mission is selected
    logBoot('Drone fleet STANDBY (awaiting mission)');
    setBootProgress(75);

    // --- METT-TC Framework ---
    logBoot('METT-TC FRAMEWORK...', 'loading');
    state.missionContext = new MissionContext();
    state.maven = new MavenMock();
    logBoot('Mission context READY');
    logBoot('Maven Smart System STANDBY');
    setBootProgress(80);

    // --- Intelligence Systems ---
    logBoot('INTELLIGENCE SYSTEMS...', 'loading');
    logBoot('Terrain analyzer READY');
    logBoot('Scene classifier READY');
    logBoot('Enemy analyzer READY');
    logBoot('Civil analyzer READY');
    logBoot('Threat engine READY');
    setBootProgress(85);

    // --- Initialize UI ---
    logBoot('HUD SYSTEMS...', 'loading');
    initUI();
    initCompass();
    initGeolocation();
    logBoot('HUD systems ONLINE');
    setBootProgress(88);

    // --- OSINT Feeds ---
    logBoot('OSINT FEEDS...', 'loading');
    initOSINT();
    logBoot('OSINT feeds ACTIVE (aircraft, weather)');
    setBootProgress(88);

    // --- Voice Command System ---
    logBoot('VOICE SYSTEMS...', 'loading');
    initSpeech();
    logBoot(speechEngine.isAvailable() ? 'Voice command ONLINE' : 'Voice command UNAVAILABLE', speechEngine.isAvailable() ? 'success' : 'loading');
    setBootProgress(90);

    // --- Register Overlays ---
    registerOverlays();
    logBoot('Overlays registered');
    setBootProgress(95);

    // --- Start Render Loop ---
    renderer.start();
    logBoot('Render loop ACTIVE');

    // --- Complete ---
    setBootProgress(100);
    logBoot('ALL SYSTEMS NOMINAL - SUIT ONLINE', 'success');
    logBoot('SELECT MISSION TO DEPLOY...', 'loading');

    // Fade out boot screen FAST - get to camera view immediately
    setTimeout(() => {
      if (bootScreen) bootScreen.classList.add('fade-out');
      setTimeout(() => {
        if (bootScreen) bootScreen.style.display = 'none';
        missionPanel.show();
      }, 500);
    }, 800);

    // Load detection model AFTER HUD is visible (non-blocking)
    loadDetectionModel();

  } catch (err) {
    logBoot(`CRITICAL ERROR: ${err.message}`, 'error');
    console.error('[BOOT] Fatal error:', err);
  }
}

// =============================================================================
// UI Initialization
// =============================================================================

function initUI() {
  // Initialize panels
  threatPanel.init();
  droneCommandPanel.init();
  missionPanel.init();
  touchHandler.init();

  // --- Touch Handlers ---
  touchHandler.onTap((pos) => {
    // Check if we tapped a detection
    const det = hitTestDetections(pos.x, pos.y, state.currentDetections);
    if (det) {
      const assessment = state.currentAssessments.find(a => a.id === det.id || a.trackId === det.trackId);
      if (assessment) {
        threatPanel.show(assessment);
        droneCommandPanel.setSelectedTarget(assessment.id, [pos.x, pos.y]);
      }
    } else {
      // Tapped empty space - dismiss panel
      if (threatPanel.isVisible()) {
        threatPanel.hide();
      }
    }
  });

  touchHandler.onLongPress((pos) => {
    // Trigger segmentation on tapped detection
    const det = hitTestDetections(pos.x, pos.y, state.currentDetections);
    if (det && state.modelsLoaded.segmentor) {
      runSegmentation(pos.x, pos.y);
    }
  });

  touchHandler.onDoubleTap((pos) => {
    // Lock/track target
    const det = hitTestDetections(pos.x, pos.y, state.currentDetections);
    if (det) {
      state.lockedTrackId = det.trackId || det.id;
      console.log(`[APP] Locked on target: ${state.lockedTrackId}`);
    } else {
      state.lockedTrackId = null;
    }
  });

  touchHandler.onSwipeDown(() => {
    threatPanel.hide();
  });

  touchHandler.onSwipeRight(() => {
    missionPanel.toggle();
  });

  touchHandler.onThreeFingerTap(() => {
    const visible = terrainOverlay.toggle();
    console.log(`[APP] Terrain overlay: ${visible ? 'ON' : 'OFF'}`);
  });

  // --- Drone Fleet Bar Click ---
  const fleetBar = document.getElementById('drone-fleet-bar');
  if (fleetBar) {
    fleetBar.addEventListener('click', () => {
      droneCommandPanel.toggle(droneManager.getFleetData());
    });
  }

  // --- Drone Command Callbacks ---
  droneCommandPanel.onTaskAssigned((task) => {
    console.log(`[APP] Task assigned: ${task.taskType} → ${task.droneId}`);
    const result = droneTasking.issueTask(task.droneId, task.taskType, {
      targetTrackId: task.targetTrackId,
      targetPosition: task.targetPosition
    });
    if (result.success) {
      console.log(`[APP] Task issued successfully: ${result.drone} → ${task.taskType}`);
    } else {
      console.warn(`[APP] Task failed: ${result.reason}`);
    }
    // Refresh drone panel
    droneCommandPanel.show(droneManager.getFleetData());
  });

  // --- Mission Selection ---
  missionPanel.onMissionSelected((mission) => {
    console.log(`[APP] Mission selected: ${mission.label}`);
    activateMission(mission);
  });
}

// =============================================================================
// Mission Activation
// =============================================================================

function activateMission(mission) {
  // Set mission context
  state.missionContext.loadScenario(mission.id.toLowerCase());
  threatEngine.setMissionContext(mission);

  // Initialize drone fleet
  droneManager.initFleet(mission.fleetComposition);
  droneManager.startSimulation();

  // Initialize time manager
  timeManager.init(mission);
  timeManager.startUpdates();

  // Start Maven intel feed
  state.maven.start();

  // Set ROE in civil analyzer
  civilAnalyzer.setROE(mission.rulesOfEngagement);

  // Update mission bar display
  const missionDisplay = _dom('mission-display');
  if (missionDisplay) {
    missionDisplay.textContent = `${mission.missionType}: ${mission.taskAndPurpose.substring(0, 60)}...`;
  }

  state.missionActive = true;
  console.log(`[APP] Mission ACTIVE: ${mission.label}`);
}

// =============================================================================
// Overlay Registration
// =============================================================================

function registerOverlays() {
  // zOrder: depth(1) → terrain(2) → detections(3) → civilians(4) → drones(5) → suit(6) → hud(7)

  // Depth overlay (z=1)
  renderer.registerOverlay('depth', (ctx, w, h, ts) => {
    if (state.currentDepthMap) {
      renderDepthOverlay(ctx, w, h, state.currentDepthMap,
        state.depthWidth, state.depthHeight, 0.15, state.depthFrameId);
    }
  }, 1);

  // Terrain overlay (z=2)
  renderer.registerOverlay('terrain', (ctx, w, h, ts) => {
    terrainOverlay.render(ctx, w, h);
  }, 2);

  // Detection boxes (z=3)
  renderer.registerOverlay('detections', (ctx, w, h, ts) => {
    renderDetectionBoxes(ctx, w, h, state.currentDetections);
    renderer.setDetectionCount(state.currentDetections.length);
  }, 3);

  // Civilian overlay (z=4)
  renderer.registerOverlay('civilians', (ctx, w, h, ts) => {
    civilianOverlay.render(ctx, w, h, ts);
  }, 4);

  // Drone overlay (z=5)
  renderer.registerOverlay('drones', (ctx, w, h, ts) => {
    droneOverlay.render(ctx, w, h, ts);
  }, 5);

  // Suit overlay (z=6)
  renderer.registerOverlay('suit', (ctx, w, h, ts) => {
    suitOverlay.render(ctx, w, h, ts);
  }, 6);

  // OSINT overlay (z=6.5) - between suit and HUD chrome
  renderer.registerOverlay('osint', (ctx, w, h, ts) => {
    osintOverlay.render(ctx, w, h, ts);
  }, 6.5);

  // HUD chrome (z=7)
  renderer.registerOverlay('hud', (ctx, w, h, ts) => {
    renderHudElements(ctx, w, h, ts);
  }, 7);

  // --- Start perception pipeline (runs alongside render) ---
  startPerceptionLoop();
}

// =============================================================================
// Model Loading (all deferred - HUD shows first)
// =============================================================================

async function loadDetectionModel() {
  try {
    console.log('[APP] Loading detection model in background...');
    await state.detector.init();
    state.modelsLoaded.detector = true;
    updateModelStatus();
    console.log('[APP] Detection model ONLINE - starting perception');
  } catch (err) {
    console.error('[APP] Detection model failed:', err);
  }

  // Then load depth/segmentation even later
  setTimeout(() => loadDeferredModels(), 3000);
}

async function loadDeferredModels() {
  // Load depth model in background
  try {
    console.log('[APP] Background: loading Depth Anything V2...');
    await state.depth.init();
    state.modelsLoaded.depth = true;
    console.log('[APP] Background: Depth Anything V2 ONLINE');
    updateModelStatus();
  } catch (err) {
    console.warn('[APP] Background: Depth model failed:', err.message);
  }

  // Load segmentation model in background (lowest priority)
  try {
    console.log('[APP] Background: loading MobileSAM...');
    await state.segmentor.init();
    state.modelsLoaded.segmentor = true;
    console.log('[APP] Background: MobileSAM ONLINE');
    updateModelStatus();
  } catch (err) {
    console.warn('[APP] Background: Segmentation model failed:', err.message);
  }
}

// =============================================================================
// Perception + Intelligence Pipeline (Optimized)
// =============================================================================

let perceptionRunning = false;

/**
 * Capture frame for depth/segmentation (ONNX models need ImageData).
 */
function captureFrame(inputSize) {
  if (!state.video || state.video.readyState < 2) return null;

  if (!state._captureCanvas || state._captureCanvas.width !== inputSize) {
    state._captureCanvas = new OffscreenCanvas(inputSize, inputSize);
    state._captureCtx = state._captureCanvas.getContext('2d', { willReadFrequently: true });
  }

  state._captureCtx.drawImage(state.video, 0, 0, inputSize, inputSize);
  return state._captureCtx.getImageData(0, 0, inputSize, inputSize);
}

async function startPerceptionLoop() {
  if (perceptionRunning) return;
  perceptionRunning = true;

  const processFrame = async () => {
    if (!perceptionRunning) return;

    // GATE: prevent overlapping inference
    if (state.perceptionBusy) {
      requestAnimationFrame(processFrame);
      return;
    }

    state.perceptionBusy = true;
    state.frameCount++;

    try {
      // --- Detection: run every Nth frame, tracker fills gaps ---
      const shouldDetect = state.modelsLoaded.detector &&
                           state.video?.readyState >= 2 &&
                           state.frameCount % state.detectionCadence === 0;

      if (shouldDetect) {
        const rawDetections = state.detector.detect(state.video);

        // Normalize bboxes to 0-1 range for tracker and overlays
        const vw = state.video.videoWidth || state.video.width || 1;
        const vh = state.video.videoHeight || state.video.height || 1;
        const normalized = rawDetections.map(d => ({
          ...d,
          bbox: [d.bbox[0] / vw, d.bbox[1] / vh, d.bbox[2] / vw, d.bbox[3] / vh]
        }));

        // Track detections
        const tracked = state.tracker.update(normalized);

        // Build enriched detection list
        state.currentDetections = tracked.map(t => ({
          id: `TRK-${String(t.id).padStart(4, '0')}`,
          trackId: t.id,
          bbox: t.bbox,
          class: t.className,
          tacticalClass: mapTacticalClass(t.className),
          confidence: t.score,
          classification: 'UNKNOWN',
          threatLevel: 0,
          distance: null,
          movement: {
            speed: t.velocity ? Math.sqrt(t.velocity[0] ** 2 + t.velocity[1] ** 2) * 30 : 0,
            heading: getMovementHeading(t.velocity),
            bearing: t.velocity ? Math.atan2(t.velocity[0], -t.velocity[1]) * 180 / Math.PI : 0
          },
          onAvenue: null
        }));
      } else if (state.modelsLoaded.detector && state.currentDetections.length > 0) {
        // Non-detection frame: tracker predicts positions from last known state
        // Detections stay as-is, movement vectors still valid via Kalman prediction
      }

      // --- Depth estimation (very infrequent) ---
      const quality = performanceManager.getQuality();
      if (state.modelsLoaded.depth &&
          state.frameCount % state.depthCadence === 0 &&
          quality === QualityLevel.FULL) {
        try {
          const depthInput = captureFrame(256);
          if (depthInput) {
            const depthResult = await state.depth.estimate(depthInput);
            if (depthResult) {
              state.currentDepthMap = depthResult.depthMap;
              state.depthWidth = depthResult.width;
              state.depthHeight = depthResult.height;
              state.depthFrameId++;

              for (const det of state.currentDetections) {
                if (det.bbox) {
                  const cx = Math.floor((det.bbox[0] + det.bbox[2] / 2) * state.depthWidth);
                  const cy = Math.floor((det.bbox[1] + det.bbox[3] / 2) * state.depthHeight);
                  const idx = cy * state.depthWidth + cx;
                  if (idx >= 0 && idx < state.currentDepthMap.length) {
                    const relDepth = state.currentDepthMap[idx];
                    const meters = relDepth * 200;
                    det.distance = { meters, confidence: 0.6,
                      zone: meters < 50 ? 'RED' : meters < 150 ? 'AMBER' : 'GREEN' };
                  }
                }
              }
            }
          }
        } catch (err) {
          console.warn('[APP] Depth error:', err.message);
        }
      }

      // --- Intelligence Analysis ---
      if (state.missionActive && state.frameCount % state.intelCadence === 0) {
        runIntelligenceAnalysis();
      }

    } catch (err) {
      console.error('[APP] Perception error:', err);
    }

    state.perceptionBusy = false;
    requestAnimationFrame(processFrame);
  };

  requestAnimationFrame(processFrame);
}

// --- Cached DOM references for intel updates (avoid getElementById each frame) ---
const _domCache = {};
function _dom(id) {
  if (!_domCache[id]) _domCache[id] = document.getElementById(id);
  return _domCache[id];
}

function runIntelligenceAnalysis() {
  const mavenIntel = state.maven ? {
    sigint: state.maven.getLatest('sigint'),
    geoint: state.maven.getLatest('geoint'),
    humint: state.maven.getLatest('humint'),
    threat: state.maven.getLatest('threat'),
    environment: state.maven.getLatest('environment')
  } : null;

  // Scene classification
  const scene = sceneClassifier.classify(
    state.currentDetections,
    state.currentDepthMap,
    state.depthWidth,
    state.depthHeight
  );

  // Update scene display
  const sceneEl = _dom('scene-type');
  if (sceneEl) sceneEl.textContent = `SCENE: ${scene.type}`;

  // Terrain analysis
  const terrain = terrainAnalyzer.analyze(
    state.currentDepthMap, state.depthWidth, state.depthHeight,
    state.currentDetections, scene.type
  );
  terrainOverlay.update(terrain);

  // Feed OSINT data to threat engine for decision-making integration
  const osintSummary = osintFeeds.getTacticalSummary();
  threatEngine.setOSINTData(osintFeeds.data, osintSummary);

  // Full threat analysis (METT-TC integrated + OSINT-enhanced)
  state.currentAssessments = threatEngine.analyze(
    state.currentDetections,
    state.currentDepthMap, state.depthWidth, state.depthHeight,
    mavenIntel
  );

  // Update detection threat levels from assessments
  for (const assessment of state.currentAssessments) {
    const det = state.currentDetections.find(d => d.id === assessment.id);
    if (det) {
      det.threatLevel = assessment.threatLevel;
      det.classification = assessment.classification;
    }
  }

  // Update civilian overlay
  const civilData = civilAnalyzer.getCivilData();
  civilianOverlay.update(civilData);

  // Update drone overlay
  droneOverlay.update(droneManager.getFleetData(), droneManager.getTaskingData());

  // Update suit overlay
  suitOverlay.update(suitStatus.getStatus());

  // Update OSINT overlay (data updates via callback, but refresh heading)
  osintOverlay.setOperatorHeading(currentHeading || 0);

  // Update bottom bar (cached DOM refs)
  const threatCount = state.currentAssessments.filter(a => a.classification === 'HOSTILE').length;
  const civCount = civilData.civilianPresence?.classification?.civilian || 0;
  const threatSumEl = _dom('threat-summary');
  const civSumEl = _dom('civ-summary');
  if (threatSumEl) threatSumEl.textContent = `THREATS: ${threatCount}`;
  if (civSumEl) civSumEl.textContent = `CIV: ${civCount}`;

  // Update drone fleet DOM
  droneManager.updateDOM();
  suitStatus.updateDOM();

  // If threat panel is showing, update it with latest data
  if (threatPanel.isVisible()) {
    const trackId = threatPanel.getSelectedTrackId();
    const updated = state.currentAssessments.find(a => a.id === trackId);
    if (updated) threatPanel.show(updated);
  }
}

// =============================================================================
// Segmentation
// =============================================================================

async function runSegmentation(x, y) {
  if (!state.modelsLoaded.segmentor) return;
  try {
    console.log(`[APP] Running segmentation at (${x.toFixed(2)}, ${y.toFixed(2)})`);
    // Encode current frame first
    const canvas = renderer.getCanvas();
    const ctx = renderer.getContext();
    if (!canvas || !ctx) return;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    await state.segmentor.encode(imageData);
    const mask = await state.segmentor.segment(x, y);
    if (mask) {
      // Register temporary mask overlay
      const { renderSegmentationMask } = await import('./ui/hud-overlays.js');
      renderer.registerOverlay('segmentation', (ctx, w, h) => {
        renderSegmentationMask(ctx, w, h, mask.data, mask.width, mask.height, [0, 255, 204, 0.3]);
      }, 2.5); // Between terrain and detections

      // Remove mask after 5 seconds
      setTimeout(() => renderer.removeOverlay('segmentation'), 5000);
    }
  } catch (err) {
    console.error('[APP] Segmentation error:', err);
  }
}

// =============================================================================
// Utility Functions
// =============================================================================

// =============================================================================
// Compass / Device Orientation
// =============================================================================

let currentHeading = null;

function initCompass() {
  const strip = document.getElementById('compass-strip');
  const headingEl = document.getElementById('compass-heading');
  if (!strip || !headingEl) return;

  function updateCompass(heading) {
    currentHeading = heading;
    // Each span is 40px wide, 13 spans cover 0-360 with wrap
    // heading 0 = N centered. Offset strip so current heading aligns with center indicator
    const degreesPerSpan = 360 / 8; // 8 cardinal/intercardinal directions
    const pixelsPerDegree = 40 / degreesPerSpan;
    const offset = -(heading * pixelsPerDegree) + 100 - 20; // center in 200px container
    strip.style.transform = `translateX(${offset}px)`;
    headingEl.textContent = `${Math.round(heading)}\u00B0`;

    // Feed heading to OSINT overlay for relative bearing calculation
    osintOverlay.setOperatorHeading(heading);
  }

  function handleOrientation(e) {
    let heading = null;
    // iOS provides webkitCompassHeading (degrees from magnetic north)
    if (e.webkitCompassHeading !== undefined) {
      heading = e.webkitCompassHeading;
    } else if (e.alpha !== null) {
      // Android/other: alpha is degrees from arbitrary reference
      // Approximate compass heading (not perfect without absolute orientation)
      heading = (360 - e.alpha) % 360;
    }
    if (heading !== null) updateCompass(heading);
  }

  // iOS 13+ requires permission request for DeviceOrientation
  if (typeof DeviceOrientationEvent !== 'undefined' &&
      typeof DeviceOrientationEvent.requestPermission === 'function') {
    // Create a one-time touch handler to request permission (iOS requires user gesture)
    const requestPermission = async () => {
      try {
        const permission = await DeviceOrientationEvent.requestPermission();
        if (permission === 'granted') {
          window.addEventListener('deviceorientation', handleOrientation, true);
          console.log('[COMPASS] Device orientation permission granted');
        } else {
          console.warn('[COMPASS] Permission denied');
        }
      } catch (err) {
        console.warn('[COMPASS] Permission error:', err);
      }
      // Remove this one-time listener
      document.removeEventListener('click', requestPermission);
      document.removeEventListener('touchend', requestPermission);
    };
    // Attach to first user interaction
    document.addEventListener('click', requestPermission, { once: true });
    document.addEventListener('touchend', requestPermission, { once: true });
    console.log('[COMPASS] Waiting for user gesture to request orientation permission');
  } else if (typeof DeviceOrientationEvent !== 'undefined') {
    // Non-iOS: just listen directly
    window.addEventListener('deviceorientation', handleOrientation, true);
    console.log('[COMPASS] Device orientation listener added');
  } else {
    console.warn('[COMPASS] DeviceOrientation API not available');
    headingEl.textContent = 'N/A';
  }
}

// =============================================================================
// Geolocation
// =============================================================================

let lastGeoLookup = 0;

function initGeolocation() {
  const coordsEl = document.getElementById('geo-coords');
  const locationEl = document.getElementById('geo-location');
  if (!coordsEl || !locationEl) return;

  if (!navigator.geolocation) {
    coordsEl.textContent = 'NO GPS';
    locationEl.textContent = 'UNAVAILABLE';
    return;
  }

  navigator.geolocation.watchPosition(
    (pos) => {
      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;
      coordsEl.textContent = `${lat.toFixed(5)}, ${lon.toFixed(5)}`;

      // Feed position to OSINT feeds
      osintFeeds.setPosition(lat, lon);

      // Reverse geocode for city/state (rate limited to every 30s)
      const now = Date.now();
      if (now - lastGeoLookup > 30000) {
        lastGeoLookup = now;
        reverseGeocode(lat, lon, locationEl);
      }
    },
    (err) => {
      console.warn('[GEO] Error:', err.message);
      coordsEl.textContent = 'NO SIGNAL';
      locationEl.textContent = err.code === 1 ? 'DENIED' : 'ERROR';
    },
    { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
  );
}

async function reverseGeocode(lat, lon, el) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=10`;
    const resp = await fetch(url, {
      headers: { 'Accept': 'application/json' }
    });
    if (!resp.ok) return;
    const data = await resp.json();
    const addr = data.address || {};
    const city = addr.city || addr.town || addr.village || addr.county || '';
    const state = addr.state || '';
    if (city && state) {
      el.textContent = `${city}, ${state}`.toUpperCase();
    } else if (city || state) {
      el.textContent = (city || state).toUpperCase();
    }
  } catch (err) {
    console.warn('[GEO] Reverse geocode failed:', err.message);
  }
}

// =============================================================================
// OSINT Initialization
// =============================================================================

function initOSINT() {
  // Register OSINT data update callback
  osintFeeds.onUpdate((data) => {
    const summary = osintFeeds.getTacticalSummary();
    osintOverlay.update(data, summary);
  });

  // OSINT toggle button
  const toggleBtn = document.getElementById('osint-toggle');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      osintOverlay.togglePanel();
    });
  }

  // OSINT panel close button
  const closeBtn = document.getElementById('osint-panel-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      osintOverlay.hidePanel();
    });
  }

  // Start feeds (they'll wait for GPS position before first fetch)
  osintFeeds.start();

  // Trigger initial overlay update so widgets show status immediately
  osintOverlay.update(osintFeeds.data, osintFeeds.getTacticalSummary());
}

// =============================================================================
// Voice Command System
// =============================================================================

function initSpeech() {
  if (!speechEngine.isAvailable()) return;

  // Wire up data providers so speech engine can generate reports
  speechEngine.setDataProviders({
    getState: () => state,
    getOsint: () => osintFeeds.getTacticalSummary(),
    getDrones: () => droneManager.getFleetData(),
    getSuit: () => suitStatus.getStatus(),
    getMission: () => state.missionContext?.getContext?.() || state.missionContext,
    getAssessments: () => state.currentAssessments,
    getTerrain: () => terrainAnalyzer.getLastAnalysis()
  });

  // Wire up action callbacks
  speechEngine.onToggleTerrain(() => terrainOverlay.toggle());
  speechEngine.onShowOsint(() => osintOverlay.togglePanel());
  speechEngine.onRecallDrones(() => {
    const fleet = droneManager.getFleetData();
    if (fleet?.fleet) {
      for (const drone of fleet.fleet) {
        if (drone.status === 'ACTIVE' || drone.status === 'TASKED') {
          droneTasking.issueTask(drone.id, 'RECOVER', {});
        }
      }
    }
  });

  // Status change → update button visual
  const voiceBtn = document.getElementById('voice-btn');
  const voiceIcon = document.getElementById('voice-icon');
  const voiceStatusEl = document.getElementById('voice-status');
  const transcriptEl = document.getElementById('voice-transcript');

  speechEngine.onStatusChange((status) => {
    if (!voiceBtn) return;
    voiceBtn.className = status !== 'idle' ? status : '';
    if (voiceStatusEl) {
      const labels = {
        idle: 'READY', listening: 'LISTENING', processing: 'PROCESSING',
        speaking: 'SPEAKING', denied: 'DENIED', error: 'ERROR'
      };
      voiceStatusEl.textContent = labels[status] || status.toUpperCase();
    }
    if (voiceIcon) {
      voiceIcon.textContent = status === 'listening' ? 'REC' :
                               status === 'speaking' ? 'SPK' : 'MIC';
    }
    // Hide transcript when idle
    if (status === 'idle' && transcriptEl) {
      setTimeout(() => {
        if (!speechEngine.isListening() && !speechEngine.isSpeaking()) {
          transcriptEl.classList.remove('visible');
        }
      }, 2000);
    }
  });

  // Transcript display
  speechEngine.onTranscript((text, isFinal) => {
    if (!transcriptEl) return;
    transcriptEl.textContent = text.toUpperCase();
    transcriptEl.classList.add('visible');
    transcriptEl.classList.toggle('final', isFinal);
  });

  // Push-to-talk button
  if (voiceBtn) {
    voiceBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (speechEngine.isSpeaking()) {
        speechEngine.stopSpeaking();
      } else if (speechEngine.isListening()) {
        speechEngine.stopListening();
      } else {
        speechEngine.startListening();
      }
    });

    // Also handle touchstart/touchend for press-and-hold
    voiceBtn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (speechEngine.isSpeaking()) {
        speechEngine.stopSpeaking();
        return;
      }
      speechEngine.startListening();
    }, { passive: false });

    voiceBtn.addEventListener('touchend', (e) => {
      e.preventDefault();
      e.stopPropagation();
      // Let recognition finish naturally - it stops when user stops speaking
    }, { passive: false });
  }
}

// =============================================================================
// Utility Functions
// =============================================================================

function mapTacticalClass(cocoClass) {
  const mapping = {
    person: 'PERSONNEL',
    car: 'VEHICLE', truck: 'VEHICLE', bus: 'VEHICLE',
    motorcycle: 'LIGHT_VEHICLE', bicycle: 'LIGHT_VEHICLE',
    airplane: 'AIRCRAFT',
    cell_phone: 'COMMS_EQUIPMENT', laptop: 'COMMS_EQUIPMENT',
    backpack: 'SUPPLY', suitcase: 'SUPPLY', handbag: 'SUPPLY',
    knife: 'EDGED_WEAPON', scissors: 'EDGED_WEAPON'
  };
  return mapping[cocoClass] || 'UNKNOWN';
}

function getMovementHeading(velocity) {
  if (!velocity) return 'STATIONARY';
  const [vx, vy] = velocity;
  const speed = Math.sqrt(vx * vx + vy * vy);
  if (speed < 0.002) return 'STATIONARY';
  // vy positive = moving down in screen = approaching
  if (vy > Math.abs(vx) * 0.5) return 'APPROACHING';
  if (vy < -Math.abs(vx) * 0.5) return 'RETREATING';
  if (vx > 0) return 'LATERAL_RIGHT';
  return 'LATERAL_LEFT';
}

function updateModelStatus() {
  const el = document.getElementById('model-status');
  if (!el) return;
  const loaded = Object.values(state.modelsLoaded).filter(v => v).length;
  const total = Object.keys(state.modelsLoaded).length;
  el.textContent = `MODELS: ${loaded}/${total}`;
  el.style.color = loaded === total ? 'var(--hud-primary)' :
                   loaded > 0 ? 'var(--hud-caution)' : 'var(--hud-hostile)';
}

// =============================================================================
// Launch
// =============================================================================

document.addEventListener('DOMContentLoaded', () => {
  boot().catch(err => {
    console.error('[APP] Boot failed:', err);
    logBoot('FATAL: Boot sequence failed', 'error');
  });
});
