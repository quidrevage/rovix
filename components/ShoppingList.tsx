'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Check, Loader, RefreshCw, ShoppingCart, X } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { useUser } from '@/context/UserContext'
import { getShoppingList, type ShoppingCategory } from '@/lib/gemini'
import { getMealDays } from '@/lib/plan'

interface SavedList {
  lang: string
  categories: ShoppingCategory[]
  checked: string[]
}

/** A week's shopping list written by the AI from the meal plan, with tick-off boxes that are remembered. */
export default function ShoppingList({ onClose }: { onClose: () => void }) {
  const t = useTranslations('mealPlan.shopping')
  const locale = useLocale()
  const { userData, setUserData } = useUser()
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle')

  const saved: SavedList | undefined = userData?.shopping
  const list = saved?.lang === locale ? saved : undefined

  const build = useCallback(async () => {
    setState('loading')
    // The first option of every meal: what the user is most likely to cook.
    const meals = getMealDays(userData?.plan?.mealPlan, true).flatMap((day) => day.meals.map((meal) => meal.options[0] || meal.description))
    const categories = await getShoppingList(meals.filter(Boolean), locale)
    if (!categories) {
      setState('error')
      return
    }
    setUserData((current: any) => ({ ...current, shopping: { lang: locale, categories, checked: [] } }))
    setState('idle')
  }, [userData?.plan?.mealPlan, locale, setUserData])

  useEffect(() => {
    if (!list && state === 'idle') build()
    // Only on open: later rebuilds are the user's choice.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const toggle = (item: string) =>
    setUserData((current: any) => {
      const checked: string[] = current?.shopping?.checked || []
      return {
        ...current,
        shopping: { ...current.shopping, checked: checked.includes(item) ? checked.filter((entry) => entry !== item) : [...checked, item] },
      }
    })

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={t('title')}
        className="h-[100dvh] w-full max-w-xl overflow-y-auto bg-white shadow-2xl sm:h-auto sm:max-h-[90vh] sm:rounded-2xl"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-gray-200 bg-white px-4 py-3 sm:px-6">
          <h2 className="flex items-center gap-2 text-xl font-bold">
            <ShoppingCart className="h-5 w-5 text-fitness-orange" />
            {t('title')}
          </h2>
          <div className="flex items-center gap-1">
            {list && state !== 'loading' && (
              <button type="button" onClick={build} title={t('refresh')} aria-label={t('refresh')} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100">
                <RefreshCw className="h-5 w-5" />
              </button>
            )}
            <button type="button" onClick={onClose} aria-label={t('close')} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100">
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        <div className="space-y-5 p-4 sm:p-6">
          {state === 'loading' && (
            <p className="flex items-center gap-2 text-gray-600">
              <Loader className="h-4 w-4 animate-spin text-fitness-orange" />
              {t('loading')}
            </p>
          )}
          {state === 'error' && (
            <div>
              <p className="mb-3 text-red-600">{t('error')}</p>
              <button type="button" onClick={build} className="rounded-lg border border-gray-300 px-4 py-2 font-semibold text-gray-700 hover:bg-gray-50">
                {t('retry')}
              </button>
            </div>
          )}
          {state !== 'loading' && list && (
            <>
              <p className="text-sm text-gray-500">{t('hint')}</p>
              {list.categories.map((category) => (
                <div key={category.name}>
                  <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">{category.name}</h3>
                  <ul className="space-y-1">
                    {category.items.map((item) => {
                      const done = list.checked.includes(item)
                      return (
                        <li key={item}>
                          <button
                            type="button"
                            onClick={() => toggle(item)}
                            aria-pressed={done}
                            className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-gray-50"
                          >
                            <span
                              className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border ${
                                done ? 'border-fitness-green bg-fitness-green text-white' : 'border-gray-400'
                              }`}
                            >
                              {done && <Check className="h-4 w-4" />}
                            </span>
                            <span className={done ? 'text-gray-400 line-through' : 'text-gray-900'}>{item}</span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </motion.div>
  )
}
