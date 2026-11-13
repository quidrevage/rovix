'use client'

import React, { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { TrendingUp, TrendingDown, Target, Weight, Activity, BarChart3, Plus, Dumbbell, Ruler } from 'lucide-react'
import dynamic from 'next/dynamic'
import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useUser } from '@/context/UserContext'
import { calculateUserMetrics, calorieAdvice, toDateKey } from '@/lib/utils'
import { GOAL_KEYS } from '@/lib/options'
import { bestSet, formatSet, type LiftSession } from '@/lib/lifts'
import Card from './ui/Card'
import Navbar from './ui/Navbar'
import Button from './ui/Button'

const ProgressChart = dynamic(() => import('./ProgressChart'), { ssr: false, loading: () => <div className="h-[300px]" /> })

interface ProgressEntry {
  date: string // YYYY-MM-DD
  weight?: number
  calories?: number
  workouts?: number
  waist?: number // cm
  chest?: number
  hips?: number
}

const MEASURES = ['waist', 'chest', 'hips'] as const
const MEASURE_COLORS = { waist: '#ff6b35', chest: '#9b59b6', hips: '#10b981' }

const PERIOD_DAYS = { week: 7, month: 30, year: 365 } as const
type Period = keyof typeof PERIOD_DAYS

const toDateInput = (date: Date) => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return local.toISOString().split('T')[0]
}

const optionalNumber = (value: string) => {
  const parsed = Number(value)
  return value.trim() !== '' && parsed >= 0 ? parsed : undefined
}

const inputClass =
  'w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-fitness-orange focus:border-transparent'

