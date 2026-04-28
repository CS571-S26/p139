import { createContext, useContext, useRef, useState, useEffect, useCallback } from 'react'
import { io } from 'socket.io-client'
import { SERVER_URL } from '../config'

const Ctx = createContext(null)

export function useSocket() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useSocket must be used inside SocketProvider')
  return ctx
}

export default function SocketProvider({ children }) {
  const socketRef = useRef(null)
  const [roomCode, setRoomCode] = useState(null)
  const [users, setUsers] = useState([])
  const [currentUser, setCurrentUser] = useState(null)
  const [error, setError] = useState(null)
  const [connected, setConnected] = useState(false)
  const [remoteCursors, setRemoteCursors] = useState({})
  const [drawables, setDrawables] = useState([])
  const [liveDrawables, setLiveDrawables] = useState({})
  const [undoStack, setUndoStack] = useState([])
  const [redoStack, setRedoStack] = useState([])
  const [clearVote, setClearVote] = useState(null) // { initiatorSocketId, initiatorName, approvals, total, threshold, hasVoted } | null

  function getSocket() {
    if (!socketRef.current) {
      const s = io(SERVER_URL, { autoConnect: false })
      s.on('connect', () => setConnected(true))
      s.on('disconnect', () => {
        setConnected(false)
        setRoomCode(null)
        setUsers([])
        setCurrentUser(null)
      })
      s.on('room-created', ({ roomCode: code, user, users: u, drawables: d }) => {
        setRoomCode(code)
        setCurrentUser(user)
        setUsers(u)
        setDrawables(d || [])
        setLiveDrawables({})
        setUndoStack([])
        setRedoStack([])
        setError(null)
      })
      s.on('room-joined', ({ roomCode: code, user, users: u, drawables: d }) => {
        setRoomCode(code)
        setCurrentUser(user)
        setUsers(u)
        setDrawables(d || [])
        setLiveDrawables({})
        setUndoStack([])
        setRedoStack([])
        setError(null)
      })
      s.on('user-joined', ({ user }) => {
        setUsers(prev => [...prev, user])
      })
      s.on('user-left', ({ socketId }) => {
        setUsers(prev => prev.filter(u => u.socketId !== socketId))
        setRemoteCursors(prev => {
          const { [socketId]: _, ...rest } = prev
          return rest
        })
      })
      s.on('cursor-move', ({ socketId, nx, ny }) => {
        setRemoteCursors(prev => ({ ...prev, [socketId]: { nx, ny } }))
      })
      s.on('tool-change', ({ socketId, tool }) => {
        setUsers(prev => prev.map(u => u.socketId === socketId ? { ...u, tool } : u))
      })
      s.on('draw-start', (d) => {
        setLiveDrawables(prev => ({ ...prev, [d.id]: d }))
      })
      s.on('draw-extend', ({ id, point, replace }) => {
        setLiveDrawables(prev => {
          const d = prev[id]
          if (!d) return prev
          const next = replace
            ? { ...d, points: [d.points[0], point] }
            : { ...d, points: [...d.points, point] }
          return { ...prev, [id]: next }
        })
      })
      s.on('draw-end', ({ drawable }) => {
        setLiveDrawables(prev => {
          const { [drawable.id]: _, ...rest } = prev
          return rest
        })
        setDrawables(prev => [...prev, drawable])
      })
      s.on('draw-cancel', ({ ids }) => {
        setLiveDrawables(prev => {
          const next = { ...prev }
          for (const id of ids) delete next[id]
          return next
        })
      })
      s.on('draw-remove', ({ id }) => {
        setDrawables(prev => prev.filter(d => d.id !== id))
      })
      s.on('draw-add', ({ drawable }) => {
        setDrawables(prev => prev.some(d => d.id === drawable.id) ? prev : [...prev, drawable])
      })
      s.on('draw-clear', () => {
        setDrawables([])
        setLiveDrawables({})
        setUndoStack([])
        setRedoStack([])
      })
      s.on('clear-vote-pending', (info) => {
        setClearVote(prev => ({ ...info, hasVoted: prev?.hasVoted || false }))
      })
      s.on('clear-vote-passed', () => {
        setClearVote(null)
      })
      s.on('clear-vote-cancelled', () => {
        setClearVote(null)
      })
      s.on('room-error', ({ message }) => {
        setError(message)
      })
      socketRef.current = s
    }
    return socketRef.current
  }

  function createRoom(name) {
    setError(null)
    const s = getSocket()
    if (!s.connected) s.connect()
    s.emit('create-room', { name })
  }

  function joinRoom(name, code) {
    setError(null)
    const s = getSocket()
    if (!s.connected) s.connect()
    s.emit('join-room', { name, roomCode: code })
  }

  function sendCursor(nx, ny) {
    const s = socketRef.current
    if (!s || !s.connected) return
    s.emit('cursor-move', { nx, ny })
  }

  function sendTool(tool) {
    const s = socketRef.current
    if (!s || !s.connected) return
    s.emit('tool-change', { tool })
  }

  function sendDrawStart({ id, tool, color, size, point }) {
    const s = socketRef.current
    if (!s || !s.connected || !currentUser) return
    // Local echo with server-style namespaced id
    const localId = currentUser.socketId + ':' + id
    const d = {
      id: localId,
      socketId: currentUser.socketId,
      tool, color, size,
      points: [point]
    }
    setLiveDrawables(prev => ({ ...prev, [localId]: d }))
    s.emit('draw-start', { id, tool, color, size, point })
    return localId
  }

  function sendDrawExtend({ id, point }) {
    const s = socketRef.current
    if (!s || !s.connected || !currentUser) return
    const localId = currentUser.socketId + ':' + id
    setLiveDrawables(prev => {
      const d = prev[localId]
      if (!d) return prev
      const replace = d.tool !== 'pen' && d.tool !== 'eraser'
      const next = replace
        ? { ...d, points: [d.points[0], point] }
        : { ...d, points: [...d.points, point] }
      return { ...prev, [localId]: next }
    })
    s.emit('draw-extend', { id, point })
  }

  function sendDrawEnd({ id }) {
    const s = socketRef.current
    if (!s || !s.connected || !currentUser) return
    const localId = currentUser.socketId + ':' + id
    setLiveDrawables(prev => {
      const d = prev[localId]
      if (!d) return prev
      setDrawables(prevD => [...prevD, d])
      const { [localId]: _, ...rest } = prev
      return rest
    })
    setUndoStack(prev => [...prev, localId])
    setRedoStack([])
    s.emit('draw-end', { id })
  }

  function undo() {
    if (undoStack.length === 0) return
    const id = undoStack[undoStack.length - 1]
    const d = drawables.find(x => x.id === id)
    const s = socketRef.current
    if (!s || !s.connected) return
    setUndoStack(prev => prev.slice(0, -1))
    if (d) {
      setRedoStack(prev => [...prev, d])
      setDrawables(prev => prev.filter(x => x.id !== id))
    }
    s.emit('draw-undo', { id })
  }

  function redo() {
    if (redoStack.length === 0) return
    const d = redoStack[redoStack.length - 1]
    const s = socketRef.current
    if (!s || !s.connected) return
    setRedoStack(prev => prev.slice(0, -1))
    setUndoStack(prev => [...prev, d.id])
    setDrawables(prev => prev.some(x => x.id === d.id) ? prev : [...prev, d])
    s.emit('draw-redo', { drawable: d })
  }

  function startClearVote() {
    const s = socketRef.current
    if (!s || !s.connected) return
    setClearVote(prev => prev ? { ...prev, hasVoted: true } : prev)
    s.emit('clear-vote-start')
  }

  function respondClearVote(approve) {
    const s = socketRef.current
    if (!s || !s.connected) return
    setClearVote(prev => prev ? { ...prev, hasVoted: true } : prev)
    s.emit('clear-vote-respond', { approve: !!approve })
  }

  const leaveRoom = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect()
    }
    setRoomCode(null)
    setUsers([])
    setCurrentUser(null)
    setError(null)
    setRemoteCursors({})
    setDrawables([])
    setLiveDrawables({})
    setUndoStack([])
    setRedoStack([])
    setClearVote(null)
  }, [])

  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect()
        socketRef.current = null
      }
    }
  }, [])

  return (
    <Ctx.Provider value={{ roomCode, users, currentUser, error, connected, remoteCursors, drawables, liveDrawables, canUndo: undoStack.length > 0, canRedo: redoStack.length > 0, clearVote, createRoom, joinRoom, leaveRoom, sendCursor, sendTool, sendDrawStart, sendDrawExtend, sendDrawEnd, startClearVote, respondClearVote, undo, redo }}>
      {children}
    </Ctx.Provider>
  )
}
