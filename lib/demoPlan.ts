import { calculateUserMetrics } from './utils'

// Template plan used when Gemini is unavailable, so the app still works in demo mode.

type Text = [en: string, uk: string, ru: string]
type Slot = 'breakfast' | 'lunch' | 'dinner' | 'snack'
type Diet = 'Vegetarian' | 'Vegan' | 'Keto' | 'Paleo' | 'Gluten-free'
type Allergen = 'dairy' | 'nuts' | 'egg' | 'fish' | 'gluten' | 'soy'
type Food = { name: Text; slot: Slot; diets: Diet[]; allergens: Allergen[] }
type Muscle = 'legs' | 'push' | 'pull' | 'core'
type Move = { name: Text; muscle: Muscle; needs: string[] }

const FOODS: Food[] = [
  { name: ['Oatmeal with berries', 'Вівсянка з ягодами', 'Овсянка с ягодами'], slot: 'breakfast', diets: ['Vegetarian', 'Vegan'], allergens: ['gluten'] },
  { name: ['Greek yogurt with fruit', 'Грецький йогурт із фруктами', 'Греческий йогурт с фруктами'], slot: 'breakfast', diets: ['Vegetarian', 'Gluten-free'], allergens: ['dairy'] },
  { name: ['Vegetable omelette', 'Овочевий омлет', 'Овощной омлет'], slot: 'breakfast', diets: ['Vegetarian', 'Keto', 'Paleo', 'Gluten-free'], allergens: ['egg'] },
  { name: ['Tofu scramble with spinach', 'Скрембл із тофу та шпинатом', 'Скрэмбл из тофу со шпинатом'], slot: 'breakfast', diets: ['Vegetarian', 'Vegan', 'Keto', 'Gluten-free'], allergens: ['soy'] },
  { name: ['Grilled chicken salad', 'Салат із куркою гриль', 'Салат с курицей гриль'], slot: 'lunch', diets: ['Keto', 'Paleo', 'Gluten-free'], allergens: [] },
  { name: ['Turkey with rice and vegetables', 'Індичка з рисом та овочами', 'Индейка с рисом и овощами'], slot: 'lunch', diets: ['Gluten-free'], allergens: [] },
  { name: ['Lentil soup with vegetables', 'Сочевичний суп з овочами', 'Чечевичный суп с овощами'], slot: 'lunch', diets: ['Vegetarian', 'Vegan', 'Gluten-free'], allergens: [] },
  { name: ['Avocado and tofu bowl', 'Боул з авокадо та тофу', 'Боул с авокадо и тофу'], slot: 'lunch', diets: ['Vegetarian', 'Vegan', 'Keto', 'Gluten-free'], allergens: ['soy'] },
  { name: ['Baked salmon with broccoli', 'Запечений лосось із броколі', 'Запечённый лосось с брокколи'], slot: 'dinner', diets: ['Keto', 'Paleo', 'Gluten-free'], allergens: ['fish'] },
  { name: ['Beef stir-fry with vegetables', 'Яловичина з овочами', 'Говядина с овощами'], slot: 'dinner', diets: ['Keto', 'Paleo', 'Gluten-free'], allergens: [] },
  { name: ['Chickpea curry with rice', 'Карі з нуту з рисом', 'Карри из нута с рисом'], slot: 'dinner', diets: ['Vegetarian', 'Vegan', 'Gluten-free'], allergens: [] },
  { name: ['Stuffed zucchini with mushrooms', 'Кабачки з грибами', 'Кабачки с грибами'], slot: 'dinner', diets: ['Vegetarian', 'Vegan', 'Keto', 'Paleo', 'Gluten-free'], allergens: [] },
  { name: ['Apple with almond butter', 'Яблуко з мигдальною пастою', 'Яблоко с миндальной пастой'], slot: 'snack', diets: ['Vegetarian', 'Vegan', 'Paleo', 'Gluten-free'], allergens: ['nuts'] },
  { name: ['Cottage cheese with cucumber', 'Сир з огірком', 'Творог с огурцом'], slot: 'snack', diets: ['Vegetarian', 'Keto', 'Gluten-free'], allergens: ['dairy'] },
  { name: ['Carrots with hummus', 'Морква з хумусом', 'Морковь с хумусом'], slot: 'snack', diets: ['Vegetarian', 'Vegan', 'Gluten-free'], allergens: [] },
  { name: ['Olives and cucumber slices', 'Оливки та огірок', 'Оливки и огурец'], slot: 'snack', diets: ['Vegetarian', 'Vegan', 'Keto', 'Paleo', 'Gluten-free'], allergens: [] },
]

