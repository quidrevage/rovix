'use client'

import React, { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Send, Bot, User as UserIcon, Loader, Trash2, Undo2, Dumbbell, UtensilsCrossed, CheckCircle2 } from 'lucide-react'
import { chatWithAI } from '@/lib/gemini'
import { applyPlanChanges, hasChanges, type ChangeSummary } from '@/lib/plan'
import { useUser } from '@/context/UserContext'
import { clearExerciseMarks } from '@/lib/week'
import { useLocale, useTranslations } from 'next-intl'
import Button from './ui/Button'
import Card from './ui/Card'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  /** Set when this reply edited the plan. */
  summary?: ChangeSummary
  /** The plan as it was before the edit; kept in memory only. */
  undoPlan?: any
  undone?: boolean
}

interface AICoachProps {
  /** Whether the chat tab is the one on screen (the chat stays mounted so the conversation survives tab switches). */
  active?: boolean
  onViewPlan?: (tab: 'meal' | 'workout') => void
}

const STORAGE_KEY = 'fitai_chat'
const STORED_MESSAGES = 40

function loadMessages(): Message[] {
  if (typeof window === 'undefined') return []
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    return Array.isArray(saved) ? saved.filter((m) => m && typeof m.content === 'string') : []
  } catch {
    return []
  }
}

// The model is asked for plain text but still emphasises with **bold** now and then.
const renderText = (content: string) =>
  content
    .replace(/^\s*[*-]\s+/gm, '• ')
    .split(/(\*\*[^*]+\*\*)/g)
    .map((part, i) => (/^\*\*[^*]+\*\*$/.test(part) ? <strong key={i}>{part.slice(2, -2)}</strong> : part))

