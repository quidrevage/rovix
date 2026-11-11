'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { motion } from 'framer-motion'
import { Dumbbell, Menu, X } from 'lucide-react'
import { useState } from 'react'
import Button from './Button'
import LanguageSwitcher from './LanguageSwitcher'
import { cn } from '@/lib/utils'

export default function Navbar() {
  const pathname = usePathname()
  const locale = useLocale()
  const t = useTranslations('nav')
  const tCommon = useTranslations('common')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Remove locale prefix from pathname for comparison
  const pathWithoutLocale = pathname.replace(`/${locale}`, '')

  const links = [
    { href: `/${locale}`, label: t('home') },
    { href: `/${locale}/dashboard`, label: t('dashboard') },
    { href: `/${locale}/meal-plan`, label: t('mealPlan') },
    { href: `/${locale}/progress`, label: t('progress') },
    { href: `/${locale}/profile`, label: t('profile') },
  ]

  return (
    <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-lg border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href={`/${locale}`} className="flex items-center gap-2">
            <Dumbbell className="w-8 h-8 text-fitness-orange" />
            <span className="text-xl font-bold bg-gradient-to-r from-fitness-orange to-fitness-purple bg-clip-text text-transparent">
              Rovix
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-6">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'text-sm font-medium transition-colors',
                  pathWithoutLocale === link.href.replace(`/${locale}`, '') || 
                  (pathWithoutLocale === '' && link.href === `/${locale}`)
                    ? 'text-fitness-orange'
                    : 'text-gray-600 hover:text-fitness-orange'
                )}
              >
                {link.label}
              </Link>
            ))}
            <LanguageSwitcher />
            <Link href={`/${locale}/onboarding`}>
              <Button size="sm">{tCommon('getStarted')}</Button>
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden flex items-center gap-2">
            <LanguageSwitcher />
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-gray-600 hover:bg-gray-100"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="md:hidden border-t border-gray-200"
        >
          <div className="px-4 py-4 space-y-3">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  'block text-base font-medium transition-colors',
                  pathWithoutLocale === link.href.replace(`/${locale}`, '') ||
                  (pathWithoutLocale === '' && link.href === `/${locale}`)
                    ? 'text-fitness-orange'
                    : 'text-gray-600 hover:text-fitness-orange'
                )}
              >
                {link.label}
              </Link>
            ))}
            <Link href={`/${locale}/onboarding`} onClick={() => setMobileMenuOpen(false)}>
              <Button size="sm" className="w-full mt-4">{tCommon('getStarted')}</Button>
            </Link>
          </div>
        </motion.div>
      )}
    </nav>
  )
}
