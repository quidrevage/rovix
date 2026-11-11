'use client'

import { useEffect } from 'react'
import { useTranslations } from 'next-intl'

const RELOADED_AT = 'fitai_chunk_reload'

/** Shown when a page crashes. A missing code chunk (after an update or a dev-server restart) is fixed by one reload. */
export default function PageError({ error, reset }: { error: Error; reset: () => void }) {
  const t = useTranslations('common')

  useEffect(() => {
    if (!/ChunkLoadError|Loading chunk/i.test(`${error.name} ${error.message}`)) return
    const last = Number(sessionStorage.getItem(RELOADED_AT) || 0)
    if (Date.now() - last < 15000) return // already tried: don't loop
    sessionStorage.setItem(RELOADED_AT, String(Date.now()))
    window.location.reload()
  }, [error])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-bold">{t('errorTitle')}</h1>
      <p className="max-w-md text-gray-600">{t('errorText')}</p>
      <div className="flex gap-3">
        <button type="button" onClick={reset} className="rounded-lg border border-gray-300 px-5 py-2.5 font-semibold text-gray-700 hover:bg-gray-50">
          {t('retry')}
        </button>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-lg bg-gradient-to-r from-fitness-orange to-fitness-purple px-5 py-2.5 font-semibold text-white hover:opacity-90"
        >
          {t('reload')}
        </button>
      </div>
    </div>
  )
}
