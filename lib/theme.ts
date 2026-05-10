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
