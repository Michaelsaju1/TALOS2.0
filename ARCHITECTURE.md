# TALOS 2.0 - Architecture Document

## Tactical Augmented Logistics & Operations System
### Exoskeleton Drone Command HUD

---

## 1. System Overview

TALOS 2.0 is a tactical AR heads-up display designed for a single operator wearing an exoskeleton suit who commands a fleet of autonomous drones. The system runs as a Progressive Web App (PWA) on an iPhone, using the rear camera as a live sensor feed with real-time ML-powered perception, intelligence analysis, and drone command overlaid on the camera view.

**Core Concept**: The operator is simultaneously the commander, sensor platform, and C2 node. Combat power is projected through drones, not direct engagement. The HUD is the operator's primary interface for perceiving the battlefield, managing drone assets, and executing missions.

### Key Design Principles

1. **METT-TC is the backbone** - Every output is grounded in the Army's decision-making framework
2. **Drone-centric COAs** - All courses of action involve tasking drones, not direct operator engagement
3. **Perception before intelligence** - Raw detection feeds into tracking, which feeds into METT-TC analysis
4. **No COA without feasibility** - Every recommendation checked against troops, time, terrain, and civilians
5. **Civilians are not optional** - ROE enforcement at every level, ASCOPE analysis, collateral damage estimation
6. **Speed over precision** - Fast "good enough" beats slow perfect in tactical scenarios
7. **Glance-and-decide** - Threat level visible in <1 second via color coding
8. **Graceful degradation** - Every model failure has a fallback
9. **Client-side only** - No server required for core functionality
10. **ONNX-first** - All models via ONNX Runtime Web for WebGPU acceleration

---

## 2. Architecture Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                     iPhone Camera                            │
│                (getUserMedia API, rear camera)                │
└──────────────────────────┬───────────────────────────────────┘
                           │ video frames
                           ▼
┌──────────────────────────────────────────────────────────────┐
│                   PERCEPTION LAYER                           │
│                                                              │
│  ┌────────────┐  ┌──────────────────┐  ┌────────────────┐   │
│  │  YOLO11n   │  │ Depth Anything   │  │  MobileSAM     │   │
│  │ (Detection)│  │ V2 Small (Depth) │  │ (Segmentation) │   │
│  │ Every frame│  │ Every 3rd frame  │  │ On-demand/tap  │   │
│  └─────┬──────┘  └────────┬─────────┘  └───────┬────────┘   │
│  ┌─────┴──────────────────┴─────────────────────┘            │
│  │  ByteTrack (Object Tracking - Pure JS, <1ms)              │
│  └─────┬─────────────────────────────────────────            │
└────────┼─────────────────────────────────────────────────────┘
         ▼
┌──────────────────────────────────────────────────────────────┐
│              INTELLIGENCE LAYER (METT-TC Framework)          │
│                                                              │
│  ┌─────────────┐ ┌─────────────┐ ┌───────────────────────┐  │
│  │   Mission    │ │   Enemy     │ │  Terrain (OAKOC)      │  │
│  │   Context    │ │  Analyzer   │ │  Terrain Analyzer     │  │
│  └──────┬──────┘ └──────┬──────┘ └───────────┬───────────┘  │
│  ┌──────┴──────┐ ┌──────┴──────┐ ┌───────────┴───────────┐  │
│  │   Troops    │ │    Time     │ │  Civil Considerations  │  │
│  │ (Drone Mgr) │ │  Manager   │ │  (ASCOPE + ROE)        │  │
│  └──────┬──────┘ └──────┬──────┘ └───────────┬───────────┘  │
│         └───────────────┴───────────────────┬─┘              │
│                    THREAT ENGINE             │                │
│                (METT-TC Integrated)          │                │
└─────────────────────────┬────────────────────────────────────┘
                          ▼
