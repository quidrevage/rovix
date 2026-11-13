import 'server-only'
import { GoogleGenerativeAI, type Part } from '@google/generative-ai'
import { DEMO_KEYS } from './exercises'
import { compactPlan, sanitizeChanges } from './plan'
import { detectLanguage, type ChatResult, type ChatTurn, type ExerciseGuide } from './aiShared'
import { calculateMacros, calculateUserMetrics, proteinPerKg } from './utils'

// Everything that talks to Gemini lives here and runs only on the server (see app/api/ai/route.ts),
// so the API key never reaches the browser.

// NEXT_PUBLIC_* names are still read so an old .env.local keeps working, but prefer the plain ones:
// a NEXT_PUBLIC_ variable is copied into browser code as soon as any client file mentions it.
const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY
export const aiConfigured = Boolean(apiKey)
const genAI = new GoogleGenerativeAI(apiKey || '')

// gemini-flash-latest / gemini-3.8-flash were measured answering 429 or hanging on a free key,
// so the default is the previous full-size model, which answers in a few seconds.
const PRIMARY_MODEL = process.env.GEMINI_MODEL || process.env.NEXT_PUBLIC_GEMINI_MODEL || 'gemini-3.5-flash'
// Safety net: during demand spikes the full-size models answer 503 or hang for minutes,
// while the lite model keeps replying within a couple of seconds.
// Two of them, because even a lite model occasionally answers 503 for a moment.
const FAST_MODELS = ['gemini-flash-lite-latest', 'gemini-3.5-flash-lite']
const unique = (models: string[]) => Array.from(new Set(models))
const PLAN_MODELS = unique([PRIMARY_MODEL, ...FAST_MODELS])
const CHAT_MODELS = unique([PRIMARY_MODEL, ...FAST_MODELS])
// Leaves room for the fast model to answer inside the route's 5-minute limit if the main one hangs.
const PLAN_TIMEOUT_MS = 4 * 60 * 1000
// Chat and exercise guides are short: give up on a slow model quickly and ask the fast one.
const CHAT_TIMEOUT_MS = 25 * 1000
const COOLDOWN_MS = 5 * 60 * 1000
// Models that were overloaded or timed out recently; they are tried last until the cooldown ends.
const coolingUntil: Record<string, number> = {}

/**
 * Tries each model in turn. Overload (503), rate limit (429) and timeouts move on to the next model;
 * the long plan request also retries once before moving on.
 */
async function generateWithFallback(prompt: string | Array<string | Part>, interactive: boolean, preferFast = false) {
  const now = Date.now()
  const cooling = (model: string) => (coolingUntil[model] || 0) > now
  // A technique guide is simple and shown in an open dialog, so speed matters more than the bigger model.
  const models = preferFast ? unique([...FAST_MODELS, PRIMARY_MODEL]) : interactive ? CHAT_MODELS : PLAN_MODELS
  const ordered = [...models.filter((model) => !cooling(model)), ...models.filter(cooling)]
  const timeout = interactive ? CHAT_TIMEOUT_MS : PLAN_TIMEOUT_MS
  const attempts = interactive ? 1 : 2
  const generationConfig = { responseMimeType: 'application/json' }

  let lastError: unknown
  let timedOut = false
  // Overload usually clears within seconds, so a chat request gets a second pass over the models.
  for (let pass = 0; pass < (interactive ? 2 : 1); pass++) {
  if (pass > 0) await new Promise((resolve) => setTimeout(resolve, 2000))
  for (const model of ordered) {
    // After a timeout the user has waited long enough: go straight to the fast models.
    if (timedOut && !FAST_MODELS.includes(model)) continue
    for (let attempt = 0; attempt < attempts; attempt++) {
      try {
        const result = await genAI.getGenerativeModel({ model, generationConfig }, { timeout }).generateContent(prompt)
        return result.response.text()
      } catch (error) {
        lastError = error
        const busy = /\b(503|429)\b/.test(String(error))
        if (/abort|timed? ?out/i.test(String(error))) timedOut = true
        if (busy || timedOut) coolingUntil[model] = Date.now() + COOLDOWN_MS
        if (!busy || timedOut) break
        if (attempt < attempts - 1) await new Promise((resolve) => setTimeout(resolve, 1500))
      }
    }
  }
  }
  throw lastError
}

// How long the plan waits for a model before asking the next one as well.
const HEDGE_MS = 25 * 1000

/**
 * For the plan: the main model sometimes stalls for minutes, so instead of waiting for it to fail,
 * the next model is started alongside after HEDGE_MS (or at once if a model fails) and the first answer wins.
 */
