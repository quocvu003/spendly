'use client'

// Nền "thung lũng hoa đêm": thảm hoa phát quang nhìn theo phối cảnh, camera trôi
// chậm về phía trước và bay nhanh hơn khi cuộn trang. Tự viết bằng Canvas 2D.
//
// Hoa:
// - 3 loại: hoa 5 cánh 2 lớp, hoa cúc nhiều cánh mảnh, hoa 6 cánh dạng loa kèn
// - Cánh chuyển màu từ nhuỵ ra mép, có viền sáng, gân giữa và quầng phát quang
// - Mỗi bông xoay một góc riêng và nghiêng theo góc nhìn (xa dẹt hơn, gần tròn hơn)
// - Bông ở gần có thân và lá phát sáng mờ; ở xa chỉ còn là đốm sáng cùng màu
//
// Cảnh: hoa nở dần khi lại gần, chuột đẩy hoa ra xa và làm hoa gần con trỏ sáng lên,
// camera nghiêng nhẹ theo chuột, bloom, sương chân trời, tia sáng mềm, bụi sáng,
// hạt nhiễu, viền tối siết lại khi cuộn nhanh.
// Tự giảm số hoa nếu máy vẽ chậm; dừng khi tab bị ẩn; prefers-reduced-motion → khung tĩnh.

import { useEffect, useRef } from 'react'

// 12 màu rực: hồng đậm, hồng, san hô, cam, vàng, xanh nõn chuối, bạc hà, xanh lơ, xanh trời, xanh tím, tím, trắng
const PETAL_COLORS = [
  '#ff4f9a', '#ff8fcb', '#ff6f61', '#ff9f43', '#ffd93d', '#b8f25c',
  '#4ff0b8', '#3ad8ff', '#5c9dff', '#8a7dff', '#c46bff', '#fff1dc',
]
const WHITE = 11 // chỉ số màu trắng, dành cho hàng hoa viền lối đi
type Kind = 'blossom' | 'daisy' | 'lily'
const KINDS: Kind[] = ['blossom', 'blossom', 'daisy', 'lily']

const DEPTH = 60          // chiều dài một vòng thung lũng; mọi đường cong lặp lại theo DEPTH
const NEAR = 0.6
const HALF_WIDTH = 9
const CAM_HEIGHT = 2.0
const TAU = Math.PI * 2

// ── Địa hình: lối đi uốn lượn giữa thung lũng, hai bên là sườn đồi nhấp nhô ──
// Tất cả là tổ hợp sin có chu kỳ chia hết cho DEPTH, nên bay mãi không có chỗ nối.
function pathX(z: number) {
  return 2.6 * Math.sin((TAU * z) / DEPTH) + 1.1 * Math.sin((TAU * 2 * z) / DEPTH + 1.3)
}
function terrain(x: number, z: number) {
  const d = x - pathX(z)
  const walls = 0.03 * d * d // sườn thung lũng dâng dần ra hai bên
  const rolling =
    0.45 * Math.sin((TAU * 3 * z) / DEPTH + x * 0.45) +
    0.3 * Math.sin(x * 0.85 - (TAU * 2 * z) / DEPTH + 0.7)
  // Lối đi bằng phẳng, đồi nhấp nhô dần khi ra xa lối đi
  return walls + (rolling + 0.75) * smoothstep(1.2, 4.5, Math.abs(d))
}
const DRIFT_SPEED = 0.5
const SCROLL_TO_DEPTH = 0.014
const DOT_BELOW_PX = 9     // nhỏ hơn: vẽ đốm sáng
const DETAIL_ABOVE_PX = 16 // lớn hơn: xoay bông, vẽ thân và lá

type Point = {
  x: number; y: number; z: number
  g: number        // độ cao mặt đất tại gốc hoa
  size: number
  flower: number   // chỉ số sprite hoa
  rot: number
  phase: number
  twinkle: number
  leafSide: number   // 1 lá: -1 hoặc 1; 0 = 2 lá
  leafAt: number     // độ cao mọc lá (0..1 theo thân)
  leafAngle: number
}

type Dust = { x: number; y: number; r: number; speed: number; phase: number }

