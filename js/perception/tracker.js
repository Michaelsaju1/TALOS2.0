// =============================================================================
// TALOS 2.0 - ByteTrack Multi-Object Tracker
// Pure JavaScript implementation with Kalman filtering and cascaded matching
// =============================================================================

/**
 * Track lifecycle states.
 */
export const TrackState = Object.freeze({
    TENTATIVE: 'TENTATIVE',   // Needs consecutive detections to confirm
    CONFIRMED: 'CONFIRMED',   // Actively tracked
    LOST:      'LOST',        // Temporarily missing
    DELETED:   'DELETED'      // Removed from tracking
});

// --- Configuration ---
const CONFIRM_FRAMES = 3;    // Consecutive detections to confirm a track
const MAX_AGE = 30;          // Frames before a LOST track is DELETED
const HIGH_CONF = 0.5;       // High confidence threshold for cascaded matching
const IOU_THRESHOLD = 0.3;   // Minimum IoU for valid match

// --- Kalman Filter ---
// State: [x, y, w, h, vx, vy, vw, vh]
// Measurement: [x, y, w, h]

class KalmanFilter {
    constructor(measurement) {
        const [x, y, w, h] = measurement;

        // State vector: position + velocity
        this.state = new Float64Array([x, y, w, h, 0, 0, 0, 0]);

        // State covariance (diagonal approximation for speed)
        this.P = new Float64Array([
            10, 10, 10, 10,   // position uncertainty
            100, 100, 100, 100 // velocity uncertainty (high initially)
        ]);

        // Process noise
        this.Q = new Float64Array([
            1, 1, 1, 1,   // position noise
            5, 5, 5, 5    // velocity noise
        ]);

        // Measurement noise
        this.R = new Float64Array([4, 4, 4, 4]);
    }

    /**
     * Predict next state (constant velocity model).
     * @returns {Float64Array} Predicted measurement [x, y, w, h]
     */
    predict() {
        // x = x + vx (for each dimension)
        this.state[0] += this.state[4];
        this.state[1] += this.state[5];
        this.state[2] += this.state[6];
        this.state[3] += this.state[7];

        // P = P + Q
        for (let i = 0; i < 8; i++) {
            this.P[i] += this.Q[i];
        }

        return this.getMeasurement();
    }

    /**
     * Update state with a new measurement.
     * @param {number[]} measurement - [x, y, w, h]
     */
    update(measurement) {
        for (let i = 0; i < 4; i++) {
            // Kalman gain: K = P / (P + R)
            const K = this.P[i] / (this.P[i] + this.R[i]);

            // Innovation (measurement residual)
            const innovation = measurement[i] - this.state[i];

            // State update
            this.state[i] += K * innovation;

            // Velocity update (learn velocity from position corrections)
            this.state[i + 4] += K * innovation * 0.5;

            // Covariance update: P = (1 - K) * P
            this.P[i] *= (1 - K);
        }

        // Decay velocity covariance towards steady state
        for (let i = 4; i < 8; i++) {
            const K = this.P[i] / (this.P[i] + this.R[i - 4] * 2);
            this.P[i] *= (1 - K * 0.3);
        }
    }

    /**
     * Get current measurement prediction.
     * @returns {number[]} [x, y, w, h]
     */
    getMeasurement() {
        return [this.state[0], this.state[1], this.state[2], this.state[3]];
    }

    /**
     * Get current velocity estimate.
     * @returns {number[]} [vx, vy, vw, vh]
     */
    getVelocity() {
        return [this.state[4], this.state[5], this.state[6], this.state[7]];
    }
}

// --- Track Object ---

