'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { AlertTriangle, ArrowLeftRight, Check, ChevronLeft, ChevronRight, ExternalLink, Loader, RotateCcw, Sparkles, Timer, Wind, X } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { langIndex, matchDemo } from '@/lib/exercises'
import { checkAIConfigured, explainExercise, getCachedGuide, type ExerciseGuide } from '@/lib/gemini'
import { addLiftSet, bestSet, clearLiftToday, formatSet, liftKey as keyOfLift, liftSessions } from '@/lib/lifts'
import { setsOf, type ExerciseView } from '@/lib/plan'
import { toDateKey } from '@/lib/utils'
import { useUser } from '@/context/UserContext'
import ExerciseFigure from './ExerciseFigure'

interface ExerciseModalProps {
  exercise: ExerciseView
  onClose: () => void
  /** Called when the last set is ticked off in the tracker. */
  onAllSetsDone?: () => void
  /** Replaces this exercise with another one; resolves to false when it could not be done. */
  onSwap?: () => Promise<boolean>
}

/** "How to do it" for one exercise: animated demo, technique notes, an AI guide, and a set/rest tracker. */
export default function ExerciseModal({ exercise, onClose, onAllSetsDone, onSwap }: ExerciseModalProps) {
  const t = useTranslations('exercise')
  const tWorkout = useTranslations('dashboard.workoutPlan')
  const locale = useLocale()
  const lang = langIndex(locale)
  const match = matchDemo(exercise.name, exercise.demo)
  const demo = match?.demo
  const exact = Boolean(match?.exact)

  const [guide, setGuide] = useState<ExerciseGuide | null>(() => getCachedGuide(exercise.name, locale))
  const [guideState, setGuideState] = useState<'idle' | 'loading' | 'error'>('idle')
  const [aiAvailable, setAiAvailable] = useState<boolean | null>(null) // null while the server is being asked
  const [step, setStep] = useState(0)
  const [swapState, setSwapState] = useState<'idle' | 'loading' | 'error'>('idle')

  // The load the user actually works with, remembered per exercise name.
  const { userData, setUserData } = useUser()
  const liftKey = keyOfLift(exercise.name)
  const myWeight: string = userData?.lifts?.[liftKey] || ''
  const saveMyWeight = (value: string) =>
    setUserData((current: any) => ({ ...current, lifts: { ...current?.lifts, [liftKey]: value.slice(0, 30) } }))

  const swap = async () => {
    if (!onSwap) return
    setSwapState('loading')
    if (!(await onSwap())) setSwapState('error') // on success the dialog is closed by the parent
  }

  // The journal: what was really lifted in each set, today and before.
  const sessions = liftSessions(userData, exercise.name)
  const today = toDateKey()
  const todaySets = sessions[sessions.length - 1]?.date === today ? sessions[sessions.length - 1].sets : []
  const earlier = sessions.filter((session) => session.date !== today)
  const previous = earlier[earlier.length - 1]
  const record = bestSet(earlier.flatMap((session) => session.sets))
  const todayBest = bestSet(todaySets)
  const newRecord = Boolean(record && todayBest && bestSet([record, todayBest]) === todayBest)

  const totalSets = setsOf(exercise.sets)
  const [doneSets, setDoneSets] = useState(() => Math.min(todaySets.length, totalSets))
  const [restLeft, setRestLeft] = useState(0)
  // Start from the latest logged set, so usually there is nothing to type.
  const lastSet = todaySets[todaySets.length - 1] || previous?.sets[0]
  const [kg, setKg] = useState(() => String(lastSet?.kg || parseFloat(myWeight.replace(',', '.')) || ''))
  const [reps, setReps] = useState(() => String(lastSet?.reps || parseInt(exercise.reps, 10) || ''))

  const askAI = useCallback(async () => {
    setGuideState('loading')
    const result = await explainExercise(exercise.name, locale)
    setGuide(result)
    setGuideState(result ? 'idle' : 'error')
  }, [exercise.name, locale])

  useEffect(() => {
    let open = true
    checkAIConfigured().then((available) => {
      if (!open) return
      setAiAvailable(available)
      // The built-in notes describe the demo's basic movement, which is often not quite this exercise
      // (a hanging leg raise is not a lying one), so the technique is written for the exercise itself.
      if (available && !getCachedGuide(exercise.name, locale)) askAI()
    })
    return () => {
      open = false
    }
  }, [askAI, exercise.name, locale])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    // In the gym the phone lies next to you: keep its screen on while the exercise is open.
    let wakeLock: { release: () => Promise<void> } | undefined
    ;(navigator as any).wakeLock?.request('screen').then((lock: any) => (wakeLock = lock), () => {})
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      wakeLock?.release().catch(() => {})
    }
  }, [onClose])

  // Lets the user know the rest is over without watching the screen: a short beep and a vibration.
  const lastRest = useRef(0)
  useEffect(() => {
    if (lastRest.current === 1 && restLeft === 0) {
      navigator.vibrate?.(300)
      try {
        const audio = new AudioContext()
        const tone = audio.createOscillator()
        const volume = audio.createGain()
        tone.frequency.value = 880
        volume.gain.value = 0.15
        tone.connect(volume).connect(audio.destination)
        tone.start()
        tone.stop(audio.currentTime + 0.35)
        tone.onended = () => audio.close()
      } catch {
        // No sound available: the timer on screen still shows it.
      }
    }
    lastRest.current = restLeft
    if (restLeft <= 0) return
    const timer = setTimeout(() => setRestLeft((seconds) => seconds - 1), 1000)
    return () => clearTimeout(timer)
  }, [restLeft])

  const completeSet = () => {
    const next = Math.min(doneSets + 1, totalSets)
    const load = Math.min(Math.max(parseFloat(kg.replace(',', '.')) || 0, 0), 999)
    const count = Math.min(Math.max(parseInt(reps, 10) || 0, 0), 999)
    if (count > 0)
      setUserData((current: any) => {
        const logged = addLiftSet(current, exercise.name, { kg: load, reps: count })
        // The next plan bases its recommended weights on `lifts`.
        return load > 0 ? { ...logged, lifts: { ...logged.lifts, [liftKey]: `${load} ${t('kg')}` } } : logged
      })
    setDoneSets(next)
    setRestLeft(next < totalSets ? exercise.restSeconds : 0)
    if (next === totalSets) onAllSetsDone?.()
  }

  const resetSets = () => {
    setUserData((current: any) => clearLiftToday(current, exercise.name))
    setDoneSets(0)
    setRestLeft(0)
  }

  const videoUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(`${exercise.name} ${t('videoQuery')}`)}`
  // Built-in notes fill in while the guide loads (when the demo is this very movement) and when AI is unavailable.
  const builtIn = demo && (exact || aiAvailable === false || guideState === 'error') ? demo : null
  const steps = guide?.steps || builtIn?.steps.map((item) => item[lang]) || []
  const muscles = guide?.muscles.join(', ') || builtIn?.muscles[lang] || ''
  const mistakes = guide?.mistakes.length ? guide.mistakes : builtIn ? [builtIn.mistake[lang]] : []
  const waiting = guideState === 'loading' || (aiAvailable === null && !exact && !guide)
  const resting = restLeft > 0
  const finished = doneSets >= totalSets
  const current = Math.min(step, Math.max(steps.length - 1, 0))

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={exercise.name}
        className="h-[100dvh] w-full max-w-4xl overflow-y-auto bg-white shadow-2xl sm:h-auto sm:max-h-[92vh] sm:rounded-2xl"
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-gray-200 bg-white px-4 py-3 sm:px-6 sm:py-4">
          <div className="min-w-0">
            <h2 className="text-xl font-bold break-words sm:text-2xl">{exercise.name}</h2>
            <p className="text-sm text-gray-600">
              {tWorkout('setsReps', { sets: exercise.sets, reps: exercise.reps })} · {tWorkout('rest', { seconds: exercise.restSeconds })}
              {exercise.weight && <> · {tWorkout('weight', { weight: exercise.weight })}</>}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('close')}
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* On a phone the blocks stack: demo, technique, then video and tracker. */}
        <div className="grid gap-5 p-4 sm:p-6 md:grid-cols-2 md:gap-6">
          {/* Demo */}
          <div>
            {demo ? (
              <>
                <ExerciseFigure key={demo.key} demo={demo} />
                <p className="mt-2 text-center text-xs text-gray-500">
                  {guide ? t('similar', { name: demo.name[lang] }) : t('pattern', { name: demo.name[lang] })}
                </p>
              </>
            ) : steps.length > 0 ? (
              // No animation for this movement: walk through the guide one step at a time instead.
              <div className="rounded-xl border border-gray-200 bg-gradient-to-b from-orange-50 to-white p-5">
                <p className="text-sm font-semibold text-fitness-orange">{t('stepOf', { current: current + 1, total: steps.length })}</p>
                <div className="my-3 flex gap-1.5" aria-hidden="true">
                  {steps.map((_, i) => (
                    <span key={i} className={`h-1.5 flex-1 rounded-full ${i <= current ? 'bg-fitness-orange' : 'bg-gray-200'}`} />
                  ))}
                </div>
                <p className="min-h-[7rem] text-lg font-medium leading-snug text-gray-900" aria-live="polite">
                  {steps[current]}
                </p>
                <div className="mt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setStep(current - 1)}
                    disabled={current === 0}
                    className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-gray-300 py-3 font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                  >
                    <ChevronLeft className="h-5 w-5" />
                    {t('prev')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep(current + 1)}
                    disabled={current === steps.length - 1}
                    className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-gradient-to-r from-fitness-orange to-fitness-purple py-3 font-semibold text-white hover:opacity-90 disabled:opacity-40"
                  >
                    {t('next')}
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex min-h-[8rem] items-center justify-center gap-2 rounded-xl border border-dashed border-gray-300 bg-gray-50 p-6 text-center text-sm text-gray-600">
                {waiting && <Loader className="h-4 w-4 flex-shrink-0 animate-spin text-fitness-purple" />}
                {waiting ? t('aiLoading') : t('noDemo')}
              </div>
            )}
          </div>

          {/* Technique */}
          <div className="space-y-5 md:row-span-2">
            {muscles && (
              <div>
                <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-gray-500">{t('muscles')}</h3>
                <p className="text-gray-900">{muscles}</p>
              </div>
            )}

            {demo && steps.length > 0 && (
              <div>
                <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
                  {t('technique')}
                  {guide && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium normal-case tracking-normal text-fitness-purple">
                      <Sparkles className="h-3 w-3" />
                      {t('aiBadge')}
                    </span>
                  )}
                </h3>
                <ol className="space-y-2">
                  {steps.map((item, i) => (
                    <li key={i} className="flex gap-3">
                      <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-orange-100 text-sm font-bold text-fitness-orange">
                        {i + 1}
                      </span>
                      <span className="text-gray-800">{item}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {demo && steps.length === 0 && waiting && (
              <p className="flex items-center gap-2 text-sm text-gray-600">
                <Loader className="h-4 w-4 animate-spin text-fitness-purple" />
                {t('aiLoading')}
              </p>
            )}

            {guide?.breathing && (
              <p className="flex gap-2 rounded-lg bg-blue-50 px-4 py-3 text-sm text-gray-800">
                <Wind className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary-600" />
                <span>
                  <span className="font-semibold">{t('breathing')}: </span>
                  {guide.breathing}
                </span>
              </p>
            )}

            {mistakes.length > 0 && (
              <div className="rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-900">
                <p className="mb-1 flex items-center gap-2 font-semibold">
                  <AlertTriangle className="h-4 w-4" />
                  {t('mistakes')}
                </p>
                <ul className="space-y-1">
                  {mistakes.map((mistake, i) => (
                    <li key={i}>{mistake}</li>
                  ))}
                </ul>
              </div>
            )}

            {exercise.notes && (
              <div>
                <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-gray-500">{t('coachNote')}</h3>
                <p className="italic text-gray-700">{exercise.notes}</p>
              </div>
            )}

            {aiAvailable && !guide && guideState !== 'loading' && (
              <div>
                {guideState === 'error' && <p className="mb-2 text-sm text-red-600">{t('aiError')}</p>}
                <button
                  type="button"
                  onClick={askAI}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-purple-50 px-4 py-3 font-semibold text-fitness-purple hover:bg-purple-100"
                >
                  <Sparkles className="h-4 w-4" />
                  {t('askAI')}
                </button>
              </div>
            )}
          </div>

          {/* Video and tracker */}
          <div className="space-y-5">
            <a
              href={videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 rounded-lg border-2 border-primary-500 px-4 py-3 font-semibold text-primary-600 hover:bg-primary-50"
            >
              <ExternalLink className="h-4 w-4" />
              {t('watchVideo')}
            </a>

            <label className="block rounded-xl border border-gray-200 p-4">
              <span className="mb-2 block font-semibold">{t('myWeight')}</span>
              <input
                value={myWeight}
                onChange={(e) => saveMyWeight(e.target.value)}
                maxLength={30}
                placeholder={exercise.weight || t('myWeightPlaceholder')}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-fitness-orange"
              />
              <span className="mt-2 block text-xs text-gray-500">{t('myWeightHint')}</span>
            </label>

            {onSwap && (
              <div>
                <button
                  type="button"
                  onClick={swap}
                  disabled={swapState === 'loading'}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-3 font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                >
                  {swapState === 'loading' ? <Loader className="h-4 w-4 animate-spin" /> : <ArrowLeftRight className="h-4 w-4" />}
                  {t('swap')}
                </button>
                {swapState === 'error' && <p className="mt-2 text-sm text-red-600">{t('swapError')}</p>}
              </div>
            )}

            <div className="rounded-xl border border-gray-200 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="flex items-center gap-2 font-semibold">
                  <Timer className="h-5 w-5 text-fitness-purple" />
                  {t('setsTitle')}
                </h3>
                {doneSets > 0 && (
                  <button type="button" onClick={resetSets} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800">
                    <RotateCcw className="h-4 w-4" />
                    {t('reset')}
                  </button>
                )}
              </div>
              <div className="mb-3 flex flex-wrap gap-2">
                {Array.from({ length: totalSets }, (_, i) => (
                  <span
                    key={i}
                    className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold ${
                      i < doneSets ? 'bg-fitness-green text-white' : i === doneSets ? 'border-2 border-fitness-orange text-fitness-orange' : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {i < doneSets ? <Check className="h-5 w-5" /> : i + 1}
                  </span>
                ))}
              </div>
              <div className="mb-3 space-y-1 text-sm text-gray-600">
                {todaySets.length > 0 && (
                  <p>
                    {t('today', { sets: todaySets.map(formatSet).join(' · ') })}
                    {newRecord && <span className="ml-2 font-semibold text-fitness-orange">{t('newRecord')}</span>}
                  </p>
                )}
                {previous && (
                  <p>
                    {t('lastTime', {
                      date: new Date(`${previous.date}T00:00:00`).toLocaleDateString(locale, { month: 'short', day: 'numeric' }),
                      sets: previous.sets.map(formatSet).join(' · '),
                    })}
                  </p>
                )}
                {record && <p>{t('record', { set: formatSet(record) })}</p>}
              </div>
              {!finished && !resting && (
                <div className="mb-3 grid grid-cols-2 gap-3">
                  <label className="block text-sm font-medium text-gray-700">
                    <span className="mb-1 block">{t('kg')}</span>
                    <input
                      inputMode="decimal"
                      value={kg}
                      onChange={(e) => setKg(e.target.value.slice(0, 6))}
                      placeholder="0"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-lg font-semibold tabular-nums focus:border-transparent focus:ring-2 focus:ring-fitness-orange"
                    />
                  </label>
                  <label className="block text-sm font-medium text-gray-700">
                    <span className="mb-1 block">{t('reps')}</span>
                    <input
                      inputMode="numeric"
                      value={reps}
                      onChange={(e) => setReps(e.target.value.slice(0, 3))}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-lg font-semibold tabular-nums focus:border-transparent focus:ring-2 focus:ring-fitness-orange"
                    />
                  </label>
                </div>
              )}
              {finished ? (
                <p className="font-semibold text-fitness-green">{t('allDone')}</p>
              ) : resting ? (
                <div className="flex items-center justify-between gap-3 rounded-lg bg-purple-50 px-4 py-3">
                  <span className="text-sm font-medium text-gray-700" aria-live="polite">
                    {t('restTimer')} <span className="text-2xl font-bold tabular-nums text-fitness-purple">{restLeft}</span> {t('seconds')}
                  </span>
                  <button type="button" onClick={() => setRestLeft(0)} className="text-sm font-semibold text-fitness-purple hover:underline">
                    {t('skipRest')}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={completeSet}
                  className="w-full rounded-lg bg-gradient-to-r from-fitness-orange to-fitness-purple px-4 py-3 font-semibold text-white hover:opacity-90"
                >
                  {t('setDone', { current: doneSets + 1, total: totalSets })}
                </button>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
