'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface CardProps {
  children: React.ReactNode
  className?: string
  hover?: boolean
  glass?: boolean
  onClick?: () => void
}

export default function Card({ children, className, hover = false, glass = false, onClick }: CardProps) {
  return (
    <motion.div
      onClick={onClick}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={hover ? { scale: 1.02 } : {}}
      className={cn(
        'rounded-2xl p-6 bg-white shadow-lg border border-gray-200',
        glass && 'glass backdrop-blur-lg',
        className
      )}
    >
      {children}
    </motion.div>
  )
}

