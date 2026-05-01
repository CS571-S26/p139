import { useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { Nav, Button } from 'react-bootstrap'
import { useSocket } from '../contexts/SocketContext'

export default function Navbar() {
  const location = useLocation()
  const navigate = useNavigate()
  const onBoard = location.pathname === '/board'
  const { roomCode, users, currentUser, leaveRoom } = useSocket()
  const [copied, setCopied] = useState(false)

  function handleLeave() {
    leaveRoom()
    navigate('/')
  }

  function copyCode() {
    if (!roomCode) return
    navigator.clipboard.writeText(roomCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <nav>
      <NavLink to="/" className="nav-l" end>
        <div className="logo" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 3a2.85 2.85 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
          </svg>
        </div>
        <span className="brand">Drawboard</span>
      </NavLink>

      {onBoard && roomCode ? (
        <div className="nav-board-info">
          <button className="nav-room-pill" onClick={copyCode} title="Copy room code">
            <span className="nav-room-label">Room</span>
            <span className="nav-room-code">{roomCode}</span>
            <svg className="nav-copy-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {copied
                ? <polyline points="20 6 9 17 4 12" />
                : <><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></>
              }
            </svg>
          </button>
          {users.map(u => (
            <span key={u.socketId} className="nav-user" title={u.name}>
              <span className="nav-udot" style={{ background: u.color }} />
              {u.name}
            </span>
          ))}
        </div>
      ) : (
        <Nav as="div" className="nav-m">
          <NavLink to="/" end className={({ isActive }) => `nl${isActive ? ' on' : ''}`}>
            Home
          </NavLink>
          <NavLink to="/about" className={({ isActive }) => `nl${isActive ? ' on' : ''}`}>
            About
          </NavLink>
          <NavLink to="/feedback" className={({ isActive }) => `nl${isActive ? ' on' : ''}`}>
            Feedback
          </NavLink>
          {roomCode && (
            <NavLink to="/board" className={({ isActive }) => `nl${isActive ? ' on' : ''}`}>
              Board
            </NavLink>
          )}
        </Nav>
      )}

      <div className="nav-r">
        {onBoard && roomCode && (
          <Button variant="outline-light" className="btn-leave" onClick={handleLeave}>Leave</Button>
        )}
      </div>
    </nav>
  )
}
