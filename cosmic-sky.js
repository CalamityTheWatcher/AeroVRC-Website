/* ============================================================
   cosmic-sky.js — the shared cosmic sky behind the inner pages.
   A focused port of the flagship engine in index.html ("The
   Threshold"): renderer + ACES tonemapping, adaptive quality
   tiers (+ ?tier= override), the domain-warped fbm nebula (the
   space dust / fog), the twinkling diffraction-spike starfield,
   LOW per-tier UnrealBloom (this sky sits UNDER body text), the
   60fps-capped / 30fps-idle render loop, and THE FREEZE
   (unfocused/hidden tab → loop stopped + body.frozen → ~0% GPU).
   Plus the flagship input polish: custom cursor + click pings
   (GSAP-gated, fine pointers only, event-driven — no persistent
   rAF of its own).
   NO planet kit, NO boot curtain, NO audio. Any failure — no
   WebGL, CDN unreachable — means do nothing: each page's scoped
   CSS nebula remains the floor (it also covers reduced-motion
   and no-JS).
   Per-page config, read ONCE at init:
     window.COSMIC_SKY = { dim: 0..1 }  // scales nebula/star/bloom intensity (default 1)
   Testing: window.__skyFrames counts rendered frames;
   <html data-sky-tier> exposes the active tier.
   ============================================================ */
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const finePointer  = matchMedia("(hover: hover) and (pointer: fine)").matches;
const isDesktop    = () => matchMedia("(min-width: 900px)").matches;
const CFG = window.COSMIC_SKY || {};
const DIM = Math.min(1, Math.max(0, typeof CFG.dim === "number" ? CFG.dim : 1));

try { initSky(); }   catch (e) { /* the backdrop is optional — the CSS sky stands */ }
try { initInput(); } catch (e) { /* the input polish is optional too */ }

