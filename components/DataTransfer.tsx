'use client'

import React, { useRef } from 'react'
import { Download, Upload } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useUser } from '@/context/UserContext'

// All data lives in this browser. A backup file is how it moves to another device (PC -> phone) or survives a reset.

const buttonClass =
  'inline-flex w-full items-center justify-start gap-2 rounded-lg border-2 border-primary-500 px-6 py-3 font-semibold text-primary-600 hover:bg-primary-50'

export default function DataTransfer({ onImported }: { onImported?: () => void }) {
  const t = useTranslations('profile.transfer')
  const { userData, setUserData } = useUser()
  const fileInput = useRef<HTMLInputElement>(null)

  const exportData = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(userData, null, 2)], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `rovix-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  const importData = async (file?: File) => {
    if (!file) return
    try {
      const data = JSON.parse(await file.text())
      if (!data || typeof data !== 'object' || !data.name || !data.plan) throw new Error('not a Rovix backup')
      if (userData && !window.confirm(t('confirm'))) return
      setUserData(data)
      onImported?.()
    } catch {
      window.alert(t('error'))
    } finally {
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  return (
    <div className="space-y-2">
      {userData && (
        <button type="button" onClick={exportData} className={buttonClass}>
          <Download className="h-4 w-4" />
          {t('export')}
        </button>
      )}
      <button type="button" onClick={() => fileInput.current?.click()} className={buttonClass}>
        <Upload className="h-4 w-4" />
        {t('import')}
      </button>
      <input
        ref={fileInput}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => importData(e.target.files?.[0])}
      />
      <p className="text-xs text-gray-500">{t('hint')}</p>
    </div>
  )
}