function generateHedged(prompt: string): Promise<string> {
  const now = Date.now()
  const cooling = (model: string) => (coolingUntil[model] || 0) > now
  const models = [...PLAN_MODELS.filter((model) => !cooling(model)), ...PLAN_MODELS.filter(cooling)]
  // Little reasoning is needed to fill a template, and it roughly halves the wait.
  const generationConfig: any = { responseMimeType: 'application/json', thinkingConfig: { thinkingLevel: 'low' } }

  return new Promise((resolve, reject) => {
    let next = 0
    let running = 0
    let done = false
    let lastError: unknown
    let timer: ReturnType<typeof setTimeout> | undefined

    const launch = () => {
      if (done || next >= models.length) return
      const model = models[next++]
      running++
      clearTimeout(timer)
      timer = setTimeout(() => {
        // Still silent: remember that it is slow right now, and bring in the next model.
        coolingUntil[model] = Date.now() + COOLDOWN_MS
        launch()
      }, HEDGE_MS)
      genAI
        .getGenerativeModel({ model, generationConfig }, { timeout: PLAN_TIMEOUT_MS })
        .generateContent(prompt)
        .then((result) => {
          if (done) return
          done = true
          clearTimeout(timer)
          resolve(result.response.text())
        })
        .catch((error) => {
          lastError = error
          running--
          if (done) return
          if (/\b(503|429)\b|abort|timed? ?out/i.test(String(error))) coolingUntil[model] = Date.now() + COOLDOWN_MS
          if (next < models.length) launch()
          else if (running === 0) {
            clearTimeout(timer)
            reject(lastError)
          }
        })
    }
    launch()
  })
}

// The model sometimes wraps JSON in a code fence or adds a sentence around it.
function parseJson(raw: string): any {
  try {
    return JSON.parse(raw)
  } catch {
    const start = raw.indexOf('{')
    const end = raw.lastIndexOf('}')
    if (start === -1 || end <= start) return null
    try {
      return JSON.parse(raw.slice(start, end + 1))
    } catch {
      return null
    }
  }
}

const LANGUAGE_NAMES: Record<string, string> = { en: 'English', uk: 'Ukrainian', ru: 'Russian' }

// Request data comes from the browser, so it is trimmed and flattened before it goes into a prompt.
const line = (value: unknown, max = 80) =>
  value == null ? '' : String(value).replace(/\s+/g, ' ').trim().slice(0, max)
const list = (value: unknown) => (Array.isArray(value) ? value : []).slice(0, 12).map((item) => line(item, 40)).filter(Boolean).join(', ')

const mealsPerDay = (userData: any) => Math.min(Math.max(Math.round(Number(userData?.mealsPerDay)) || 4, 3), 5)