class Track {
    /**
     * @param {number} id - Unique track ID
     * @param {number[]} bbox - Initial [x, y, w, h]
     * @param {string} className - COCO class name
     * @param {number} score - Detection confidence
     */
    constructor(id, bbox, className, score) {
        this.id = id;
        this.kf = new KalmanFilter(bbox);
        this.state = TrackState.TENTATIVE;
        this.age = 0;
        this.timeSinceUpdate = 0;
        this.consecutiveHits = 1;
        this.score = score;

        // Class voting: track which class is seen most often
        this.classHistory = {};
        this.classHistory[className] = 1;
        this.currentClass = className;
    }

    /**
     * Predict next position using Kalman filter.
     * @returns {number[]}
     */
    predict() {
        const predicted = this.kf.predict();
        this.age++;
        this.timeSinceUpdate++;
        return predicted;
    }

    /**
     * Update track with matched detection.
     * @param {number[]} bbox
     * @param {string} className
     * @param {number} score
     */
    update(bbox, className, score) {
        this.kf.update(bbox);
        this.timeSinceUpdate = 0;
        this.consecutiveHits++;
        this.score = score;

        // Update class voting
        this.classHistory[className] = (this.classHistory[className] || 0) + 1;

        // Current class = most voted
        let maxVotes = 0;
        for (const cls in this.classHistory) {
            if (this.classHistory[cls] > maxVotes) {
                maxVotes = this.classHistory[cls];
                this.currentClass = cls;
            }
        }

        // State transitions
        if (this.state === TrackState.TENTATIVE && this.consecutiveHits >= CONFIRM_FRAMES) {
            this.state = TrackState.CONFIRMED;
        } else if (this.state === TrackState.LOST) {
            this.state = TrackState.CONFIRMED;
            this.consecutiveHits = 1;
        }
    }

    /**
     * Mark track as having no match this frame.
     */
    markMissed() {
        this.consecutiveHits = 0;

        if (this.state === TrackState.TENTATIVE) {
            // Tentative tracks are immediately deleted if missed
            this.state = TrackState.DELETED;
        } else if (this.state === TrackState.CONFIRMED) {
            this.state = TrackState.LOST;
        }
        // LOST tracks remain LOST until timeSinceUpdate exceeds maxAge
    }

    /**
     * Get the current bounding box.
     * @returns {number[]} [x, y, w, h]
     */
    getBbox() {
        return this.kf.getMeasurement();
    }

    /**
     * Get current velocity.
     * @returns {number[]} [vx, vy]
     */
    getVelocity() {
        const vel = this.kf.getVelocity();
        return [vel[0], vel[1]];
    }
}

// --- IoU Computation ---

/**
 * Compute IoU between two bounding boxes [x, y, w, h].
 * @param {number[]} a
 * @param {number[]} b
 * @returns {number}
 */
function computeIoU(a, b) {
    const x1 = Math.max(a[0], b[0]);
    const y1 = Math.max(a[1], b[1]);
    const x2 = Math.min(a[0] + a[2], b[0] + b[2]);
    const y2 = Math.min(a[1] + a[3], b[1] + b[3]);

    const interW = Math.max(0, x2 - x1);
    const interH = Math.max(0, y2 - y1);
    const inter = interW * interH;

    const areaA = a[2] * a[3];
    const areaB = b[2] * b[3];
    const union = areaA + areaB - inter;

    return union > 0 ? inter / union : 0;
}

/**
 * Build cost matrix (1 - IoU) between tracks and detections.
 * @param {Track[]} tracks
 * @param {Array} detections
 * @returns {number[][]} Cost matrix [tracks x detections]
 */
function buildCostMatrix(tracks, detections) {
    const matrix = [];
    for (const track of tracks) {
        const row = [];
        const trackBbox = track.getBbox();
        for (const det of detections) {
            row.push(1 - computeIoU(trackBbox, det.bbox));
        }
        matrix.push(row);
    }
    return matrix;
}

/**
 * Greedy matching: iteratively assign best IoU pairs.
 * More robust than pure Hungarian for real-time use and simpler to implement.
 *
 * @param {number[][]} costMatrix - [tracks x detections], lower = better
 * @param {number} threshold - Maximum cost (1 - minIoU)
 * @returns {{matches: [number, number][], unmatchedTracks: number[], unmatchedDetections: number[]}}
 */
