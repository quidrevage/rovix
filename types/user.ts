export interface User {
  id: string
  email: string
  name: string
  gender?: 'male' | 'female' | 'other'
  age?: number
  height?: number // in cm
  weight?: number // in kg
  fitnessGoal?: 'muscle_gain' | 'fat_loss' | 'weight_loss' | 'endurance' | 'flexibility' | 'maintenance'
  activityLevel?: 'sedentary' | 'light' | 'lightly_active' | 'moderate' | 'moderately_active' | 'active' | 'very_active'
  equipmentAccess?: string[]
  dietPreferences?: string[]
  allergies?: string[]
  trainingFrequency?: number // days per week
  calorieAdjust?: number // kcal per day added to the calculated target
  createdAt: string
  updatedAt?: string
}

export interface UserMetrics {
  bmi: number
  bmr: number // Basal Metabolic Rate
  tdee: number // Total Daily Energy Expenditure
  calories: number
  protein: number // grams
  carbs: number // grams
  fats: number // grams
}

