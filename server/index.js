import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { customAlphabet } from 'nanoid';
import { createClient } from '@supabase/supabase-js';
import { config as loadDotenv } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load server/.env regardless of where node was started from
loadDotenv({ path: join(dirname(fileURLToPath(import.meta.url)), '.env') });

// ── Supabase persistence (optional; degrades to in-memory only if env not set) ──
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const supabase = (SUPABASE_URL && SUPABASE_SERVICE_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } })
  : null;
if (!supabase) {
  console.log('[persistence] Supabase env not set — running with in-memory rooms only.');
} else {
  console.log('[persistence] Supabase client initialized.');
}

async function loadRoomFromDb(code) {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('rooms')
    .select('code, drawables, chat_history, is_public, host_name, created_at')
    .eq('code', code)
    .maybeSingle();
  if (error) {
    console.error('[persistence] loadRoomFromDb error', code, error.message);
    return null;
  }
  return data || null;
}

async function roomExistsInDb(code) {
  if (!supabase) return false;
  const { count, error } = await supabase
    .from('rooms')
    .select('code', { count: 'exact', head: true })
    .eq('code', code);
  if (error) {
    console.error('[persistence] roomExistsInDb error', code, error.message);
    return false;
  }
  return (count || 0) > 0;
}

async function saveRoomToDb(code, room) {
  if (!supabase) return;
  if (!room) return;
  const payload = {
    code,
    drawables: room.drawables || [],
    chat_history: room.chatHistory || [],
    is_public: !!room.isPublic,
    host_name: room.hostName || 'Anonymous',
    last_active: new Date().toISOString()
  };
  // Preserve created_at by only setting it if inserting fresh
  const { error } = await supabase.from('rooms').upsert(payload, { onConflict: 'code' });
  if (error) console.error('[persistence] saveRoomToDb error', code, error.message);
}

async function saveFeedbackToDb(entry) {
  if (!supabase) return true;
  const { error } = await supabase
    .from('feedback')
    .insert({
      name: entry.name,
      message: entry.message,
      socket_id: entry.socketId,
      room_code: entry.roomCode || null
    });
  if (error) {
    console.error('[persistence] saveFeedbackToDb error', error.message);
    return false;
  }
  return true;
}

function markDirty(code) {
  const room = rooms.get(code);
  if (room) room.dirty = true;
}

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
const MAX_USERS = 5;
const MAX_DRAWABLES = 5000;
const ALLOWED_TOOLS = new Set(['pen', 'eraser', 'rect', 'circle', 'line', 'triangle', 'arrow', 'star', 'text', 'image']);
const CLEAR_VOTE_TIMEOUT_MS = 30000;
const MAX_TEXT_LEN = 500;
const MAX_IMAGE_DATAURL_LEN = 1_200_000; // ~900KB after base64; client should compress below this
const MAX_CHAT_LEN = 400;
const MAX_CHAT_HISTORY = 100;

function clearVoteThreshold(userCount) {
  if (userCount <= 1) return 1;
  if (userCount === 2) return 2;
  return Math.ceil((userCount * 2) / 3);
}

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
// in-memory ring of recent feedback submissions; capped at 200
const feedbackLog = [];

app.get('/', (_req, res) => res.json({ status: 'ok' }));

