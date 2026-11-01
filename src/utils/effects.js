// Scratch buffer reused across frames to avoid ~3.6MB alloc/frame GC churn (Goldfish F8)
let breathScratch = null;
export function applyBreathing(positions, time, intensity = 0.015) {
  if (!breathScratch || breathScratch.length !== positions.length) {
    breathScratch = new Float32Array(positions);
  }
  breathScratch.set(positions);
  const count = breathScratch.length / 3;
  const breath = Math.sin(time * 1.2) * intensity;
  for (let i = 0; i < count; i++) {
    breathScratch[i * 3 + 1] += breath;
  }
  return breathScratch;
}

export function applyShockwave(positions, time, origin = [0, 0, 0], strength = 0.2) {
  const out = new Float32Array(positions);
  const count = out.length / 3;
  const wave = Math.sin(time * 3) * strength;
  for (let i = 0; i < count; i++) {
    const x = positions[i * 3] - origin[0];
    const y = positions[i * 3 + 1] - origin[1];
    const z = positions[i * 3 + 2] - origin[2];
    const dist = Math.sqrt(x * x + y * y + z * z);
    const factor = Math.max(0, 1 - dist / 2) * wave;
    out[i * 3] += x * factor;
    out[i * 3 + 1] += y * factor;
    out[i * 3 + 2] += z * factor;
  }
  return out;
}
