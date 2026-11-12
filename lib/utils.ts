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
  const calories = calculateCalorieGoal(tdee, user.fitnessGoal)
  const macros = calculateMacros(calories, user.fitnessGoal, user.weight)

  return {
    bmi,
    bmr,
    tdee,
    calories,
    ...macros,
  }
}

