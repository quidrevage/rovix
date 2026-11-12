import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { User } from '@/types/user'
import { UserMetrics } from '@/types/user'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Local calendar date as YYYY-MM-DD (the key used by the progress log). */
export function toDateKey(date: Date = new Date()): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return local.toISOString().split('T')[0]
}

export function calculateBMI(height: number, weight: number): number {
  const heightInMeters = height / 100
  return Number((weight / (heightInMeters * heightInMeters)).toFixed(1))
}

export function calculateBMR(user: User): number {
  if (!user.gender || !user.age || !user.height || !user.weight) {
    return 0
  }

  // Mifflin-St Jeor Equation
  if (user.gender === 'male') {
    return Math.round(10 * user.weight + 6.25 * user.height - 5 * user.age + 5)
  } else {
    return Math.round(10 * user.weight + 6.25 * user.height - 5 * user.age - 161)
  }
}

export function calculateTDEE(bmr: number, activityLevel: string): number {
  const multipliers = {
    sedentary: 1.2,
    light: 1.375,
    lightly_active: 1.375,
    moderate: 1.55,
    moderately_active: 1.55,
    active: 1.725,
    very_active: 1.725,
  }

  const multiplier = multipliers[activityLevel as keyof typeof multipliers] || 1.2
  return Math.round(bmr * multiplier)
}

export function calculateCalorieGoal(tdee: number, fitnessGoal: string): number {
  if (fitnessGoal === 'muscle_gain') {
    return tdee + 300 // Surplus for muscle gain
  } else if (fitnessGoal === 'fat_loss' || fitnessGoal === 'weight_loss') {
    return tdee - 500 // Deficit for fat loss
  }
  return tdee // Maintenance
}

/** Grams of protein per kilogram of body weight: 1.5-2 g/kg covers training needs without overshooting. */
export function proteinPerKg(fitnessGoal: string): number {
  if (fitnessGoal === 'muscle_gain') return 1.8
  // A deficit needs the upper end to keep muscle.
  if (fitnessGoal === 'fat_loss' || fitnessGoal === 'weight_loss') return 2
  return 1.6
}

export function calculateMacros(calories: number, fitnessGoal: string, weight: number) {
  // Protein follows body weight, fat is a share of calories, carbs take what is left.
  const protein = Math.round(Number(weight) * proteinPerKg(fitnessGoal))
  const fats = Math.round((calories * (fitnessGoal === 'muscle_gain' ? 0.25 : 0.3)) / 9) // 9 calories per gram

  return {
    protein,
    carbs: Math.max(0, Math.round((calories - protein * 4 - fats * 9) / 4)), // 4 calories per gram
    fats,
  }
}

export function calculateUserMetrics(user: User): UserMetrics | null {
  if (!user.height || !user.weight || !user.gender || !user.age || !user.activityLevel || !user.fitnessGoal) {
    return null
  }

  const bmi = calculateBMI(user.height, user.weight)
  const bmr = calculateBMR(user)
  const tdee = calculateTDEE(bmr, user.activityLevel)
  // calorieAdjust is the correction the user accepted on the progress page (see calorieAdvice).
  const calories = calculateCalorieGoal(tdee, user.fitnessGoal) + (Number(user.calorieAdjust) || 0)
  const macros = calculateMacros(calories, user.fitnessGoal, user.weight)

  return {
    bmi,
    bmr,
    tdee,
    calories,
    ...macros,
  }
}


const ADJUST_STEP = 150
const ADJUST_LIMIT = 450
const ADJUST_MIN_DAYS = 10

export interface CalorieAdvice {
  delta: number // kcal per day to add (positive) or remove (negative)
  days: number
  change: number // kg over those days
}

/**
 * Compares the logged weight trend with what the goal needs and suggests a small calorie correction,
 * the way a coach would after a couple of weeks. Null when the trend is fine or there is too little data.
 */
export function calorieAdvice(userData: any): CalorieAdvice | null {
  const since = String(userData?.calorieAdjustedAt || '')
  const from = new Date()
  from.setDate(from.getDate() - 28)
  const fromKey = toDateKey(from)
  const weights = ((userData?.progress || []) as any[])
    .filter((entry) => Number(entry?.weight) > 0 && entry.date >= fromKey && entry.date > since)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))
  if (weights.length < 2) return null

  const first = weights[0]
  const last = weights[weights.length - 1]
  const days = Math.round((new Date(`${last.date}T00:00:00`).getTime() - new Date(`${first.date}T00:00:00`).getTime()) / 86400000)
  if (days < ADJUST_MIN_DAYS) return null

  const change = Number(last.weight) - Number(first.weight)
  const perWeek = ((change / Number(first.weight)) * 100 * 7) / days // % of body weight per week
  const goal = String(userData?.fitnessGoal || '')
  // Healthy pace: losing 0.25-1% a week, gaining 0.1-0.5% a week, otherwise staying within 0.5%.
  const [low, high] =
    goal === 'fat_loss' || goal === 'weight_loss' ? [-1, -0.25] : goal === 'muscle_gain' ? [0.1, 0.5] : [-0.5, 0.5]
  const delta = perWeek > high ? -ADJUST_STEP : perWeek < low ? ADJUST_STEP : 0
  const total = (Number(userData?.calorieAdjust) || 0) + delta
  if (!delta || Math.abs(total) > ADJUST_LIMIT) return null
  return { delta, days, change: Math.round(change * 10) / 10 }
}
