// Bet+AI V347 — wspólna polityka VALUE + Red Flag Guard dla całej zakładki FM AI.
// Daily Scanner i pełna analiza używają tych samych progów i tych samych blokad jakościowych.

export const VALUE_POLICY_V347 = Object.freeze({
  minCalibrationSamples: 30,
  minStrongCalibrationSamples: 100,
  minStrongModelAgreement: 65,
  minStrongReliability: 82,
  minStrongDataQuality: 88,
  minStrongEvPct: 8,
  minStrongMarketScore: 70,
  minStrongLeagueTrust: 55,
  strongEdgeExtraPp: 5,
  minValueEvPct: 3,
  minValueReliability: 62,
  minModelAgreement: 45,
  hardBlockConsensusAgreement: 45,
  hardBlockLeagueTrust: 42,
  outlierEdgePp: 22,
  outlierEvPct: 30
})

const n = (value, fallback = 0) => {
  const out = Number(value)
  return Number.isFinite(out) ? out : fallback
}
const clamp = (value, min, max) => Math.max(min, Math.min(max, n(value, min)))
const round1 = value => Math.round((n(value, 0) + Number.EPSILON) * 10) / 10

export function baseEdgeThresholdV347(key = '') {
  if (['home', 'draw', 'away'].includes(key)) return 6
  if (['bttsYes', 'bttsNo', 'btts'].includes(key)) return 5.5
  return 5
}

export function calibrationScoreV347(calibration = {}) {
  const status = String(calibration?.status || 'PENDING').toUpperCase()
  if (status === 'GOOD') return 92
  if (status === 'OK') return 76
  if (status === 'POOR') return 28
  return 45
}

