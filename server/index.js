import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { customAlphabet } from 'nanoid';

const app = express();
const http = createServer(app);

const allowedOrigins = [
  'http://localhost:5173',
  process.env.CLIENT_URL
].filter(Boolean);

const io = new Server(http, {
  cors: { origin: allowedOrigins, methods: ['GET', 'POST'] }
});

const genCode = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 6);

const COLORS = [
  '#5b8af5', '#f5715b', '#5bf5a3', '#f5d45b',
  '#c45bf5', '#5bf5f0', '#f57eab', '#8af55b'
];
const MAX_USERS = 8;
const MAX_DRAWABLES = 5000;
const ALLOWED_TOOLS = new Set(['pen', 'eraser', 'rect', 'circle', 'line']);

function validPoint(p) {
  return p && typeof p.nx === 'number' && typeof p.ny === 'number'
    && p.nx >= -0.01 && p.nx <= 1.01 && p.ny >= -0.01 && p.ny <= 1.01;
}

function pickColor(room) {
  const taken = new Set();
  if (room) for (const u of room.users.values()) taken.add(u.color);
  const available = COLORS.filter(c => !taken.has(c));
  const pool = available.length ? available : COLORS;
  return pool[Math.floor(Math.random() * pool.length)];
}

// roomCode -> { users: Map<socketId, {name, color, socketId}> }
const rooms = new Map();
// socketId -> roomCode
const socketRooms = new Map();

app.get('/', (_req, res) => res.json({ status: 'ok' }));

io.on('connection', (socket) => {
  socket.on('create-room', ({ name }) => {
    if (!name || typeof name !== 'string') {
      socket.emit('room-error', { message: 'Name is required.' });
      return;
    }

    let code;
    do { code = genCode(); } while (rooms.has(code));

    const user = { name: name.trim().slice(0, 20), color: pickColor(null), socketId: socket.id, tool: 'pen' };
    const users = new Map();
    users.set(socket.id, user);
    rooms.set(code, { users, drawables: [], inProgress: new Map() });
    socketRooms.set(socket.id, code);
    socket.join(code);

    socket.emit('room-created', {
      roomCode: code,
      user,
      users: [...users.values()],
      drawables: []
    });
  });

  socket.on('join-room', ({ name, roomCode }) => {
    if (!name || typeof name !== 'string') {
      socket.emit('room-error', { message: 'Name is required.' });
      return;
    }
    const code = (roomCode || '').toUpperCase().trim();
    const room = rooms.get(code);

    if (!room) {
      socket.emit('room-error', { message: 'Room not found.' });
      return;
    }
    if (room.users.size >= MAX_USERS) {
      socket.emit('room-error', { message: 'Room is full.' });
      return;
    }

    const color = pickColor(room);
    const user = { name: name.trim().slice(0, 20), color, socketId: socket.id, tool: 'pen' };
    room.users.set(socket.id, user);
    socketRooms.set(socket.id, code);
    socket.join(code);

    socket.emit('room-joined', {
      roomCode: code,
      user,
      users: [...room.users.values()],
      drawables: [...room.drawables]
    });

    socket.to(code).emit('user-joined', { user });
  });

  socket.on('cursor-move', ({ nx, ny }) => {
    const code = socketRooms.get(socket.id);
    if (!code) return;
    if (typeof nx !== 'number' || typeof ny !== 'number') return;
    socket.to(code).emit('cursor-move', { socketId: socket.id, nx, ny });
  });

  socket.on('tool-change', ({ tool }) => {
    const code = socketRooms.get(socket.id);
    if (!code) return;
    const room = rooms.get(code);
    const user = room?.users.get(socket.id);
    if (!user) return;
    user.tool = tool;
    socket.to(code).emit('tool-change', { socketId: socket.id, tool });
  });

  socket.on('draw-start', (msg) => {
    const code = socketRooms.get(socket.id);
    if (!code) return;
    const room = rooms.get(code);
    if (!room) return;
    if (!msg || typeof msg.id !== 'string') return;
    if (!ALLOWED_TOOLS.has(msg.tool)) return;
    if (typeof msg.color !== 'string' || msg.color.length > 9) return;
    if (typeof msg.size !== 'number' || msg.size < 1 || msg.size > 64) return;
    if (!validPoint(msg.point)) return;
    const safeId = socket.id + ':' + msg.id.slice(0, 64);
    const d = {
      id: safeId,
      socketId: socket.id,
      tool: msg.tool,
      color: msg.color,
      size: msg.size,
      points: [msg.point]
    };
    room.inProgress.set(safeId, d);
    socket.to(code).emit('draw-start', d);
  });

  socket.on('draw-extend', ({ id, point } = {}) => {
    const code = socketRooms.get(socket.id);
    if (!code) return;
    const room = rooms.get(code);
    if (!room) return;
    if (typeof id !== 'string') return;
    if (!validPoint(point)) return;
    const safeId = socket.id + ':' + id.slice(0, 64);
    const d = room.inProgress.get(safeId);
    if (!d) return;
    if (d.tool === 'pen' || d.tool === 'eraser') {
      if (d.points.length < 4000) d.points.push(point);
    } else {
      d.points = [d.points[0], point];
    }
    socket.to(code).emit('draw-extend', {
      id: safeId,
      point,
      replace: d.tool !== 'pen' && d.tool !== 'eraser'
    });
  });

  socket.on('draw-end', ({ id } = {}) => {
    const code = socketRooms.get(socket.id);
    if (!code) return;
    const room = rooms.get(code);
    if (!room) return;
    if (typeof id !== 'string') return;
    const safeId = socket.id + ':' + id.slice(0, 64);
    const d = room.inProgress.get(safeId);
    if (!d) return;
    room.inProgress.delete(safeId);
    room.drawables.push(d);
    if (room.drawables.length > MAX_DRAWABLES) {
      room.drawables.splice(0, room.drawables.length - MAX_DRAWABLES);
    }
    socket.to(code).emit('draw-end', { drawable: d });
  });

  socket.on('draw-clear', () => {
    const code = socketRooms.get(socket.id);
    if (!code) return;
    const room = rooms.get(code);
    if (!room) return;
    room.drawables.length = 0;
    room.inProgress.clear();
    io.to(code).emit('draw-clear');
  });

  socket.on('disconnect', () => {
    const code = socketRooms.get(socket.id);
    if (!code) return;

    socketRooms.delete(socket.id);
    const room = rooms.get(code);
    if (!room) return;

    // Cancel any in-progress drawables this user had
    const orphanedIds = [];
    for (const [id, d] of room.inProgress) {
      if (d.socketId === socket.id) orphanedIds.push(id);
    }
    for (const id of orphanedIds) room.inProgress.delete(id);
    if (orphanedIds.length) {
      socket.to(code).emit('draw-cancel', { ids: orphanedIds });
    }

    room.users.delete(socket.id);
    if (room.users.size === 0) {
      rooms.delete(code);
    } else {
      io.to(code).emit('user-left', { socketId: socket.id });
    }
  });
});

const PORT = process.env.PORT || 3001;
http.listen(PORT, () => console.log(`Server running on :${PORT}`));
