import React, { useCallback, useState } from 'react'
import MatchSimulatorIntroView from './MatchSimulatorIntroView'
import MatchSimulatorView from './MatchSimulatorView'

export default function MatchSimulatorFlowView({ lang = 'pl' }) {
  const [stage, setStage] = useState('intro')
  const openMatchEngine = useCallback(() => setStage('match'), [])

  return (
    <div className={`match-simulator-flow-v87 is-${stage}`}>
      {stage === 'intro'
        ? <MatchSimulatorIntroView lang={lang} onComplete={openMatchEngine} />
        : <div className="match-simulator-stage-v87"><MatchSimulatorView lang={lang} /></div>}
    </div>
  )
}
