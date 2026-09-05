import React, { useEffect, useMemo, useRef } from 'react'
import { getMatchFrameV320 } from './matchEngineV320'

const clamp = (v, a, b) => Math.max(a, Math.min(b, Number(v) || 0))

function color(value, fallback) {
  const raw = String(value || '').trim()
  if (/^#[0-9a-f]{3,8}$/i.test(raw)) return raw
  if (/^[0-9a-f]{6}$/i.test(raw)) return `#${raw}`
  return fallback
}

function teamColors(lineup, side) {
  return {
    player: color(lineup?.colors?.player?.primary, side === 'home' ? '#24d8dc' : '#597cf3'),
    number: color(lineup?.colors?.player?.number, side === 'home' ? '#07151b' : '#ffffff'),
    gk: color(lineup?.colors?.goalkeeper?.primary, '#f2cf42')
  }
}

function drawPitch(ctx, w, h) {
  const pad = 10
  const x = pad, y = pad, pw = w - pad * 2, ph = h - pad * 2
  ctx.save()
  const grad = ctx.createLinearGradient(0, y, 0, y + ph)
  grad.addColorStop(0, '#176f44')
  grad.addColorStop(1, '#0d5e38')
  ctx.fillStyle = grad
  ctx.fillRect(x, y, pw, ph)
  for (let i = 0; i < 10; i += 1) {
    ctx.fillStyle = i % 2 ? 'rgba(255,255,255,.025)' : 'rgba(0,0,0,.025)'
    ctx.fillRect(x + i * pw / 10, y, pw / 10, ph)
  }
  ctx.strokeStyle = 'rgba(255,255,255,.78)'
  ctx.lineWidth = Math.max(1, w / 850)
  ctx.strokeRect(x, y, pw, ph)
  ctx.beginPath(); ctx.moveTo(x + pw / 2, y); ctx.lineTo(x + pw / 2, y + ph); ctx.stroke()
  ctx.beginPath(); ctx.arc(x + pw / 2, y + ph / 2, ph * .13, 0, Math.PI * 2); ctx.stroke()
  const boxW = pw * .16, boxH = ph * .48
  ctx.strokeRect(x, y + (ph - boxH) / 2, boxW, boxH)
  ctx.strokeRect(x + pw - boxW, y + (ph - boxH) / 2, boxW, boxH)
  const sixW = pw * .06, sixH = ph * .23
  ctx.strokeRect(x, y + (ph - sixH) / 2, sixW, sixH)
  ctx.strokeRect(x + pw - sixW, y + (ph - sixH) / 2, sixW, sixH)
  ctx.restore()
}

function pxPoint(point, w, h) {
  const pad = 10
  return { x: pad + clamp(point.x, 0, 100) / 100 * (w - pad * 2), y: pad + clamp(point.y, 0, 100) / 100 * (h - pad * 2) }
}

function drawPlayer(ctx, player, side, colors, w, h, active, target) {
  const p = pxPoint(player, w, h)
  const radius = clamp(w / 105, 5.5, 10)
  ctx.save()
  if (active) {
    ctx.beginPath(); ctx.arc(p.x, p.y, radius + 5, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(255,255,255,.2)'; ctx.fill()
  }
  ctx.beginPath(); ctx.arc(p.x, p.y + radius * .38, radius * .88, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.fill()
  ctx.beginPath(); ctx.arc(p.x, p.y, radius, 0, Math.PI * 2)
  ctx.fillStyle = player.role === 'G' ? colors.gk : colors.player
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 1.2; ctx.stroke()
  ctx.fillStyle = player.role === 'G' ? '#111827' : colors.number
  ctx.font = `700 ${Math.max(7, radius * 1.05)}px system-ui, sans-serif`
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillText(String(player.number || player.index + 1 || '•'), p.x, p.y + .3)
  if (target) {
    const t = pxPoint(target, w, h)
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(t.x, t.y)
    ctx.strokeStyle = 'rgba(255,255,255,.26)'; ctx.lineWidth = 1; ctx.stroke()
  }
  if (w > 620 && player.name) {
    const short = String(player.name).trim().split(/\s+/).at(-1)
    ctx.font = `600 ${Math.max(8, radius * .88)}px system-ui, sans-serif`
    const tw = ctx.measureText(short).width + 8
    ctx.fillStyle = 'rgba(3,11,18,.68)'; ctx.fillRect(p.x - tw / 2, p.y + radius + 3, tw, 14)
    ctx.fillStyle = '#fff'; ctx.fillText(short, p.x, p.y + radius + 10)
  }
  ctx.restore()
}

function drawBall(ctx, ball, w, h, segment, progress) {
  const p = pxPoint(ball, w, h)
  const r = clamp(w / 220, 3, 5.2)
  ctx.save()
  ctx.beginPath(); ctx.arc(p.x + 2, p.y + 3, r * .9, 0, Math.PI * 2); ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.fill()
  ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill(); ctx.strokeStyle = '#111827'; ctx.lineWidth = 1; ctx.stroke()
  ctx.beginPath(); ctx.arc(p.x - r * .18, p.y - r * .12, r * .32, 0, Math.PI * 2); ctx.fillStyle = '#111827'; ctx.fill()
  if (segment && ['cross','throughBall','shot','goal','pass'].includes(segment.type) && progress < .98) {
    const start = pxPoint(segment.start, w, h), end = pxPoint(segment.end, w, h)
    ctx.setLineDash([4, 6]); ctx.beginPath(); ctx.moveTo(start.x, start.y); ctx.lineTo(end.x, end.y); ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 1.2; ctx.stroke(); ctx.setLineDash([])
  }
  ctx.restore()
}

export default function RealisticMatchCanvasV320({ engine, clockSec = 0, running = false, speed = 1, lineups = {}, homeName = 'Gospodarze', awayName = 'Goście' }) {
  const canvasRef = useRef(null)
  const targetClockRef = useRef(clockSec)
  const smoothClockRef = useRef(clockSec)
  const dimsRef = useRef({ w: 900, h: 540 })
  const colors = useMemo(() => ({ home: teamColors(lineups?.home, 'home'), away: teamColors(lineups?.away, 'away') }), [lineups])

  useEffect(() => { targetClockRef.current = clockSec }, [clockSec])
  useEffect(() => { smoothClockRef.current = clockSec }, [engine?.seed])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !engine) return undefined
    const parent = canvas.parentElement
    const resize = () => {
      const rect = parent.getBoundingClientRect()
      const cssW = Math.max(320, rect.width)
      const cssH = Math.max(250, cssW * .59)
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      canvas.style.width = `${cssW}px`
      canvas.style.height = `${cssH}px`
      canvas.width = Math.round(cssW * dpr)
      canvas.height = Math.round(cssH * dpr)
      dimsRef.current = { w: cssW, h: cssH, dpr }
    }
    resize()
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null
    observer?.observe(parent)
    let raf = 0
    const render = () => {
      const { w, h, dpr = 1 } = dimsRef.current
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      const diff = targetClockRef.current - smoothClockRef.current
      smoothClockRef.current += diff * (running ? .28 : .6)
      if (Math.abs(diff) < .02) smoothClockRef.current = targetClockRef.current
      const frame = getMatchFrameV320(engine, smoothClockRef.current)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)
      drawPitch(ctx, w, h)
      const fromKey = frame.segment?.fromKey || ''
      const toKey = frame.segment?.toKey || ''
      frame.home.forEach(p => drawPlayer(ctx, p, 'home', colors.home, w, h, p.key === fromKey || p.key === toKey, p.key === toKey ? frame.segment?.end : null))
      frame.away.forEach(p => drawPlayer(ctx, p, 'away', colors.away, w, h, p.key === fromKey || p.key === toKey, p.key === toKey ? frame.segment?.end : null))
      drawBall(ctx, frame.ball, w, h, frame.segment, frame.progress)
      raf = requestAnimationFrame(render)
    }
    raf = requestAnimationFrame(render)
    return () => { cancelAnimationFrame(raf); observer?.disconnect() }
  }, [engine, colors, running, speed])

  const frame = useMemo(() => engine ? getMatchFrameV320(engine, clockSec) : null, [engine, Math.floor(clockSec)])
  return (
    <div className="v320-pitch-shell">
      <canvas ref={canvasRef} className="v320-match-canvas" aria-label={`Realistyczna symulacja 2D ${homeName} kontra ${awayName}`} />
      <div className="v320-engine-chip"><b>V320 REALISTIC 2D</b><span>seed {engine?.seed ?? '—'}</span></div>
      <div className={`v320-live-action ${frame?.segment?.danger >= .7 ? 'danger' : ''}`}>
        <small>{frame?.segment?.type ? String(frame.segment.type).toUpperCase() : 'POSSESSION'}</small>
        <strong>{frame?.segment?.commentary || 'Budowanie akcji'}</strong>
      </div>
    </div>
  )
}
