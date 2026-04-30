import { useSocket } from '../contexts/SocketContext'
import ToolIcon from './ToolIcon'

const HOTSPOTS = {
  pen: { x: 2, y: 20 },
  eraser: { x: 3, y: 17 },
  rect: { x: 11, y: 11 },
  circle: { x: 11, y: 11 },
  line: { x: 11, y: 11 },
  triangle: { x: 11, y: 11 },
  arrow: { x: 11, y: 11 },
  star: { x: 11, y: 11 },
  text: { x: 11, y: 11 },
  image: { x: 11, y: 11 }
}

export default function RemoteCursors({ width, height }) {
  const { users, currentUser, remoteCursors } = useSocket()
  if (!width || !height) return null

  const byId = new Map(users.map(u => [u.socketId, u]))

  return (
    <div className="remote-cursors-layer">
      {Object.entries(remoteCursors).map(([socketId, pos]) => {
        if (currentUser && socketId === currentUser.socketId) return null
        const user = byId.get(socketId)
        if (!user) return null
        if (pos.nx < 0 || pos.nx > 1 || pos.ny < 0 || pos.ny > 1) return null
        const tool = user.tool || 'pen'
        const hotspot = HOTSPOTS[tool] || HOTSPOTS.pen
        const left = pos.nx * width
        const top = pos.ny * height
        return (
          <div
            key={socketId}
            className="remote-cursor"
            style={{
              left,
              top,
              color: user.color,
              '--hotspot-x': `${hotspot.x}px`,
              '--hotspot-y': `${hotspot.y}px`
            }}
          >
            <div className="rc-icon">
              <ToolIcon tool={tool} />
            </div>
            <div className="rc-label" style={{ background: user.color }}>
              {user.name}
            </div>
          </div>
        )
      })}
    </div>
  )
}
