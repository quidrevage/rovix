'use client'

import React, { useEffect, useRef, useState } from 'react'
import { Pause, Play } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { ExerciseDemo, Point, Pose } from '@/lib/exercises'

// Body proportions in the 200x190 drawing box.
const TORSO = 44
const ARM = 22 // upper arm and forearm
const LEG = 34 // thigh and shin
const NECK = 15
const FLOOR = 177
const DEFAULT_PERIOD = 2.8

const COLORS = { body: '#374151', far: '#9ca3af', active: '#ff6b35', prop: '#9b59b6', scene: '#d1d5db' }

const lerp = (a: Point, b: Point, t: number): Point => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]

/** Two-segment limb from `root` towards `target`: returns the middle joint and the reachable end point. */
function limb(root: Point, target: Point, length: number, bend: number): { mid: Point; end: Point } {
  const dx = target[0] - root[0]
  const dy = target[1] - root[1]
  const distance = Math.hypot(dx, dy) || 0.001
  const ux = dx / distance
  const uy = dy / distance
  const reach = Math.min(distance, length * 2 - 0.01)
  const offset = Math.sqrt(Math.max(length * length - (reach / 2) ** 2, 0))
  return {
    mid: [root[0] + (ux * reach) / 2 - bend * offset * uy, root[1] + (uy * reach) / 2 + bend * offset * ux],
    end: [root[0] + ux * reach, root[1] + uy * reach],
  }
}

// Front view: the pose gives the right-hand side, the left is its mirror image around the centre line.
const SHOULDER_HALF = 12
const HIP_HALF = 7
const CENTER = 100

function solveFront(demo: ExerciseDemo, t: number) {
  const at = (key: 'hip' | 'sh' | 'hand' | 'foot') => lerp(demo.a[key], demo.b[key], t)
  const hip = at('hip')
  const shoulder = at('sh')
  const side = (sign: 1 | -1) => {
    const flip = (p: Point): Point => (sign > 0 ? p : [2 * CENTER - p[0], p[1]])
    const armRoot = flip([shoulder[0] + SHOULDER_HALF, shoulder[1]])
    const legRoot = flip([hip[0] + HIP_HALF, hip[1]])
    return {
      arm: { root: armRoot, ...limb(armRoot, flip(at('hand')), ARM, demo.elbow * sign) },
      leg: { root: legRoot, ...limb(legRoot, flip(at('foot')), LEG, demo.knee * sign) },
    }
  }
  const right = side(1)
  const left = side(-1)
  return {
    hip,
    shoulder,
    head: [shoulder[0], shoulder[1] - NECK] as Point,
    arm: right.arm,
    leg: right.leg,
    arm2: left.arm,
    leg2: left.leg,
  }
}

type Limb = { mid: Point; end: Point; root?: Point }
// A limb drawn from the body's centre line; front-view limbs pass through their own shoulder or hip first.
const limbPath = (from: Point, part: Limb) => path(from, ...(part.root ? [part.root] : []), part.mid, part.end)

function solve(demo: ExerciseDemo, t: number): { hip: Point; shoulder: Point; head: Point; arm: Limb; leg: Limb; arm2: Limb | null; leg2: Limb | null } {
  if (demo.view === 'front') return solveFront(demo, t)
  const { a, b } = demo
  const at = (key: keyof Pose) => lerp(a[key] as Point, b[key] as Point, t)

  const hip = at('hip')
  const rawShoulder = at('sh')
  const torso = Math.hypot(rawShoulder[0] - hip[0], rawShoulder[1] - hip[1]) || 1
  const dir: Point = [(rawShoulder[0] - hip[0]) / torso, (rawShoulder[1] - hip[1]) / torso]
  const shoulder: Point = [hip[0] + dir[0] * TORSO, hip[1] + dir[1] * TORSO]

  // A straight leg swinging from the hip moves on an arc; a straight line between the two poses would fold the knee.
  const swingFoot = (): Point => {
    const from = [a.foot[0] - a.hip[0], a.foot[1] - a.hip[1]]
    const to = [b.foot[0] - b.hip[0], b.foot[1] - b.hip[1]]
    const startAngle = Math.atan2(from[1], from[0])
    let turn = Math.atan2(to[1], to[0]) - startAngle
    if (turn > Math.PI) turn -= 2 * Math.PI
    if (turn < -Math.PI) turn += 2 * Math.PI
    const radius = Math.hypot(from[0], from[1]) * (1 - t) + Math.hypot(to[0], to[1]) * t
    const angle = startAngle + turn * t
    return [hip[0] + radius * Math.cos(angle), hip[1] + radius * Math.sin(angle)]
  }

  return {
    hip,
    shoulder,
    head: a.head && b.head ? at('head') : ([shoulder[0] + dir[0] * NECK, shoulder[1] + dir[1] * NECK] as Point),
    arm: limb(shoulder, at('hand'), ARM, demo.elbow),
    leg: limb(hip, demo.swingLegs ? swingFoot() : at('foot'), LEG, demo.knee),
    arm2: a.hand2 && b.hand2 ? limb(shoulder, at('hand2'), ARM, demo.elbow) : null,
    leg2: a.foot2 && b.foot2 ? limb(hip, at('foot2'), LEG, demo.knee) : null,
  }
}

