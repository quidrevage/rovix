# Internationalization Setup

## Overview

The application now supports multiple languages:
- English (en) - Default
- Ukrainian (uk) - Українська
- Russian (ru) - Русский

## Database Functions

All database functions are available in `lib/database.ts`:

### Meal Plans
- `saveMealPlan(mealPlan)` - Save a single meal plan
- `saveMealPlans(mealPlans)` - Save multiple meal plans (batch)
- `getMealPlans(userId, days)` - Get meal plans for a user

### Workout Plans
- `saveWorkoutPlan(workoutPlan)` - Save a single workout plan
- `saveWorkoutPlans(workoutPlans)` - Save multiple workout plans (batch)
- `getWorkoutPlans(userId, days)` - Get workout plans for a user

### Progress Tracking
- `saveUserProgress(userId, progress)` - Save user progress data
- `getUserProgress(userId, limit)` - Get user progress history

## Translation Files

Translation files are located in `/messages`:
- `en.json` - English translations
- `uk.json` - Ukrainian translations
- `ru.json` - Russian translations

## Usage in Components

```tsx
import { useTranslations } from 'next-intl'
import { useLocale } from 'next-intl'

export default function MyComponent() {
  const t = useTranslations('section')
  const locale = useLocale()
  
  return (
    <div>
      <h1>{t('key')}</h1>
      <p>{t('keyWithParam', { param: 'value' })}</p>
    </div>
  )
}
```

## Language Switcher

The language switcher is already integrated into the Navbar component. Users can switch languages by clicking the globe icon.

## URL Structure

All routes now include the locale prefix:
- `/en` - English version
- `/uk` - Ukrainian version
- `/ru` - Russian version

Example:
- `/en/dashboard` - Dashboard in English
- `/uk/dashboard` - Dashboard in Ukrainian
- `/ru/dashboard` - Dashboard in Russian

## Next Steps

To fully implement translations in all components:

1. Import `useTranslations` and `useLocale` from `next-intl`
2. Replace hardcoded strings with translation keys
3. Update links to include locale prefix: `/${locale}/path`
4. Test all languages to ensure translations work correctly

## Database Structure

### Collections:
- `users` - User profiles
- `mealPlans` - Meal plans per user
- `workoutPlans` - Workout plans per user
- `userProgress` - Progress tracking data

All data is automatically saved and loaded from Firebase Firestore.