export default function ProgressPage() {
  const { userData, setUserData, loading } = useUser()
  const t = useTranslations('progress')
  const tProfile = useTranslations('profile')
  const locale = useLocale()
  const router = useRouter()
  const [selectedPeriod, setSelectedPeriod] = useState<Period>('month')
  const [form, setForm] = useState({ date: toDateInput(new Date()), weight: '', calories: '', workouts: '', waist: '', chest: '', hips: '' })
  const [selectedLift, setSelectedLift] = useState('')

  const entries: ProgressEntry[] = useMemo(() => userData?.progress || [], [userData])

  const currentData = useMemo(() => {
    const from = new Date()
    from.setDate(from.getDate() - PERIOD_DAYS[selectedPeriod] + 1)
    const fromKey = toDateInput(from)
    return entries
      .filter((entry) => entry.date >= fromKey)
      .map((entry) => ({
        ...entry,
        label: new Date(`${entry.date}T00:00:00`).toLocaleDateString(locale, { month: 'short', day: 'numeric' }),
      }))
  }, [entries, selectedPeriod, locale])

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-fitness-orange border-t-transparent" />
      </div>
    )
  }

  if (!userData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100">
        <Navbar />
        <div className="max-w-4xl mx-auto py-12 px-4">
          <Card className="text-center py-12">
            <h2 className="text-2xl font-bold mb-4">{tProfile('noProfile')}</h2>
            <p className="text-gray-600 mb-6">{tProfile('completeOnboarding')}</p>
            <Button onClick={() => router.push(`/${locale}/onboarding`)}>{tProfile('goToOnboarding')}</Button>
          </Card>
        </div>
      </div>
    )
  }

  const metrics = calculateUserMetrics(userData)
  const advice = calorieAdvice(userData)
  const calorieAdjust = Number(userData.calorieAdjust) || 0
  const setCalorieAdjust = (value: number) =>
    setUserData({ ...userData, calorieAdjust: value, calorieAdjustedAt: toDateKey() })

  const weights = currentData.filter((d) => d.weight !== undefined).map((d) => d.weight as number)
  const calorieDays = currentData.filter((d) => d.calories !== undefined)
  const weightChange =
    weights.length > 1 && weights[0] > 0 ? (((weights[weights.length - 1] - weights[0]) / weights[0]) * 100).toFixed(1) : '0'

  const stats = {
    weightChange,
    workoutsCompleted: currentData.reduce((sum, d) => sum + (d.workouts || 0), 0),
    avgCalories: calorieDays.length
      ? Math.round(calorieDays.reduce((sum, d) => sum + (d.calories as number), 0) / calorieDays.length)
      : 0,
    consistency: Math.round((currentData.filter((d) => (d.workouts || 0) > 0).length / PERIOD_DAYS[selectedPeriod]) * 100),
  }

  const saveEntry = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.date) return

    // Only the filled fields: saving a waist measurement must not erase the day's weight.
    const filled = Object.fromEntries(
      (['weight', 'calories', 'workouts', ...MEASURES] as const)
        .map((key) => [key, optionalNumber(form[key])] as const)
        .filter(([, value]) => value !== undefined)
    )
    if (Object.keys(filled).length === 0) return

    const entry: ProgressEntry = { ...entries.find((item) => item.date === form.date), ...filled, date: form.date }
    const progress = [...entries.filter((item) => item.date !== entry.date), entry].sort((a, b) =>
      a.date.localeCompare(b.date)
    )
    setUserData({ ...userData, progress })
    setForm({ date: form.date, weight: '', calories: '', workouts: '', waist: '', chest: '', hips: '' })
  }

  const measured = MEASURES.filter((key) => currentData.some((entry) => entry[key] !== undefined))

  // Strength: the best set of every logged session of the chosen exercise.
  const liftLog: Record<string, LiftSession[]> = userData.liftLog || {}
  const liftNames = Object.keys(liftLog).sort()
  const lift = liftLog[selectedLift] ? selectedLift : liftNames[0]
  const liftAll = liftLog[lift] || []
  const liftRecord = bestSet(liftAll.flatMap((session) => session.sets))
  const liftWeighted = Boolean(liftRecord && liftRecord.kg > 0)
  const liftFrom = new Date()
  liftFrom.setDate(liftFrom.getDate() - PERIOD_DAYS[selectedPeriod] + 1)
  const liftData = liftAll
    .filter((session) => session.date >= toDateInput(liftFrom))
    .map((session) => {
      const best = bestSet(session.sets)
      return {
        label: new Date(`${session.date}T00:00:00`).toLocaleDateString(locale, { month: 'short', day: 'numeric' }),
        best: best && (liftWeighted ? best.kg : best.reps),
      }
    })

  const noData = <p className="py-12 text-center text-gray-500">{t('noData')}</p>

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <h1 className="text-4xl font-bold mb-2">{t('title')}</h1>
          <p className="text-gray-600">{t('description')}</p>
        </motion.div>

        {(advice || calorieAdjust !== 0) && (
          <Card className="mb-6 border-l-4 border-fitness-orange">
            <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
              <Target className="w-5 h-5 text-fitness-orange" />
              {t('adjust.title')}
            </h3>
            {advice && (
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <p className="flex-1 text-gray-700">
                  {t(advice.delta > 0 ? 'adjust.more' : 'adjust.less', {
                    days: advice.days,
                    change: `${advice.change > 0 ? '+' : ''}${advice.change}`,
                    kcal: Math.abs(advice.delta),
                  })}
                </p>
                <Button size="sm" onClick={() => setCalorieAdjust(calorieAdjust + advice.delta)}>
                  {t('adjust.apply')}
                </Button>
              </div>
            )}
            {calorieAdjust !== 0 && (
              <p className="mt-2 text-sm text-gray-500">
                {t('adjust.current', { value: `${calorieAdjust > 0 ? '+' : ''}${calorieAdjust}` })}{' '}
                <button type="button" className="underline hover:text-fitness-orange" onClick={() => setCalorieAdjust(0)}>
                  {t('adjust.reset')}
                </button>
              </p>
            )}
            <p className="mt-2 text-xs text-gray-500">{t('adjust.hint')}</p>
          </Card>
        )}

        {/* Daily log */}
        <Card className="mb-6">
          <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Plus className="w-5 h-5 text-fitness-orange" />
            {t('log.title')}
          </h3>
          <form onSubmit={saveEntry} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
            <label className="block text-sm font-medium text-gray-700">
              <span className="block mb-2">{t('log.date')}</span>
              <input
                type="date"
                required
                max={toDateInput(new Date())}
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className={inputClass}
              />
            </label>
            <label className="block text-sm font-medium text-gray-700">
              <span className="block mb-2">{t('log.weight')}</span>
              <input
                type="number"
                min="0"
                step="0.1"
                value={form.weight}
                onChange={(e) => setForm({ ...form, weight: e.target.value })}
                className={inputClass}
              />
            </label>
            <label className="block text-sm font-medium text-gray-700">
              <span className="block mb-2">{t('log.calories')}</span>
              <input
                type="number"
                min="0"
                value={form.calories}
                onChange={(e) => setForm({ ...form, calories: e.target.value })}
                className={inputClass}
              />
            </label>
            <label className="block text-sm font-medium text-gray-700">
              <span className="block mb-2">{t('log.workouts')}</span>
              <input
                type="number"
                min="0"
                value={form.workouts}
                onChange={(e) => setForm({ ...form, workouts: e.target.value })}
                className={inputClass}
              />
            </label>
            {MEASURES.map((key) => (
              <label key={key} className="block text-sm font-medium text-gray-700">
                <span className="block mb-2">{t(`log.${key}`)}</span>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={form[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  className={inputClass}
                />
              </label>
            ))}
            <Button type="submit" size="sm" className="py-3">
              {t('log.save')}
            </Button>
          </form>
          <p className="mt-3 text-xs text-gray-500">{t('log.hint')}</p>
        </Card>

        {/* Period Selector */}
        <div className="flex gap-2 mb-6">
          {(Object.keys(PERIOD_DAYS) as Period[]).map((period) => (
            <Button
              key={period}
              variant={selectedPeriod === period ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setSelectedPeriod(period)}
            >
              {t(`periods.${period}`)}
            </Button>
          ))}
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card glass>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">{t('stats.weightChange')}</p>
                <p className="text-2xl font-bold">{stats.weightChange}%</p>
              </div>
              <TrendingDown className="w-8 h-8 text-fitness-green" />
            </div>
          </Card>
          <Card glass>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">{t('stats.workouts')}</p>
                <p className="text-2xl font-bold">{stats.workoutsCompleted}</p>
              </div>
              <Activity className="w-8 h-8 text-fitness-orange" />
            </div>
          </Card>
          <Card glass>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">{t('stats.avgCalories')}</p>
                <p className="text-2xl font-bold">{stats.avgCalories}</p>
              </div>
              <Target className="w-8 h-8 text-fitness-purple" />
            </div>
          </Card>
          <Card glass>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">{t('stats.consistency')}</p>
                <p className="text-2xl font-bold">{stats.consistency}%</p>
              </div>
              <TrendingUp className="w-8 h-8 text-fitness-green" />
            </div>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <Card>
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Weight className="w-5 h-5 text-fitness-orange" />
              {t('charts.weightProgress')}
            </h3>
            {weights.length === 0 ? noData : (
              <ProgressChart kind="line" data={currentData} dataKey="weight" color="#ff6b35" name={t('charts.weight')} />
            )}
          </Card>

          <Card>
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Target className="w-5 h-5 text-fitness-green" />
              {t('charts.dailyCalories')}
            </h3>
            {calorieDays.length === 0 ? noData : (
              <ProgressChart kind="bar" data={currentData} dataKey="calories" color="#10b981" name={t('charts.calories')} />
            )}
          </Card>
        </div>

        <Card>
          <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-fitness-purple" />
            {t('charts.workoutFrequency')}
          </h3>
          {stats.workoutsCompleted === 0 ? noData : (
            <ProgressChart kind="bar" data={currentData} dataKey="workouts" color="#9b59b6" name={t('charts.workoutsPerDay')} wholeNumbers />
          )}
        </Card>

        {measured.length > 0 && (
          <Card className="mt-6">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Ruler className="w-5 h-5 text-fitness-green" />
              {t('charts.measurements')}
            </h3>
            <ProgressChart
              kind="line"
              data={currentData}
              dataKey={measured[0]}
              color={MEASURE_COLORS[measured[0]]}
              name={t(`log.${measured[0]}`)}
              more={measured.slice(1).map((key) => ({ dataKey: key, color: MEASURE_COLORS[key], name: t(`log.${key}`) }))}
            />
          </Card>
        )}

        <Card className="mt-6">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-xl font-bold flex items-center gap-2">
              <Dumbbell className="w-5 h-5 text-fitness-orange" />
              {t('strength.title')}
            </h3>
            {liftNames.length > 0 && (
              <select value={lift} onChange={(e) => setSelectedLift(e.target.value)} className={`${inputClass} capitalize sm:w-72`}>
                {liftNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            )}
          </div>
          {liftNames.length === 0 ? (
            <p className="py-12 text-center text-gray-500">{t('strength.empty')}</p>
          ) : (
            <>
              {liftRecord && <p className="mb-2 text-sm text-gray-600">{t('strength.record', { set: formatSet(liftRecord) })}</p>}
              {liftData.length === 0 ? noData : (
                <ProgressChart
                  kind="line"
                  data={liftData}
                  dataKey="best"
                  color="#ff6b35"
                  name={t(liftWeighted ? 'strength.kg' : 'strength.reps')}
                />
              )}
            </>
          )}
        </Card>

        {/* Goals Summary */}
        {metrics && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
            <Card glass>
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Target className="w-5 h-5 text-fitness-orange" />
                {t('goals.yourGoals')}
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">{t('goals.fitnessGoal')}</span>
                  <span className="font-semibold">
                    {GOAL_KEYS[userData.fitnessGoal] ? tProfile(GOAL_KEYS[userData.fitnessGoal]) : t('notSet')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">{t('goals.targetCalories')}</span>
                  <span className="font-semibold">{metrics.calories} {t('kcalPerDay')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">{t('goals.trainingFrequency')}</span>
                  <span className="font-semibold">{userData.trainingFrequency || 0} {t('goals.daysPerWeek')}</span>
                </div>
              </div>
            </Card>

            <Card glass>
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-fitness-green" />
                {t('metrics.currentMetrics')}
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">{t('metrics.bmi')}</span>
                  <span className="font-semibold">{metrics.bmi}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">{t('metrics.protein')}</span>
                  <span className="font-semibold">{metrics.protein} {t('metrics.perDay')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">{t('metrics.carbs')}</span>
                  <span className="font-semibold">{metrics.carbs} {t('metrics.perDay')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">{t('metrics.fats')}</span>
                  <span className="font-semibold">{metrics.fats} {t('metrics.perDay')}</span>
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
