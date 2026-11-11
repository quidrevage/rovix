import { DEMO_KEYS } from './exercises'

// One place that knows the stored plan format: the pages read it through the view helpers below,
// and the AI coach edits it through sanitizeChanges + applyPlanChanges.

export interface PlanExercise {
  name: string
  sets: string
  reps: string
  weight?: string // recommended load, free text ("2 × 10 kg", "bodyweight")
  notes?: string
  rest?: number // seconds
  demo?: string // key of a built-in demo from lib/exercises
}

export interface PlanMeal {
  meal: string
  options: string[]
  calories?: number
  protein?: string
  carbs?: string
  fats?: string
}

/** What the AI coach may change: whole days (replaced as a unit) and the daily targets. */
export interface PlanChanges {
  workoutDays?: { day: number; focus?: string; exercises: PlanExercise[] }[]
  mealDays?: { day: number; meals: PlanMeal[] }[]
  mealTargets?: { calories?: number; protein?: string; carbs?: string; fats?: string }
}

export interface ChangeSummary {
  workoutDays: number[]
  mealDays: number[]
  targets: boolean
}

export interface MealView extends PlanMeal {
  id: string
  name: string
  description: string
  calories: number
  protein: string
  carbs: string
  fats: string
  ingredients?: string[]
  instructions?: string[]
}

export interface MealDayView {
  id: string
  day: number
  date: string
  totalCalories: number
  totalProtein: string
  totalCarbs: string
  totalFats: string
  meals: MealView[]
}

export interface ExerciseView {
  id: string
  name: string
  sets: string
  reps: string
  restSeconds: number
  notes: string
  weight: string
  demo?: string
}

export interface WorkoutDayView {
  id: string
  day: number
  focus: string
  date: string
  estimatedDuration: number // minutes
  exercises: ExerciseView[]
}

const DEFAULT_REST = 60
const WEEK = 7

const text = (value: unknown, max = 200) => (value == null ? '' : String(value).trim().slice(0, max))

const toOptions = (meal: any): string[] => {
  if (Array.isArray(meal?.options)) return meal.options.map((option: unknown) => text(option)).filter(Boolean)
  if (meal?.options) return [text(meal.options)]
  if (meal?.description) return [text(meal.description)]
  return typeof meal === 'string' ? [meal] : []
}

const weeklyMealsOf = (mealPlan: any, fillWeek: boolean): any[] => {
  if (Array.isArray(mealPlan?.weeklyMeals) && mealPlan.weeklyMeals.length) return mealPlan.weeklyMeals
  // Plans saved before the weekly format hold a single day in dailyMeals.
  if (Array.isArray(mealPlan?.dailyMeals) && mealPlan.dailyMeals.length) {
    return Array.from({ length: fillWeek ? WEEK : 1 }, (_, i) => ({ day: i + 1, meals: mealPlan.dailyMeals }))
  }
  return []
}

// A day shows its own totals when its meals carry numbers; otherwise the plan-wide daily target.
const withDayTotals = (day: MealDayView): MealDayView => {
  const sum = (pick: (meal: MealView) => unknown) =>
    day.meals.reduce((total, meal) => total + (parseFloat(String(pick(meal))) || 0), 0)
  const calories = sum((meal) => meal.calories)
  if (!calories) return day
  const grams = (value: number, fallback: string) => (value ? `${Math.round(value)}g` : fallback)
  return {
    ...day,
    totalCalories: Math.round(calories),
    totalProtein: grams(sum((meal) => meal.protein), day.totalProtein),
    totalCarbs: grams(sum((meal) => meal.carbs), day.totalCarbs),
    totalFats: grams(sum((meal) => meal.fats), day.totalFats),
  }
}

export function getMealDays(mealPlan: any, fillWeek = false): MealDayView[] {
  const date = new Date().toISOString()
  return weeklyMealsOf(mealPlan, fillWeek).map((day, dayIndex) => ({
    id: `mp-${dayIndex}`,
    day: typeof day?.day === 'number' ? day.day : dayIndex + 1,
    date,
    totalCalories: mealPlan.calories || 0,
    totalProtein: mealPlan.macros?.protein || '0g',
    totalCarbs: mealPlan.macros?.carbs || '0g',
    totalFats: mealPlan.macros?.fats || '0g',
    meals: (Array.isArray(day?.meals) ? day.meals : []).map((meal: any, index: number) => {
      const name = meal?.meal || meal?.name || `Meal ${index + 1}`
      const options = toOptions(meal)
      return {
        id: `meal-${dayIndex}-${index}`,
        meal: name,
        name,
        options,
        description: meal?.description || options.join(', '),
        calories: Number(meal?.calories) || 0,
        protein: meal?.protein || '',
        carbs: meal?.carbs || '',
        fats: meal?.fats || '',
        ingredients: meal?.ingredients,
        instructions: meal?.instructions,
      }
    }),
  })).map(withDayTotals)
}

