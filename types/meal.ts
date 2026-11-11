export interface Meal {
  id: string
  name: string
  description: string
  calories: number
  protein: number
  carbs: number
  fats: number
  ingredients: string[]
  instructions: string[]
  imageUrl?: string
}

export interface MealPlan {
  id: string
  userId: string
  day: number // 1-7
  date: string
  meals: Meal[]
  totalCalories: number
  totalProtein: number
  totalCarbs: number
  totalFats: number
}

