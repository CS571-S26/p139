import { useState, useEffect } from 'react'

const GRID = [
  '#000000', '#4a4a4a', '#9b9b9b', '#ffffff',
  '#e74c3c', '#f5715b', '#ff8c00', '#f5d45b',
  '#f1c40f', '#5bf5a3', '#2ecc71', '#1abc9c',
  '#5bf5f0', '#5b8af5', '#3498db', '#9b59b6',
  '#c45bf5', '#f57eab', '#8b4513', '#2c3e50'
]

function normalizeHex(s) {
  const t = s.replace('#', '').trim()
  if (/^[0-9a-fA-F]{6}$/.test(t)) return '#' + t.toLowerCase()
  if (/^[0-9a-fA-F]{3}$/.test(t)) return '#' + t.split('').map(c => c + c).join('').toLowerCase()
  return null
}

export default function ColorPicker({ value, onChange, onClose }) {
  const [hex, setHex] = useState(value.replace('#', '').toUpperCase())

  useEffect(() => {
    setHex(value.replace('#', '').toUpperCase())
  }, [value])

  function commitHex() {
    const v = normalizeHex(hex)
    if (v) onChange(v)
    else setHex(value.replace('#', '').toUpperCase())
  }

  return (
    <div className="color-picker-panel">
      <div className="cp-header">
        <span className="cp-title">Color</span>
        <button className="cp-close" onClick={onClose} aria-label="Close">×</button>
      </div>
      <div className="cp-grid">
        {GRID.map(c => (
          <button
            key={c}
            className={'cp-swatch' + (value.toLowerCase() === c.toLowerCase() ? ' active' : '')}
            style={{ background: c }}
            onClick={() => onChange(c)}
            aria-label={c}
          />
        ))}
      </div>
      <div className="cp-hex-row">
        <label className="cp-hex-label">#</label>
        <input
          className="cp-hex-input"
          type="text"
          value={hex}
          maxLength={6}
          onChange={e => setHex(e.target.value.toUpperCase())}
          onBlur={commitHex}
          onKeyDown={e => { if (e.key === 'Enter') { commitHex(); e.target.blur() } }}
          spellCheck={false}
        />
        <div className="cp-preview" style={{ background: value }} />
      </div>
    </div>
  )
}