// Shared by the plan and the chat, so a swapped or edited meal follows the same rules as a generated one.
// The numbers follow the ISSN position stands (protein and exercise, nutrient timing, diets and body composition)
// and the WHO healthy diet guidance.
function nutritionRules(userData: any): string {
  const weight = Number(userData?.weight) || 0
  const goal = String(userData?.fitnessGoal || '')
  const meals = mealsPerDay(userData)
  const mainMealProtein = weight ? `${Math.round(weight * 0.3)} g` : '25 g'
  const goalAdvice =
    goal === 'muscle_gain'
      ? 'Goal is muscle gain: a moderate surplus from ordinary food. Prefer energy-dense staples that are easy to eat in volume (rice, pasta, potatoes, bread, oats, milk, eggs, minced meat) and make the last meal of the day rich in slow dairy protein (cottage cheese, kefir, yogurt) when the diet allows it.'
      : goal === 'fat_loss' || goal === 'weight_loss'
      ? 'Goal is fat loss: a moderate deficit that is easy to live with. Prefer filling, high-volume food (lean meat and fish, eggs, cottage cheese, potatoes, buckwheat, legumes, soups, lots of vegetables), keep protein high in every meal, and spend the calories on food rather than on sweet drinks, sauces and excess oil.'
      : 'Goal is health and performance: balanced plates, enough carbohydrates to train well, no extremes.'

  return `Plan the food the way a sports dietitian, a nutritionist and a strength coach would do it together for a real client: evidence-based, realistic, and easy to follow for months.

      How a professional builds the day:
      - Protein: ${proteinPerKg(goal)} g per kg of body weight per day (never outside 1.5-2 g per kg, and not higher even if more would fit the calories). Spread it evenly: every main meal (breakfast, lunch, dinner) has at least ${mainMealProtein} of protein from a complete source (meat, poultry, fish, eggs, dairy; for plant-based diets combine legumes with grains or use soy), and a snack has 10-20 g where possible. No meal carries more than half of the day's protein.
      - Carbohydrates: mostly slow, minimally processed staples (buckwheat, oats, rice, pasta, potatoes, bulgur, whole-grain bread, legumes), plus fruit. On training days give more carbohydrates and put a good part of them in the meals around the workout; on rest days give fewer carbohydrates and the same protein.
      - Fats: mostly unsaturated (vegetable oil, nuts, seeds, fish). Include fish 1-2 times a week, choosing affordable kinds (pollock, hake, mackerel, herring, canned fish). Keep fried food, sausages, processed meat, pastries and sweets to a minimum. Always count cooking oil and dressings, in grams.
      - Vegetables and fruit: at least 400 g a day in total, with a vegetable or salad in every lunch and dinner, so the day has enough fibre (about 14 g per 1000 kcal).
      - Exactly ${meals} meals a day (${meals === 3 ? 'breakfast, lunch, dinner' : meals === 4 ? 'breakfast, lunch, dinner and one snack' : 'breakfast, lunch, dinner and two snacks: one between breakfast and lunch, one between lunch and dinner'}), 3-4 hours apart.
      - ${goalAdvice}
      - Numbers are honest: take calories and macros from standard food composition tables for the amounts you wrote, so that calories are close to protein x 4 + carbs x 4 + fats x 9. Each day's meals add up to the day's calories and to the daily protein within about 10%.

      How the dishes look:
      - Plain everyday home food, the kind people really cook on a weekday — not restaurant or "fitness blog" dishes.
      - Lunch and dinner are: a staple side (rice, buckwheat, pasta, potatoes, bulgur, bread) + a simple protein (chicken, turkey, eggs, minced meat, fish, cottage cheese, beans) + a vegetable or a simple salad. Breakfast and snacks are just as simple (porridge, eggs, sandwiches, cottage cheese, yogurt, kefir, fruit, nuts).
      - 3-5 common, affordable ingredients from an ordinary supermarket in the user's country, up to about 25 minutes of active cooking, simple methods (boil, stew, bake, pan with little oil). No exotic or expensive ingredients (quinoa, avocado, salmon steaks, chia, tofu and the like) unless the user's diet or own wishes call for them.
      - Plan a weekly rotation, not seven unique days: 3-4 different breakfasts, 4-5 different lunch and dinner dishes and 3-4 different snacks for the whole week. Each lunch or dinner dish appears on 2-3 days so it is cooked once in a bigger batch. Mix them so that every day is a different combination: never repeat a whole day and never alternate two fixed day menus.
      - "options" holds exactly one dish per meal unless the user asks for alternatives. It is one complete dish written as: dish name (ingredient amount, ingredient amount, ...), with the amount of every ingredient in grams of ready-to-eat food (cooked weight for grains, pasta and meat), or pieces for eggs and whole fruit. Example: "Chicken with rice and cucumber (chicken breast 150 g, boiled rice 200 g, cucumber 100 g, vegetable oil 5 g)".
      - Write the units in the language of the plan (for example "г", "мл", "шт." in Russian and Ukrainian).`
}

// Usual training days (1-7) for a weekly frequency, so the workouts and the meals agree without seeing each other.
const TRAINING_DAYS: Record<number, number[]> = {
  1: [3],
  2: [1, 4],
  3: [1, 3, 5],
  4: [1, 2, 4, 5],
  5: [1, 2, 3, 5, 6],
  6: [1, 2, 3, 4, 5, 6],
}

type Slot = 'breakfast' | 'lunch' | 'dinner' | 'snack'

