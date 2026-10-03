import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

/**
 * A Game Boy DMG-01, built from primitives. One scene unit is one centimetre,
 * which matches the real thing: 90 x 148 x 32 mm.
 *
 * The shell is an extruded rounded outline (with the DMG's chamfered bottom
 * corners) so the silhouette and the bevel highlights are right; everything on
 * the front face — wordmark, labels, speaker — is either geometry or printed on
 * a transparent decal so it stays crisp at any zoom.
 */

const BODY_W = 9.0;
const BODY_H = 14.8;
const BODY_D = 3.2;
const FACE_Z = BODY_D / 2;

const SCREEN = { w: 4.7, h: 4.23, x: -0.75, y: 3.72 };
const BEZEL = { w: 6.5, h: 5.78, x: -0.75, y: 3.72 };

const COLORS = {
  shell: 0xcbc7bd,
  bezel: 0x4a4a52,
  bezelDeep: 0x2b2b32,
  button: 0x33333b,
  lcdFrame: 0x1d1d22,
  magenta: 0xb5296a,
  blue: 0x2f6fd8,
  led: 0xff3b30,
};

/* ------------------------------------------------------------------ *
 * Printed artwork
 * ------------------------------------------------------------------ */

const PX = 100; // decal pixels per centimetre

/** Body-space (cm, origin at the centre of the face) → decal pixels. */
function toDecal(x, y) {
  return [(x + BODY_W / 2) * PX, (BODY_H / 2 - y) * PX];
}