const smoothstep = (a: number, b: number, v: number) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)))
  return t * t * (3 - 2 * t)
}
const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5
const rgbOf = (hex: string) => {
  const n = parseInt(hex.slice(1), 16)
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`
}

// ── Sprite hoa ──────────────────────────────────────────────────────────────
function petalPath(len: number, width: number, pointed: boolean) {
  const p = new Path2D()
  p.moveTo(0, 0)
  if (pointed) {
    p.bezierCurveTo(width, -len * 0.25, width * 0.7, -len * 0.75, 0, -len)
    p.bezierCurveTo(-width * 0.7, -len * 0.75, -width, -len * 0.25, 0, 0)
  } else {
    // Cánh tròn đầu, hơi lõm ở chóp như cánh hoa anh đào
    p.bezierCurveTo(width * 1.1, -len * 0.3, width * 1.05, -len * 0.95, width * 0.25, -len)
    p.quadraticCurveTo(0, -len * 0.9, -width * 0.25, -len)
    p.bezierCurveTo(-width * 1.05, -len * 0.95, -width * 1.1, -len * 0.3, 0, 0)
  }
  return p
}

function drawPetals(g: CanvasRenderingContext2D, px: number, rgb: string, count: number,
  len: number, width: number, pointed: boolean, offset: number, alpha: number) {
  const path = petalPath(len, width, pointed)
  for (let i = 0; i < count; i++) {
    g.save()
    g.rotate(offset + (i / count) * Math.PI * 2)
    const grad = g.createLinearGradient(0, 0, 0, -len)
    grad.addColorStop(0, `rgba(255,255,255,${0.95 * alpha})`)
    grad.addColorStop(0.3, `rgba(${rgb},${0.95 * alpha})`)
    grad.addColorStop(1, `rgba(${rgb},${0.6 * alpha})`)
    g.shadowColor = `rgba(${rgb},0.9)`
    g.shadowBlur = px * 0.07
    g.fillStyle = grad
    g.fill(path)
    g.shadowBlur = 0
    // Viền sáng + gân giữa
    g.strokeStyle = `rgba(255,255,255,${0.4 * alpha})`
    g.lineWidth = px * 0.008
    g.stroke(path)
    g.strokeStyle = `rgba(255,255,255,${0.28 * alpha})`
    g.beginPath()
    g.moveTo(0, -len * 0.12)
    g.lineTo(0, -len * 0.75)
    g.stroke()
    g.restore()
  }
}

function makeFlowerSprite(kind: Kind, color: string, px = 128): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = c.height = px
  const g = c.getContext('2d')!
  const m = px / 2
  const rgb = rgbOf(color)

  // Quầng phát quang
  const halo = g.createRadialGradient(m, m, 0, m, m, m)
  halo.addColorStop(0, `rgba(${rgb},0.35)`)
  halo.addColorStop(0.45, `rgba(${rgb},0.1)`)
  halo.addColorStop(1, `rgba(${rgb},0)`)
  g.fillStyle = halo
  g.fillRect(0, 0, px, px)

  g.save()
  g.translate(m, m)
  let centerR = px * 0.06
  if (kind === 'blossom') {
    drawPetals(g, px, rgb, 5, px * 0.3, px * 0.13, false, 0, 0.85)
    drawPetals(g, px, rgb, 5, px * 0.19, px * 0.09, false, Math.PI / 5, 1)
  } else if (kind === 'daisy') {
    drawPetals(g, px, rgb, 14, px * 0.33, px * 0.04, true, 0, 0.95)
    centerR = px * 0.085
  } else {
    drawPetals(g, px, rgb, 3, px * 0.34, px * 0.1, true, 0, 0.8)
    drawPetals(g, px, rgb, 3, px * 0.3, px * 0.09, true, Math.PI / 3, 1)
  }

  // Nhuỵ: đĩa vàng sáng + chấm phấn hoa
  const core = g.createRadialGradient(0, 0, 0, 0, 0, centerR)
  core.addColorStop(0, 'rgba(255,255,240,1)')
  core.addColorStop(0.6, 'rgba(255,226,150,0.95)')
  core.addColorStop(1, 'rgba(255,200,110,0)')
  g.fillStyle = core
  g.beginPath()
  g.arc(0, 0, centerR, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = 'rgba(255,240,190,0.95)'
  const dots = kind === 'daisy' ? 12 : 7
  for (let i = 0; i < dots; i++) {
    const a = (i / dots) * Math.PI * 2
    g.beginPath()
    g.arc(Math.cos(a) * centerR * 0.9, Math.sin(a) * centerR * 0.9, px * 0.009, 0, Math.PI * 2)
    g.fill()
  }
  g.restore()
  return c
}

function makeDotSprite(color: string, px = 24): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = c.height = px
  const g = c.getContext('2d')!
  const m = px / 2
  const rgb = rgbOf(color)
  const grad = g.createRadialGradient(m, m, 0, m, m, m)
  grad.addColorStop(0, 'rgba(255,255,255,1)')
  grad.addColorStop(0.2, `rgba(${rgb},0.8)`)
  grad.addColorStop(1, `rgba(${rgb},0)`)
  g.fillStyle = grad
  g.fillRect(0, 0, px, px)
  return c
}

// Lá phát sáng mờ, gốc lá ở giữa cạnh dưới sprite
function makeLeafSprite(px = 64): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = c.height = px
  const g = c.getContext('2d')!
  g.translate(px / 2, px)
  const len = px * 0.9, wid = px * 0.22
  const p = new Path2D()
  p.moveTo(0, 0)
  p.bezierCurveTo(wid, -len * 0.3, wid * 0.8, -len * 0.75, 0, -len)
  p.bezierCurveTo(-wid * 0.8, -len * 0.75, -wid, -len * 0.3, 0, 0)
  const grad = g.createLinearGradient(0, 0, 0, -len)
  grad.addColorStop(0, 'rgba(70,170,140,0.75)')
  grad.addColorStop(1, 'rgba(120,230,200,0.35)')
  g.shadowColor = 'rgba(90,220,180,0.7)'
  g.shadowBlur = px * 0.12
  g.fillStyle = grad
  g.fill(p)
  g.shadowBlur = 0
  g.strokeStyle = 'rgba(200,255,235,0.35)'
  g.lineWidth = px * 0.015
  g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -len * 0.85); g.stroke()
  return c
}

function makeGrainTile(px = 128): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = c.height = px
  const g = c.getContext('2d')!
  const img = g.createImageData(px, px)
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.random() * 255
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v
    img.data[i + 3] = 255
  }
  g.putImageData(img, 0, 0)
  return c
}

// Một "dải hoa": dòng hoa cùng màu, cùng loại, uốn lượn song song theo lối đi
type Strand = { offset: number; amp: number; freq: number; phase: number; width: number; flower: number; weight: number }

function makeStrands(halfWidth: number, colorN: number): Strand[] {
  const s = halfWidth / HALF_WIDTH // màn hình dọc thu hẹp thung lũng
  const flowerIdx = (kind: number, color: number) => kind * colorN + color
  const strands: Strand[] = [
    // Hàng hoa trắng nhỏ viền hai mép lối đi
    { offset: -0.9, amp: 0.15, freq: 5, phase: 0, width: 0.18, flower: flowerIdx(2, WHITE), weight: 0.7 },
    { offset: 0.9, amp: 0.15, freq: 5, phase: 2, width: 0.18, flower: flowerIdx(2, WHITE), weight: 0.7 },
  ]
  // Các dải màu uốn lượn trên sườn đồi hai bên; mỗi dải một màu và một loại hoa
  // 12 dải, mỗi dải một màu khác nhau (không dùng màu trắng), xếp xen kẽ hai bên
  const offsets = [-1.8, 2.0, -3.0, 3.2, -4.3, 4.5, -5.6, 5.8, -7.0, 7.2, -8.4, 8.6]
  const colors = [0, 7, 4, 10, 2, 6, 9, 3, 1, 5, 8, 0]
  const kinds = [0, 3, 2, 0, 3, 1, 0, 2, 3, 0, 2, 1]   // blossom / lily / daisy xen kẽ
  offsets.forEach((o, i) => {
    strands.push({
      offset: o * s,
      amp: (1.2 + Math.random() * 1.2) * s,
      freq: 2 + (i % 3),
      phase: Math.random() * TAU,
      width: (0.6 + Math.random() * 0.6) * s,
      flower: flowerIdx(kinds[i], colors[i] % colorN),
      weight: 1.3 - Math.abs(o) * 0.05,
    })
  })
  return strands
}

function strandX(st: Strand, z: number) {
  return pathX(z) + st.offset + st.amp * Math.sin((TAU * st.freq * z) / DEPTH + st.phase)
}

function createField(count: number, halfWidth: number, colorN: number, flowerN: number): Point[] {
  const pts: Point[] = []
  const strands = makeStrands(halfWidth, colorN)
  const totalWeight = strands.reduce((a, s) => a + s.weight, 0)
  const pickStrand = () => {
    let r = Math.random() * totalWeight
    for (const s of strands) { r -= s.weight; if (r <= 0) return s }
    return strands[strands.length - 1]
  }

  for (let i = 0; i < count; i++) {
    const z = Math.random() * DEPTH
    let x: number, flower: number, scale = 1
    if (Math.random() < 0.72) {
      // Hoa mọc theo dải uốn lượn; đa số cùng màu với dải
      const st = pickStrand()
      x = strandX(st, z) + gauss() * st.width
      flower = Math.random() < 0.85 ? st.flower : Math.floor(Math.random() * flowerN)
      if (st.width < 0.2) scale = 0.6 // hàng viền lối đi: hoa nhỏ
    } else {
      // Rải thưa trên sườn đồi, tránh lối đi
      const d = (Math.random() < 0.5 ? -1 : 1) * (1.2 + Math.random() * halfWidth * 1.1)
      x = pathX(z) + d
      flower = Math.floor(Math.random() * flowerN)
      scale = 0.8
    }
    const d = x - pathX(z)
    if (Math.abs(d) < 0.7) x = pathX(z) + (d < 0 ? -0.7 : 0.7)
    pts.push({
      x, z,
      g: terrain(x, z),
      y: (0.12 + Math.random() * 0.4) * scale, // chiều cao thân
      size: (0.13 + Math.random() * 0.17) * scale,
      flower,
      rot: Math.random() * Math.PI * 2,
      phase: Math.random() * Math.PI * 2,
      twinkle: 0.6 + Math.random() * 1.4,
      leafSide: Math.random() < 0.55 ? (Math.random() < 0.5 ? -1 : 1) : 0,
      leafAt: 0.2 + Math.random() * 0.3,
      leafAngle: 0.55 + Math.random() * 0.5,
    })
  }
  return pts
}

export default function NightFlowerField({ className = '' }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const flowers = KINDS.flatMap(k => PETAL_COLORS.map(c => makeFlowerSprite(k, c)))
    const nearDots = PETAL_COLORS.map(c => makeDotSprite(c))
    const leaf = makeLeafSprite()
    const grainPattern = ctx.createPattern(makeGrainTile(), 'repeat')

    const bloom = document.createElement('canvas')
    const bloomCtx = bloom.getContext('2d')!
    const rays = document.createElement('canvas')

    let w = 0, h = 0, dpr = 1
    let points: Point[] = []
    let dust: Dust[] = []
    let quality = 1

    function build() {
      const small = w < 820
      const area = (w * h) / 1000
      const count = Math.round(Math.min(7500, Math.max(3200, area * (small ? 6.5 : 5.4))) * quality)
      const halfWidth = Math.min(HALF_WIDTH, Math.max(4, HALF_WIDTH * (w / h) / 1.6))
      points = createField(count, halfWidth, PETAL_COLORS.length, flowers.length)
      dust = Array.from({ length: small ? 30 : 60 }, () => ({
        x: Math.random(), y: Math.random(), r: 0.5 + Math.random() * 1.3,
        speed: 0.004 + Math.random() * 0.01, phase: Math.random() * Math.PI * 2,
      }))
    }

    function buildRays() {
      rays.width = Math.max(1, Math.round(w / 2))
      rays.height = Math.max(1, Math.round(h / 2))
      const g = rays.getContext('2d')!
      g.clearRect(0, 0, rays.width, rays.height)
      g.filter = 'blur(22px)'
      const rh = rays.height * 0.8
      ;[0.24, 0.52, 0.78].forEach((cx, i) => {
        const x = cx * rays.width
        const top = rays.width * 0.012, bottom = rays.width * (0.06 + i * 0.012)
        const grad = g.createLinearGradient(0, 0, 0, rh)
        grad.addColorStop(0, 'rgba(200,215,255,0.08)')
        grad.addColorStop(1, 'rgba(200,215,255,0)')
        g.fillStyle = grad
        g.beginPath()
        g.moveTo(x - top, 0); g.lineTo(x + top, 0)
        g.lineTo(x + bottom + rays.width * 0.03, rh); g.lineTo(x - bottom + rays.width * 0.03, rh)
        g.closePath(); g.fill()
      })
      g.filter = 'none'
    }

    function resize() {
      w = window.innerWidth
      h = window.innerHeight
      dpr = Math.min(window.devicePixelRatio || 1, w < 820 ? 1.25 : 1.5)
      canvas!.width = Math.round(w * dpr)
      canvas!.height = Math.round(h * dpr)
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
      bloom.width = Math.max(1, Math.round(w / 8))
      bloom.height = Math.max(1, Math.round(h / 8))
      buildRays()
      build()
    }

    const mouse = { x: -9999, y: -9999, sx: -9999, sy: -9999, nx: 0, ny: 0, snx: 0, sny: 0 }
    let lastScroll = window.scrollY
    let scrollSpeed = 0
    let drift = 0
    let time = 0

    const onPointer = (e: PointerEvent) => {
      mouse.x = e.clientX; mouse.y = e.clientY
      mouse.nx = e.clientX / w - 0.5; mouse.ny = e.clientY / h - 0.5
      if (mouse.sx < -9000) { mouse.sx = mouse.x; mouse.sy = mouse.y }
    }
    const onLeave = () => { mouse.x = mouse.y = -9999 }

    function draw(dt: number) {
      time += dt
      if (!reduced) drift += dt * DRIFT_SPEED

      const sy = window.scrollY
      scrollSpeed += (Math.abs(sy - lastScroll) / Math.max(dt, 1 / 120) - scrollSpeed) * 0.08
      lastScroll = sy
      const camZ = drift + sy * SCROLL_TO_DEPTH

      if (mouse.x > -9000) {
        mouse.sx += (mouse.x - mouse.sx) * 0.12
        mouse.sy += (mouse.y - mouse.sy) * 0.12
      } else {
        mouse.sx = mouse.sy = -9999
      }
      mouse.snx += (mouse.nx - mouse.snx) * 0.04
      mouse.sny += (mouse.ny - mouse.sny) * 0.04

      const f = Math.max(w, h * 1.1) * 0.62
      const horizon = h * 0.36 - mouse.sny * h * 0.04
      // Camera bay dọc lối đi uốn lượn, quay đầu theo hướng lối đi phía trước
      const camPathX = pathX(camZ)
      const heading = (pathX(camZ + 6) - camPathX) / 6
      const camX = camPathX + mouse.snx * 0.8

      // ── Trời đêm + sương + tia sáng ──
      ctx!.globalCompositeOperation = 'source-over'
      ctx!.globalAlpha = 1
      const sky = ctx!.createLinearGradient(0, 0, 0, h)
      sky.addColorStop(0, '#03040a')
      sky.addColorStop(horizon / h, '#0c1430')
      sky.addColorStop(Math.min(1, horizon / h + 0.1), '#080d1c')
      sky.addColorStop(1, '#020308')
      ctx!.fillStyle = sky
      ctx!.fillRect(0, 0, w, h)

      ctx!.globalCompositeOperation = 'lighter'
      const haze = ctx!.createRadialGradient(w / 2, horizon, 0, w / 2, horizon, w * 0.75)
      haze.addColorStop(0, 'rgba(110,130,230,0.15)')
      haze.addColorStop(0.35, 'rgba(70,90,170,0.06)')
      haze.addColorStop(1, 'rgba(0,0,0,0)')
      ctx!.fillStyle = haze
      ctx!.fillRect(0, 0, w, h)
      ctx!.globalAlpha = 0.75 + 0.25 * Math.sin(time * 0.3)
      ctx!.drawImage(rays, Math.sin(time * 0.12) * w * 0.02, 0, w, h)

      // ── Thảm hoa ──
      const R = Math.min(w, h) * 0.22
      for (const p of points) {
        const zr = (((p.z - camZ) % DEPTH) + DEPTH) % DEPTH
        if (zr < NEAR) continue
        const near = 1 - zr / DEPTH

        let size = ((p.size * f) / zr) * (0.35 + 0.65 * smoothstep(0.15, 0.8, near))
        let alpha = smoothstep(0, 0.35, near) * (1 - smoothstep(0.9, 1, near))
        alpha *= 0.8 + 0.2 * Math.sin(time * p.twinkle + p.phase)

        // Chiếu lên màn hình: trừ hướng quay của camera, đặt hoa trên mặt đất địa hình
        const groundY = horizon + ((CAM_HEIGHT - p.g) * f) / zr
        let x = w / 2 + ((p.x - camX - zr * heading) * f) / zr
        let y = horizon + ((CAM_HEIGHT - p.g - p.y) * f) / zr
        let sway = 0
        if (!reduced) {
          sway = Math.sin(time * 0.8 + p.phase) * 0.08
          x += sway * size
        }

        let dx = 0, dy = 0
        if (mouse.sx > -9000) {
          const mx = x - mouse.sx, my = y - mouse.sy
          const d = Math.hypot(mx, my)
          if (d < R && d > 0.01) {
            const k = (1 - d / R) ** 2
            dx = (mx / d) * k * R * 0.35
            dy = (my / d) * k * R * 0.35
            size *= 1 + k * 0.5
            alpha = Math.min(1, alpha + k * 0.5)
          }
        }
        x += dx; y += dy
        if (alpha < 0.02) continue
        if (x < -size * 2 || x > w + size * 2 || y < -size * 2 || y > h + size * 2) continue

        if (size < DOT_BELOW_PX) {
          // Xa: đốm sáng cùng màu với bông hoa
          const img = nearDots[p.flower % nearDots.length]
          const s = Math.max(2, size * 1.3)
          ctx!.globalAlpha = alpha
          ctx!.drawImage(img, x - s / 2, y - s / 2, s, s)
          continue
        }

        // Hoa nghiêng theo góc nhìn: nhìn chéo xuống nên bông dẹt theo chiều dọc
        const tilt = Math.min(0.92, Math.max(0.42, (CAM_HEIGHT / zr) * 1.6))
        const img = flowers[p.flower]

        if (size < DETAIL_ABOVE_PX) {
          ctx!.globalAlpha = alpha
          ctx!.drawImage(img, x - size / 2, y - (size * tilt) / 2, size, size * tilt)
          continue
        }

        // Gần: thân + 2 lá + bông xoay
        const stemBottomX = x - dx * 0.6 - sway * size
        const stemBottomY = groundY + dy * 0.4
        ctx!.globalAlpha = alpha * 0.55
        ctx!.strokeStyle = 'rgba(110,210,180,0.8)'
        ctx!.lineWidth = Math.max(1, size * 0.035)
        ctx!.beginPath()
        ctx!.moveTo(stemBottomX, stemBottomY)
        ctx!.quadraticCurveTo(stemBottomX + sway * size * 0.5, (stemBottomY + y) / 2, x, y)
        ctx!.stroke()

        // 1 hoặc 2 lá, độ cao và góc khác nhau theo từng bông
        const leafSize = size * 0.5
        const sides = p.leafSide === 0 ? [-1, 1] : [p.leafSide]
        for (const side of sides) {
          const at = side < 0 ? p.leafAt : p.leafAt + 0.12
          ctx!.save()
          ctx!.translate(stemBottomX + (x - stemBottomX) * at, stemBottomY - (stemBottomY - y) * at)
          ctx!.rotate(side * (p.leafAngle + sway))
          ctx!.globalAlpha = alpha * 0.6
          ctx!.drawImage(leaf, -leafSize / 2, -leafSize, leafSize, leafSize)
          ctx!.restore()
        }

        ctx!.save()
        ctx!.translate(x, y)
        ctx!.scale(1, tilt)
        ctx!.rotate(p.rot + sway * 0.5)
        ctx!.globalAlpha = alpha
        ctx!.drawImage(img, -size / 2, -size / 2, size, size)
        ctx!.restore()
      }

      // ── Bụi sáng ──
      ctx!.fillStyle = '#dfe6ff'
      for (const d of dust) {
        if (!reduced) d.y -= d.speed * dt
        if (d.y < -0.02) { d.y = 1.02; d.x = Math.random() }
        const tw = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(time * 2 + d.phase))
        ctx!.globalAlpha = 0.3 * tw
        ctx!.beginPath()
        ctx!.arc(d.x * w + Math.sin(time * 0.4 + d.phase) * 12, d.y * h, d.r, 0, Math.PI * 2)
        ctx!.fill()
      }

      // ── Bloom nhẹ để giữ đường nét cánh hoa ──
      bloomCtx.globalCompositeOperation = 'copy'
      bloomCtx.drawImage(canvas!, 0, 0, bloom.width, bloom.height)
      ctx!.globalCompositeOperation = 'lighter'
      ctx!.globalAlpha = 0.32
      ctx!.drawImage(bloom, 0, 0, w, h)

      // ── Hạt nhiễu ──
      if (grainPattern) {
        ctx!.globalCompositeOperation = 'source-over'
        ctx!.globalAlpha = 0.03
        ctx!.save()
        ctx!.translate(Math.random() * 128, Math.random() * 128)
        ctx!.fillStyle = grainPattern
        ctx!.fillRect(-128, -128, w + 256, h + 256)
        ctx!.restore()
      }

      // ── Viền tối, siết lại khi cuộn nhanh ──
      ctx!.globalCompositeOperation = 'source-over'
      ctx!.globalAlpha = 1
      const tight = Math.min(1, scrollSpeed / 2500)
      const vig = ctx!.createRadialGradient(w / 2, h * 0.45, Math.min(w, h) * (0.35 - tight * 0.12), w / 2, h * 0.45, Math.max(w, h) * 0.8)
      vig.addColorStop(0, 'rgba(0,0,0,0)')
      vig.addColorStop(1, `rgba(0,0,0,${0.7 + tight * 0.2})`)
      ctx!.fillStyle = vig
      ctx!.fillRect(0, 0, w, h)
    }

    let raf = 0
    let last = performance.now()
    let slowFrames = 0
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      draw(dt)
      if (dt > 1 / 35 && quality > 0.4) {
        if (++slowFrames > 45) { quality -= 0.2; slowFrames = 0; build() }
      } else {
        slowFrames = Math.max(0, slowFrames - 1)
      }
      raf = requestAnimationFrame(loop)
    }
    const start = () => { if (!raf) { last = performance.now(); raf = requestAnimationFrame(loop) } }
    const stop = () => { cancelAnimationFrame(raf); raf = 0 }
    const onVisibility = () => (document.hidden ? stop() : start())

    resize()
    if (reduced) {
      draw(0)
      const onResizeStatic = () => { resize(); draw(0) }
      window.addEventListener('resize', onResizeStatic)
      return () => window.removeEventListener('resize', onResizeStatic)
    }

    window.addEventListener('resize', resize)
    window.addEventListener('pointermove', onPointer, { passive: true })
    document.addEventListener('pointerleave', onLeave)
    document.addEventListener('visibilitychange', onVisibility)
    start()
    return () => {
      stop()
      window.removeEventListener('resize', resize)
      window.removeEventListener('pointermove', onPointer)
      document.removeEventListener('pointerleave', onLeave)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  return (
    <div aria-hidden className={`pointer-events-none fixed inset-0 bg-[#03040a] ${className}`}>
      <canvas ref={canvasRef} className="block h-full w-full" />
    </div>
  )
}
