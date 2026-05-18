/**
 * Intent escolhido na primeira tela do Register (StepIntentionLarge).
 * Persistido em localStorage pra sobreviver à confirmação de email (auto-login) e
 * ser consumido no OnboardingTenant.
 */
export type OnboardingIntent = "monitor" | "campaigns" | "both"

const STORAGE_KEY = "zoe_onboarding_intent"

const FEATURES_BY_INTENT: Record<OnboardingIntent, string[]> = {
  monitor: ["intelligence"],
  campaigns: ["operations"],
  both: ["intelligence", "operations"],
}

export function setOnboardingIntent(intent: OnboardingIntent) {
  try { localStorage.setItem(STORAGE_KEY, intent) } catch { /* storage off */ }
}

export function getOnboardingIntent(): OnboardingIntent | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    return value === "monitor" || value === "campaigns" || value === "both" ? value : null
  } catch { return null }
}

export function clearOnboardingIntent() {
  try { localStorage.removeItem(STORAGE_KEY) } catch { /* storage off */ }
}

/** Códigos de feature a ativar pro intent. Default = ambos quando intent ausente. */
export function featuresForIntent(intent: OnboardingIntent | null): string[] {
  return intent ? FEATURES_BY_INTENT[intent] : FEATURES_BY_INTENT.both
}
