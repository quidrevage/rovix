'use client'

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { useUser } from '@/context/UserContext'
import { useTranslations, useLocale } from 'next-intl'
import { useRouter } from 'next/navigation'
import { User, Edit2, Save, X, Calendar, Target, Activity, UtensilsCrossed, Dumbbell } from 'lucide-react'
import Card from './ui/Card'
import Button from './ui/Button'
import Navbar from './ui/Navbar'
import { ACTIVITY_KEYS, DIET_OPTIONS, EQUIPMENT_OPTIONS, GOAL_KEYS, addDiet, customDiets } from '@/lib/options'
import TagInput from './ui/TagInput'
import DataTransfer from './DataTransfer'

export default function Profile() {
  const { userData, setUserData, loading } = useUser()
  const t = useTranslations('profile')
  const tOnboarding = useTranslations('onboarding')
  const locale = useLocale()
  const router = useRouter()
  const [isEditing, setIsEditing] = useState(false)
  const [editedData, setEditedData] = useState<any>({})

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-fitness-orange border-t-transparent" />
      </div>
    )
  }

  if (!userData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        <Navbar />
        <div className="max-w-4xl mx-auto py-12 px-4">
          <Card className="text-center py-12">
            <User className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-4">{t('noProfile')}</h2>
            <p className="text-gray-600 mb-6">{t('completeOnboarding')}</p>
            <Button onClick={() => router.push(`/${locale}/onboarding`)}>
              {t('goToOnboarding')}
            </Button>
            <div className="mx-auto mt-8 max-w-sm text-left">
              <DataTransfer />
            </div>
          </Card>
        </div>
      </div>
    )
  }

  const startEditing = () => {
    setEditedData(userData)
    setIsEditing(true)
  }

  const canSave =
    Boolean(editedData.name?.trim()) && Number(editedData.age) > 0 && Number(editedData.height) > 0 && Number(editedData.weight) > 0

  const handleSave = () => {
    if (!canSave) return
    setUserData(editedData)
    setIsEditing(false)
  }

  const handleCancel = () => {
    setIsEditing(false)
  }

  const optionLabel = (options: { value: string; key: string }[], value: string) => {
    const option = options.find((item) => item.value === value)
    return option ? tOnboarding(option.key) : value
  }

  const calculateBMI = () => {
    if (!userData.height || !userData.weight) return null
    const heightInMeters = Number(userData.height) / 100
    const bmi = Number(userData.weight) / (heightInMeters * heightInMeters)
    return bmi.toFixed(1)
  }

  const noteField = (field: 'allergies' | 'trainingNotes' | 'foodNotes', placeholder: string) => (
    <textarea
      value={editedData[field] || ''}
      onChange={(e) => setEditedData({ ...editedData, [field]: e.target.value })}
      maxLength={500}
      placeholder={placeholder}
      className="w-full h-24 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-fitness-orange focus:border-transparent resize-none dark:bg-gray-700 dark:border-gray-600"
    />
  )

  const setDiets = (dietPreferences: string[]) => setEditedData({ ...editedData, dietPreferences })

  const toggleDiet = (value: string) => {
    const current: string[] = editedData.dietPreferences || []
    // "No Preference" and a specific diet exclude each other.
    const next = current.includes(value)
      ? current.filter((item) => item !== value)
      : value === 'No Preference'
      ? [value]
      : [...current.filter((item) => item !== 'No Preference'), value]
    setEditedData({ ...editedData, dietPreferences: next })
  }

  const bmi = calculateBMI()
  const getBMICategory = (bmi: number) => {
    if (bmi < 18.5) return t('bmiUnderweight')
    if (bmi < 25) return t('bmiNormal')
    if (bmi < 30) return t('bmiOverweight')
    return t('bmiObese')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <Navbar />
      <div className="max-w-6xl mx-auto py-12 px-4">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-fitness-orange to-fitness-purple bg-clip-text text-transparent mb-2">
                {t('title')}
              </h1>
              <p className="text-gray-600 dark:text-gray-400">{t('subtitle')}</p>
            </div>
            {!isEditing ? (
              <Button onClick={startEditing} className="flex items-center gap-2">
                <Edit2 className="w-4 h-4" />
                {t('edit')}
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button onClick={handleCancel} variant="outline" className="flex items-center gap-2">
                  <X className="w-4 h-4" />
                  {t('cancel')}
                </Button>
                <Button onClick={handleSave} disabled={!canSave} className="flex items-center gap-2">
                  <Save className="w-4 h-4" />
                  {t('save')}
                </Button>
              </div>
            )}
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Personal Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Personal Information Card */}
            <Card>
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <User className="w-6 h-6 text-fitness-orange" />
                {t('personalInfo')}
              </h2>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {t('name')}
                    </label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={editedData.name || ''}
                        onChange={(e) => setEditedData({ ...editedData, name: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-fitness-orange focus:border-transparent dark:bg-gray-700 dark:border-gray-600"
                      />
                    ) : (
                      <p className="text-gray-900 dark:text-gray-100 font-medium">{userData.name || '-'}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {t('gender')}
                    </label>
                    {isEditing ? (
                      <select
                        value={editedData.gender || ''}
                        onChange={(e) => setEditedData({ ...editedData, gender: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-fitness-orange focus:border-transparent dark:bg-gray-700 dark:border-gray-600"
                      >
                        <option value="">{t('selectGender')}</option>
                        <option value="male">{t('male')}</option>
                        <option value="female">{t('female')}</option>
                        <option value="other">{t('other')}</option>
                      </select>
                    ) : (
                      <p className="text-gray-900 dark:text-gray-100 font-medium">
                        {userData.gender === 'male' ? t('male') : userData.gender === 'female' ? t('female') : userData.gender === 'other' ? t('other') : '-'}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {t('age')}
                    </label>
                    {isEditing ? (
                      <input
                        type="number"
                        value={editedData.age || ''}
                        onChange={(e) => setEditedData({ ...editedData, age: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-fitness-orange focus:border-transparent dark:bg-gray-700 dark:border-gray-600"
                      />
                    ) : (
                      <p className="text-gray-900 dark:text-gray-100 font-medium">{userData.age || '-'} {t('years')}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {t('height')}
                    </label>
                    {isEditing ? (
                      <input
                        type="number"
                        value={editedData.height || ''}
                        onChange={(e) => setEditedData({ ...editedData, height: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-fitness-orange focus:border-transparent dark:bg-gray-700 dark:border-gray-600"
                      />
                    ) : (
                      <p className="text-gray-900 dark:text-gray-100 font-medium">{userData.height || '-'} cm</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {t('weight')}
                    </label>
                    {isEditing ? (
                      <input
                        type="number"
                        value={editedData.weight || ''}
                        onChange={(e) => setEditedData({ ...editedData, weight: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-fitness-orange focus:border-transparent dark:bg-gray-700 dark:border-gray-600"
                      />
                    ) : (
                      <p className="text-gray-900 dark:text-gray-100 font-medium">{userData.weight || '-'} kg</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {t('activityLevel')}
                    </label>
                    {isEditing ? (
                      <select
                        value={editedData.activityLevel || ''}
                        onChange={(e) => setEditedData({ ...editedData, activityLevel: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-fitness-orange focus:border-transparent dark:bg-gray-700 dark:border-gray-600"
                      >
                        <option value="sedentary">{t('sedentary')}</option>
                        <option value="light">{t('light')}</option>
                        <option value="moderate">{t('moderate')}</option>
                        <option value="active">{t('active')}</option>
                      </select>
                    ) : (
                      <p className="text-gray-900 dark:text-gray-100 font-medium">
                        {ACTIVITY_KEYS[userData.activityLevel] ? t(ACTIVITY_KEYS[userData.activityLevel]) : '-'}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </Card>

            {/* Goals Card */}
            <Card>
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <Target className="w-6 h-6 text-fitness-purple" />
                {t('goals')}
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('fitnessGoal')}
                  </label>
                  {isEditing ? (
                    <select
                      value={editedData.fitnessGoal || ''}
                      onChange={(e) => setEditedData({ ...editedData, fitnessGoal: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-fitness-orange focus:border-transparent dark:bg-gray-700 dark:border-gray-600"
                    >
                      <option value="weight_loss">{t('weightLoss')}</option>
                      <option value="muscle_gain">{t('muscleGain')}</option>
                      <option value="endurance">{t('endurance')}</option>
                      <option value="flexibility">{t('flexibility')}</option>
                      <option value="maintenance">{t('maintenance')}</option>
                    </select>
                  ) : (
                    <p className="text-gray-900 dark:text-gray-100 font-medium">
                      {GOAL_KEYS[userData.fitnessGoal] ? t(GOAL_KEYS[userData.fitnessGoal]) : '-'}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('trainingFrequency')}
                  </label>
                  <p className="text-gray-900 dark:text-gray-100 font-medium">
                    {userData.trainingFrequency || '-'} {t('daysPerWeek')}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('equipment')}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {userData.equipmentAccess?.map((item: string, index: number) => (
                      <span
                        key={index}
                        className="px-3 py-1 bg-gradient-to-r from-fitness-orange to-fitness-purple text-white rounded-full text-sm"
                      >
                        {optionLabel(EQUIPMENT_OPTIONS, item)}
                      </span>
                    ))}
                  </div>
                </div>
                {(isEditing || userData.trainingNotes) && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {t('trainingNotes')}
                    </label>
                    {isEditing ? (
                      noteField('trainingNotes', tOnboarding('goals.trainingNotesPlaceholder'))
                    ) : (
                      <p className="text-gray-900 dark:text-gray-100">{userData.trainingNotes}</p>
                    )}
                  </div>
                )}
              </div>
            </Card>

            {/* Diet Preferences Card */}
            <Card>
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <UtensilsCrossed className="w-6 h-6 text-fitness-orange" />
                {t('dietPreferences')}
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('preferences')}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {isEditing
                      ? DIET_OPTIONS.map(({ value }) => {
                          const selected = (editedData.dietPreferences || []).includes(value)
                          return (
                            <button
                              key={value}
                              type="button"
                              onClick={() => toggleDiet(value)}
                              aria-pressed={selected}
                              className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                                selected ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-300 text-gray-700 hover:border-blue-400'
                              }`}
                            >
                              {optionLabel(DIET_OPTIONS, value)}
                            </button>
                          )
                        })
                      : userData.dietPreferences?.map((item: string, index: number) => (
                          <span
                            key={index}
                            className="px-3 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded-full text-sm"
                          >
                            {optionLabel(DIET_OPTIONS, item)}
                          </span>
                        ))}
                  </div>
                  {isEditing && (
                    <div className="mt-3">
                      <TagInput
                        values={customDiets(editedData.dietPreferences)}
                        onAdd={(value) => setDiets(addDiet(editedData.dietPreferences, value))}
                        onRemove={(value) => setDiets((editedData.dietPreferences || []).filter((item: string) => item !== value))}
                        placeholder={tOnboarding('preferences.customDietPlaceholder')}
                        addLabel={tOnboarding('preferences.addDiet')}
                      />
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('mealsPerDay')}
                  </label>
                  {isEditing ? (
                    <div className="flex gap-2">
                      {[3, 4, 5].map((count) => (
                        <button
                          key={count}
                          type="button"
                          onClick={() => setEditedData({ ...editedData, mealsPerDay: count })}
                          aria-pressed={(Number(editedData.mealsPerDay) || 4) === count}
                          className={`w-10 h-10 rounded-full text-sm border transition-colors ${
                            (Number(editedData.mealsPerDay) || 4) === count ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-300 text-gray-700 hover:border-blue-400'
                          }`}
                        >
                          {count}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-900 dark:text-gray-100 font-medium">{Number(userData.mealsPerDay) || 4}</p>
                  )}
                </div>
                {(isEditing || userData.foodNotes) && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {t('foodNotes')}
                    </label>
                    {isEditing ? (
                      noteField('foodNotes', tOnboarding('preferences.foodNotesPlaceholder'))
                    ) : (
                      <p className="text-gray-900 dark:text-gray-100">{userData.foodNotes}</p>
                    )}
                  </div>
                )}
                {(isEditing || userData.allergies) && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {t('allergies')}
                    </label>
                    {isEditing ? (
                      noteField('allergies', tOnboarding('preferences.allergiesPlaceholder'))
                    ) : (
                      <p className="text-gray-900 dark:text-gray-100">{userData.allergies}</p>
                    )}
                  </div>
                )}
                {isEditing && <p className="text-sm text-gray-500">{t('planHint')}</p>}
              </div>
            </Card>
          </div>

          {/* Right Column - Stats */}
          <div className="space-y-6">
            {/* Stats Card */}
            <Card className="bg-gradient-to-br from-fitness-orange to-fitness-purple text-white">
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <Activity className="w-6 h-6" />
                {t('stats')}
              </h2>
              <div className="space-y-4">
                {bmi && (
                  <div>
                    <p className="text-sm opacity-90 mb-1">{t('bmi')}</p>
                    <p className="text-3xl font-bold">{bmi}</p>
                    <p className="text-sm opacity-75">{getBMICategory(Number(bmi))}</p>
                  </div>
                )}
                {userData.plan?.mealPlan?.calories && (
                  <div>
                    <p className="text-sm opacity-90 mb-1">{t('dailyCalories')}</p>
                    <p className="text-3xl font-bold">{userData.plan.mealPlan.calories}</p>
                  </div>
                )}
              </div>
            </Card>

            {/* Quick Actions */}
            <Card>
              <h2 className="text-xl font-bold mb-4">{t('quickActions')}</h2>
              <div className="space-y-2">
                <Button
                  onClick={() => router.push(`/${locale}/dashboard`)}
                  className="w-full justify-start"
                  variant="outline"
                >
                  <Dumbbell className="w-4 h-4 mr-2" />
                  {t('viewDashboard')}
                </Button>
                <Button
                  onClick={() => router.push(`/${locale}/progress`)}
                  className="w-full justify-start"
                  variant="outline"
                >
                  <Activity className="w-4 h-4 mr-2" />
                  {t('viewProgress')}
                </Button>
                <Button
                  onClick={() => router.push(`/${locale}/onboarding`)}
                  className="w-full justify-start"
                  variant="outline"
                >
                  <Edit2 className="w-4 h-4 mr-2" />
                  {t('updateProfile')}
                </Button>
              </div>
            </Card>

            <Card>
              <h2 className="text-xl font-bold mb-4">{t('transfer.title')}</h2>
              <DataTransfer />
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}

