const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const GAME_KEYS = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'Space', 'ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight', 'KeyC', 'KeyQ', 'KeyE',
]);

export class Input {
  constructor() {
    this.keys = new Set();
    this.jumpQueued = false;
    this.camQueued = false;
    this.pauseQueued = false;
    this.playing = false;
    this.onPause = null;
    this.touch = { throttle: 0, steer: 0, jump: false, boost: false, drift: false, active: false };
    this.touchJumpQueued = false;
    this.padJumpPrev = false;
    this.padCamPrev = false;
    this.pad = { throttle: 0, steer: 0, jump: false, boost: false, drift: false, cam: false };
    this.touchBound = false;
    this.joystickPointer = null;

    window.addEventListener('keydown', (e) => {
      if (e.target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
      if (GAME_KEYS.has(e.code) && this.playing) e.preventDefault();
      if (e.code === 'Space' && !e.repeat) this.jumpQueued = true;
      if (e.code === 'KeyC' && !e.repeat) this.camQueued = true;
      if (e.code === 'Escape') this.onPause?.();
      this.keys.add(e.code);
    }, { passive: false });

    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
    });

    window.addEventListener('blur', () => {
      this.keys.clear();
      this.touch.boost = false;
      this.touch.drift = false;
      this.touch.jump = false;
    });
  }

  setPlaying(v) {
    this.playing = v;
    if (!v) this.keys.clear();
  }

  read() {
    const k = this.keys;
    let throttle = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
    let steer = (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0) - (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0);
    let boost = k.has('ShiftLeft') || k.has('ShiftRight');
    let drift = k.has('ControlLeft') || k.has('ControlRight');
    let jumpPressed = this.jumpQueued;
    this.jumpQueued = false;

    const cameraToggle = this.camQueued;
    this.camQueued = false;

    // Gamepad
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const pad = pads && Array.from(pads).find((p) => p && p.connected);
    if (pad) {
      const ax = pad.axes[0] || 0;
      const ay = pad.axes[1] || 0;
      const dz = (v) => (Math.abs(v) < 0.16 ? 0 : (v - Math.sign(v) * 0.16) / 0.84);
      if (Math.abs(ax) > 0.16 || Math.abs(ay) > 0.16) {
        steer = -dz(ax);
        throttle = -dz(ay);
      }
      const b = pad.buttons;
      const padJump = !!(b[0]?.pressed || b[3]?.pressed);
      if (padJump && !this.padJumpPrev) jumpPressed = true;
      this.padJumpPrev = padJump;
      if (b[1]?.pressed || b[7]?.pressed || b[7]?.value > 0.3) boost = true;
      if (b[2]?.pressed || b[4]?.pressed) drift = true;
      const padCam = !!(b[5]?.pressed || b[9]?.pressed);
      if (padCam && !this.padCamPrev) this.camQueued = true;
      this.padCamPrev = padCam;
    }

    if (this.touch.active) {
      throttle = clamp(throttle + this.touch.throttle, -1, 1);
      steer = clamp(steer - this.touch.steer, -1, 1);
      boost = boost || this.touch.boost;
      drift = drift || this.touch.drift;
      if (this.touch.jump && !this.touch.jumpHeld) { jumpPressed = true; this.touch.jumpHeld = true; }
      if (!this.touch.jump) this.touch.jumpHeld = false;
      if (this.touchJumpQueued) { jumpPressed = true; this.touchJumpQueued = false; }
    }

    return {
      throttle, steer, boost, drift, jumpPressed,
      cameraToggle: cameraToggle || this.camQueued,
      airRoll: (k.has('KeyE') ? 1 : 0) - (k.has('KeyQ') ? 1 : 0),
    };
  }

  bindTouch() {
    if (this.touchBound) return;
    this.touchBound = true;
    const zone = document.getElementById('joy-zone');
    const stick = document.getElementById('joy-stick');
    const jump = document.getElementById('tb-jump');
    const boost = document.getElementById('tb-boost');
    const drift = document.getElementById('tb-drift');
    const cam = document.getElementById('tb-cam');
    if (!zone || !stick) return;
    this.touch.active = true;

    const setStick = (e) => {
      const rect = zone.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      let dx = (e.clientX - cx) / (rect.width / 2);
      let dy = (e.clientY - cy) / (rect.height / 2);
      const len = Math.hypot(dx, dy);
      if (len > 1) { dx /= len; dy /= len; }
      this.touch.steer = dx;
      this.touch.throttle = -dy;
      stick.style.transform = `translate(${dx * 38}px, ${dy * 38}px)`;
    };
    const resetStick = () => {
      this.touch.steer = 0; this.touch.throttle = 0;
      this.joystickPointer = null;
      stick.style.transform = '';
    };
    zone.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.joystickPointer = e.pointerId;
      zone.setPointerCapture?.(e.pointerId);
      setStick(e);
    });
    zone.addEventListener('pointermove', (e) => {
      if (this.joystickPointer !== e.pointerId) return;
      setStick(e);
    });
    zone.addEventListener('pointerup', resetStick);
    zone.addEventListener('pointercancel', resetStick);

    const hold = (el, prop) => {
      if (!el) return;
      const on = (e) => { e.preventDefault(); this.touch[prop] = true; el.classList.add('on'); };
      const off = (e) => { e.preventDefault(); this.touch[prop] = false; el.classList.remove('on'); };
      el.addEventListener('pointerdown', on);
      el.addEventListener('pointerup', off);
      el.addEventListener('pointercancel', off);
      el.addEventListener('pointerleave', off);
    };
    hold(jump, 'jump');
    hold(boost, 'boost');
    hold(drift, 'drift');
    if (cam) cam.addEventListener('pointerdown', (e) => { e.preventDefault(); this.touchJumpQueued = false; this.camQueued = true; });
    const menuBtn = document.getElementById('tb-menu');
    if (menuBtn) menuBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); this.onPause?.(); });
  }

  setTouchVisible(visible) {
    const el = document.getElementById('touch-controls');
    if (!el) return;
    el.classList.toggle('visible', !!visible);
    el.classList.toggle('hidden', !visible);
  }
}
