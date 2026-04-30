# Drawboard

A small real-time collaborative whiteboard. Pick a name, share a six-character room code, and you're sketching with up to five people at once.

Built for CS571 by Roman Kus.

## Features

- Pen, eraser, and six shape tools (rectangle, circle, line, triangle, arrow, star). Text and image upload too (paste, drag, or file picker).
- Live cursors so you can see where everyone else is drawing.
- Per-user undo and redo. The clear-canvas button needs a majority vote, so one person can't wipe the room.
- Sidebar chat with history that persists alongside the canvas.
- Public rooms (anyone can join from the lobby) and private rooms (code-only).
- PNG export of the current canvas.
- Rooms persist in Supabase, so leaving and coming back hours later with the same code restores the drawing and chat.

## Tech

- **Frontend:** React 19, Vite, plain CSS, React Router. Deployed on Vercel.
- **Backend:** Node, Express, Socket.io. Deployed on Render.
- **Storage:** Supabase Postgres for room state.

Persistence is optional. If Supabase env vars are missing, the server runs entirely in memory and rooms vanish when everyone leaves.

## Running locally

Requires Node 20 or newer.

```bash
# Frontend
npm install
npm run dev          # http://localhost:5173

# Backend (in a second terminal)
cd server
npm install
npm run dev          # http://localhost:3001
```

The frontend reads its server URL from `src/config.js`. For local dev that's `http://localhost:3001`.

### Optional: persistence

To enable room persistence:

1. Create a free Supabase project.
2. Run this in the SQL editor:

   ```sql
   create table public.rooms (
     code text primary key,
     drawables jsonb not null default '[]'::jsonb,
     chat_history jsonb not null default '[]'::jsonb,
     is_public boolean not null default false,
     host_name text not null,
     created_at timestamptz not null default now(),
     last_active timestamptz not null default now()
   );
   create index rooms_last_active_idx on public.rooms (last_active);
   ```

3. Copy `server/.env.example` to `server/.env` and fill in your Supabase URL and secret (service role) key.
4. Restart the server. The logs should show `[persistence] Supabase client initialized.`

## Project layout

```
src/
  App.jsx              router and page wiring
  components/          canvas layer, navbar, color picker, ghost cursors
  contexts/
    SocketContext.jsx  socket.io client + all real-time state
  pages/
    Home.jsx           name entry, create or join a room
    Board.jsx          the whiteboard itself
    About.jsx          static info
    Feedback.jsx       feedback form that posts to the server
server/
  index.js             Express + Socket.io + Supabase persistence
```

## Author

Roman Kus, [@RomanWKus](https://github.com/RomanWKus) on GitHub. Sophomore project, spring 2026.