const MOVES: Move[] = [
  { name: ['Bodyweight squats', 'Присідання', 'Приседания'], muscle: 'legs', needs: [] },
  { name: ['Lunges', 'Випади', 'Выпады'], muscle: 'legs', needs: [] },
  { name: ['Goblet squats', 'Присідання з гантеллю', 'Приседания с гантелью'], muscle: 'legs', needs: ['Dumbbells', 'Gym'] },
  { name: ['Leg press', 'Жим ногами', 'Жим ногами'], muscle: 'legs', needs: ['Gym'] },
  { name: ['Push-ups', 'Віджимання', 'Отжимания'], muscle: 'push', needs: [] },
  { name: ['Dumbbell bench press', 'Жим гантелей лежачи', 'Жим гантелей лёжа'], muscle: 'push', needs: ['Dumbbells', 'Gym'] },
  { name: ['Band shoulder press', 'Жим стрічки над головою', 'Жим ленты над головой'], muscle: 'push', needs: ['Resistance Bands'] },
  { name: ['Superman hold', 'Вправа «супермен»', 'Упражнение «супермен»'], muscle: 'pull', needs: [] },
  { name: ['Pull-ups', 'Підтягування', 'Подтягивания'], muscle: 'pull', needs: ['Pull-up Bar', 'Gym'] },
  { name: ['Dumbbell rows', 'Тяга гантелі', 'Тяга гантели'], muscle: 'pull', needs: ['Dumbbells', 'Gym'] },
  { name: ['Band rows', 'Тяга стрічки', 'Тяга ленты'], muscle: 'pull', needs: ['Resistance Bands'] },
  { name: ['Plank', 'Планка', 'Планка'], muscle: 'core', needs: [] },
  { name: ['Bicycle crunches', 'Скручування «велосипед»', 'Скручивания «велосипед»'], muscle: 'core', needs: [] },
]

const ALLERGEN_PATTERNS: Record<Allergen, RegExp> = {
  dairy: /dairy|milk|lactose|cheese|yogurt|молок|молоч|лактоз|сир|сыр|творог|йогурт/i,
  nuts: /nut|almond|peanut|горіх|арахіс|мигдал|орех|арахис|миндал/i,
  egg: /egg|яйц|яєц|яйк/i,
  fish: /fish|salmon|seafood|риб|рыб|лосос|морепродукт/i,
  gluten: /gluten|wheat|oat|глютен|пшени|вівс|овсян/i,
  soy: /soy|tofu|со[яєю]|тофу/i,
}

const SLOT_SHARE: Record<Slot, number> = { breakfast: 0.25, lunch: 0.35, dinner: 0.3, snack: 0.1 }
const SLOT_NAME: Record<Slot, Text> = {
  breakfast: ['Breakfast', 'Сніданок', 'Завтрак'],
  lunch: ['Lunch', 'Обід', 'Обед'],
  dinner: ['Dinner', 'Вечеря', 'Ужин'],
  snack: ['Snack', 'Перекус', 'Перекус'],
}
const FALLBACK_FOOD: Text = [
  'Vegetables with a protein source that suits your diet',
  'Овочі з джерелом білка, що підходить вашому раціону',
  'Овощи с источником белка, подходящим вашему рациону',
]
const FOCUS: Record<'full' | 'upper' | 'lower' | 'rest', Text> = {
  full: ['Full body', 'Усе тіло', 'Всё тело'],
  upper: ['Upper body', 'Верх тіла', 'Верх тела'],
  lower: ['Legs and core', 'Ноги та прес', 'Ноги и пресс'],
  rest: ['Rest and recovery', 'Відпочинок', 'Отдых и восстановление'],
}
const TIPS: Text[] = [
  ['Drink water throughout the day', 'Пийте воду протягом дня', 'Пейте воду в течение дня'],
  ['Aim for 7-9 hours of sleep', 'Спіть 7-9 годин', 'Спите 7-9 часов'],
]

