import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

/**
 * Renders its children in a portal at document.body, positioned above (default)
 * or below a given anchor element. Escapes parent overflow clipping.
 * Handles outside-click / Escape to close.
 */
export default function AnchoredPopover({ anchorRef, open, onClose, children, placement = 'top', offset = 6 }) {
  const panelRef = useRef(null)
  const [pos, setPos] = useState(null)

  useLayoutEffect(() => {
    if (!open) return
    function place() {
      const a = anchorRef.current
      const p = panelRef.current
      if (!a || !p) return
      const ar = a.getBoundingClientRect()
      const pr = p.getBoundingClientRect()
      let left = ar.left
      // Clamp horizontally to viewport
      if (left + pr.width > window.innerWidth - 8) left = window.innerWidth - pr.width - 8
      if (left < 8) left = 8
      let top
      if (placement === 'top') {
        top = ar.top - pr.height - offset
        if (top < 8) top = ar.bottom + offset // flip below if not enough room above
      } else {
        top = ar.bottom + offset
        if (top + pr.height > window.innerHeight - 8) top = ar.top - pr.height - offset
      }
      setPos({ left, top })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open, anchorRef, placement, offset])

  useEffect(() => {
    if (!open) return
    function onDown(e) {
      const p = panelRef.current
      const a = anchorRef.current
      if (p && !p.contains(e.target) && a && !a.contains(e.target)) {
        onClose()
      }
    }
    function onKey(e) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('touchstart', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open, anchorRef, onClose])

  if (!open) return null
  return createPortal(
    <div
      ref={panelRef}
      className="anchored-popover"
      style={{
        position: 'fixed',
        left: pos?.left ?? -9999,
        top: pos?.top ?? -9999,
        visibility: pos ? 'visible' : 'hidden',
        zIndex: 1000
      }}
    >
      {children}
    </div>,
    document.body
  )
}
