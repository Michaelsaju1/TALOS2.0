// TALOS 2.0 - Terrain Analysis Engine (T - Terrain in METT-TC)
// Computational OAKOC analysis using depth map + detections
// Thinks like a Combat Engineer: observation, avenues, key terrain, obstacles, cover

class TerrainAnalyzer {
  constructor() {
    this.lastAnalysis = null;
    this.analysisInterval = 3; // Analyze every N depth frames
    this.frameCounter = 0;
  }

  // Full OAKOC terrain analysis
  analyze(depthMap, depthWidth, depthHeight, detections, sceneType) {
    this.frameCounter++;
    // Only run full analysis periodically (expensive)
    if (this.lastAnalysis && this.frameCounter % this.analysisInterval !== 0) {
      return this.lastAnalysis;
    }

    if (!depthMap || depthMap.length === 0) {
      return this._emptyAnalysis(sceneType);
    }

    const observation = this._analyzeObservation(depthMap, depthWidth, depthHeight);
    const avenues = this._analyzeAvenues(depthMap, depthWidth, depthHeight, sceneType);
    const keyTerrain = this._analyzeKeyTerrain(depthMap, depthWidth, depthHeight, avenues);
    const obstacles = this._analyzeObstacles(depthMap, depthWidth, depthHeight, detections);
    const coverAndConcealment = this._analyzeCoverConcealment(depthMap, depthWidth, depthHeight, detections);

    this.lastAnalysis = {
      sceneType: sceneType || 'MIXED',
      oakoc: {
        observation,
        avenues,
        keyTerrain,
        obstacles,
        coverAndConcealment
      },
      mobility: this._assessMobility(avenues, obstacles),
      countermobility: this._assessCountermobility(avenues, obstacles),
      survivability: this._assessSurvivability(coverAndConcealment, observation)
    };

    return this.lastAnalysis;
  }

  getLastAnalysis() {
    return this.lastAnalysis;
  }

  // --- OBSERVATION & FIELDS OF FIRE ---

  _analyzeObservation(depthMap, w, h) {
    const fieldsOfFire = [];
    const deadSpace = [];
    const bestObservationPoints = [];

    // Analyze lines of sight from bottom-center (operator position)
    const numRays = 8;
    for (let i = 0; i < numRays; i++) {
      const angle = (i / numRays) * Math.PI - Math.PI / 2; // -90 to +90 degrees
      const bearing = Math.round((i / numRays) * 180);

      const ray = this._castRay(depthMap, w, h, 0.5, 0.95, angle);
      fieldsOfFire.push({
        bearing,
        range: ray.clearRange,
        clearance: ray.blocked ? 'BLOCKED' : 'CLEAR',
        blockedBy: ray.blockType
      });

      // Dead space behind obstacles
      if (ray.blocked && ray.blockPosition) {
        deadSpace.push({
          region: [ray.blockPosition[0] - 0.05, ray.blockPosition[1] - 0.05, 0.1, 0.1],
          behindObstacle: ray.blockType || 'OBSTACLE'
        });
      }
    }

    // Best observation points: high depth values near top of frame (elevated)
    const sampleStep = Math.max(1, Math.floor(w / 20));
    for (let sx = 0; sx < w; sx += sampleStep) {
      for (let sy = 0; sy < h * 0.5; sy += sampleStep) { // Top half
        const idx = sy * w + sx;
        if (idx >= depthMap.length) continue;
        const depth = depthMap[idx];

        // Low depth value at top = elevated nearby terrain
        if (depth < 0.3) {
          // Check if it has good lines of sight (depth increases around it)
          const advantage = this._calcObservationAdvantage(depthMap, w, h, sx, sy);
          if (advantage > 0.5) {
            bestObservationPoints.push({
              position: [sx / w, sy / h],
              advantage: Math.min(1, advantage)
            });
          }
        }
      }
    }

    // Keep only top 3 observation points
    bestObservationPoints.sort((a, b) => b.advantage - a.advantage);
    bestObservationPoints.splice(3);

    return { fieldsOfFire, deadSpace, bestObservationPoints };
  }

  // --- AVENUES OF APPROACH ---

