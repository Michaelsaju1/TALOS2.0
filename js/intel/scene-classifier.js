// TALOS 2.0 - Scene Classifier
// Classifies current environment using YOLO detections + depth map analysis
// Terrain type fundamentally changes tactical analysis

const SCENE_TYPES = {
  URBAN: {
    label: 'URBAN',
    description: 'Built-up area with structures',
    infantryAdvantage: 'HIGH',
    armorAdvantage: 'LOW',
    coverAvailability: 'HIGH',
    observationRange: 'SHORT',
    engagementRange: '50-150m'
  },
  OPEN_TERRAIN: {
    label: 'OPEN',
    description: 'Open ground with minimal cover',
    infantryAdvantage: 'LOW',
    armorAdvantage: 'HIGH',
    coverAvailability: 'LOW',
    observationRange: 'LONG',
    engagementRange: '200-800m'
  },
  WOODED: {
    label: 'WOODED',
    description: 'Forested or heavily vegetated area',
    infantryAdvantage: 'HIGH',
    armorAdvantage: 'LOW',
    coverAvailability: 'HIGH',
    observationRange: 'SHORT',
    engagementRange: '25-100m'
  },
  MOUNTAINOUS: {
    label: 'MOUNTAIN',
    description: 'Mountainous or elevated terrain',
    infantryAdvantage: 'MEDIUM',
    armorAdvantage: 'VERY_LOW',
    coverAvailability: 'MEDIUM',
    observationRange: 'VARIABLE',
    engagementRange: '100-500m'
  },
  INTERIOR: {
    label: 'INTERIOR',
    description: 'Inside a building or structure',
    infantryAdvantage: 'VERY_HIGH',
    armorAdvantage: 'NONE',
    coverAvailability: 'MEDIUM',
    observationRange: 'VERY_SHORT',
    engagementRange: '5-25m'
  },
  MIXED: {
    label: 'MIXED',
    description: 'Mixed terrain types',
    infantryAdvantage: 'MEDIUM',
    armorAdvantage: 'MEDIUM',
    coverAvailability: 'MEDIUM',
    observationRange: 'MEDIUM',
    engagementRange: '50-300m'
  }
};

class SceneClassifier {
  constructor() {
    this.currentScene = SCENE_TYPES.MIXED;
    this.confidence = 0;
    this.history = []; // rolling window of classifications
    this.maxHistory = 10;
  }

  // Classify scene from detections and depth map
  classify(detections, depthMap, depthWidth, depthHeight) {
    const scores = {
      URBAN: 0, OPEN_TERRAIN: 0, WOODED: 0,
      MOUNTAINOUS: 0, INTERIOR: 0
    };

    // --- Detection-based signals ---
    if (detections && detections.length > 0) {
      const classes = detections.map(d => d.class);

      // Urban indicators
      const urbanObjects = ['car', 'truck', 'bus', 'traffic light', 'stop sign', 'fire hydrant', 'parking meter'];
      const urbanCount = classes.filter(c => urbanObjects.includes(c)).length;
      scores.URBAN += urbanCount * 0.3;

      // Interior indicators
      const interiorObjects = ['chair', 'couch', 'bed', 'dining table', 'tv', 'laptop', 'microwave', 'oven', 'refrigerator', 'sink', 'toilet'];
      const interiorCount = classes.filter(c => interiorObjects.includes(c)).length;
      scores.INTERIOR += interiorCount * 0.5;

      // Many persons in small area = possibly urban/interior
      const personCount = classes.filter(c => c === 'person').length;
      if (personCount > 3) scores.URBAN += 0.2;
    }

    // --- Depth-based signals ---
    if (depthMap && depthMap.length > 0) {
      const stats = this._analyzeDepthMap(depthMap, depthWidth, depthHeight);

      // Uniform shallow depth = interior
      if (stats.mean < 0.3 && stats.stdDev < 0.1) {
        scores.INTERIOR += 0.6;
      }

      // Extreme depth range = mountainous
      if (stats.range > 0.8 && stats.stdDev > 0.25) {
        scores.MOUNTAINOUS += 0.5;
      }

      // Uniform deep gradient = open terrain
      if (stats.mean > 0.5 && stats.stdDev < 0.15) {
        scores.OPEN_TERRAIN += 0.5;
      }

      // High variance with vertical elements = wooded/urban
      if (stats.stdDev > 0.15 && stats.stdDev < 0.25) {
        // Check for vertical discontinuities (buildings or trees)
        const verticalEdges = this._countVerticalEdges(depthMap, depthWidth, depthHeight);
        if (verticalEdges > 0.1) {
          scores.URBAN += 0.3;
          scores.WOODED += 0.2;
        }
      }

      // Moderate variance with no clear urban objects = wooded
      if (stats.stdDev > 0.12 && stats.mean > 0.3) {
        scores.WOODED += 0.15;
      }
    }

    // Find highest scoring scene type
    let maxScore = 0;
    let bestType = 'MIXED';
    for (const [type, score] of Object.entries(scores)) {
      if (score > maxScore) {
        maxScore = score;
        bestType = type;
      }
    }

    // Require minimum confidence
    const confidence = Math.min(1.0, maxScore);
    if (confidence < 0.3) {
      bestType = 'MIXED';
    }

    // Add to history for temporal smoothing
    this.history.push(bestType);
    if (this.history.length > this.maxHistory) this.history.shift();

    // Use mode of recent history for stability
    const smoothedType = this._getMode(this.history);
    this.currentScene = SCENE_TYPES[smoothedType] || SCENE_TYPES.MIXED;
    this.confidence = confidence;

    return {
      type: smoothedType,
      ...this.currentScene,
      confidence: this.confidence
    };
  }

  getCurrentScene() {
    return {
      type: Object.keys(SCENE_TYPES).find(k => SCENE_TYPES[k] === this.currentScene) || 'MIXED',
      ...this.currentScene,
      confidence: this.confidence
    };
  }

  _analyzeDepthMap(depthMap, w, h) {
    // Sample for performance (every 4th pixel)
    let sum = 0, count = 0, min = 1, max = 0;
    const step = 4;
    for (let i = 0; i < depthMap.length; i += step) {
      const v = depthMap[i];
      sum += v;
      count++;
      if (v < min) min = v;
      if (v > max) max = v;
    }
    const mean = sum / count;

    let variance = 0;
    for (let i = 0; i < depthMap.length; i += step) {
      const diff = depthMap[i] - mean;
      variance += diff * diff;
    }
    variance /= count;

    return { mean, stdDev: Math.sqrt(variance), min, max, range: max - min };
  }

  _countVerticalEdges(depthMap, w, h) {
    // Count sharp depth transitions in vertical direction (buildings, trees)
    let edgeCount = 0;
    let totalChecked = 0;
    const step = 8;
    const threshold = 0.15;

    for (let x = 0; x < w; x += step) {
      for (let y = step; y < h; y += step) {
        const curr = depthMap[y * w + x];
        const prev = depthMap[(y - step) * w + x];
        if (Math.abs(curr - prev) > threshold) edgeCount++;
        totalChecked++;
      }
    }

    return totalChecked > 0 ? edgeCount / totalChecked : 0;
  }

  _getMode(arr) {
    const freq = {};
    let maxCount = 0;
    let mode = arr[arr.length - 1];
    for (const val of arr) {
      freq[val] = (freq[val] || 0) + 1;
      if (freq[val] > maxCount) {
        maxCount = freq[val];
        mode = val;
      }
    }
    return mode;
  }
}

export const sceneClassifier = new SceneClassifier();
export { SCENE_TYPES };
