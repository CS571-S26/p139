import { useState, useRef, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useSocket } from '../contexts/SocketContext'

const PRESETS = ['#000000', '#f5715b', '#f5d45b', '#5bf5a3', '#5b8af5', '#c45bf5']

export default function Board() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { roomCode } = useSocket()
  const canvasRef = useRef(null)
  const colorRef = useRef(null)

  const [activeTool, setActiveTool] = useState('pen')
  const [activeColor, setActiveColor] = useState('#000000')
  const [strokeSize, setStrokeSize] = useState(3)
  const [shapesOpen, setShapesOpen] = useState(false)

  const roomParam = params.get('room')
  useEffect(() => {
    if (!roomParam || (!roomCode && !roomParam)) navigate('/')
  }, [roomParam, roomCode, navigate])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const wrap = canvas.parentElement
    const ro = new ResizeObserver(([entry]) => {
      canvas.width = entry.contentRect.width
      canvas.height = entry.contentRect.height
    })
    ro.observe(wrap)
    return () => ro.disconnect()
  }, [])

  return (
    <div className="board-page">
      <div className="board-body">
        <div className="board-toolbar">
          <button
            className={'tool-btn' + (activeTool === 'pen' ? ' active' : '')}
            onClick={() => setActiveTool('pen')}
            title="Pen"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 3a2.85 2.85 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
            </svg>
          </button>
          <button
            className={'tool-btn' + (activeTool === 'eraser' ? ' active' : '')}
            onClick={() => setActiveTool('eraser')}
            title="Eraser"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 20H7L3 16l9-9 8 8-4 5z" /><path d="M6 11l8 8" />
            </svg>
          </button>

          <div className="shapes-wrap">
            <button
              className={'tool-btn' + (activeTool === 'rect' || activeTool === 'circle' || activeTool === 'line' ? ' active' : '')}
              onClick={() => setShapesOpen(!shapesOpen)}
              title="Shapes"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="14" cy="10" r="7" /><rect x="3" y="11" width="10" height="10" rx="1" />
              </svg>
            </button>
            {shapesOpen && (
              <div className="shapes-popover">
                <button className="shape-opt" onClick={() => { setActiveTool('rect'); setShapesOpen(false) }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="5" width="18" height="14" rx="1" /></svg>
                  Rectangle
                </button>
                <button className="shape-opt" onClick={() => { setActiveTool('circle'); setShapesOpen(false) }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /></svg>
                  Circle
                </button>
                <button className="shape-opt" onClick={() => { setActiveTool('line'); setShapesOpen(false) }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="19" x2="19" y2="5" /></svg>
                  Line
                </button>
              </div>
            )}
          </div>

          <div className="tool-divider" />

          {/* Color picker */}
          <button
            className="color-picker-btn"
            style={{ background: activeColor }}
            onClick={() => colorRef.current?.click()}
            title="Pick color"
          />
          <input
            ref={colorRef}
            type="color"
            className="color-input-hidden"
            value={activeColor}
            onChange={e => setActiveColor(e.target.value)}
          />
          <div className="preset-row">
            {PRESETS.map(c => (
              <button
                key={c}
                className={'color-preset' + (activeColor === c ? ' active' : '')}
                style={{ background: c }}
                onClick={() => setActiveColor(c)}
              />
            ))}
          </div>

          <div className="tool-divider" />

          {/* Stroke size */}
          <span className="size-label">{strokeSize}px</span>
          <input
            type="range"
            className="stroke-slider"
            min={1}
            max={12}
            value={strokeSize}
            onChange={e => setStrokeSize(+e.target.value)}
            title={'Size: ' + strokeSize}
          />
          <div
            className="stroke-preview"
            style={{ width: Math.max(strokeSize, 4), height: Math.max(strokeSize, 4) }}
          />

          <div className="tool-divider" />

          <button className="tool-btn disabled" title="Undo" disabled>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 102.13-9.36L1 10" />
            </svg>
          </button>
          <button className="tool-btn disabled" title="Redo" disabled>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 11-2.13-9.36L23 10" />
            </svg>
          </button>
        </div>

        <div className="board-canvas-wrap">
          <canvas ref={canvasRef} />
          <span className="board-overlay-text">Select a tool and start drawing</span>
        </div>
      </div>
    </div>
  )
}
