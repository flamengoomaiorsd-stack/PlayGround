import * as THREE from 'three';
import { ARENA } from './constants.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const wrap = (a) => {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
};

const DIFFICULTY = [
  { reaction: 0.34, noise: 0.42, boostChance: 0.28, aggression: 0.55, lead: 0.12, aerial: 0.15, speed: 0.82 },
  { reaction: 0.24, noise: 0.26, boostChance: 0.5, aggression: 0.72, lead: 0.2, aerial: 0.35, speed: 0.9 },
  { reaction: 0.15, noise: 0.14, boostChance: 0.72, aggression: 0.86, lead: 0.28, aerial: 0.6, speed: 0.96 },
  { reaction: 0.09, noise: 0.07, boostChance: 0.9, aggression: 0.95, lead: 0.36, aerial: 0.82, speed: 1 },
  { reaction: 0.05, noise: 0.03, boostChance: 1, aggression: 1, lead: 0.44, aerial: 1, speed: 1.04 },
];

export function difficultyLabel(level) {
  return ['Iniciante', 'Amador', 'Profissional', 'All-Star', 'Lenda'][clamp(level, 0, 4)];
}

export function makeBotController(difficulty = 2, role = 'attacker', seed = 0) {
  const cfg = DIFFICULTY[clamp(difficulty, 0, 4)];
  const rng = (() => {
    let s = (seed + 1) * 9301 + 49297;
    return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  })();
  const state = {
    timer: 0,
    target: new THREE.Vector3(),
    hasTarget: false,
    jumpCooldown: 0,
    mistake: 0,
    mistakeTimer: 3 + rng() * 4,
    padTarget: null,
    strafeDir: rng() > 0.5 ? 1 : -1,
  };

  return (car, world, dt) => {
    state.jumpCooldown = Math.max(0, state.jumpCooldown - dt);
    state.timer -= dt;
    state.mistakeTimer -= dt;
    if (state.mistakeTimer <= 0) {
      state.mistakeTimer = 3 + rng() * 4;
      state.mistake = rng() < 0.3 ? (rng() - 0.5) * cfg.noise * 8 : 0;
    }

    const ball = world.ball;
    const attackZ = car.team === 0 ? ARENA.halfL : -ARENA.halfL;
    const ownZ = car.team === 0 ? -ARENA.halfL : ARENA.halfL;
    const ownDir = Math.sign(ownZ);
    const ballDist = Math.hypot(ball.pos.x - car.pos.x, ball.pos.z - car.pos.z);
    const ballToOwn = Math.abs(ball.pos.z - ownZ);
    const danger = ballToOwn < 30 && ball.vel.z * ownDir < -4;
    const kickoff = Math.abs(ball.pos.z) < 2 && Math.abs(ball.vel.length()) < 2 && Math.abs(car.pos.z) > 20;
    const behindBall = (ball.pos.z - car.pos.z) * Math.sign(attackZ) < 0;

    if (state.timer <= 0) {
      state.timer = cfg.reaction * (0.7 + rng() * 0.6);
      const lead = clamp(ballDist / 34, 0.04, 0.65) * (0.35 + cfg.lead);
      const pred = new THREE.Vector3(
        ball.pos.x + ball.vel.x * lead,
        Math.max(ball.radius, ball.pos.y + ball.vel.y * lead * 0.5),
        ball.pos.z + ball.vel.z * lead,
      );
      const goal = new THREE.Vector3(0, 1.5, attackZ);
      const dirGoal = new THREE.Vector3(goal.x - pred.x, 0, goal.z - pred.z).normalize();
      const perp = new THREE.Vector3(-dirGoal.z, 0, dirGoal.x);

      let target = pred.clone().addScaledVector(dirGoal, -(ARENA.ballRadius + 3.1));

      // wrong side of the ball: swing around
      const carToBall = new THREE.Vector3(ball.pos.x - car.pos.x, 0, ball.pos.z - car.pos.z);
      const goalSide = carToBall.dot(dirGoal);
      if (goalSide > 0.5 && ballDist < 18) {
        target.addScaledVector(perp, state.strafeDir * (5 + ballDist * 0.35));
        target.x += state.strafeDir * 4;
      }

      // defensive positioning
      if (role === 'defender' || (role === 'attacker' && car.team === 0 && false)) {
        if (ballToOwn < 36) {
          target = new THREE.Vector3(
            clamp(ball.pos.x * 0.35, -9, 9),
            0,
            ownZ + Math.sign(ownZ) * -9,
          );
          if (ballToOwn < 18) {
            target = pred.clone().addScaledVector(
              new THREE.Vector3(0, 0, Math.sign(ownZ)),
              4,
            );
          }
        } else {
          target = pred.clone().addScaledVector(dirGoal, -7);
          target.x += (car.team === 0 ? -8 : 8);
        }
      }
      if (role === 'attacker' && world.teamSize > 1) {
        target.addScaledVector(perp, state.strafeDir * 2.5);
      }

      // grab boost when useful
      if (car.boost < 30 && ballDist > 14 && !danger) {
        let best = null;
        let bestD = 1e9;
        for (const pad of world.pads) {
          if (!pad.active) continue;
          const d = Math.hypot(pad.x - car.pos.x, pad.z - car.pos.z);
          const towardGoal = (pad.z - car.pos.z) * Math.sign(attackZ);
          if (d < bestD && d < 34 && towardGoal > -10) { bestD = d; best = pad; }
        }
        if (best && bestD < ballDist * 0.75) {
          target = new THREE.Vector3(best.x, 0, best.z);
          state.padTarget = best;
        } else state.padTarget = null;
      } else state.padTarget = null;

      if (kickoff) {
        const jitter = (rng() - 0.5) * 1.5;
        target = new THREE.Vector3(jitter, 0, 0);
      }

      target.x += state.mistake;
      target.z += state.mistake * 0.5;
      target.x = clamp(target.x, -ARENA.halfW + 3, ARENA.halfW - 3);
      target.z = clamp(target.z, -ARENA.halfL + 3, ARENA.halfL - 3);
      state.target.copy(target);
      state.hasTarget = true;
    }

    if (!state.hasTarget) state.target.set(0, 0, 0);
    const dx = state.target.x - car.pos.x;
    const dz = state.target.z - car.pos.z;
    const dist = Math.hypot(dx, dz);
    const desiredYaw = Math.atan2(dx, dz);
    const delta = wrap(desiredYaw - car.yaw);
    let steer = clamp(delta * 2.4, -1, 1);
    if (Math.abs(delta) > 0.08) steer += (rng() - 0.5) * cfg.noise * 0.4;
    steer = clamp(steer, -1, 1);

    let throttle = 1;
    if (dist < 2.2) throttle = 0.2;
    if (Math.abs(delta) > 1.35) throttle = 0.55;
    if (Math.abs(delta) > 2.2) throttle = 0.85;
    if (ball.pos.y > 6 && ballDist > 8) throttle = Math.min(1, throttle + 0.15);

    let boost = false;
    let jumping = false;
    let drift = false;

    const aligned = Math.abs(delta) < 0.42;
    if (aligned && car.boost > 5) {
      if (dist > 10) boost = rng() < cfg.boostChance;
      else if (ballDist > 7 && ballDist < 20 && rng() < cfg.boostChance * 0.7) boost = true;
    }
    if (kickoff && car.boost > 10 && aligned) boost = true;
    if (danger && car.boost > 20 && aligned) boost = true;

    // jump for aerial / flip into ball
    const ballHigh = ball.pos.y > 2.6;
    const closeToBall = ballDist < 6.8;
    if (closeToBall && aligned && car.onGround && state.jumpCooldown <= 0) {
      if (ballHigh && ball.pos.y < 13 && rng() < cfg.aerial) {
        jumping = true;
        state.jumpCooldown = 1.1;
      } else if (ballDist > 3.2 && ballDist < 6 && ball.pos.y < 4 && dist < 15) {
        // flip toward ball for a strong touch
        jumping = true;
        state.jumpCooldown = 0.9;
      }
    }
    if (!car.onGround && car.jumps === 1 && closeToBall && state.jumpCooldown <= 0) {
      jumping = true;
      state.jumpCooldown = 1.4;
    }
    if (Math.abs(delta) > 1.6 && car.onGround && car.vel.length() > 14) drift = true;
    if (car.onGround && state.padTarget && dist < 40 && car.boost < 90) drift = false;

    // aerial attitude: pitch toward ball height
    let airThrottle = 0;
    if (!car.onGround) {
      const dy = ball.pos.y - (car.pos.y + 1);
      airThrottle = clamp(dy * 0.2, -1, 1);
      if (car.pos.y > 1 && car.jumps === 1 && ball.pos.y > car.pos.y + 2 && car.boost > 12 && rng() < 0.5) {
        jumping = true;
        state.jumpCooldown = 1.5;
      }
      if (ball.pos.y > car.pos.y + 2 && car.boost > 8 && Math.abs(ball.pos.z - car.pos.z) < 18) boost = true;
    }

    return {
      throttle: car.onGround ? throttle : airThrottle,
      steer,
      boost,
      drift,
      jumpPressed: jumping,
      airRoll: 0,
    };
  };
}