┌──────────────────────────────────────────────────────────────┐
│                    DISPLAY LAYER                             │
│  Camera Feed → Depth → Terrain → Detections → Civilians     │
│  → Drones → Suit Status → HUD Chrome                        │
│  Touch: Tap/LongPress/DoubleTap/Swipe/3-finger              │
└──────────────────────────────────────────────────────────────┘
```

---

## 3. Model Selection Decisions

### YOLO11n (Object Detection)

| Factor | Decision |
|--------|----------|
| **Why over COCO-SSD** | 39.5 vs ~25 mAP. 2.6M params. Same model size (~5-6 MB). Strictly superior. |
| **Why nano variant** | Must run every frame for responsive HUD. 15-20 FPS on iPhone WebGPU at 320x320. |
| **Why ONNX over TF.js** | ONNX Runtime Web with WebGPU is 2-5x faster. Proven YOLO browser implementations exist. |
| **Limitation** | COCO's 80 classes don't include military equipment. We map to tactical categories. |

### Depth Anything V2 Small (Depth Estimation)

| Factor | Decision |
|--------|----------|
| **Why over heuristics** | Per-pixel depth of entire scene vs only detected objects. Soldier needs depth to terrain, cover, buildings. |
| **Why V2 Small** | 24.8M params, ~18-26 MB quantized. Fits within iPhone Safari's 256 MB Metal buffer. |
| **Why every 3rd frame** | Depth changes slowly. Save GPU for detection. Interpolate between frames. |
| **Why quantized** | INT8 reduces ~97 MB to ~18-26 MB with minimal accuracy loss. |

### MobileSAM (Segmentation)

| Factor | Decision |
|--------|----------|
| **Why SAM at all** | Bounding boxes show location. Segmentation shows exposure, cover quality, precise boundaries. |
| **Why MobileSAM** | ~5M param encoder, ~30-40 MB ONNX. Working browser demo exists. SAM 2 is 632M+ - won't run in browser. |
| **Why on-demand** | 3 models every frame would drop to <5 FPS. Tap a target → run segmentation. |

### ByteTrack (Object Tracking)

| Factor | Decision |
|--------|----------|
| **Why tracking** | Without it: flickering detections, no movement analysis, no approach speed. HUD unusable. |
| **Why ByteTrack** | SOTA tracker. Pure algorithm (Kalman + Hungarian). No neural network. <1ms per frame in JS. |
| **What it enables** | Persistent IDs, movement vectors, approach/retreat detection, group formation analysis. |

### V-JEPA / I-JEPA: NOT USED

| Factor | Decision |
|--------|----------|
| **Why excluded** | 1.2B-1.6B parameters. Cannot run in browser. |
| **What we take** | JEPA's predict-future-states concept → Kalman filters in ByteTrack achieve practical goal without cost. |

### Combined Model Budget

| Model | ONNX Size | Active GPU Memory | Frequency |
|-------|-----------|-------------------|-----------|
| YOLO11n | ~5-6 MB | ~20-30 MB | Every frame |
| Depth Anything V2 Small | ~18-26 MB | ~50-80 MB | Every 3rd frame |
| MobileSAM | ~30-40 MB | ~40-60 MB | On-demand |
| ByteTrack | 0 (pure JS) | Negligible | Every frame |
| **TOTAL** | **~55-75 MB** | **~110-170 MB** | |

Well within iPhone Safari's 256 MB Metal buffer limit.

---

## 4. METT-TC Framework Implementation

### M - Mission (mission-context.js)

Defines operational context that drives ALL analysis. Mission types:
- **OFFENSE**: Prioritizes enemy detection, avenue identification, weakness exploitation
- **DEFENSE**: Prioritizes key terrain, engagement areas, early warning
- **STABILITY**: Prioritizes civilian considerations, pattern-of-life, ROE enforcement
- **RECON**: Prioritizes maximum detection, terrain mapping, avoiding detection

Each mission includes: task & purpose, commander's intent, phase, PIR, ROE, fleet composition.

### E - Enemy (enemy-analyzer.js)

Goes beyond detection to analyze:
- **Composition**: Group tracked detections into tactical units (fire team, squad, platoon)
- **Disposition**: Where they are relative to terrain, formation analysis
- **Strength**: Force ratio calculation, equipment comparison
- **MPCOA**: Most Probable Course of Action based on movement + terrain + doctrine
- **MDCOA**: Most Dangerous Course of Action from enemy's perspective
- **HVTs**: High-value targets identified by behavior and equipment
- **Decision Points**: Where/when enemy must commit to a COA

### T - Terrain (terrain-analyzer.js + scene-classifier.js)

Full OAKOC computational analysis from depth map:
- **O - Observation**: Line-of-sight analysis via depth gradients, dead space zones, fields of fire
- **A - Avenues**: Depth corridors = avenues of approach, classified MOUNTED/DISMOUNTED
- **K - Key Terrain**: Depth map local minima = elevated positions, chokepoints at avenue narrows
- **O - Obstacles**: Sharp depth edges = barriers, classified WALL/BERM with breach assessment
- **C - Cover/Concealment**: Depth discontinuities = cover positions with survivability scoring

Plus: Mobility assessment, countermobility recommendations, survivability (fighting position) analysis.

### T - Troops Available (drone-manager.js + drone-types.js)

The operator's troops ARE drones. Five types aligned to Warfighting Functions:
- **ISR** (Intelligence): Reconnaissance, overwatch, tracking, laser designation
- **STRIKE** (Fires): Precision engagement with loitering munitions
- **EW** (Protection): Jamming, SIGINT, counter-UAS, comms relay
- **CARGO** (Sustainment): Resupply delivery
- **SCREEN** (Maneuver): Perimeter security, early warning

Fleet manager tracks: type, position, battery, payload, health, task, sensor coverage.

### T - Time (time-manager.js)

Mission timeline and time-based feasibility:
- Phase lines with status tracking
- Enemy ETA calculations from ByteTrack movement vectors + depth distance
- COA time-feasibility filtering (removes COAs that can't complete before threat arrives)
- Decision point warnings

### C - Civil Considerations (civil-analyzer.js)

ASCOPE framework:
- **Civilian detection**: Multi-signal classification (behavior, context, equipment, Maven intel)
- **Protected structures**: Mosques, hospitals, schools identified and marked as no-fire zones
- **ROE enforcement**: WEAPONS_FREE / TIGHT / HOLD with automatic constraint checking
- **Collateral damage estimation**: Per-engagement CDE before COA recommendation
- **Density tracking**: Civilian density level affects available engagement types

---

## 5. Warfighting Functions Integration

| WfF | Module | Drone Role |
|-----|--------|-----------|
| **Movement & Maneuver** | terrain-analyzer, drone-tasking | Operator guidance + drone screening |
| **Intelligence** | detector, depth, maven-mock, drone ISR | Suit sensors + drone feeds = fused intel |
| **Fires** | drone-tasking, threat-engine | Strike drone engagement + target designation |
| **Sustainment** | drone-manager, suit-status | Drone battery/payload + suit power management |
| **Protection** | suit-status, drone-tasking | Suit armor + counter-UAS + EW jamming |
| **Mission Command** | mission-context, all UI | Operator IS commander. HUD IS C2 system. |

---

## 6. Threat Engine (threat-engine.js)

The brain. Composite threat scoring formula:

```
threatScore = 0.15 * classificationScore    // What is it? (doctrine)
            + 0.20 * proximityScore          // How close? (depth)
            + 0.15 * behaviorScore           // What's it doing? (tracker)
            + 0.10 * intelCorrelationScore   // Does Maven know?
            + 0.05 * exposureScore           // How exposed? (segmentation)
            + 0.10 * terrainAdvantage        // Terrain favor them?
            + 0.08 * avenueControl           // On avenue of approach?
            + 0.05 * keyTerrainProximity     // Near key terrain?
            + 0.07 * missionRelevance        // Affects mission?
            + 0.05 * timeUrgency             // How urgent?
