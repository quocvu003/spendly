/**
 * Tính màu text tương phản dựa trên độ sáng của màu nền.
 * Trả về text trắng cho nền tối, text tối cho nền sáng.
 */
export function getContrastColors(bgHex: string) {
  const hex = bgHex.replace('#', '')
  if (hex.length !== 6) {
    return { text: '#ffffff', muted: 'rgba(255,255,255,0.7)', iconBg: 'rgba(255,255,255,0.2)' }
  }
  const r = parseInt(hex.substring(0, 2), 16)
  const g = parseInt(hex.substring(2, 4), 16)
  const b = parseInt(hex.substring(4, 6), 16)
  // Perceived luminance (human eye sensitivity)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  const isDark = luminance <= 0.55
  return {
    text:    isDark ? '#ffffff'              : '#1e293b',
    muted:   isDark ? 'rgba(255,255,255,0.7)' : 'rgba(30,41,59,0.55)',
    iconBg:  isDark ? 'rgba(255,255,255,0.2)' : 'rgba(30,41,59,0.1)',
  }
}

/**
 * Bảng 3 màu cho viền phát sáng, cùng họ với màu chủ đề của card:
 * màu gốc (tăng độ bão hoà) và hai màu lệch sắc độ ±35°, sáng hơn một chút
 * để quầng sáng vẫn nổi trên nền sáng của trang.
 */
export function getGlowColors(baseHex: string): string[] {
  const hsl = hexToHsl(baseHex)
  if (!hsl) return ['#F2244F', '#4DA6E6', '#379590']
  const [h, s, l] = hsl
  const sat = Math.max(s, 0.55)
  const light = Math.min(Math.max(l, 0.45), 0.62)
  return [
    hslToHex(h, sat, light),
    hslToHex(h + 35, sat, Math.min(light + 0.08, 0.7)),
    hslToHex(h - 35, sat, light),
  ]
}

function hexToHsl(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex)
  if (!m) return null
  const n = parseInt(m[1], 16)
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return [h * 60, s, l]
}

function hslToHex(h: number, s: number, l: number): string {
  h = ((h % 360) + 360) % 360
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  const [r, g, b] =
    h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] :
    h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x]
  const to = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, '0')
  return `#${to(r)}${to(g)}${to(b)}`
}
