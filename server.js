import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import { WebSocketServer } from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());
app.use(express.static(join(__dirname, 'dist')));

const AGENT_TOKEN = process.env.ZB_HUMANOID_AGENT_TOKEN || '';

// Live browser connections (agent-control bridge). Each browser opens /ws and
// reports real state; control commands are forwarded to it. When no browser is
// connected, control endpoints report that honestly instead of faking success.
const browserClients = new Set();
let commandSeq = 0;
const pendingCommands = new Map(); // id -> { resolve, timer }

function forwardCommand(command, params, timeoutMs = 8000) {
  const client = [...browserClients].find(c => c.readyState === 1 && c.isAgentBridge);
  if (!client) {
    return Promise.resolve({ success: false, error: 'no browser connected' });
  }
  const id = `cmd_${++commandSeq}`;
  return new Promise((resolve) => {
    pendingCommands.set(id, { resolve });
    const timer = setTimeout(() => {
      if (pendingCommands.has(id)) {
        pendingCommands.delete(id);
        resolve({ success: false, error: 'command timeout' });
      }
    }, timeoutMs);
    timer.unref?.();
    client.send(JSON.stringify({ type: 'command', id, command, params }));
  });
}

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
    agentControl: { transport: 'websocket', path: '/ws', connectedBrowsers: browserClients.size },
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

app.get('/api/humanoid/state', async (req, res) => {
  // Live state from a connected browser; honest empty answer otherwise
  const result = await forwardCommand('state', {});
  if (result.success) return res.json(result.state);
  res.json({ connected: false, error: result.error, lastUpdated: Date.now() });
});

app.post('/api/humanoid/control', express.json(), async (req, res) => {
  const { action, params } = req.body || {};
  const commandMap = {
    mood: 'mood',
    assemble: 'assemble',
    audio: 'audio',
    particles: 'particles',
    screenshot: 'screenshot',
    performance: 'performance',
    skin: 'skin'
  };
  const command = commandMap[action];
  if (!command) return res.status(400).json({ success: false, error: 'Unknown action' });
  const result = await forwardCommand(command, params);
  res.json({ success: result.success, action, ...(result.success ? result : { error: result.error }) });
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
    capabilities: { streaming: false, pushNotifications: false, stateTransitionHistory: false, extendedAgentCard: false, liveControl: true },
    controlTransport: { type: 'websocket', path: '/ws', auth: 'token (ZB_HUMANOID_AGENT_TOKEN)' },
    defaultInputModes: ['text/plain'],
    defaultOutputModes: ['text/plain'],
    skills: [
      { id: 'humanoid.control', name: 'control', description: 'Control a live browser session: mood/assembly/audio/particles/performance/skin/screenshot (requires a connected browser)', tags: ['mood', 'assemble', 'audio', 'screenshot', 'performance', 'skin', 'particles'] },
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

// Express app is consumed by http server below (needed for WebSocket upgrade)
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`zb-humanoid server running on port ${PORT}`);
});

// WebSocket endpoint for the browser agent-control bridge
const wss = new WebSocketServer({ noServer: true });
server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname !== '/ws') return socket.destroy();
  // Token gate: if AGENT_TOKEN set, require exact match; if unset, allow only loopback
  const token = url.searchParams.get('token') || '';
  if (AGENT_TOKEN) {
    if (token !== AGENT_TOKEN) return socket.destroy();
  } else {
    const remote = req.socket.remoteAddress || '';
    const loopback = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(remote);
    if (!loopback) {
      console.warn(`[ws] rejected unauthenticated connection from ${remote} — set ZB_HUMANOID_AGENT_TOKEN to allow remote`);
      return socket.destroy();
    }
  }
  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit('connection', ws, req);
  });
});

wss.on('connection', (ws) => {
  ws.isAgentBridge = true;
  browserClients.add(ws);
  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }
    if (msg.type === 'result' && msg.id && pendingCommands.has(msg.id)) {
      const { resolve } = pendingCommands.get(msg.id);
      pendingCommands.delete(msg.id);
      resolve(msg);
    }
    // 'hello'/'state' messages are informational; latest state could be cached here if needed
  });
  ws.on('close', () => browserClients.delete(ws));
  ws.on('error', () => browserClients.delete(ws));
});
