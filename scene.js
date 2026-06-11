/* ============================================================
   SCAM SHIELD — scroll-driven 3D hero
   three.js r169 (ESM) + GSAP/ScrollTrigger + Lenis (UMD globals)

   Metaphor (product-true, not decoration):
   - Thousands of red "threat" shards scattered in the dark = the
     chaos of scams hitting you.
   - As you scroll, they fly in and LOCK into a curved armoured
     shield, cooling from threat-red to steel-blue, and a green
     ✓ ("safe") ignites across its face.
   - Camera flies around and into the shield as it forms.

   Reuses the OBELISK mechanism: one pinned fixed canvas, Lenis
   smooth scroll -> damped 0..1 progress -> camera spline +
   InstancedMesh assemble. UnrealBloom on the green check.
   ============================================================ */

window.addEventListener("error", (e) =>
  console.error("[SHIELD error]", e.message, e.filename, e.lineno)
);
window.addEventListener("unhandledrejection", (e) =>
  console.error("[SHIELD rejection]", e.reason)
);

import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const IS_MOBILE = window.matchMedia("(max-width: 720px)").matches;

/* ---------- renderer / scene / camera ---------- */
const canvas = document.getElementById("scene");
const renderer = new THREE.WebGLRenderer({
  canvas, antialias: !IS_MOBILE, powerPreference: "high-performance", alpha: true,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, IS_MOBILE ? 2 : 1.75));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.04;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x080c16, 0.012);

const camera = new THREE.PerspectiveCamera(
  IS_MOBILE ? 64 : 54, window.innerWidth / window.innerHeight, 0.1, 320
);
camera.position.set(0, 3, 52);

const pmrem = new THREE.PMREMGenerator(renderer);
const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
scene.environment = envRT.texture;

/* ---------- lights (cool / protective) ---------- */
const key = new THREE.DirectionalLight(0xdfeaff, 1.45);
key.position.set(10, 18, 16); scene.add(key);
const rim = new THREE.DirectionalLight(0x3a86ff, 1.25);
rim.position.set(-15, 6, -8); scene.add(rim);
scene.add(new THREE.AmbientLight(0x223047, 0.5));
/* green "safe" glow that ignites as the check forms */
const safeLight = new THREE.PointLight(0x36df8b, 0, 70, 2);
safeLight.position.set(0, 0, 8); scene.add(safeLight);

/* ---------- THE SHIELD — instanced armour plates ---------- */
const SHIELD_W = 8.4;     // world half-width
const SHIELD_H = 10.6;    // world half-height
const BULGE = 3.2;        // forward dome depth
const COLS = IS_MOBILE ? 34 : 50;
const ROWS = IS_MOBILE ? 44 : 64;

/* shield silhouette: heater shield (rounded top shoulders -> point) */
function shieldHalfWidth(y){           // y in [-1,1]
  if (y > 0.55){
    const t = (y - 0.55) / 0.45;       // 0..1 toward top
    return 1.0 - 0.26 * t * t;         // rounded top corners
  }
  const t = Math.max(0, (y + 1) / 1.55);
  return Math.pow(t, 0.82);            // taper to a point at the bottom
}

/* checkmark polyline in normalized shield space (the "safe" mark) */
const CHECK = [
  new THREE.Vector2(-0.34,  0.04),
  new THREE.Vector2(-0.07, -0.30),
  new THREE.Vector2( 0.40,  0.36),
];
function distToCheck(x, y){
  let best = 1e9;
  for (let i = 0; i < CHECK.length - 1; i++){
    const a = CHECK[i], b = CHECK[i+1];
    const abx = b.x-a.x, aby = b.y-a.y;
    const apx = x-a.x,  apy = y-a.y;
    const tt = Math.max(0, Math.min(1, (apx*abx+apy*aby)/(abx*abx+aby*aby)));
    const dx = apx-abx*tt, dy = apy-aby*tt;
    best = Math.min(best, Math.hypot(dx, dy));
  }
  return best;
}

const targets = [];
const dummy = new THREE.Object3D();
const tmpV = new THREE.Vector3();