function greedyMatch(costMatrix, threshold) {
    const numTracks = costMatrix.length;
    const numDets = costMatrix[0]?.length || 0;

    if (numTracks === 0 || numDets === 0) {
        return {
            matches: [],
            unmatchedTracks: Array.from({ length: numTracks }, (_, i) => i),
            unmatchedDetections: Array.from({ length: numDets }, (_, i) => i)
        };
    }

    // Build list of all (cost, trackIdx, detIdx) pairs
    const pairs = [];
    for (let t = 0; t < numTracks; t++) {
        for (let d = 0; d < numDets; d++) {
            pairs.push({ cost: costMatrix[t][d], track: t, det: d });
        }
    }

    // Sort by cost ascending (best matches first)
    pairs.sort((a, b) => a.cost - b.cost);

    const matchedTracks = new Set();
    const matchedDets = new Set();
    const matches = [];

    for (const pair of pairs) {
        if (matchedTracks.has(pair.track) || matchedDets.has(pair.det)) continue;
        if (pair.cost > threshold) break; // No more valid matches possible

        matches.push([pair.track, pair.det]);
        matchedTracks.add(pair.track);
        matchedDets.add(pair.det);
    }

    const unmatchedTracks = [];
    for (let t = 0; t < numTracks; t++) {
        if (!matchedTracks.has(t)) unmatchedTracks.push(t);
    }

    const unmatchedDetections = [];
    for (let d = 0; d < numDets; d++) {
        if (!matchedDets.has(d)) unmatchedDetections.push(d);
    }

    return { matches, unmatchedTracks, unmatchedDetections };
}

// --- Main Tracker ---

export class Tracker {
    constructor() {
        /** @type {Track[]} All active tracks */
        this._tracks = [];

        /** @type {number} Next track ID */
        this._nextId = 1;

        /** @type {number} Maximum frames before deleting lost track */
        this._maxAge = MAX_AGE;

        console.log('[TRACKER] ByteTrack multi-object tracker initialized');
    }

