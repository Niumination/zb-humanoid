import { Scene, Color, PerspectiveCamera, WebGLRenderer, BufferGeometry, BufferAttribute, ShaderMaterial, Points, SphereGeometry, AmbientLight, DirectionalLight, Raycaster, Vector2, AdditiveBlending, ACESFilmicToneMapping } from 'three';
import { createSoftParticleTexture } from './utils/particleTexture.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { sampleHeadPoints } from './utils/headSampler.js';
import { createMorphTargets, lerpPositions } from './utils/animations.js';
import { applyBreathing, applyShockwave } from './utils/effects.js';
import { setupAudioReactivity } from './utils/audioReactivity.js';
import { setupUIControls } from './utils/controls.js';
import { createPostProcessing } from './utils/postprocessing/effects.js';
import { setupCapture } from './utils/capture.js';
import { setLanguage, t } from './utils/i18n.js';
import { setPerformanceMode, getPerformanceMode, getPerformancePresets, detectOptimalMode } from './utils/performance.js';
import { startMoodPack, stopMoodPack, getMoodPacks, getCurrentPack } from './utils/moodPacks.js';
import { startRecording, stopRecording, isRecordingActive } from './utils/recording.js';
import { setSkin, getSkins, getSkinConfig, getSkin } from './utils/skins.js';
import { createPolishedAssembly } from './utils/assemblyPolished.js';
import { createExpressionBlends, applyExpression } from './utils/expressions.js';
import { sampleBestHead } from './utils/hybridSampler.js';


// DEBUG: inline debug overlay
const debug = (() => { 
  const el = document.getElementById('debug-overlay'); 
  if (!el) return { log: () => {} }; 
  return { log(msg) { el.textContent += (el.textContent ? '\n' : '') + '[' + new Date().toLocaleTimeString() + '] ' + msg; } }; 
})();

const CONFIG = {
  PARTICLE_COUNT: 300000,
  COLOR: '#8B5CF6',
  AUTO_ROTATE: true,
};

const state = {
  mood: 'neutral',
  time: 0,
  morphProgress: 0,
  targetMood: null,
  audioEnabled: false,
  performanceMode: 'balanced',
};

const container = document.getElementById('canvas');
const scene = new Scene();
scene.background = new Color(0x050505);

const camera = new PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 1000);
camera.position.set(0, 0, 4);