io.on('connection', (socket) => {
  socket.on('create-room', async ({ name, isPublic } = {}) => {
    if (!name || typeof name !== 'string') {
      socket.emit('room-error', { message: 'Name is required.' });
      return;
    }

    // Find a code that isn't in memory AND isn't in the DB (saved hibernated room)
    let code;
    let tries = 0;
    do {
      code = genCode();
      tries++;
      if (tries > 10) break;
    } while (rooms.has(code) || (await roomExistsInDb(code)));

    const cleanName = name.trim().slice(0, 20);
    const user = { name: cleanName, color: pickColor(null), socketId: socket.id, tool: 'pen' };
    const users = new Map();
    users.set(socket.id, user);
    rooms.set(code, {
      users,
      drawables: [],
      inProgress: new Map(),
      chatHistory: [],
      isPublic: !!isPublic,
      hostName: cleanName,
      createdAt: Date.now(),
      dirty: true
    });
    socketRooms.set(socket.id, code);
    socket.join(code);

    socket.emit('room-created', {
      roomCode: code,
      user,
      users: [...users.values()],
      drawables: [],
      chatHistory: [],
      isPublic: !!isPublic
    });
  });

  socket.on('join-public-room', ({ name } = {}) => {
    if (!name || typeof name !== 'string') {
      socket.emit('room-error', { message: 'Name is required.' });
      return;
    }
    const candidates = [];
    for (const [code, room] of rooms) {
      if (!room.isPublic) continue;
      if (room.users.size === 0 || room.users.size >= MAX_USERS) continue;
      candidates.push(code);
    }
    if (candidates.length === 0) {
      socket.emit('room-error', { message: 'No public rooms available. Try creating one.' });
      return;
    }
    const code = candidates[Math.floor(Math.random() * candidates.length)];
    const room = rooms.get(code);
    const color = pickColor(room);
    const user = { name: name.trim().slice(0, 20), color, socketId: socket.id, tool: 'pen' };
    room.users.set(socket.id, user);
    socketRooms.set(socket.id, code);
    socket.join(code);

    socket.emit('room-joined', {
      roomCode: code,
      user,
      users: [...room.users.values()],
      drawables: [...room.drawables],
      chatHistory: [...(room.chatHistory || [])]
    });
    socket.to(code).emit('user-joined', { user });
  });

  socket.on('join-room', async ({ name, roomCode }) => {
    if (!name || typeof name !== 'string') {
      socket.emit('room-error', { message: 'Name is required.' });
      return;
    }
    const code = (roomCode || '').toUpperCase().trim();
    let room = rooms.get(code);

    // Try to hydrate from DB if not in memory
    if (!room) {
      const saved = await loadRoomFromDb(code);
      if (saved) {
        room = {
          users: new Map(),
          drawables: Array.isArray(saved.drawables) ? saved.drawables : [],
          inProgress: new Map(),
          chatHistory: Array.isArray(saved.chat_history) ? saved.chat_history : [],
          isPublic: !!saved.is_public,
          hostName: saved.host_name || 'Anonymous',
          createdAt: saved.created_at ? new Date(saved.created_at).getTime() : Date.now(),
          dirty: false
        };
        rooms.set(code, room);
      }
    }

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
      drawables: [...room.drawables],
      chatHistory: [...(room.chatHistory || [])]
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
    // Text and image use the commit flow, not the live-stroke flow
    if (msg.tool === 'text' || msg.tool === 'image') return;
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
    socket.to(code).emit('cursor-move', { socketId: socket.id, nx: msg.point.nx, ny: msg.point.ny });
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
    socket.to(code).emit('cursor-move', { socketId: socket.id, nx: point.nx, ny: point.ny });
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
    room.dirty = true;
    socket.to(code).emit('draw-end', { drawable: d });
  });

  socket.on('draw-undo', ({ id } = {}) => {
    const code = socketRooms.get(socket.id);
    if (!code) return;
    const room = rooms.get(code);
    if (!room) return;
    if (typeof id !== 'string') return;
    const idx = room.drawables.findIndex(d => d.id === id && d.socketId === socket.id);
    if (idx === -1) return;
    room.drawables.splice(idx, 1);
    room.dirty = true;
    io.to(code).emit('draw-remove', { id });
  });

  socket.on('draw-redo', ({ drawable } = {}) => {
    const code = socketRooms.get(socket.id);
    if (!code) return;
    const room = rooms.get(code);
    if (!room) return;
    if (!drawable || drawable.socketId !== socket.id) return;
    if (!ALLOWED_TOOLS.has(drawable.tool)) return;
    if (typeof drawable.color !== 'string' || drawable.color.length > 9) return;
    if (typeof drawable.size !== 'number' || drawable.size < 1 || drawable.size > 64) return;
    if (!Array.isArray(drawable.points) || drawable.points.length === 0) return;
    for (const p of drawable.points) if (!validPoint(p)) return;
    if (room.drawables.some(d => d.id === drawable.id)) return;
    room.drawables.push(drawable);
    if (room.drawables.length > MAX_DRAWABLES) {
      room.drawables.splice(0, room.drawables.length - MAX_DRAWABLES);
    }
    room.dirty = true;
    io.to(code).emit('draw-add', { drawable });
  });

  socket.on('drawable-add', ({ drawable } = {}) => {
    const code = socketRooms.get(socket.id);
    if (!code) return;
    const room = rooms.get(code);
    if (!room) return;
    if (!drawable || typeof drawable.id !== 'string') return;
    if (!ALLOWED_TOOLS.has(drawable.tool)) return;
    if (typeof drawable.color !== 'string' || drawable.color.length > 9) return;
    if (typeof drawable.size !== 'number' || drawable.size < 1 || drawable.size > 64) return;
    if (!Array.isArray(drawable.points) || drawable.points.length === 0) return;
    for (const p of drawable.points) if (!validPoint(p)) return;

    if (drawable.tool === 'text') {
      if (typeof drawable.text !== 'string') return;
      if (drawable.text.length === 0 || drawable.text.length > MAX_TEXT_LEN) return;
    } else if (drawable.tool === 'image') {
      if (typeof drawable.dataUrl !== 'string') return;
      if (!drawable.dataUrl.startsWith('data:image/')) return;
      if (drawable.dataUrl.length > MAX_IMAGE_DATAURL_LEN) return;
      if (typeof drawable.width !== 'number' || drawable.width <= 0 || drawable.width > 1.5) return;
      if (typeof drawable.height !== 'number' || drawable.height <= 0 || drawable.height > 1.5) return;
    } else {
      // Only text and image are supposed to use the commit flow
      return;
    }

    const safeId = socket.id + ':' + drawable.id.slice(0, 64);
    const safeDrawable = { ...drawable, id: safeId, socketId: socket.id };
    if (room.drawables.some(d => d.id === safeId)) return;
    room.drawables.push(safeDrawable);
    if (room.drawables.length > MAX_DRAWABLES) {
      room.drawables.splice(0, room.drawables.length - MAX_DRAWABLES);
    }
    room.dirty = true;
    io.to(code).emit('draw-add', { drawable: safeDrawable });
  });

  socket.on('chat-send', ({ text } = {}) => {
    const code = socketRooms.get(socket.id);
    if (!code) return;
    const room = rooms.get(code);
    if (!room) return;
    if (typeof text !== 'string') return;
    const trimmed = text.trim().slice(0, MAX_CHAT_LEN);
    if (!trimmed) return;
    const user = room.users.get(socket.id);
    if (!user) return;
    const msg = {
      socketId: socket.id,
      name: user.name,
      color: user.color,
      text: trimmed,
      timestamp: Date.now()
    };
    if (!room.chatHistory) room.chatHistory = [];
    room.chatHistory.push(msg);
    if (room.chatHistory.length > MAX_CHAT_HISTORY) {
      room.chatHistory.splice(0, room.chatHistory.length - MAX_CHAT_HISTORY);
    }
    room.dirty = true;
    io.to(code).emit('chat-message', msg);
  });

  socket.on('feedback-send', async ({ name, message } = {}) => {
    if (typeof message !== 'string') return;
    const trimmedMsg = message.trim();
    if (!trimmedMsg || trimmedMsg.length > 1000) {
      socket.emit('feedback-ack', { ok: false, error: 'Message must be 1-1000 characters.' });
      return;
    }
    const cleanName = (typeof name === 'string' && name.trim())
      ? name.trim().slice(0, 30)
      : 'Anonymous';
    const entry = {
      name: cleanName,
      message: trimmedMsg,
      timestamp: new Date().toISOString(),
      socketId: socket.id,
      roomCode: socketRooms.get(socket.id) || null
    };
    feedbackLog.push(entry);
    if (feedbackLog.length > 200) feedbackLog.splice(0, feedbackLog.length - 200);
    console.log('[feedback]', JSON.stringify(entry));
    const saved = await saveFeedbackToDb(entry);
    socket.emit('feedback-ack', saved
      ? { ok: true }
      : { ok: false, error: 'Could not save feedback. Try again.' });
  });

  function performClear(code, room) {
    room.drawables.length = 0;
    room.inProgress.clear();
    room.dirty = true;
    io.to(code).emit('draw-clear');
  }

  function cancelClearVote(code, room, reason) {
    if (!room.pendingClearVote) return;
    if (room.pendingClearVote.timeoutId) clearTimeout(room.pendingClearVote.timeoutId);
    room.pendingClearVote = null;
    io.to(code).emit('clear-vote-cancelled', { reason: reason || 'cancelled' });
  }

  socket.on('clear-vote-start', () => {
    const code = socketRooms.get(socket.id);
    if (!code) return;
    const room = rooms.get(code);
    if (!room) return;
    if (room.pendingClearVote) return; // already voting

    const initiator = room.users.get(socket.id);
    if (!initiator) return;

    // Solo room: clear immediately, no vote
    if (room.users.size <= 1) {
      performClear(code, room);
      return;
    }

    const threshold = clearVoteThreshold(room.users.size);
    const approvals = new Set([socket.id]);
    const timeoutId = setTimeout(() => {
      const r = rooms.get(code);
      if (r && r.pendingClearVote) cancelClearVote(code, r, 'timeout');
    }, CLEAR_VOTE_TIMEOUT_MS);

    room.pendingClearVote = {
      initiatorSocketId: socket.id,
      initiatorName: initiator.name,
      approvals,
      threshold,
      timeoutId
    };

    io.to(code).emit('clear-vote-pending', {
      initiatorSocketId: socket.id,
      initiatorName: initiator.name,
      approvals: approvals.size,
      total: room.users.size,
      threshold
    });
  });

  socket.on('clear-vote-respond', ({ approve } = {}) => {
    const code = socketRooms.get(socket.id);
    if (!code) return;
    const room = rooms.get(code);
    if (!room || !room.pendingClearVote) return;
    if (!room.users.has(socket.id)) return;
    if (room.pendingClearVote.approvals.has(socket.id)) return; // already voted

    if (approve === false) {
      cancelClearVote(code, room, 'rejected');
      return;
    }

    room.pendingClearVote.approvals.add(socket.id);

    if (room.pendingClearVote.approvals.size >= room.pendingClearVote.threshold) {
      if (room.pendingClearVote.timeoutId) clearTimeout(room.pendingClearVote.timeoutId);
      room.pendingClearVote = null;
      io.to(code).emit('clear-vote-passed');
      performClear(code, room);
      return;
    }

    io.to(code).emit('clear-vote-pending', {
      initiatorSocketId: room.pendingClearVote.initiatorSocketId,
      initiatorName: room.pendingClearVote.initiatorName,
      approvals: room.pendingClearVote.approvals.size,
      total: room.users.size,
      threshold: room.pendingClearVote.threshold
    });
  });

  socket.on('disconnect', async () => {
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

    // Clean up any pending clear vote affected by this leaving user
    if (room.pendingClearVote) {
      room.pendingClearVote.approvals.delete(socket.id);
      const initiatorLeft = room.pendingClearVote.initiatorSocketId === socket.id;
      const stillHasVoters = room.users.size > 0;
      if (initiatorLeft || !stillHasVoters) {
        cancelClearVote(code, room, 'cancelled');
      } else {
        // Recompute threshold based on new user count
        const newThreshold = clearVoteThreshold(room.users.size);
        room.pendingClearVote.threshold = newThreshold;
        if (room.pendingClearVote.approvals.size >= newThreshold) {
          if (room.pendingClearVote.timeoutId) clearTimeout(room.pendingClearVote.timeoutId);
          const pending = room.pendingClearVote;
          room.pendingClearVote = null;
          io.to(code).emit('clear-vote-passed');
          performClear(code, room);
        } else {
          io.to(code).emit('clear-vote-pending', {
            initiatorSocketId: room.pendingClearVote.initiatorSocketId,
            initiatorName: room.pendingClearVote.initiatorName,
            approvals: room.pendingClearVote.approvals.size,
            total: room.users.size,
            threshold: newThreshold
          });
        }
      }
    }

    if (room.users.size === 0) {
      if (room.pendingClearVote && room.pendingClearVote.timeoutId) {
        clearTimeout(room.pendingClearVote.timeoutId);
      }
      await saveRoomToDb(code, room);
      rooms.delete(code);
    } else {
      io.to(code).emit('user-left', { socketId: socket.id });
    }
  });
});

// Periodic save of any room with pending changes — protects against crashes mid-session.
const SAVE_INTERVAL_MS = 30_000;
setInterval(async () => {
  for (const [code, room] of rooms) {
    if (!room.dirty) continue;
    room.dirty = false;
    try {
      await saveRoomToDb(code, room);
    } catch (e) {
      console.error('[persistence] periodic save failed', code, e?.message || e);
      room.dirty = true; // retry on next tick
    }
  }
}, SAVE_INTERVAL_MS);

const PORT = process.env.PORT || 3001;
http.listen(PORT, () => console.log(`Server running on :${PORT}`));