    /**
     * Update tracker with new detections for the current frame.
     * Implements ByteTrack cascaded matching strategy.
     *
     * @param {Array<{class: string, score: number, bbox: number[]}>} detections
     * @returns {Array<{id: number, bbox: number[], velocity: number[], class: string,
     *           state: string, age: number}>}
     */
    update(detections) {
        // --- Step 1: Predict all existing tracks ---
        for (const track of this._tracks) {
            track.predict();
        }

        // --- Step 2: Split detections into high and low confidence ---
        const highDets = [];
        const lowDets = [];
        const highIndices = [];
        const lowIndices = [];

        for (let i = 0; i < detections.length; i++) {
            if (detections[i].score >= HIGH_CONF) {
                highDets.push(detections[i]);
                highIndices.push(i);
            } else {
                lowDets.push(detections[i]);
                lowIndices.push(i);
            }
        }

        // --- Step 3: Get active tracks (CONFIRMED and TENTATIVE) ---
        const activeTracks = [];
        const activeTrackIndices = [];

        for (let i = 0; i < this._tracks.length; i++) {
            const track = this._tracks[i];
            if (track.state !== TrackState.DELETED) {
                activeTracks.push(track);
                activeTrackIndices.push(i);
            }
        }

        // --- Step 4: First association - match high confidence detections ---
        let unmatchedTrackIndices;
        let unmatchedDetIndices;

        if (activeTracks.length > 0 && highDets.length > 0) {
            const costMatrix = buildCostMatrix(activeTracks, highDets);
            const result = greedyMatch(costMatrix, 1 - IOU_THRESHOLD);

            // Apply matches
            for (const [tIdx, dIdx] of result.matches) {
                const track = activeTracks[tIdx];
                const det = highDets[dIdx];
                track.update(det.bbox, det.class, det.score);
            }

            unmatchedTrackIndices = result.unmatchedTracks;
            unmatchedDetIndices = result.unmatchedDetections;
        } else {
            unmatchedTrackIndices = activeTracks.map((_, i) => i);
            unmatchedDetIndices = highDets.map((_, i) => i);
        }

        // --- Step 5: Second association - match remaining tracks with low confidence ---
        const remainingTracks = unmatchedTrackIndices.map(i => activeTracks[i]);
        const remainingTrackLocalIndices = unmatchedTrackIndices;

        if (remainingTracks.length > 0 && lowDets.length > 0) {
            const costMatrix = buildCostMatrix(remainingTracks, lowDets);
            const result = greedyMatch(costMatrix, 1 - IOU_THRESHOLD);

            // Apply matches
            for (const [tIdx, dIdx] of result.matches) {
                const track = remainingTracks[tIdx];
                const det = lowDets[dIdx];
                track.update(det.bbox, det.class, det.score);
            }

            // Mark still-unmatched tracks as missed
            for (const tIdx of result.unmatchedTracks) {
                remainingTracks[tIdx].markMissed();
            }

            // Unmatched low-confidence detections do NOT create new tracks
            // (ByteTrack design: only high-confidence creates new tracks)

            // Also add unmatched high-confidence detections to create new tracks
            unmatchedDetIndices = unmatchedDetIndices; // already set
        } else {
            // No low dets to match, mark all remaining tracks as missed
            for (const track of remainingTracks) {
                track.markMissed();
            }
        }

        // --- Step 6: Create new tracks from unmatched HIGH confidence detections ---
        for (const dIdx of unmatchedDetIndices) {
            const det = highDets[dIdx];
            const track = new Track(this._nextId++, det.bbox, det.class, det.score);
            this._tracks.push(track);
        }

        // --- Step 7: Remove dead tracks ---
        this._tracks = this._tracks.filter(track => {
            if (track.state === TrackState.DELETED) return false;
            if (track.state === TrackState.LOST && track.timeSinceUpdate > this._maxAge) {
                track.state = TrackState.DELETED;
                return false;
            }
            return true;
        });

        // --- Step 8: Build output ---
        return this._getOutput();
    }

    /**
     * Build the output array from current tracks.
     * Only returns CONFIRMED and LOST tracks (not TENTATIVE).
     *
     * @returns {Array<{id: number, bbox: number[], velocity: number[], class: string,
     *           state: string, age: number}>}
     * @private
     */
    _getOutput() {
        const output = [];

        for (const track of this._tracks) {
            // Only report confirmed or recently-lost tracks
            if (track.state === TrackState.CONFIRMED || track.state === TrackState.LOST) {
                const bbox = track.getBbox();
                output.push({
                    id: track.id,
                    bbox: [
                        Math.max(0, bbox[0]),
                        Math.max(0, bbox[1]),
                        Math.max(1, bbox[2]),
                        Math.max(1, bbox[3])
                    ],
                    velocity: track.getVelocity(),
                    class: track.currentClass,
                    state: track.state,
                    age: track.age
                });
            }
        }

        return output;
    }

    /**
     * Format a track ID for display (e.g., TRK-0001).
     * @param {number} id
     * @returns {string}
     */
    static formatId(id) {
        return `TRK-${String(id).padStart(4, '0')}`;
    }

    /**
     * Get count of active (CONFIRMED) tracks.
     * @returns {number}
     */
    getActiveCount() {
        return this._tracks.filter(t => t.state === TrackState.CONFIRMED).length;
    }

    /**
     * Get all tracks including tentative (for debugging).
     * @returns {Track[]}
     */
    getAllTracks() {
        return this._tracks;
    }

    /**
     * Reset the tracker, clearing all tracks.
     */
    reset() {
        this._tracks = [];
        this._nextId = 1;
        console.log('[TRACKER] Tracker reset');
    }
}