const renderer = new WebGLRenderer({ canvas: container, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.autoRotate = CONFIG.AUTO_ROTATE;
controls.autoRotateSpeed = 0.5;

const statsEl = document.getElementById('stats');
const loadingEl = document.getElementById('loading');
const loadingTextEl = document.getElementById('loading-text');


let skinConfig = getSkinConfig();

const vertexShader = `
  attribute float size;
  attribute float random;
  varying vec3 vPosition;
  varying float vRandom;
  varying float vDepth;
  
  uniform float time;
  
  void main() {
    vPosition = position;
    vRandom = random;
    
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    
    // Depth-based size attenuation
    float depth = -mvPosition.z;
    vDepth = depth;
    float depthFactor = 1.0 / (1.0 + depth * 0.1);
    
    // Random size variation
    float randomSize = 0.8 + random * 0.4;
    
    // Subtle time-based jitter
    float jitter = sin(time * 2.0 + random * 6.28) * 0.02;
    
    gl_PointSize = size * randomSize * depthFactor * (300.0 / depth) + jitter;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const fragmentShader = `
  uniform vec3 color;
  uniform sampler2D particleTexture;
  uniform float flash;
  
  varying vec3 vPosition;
  varying float vRandom;
  varying float vDepth;
  
  void main() {
    // Sample soft particle texture
    vec4 texColor = texture2D(particleTexture, gl_PointCoord);
    
    // Depth-based opacity
    float depthAlpha = 1.0 / (1.0 + vDepth * 0.05);
    depthAlpha = clamp(depthAlpha, 0.1, 1.0);
    
    // View-dependent rim lighting
    vec3 viewDir = normalize(cameraPosition - vPosition);
    float rim = 1.0 - abs(dot(viewDir, vec3(0.0, 0.0, 1.0)));
    rim = pow(rim, 3.0) * 0.5;
    
    // Color with rim highlight + assembly-complete flash
    vec3 finalColor = color + rim * 0.3 + flash;
    
    // Subtle color variation per particle
    finalColor += (vRandom - 0.5) * 0.1;
    
    // Final alpha
    float alpha = texColor.a * depthAlpha;
    
    gl_FragColor = vec4(finalColor, alpha);
  }
`;

function createParticles(positions) {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  const sizes = new Float32Array(positions.length / 3);
  const randoms = new Float32Array(positions.length / 3);
  for (let i = 0; i < sizes.length; i++) {
    sizes[i] = 0.9 + Math.random() * 1.4; // varied sizes for light-figure look
    randoms[i] = Math.random();
  }
  geometry.setAttribute('size', new BufferAttribute(sizes, 1));
  geometry.setAttribute('random', new BufferAttribute(randoms, 1));
  const material = new ShaderMaterial({
    uniforms: {
      color: { value: new Color(CONFIG.COLOR) },
      particleTexture: { value: createSoftParticleTexture() },
      time: { value: 0 },
      cameraPosition: { value: camera.position },
      flash: { value: 0 }
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  });
  const points = new Points(geometry, material);
  scene.add(points);
  return points;
}

function createSphereFallback() {
  const geo = new SphereGeometry(1.5, 64, 64);
  const pos = geo.getAttribute('position').array;
  const sampled = new Float32Array(CONFIG.PARTICLE_COUNT * 3);
  for (let i = 0; i < CONFIG.PARTICLE_COUNT; i++) {
    const i3 = i * 3;
    const src = (i % (pos.length / 3)) * 3;
    sampled[i3] = pos[src];
    sampled[i3 + 1] = pos[src + 1];
    sampled[i3 + 2] = pos[src + 2];
  }
  return createParticles(sampled);
}

let particles = createSphereFallback();
let assembly = null;
let morphTargets = null;
let expressionBlends = null;
let currentExpression = null;
let basePositions = null;
let audioReactivity = null;
let postProcessing = null;
let capture = null;

function hideLoading() {
  if (loadingEl) loadingEl.classList.add('hidden');
}

function updateLoadingText(text) {
  if (loadingTextEl) loadingTextEl.textContent = text;
  if (loadingEl) loadingEl.classList.add('hidden');
}

async function loadHeadModel() {
  debug.log('loadHeadModel start');
  try {
    updateLoadingText('Sampling head model...');
    debug.log('sampling head');
    const positions = await sampleBestHead(CONFIG.PARTICLE_COUNT);
    updateLoadingText('Building particles...');
    debug.log('building particles');
    scene.remove(particles);
    particles.geometry.dispose();
    particles.material.dispose();
    basePositions = new Float32Array(positions);
    particles = createParticles(basePositions);
    assembly = createPolishedAssembly(basePositions, 2.5);
    // Bloom flash when assembly completes (spec v2 §3.3)
    assembly.onComplete = () => {
      const u = particles.material && particles.material.uniforms;
      if (!u || !u.flash) return;
      const t0 = performance.now();
      const pulse = () => {
        const e = (performance.now() - t0) / 900;
        u.flash.value = Math.max(0, 0.9 * (1 - e));
        if (e < 1) requestAnimationFrame(pulse);
      };
      pulse();
    };
    morphTargets = createMorphTargets(basePositions);
    expressionBlends = createExpressionBlends(basePositions);
    audioReactivity = setupAudioReactivity(particles, basePositions);
    postProcessing = createPostProcessing(renderer, scene, camera);
    capture = setupCapture(renderer, scene, camera);
    updateLoadingText('Ready');
    debug.log('ready');
    setTimeout(hideLoading, 300);
  } catch (err) {
    console.error(err);
    debug.log('error: ' + (err && err.message ? err.message : err));
    updateLoadingText('Fallback mode');
    setTimeout(hideLoading, 500);
  }
}

const MOODS = {
  neutral: { color: '#8B5CF6', speed: 0.1 },
  happy: { color: '#22c55e', speed: 0.18 },
  sad: { color: '#3b82f6', speed: 0.07 },
  angry: { color: '#ef4444', speed: 0.22 },
  excited: { color: '#f97316', speed: 0.28 },
  calm: { color: '#06b6d4', speed: 0.05 },
};

function applyMood(mood) {
  state.mood = mood;
  state.targetMood = mood;
  state.morphProgress = 0;
  currentExpression = mood;

  if (!particles.material || !particles.material.uniforms) return;
  const cfg = MOODS[mood] || MOODS.neutral;
  particles.material.uniforms.color.value.set(cfg.color);
  controls.autoRotateSpeed = cfg.speed;
  // Position morphing is applied per-frame in animate() via morphProgress.
}

let lastTime = performance.now();
let frameCount = 0;
let fpsTime = 0;

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

addEventListener('keydown', (e) => {
  const moodKeys = { '1': 'neutral', '2': 'happy', '3': 'sad', '4': 'angry', '5': 'excited', '6': 'calm' };
  if (moodKeys[e.key]) applyMood(moodKeys[e.key]);
  if (e.key === ' ' && assembly) assembly.reset();
  if (e.key.toLowerCase() === 'a') {
    state.audioEnabled = !state.audioEnabled;
    if (state.audioEnabled && audioReactivity && !audioReactivity.isActive()) {
      audioReactivity.init();
    }
  }
  if (e.key.toLowerCase() === 'r') {
    applyShockwave(basePositions, particles, state.time);
  }
  if (e.key.toLowerCase() === 's') {
    if (capture) capture.downloadScreenshot();
  }
  if (e.key.toLowerCase() === 'p') {
    const modes = getPerformancePresets();
    const current = getPerformanceMode();
    const next = modes[(modes.indexOf(current) + 1) % modes.length];
    setPerformanceMode(next);
    state.performanceMode = next;
    updateLoadingText(`Performance: ${next}`);
    setTimeout(() => { if (loadingEl) loadingEl.classList.add('hidden'); }, 1000);
  }
  if (e.key.toLowerCase() === 'm') {
    const packs = getMoodPacks();
    const current = getCurrentPack();
    const next = packs[(packs.indexOf(current) + 1) % packs.length] || packs[0];
    startMoodPack(next, applyMood);
    updateLoadingText(`Mood pack: ${next}`);
    setTimeout(() => { if (loadingEl) loadingEl.classList.add('hidden'); }, 1000);
  }
  if (e.key.toLowerCase() === 'x') {
    if (isRecordingActive()) {
      stopRecording();
      updateLoadingText('Recording saved');
    } else {
      startRecording(renderer.domElement);
      updateLoadingText('Recording...');
    }
    setTimeout(() => { if (loadingEl) loadingEl.classList.add('hidden'); }, 1000);
  }
  if (e.key.toLowerCase() === 'k') {
    const skins = getSkins();
    const current = getSkin();
    const next = skins[(skins.indexOf(current) + 1) % skins.length];
    const config = setSkin(next);
    skinConfig = config;
    updateLoadingText(`Skin: ${next}`);
    setTimeout(() => { if (loadingEl) loadingEl.classList.add('hidden'); }, 1000);
  }
});

// Language switcher
const langButtons = document.querySelectorAll('#lang-switcher button');
langButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    const lang = btn.dataset.lang;
    if (lang) setLanguage(lang);
  });
});

setupUIControls({
  applyMood,
  toggleAssembly: () => { if (assembly) assembly.reset(); },
  toggleAudio: () => {
    state.audioEnabled = !state.audioEnabled;
    if (state.audioEnabled && audioReactivity && !audioReactivity.isActive()) {
      audioReactivity.init();
    }
  }
});

function animate() {
  requestAnimationFrame(animate);
  const now = performance.now();
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  state.time += dt;

  let nextPositions = null;

  // Layered pipeline: assembly -> expression+breathing -> audio override.
  // Expressions are recomputed every frame on top of base, otherwise the
  // per-frame breathing write silently discards the mood morph (old bug).
  if (assembly && assembly.playing) {
    nextPositions = assembly.tick(dt);
  } else if (basePositions) {
    let layer = basePositions;
    if (expressionBlends && state.targetMood && state.morphProgress < 1) {
      state.morphProgress = Math.min(1, state.morphProgress + dt / 0.6);
      layer = applyExpression(basePositions, expressionBlends, state.targetMood, 0.6 * state.morphProgress);
    }
    nextPositions = applyBreathing(layer, state.time, 0.012);
  }

  const audioPositions = (state.audioEnabled && audioReactivity) ? audioReactivity.tick(state.time) : null;
  if (audioPositions) nextPositions = audioPositions;

  if (nextPositions) {
    particles.geometry.attributes.position.array.set(nextPositions);
    particles.geometry.attributes.position.needsUpdate = true;
  }

  particles.rotation.y = state.time * 0.1;
  controls.update();

  // Update shader uniforms
  if (particles.material && particles.material.uniforms) {
    particles.material.uniforms.time.value = state.time;
    particles.material.uniforms.cameraPosition.value.copy(camera.position);
  }

  if (postProcessing) {
    postProcessing.render();
  } else {
    renderer.render(scene, camera);
  }

  frameCount++;
  fpsTime += dt;
  if (fpsTime >= 1) {
    if (statsEl) statsEl.textContent = `FPS: ${frameCount} | Particles: ${particles.geometry.attributes.position.count}`;
    // Auto-degrade on sustained low FPS (software GL / weak GPU):
    // step down through performance presets, which disables bloom at 'low'.
    if (frameCount < 15 && state.time > 8) {
      const order = ['high', 'balanced', 'low'];
      const idx = order.indexOf(getPerformanceMode());
      if (idx < order.length - 1) {
        const next = order[idx + 1];
        applyPerformancePreset(next);
        console.warn('Low FPS: switched performance mode to', next);
      }
    }
    frameCount = 0;
    fpsTime = 0;
  }
}

// Performance presets actually affect rendering (Goldfish finding #8)
function applyPerformancePreset(mode) {
  const cfg = setPerformanceMode(mode);
  state.performanceMode = mode;
  renderer.setPixelRatio(cfg.pixelRatio);
  // Bloom off -> render directly; on -> composer
  postProcessing = cfg.bloom ? createPostProcessing(renderer, scene, camera) : null;
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}

debug.log('animate start');
animate();
loadHeadModel();
