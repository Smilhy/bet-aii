import React, { useCallback, useState } from 'react'
import MatchSimulatorIntroView from './MatchSimulatorIntroView'
import MatchSimulatorView from './MatchSimulatorView'
import MatchSimulatorDailyMatchesView from './MatchSimulatorDailyMatchesView'

export default function MatchSimulatorFlowView({ lang = 'pl' }) {
  const [stage, setStage] = useState('intro')
  const [selectedMatch, setSelectedMatch] = useState(null)
  const openDailyMatches = useCallback(() => setStage('matches'), [])
  const openMatchEngine = useCallback((match) => {
    setSelectedMatch(match || null)
    setStage('match')
  }, [])

  return (
    <div className={`match-simulator-flow-v87 is-${stage}`}>
      {stage === 'intro' && <MatchSimulatorIntroView lang={lang} onComplete={openDailyMatches} />}
      {stage === 'matches' && <MatchSimulatorDailyMatchesView lang={lang} onSelectMatch={openMatchEngine} />}
      {stage === 'match' && <div className="match-simulator-stage-v87"><MatchSimulatorView lang={lang} selectedMatch={selectedMatch} /></div>}
    </div>
  )
}
