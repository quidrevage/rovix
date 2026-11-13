import { toDateKey } from './utils'

// The lift journal: the weight and reps actually done in every set, per exercise name and date.
// The functions take the saved user data and return a new copy, so they fit setUserData((current) => ...).

export interface LiftSet {
  kg: number // 0 for bodyweight work
  reps: number
}

export interface LiftSession {
  date: string // YYYY-MM-DD
  sets: LiftSet[]
}

const MAX_SESSIONS = 100

export const liftKey = (name: string) => name.trim().toLowerCase()

/** All logged sessions of one exercise, oldest first. */
export function liftSessions(userData: any, name: string): LiftSession[] {
  return userData?.liftLog?.[liftKey(name)] || []
}

const withSessions = (userData: any, name: string, sessions: LiftSession[]) => {
  const liftLog = { ...userData?.liftLog }
  if (sessions.length) liftLog[liftKey(name)] = sessions.slice(-MAX_SESSIONS)
  else delete liftLog[liftKey(name)]
  return { ...userData, liftLog }
}

/** Adds one finished set to today's session of the exercise. */
export function addLiftSet(userData: any, name: string, set: LiftSet): any {
  const sessions = liftSessions(userData, name)
  const today = toDateKey()
  const last = sessions[sessions.length - 1]
  if (last?.date === today) return withSessions(userData, name, [...sessions.slice(0, -1), { date: today, sets: [...last.sets, set].slice(-20) }])
  return withSessions(userData, name, [...sessions, { date: today, sets: [set] }])
}

/** Forgets today's sets of the exercise (the set tracker was reset). */
export function clearLiftToday(userData: any, name: string): any {
  const today = toDateKey()
  return withSessions(userData, name, liftSessions(userData, name).filter((session) => session.date !== today))
}

/** The heaviest set; among equally heavy ones, the one with the most reps. */
export function bestSet(sets: LiftSet[]): LiftSet | null {
  return sets.reduce<LiftSet | null>(
    (best, set) => (!best || set.kg > best.kg || (set.kg === best.kg && set.reps > best.reps) ? set : best),
    null
  )
}

export const formatSet = (set: LiftSet) => (set.kg > 0 ? `${set.kg}×${set.reps}` : `${set.reps}`)
