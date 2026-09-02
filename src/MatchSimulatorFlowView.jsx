import React, { useCallback, useState } from 'react'
import MatchSimulatorIntroView from './MatchSimulatorIntroView'
import MatchSimulatorView from './MatchSimulatorView'
import MatchSimulatorDailyMatchesView from './MatchSimulatorDailyMatchesView'
import MatchSimulatorPreparationView from './MatchSimulatorPreparationView'

export default function MatchSimulatorFlowView({ lang = 'pl' }) {
  const [stage, setStage] = useState('intro')
  const [selectedMatch, setSelectedMatch] = useState(null)
  const [preparedData, setPreparedData] = useState(null)

  const openDailyMatches = useCallback(() => setStage('matches'), [])
  const openPreparation = useCallback((match) => {
    setSelectedMatch(match || null)
    setPreparedData(null)
    setStage('prep')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])
  const openMatchEngine = useCallback((match, data) => {
    setSelectedMatch(match || null)
    setPreparedData(data || null)
    setStage('match')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])
  const backToMatches = useCallback(() => {
    setPreparedData(null)
    setStage('matches')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  return (
    <div className={`match-simulator-flow-v87 is-${stage}`}>
      {stage === 'intro' && <MatchSimulatorIntroView lang={lang} onComplete={openDailyMatches} />}
      {stage === 'matches' && <MatchSimulatorDailyMatchesView lang={lang} onSelectMatch={openPreparation} />}
      {stage === 'prep' && <MatchSimulatorPreparationView lang={lang} match={selectedMatch} onBack={backToMatches} onStart={openMatchEngine} />}
      {stage === 'match' && <div className="match-simulator-stage-v87"><MatchSimulatorView lang={lang} selectedMatch={selectedMatch} initialData={preparedData} autoStart onBack={backToMatches} /></div>}
    </div>
  )
}
