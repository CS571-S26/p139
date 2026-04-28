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
        <div className="icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 3a2.85 2.85 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
          </svg>
        </div>
        <h1 className="h1">Draw together, in real time.</h1>
        <p className="sub">Enter a name, then create a room or jump into a public one.</p>
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
            <div className="visibility-toggle" role="radiogroup" aria-label="Room visibility">
              <button
                type="button"
                className={'vis-opt' + (!isPublic ? ' active' : '')}
                onClick={() => setIsPublic(false)}
                aria-pressed={!isPublic}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" />
                  <path d="M7 11V7a5 5 0 0110 0v4" />
                </svg>
                Private
              </button>
              <button
                type="button"
                className={'vis-opt' + (isPublic ? ' active' : '')}
                onClick={() => setIsPublic(true)}
                aria-pressed={isPublic}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="2" y1="12" x2="22" y2="12" />
                  <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
                </svg>
                Public
              </button>
            </div>
            <button className="btn btn-primary" onClick={handleCreate}>Create Room</button>
            <button className="btn btn-secondary" onClick={handleJoinPublic}>Join Public Room</button>
            <div className="join-divider"><span>or</span></div>
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