const setCount = (sets: unknown) => Math.min(Math.max(parseInt(String(sets), 10) || 3, 1), 10)

export function getWorkoutDays(workoutPlan: any): WorkoutDayView[] {
  if (!Array.isArray(workoutPlan)) return []
  const date = new Date().toISOString()
  return workoutPlan.map((day: any, index: number) => {
    const exercises: ExerciseView[] = (Array.isArray(day?.exercises) ? day.exercises : []).map((ex: any, i: number) => ({
      id: `ex-${index}-${i}`,
      name: text(ex?.name) || `Exercise ${i + 1}`,
      sets: text(ex?.sets, 20) || '3',
      reps: text(ex?.reps, 40) || '10',
      restSeconds: Number(ex?.rest) > 0 ? Number(ex.rest) : DEFAULT_REST,
      notes: ex?.notes || '',
      weight: text(ex?.weight, 60),
      demo: ex?.demo || undefined,
    }))
    // About 45 seconds of work per set plus the rest, with a 5-minute warm-up.
    const seconds = exercises.reduce((sum, ex) => sum + setCount(ex.sets) * (45 + ex.restSeconds), 0)
    return {
      id: `wp-${index}`,
      day: index + 1,
      focus: day?.focus || '',
      date,
      estimatedDuration: Math.max(10, Math.round((seconds / 60 + 5) / 5) * 5),
      exercises,
    }
  })
}

export function mealKind(name: string): 'breakfast' | 'lunch' | 'dinner' | 'snack' {
  const value = (name || '').toLowerCase()
  if (/breakfast|завтрак|сніданок/.test(value)) return 'breakfast'
  if (/lunch|обед|обід/.test(value)) return 'lunch'
  if (/dinner|ужин|вечеря/.test(value)) return 'dinner'
  return 'snack'
}

export const setsOf = setCount

/** A short copy of the plan for the AI prompt: only the fields the coach may read and change. */
export function compactPlan(plan: any) {
  return {
    workoutPlan: getWorkoutDays(plan?.workoutPlan).map((day) => ({
      day: day.day,
      focus: day.focus,
      exercises: day.exercises.map((ex) => ({
        name: ex.name,
        sets: ex.sets,
        reps: ex.reps,
        rest: ex.restSeconds,
        ...(ex.weight ? { weight: ex.weight } : {}),
        ...(ex.notes ? { notes: ex.notes } : {}),
        ...(ex.demo ? { demo: ex.demo } : {}),
      })),
    })),
    mealPlan: {
      calories: plan?.mealPlan?.calories || 0,
      macros: plan?.mealPlan?.macros || {},
      days: getMealDays(plan?.mealPlan, true).map((day) => ({
        day: day.day,
        meals: day.meals.map((meal) => ({
          meal: meal.meal,
          options: meal.options,
          calories: meal.calories,
          protein: meal.protein,
          carbs: meal.carbs,
          fats: meal.fats,
        })),
      })),
    },
  }
}

const dayNumber = (value: unknown) => {
  const day = parseInt(String(value).replace(/\D/g, ''), 10)
  return day >= 1 && day <= WEEK ? day : null
}

const grams = (value: unknown) => {
  const result = text(value, 20)
  return result && /^\d+(\.\d+)?$/.test(result) ? `${result}g` : result
}

function cleanExercise(raw: any): PlanExercise | null {
  const name = text(raw?.name, 120)
  if (!name) return null
  const rest = Number(raw?.rest)
  const demo = text(raw?.demo, 20)
  return {
    name,
    sets: text(raw?.sets, 20) || '3',
    reps: text(raw?.reps, 40) || '10',
    notes: text(raw?.notes, 300),
    ...(text(raw?.weight, 60) ? { weight: text(raw?.weight, 60) } : {}),
    ...(rest > 0 && rest <= 600 ? { rest: Math.round(rest) } : {}),
    ...(DEMO_KEYS.includes(demo) ? { demo } : {}),
  }
}

function cleanMeal(raw: any): PlanMeal | null {
  const meal = text(raw?.meal || raw?.name, 60)
  const options = toOptions(raw).slice(0, 6)
  if (!meal || options.length === 0) return null
  const calories = Number(raw?.calories)
  return {
    meal,
    options,
    ...(calories > 0 ? { calories: Math.round(calories) } : {}),
    protein: grams(raw?.protein),
    carbs: grams(raw?.carbs),
    fats: grams(raw?.fats),
  }
}

