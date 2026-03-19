import { NavLink } from 'react-router-dom'

export default function Navbar() {
  return (
    <nav>
      <NavLink to="/" className="nav-l" end>
        <div className="logo">
          <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 3a2.85 2.85 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
          </svg>
        </div>
        <span className="brand">Drawboard</span>
      </NavLink>

      <div className="nav-m">
        <NavLink to="/" end className={({ isActive }) => `nl${isActive ? ' on' : ''}`}>
          Home
        </NavLink>
        <NavLink to="/about" className={({ isActive }) => `nl${isActive ? ' on' : ''}`}>
          About
        </NavLink>
      </div>

      <div className="nav-r" />
    </nav>
  )
}
