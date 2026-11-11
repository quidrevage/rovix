'use client'

import React from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { useLocale, useTranslations } from 'next-intl'
import {
  Dumbbell,
  UtensilsCrossed,
  Brain,
  Check,
  Star,
  ArrowRight,
  TrendingUp,
  Calendar,
  Target,
} from 'lucide-react'
import Button from './ui/Button'
import Card from './ui/Card'
import Navbar from './ui/Navbar'

export default function LandingPage() {
  const t = useTranslations('landing')
  const tCommon = useTranslations('common')
  const locale = useLocale()
  const onboardingHref = `/${locale}/onboarding`

  const features = [
    {
      icon: UtensilsCrossed,
      title: t('features.mealPlans.title'),
      description: t('features.mealPlans.description'),
      color: 'text-fitness-green',
    },
    {
      icon: Dumbbell,
      title: t('features.workoutPlans.title'),
      description: t('features.workoutPlans.description'),
      color: 'text-fitness-orange',
    },
    {
      icon: Brain,
      title: t('features.aiCoach.title'),
      description: t('features.aiCoach.description'),
      color: 'text-fitness-purple',
    },
  ]

  const testimonials = [
    {
      name: 'Sarah Johnson',
      role: t('testimonials.sarah.role'),
      content: t('testimonials.sarah.content'),
      rating: 5,
    },
    {
      name: 'Mike Chen',
      role: t('testimonials.mike.role'),
      content: t('testimonials.mike.content'),
      rating: 5,
    },
    {
      name: 'Emily Rodriguez',
      role: t('testimonials.emily.role'),
      content: t('testimonials.emily.content'),
      rating: 5,
    },
  ]

  const pricingPlans = [
    {
      name: t('pricing.free.name'),
      price: '$0',
      period: t('pricing.perWeek'),
      features: [
        t('pricing.free.f1'),
        t('pricing.free.f2'),
        t('pricing.free.f3'),
        t('pricing.free.f4'),
      ],
      highlighted: false,
    },
    {
      name: t('pricing.pro.name'),
      price: '$19',
      period: t('pricing.perMonth'),
      features: [
        t('pricing.pro.f1'),
        t('pricing.pro.f2'),
        t('pricing.pro.f3'),
        t('pricing.pro.f4'),
        t('pricing.pro.f5'),
        t('pricing.pro.f6'),
      ],
      highlighted: true,
    },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100">
      <Navbar />

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-20 pb-32 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center max-w-4xl mx-auto"
          >
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold mb-6 bg-gradient-to-r from-fitness-orange via-fitness-purple to-fitness-green bg-clip-text text-transparent">
              {t('heroTitle')}
            </h1>
            <p className="text-xl md:text-2xl text-gray-600 mb-8">
              {t('heroDescription')}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href={onboardingHref}>
                <Button size="lg" className="w-full sm:w-auto">
                  {t('getMyPlan')} <ArrowRight className="ml-2 w-5 h-5 inline" />
                </Button>
              </Link>
              <Link href="#features">
                <Button variant="outline" size="lg" className="w-full sm:w-auto">
                  {tCommon('learnMore')}
                </Button>
              </Link>
            </div>
          </motion.div>

          {/* Floating Elements */}
          <motion.div
            animate={{
              y: [0, -20, 0],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
            className="absolute top-20 left-10 w-20 h-20 bg-fitness-orange/20 rounded-full blur-xl"
          />
          <motion.div
            animate={{
              y: [0, 20, 0],
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
            className="absolute bottom-20 right-10 w-32 h-32 bg-fitness-purple/20 rounded-full blur-xl"
          />
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8 bg-white/50">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              {t('featuresTitle')}
            </h2>
            <p className="text-xl text-gray-600">
              {t('featuresSubtitle')}
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.2 }}
              >
                <Card hover glass className="text-center">
                  <feature.icon className={`w-12 h-12 ${feature.color} mx-auto mb-4`} />
                  <h3 className="text-2xl font-bold mb-3">{feature.title}</h3>
                  <p className="text-gray-600">{feature.description}</p>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-4">{t('testimonials.title')}</h2>
            <p className="text-xl text-gray-600">
              {t('testimonials.subtitle')}
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <motion.div
                key={testimonial.name}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.2 }}
              >
                <Card glass>
                  <div className="flex gap-1 mb-4">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star key={i} className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                  <p className="text-gray-700 mb-4 italic">
                    &quot;{testimonial.content}&quot;
                  </p>
                  <div>
                    <p className="font-semibold">{testimonial.name}</p>
                    <p className="text-sm text-gray-600">{testimonial.role}</p>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-fitness-orange/10 via-fitness-purple/10 to-fitness-green/10">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-4">{t('pricing.title')}</h2>
            <p className="text-xl text-gray-600">
              {t('pricing.subtitle')}
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-8">
            {pricingPlans.map((plan, index) => (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.2 }}
              >
                <Card
                  className={plan.highlighted ? 'ring-2 ring-fitness-orange relative' : ''}
                  hover
                >
                  {plan.highlighted && (
                    <div className="absolute top-4 right-4 bg-fitness-orange text-white text-xs font-bold px-3 py-1 rounded-full">
                      {t('pricing.popular')}
                    </div>
                  )}
                  <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                  <div className="mb-6">
                    <span className="text-4xl font-bold">{plan.price}</span>
                    <span className="text-gray-600">{plan.period}</span>
                  </div>
                  <ul className="space-y-3 mb-8">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-center gap-2">
                        <Check className="w-5 h-5 text-fitness-green flex-shrink-0" />
                        <span className="text-gray-700">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Link href={onboardingHref}>
                    <Button
                      variant={plan.highlighted ? 'primary' : 'outline'}
                      className="w-full"
                    >
                      {tCommon('getStarted')}
                    </Button>
                  </Link>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <Card glass className="text-center">
              <Target className="w-16 h-16 text-fitness-orange mx-auto mb-6" />
              <h2 className="text-3xl md:text-4xl font-bold mb-4">{t('cta.title')}</h2>
              <p className="text-xl text-gray-600 mb-8">
                {t('cta.description')}
              </p>
              <Link href={onboardingHref}>
                <Button size="lg">
                  {t('cta.startJourney')} <ArrowRight className="ml-2 w-5 h-5 inline" />
                </Button>
              </Link>
            </Card>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 sm:px-6 lg:px-8 border-t border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Dumbbell className="w-6 h-6 text-fitness-orange" />
            <span className="text-lg font-bold bg-gradient-to-r from-fitness-orange to-fitness-purple bg-clip-text text-transparent">
              Rovix
            </span>
          </div>
          <p className="text-gray-600">
            {t('footer')}
          </p>
        </div>
      </footer>
    </div>
  )
}

