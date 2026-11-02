// Remote agent-control bridge (Goldfish finding: control endpoints were stubs).
// Browser connects to the same origin over WebSocket, reports live state,
// and executes control commands from the agent. Auth via token query param.

const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 15000;

export function setupAgentControl(getState, handlers, token) {
  let ws = null;
  let closedByUs = false;
  let reconnectDelay = RECONNECT_BASE_MS;

  function send(msg) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
      return true;
    }
    return false;
  }

  function connect() {
    if (closedByUs) return;
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${proto}//${location.host}/ws?token=${encodeURIComponent(token || '')}`;
    try {
      ws = new WebSocket(url);
    } catch {
      scheduleReconnect();
      return;
    }

    ws.onopen = () => {
      reconnectDelay = RECONNECT_BASE_MS;
      send({ type: 'hello', state: getState() });
    };

    ws.onmessage = (event) => {
      let msg;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }
      if (msg.type === 'command') {
        const result = executeCommand(msg.command, msg.params, handlers);
        send({ type: 'result', id: msg.id, command: msg.command, ...result });
      }
    };

    ws.onclose = () => {
      if (!closedByUs) scheduleReconnect();
    };

    ws.onerror = () => {
      try { ws.close(); } catch { /* noop */ }
    };
  }

  function scheduleReconnect() {
    setTimeout(connect, reconnectDelay);
    reconnectDelay = Math.min(reconnectDelay * 2, RECONNECT_MAX_MS);
  }

  function executeCommand(command, params, h) {
    params = params || {};
    switch (command) {
      case 'mood': {
        const mood = h.applyMood ? h.applyMood(params.mood) : null;
        if (!mood) return { success: false, error: `unknown mood: ${params.mood}` };
        return { success: true, mood };
      }
      case 'assemble':
        h.assemble();
        return { success: true, message: 'Assembly restarted' };
      case 'audio':
        return { success: true, enabled: h.toggleAudio(!!params.enabled) };
      case 'particles':
        return h.setParticleCount(params.count);
      case 'performance':
        return h.setPerformance(params.mode);
      case 'skin':
        return h.setSkin(params.skin);
      case 'screenshot':
        return h.screenshot();
      case 'state':
        return { success: true, state: getState() };
      default:
        return { success: false, error: `unknown command: ${command}` };
    }
  }

  // Push state changes to the agent
  function pushState() {
    send({ type: 'state', state: getState() });
  }

  connect();

  return {
    pushState,
    close() {
      closedByUs = true;
      if (ws) try { ws.close(); } catch { /* noop */ }
    }
  };
}
