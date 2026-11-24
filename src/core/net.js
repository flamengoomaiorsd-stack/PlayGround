import Peer from 'peerjs';

const PREFIX = 'tsx1';
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function randomCode() {
  let out = '';
  for (let i = 0; i < 5; i++) out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return out;
}

const PEER_CONFIG = {
  debug: 0,
  config: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun.cloudflare.com:3478' },
    ],
  },
};

export class NetClient {
  constructor() {
    this.peer = null;
    this.conn = null;
    this.code = null;
    this.role = null;
    this.handlers = {};
    this.closed = false;
    this.timeout = null;
    this.lastStatus = '';
  }

  on(event, cb) {
    (this.handlers[event] ||= []).push(cb);
    return this;
  }

  emit(event, payload) {
    for (const cb of this.handlers[event] || []) {
      try { cb(payload); } catch (err) { console.error(err); }
    }
  }

  status(text) {
    this.lastStatus = text;
    this.emit('status', text);
  }

  createRoom() {
    return new Promise((resolve, reject) => {
      this.close();
      this.closed = false;
      this.role = 'host';
      const tryHost = (attempt = 0) => {
        const code = randomCode();
        const id = `${PREFIX}-${code}-h`;
        this.status('Criando sala segura…');
        let settled = false;
        let peer;
        try {
          peer = new Peer(id, PEER_CONFIG);
        } catch (err) {
          reject(err);
          return;
        }
        this.peer = peer;
        const fail = (err) => {
          if (settled) return;
          settled = true;
          try { peer.destroy(); } catch {}
          if (attempt < 2 && (err?.type === 'unavailable-id' || err?.type === 'network')) {
            setTimeout(() => tryHost(attempt + 1), 700);
          } else {
            reject(err);
          }
        };
        peer.on('open', () => {
          if (settled) return;
          settled = true;
          this.code = code;
          this.status('Sala criada. Aguardando adversário…');
          this.emit('room', code);
          this.bindPeer();
          resolve(code);
        });
        peer.on('error', fail);
      };
      tryHost();
    });
  }

  bindPeer() {
    const peer = this.peer;
    if (!peer) return;
    peer.on('connection', (conn) => {
      if (this.conn && this.conn.open) {
        // room is full (1v1/2v2 lobby handles one guest)
        try { conn.close(); } catch {}
        return;
      }
      this.attachConnection(conn);
      this.status('Adversário conectado!');
      this.emit('guest', true);
    });
    peer.on('disconnected', () => {
      if (!this.closed) {
        this.status('Reconectando ao servidor…');
        setTimeout(() => { try { peer.reconnect(); } catch {} }, 1200);
      }
    });
    peer.on('error', (err) => {
      if (err?.type === 'peer-unavailable') return;
      this.emit('error', err?.message || String(err));
    });
    peer.on('close', () => {
      if (!this.closed) this.emit('close');
    });
  }

  joinRoom(code) {
    return new Promise((resolve, reject) => {
      this.close();
      this.closed = false;
      this.role = 'guest';
      const clean = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
      if (clean.length < 4) { reject(new Error('Código inválido')); return; }
      this.code = clean;
      this.status('Procurando sala…');
      const peer = new Peer(PEER_CONFIG);
      this.peer = peer;
      let settled = false;
      const finish = (err) => {
        if (settled) return;
        settled = true;
        clearTimeout(this.timeout);
        this.status(err ? 'Falha na conexão' : 'Conectando…');
        if (err) {
          try { peer.destroy(); } catch {}
          reject(err);
        } else resolve();
      };
      this.timeout = setTimeout(() => finish(new Error('Sala não encontrada. Verifique o código.')), 18000);
      peer.on('open', () => {
        this.status('Conectando à sala…');
        const conn = peer.connect(`${PREFIX}-${clean}-h`, { reliable: true, serialization: 'json' });
        conn.on('open', () => {
          this.attachConnection(conn);
          finish();
        });
        conn.on('error', (err) => finish(err || new Error('Conexão recusada')));
      });
      peer.on('error', (err) => {
        if (err?.type === 'peer-unavailable') finish(new Error('Sala não encontrada. Verifique o código.'));
        else finish(new Error('Erro de rede: ' + (err?.type || 'desconhecido')));
      });
    });
  }

  attachConnection(conn) {
    this.conn = conn;
    conn.on('data', (data) => {
      if (data && typeof data === 'object') this.emit('data', data);
    });
    conn.on('close', () => {
      this.conn = null;
      if (!this.closed) this.emit('close');
    });
    conn.on('error', (err) => this.emit('error', err?.message || 'Erro na conexão'));
  }

  send(data) {
    if (this.conn && this.conn.open) {
      try { this.conn.send(data); return true; } catch { return false; }
    }
    return false;
  }

  get connected() {
    return !!(this.conn && this.conn.open);
  }

  close() {
    this.closed = true;
    clearTimeout(this.timeout);
    try { this.conn?.close(); } catch {}
    try { this.peer?.destroy(); } catch {}
    this.conn = null;
    this.peer = null;
    this.code = null;
    this.role = null;
  }
}