export default function AICoach({ active = true, onViewPlan }: AICoachProps) {
  const locale = useLocale()
  const t = useTranslations('aiCoach')
  const { userData, setUserData } = useUser()

  const [messages, setMessages] = useState<Message[]>(loadMessages)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  // The answer arrives seconds later: apply it to the plan as it is then, not as it was when the question was sent.
  const latestUser = useRef(userData)
  latestUser.current = userData

  // Scroll the message list itself; scrollIntoView would also drag the whole page down.
  useEffect(() => {
    if (active && listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
  }, [messages, loading, active])

  useEffect(() => {
    try {
      const stored = messages.slice(-STORED_MESSAGES).map(({ undoPlan, ...message }) => message)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stored))
    } catch {
      // The chat still works without persistence.
    }
  }, [messages])

  const send = async (override?: string) => {
    const content = (override ?? input).trim()
    if (!content || loading) return

    const history = messages.map(({ role, content }) => ({ role, content }))
    setMessages((prev) => [...prev, { id: `${Date.now()}-u`, role: 'user', content, timestamp: Date.now() }])
    setInput('')
    setLoading(true)

    try {
      const result = await chatWithAI({ message: content, history, userData: latestUser.current, locale })

      const reply: Message = { id: `${Date.now()}-a`, role: 'assistant', content: result.reply, timestamp: Date.now() }
      const currentPlan = latestUser.current?.plan
      if (result.changes && currentPlan) {
        const applied = applyPlanChanges(currentPlan, result.changes)
        if (hasChanges(applied.summary)) {
          setUserData((current: any) => clearExerciseMarks({ ...current, plan: applied.plan }, applied.summary.workoutDays))
          reply.summary = applied.summary
          reply.undoPlan = currentPlan
        }
      }
      setMessages((prev) => [...prev, reply])
    } catch (error) {
      console.error('Error chatting with AI:', error)
      setMessages((prev) => [...prev, { id: `${Date.now()}-e`, role: 'assistant', content: t('error'), timestamp: Date.now() }])
    } finally {
      setLoading(false)
    }
  }

  const undo = (message: Message) => {
    if (!message.undoPlan) return
    setUserData((current: any) => ({ ...current, plan: message.undoPlan }))
    setMessages((prev) => prev.map((m) => (m.id === message.id ? { ...m, undone: true, undoPlan: undefined } : m)))
  }

  const clearChat = () => {
    if (!loading) setMessages([])
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  // Only the most recent edit can be undone; undoing an older one would silently drop the later ones.
  const lastEditId = [...messages].reverse().find((m) => m.summary && !m.undone)?.id

  const bubble = (role: Message['role']) =>
    `max-w-[85%] rounded-2xl px-4 py-3 ${
      role === 'user'
        ? 'bg-gradient-to-r from-fitness-orange to-fitness-purple text-white rounded-tr-sm'
        : 'bg-gray-100 text-gray-900 rounded-tl-sm'
    }`

  const botAvatar = (
    <div className="w-8 h-8 rounded-full bg-gradient-to-r from-fitness-orange to-fitness-purple flex items-center justify-center flex-shrink-0">
      <Bot className="w-5 h-5 text-white" />
    </div>
  )

  const time = (timestamp: number) =>
    new Date(timestamp).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })

  return (
    <Card glass className="h-[72vh] min-h-[480px] flex flex-col">
      <div className="flex items-center gap-3 mb-4 pb-4 border-b border-gray-200">
        <div className="w-10 h-10 rounded-full bg-gradient-to-r from-fitness-orange to-fitness-purple flex items-center justify-center">
          <Bot className="w-6 h-6 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-lg">{t('title')}</h3>
          <p className="text-sm text-gray-600">{t('subtitle')}</p>
        </div>
        {messages.length > 0 && (
          <button
            type="button"
            onClick={clearChat}
            title={t('clear')}
            aria-label={t('clear')}
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-800 transition-colors"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Messages */}
      <div ref={listRef} className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2">
        <div className="flex gap-3 justify-start">
          {botAvatar}
          <div className={bubble('assistant')}>
            <p className="text-sm whitespace-pre-wrap break-words">{t('welcome')}</p>
          </div>
        </div>

        {messages.length === 0 && (
          <div className="flex flex-wrap gap-2 pl-11">
            {(['s1', 's2', 's3', 's4'] as const).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => send(t(`suggestions.${key}`))}
                disabled={loading}
                className="rounded-full border border-fitness-orange/40 bg-white px-3 py-1.5 text-left text-sm text-gray-700 hover:bg-orange-50 transition-colors"
              >
                {t(`suggestions.${key}`)}
              </button>
            ))}
          </div>
        )}

        {messages.map((message) => (
          <motion.div
            key={message.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {message.role === 'assistant' && botAvatar}
            <div className={bubble(message.role)}>
              <p className="text-sm whitespace-pre-wrap break-words">
                {message.role === 'assistant' ? renderText(message.content) : message.content}
              </p>

              {message.summary && (
                <div className="mt-3 rounded-xl border border-green-200 bg-white p-3 text-sm">
                  <p className={`flex items-center gap-2 font-semibold ${message.undone ? 'text-gray-500' : 'text-green-700'}`}>
                    {message.undone ? <Undo2 className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                    {message.undone ? t('undone') : t('applied')}
                  </p>
                  <ul className={`mt-1 space-y-0.5 text-gray-600 ${message.undone ? 'line-through' : ''}`}>
                    {message.summary.workoutDays.length > 0 && (
                      <li>{t('changedWorkout', { days: message.summary.workoutDays.join(', ') })}</li>
                    )}
                    {message.summary.mealDays.length > 0 && (
                      <li>{t('changedMeal', { days: message.summary.mealDays.join(', ') })}</li>
                    )}
                    {message.summary.targets && <li>{t('changedTargets')}</li>}
                  </ul>
                  {!message.undone && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {message.summary.workoutDays.length > 0 && (
                        <button
                          type="button"
                          onClick={() => onViewPlan?.('workout')}
                          className="inline-flex items-center gap-1 rounded-lg bg-gray-100 px-2.5 py-1 font-medium text-gray-700 hover:bg-gray-200"
                        >
                          <Dumbbell className="w-4 h-4" />
                          {t('viewWorkout')}
                        </button>
                      )}
                      {(message.summary.mealDays.length > 0 || message.summary.targets) && (
                        <button
                          type="button"
                          onClick={() => onViewPlan?.('meal')}
                          className="inline-flex items-center gap-1 rounded-lg bg-gray-100 px-2.5 py-1 font-medium text-gray-700 hover:bg-gray-200"
                        >
                          <UtensilsCrossed className="w-4 h-4" />
                          {t('viewMeal')}
                        </button>
                      )}
                      {message.id === lastEditId && message.undoPlan && (
                        <button
                          type="button"
                          onClick={() => undo(message)}
                          className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 font-medium text-red-600 hover:bg-red-50"
                        >
                          <Undo2 className="w-4 h-4" />
                          {t('undo')}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              <p className="text-xs mt-2 opacity-70">{time(message.timestamp)}</p>
            </div>
            {message.role === 'user' && (
              <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center flex-shrink-0">
                <UserIcon className="w-5 h-5 text-gray-700" />
              </div>
            )}
          </motion.div>
        ))}

        {loading && (
          <div className="flex gap-3 justify-start">
            {botAvatar}
            <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2 text-sm text-gray-600">
              <Loader className="w-5 h-5 animate-spin text-fitness-orange" />
              {t('thinking')}
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="flex gap-2 pt-4 border-t border-gray-200">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t('placeholder')}
          className="flex-1 px-4 py-3 rounded-lg border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-fitness-orange resize-none"
          rows={2}
        />
        <Button onClick={() => send()} disabled={!input.trim() || loading} className="px-6" aria-label={t('send')}>
          <Send className="w-5 h-5" />
        </Button>
      </div>
    </Card>
  )
}
