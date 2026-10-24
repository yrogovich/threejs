import * as THREE from 'three';

// Each generator fills `count` particles and returns { positions, colors }.
// Positions are in world units; the scene is framed for shapes roughly 12 units wide.

const TAU = Math.PI * 2;
const tmp = new THREE.Color();

function make(count, fn) {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const p = new THREE.Vector3();
  const c = new THREE.Color();
  for (let i = 0; i < count; i++) {
    fn(i, p, c);
    p.toArray(positions, i * 3);
    c.toArray(colors, i * 3);
  }
  return { positions, colors };
}

// Gaussian-ish random in [-1, 1], biased to the centre.
const spread = (pow = 3) => Math.pow(Math.random(), pow) * (Math.random() < 0.5 ? 1 : -1);

function randomOnSphere(v, radius) {
  const u = Math.random() * 2 - 1;
  const t = Math.random() * TAU;
  const s = Math.sqrt(1 - u * u);
  return v.set(s * Math.cos(t), u, s * Math.sin(t)).multiplyScalar(radius);
}

const inner = new THREE.Color('#ffb36b');
const outer = new THREE.Color('#4f5bff');

export function galaxy(count) {
  const arms = 4;
  const radius = 6.5;
  return make(count, (i, p, c) => {
    const r = Math.pow(Math.random(), 1.6) * radius;
    const branch = ((i % arms) / arms) * TAU;
    const spin = r * 1.05;
    const scatter = 0.25 + r * 0.12;
    p.set(
      Math.cos(branch + spin) * r + spread() * scatter * 2,
      spread(4) * (1.2 - r / radius) * 0.9,
      Math.sin(branch + spin) * r + spread() * scatter * 2,
    );
    c.copy(inner).lerp(outer, r / radius);
    if (Math.random() < 0.02) c.setRGB(1, 1, 1);
  });
}

export function planet(count) {
  const sphereA = new THREE.Color('#29e3ff');
  const sphereB = new THREE.Color('#c63bff');
  const ringA = new THREE.Color('#ffd88a');
  const ringB = new THREE.Color('#ff6a9a');
  const tilt = new THREE.Euler(0.45, 0, 0.25);
  return make(count, (i, p, c) => {
    if (Math.random() < 0.55) {
      randomOnSphere(p, 2.6 + spread(6) * 0.15);
      c.copy(sphereA).lerp(sphereB, (p.y / 2.6 + 1) / 2);
    } else {
      const t = Math.random();
      const r = 3.6 + t * 2.4;
      const a = Math.random() * TAU;
      // A few gaps make the rings read as rings.
      const band = Math.sin(t * 28) > -0.6 ? 1 : 0.15;
      p.set(Math.cos(a) * r, spread(5) * 0.08, Math.sin(a) * r).applyEuler(tilt);
      c.copy(ringA).lerp(ringB, t).multiplyScalar(band);
    }
  });
}

export function torusKnot(count) {
  const P = 2;
  const Q = 3;
  const scale = 1.55;
  const dir = new THREE.Vector3();
  return make(count, (i, p, c) => {
    const t = Math.random() * TAU;
    const r = Math.cos(Q * t) + 2;
    p.set(r * Math.cos(P * t), r * Math.sin(P * t), -Math.sin(Q * t)).multiplyScalar(scale);
    randomOnSphere(dir, Math.sqrt(Math.random()) * 0.42);
    p.add(dir);
    c.setHSL(t / TAU, 0.85, 0.6);
  });
}

export function helix(count) {
  const strandA = new THREE.Color('#2bf0ff');
  const strandB = new THREE.Color('#ff3ea5');
  const rung = new THREE.Color('#e9e6ff');
  const length = 11;
  const radius = 1.7;
  const turns = 1.15;
  return make(count, (i, p, c) => {
    const roll = Math.random();
    if (roll < 0.78) {
      const x = (Math.random() - 0.5) * length;
      const strand = roll < 0.39 ? 0 : Math.PI;
      const a = x * turns + strand;
      p.set(x, Math.cos(a) * radius, Math.sin(a) * radius);
      p.x += spread() * 0.12;
      p.y += spread() * 0.18;
      p.z += spread() * 0.18;
      c.copy(strand === 0 ? strandA : strandB);
    } else {
      const steps = 34;
      const x = (Math.floor(Math.random() * steps) / (steps - 1) - 0.5) * length;
      const a = x * turns;
      const k = Math.random() * 2 - 1;
      p.set(x + spread() * 0.04, Math.cos(a) * radius * k, Math.sin(a) * radius * k);
      c.copy(rung).lerp(k > 0 ? strandA : strandB, Math.abs(k) * 0.6);
    }
  });
}

export function wave(count) {
  const low = new THREE.Color('#00ffa3');
  const high = new THREE.Color('#8a3dff');
  const size = 12;
  return make(count, (i, p, c) => {
    const x = (Math.random() - 0.5) * size;
    const z = (Math.random() - 0.5) * size;
    const d = Math.hypot(x, z);
    const y = Math.sin(d * 1.1) * Math.exp(-d * 0.12) * 1.4 + Math.sin(x * 0.7) * 0.4;
    p.set(x, y + spread(6) * 0.08, z);
    c.copy(low).lerp(high, THREE.MathUtils.clamp((y + 1.4) / 2.8, 0, 1));
    // Fade the edges of the square so it doesn't look clipped.
    c.multiplyScalar(THREE.MathUtils.smoothstep(size / 2 - d * 0.75, 0, 2.2));
  });
}

export function nebula(count) {
  return make(count, (i, p, c) => {
    randomOnSphere(p, 18 + Math.random() * 22);
    tmp.setHSL(0.6 + Math.random() * 0.25, 0.8, 0.55);
    c.copy(tmp);
  });
}

export const SHAPES = [
  { name: 'Spiral Galaxy', build: galaxy },
  { name: 'Ringed World', build: planet },
  { name: 'Torus Knot', build: torusKnot },
  { name: 'Double Helix', build: helix },
  { name: 'Gravity Wave', build: wave },
];
