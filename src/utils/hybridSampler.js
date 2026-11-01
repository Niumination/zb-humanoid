import { sampleHeadPoints } from './headSampler.js';
import { sampleProceduralFace } from './proceduralFace.js';

// Head model served via jsDelivr CDN (position-only, CC0 — see docs/designs/LICENSE-CREDITS.md)
const HEAD_URLS = [
  'https://cdn.jsdelivr.net/gh/Niumination/zb-humanoid@main/assets/head.glb',
  '/assets/head.glb'
];

export async function sampleBestHead(count = 300000) {
  for (const url of HEAD_URLS) {
    try {
      console.log('Trying head model:', url);
      const points = await sampleHeadPoints(url, count);
      console.log('Head model loaded:', points.length / 3, 'points');
      return points;
    } catch (e) {
      console.warn('Failed:', url, e && e.message);
    }
  }
  console.warn('All head sources failed, using procedural fallback');
  return sampleProceduralFace(count);
}