function buildShield(){
  for (let r = 0; r < ROWS; r++){
    const yN = (r / (ROWS - 1)) * 2 - 1;            // -1..1
    const hw = shieldHalfWidth(yN);
    for (let c = 0; c < COLS; c++){
      const xN = (c / (COLS - 1)) * 2 - 1;          // -1..1
      if (Math.abs(xN) > hw - 0.012) continue;       // outside silhouette

      const onCheck = distToCheck(xN, yN) < 0.085;

      const px = xN * SHIELD_W;
      const py = yN * SHIELD_H;
      // convex dome toward camera (+z)
      const pz = BULGE * Math.max(0, 1 - (xN*xN + Math.pow(yN*0.82, 2))) + (onCheck ? 0.45 : 0);

      // plate (tile) — thin slab, gap between for armour read
      const tileW = (2 * SHIELD_W / COLS) * 0.82;
      const tileH = (2 * SHIELD_H / ROWS) * 0.82;
      const sx = onCheck ? tileW * 0.9 : tileW;
      const sy = onCheck ? tileH * 0.9 : tileH;
      const sz = onCheck ? 0.5 : 0.34;

      // scattered start — sphere-shell cloud
      const dir = new THREE.Vector3(Math.random()-0.5, Math.random()-0.5, Math.random()-0.5).normalize();
      const scatter = dir.multiplyScalar(34 + Math.random()*78);

      targets.push({
        pos: new THREE.Vector3(px, py, pz),
        scale: new THREE.Vector3(sx, sy, sz),
        tiltX: -yN * 0.42, tiltY: xN * 0.42,        // follow dome curvature
        accent: onCheck,
        scatter,
        delay: (1 - (yN*0.5+0.5)) * 0.4 + Math.random()*0.2, // top locks first-ish
        spin: (Math.random()-0.5) * 7,
      });
    }
  }
}
buildShield();

const plainIdx = [], accentIdx = [];
targets.forEach((t, i) => (t.accent ? accentIdx : plainIdx).push(i));

const plateGeo = new THREE.BoxGeometry(1, 1, 1);
const plainMat = new THREE.MeshStandardMaterial({
  color: 0xffffff, metalness: 1.0, roughness: 0.3, envMapIntensity: 1.3,
});
const accentMat = new THREE.MeshStandardMaterial({
  color: 0xffffff, emissive: 0x36df8b, emissiveIntensity: 2.4, metalness: 0.35, roughness: 0.34,
});
const mesh = new THREE.InstancedMesh(plateGeo, plainMat, plainIdx.length);
const accentMesh = new THREE.InstancedMesh(plateGeo, accentMat, accentIdx.length);
[mesh, accentMesh].forEach(m => { m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.frustumCulled = false; scene.add(m); });

/* per-instance colour: threat -> safe */
const C_THREAT = new THREE.Color(0xff4655);   // plain threat red
const C_STEEL  = new THREE.Color(0x2b3c57);   // assembled steel-blue
const C_THREAT2= new THREE.Color(0xffa23d);   // accent threat amber
const C_SAFE   = new THREE.Color(0x49f0a0);   // assembled green
const _col = new THREE.Color();
mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(plainIdx.length*3), 3);
accentMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(accentIdx.length*3), 3);

const easeOut = (x) => 1 - Math.pow(1 - x, 3);
const clamp01 = (x) => Math.min(1, Math.max(0, x));

let colorsDirty = true;
function updateInstances(assemble, t){
  const writeColor = colorsDirty || assemble < 0.999;   // skip colour writes once fully formed
  let pa = 0, aa = 0;
  for (let i = 0; i < targets.length; i++){
    const d = targets[i];
    const local = clamp01((assemble - d.delay * 0.45) / (1 - d.delay * 0.45 + 1e-4));
    const e = easeOut(local);

    tmpV.copy(d.scatter).lerp(d.pos, e);
    if (e > 0.001){                         // subtle living breath once formed
      const b = 0.05 * e;
      tmpV.x += Math.sin(t*0.6 + d.pos.y*1.5) * b;
      tmpV.y += Math.cos(t*0.5 + d.pos.x*1.5) * b;
    }
    dummy.position.copy(tmpV);
    const wob = d.spin * (1 - e);
    dummy.rotation.set(d.tiltX + wob*0.5, d.tiltY + wob, wob*0.3);
    const s = 0.16 + 0.84 * e;
    dummy.scale.set(d.scale.x, d.scale.y, d.scale.z * (0.4 + 0.6*s));
    dummy.scale.multiplyScalar(s < 1 ? (0.5 + 0.5*s) : 1);
    dummy.updateMatrix();

    if (d.accent){
      accentMesh.setMatrixAt(aa, dummy.matrix);
      if (writeColor){ _col.copy(C_THREAT2).lerp(C_SAFE, e); accentMesh.instanceColor.setXYZ(aa, _col.r, _col.g, _col.b); }
      aa++;
    } else {
      mesh.setMatrixAt(pa, dummy.matrix);
      if (writeColor){ _col.copy(C_THREAT).lerp(C_STEEL, e); mesh.instanceColor.setXYZ(pa, _col.r, _col.g, _col.b); }
      pa++;
    }
  }
  mesh.instanceMatrix.needsUpdate = true;
  accentMesh.instanceMatrix.needsUpdate = true;
  if (writeColor){ mesh.instanceColor.needsUpdate = true; accentMesh.instanceColor.needsUpdate = true; }
  colorsDirty = assemble < 0.999;
}

