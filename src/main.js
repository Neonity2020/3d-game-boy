import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildGameBoy } from './gameboy.js';
import { Tetris } from './tetris.js';
import { Chip } from './chip.js';

const stage = document.getElementById('stage');

/* ------------------------------------------------------------------ *
 * Renderer / scene
 * ------------------------------------------------------------------ */

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.02;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
stage.appendChild(renderer.domElement);

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(32, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(7, 7, 37);

const CAM_END = new THREE.Vector3(0, 0.9, 32.5);
camera.position.copy(CAM_END);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.enablePan = false;
controls.minDistance = 15;
controls.maxDistance = 46;
controls.minPolarAngle = 0.25;
controls.maxPolarAngle = 2.45;
controls.target.set(0, 0, 0);
controls.enabled = false; // released once the intro settles

// Soft studio lighting, plus an image-based environment so the plastic has
// something to reflect.
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.45;

scene.add(new THREE.HemisphereLight(0xa8bcd8, 0x3c382f, 0.6));

const key = new THREE.DirectionalLight(0xfff4e2, 2.3);
key.position.set(9, 15, 13);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.near = 4;
key.shadow.camera.far = 60;
key.shadow.camera.left = -14;
key.shadow.camera.right = 14;
key.shadow.camera.top = 16;
key.shadow.camera.bottom = -16;
key.shadow.bias = -0.0009;
key.shadow.normalBias = 0.02;
scene.add(key);

const fill = new THREE.DirectionalLight(0xbcd2ff, 0.55);
fill.position.set(-12, -5, 8);
scene.add(fill);

const rim = new THREE.DirectionalLight(0xffffff, 1.5);
rim.position.set(-7, 9, -13);
scene.add(rim);

// Shadow catcher so the console feels like it is hovering over a surface.
const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(60, 60),
  new THREE.ShadowMaterial({ opacity: 0.36 })
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -8.9;
floor.receiveShadow = true;
scene.add(floor);

/* ------------------------------------------------------------------ *
 * Console
 * ------------------------------------------------------------------ */

const screenCanvas = document.createElement('canvas');
const chip = new Chip();
const tetris = new Tetris(screenCanvas, { onSound: (name) => chip.play(name) });
tetris.render();

const gb = buildGameBoy(screenCanvas);
scene.add(gb.group);

const screenNormal = new THREE.Vector3();
const screenWorld = new THREE.Vector3();
const tmpVec = new THREE.Vector3();

/* ------------------------------------------------------------------ *
 * Press feedback
 * ------------------------------------------------------------------ */

const presses = new Map(); // action -> { value, target }

function pressState(action) {
  if (!presses.has(action)) presses.set(action, { value: 0, target: 0 });
  return presses.get(action);
}

const DIR_SIGN = {
  up: [-0.075, 0],
  down: [0.075, 0],
  left: [0, -0.075],
  right: [0, 0.075],
};

function updatePresses(dt) {
  const speed = 14;

  // d-pad rocks about the axis opposite the pressed direction
  let pitch = 0;
  let yaw = 0;
  let push = 0;
  for (const [action, [rx, ry]] of Object.entries(DIR_SIGN)) {
    const s = pressState(action);
    s.value += (s.target - s.value) * Math.min(1, dt * speed);
    pitch += rx * s.value;
    yaw += ry * s.value;
    push += 0.018 * s.value;
  }
  gb.dpad.rotation.x = pitch;
  gb.dpad.rotation.y = yaw;
  gb.dpad.position.z = -push;

  for (const [action, btn] of Object.entries(gb.buttons)) {
    const s = pressState(action);
    s.value += (s.target - s.value) * Math.min(1, dt * speed);
    btn.position.z = -0.09 * s.value;
    btn.rotation.x = 0.16 * s.value;
  }

  // power switch slide
  const target = gb.powerOn ? 0.42 : -0.42;
  gb.slider.position.x += (target - gb.slider.position.x) * Math.min(1, dt * 9);
}

/* ------------------------------------------------------------------ *
 * Input — 3D buttons
 * ------------------------------------------------------------------ */

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let hovered = null;
let pointerHeld = null;

function pick(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObjects(gb.hits, false)[0];
  return hit ? hit.object : null;
}

renderer.domElement.addEventListener('pointermove', (event) => {
  if (pointerHeld) return;
  const obj = pick(event);
  hovered = obj ? obj.userData.action : null;
  renderer.domElement.style.cursor = hovered ? 'pointer' : 'grab';
});

renderer.domElement.addEventListener('pointerdown', (event) => {
  chip.unlock();
  const obj = pick(event);
  if (!obj) return;
  const action = obj.userData.action;
  event.preventDefault();
  renderer.domElement.setPointerCapture(event.pointerId);
  renderer.domElement.style.cursor = 'pointer';
  controls.enabled = false;
  pointerHeld = action;
  startRepeat(action);
  activate(action);
});

function releasePointer() {
  if (pointerHeld) stopRepeat(pointerHeld);
  pointerHeld = null;
  controls.enabled = introDone;
}

renderer.domElement.addEventListener('pointerup', releasePointer);
renderer.domElement.addEventListener('pointercancel', releasePointer);
renderer.domElement.addEventListener('pointerleave', () => {
  if (!pointerHeld) hovered = null;
  releasePointer();
});

/* ------------------------------------------------------------------ *
 * Input — keyboard, with DAS/ARR the way a Game Boy felt
 * ------------------------------------------------------------------ */

const REPEAT = {
  left: [170, 55],
  right: [170, 55],
  down: [110, 45],
  up: [260, 120],
  a: [260, 120],
  b: [260, 120],
};

const KEY_ACTIONS = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowDown: 'down',
  ArrowUp: 'up',
  KeyA: 'a',
  KeyD: 'a',
  KeyX: 'a',
  KeyZ: 'b',
  KeyW: 'b',
  Space: 'drop',
  Enter: 'start',
  KeyP: 'power',
};