/** Validates whatever the model returned; anything malformed is dropped rather than saved. */
export function sanitizeChanges(raw: any): PlanChanges | null {
  if (!raw || typeof raw !== 'object') return null
  const changes: PlanChanges = {}

  const workoutDays = (Array.isArray(raw.workoutDays) ? raw.workoutDays : [])
    .map((item: any) => {
      const day = dayNumber(item?.day)
      if (!day || !Array.isArray(item?.exercises)) return null
      const exercises = item.exercises.map(cleanExercise).filter(Boolean).slice(0, 15) as PlanExercise[]
      return { day, focus: text(item.focus, 80), exercises }
    })
    .filter(Boolean)
  if (workoutDays.length) changes.workoutDays = workoutDays

  const mealDays = (Array.isArray(raw.mealDays) ? raw.mealDays : [])
    .map((item: any) => {
      const day = dayNumber(item?.day)
      if (!day || !Array.isArray(item?.meals)) return null
      const meals = item.meals.map(cleanMeal).filter(Boolean).slice(0, 8) as PlanMeal[]
      return meals.length ? { day, meals } : null
    })
    .filter(Boolean)
  if (mealDays.length) changes.mealDays = mealDays

  const targets = raw.mealTargets
  if (targets && typeof targets === 'object') {
    const calories = Number(targets.calories)
    const mealTargets = {
      ...(calories >= 800 && calories <= 8000 ? { calories: Math.round(calories) } : {}),
      ...(grams(targets.protein) ? { protein: grams(targets.protein) } : {}),
      ...(grams(targets.carbs) ? { carbs: grams(targets.carbs) } : {}),
      ...(grams(targets.fats) ? { fats: grams(targets.fats) } : {}),
    }
    if (Object.keys(mealTargets).length) changes.mealTargets = mealTargets
  }

  return Object.keys(changes).length ? changes : null
}

/** Returns a new plan with the changes applied, plus which days were touched. */
export function applyPlanChanges(plan: any, changes: PlanChanges): { plan: any; summary: ChangeSummary } {
  const summary: ChangeSummary = { workoutDays: [], mealDays: [], targets: false }
  const next = { ...plan }

  if (changes.workoutDays?.length) {
    const workoutPlan: any[] = Array.isArray(plan?.workoutPlan) ? [...plan.workoutPlan] : []
    for (const change of changes.workoutDays) {
      while (workoutPlan.length < change.day) {
        workoutPlan.push({ day: `Day ${workoutPlan.length + 1}`, focus: '', exercises: [] })
      }
      const current = workoutPlan[change.day - 1] || {}
      workoutPlan[change.day - 1] = {
        ...current,
        day: current.day || `Day ${change.day}`,
        focus: change.focus || current.focus || '',
        exercises: change.exercises,
      }
      summary.workoutDays.push(change.day)
    }
    next.workoutPlan = workoutPlan
  }

  if (changes.mealDays?.length || changes.mealTargets) {
    const { dailyMeals, ...mealPlan } = plan?.mealPlan || {}
    const weeklyMeals: any[] = weeklyMealsOf(plan?.mealPlan, true).map((day, index) => ({
      ...day,
      day: typeof day?.day === 'number' ? day.day : index + 1,
    }))

    for (const change of changes.mealDays || []) {
      const index = weeklyMeals.findIndex((day) => day.day === change.day)
      if (index >= 0) weeklyMeals[index] = { ...weeklyMeals[index], meals: change.meals }
      else weeklyMeals.push({ day: change.day, meals: change.meals })
      summary.mealDays.push(change.day)
    }
    weeklyMeals.sort((a, b) => a.day - b.day)

    const { calories, ...macros } = changes.mealTargets || {}
    summary.targets = Boolean(changes.mealTargets)
    next.mealPlan = {
      ...mealPlan,
      ...(calories ? { calories } : {}),
      macros: { ...mealPlan.macros, ...macros },
      weeklyMeals,
    }
  }

  summary.workoutDays = Array.from(new Set(summary.workoutDays)).sort((a, b) => a - b)
  summary.mealDays = Array.from(new Set(summary.mealDays)).sort((a, b) => a - b)
  return { plan: next, summary }
}

export const hasChanges = (summary: ChangeSummary) =>
  summary.workoutDays.length > 0 || summary.mealDays.length > 0 || summary.targets
