// Stored values stay stable; these tables map them to translation keys.

export const EQUIPMENT_OPTIONS: { value: string; key: string }[] = [
  { value: 'Gym', key: 'goals.equipmentGym' },
  { value: 'Dumbbells', key: 'goals.equipmentDumbbells' },
  { value: 'Resistance Bands', key: 'goals.equipmentBands' },
  { value: 'Bodyweight Only', key: 'goals.equipmentNone' },
  { value: 'Pull-up Bar', key: 'goals.equipmentPullUpBar' },
]

export const DIET_OPTIONS: { value: string; key: string }[] = [
  { value: 'No Preference', key: 'preferences.noRestrictions' },
  { value: 'Vegetarian', key: 'preferences.vegetarian' },
  { value: 'Vegan', key: 'preferences.vegan' },
  { value: 'Keto', key: 'preferences.keto' },
  { value: 'Paleo', key: 'preferences.paleo' },
  { value: 'Gluten-free', key: 'preferences.glutenFree' },
]

const PRESET_DIETS = DIET_OPTIONS.map((option) => option.value)

/** Diet preferences the user typed in themselves (anything that is not one of the presets). */
export const customDiets = (selected: string[] = []) => selected.filter((item) => !PRESET_DIETS.includes(item))

/** Adds the user's own preference; a specific preference replaces "No Preference". */
export const addDiet = (selected: string[] = [], value: string) =>
  selected.some((item) => item.toLowerCase() === value.toLowerCase())
    ? selected
    : [...selected.filter((item) => item !== 'No Preference'), value]

/** Translation key in the `profile` namespace for a stored fitness goal. */
export const GOAL_KEYS: Record<string, string> = {
  weight_loss: 'weightLoss',
  fat_loss: 'weightLoss',
  muscle_gain: 'muscleGain',
  endurance: 'endurance',
  flexibility: 'flexibility',
  maintenance: 'maintenance',
}

/** Translation key in the `profile` namespace for a stored activity level. */
export const ACTIVITY_KEYS: Record<string, string> = {
  sedentary: 'sedentary',
  light: 'light',
  lightly_active: 'light',
  moderate: 'moderate',
  moderately_active: 'moderate',
  active: 'active',
  very_active: 'active',
}
