const http = require('http');
const crypto = require('crypto');
const os = require('os');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const COLORS = ['红', '橙', '黄', '绿', '青', '蓝', '紫', '粉', '金', '银'];
const ANIMALS = ['狐狸', '熊猫', '老虎', '兔子', '猫头鹰', '海豚', '刺猬', '考拉', '麋鹿', '水獭', '企鹅', '松鼠'];

function randomName() {
  return COLORS[Math.floor(Math.random() * COLORS.length)] + ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
}

function getLocalIp() {
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return 'localhost';
}

const LAN = getLocalIp();

const server = http.createServer((req, res) => {
  if (req.url === '/' || req.url === '/index.html') {
    const html = fs.readFileSync(path.join(__dirname, 'index.html'));
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

const MAGIC = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
let nextId = 1;
const clients = []; // { id, socket, name }

function encodeFrame(data, opcode = 0x1) {
  const payload = Buffer.from(data, 'utf8');
  const len = payload.length;
  let header;
  if (len < 126) {
    header = Buffer.from([0x80 | opcode, len]);
  } else if (len < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x80 | opcode;
    header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x80 | opcode;
    header[1] = 127;
    header.writeUInt32BE(0, 2);
    header.writeUInt32BE(len, 6);
  }
  return Buffer.concat([header, payload]);
}

function memberList() {
  return clients.map(c => ({ id: c.id, name: c.name }));
}

function broadcast(obj) {
  const frame = encodeFrame(JSON.stringify(obj));
  for (const c of clients) {
    if (c.socket.writable) c.socket.write(frame);
  }
}

function broadcastMembers() {
  broadcast({ type: 'members', list: memberList() });
}

function handleMessage(socket, client, raw) {
  let p;
  try { p = JSON.parse(raw); } catch { return; }
  if (p.type === 'chat') {
    const text = String(p.text || '').slice(0, 500);
    if (!text.trim()) return;
    const obj = { type: 'chat', id: client.id, name: client.name, text, ts: Date.now() };
    if (typeof p.ttl === 'number') obj.ttl = p.ttl > 0 ? p.ttl : 0; // 0 = 永久
    broadcast(obj);
  } else if (p.type === 'rename') {
    const name = String(p.name || '').trim().slice(0, 12);
    if (!name) return;
    const old = client.name;
    if (name === old) return;
    client.name = name;
    broadcast({ type: 'system', text: '「' + old + '」改名为「' + name + '」' });
    broadcastMembers();
  }
}

function setupClient(socket) {
  const client = { id: nextId++, socket, name: randomName() };
  clients.push(client);

  socket.write(encodeFrame(JSON.stringify({
    type: 'welcome',
    id: client.id,
    name: client.name,
    members: memberList(),
    lan: 'http://' + LAN + ':' + PORT
  })));

  broadcast({ type: 'system', text: '👋 欢迎「' + client.name + '」加入聊天室' });
  broadcastMembers();

  let buffer = Buffer.alloc(0);
  socket.on('data', (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    while (true) {
      if (buffer.length < 2) break;
      const b0 = buffer[0];
      const b1 = buffer[1];
      const opcode = b0 & 0x0f;
      const masked = (b1 & 0x80) !== 0;
      let len = b1 & 0x7f;
      let offset = 2;
      if (len === 126) {
        if (buffer.length < 4) break;
        len = buffer.readUInt16BE(2);
        offset = 4;
      } else if (len === 127) {
        if (buffer.length < 10) break;
        len = buffer.readUInt32BE(6);
        offset = 10;
      }
      let maskKey;
      if (masked) {
        if (buffer.length < offset + 4) break;
        maskKey = buffer.slice(offset, offset + 4);
        offset += 4;
      }
      if (buffer.length < offset + len) break;
      let payload = buffer.slice(offset, offset + len);
      if (masked) {
        const p = Buffer.alloc(len);
        for (let i = 0; i < len; i++) p[i] = payload[i] ^ maskKey[i % 4];
        payload = p;
      }
      buffer = buffer.slice(offset + len);
      if (opcode === 0x8) { socket.end(); return; }
      if (opcode === 0x9) { socket.write(encodeFrame('', 0xA)); continue; }
      if (opcode === 0x1 || opcode === 0x0) {
        handleMessage(socket, client, payload.toString('utf8'));
      }
    }
  });

  socket.on('close', () => {
    const idx = clients.indexOf(client);
    if (idx !== -1) clients.splice(idx, 1);
    broadcast({ type: 'system', text: '「' + client.name + '」离开了聊天室' });
    broadcastMembers();
  });
  socket.on('error', () => {});
}

server.on('upgrade', (req, socket) => {
  const key = req.headers['sec-websocket-key'];
  if (!key) { socket.destroy(); return; }
  const accept = crypto.createHash('sha1').update(key + MAGIC).digest('base64');
  socket.write(
    'HTTP/1.1 101 Switching Protocols\r\n' +
    'Upgrade: websocket\r\n' +
    'Connection: Upgrade\r\n' +
    'Sec-WebSocket-Accept: ' + accept + '\r\n\r\n'
  );
  socket.setKeepAlive(true);
  setupClient(socket);
});

server.listen(PORT, () => {
  console.log('私密聊天服务已启动');
  console.log('本机:   http://localhost:' + PORT);
  console.log('局域网: http://' + LAN + ':' + PORT + '  (同 WiFi 可分享)');
});
