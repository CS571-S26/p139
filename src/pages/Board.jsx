import { useState, useRef, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useSocket } from '../contexts/SocketContext'
import RemoteCursors from '../components/RemoteCursors'
import DrawLayer from '../components/DrawLayer'
import AnchoredPopover from '../components/AnchoredPopover'
import ColorPicker from '../components/ColorPicker'

const PRESETS = ['#000000', '#f5715b', '#f5d45b', '#5bf5a3', '#5b8af5', '#c45bf5']

export default function Board() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { roomCode, sendCursor, sendTool, sendDrawStart, sendDrawExtend, sendDrawEnd, drawables, liveDrawables, canUndo, canRedo, undo, redo } = useSocket()
  const canvasRef = useRef(null)
  const wrapRef = useRef(null)
  const colorBtnRef = useRef(null)
  const shapesBtnRef = useRef(null)
  const lastSentRef = useRef(0)
  const lastExtendRef = useRef(0)
  const drawingIdRef = useRef(null)

  const [activeTool, setActiveTool] = useState('pen')
  const [activeColor, setActiveColor] = useState('#000000')
  const [strokeSize, setStrokeSize] = useState(3)
  const [shapesOpen, setShapesOpen] = useState(false)
  const [colorOpen, setColorOpen] = useState(false)
  const [canvasSize, setCanvasSize] = useState({ w: 0, h: 0 })

  const roomParam = params.get('room')
  useEffect(() => {
    if (!roomParam || (!roomCode && !roomParam)) navigate('/')
  }, [roomParam, roomCode, navigate])

  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    const ro = new ResizeObserver(([entry]) => {
      setCanvasSize({ w: entry.contentRect.width, h: entry.contentRect.height })
    })
    ro.observe(wrap)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    sendTool(activeTool)
  }, [activeTool, sendTool])

  function handlePointerMove(e) {
    const now = performance.now()
    if (now - lastSentRef.current < 33) return
    lastSentRef.current = now
    const rect = e.currentTarget.getBoundingClientRect()
    const nx = (e.clientX - rect.left) / rect.width
    const ny = (e.clientY - rect.top) / rect.height
    if (nx < 0 || nx > 1 || ny < 0 || ny > 1) return
    sendCursor(nx, ny)
  }

  function handlePointerLeave() {
    lastSentRef.current = 0
    sendCursor(-1, -1)
  }

  function normalizedPoint(e) {
    const rect = e.currentTarget.getBoundingClientRect()
    let nx = (e.clientX - rect.left) / rect.width
    let ny = (e.clientY - rect.top) / rect.height
    if (nx < 0) nx = 0; if (nx > 1) nx = 1
    if (ny < 0) ny = 0; if (ny > 1) ny = 1
    return { nx, ny }
  }

  function handleCanvasPointerDown(e) {
    if (e.button !== 0) return
    e.currentTarget.setPointerCapture?.(e.pointerId)
    const point = normalizedPoint(e)
    const id = (crypto.randomUUID?.() || String(Date.now()) + Math.random())
    drawingIdRef.current = id
    lastExtendRef.current = 0
    sendDrawStart({ id, tool: activeTool, color: activeColor, size: strokeSize, point })
  }

  function handleCanvasPointerMove(e) {
    if (!drawingIdRef.current) return
    const now = performance.now()
    if (now - lastExtendRef.current < 16) return
    lastExtendRef.current = now
    sendDrawExtend({ id: drawingIdRef.current, point: normalizedPoint(e) })
  }

  function handleCanvasPointerUp(e) {
    if (!drawingIdRef.current) return
    // Capture final point if we haven't yet (short tap or throttled)
    sendDrawExtend({ id: drawingIdRef.current, point: normalizedPoint(e) })
    sendDrawEnd({ id: drawingIdRef.current })
    drawingIdRef.current = null
  }

  useEffect(() => {
    function onKey(e) {
      const tag = e.target.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      const mod = e.ctrlKey || e.metaKey
      if (!mod) return
      if (e.key === 'z' && !e.shiftKey) {
        e.preventDefault(); undo()
      } else if ((e.key === 'z' && e.shiftKey) || e.key === 'y') {
        e.preventDefault(); redo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, redo])

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

          <button
            ref={shapesBtnRef}
            className={'tool-btn' + (activeTool === 'rect' || activeTool === 'circle' || activeTool === 'line' ? ' active' : '')}
            onClick={() => setShapesOpen(v => !v)}
            title="Shapes"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="14" cy="10" r="7" /><rect x="3" y="11" width="10" height="10" rx="1" />
            </svg>
          </button>
          <AnchoredPopover anchorRef={shapesBtnRef} open={shapesOpen} onClose={() => setShapesOpen(false)}>
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
          </AnchoredPopover>

          <div className="tool-divider" />

          {/* Color picker */}
          <button
            ref={colorBtnRef}
            className="color-picker-btn"
            style={{ background: activeColor }}
            onClick={() => setColorOpen(v => !v)}
            title="Pick color"
          />
          <AnchoredPopover anchorRef={colorBtnRef} open={colorOpen} onClose={() => setColorOpen(false)}>
            <ColorPicker
              value={activeColor}
              onChange={(c) => setActiveColor(c)}
              onClose={() => setColorOpen(false)}
            />
          </AnchoredPopover>
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
          <div className="stroke-preview-slot">
            <div
              className="stroke-preview"
              style={{ width: strokeSize, height: strokeSize }}
            />
          </div>

          <div className="tool-divider" />

          <button
            className={'tool-btn' + (canUndo ? '' : ' disabled')}
            title="Undo (Cmd/Ctrl+Z)"
            onClick={undo}
            disabled={!canUndo}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 102.13-9.36L1 10" />
            </svg>
          </button>
          <button
            className={'tool-btn' + (canRedo ? '' : ' disabled')}
            title="Redo (Cmd/Ctrl+Shift+Z)"
            onClick={redo}
            disabled={!canRedo}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 11-2.13-9.36L23 10" />
            </svg>
          </button>
        </div>

        <div
          ref={wrapRef}
          className={'board-canvas-wrap tool-' + activeTool}
          onPointerMove={handlePointerMove}
          onPointerLeave={handlePointerLeave}
        >
          <DrawLayer
            ref={canvasRef}
            width={canvasSize.w}
            height={canvasSize.h}
            onPointerDown={handleCanvasPointerDown}
            onPointerMove={handleCanvasPointerMove}
            onPointerUp={handleCanvasPointerUp}
            onPointerCancel={handleCanvasPointerUp}
          />
          {drawables.length === 0 && Object.keys(liveDrawables).length === 0 && (
            <span className="board-overlay-text">Select a tool and start drawing</span>
          )}
          <RemoteCursors width={canvasSize.w} height={canvasSize.h} />
        </div>
      </div>
    </div>
  )
}
