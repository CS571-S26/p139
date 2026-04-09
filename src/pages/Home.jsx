import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSocket } from '../contexts/SocketContext'

export default function Home() {
  const nameRef = useRef(null)
  const codeRef = useRef(null)
  const [error, setError] = useState(null)
  const { roomCode, error: socketError, createRoom, joinRoom } = useSocket()
  const navigate = useNavigate()

  useEffect(() => {
    if (roomCode) navigate('/board?room=' + roomCode)
  }, [roomCode, navigate])

  useEffect(() => {
    if (socketError) setError(socketError)
  }, [socketError])

  useEffect(() => {
    if (!error) return
    const t = setTimeout(() => setError(null), 3000)
    return () => clearTimeout(t)
  }, [error])

  function handleCreate() {
    const name = nameRef.current?.value.trim()
    if (!name) { setError('Enter your name first.'); return }
    setError(null)
    createRoom(name)
  }

  function handleJoin() {
    const name = nameRef.current?.value.trim()
    const code = codeRef.current?.value.trim()
    if (!name) { setError('Enter your name first.'); return }
    if (!code) { setError('Enter a room code.'); return }
    setError(null)
    joinRoom(name, code.toUpperCase())
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') handleJoin()
  }

  return (
    <>
      <div className="home">
        <div className="icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 3a2.85 2.85 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
          </svg>
        </div>
        <h1 className="h1">Draw together, in real time.</h1>
        <p className="sub">Enter a name, then create a new room or join one with a code.</p>
        <div className="form">
          <input
            ref={nameRef}
            className="inp"
            placeholder="Your name"
            maxLength={20}
            aria-label="Your name"
            onChange={() => setError(null)}
          />
          {error && <p className="form-error">{error}</p>}
          <div className="action-section">
            <button className="btn btn-primary" onClick={handleCreate}>Create Room</button>
            <div className="join-row">
              <input
                ref={codeRef}
                className="inp inp-mono"
                placeholder="Room code"
                maxLength={6}
                aria-label="Room code"
                onKeyDown={handleKeyDown}
                onChange={() => setError(null)}
              />
              <button className="btn btn-ghost" onClick={handleJoin}>Join</button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