/* ---------- camera flythrough (shield at origin, faces +Z) ---------- */
const camPath = new THREE.CatmullRomCurve3([
  new THREE.Vector3(0, 3, 52),     // far — scattered cloud
  new THREE.Vector3(17, 7, 34),    // swing right
  new THREE.Vector3(12, -5, 22),   // drop & approach
  new THREE.Vector3(3, 0, 14.5),   // close to the face (right-biased; hero text sits left)
  new THREE.Vector3(-11, 8, 24),   // swing left & up
  new THREE.Vector3(4, 12, 30),    // crest above
  new THREE.Vector3(0, 3, 43),     // pull back — full shield reveal
]);
const lookPath = new THREE.CatmullRomCurve3([
  new THREE.Vector3(0, 1, 2),
  new THREE.Vector3(0, 0, 2),
  new THREE.Vector3(0, -1, 2),
  new THREE.Vector3(0, 0, 3),
  new THREE.Vector3(0, 2, 2),
  new THREE.Vector3(0, 1, 2),
  new THREE.Vector3(0, 0, 2),
]);
const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();

function updateCamera(p, t){
  camPath.getPointAt(clamp01(p), camPos);
  lookPath.getPointAt(clamp01(p), camLook);
  camPos.x += pointer.x * 2.0 + Math.sin(t*0.25)*0.35;
  camPos.y += pointer.y * 1.3 + Math.cos(t*0.22)*0.28;
  camera.position.lerp(camPos, 0.08);
  camera.lookAt(camLook);
  const lit = clamp01((p - 0.18) * 1.7);
  safeLight.intensity = 3.0 * lit * (0.9 + 0.1*Math.sin(t*2.0));
}

