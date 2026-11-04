'use client'

// Viền phát sáng chuyển động (dựa trên "Pulsating Border" của Originkit,
// shader PulsingBorder của @paper-design/shaders-react).
//
// Cách dùng: đặt bên trong một khung `relative` KHÔNG có overflow-hidden, cạnh card:
//   <div className="relative">
//     <PulsatingBorder colors={...} cornerRadius={24} />
//     <div className="relative z-10 rounded-3xl overflow-hidden">…card…</div>
//   </div>
// Lớp sáng phủ kín khung cha và tràn ra ngoài để vẽ quầng sáng.
//
// Khác bản gốc:
// - Không portal ra document.body: card không nằm trong phần tử nào cắt tràn, nên
//   bỏ được việc theo dõi cuộn trang để dời lớp sáng (tránh lớp sáng trễ khi cuộn).
// - Chỉ tạo canvas WebGL khi card nằm trong/gần màn hình: trình duyệt giới hạn
//   khoảng 16 WebGL context cùng lúc, danh sách nhiều phòng sẽ vượt giới hạn.
// - Độ bo góc tính từ cornerRadius (px) và kích thước thật, để khớp góc của card.
// - Tôn trọng prefers-reduced-motion: đứng yên thay vì chuyển động.

import { useEffect, useRef, useState } from 'react'
import { PulsingBorder } from '@paper-design/shaders-react'

type Props = {
  colors: string[]
  /** Bán kính bo góc của card (px), để viền khớp góc */
  cornerRadius: number
  speed?: number
  thickness?: number   // 0–100
  softness?: number    // 0–100
  intensity?: number   // 0–100
  bloom?: number       // 0–100
  spotSize?: number    // 0–100
  /** Khoảng quầng sáng tràn ra ngoài khung (px) */
  spread?: number
  className?: string
}

const SPOTS = 3
const PULSE = 0
const SMOKE = 0.35
const SMOKE_SIZE = 0.63
// Chừa thêm chỗ ngoài "thế giới" của shader để quầng sáng mờ hẳn trước mép canvas
const GLOW_ROOM = 0.4
const MAX_ROOM = 480

export default function PulsatingBorder({
  colors,
  cornerRadius,
  speed = 1,
  thickness = 5,
  softness = 75,
  intensity = 30,
  bloom = 50,
  spotSize = 60,
  spread = 31,
  className = '',
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [visible, setVisible] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)

  // Kích thước khung
  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const read = () => {
      const w = host.clientWidth, h = host.clientHeight
      setSize(prev => (prev.w === w && prev.h === h ? prev : { w, h }))
    }
    read()
    const ro = new ResizeObserver(read)
    ro.observe(host)
    return () => ro.disconnect()
  }, [])

  // Chỉ dựng WebGL khi khung ở gần màn hình
  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { rootMargin: '200px' })
    io.observe(host)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReducedMotion(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  // "Thế giới" của shader = khung + spread mỗi bên; margin đặt viền về đúng khung.
  const worldW = size.w + spread * 2
  const worldH = size.h + spread * 2
  const marginX = worldW > 0 ? spread / worldW : 0
  const marginY = worldH > 0 ? spread / worldH : 0
  const room = Math.min(MAX_ROOM, Math.ceil(GLOW_ROOM * Math.min(worldW, worldH)))
  const bleed = spread + room

  // Shader: bán kính góc = roundness × nửa cạnh ngắn của khung
  const halfShort = Math.min(size.w, size.h) / 2
  const roundness = halfShort > 0 ? Math.min(1, cornerRadius / halfShort) : 0

  const ready = size.w > 0 && size.h > 0 && visible

  return (
    <div ref={hostRef} aria-hidden className={`pointer-events-none absolute inset-0 ${className}`}>
      {ready && (
        <PulsingBorder
          colors={colors}
          colorBack="rgba(0, 0, 0, 0)"
          speed={reducedMotion ? 0 : speed}
          roundness={roundness}
          thickness={thickness / 100}
          softness={softness / 100}
          intensity={intensity / 100}
          bloom={bloom / 100}
          spots={SPOTS}
          spotSize={(spotSize / 100) * 0.5}
          pulse={PULSE}
          smoke={SMOKE}
          smokeSize={SMOKE_SIZE}
          worldWidth={worldW}
          worldHeight={worldH}
          fit="none"
          marginLeft={marginX}
          marginRight={marginX}
          marginTop={marginY}
          marginBottom={marginY}
          scale={1}
          rotation={0}
          offsetX={0}
          offsetY={0}
          originX={0.5}
          originY={0.5}
          frame={0}
          style={{
            position: 'absolute',
            left: -bleed,
            top: -bleed,
            width: size.w + bleed * 2,
            height: size.h + bleed * 2,
          }}
        />
      )}
    </div>
  )
}
