'use client'

import React, { useCallback, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Calendar,
  UtensilsCrossed,
  Dumbbell,
  TrendingUp,
  RefreshCw,
  Download,
  ChefHat,
  Apple,
  Coffee,
  Sunset,
  Bot,
  PlayCircle,
  CheckCircle2,
  Circle,
  Repeat,
  Sparkles,
  Shuffle,
} from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import Button from './ui/Button'
import Card from './ui/Card'
import Navbar from './ui/Navbar'
import PlanTranslator from './PlanTranslator'
import { useUser } from '@/context/UserContext'
import { calculateUserMetrics } from '@/lib/utils'
import { chatWithAI, generateFitnessPlan } from '@/lib/gemini'
import { applyPlanChanges, compactPlan, getMealDays, getWorkoutDays, mealKind, type ExerciseView } from '@/lib/plan'
import { WEEK_DAYS, clearExerciseMarks, daysInto, setDayDone, setExerciseDone, startNewWeek, weekOf } from '@/lib/week'

// Not needed for the first paint: the chat, the exercise dialog and the PDF library load on their own.
const AICoach = dynamic(() => import('./AICoach'), { ssr: false })
const ExerciseModal = dynamic(() => import('./ExerciseModal'), { ssr: false })

type Tab = 'meal' | 'workout' | 'coach'

