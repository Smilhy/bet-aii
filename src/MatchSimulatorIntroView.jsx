import React, { useEffect, useMemo, useRef, useState } from 'react'

const INTRO_DURATION_MS = 5200
const COMPLETE_HOLD_MS = 420

const COPY = {
  pl: {
    loading: 'Ładowanie Bet+AI Piłka nożna Manager',
    ready: 'Silnik gotowy',
    kicker: 'BET+AI FOOTBALL MANAGER',
    tagline: 'Duże intro startowe • po 100% automatyczne przejście do meczu',
    steps: [
      'Inicjalizacja modeli AI',
      'Synchronizacja danych meczu',
      'Budowanie taktyki',
      'Ładowanie Match Engine',
      'Uruchamianie symulatora'
    ]
  },
  en: {
    loading: 'Loading Bet+AI Football Manager',
    ready: 'Match Engine ready',
    kicker: 'BET+AI FOOTBALL MANAGER',
    tagline: 'Large startup intro • auto transition to the match screen at 100%',
    steps: [
      'Initializing AI models',
      'Syncing match data',
      'Building tactics',
      'Loading Match Engine',
      'Starting simulator'
    ]
  }
}

export default function MatchSimulatorIntroView({ lang = 'pl', onComplete }) {
  const copy = COPY[lang] || COPY.pl
  const [progress, setProgress] = useState(0)
  const [finishing, setFinishing] = useState(false)
  const frameRef = useRef(0)
  const startRef = useRef(0)
  const completedRef = useRef(false)

  const stepIndex = useMemo(() => {
    if (progress < 20) return 0
    if (progress < 42) return 1
    if (progress < 65) return 2
    if (progress < 86) return 3
    return 4
  }, [progress])

  useEffect(() => {
    completedRef.current = false
    startRef.current = 0
    const animate = (now) => {
      if (!startRef.current) startRef.current = now
      const elapsed = now - startRef.current
      const raw = Math.min(1, elapsed / INTRO_DURATION_MS)
      const eased = 1 - Math.pow(1 - raw, 2.15)
      const next = Math.min(100, Math.round(eased * 1000) / 10)
      setProgress(next)

      if (raw < 1) {
        frameRef.current = window.requestAnimationFrame(animate)
        return
      }

      if (!completedRef.current) {
        completedRef.current = true
        setProgress(100)
        setFinishing(true)
        window.setTimeout(() => onComplete?.(), COMPLETE_HOLD_MS)
      }
    }

    frameRef.current = window.requestAnimationFrame(animate)
    return () => {
      if (frameRef.current) window.cancelAnimationFrame(frameRef.current)
    }
  }, [onComplete])

  return (
    <section className={`simulator-splash-v87 simulator-splash-large-v91 ${finishing ? 'is-finishing' : ''}`}>
      <img className="simulator-splash-image-v87" src="/betai-symulator-loading-v1.png" alt="Bet+AI Football Manager" />
      <div className="simulator-splash-vignette-v87" aria-hidden="true" />
      <div className="simulator-splash-light-v87" aria-hidden="true" />
      <div className="simulator-splash-scan-v87" aria-hidden="true" />

      <div className="simulator-splash-topcopy-v91">
        <small>{copy.kicker}</small>
        <p>{copy.tagline}</p>
      </div>

      <div className="simulator-splash-dock-v92">
        <div className="simulator-splash-loader-v87 simulator-splash-loader-large-v91 simulator-splash-loader-docked-v92">
          <div className="simulator-splash-loader-top-v87">
            <div>
              <small>BET+AI • MATCH ENGINE</small>
              <strong>{progress >= 100 ? copy.ready : copy.loading}</strong>
            </div>
            <b>{Math.round(progress)}%</b>
          </div>

          <div className="simulator-splash-track-v87">
            <i style={{ width: `${progress}%` }} />
          </div>

          <div className="simulator-splash-loader-bottom-v87">
            <span className="simulator-splash-dot-v87" />
            <strong>{copy.steps[stepIndex]}</strong>
            <em>{progress >= 100 ? '✓' : '•••'}</em>
          </div>

          <div className="simulator-splash-steps-v91 simulator-splash-steps-v92">
            {copy.steps.map((step, index) => (
              <span key={step} className={index <= stepIndex ? 'active' : ''}>{step}</span>
            ))}
          </div>
        </div>
      </div>

      <div className="simulator-splash-corner-v87">AI SIMULATOR</div>
    </section>
  )
}
