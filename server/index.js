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

    const user = { name: name.trim().slice(0, 20), color: COLORS[0], socketId: socket.id };
    const users = new Map();
    users.set(socket.id, user);
    rooms.set(code, { users });
    socketRooms.set(socket.id, code);
    socket.join(code);

    socket.emit('room-created', {
      roomCode: code,
      user,
      users: [...users.values()]
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

    const color = COLORS[room.users.size % COLORS.length];
    const user = { name: name.trim().slice(0, 20), color, socketId: socket.id };
    room.users.set(socket.id, user);
    socketRooms.set(socket.id, code);
    socket.join(code);

    socket.emit('room-joined', {
      roomCode: code,
      user,
      users: [...room.users.values()]
    });

    socket.to(code).emit('user-joined', { user });
  });

  socket.on('disconnect', () => {
    const code = socketRooms.get(socket.id);
    if (!code) return;

    socketRooms.delete(socket.id);
    const room = rooms.get(code);
    if (!room) return;

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
