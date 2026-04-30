import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSocket } from '../contexts/SocketContext'

export default function Home() {
  const nameRef = useRef(null)
  const codeRef = useRef(null)
  const [error, setError] = useState(null)
  const [isPublic, setIsPublic] = useState(false)
  const { roomCode, error: socketError, createRoom, joinRoom, joinPublicRoom } = useSocket()
  const navigate = useNavigate()

  useEffect(() => {
    if (roomCode) navigate('/board?room=' + roomCode)
  }, [roomCode, navigate])

  useEffect(() => {
    if (socketError) setError(socketError)
  }, [socketError])

  useEffect(() => {
    if (!error) return
    const t = setTimeout(() => setError(null), 4000)
    return () => clearTimeout(t)
  }, [error])

  function handleCreate() {
    const name = nameRef.current?.value.trim()
    if (!name) { setError('Enter your name first.'); return }
    setError(null)
    createRoom(name, isPublic)
  }

  function handleJoin() {
    const name = nameRef.current?.value.trim()
    const code = codeRef.current?.value.trim()
    if (!name) { setError('Enter your name first.'); return }
    if (!code) { setError('Enter a room code.'); return }
    setError(null)
    joinRoom(name, code.toUpperCase())
  }

  function handleJoinPublic() {
    const name = nameRef.current?.value.trim()
    if (!name) { setError('Enter your name first.'); return }
    setError(null)
    joinPublicRoom(name)
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') handleJoin()
  }

  return (
    <>
      <div className="home">
        <div className="home-card">
          <div className="icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 3a2.85 2.85 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
            </svg>
          </div>
          <h1 className="h1">Draw together,<br /><span className="h1-accent">in real time.</span></h1>
          <p className="sub">Pick a name and start a room. No signup.</p>
          <div className="form">
          <div className="field">
            <label htmlFor="name-inp" className="lbl">Your name</label>
            <input
              id="name-inp"
              ref={nameRef}
              className="inp"
              placeholder="e.g. Alex"
              maxLength={20}
              onChange={() => setError(null)}
            />
          </div>
          {error && <p className="form-error" role="alert">{error}</p>}

          <button className="btn btn-primary" onClick={handleCreate}>Create new room</button>
          <label className="check-row">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
            />
            <span>Make public — anyone can join</span>
          </label>

          <div className="or-divider"><span>or join existing</span></div>

          <div className="join-row">
            <label htmlFor="code-inp" className="sr-only">Room code</label>
            <input
              id="code-inp"
              ref={codeRef}
              className="inp inp-mono"
              placeholder="ABC123"
              maxLength={6}
              onKeyDown={handleKeyDown}
              onChange={() => setError(null)}
            />
            <button className="btn btn-ghost" onClick={handleJoin}>Join</button>
          </div>

          <button type="button" className="link-btn" onClick={handleJoinPublic}>
            Drop into a random public room
          </button>
          </div>
        </div>
      </div>
    </>
  )
}
