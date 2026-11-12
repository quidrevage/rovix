import type { PlanChanges } from './plan'

// Types and helpers used on both sides of /api/ai. Nothing here may touch the API key.

export type Locale = 'en' | 'uk' | 'ru'

export interface ChatTurn {
  role: 'user' | 'assistant'
  content: string
}

export interface ChatResult {
  reply: string
  /** Edits to the saved plan the user asked for, already validated; null for a plain answer. */
  changes: PlanChanges | null
}

export interface ExerciseGuide {
  muscles: string[]
  steps: string[]
  mistakes: string[]
  breathing: string
}

/** Picks the reply language: the message's script, then the page locale for Cyrillic text. */
export function detectLanguage(text: string, userLocale?: string): string {
  if (/[іїєґ]/i.test(text)) return 'uk'
  if (/[ыэъё]/i.test(text)) return 'ru'
  if (/[а-я]/i.test(text)) return userLocale === 'uk' ? 'uk' : 'ru'
  return /[a-z]/i.test(text) ? 'en' : userLocale || 'en'
}

const PROFILE_FIELDS = [
  'name',
  'gender',
  'age',
  'height',
  'weight',
  'activityLevel',
  'fitnessGoal',
  'trainingFrequency',
  'equipmentAccess',
  'trainingNotes',
  'dietPreferences',
  'foodNotes',
  'mealsPerDay',
  'allergies',
] as const

/** The part of the saved user data the AI needs; the progress log and other local data stay in the browser. */
export function profileOf(userData: any): Record<string, unknown> {
  const profile: Record<string, unknown> = {}
  for (const field of PROFILE_FIELDS) {
    if (userData?.[field] != null) profile[field] = userData[field]
  }
  return profile
}