const path = (...points: Point[]) => points.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ')

interface ExerciseFigureProps {
  demo: ExerciseDemo
}

/** Animated side-view figure with play/pause, slow motion and a scrubber to stop at any point of the movement. */
export default function ExerciseFigure({ demo }: ExerciseFigureProps) {
  const t = useTranslations('exercise')
  // Phase runs 0..1 over one repetition: 0 = start pose, 0.5 = end pose, 1 = back at the start.
  const [phase, setPhase] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [slow, setSlow] = useState(false)
  const phaseRef = useRef(0)

  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) setPlaying(false)
  }, [])

  useEffect(() => {
    if (!playing) return
    const period = (demo.period || DEFAULT_PERIOD) * (slow ? 2.5 : 1)
    let frame = 0
    let last = performance.now()
    const tick = (now: number) => {
      phaseRef.current = (phaseRef.current + (now - last) / 1000 / period) % 1
      last = now
      setPhase(phaseRef.current)
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [playing, slow, demo])

  const position = (1 - Math.cos(phase * 2 * Math.PI)) / 2 // eased 0 → 1 → 0
  const body = solve(demo, position)

  const scrub = (value: number) => {
    setPlaying(false)
    phaseRef.current = Math.acos(1 - 2 * value) / (2 * Math.PI)
    setPhase(phaseRef.current)
  }

  const towards = phase < 0.5 ? 'b' : 'a'
  const cue = demo.hold ? t('hold') : !demo.effort ? t('rhythm') : towards === demo.effort ? t('exhale') : t('inhale')
  const exhaling = Boolean(demo.effort) && towards === demo.effort

  const stroke = (part: 'legs' | 'arms' | 'core') => (demo.highlight === part ? COLORS.active : COLORS.body)
  const line = { fill: 'none', strokeWidth: 7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  const front = demo.view === 'front'
  const hand = body.arm.end
  const foot = body.leg.end

  return (
    <div>
      <div className="rounded-xl bg-gradient-to-b from-orange-50 to-white border border-gray-200">
        <svg viewBox="0 0 200 190" className="mx-auto h-auto max-h-[42vh] w-full" role="img" aria-label={t('animation')}>
          {/* Scene */}
          <line x1="8" y1={FLOOR + 4} x2="192" y2={FLOOR + 4} stroke={COLORS.scene} strokeWidth="2" strokeLinecap="round" />
          {demo.scene === 'mat' && <rect x="14" y={FLOOR} width="172" height="4" rx="2" fill="#e9d5ff" />}
          {demo.scene === 'bench' && (
            <g stroke={COLORS.scene} strokeWidth="5" strokeLinecap="round">
              <line x1="44" y1="141" x2="126" y2="141" strokeWidth="7" />
              <line x1="56" y1="144" x2="56" y2={FLOOR + 2} />
              <line x1="114" y1="144" x2="114" y2={FLOOR + 2} />
            </g>
          )}
          {demo.scene === 'bars' && (
            <g stroke={COLORS.scene} strokeWidth="5" strokeLinecap="round">
              <line x1="82" y1="113" x2="126" y2="113" strokeWidth="6" />
              <line x1="88" y1="116" x2="88" y2={FLOOR + 2} />
              <line x1="120" y1="116" x2="120" y2={FLOOR + 2} />
            </g>
          )}
          {demo.scene === 'seat' && (
            <g stroke={COLORS.scene} strokeWidth="7" strokeLinecap="round" fill="none">
              <path d="M34 106 L64 158 L92 160" />
              <line x1="64" y1="158" x2="64" y2={FLOOR + 2} strokeWidth="5" />
            </g>
          )}
          {demo.prop === 'bar' && (
            <g stroke={COLORS.scene} strokeWidth="5" strokeLinecap="round">
              <line x1="152" y1="20" x2="152" y2={FLOOR + 2} />
              <line x1={hand[0]} y1={hand[1] - 2} x2="152" y2="20" />
            </g>
          )}

          {/* Far-side limbs */}
          {body.leg2 && <path d={limbPath(body.hip, body.leg2)} stroke={front ? stroke('legs') : COLORS.far} {...line} />}
          {body.arm2 && <path d={limbPath(body.shoulder, body.arm2)} stroke={front ? stroke('arms') : COLORS.far} {...line} />}

          {/* Body */}
          <path d={limbPath(body.hip, body.leg)} stroke={stroke('legs')} {...line} />
          <path d={path(body.hip, body.shoulder)} stroke={stroke('core')} {...line} strokeWidth={9} />
          <circle cx={body.head[0]} cy={body.head[1]} r="9" fill={COLORS.body} />
          <path d={limbPath(body.shoulder, body.arm)} stroke={stroke('arms')} {...line} />

          {/* Equipment */}
          {demo.prop === 'dumbbell' && <circle cx={hand[0]} cy={hand[1]} r="6" fill={COLORS.prop} />}
          {demo.prop === 'dumbbell' && front && body.arm2 && <circle cx={body.arm2.end[0]} cy={body.arm2.end[1]} r="6" fill={COLORS.prop} />}
          {demo.prop === 'barbell' && (
            <g>
              <circle cx={hand[0]} cy={hand[1]} r="10" fill="none" stroke={COLORS.prop} strokeWidth="4" />
              <circle cx={hand[0]} cy={hand[1]} r="2.5" fill={COLORS.prop} />
            </g>
          )}
          {demo.prop === 'bar' && <circle cx={hand[0]} cy={hand[1]} r="4" fill={COLORS.prop} />}
          {demo.prop === 'platform' &&
            (() => {
              const dx = foot[0] - body.leg.mid[0]
              const dy = foot[1] - body.leg.mid[1]
              const length = Math.hypot(dx, dy) || 1
              const nx = (-dy / length) * 18
              const ny = (dx / length) * 18
              const cx = foot[0] + (dx / length) * 5
              const cy = foot[1] + (dy / length) * 5
              return <line x1={cx - nx} y1={cy - ny} x2={cx + nx} y2={cy + ny} stroke={COLORS.prop} strokeWidth="6" strokeLinecap="round" />
            })()}
        </svg>
      </div>

      <p
        className={`mt-2 text-center text-sm font-semibold ${exhaling ? 'text-fitness-orange' : 'text-gray-600'}`}
        aria-live="off"
      >
        {cue}
      </p>

      <div className="mt-2 flex items-center gap-3">
        <button
          type="button"
          onClick={() => setPlaying(!playing)}
          aria-label={playing ? t('pause') : t('play')}
          title={playing ? t('pause') : t('play')}
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-fitness-orange to-fitness-purple text-white hover:opacity-90"
        >
          {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 pl-0.5" />}
        </button>
        <input
          type="range"
          min="0"
          max="100"
          value={Math.round(position * 100)}
          onChange={(e) => scrub(Number(e.target.value) / 100)}
          aria-label={t('scrub')}
          className="h-2 flex-1 cursor-pointer accent-fitness-orange"
        />
        <button
          type="button"
          onClick={() => setSlow(!slow)}
          aria-pressed={slow}
          className={`flex-shrink-0 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
            slow ? 'border-fitness-orange bg-orange-50 text-fitness-orange' : 'border-gray-300 text-gray-600 hover:bg-gray-50'
          }`}
        >
          {t('slow')}
        </button>
      </div>
    </div>
  )
}