const SLOT_NAMES: Record<string, Record<Slot, string>> = {
  en: { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snack' },
  uk: { breakfast: 'Сніданок', lunch: 'Обід', dinner: 'Вечеря', snack: 'Перекус' },
  ru: { breakfast: 'Завтрак', lunch: 'Обед', dinner: 'Ужин', snack: 'Перекус' },
}

// The order of a day's meals and each one's share of the day's calories / protein, by meals per day.
const DAY_LAYOUT: Record<number, { slots: Slot[]; calories: Record<string, number>; protein: Record<string, number> }> = {
  3: { slots: ['breakfast', 'lunch', 'dinner'], calories: { breakfast: 0.3, main: 0.35 }, protein: { breakfast: 0.3, main: 0.35 } },
  4: {
    slots: ['breakfast', 'lunch', 'snack', 'dinner'],
    calories: { breakfast: 0.25, main: 0.3, snack: 0.15 },
    protein: { breakfast: 0.25, main: 0.325, snack: 0.1 },
  },
  5: {
    slots: ['breakfast', 'snack', 'lunch', 'snack', 'dinner'],
    calories: { breakfast: 0.24, main: 0.28, snack: 0.1 },
    protein: { breakfast: 0.22, main: 0.29, snack: 0.1 },
  },
}

/**
 * Lays the dish pools out into 7 days. Every dinner is eaten again as the next day's lunch, so each main dish
 * is cooked once in a double batch, and the pool sizes (3 and 5) make all seven days different.
 */
function arrangeWeek(pools: any, slots: Slot[], locale: string) {
  const dishes = (value: unknown) =>
    (Array.isArray(value) ? value : []).filter((dish: any) => typeof dish?.dish === 'string' && dish.dish.trim())
  const breakfasts = dishes(pools?.breakfasts)
  const mains = dishes(pools?.mains)
  const snacks = dishes(pools?.snacks)
  if (!breakfasts.length || !mains.length || (slots.includes('snack') && !snacks.length)) return null

  const names = SLOT_NAMES[locale] || SLOT_NAMES.en
  return Array.from({ length: 7 }, (_, day) => {
    let snack = day
    const pick = (slot: Slot) =>
      slot === 'breakfast'
        ? breakfasts[day % breakfasts.length]
        : slot === 'dinner'
        ? mains[day % mains.length]
        : slot === 'lunch'
        ? mains[(day + mains.length - 1) % mains.length]
        : snacks[snack++ % snacks.length]
    return {
      day: day + 1,
      meals: slots.map((slot) => {
        const dish = pick(slot)
        const grams = (value: unknown) => `${Math.round(parseFloat(String(value)) || 0)}g`
        return {
          meal: names[slot],
          options: [line(dish.dish, 300)],
          calories: Math.round(Number(dish.calories) || 0),
          protein: grams(dish.protein),
          carbs: grams(dish.carbs),
          fats: grams(dish.fats),
        }
      }),
    }
  })
}

/**
 * The workouts and the meals are asked for separately and at the same time, and the meals come as pools of dishes
 * that arrangeWeek turns into days: the answers are short, so the plan is ready several times sooner.
 */
export async function planFromAI(userData: any, locale: string, previous?: any) {
  // Targets come from the profile, not from the model: it tends to overshoot protein.
  const targets = calculateUserMetrics(userData)
  const language = LANGUAGE_NAMES[locale] || 'English'
  const lastWeek = previous?.workouts ? JSON.stringify(previous.workouts).slice(0, 6000) : ''
  const lifts = previous?.lifts && Object.keys(previous.lifts).length ? JSON.stringify(previous.lifts).slice(0, 1500) : ''
  const frequency = Math.min(Math.max(Math.round(Number(userData?.trainingFrequency)) || 3, 1), 6)
  const trainingDays = TRAINING_DAYS[frequency].join(', ')

  const layout = DAY_LAYOUT[mealsPerDay(userData)]
  const dayCalories = targets?.calories || 2000
  const dayProtein = targets?.protein || Math.round((Number(userData?.weight) || 70) * proteinPerKg(String(userData?.fitnessGoal || '')))
  const budget = (pool: 'breakfast' | 'main' | 'snack') => ({
    calories: Math.round((dayCalories * layout.calories[pool]) / 10) * 10,
    protein: Math.round(dayProtein * layout.protein[pool]),
  })

  const person = `
      - Name: ${line(userData?.name)}
      - Gender: ${line(userData?.gender)}
      - Age: ${line(userData?.age)}
      - Height: ${line(userData?.height)} cm
      - Weight: ${line(userData?.weight)} kg
      - Activity: ${line(userData?.activityLevel)}
      - Goal: ${line(userData?.fitnessGoal)}
      - Frequency: ${line(userData?.trainingFrequency)} days/week`

  const workoutPrompt = `
      You are an elite strength and conditioning coach with years of practice with ordinary people, not only athletes. Create a JSON 7-day workout plan for this user.
      Write every text value (focus, exercise names, weight, notes) in ${language}. Keep the JSON keys in English. Answer with compact JSON.

      User Profile:${person}
      - Equipment: ${list(userData?.equipmentAccess)}
      - Training wishes and limitations (in the user's own words; follow them): ${line(userData?.trainingNotes, 500) || 'none'}

      Training days are days ${trainingDays} unless the user's wishes say otherwise; every other day is a rest day with an empty "exercises" list.

      ${lastWeek ? `This plan is for the NEXT week. Last week the user completed ${line(previous.completed, 3)} of ${line(previous.planned, 3)} planned workouts:
      ${lastWeek}
      Build on it: if most workouts were done, progress modestly (a little more reps, sets or a harder variation) and swap one or two exercises per day for variety; if few were done, make the week easier to stick to.` : ''}

      ${lifts ? `Loads the user actually worked with (exercise -> load): ${lifts}. Base the recommended weights on them.` : ''}

      REQUIRED JSON STRUCTURE:
      {
        "workoutPlan": [
          {
            "day": "Day 1",
            "focus": "Legs/Cardio",
            "exercises": [
              { "name": "Squats", "sets": "3", "reps": "12", "weight": "2 × 10", "rest": 60, "notes": "Keep back straight", "demo": "squat" }
            ]
          },
          { "day": "Day 2", "focus": "Rest", "exercises": [] },
          ... (7 days total)
        ]
      }

      Exercise variety: choose from the full range of exercises that fit the equipment and the user's wishes — compound and
      isolation lifts, single-leg and single-arm work, core, mobility and conditioning — not only the most common ones and
      not only those that have a demo. Do not repeat an exercise on two different days, and give each training day
      5-6 exercises that work well together.

      For every exercise: "weight" is a recommended starting load for THIS user as a short text written in ${language}, units included
      (two 8-kilogram dumbbells, bodyweight, a light band and so on). Base it on sex, body weight, goal and the available
      equipment, and stay on the conservative side: the last reps should be hard but clean.
      "rest" is the rest between sets in seconds, "notes" is one short technique cue, and "demo" is the movement pattern
      it matches, one of: ${DEMO_KEYS.join(', ')}. Use "" unless the exercise is that movement or a close variation of it.
    `

  const mealPrompt = `
      You are a team of a sports dietitian, a nutritionist and a strength coach with years of practice with ordinary people, not only athletes. Create a JSON 7-day meal plan for this user.
      Write every text value (meal names, options, tips) in ${language}. Keep the JSON keys in English. Answer with compact JSON.

      User Profile:${person}
      - Diet: ${list(userData?.dietPreferences)}
      - Foods and dishes the user likes and cooks (in the user's own words; use them often, and add other equally simple foods for variety): ${line(userData?.foodNotes, 500) || 'not specified'}
      - Allergies: ${line(userData?.allergies, 300)}

      ${lastWeek ? 'This plan is for the NEXT week: choose different dishes than a typical first week.' : ''}

      You do not lay out the days yourself. Return pools of dishes; the app arranges them into the week: breakfasts rotate,
      and every main dish is cooked once in a double batch and eaten as a dinner and as the next day's lunch.

      REQUIRED JSON STRUCTURE:
      {
        "breakfasts": [ { "dish": "Oatmeal with milk and banana (oats 80 g, milk 200 ml, banana 120 g)", "calories": 400, "protein": "20g", "carbs": "50g", "fats": "10g" } ],
        "mains": [ ... ],
        "snacks": [ ... ],
        "tips": ["Drink water", "Sleep 8 hours"]
      }
      - "breakfasts": exactly 3 different dishes, each about ${budget('breakfast').calories} kcal with about ${budget('breakfast').protein} g of protein.
      - "mains": exactly 5 different lunch/dinner dishes, each about ${budget('main').calories} kcal with about ${budget('main').protein} g of protein. Use different protein sources and different sides across them; at least one is fish (unless the diet forbids it).
      - "snacks": ${layout.slots.includes('snack') ? `exactly 3 different snacks, each about ${budget('snack').calories} kcal with about ${budget('snack').protein} g of protein` : 'an empty list'}.
      Dishes of one pool must be equal in calories and protein (within 5%), because any of them can land on any day.
      The protein figure is a limit, not a minimum: a dish may be 5 g under it but never over. Cooked lean meat, poultry and fish have 25-30 g of protein per 100 g, so a main dish here holds only about ${Math.max(60, Math.round((budget('main').protein - 10) / 0.28 / 10) * 10)} g of them, and never more. Reach the calories with a bigger side (grains, pasta, potatoes, bread), fruit, nuts and a little oil — not with more meat, eggs or cottage cheese.
      Before answering, add up the protein of every dish from its ingredients and reduce the protein food if it is over the limit.
      "dish" is written the way the rules below describe an item of "options".

      ${nutritionRules(userData)}

      For this request ignore the rules above about the number of meals a day, the weekly rotation and training-day carbohydrates: the app takes care of them.

      In "tips" give 4-5 short practical tips for THIS user from the dietitian and the coach: water (about 30-35 ml per kg of body weight a day), sleep, how to batch-cook these dishes (each main is cooked for two meals), and what to eat around the workouts (training days: ${trainingDays}).
    `

  const [workouts, meals] = (await Promise.all([generateHedged(workoutPrompt), generateHedged(mealPrompt)])).map(parseJson)
  const weeklyMeals = arrangeWeek(meals, layout.slots, locale)
  if (!Array.isArray(workouts?.workoutPlan) || !weeklyMeals) {
    throw new Error('Gemini returned a plan with an unexpected structure')
  }
  const goal = String(userData?.fitnessGoal || '')
  const macros = targets || calculateMacros(dayCalories, goal, dayProtein / proteinPerKg(goal))
  return {
    workoutPlan: workouts.workoutPlan,
    mealPlan: {
      calories: dayCalories,
      macros: { protein: `${macros.protein}g`, carbs: `${macros.carbs}g`, fats: `${macros.fats}g` },
      weeklyMeals,
    },
    tips: Array.isArray(meals.tips) ? meals.tips : [],
  }
}

const HISTORY_LIMIT = 12

export async function chatFromAI(options: {
  message: string
  history?: ChatTurn[]
  userData?: any
  locale?: string
}): Promise<ChatResult | null> {
  const { userData, locale } = options
  const message = String(options.message || '').trim().slice(0, 2000)
  const detectedLang = detectLanguage(message, locale)

  const profile = userData
    ? [
        `Gender: ${line(userData.gender) || 'N/A'}`,
        `Age: ${line(userData.age) || 'N/A'}`,
        `Height: ${line(userData.height) || 'N/A'} cm`,
        `Weight: ${line(userData.weight) || 'N/A'} kg`,
        `Goal: ${line(userData.fitnessGoal) || 'N/A'}`,
        `Activity: ${line(userData.activityLevel) || 'N/A'}`,
        `Training days per week: ${line(userData.trainingFrequency) || 'N/A'}`,
        `Equipment: ${list(userData.equipmentAccess) || 'N/A'}`,
        `Training wishes and limitations: ${line(userData.trainingNotes, 500) || 'none'}`,
        `Diet: ${list(userData.dietPreferences) || 'N/A'}`,
        `Foods and dishes the user likes: ${line(userData.foodNotes, 500) || 'not specified'}`,
        `Allergies: ${line(userData.allergies, 300) || 'none'}`,
        `Meals per day: ${mealsPerDay(userData)}`,
      ].join('; ')
    : 'unknown'

  const plan = userData?.plan ? JSON.stringify(compactPlan(userData.plan)) : null
  const conversation = (Array.isArray(options.history) ? options.history : [])
    .slice(-HISTORY_LIMIT)
    .map((turn) => `${turn?.role === 'user' ? 'User' : 'Coach'}: ${String(turn?.content || '').slice(0, 2000)}`)
    .join('\n')

  const prompt = `You are an expert fitness coach, sports dietitian and nutritionist inside the Rovix app. You give helpful, accurate, motivating advice about training, nutrition, weight management and healthy habits. Be friendly and practical. If you don't know something, say so rather than guessing.

You can also EDIT the user's saved 7-day plan when they ask for it.

User profile: ${profile}

${plan ? `CURRENT PLAN (JSON, days are numbered 1-7):\n${plan}` : 'The user has no saved plan yet, so you cannot edit one.'}

${conversation ? `Conversation so far:\n${conversation}\n` : ''}
User: ${message}

Answer with a single JSON object and nothing else:
{
  "reply": "your answer to the user",
  "changes": null
}

Rules for "reply":
- Write it in ${LANGUAGE_NAMES[detectedLang] || 'English'}. Plain text only: no markdown headings or tables; short paragraphs or simple "- " lists are fine.
- When you change the plan, say briefly what exactly you changed and why.
- Get to the point; greet the user only if they greet you first.

Rules for "changes":
- Keep it null unless the user clearly asks to change, replace, add or remove something in their plan (or agrees to a change you proposed). For questions and advice it must be null.
- Otherwise use this shape, including only the parts that change:
  {
    "workoutDays": [ { "day": 1, "focus": "...", "exercises": [ { "name": "...", "sets": "3", "reps": "10-12", "weight": "recommended load in the plan's language", "rest": 60, "notes": "...", "demo": "squat" } ] } ],
    "mealDays": [ { "day": 1, "meals": [ { "meal": "Breakfast", "options": ["..."], "calories": 400, "protein": "20g", "carbs": "50g", "fats": "10g" } ] } ],
    "mealTargets": { "calories": 2000, "protein": "150g", "carbs": "200g", "fats": "60g" }
  }
- Each day you include REPLACES that whole day, so list every exercise or meal of that day after the change, copying the untouched ones exactly as they are. Do not include days that stay the same.
- A rest day is a workout day with an empty "exercises" list.
- When you add or replace exercises, pick ones that are not used elsewhere in the week and do not default to the most common ones; an exercise does not need a demo.
- Give every new or changed exercise a conservative recommended "weight" for this user (short text in the plan's language); keep the weight of untouched exercises.
- "demo" is the movement pattern the exercise matches, one of: ${DEMO_KEYS.join(', ')}. Use "" unless the exercise is that movement or a close variation of it.
- Write exercise names, meal names, options, focus and notes in the same language the current plan uses.
- Respect the user's equipment, training wishes, diet and allergies. Days may differ in calories (more on training days, less on rest days) as long as the weekly average stays close to the target, unless the user asks otherwise.
- Rules for every meal you add or change (untouched meals stay exactly as they are):
      ${nutritionRules(userData)}
- When the user names their own dish, use exactly that dish even if it is not a typical diet food: choose a portion in grams that fits the meal's calories and estimate its calories and macros honestly.
- Change "mealTargets" only when the user asks to change the targets.
- If the request is unclear (for example, which day), ask a short question in "reply" and keep "changes" null.`

  const raw = await generateWithFallback(prompt, true)
  const parsed = parseJson(raw)
  const reply = typeof parsed?.reply === 'string' && parsed.reply.trim() ? parsed.reply.trim() : null

  if (!reply) {
    // Not the JSON we asked for: plain text is still an answer; broken JSON is a failure (null).
    return parsed ? null : { reply: raw.trim(), changes: null }
  }
  return { reply, changes: userData?.plan ? sanitizeChanges(parsed.changes) : null }
}

const strings = (value: unknown, max: number) =>
  (Array.isArray(value) ? value : []).map((item) => String(item).trim()).filter(Boolean).slice(0, max)

/** A detailed technique guide for one exercise; null when the model returned nothing usable. */
export async function guideFromAI(exerciseName: string, locale: string): Promise<ExerciseGuide | null> {
  const name = line(exerciseName, 120).replace(/["`]/g, '')
  if (!name) return null

  const prompt = `You are an experienced strength and conditioning coach. Explain how to perform the exercise "${name}" safely and with correct technique, for a person training on their own.
Write every text value in ${LANGUAGE_NAMES[locale] || 'English'}. Be concrete and brief: each item is one sentence.

Answer with a single JSON object:
{
  "muscles": ["main muscles worked, 2-4 items"],
  "steps": ["4-6 steps, from the starting position to the end of a repetition"],
  "mistakes": ["2-3 common mistakes and how to avoid them"],
  "breathing": "when to inhale and when to exhale"
}`

  const parsed = parseJson(await generateWithFallback(prompt, true, true))
  const guide: ExerciseGuide = {
    muscles: strings(parsed?.muscles, 5),
    steps: strings(parsed?.steps, 8),
    mistakes: strings(parsed?.mistakes, 4),
    breathing: typeof parsed?.breathing === 'string' ? parsed.breathing.trim() : '',
  }
  return guide.steps.length ? guide : null
}

/**
 * Translates the plan's texts (exercise and meal names, notes, tips) into another language.
 * Only the strings travel to the model and come back by position, so numbers and structure cannot change.
 */
export async function translatePlanWithAI(plan: any, locale: string): Promise<any> {
  const copy = JSON.parse(JSON.stringify(plan))
  const slots: { holder: any; key: string | number }[] = []
  const slot = (holder: any, key: string | number) => {
    if (holder && typeof holder[key] === 'string' && holder[key].trim()) slots.push({ holder, key })
  }

  for (const day of Array.isArray(copy?.workoutPlan) ? copy.workoutPlan : []) {
    slot(day, 'focus')
    for (const exercise of Array.isArray(day?.exercises) ? day.exercises : []) {
      slot(exercise, 'name')
      slot(exercise, 'notes')
      slot(exercise, 'weight')
      // Reps are usually a number, but can carry words ("45 sec", "10 per leg").
      if (/[^\d\s\-–.,x×]/.test(String(exercise?.reps ?? ''))) slot(exercise, 'reps')
    }
  }
  const mealDays = [...(copy?.mealPlan?.weeklyMeals || []), { meals: copy?.mealPlan?.dailyMeals }]
  for (const day of mealDays) {
    for (const meal of Array.isArray(day?.meals) ? day.meals : []) {
      slot(meal, 'meal')
      slot(meal, 'name')
      slot(meal, 'description')
      if (Array.isArray(meal?.options)) meal.options.forEach((_: unknown, i: number) => slot(meal.options, i))
      else slot(meal, 'options')
    }
  }
  if (Array.isArray(copy?.tips)) copy.tips.forEach((_: unknown, i: number) => slot(copy.tips, i))

  const texts = unique(slots.map(({ holder, key }) => String(holder[key]).slice(0, 300))).slice(0, 400)
  if (texts.length === 0) return copy

  const prompt = `Translate every string of this JSON array into ${LANGUAGE_NAMES[locale] || 'English'}. They are items of a fitness plan: exercise names, workout focus, meals, dishes and short notes. Use the usual gym and cooking terms of that language, keep numbers and units as they are, and leave strings that are already in that language unchanged.

${JSON.stringify(texts)}

Answer with a single JSON object: { "t": [ ...the ${texts.length} translated strings in the same order... ] }`

  const parsed = parseJson(await generateWithFallback(prompt, false))
  const translated: unknown[] = Array.isArray(parsed?.t) ? parsed.t : []
  if (translated.length !== texts.length) throw new Error('Translation returned a different number of strings')

  const byOriginal = new Map(texts.map((original, i) => [original, String(translated[i] || original)]))
  for (const { holder, key } of slots) holder[key] = byOriginal.get(String(holder[key]).slice(0, 300)) ?? holder[key]
  return copy
}

export interface FoodEstimate {
  name: string
  grams?: number // the portion the numbers are for; only for a photo
  calories: number
  protein: number
  carbs: number
  fats: number
}

/** Calories and macros of something the user ate outside the plan, from their own description or a photo of it. */
export async function foodFromAI(text: string, locale: string, image?: { data: string; mimeType: string }): Promise<FoodEstimate | null> {
  const food = line(text, 200).replace(/["`]/g, '')
  if (!food && !image) return null
  const language = LANGUAGE_NAMES[locale] || 'English'

  const prompt = image
    ? `The photo shows food a person is eating. Name it and estimate the weight of the whole visible portion in grams,
then estimate that portion like a dietitian using standard food composition tables (count visible oil, sauces and dressings).
If the photo shows no food, answer with "calories": 0.

Answer with a single JSON object:
{ "name": "short name of the food without the amount, in ${language}", "grams": 0, "calories": 0, "protein": 0, "carbs": 0, "fats": 0 }
Calories are kcal, the rest are grams, all whole numbers.`
    : `A person describes what they ate: "${food}".
Estimate it like a dietitian using standard food composition tables. If no amount is given, assume one usual portion.

Answer with a single JSON object:
{ "name": "short name of the food with the amount, in ${language}", "calories": 0, "protein": 0, "carbs": 0, "fats": 0 }
Calories are kcal, the rest are grams, all whole numbers.`

  const parsed = parseJson(await generateWithFallback(image ? [prompt, { inlineData: image }] : prompt, true, true))
  const number = (value: unknown) => Math.max(0, Math.round(parseFloat(String(value)) || 0))
  const calories = number(parsed?.calories)
  if (!calories || calories > 5000) return null
  return {
    name: line(parsed?.name, 120) || food,
    ...(image && number(parsed?.grams) ? { grams: number(parsed.grams) } : {}),
    calories,
    protein: number(parsed?.protein),
    carbs: number(parsed?.carbs),
    fats: number(parsed?.fats),
  }
}

export interface Recipe {
  ingredients: string[]
  steps: string[]
}

/** How to cook one dish of the plan; null when the model returned nothing usable. */
export async function recipeFromAI(dish: string, locale: string): Promise<Recipe | null> {
  const name = line(dish, 300).replace(/["`]/g, '')
  if (!name) return null

  const prompt = `Explain how to cook this dish for one person at home, the simplest usual way: "${name}".
The amounts in brackets are the ready-to-eat portion; keep the portion that size.
Write every text value in ${LANGUAGE_NAMES[locale] || 'English'}. Each step is one short sentence.

Answer with a single JSON object:
{
  "ingredients": ["every ingredient with the raw amount to take, e.g. dry rice — 70 g"],
  "steps": ["3-6 cooking steps"]
}`

  const parsed = parseJson(await generateWithFallback(prompt, true, true))
  const recipe: Recipe = { ingredients: strings(parsed?.ingredients, 12), steps: strings(parsed?.steps, 8) }
  return recipe.steps.length ? recipe : null
}

export interface ShoppingCategory {
  name: string
  items: string[]
}

/** A consolidated shopping list for the dishes of the week. */
export async function shoppingFromAI(meals: unknown, locale: string): Promise<ShoppingCategory[] | null> {
  const dishes = (Array.isArray(meals) ? meals : []).slice(0, 60).map((meal) => line(meal, 160)).filter(Boolean)
  if (dishes.length === 0) return null

  const prompt = `These are the dishes one person will cook during a week (repeats mean the dish is eaten several times):
${JSON.stringify(dishes)}

Write one consolidated shopping list for the whole week in ${LANGUAGE_NAMES[locale] || 'English'}: merge the same ingredient across dishes and give a sensible total amount for one person. Skip water, salt and pepper. Group the items by store section.

Answer with a single JSON object:
{ "categories": [ { "name": "section name", "items": ["ingredient — amount"] } ] }`

  const parsed = parseJson(await generateWithFallback(prompt, true))
  const categories = (Array.isArray(parsed?.categories) ? parsed.categories : [])
    .map((category: any) => ({ name: line(category?.name, 60), items: unique(strings(category?.items, 40).map((item) => line(item, 100))) }))
    .filter((category: ShoppingCategory) => category.name && category.items.length)
    .slice(0, 12)
  return categories.length ? categories : null
}