export default function Dashboard() {
  const t = useTranslations('dashboard')
  const locale = useLocale()
  const router = useRouter()
  const { userData, setUserData } = useUser()
  const [activeTab, setActiveTab] = useState<Tab>('meal')
  const [loading, setLoading] = useState(false)
  const [openExercise, setOpenExercise] = useState<{ exercise: ExerciseView; day: number; index: number; count: number } | null>(null)
  const closeExercise = useCallback(() => setOpenExercise(null), [])

  const metrics = useMemo(() => (userData ? calculateUserMetrics(userData) : null), [userData])
  const mealPlans = useMemo(() => getMealDays(userData?.plan?.mealPlan), [userData?.plan?.mealPlan])
  const workoutPlans = useMemo(() => getWorkoutDays(userData?.plan?.workoutPlan), [userData?.plan?.workoutPlan])

  const week = weekOf(userData)
  const trainingDays = workoutPlans.filter((plan) => plan.exercises.length > 0)
  const doneCount = trainingDays.filter((plan) => week.doneDays[plan.day]).length
  const weekDay = daysInto(week) + 1
  const weekOver = weekDay > WEEK_DAYS
  const weekFinished = trainingDays.length > 0 && doneCount === trainingDays.length

  // `nextWeek`: the new plan builds on the one just finished instead of starting from scratch.
  const regeneratePlans = async (nextWeek = false) => {
    if (!userData) return

    setLoading(true)
    try {
      const previous = {
        lifts: userData.lifts,
        ...(nextWeek ? { workouts: compactPlan(userData.plan).workoutPlan, completed: doneCount, planned: trainingDays.length } : {}),
      }
      const newPlan = await generateFitnessPlan(userData, locale, previous)
      // Generation takes a while: merge into the data as it is now, not as it was when the request started.
      setUserData((current: any) => startNewWeek(current, newPlan))
    } catch (error) {
      console.error('Error regenerating plan:', error)
      alert(t('actions.regenerateError'))
    } finally {
      setLoading(false)
    }
  }

  // Asks the coach for another exercise in place of the open one; only that day changes.
  const swapExercise = async (): Promise<boolean> => {
    if (!openExercise) return false
    const { exercise, day } = openExercise
    const result = await chatWithAI({
      message: `In the workout plan, replace the exercise "${exercise.name}" on day ${day} with a different exercise for the same muscles that fits my equipment and limitations. Change only that exercise and keep the other exercises of that day exactly as they are.`,
      userData,
      locale,
    })
    const workoutDays = (result.changes?.workoutDays || []).filter((item) => item.day === day)
    if (workoutDays.length === 0) return false
    setUserData((current: any) => clearExerciseMarks({ ...current, plan: applyPlanChanges(current.plan, { workoutDays }).plan }, [day]))
    setOpenExercise(null)
    return true
  }

  const [refreshingDay, setRefreshingDay] = useState<number | null>(null)

  // Asks the coach for a different set of exercises for one day, keeping its focus.
  const refreshDay = async (day: number, focus: string) => {
    setRefreshingDay(day)
    const result = await chatWithAI({
      message: `In the workout plan, replace ALL exercises of day ${day} with a fresh, varied set of different exercises for the same focus ("${focus}") that fits my equipment and limitations. Do not reuse the exercises that day has now.`,
      userData,
      locale,
    })
    const workoutDays = (result.changes?.workoutDays || []).filter((item) => item.day === day && item.exercises.length > 0)
    if (workoutDays.length > 0) {
      setUserData((current: any) => clearExerciseMarks({ ...current, plan: applyPlanChanges(current.plan, { workoutDays }).plan }, [day]))
    } else {
      alert(t('workoutPlan.refreshError'))
    }
    setRefreshingDay(null)
  }

  const exportPDF = async () => {
    try {
      const { exportMealPlanPDF, exportWorkoutPlanPDF } = await import('@/lib/pdfExport')
      if (activeTab === 'workout' && workoutPlans.length > 0) {
        await exportWorkoutPlanPDF(userData, workoutPlans, locale)
      } else if (activeTab !== 'workout' && mealPlans.length > 0) {
        await exportMealPlanPDF(userData, mealPlans, locale)
      } else {
        alert(t('actions.noDataToExport'))
      }
    } catch (error) {
      console.error('Error exporting PDF:', error)
      alert(t('actions.noDataToExport'))
    }
  }

  const tabClass = (tab: Tab) =>
    `px-4 sm:px-6 py-3 font-medium transition-colors border-b-2 whitespace-nowrap ${
      activeTab === tab
        ? 'border-fitness-orange text-fitness-orange'
        : 'border-transparent text-gray-600 hover:text-fitness-orange'
    }`

  // --- ОТРИСОВКА ---

  if (!metrics) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100">
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <Card className="text-center">
            <h2 className="text-2xl font-bold mb-4">{t('completeProfile')}</h2>
            <p className="text-gray-600 mb-6">
              {t('completeOnboarding')}
            </p>
            <Button onClick={() => router.push(`/${locale}/onboarding`)}>
              {t('completeProfile')}
            </Button>
          </Card>
        </div>
      </div>
    )
  }

  const mealIcons: any = {
    breakfast: <Coffee className="w-5 h-5" />,
    lunch: <Sunset className="w-5 h-5" />,
    dinner: <ChefHat className="w-5 h-5" />,
    snack: <Apple className="w-5 h-5" />,
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-4xl font-bold mb-2">
            {t('welcome', { name: userData?.name || 'User' })}
          </h1>
          <p className="text-gray-600">
            {t('personalizedPlan')}
          </p>
          {userData?.plan?.demo && (
            <p className="mt-4 rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800">
              {t('demoNotice')}
            </p>
          )}
        </motion.div>

        {/* Metrics Summary */}
        {metrics && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <Card glass>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">{t('metrics.bmi')}</p>
                  <p className="text-2xl font-bold">{metrics.bmi}</p>
                </div>
                <TrendingUp className="w-8 h-8 text-fitness-orange" />
              </div>
            </Card>
            <Card glass>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">{t('metrics.dailyCalories')}</p>
                  <p className="text-2xl font-bold">{metrics.calories}</p>
                </div>
                <UtensilsCrossed className="w-8 h-8 text-fitness-green" />
              </div>
            </Card>
            <Card glass>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">{t('metrics.protein')}</p>
                  <p className="text-2xl font-bold">{metrics.protein}</p>
                </div>
                <Dumbbell className="w-8 h-8 text-fitness-purple" />
              </div>
            </Card>
            <Card glass>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">{t('metrics.carbs')}</p>
                  <p className="text-2xl font-bold">{metrics.carbs}</p>
                </div>
                <Apple className="w-8 h-8 text-fitness-green" />
              </div>
            </Card>
          </div>
        )}

        <PlanTranslator />

        {/* Training week */}
        {trainingDays.length > 0 && (
          <Card className={`mb-8 ${weekOver || weekFinished ? 'border-fitness-orange bg-orange-50' : ''}`}>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="min-w-[200px] flex-1">
                <h2 className="text-lg font-bold">
                  {weekOver ? t('week.overTitle') : weekFinished ? t('week.finishedTitle') : t('week.title', { day: weekDay })}
                </h2>
                <p className="text-sm text-gray-600">
                  {t('week.done', { done: doneCount, total: trainingDays.length })}
                  {(weekOver || weekFinished) && ` ${t('week.nextHint')}`}
                </p>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-200">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-fitness-orange to-fitness-purple transition-all"
                    style={{ width: `${(doneCount / trainingDays.length) * 100}%` }}
                  />
                </div>
              </div>
              {(weekOver || weekFinished) && (
                <div className="flex flex-wrap gap-3">
                  <Button onClick={() => regeneratePlans(true)} isLoading={loading}>
                    <Sparkles className="w-4 h-4 mr-2" />
                    {t('week.newPlan')}
                  </Button>
                  <Button variant="outline" disabled={loading} onClick={() => setUserData((current: any) => startNewWeek(current))}>
                    <Repeat className="w-4 h-4 mr-2" />
                    {t('week.repeat')}
                  </Button>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Tabs */}
        <div className="mb-6">
          <div className="flex gap-2 sm:gap-4 border-b border-gray-200 overflow-x-auto">
            <button onClick={() => setActiveTab('meal')} className={tabClass('meal')}>
              <UtensilsCrossed className="w-5 h-5 inline mr-2" />
              {t('tabs.mealPlan')}
            </button>
            <button onClick={() => setActiveTab('workout')} className={tabClass('workout')}>
              <Dumbbell className="w-5 h-5 inline mr-2" />
              {t('tabs.workoutPlan')}
            </button>
            <button onClick={() => setActiveTab('coach')} className={tabClass('coach')}>
              <Bot className="w-5 h-5 inline mr-2" />
              {t('tabs.aiCoach')}
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-4 mb-6">
          <Button
            variant="outline"
            onClick={() => regeneratePlans()}
            isLoading={loading}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            {t('actions.regeneratePlans')}
          </Button>
          <Button variant="outline" onClick={exportPDF}>
            <Download className="w-4 h-4 mr-2" />
            {t('actions.exportPDF')}
          </Button>
          {activeTab === 'meal' && (
            <Button
              variant="outline"
              onClick={() => router.push(`/${locale}/meal-plan`)}
            >
              <UtensilsCrossed className="w-4 h-4 mr-2" />
              {t('actions.viewFullMealPlan')}
            </Button>
          )}
        </div>

        {/* Tab Content */}
        {activeTab !== 'coach' && (
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {activeTab === 'meal' && (
            <div className="space-y-6">
              {loading ? (
                <Card className="text-center py-12">
                  <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-fitness-orange border-t-transparent"></div>
                  <p className="mt-4 text-gray-600">{t('actions.generating', { type: t('tabs.mealPlan').toLowerCase() })}</p>
                </Card>
              ) : mealPlans.length === 0 ? (
                <Card className="text-center py-12">
                  <p className="text-gray-600 mb-4">{t('mealPlan.noPlans')}</p>
                </Card>
              ) : (
                mealPlans.map((plan) => (
                  <Card key={plan.id} hover>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-xl font-bold flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-fitness-orange" />
                        {t('day', { day: plan.day })}
                      </h3>
                      <div className="flex gap-4 text-sm">
                        <span className="font-semibold">{t('mealPlan.calories', { calories: plan.totalCalories })}</span>
                        <span className="text-gray-600">
                           P: {plan.totalProtein} | C: {plan.totalCarbs} | F: {plan.totalFats}
                        </span>
                      </div>
                    </div>
                    <div className="grid md:grid-cols-2 gap-4">
                      {plan.meals.map((meal) => (
                        <div
                          key={meal.id}
                          className="p-4 rounded-lg bg-gray-50 border border-gray-200"
                        >
                          <div className="flex items-center gap-2 mb-2">
                            {mealIcons[mealKind(meal.name)]}
                            <h4 className="font-semibold flex-1">{meal.name}</h4>
                            {meal.calories > 0 && (
                              <span className="text-xs font-medium text-gray-500">
                                {t('mealPlan.calories', { calories: meal.calories })}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 mb-2">
                            {meal.description}
                          </p>
                        </div>
                      ))}
                    </div>
                  </Card>
                ))
              )}
            </div>
          )}

          {activeTab === 'workout' && (
            <div className="space-y-6">
              {loading ? (
                <Card className="text-center py-12">
                  <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-fitness-orange border-t-transparent"></div>
                  <p className="mt-4 text-gray-600">{t('actions.generating', { type: t('tabs.workoutPlan').toLowerCase() })}</p>
                </Card>
              ) : workoutPlans.length === 0 ? (
                <Card className="text-center py-12">
                  <p className="text-gray-600 mb-4">{t('workoutPlan.noPlans')}</p>
                </Card>
              ) : (
                <>
                  <p className="flex items-center gap-2 text-sm text-gray-600">
                    <PlayCircle className="w-4 h-4 text-fitness-orange" />
                    {t('workoutPlan.tapHint')}
                  </p>
                  {workoutPlans.map((plan) => {
                    const done = Boolean(week.doneDays[plan.day])
                    const doneExercises = week.doneExercises[plan.day] || []
                    return (
                      <Card key={plan.id} className={done ? 'border-green-300' : undefined}>
                        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                          <h3 className="text-xl font-bold flex items-center gap-2">
                            <Calendar className="w-5 h-5 text-fitness-purple" />
                            {t('day', { day: plan.day })}
                            {plan.focus && <span className="text-base font-medium text-gray-600">· {plan.focus}</span>}
                          </h3>
                          {plan.exercises.length > 0 && (
                            <div className="flex flex-wrap items-center gap-3">
                              {!done && (
                                <button
                                  type="button"
                                  onClick={() => refreshDay(plan.day, plan.focus)}
                                  disabled={refreshingDay !== null}
                                  className="inline-flex items-center gap-1.5 rounded-full border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-600 hover:border-fitness-purple hover:text-fitness-purple disabled:opacity-50"
                                >
                                  <Shuffle className={`w-4 h-4 ${refreshingDay === plan.day ? 'animate-spin' : ''}`} />
                                  {t('workoutPlan.refresh')}
                                </button>
                              )}
                              <span className="text-sm text-gray-600">
                                <Dumbbell className="w-4 h-4 inline mr-1" />
                                {t('workoutPlan.duration', { duration: plan.estimatedDuration })}
                              </span>
                              <button
                                type="button"
                                onClick={() => setUserData((current: any) => setDayDone(current, plan.day, !done, plan.exercises.length))}
                                aria-pressed={done}
                                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                                  done
                                    ? 'border-green-300 bg-green-50 text-green-700'
                                    : 'border-gray-300 text-gray-600 hover:border-fitness-green hover:text-fitness-green'
                                }`}
                              >
                                {done ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
                                {done ? t('workoutPlan.done') : t('workoutPlan.markDone')}
                              </button>
                            </div>
                          )}
                        </div>
                        {plan.exercises.length === 0 && (
                          <p className="text-sm text-gray-600">{t('restDay')}</p>
                        )}
                        <div className="space-y-3">
                          {plan.exercises.map((exercise, index) => {
                            const exerciseDone = done || doneExercises.includes(index)
                            return (
                              <div
                                key={exercise.id}
                                className={`flex items-stretch rounded-lg border transition-colors ${
                                  exerciseDone ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50 hover:border-fitness-orange'
                                }`}
                              >
                                <button
                                  type="button"
                                  onClick={() =>
                                    setUserData((current: any) => setExerciseDone(current, plan.day, index, !exerciseDone, plan.exercises.length))
                                  }
                                  aria-pressed={exerciseDone}
                                  aria-label={`${t('workoutPlan.markDone')}: ${exercise.name}`}
                                  className="flex items-center pl-4 pr-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-fitness-green rounded-l-lg"
                                >
                                  {exerciseDone ? (
                                    <CheckCircle2 className="w-6 h-6 text-fitness-green" />
                                  ) : (
                                    <Circle className="w-6 h-6 text-gray-400 hover:text-fitness-green" />
                                  )}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setOpenExercise({ exercise, day: plan.day, index, count: plan.exercises.length })}
                                  className="min-w-0 flex-1 text-left p-4 pl-3 rounded-r-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-fitness-orange"
                                >
                                  <div className="flex items-center justify-between gap-3 mb-2">
                                    <h4 className={`font-semibold ${exerciseDone ? 'text-gray-500 line-through' : ''}`}>{exercise.name}</h4>
                                    <span className="text-sm text-gray-600 text-right">
                                      {t('workoutPlan.setsReps', { sets: exercise.sets, reps: exercise.reps })}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between gap-4 text-xs text-gray-600">
                                    <span>
                                      {t('workoutPlan.rest', { seconds: exercise.restSeconds })}
                                      {exercise.weight && <> · {t('workoutPlan.weight', { weight: exercise.weight })}</>}
                                    </span>
                                    <span className="inline-flex items-center gap-1 font-medium text-fitness-orange">
                                      <PlayCircle className="w-4 h-4" />
                                      {t('workoutPlan.howTo')}
                                    </span>
                                  </div>
                                  {exercise.notes && (
                                    <p className="text-xs text-gray-600 mt-2 italic">
                                      {exercise.notes}
                                    </p>
                                  )}
                                </button>
                              </div>
                            )
                          })}
                        </div>
                      </Card>
                    )
                  })}
                </>
              )}
            </div>
          )}
        </motion.div>
        )}

        {/* The coach stays mounted so the conversation and its undo history survive tab switches. */}
        <div className={activeTab === 'coach' ? '' : 'hidden'}>
          <AICoach active={activeTab === 'coach'} onViewPlan={setActiveTab} />
        </div>
      </div>

      {openExercise && (
        <ExerciseModal
          exercise={openExercise.exercise}
          onClose={closeExercise}
          onSwap={swapExercise}
          onAllSetsDone={() =>
            setUserData((current: any) => setExerciseDone(current, openExercise.day, openExercise.index, true, openExercise.count))
          }
        />
      )}
    </div>
  )
}