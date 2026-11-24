import * as THREE from 'three';
import { ARENA, PHYS } from './constants.js';
import { carPhysicalStats, BODY_DIMS } from '../data/cars.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const tmpV = new THREE.Vector3();
const tmpV2 = new THREE.Vector3();
const tmpQ = new THREE.Quaternion();
const tmpE = new THREE.Euler();
const tmpM = new THREE.Matrix4();

const BIG_PADS = [
  [-31, -42], [31, -42], [-31, 42], [31, 42], [0, -22], [0, 22],
];
const SMALL_PADS = [
  [-17, -30], [17, -30], [-17, 30], [17, 30],
  [-28, -8], [28, -8], [-28, 8], [28, 8],
  [-9, -16], [9, -16], [-9, 16], [9, 16],
  [-20, 0], [20, 0],
];

export function spawnPositions(teamSize) {
  const layouts = {
    1: [[[0, -31]], [[0, 31]]],
    2: [[[-7, -29], [7, -39]], [[7, 29], [-7, 39]]],
    3: [[[-12, -38], [0, -29], [12, -38]], [[12, 38], [0, 29], [-12, 38]]],
  };
  return layouts[teamSize] || layouts[1];
}

let nextId = 1;

export class World {
  constructor({
    carSetups = [],
    theme,
    mode = 'ai',
    duration = 180,
    teamSize = 1,
    onEvent = null,
    authorative = true,
  } = {}) {
    this.theme = theme;
    this.mode = mode;
    this.duration = duration;
    this.teamSize = teamSize;
    this.onEvent = onEvent;
    this.authorative = authorative && mode !== 'online-guest';
    this.elapsed = 0;
    this.events = [];
    this.phase = 'countdown';
    this.countdown = ARENA.kickoffTime;
    this.matchTime = duration;
    this.overtime = false;
    this.score = [0, 0];
    this.goalTimer = 0;
    this.lastScorer = null;
    this.winner = null;
    this.demo = mode === 'demo';
    this.finished = false;
    this.ball = {
      pos: new THREE.Vector3(0, ARENA.ballRadius + 0.05, 0),
      vel: new THREE.Vector3(),
      radius: ARENA.ballRadius,
      lastTouch: null,
      lastHitTime: -1,
      hitSeq: 0,
    };
    this.cars = [];
    this.pads = [];
    this.padLayout();
    this.spawnCars(carSetups);
    this.resetKickoff(true);
    this.controllers = new Map();
  }

  padLayout() {
    for (const [x, z] of BIG_PADS) {
      this.pads.push({ x, z, big: true, active: true, timer: 0, radius: 4.2, respawn: 10 });
    }
    for (const [x, z] of SMALL_PADS) {
      this.pads.push({ x, z, big: false, active: true, timer: 0, radius: 2.6, respawn: 4 });
    }
  }

  spawnCars(setups) {
    const layout = spawnPositions(this.teamSize);
    const counts = [0, 0];
    setups.forEach((setup, i) => {
      const team = setup.team ?? (i % 2);
      const spawns = layout;
      const slot = counts[team]++;
      const [x, z] = spawns[team][slot % spawns[team].length];
      const stats = carPhysicalStats(setup.def);
      const dims = BODY_DIMS[setup.def.style] || BODY_DIMS.octane;
      const car = {
        id: setup.id || `car-${nextId++}`,
        def: setup.def,
        stats,
        team,
        name: setup.name || 'Piloto',
        isBot: !!setup.isBot,
        isLocal: !!setup.isLocal,
        isGuest: !!setup.isGuest,
        difficulty: setup.difficulty || 2,
        pos: new THREE.Vector3(x, 0, z),
        vel: new THREE.Vector3(),
        quat: new THREE.Quaternion(),
        yaw: team === 0 ? 0 : Math.PI,
        pitch: 0,
        roll: 0,
        boost: 33,
        onGround: true,
        jumps: 0,
        stun: 0,
        respawnAt: 0,
        hidden: false,
        boostActive: false,
        drifting: false,
        wheelSpin: 0,
        flip: null,
        hitCooldown: 0,
        lastInput: { throttle: 0, steer: 0, boost: false, drift: false, jumpPressed: false, airRoll: 0 },
        dims,
        centerY: clamp(dims.h * 0.52, 0.7, 1.05),
        halfW: dims.w / 2 + 0.06,
        halfL: dims.l / 2 + 0.06,
        spawn: new THREE.Vector3(x, 0, z),
        goals: 0,
        touches: 0,
        demos: 0,
        surface: 'ground',
        ai: setup.ai || null,
        aiTimer: 0,
        _dirty: true,
      };
      car.quat.setFromEuler(tmpE.set(car.pitch, car.yaw, car.roll, 'YXZ'));
      this.cars.push(car);
    });
  }