const VOLUME: Record<string, { sets: string; reps: string }> = {
  muscle_gain: { sets: '4', reps: '8-12' },
  weight_loss: { sets: '3', reps: '12-15' },
  fat_loss: { sets: '3', reps: '12-15' },
  endurance: { sets: '3', reps: '15-20' },
}

// Which weekdays (0-6) are training days for a given frequency.
const SCHEDULE: Record<number, number[]> = {
  2: [0, 3],
  3: [0, 2, 4],
  4: [0, 1, 3, 4],
  5: [0, 1, 2, 3, 4],
}

export function generateDemoPlan(userData: any, locale: string = 'en') {
  const lang = locale === 'uk' ? 1 : locale === 'ru' ? 2 : 0
  const offset = Math.floor(Math.random() * 16)

  const equipment: string[] = userData.equipmentAccess || []
  const available = MOVES.filter((m) => m.needs.length === 0 || m.needs.some((n) => equipment.includes(n)))
  const pickMoves = (muscles: Muscle[], day: number) =>
    muscles.flatMap((muscle) => {
      const pool = available.filter((m) => m.muscle === muscle)
      return [pool[(day + offset) % pool.length], pool[(day + offset + 1) % pool.length]]
    }).filter((m, i, all) => all.indexOf(m) === i)

  const volume = VOLUME[userData.fitnessGoal] || { sets: '3', reps: '10-12' }
  const frequency = Math.min(Math.max(Number(userData.trainingFrequency) || 3, 2), 5)
  const trainingDays = SCHEDULE[frequency]

  const workoutPlan = Array.from({ length: 7 }, (_, day) => {
    const order = trainingDays.indexOf(day)
    if (order === -1) {
      return { day: `Day ${day + 1}`, focus: FOCUS.rest[lang], exercises: [] }
    }
    // Up to 3 days/week train the whole body; more days alternate a split.
    const type = frequency <= 3 ? 'full' : order % 2 === 0 ? 'upper' : 'lower'
    const muscles: Muscle[] =
      type === 'full' ? ['legs', 'push', 'pull', 'core'] : type === 'upper' ? ['push', 'pull'] : ['legs', 'core']
    return {
      day: `Day ${day + 1}`,
      focus: FOCUS[type][lang],
      exercises: pickMoves(muscles, day).map((m) => ({ name: m.name[lang], sets: volume.sets, reps: volume.reps, notes: '' })),
    }
  })

  const metrics = calculateUserMetrics(userData)
  const calories = metrics?.calories || 2000
  const protein = metrics?.protein || 150
  const carbs = metrics?.carbs || 200
  const fats = metrics?.fats || 60

  const allergyText = String(userData.allergies || '')
  const blocked = (Object.keys(ALLERGEN_PATTERNS) as Allergen[]).filter((a) => ALLERGEN_PATTERNS[a].test(allergyText))
  // Only the preset diets can filter the templates; the user's own preferences need the AI.
  const diets = ((userData.dietPreferences || []) as string[]).filter((d) => FOODS.some((f) => f.diets.includes(d as Diet))) as Diet[]
  const suitable = FOODS.filter(
    (f) => diets.every((d) => f.diets.includes(d)) && !f.allergens.some((a) => blocked.includes(a))
  )

  const weeklyMeals = Array.from({ length: 7 }, (_, day) => ({
    day: day + 1,
    meals: (Object.keys(SLOT_SHARE) as Slot[]).map((slot) => {
      const pool = suitable.filter((f) => f.slot === slot)
      const share = SLOT_SHARE[slot]
      return {
        meal: SLOT_NAME[slot][lang],
        options: pool.length ? [pool[(day + offset) % pool.length].name[lang]] : [FALLBACK_FOOD[lang]],
        calories: Math.round(calories * share),
        protein: `${Math.round(protein * share)}g`,
        carbs: `${Math.round(carbs * share)}g`,
        fats: `${Math.round(fats * share)}g`,
      }
    }),
  }))

  return {
    demo: true,
    workoutPlan,
    mealPlan: { calories, macros: { protein: `${protein}g`, carbs: `${carbs}g`, fats: `${fats}g` }, weeklyMeals },
    tips: TIPS.map((tip) => tip[lang]),
  }
}