  _analyzeAvenues(depthMap, w, h, sceneType) {
    const avenues = [];

    // Analyze depth channels: regions where depth forms consistent corridors
    // Sample horizontal slices to find consistent depth gradients
    const sliceCount = 5;
    const corridors = [];

    for (let slice = 0; slice < sliceCount; slice++) {
      const y = Math.floor((h * (slice + 1)) / (sliceCount + 1));
      const profile = [];

      for (let x = 0; x < w; x += 4) {
        const idx = y * w + x;
        if (idx < depthMap.length) {
          profile.push({ x: x / w, depth: depthMap[idx] });
        }
      }

      // Find low-variance (smooth) regions = potential avenues
      const smoothRegions = this._findSmoothRegions(profile, 0.08);
      corridors.push(...smoothRegions.map(r => ({ ...r, y: y / h })));
    }

    // Cluster corridors that are vertically aligned into avenues
    const clustered = this._clusterCorridors(corridors);

    let aveId = 1;
    for (const cluster of clustered) {
      const bearing = Math.round(Math.atan2(cluster.centerX - 0.5, 0.5 - cluster.centerY) * 180 / Math.PI + 180) % 360;
      const width = cluster.avgWidth;
      const isMounted = width > 0.15;

      // Detect chokepoints (narrowest parts of the avenue)
      const chokePoints = [];
      if (cluster.narrowest && cluster.narrowest.width < width * 0.5) {
        chokePoints.push({
          position: [cluster.narrowest.x, cluster.narrowest.y],
          width: cluster.narrowest.width * 100
        });
      }

      // Determine if this is a threat axis (approaches from top/sides toward bottom/center)
      const threatAxis = cluster.centerY < 0.6;

      avenues.push({
        id: `AVE-${aveId++}`,
        type: isMounted ? 'MOUNTED' : 'DISMOUNTED',
        bearing,
        width: width > 0.2 ? 'WIDE' : width > 0.1 ? 'MEDIUM' : 'NARROW',
        chokePoints,
        threatAxis,
        center: [cluster.centerX, cluster.centerY]
      });
    }

    // Ensure at least one avenue exists for HUD display
    if (avenues.length === 0) {
      avenues.push({
        id: 'AVE-1', type: 'DISMOUNTED', bearing: 0, width: 'MEDIUM',
        chokePoints: [], threatAxis: true, center: [0.5, 0.3]
      });
    }

    return avenues.slice(0, 4); // Max 4 avenues
  }

  // --- KEY TERRAIN ---

  _analyzeKeyTerrain(depthMap, w, h, avenues) {
    const keyTerrain = [];

    // Find high ground: local minima in depth map (close = elevated)
    const gridSize = 8;
    const cellW = Math.floor(w / gridSize);
    const cellH = Math.floor(h / gridSize);

    const cellDepths = [];
    for (let gy = 0; gy < gridSize; gy++) {
      for (let gx = 0; gx < gridSize; gx++) {
        let sum = 0, count = 0;
        for (let dy = 0; dy < cellH; dy += 2) {
          for (let dx = 0; dx < cellW; dx += 2) {
            const idx = (gy * cellH + dy) * w + (gx * cellW + dx);
            if (idx < depthMap.length) { sum += depthMap[idx]; count++; }
          }
        }
        cellDepths.push({
          gx, gy,
          cx: (gx + 0.5) / gridSize,
          cy: (gy + 0.5) / gridSize,
          avgDepth: count > 0 ? sum / count : 1
        });
      }
    }

    // Find cells that are closer (lower depth) than neighbors = elevated
    for (const cell of cellDepths) {
      const neighbors = cellDepths.filter(c =>
        Math.abs(c.gx - cell.gx) <= 1 && Math.abs(c.gy - cell.gy) <= 1 && c !== cell
      );
      const avgNeighborDepth = neighbors.reduce((s, n) => s + n.avgDepth, 0) / Math.max(1, neighbors.length);

      if (cell.avgDepth < avgNeighborDepth - 0.08) {
        // This cell is elevated relative to surroundings
        const controlsAvenues = avenues
          .filter(a => Math.abs(a.center[0] - cell.cx) < 0.3 && Math.abs(a.center[1] - cell.cy) < 0.3)
          .map(a => a.id);

        const tacticalValue = Math.min(1, (avgNeighborDepth - cell.avgDepth) * 3 + controlsAvenues.length * 0.2);

        keyTerrain.push({
          position: [cell.cx, cell.cy],
          type: 'HIGH_GROUND',
          controlsAvenues,
          tacticalValue
        });
      }
    }

    // Add chokepoints as key terrain
    for (const ave of avenues) {
      for (const cp of ave.chokePoints) {
        keyTerrain.push({
          position: cp.position,
          type: 'CHOKEPOINT',
          controlsAvenues: [ave.id],
          tacticalValue: 0.75
        });
      }
    }

    // Keep top 5
    keyTerrain.sort((a, b) => b.tacticalValue - a.tacticalValue);
    return keyTerrain.slice(0, 5);
  }

