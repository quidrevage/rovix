import { toDateKey } from './utils'

// The streak: days in a row on which the user recorded anything (a meal, a set, a weight...).

/** Remembers that something was saved today. Called on every save (see UserContext). */
export function withActiveDay(userData: any): any {
  if (!userData || typeof userData !== 'object') return userData
  const today = toDateKey()
  const days: string[] = userData.activeDays || []
  if (days[days.length - 1] === today) return userData
  return { ...userData, activeDays: [...days.filter((day) => day !== today), today].slice(-400) }
}

/** Days in a row up to today; a day that has not been used yet does not break yesterday's streak. */
export function streakOf(userData: any): number {
  const days = new Set<string>(userData?.activeDays || [])
  const date = new Date()
  if (!days.has(toDateKey(date))) date.setDate(date.getDate() - 1)
  let streak = 0
  while (days.has(toDateKey(date))) {
    streak++
    date.setDate(date.getDate() - 1)
  }
  return streak
}
