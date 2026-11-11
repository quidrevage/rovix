'use client'

import React, { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { useUser } from '@/context/UserContext'
import { useTranslations, useLocale } from 'next-intl'
import { useRouter } from 'next/navigation'
import {
  Calendar,
  UtensilsCrossed,
  Coffee,
  Sunset,
  ChefHat,
  Apple,
  Download,
  RefreshCw,
  ShoppingCart,
  ArrowLeft,
  Clock,
  X,
  Info,
} from 'lucide-react'
import Navbar from './ui/Navbar'
import Card from './ui/Card'
import Button from './ui/Button'
import PlanTranslator from './PlanTranslator'
import ShoppingList from './ShoppingList'
import { exportMealPlanPDF } from '@/lib/pdfExport'
import { chatWithAI, generateFitnessPlan } from '@/lib/gemini'
import { applyPlanChanges, getMealDays, mealKind } from '@/lib/plan'
import { startNewWeek } from '@/lib/week'

export default function MealPlanPage() {
  const { userData, setUserData, loading: userLoading } = useUser()
  const t = useTranslations('mealPlan')
  const locale = useLocale()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const [selectedMeal, setSelectedMeal] = useState<any | null>(null)
  const [swapState, setSwapState] = useState<'idle' | 'loading' | 'error'>('idle')
  const [showShopping, setShowShopping] = useState(false)

  // Asks the coach for a different dish in place of the open meal and applies it to that day only.
  const swapMeal = async () => {
    if (!selectedMeal || !selectedDay || !userData?.plan) return
    setSwapState('loading')
    const result = await chatWithAI({
      message: `In the meal plan, replace the meal "${selectedMeal.meal}" on day ${selectedDay} with a different dish of similar calories and macros. Change only that meal and keep the other meals of that day exactly as they are.`,
      userData,
      locale,
    })
    const mealDays = (result.changes?.mealDays || []).filter((day) => day.day === selectedDay)
    if (mealDays.length === 0) {
      setSwapState('error')
      return
    }
    setUserData((current: any) => ({ ...current, plan: applyPlanChanges(current.plan, { mealDays }).plan }))
    setSwapState('idle')
    setSelectedMeal(null)
  }

  // Plans saved in the old one-day format are repeated across the week.
  const mealPlans = useMemo(() => getMealDays(userData?.plan?.mealPlan, true), [userData?.plan?.mealPlan])

  const mealIcons: Record<string, React.ReactNode> = {
    breakfast: <Coffee className="w-5 h-5" />,
    lunch: <Sunset className="w-5 h-5" />,
    dinner: <ChefHat className="w-5 h-5" />,
    snack: <Apple className="w-5 h-5" />,
  }

  const getMealIcon = (mealName: string) => mealIcons[mealKind(mealName)]

  const handleExportPDF = async () => {
    try {
      await exportMealPlanPDF(userData, mealPlans, locale)
    } catch (error) {
      console.error('Error exporting PDF:', error)
    }
  }

  const handleRegenerate = async () => {
    if (!userData) return
    
    setLoading(true)
    try {
      const newPlan = await generateFitnessPlan(userData, locale)
      setUserData((current: any) => startNewWeek(current, newPlan))
    } catch (error) {
      console.error('Error regenerating plan:', error)
      alert(t('regenerateError'))
    } finally {
      setLoading(false)
    }
  }

  const getDayName = (dayNumber: number) => {
    const days = locale === 'ru' 
      ? ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье']
      : locale === 'uk'
      ? ['Понеділок', 'Вівторок', 'Середа', 'Четвер', 'П\'ятниця', 'Субота', 'Неділя']
      : ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    return days[dayNumber - 1] || `Day ${dayNumber}`
  }

  if (userLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-fitness-orange border-t-transparent" />
      </div>
    )
  }

  if (!userData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-orange-50 to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <Card className="text-center py-12">
            <UtensilsCrossed className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-4">{t('noPlan')}</h2>
            <p className="text-gray-600 mb-6">{t('completeOnboarding')}</p>
            <Button onClick={() => router.push(`/${locale}/onboarding`)}>
              {t('goToOnboarding')}
            </Button>
          </Card>
        </div>
      </div>
    )
  }

  if (mealPlans.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-orange-50 to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <Card className="text-center py-12">
            <UtensilsCrossed className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-4">{t('noPlan')}</h2>
            <p className="text-gray-600 mb-6">
              {t('completeOnboarding')}
            </p>
            <div className="flex gap-3 justify-center">
              <Button onClick={handleRegenerate} disabled={loading}>
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                {t('regenerate')}
              </Button>
              <Button variant="outline" onClick={() => router.push(`/${locale}/onboarding`)}>
                {t('goToOnboarding')}
              </Button>
            </div>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-orange-50 to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <Navbar />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-fitness-orange to-fitness-purple bg-clip-text text-transparent mb-2">
                {t('title')}
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                {t('subtitle')}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => setShowShopping(true)} variant="outline" className="flex items-center gap-2">
                <ShoppingCart className="w-4 h-4" />
                {t('shopping.button')}
              </Button>
              <Button
                onClick={handleRegenerate}
                disabled={loading}
                variant="outline"
                className="flex items-center gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                {t('regenerate')}
              </Button>
              <Button
                onClick={handleExportPDF}
                className="flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                {t('exportPDF')}
              </Button>
            </div>
          </div>

          <PlanTranslator />

          {/* Summary Card */}
          <Card className="bg-gradient-to-r from-fitness-orange to-fitness-purple text-white mb-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm opacity-90 mb-1">{t('dailyCalories')}</p>
                <p className="text-2xl font-bold">{userData.plan?.mealPlan?.calories || 0}</p>
              </div>
              <div>
                <p className="text-sm opacity-90 mb-1">{t('protein')}</p>
                <p className="text-2xl font-bold">{userData.plan?.mealPlan?.macros?.protein || '0g'}</p>
              </div>
              <div>
                <p className="text-sm opacity-90 mb-1">{t('carbs')}</p>
                <p className="text-2xl font-bold">{userData.plan?.mealPlan?.macros?.carbs || '0g'}</p>
              </div>
              <div>
                <p className="text-sm opacity-90 mb-1">{t('fats')}</p>
                <p className="text-2xl font-bold">{userData.plan?.mealPlan?.macros?.fats || '0g'}</p>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Weekly Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7 gap-4 mb-8">
          {mealPlans.map((plan: any, index: number) => {
            const dayNumber = plan.day || index + 1
            const isSelected = selectedDay === dayNumber
            
            return (
              <motion.div
                key={dayNumber}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card
                  className={`cursor-pointer transition-all ${
                    isSelected ? 'ring-2 ring-fitness-orange shadow-lg' : 'hover:shadow-md'
                  }`}
                  onClick={() => setSelectedDay(isSelected ? null : dayNumber)}
                >
                  <div className="text-center mb-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-r from-fitness-orange to-fitness-purple flex items-center justify-center mx-auto mb-2">
                      <Calendar className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="font-bold text-lg">{getDayName(dayNumber)}</h3>
                    <p className="text-sm text-gray-500">
                      {t('day')} {dayNumber}
                      {plan.totalCalories > 0 && <> · {plan.totalCalories} {t('cal')}</>}
                    </p>
                  </div>

                  <div className="space-y-2 min-h-[80px]">
                    {plan.meals && plan.meals.length > 0 ? (
                      <>
                        {plan.meals.slice(0, 3).map((meal: any, mealIndex: number) => {
                          const mealName = meal.meal || meal.name || 'Meal'
                          const mealOptions = Array.isArray(meal.options) 
                            ? meal.options 
                            : (meal.options ? [meal.options] : (meal.description ? [meal.description] : []))
                          const displayText = mealOptions.length > 0 
                            ? `${mealName}: ${mealOptions[0]}` 
                            : mealName
                          
                          return (
                            <div key={mealIndex} className="flex items-start gap-2 text-xs">
                              <div className="mt-0.5 flex-shrink-0">
                                {getMealIcon(mealName)}
                              </div>
                              <span className="truncate leading-tight">{displayText}</span>
                            </div>
                          )
                        })}
                        {plan.meals.length > 3 && (
                          <p className="text-xs text-gray-500 text-center pt-1">
                            {t('more', { count: plan.meals.length - 3 })}
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="text-xs text-gray-400 text-center py-2">{t('noMeals')}</p>
                    )}
                  </div>
                </Card>
              </motion.div>
            )
          })}
        </div>

        {/* Detailed View for Selected Day */}
        {selectedDay && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <Card>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <Calendar className="w-6 h-6 text-fitness-orange" />
                  {getDayName(selectedDay)} - {t('day')} {selectedDay}
                </h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedDay(null)}
                >
                  <ArrowLeft className="w-4 h-4" />
                </Button>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                {(() => {
                  const dayPlan = mealPlans.find((p: any) => p.day === selectedDay) || mealPlans[selectedDay - 1]
                  const meals = dayPlan?.meals || []
                  if (meals.length === 0) {
                    return (
                      <div className="col-span-2 text-center py-8 text-gray-500">
                        <p>{t('noMealsForDay')}</p>
                      </div>
                    )
                  }
                  
                  return meals.map((meal: any, index: number) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <Card className="h-full cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setSelectedMeal(meal)}>
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-r from-fitness-orange to-fitness-purple flex items-center justify-center">
                          {getMealIcon(meal.meal || meal.name || 'meal')}
                        </div>
                        <div className="flex-1">
                          <h3 className="text-xl font-bold">{meal.meal || meal.name || `Meal ${index + 1}`}</h3>
                          <button className="text-xs text-fitness-orange hover:underline mt-1 flex items-center gap-1">
                            <Info className="w-3 h-3" />
                            {t('viewDetails')}
                          </button>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{t('options')}</p>
                          <div className="flex flex-wrap gap-2">
                            {meal.options && meal.options.length > 0 ? (
                              meal.options.map((option: string, optIndex: number) => (
                                <span
                                  key={optIndex}
                                  className="px-3 py-1 bg-orange-100 dark:bg-orange-900/20 text-orange-800 dark:text-orange-200 rounded-full text-sm"
                                >
                                  {option}
                                </span>
                              ))
                            ) : meal.description ? (
                              <span className="px-3 py-1 bg-orange-100 dark:bg-orange-900/20 text-orange-800 dark:text-orange-200 rounded-full text-sm">
                                {meal.description}
                              </span>
                            ) : (
                              <span className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full text-sm">
                                {t('noOptionsAvailable')}
                              </span>
                            )}
                          </div>
                        </div>

                        {Boolean(meal.calories || meal.protein || meal.carbs || meal.fats) && (
                          <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                            <p className="text-sm font-semibold mb-2">{t('nutrition')}</p>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              {meal.calories > 0 && (
                                <div className="flex items-center gap-2">
                                  <Clock className="w-4 h-4 text-gray-400" />
                                  <span>{meal.calories} {t('cal')}</span>
                                </div>
                              )}
                              {meal.protein && (
                                <div>
                                  <span className="text-blue-600 font-medium">P:</span> {meal.protein}
                                </div>
                              )}
                              {meal.carbs && (
                                <div>
                                  <span className="text-green-600 font-medium">C:</span> {meal.carbs}
                                </div>
                              )}
                              {meal.fats && (
                                <div>
                                  <span className="text-orange-600 font-medium">F:</span> {meal.fats}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </Card>
                  </motion.div>
                  ))
                })()}
              </div>
            </Card>
          </motion.div>
        )}

        {showShopping && <ShoppingList onClose={() => setShowShopping(false)} />}

        {/* Meal Details Modal */}
        {selectedMeal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={() => setSelectedMeal(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-r from-fitness-orange to-fitness-purple flex items-center justify-center">
                      {getMealIcon(selectedMeal.meal || selectedMeal.name || 'meal')}
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold">{selectedMeal.meal || selectedMeal.name || 'Meal'}</h2>
                      <p className="text-sm text-gray-500">{t('mealDetails')}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedMeal(null)}
                    className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <div className="space-y-6">
                  {/* Options */}
                  {(selectedMeal.options && selectedMeal.options.length > 0) || selectedMeal.description ? (
                    <div>
                      <h3 className="text-lg font-semibold mb-3">{t('options')}</h3>
                      <div className="flex flex-wrap gap-2">
                        {selectedMeal.options && selectedMeal.options.length > 0 ? (
                          selectedMeal.options.map((option: string, optIndex: number) => (
                            <span
                              key={optIndex}
                              className="px-4 py-2 bg-orange-100 dark:bg-orange-900/20 text-orange-800 dark:text-orange-200 rounded-full text-sm font-medium"
                            >
                              {option}
                            </span>
                          ))
                        ) : (
                          <span className="px-4 py-2 bg-orange-100 dark:bg-orange-900/20 text-orange-800 dark:text-orange-200 rounded-full text-sm font-medium">
                            {selectedMeal.description}
                          </span>
                        )}
                      </div>
                    </div>
                  ) : null}

                  {/* Nutrition Info */}
                  {Boolean(selectedMeal.calories || selectedMeal.protein || selectedMeal.carbs || selectedMeal.fats) && (
                    <div className="p-4 bg-gradient-to-r from-fitness-orange/10 to-fitness-purple/10 rounded-xl">
                      <h3 className="text-lg font-semibold mb-3">{t('nutrition')}</h3>
                      <div className="grid grid-cols-2 gap-4">
                        {selectedMeal.calories > 0 && (
                          <div className="flex items-center gap-2">
                            <Clock className="w-5 h-5 text-fitness-orange" />
                            <div>
                              <p className="text-sm text-gray-600 dark:text-gray-400">{t('calories')}</p>
                              <p className="text-xl font-bold">{selectedMeal.calories} {t('cal')}</p>
                            </div>
                          </div>
                        )}
                        {selectedMeal.protein && (
                          <div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">{t('protein')}</p>
                            <p className="text-xl font-bold text-blue-600">{selectedMeal.protein}</p>
                          </div>
                        )}
                        {selectedMeal.carbs && (
                          <div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">{t('carbs')}</p>
                            <p className="text-xl font-bold text-green-600">{selectedMeal.carbs}</p>
                          </div>
                        )}
                        {selectedMeal.fats && (
                          <div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">{t('fats')}</p>
                            <p className="text-xl font-bold text-orange-600">{selectedMeal.fats}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {selectedDay && (
                    <div>
                      <Button variant="outline" onClick={swapMeal} isLoading={swapState === 'loading'} className="w-full">
                        <RefreshCw className="w-4 h-4 mr-2" />
                        {t('swap')}
                      </Button>
                      {swapState === 'error' && <p className="mt-2 text-sm text-red-600">{t('swapError')}</p>}
                    </div>
                  )}

                  {/* Ingredients */}
                  {selectedMeal.ingredients && selectedMeal.ingredients.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold mb-3">{t('ingredients')}</h3>
                      <ul className="list-disc list-inside space-y-1 text-gray-700 dark:text-gray-300">
                        {selectedMeal.ingredients.map((ingredient: string, ingIndex: number) => (
                          <li key={ingIndex}>{ingredient}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Instructions */}
                  {selectedMeal.instructions && selectedMeal.instructions.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold mb-3">{t('instructions')}</h3>
                      <ol className="list-decimal list-inside space-y-2 text-gray-700 dark:text-gray-300">
                        {selectedMeal.instructions.map((instruction: string, instIndex: number) => (
                          <li key={instIndex}>{instruction}</li>
                        ))}
                      </ol>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </div>
    </div>
  )
}