  // --- OBSTACLES ---

  _analyzeObstacles(depthMap, w, h, detections) {
    const obstacles = [];

    // Find sharp depth edges = vertical barriers
    const edgeThreshold = 0.2;
    const sampleStep = Math.max(1, Math.floor(w / 30));
    const edgeMap = [];

    for (let y = sampleStep; y < h - sampleStep; y += sampleStep) {
      for (let x = sampleStep; x < w - sampleStep; x += sampleStep) {
        const idx = y * w + x;
        if (idx >= depthMap.length) continue;

        const curr = depthMap[idx];
        const right = depthMap[idx + sampleStep] || curr;
        const down = depthMap[(y + sampleStep) * w + x] || curr;

        const hEdge = Math.abs(curr - right);
        const vEdge = Math.abs(curr - down);

        if (hEdge > edgeThreshold || vEdge > edgeThreshold) {
          edgeMap.push({ x: x / w, y: y / h, strength: Math.max(hEdge, vEdge) });
        }
      }
    }

    // Cluster edges into obstacles
    const clusters = this._clusterEdges(edgeMap);
    for (const cluster of clusters.slice(0, 5)) {
      const type = cluster.avgStrength > 0.35 ? 'WALL' : 'BERM';
      obstacles.push({
        position: [cluster.minX, cluster.minY, cluster.maxX - cluster.minX, cluster.maxY - cluster.minY],
        type,
        breachable: type !== 'WALL' || cluster.size < 5,
        breachMethod: type === 'WALL' ? 'Mechanical/explosive' : 'Manual/vehicle',
        favorsSide: 'DEFENDER'
      });
    }

    // Add detected large objects as obstacles
    if (detections) {
      for (const det of detections) {
        if (det.tacticalClass === 'VEHICLE' && det.bbox) {
          obstacles.push({
            position: det.bbox,
            type: 'VEHICLE_OBSTACLE',
            breachable: true,
            breachMethod: 'Bypass or push',
            favorsSide: 'NEUTRAL'
          });
        }
      }
    }

    return obstacles;
  }

  // --- COVER & CONCEALMENT ---

  _analyzeCoverConcealment(depthMap, w, h, detections) {
    const coverPositions = [];
    const concealmentZones = [];

    // Cover: objects with significant depth mass (sharp edges = vertical cover)
    const sampleStep = Math.max(1, Math.floor(w / 20));

    for (let y = Math.floor(h * 0.3); y < h; y += sampleStep) {
      for (let x = 0; x < w; x += sampleStep) {
        const idx = y * w + x;
        if (idx >= depthMap.length) continue;

        const depth = depthMap[idx];

        // Check for depth discontinuity (cover = something in front of deeper background)
        let hasEdge = false;
        let edgeStrength = 0;
        for (const [dx, dy] of [[sampleStep, 0], [-sampleStep, 0], [0, sampleStep], [0, -sampleStep]]) {
          const ni = (y + dy) * w + (x + dx);
          if (ni >= 0 && ni < depthMap.length) {
            const diff = depthMap[ni] - depth;
            if (diff > 0.1) { // Neighbor is deeper = this point is in front
              hasEdge = true;
              edgeStrength = Math.max(edgeStrength, diff);
            }
          }
        }

        if (hasEdge && edgeStrength > 0.12) {
          const quality = edgeStrength > 0.3 ? 'HARD_COVER' : 'PARTIAL_COVER';
          const exposureAngle = Math.round((1 - edgeStrength) * 90);

          // Check fields of fire from this position
          const fof = [];
          for (const ave of (this.lastAnalysis?.oakoc?.avenues || [])) {
            const dist = Math.sqrt(Math.pow(x / w - ave.center[0], 2) + Math.pow(y / h - ave.center[1], 2));
            if (dist < 0.4) fof.push(ave.id);
          }

          const survivabilityScore = Math.min(1, edgeStrength * 1.5 + fof.length * 0.15);

          coverPositions.push({
            position: [x / w, y / h],
            quality,
            exposureAngle,
            fieldsOfFire: fof,
            survivabilityScore
          });
        }
      }
    }

    // Sort by survivability and keep top positions
    coverPositions.sort((a, b) => b.survivabilityScore - a.survivabilityScore);

    // Concealment: high depth variance regions (foliage, broken terrain)
    const gridSize = 6;
    const cellW = Math.floor(w / gridSize);
    const cellH = Math.floor(h / gridSize);

    for (let gy = 0; gy < gridSize; gy++) {
      for (let gx = 0; gx < gridSize; gx++) {
        let sum = 0, sumSq = 0, count = 0;
        for (let dy = 0; dy < cellH; dy += 3) {
          for (let dx = 0; dx < cellW; dx += 3) {
            const idx = (gy * cellH + dy) * w + (gx * cellW + dx);
            if (idx < depthMap.length) {
              const v = depthMap[idx];
              sum += v; sumSq += v * v; count++;
            }
          }
        }
        if (count === 0) continue;
        const mean = sum / count;
        const variance = sumSq / count - mean * mean;

        if (variance > 0.01 && variance < 0.04) { // Moderate variance = broken ground/foliage
          concealmentZones.push({
            region: [gx / gridSize, gy / gridSize, 1 / gridSize, 1 / gridSize],
            type: variance > 0.025 ? 'BROKEN_GROUND' : 'FOLIAGE'
          });
        }
      }
    }

    return {
      coverPositions: coverPositions.slice(0, 8),
      concealmentZones: concealmentZones.slice(0, 6)
    };
  }

