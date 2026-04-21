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
      s.on('room-created', ({ roomCode: code, user, users: u }) => {
        setRoomCode(code)
        setCurrentUser(user)
        setUsers(u)
        setError(null)
      })
      s.on('room-joined', ({ roomCode: code, user, users: u }) => {
        setRoomCode(code)
        setCurrentUser(user)
        setUsers(u)
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

  const leaveRoom = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect()
    }
    setRoomCode(null)
    setUsers([])
    setCurrentUser(null)
    setError(null)
    setRemoteCursors({})
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
    <Ctx.Provider value={{ roomCode, users, currentUser, error, connected, remoteCursors, createRoom, joinRoom, leaveRoom, sendCursor, sendTool }}>
      {children}
    </Ctx.Provider>
  )
}
