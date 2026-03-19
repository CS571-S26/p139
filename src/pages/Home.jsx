import AuroraBackground from '../components/AuroraBackground'
import BackgroundAnimation from '../components/BackgroundAnimation'

export default function Home() {
  return (
    <>
      <AuroraBackground />
      <BackgroundAnimation />
      <div className="home">
        <div className="icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 3a2.85 2.85 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
          </svg>
        </div>
        <h1 className="h1">Draw together, in real time.</h1>
        <p className="sub">Enter a name, then create a new room or join one with a code.</p>
        <div className="form">
          <input className="inp" placeholder="Your name" maxLength={20} aria-label="Your name" />
          <div className="action-section">
            <button className="btn btn-primary">Create Room</button>
            <div className="join-row">
              <input className="inp inp-mono" placeholder="Room code" maxLength={6} aria-label="Room code" />
              <button className="btn btn-ghost">Join</button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
