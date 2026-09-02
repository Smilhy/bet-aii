import React, { useEffect, useMemo, useState } from 'react'

const PROGRESS_TICK_MS = 70
const STEP_BREAKPOINTS = [18, 42, 66, 86, 100]

const STRINGS = {
  pl: {
    kicker: 'BET+AI FOOTBALL MANAGER',
    titlePrimary: 'Bet+AI',
    titleSecondary: 'Football Manager',
    subtitle: 'Symulator AI • ekran startowy. To jest animowane wejście do nowej zakładki, stylowo dopasowane do Twojej strony.',
    feature1: 'Strategia AI',
    feature1Sub: 'Adaptacyjne taktyki',
    feature2: 'Silnik meczu',
    feature2Sub: 'Symulacje w czasie rzeczywistym',
    feature3: 'Dane i analizy',
    feature3Sub: 'Inteligentne decyzje',
    loadingTitle: 'Ładowanie modułu Symulator AI...',
    loadingHint: 'Animacja startowa • etap 1',
    step1: 'Inicjalizacja modeli AI',
    step2: 'Synchronizacja danych meczu',
    step3: 'Budowanie taktyki',
    step4: 'Uruchamianie silnika meczu',
    step5: 'Prawie gotowe',
    rightTitle: 'Etap 1',
    rightBody: 'Po kliknięciu w zakładkę „Symulator AI” użytkownik widzi żywy ekran ładowania z neonowym postępem, pulsującym tłem i statusem uruchamiania modułu.',
    rightTag1: 'Zakładka gotowa do rozbudowy',
    rightTag2: 'Kolory 1:1 pod Bet+AI',
    rightTag3: 'Następny krok: prawdziwe dane meczu',
  },
  en: {
    kicker: 'BET+AI FOOTBALL MANAGER',
    titlePrimary: 'Bet+AI',
    titleSecondary: 'Football Manager',
    subtitle: 'AI Simulator • splash screen. This is the animated entry screen for the new tab, styled to match your platform.',
    feature1: 'AI Strategy',
    feature1Sub: 'Adaptive tactics',
    feature2: 'Match Engine',
    feature2Sub: 'Real-time simulations',
    feature3: 'Data & analysis',
    feature3Sub: 'Smarter decisions',
    loadingTitle: 'Loading AI Simulator module...',
    loadingHint: 'Start animation • step 1',
    step1: 'Initializing AI models',
    step2: 'Syncing match data',
    step3: 'Building tactics',
    step4: 'Starting match engine',
    step5: 'Almost ready',
    rightTitle: 'Step 1',
    rightBody: 'When the user clicks the “AI Simulator” tab, they see a live loading screen with neon progress, a pulsing background, and module startup status.',
    rightTag1: 'Tab ready for expansion',
    rightTag2: 'Colors matched to Bet+AI',
    rightTag3: 'Next step: real match data',
  }
}

function useLoopingProgress() {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const timer = window.setInterval(() => {
      setProgress(prev => {
        const next = prev + (prev < 70 ? 2 : prev < 92 ? 1 : 0.5)
        if (next >= 100) return 0
        return next
      })
    }, PROGRESS_TICK_MS)

    return () => window.clearInterval(timer)
  }, [])

  return progress
}

export default function MatchSimulatorIntroView({ lang = 'pl' }) {
  const copy = STRINGS[lang] || STRINGS.pl
  const progress = useLoopingProgress()
  const steps = useMemo(() => [copy.step1, copy.step2, copy.step3, copy.step4, copy.step5], [copy])
  const activeStepIndex = useMemo(() => STEP_BREAKPOINTS.findIndex(limit => progress <= limit), [progress])

  return (
    <section className="simulator-intro-page-v1">
      <div className="simulator-intro-hero-v1">
        <div className="simulator-intro-bg-v1" aria-hidden="true" />
        <div className="simulator-intro-overlay-v1" aria-hidden="true" />
        <div className="simulator-intro-grid-v1" aria-hidden="true" />
        <div className="simulator-intro-scan-v1" aria-hidden="true" />

        <div className="simulator-intro-copy-v1">
          <span className="simulator-intro-kicker-v1">{copy.kicker}</span>
          <h1>
            <span>{copy.titlePrimary}</span>
            <strong>{copy.titleSecondary}</strong>
          </h1>
          <p>{copy.subtitle}</p>

          <div className="simulator-intro-features-v1">
            <article>
              <i>🧠</i>
              <strong>{copy.feature1}</strong>
              <span>{copy.feature1Sub}</span>
            </article>
            <article>
              <i>⚽</i>
              <strong>{copy.feature2}</strong>
              <span>{copy.feature2Sub}</span>
            </article>
            <article>
              <i>🛡️</i>
              <strong>{copy.feature3}</strong>
              <span>{copy.feature3Sub}</span>
            </article>
          </div>

          <div className="simulator-intro-loader-v1">
            <div className="simulator-intro-loader-head-v1">
              <strong>{copy.loadingTitle}</strong>
              <span>{Math.round(progress)}%</span>
            </div>
            <div className="simulator-intro-loader-bar-v1">
              <i style={{ width: `${progress}%` }} />
            </div>
            <div className="simulator-intro-loader-meta-v1">
              <small>{copy.loadingHint}</small>
              <small>{steps[activeStepIndex] || steps[steps.length - 1]}</small>
            </div>
            <div className="simulator-intro-steps-v1">
              {steps.map((step, index) => (
                <span key={step} className={index <= activeStepIndex ? 'active' : ''}>{step}</span>
              ))}
            </div>
          </div>
        </div>

        <aside className="simulator-intro-sidecard-v1">
          <div className="simulator-intro-chip-v1">AI MATCH ENGINE</div>
          <h3>{copy.rightTitle}</h3>
          <p>{copy.rightBody}</p>
          <div className="simulator-intro-tags-v1">
            <span>{copy.rightTag1}</span>
            <span>{copy.rightTag2}</span>
            <span>{copy.rightTag3}</span>
          </div>
        </aside>
      </div>
    </section>
  )
}
