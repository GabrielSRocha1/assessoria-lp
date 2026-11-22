/*
 * Globo 3D — motor WebGL (Three.js, tree-shaken e embutido no HTML).
 * createGlobe(container, options) → API { start, stop, invalidate, dispose, state }
 * Retorna null quando WebGL não está disponível (a página mantém o fallback CSS).
 */
import {
  WebGLRenderer, Scene, PerspectiveCamera, Group, Mesh, SphereGeometry,
  MeshPhongMaterial, MeshBasicMaterial, ShaderMaterial, DirectionalLight, AmbientLight,
  Texture, SRGBColorSpace, AdditiveBlending, BackSide, DoubleSide, Sprite, SpriteMaterial,
  BufferGeometry, Float32BufferAttribute, LineSegments, LineBasicMaterial, Points,
  Vector3, QuadraticBezierCurve3, Color, RingGeometry, ACESFilmicToneMapping,
  LinearMipmapLinearFilter, LinearFilter
} from 'three';

const DEG = Math.PI / 180;

export function latLonToVec3(lat, lon, r = 1, out = new Vector3()) {
  const phi = (90 - lat) * DEG;
  const th = (lon + 180) * DEG;
  return out.set(-r * Math.sin(phi) * Math.cos(th), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(th));
}

/** Rotação Y do grupo que coloca a longitude `lon` de frente para a câmera (+Z). */
export function spinForLon(lon) { return -(lon + 90) * DEG; }

const PRESETS = {
  high: { dpr: 2,    seg: 96, clouds: true,  aa: true,  arcPts: 72, fps: 60 },
  mid:  { dpr: 1.75, seg: 72, clouds: true,  aa: true,  arcPts: 56, fps: 60 },
  low:  { dpr: 1.5,  seg: 48, clouds: false, aa: false, arcPts: 40, fps: 30 }
};

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
function makeTex(img, srgb, aniso) {
  const t = new Texture(img);
  if (srgb) t.colorSpace = SRGBColorSpace;
  t.anisotropy = aniso || 1;
  t.needsUpdate = true;
  return t;
}
const idle = (fn, timeout = 600) =>
  ('requestIdleCallback' in window) ? window.requestIdleCallback(fn, { timeout }) : setTimeout(fn, 60);

