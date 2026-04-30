import { useState, useRef, useEffect, useCallback } from 'react'
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
  const { roomCode, currentUser, sendCursor, sendTool, sendDrawStart, sendDrawExtend, sendDrawEnd, sendDrawableAdd, sendDrawableUpdate, sendDrawableDelete, sendChat, setChatOpen: ctxSetChatOpen, drawables, liveDrawables, canUndo, canRedo, undo, redo, clearVote, startClearVote, respondClearVote, messages, unreadCount } = useSocket()
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
  const textFocusTimerRef = useRef(null)
  const textIgnoreBlurUntilRef = useRef(0)
  const textJustCommittedRef = useRef(false)
  const textJustCommittedTimerRef = useRef(null)
  const textOverlayResizeRef = useRef(null)
  const textOverlayResizeCleanupRef = useRef(null)
  const imageAspectCacheRef = useRef(new Map())
  const transformRef = useRef(null)
  const transformCleanupRef = useRef(null)
  const marqueeRef = useRef(null)
  const marqueeCleanupRef = useRef(null)

  const [activeTool, setActiveTool] = useState('pen')
  const [activeColor, setActiveColor] = useState('#000000')
  const [strokeSize, setStrokeSize] = useState(3)
  const [shapesOpen, setShapesOpen] = useState(false)
  const [colorOpen, setColorOpen] = useState(false)
  const [canvasSize, setCanvasSize] = useState({ w: 0, h: 0 })
  const [textOverlay, setTextOverlay] = useState(null) // { x, y, value }
  const [selectedDrawableIds, setSelectedDrawableIds] = useState([])
  const [selectionRect, setSelectionRect] = useState(null)
  const [, setImageAspectVersion] = useState(0)
  const [chatOpen, setChatOpen] = useState(false)
  const [draftMsg, setDraftMsg] = useState('')
  const [dragOver, setDragOver] = useState(false)

  useEffect(() => {
    if (!textOverlay) return
    const focusOverlay = () => {
      const el = textOverlayRef.current
      if (!el) return
      el.focus({ preventScroll: true })
      el.setSelectionRange?.(el.value.length, el.value.length)
    }
    focusOverlay()
    const raf = requestAnimationFrame(focusOverlay)
    textFocusTimerRef.current = setTimeout(focusOverlay, 80)
    return () => {
      cancelAnimationFrame(raf)
      if (textFocusTimerRef.current) clearTimeout(textFocusTimerRef.current)
    }
  }, [textOverlay])

  useEffect(() => {
    return () => {
      transformCleanupRef.current?.()
      marqueeCleanupRef.current?.()
      textOverlayResizeCleanupRef.current?.()
      if (textFocusTimerRef.current) clearTimeout(textFocusTimerRef.current)
      if (textJustCommittedTimerRef.current) clearTimeout(textJustCommittedTimerRef.current)
    }
  }, [])

  const roomParam = params.get('room')?.toUpperCase() || ''
  const hasJoinedRoom = !!roomParam && !!roomCode && !!currentUser && roomCode === roomParam
  useEffect(() => {
    if (!hasJoinedRoom) navigate('/', { replace: true })
  }, [hasJoinedRoom, navigate])

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

  useEffect(() => {
    setSelectedDrawableIds(ids => {
      const next = ids.filter(id => drawables.some(d => d.id === id))
      return next.length === ids.length ? ids : next
    })
  }, [drawables])

  const selectedIdSet = new Set(selectedDrawableIds)
  const selectedDrawables = drawables.filter(d => selectedIdSet.has(d.id))
  const selectedDrawable = selectedDrawables.length === 1 ? selectedDrawables[0] : null
  const selectedEditableText = selectedDrawable?.tool === 'text' && selectedDrawable.socketId === currentUser?.socketId
  const activeSize = textOverlay ? (textOverlay.size || strokeSize) : selectedEditableText ? (selectedDrawable.size || strokeSize) : strokeSize

  function clamp(n, min, max) {
    return Math.min(max, Math.max(min, n))
  }

  function imageAspect(drawable) {
    if (typeof drawable.aspect === 'number' && drawable.aspect > 0) return drawable.aspect
    if (imageAspectCacheRef.current.has(drawable.id)) {
      return imageAspectCacheRef.current.get(drawable.id)
    }
    if (!drawable.dataUrl) return null
    const img = new Image()
    img.onload = () => {
      if (!img.naturalWidth || !img.naturalHeight) return
      imageAspectCacheRef.current.set(drawable.id, img.naturalHeight / img.naturalWidth)
      setImageAspectVersion(v => v + 1)
    }
    img.src = drawable.dataUrl
    imageAspectCacheRef.current.set(drawable.id, null)
    return null
  }

  function imageHeightForWidth(drawable, widthNorm) {
    const aspect = imageAspect(drawable)
    if (!aspect || !canvasSize.w || !canvasSize.h) return drawable.height || 0.3
    return (widthNorm * canvasSize.w * aspect) / canvasSize.h
  }

  function getTextFontSize(drawable) {
    return Math.max(drawable.size * 4, 16)
  }

  function textSizeToFontSize(size) {
    return Math.max(size * 4, 16)
  }

  function estimateTextBox(drawable) {
    const fontSize = getTextFontSize(drawable)
    const lines = String(drawable.text || '').split('\n')
    const longestLine = lines.reduce((max, line) => Math.max(max, line.length), 1)
    return {
      w: drawable.width ? drawable.width * canvasSize.w : Math.min(Math.max(longestLine * fontSize * 0.55 + 12, 90), 420),
      h: drawable.height ? drawable.height * canvasSize.h : Math.max(lines.length * fontSize * 1.22 + 8, fontSize + 10)
    }
  }

  function drawableRect(drawable) {
    if (!drawable?.points?.[0] || !canvasSize.w || !canvasSize.h) return null
    const x = drawable.points[0].nx * canvasSize.w
    const y = drawable.points[0].ny * canvasSize.h
    if (drawable.tool === 'image') {
      const width = drawable.width || 0.3
      return {
        x,
        y,
        w: width * canvasSize.w,
        h: imageHeightForWidth(drawable, width) * canvasSize.h
      }
    }
    if (drawable.tool === 'text') {
      const box = estimateTextBox(drawable)
      return { x, y, w: box.w, h: box.h }
    }
    const pad = Math.max((drawable.size || 2) * 2, 8)
    const xs = drawable.points.map(p => p.nx * canvasSize.w)
    const ys = drawable.points.map(p => p.ny * canvasSize.h)
    const minX = Math.min(...xs) - pad
    const maxX = Math.max(...xs) + pad
    const minY = Math.min(...ys) - pad
    const maxY = Math.max(...ys) + pad
    return {
      x: clamp(minX, 0, canvasSize.w),
      y: clamp(minY, 0, canvasSize.h),
      w: Math.max(12, clamp(maxX, 0, canvasSize.w) - clamp(minX, 0, canvasSize.w)),
      h: Math.max(12, clamp(maxY, 0, canvasSize.h) - clamp(minY, 0, canvasSize.h))
    }
  }

  function unionRects(rects) {
    const valid = rects.filter(Boolean)
    if (valid.length === 0) return null
    const left = Math.min(...valid.map(r => r.x))
    const top = Math.min(...valid.map(r => r.y))
    const right = Math.max(...valid.map(r => r.x + r.w))
    const bottom = Math.max(...valid.map(r => r.y + r.h))
    return { x: left, y: top, w: right - left, h: bottom - top }
  }

  function rectsIntersect(a, b) {
    return a.x <= b.x + b.w && a.x + a.w >= b.x && a.y <= b.y + b.h && a.y + a.h >= b.y
  }

  function findDrawableAt(e, allowedTools = null) {
    if (!currentUser) return null
    const rect = wrapRef.current?.getBoundingClientRect()
    if (!rect) return null
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    for (let i = drawables.length - 1; i >= 0; i--) {
      const d = drawables[i]
      if (d.socketId !== currentUser.socketId) continue
      if (allowedTools && !allowedTools.includes(d.tool)) continue
      const box = drawableRect(d)
      if (!box) continue
      const pad = d.tool === 'text' ? 6 : 0
      if (x >= box.x - pad && x <= box.x + box.w + pad && y >= box.y - pad && y <= box.y + box.h + pad) {
        return d
      }
    }
    return null
  }

  function startTransform(e, drawable, mode) {
    if (!drawable || !wrapRef.current) return
    e.preventDefault()
    e.stopPropagation()
    transformCleanupRef.current?.()
    e.currentTarget.setPointerCapture?.(e.pointerId)
    const activeIds = selectedDrawableIds.includes(drawable.id) && mode === 'move'
      ? selectedDrawableIds
      : [drawable.id]
    setSelectedDrawableIds(activeIds)
    const movingDrawables = drawables.filter(d => activeIds.includes(d.id) && d.socketId === currentUser?.socketId)
    const movingBounds = unionRects(movingDrawables.map(d => drawableRect(d)))
    transformRef.current = {
      id: drawable.id,
      mode,
      ids: activeIds,
      startX: e.clientX,
      startY: e.clientY,
      bounds: movingBounds,
      originals: movingDrawables.map(d => ({
        id: d.id,
        points: d.points.map(p => ({ ...p }))
      })),
      original: {
        point: { ...drawable.points[0] },
        width: drawable.width || (drawable.tool === 'image' ? 0.3 : estimateTextBox(drawable).w / canvasSize.w),
        height: drawable.tool === 'image'
          ? imageHeightForWidth(drawable, drawable.width || 0.3)
          : drawable.height || estimateTextBox(drawable).h / canvasSize.h,
        aspect: drawable.tool === 'image' ? imageAspect(drawable) : null,
        size: drawable.size || strokeSize,
        tool: drawable.tool
      }
    }
    const onMove = (event) => updateTransform(event)
    const cleanup = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      transformCleanupRef.current = null
    }
    const onUp = (event) => {
      updateTransform(event, true)
      cleanup()
    }
    transformCleanupRef.current = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      transformCleanupRef.current = null
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  }

  function pointerInCanvas(e) {
    const rect = wrapRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    return {
      x: clamp(e.clientX - rect.left, 0, rect.width),
      y: clamp(e.clientY - rect.top, 0, rect.height)
    }
  }

  function startMarqueeSelect(e) {
    if (!wrapRef.current || !currentUser) return
    e.currentTarget.setPointerCapture?.(e.pointerId)
    marqueeCleanupRef.current?.()
    const start = pointerInCanvas(e)
    const makeRect = (point) => ({
      x: Math.min(start.x, point.x),
      y: Math.min(start.y, point.y),
      w: Math.abs(point.x - start.x),
      h: Math.abs(point.y - start.y)
    })
    marqueeRef.current = { start }
    setSelectionRect({ x: start.x, y: start.y, w: 0, h: 0 })

    const onMove = (event) => {
      if (!marqueeRef.current) return
      setSelectionRect(makeRect(pointerInCanvas(event)))
    }
    const cleanup = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      marqueeRef.current = null
      marqueeCleanupRef.current = null
    }
    const onUp = (event) => {
      const rect = makeRect(pointerInCanvas(event))
      const ids = rect.w < 6 && rect.h < 6
        ? []
        : drawables
            .filter(d => d.socketId === currentUser.socketId)
            .filter(d => {
              const box = drawableRect(d)
              return box && rectsIntersect(rect, box)
            })
            .map(d => d.id)
      setSelectedDrawableIds(ids)
      setSelectionRect(null)
      cleanup()
    }
    marqueeCleanupRef.current = cleanup
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  }

  function updateTransform(e, final = false) {
    const t = transformRef.current
    if (!t || !canvasSize.w || !canvasSize.h) return
    const dx = (e.clientX - t.startX) / canvasSize.w
    const dy = (e.clientY - t.startY) / canvasSize.h
    const updates = {}
    if (t.mode === 'move') {
      let safeDx = dx
      let safeDy = dy
      if (t.bounds) {
        safeDx = clamp(dx, -t.bounds.x / canvasSize.w, (canvasSize.w - t.bounds.x - t.bounds.w) / canvasSize.w)
        safeDy = clamp(dy, -t.bounds.y / canvasSize.h, (canvasSize.h - t.bounds.y - t.bounds.h) / canvasSize.h)
      }
      for (const original of t.originals) {
        sendDrawableUpdate(original.id, {
          points: original.points.map(p => ({
            nx: clamp(p.nx + safeDx, 0, 1),
            ny: clamp(p.ny + safeDy, 0, 1)
          }))
        })
      }
      if (final) transformRef.current = null
      return
    } else {
      const minW = t.original.tool === 'text' ? 0.08 : 0.05
      const maxW = Math.max(minW, 1 - t.original.point.nx)
      updates.width = clamp(t.original.width + dx, minW, maxW)
      if (t.original.tool === 'image') {
        const aspect = t.original.aspect || ((t.original.height * canvasSize.h) / (t.original.width * canvasSize.w))
        updates.height = clamp(
          (updates.width * canvasSize.w * aspect) / canvasSize.h,
          0.05,
          Math.max(0.05, 1 - t.original.point.ny)
        )
      } else {
        const minH = Math.max(24 / canvasSize.h, 0.035)
        const maxH = Math.max(minH, 1 - t.original.point.ny)
        updates.height = clamp(t.original.height + dy, minH, maxH)
        const widthScale = updates.width / t.original.width
        const heightScale = updates.height / t.original.height
        const nextSize = clamp(Math.round(t.original.size * Math.max(widthScale, heightScale)), 1, 64)
        updates.size = nextSize
      }
    }
    sendDrawableUpdate(t.id, updates)
    if (final) transformRef.current = null
  }

  function handleStrokeSizeChange(nextSize) {
    if (textOverlay) {
      setTextOverlay(o => o ? { ...o, size: nextSize } : o)
      return
    }
    if (selectedEditableText) {
      sendDrawableUpdate(selectedDrawable.id, { size: nextSize })
      return
    }
    setStrokeSize(nextSize)
  }

  function openTextEditorForDrawable(drawable) {
    const box = drawableRect(drawable)
    if (!box || !drawable.points?.[0]) return
    setActiveTool('text')
    setActiveColor(drawable.color || activeColor)
    setSelectedDrawableIds([drawable.id])
    textIgnoreBlurUntilRef.current = performance.now() + 350
    setTextOverlay({
      editingId: drawable.id,
      x: box.x,
      y: box.y,
      nx: drawable.points[0].nx,
      ny: drawable.points[0].ny,
      width: box.w,
      height: box.h,
      size: drawable.size || strokeSize,
      color: drawable.color || activeColor,
      value: drawable.text || ''
    })
  }

  function handlePointerMove(e) {
    if (drawingIdRef.current) return
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
    if (e.pointerType === 'mouse' && e.button !== 0) return
    if (!textOverlay && activeTool === 'text' && textJustCommittedRef.current) {
      e.preventDefault()
      return
    }
    if (textOverlay) {
      e.preventDefault()
      commitTextOverlay()
      return
    }
    const editable = activeTool === 'text' || activeTool === 'image'
      ? findDrawableAt(e, [activeTool])
      : null
    if (editable) {
      if (activeTool === 'text') {
        e.preventDefault()
        openTextEditorForDrawable(editable)
        return
      }
      startTransform(e, editable, 'move')
      return
    }
    if (activeTool === 'select') {
      e.preventDefault()
      const hit = findDrawableAt(e)
      if (hit) {
        startTransform(e, hit, 'move')
      } else {
        startMarqueeSelect(e)
      }
      return
    }
    setSelectedDrawableIds([])
    if (activeTool === 'text') {
      e.preventDefault()
      const wrapRect = wrapRef.current.getBoundingClientRect()
      const point = normalizedPoint(e)
      const fontSize = Math.max(strokeSize * 4, 16)
      const x = e.clientX - wrapRect.left
      const y = e.clientY - wrapRect.top
      const width = clamp(220, 90, Math.max(90, wrapRect.width - x - 16))
      textIgnoreBlurUntilRef.current = performance.now() + 350
      setTextOverlay({
        x,
        y,
        nx: point.nx,
        ny: point.ny,
        width,
        height: Math.max(fontSize * 2.4, 48),
        size: strokeSize,
        color: activeColor,
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
    sendDrawStart({ id, tool: activeTool, color: activeColor, size: strokeSize, point })
  }

  function handleCanvasPointerMove(e) {
    if (transformRef.current || marqueeRef.current) {
      return
    }
    if (!drawingIdRef.current) return
    const now = performance.now()
    if (now - lastExtendRef.current < 16) return
    lastExtendRef.current = now
    const point = normalizedPoint(e)
    sendDrawExtend({ id: drawingIdRef.current, point })
  }

  function handleCanvasPointerUp(e) {
    if (transformRef.current) {
      e.currentTarget.releasePointerCapture?.(e.pointerId)
      return
    }
    if (marqueeRef.current) {
      e.currentTarget.releasePointerCapture?.(e.pointerId)
      return
    }
    if (!drawingIdRef.current) return
    // Capture final point if we haven't yet (short tap or throttled)
    const point = normalizedPoint(e)
    sendDrawExtend({ id: drawingIdRef.current, point })
    sendDrawEnd({ id: drawingIdRef.current })
    drawingIdRef.current = null
  }

  function commitTextOverlay() {
    if (!textOverlay) return
    textJustCommittedRef.current = true
    if (textJustCommittedTimerRef.current) clearTimeout(textJustCommittedTimerRef.current)
    textJustCommittedTimerRef.current = setTimeout(() => {
      textJustCommittedRef.current = false
      textJustCommittedTimerRef.current = null
    }, 250)
    const text = (textOverlay.value || '').trim()
    if (!text) { setTextOverlay(null); return }
    const box = textOverlayRef.current?.getBoundingClientRect()
    const width = box && canvasSize.w ? box.width / canvasSize.w : textOverlay.width / canvasSize.w
    const height = box && canvasSize.h ? box.height / canvasSize.h : textOverlay.height / canvasSize.h
    const size = textOverlay.size || strokeSize
    if (textOverlay.editingId) {
      sendDrawableUpdate(textOverlay.editingId, {
        text: text.slice(0, 500),
        width: clamp(width, 0.05, 1.5),
        height: clamp(height, 0.03, 1.5),
        size
      })
      setSelectedDrawableIds([textOverlay.editingId])
      setTextOverlay(null)
      return
    }
    const id = (crypto.randomUUID?.() || String(Date.now()) + Math.random())
    const localId = sendDrawableAdd({
      id,
      tool: 'text',
      color: textOverlay.color || activeColor,
      size,
      points: [{ nx: textOverlay.nx, ny: textOverlay.ny }],
      width: clamp(width, 0.05, 1.5),
      height: clamp(height, 0.03, 1.5),
      text: text.slice(0, 500)
    })
    setTextOverlay(null)
    if (localId) setSelectedDrawableIds([localId])
  }

  function handleTextOverlayBlur() {
    const text = (textOverlay?.value || '').trim()
    if (textOverlayResizeRef.current) {
      requestAnimationFrame(() => textOverlayRef.current?.focus({ preventScroll: true }))
      return
    }
    if (!text && performance.now() < textIgnoreBlurUntilRef.current) {
      requestAnimationFrame(() => textOverlayRef.current?.focus({ preventScroll: true }))
      return
    }
    commitTextOverlay()
  }

  const deleteSelectedDrawables = useCallback(() => {
    const ids = selectedDrawables
      .filter(d => d.socketId === currentUser?.socketId)
      .map(d => d.id)
    if (ids.length === 0) return
    sendDrawableDelete(ids)
    setSelectedDrawableIds([])
  }, [currentUser?.socketId, selectedDrawables, sendDrawableDelete])

  function startTextOverlayResize(e) {
    if (!textOverlay || !wrapRef.current) return
    e.preventDefault()
    e.stopPropagation()
    textOverlayResizeCleanupRef.current?.()
    e.currentTarget.setPointerCapture?.(e.pointerId)
    const base = {
      startX: e.clientX,
      startY: e.clientY,
      x: textOverlay.x,
      y: textOverlay.y,
      width: textOverlay.width,
      height: textOverlay.height,
      size: textOverlay.size || strokeSize
    }
    textOverlayResizeRef.current = base
    const onMove = (event) => {
      const t = textOverlayResizeRef.current
      if (!t || !wrapRef.current) return
      const wrapRect = wrapRef.current.getBoundingClientRect()
      const maxW = Math.max(90, wrapRect.width - t.x - 8)
      const maxH = Math.max(32, wrapRect.height - t.y - 8)
      const width = clamp(t.width + event.clientX - t.startX, 80, maxW)
      const height = clamp(t.height + event.clientY - t.startY, 32, maxH)
      const scale = Math.max(width / t.width, height / t.height)
      const size = clamp(Math.round(t.size * scale), 1, 64)
      setTextOverlay(o => o ? { ...o, width, height, size } : o)
    }
    const cleanup = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      textOverlayResizeRef.current = null
      textOverlayResizeCleanupRef.current = null
      requestAnimationFrame(() => textOverlayRef.current?.focus({ preventScroll: true }))
    }
    const onUp = () => cleanup()
    textOverlayResizeCleanupRef.current = cleanup
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
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
    const localId = sendDrawableAdd({
      id,
      tool: 'image',
      color: '#000000',
      size: 1,
      points: [{ nx: Math.max(0, Math.min(1 - drawableW, point.nx)), ny: Math.max(0, Math.min(1 - drawableH, point.ny)) }],
      width: drawableW,
      height: drawableH,
      aspect,
      dataUrl: outUrl
    })
    if (localId) {
      setActiveTool('image')
      setSelectedDrawableIds([localId])
    }
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
      if ((e.key === 'Backspace' || e.key === 'Delete') && selectedDrawableIds.length > 0) {
        e.preventDefault()
        deleteSelectedDrawables()
        return
      }
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
  }, [undo, redo, selectedDrawableIds, deleteSelectedDrawables])

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
  const selectionBounds = !textOverlay ? unionRects(selectedDrawables.map(d => drawableRect(d))) : null
  const hasSelection = selectedDrawables.length > 0
  const canResizeSelection = !!selectedDrawable && ['text', 'image'].includes(selectedDrawable.tool)

  if (!hasJoinedRoom) return null

  return (
    <div className="board-page">
      <div className="board-body">
        <div className="board-toolbar">
          <button
            className={'tool-btn' + (activeTool === 'select' ? ' active' : '')}
            onClick={() => setActiveTool('select')}
            title="Select"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 3l10 9-5 1.2 3.2 6.3-2.8 1.4-3.1-6.2L7 18z" />
            </svg>
          </button>
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
          <span className="size-label">{activeSize}px</span>
          <input
            type="range"
            className="stroke-slider"
            min={1}
            max={12}
            value={activeSize}
            onChange={e => handleStrokeSizeChange(+e.target.value)}
            title={(selectedEditableText ? 'Text size: ' : 'Size: ') + activeSize}
          />
          <div className="stroke-preview-slot">
            <div
              className="stroke-preview"
              style={{ width: activeSize, height: activeSize }}
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
            className={'tool-btn' + (clearVote && !hasSelection ? ' disabled' : '')}
            title={hasSelection ? 'Delete selected' : 'Clear canvas'}
            onClick={hasSelection ? deleteSelectedDrawables : startClearVote}
            disabled={!hasSelection && !!clearVote}
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
            className={'tool-btn' + (activeTool === 'image' ? ' active' : '')}
            title="Insert image"
            onClick={() => { setActiveTool('image'); fileInputRef.current?.click() }}
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
            <textarea
              ref={textOverlayRef}
              className="text-overlay"
              style={{
                left: textOverlay.x,
                top: textOverlay.y,
                width: textOverlay.width,
                height: textOverlay.height,
                color: textOverlay.color || activeColor,
                fontSize: textSizeToFontSize(textOverlay.size || strokeSize)
              }}
              value={textOverlay.value}
              autoFocus
              onPointerDown={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => setTextOverlay(o => o ? { ...o, value: e.target.value } : o)}
              onKeyDown={(e) => {
                e.stopPropagation()
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitTextOverlay() }
                else if (e.key === 'Escape') { setTextOverlay(null) }
              }}
              onBlur={handleTextOverlayBlur}
              placeholder="Type here..."
            />
          )}
          {textOverlay && (
            <button
              className="text-overlay-resize-handle"
              type="button"
              aria-label="Resize text box"
              style={{
                left: textOverlay.x + textOverlay.width,
                top: textOverlay.y + textOverlay.height
              }}
              onPointerDown={startTextOverlayResize}
            />
          )}
          {selectionRect && (
            <div
              className="selection-marquee"
              style={{
                left: selectionRect.x,
                top: selectionRect.y,
                width: selectionRect.w,
                height: selectionRect.h
              }}
            />
          )}
          {selectionBounds && (
            <div
              className={'drawable-selection' + (selectedDrawables.length > 1 ? ' multi' : '')}
              style={{
                left: selectionBounds.x,
                top: selectionBounds.y,
                width: selectionBounds.w,
                height: selectionBounds.h
              }}
            >
              <button
                className="drawable-delete-handle"
                type="button"
                aria-label="Delete selected drawing"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={deleteSelectedDrawables}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                  <path d="M10 11v6" />
                  <path d="M14 11v6" />
                  <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
                </svg>
              </button>
              {canResizeSelection && (
                <button
                  className="drawable-resize-handle"
                  type="button"
                  aria-label="Resize selected drawing"
                  onPointerDown={(e) => startTransform(e, selectedDrawable, 'resize')}
                />
              )}
            </div>
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
