import { useSocket } from '../contexts/SocketContext'
import ToolIcon from './ToolIcon'

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
        const left = pos.nx * width
        const top = pos.ny * height
        return (
          <div
            key={socketId}
            className="remote-cursor"
            style={{ left, top, color: user.color }}
          >
            <div className="rc-icon">
              <ToolIcon tool={user.tool || 'pen'} />
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
