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
  const { roomCode, currentUser, sendCursor, sendTool, sendDrawStart, sendDrawExtend, sendDrawEnd, sendDrawableAdd, sendChat, setChatOpen: ctxSetChatOpen, drawables, liveDrawables, canUndo, canRedo, undo, redo, clearVote, startClearVote, respondClearVote, messages, unreadCount } = useSocket()
  const canvasRef = useRef(null)
  const wrapRef = useRef(null)
  const colorBtnRef = useRef(null)
  const shapesBtnRef = useRef(null)
  const fileInputRef = useRef(null)
  const lastSentRef = useRef(0)
  const lastExtendRef = useRef(0)
  const drawingIdRef = useRef(null)
  const chatInputRef = useRef(null)
  const chatScrollRef = useRef(null)
  const textOverlayRef = useRef(null)

  const [activeTool, setActiveTool] = useState('pen')
  const [activeColor, setActiveColor] = useState('#000000')
  const [strokeSize, setStrokeSize] = useState(3)
  const [shapesOpen, setShapesOpen] = useState(false)
  const [colorOpen, setColorOpen] = useState(false)
  const [canvasSize, setCanvasSize] = useState({ w: 0, h: 0 })
  const [textOverlay, setTextOverlay] = useState(null) // { x, y, value }
  const [chatOpen, setChatOpen] = useState(false)
  const [draftMsg, setDraftMsg] = useState('')
  const [dragOver, setDragOver] = useState(false)

  useEffect(() => {
    if (!textOverlay) return
    const t = requestAnimationFrame(() => textOverlayRef.current?.focus())
    return () => cancelAnimationFrame(t)
  }, [textOverlay])

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
    if (activeTool === 'text') {
      const wrapRect = wrapRef.current.getBoundingClientRect()
      const point = normalizedPoint(e)
      setTextOverlay({
        x: e.clientX - wrapRect.left,
        y: e.clientY - wrapRect.top,
        nx: point.nx,
        ny: point.ny,
        value: ''
      })
      sendCursor(point.nx, point.ny)
      return
    }
    if (activeTool === 'image') {
      // Image tool just opens the file picker
      fileInputRef.current?.click()
      return
    }
    e.currentTarget.setPointerCapture?.(e.pointerId)
    const point = normalizedPoint(e)
    const id = (crypto.randomUUID?.() || String(Date.now()) + Math.random())
    drawingIdRef.current = id
    lastExtendRef.current = 0
    sendCursor(point.nx, point.ny)
    sendDrawStart({ id, tool: activeTool, color: activeColor, size: strokeSize, point })
  }

  function handleCanvasPointerMove(e) {
    if (!drawingIdRef.current) return
    const now = performance.now()
    if (now - lastExtendRef.current < 16) return
    lastExtendRef.current = now
    const point = normalizedPoint(e)
    sendCursor(point.nx, point.ny)
    sendDrawExtend({ id: drawingIdRef.current, point })
  }

  function handleCanvasPointerUp(e) {
    if (!drawingIdRef.current) return
    // Capture final point if we haven't yet (short tap or throttled)
    const point = normalizedPoint(e)
    sendCursor(point.nx, point.ny)
    sendDrawExtend({ id: drawingIdRef.current, point })
    sendDrawEnd({ id: drawingIdRef.current })
    drawingIdRef.current = null
  }

  function commitTextOverlay() {
    if (!textOverlay) return
    const text = (textOverlay.value || '').trim()
    if (!text) { setTextOverlay(null); return }
    const id = (crypto.randomUUID?.() || String(Date.now()) + Math.random())
    sendDrawableAdd({
      id,
      tool: 'text',
      color: activeColor,
      size: strokeSize,
      points: [{ nx: textOverlay.nx, ny: textOverlay.ny }],
      text: text.slice(0, 500)
    })
    setTextOverlay(null)
  }

  // Compress an image file to a data URL within size limits
  async function fileToDataUrl(file, point = { nx: 0.2, ny: 0.2 }) {
    if (!file || !file.type.startsWith('image/')) return
    const dataUrl = await new Promise((resolve, reject) => {
      const r = new FileReader()
      r.onload = () => resolve(r.result)
      r.onerror = reject
      r.readAsDataURL(file)
    })
    const img = await new Promise((resolve, reject) => {
      const i = new Image()
      i.onload = () => resolve(i)
      i.onerror = reject
      i.src = dataUrl
    })
    const W = canvasSize.w, H = canvasSize.h
    if (!W || !H) return
    // Cap longest side to ~800px before serializing
    const MAX_SIDE = 800
    let dw = img.width, dh = img.height
    if (Math.max(dw, dh) > MAX_SIDE) {
      const s = MAX_SIDE / Math.max(dw, dh)
      dw = Math.round(dw * s); dh = Math.round(dh * s)
    }
    const off = document.createElement('canvas')
    off.width = dw; off.height = dh
    off.getContext('2d').drawImage(img, 0, 0, dw, dh)
    let outUrl = off.toDataURL('image/jpeg', 0.85)
    // If still too large, lower quality
    if (outUrl.length > 1_000_000) outUrl = off.toDataURL('image/jpeg', 0.7)
    if (outUrl.length > 1_100_000) return // give up — too big

    // Place: take up ~40% of canvas width, preserve aspect
    const targetW = 0.4
    const aspect = dh / dw
    const drawableW = targetW
    const drawableH = (targetW * (W / H)) * aspect
    const id = (crypto.randomUUID?.() || String(Date.now()) + Math.random())
    sendDrawableAdd({
      id,
      tool: 'image',
      color: '#000000',
      size: 1,
      points: [{ nx: Math.max(0, Math.min(1 - drawableW, point.nx)), ny: Math.max(0, Math.min(1 - drawableH, point.ny)) }],
      width: drawableW,
      height: drawableH,
      dataUrl: outUrl
    })
  }

  function handleFilePicked(e) {
    const file = e.target.files?.[0]
    if (file) fileToDataUrl(file)
    e.target.value = '' // allow re-picking same file
  }

  function handleDrop(e) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file && file.type.startsWith('image/')) {
      const rect = e.currentTarget.getBoundingClientRect()
      const point = {
        nx: (e.clientX - rect.left) / rect.width,
        ny: (e.clientY - rect.top) / rect.height
      }
      fileToDataUrl(file, point)
    }
  }

  // Paste image from clipboard
  useEffect(() => {
    function onPaste(e) {
      const items = e.clipboardData?.items
      if (!items) return
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile()
          if (file) fileToDataUrl(file)
          return
        }
      }
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  })

  // Keep context's chatOpen in sync (clears unread count)
  useEffect(() => { ctxSetChatOpen?.(chatOpen) }, [chatOpen, ctxSetChatOpen])

  // Auto-scroll chat to bottom on new message
  useEffect(() => {
    if (chatOpen && chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight
    }
  }, [messages, chatOpen])

  function submitChat(e) {
    e.preventDefault()
    if (!draftMsg.trim()) return
    sendChat(draftMsg)
    setDraftMsg('')
  }

  function fmtTime(ts) {
    try {
      const d = new Date(ts)
      return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    } catch { return '' }
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

  function handleExportPng() {
    const c = canvasRef.current
    if (!c || !c.width || !c.height) return
    const out = document.createElement('canvas')
    out.width = c.width
    out.height = c.height
    const ctx = out.getContext('2d')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, out.width, out.height)
    ctx.drawImage(c, 0, 0)
    out.toBlob((blob) => {
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `drawboard-${roomCode || 'canvas'}-${Date.now()}.png`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    }, 'image/png')
  }

  const isShapeTool = ['rect', 'circle', 'line', 'triangle', 'arrow', 'star'].includes(activeTool)
  const isInitiator = clearVote && currentUser && clearVote.initiatorSocketId === currentUser.socketId

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
            className={'tool-btn' + (activeTool === 'text' ? ' active' : '')}
            onClick={() => setActiveTool('text')}
            title="Text"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="4 7 4 4 20 4 20 7" /><line x1="9" y1="20" x2="15" y2="20" /><line x1="12" y1="4" x2="12" y2="20" />
            </svg>
          </button>

          <button
            ref={shapesBtnRef}
            className={'tool-btn' + (isShapeTool ? ' active' : '')}
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
              <button className="shape-opt" onClick={() => { setActiveTool('triangle'); setShapesOpen(false) }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"><path d="M12 4 L4 20 L20 20 Z" /></svg>
                Triangle
              </button>
              <button className="shape-opt" onClick={() => { setActiveTool('arrow'); setShapesOpen(false) }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="20" x2="20" y2="4" /><polyline points="13 4 20 4 20 11" /></svg>
                Arrow
              </button>
              <button className="shape-opt" onClick={() => { setActiveTool('star'); setShapesOpen(false) }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"><polygon points="12 2 14.6 9 22 9 16 13.5 18.2 21 12 16.5 5.8 21 8 13.5 2 9 9.4 9" /></svg>
                Star
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

          <div className="tool-divider" />

          <button
            className={'tool-btn' + (clearVote ? ' disabled' : '')}
            title="Clear canvas"
            onClick={startClearVote}
            disabled={!!clearVote}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
              <path d="M10 11v6" /><path d="M14 11v6" />
              <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
            </svg>
          </button>
          <button
            className="tool-btn"
            title="Export as PNG"
            onClick={handleExportPng}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </button>
          <button
            className="tool-btn"
            title="Insert image"
            onClick={() => fileInputRef.current?.click()}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
          </button>

          <div className="tool-divider" />

          <button
            className={'tool-btn chat-btn' + (chatOpen ? ' active' : '')}
            title="Chat"
            onClick={() => setChatOpen(v => !v)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
            </svg>
            {!chatOpen && unreadCount > 0 && <span className="chat-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleFilePicked}
          />
        </div>

        <div
          ref={wrapRef}
          className={'board-canvas-wrap tool-' + activeTool + (dragOver ? ' drag-over' : '')}
          onPointerMove={handlePointerMove}
          onPointerLeave={handlePointerLeave}
          onDragEnter={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragOver={(e) => { e.preventDefault() }}
          onDragLeave={(e) => { if (e.target === e.currentTarget) setDragOver(false) }}
          onDrop={handleDrop}
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
          {textOverlay && (
            <input
              ref={textOverlayRef}
              className="text-overlay"
              style={{ left: textOverlay.x, top: textOverlay.y, color: activeColor, fontSize: Math.max(strokeSize * 4, 14) }}
              value={textOverlay.value}
              autoFocus
              type="text"
              onPointerDown={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => setTextOverlay(o => o ? { ...o, value: e.target.value } : o)}
              onKeyDown={(e) => {
                e.stopPropagation()
                if (e.key === 'Enter') { e.preventDefault(); commitTextOverlay() }
                else if (e.key === 'Escape') { setTextOverlay(null) }
              }}
              onBlur={commitTextOverlay}
              placeholder="Type here…"
            />
          )}
          {drawables.length === 0 && Object.keys(liveDrawables).length === 0 && !textOverlay && (
            <span className="board-overlay-text">Select a tool and start drawing</span>
          )}
          {clearVote && (
            <div className="clear-vote-banner" role="dialog" aria-live="polite">
              <div className="clear-vote-text">
                <strong>{clearVote.initiatorName}</strong>
                {isInitiator ? ' is asking to clear the canvas' : ' wants to clear the canvas'}
                <span className="clear-vote-count"> ({clearVote.approvals}/{clearVote.threshold})</span>
              </div>
              {!isInitiator && !clearVote.hasVoted && (
                <div className="clear-vote-actions">
                  <button className="clear-vote-btn approve" onClick={() => respondClearVote(true)}>Approve</button>
                  <button className="clear-vote-btn reject" onClick={() => respondClearVote(false)}>Reject</button>
                </div>
              )}
              {(isInitiator || clearVote.hasVoted) && (
                <div className="clear-vote-actions">
                  <button className="clear-vote-btn reject" onClick={() => respondClearVote(false)}>Cancel</button>
                </div>
              )}
            </div>
          )}
          <RemoteCursors width={canvasSize.w} height={canvasSize.h} />
        </div>

        {chatOpen && (
          <aside className="chat-panel" aria-label="Room chat">
            <header className="chat-header">
              <span>Chat</span>
              <button className="chat-close" onClick={() => setChatOpen(false)} aria-label="Close chat">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="6" y1="6" x2="18" y2="18" /><line x1="6" y1="18" x2="18" y2="6" />
                </svg>
              </button>
            </header>
            <div className="chat-messages" ref={chatScrollRef}>
              {messages.length === 0 && (
                <div className="chat-empty">No messages yet. Say hi.</div>
              )}
              {messages.map((m, i) => (
                <div key={i} className={'chat-msg' + (m.socketId === currentUser?.socketId ? ' me' : '')}>
                  <div className="chat-msg-meta">
                    <span className="chat-msg-name" style={{ color: m.color }}>{m.name}</span>
                    <span className="chat-msg-time">{fmtTime(m.timestamp)}</span>
                  </div>
                  <div className="chat-msg-text">{m.text}</div>
                </div>
              ))}
            </div>
            <form className="chat-input-row" onSubmit={submitChat}>
              <input
                ref={chatInputRef}
                className="chat-input"
                type="text"
                placeholder="Send a message"
                value={draftMsg}
                onChange={(e) => setDraftMsg(e.target.value)}
                maxLength={400}
              />
              <button type="submit" className="chat-send-btn" disabled={!draftMsg.trim()} aria-label="Send">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            </form>
          </aside>
        )}
      </div>
    </div>
  )
}