  setController(carId, fn) {
    this.controllers.set(carId, fn);
  }

  getCar(id) {
    return this.cars.find((c) => c.id === id);
  }

  localCar() {
    return this.cars.find((c) => c.isLocal);
  }

  emit(event) {
    this.events.push(event);
    this.onEvent?.(event);
  }

  resetKickoff(initial = false) {
    const layout = spawnPositions(this.teamSize);
    const counts = [0, 0];
    const spawns = layout;
    for (const car of this.cars) {
      const slot = counts[car.team]++;
      const [x, z] = spawns[car.team][slot % spawns[car.team].length];
      car.pos.set(x, 0, z);
      car.spawn.set(x, 0, z);
      car.vel.set(0, 0, 0);
      car.yaw = car.team === 0 ? 0 : Math.PI;
      car.pitch = 0; car.roll = 0;
      car.quat.setFromEuler(tmpE.set(0, car.yaw, 0, 'YXZ'));
      car.boost = 33;
      car.onGround = true;
      car.jumps = 0;
      car.stun = 0;
      car.respawnAt = 0;
      car.hidden = false;
      car.flip = null;
      car.boostActive = false;
      car.drifting = false;
      car.hitCooldown = 0;
    }
    this.ball.pos.set(0, ARENA.ballRadius + 0.04, 0);
    this.ball.vel.set(0, 0, 0);
    this.ball.lastTouch = null;
    for (const pad of this.pads) { pad.active = true; pad.timer = 0; }
    this.phase = initial ? 'countdown' : 'countdown';
    this.countdown = initial ? ARENA.kickoffTime : 2.5;
    this.goalTimer = 0;
  }

  startOvertime() {
    this.overtime = true;
    this.matchTime = 0;
    this.phase = 'play';
    this.emit({ type: 'overtime' });
  }

  scoreGoal(team, scorer) {
    if (this.phase !== 'play') return;
    if (!this.authorative) return;
    this.score[team] += 1;
    const ownGoal = scorer && scorer.team !== team;
    this.lastScorer = { team, carId: scorer?.id || null, name: scorer?.name || '', ownGoal };
    if (scorer) scorer.goals += 1;
    this.phase = 'goal';
    this.goalTimer = 2.7;
    this.emit({ type: 'goal', team, scorer: this.lastScorer, overtime: this.overtime, ownGoal });
    this.ball.vel.multiplyScalar(0.35);
  }

  endMatch() {
    if (this.phase === 'ended') return;
    this.phase = 'ended';
    this.finished = true;
    this.winner = this.score[0] === this.score[1] ? null : (this.score[0] > this.score[1] ? 0 : 1);
    this.emit({ type: 'end', winner: this.winner, score: [...this.score], overtime: this.overtime });
  }

  step(dt) {
    dt = Math.min(dt, 1 / 30);
    this.elapsed += dt;
    if (!this.authorative) {
      if (this.phase === 'countdown') {
        this.countdown = Math.max(0, this.countdown - dt);
        if (this.countdown <= 0) this.phase = 'play';
      }
      const canControlGuest = this.phase === 'play';
      for (const car of this.cars) this.updateCar(car, dt, canControlGuest);
      this.updateBall(dt);
      this.carCarCollisions(dt);
      this.updatePads(dt);
      return;
    }
    if (this.phase === 'countdown') {
      const before = Math.ceil(this.countdown);
      this.countdown -= dt;
      const after = Math.ceil(this.countdown);
      if (after !== before && after >= 0) this.emit({ type: 'countdown', n: after });
      if (this.countdown <= 0) {
        this.phase = 'play';
        this.countdown = 0;
        this.emit({ type: 'go' });
        this.ball.vel.set((Math.random() - 0.5) * 1.5, 0, (Math.random() - 0.5) * 1.5);
      }
    } else if (this.phase === 'play') {
      if (!this.overtime) {
        this.matchTime -= dt;
        if (this.matchTime <= 0) {
          this.matchTime = 0;
          if (this.score[0] === this.score[1]) this.startOvertime();
          else this.endMatch();
        }
      }
    } else if (this.phase === 'goal') {
      this.goalTimer -= dt;
      if (this.goalTimer <= 0) {
        if (this.overtime) {
          this.endMatch();
        } else if (this.matchTime <= 0) {
          this.endMatch();
        } else {
          this.resetKickoff(false);
        }
      }
    }

    const canControl = this.phase === 'play';
    for (const car of this.cars) {
      this.updateCar(car, dt, canControl);
    }
    if (this.phase !== 'countdown') this.updateBall(dt);
    this.carCarCollisions(dt);
    this.updatePads(dt);
    if (this.phase === 'play' && this.authorative) this.checkGoal();
  }