export function classifyValueCandidateV347(candidate = {}, context = {}) {
  const quality = n(context.dataQuality, 0)
  const modelAgreement = n(context.modelAgreement, 65)
  const consensusSources = n(context.consensusSources, 0)
  const consensusAgreement = n(context.consensusAgreement, 0)
  const marketScore = n(context.marketScore, consensusSources > 0 ? consensusAgreement : 55)
  const marketDriftStatus = String(context.marketDriftStatus || 'PENDING').toUpperCase()
  const leagueTrustScore = context.leagueTrustScore == null ? null : n(context.leagueTrustScore, 0)
  const priceMoveAgainstPp = context.priceMoveAgainstPp == null ? null : n(context.priceMoveAgainstPp, 0)
  const calibration = candidate?.calibration || {}
  const samples = n(calibration?.samples, 0)

  let threshold = baseEdgeThresholdV347(candidate?.key || '')
  if (quality < 75) threshold += 4
  else if (quality < 85) threshold += 2.5
  else if (quality < 92) threshold += 1
  if (String(calibration?.status || '').toUpperCase() === 'OK') threshold += 0.75
  threshold += n(calibration?.leaguePenalty, 0)
  if (consensusSources >= 2 && consensusAgreement < 60) threshold += 1
  if (modelAgreement < 60) threshold += 1.5
  if (modelAgreement < 50) threshold += 2
  if (marketDriftStatus === 'WATCH') threshold += 1.25
  if (leagueTrustScore != null && leagueTrustScore < 60) threshold += 1
  threshold = round1(threshold)

  const calibrationScore = calibrationScoreV347(calibration)
  const reliabilityScore = Math.round(clamp(
    quality * 0.38 + modelAgreement * 0.20 + calibrationScore * 0.24 + marketScore * 0.18,
    0,
    100
  ))
  const calibrationStatus = String(calibration?.status || 'PENDING').toUpperCase()
  const reliabilityLabel = calibrationStatus === 'PENDING'
    ? 'PENDING'
    : calibrationStatus === 'POOR' || reliabilityScore < 65
      ? 'LOW'
      : reliabilityScore >= 82 ? 'HIGH' : 'MEDIUM'

  const edge = n(candidate?.edgePp, 0)
  const ev = n(candidate?.expectedValuePct, 0)
  const strongPriceSignal = edge >= threshold + VALUE_POLICY_V347.strongEdgeExtraPp && ev >= VALUE_POLICY_V347.minStrongEvPct
  const strongSampleReady = samples >= VALUE_POLICY_V347.minStrongCalibrationSamples
  const strongAgreementReady = modelAgreement >= VALUE_POLICY_V347.minStrongModelAgreement
  const strongMarketReady = marketScore >= VALUE_POLICY_V347.minStrongMarketScore
  const strongLeagueReady = leagueTrustScore == null || leagueTrustScore >= VALUE_POLICY_V347.minStrongLeagueTrust

  const redFlags = []
  if (quality < 75) redFlags.push({ level: 'BLOCK', code: 'LOW_DATA_QUALITY', text: `Data Quality ${Math.round(quality)}/100` })
  else if (quality < 88) redFlags.push({ level: 'WARN', code: 'DATA_QUALITY', text: `Data Quality ${Math.round(quality)}/100 poniżej progu STRONG` })
  if (samples < VALUE_POLICY_V347.minCalibrationSamples) redFlags.push({ level: 'BLOCK', code: 'CALIBRATION_SAMPLE', text: `Kalibracja ${samples}/${VALUE_POLICY_V347.minCalibrationSamples} prób` })
  else if (samples < VALUE_POLICY_V347.minStrongCalibrationSamples) redFlags.push({ level: 'WARN', code: 'STRONG_SAMPLE', text: `STRONG wymaga ${VALUE_POLICY_V347.minStrongCalibrationSamples} prób (${samples}/${VALUE_POLICY_V347.minStrongCalibrationSamples})` })
  if (calibrationStatus === 'POOR') redFlags.push({ level: 'BLOCK', code: 'POOR_CALIBRATION', text: 'Słaba kalibracja historyczna rynku' })
  if (modelAgreement < VALUE_POLICY_V347.minModelAgreement) redFlags.push({ level: 'BLOCK', code: 'MODEL_DISAGREEMENT', text: `Model agreement ${Math.round(modelAgreement)}%` })
  else if (modelAgreement < VALUE_POLICY_V347.minStrongModelAgreement) redFlags.push({ level: 'WARN', code: 'MODEL_AGREEMENT', text: `Model agreement ${Math.round(modelAgreement)}% poniżej progu STRONG` })
  if (consensusSources >= 2 && consensusAgreement < VALUE_POLICY_V347.hardBlockConsensusAgreement) redFlags.push({ level: 'BLOCK', code: 'MARKET_DISAGREEMENT', text: `Market consensus tylko ${Math.round(consensusAgreement)}%` })
  else if (consensusSources >= 2 && consensusAgreement < 60) redFlags.push({ level: 'WARN', code: 'MARKET_CONSENSUS', text: `Market consensus ${Math.round(consensusAgreement)}%` })
  if (marketDriftStatus === 'DRIFT') redFlags.push({ level: 'BLOCK', code: 'MODEL_DRIFT', text: 'Wykryto drift dla tego rynku' })
  else if (marketDriftStatus === 'WATCH') redFlags.push({ level: 'WARN', code: 'MODEL_DRIFT_WATCH', text: 'Rynek jest pod obserwacją driftu' })
  if (leagueTrustScore != null && leagueTrustScore < VALUE_POLICY_V347.hardBlockLeagueTrust) redFlags.push({ level: 'BLOCK', code: 'LOW_LEAGUE_TRUST', text: `League / Market Trust ${Math.round(leagueTrustScore)}/100` })
  else if (leagueTrustScore != null && leagueTrustScore < VALUE_POLICY_V347.minStrongLeagueTrust) redFlags.push({ level: 'WARN', code: 'LEAGUE_TRUST', text: `League / Market Trust ${Math.round(leagueTrustScore)}/100` })
  if (priceMoveAgainstPp != null && priceMoveAgainstPp <= -8) redFlags.push({ level: 'BLOCK', code: 'PRICE_MOVE_AGAINST', text: `Rynek przesunął się przeciw modelowi o ${Math.abs(round1(priceMoveAgainstPp))} pp` })
  if (edge >= VALUE_POLICY_V347.outlierEdgePp || ev >= VALUE_POLICY_V347.outlierEvPct) redFlags.push({ level: 'WARN', code: 'PRICE_OUTLIER', text: 'Nietypowo duża przewaga — wymaga dodatkowej weryfikacji ceny' })

  const hardBlocked = redFlags.some(flag => flag.level === 'BLOCK')
  let decision = 'NO_BET'
  let reason = 'Brak dodatniej przewagi nad ceną rynkową'

  if (candidate?.vigAdjusted === false) {
    reason = 'Brak pełnego rynku do wiarygodnego usunięcia marży bukmachera'
  } else if (hardBlocked) {
    const first = redFlags.find(flag => flag.level === 'BLOCK')
    reason = first?.text || 'Red Flag Guard zablokował rekomendację'
  } else if (reliabilityScore < VALUE_POLICY_V347.minValueReliability) {
    reason = 'Łączna wiarygodność modelu jest za niska'
  } else if (
    strongPriceSignal &&
    quality >= VALUE_POLICY_V347.minStrongDataQuality &&
    reliabilityScore >= VALUE_POLICY_V347.minStrongReliability &&
    strongSampleReady &&
    strongAgreementReady &&
    strongMarketReady &&
    strongLeagueReady
  ) {
    decision = 'STRONG_VALUE'
    reason = 'Duża przewaga cenowa potwierdzona kalibracją, zgodnością modeli i kontrolą rynku'
  } else if (edge >= threshold && ev >= VALUE_POLICY_V347.minValueEvPct) {
    decision = 'VALUE'
    if (strongPriceSignal && !strongSampleReady) {
      reason = `Value potwierdzone; STRONG VALUE wymaga min. ${VALUE_POLICY_V347.minStrongCalibrationSamples} prób (${samples}/${VALUE_POLICY_V347.minStrongCalibrationSamples})`
    } else if (strongPriceSignal && !strongAgreementReady) {
      reason = `Value potwierdzone; STRONG VALUE wymaga model agreement ≥ ${VALUE_POLICY_V347.minStrongModelAgreement}%`
    } else if (strongPriceSignal && !strongMarketReady) {
      reason = `Value potwierdzone; STRONG VALUE wymaga Market Score ≥ ${VALUE_POLICY_V347.minStrongMarketScore}`
    } else if (strongPriceSignal && !strongLeagueReady) {
      reason = `Value potwierdzone; STRONG VALUE wymaga League / Market Trust ≥ ${VALUE_POLICY_V347.minStrongLeagueTrust}`
    } else if (strongPriceSignal && quality < VALUE_POLICY_V347.minStrongDataQuality) {
      reason = `Value potwierdzone; STRONG VALUE wymaga Data Quality ≥ ${VALUE_POLICY_V347.minStrongDataQuality}`
    } else if (strongPriceSignal && reliabilityScore < VALUE_POLICY_V347.minStrongReliability) {
      reason = `Value potwierdzone; STRONG VALUE wymaga Reliability ≥ ${VALUE_POLICY_V347.minStrongReliability}`
    } else {
      reason = 'Przewaga przekracza wymagany próg po kontroli kalibracji i Red Flag Guard'
    }
  } else if (edge > 0 && ev > 0) {
    decision = 'SMALL_EDGE'
    reason = 'Dodatnia przewaga, ale poniżej bezpiecznego progu'
  }

  return {
    ...candidate,
    threshold,
    decision,
    reason,
    reliabilityScore,
    reliabilityLabel,
    policyVersion: 'BETAI_VALUE_POLICY_V347',
    redFlags,
    redFlagCount: redFlags.length,
    hardBlocked,
    strongGuard: {
      sampleReady: strongSampleReady,
      agreementReady: strongAgreementReady,
      marketReady: strongMarketReady,
      leagueReady: strongLeagueReady,
      requiredSamples: VALUE_POLICY_V347.minStrongCalibrationSamples,
      requiredAgreement: VALUE_POLICY_V347.minStrongModelAgreement,
      requiredMarketScore: VALUE_POLICY_V347.minStrongMarketScore,
      requiredLeagueTrust: VALUE_POLICY_V347.minStrongLeagueTrust
    }
  }
}
