'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Languages, Loader } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { useUser } from '@/context/UserContext'
import { detectLanguage } from '@/lib/aiShared'
import { generateDemoPlan } from '@/lib/demoPlan'
import { translatePlan } from '@/lib/gemini'

// The plan's text is written once, in the language that was active then. When the interface language
// changes, this translates the saved plan to match and shows what is happening.

/** The language a plan is written in: recorded at creation, guessed from its text for older plans. */
function planLanguage(plan: any, locale: string): string {
  if (plan?.lang) return plan.lang
  const sample = (plan?.workoutPlan || [])
    .flatMap((day: any) => [day?.focus, ...(day?.exercises || []).map((ex: any) => ex?.name)])
    .concat((plan?.mealPlan?.weeklyMeals || []).flatMap((day: any) => (day?.meals || []).map((meal: any) => meal?.meal)))
    .filter(Boolean)
    .join(' ')
  return sample ? detectLanguage(sample, locale) : locale
}

export default function PlanTranslator() {
  const locale = useLocale()
  const t = useTranslations('common')
  const { userData, setUserData } = useUser()
  const [state, setState] = useState<'idle' | 'working' | 'error'>('idle')
  const attempted = useRef('')

  const plan = userData?.plan
  const outdated = Boolean(plan) && planLanguage(plan, locale) !== locale

  const translate = useCallback(async () => {
    if (!plan) return
    if (plan.demo) {
      // The template plan exists in every language already.
      setUserData((current: any) => ({ ...current, plan: { ...generateDemoPlan(current, locale), lang: locale } }))
      return
    }
    setState('working')
    const translated = await translatePlan(plan, locale)
    if (!translated) {
      setState('error')
      return
    }
    // The shopping list was written in the old language too; it is rebuilt on demand.
    setUserData((current: any) => ({ ...current, plan: { ...translated, lang: locale }, shopping: undefined }))
    setState('idle')
  }, [plan, locale, setUserData])

  useEffect(() => {
    // One automatic attempt per plan and language; after a failure the user retries with the button.
    const key = `${userData?.createdAt}:${locale}`
    if (!outdated || state !== 'idle' || attempted.current === key) return
    attempted.current = key
    translate()
  }, [outdated, state, locale, userData?.createdAt, translate])

  if (!outdated || state === 'idle') return null

  return (
    <div
      role="status"
      className="mb-6 flex flex-wrap items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900"
    >
      {state === 'working' ? <Loader className="h-4 w-4 animate-spin" /> : <Languages className="h-4 w-4" />}
      <span className="flex-1">{state === 'working' ? t('translatingPlan') : t('translateFailed')}</span>
      {state === 'error' && (
        <button type="button" onClick={translate} className="rounded-lg bg-blue-600 px-3 py-1.5 font-semibold text-white hover:bg-blue-700">
          {t('retry')}
        </button>
      )}
    </div>
  )
}