/* ==================== the sky ==================== */
function initSky() {
  const canvas = document.getElementById("sky");
  if (!canvas) return;

  let renderer = null;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  } catch (err) {}
  if (!renderer) { canvas.style.display = "none"; return; }   // CSS sky carries the page
  renderer.setClearColor(0x040816, 1);   // the scene owns the background (bloom-friendly)
  /* ACES filmic tonemapping: additive glow (bloom, bright stars) rolls off
     softly instead of clipping to flat white. Bloom strengths in TIERS are
     tuned FOR this curve — change them together. */
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  /* ---- adaptive quality tiers ----
     The sky is fill-rate bound, so it scales to the visitor's GPU. A tier
     sets BAKED settings (particle counts, nebula octaves) and RUNTIME
     settings (DPR, bloom — which the fps watchdog can lower live).
     bloomStr runs LOWER than the flagship splash on purpose: this is a
     backdrop under reading copy, not the hero shot. */
  const TIER_ORDER = ["ultra", "high", "balanced", "lite"];
  const TIERS = {
    ultra:    { dpr: 1.75, bloom: true,  bloomStr: 0.34, bloomHalf: false, parts: 1.0,  neb: 4 },
    high:     { dpr: 1.5,  bloom: true,  bloomStr: 0.30, bloomHalf: false, parts: 0.85, neb: 4 },
    balanced: { dpr: 1.25, bloom: true,  bloomStr: 0.26, bloomHalf: true,  parts: 0.6,  neb: 3 },
    lite:     { dpr: 1.0,  bloom: false, bloomStr: 0,    bloomHalf: true,  parts: 0.4,  neb: 3 }
  };
  function guessTierFromGPU() {
    let s = "";
    try {
      const gl = renderer.getContext();
      const dbg = gl.getExtension("WEBGL_debug_renderer_info");
      s = (dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : "").toLowerCase();
    } catch (e) {}
    if (/swiftshader|llvmpipe|software|mali|adreno|powervr|apple gpu/.test(s)) return "lite";
    if (/rtx\s*(40|50)\d\d|rtx\s*30(80|90)|rx\s*(69|78|79)\d\d/.test(s)) return "ultra";
    if (/rtx\s*(20|30)\d\d|gtx\s*16\d\d|rx\s*(58|59|66|67|68)\d\d|apple\s*m[1-9]/.test(s)) return "high";
    if (/gtx\s*(10|9)\d\d|rx\s*(4|5[0-6])\d\d|iris|radeon|geforce/.test(s)) return "balanced";
    if (/intel|uhd|hd graphics/.test(s)) return "lite";
    return "high";   // unknown but WebGL-capable desktop → sensible middle
  }
  // ?tier=ultra|high|balanced|lite forces a tier (testing); else auto.
  const forcedTier = new URLSearchParams(location.search).get("tier");
  let tierIdx = TIER_ORDER.indexOf(
    TIER_ORDER.includes(forcedTier) ? forcedTier
    : !isDesktop() ? "balanced"                    // phones start no higher than balanced
    : guessTierFromGPU()
  );
  if (tierIdx < 0) tierIdx = 1;
  const Q = { ...TIERS[TIER_ORDER[tierIdx]] };     // live copy the watchdog mutates
  let bloomOn = Q.bloom && Q.bloomStr * DIM > 0.01;
  document.documentElement.dataset.skyTier = TIER_ORDER[tierIdx];
  const pScale = (n) => Math.max(24, Math.round(n * Q.parts));   // particle-count scaler (floor so nothing vanishes)

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.1, 120);
  camera.position.set(0, 0, 7.2);

  /* ---- deep-space nebula: fbm noise plane far behind everything ---- */
  const nebulaMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uDim: { value: DIM } },
    depthWrite: false,
    vertexShader: /* glsl */`
      varying vec2 vUv;
      void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
      uniform float uTime; uniform float uDim; varying vec2 vUv;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p){
        vec2 i = floor(p), f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1,0)), u.x),
                   mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), u.x), u.y);
      }
      float fbm(vec2 p){
        float v = 0.0, a = 0.5;
        for (int i = 0; i < ${Q.neb}; i++){ v += a * noise(p); p *= 2.03; a *= 0.5; }
        return v;
      }
      void main(){
        vec2 uv = vUv * vec2(2.2, 1.4);
        // domain warp: wisps get pulled into filaments instead of soft blobs
        vec2 w = vec2(fbm(uv * 1.4 + uTime * 0.006), fbm(uv * 1.4 - uTime * 0.005 + 3.7));
        float n1 = fbm(uv * 2.0 + (w - 0.5) * 2.1 + vec2(uTime * 0.016, -uTime * 0.011));
        float n2 = fbm(uv * 3.4 + (w.yx - 0.5) * 2.6 - vec2(uTime * 0.009,  uTime * 0.013) + 7.3);
        vec3 col = vec3(0.016, 0.031, 0.086);                       // bg-deep
        col += vec3(0.29, 0.61, 1.00) * smoothstep(0.52, 0.95, n1) * 0.16 * uDim;  // aero wisps
        col += vec3(0.35, 0.40, 0.95) * smoothstep(0.58, 0.98, n2) * 0.12 * uDim;  // blurple wisps
        col += vec3(0.00, 0.94, 1.00) * smoothstep(0.72, 1.00, n1 * n2 * 1.6) * 0.08 * uDim; // cyan sparks
        float falloff = 1.0 - smoothstep(0.25, 0.75, distance(vUv, vec2(0.5, 0.52)));
        col = mix(vec3(0.016, 0.031, 0.086), col, falloff);
        col += (hash(gl_FragCoord.xy) - 0.5) / 255.0;   // dither — kills banding in the deep navy
        gl_FragColor = vec4(col, 1.0);
      }`
  });
  const nebula = new THREE.Mesh(new THREE.PlaneGeometry(120, 70), nebulaMat);
  nebula.position.z = -42;
  scene.add(nebula);

  /* ---- twinkle shader (diffraction spikes on the bright ones) ---- */
  function makeTwinkleMaterial(basePx) {
    return new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uPx: { value: basePx }, uFade: { value: DIM } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */`
        uniform float uTime; uniform float uPx;
        attribute float aSize; attribute float aPhase; attribute float aSpeed;
        attribute vec3 aColor;
        varying vec3 vColor; varying float vTw; varying float vPx; varying float vNear;
        void main(){
          vTw = 0.55 + 0.45 * sin(uTime * aSpeed + aPhase);
          vColor = aColor;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = clamp(aSize * vTw * (uPx / -mv.z), 1.0, 34.0);
          vPx = gl_PointSize;
          vNear = smoothstep(2.2, 4.5, -mv.z);   // motes drifting into the lens fade out
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */`
        uniform float uFade;
        varying vec3 vColor; varying float vTw; varying float vPx; varying float vNear;
        void main(){
          vec2 p = gl_PointCoord - 0.5;
          float d = length(p);
          float a = smoothstep(0.5, 0.06, d);
          // diffraction spikes — bright sprites earn the 4-point flare
          float spikeW = smoothstep(8.0, 15.0, vPx);
          float cross = max(
            smoothstep(0.045, 0.0, abs(p.y)) * smoothstep(0.5, 0.05, abs(p.x)),
            smoothstep(0.045, 0.0, abs(p.x)) * smoothstep(0.5, 0.05, abs(p.y)));
          a = min(a + cross * spikeW * 0.85, 1.0);
          gl_FragColor = vec4(vColor, a * vTw * uFade * vNear);
        }`
    });
  }
  const AERO = [0.29, 0.61, 1.0], CYAN = [0.0, 0.94, 1.0], ICE = [0.66, 0.82, 1.0];

  /* ---- starfield: twinkling motes with real depth ---- */
  const starCount = pScale(Math.min(2600, (innerWidth * innerHeight) / 820));
  const starMat = makeTwinkleMaterial(240);
  const pos = new Float32Array(starCount * 3);
  const col = new Float32Array(starCount * 3);
  const size = new Float32Array(starCount);
  const phase = new Float32Array(starCount);
  const speed = new Float32Array(starCount);
  for (let i = 0; i < starCount; i++) {
    const r = 9 + Math.pow(Math.random(), 0.7) * 22;      // depth spread, never in your face
    const th = Math.random() * Math.PI * 2;
    const ph = Math.acos(2 * Math.random() - 1);
    pos[i*3]     = r * Math.sin(ph) * Math.cos(th);
    pos[i*3 + 1] = r * Math.sin(ph) * Math.sin(th) * 0.6; // flatten vertically
    pos[i*3 + 2] = r * Math.cos(ph);
    const c = Math.random() < 0.65 ? AERO : (Math.random() < 0.7 ? CYAN : ICE);
    const b = 0.4 + Math.random() * 0.6;
    col[i*3] = c[0]*b; col[i*3+1] = c[1]*b; col[i*3+2] = c[2]*b;
    size[i]  = 0.4 + Math.random() * 0.8;
    phase[i] = Math.random() * Math.PI * 2;
    speed[i] = 0.4 + Math.random() * 1.6;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("aColor",   new THREE.BufferAttribute(col, 3));
  geo.setAttribute("aSize",    new THREE.BufferAttribute(size, 1));
  geo.setAttribute("aPhase",   new THREE.BufferAttribute(phase, 1));
  geo.setAttribute("aSpeed",   new THREE.BufferAttribute(speed, 1));
  const stars = new THREE.Points(geo, starMat);
  scene.add(stars);

  /* ---- post-processing: bloom, per tier, dimmed with the page ---- */
  let composer = null, bloomPass = null;
  if (bloomOn) {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    bloomPass = new UnrealBloomPass(
      new THREE.Vector2(innerWidth, innerHeight),
      Q.bloomStr * (isDesktop() ? 1 : 0.75) * DIM,   // strength: tier × mobile soften × page dim
      0.85,                                           // radius — tight core, soft skirt
      0.30                                            // threshold — only the bright stuff glows
    );
    if (Q.bloomHalf) {                                // balanced tier: half-res bloom, ~¼ the cost
      const base = bloomPass.setSize.bind(bloomPass);
      bloomPass.setSize = (w, h) => base(w / 2, h / 2);
    }
    composer.addPass(bloomPass);
    composer.addPass(new OutputPass());
  }

  /* ---- layout / resize ---- */
  function layout() {
    const dpr = Math.min(devicePixelRatio, Q.dpr);   // DPR cap from the active tier
    renderer.setPixelRatio(dpr);
    renderer.setSize(innerWidth, innerHeight);
    if (composer) { composer.setPixelRatio(dpr); composer.setSize(innerWidth, innerHeight); }
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
  }
  layout();
  window.addEventListener("resize", layout, { passive: true });

  /* ---- render loop (adaptive, freezable) ---- */
  const clock = new THREE.Clock();
  let slowFrames = 0, simTime = 0, frameAcc = 0;
  let lastActive = performance.now();
  const wake = () => { lastActive = performance.now(); };
  window.addEventListener("pointermove", wake, { passive: true });
  window.addEventListener("pointerdown", wake, { passive: true });
  window.addEventListener("wheel", wake, { passive: true });
  window.addEventListener("keydown", wake, { passive: true });
  let idleMode = false;
  function loop() {
    // 60fps render cap (a 144/240Hz monitor would otherwise draw 3–4× more
    // frames than needed); after 8s without input the ambient sky idles at
    // 30fps. While input is fresh (<1.1s) render every rAF — the skip-cap
    // has uneven pacing on high-refresh monitors, which reads as judder
    // exactly when the visitor is interacting.
    frameAcc += clock.getDelta();
    const now = performance.now();
    idleMode = now - lastActive > 8000;
    const hot = now - lastActive < 1100;
    if (!hot && frameAcc < (idleMode ? 1 / 31 : 1 / 62)) return;
    tick(Math.min(frameAcc, 0.05));
    frameAcc = 0;
  }
  // fps watchdog step-down: DPR toward 0.9, then bloom off
  function downgradeQuality() {
    if (Q.dpr > 0.95) Q.dpr = Math.max(0.9, Q.dpr - 0.25);
    else if (bloomOn) bloomOn = false;
    else return;
    if (document.documentElement.dataset.skyTier) document.documentElement.dataset.skyTier += "↓";
    layout();
  }
  function tick(dt) {
    simTime += dt;              // own clock — no time jump after tab switches
    const t = simTime;
    // active rendering only; the idle 30fps cadence is intentional
    if (!idleMode && (Q.dpr > 0.95 || bloomOn)) {
      if (dt > 0.028) slowFrames++; else slowFrames = Math.max(0, slowFrames - 1);
      if (slowFrames > 110) { downgradeQuality(); slowFrames = 0; }
    }
    stars.rotation.y = t * 0.01;
    nebulaMat.uniforms.uTime.value = t;
    starMat.uniforms.uTime.value = t;
    if (bloomOn && composer) composer.render();
    else renderer.render(scene, camera);
    window.__skyFrames = (window.__skyFrames || 0) + 1;   // testing hook
  }

  if (reduceMotion) {
    tick(1 / 60);                              // one static frame, no loop
    window.addEventListener("resize", () => tick(1 / 60), { passive: true });   // fresh static frame, still no loop
    return;
  }
  /* THE FREEZE — pause ALL rendering when the tab is hidden OR the window
     merely loses focus: the sky is doing nothing anyone can see. body.frozen
     also halts every CSS animation, taking an unwatched tab to ~0 GPU. */
  let running = false;
  const setRunning = (on) => {
    if (on === running) return;
    running = on;
    renderer.setAnimationLoop(on ? loop : null);
    document.body.classList.toggle("frozen", !on);
    if (on) { clock.getDelta(); frameAcc = 0; lastActive = performance.now(); } // no time jump / fresh idle window
  };
  setRunning(!document.hidden && document.hasFocus());   // correct even when loaded unfocused
  if (!running) tick(1 / 60);                            // …but paint one frame so the sky isn't blank
  window.addEventListener("blur",  () => setRunning(false));
  window.addEventListener("focus", () => setRunning(true));
  document.addEventListener("visibilitychange", () => {
    setRunning(!document.hidden && document.hasFocus());
  });
}

/* ==================== input polish (cursor + pings) ====================
   Everything here is event-driven — no persistent rAF; GSAP's ticker only
   runs while an input-triggered tween is live, so the freeze bar holds. */
function initInput() {
  if (reduceMotion || !finePointer || !window.gsap) return;   // native cursor stays
  const gsap = window.gsap;

  /* JS-injected CSS — the pages stay markup-clean. !important on position
     AND z-index: style.css's body>* stacking trap carries ID-level
     specificity via :not(#sparkles), so both need the hammer. */
  const style = document.createElement("style");
  style.textContent = [
    "#cursor-dot,#cursor-ring{position:fixed !important;top:0;left:0;z-index:60 !important;pointer-events:none;border-radius:50%;opacity:0}",
    "#cursor-dot{width:6px;height:6px;margin:-3px 0 0 -3px;background:var(--accent-hi,#82c6ff);box-shadow:0 0 8px var(--accent,#4a9cff)}",
    "#cursor-ring{width:30px;height:30px;margin:-15px 0 0 -15px}",
    '#cursor-ring::after{content:"";position:absolute;inset:0;border-radius:50%;border:1px solid rgba(130,198,255,.5);transition:transform .25s ease,border-color .25s ease}',
    "#cursor-ring.is-hover::after{transform:scale(1.53);border-color:#00f0ff}",
    "body.custom-cursor,body.custom-cursor a,body.custom-cursor button{cursor:none}",
    ".click-ping{position:fixed !important;top:0;left:0;z-index:58 !important;pointer-events:none;width:46px;height:46px;margin:-23px 0 0 -23px;border-radius:50%;opacity:0;border:2px solid rgba(0,240,255,.75);box-shadow:0 0 18px rgba(0,240,255,.4),inset 0 0 12px rgba(0,240,255,.2);will-change:transform,opacity}"
  ].join("\n");
  document.head.appendChild(style);

  /* ---- custom cursor: fast dot + lagging ring ---- */
  const dot = document.createElement("div");
  dot.id = "cursor-dot"; dot.setAttribute("aria-hidden", "true");
  const ring = document.createElement("div");
  ring.id = "cursor-ring"; ring.setAttribute("aria-hidden", "true");
  document.body.appendChild(dot);
  document.body.appendChild(ring);
  document.body.classList.add("custom-cursor");
  const dx = gsap.quickTo(dot,  "x", { duration: 0.12, ease: "power2" });
  const dy = gsap.quickTo(dot,  "y", { duration: 0.12, ease: "power2" });
  const rx = gsap.quickTo(ring, "x", { duration: 0.35, ease: "power3" });
  const ry = gsap.quickTo(ring, "y", { duration: 0.35, ease: "power3" });
  window.addEventListener("pointermove", (e) => {
    gsap.to([dot, ring], { opacity: 1, duration: 0.4, overwrite: "auto" });
    dx(e.clientX); dy(e.clientY);
    rx(e.clientX); ry(e.clientY);
  }, { passive: true });
  document.addEventListener("pointerover", (e) => {   // ring grows over real controls
    ring.classList.toggle("is-hover", !!(e.target.closest && e.target.closest("a, button")));
  });
  document.documentElement.addEventListener("mouseleave", () => {
    gsap.to([dot, ring], { opacity: 0, duration: 0.3, overwrite: "auto" });
  });

  /* ---- click pings: pooled expanding rings at the cursor ---- */
  const pingPool = [];
  for (let i = 0; i < 6; i++) {
    const p = document.createElement("div");
    p.className = "click-ping";
    p.setAttribute("aria-hidden", "true");
    document.body.appendChild(p);
    pingPool.push(p);
  }
  window.addEventListener("pointerup", (e) => {
    // never eat (or decorate) a real control's click
    if (e.target.closest && e.target.closest("a, button, input, select, textarea, summary, label")) return;
    const p = pingPool.find((x) => !x.dataset.busy) || pingPool[0];
    p.dataset.busy = "1";
    gsap.set(p, { x: e.clientX, y: e.clientY });
    gsap.timeline({ onComplete() { delete p.dataset.busy; } })
      .fromTo(p, { scale: 0.3, opacity: 0.9 }, { scale: 2.3, opacity: 0, duration: 0.9, ease: "expo.out" });
  });
}