  // --- MOBILITY / COUNTERMOBILITY / SURVIVABILITY ---

  _assessMobility(avenues, obstacles) {
    const mountedRoutes = avenues.filter(a => a.type === 'MOUNTED').length;
    const dismountedRoutes = avenues.length;
    const blockingObstacles = obstacles.filter(o => o.breachable);

    return {
      assessment: mountedRoutes > 1 ? 'UNRESTRICTED' : mountedRoutes === 1 ? 'RESTRICTED' : 'SEVERELY_RESTRICTED',
      mountedRoutes,
      dismountedRoutes,
      breachSites: blockingObstacles.map(o => ({
        obstacle: o.type,
        method: o.breachMethod,
        effort: o.type === 'WALL' ? 'HIGH' : 'MEDIUM'
      }))
    };
  }

  _assessCountermobility(avenues, obstacles) {
    return {
      recommendedObstacles: avenues
        .filter(a => a.threatAxis)
        .map(a => ({
          position: a.chokePoints[0]?.position || a.center,
          type: a.type === 'MOUNTED' ? 'ANTI_VEHICLE' : 'WIRE_OBSTACLE',
          denies: a.id,
          reason: `Denies ${a.type.toLowerCase()} avenue of approach ${a.id}`
        }))
        .slice(0, 3)
    };
  }

  _assessSurvivability(coverAndConcealment, observation) {
    const bestPositions = coverAndConcealment.coverPositions
      .filter(c => c.survivabilityScore > 0.5)
      .map((c, i) => ({
        position: c.position,
        coverQuality: c.survivabilityScore,
        observationQuality: observation.bestObservationPoints.some(op =>
          Math.abs(op.position[0] - c.position[0]) < 0.2 && Math.abs(op.position[1] - c.position[1]) < 0.2
        ) ? 0.8 : 0.4,
        avenuesCovered: c.fieldsOfFire,
        recommendation: i === 0 ? 'PRIMARY' : i === 1 ? 'ALTERNATE' : 'SUPPLEMENTARY'
      }));

    return { bestFightingPositions: bestPositions.slice(0, 3) };
  }

  // --- Utility Methods ---

  _castRay(depthMap, w, h, startX, startY, angle) {
    const steps = 20;
    const dx = Math.cos(angle) / steps * 0.4;
    const dy = -Math.sin(angle) / steps * 0.4;
    let x = startX, y = startY;
    let prevDepth = 1;
    let clearRange = 0;

    for (let i = 0; i < steps; i++) {
      x += dx; y += dy;
      if (x < 0 || x >= 1 || y < 0 || y >= 1) break;

      const px = Math.floor(x * w);
      const py = Math.floor(y * h);
      const idx = py * w + px;
      if (idx < 0 || idx >= depthMap.length) break;

      const depth = depthMap[idx];
      if (i > 0 && Math.abs(depth - prevDepth) > 0.25) {
        return {
          blocked: true,
          clearRange: i / steps,
          blockPosition: [x, y],
          blockType: depth < prevDepth ? 'ELEVATED_TERRAIN' : 'DEPRESSION'
        };
      }
      prevDepth = depth;
      clearRange = (i + 1) / steps;
    }

    return { blocked: false, clearRange, blockPosition: null, blockType: null };
  }

