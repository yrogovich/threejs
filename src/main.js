import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import { SHAPES, nebula } from './shapes.js';
import { particleVertex, particleFragment, starVertex, starFragment } from './shaders.js';

const isMobile = matchMedia('(max-width: 768px), (pointer: coarse)').matches;
const COUNT = isMobile ? 45_000 : 90_000;
const MORPH_DURATION = 2.6;
const AUTO_ADVANCE = 8;

// ---------------------------------------------------------------- renderer
const canvas = document.querySelector('#scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
const pixelRatio = Math.min(window.devicePixelRatio, 2);
renderer.setPixelRatio(pixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor('#03020a');

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(0, 4.5, isMobile ? 17 : 13);

const controls = new OrbitControls(camera, canvas);
controls.target.set(0, -1.2, 0);
controls.enableDamping = true;
controls.enablePan = false;
controls.minDistance = 5;
controls.maxDistance = 30;
controls.rotateSpeed = 0.6;

// ---------------------------------------------------------------- particles
const shapes = SHAPES.map((s) => ({ name: s.name, ...s.build(COUNT) }));
const intro = nebula(COUNT);

const geometry = new THREE.BufferGeometry();
const from = new THREE.BufferAttribute(new Float32Array(intro.positions), 3);
const to = new THREE.BufferAttribute(new Float32Array(shapes[0].positions), 3);
const colorFrom = new THREE.BufferAttribute(new Float32Array(intro.colors), 3);
const colorTo = new THREE.BufferAttribute(new Float32Array(shapes[0].colors), 3);
const random = new Float32Array(COUNT).map(() => Math.random());
geometry.setAttribute('position', from);
geometry.setAttribute('aTarget', to);
geometry.setAttribute('aColorFrom', colorFrom);
geometry.setAttribute('aColorTo', colorTo);
geometry.setAttribute('aRandom', new THREE.BufferAttribute(random, 1));
geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 50);

const uniforms = {
  uTime: { value: 0 },
  uProgress: { value: 0 },
  uSize: { value: 30 },
  uPixelRatio: { value: pixelRatio },
  uMouse: { value: new THREE.Vector3(999, 999, 999) },
  uMouseStrength: { value: 0 },
};

const material = new THREE.ShaderMaterial({
  vertexShader: particleVertex,
  fragmentShader: particleFragment,
  uniforms,
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
});

const particles = new THREE.Points(geometry, material);
scene.add(particles);

// ---------------------------------------------------------------- starfield
{
  const n = 4000;
  const pos = new Float32Array(n * 3);
  const v = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    v.randomDirection().multiplyScalar(60 + Math.random() * 60).toArray(pos, i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aRandom', new THREE.BufferAttribute(new Float32Array(n).map(() => Math.random()), 1));
  const stars = new THREE.Points(
    g,
    new THREE.ShaderMaterial({
      vertexShader: starVertex,
      fragmentShader: starFragment,
      uniforms: { uTime: uniforms.uTime, uPixelRatio: uniforms.uPixelRatio },
      transparent: true,
      depthWrite: false,
    }),
  );
  scene.add(stars);
}

// ---------------------------------------------------------------- post
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.7, 0.4, 0.12);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// ---------------------------------------------------------------- morphing
let current = -1; // -1 = intro cloud
let target = 0;
let morphStart = 0;
let morphing = true;
let lastChange = 0;

const label = document.querySelector('#shape-name');
const index = document.querySelector('#shape-index');
const dots = document.querySelector('#dots');

SHAPES.forEach((s, i) => {
  const b = document.createElement('button');
  b.setAttribute('aria-label', s.name);
  b.addEventListener('click', (e) => {
    e.stopPropagation();
    morphTo(i);
  });
  dots.append(b);
});

function updateLabel() {
  label.textContent = shapes[target].name;
  label.classList.remove('in');
  void label.offsetWidth; // restart the CSS animation
  label.classList.add('in');
  index.textContent = `${String(target + 1).padStart(2, '0')} / ${String(shapes.length).padStart(2, '0')}`;
  [...dots.children].forEach((d, i) => d.classList.toggle('active', i === target));
}
updateLabel();

function morphTo(next) {
  if (morphing || next === current) return;
  // The finished target becomes the new origin.
  from.array.set(shapes[current].positions);
  colorFrom.array.set(shapes[current].colors);
  to.array.set(shapes[next].positions);
  colorTo.array.set(shapes[next].colors);
  from.needsUpdate = to.needsUpdate = colorFrom.needsUpdate = colorTo.needsUpdate = true;
  target = next;
  morphStart = clock.elapsedTime;
  uniforms.uProgress.value = 0;
  morphing = true;
  updateLabel();
}

const nextShape = () => morphTo((current + 1) % shapes.length);

// ---------------------------------------------------------------- input
const pointer = new THREE.Vector2();
const raycaster = new THREE.Raycaster();
const plane = new THREE.Plane();
const hit = new THREE.Vector3();
let pointerActive = false;
let downAt = null;

window.addEventListener('pointermove', (e) => {
  pointer.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  pointerActive = true;
});
window.addEventListener('pointerleave', () => (pointerActive = false));
canvas.addEventListener('pointerdown', (e) => (downAt = { x: e.clientX, y: e.clientY }));
canvas.addEventListener('pointerup', (e) => {
  // Treat it as a click only if the user didn't drag to orbit.
  if (downAt && Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) < 6) nextShape();
  downAt = null;
});
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' || e.code === 'ArrowRight') nextShape();
  if (e.code === 'ArrowLeft') morphTo((current - 1 + shapes.length) % shapes.length);
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
});

// ---------------------------------------------------------------- loop
const clock = new THREE.Clock();
const progressBar = document.querySelector('#progress');

renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  uniforms.uTime.value = t;

  if (morphing) {
    const k = Math.min((t - morphStart) / MORPH_DURATION, 1);
    uniforms.uProgress.value = k;
    if (k === 1) {
      morphing = false;
      current = target;
      lastChange = t;
    }
  } else if (t - lastChange > AUTO_ADVANCE) {
    nextShape();
  }
  progressBar.style.transform = `scaleX(${morphing ? 0 : Math.min((t - lastChange) / AUTO_ADVANCE, 1)})`;

  // Cursor position on a plane through the origin facing the camera.
  if (pointerActive) {
    raycaster.setFromCamera(pointer, camera);
    plane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(hit).negate(), particles.position);
    if (raycaster.ray.intersectPlane(plane, hit)) uniforms.uMouse.value.lerp(hit, 0.25);
  }
  const strength = pointerActive ? 1 : 0;
  uniforms.uMouseStrength.value += (strength - uniforms.uMouseStrength.value) * Math.min(dt * 4, 1);

  particles.rotation.y += dt * 0.07;
  controls.update();
  composer.render();
});

document.body.classList.add('ready');
