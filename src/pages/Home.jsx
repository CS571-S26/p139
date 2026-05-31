import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Form, Button, Spinner } from 'react-bootstrap'
import { useSocket } from '../contexts/SocketContext'

export default function Home() {
  const nameRef = useRef(null)
  const codeRef = useRef(null)
  const [error, setError] = useState(null)
  const [isPublic, setIsPublic] = useState(false)
  const [creating, setCreating] = useState(false)
  const [joining, setJoining] = useState(false)
  const [joiningPublic, setJoiningPublic] = useState(false)
  const { roomCode, error: socketError, createRoom, joinRoom, joinPublicRoom } = useSocket()
  const navigate = useNavigate()

  useEffect(() => {
    if (roomCode) navigate('/board?room=' + roomCode)
  }, [roomCode, navigate])

  useEffect(() => {
    if (socketError) {
      setError(socketError)
      setCreating(false)
      setJoining(false)
      setJoiningPublic(false)
    }
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
    setCreating(true)
    createRoom(name, isPublic)
  }

  function handleJoin() {
    const name = nameRef.current?.value.trim()
    const code = codeRef.current?.value.trim()
    if (!name) { setError('Enter your name first.'); return }
    if (!code) { setError('Enter a room code.'); return }
    setError(null)
    setJoining(true)
    joinRoom(name, code.toUpperCase())
  }

  function handleJoinPublic() {
    const name = nameRef.current?.value.trim()
    if (!name) { setError('Enter your name first.'); return }
    setError(null)
    setJoiningPublic(true)
    joinPublicRoom(name)
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') handleJoin()
  }

  return (
    <>
      <div className="home">
        <div className="home-card">
          <div className="icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 3a2.85 2.85 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
            </svg>
          </div>
          <h1 className="h1">Draw together,<br /><span className="h1-accent">in real time.</span></h1>
          <p className="sub">Pick a name and start a room. No signup.</p>
          <Form className="form" onSubmit={(e) => { e.preventDefault(); handleCreate() }}>
            <Form.Group className="field" controlId="name-inp">
              <Form.Label className="lbl">Your name</Form.Label>
              <Form.Control
                ref={nameRef}
                className="inp"
                placeholder="e.g. Alex"
                maxLength={20}
                onChange={() => setError(null)}
              />
            </Form.Group>
            {error && <p className="form-error" role="alert">{error}</p>}

            <Button type="submit" className="btn btn-primary" onClick={handleCreate} disabled={creating}>
              {creating && (
                <Spinner
                  as="span"
                  animation="border"
                  size="sm"
                  role="status"
                  aria-hidden="true"
                  className="btn-spinner"
                />
              )}
              {creating ? 'Creating room…' : 'Create new room'}
            </Button>
            <Form.Check
              type="checkbox"
              id="make-public"
              className="check-row"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
              label="Make public — anyone can join"
            />

            <div className="or-divider"><span>or join existing</span></div>

            <div className="join-row">
              <Form.Label htmlFor="code-inp" className="sr-only">Room code</Form.Label>
              <Form.Control
                id="code-inp"
                ref={codeRef}
                className="inp inp-mono"
                placeholder="ABC123"
                maxLength={6}
                onKeyDown={handleKeyDown}
                onChange={() => setError(null)}
              />
              <Button type="button" variant="light" className="btn btn-ghost btn-loading-wrap" onClick={handleJoin} disabled={joining}>
                <span style={{ visibility: joining ? 'hidden' : 'visible' }}>Join</span>
                {joining && (
                  <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" className="btn-spinner-abs btn-spinner-dark" />
                )}
              </Button>
            </div>

            <Button type="button" variant="link" className="link-btn" onClick={handleJoinPublic} disabled={joiningPublic}>
              {joiningPublic && (
                <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" className="btn-spinner btn-spinner-dark" />
              )}
              {joiningPublic ? 'Finding a room…' : 'Drop into a random public room'}
            </Button>
          </Form>
        </div>
      </div>
    </>
  )
}
