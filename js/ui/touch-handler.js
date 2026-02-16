// TALOS 2.0 - Touch/Gesture Handler
// Manages all touch interactions on the HUD

export class TouchHandler {
  constructor() {
    this.touchLayer = null;
    this.callbacks = {
      onTap: [],
      onLongPress: [],
      onDoubleTap: [],
      onSwipeDown: [],
      onSwipeRight: [],
      onThreeFingerTap: []
    };

    // Touch state
    this._touchStart = null;
    this._touchStartTime = 0;
    this._longPressTimer = null;
    this._lastTapTime = 0;
    this._lastTapPos = null;
    this._longPressFired = false;
    this._swipeDetected = false;
  }

  init() {
    this.touchLayer = document.getElementById('touch-layer');
    if (!this.touchLayer) return;

    this.touchLayer.addEventListener('touchstart', (e) => this._handleTouchStart(e), { passive: false });
    this.touchLayer.addEventListener('touchmove', (e) => this._handleTouchMove(e), { passive: false });
    this.touchLayer.addEventListener('touchend', (e) => this._handleTouchEnd(e), { passive: false });
    this.touchLayer.addEventListener('touchcancel', () => this._resetState());
  }

  onTap(cb) { this.callbacks.onTap.push(cb); }
  onLongPress(cb) { this.callbacks.onLongPress.push(cb); }
  onDoubleTap(cb) { this.callbacks.onDoubleTap.push(cb); }
  onSwipeDown(cb) { this.callbacks.onSwipeDown.push(cb); }
  onSwipeRight(cb) { this.callbacks.onSwipeRight.push(cb); }
  onThreeFingerTap(cb) { this.callbacks.onThreeFingerTap.push(cb); }

  _handleTouchStart(e) {
    // Three-finger tap detection
    if (e.touches.length === 3) {
      e.preventDefault();
      this._resetState();
      const pos = this._normalizeTouch(e.touches[0]);
      this._emit('onThreeFingerTap', pos);
      return;
    }

    if (e.touches.length !== 1) return;

    const touch = e.touches[0];
    this._touchStart = { x: touch.clientX, y: touch.clientY };
    this._touchStartTime = Date.now();
    this._longPressFired = false;
    this._swipeDetected = false;

    // Start long press timer
    this._longPressTimer = setTimeout(() => {
      if (!this._swipeDetected && this._touchStart) {
        this._longPressFired = true;
        this._emit('onLongPress', this._normalizeTouch(touch));
      }
    }, 500);
  }

  _handleTouchMove(e) {
    if (!this._touchStart || e.touches.length !== 1) return;

    const touch = e.touches[0];
    const dx = touch.clientX - this._touchStart.x;
    const dy = touch.clientY - this._touchStart.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Cancel long press if moved too far
    if (dist > 10) {
      clearTimeout(this._longPressTimer);
      this._longPressTimer = null;
    }

    // Detect swipe
    if (dist > 50 && !this._swipeDetected) {
      const elapsed = Date.now() - this._touchStartTime;
      if (elapsed < 500) {
        this._swipeDetected = true;
        clearTimeout(this._longPressTimer);

        if (dy > 50 && Math.abs(dx) < Math.abs(dy)) {
          e.preventDefault();
          this._emit('onSwipeDown', this._normalizeTouch(touch));
        } else if (dx > 50 && Math.abs(dx) > Math.abs(dy)) {
          e.preventDefault();
          this._emit('onSwipeRight', this._normalizeTouch(touch));
        }
      }
    }
  }

  _handleTouchEnd(e) {
    clearTimeout(this._longPressTimer);

    if (this._longPressFired || this._swipeDetected || !this._touchStart) {
      this._resetState();
      return;
    }

    const elapsed = Date.now() - this._touchStartTime;
    if (elapsed > 300) {
      this._resetState();
      return;
    }

    // It's a tap
    const pos = {
      x: this._touchStart.x / window.innerWidth,
      y: this._touchStart.y / window.innerHeight,
      timestamp: Date.now()
    };

    // Check for double tap
    const timeSinceLastTap = pos.timestamp - this._lastTapTime;
    if (timeSinceLastTap < 300 && this._lastTapPos) {
      const dist = Math.sqrt(
        Math.pow(pos.x - this._lastTapPos.x, 2) + Math.pow(pos.y - this._lastTapPos.y, 2)
      );
      if (dist < 0.05) {
        this._emit('onDoubleTap', pos);
        this._lastTapTime = 0;
        this._lastTapPos = null;
        this._resetState();
        return;
      }
    }

    // Single tap (with brief delay to check for double)
    this._lastTapTime = pos.timestamp;
    this._lastTapPos = pos;

    setTimeout(() => {
      if (Date.now() - this._lastTapTime >= 280) {
        this._emit('onTap', pos);
      }
    }, 300);

    this._resetState();
  }

  _normalizeTouch(touch) {
    return {
      x: touch.clientX / window.innerWidth,
      y: touch.clientY / window.innerHeight,
      timestamp: Date.now()
    };
  }

  _resetState() {
    this._touchStart = null;
    clearTimeout(this._longPressTimer);
    this._longPressTimer = null;
  }

  _emit(event, data) {
    for (const cb of this.callbacks[event]) {
      try { cb(data); } catch (err) { console.error(`[TOUCH] Error in ${event}:`, err); }
    }
  }
}

// Hit-test helper: check if normalized (x,y) falls within any detection bbox
export function hitTestDetections(x, y, detections) {
  if (!detections) return null;
  for (const det of detections) {
    if (!det.bbox) continue;
    const [bx, by, bw, bh] = det.bbox;
    if (x >= bx && x <= bx + bw && y >= by && y <= by + bh) {
      return det;
    }
  }
  return null;
}

export const touchHandler = new TouchHandler();
