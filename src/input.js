// Bitmap-style physical input, touch buttons, and gamepad polling.
const KEYMAP = {
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  up: ['ArrowUp', 'KeyW'],
  down: ['ArrowDown', 'KeyS'],
  jump: ['Space', 'KeyW', 'ArrowUp'],
  attack: ['KeyJ', 'KeyX'],
  heavy: ['KeyK', 'KeyC'],
  rage: ['KeyL', 'KeyV'],
  dash: ['ShiftLeft', 'ShiftRight'],
  confirm: ['Enter', 'NumpadEnter', 'Space'],
  back: ['Escape', 'Backspace'],
  pause: ['Escape', 'KeyP'],
  credits: ['KeyC'],
};

const state = {
  down: new Set(),   // keyboard
  pad: new Set(),    // gamepad
  pressed: new Set(),
  pointer: { x: 240, y: 135, inside: false },
  clicks: [],
  touch: {},
  activeTouches: new Map(),
};

function addPressed(action) {
  state.pressed.add(action);
}

const eventCodeToActions = new Map();
for (const [action, codes] of Object.entries(KEYMAP)) {
  for (const code of codes) {
    if (!eventCodeToActions.has(code)) eventCodeToActions.set(code, []);
    eventCodeToActions.get(code).push(action);
  }
}

export const input = {
  init(canvas) {
    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab'].includes(e.code)) e.preventDefault();
      if (e.repeat) return;
      const actions = eventCodeToActions.get(e.code) || [];
      for (const a of actions) {
        state.down.add(a);
        addPressed(a);
      }
    });
    window.addEventListener('keyup', (e) => {
      const actions = eventCodeToActions.get(e.code) || [];
      for (const a of actions) state.down.delete(a);
    });
    window.addEventListener('blur', () => {
      state.down.clear();
      state.pad.clear();
      this.padPrev = {};
      state.activeTouches.clear();
      for (const k of Object.keys(state.touch)) state.touch[k] = false;
    });

    const toCanvas = (ev) => {
      const r = canvas.getBoundingClientRect();
      return {
        x: ((ev.clientX - r.left) / r.width) * 480,
        y: ((ev.clientY - r.top) / r.height) * 270,
      };
    };
    canvas.addEventListener('pointermove', (ev) => {
      const p = toCanvas(ev);
      state.pointer.x = p.x;
      state.pointer.y = p.y;
      state.pointer.inside = true;
    });
    canvas.addEventListener('pointerleave', () => { state.pointer.inside = false; });
    canvas.addEventListener('pointerdown', (ev) => {
      ev.preventDefault();
      const p = toCanvas(ev);
      state.pointer.x = p.x;
      state.pointer.y = p.y;
      state.pointer.inside = true;
      state.clicks.push(p);
      addPressed('attack'); // gameplay: tap the canvas to attack
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    // virtual touch buttons
    const buttons = document.querySelectorAll('[data-action]');
    for (const el of buttons) {
      const action = el.dataset.action;
      const on = (ev) => {
        ev.preventDefault();
        try { el.setPointerCapture?.(ev.pointerId); } catch {}
        state.touch[action] = true;
        state.activeTouches.set(ev.pointerId, action);
        addPressed(action);
      };
      const off = (ev) => {
        ev.preventDefault();
        state.touch[action] = false;
        if (state.activeTouches.get(ev.pointerId) === action) state.activeTouches.delete(ev.pointerId);
      };
      el.addEventListener('pointerdown', on);
      el.addEventListener('pointerup', off);
      el.addEventListener('pointercancel', off);
      el.addEventListener('pointerleave', (ev) => {
        if (ev.buttons === 0) state.touch[action] = false;
      });
    }
    const releasePointer = (ev) => {
      const action = state.activeTouches.get(ev.pointerId);
      if (action) {
        state.touch[action] = false;
        state.activeTouches.delete(ev.pointerId);
      }
    };
    window.addEventListener('pointerup', releasePointer);
    window.addEventListener('pointercancel', releasePointer);

    this.canvas = canvas;
    this.padPrev = {};
    this.padEnabled = true;
  },

  isDown(action) {
    return state.down.has(action) || state.pad.has(action) || !!state.touch[action];
  },

  justPressed(action) {
    return state.pressed.has(action);
  },

  consume(action) {
    state.pressed.delete(action);
  },

  consumeClick() {
    return state.clicks.shift() || null;
  },

  get pointer() { return state.pointer; },

  pollGamepad() {
    if (!navigator.getGamepads) return;
    const pads = navigator.getGamepads();
    let pad = null;
    for (const p of pads) if (p && p.connected) { pad = p; break; }
    if (!pad) {
      if (state.pad.size) state.pad.clear();
      this.padPrev = {};
      return;
    }
    const b = pad.buttons;
    const ax = pad.axes[0] || 0;
    const ay = pad.axes[1] || 0;
    const now = {
      left: !!(b[14]?.pressed) || ax < -0.45,
      right: !!(b[15]?.pressed) || ax > 0.45,
      up: !!(b[12]?.pressed) || ay < -0.55,
      down: !!(b[13]?.pressed) || ay > 0.55,
      attack: !!(b[0]?.pressed),
      jump: !!(b[2]?.pressed),
      dash: !!(b[1]?.pressed),
      rage: !!(b[3]?.pressed),
      confirm: !!(b[0]?.pressed) || !!(b[9]?.pressed),
      back: !!(b[1]?.pressed) || !!(b[8]?.pressed),
      pause: !!(b[9]?.pressed),
      heavy: !!(b[5]?.pressed) || !!(b[7]?.pressed),
      credits: false,
    };
    const prev = this.padPrev;
    for (const [action, on] of Object.entries(now)) {
      if (on && !prev[action]) addPressed(action);
      if (on) state.pad.add(action);
      else state.pad.delete(action);
    }
    this.padPrev = now;
  },

  endFrame() {
    state.pressed.clear();
    state.clicks.length = 0;
  },
};