// `code` is the physical key, which is what we want; `key` is the fallback for
// events that do not carry a physical code (synthetic input, some IMEs).
const KEY_FALLBACK = {
  ArrowLeft: 'left', ArrowRight: 'right', ArrowDown: 'down', ArrowUp: 'up',
  a: 'a', d: 'a', x: 'a', z: 'b', w: 'b', ' ': 'drop',
  Enter: 'start', p: 'power', P: 'power',
};

const keyAction = (event) => KEY_ACTIONS[event.code] || KEY_FALLBACK[event.key];

const repeats = new Map();

function startRepeat(action) {
  if (action === 'power') return; // a toggle must never auto-fire
  const [delay, interval] = REPEAT[action] || [260, 140];
  repeats.set(action, { t: performance.now() + delay, interval });
}

function stopRepeat(action) {
  repeats.delete(action);
  if (action in gb.buttons || action in DIR_SIGN) pressState(action).target = 0;
}

function tickRepeats(now) {
  for (const [action, state] of repeats) {
    if (state.t === null) continue;
    if (now >= state.t) {
      state.t = now + state.interval;
      activate(action, true);
    }
  }
}

window.addEventListener('keydown', (event) => {
  const action = keyAction(event);
  if (!action) return;
  event.preventDefault();
  chip.unlock();
  if (event.repeat) return;
  if (action !== 'power') startRepeat(action);
  activate(action);
});

window.addEventListener('keyup', (event) => {
  const action = keyAction(event);
  if (action) stopRepeat(action);
});

window.addEventListener('blur', () => {
  for (const action of [...repeats.keys()]) stopRepeat(action);
  releasePointer();
});

/* ------------------------------------------------------------------ *
 * Wire an action to hardware sound + game
 * ------------------------------------------------------------------ */

function setPower(on) {
  if (gb.powerOn === on) return;
  gb.powerOn = on;
  tetris.power(on);
  chip.unlock();
  chip.play('power');
}

