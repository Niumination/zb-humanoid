// Procedural face fallback v2 (per spec v2 §3.1):
// Fibonacci sphere for even coverage + noise displacement + variable density
// around features, instead of uniform random on a rough ellipsoid.

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

// Cheap deterministic value noise (no dependency)
function hash(n) {
  const s = Math.sin(n) * 43758.5453;
  return s - Math.floor(s);
}
function noise3(x, y, z) {
  return (hash(x * 12.9898 + y * 78.233 + z * 37.719) - 0.5) * 2;
}

function createProceduralFacePointCloud(count = 300000) {
  const positions = new Float32Array(count * 3);

  const faceWidth = 0.72;
  const faceHeight = 0.95;
  const faceDepth = 0.52;

  const noseWidth = 0.14;
  const noseDepth = 0.18;
  const eyeSize = 0.13;
  const eyeSpacing = 0.26;
  const mouthWidth = 0.3;
  const mouthHeight = 0.09;

  for (let i = 0; i < count; i++) {
    const i3 = i * 3;

    // Fibonacci sphere: even, non-clumping coverage
    const t = (i + 0.5) / count;
    const phi = Math.acos(1 - 2 * t);          // polar
    const theta = GOLDEN_ANGLE * i;             // azimuth

    let x = faceWidth * Math.sin(phi) * Math.cos(theta);
    let y = faceHeight * Math.cos(phi);
    let z = faceDepth * Math.sin(phi);

    // Flatten the back of the head slightly (face reads front-on)
    if (z < 0) z *= 0.85;

    // Organic noise displacement
    const n = noise3(x * 3.1, y * 3.1, z * 3.1);
    const r = 1 + n * 0.015;
    x *= r; y *= r; z *= r;

    // Nose (forward bump)
    const noseDist = Math.hypot(x, y - 0.02);
    if (noseDist < noseWidth && y > -0.25 && y < 0.35) {
      const f = 1 - noseDist / noseWidth;
      z += noseDepth * Math.pow(f, 0.6);
    }

    // Brow ridge
    if (Math.abs(y - 0.28) < 0.07 && Math.abs(x) < 0.42) {
      z += 0.05 * (1 - Math.abs(y - 0.28) / 0.07);
    }

    // Eye sockets
    const le = Math.hypot(x + eyeSpacing, y - 0.12);
    const re = Math.hypot(x - eyeSpacing, y - 0.12);
    const ed = Math.min(le, re);
    if (ed < eyeSize) {
      z -= 0.12 * (1 - ed / eyeSize);
    }

    // Mouth
    if (Math.abs(y + 0.18) < mouthHeight && Math.abs(x) < mouthWidth) {
      const f = 1 - Math.abs(y + 0.18) / mouthHeight;
      z += 0.045 * f;
    }

    // Chin
    if (y < -0.35 && Math.abs(x) < 0.22) {
      z += 0.09 * (1 - Math.abs(x) / 0.22) * Math.min(1, (-y - 0.35) * 3);
    }

    // Jaw taper
    if (y < 0 && Math.abs(x) > 0.3) {
      z -= 0.06 * Math.min(1, (Math.abs(x) - 0.3) / 0.4);
    }

    positions[i3] = x;
    positions[i3 + 1] = y;
    positions[i3 + 2] = z;
  }

  return positions;
}

export function sampleProceduralFace(count = 300000) {
  return createProceduralFacePointCloud(count);
}