  _findSmoothRegions(profile, threshold) {
    const regions = [];
    let start = null;

    for (let i = 1; i < profile.length; i++) {
      const diff = Math.abs(profile[i].depth - profile[i - 1].depth);
      if (diff < threshold) {
        if (start === null) start = i - 1;
      } else {
        if (start !== null && (i - start) > 3) {
          regions.push({
            startX: profile[start].x,
            endX: profile[i - 1].x,
            width: profile[i - 1].x - profile[start].x,
            centerX: (profile[start].x + profile[i - 1].x) / 2,
            avgDepth: profile.slice(start, i).reduce((s, p) => s + p.depth, 0) / (i - start)
          });
        }
        start = null;
      }
    }
    return regions;
  }

  _clusterCorridors(corridors) {
    if (corridors.length === 0) return [];
    const clusters = [];
    const used = new Set();

    for (let i = 0; i < corridors.length; i++) {
      if (used.has(i)) continue;
      const cluster = [corridors[i]];
      used.add(i);

      for (let j = i + 1; j < corridors.length; j++) {
        if (used.has(j)) continue;
        if (Math.abs(corridors[j].centerX - corridors[i].centerX) < 0.15) {
          cluster.push(corridors[j]);
          used.add(j);
        }
      }

      if (cluster.length >= 2) {
        const centerX = cluster.reduce((s, c) => s + c.centerX, 0) / cluster.length;
        const centerY = cluster.reduce((s, c) => s + c.y, 0) / cluster.length;
        const avgWidth = cluster.reduce((s, c) => s + c.width, 0) / cluster.length;
        const narrowest = cluster.reduce((min, c) =>
          !min || c.width < min.width ? { x: c.centerX, y: c.y, width: c.width } : min, null);

        clusters.push({ centerX, centerY, avgWidth, narrowest, size: cluster.length });
      }
    }

    return clusters;
  }

  _clusterEdges(edges) {
    if (edges.length === 0) return [];
    const clusters = [];
    const used = new Set();

    for (let i = 0; i < edges.length; i++) {
      if (used.has(i)) continue;
      const cluster = [edges[i]];
      used.add(i);

      for (let j = i + 1; j < edges.length; j++) {
        if (used.has(j)) continue;
        const dist = Math.sqrt(Math.pow(edges[i].x - edges[j].x, 2) + Math.pow(edges[i].y - edges[j].y, 2));
        if (dist < 0.08) {
          cluster.push(edges[j]);
          used.add(j);
        }
      }

      if (cluster.length >= 2) {
        const minX = Math.min(...cluster.map(e => e.x));
        const maxX = Math.max(...cluster.map(e => e.x));
        const minY = Math.min(...cluster.map(e => e.y));
        const maxY = Math.max(...cluster.map(e => e.y));
        const avgStrength = cluster.reduce((s, e) => s + e.strength, 0) / cluster.length;
        clusters.push({ minX, maxX, minY, maxY, avgStrength, size: cluster.length });
      }
    }

    return clusters;
  }

  _calcObservationAdvantage(depthMap, w, h, sx, sy) {
    // How much deeper is the surrounding area compared to this point?
    const centerDepth = depthMap[sy * w + sx] || 0.5;
    let deeperCount = 0, totalChecked = 0;
    const checkRadius = Math.floor(w / 10);

    for (let dy = -checkRadius; dy <= checkRadius; dy += Math.max(1, Math.floor(checkRadius / 3))) {
      for (let dx = -checkRadius; dx <= checkRadius; dx += Math.max(1, Math.floor(checkRadius / 3))) {
        const ny = sy + dy, nx = sx + dx;
        if (ny < 0 || ny >= h || nx < 0 || nx >= w) continue;
        const idx = ny * w + nx;
        if (idx < depthMap.length) {
          totalChecked++;
          if (depthMap[idx] > centerDepth + 0.05) deeperCount++;
        }
      }
    }

    return totalChecked > 0 ? deeperCount / totalChecked : 0;
  }

  _emptyAnalysis(sceneType) {
    return {
      sceneType: sceneType || 'UNKNOWN',
      oakoc: {
        observation: { fieldsOfFire: [], deadSpace: [], bestObservationPoints: [] },
        avenues: [{ id: 'AVE-1', type: 'DISMOUNTED', bearing: 0, width: 'UNKNOWN', chokePoints: [], threatAxis: true, center: [0.5, 0.3] }],
        keyTerrain: [],
        obstacles: [],
        coverAndConcealment: { coverPositions: [], concealmentZones: [] }
      },
      mobility: { assessment: 'UNKNOWN', mountedRoutes: 0, dismountedRoutes: 0, breachSites: [] },
      countermobility: { recommendedObstacles: [] },
      survivability: { bestFightingPositions: [] }
    };
  }
}

export const terrainAnalyzer = new TerrainAnalyzer();