/* ---------- post ---------- */
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  IS_MOBILE ? 0.8 : 1.05, 0.72, 0.08
);
composer.addPass(bloom);
const VignetteShader = {
  uniforms: { tDiffuse: { value: null }, uAmount: { value: 1.0 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uAmount; varying vec2 vUv;
    void main(){
      vec2 uv=vUv; float d=distance(uv, vec2(0.5));
      vec3 col=texture2D(tDiffuse, uv).rgb;
      float ca = smoothstep(0.2,0.75,d)*0.0024*uAmount;
      col.r=texture2D(tDiffuse, uv+vec2(ca,0.0)).r;
      col.b=texture2D(tDiffuse, uv-vec2(ca,0.0)).b;
      col *= smoothstep(0.96,0.42,d)*0.5+0.5;
      gl_FragColor=vec4(col,1.0);
    }`,
};
composer.addPass(new ShaderPass(VignetteShader));
composer.addPass(new OutputPass());

/* ---------- pointer parallax ---------- */
const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
window.addEventListener("pointermove", (e) => {
  pointer.tx = (e.clientX / window.innerWidth - 0.5) * 2;
  pointer.ty = -(e.clientY / window.innerHeight - 0.5) * 2;
}, { passive: true });

/* ---------- scroll -> progress ---------- */
let scrollProgress = 0, damped = 0, lenis = null;
const railFill = document.getElementById("rail-fill");
function initScroll(){
  if (REDUCED){
    window.addEventListener("scroll", () => {
      const max = document.body.scrollHeight - window.innerHeight;
      scrollProgress = max > 0 ? window.scrollY / max : 0;
    }, { passive: true });
    return;
  }
  lenis = new Lenis({ lerp: 0.09, wheelMultiplier: 1.0, smoothWheel: true, syncTouch: true, syncTouchLerp: 0.075 });
  window.__lenis = lenis;
  lenis.on("scroll", ({ scroll, limit }) => {
    scrollProgress = limit > 0 ? scroll / limit : 0;
    if (railFill) railFill.style.height = (scrollProgress*100).toFixed(2) + "%";
    if (window.ScrollTrigger) ScrollTrigger.update();
  });
  if (window.gsap && window.ScrollTrigger){
    gsap.registerPlugin(ScrollTrigger);
    gsap.ticker.add((time) => lenis.raf(time*1000));
    gsap.ticker.lagSmoothing(0);
  }
}

function initReveals(){
  if (!window.gsap || !window.ScrollTrigger || REDUCED) return;
  document.querySelectorAll(".stmt-inner, .cta-inner, .hero-content").forEach((el) => {
    const kids = el.children;
    gsap.set(kids, { opacity: 0, y: 36 });
    gsap.to(kids, { opacity: 1, y: 0, duration: 1.05, stagger: 0.08, ease: "power3.out",
      scrollTrigger: { trigger: el.closest(".panel"), start: "top 72%", toggleActions: "play none none reverse" } });
  });
}

/* The 3D only needs to fully assemble across the cinematic panels, not the
   long tool section below. We map scroll so assembly completes by the CTA. */
let formEnd = 0.62;
function computeFormEnd(){
  const cine = document.getElementById("cinematic");
  const total = document.body.scrollHeight - window.innerHeight;
  if (cine && total > 0){
    formEnd = clamp01((cine.offsetTop + cine.offsetHeight * 0.9) / total);
  }
}

/* ---------- render loop ---------- */
const clock = new THREE.Clock();
let started = false;
window.__frames = 0;
function tick(){
  window.__frames++;
  const t = clock.getElapsedTime();
  pointer.x += (pointer.tx - pointer.x) * 0.05;
  pointer.y += (pointer.ty - pointer.y) * 0.05;
  damped += (scrollProgress - damped) * 0.085;

  const cineP = clamp01(damped / formEnd);          // 0..1 across cinematic
  const assemble = clamp01(cineP / 0.82);           // formed near end of cinematic
  updateInstances(assemble, t);

  // shield faces the camera; gentle sway + pointer, never a full hiding spin
  const yaw = Math.sin(t*0.18)*0.13 + pointer.x*0.16 + (cineP-0.5)*0.32;
  const pit = Math.sin(t*0.13)*0.05 + pointer.y*0.06;
  mesh.rotation.set(pit, yaw, 0);
  accentMesh.rotation.set(pit, yaw, 0);

  updateCamera(cineP, t);
  composer.render();
  requestAnimationFrame(tick);
}

/* verification helper — force-render to a given scroll progress (hidden tabs throttle rAF) */
window.__step = (p = 0.55, n = 40) => {
  for (let k = 0; k < n; k++){
    const t = k * 0.05;
    const cineP = clamp01(p / formEnd);
    const assemble = clamp01(cineP / 0.82);
    updateInstances(assemble, t);
    const yaw = (cineP - 0.5) * 0.32;
    mesh.rotation.set(0, yaw, 0); accentMesh.rotation.set(0, yaw, 0);
    updateCamera(cineP, t);
    composer.render();
  }
  return "rendered p=" + p;
};

function onResize(){
  const w = window.innerWidth, h = window.innerHeight;
  camera.aspect = w/h; camera.updateProjectionMatrix();
  renderer.setSize(w, h); composer.setSize(w, h); bloom.setSize(w, h);
  computeFormEnd();
}
window.addEventListener("resize", onResize);

/* ---------- boot ---------- */
const loaderEl = document.getElementById("loader");
const loaderFill = document.getElementById("loader-fill");
function finishLoad(){
  if (started) return;
  started = true; window.__SHIELD_STARTED__ = true;
  try {
    onResize();
    updateInstances(REDUCED ? 1 : 0.0, 0);
    initScroll(); initReveals(); computeFormEnd(); tick();
  } catch (err){ console.error("[SHIELD finishLoad failed]", err); }
  const clearLoader = () => {
    if (loaderEl.classList.contains("done")) return;
    loaderEl.classList.add("done");
    if (window.ScrollTrigger) try { ScrollTrigger.refresh(); } catch(_){}
  };
  if (loaderFill) loaderFill.style.width = "100%";
  if (window.gsap){
    gsap.to(loaderFill, { width: "100%", duration: 0.7, ease: "power2.inOut", onComplete: clearLoader });
  }
  setTimeout(clearLoader, 1200);   // hard fallback — loader can never get stuck
}
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => setTimeout(finishLoad, 200));
setTimeout(finishLoad, 2500);
window.addEventListener("load", () => setTimeout(finishLoad, 100));
