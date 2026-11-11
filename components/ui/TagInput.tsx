'use client'

import React, { useState } from 'react'
import { Plus, X } from 'lucide-react'

interface TagInputProps {
  /** The user's own entries, shown as removable chips. */
  values: string[]
  onAdd: (value: string) => void
  onRemove: (value: string) => void
  placeholder: string
  addLabel: string
}

/** Lets the user add their own short entries (for example a diet preference that is not in the preset list). */
export default function TagInput({ values, onAdd, onRemove, placeholder, addLabel }: TagInputProps) {
  const [draft, setDraft] = useState('')

  const add = () => {
    const value = draft.trim().slice(0, 40)
    if (value) onAdd(value)
    setDraft('')
  }

  return (
    <div className="space-y-2">
      {values.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {values.map((value) => (
            <span key={value} className="inline-flex items-center gap-1 rounded-full bg-purple-100 py-1 pl-3 pr-1 text-sm text-purple-900">
              {value}
              <button
                type="button"
                onClick={() => onRemove(value)}
                aria-label={`× ${value}`}
                className="rounded-full p-1 hover:bg-purple-200"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              add()
            }
          }}
          maxLength={40}
          placeholder={placeholder}
          className="min-w-0 flex-1 rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-fitness-purple"
        />
        <button
          type="button"
          onClick={add}
          disabled={!draft.trim()}
          className="inline-flex items-center gap-1 rounded-lg border border-fitness-purple px-3 py-2 font-medium text-fitness-purple hover:bg-purple-50 disabled:opacity-40"
        >
          <Plus className="h-4 w-4" />
          {addLabel}
        </button>
      </div>
    </div>
  )
}