function activate(action, isRepeat = false) {
  if (action === 'power') {
    setPower(!gb.powerOn);
    return;
  }
  // START also wakes a sleeping console, so it is never a dead press
  if (action === 'start' && tetris.state === 'off') {
    setPower(true);
    return;
  }

  if (action in gb.buttons || action in DIR_SIGN) pressState(action).target = 1;
  if (!isRepeat) chip.play('click');
  tetris.press(action);
}

/* ------------------------------------------------------------------ *
 * Loop
 * ------------------------------------------------------------------ */

const clock = new THREE.Clock();
let introDone = false;
let firstFrame = true;
let rafId = null;
let lastTick = performance.now();
const stats = { frames: 0, lastDt: 0, lastAt: 0 };

function frame() {
  rafId = null;
  lastTick = performance.now();
  stepFrame();
  if (rafId === null) rafId = requestAnimationFrame(frame);
}

function stepFrame() {
  // the game module works in milliseconds, matching its timing constants
  const dt = Math.min(clock.getDelta() * 1000, 50);
  const now = performance.now();
  stats.frames++;
  stats.lastDt = dt;
  stats.lastAt = now;

  // intro glide
  if (!introDone) {
    const t = Math.min(1, clock.elapsedTime / 2.1);
    const e = 1 - Math.pow(1 - t, 3);
    camera.position.x = CAM_END.x + 7 * (1 - e);
    camera.position.y = CAM_END.y + 7 * (1 - e);
    camera.position.z = CAM_END.z + 5 * (1 - e);
    if (t >= 1) {
      introDone = true;
      controls.enabled = true;
    }
  }

  tickRepeats(now);

  tetris.update(dt);
  tetris.render();
  gb.screen.texture.needsUpdate = true;

  // power lamp
  const lampOn = gb.powerOn && tetris.state !== 'off';
  const flicker = 0.85 + Math.sin(now / 140) * 0.06;
  gb.ledMat.emissiveIntensity = THREE.MathUtils.lerp(
    gb.ledMat.emissiveIntensity,
    lampOn ? 2.6 * flicker : 0,
    0.18
  );

  // screen brightness follows the game state
  const targetEmissive = tetris.state === 'off' ? 0.16 : 0.78;
  gb.screenMat.emissiveIntensity = THREE.MathUtils.lerp(
    gb.screenMat.emissiveIntensity,
    targetEmissive,
    0.12
  );

  updatePresses(dt);

  // glare follows the viewing angle
  gb.screen.mesh.getWorldPosition(screenWorld);
  tmpVec.copy(camera.position).sub(screenWorld).normalize();
  screenNormal.set(0, 0, 1).applyQuaternion(gb.group.quaternion).normalize();
  const facing = Math.abs(tmpVec.dot(screenNormal));
  const slant = 1 - facing;
  gb.glare.material.opacity = THREE.MathUtils.lerp(
    gb.glare.material.opacity,
    0.06 + Math.pow(slant, 1.6) * 0.85,
    0.1
  );
  gb.glare.position.x = slant * 1.1;
  gb.glare.position.y = -slant * 0.5;

  // soft idle sway so the render never feels frozen
  if (introDone) {
    gb.group.rotation.y = Math.sin(now / 6000) * 0.035;
    gb.group.rotation.x = Math.sin(now / 7400) * 0.02;
  }

  controls.update();
  renderer.render(scene, camera);

  if (firstFrame) {
    firstFrame = false;
    document.getElementById('loading').classList.add('gone');
  }
}

/**
 * Embedded browsers and background tabs can throttle requestAnimationFrame to a
 * standstill. If no frame has landed for a while, drive the loop from a timer
 * so the console keeps running and stays responsive.
 */
setInterval(() => {
  if (rafId !== null && performance.now() - lastTick > 250) {
    cancelAnimationFrame(rafId);
    frame();
  }
}, 120);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Debug handle: lets you inspect the running scene from the console, and
// read back real framebuffer pixels.
window.__gb = { THREE, scene, camera, renderer, gb, tetris, chip, controls, stats };

// Power on on a plain timer rather than from inside the render loop, so the
// console still wakes up even if frames are not arriving yet.
setTimeout(() => setPower(true), 900);

frame();