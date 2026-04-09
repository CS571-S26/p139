export default function About() {
  return (
    <div className="about">
      <h1 className="h1">About Drawboard</h1>
      <p className="sub">
        A collaborative whiteboard for sketching and brainstorming in real time.
        No sign-up required.
      </p>

      <div className="about-grid">
        <div className="about-card">
          <div className="about-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
          </div>
          <h3 className="about-card-title">Draw freely</h3>
          <p className="about-card-text">
            Pen, shapes, and eraser on an infinite canvas.
          </p>
        </div>

        <div className="about-card">
          <div className="about-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4-4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" />
            </svg>
          </div>
          <h3 className="about-card-title">Real-time sync</h3>
          <p className="about-card-text">
            Share a room code and see every stroke as it happens.
          </p>
        </div>

        <div className="about-card">
          <div className="about-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0110 0v4" />
            </svg>
          </div>
          <h3 className="about-card-title">No account needed</h3>
          <p className="about-card-text">
            Pick a name, join a room, and start drawing.
          </p>
        </div>
      </div>

      <div className="about-tech">
        <h2 className="about-section-title">Built with</h2>
        <div className="tech-tags">
          <span className="tech-tag">React</span>
          <span className="tech-tag">Vite</span>
          <span className="tech-tag">Tailwind CSS</span>
          <span className="tech-tag">WebSockets</span>
          <span className="tech-tag">Canvas API</span>
        </div>
      </div>
    </div>
  )
}