  updateCar(car, dt, canControl) {
    car._dirty = true;
    if (car.stun > 0) {
      car.stun -= dt;
      car.vel.y -= ARENA.gravity * dt;
      car.pos.addScaledVector(car.vel, dt);
      car.vel.multiplyScalar(1 - dt * 0.4);
      if (car.pos.y < 0) { car.pos.y = 0; car.vel.y = 0; }
      if (car.stun <= 0) this.respawnCar(car);
      car._dirty = true;
      this.integrateRotation(car, dt);
      return;
    }
    if (car.hidden) return;

    let input = car.lastInput;
    if (car.respawnAt > 0) return;
    const controller = this.controllers.get(car.id);
    if (controller && canControl) {
      const result = controller(car, this, dt);
      if (result) input = result;
    } else if (!canControl) {
      input = { throttle: 0, steer: 0, boost: false, drift: false, jumpPressed: false, airRoll: 0 };
    }
    car.lastInput = input;

    const forward = tmpV.set(Math.sin(car.yaw), 0, Math.cos(car.yaw));
    const right = tmpV2.set(Math.cos(car.yaw), 0, -Math.sin(car.yaw));
    const speedF = car.vel.x * forward.x + car.vel.z * forward.z;
    const speedR = car.vel.x * right.x + car.vel.z * right.z;
    car.boostActive = false;
    car.drifting = false;

    if (car.onGround) {
      // steering
      const steerBoost = input.drift ? 1.42 : 1;
      const speedFactor = clamp(Math.abs(speedF) / 7 + 0.08, 0.08, 1);
      const direction = speedF < -0.5 ? -1 : 1;
      car.yaw += (input.steer || 0) * 2.9 * car.stats.handling * steerBoost * speedFactor * direction * dt;
      car.yaw = ((car.yaw + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;

      // engine
      const throttle = input.throttle || 0;
      if (throttle !== 0) {
        const a = car.stats.accel * (throttle > 0 ? 1 : 0.66);
        car.vel.x += forward.x * throttle * a * dt;
        car.vel.z += forward.z * throttle * a * dt;
      }
      // boost
      if (input.boost && car.boost > 0) {
        car.boost = Math.max(0, car.boost - PHYS.boostConsume * dt);
        car.vel.x += forward.x * car.stats.boostPower * dt;
        car.vel.z += forward.z * car.stats.boostPower * dt;
        car.boostActive = true;
        if (Math.random() < dt * 22) this.emit({ type: 'exhaust', carId: car.id, team: car.team });
      }
      // tire grip
      const grip = input.drift ? 2.4 : 10;
      const gripFactor = Math.min(1, grip * dt);
      car.vel.x -= right.x * speedR * gripFactor;
      car.vel.z -= right.z * speedR * gripFactor;
      // drag
      const drag = 0.42 + Math.abs(speedF) * 0.006;
      car.vel.x *= 1 - drag * dt;
      car.vel.z *= 1 - drag * dt;
      // lateral drift detection
      if (input.drift && Math.abs(speedF) > 9) {
        car.drifting = true;
        if (Math.random() < dt * 30) this.emit({ type: 'drift', carId: car.id, pos: car.pos.clone() });
      }
      // speed limiter
      const maxSpeed = car.stats.topSpeed + (car.boostActive ? 7 : 0);
      const horiz = Math.hypot(car.vel.x, car.vel.z);
      if (horiz > maxSpeed) {
        const k = maxSpeed / horiz;
        car.vel.x *= k; car.vel.z *= k;
      }
      // jump
      if (input.jumpPressed) {
        car.vel.y = PHYS.jumpImpulse;
        car.onGround = false;
        car.jumps = 1;
        car.pitch = 0; car.roll = 0;
        this.emit({ type: 'jump', carId: car.id, pos: car.pos.clone(), team: car.team });
      }
      car.pitch *= 1 - Math.min(1, dt * 14);
      car.roll *= 1 - Math.min(1, dt * 14);
    } else {
      // airborne
      car.vel.y -= ARENA.gravity * dt;
      car.pitch += (input.throttle || 0) * 2.35 * dt;
      car.yaw += (input.steer || 0) * 1.7 * dt;
      if (input.airRoll) car.roll += input.airRoll * 2.8 * dt;
      else if (input.drift) car.roll -= (input.steer || 0) * 2.4 * dt;
      car.pitch = clamp(car.pitch, -1.25, 1.25);
      car.roll = clamp(car.roll, -1.35, 1.35);
      // boost with 3D direction
      const q = car.quat;
      const f3 = tmpV.set(0, 0, 1).applyQuaternion(q);
      if (input.boost && car.boost > 0) {
        car.boost = Math.max(0, car.boost - PHYS.boostConsume * dt);
        car.vel.addScaledVector(f3, car.stats.boostPower * 0.92 * dt);
        car.boostActive = true;
        if (Math.random() < dt * 26) this.emit({ type: 'exhaust', carId: car.id, team: car.team });
      }
      if (input.jumpPressed && car.jumps === 1 && !car.flip) {
        car.jumps = 2;
        const hasDir = Math.abs(input.throttle) > 0.2 || Math.abs(input.steer) > 0.2;
        if (hasDir) {
          const dir = tmpV2.set(0, 0, 1).applyQuaternion(car.quat).multiplyScalar(Math.max(0, input.throttle));
          const side = new THREE.Vector3(1, 0, 0).applyQuaternion(car.quat).multiplyScalar(-input.steer);
          dir.add(side);
          dir.y = 0;
          if (dir.lengthSq() < 0.01) dir.set(Math.sin(car.yaw), 0, Math.cos(car.yaw));
          dir.normalize();
          car.vel.addScaledVector(dir, 11.5);
          car.vel.y = Math.max(car.vel.y, 3.5);
          car.flip = { axis: Math.abs(input.steer) > Math.abs(input.throttle) ? 'z' : 'x', t: 0, dir: Math.sign(input.steer) || 1, duration: 0.42 };
          this.emit({ type: 'flip', carId: car.id, pos: car.pos.clone() });
        } else {
          car.vel.y += PHYS.doubleJumpImpulse;
          this.emit({ type: 'flip', carId: car.id, pos: car.pos.clone() });
        }
      }
      // faster alignment when not flipping
      car.pitch *= 1 - dt * 0.15;
      car.roll *= 1 - dt * 0.15;
    }

    car.pos.addScaledVector(car.vel, dt);
    this.collideCarArena(car);
    this.integrateRotation(car, dt);
    if (car.onGround) {
      car.pos.y = 0;
      car.vel.y = 0;
    }
    if (car.flip) {
      car.flip.t += dt;
      if (car.flip.t > car.flip.duration) car.flip = null;
    }
  }

  integrateRotation(car, dt) {
    car.quat.setFromEuler(tmpE.set(car.pitch, car.yaw, car.roll, 'YXZ'));
    const horiz = Math.hypot(car.vel.x, car.vel.z);
    car.wheelSpin += horiz * dt * 2.2;
    // landing detection handled by arena collision
  }

  collideCarArena(car) {
    const marginX = car.halfW;
    const marginL = car.halfL * 0.9;
    // side walls
    const limit = ARENA.halfW - marginX;
    if (car.pos.x > limit) { car.pos.x = limit; car.vel.x *= -0.22; }
    if (car.pos.x < -limit) { car.pos.x = -limit; car.vel.x *= -0.22; }
    // z walls / goals
    const inGoalX = Math.abs(car.pos.x) < ARENA.goalHalfW - 1.2;
    const inGoalHeight = car.pos.y < ARENA.goalHeight - 1.6;
    const zLimit = ARENA.halfL - marginL;
    if (car.pos.z > zLimit) {
      if (inGoalX && inGoalHeight) {
        const back = ARENA.halfL + ARENA.goalDepth - marginL;
        if (car.pos.z > back) { car.pos.z = back; car.vel.z *= -0.25; }
        const gx = ARENA.goalHalfW - 1.2;
        if (car.pos.x > gx) { car.pos.x = gx; car.vel.x *= -0.2; }
        if (car.pos.x < -gx) { car.pos.x = -gx; car.vel.x *= -0.2; }
      } else {
        car.pos.z = zLimit; car.vel.z *= -0.22;
      }
    }
    if (car.pos.z < -zLimit) {
      if (inGoalX && inGoalHeight) {
        const back = ARENA.halfL + ARENA.goalDepth - marginL;
        if (car.pos.z < -back) { car.pos.z = -back; car.vel.z *= -0.25; }
        const gx = ARENA.goalHalfW - 1.2;
        if (car.pos.x > gx) { car.pos.x = gx; car.vel.x *= -0.2; }
        if (car.pos.x < -gx) { car.pos.x = -gx; car.vel.x *= -0.2; }
      } else {
        car.pos.z = -zLimit; car.vel.z *= -0.22;
      }
    }
    // ground
    if (car.pos.y <= 0) {
      if (!car.onGround && car.vel.y < -8) {
        this.emit({ type: 'land', carId: car.id, power: -car.vel.y });
      }
      car.pos.y = 0;
      if (car.vel.y < 0) car.vel.y = 0;
      car.onGround = true;
      car.jumps = 0;
      car.pitch *= 0.4;
      car.roll *= 0.4;
    } else if (car.pos.y > 0.25) {
      car.onGround = false;
    }
    // ceiling
    if (car.pos.y > ARENA.height - 2) { car.pos.y = ARENA.height - 2; car.vel.y = Math.min(0, car.vel.y); }
    // carrier bounce off other surfaces
    if (car.pos.y < 0.02 && car.onGround) { car.pitch = 0; car.roll = 0; }
  }

  updateBall(dt) {
    const ball = this.ball;
    ball.vel.y -= ARENA.gravity * dt;
    ball.pos.addScaledVector(ball.vel, dt);
    const r = ball.radius;
    // floor
    if (ball.pos.y < r) {
      ball.pos.y = r;
      if (ball.vel.y < 0) {
        if (ball.vel.y < -3) this.emit({ type: 'ballBounce', power: -ball.vel.y, pos: ball.pos.clone() });
        ball.vel.y = -ball.vel.y * 0.62;
      }
      const friction = Math.exp(-1.1 * dt);
      ball.vel.x *= friction;
      ball.vel.z *= friction;
    }
    // ceiling
    if (ball.pos.y > ARENA.height - r) {
      ball.pos.y = ARENA.height - r;
      ball.vel.y = -Math.abs(ball.vel.y) * 0.6;
    }
    // side walls
    if (Math.abs(ball.pos.x) > ARENA.halfW - r) {
      const sign = Math.sign(ball.pos.x);
      ball.pos.x = sign * (ARENA.halfW - r);
      ball.vel.x = -ball.vel.x * 0.68;
      this.emit({ type: 'wallHit', power: Math.abs(ball.vel.x), pos: ball.pos.clone() });
    }
    const inGoalX = Math.abs(ball.pos.x) < ARENA.goalHalfW - r * 0.1;
    const inGoalY = ball.pos.y < ARENA.goalHeight - r * 0.1;
    // z ends
    for (const end of [-1, 1]) {
      const line = end * ARENA.halfL;
      const front = end * (ARENA.halfL - r);
      if ((ball.pos.z - front) * end < 0) continue;
      if (inGoalX && inGoalY) {
        // inside goal, handle net boundaries
        const back = end * (ARENA.halfL + ARENA.goalDepth - r);
        if ((ball.pos.z - back) * end > 0) {
          ball.pos.z = back;
          ball.vel.z *= -0.38;
        }
        if (Math.abs(ball.pos.x) > ARENA.goalHalfW - r) {
          const s = Math.sign(ball.pos.x);
          ball.pos.x = s * (ARENA.goalHalfW - r);
          ball.vel.x *= -0.4;
        }
        if (ball.pos.y > ARENA.goalHeight - r) {
          ball.pos.y = ARENA.goalHeight - r;
          ball.vel.y = -Math.abs(ball.vel.y) * 0.4;
        }
      } else {
        // bounced off wall beside/above goal
        if ((ball.pos.z - front) * end > 0) {
          ball.pos.z = front;
          ball.vel.z = -ball.vel.z * 0.66;
          this.emit({ type: 'wallHit', power: Math.abs(ball.vel.z), pos: ball.pos.clone() });
        }
      }
    }
    // clamp ball speed
    const speed = ball.vel.length();
    if (speed > PHYS.maxBallSpeed) ball.vel.multiplyScalar(PHYS.maxBallSpeed / speed);
    // ball-car collisions
    for (const car of this.cars) {
      if (car.hidden || car.stun > 0) continue;
      this.carBallCollision(car);
    }
    // ball spin visual
    ball.spin = ball.vel.length() * dt;
  }

  carBallCollision(car) {
    const ball = this.ball;
    const center = tmpV.set(car.pos.x, car.pos.y + car.centerY, car.pos.z);
    const rel = tmpV2.copy(ball.pos).sub(center);
    const inv = tmpQ.copy(car.quat).invert();
    rel.applyQuaternion(inv);
    const hw = car.halfW + ball.radius * 0.15;
    const hh = car.centerY + ball.radius * 0.05;
    const hl = car.halfL + ball.radius * 0.15;
    const closest = new THREE.Vector3(
      clamp(rel.x, -hw, hw),
      clamp(rel.y, -0.2, car.centerY + 0.55),
      clamp(rel.z, -hl, hl),
    );
    const delta = rel.clone().sub(closest);
    const dist = delta.length();
    if (dist > ball.radius) return;
    if (dist < 0.0001) delta.set(0, 1, 0);
    const normalLocal = delta.clone().normalize();
    const normal = normalLocal.clone().applyQuaternion(car.quat).normalize();
    const closestWorld = closest.clone().applyQuaternion(car.quat).add(center);
    const push = ball.radius - dist;
    ball.pos.addScaledVector(normal, push + 0.05);

    const now = this.elapsed;
    const carSpeed = car.vel.length();
    const relSpeed = ball.vel.clone().sub(car.vel);
    const closing = -relSpeed.dot(normal);
    const boostBonus = car.boostActive ? 6.5 : 0;
    const power = (3.8 + carSpeed * 0.62 + boostBonus) * (closing > 0 ? 1.08 : 0.8);
    ball.vel.addScaledVector(normal, power);
    ball.vel.addScaledVector(car.vel, 0.34);
    ball.vel.y += Math.max(0, power) * 0.12;

    const speed = ball.vel.length();
    if (speed > PHYS.maxBallSpeed) ball.vel.multiplyScalar(PHYS.maxBallSpeed / speed);
    if (ball.pos.y < ball.radius) { ball.pos.y = ball.radius; ball.vel.y = Math.abs(ball.vel.y) * 0.4; }

    if (car.hitCooldown <= 0 && now - ball.lastHitTime > 0.06) {
      const p = clamp(power / 16, 0.35, 1.7);
      ball.hitSeq += 1;
      car.hitCooldown = 0.14;
      ball.lastHitTime = now;
      car.touches += 1;
      ball.lastTouch = car;
      // save detection
      const ownGoalZ = car.team === 0 ? -ARENA.halfL : ARENA.halfL;
      const nearOwn = Math.abs(ball.pos.z - ownGoalZ) < 28;
      if (nearOwn && ball.vel.z * (car.team === 0 ? -1 : 1) > 9) {
        this.emit({ type: 'save', carId: car.id, team: car.team, pos: ball.pos.clone() });
      }
      this.emit({ type: 'hit', carId: car.id, team: car.team, power: p, pos: ball.pos.clone(), speed: ball.vel.length() });
    }
  }

  carCarCollisions() {
    for (let i = 0; i < this.cars.length; i++) {
      for (let j = i + 1; j < this.cars.length; j++) {
        const a = this.cars[i];
        const b = this.cars[j];
        if (a.hidden || b.hidden) continue;
        const pa = tmpV.set(a.pos.x, a.pos.y + a.centerY * 0.7, a.pos.z);
        const pb = tmpV2.set(b.pos.x, b.pos.y + b.centerY * 0.7, b.pos.z);
        const dx = pb.x - pa.x, dy = pb.y - pa.y, dz = pb.z - pa.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const minDist = 2.3;
        if (dist < minDist && dist > 0.001) {
          const nx = dx / dist, ny = dy / dist, nz = dz / dist;
          const overlap = minDist - dist;
          const relV = a.vel.x * nx + a.vel.y * ny + a.vel.z * nz - (b.vel.x * nx + b.vel.y * ny + b.vel.z * nz);
          if (a.stun <= 0 && b.stun <= 0) {
            if (a.boostActive && !b.boostActive && Math.abs(relV) > 27 && a.team !== b.team) {
              this.demolish(b, a);
            } else if (b.boostActive && !a.boostActive && Math.abs(relV) > 27 && a.team !== b.team) {
              this.demolish(a, b);
            } else {
              const imp = Math.max(0, relV) * 0.48;
              a.vel.x -= nx * imp * 0.6; a.vel.z -= nz * imp * 0.6;
              b.vel.x += nx * imp * 0.6; b.vel.z += nz * imp * 0.6;
              a.pos.x -= nx * overlap * 0.5; a.pos.z -= nz * overlap * 0.5;
              b.pos.x += nx * overlap * 0.5; b.pos.z += nz * overlap * 0.5;
              a.vel.y += Math.max(0, imp * 0.1);
              b.vel.y += Math.max(0, imp * 0.1);
              if (Math.abs(relV) > 6 && this.elapsed - (this.lastBump || 0) > 0.25) {
                this.lastBump = this.elapsed;
                this.emit({ type: 'bump', power: Math.abs(relV) / 30, pos: new THREE.Vector3((a.pos.x + b.pos.x) / 2, a.pos.y + 1, (a.pos.z + b.pos.z) / 2) });
              }
            }
          }
        }
      }
    }
  }

  demolish(victim, attacker) {
    if (victim.stun > 0) return;
    victim.stun = 2.1;
    victim.hidden = true;
    victim.vel.set(0, 9, 0);
    victim.boost = 0;
    attacker.demos += 1;
    this.emit({ type: 'demolish', carId: victim.id, attackerId: attacker.id, pos: victim.pos.clone(), team: victim.team, byTeam: attacker.team });
  }

  respawnCar(car) {
    car.hidden = false;
    car.stun = 0;
    car.vel.set(0, 0, 0);
    const z = car.team === 0 ? -ARENA.halfL + 14 : ARENA.halfL - 14;
    car.pos.set(car.team === 0 ? -8 : 8, 0, z);
    car.yaw = car.team === 0 ? 0 : Math.PI;
    car.pitch = 0; car.roll = 0;
    car.quat.setFromEuler(tmpE.set(0, car.yaw, 0, 'YXZ'));
    car.boost = 33;
    car.onGround = true;
    car.jumps = 0;
    car.flip = null;
  }

  updatePads(dt) {
    for (const pad of this.pads) {
      if (!pad.active) {
        pad.timer -= dt;
        if (pad.timer <= 0) { pad.active = true; pad.timer = 0; }
        continue;
      }
      for (const car of this.cars) {
        if (car.hidden || car.stun > 0) continue;
        const dx = car.pos.x - pad.x;
        const dz = car.pos.z - pad.z;
        if (dx * dx + dz * dz < pad.radius * pad.radius && car.pos.y < 2) {
          if (car.boost < PHYS.boostMax - 0.5) {
            car.boost = Math.min(PHYS.boostMax, car.boost + (pad.big ? 100 : 12));
            pad.active = false;
            pad.timer = pad.respawn;
            this.emit({ type: 'boost', carId: car.id, big: pad.big, pos: new THREE.Vector3(pad.x, 0.5, pad.z) });
          }
        }
      }
    }
  }

  checkGoal() {
    const ball = this.ball;
    if (Math.abs(ball.pos.z) < ARENA.halfL + ball.radius * 0.7) return;
    if (Math.abs(ball.pos.x) > ARENA.goalHalfW - 0.2) return;
    if (ball.pos.y > ARENA.goalHeight - 0.2) return;
    const scoringTeam = ball.pos.z > 0 ? 0 : 1;
    const scorer = ball.lastTouch;
    this.scoreGoal(scoringTeam, scorer);
  }

  getSnapshot(extra = {}) {
    return {
      t: this.matchTime,
      phase: this.phase,
      countdown: this.countdown,
      score: [...this.score],
      overtime: this.overtime,
      elapsed: this.elapsed,
      ball: {
        p: [this.ball.pos.x, this.ball.pos.y, this.ball.pos.z],
        v: [this.ball.vel.x, this.ball.vel.y, this.ball.vel.z],
      },
      cars: this.cars.map((c) => ({
        id: c.id,
        p: [c.pos.x, c.pos.y, c.pos.z],
        v: [c.vel.x, c.vel.y, c.vel.z],
        q: [c.quat.x, c.quat.y, c.quat.z, c.quat.w],
        yaw: c.yaw, pitch: c.pitch, roll: c.roll,
        boost: c.boost,
        hidden: c.hidden,
        stun: c.stun,
      })),
      pads: this.pads.map((p) => p.active),
      ...extra,
    };
  }

  applySnapshot(snap, localCarId, { hostInput = null, guestInputHandler = null } = {}) {
    if (!snap) return;
    if (snap.phase) this.phase = snap.phase;
    if (typeof snap.t === 'number' && !this.overtime) this.matchTime = snap.t;
    if (typeof snap.countdown === 'number') this.countdown = snap.countdown;
    if (snap.overtime) this.overtime = true;
    if (snap.score) {
      if (snap.score[0] !== this.score[0] || snap.score[1] !== this.score[1]) {
        this.score = [...snap.score];
      }
    }
    // ball correction
    if (snap.ball) {
      const target = tmpV.fromArray(snap.ball.p);
      const diff = target.distanceTo(this.ball.pos);
      if (diff > 0.03) {
        const k = diff > 2.5 ? 0.6 : 0.25;
        this.ball.pos.lerp(target, k);
        this.ball.vel.lerp(tmpV2.fromArray(snap.ball.v), diff > 2.5 ? 0.5 : 0.2);
      }
    }
    // cars
    if (snap.cars) {
      for (const data of snap.cars) {
        const car = this.cars.find((c) => c.id === data.id);
        if (!car) continue;
        if (car.isLocal && car.id === localCarId) {
          const target = tmpV.fromArray(data.p);
          const err = target.distanceTo(car.pos);
          if (err > 4.5) {
            car.pos.copy(target);
            car.vel.fromArray(data.v);
            car.yaw = data.yaw; car.pitch = data.pitch; car.roll = data.roll;
            car.quat.setFromEuler(tmpE.set(car.pitch, car.yaw, car.roll, 'YXZ'));
          } else if (err > 1.2) {
            car.pos.lerp(target, 0.05);
          }
          if (typeof data.boost === 'number' && Math.abs(car.boost - data.boost) > 8) car.boost = data.boost;
        } else if (!car.isBot || this.mode !== 'online-guest') {
          const target = tmpV.fromArray(data.p);
          const err = target.distanceTo(car.pos);
          if (err > 3.5) {
            car.pos.copy(target);
            car.vel.fromArray(data.v);
          } else {
            car.pos.lerp(target, 0.55);
            car.vel.lerp(tmpV2.fromArray(data.v), 0.45);
          }
          car.yaw = data.yaw; car.pitch = data.pitch; car.roll = data.roll;
          car.quat.setFromEuler(tmpE.set(car.pitch, car.yaw, car.roll, 'YXZ'));
          car.boost = data.boost;
          car.hidden = data.hidden;
          car.stun = data.stun;
          car.onGround = car.pos.y <= 0.1;
        } else {
          const target = tmpV.fromArray(data.p);
          car.pos.lerp(target, 0.5);
          car.vel.fromArray(data.v);
          car.yaw = data.yaw; car.pitch = data.pitch; car.roll = data.roll;
          car.quat.setFromEuler(tmpE.set(car.pitch, car.yaw, car.roll, 'YXZ'));
          car.hidden = data.hidden;
          car.boost = data.boost;
        }
      }
    }
    if (snap.pads && snap.pads.length === this.pads.length) {
      snap.pads.forEach((active, i) => {
        if (this.pads[i].active !== active) {
          this.pads[i].active = active;
          if (!active) this.pads[i].timer = this.pads[i].respawn;
        }
      });
    }
    if (hostInput) {
      const hostCar = this.cars.find((c) => !c.isLocal && !c.isBot);
      if (hostCar) hostCar.lastInput = hostInput;
    }
    this._dirty = true;
  }
}
