import 'server-only'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { DEMO_KEYS } from './exercises'
import { compactPlan, sanitizeChanges } from './plan'
import { detectLanguage, type ChatResult, type ChatTurn, type ExerciseGuide } from './aiShared'

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
async function generateWithFallback(prompt: string, interactive: boolean, preferFast = false) {
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

export async function planFromAI(userData: any, locale: string, previous?: any) {
  const lastWeek = previous?.workouts ? JSON.stringify(previous.workouts).slice(0, 6000) : ''
  const lifts = previous?.lifts && Object.keys(previous.lifts).length ? JSON.stringify(previous.lifts).slice(0, 1500) : ''
  const prompt = `
      You are an elite fitness coach. Create a JSON fitness plan for this user.
      Write every text value (focus, exercise and meal names, options, notes, tips) in ${LANGUAGE_NAMES[locale] || 'English'}. Keep the JSON keys in English.

      User Profile:
      - Name: ${line(userData?.name)}
      - Gender: ${line(userData?.gender)}
      - Age: ${line(userData?.age)}
      - Height: ${line(userData?.height)} cm
      - Weight: ${line(userData?.weight)} kg
      - Activity: ${line(userData?.activityLevel)}
      - Goal: ${line(userData?.fitnessGoal)}
      - Frequency: ${line(userData?.trainingFrequency)} days/week
      - Equipment: ${list(userData?.equipmentAccess)}
      - Training wishes and limitations (in the user's own words; follow them): ${line(userData?.trainingNotes, 500) || 'none'}
      - Diet: ${list(userData?.dietPreferences)}
      - Allergies: ${line(userData?.allergies, 300)}

      ${lastWeek ? `This plan is for the NEXT week. Last week the user completed ${line(previous.completed, 3)} of ${line(previous.planned, 3)} planned workouts:
      ${lastWeek}
      Build on it: if most workouts were done, progress modestly (a little more reps, sets or a harder variation) and swap one or two exercises per day for variety; if few were done, make the week easier to stick to. Vary the meals compared to a typical repeat.` : ''}

      ${lifts ? `Loads the user actually worked with (exercise -> load): ${lifts}. Base the recommended weights on them.` : ''}

      REQUIRED JSON STRUCTURE (Create a 7-day plan):
      {
        "workoutPlan": [
          {
            "day": "Day 1",
            "focus": "Legs/Cardio",
            "exercises": [
              { "name": "Squats", "sets": "3", "reps": "12", "weight": "2 × 10", "rest": 60, "notes": "Keep back straight", "demo": "squat" }
            ]
          },
          { "day": "Day 2", "focus": "Upper Body", "exercises": [...] },
          ... (create 7 days total)
        ],
        "mealPlan": {
          "calories": 2000,
          "macros": { "protein": "150g", "carbs": "200g", "fats": "60g" },
          "weeklyMeals": [
            {
              "day": 1,
              "meals": [
                { "meal": "Breakfast", "options": ["Oatmeal with berries", "Greek yogurt"], "calories": 400, "protein": "20g", "carbs": "50g", "fats": "10g" },
                { "meal": "Lunch", "options": ["Grilled chicken salad"], "calories": 500, "protein": "40g", "carbs": "30g", "fats": "20g" },
                { "meal": "Dinner", "options": ["Salmon with vegetables"], "calories": 600, "protein": "45g", "carbs": "40g", "fats": "25g" },
                { "meal": "Snack", "options": ["Apple with almond butter"], "calories": 200, "protein": "5g", "carbs": "25g", "fats": "10g" }
              ]
            },
            ... (create 7 days total)
          ]
        },
        "tips": ["Drink water", "Sleep 8 hours"]
      }

      Exercise variety: choose from the full range of exercises that fit the equipment and the user's wishes — compound and
      isolation lifts, single-leg and single-arm work, core, mobility and conditioning — not only the most common ones and
      not only those that have a demo. Do not repeat an exercise on two different days, and give each training day
      5-6 exercises that work well together.

      For every exercise: "weight" is a recommended starting load for THIS user as a short text written in ${LANGUAGE_NAMES[locale] || 'English'}, units included
      (two 8-kilogram dumbbells, bodyweight, a light band and so on). Base it on sex, body weight, goal and the available
      equipment, and stay on the conservative side: the last reps should be hard but clean.
      "rest" is the rest between sets in seconds, and "demo" is the movement pattern
      it matches, one of: ${DEMO_KEYS.join(', ')}. Use "" unless the exercise is that movement or a close variation of it.

      Days do not need the same calories: training days may be higher and rest days lower,
      as long as the weekly average stays close to "calories". Each meal's numbers must be realistic for that meal.
    `

  // JSON-режим гарантирует, что ответ будет в правильном формате
  const plan = parseJson(await generateWithFallback(prompt, false))
  if (!Array.isArray(plan?.workoutPlan) || !plan?.mealPlan) {
    throw new Error('Gemini returned a plan with an unexpected structure')
  }
  return plan
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
        `Allergies: ${line(userData.allergies, 300) || 'none'}`,
      ].join('; ')
    : 'unknown'

  const plan = userData?.plan ? JSON.stringify(compactPlan(userData.plan)) : null
  const conversation = (Array.isArray(options.history) ? options.history : [])
    .slice(-HISTORY_LIMIT)
    .map((turn) => `${turn?.role === 'user' ? 'User' : 'Coach'}: ${String(turn?.content || '').slice(0, 2000)}`)
    .join('\n')

  const prompt = `You are an expert AI fitness and nutrition coach inside the Rovix app. You give helpful, accurate, motivating advice about training, nutrition, weight management and healthy habits. Be friendly and practical. If you don't know something, say so rather than guessing.

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
