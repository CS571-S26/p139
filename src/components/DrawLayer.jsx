import { forwardRef, useEffect, useRef } from 'react'
import { useSocket } from '../contexts/SocketContext'

function drawDrawable(ctx, d, W, H) {
  if (!d.points || d.points.length === 0) return
  const px = (n) => n * W, py = (n) => n * H
  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.lineWidth = d.size

  if (d.tool === 'eraser') {
    ctx.globalCompositeOperation = 'destination-out'
    ctx.strokeStyle = '#000'
    ctx.fillStyle = '#000'
    ctx.lineWidth = Math.max(d.size * 2, 8)
  } else {
    ctx.strokeStyle = d.color
    ctx.fillStyle = d.color
  }

  if (d.tool === 'pen' || d.tool === 'eraser') {
    if (d.points.length === 1) {
      const r = Math.max(ctx.lineWidth / 2, 1)
      ctx.beginPath()
      ctx.arc(px(d.points[0].nx), py(d.points[0].ny), r, 0, Math.PI * 2)
      ctx.fill()
    } else {
      ctx.beginPath()
      ctx.moveTo(px(d.points[0].nx), py(d.points[0].ny))
      if (d.points.length === 2) {
        ctx.lineTo(px(d.points[1].nx), py(d.points[1].ny))
      } else {
        for (let i = 1; i < d.points.length - 1; i++) {
          const cx = px(d.points[i].nx), cy = py(d.points[i].ny)
          const nx2 = px(d.points[i + 1].nx), ny2 = py(d.points[i + 1].ny)
          const mx = (cx + nx2) / 2, my = (cy + ny2) / 2
          ctx.quadraticCurveTo(cx, cy, mx, my)
        }
        const last = d.points[d.points.length - 1]
        ctx.lineTo(px(last.nx), py(last.ny))
      }
      ctx.stroke()
    }
  } else if (d.points.length >= 2) {
    const [a, b] = d.points
    const ax = px(a.nx), ay = py(a.ny)
    const bx = px(b.nx), by = py(b.ny)
    if (d.tool === 'rect') {
      ctx.strokeRect(Math.min(ax, bx), Math.min(ay, by), Math.abs(bx - ax), Math.abs(by - ay))
    } else if (d.tool === 'circle') {
      const cx = (ax + bx) / 2, cy = (ay + by) / 2
      const rx = Math.abs(bx - ax) / 2, ry = Math.abs(by - ay) / 2
      ctx.beginPath()
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
      ctx.stroke()
    } else if (d.tool === 'line') {
      ctx.beginPath()
      ctx.moveTo(ax, ay)
      ctx.lineTo(bx, by)
      ctx.stroke()
    } else if (d.tool === 'triangle') {
      const left = Math.min(ax, bx), right = Math.max(ax, bx)
      const top = Math.min(ay, by), bottom = Math.max(ay, by)
      const midX = (left + right) / 2
      ctx.beginPath()
      ctx.moveTo(midX, top)
      ctx.lineTo(left, bottom)
      ctx.lineTo(right, bottom)
      ctx.closePath()
      ctx.stroke()
    } else if (d.tool === 'arrow') {
      const angle = Math.atan2(by - ay, bx - ax)
      const headLen = Math.max(d.size * 4, 10)
      ctx.beginPath()
      ctx.moveTo(ax, ay)
      ctx.lineTo(bx, by)
      ctx.lineTo(
        bx - headLen * Math.cos(angle - Math.PI / 6),
        by - headLen * Math.sin(angle - Math.PI / 6)
      )
      ctx.moveTo(bx, by)
      ctx.lineTo(
        bx - headLen * Math.cos(angle + Math.PI / 6),
        by - headLen * Math.sin(angle + Math.PI / 6)
      )
      ctx.stroke()
    } else if (d.tool === 'star') {
      const cx = (ax + bx) / 2, cy = (ay + by) / 2
      const R = Math.min(Math.abs(bx - ax), Math.abs(by - ay)) / 2
      if (R > 0) {
        const r = R * 0.4
        ctx.beginPath()
        for (let i = 0; i < 10; i++) {
          const radius = i % 2 === 0 ? R : r
          const theta = -Math.PI / 2 + (i * Math.PI) / 5
          const x = cx + radius * Math.cos(theta)
          const y = cy + radius * Math.sin(theta)
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
        }
        ctx.closePath()
        ctx.stroke()
      }
    }
  }
  ctx.restore()
}

const DrawLayer = forwardRef(function DrawLayer({ width, height, ...handlers }, ref) {
  const internalRef = useRef(null)
  const canvasRef = ref || internalRef
  const { drawables, liveDrawables } = useSocket()

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width
      canvas.height = height
    }
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, width, height)
    for (const d of drawables) drawDrawable(ctx, d, width, height)
    for (const id in liveDrawables) drawDrawable(ctx, liveDrawables[id], width, height)
  }, [drawables, liveDrawables, width, height, canvasRef])

  return <canvas ref={canvasRef} {...handlers} />
})

export default DrawLayer
