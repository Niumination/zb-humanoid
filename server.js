import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());
app.use(express.static(join(__dirname, 'dist')));

const WEBHOOK_SECRET = process.env.ZB_HUMANOID_WEBHOOK_SECRET;
if (!WEBHOOK_SECRET) {
  console.warn('[server] ZB_HUMANOID_WEBHOOK_SECRET not set — webhook auth will reject all requests');
}

function getPublicUrl(req) {
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const proto = req.headers['x-forwarded-proto'] || 'https';
  return `${proto}://${host}`;
}

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'zb-humanoid', timestamp: Date.now() });
});

app.get('/api/humanoid/status', (req, res) => {
  res.json({
    service: 'zb-humanoid',
    version: '0.5.0',
    particles: 300000,
    features: ['assembly', 'moods', 'audio-reactivity', 'ui-controls', 'post-processing', 'capture', 'performance', 'mood-packs', 'recording', 'skins', 'i18n'],
    deployment: 'vercel',
    publicUrl: 'https://zb-humanoid.abstract.biz.id',
    quickTunnel: 'https://referring-gate-excited-cologne.trycloudflare.com',
    endpoints: {
      health: '/api/health',
      status: '/api/humanoid/status',
      state: '/api/humanoid/state',
      control: '/api/humanoid/control',
      webhook: '/api/humanoid/webhook',
      metrics: '/api/humanoid/metrics',
      agentCard: '/.well-known/agent-card.json',
      performance: '/api/humanoid/performance',
      moodPacks: '/api/humanoid/mood-packs',
      skins: '/api/humanoid/skins'
    }
  });
});

app.get('/api/humanoid/state', (req, res) => {
  res.json({
    mood: 'neutral',
    audioEnabled: false,
    particles: 300000,
    performanceMode: 'balanced',
    skin: 'default',
    lastUpdated: Date.now()
  });
});

app.post('/api/humanoid/control', express.json(), (req, res) => {
  const { action, params } = req.body || {};
  
  switch (action) {
    case 'mood':
      res.json({ success: true, action, mood: params?.mood || 'neutral' });
      break;
    case 'assemble':
      res.json({ success: true, action, message: 'Assembly animation triggered' });
      break;
    case 'audio':
      res.json({ success: true, action, enabled: params?.enabled ?? true });
      break;
    case 'particles':
      res.json({ success: true, action, count: params?.count || 300000 });
      break;
    case 'screenshot':
      res.json({ success: true, action, message: 'Screenshot captured' });
      break;
    case 'performance':
      res.json({ success: true, action, mode: params?.mode || 'balanced' });
      break;
    case 'mood-pack':
      res.json({ success: true, action, pack: params?.pack || 'calm' });
      break;
    case 'skin':
      res.json({ success: true, action, skin: params?.skin || 'default' });
      break;
    default:
      res.status(400).json({ success: false, error: 'Unknown action' });
  }
});

app.post('/api/humanoid/webhook', express.json(), (req, res) => {
  const { source, action, data, token } = req.body || {};
  
  // Auth required: reject requests with no token or a wrong token (Goldfish F3)
  if (!token || token !== WEBHOOK_SECRET) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  
  console.log(`[webhook] source=${source} action=${action} data=${JSON.stringify(data)}`);
  res.json({ success: true, source, action });
});

app.get('/api/humanoid/metrics', (req, res) => {
  const metrics = {
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    cpu: process.cpuUsage(),
    timestamp: Date.now(),
  };
  res.json(metrics);
});

app.get('/api/humanoid/performance', (req, res) => {
  res.json({
    modes: ['high', 'balanced', 'low', 'ultra'],
    current: 'balanced',
    presets: {
      high: { particles: 300000, bloom: true, pixelRatio: 2 },
      balanced: { particles: 150000, bloom: true, pixelRatio: 1.5 },
      low: { particles: 80000, bloom: false, pixelRatio: 1 },
      ultra: { particles: 50000, bloom: false, pixelRatio: 1 }
    }
  });
});

app.get('/api/humanoid/mood-packs', (req, res) => {
  res.json({
    packs: {
      calm: { name: 'Calm Session', moods: ['calm', 'neutral', 'calm'], duration: 30 },
      energetic: { name: 'Energetic', moods: ['excited', 'happy', 'excited'], duration: 20 },
      emotional: { name: 'Emotional Journey', moods: ['calm', 'sad', 'neutral', 'happy', 'excited'], duration: 45 },
      focus: { name: 'Focus Mode', moods: ['neutral', 'calm', 'neutral'], duration: 60 }
    },
    current: null
  });
});

app.get('/api/humanoid/skins', (req, res) => {
  res.json({
    skins: {
      default: { name: 'Default', particleColor: '#8B5CF6' },
      cyber: { name: 'Cyber', particleColor: '#00ff88' },
      sunset: { name: 'Sunset', particleColor: '#ff6b6b' },
      ocean: { name: 'Ocean', particleColor: '#4ecdc4' },
      monochrome: { name: 'Monochrome', particleColor: '#ffffff' }
    },
    current: 'default'
  });
});

app.get('/.well-known/agent-card.json', (req, res) => {
  const publicUrl = getPublicUrl(req);
  res.json({
    name: 'zb-humanoid',
    description: 'Three.js particle humanoid interface for Hermes Agent OS',
    url: publicUrl,
    version: '0.5.0',
    provider: { organization: 'zb-humanoid', url: publicUrl },
    supportedInterfaces: [{ url: publicUrl, protocolBinding: 'JSONRPC', protocolVersion: '1.0' }],
    capabilities: { streaming: false, pushNotifications: false, stateTransitionHistory: false, extendedAgentCard: false },
    defaultInputModes: ['text/plain'],
    defaultOutputModes: ['text/plain'],
    skills: [
      { id: 'humanoid.control', name: 'control', description: 'Control humanoid mood/assembly/audio/screenshot/performance/skin', tags: ['mood', 'assemble', 'audio', 'screenshot', 'performance', 'skin'] },
      { id: 'humanoid.status', name: 'status', description: 'Get humanoid status, metrics, performance, mood packs, skins', tags: ['status', 'health', 'metrics'] }
    ]
  });
});

app.get('*', (req, res) => {
  const indexPath = join(__dirname, 'dist', 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('Not found');
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`zb-humanoid server running on port ${PORT}`);
});
