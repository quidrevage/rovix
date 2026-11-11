export interface Exercise {
  id: string
  name: string
  sets: number
  reps: number | string // Can be "8-12" or 10
  restSeconds: number
  notes?: string
  muscleGroups: string[]
  equipment?: string[]
}

export interface WorkoutPlan {
  id: string
  userId: string
  day: number // 1-7
  date: string
  exercises: Exercise[]
  estimatedDuration: number // minutes
  targetMuscleGroups: string[]
}

