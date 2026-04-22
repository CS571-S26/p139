import { useRef, useEffect, useState } from 'react'

function hexToRgb(hex) {
  const m = /^#?([a-f0-9]{6})$/i.exec(hex || '')
  if (!m) return { r: 0, g: 0, b: 0 }
  const v = parseInt(m[1], 16)
  return { r: (v >> 16) & 0xff, g: (v >> 8) & 0xff, b: v & 0xff }
}
function rgbToHex(r, g, b) {
  const c = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')
  return '#' + c(r) + c(g) + c(b)
}
function rgbToHsv(r, g, b) {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  const d = max - min
  let h = 0
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h *= 60
    if (h < 0) h += 360
  }
  return { h, s: max === 0 ? 0 : d / max, v: max }
}
function hsvToRgb(h, s, v) {
  h = ((h % 360) + 360) % 360
  const c = v * s
  const x = c * (1 - Math.abs((h / 60) % 2 - 1))
  const m = v - c
  let r = 0, g = 0, b = 0
  if (h < 60)      [r, g, b] = [c, x, 0]
  else if (h < 120) [r, g, b] = [x, c, 0]
  else if (h < 180) [r, g, b] = [0, c, x]
  else if (h < 240) [r, g, b] = [0, x, c]
  else if (h < 300) [r, g, b] = [x, 0, c]
  else              [r, g, b] = [c, 0, x]
  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255)
  }
}

export default function ColorPicker({ value, onChange, onClose }) {
  const rgb = hexToRgb(value)
  const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b)

  // Keep hue in state so dragging into pure white/black doesn't lose it.
  const [hue, setHue] = useState(hsv.h)
  // Track the hex input text independently so the user can type freely.
  const [hexText, setHexText] = useState(value.replace('#', '').toUpperCase())

  useEffect(() => {
    // When external value changes, update hue only if the derived hue is nonzero
    // (preserves user-selected hue when S or V collapses).
    const nh = rgbToHsv(hexToRgb(value).r, hexToRgb(value).g, hexToRgb(value).b)
    if (nh.s > 0) setHue(nh.h)
    setHexText(value.replace('#', '').toUpperCase())
  }, [value])

  function emitHsv(h, s, v) {
    const { r, g, b } = hsvToRgb(h, s, v)
    onChange(rgbToHex(r, g, b))
  }

  function emitRgb(r, g, b) {
    onChange(rgbToHex(r, g, b))
  }

  // SV area interaction
  const svRef = useRef(null)
  function onSvPointer(e) {
    const el = svRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    function update(evt) {
      let x = (evt.clientX - rect.left) / rect.width
      let y = (evt.clientY - rect.top) / rect.height
      x = Math.max(0, Math.min(1, x))
      y = Math.max(0, Math.min(1, y))
      emitHsv(hue, x, 1 - y)
    }
    update(e)
    function move(ev) { update(ev) }
    function up() {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  // Hue slider interaction
  const hueRef = useRef(null)
  function onHuePointer(e) {
    const el = hueRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    function update(evt) {
      let x = (evt.clientX - rect.left) / rect.width
      x = Math.max(0, Math.min(1, x))
      const h = x * 360
      setHue(h)
      const cur = rgbToHsv(rgb.r, rgb.g, rgb.b)
      emitHsv(h, cur.s || 1, cur.v || 1)
    }
    update(e)
    function move(ev) { update(ev) }
    function up() {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  function onRgbChange(channel, raw) {
    const n = Math.max(0, Math.min(255, parseInt(raw, 10) || 0))
    const next = { ...rgb, [channel]: n }
    emitRgb(next.r, next.g, next.b)
  }

  function commitHex() {
    const m = /^#?([a-f0-9]{6})$/i.exec(hexText)
    if (m) onChange('#' + m[1].toLowerCase())
    else setHexText(value.replace('#', '').toUpperCase())
  }

  const hueColor = rgbToHex(hsvToRgb(hue, 1, 1).r, hsvToRgb(hue, 1, 1).g, hsvToRgb(hue, 1, 1).b)
  const curHsv = rgbToHsv(rgb.r, rgb.g, rgb.b)

  return (
    <div className="color-picker-panel">
      <div className="cp-header">
        <span className="cp-title">Color</span>
        <button className="cp-close" onClick={onClose} aria-label="Close">×</button>
      </div>

      <div
        ref={svRef}
        className="cp-sv"
        style={{ background: hueColor }}
        onPointerDown={onSvPointer}
      >
        <div className="cp-sv-whiteover" />
        <div className="cp-sv-blackover" />
        <div
          className="cp-sv-dot"
          style={{
            left: `${curHsv.s * 100}%`,
            top: `${(1 - curHsv.v) * 100}%`
          }}
        />
      </div>

      <div
        ref={hueRef}
        className="cp-hue"
        onPointerDown={onHuePointer}
      >
        <div
          className="cp-hue-thumb"
          style={{ left: `${(hue / 360) * 100}%` }}
        />
      </div>

      <div className="cp-row">
        <div className="cp-preview-big" style={{ background: value }} />
        <label className="cp-field-col">
          <span className="cp-field-label">HEX</span>
          <input
            className="cp-hex-input"
            type="text"
            value={hexText}
            maxLength={7}
            onChange={e => setHexText(e.target.value.replace('#', '').toUpperCase())}
            onBlur={commitHex}
            onKeyDown={e => { if (e.key === 'Enter') { commitHex(); e.target.blur() } }}
            spellCheck={false}
          />
        </label>
      </div>

      <div className="cp-rgb">
        {['r', 'g', 'b'].map(ch => (
          <label key={ch} className="cp-field-col">
            <span className="cp-field-label">{ch.toUpperCase()}</span>
            <input
              className="cp-rgb-input"
              type="number"
              min={0}
              max={255}
              value={rgb[ch]}
              onChange={e => onRgbChange(ch, e.target.value)}
            />
          </label>
        ))}
      </div>
    </div>
  )
}
