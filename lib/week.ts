import { toDateKey } from './utils'

// The training week: which workouts and exercises of the current 7-day plan are done.
// All functions take the saved user data and return a new copy, so they fit setUserData((current) => ...).

export interface WeekState {
  start: string // YYYY-MM-DD, the first day of this plan week
  doneDays: Record<number, string> // plan day (1-7) -> date it was completed
  doneExercises: Record<number, number[]> // plan day -> indexes of finished exercises
}

export const WEEK_DAYS = 7

export function weekOf(userData: any): WeekState {
  const week = userData?.week
  return {
    // Data saved before weeks existed: the week started when the plan was created.
    start: week?.start || toDateKey(new Date(userData?.createdAt || Date.now())),
    doneDays: week?.doneDays || {},
    doneExercises: week?.doneExercises || {},
  }
}

/** How many full days have passed since the week started (0 on the first day). */
export function daysInto(week: WeekState): number {
  const start = new Date(`${week.start}T00:00:00`).getTime()
  const today = new Date(`${toDateKey()}T00:00:00`).getTime()
  return Math.max(0, Math.round((today - start) / 86400000))
}

// Keeps the progress log (workouts per date) in step with the done marks.
function withWorkoutCount(progress: any[], date: string, delta: number): any[] {
  const next = [...(progress || [])]
  const index = next.findIndex((entry) => entry.date === date)
  if (index >= 0) next[index] = { ...next[index], workouts: Math.max(0, (next[index].workouts || 0) + delta) }
  else if (delta > 0) next.push({ date, workouts: delta })
  return next.sort((a, b) => String(a.date).localeCompare(String(b.date)))
}

const allIndexes = (count: number) => Array.from({ length: count }, (_, i) => i)

/** Marks a whole workout done (ticking all its exercises) or not done. */
export function setDayDone(userData: any, day: number, done: boolean, exerciseCount: number): any {
  const week = weekOf(userData)
  const doneOn = week.doneDays[day]
  if (Boolean(doneOn) === done) return userData

  const doneDays = { ...week.doneDays }
  if (done) doneDays[day] = toDateKey()
  else delete doneDays[day]

  return {
    ...userData,
    progress: withWorkoutCount(userData.progress, done ? toDateKey() : doneOn, done ? 1 : -1),
    week: { ...week, doneDays, doneExercises: { ...week.doneExercises, [day]: done ? allIndexes(exerciseCount) : [] } },
  }
}

/** Ticks or unticks one exercise; the workout becomes done when its last exercise is ticked. */
export function setExerciseDone(userData: any, day: number, index: number, done: boolean, exerciseCount: number): any {
  const week = weekOf(userData)
  const current = week.doneExercises[day] || []
  if (current.includes(index) === done) return userData
  const list = done ? [...current, index] : current.filter((item) => item !== index)

  if (list.length >= exerciseCount) return setDayDone(userData, day, true, exerciseCount)
  const base = week.doneDays[day] ? setDayDone(userData, day, false, exerciseCount) : userData
  const baseWeek = weekOf(base)
  return { ...base, week: { ...baseWeek, doneExercises: { ...baseWeek.doneExercises, [day]: list } } }
}

/** Starts a fresh week, optionally with a new plan. */
export function startNewWeek(userData: any, plan?: any): any {
  return {
    ...userData,
    ...(plan ? { plan, createdAt: Date.now() } : {}),
    week: { start: toDateKey(), doneDays: {}, doneExercises: {} },
  }
}

/** After the coach rewrites some workout days their exercise ticks no longer point at the same exercises. */
export function clearExerciseMarks(userData: any, days: number[]): any {
  const week = weekOf(userData)
  const doneExercises = { ...week.doneExercises }
  for (const day of days) if (!week.doneDays[day]) delete doneExercises[day]
  return { ...userData, week: { ...week, doneExercises } }
}
