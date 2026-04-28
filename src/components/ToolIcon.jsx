export default function ToolIcon({ tool }) {
  const common = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round'
  }
  switch (tool) {
    case 'pen':
      return <svg {...common}><path d="M17 3a2.85 2.85 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z" /></svg>
    case 'eraser':
      return <svg {...common}><path d="M20 20H7L3 16l9-9 8 8-4 5z" /><path d="M6 11l8 8" /></svg>
    case 'rect':
      return <svg {...common}><rect x="3" y="5" width="18" height="14" rx="1" /></svg>
    case 'circle':
      return <svg {...common}><circle cx="12" cy="12" r="9" /></svg>
    case 'line':
      return <svg {...common}><line x1="5" y1="19" x2="19" y2="5" /></svg>
    case 'triangle':
      return <svg {...common}><path d="M12 4 L4 20 L20 20 Z" /></svg>
    case 'arrow':
      return <svg {...common}><line x1="4" y1="20" x2="20" y2="4" /><polyline points="13 4 20 4 20 11" /></svg>
    case 'star':
      return <svg {...common}><polygon points="12 2 14.6 9 22 9 16 13.5 18.2 21 12 16.5 5.8 21 8 13.5 2 9 9.4 9" /></svg>
    default:
      return null
  }
}