function drawTracked(ctx, text, x, y, size, spacing, color, align = 'center') {
  ctx.fillStyle = color;
  ctx.font = `700 ${size}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
  ctx.textBaseline = 'alphabetic';

  const chars = [...text];
  const widths = chars.map((c) => ctx.measureText(c).width);
  const total = widths.reduce((a, b) => a + b, 0) + spacing * (chars.length - 1);

  let cx = align === 'center' ? x - total / 2 : x;
  for (let i = 0; i < chars.length; i++) {
    ctx.fillText(chars[i], cx, y);
    cx += widths[i] + spacing;
  }
  return total;
}

function makeFrontDecal() {
  const canvas = document.createElement('canvas');
  canvas.width = BODY_W * PX;
  canvas.height = BODY_H * PX;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // ---- power lamp caption ----
  let [lx, ly] = toDecal(-2.75, 6.95);
  drawTracked(ctx, 'POWER', lx, ly + 9, 15, 1.6, '#7d7a72', 'left');

  // ---- GAME BOY wordmark, with a nod to the boot-screen stripe ----
  const [wx, wy] = toDecal(-0.75, 0.34);
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.28)';
  ctx.shadowBlur = 4;
  ctx.shadowOffsetY = 2;
  drawTracked(ctx, 'GAME BOY', wx, wy, 62, 3, '#232a63');
  ctx.restore();

  const markW = drawTracked(ctx, 'GAME BOY', wx, wy, 62, 3, '#232a63');
  ctx.font = '700 16px Helvetica, Arial, sans-serif';
  ctx.fillStyle = '#232a63';
  ctx.fillText('™', wx + markW / 2 + 8, wy);

  const stripeY = wy + 15;
  const stripeW = markW * 0.98;
  const segs = ['#7f3bb5', '#b5296a', '#d8442f', '#2f6fd8'];
  segs.forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.fillRect(wx - stripeW / 2 + (stripeW / segs.length) * i, stripeY, stripeW / segs.length - 1.5, 7);
  });

  // ---- the tagline the real DMG carries ----
  const [tx, ty] = toDecal(-0.75, -0.62);
  drawTracked(ctx, 'DOT MATRIX WITH STEREO SOUND', tx, ty, 16, 1.4, '#6f6c65');

  // ---- button labels ----
  let [ax, ay] = toDecal(3.16, -3.62);
  drawTracked(ctx, 'A', ax, ay, 30, 0, '#4b4b52');
  let [bx, by] = toDecal(1.62, -3.0);
  drawTracked(ctx, 'B', bx, by, 30, 0, '#4b4b52');

  // ---- select / start with their arrows ----
  const [sx, sy] = toDecal(-0.98, -5.42);
  drawTracked(ctx, 'SELECT', sx, sy, 13, 1.2, '#7d7a72');
  const [tx2, ty2] = toDecal(1.0, -5.42);
  drawTracked(ctx, 'START', tx2, ty2, 13, 1.2, '#7d7a72');

  ctx.fillStyle = '#8b8880';
  ctx.beginPath();
  ctx.moveTo(...toDecal(-1.62, -5.06));
  ctx.lineTo(...toDecal(-1.9, -4.92));
  ctx.lineTo(...toDecal(-1.9, -5.2));
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(...toDecal(0.64, -5.06));
  ctx.lineTo(...toDecal(0.36, -4.92));
  ctx.lineTo(...toDecal(0.36, -5.2));
  ctx.closePath();
  ctx.fill();

  // ---- Nintendo wordmark, bottom left ----
  const [nx, ny] = toDecal(-2.55, -6.62);
  ctx.fillStyle = '#5d5a54';
  ctx.font = 'italic 700 34px Georgia, "Times New Roman", serif';
  ctx.textAlign = 'center';
  ctx.fillText('Nintendo', nx, ny);
  ctx.textAlign = 'left';

  // ---- moulded ridge above the d-pad ----
  ctx.strokeStyle = 'rgba(0,0,0,0.07)';
  ctx.lineWidth = 3;
  const [r1x, r1y] = toDecal(-4.2, -4.5);
  const [r2x, r2y] = toDecal(4.2, -6.9);
  ctx.beginPath();
  ctx.moveTo(r1x, r1y);
  ctx.lineTo(r2x, r2y);
  ctx.stroke();

  return canvas;
}

function makeBackDecal() {
  const canvas = document.createElement('canvas');
  canvas.width = BODY_W * PX;
  canvas.height = BODY_H * PX;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#6b6862';

  const [x1, y1] = toDecal(0, 3.1);
  drawTracked(ctx, 'Nintendo GAME BOY™', x1, y1, 34, 1.5, '#6b6862');
  const [x2, y2] = toDecal(0, 2.4);
  drawTracked(ctx, 'MODEL NO. DMG-01', x2, y2, 20, 1.2, '#7d7a72');
  const [x3, y3] = toDecal(0, 1.95);
  drawTracked(ctx, 'PAT. PEND.    MADE IN JAPAN', x3, y3, 18, 1.2, '#8b8880');

  // battery cover seam
  ctx.strokeStyle = 'rgba(0,0,0,0.13)';
  ctx.lineWidth = 4;
  const [sx, sy] = toDecal(0, 0.2);
  ctx.strokeRect(sx - 340, sy - 150, 680, 780);

  return canvas;
}

function decalTexture(canvas) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/* ------------------------------------------------------------------ *
 * Geometry helpers
 * ------------------------------------------------------------------ */

function roundedBox(w, h, d, r = 0.08, seg = 2) {
  return new RoundedBoxGeometry(w, h, d, seg, Math.min(r, Math.min(w, h, d) / 2 - 0.001));
}

function shellGeometry() {
  const r = 0.78;
  const c = 0.95; // bottom corner chamfer
  const hw = BODY_W / 2;
  const hh = BODY_H / 2;

  const s = new THREE.Shape();
  s.moveTo(-hw + c, -hh);
  s.lineTo(hw - c, -hh);
  s.lineTo(hw, -hh + c);
  s.lineTo(hw, hh - r);
  s.quadraticCurveTo(hw, hh, hw - r, hh);
  s.lineTo(-hw + r, hh);
  s.quadraticCurveTo(-hw, hh, -hw, hh - r);
  s.lineTo(-hw, -hh + c);
  s.lineTo(-hw + c, -hh);

  const bevel = 0.07;
  const geo = new THREE.ExtrudeGeometry(s, {
    depth: BODY_D - bevel * 2,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelOffset: 0,
    bevelSegments: 3,
    curveSegments: 12,
  });
  geo.translate(0, 0, -(BODY_D - bevel * 2) / 2);
  geo.computeVertexNormals();
  return geo;
}

function decalMesh(canvas, z, flip = false) {
  const geo = new THREE.PlaneGeometry(BODY_W, BODY_H);
  const mat = new THREE.MeshStandardMaterial({
    map: decalTexture(canvas),
    transparent: true,
    roughness: 0.6,
    metalness: 0,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.z = z;
  if (flip) mesh.rotation.y = Math.PI;
  mesh.renderOrder = 2;
  return mesh;
}

/* ------------------------------------------------------------------ *
 * Build
 * ------------------------------------------------------------------ */

export function buildGameBoy(screenCanvas) {
  const group = new THREE.Group();

  const shellMat = new THREE.MeshPhysicalMaterial({
    color: COLORS.shell,
    roughness: 0.68,
    metalness: 0,
    clearcoat: 0.22,
    clearcoatRoughness: 0.65,
  });
  const bezelMat = new THREE.MeshPhysicalMaterial({
    color: COLORS.bezel,
    roughness: 0.46,
    metalness: 0,
    clearcoat: 0.3,
    clearcoatRoughness: 0.4,
  });
  const deepMat = new THREE.MeshStandardMaterial({ color: COLORS.bezelDeep, roughness: 0.7 });
  const buttonMat = new THREE.MeshPhysicalMaterial({
    color: COLORS.button,
    roughness: 0.42,
    metalness: 0,
    clearcoat: 0.4,
    clearcoatRoughness: 0.35,
  });

  /* ---------------- shell ---------------- */
  const shell = new THREE.Mesh(shellGeometry(), shellMat);
  shell.castShadow = true;
  shell.receiveShadow = true;
  group.add(shell);

  // battery cover on the back, plus two screws
  const cover = new THREE.Mesh(roundedBox(6.8, 7.8, 0.1, 0.2, 3), shellMat);
  cover.position.set(0, -1.5, -FACE_Z - 0.03);
  cover.receiveShadow = true;
  group.add(cover);

  const screwMat = new THREE.MeshStandardMaterial({ color: 0x9d9a92, roughness: 0.35, metalness: 0.85 });
  for (const [sx, sy] of [[-3.85, 6.35], [3.85, 6.35], [-3.85, -6.6], [3.85, -6.6]]) {
    const screw = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.06, 16), screwMat);
    screw.rotation.x = Math.PI / 2;
    screw.position.set(sx, sy, -FACE_Z - 0.06);
    group.add(screw);
    const slot = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.05, 0.02), deepMat);
    slot.position.set(sx, sy, -FACE_Z - 0.1);
    group.add(slot);
  }

  group.add(decalMesh(makeBackDecal(), -FACE_Z - 0.09, true));

  /* ---------------- front decal ---------------- */
  group.add(decalMesh(makeFrontDecal(), FACE_Z + 0.006));

  /* ---------------- screen ---------------- */
  const screenGroup = new THREE.Group();
  screenGroup.position.set(SCREEN.x, SCREEN.y, 0);
  group.add(screenGroup);

  const barV = (BEZEL.h - SCREEN.h) / 2;   // height of top/bottom bars
  const barH = (BEZEL.w - SCREEN.w) / 2;   // width of left/right bars
  const frameZ = FACE_Z + 0.05;
  const frameDepth = 0.18;

  const addBar = (w, h, x, y, mat, depth = frameDepth, z = frameZ) => {
    const bar = new THREE.Mesh(roundedBox(w, h, depth, 0.06, 2), mat);
    bar.position.set(x, y, z - depth / 2);
    bar.castShadow = true;
    return bar;
  };

  screenGroup.add(addBar(BEZEL.w, barV, 0, SCREEN.h / 2 + barV / 2, bezelMat));
  screenGroup.add(addBar(BEZEL.w, barV, 0, -SCREEN.h / 2 - barV / 2, bezelMat));
  screenGroup.add(addBar(barH, SCREEN.h, -SCREEN.w / 2 - barH / 2, 0, bezelMat));
  screenGroup.add(addBar(barH, SCREEN.h, SCREEN.w / 2 + barH / 2, 0, bezelMat));

  // black lip hugging the glass
  const lip = 0.1;
  const lipMat = deepMat;
  screenGroup.add(addBar(SCREEN.w + lip * 2, lip, 0, SCREEN.h / 2 + lip / 2, lipMat, 0.1, FACE_Z + 0.035));
  screenGroup.add(addBar(SCREEN.w + lip * 2, lip, 0, -SCREEN.h / 2 - lip / 2, lipMat, 0.1, FACE_Z + 0.035));
  screenGroup.add(addBar(lip, SCREEN.h, -SCREEN.w / 2 - lip / 2, 0, lipMat, 0.1, FACE_Z + 0.035));
  screenGroup.add(addBar(lip, SCREEN.h, SCREEN.w / 2 + lip / 2, 0, lipMat, 0.1, FACE_Z + 0.035));

  // recessed backing behind the glass
  const backing = new THREE.Mesh(
    new THREE.PlaneGeometry(SCREEN.w, SCREEN.h),
    new THREE.MeshStandardMaterial({ color: 0x6f7a45, roughness: 0.9 })
  );
  backing.position.z = FACE_Z - 0.04;
  screenGroup.add(backing);

  // the LCD itself
  const screenTex = new THREE.CanvasTexture(screenCanvas);
  screenTex.colorSpace = THREE.SRGBColorSpace;
  screenTex.magFilter = THREE.LinearFilter;
  screenTex.minFilter = THREE.LinearFilter;
  screenTex.generateMipmaps = false;

  const screenMat = new THREE.MeshStandardMaterial({
    map: screenTex,
    emissive: 0xffffff,
    emissiveMap: screenTex,
    emissiveIntensity: 0.72,
    roughness: 0.32,
    metalness: 0,
  });
  const screenMesh = new THREE.Mesh(new THREE.PlaneGeometry(SCREEN.w, SCREEN.h), screenMat);
  screenMesh.position.z = FACE_Z + 0.012;
  screenGroup.add(screenMesh);

  // moving glare across the glass
  const glareTex = makeGlareTexture();
  const glareMat = new THREE.MeshBasicMaterial({
    map: glareTex,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    opacity: 0.0,
  });
  const glare = new THREE.Mesh(new THREE.PlaneGeometry(SCREEN.w * 1.5, SCREEN.h * 1.7), glareMat);
  glare.position.z = FACE_Z + 0.045;
  glare.renderOrder = 3;
  screenGroup.add(glare);

  /* ---------------- power lamp ---------------- */
  const ledMat = new THREE.MeshStandardMaterial({
    color: 0x5a1410,
    emissive: COLORS.led,
    emissiveIntensity: 0,
    roughness: 0.25,
  });
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.15, 20, 14), ledMat);
  led.position.set(-3.35, 6.95, FACE_Z + 0.03);
  group.add(led);
  const ledRing = new THREE.Mesh(
    new THREE.RingGeometry(0.17, 0.22, 24),
    new THREE.MeshStandardMaterial({ color: 0x55524c, roughness: 0.6 })
  );
  ledRing.position.set(-3.35, 6.95, FACE_Z + 0.005);
  group.add(ledRing);

  /* ---------------- d-pad ---------------- */
  const dpad = new THREE.Group();
  dpad.position.set(-2.5, -2.7, 0);
  group.add(dpad);

  const armH = new THREE.Mesh(roundedBox(2.95, 1.06, 0.3, 0.12, 3), buttonMat);
  const armV = new THREE.Mesh(roundedBox(1.06, 2.95, 0.3, 0.12, 3), buttonMat);
  for (const arm of [armH, armV]) {
    arm.position.z = FACE_Z + 0.1;
    arm.castShadow = true;
    dpad.add(arm);
  }
  const pivot = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.34, 20), buttonMat);
  pivot.rotation.x = Math.PI / 2;
  pivot.position.z = FACE_Z + 0.1;
  dpad.add(pivot);

  // hit zones tile the cross exactly, so every part of the pad is clickable
  const zoneMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
  const DIRS = {
    up: [0, 0.74, 1.06, 1.48],
    down: [0, -0.74, 1.06, 1.48],
    left: [-0.74, 0, 1.48, 1.06],
    right: [0.74, 0, 1.48, 1.06],
  };
  for (const [name, [dx, dy, w, h]] of Object.entries(DIRS)) {
    const zone = new THREE.Mesh(new THREE.PlaneGeometry(w, h), zoneMat);
    zone.position.set(dx, dy, FACE_Z + 0.3);
    zone.userData.action = name;
    dpad.add(zone);
  }

  /* ---------------- A / B ---------------- */
  const faceAngle = -Math.PI / 9; // -20°
  const buttons = {};
  for (const [name, label, ox, oy] of [['b', 'B', 1.74, -1.97], ['a', 'A', 3.16, -2.63]]) {
    const btn = new THREE.Group();
    btn.position.set(ox, oy, 0);
    btn.rotation.z = faceAngle;
    group.add(btn);

    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.66, 0.4, 40), buttonMat);
    cap.rotation.x = Math.PI / 2;
    cap.position.z = FACE_Z + 0.11;
    cap.castShadow = true;
    btn.add(cap);

    // coloured ring on the A button, like the real thing
    if (name === 'a') {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.5, 0.045, 10, 40),
        new THREE.MeshStandardMaterial({ color: COLORS.magenta, roughness: 0.4 })
      );
      ring.position.z = FACE_Z + 0.29;
      btn.add(ring);
    } else {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.5, 0.045, 10, 40),
        new THREE.MeshStandardMaterial({ color: COLORS.blue, roughness: 0.4 })
      );
      ring.position.z = FACE_Z + 0.29;
      btn.add(ring);
    }

    const hit = new THREE.Mesh(new THREE.CircleGeometry(0.78, 24), zoneMat);
    hit.position.z = FACE_Z + 0.34;
    hit.userData.action = name;
    btn.add(hit);

    buttons[name] = btn;
  }

  /* ---------------- start / select ---------------- */
  for (const [name, ox] of [['select', -0.98], ['start', 1.0]]) {
    const btn = new THREE.Group();
    btn.position.set(ox, -4.9, 0);
    btn.rotation.z = faceAngle;
    group.add(btn);

    const cap = new THREE.Mesh(roundedBox(1.5, 0.56, 0.3, 0.26, 4), buttonMat);
    cap.position.z = FACE_Z + 0.09;
    cap.castShadow = true;
    btn.add(cap);

    const hit = new THREE.Mesh(roundedBox(1.7, 0.72, 0.3, 0.3, 3), zoneMat);
    hit.position.z = FACE_Z + 0.2;
    hit.userData.action = name;
    btn.add(hit);

    buttons[name] = btn;
  }

  /* ---------------- speaker ---------------- */
  const speaker = new THREE.Group();
  speaker.position.set(2.45, -4.6, FACE_Z + 0.012);
  speaker.rotation.z = faceAngle;
  group.add(speaker);

  const slotMat = new THREE.MeshStandardMaterial({ color: COLORS.lcdFrame, roughness: 0.85 });
  const slotGeo = roundedBox(1.0, 0.2, 0.1, 0.09, 3);
  for (let i = 0; i < 6; i++) {
    const slot = new THREE.Mesh(slotGeo, slotMat);
    slot.position.y = (i - 2.5) * 0.44;
    speaker.add(slot);
  }

  /* ---------------- power switch (top edge) ---------------- */
  const power = new THREE.Group();
  power.position.set(-2.3, BODY_H / 2 - 0.02, 0);
  group.add(power);

  const switchWell = new THREE.Mesh(roundedBox(1.9, 0.24, 0.9, 0.08, 3), deepMat);
  switchWell.position.y = 0.03;
  power.add(switchWell);

  const slider = new THREE.Mesh(roundedBox(0.85, 0.3, 0.78, 0.1, 3), buttonMat);
  slider.position.set(-0.42, 0.13, 0);
  slider.castShadow = true;
  power.add(slider);

  const ribs = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const rib = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.06), deepMat);
    rib.position.set(0, 0.16, (i - 1) * 0.22);
    ribs.add(rib);
  }
  slider.add(ribs);

  const powerHit = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.6, 1.0), zoneMat);
  powerHit.position.y = 0.2;
  powerHit.userData.action = 'power';
  power.add(powerHit);

  /* ---------------- edge details ---------------- */
  // volume wheel, right side
  const wheel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.42, 0.42, 0.22, 28),
    new THREE.MeshStandardMaterial({ color: 0xa8a49a, roughness: 0.5 })
  );
  wheel.rotation.z = Math.PI / 2;
  wheel.position.set(BODY_W / 2 + 0.02, 0.4, 0.2);
  group.add(wheel);

  // headphone jack, bottom edge
  const jack = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.22, 24), deepMat);
  jack.position.set(1.4, -BODY_H / 2 - 0.02, 0.3);
  group.add(jack);

  // link port cover, top edge
  const link = new THREE.Mesh(roundedBox(1.9, 0.22, 1.1, 0.08, 3), deepMat);
  link.position.set(2.3, BODY_H / 2 - 0.02, 0);
  group.add(link);

  // cartridge seam on the back edge
  const seam = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.03, 0.04), deepMat);
  seam.position.set(0, -3.9, -FACE_Z - 0.05);
  group.add(seam);

  /* ---------------- interaction surface ---------------- */
  const hits = [];
  const registerHit = (obj) => {
    if (obj.userData.action) {
      obj.userData.isButton = true;
      hits.push(obj);
    }
  };
  dpad.traverse(registerHit);
  Object.values(buttons).forEach((b) => b.traverse(registerHit));
  registerHit(powerHit);

  return {
    group,
    hits,
    dpad,
    buttons,
    slider,
    screen: { mesh: screenMesh, material: screenMat, texture: screenTex },
    glare,
    ledMat,
    screenMat,
    powerOn: false,
  };
}

/** Soft diagonal streak used as a fake reflection on the glass. */
function makeGlareTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 256, 256);
  grad.addColorStop(0.0, 'rgba(255,255,255,0)');
  grad.addColorStop(0.38, 'rgba(255,255,255,0.42)');
  grad.addColorStop(0.46, 'rgba(255,255,255,0.10)');
  grad.addColorStop(0.52, 'rgba(255,255,255,0.30)');
  grad.addColorStop(0.62, 'rgba(255,255,255,0)');
  grad.addColorStop(1.0, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}