```

COA generation applies 6 constraint filters:
1. **Mission alignment** - COAs ranked by mission type preference
2. **Enemy prediction** - Account for MPCOA/MDCOA
3. **Terrain** - Specific positions, avenues, obstacles
4. **Troops** - Only recommend what fleet can actually do
5. **Time** - Filter by time feasibility vs threat arrival
6. **Civil** - Check civilian constraints, downrank or block if ROE violated

---

## 7. File Structure

```
Iron_man/
├── index.html                    # Entry point + boot sequence
├── manifest.json                 # PWA manifest
├── sw.js                         # Service worker
├── ARCHITECTURE.md               # This document
├── .gitignore
├── css/hud.css                   # Tactical HUD theme
├── js/
│   ├── app.js                    # Bootstrap + main pipeline
│   ├── core/
│   │   ├── camera.js             # getUserMedia + iOS constraints
│   │   ├── renderer.js           # 30 FPS render loop + overlay compositing
│   │   └── performance.js        # Adaptive quality degradation
│   ├── perception/
│   │   ├── detector.js           # YOLO11n via ONNX Runtime Web
│   │   ├── depth.js              # Depth Anything V2 via ONNX
│   │   ├── segmentor.js          # MobileSAM via ONNX (on-demand)
│   │   └── tracker.js            # ByteTrack (Kalman + Hungarian)
│   ├── intel/
│   │   ├── maven-mock.js         # Simulated Maven Smart System
│   │   ├── threat-engine.js      # METT-TC integrated threat analysis
│   │   ├── terrain-analyzer.js   # OAKOC from depth map
│   │   ├── scene-classifier.js   # Environment classification
│   │   ├── enemy-analyzer.js     # MPCOA/MDCOA prediction
│   │   └── civil-analyzer.js     # ASCOPE + ROE enforcement
│   ├── mission/
│   │   ├── mission-context.js    # Mission type, intent, ROE
│   │   └── time-manager.js       # Timeline + ETA calculations
│   ├── drones/
│   │   ├── drone-types.js        # 5 drone type definitions
│   │   ├── drone-manager.js      # Fleet status + simulation
│   │   └── drone-tasking.js      # WfF-aligned task assignment
│   ├── suit/
│   │   └── suit-status.js        # Power, armor, systems, threats
│   ├── knowledge/
│   │   └── army-branches.js      # 24-branch doctrine database
│   └── ui/
│       ├── hud-elements.js       # Reticle, grid, detection boxes
│       ├── hud-overlays.js       # Depth visualization, masks
│       ├── terrain-overlay.js    # OAKOC visualization
│       ├── civilian-overlay.js   # Civilian markers, ROE zones
│       ├── drone-overlay.js      # Drone positions, tasking lines
│       ├── suit-overlay.js       # Armor silhouette, threat warnings
│       ├── threat-panel.js       # Full threat detail panel
│       ├── drone-command-panel.js# Drone tasking interface
│       ├── mission-panel.js      # Mission selection
│       └── touch-handler.js      # Gesture recognition
├── models/                       # ONNX model files (gitignored)
└── assets/icons/                 # PWA icons
```

---

## 8. Degradation Strategy

| Condition | Response |
|-----------|----------|
| FPS < 10 | Reduce depth frequency to every 5th frame |
| FPS < 7 | Disable depth estimation entirely |
| FPS < 5 | Reduce YOLO input to 240x240 |
| Model fails to load | Skip model, warn, continue with available |
| Camera denied | Show intel-only mode (Maven data) |
| Low battery (<15%) | Detection-only mode |
| WebGPU unavailable | WASM fallback |

---

## 9. Technology Stack

- **Runtime**: Browser (Safari iOS 26+ / Chrome)
- **ML Runtime**: ONNX Runtime Web 1.20.1 with WebGPU backend
- **Rendering**: Canvas 2D API at 30 FPS
- **Camera**: getUserMedia API with iOS-specific constraints
- **Deployment**: Progressive Web App (installable, offline-capable)
- **No server required**: All processing client-side

---

## 10. Future Integration Points

- **Real Maven API**: Swap `maven-mock.js` for API client - interface stays identical
- **Real drone control**: Swap simulated tasking for MAVLink/drone API commands
- **Suit telemetry**: Connect to actual exoskeleton sensor bus
- **Multi-operator mesh**: WebRTC for operator-to-operator data sharing
- **Fine-tuned YOLO**: Train on military equipment dataset for better tactical classification
