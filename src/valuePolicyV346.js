// Bet+AI V346 — jedna polityka decyzji VALUE dla całej zakładki FM AI.
// Cel: Daily Scanner i pełna analiza mają identyczne progi STRONG/VALUE.

export const VALUE_POLICY_V346 = Object.freeze({
  minCalibrationSamples: 30,
  minStrongCalibrationSamples: 100,
  minStrongModelAgreement: 65,
  minStrongReliability: 82,
  minStrongDataQuality: 88,
  minStrongEvPct: 8,
  strongEdgeExtraPp: 5,
  minValueEvPct: 3,
  minValueReliability: 62,
  minModelAgreement: 45
})

const n = (value, fallback = 0) => {
  const out = Number(value)
  return Number.isFinite(out) ? out : fallback
}
const clamp = (value, min, max) => Math.max(min, Math.min(max, n(value, min)))
const round1 = value => Math.round((n(value, 0) + Number.EPSILON) * 10) / 10

export function baseEdgeThresholdV346(key = '') {
  if (['home', 'draw', 'away'].includes(key)) return 6
  if (['bttsYes', 'bttsNo', 'btts'].includes(key)) return 5.5
  return 5
}

export function calibrationScoreV346(calibration = {}) {
  const status = String(calibration?.status || 'PENDING').toUpperCase()
  if (status === 'GOOD') return 92
  if (status === 'OK') return 76
  if (status === 'POOR') return 28
  return 45
}

export function classifyValueCandidateV346(candidate = {}, context = {}) {
  const quality = n(context.dataQuality, 0)
  const modelAgreement = n(context.modelAgreement, 65)
  const consensusSources = n(context.consensusSources, 0)
  const consensusAgreement = n(context.consensusAgreement, 0)
  const marketScore = n(context.marketScore, consensusSources > 0 ? consensusAgreement : 55)
  const calibration = candidate?.calibration || {}
  const samples = n(calibration?.samples, 0)

  let threshold = baseEdgeThresholdV346(candidate?.key || '')
  if (quality < 75) threshold += 4
  else if (quality < 85) threshold += 2.5
  else if (quality < 92) threshold += 1
  if (String(calibration?.status || '').toUpperCase() === 'OK') threshold += 0.75
  threshold += n(calibration?.leaguePenalty, 0)
  if (consensusSources >= 2 && consensusAgreement < 60) threshold += 1
  if (modelAgreement < 60) threshold += 1.5
  if (modelAgreement < 50) threshold += 2
  threshold = round1(threshold)

  const calibrationScore = calibrationScoreV346(calibration)
  const reliabilityScore = Math.round(clamp(
    quality * 0.40 + modelAgreement * 0.20 + calibrationScore * 0.25 + marketScore * 0.15,
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
  const strongPriceSignal = edge >= threshold + VALUE_POLICY_V346.strongEdgeExtraPp && ev >= VALUE_POLICY_V346.minStrongEvPct
  const strongSampleReady = samples >= VALUE_POLICY_V346.minStrongCalibrationSamples
  const strongAgreementReady = modelAgreement >= VALUE_POLICY_V346.minStrongModelAgreement

  let decision = 'NO_BET'
  let reason = 'Brak dodatniej przewagi nad ceną rynkową'

  if (candidate?.vigAdjusted === false) {
    reason = 'Brak pełnego rynku do wiarygodnego usunięcia marży bukmachera'
  } else if (quality < 75) {
    reason = 'Za niska jakość danych'
  } else if (samples < VALUE_POLICY_V346.minCalibrationSamples || calibrationStatus === 'PENDING') {
    reason = `Za mała próbka kalibracji — ${samples}/${VALUE_POLICY_V346.minCalibrationSamples}`
  } else if (calibrationStatus === 'POOR') {
    reason = 'Model jest słabo skalibrowany dla tego rynku'
  } else if (modelAgreement < VALUE_POLICY_V346.minModelAgreement) {
    reason = 'Modele zbyt mocno się nie zgadzają — brak rekomendacji'
  } else if (consensusSources >= 2 && consensusAgreement < 45) {
    reason = 'Zewnętrzne źródła są zbyt rozbieżne — brak rekomendacji'
  } else if (reliabilityScore < VALUE_POLICY_V346.minValueReliability) {
    reason = 'Łączna wiarygodność modelu jest za niska'
  } else if (
    strongPriceSignal &&
    quality >= VALUE_POLICY_V346.minStrongDataQuality &&
    reliabilityScore >= VALUE_POLICY_V346.minStrongReliability &&
    strongSampleReady &&
    strongAgreementReady
  ) {
    decision = 'STRONG_VALUE'
    reason = 'Duża przewaga cenowa, min. 100 prób kalibracji i wysoka zgodność modeli'
  } else if (edge >= threshold && ev >= VALUE_POLICY_V346.minValueEvPct) {
    decision = 'VALUE'
    if (strongPriceSignal && !strongSampleReady) {
      reason = `Value potwierdzone; STRONG VALUE wymaga min. ${VALUE_POLICY_V346.minStrongCalibrationSamples} prób (${samples}/${VALUE_POLICY_V346.minStrongCalibrationSamples})`
    } else if (strongPriceSignal && !strongAgreementReady) {
      reason = `Value potwierdzone; STRONG VALUE wymaga model agreement ≥ ${VALUE_POLICY_V346.minStrongModelAgreement}%`
    } else if (strongPriceSignal && quality < VALUE_POLICY_V346.minStrongDataQuality) {
      reason = `Value potwierdzone; STRONG VALUE wymaga Data Quality ≥ ${VALUE_POLICY_V346.minStrongDataQuality}`
    } else if (strongPriceSignal && reliabilityScore < VALUE_POLICY_V346.minStrongReliability) {
      reason = `Value potwierdzone; STRONG VALUE wymaga Reliability ≥ ${VALUE_POLICY_V346.minStrongReliability}`
    } else {
      reason = 'Przewaga przekracza wymagany próg po kontroli kalibracji'
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
    policyVersion: 'BETAI_VALUE_POLICY_V346',
    strongGuard: {
      sampleReady: strongSampleReady,
      agreementReady: strongAgreementReady,
      requiredSamples: VALUE_POLICY_V346.minStrongCalibrationSamples,
      requiredAgreement: VALUE_POLICY_V346.minStrongModelAgreement
    }
  }
}