/* ---------- shaders ---------- */
const ATMO_VS = `
varying vec3 vN; varying vec3 vV;
void main(){
  vec4 mv = modelViewMatrix * vec4(position,1.0);
  vN = normalize(normalMatrix * normal);
  vV = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;
const HALO_FS = `
uniform vec3 uColor; uniform float uEdge; uniform float uStrength;
varying vec3 vN; varying vec3 vV;
void main(){
  float d = -dot(vN, vV);
  float g = pow(smoothstep(0.0, uEdge, d), 3.0) * uStrength;
  gl_FragColor = vec4(uColor, g);
}`;
const RIM_FS = `
uniform vec3 uBlue; uniform vec3 uGold; uniform vec3 uLight;
varying vec3 vN; varying vec3 vV;
void main(){
  float f = pow(clamp(1.0 - dot(vN, vV), 0.0, 1.0), 4.0);
  float lit = clamp(dot(vN, uLight), 0.0, 1.0);
  vec3 c = mix(uBlue, uGold, lit * 0.45);
  gl_FragColor = vec4(c, f * 0.38);
}`;
const DOT_VS = `
attribute float aSize; attribute vec3 aColor;
uniform float uPR; uniform float uScale;
varying vec3 vColor; varying float vFade;
void main(){
  vec4 mv = modelViewMatrix * vec4(position,1.0);
  vec3 nW = normalize((modelMatrix * vec4(position,1.0)).xyz);
  vFade = smoothstep(-0.05, 0.28, dot(nW, normalize(cameraPosition)));
  vColor = aColor;
  gl_PointSize = aSize * uPR * (uScale / -mv.z);
  gl_Position = projectionMatrix * mv;
}`;
const DOT_FS = `
varying vec3 vColor; varying float vFade;
void main(){
  float d = length(gl_PointCoord - 0.5);
  float glow = smoothstep(0.5, 0.0, d);
  float core = smoothstep(0.16, 0.04, d);
  float a = (glow * glow * 0.85 + core) * vFade;
  gl_FragColor = vec4(mix(vColor, vec3(1.0), core * 0.55), a);
}`;
const ARC_VS = `
attribute float aT; attribute float aOff; attribute float aSpd;
varying float vT; varying float vOff; varying float vSpd;
void main(){
  vT = aT; vOff = aOff; vSpd = aSpd;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
}`;
const ARC_FS = `
uniform float uTime; uniform float uStatic; uniform vec3 uA; uniform vec3 uB;
varying float vT; varying float vOff; varying float vSpd;
void main(){
  float head = fract(uTime * vSpd + vOff) * 1.6 - 0.3;
  float x = vT - head;
  float tail = x <= 0.0 ? clamp(1.0 + x / 0.3, 0.0, 1.0) : clamp(1.0 - x / 0.015, 0.0, 1.0);
  tail = pow(tail, 1.7);
  float edge = smoothstep(0.0, 0.06, vT) * smoothstep(1.0, 0.94, vT);
  float a = mix(0.2 + tail * 1.0, 0.45, uStatic) * edge;
  vec3 c = mix(uA, uB, pow(tail, 3.0) * (1.0 - uStatic));
  gl_FragColor = vec4(c, a);
}`;

/* ---------- glow sprite texture (canvas) ---------- */

export function createGlobe(container, o = {}) {
  const q = { ...PRESETS[o.tier] || PRESETS.mid };
  const reduced = !!o.reducedMotion;
  const compact = !!o.compact;
  const A = o.assets || {};
  const data = o.data || { countries: [], arcs: [] };

  const canvas = document.createElement('canvas');
  canvas.className = 'globe-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  let renderer;
  try {
    renderer = new WebGLRenderer({
      canvas, antialias: q.aa, alpha: true,
      powerPreference: o.tier === 'high' ? 'high-performance' : 'low-power'
    });
  } catch (e) { return null; }
  const gl = renderer.getContext();
  if (!gl) { renderer.dispose(); return null; }
  container.appendChild(canvas);

  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  let dprCap = q.dpr;

  const scene = new Scene();
  const camera = new PerspectiveCamera(30, 1, 0.1, 100);
  const baseDist = o.distance || 4.6;
  camera.position.set(0, 0, baseDist);

  const tilt = new Group();
  tilt.rotation.set(o.tiltX ?? 0.2, 0, o.tiltZ ?? -0.16);
  scene.add(tilt);
  const spin = new Group();
  spin.rotation.y = spinForLon(o.startLon ?? -48);
  tilt.add(spin);

  /* luzes: chave dourada discreta + recorte azul + ambiente oceânico */
  const LIGHT_DIR = new Vector3(-0.55, 0.42, 0.72).normalize();
  const key = new DirectionalLight(0xffe4bd, 3.0);
  key.position.copy(LIGHT_DIR).multiplyScalar(10);
  const rim = new DirectionalLight(0x6fb6ff, 0.7);
  rim.position.set(6, -1.5, -4);
  const amb = new AmbientLight(0x3a5274, 1.7);
  scene.add(key, rim, amb);

  /* Terra */
  const earthGeo = new SphereGeometry(1, q.seg, Math.round(q.seg / 2));
  const earthMat = new MeshPhongMaterial({
    color: 0xffffff, specular: new Color(0x22374f), shininess: 34, bumpScale: 2.2
  });
  earthMat.color.set(0x0d3560); // placeholder oceânico até a textura chegar
  const earth = new Mesh(earthGeo, earthMat);
  spin.add(earth);

  /* nuvens */
  let clouds = null;
  if (q.clouds && A.clouds) {
    clouds = new Mesh(
      new SphereGeometry(1.012, Math.round(q.seg * 0.75), Math.round(q.seg * 0.375)),
      new MeshPhongMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, shininess: 0 })
    );
    clouds.renderOrder = 2;
    spin.add(clouds);
  }

  /* atmosfera: brilho interno (fresnel) + halo externo */
  const rimMesh = new Mesh(
    new SphereGeometry(1.004, 64, 32),
    new ShaderMaterial({
      vertexShader: ATMO_VS, fragmentShader: RIM_FS,
      uniforms: {
        uBlue: { value: new Color(0x4a9dff) }, uGold: { value: new Color(0xe9c27a) },
        uLight: { value: LIGHT_DIR.clone() }
      },
      transparent: true, blending: AdditiveBlending, depthWrite: false
    })
  );
  rimMesh.renderOrder = 3;
  const HALO_S = 1.16;
  const halo = new Mesh(
    new SphereGeometry(HALO_S, 64, 32),
    new ShaderMaterial({
      vertexShader: ATMO_VS, fragmentShader: HALO_FS,
      uniforms: {
        uColor: { value: new Color(0x5ea6ff) },
        uEdge: { value: Math.sqrt(1 - 1 / (HALO_S * HALO_S)) },
        uStrength: { value: 0.42 }
      },
      side: BackSide, transparent: true, blending: AdditiveBlending, depthWrite: false
    })
  );
  scene.add(halo);
  tilt.add(rimMesh);

  /* ---------- marcadores: pontos, hastes, anéis, bandeiras ---------- */
  const byIso = new Map(data.countries.map((c, i) => [c.iso2, { ...c, cell: i }]));
  const flagSet = compact && data.compactFlags ? new Set(data.compactFlags) : null;
  const markers = new Group();
  spin.add(markers);
  const tmp = new Vector3();

  // pontos luminosos
  const dotPos = [], dotSize = [], dotCol = [];
  const gold = new Color(0xf2cf7e), cyan = new Color(0x7fd0ff);
  data.countries.forEach((c) => {
    latLonToVec3(c.lat, c.lon, 1.004, tmp);
    dotPos.push(tmp.x, tmp.y, tmp.z);
    dotSize.push(c.hub ? 30 : 20);
    const col = c.hub ? gold : cyan;
    dotCol.push(col.r, col.g, col.b);
  });
  const dotGeo = new BufferGeometry();
  dotGeo.setAttribute('position', new Float32BufferAttribute(dotPos, 3));
  dotGeo.setAttribute('aSize', new Float32BufferAttribute(dotSize, 1));
  dotGeo.setAttribute('aColor', new Float32BufferAttribute(dotCol, 3));
  const dotMat = new ShaderMaterial({
    vertexShader: DOT_VS, fragmentShader: DOT_FS,
    uniforms: { uPR: { value: 1 }, uScale: { value: compact ? 0.32 : 0.26 } },
    transparent: true, blending: AdditiveBlending, depthWrite: false
  });
  const dots = new Points(dotGeo, dotMat);
  dots.renderOrder = 4;
  markers.add(dots);

  // anéis de pulso nos hubs
  const rings = [];
  if (!reduced) {
    const ringGeo = new RingGeometry(0.018, 0.024, 40);
    data.countries.filter((c) => c.hub).forEach((c, i) => {
      const m = new Mesh(ringGeo, new MeshBasicMaterial({
        color: 0xf2cf7e, transparent: true, opacity: 0, side: DoubleSide,
        blending: AdditiveBlending, depthWrite: false
      }));
      latLonToVec3(c.lat, c.lon, 1.003, m.position);
      m.lookAt(tmp.copy(m.position).multiplyScalar(2));
      m.userData.phase = i * 0.37;
      markers.add(m);
      rings.push(m);
    });
  }

  // arcos de conexão (um único draw call)
  {
    const pos = [], aT = [], aOff = [], aSpd = [];
    const a = new Vector3(), b = new Vector3(), mid = new Vector3(), p = new Vector3(), pPrev = new Vector3();
    const N = q.arcPts;
    data.arcs.forEach(([i1, i2], k) => {
      const c1 = byIso.get(i1), c2 = byIso.get(i2);
      if (!c1 || !c2) return;
      latLonToVec3(c1.lat, c1.lon, 1.004, a);
      latLonToVec3(c2.lat, c2.lon, 1.004, b);
      const ang = a.angleTo(b);
      mid.copy(a).add(b).normalize().multiplyScalar(1.02 + ang * 0.26);
      const curve = new QuadraticBezierCurve3(a.clone(), mid.clone(), b.clone());
      const off = (k * 0.6180339) % 1, spd = 0.11 + ((k * 7) % 5) * 0.018;
      const n = Math.max(12, Math.round(N * Math.min(1, ang / 1.4 + 0.25)));
      for (let s = 1; s <= n; s++) {
        const t0 = (s - 1) / n, t1 = s / n;
        curve.getPoint(t0, pPrev); curve.getPoint(t1, p);
        pos.push(pPrev.x, pPrev.y, pPrev.z, p.x, p.y, p.z);
        aT.push(t0, t1); aOff.push(off, off); aSpd.push(spd, spd);
      }
    });
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(pos, 3));
    g.setAttribute('aT', new Float32BufferAttribute(aT, 1));
    g.setAttribute('aOff', new Float32BufferAttribute(aOff, 1));
    g.setAttribute('aSpd', new Float32BufferAttribute(aSpd, 1));
    var arcMat = new ShaderMaterial({
      vertexShader: ARC_VS, fragmentShader: ARC_FS,
      uniforms: {
        uTime: { value: 0 }, uStatic: { value: reduced ? 1 : 0 },
        uA: { value: new Color(0xd6a94a) }, uB: { value: new Color(0xfff2cf) }
      },
      transparent: true, blending: AdditiveBlending, depthWrite: false
    });
    const arcs = new LineSegments(g, arcMat);
    arcs.renderOrder = 5;
    markers.add(arcs);
  }

  // bandeiras (sprites a partir de um atlas pré-renderizado) + hastes
  const flags = [];
  const camDir = new Vector3(0, 0, 1);
  function buildFlags(atlasImg) {
    const cols = data.atlas?.cols || 8, rows = data.atlas?.rows || 8;
    const base = makeTex(atlasImg, true, aniso);
    base.minFilter = LinearMipmapLinearFilter; base.magFilter = LinearFilter;
    const polePos = [];
    const size = o.flagSize || (compact ? 0.17 : 0.135);
    const list = data.countries.map((c, i) => ({ ...c, cell: i })).filter((c) => !flagSet || flagSet.has(c.iso2));
    list.forEach((c, j) => {
      const h = (compact ? 0.07 : 0.055) + (j % 3) * (compact ? 0.05 : 0.042);
      const b0 = latLonToVec3(c.lat, c.lon, 1.0, new Vector3());
      const top = latLonToVec3(c.lat, c.lon, 1.0 + h, new Vector3());
      polePos.push(b0.x, b0.y, b0.z, top.x, top.y, top.z);
      const t = base.clone();
      const col = c.cell % cols, row = Math.floor(c.cell / cols);
      t.repeat.set(1 / cols, 1 / rows);
      t.offset.set(col / cols, 1 - (row + 1) / rows);
      t.needsUpdate = true;
      const m = new SpriteMaterial({ map: t, transparent: true, depthWrite: false, opacity: 0 });
      const s = new Sprite(m);
      s.center.set(2 / 128, 1 - 4 / 128);
      s.scale.set(size, size, 1);
      s.position.copy(top);
      s.renderOrder = 6;
      s.userData.n = b0.clone();
      markers.add(s);
      flags.push(s);
    });
    const pg = new BufferGeometry();
    pg.setAttribute('position', new Float32BufferAttribute(polePos, 3));
    const poles = new LineSegments(pg, new LineBasicMaterial({ color: 0xe8edf5, transparent: true, opacity: 0.6, depthWrite: false }));
    poles.renderOrder = 5;
    markers.add(poles);
    state.flagCount = flags.length;
    updateFlagFade();
  }
  const nW = new Vector3();
  function updateFlagFade() {
    for (let i = 0; i < flags.length; i++) {
      const s = flags[i];
      nW.copy(s.userData.n).applyMatrix4(spin.matrixWorld).sub(tmp.setFromMatrixPosition(spin.matrixWorld)).normalize();
      const f = nW.dot(camDir);
      const x = Math.min(1, Math.max(0, (f + 0.12) / 0.38));
      s.material.opacity = x * x * (3 - 2 * x);
      s.visible = s.material.opacity > 0.01;
    }
  }

  /* ---------- texturas progressivas ---------- */
  const state = { lo: false, hi: false, flags: false, frames: 0, dpr: 1, tier: o.tier || 'mid', webgl: true };
  let firstPaint = false;
  function markReady() {
    if (firstPaint) return;
    firstPaint = true;
    container.classList.add('globe-ready');
    o.onReady && o.onReady();
  }
  const setMap = (img) => {
    if (earthMat.map) earthMat.map.dispose();
    earthMat.map = makeTex(img, true, aniso);
    earthMat.color.set(0xffffff);
    earthMat.needsUpdate = true;
  };
  (async () => {
    try {
      if (A.earthLo) { setMap(await loadImage(A.earthLo)); state.lo = true; }
      invalidate(); requestAnimationFrame(markReady);
      if (A.atlas) { buildFlags(await loadImage(A.atlas)); state.flags = true; invalidate(); }
      await new Promise((r) => idle(r, 900));
      const [hi, bump, water, cl] = await Promise.all([
        A.earthHi ? loadImage(A.earthHi) : null,
        A.bump ? loadImage(A.bump) : null,
        A.water ? loadImage(A.water) : null,
        clouds && A.clouds ? loadImage(A.clouds) : null
      ]);
      if (hi) setMap(hi);
      if (bump) { earthMat.bumpMap = makeTex(bump, false, aniso); }
      if (water) { earthMat.specularMap = makeTex(water, false, aniso); }
      if (cl && clouds) { clouds.material.alphaMap = makeTex(cl, false, aniso); clouds.material.opacity = 0.82; clouds.material.needsUpdate = true; }
      earthMat.needsUpdate = true;
      state.hi = true;
      container.dataset.globeState = 'hi';
      invalidate();
    } catch (e) { /* mantém o que já foi carregado */ }
  })();

  /* ---------- tamanho ---------- */
  function resize() {
    const w = Math.max(1, container.clientWidth), h = Math.max(1, container.clientHeight);
    const pr = Math.min(window.devicePixelRatio || 1, dprCap);
    renderer.setPixelRatio(pr);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const halfFov = Math.tan(15 * DEG);
    const need = o.fit || 1.32;
    camera.position.z = Math.max(baseDist, need / (halfFov * Math.min(1, camera.aspect)));
    camera.updateProjectionMatrix();
    dotMat.uniforms.uPR.value = pr * (h / 600);
    state.dpr = pr;
    invalidate();
  }
  const ro = ('ResizeObserver' in window) ? new ResizeObserver(resize) : null;
  ro ? ro.observe(container) : window.addEventListener('resize', resize);

  /* ---------- interação: arrastar horizontalmente (rolagem vertical preservada) ---------- */
  let dragging = false, px = 0, vel = 0, lastMove = 0;
  canvas.style.touchAction = 'pan-y';
  canvas.addEventListener('pointerdown', (e) => {
    dragging = true; px = e.clientX; vel = 0; lastMove = performance.now();
    canvas.classList.add('is-dragging');
    try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const now = performance.now();
    const dx = e.clientX - px; px = e.clientX;
    const d = (dx / Math.max(200, canvas.clientWidth)) * Math.PI * 1.1;
    spin.rotation.y += d;
    const dt = Math.max(8, now - lastMove) / 1000; lastMove = now;
    vel = Math.max(-3, Math.min(3, d / dt)) * 0.6;
    invalidate();
  });
  const end = () => { dragging = false; canvas.classList.remove('is-dragging'); };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('pointerleave', end);

  /* ---------- loop ---------- */
  const autoSpeed = reduced ? 0 : (o.speed ?? 0.075);
  const minFrame = 1000 / q.fps - 2;
  let running = false, raf = 0, last = 0, t = 0, perfAcc = 0, perfN = 0, downgraded = 0;

  function update(dt) {
    if (!dragging) {
      spin.rotation.y += (autoSpeed + vel) * dt;
      vel *= Math.pow(0.05, dt);
      if (Math.abs(vel) < 0.002) vel = 0;
    }
    if (clouds && !reduced) clouds.rotation.y += dt * 0.012;
    t += dt;
    arcMat.uniforms.uTime.value = t;
    for (let i = 0; i < rings.length; i++) {
      const r = rings[i];
      const k = ((t * 0.42 + r.userData.phase) % 1);
      const s = 1 + k * 2.2;
      r.scale.set(s, s, s);
      r.material.opacity = (1 - k) * (1 - k) * 0.8;
    }
  }
  function draw() {
    spin.updateMatrixWorld();
    updateFlagFade();
    renderer.render(scene, camera);
    state.frames++;
  }
  function adapt(dt) {
    if (state.frames < 45 || downgraded > 2) return;
    perfAcc += dt; perfN++;
    if (perfN < 90) return;
    const avg = perfAcc / perfN; perfAcc = 0; perfN = 0;
    if (avg > 1 / 38) {
      downgraded++;
      if (dprCap > 1.01) { dprCap = Math.max(1, dprCap - 0.5); resize(); }
      else if (clouds && clouds.visible) { clouds.visible = false; }
    }
  }
  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (now - last < minFrame) return;
    const dt = last ? Math.min(0.12, (now - last) / 1000) : 1 / 60;
    last = now;
    update(dt);
    draw();
    adapt(dt);
  }
  let pending = false;
  function invalidate() {
    if (running || pending) return;
    pending = true;
    requestAnimationFrame(() => { pending = false; if (!running) { if (reduced) update(0.0001); draw(); } });
  }
  function start() {
    if (running || reduced) { invalidate(); return; }
    running = true; last = 0;
    raf = requestAnimationFrame(frame);
  }
  function stop() { running = false; cancelAnimationFrame(raf); }

  // reduzir movimento: arrastar ainda funciona com render sob demanda + inércia curta
  if (reduced) {
    canvas.addEventListener('pointerup', () => { vel = 0; });
  }

  resize();
  // pausa quando fora da tela ou aba oculta (economia de bateria)
  let inView = true;
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((es) => {
      inView = es[0].isIntersecting;
      (inView && !document.hidden) ? start() : stop();
    }, { rootMargin: '80px' }).observe(container);
  }
  document.addEventListener('visibilitychange', () => {
    (document.hidden || !inView) ? stop() : start();
  });
  start();

  const api = {
    start, stop, invalidate, state,
    get running() { return running; },
    get rotation() { return spin.rotation.y; },
    dispose() {
      stop(); ro && ro.disconnect();
      scene.traverse((n) => { n.geometry && n.geometry.dispose(); if (n.material) { n.material.map && n.material.map.dispose(); n.material.dispose(); } });
      renderer.dispose(); canvas.remove();
    }
  };
  return api;
}
