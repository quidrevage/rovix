'use client'

import React, { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { TrendingUp, TrendingDown, Target, Weight, Activity, BarChart3, Plus } from 'lucide-react'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useUser } from '@/context/UserContext'
import { calculateUserMetrics } from '@/lib/utils'
import { GOAL_KEYS } from '@/lib/options'
import Card from './ui/Card'
import Navbar from './ui/Navbar'
import Button from './ui/Button'

interface ProgressEntry {
  date: string // YYYY-MM-DD
  weight?: number
  calories?: number
  workouts?: number
}

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
  const [form, setForm] = useState({ date: toDateInput(new Date()), weight: '', calories: '', workouts: '' })

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

    const entry: ProgressEntry = {
      date: form.date,
      weight: optionalNumber(form.weight),
      calories: optionalNumber(form.calories),
      workouts: optionalNumber(form.workouts),
    }
    if (entry.weight === undefined && entry.calories === undefined && entry.workouts === undefined) return

    const progress = [...entries.filter((item) => item.date !== entry.date), entry].sort((a, b) =>
      a.date.localeCompare(b.date)
    )
    setUserData({ ...userData, progress })
    setForm({ ...form, weight: '', calories: '', workouts: '' })
  }

  const noData = <p className="py-12 text-center text-gray-500">{t('noData')}</p>

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <h1 className="text-4xl font-bold mb-2">{t('title')}</h1>
          <p className="text-gray-600">{t('description')}</p>
        </motion.div>

        {/* Daily log */}
        <Card className="mb-6">
          <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Plus className="w-5 h-5 text-fitness-orange" />
            {t('log.title')}
          </h3>
          <form onSubmit={saveEntry} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
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
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={currentData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" />
                  <YAxis domain={['auto', 'auto']} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="weight" connectNulls stroke="#ff6b35" strokeWidth={2} name={t('charts.weight')} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </Card>

          <Card>
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Target className="w-5 h-5 text-fitness-green" />
              {t('charts.dailyCalories')}
            </h3>
            {calorieDays.length === 0 ? noData : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={currentData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="calories" fill="#10b981" name={t('charts.calories')} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>
        </div>

        <Card>
          <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-fitness-purple" />
            {t('charts.workoutFrequency')}
          </h3>
          {stats.workoutsCompleted === 0 ? noData : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={currentData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="workouts" fill="#9b59b6" name={t('charts.workoutsPerDay')} />
              </BarChart>
            </ResponsiveContainer>
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
