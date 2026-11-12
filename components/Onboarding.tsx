"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { useUser } from '@/context/UserContext';
import { generateFitnessPlan } from '@/lib/gemini';
import { useTranslations } from 'next-intl';
import { User, Target, UtensilsCrossed, CheckCircle2, ArrowRight, ArrowLeft, Loader2 } from 'lucide-react';
import Button from './ui/Button';
import Card from './ui/Card';
import Navbar from './ui/Navbar';
import { DIET_OPTIONS, EQUIPMENT_OPTIONS, addDiet, customDiets } from '@/lib/options';
import TagInput from './ui/TagInput';
import DataTransfer from './DataTransfer';

interface FormData {
  name: string;
  gender: string;
  age: string;
  height: string;
  weight: string;
  activityLevel: string;
  fitnessGoal: string;
  trainingFrequency: string;
  equipmentAccess: string[];
  trainingNotes: string;
  dietPreferences: string[];
  allergies: string;
  foodNotes: string;
  mealsPerDay: string;
}

export default function Onboarding() {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations('onboarding');
  const { user, userData, setUserData } = useUser();
  const [currentStep, setCurrentStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [showError, setShowError] = useState(false);

  const steps = [
    { id: 'personal', title: t('steps.personalInfo'), icon: User },
    { id: 'goals', title: t('steps.goals'), icon: Target },
    { id: 'preferences', title: t('steps.preferences'), icon: UtensilsCrossed },
  ];

  const [formData, setFormData] = useState<FormData>({
    name: '',
    gender: '',
    age: '',
    height: '',
    weight: '',
    activityLevel: '',
    fitnessGoal: '',
    trainingFrequency: '',
    equipmentAccess: [],
    trainingNotes: '',
    dietPreferences: [],
    allergies: '',
    foodNotes: '',
    mealsPerDay: '4'
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>, field: keyof FormData) => {
    const { value, checked } = e.target;
    setFormData(prev => {
      const currentArray = prev[field] as string[];
      if (checked) {
        return { ...prev, [field]: [...currentArray, value] };
      } else {
        return { ...prev, [field]: currentArray.filter(item => item !== value) };
      }
    });
  };

  const setDiets = (dietPreferences: string[]) => setFormData((prev) => ({ ...prev, dietPreferences }));

  const inRange = (value: string, min: number, max: number) => Number(value) >= min && Number(value) <= max;

  const isStepValid = () => {
    if (currentStep === 0) {
      return (
        formData.name.trim() !== '' &&
        formData.gender !== '' &&
        formData.activityLevel !== '' &&
        inRange(formData.age, 10, 120) &&
        inRange(formData.height, 100, 250) &&
        inRange(formData.weight, 30, 400)
      );
    }
    if (currentStep === 1) {
      return formData.fitnessGoal !== '' && formData.trainingFrequency !== '' && formData.equipmentAccess.length > 0;
    }
    return true;
  };

  const handleNext = () => {
    if (!isStepValid()) {
      setShowError(true);
      return;
    }
    setShowError(false);

    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      handleGenerate();
    }
  };

  const handleBack = () => {
    setShowError(false);
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleGenerate = async () => {
    setIsLoading(true);
    try {
      const generatedPlan = await generateFitnessPlan(formData, locale);

      if (generatedPlan && user) {
        const dataToSave = {
          ...formData,
          progress: userData?.progress || [],
          plan: generatedPlan,
          createdAt: Date.now() 
        };

        setUserData(dataToSave);
        window.location.href = `/${locale}/dashboard`; 
      } else {
        alert(t('error'));
      }
    } catch (error) {
      console.error("Критическая ошибка:", error);
      alert(t('error'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <Navbar />
      <div className="max-w-4xl mx-auto py-12 px-4">
        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-6">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const isActive = index === currentStep;
              const isCompleted = index < currentStep;
              
              return (
                <div key={step.id} className="flex-1 flex flex-col items-center">
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className={`relative w-16 h-16 rounded-full flex items-center justify-center mb-3 transition-all duration-300 ${
                      isActive 
                        ? 'bg-gradient-to-r from-fitness-orange to-fitness-purple text-white shadow-lg scale-110' 
                        : isCompleted
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-200 text-gray-400 dark:bg-gray-700'
                    }`}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="w-8 h-8" />
                    ) : (
                      <Icon className="w-8 h-8" />
                    )}
                    {isActive && (
                      <motion.div
                        className="absolute inset-0 rounded-full border-4 border-fitness-orange"
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ duration: 2, repeat: Infinity }}
                      />
                    )}
                  </motion.div>
                  <span className={`text-sm font-medium text-center ${
                    isActive ? 'text-fitness-orange font-bold' : isCompleted ? 'text-green-600' : 'text-gray-400'
                  }`}>
                    {step.title}
                  </span>
                </div>
              );
            })}
          </div>
          
          {/* Progress Bar */}
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden dark:bg-gray-700">
            <motion.div
              className="h-full bg-gradient-to-r from-fitness-orange to-fitness-purple rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
              transition={{ duration: 0.5, ease: "easeInOut" }}
            />
          </div>
        </div>

        {/* Coming from another device: bring the saved data instead of filling the form again. */}
        {currentStep === 0 && !userData && (
          <details className="mb-6 rounded-xl border border-gray-200 bg-white px-4 py-3">
            <summary className="cursor-pointer text-sm font-medium text-gray-700">{t('haveBackup')}</summary>
            <div className="mt-3 max-w-sm">
              <DataTransfer onImported={() => router.push(`/${locale}/dashboard`)} />
            </div>
          </details>
        )}

        {/* Form Content */}
        <Card className="min-h-[500px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{ duration: 0.3 }}
            >
              {/* STEP 1: PERSONAL DETAILS */}
              {currentStep === 0 && (
                <div className="space-y-6">
                  <div className="text-center mb-8">
                    <h2 className="text-3xl font-bold bg-gradient-to-r from-fitness-orange to-fitness-purple bg-clip-text text-transparent mb-2">
                      {t('steps.personalInfo')}
                    </h2>
                    <p className="text-gray-600 dark:text-gray-400">{t('personalInfo.description') || 'Расскажите нам о себе'}</p>
                  </div>
                  
                  <div className="space-y-5">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        {t('personalInfo.name')}
                      </label>
                      <input
                        name="name"
                        value={formData.name}
                        onChange={handleInputChange}
                        placeholder={t('personalInfo.namePlaceholder')}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-fitness-orange focus:ring-2 focus:ring-fitness-orange/20 transition-all dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                          {t('personalInfo.gender')}
                        </label>
                        <select
                          name="gender"
                          value={formData.gender}
                          onChange={handleInputChange}
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-fitness-orange focus:ring-2 focus:ring-fitness-orange/20 transition-all dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        >
                          <option value="">{t('personalInfo.genderSelect')}</option>
                          <option value="male">{t('personalInfo.male')}</option>
                          <option value="female">{t('personalInfo.female')}</option>
                          <option value="other">{t('personalInfo.other')}</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                          {t('personalInfo.age')}
                        </label>
                        <input
                          name="age"
                          type="number"
                          value={formData.age}
                          onChange={handleInputChange}
                          placeholder={t('personalInfo.agePlaceholder')}
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-fitness-orange focus:ring-2 focus:ring-fitness-orange/20 transition-all dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                          {t('bodyMetrics.height')}
                        </label>
                        <input
                          name="height"
                          type="number"
                          value={formData.height}
                          onChange={handleInputChange}
                          placeholder={t('bodyMetrics.heightPlaceholder')}
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-fitness-orange focus:ring-2 focus:ring-fitness-orange/20 transition-all dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                          {t('bodyMetrics.weight')}
                        </label>
                        <input
                          name="weight"
                          type="number"
                          value={formData.weight}
                          onChange={handleInputChange}
                          placeholder={t('bodyMetrics.weightPlaceholder')}
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-fitness-orange focus:ring-2 focus:ring-fitness-orange/20 transition-all dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        {t('bodyMetrics.activityLevel')}
                      </label>
                      <select
                        name="activityLevel"
                        value={formData.activityLevel}
                        onChange={handleInputChange}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-fitness-orange focus:ring-2 focus:ring-fitness-orange/20 transition-all dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                      >
                        <option value="">{t('bodyMetrics.activitySelect')}</option>
                        <option value="sedentary">{t('bodyMetrics.sedentary')}</option>
                        <option value="light">{t('bodyMetrics.lightlyActive')}</option>
                        <option value="moderate">{t('bodyMetrics.moderatelyActive')}</option>
                        <option value="active">{t('bodyMetrics.veryActive')}</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 2: GOALS */}
              {currentStep === 1 && (
                <div className="space-y-6">
                  <div className="text-center mb-8">
                    <h2 className="text-3xl font-bold bg-gradient-to-r from-fitness-orange to-fitness-purple bg-clip-text text-transparent mb-2">
                      {t('steps.goals')}
                    </h2>
                    <p className="text-gray-600 dark:text-gray-400">{t('goals.description') || 'Определите свои фитнес-цели'}</p>
                  </div>

                  <div className="space-y-5">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        {t('goals.fitnessGoal')}
                      </label>
                      <select
                        name="fitnessGoal"
                        value={formData.fitnessGoal}
                        onChange={handleInputChange}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-fitness-orange focus:ring-2 focus:ring-fitness-orange/20 transition-all dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                      >
                        <option value="">{t('goals.goalSelect')}</option>
                        <option value="weight_loss">{t('goals.fatLoss')}</option>
                        <option value="muscle_gain">{t('goals.muscleGain')}</option>
                        <option value="endurance">{t('goals.endurance')}</option>
                        <option value="flexibility">{t('goals.flexibility')}</option>
                        <option value="maintenance">{t('goals.maintenance')}</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        {t('goals.trainingFrequency')}
                      </label>
                      <select
                        name="trainingFrequency"
                        value={formData.trainingFrequency}
                        onChange={handleInputChange}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-fitness-orange focus:ring-2 focus:ring-fitness-orange/20 transition-all dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                      >
                        <option value="">{t('goals.trainingFrequency')}</option>
                        <option value="2">2 {t('goals.daysPerWeek') || 'days per week'}</option>
                        <option value="3">3 {t('goals.daysPerWeek') || 'days per week'}</option>
                        <option value="4">4 {t('goals.daysPerWeek') || 'days per week'}</option>
                        <option value="5">5+ {t('goals.daysPerWeek') || 'days per week'}</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                        {t('goals.equipment')}
                      </label>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {EQUIPMENT_OPTIONS.map(({ value: item, key: labelKey }) => (
                          <motion.label
                            key={item}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            className={`flex items-center space-x-3 p-4 border-2 rounded-xl cursor-pointer transition-all ${
                              formData.equipmentAccess.includes(item)
                                ? 'border-fitness-orange bg-orange-50 dark:bg-orange-900/20'
                                : 'border-gray-200 hover:border-gray-300 dark:border-gray-600 dark:hover:border-gray-500'
                            }`}
                          >
                            <input
                              type="checkbox"
                              value={item}
                              checked={formData.equipmentAccess.includes(item)}
                              onChange={(e) => handleCheckboxChange(e, 'equipmentAccess')}
                              className="w-5 h-5 rounded text-fitness-orange focus:ring-fitness-orange"
                            />
                            <span className="text-sm font-medium">{t(labelKey)}</span>
                          </motion.label>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        {t('goals.trainingNotes')}
                      </label>
                      <textarea
                        name="trainingNotes"
                        value={formData.trainingNotes}
                        onChange={handleInputChange}
                        maxLength={500}
                        placeholder={t('goals.trainingNotesPlaceholder')}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-fitness-orange focus:ring-2 focus:ring-fitness-orange/20 transition-all resize-none dark:bg-gray-700 dark:border-gray-600 dark:text-white h-28"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 3: PREFERENCES */}
              {currentStep === 2 && (
                <div className="space-y-6">
                  <div className="text-center mb-8">
                    <h2 className="text-3xl font-bold bg-gradient-to-r from-fitness-orange to-fitness-purple bg-clip-text text-transparent mb-2">
                      {t('steps.preferences')}
                    </h2>
                    <p className="text-gray-600 dark:text-gray-400">{t('preferences.description') || 'Ваши предпочтения в питании'}</p>
                  </div>

                  <div className="space-y-5">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                        {t('preferences.dietPreferences')}
                      </label>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {DIET_OPTIONS.map(({ value: item, key: labelKey }) => (
                          <motion.label
                            key={item}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            className={`flex items-center space-x-3 p-4 border-2 rounded-xl cursor-pointer transition-all ${
                              formData.dietPreferences.includes(item)
                                ? 'border-fitness-purple bg-purple-50 dark:bg-purple-900/20'
                                : 'border-gray-200 hover:border-gray-300 dark:border-gray-600 dark:hover:border-gray-500'
                            }`}
                          >
                            <input
                              type="checkbox"
                              value={item}
                              checked={formData.dietPreferences.includes(item)}
                              onChange={(e) => handleCheckboxChange(e, 'dietPreferences')}
                              className="w-5 h-5 rounded text-fitness-purple focus:ring-fitness-purple"
                            />
                            <span className="text-sm font-medium">{t(labelKey)}</span>
                          </motion.label>
                        ))}
                      </div>
                      <div className="mt-3">
                        <TagInput
                          values={customDiets(formData.dietPreferences)}
                          onAdd={(value) => setDiets(addDiet(formData.dietPreferences, value))}
                          onRemove={(value) => setDiets((formData.dietPreferences || []).filter((item: string) => item !== value))}
                          placeholder={t('preferences.customDietPlaceholder')}
                          addLabel={t('preferences.addDiet')}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        {t('preferences.mealsPerDay')}
                      </label>
                      <select
                        name="mealsPerDay"
                        value={formData.mealsPerDay}
                        onChange={handleInputChange}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-fitness-orange focus:ring-2 focus:ring-fitness-orange/20 transition-all dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                      >
                        <option value="3">3</option>
                        <option value="4">4</option>
                        <option value="5">5</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        {t('preferences.foodNotes')}
                      </label>
                      <textarea
                        name="foodNotes"
                        value={formData.foodNotes}
                        onChange={handleInputChange}
                        maxLength={500}
                        placeholder={t('preferences.foodNotesPlaceholder')}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-fitness-orange focus:ring-2 focus:ring-fitness-orange/20 transition-all resize-none dark:bg-gray-700 dark:border-gray-600 dark:text-white h-24"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        {t('preferences.allergies')}
                      </label>
                      <textarea
                        name="allergies"
                        value={formData.allergies}
                        onChange={handleInputChange}
                        placeholder={t('preferences.allergiesPlaceholder')}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-fitness-orange focus:ring-2 focus:ring-fitness-orange/20 transition-all resize-none dark:bg-gray-700 dark:border-gray-600 dark:text-white h-32"
                      />
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {showError && (
            <p role="alert" className="mt-6 text-sm font-medium text-red-600">{t('validation')}</p>
          )}

          {/* Navigation Buttons */}
          <div className="flex justify-between mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
            <Button
              onClick={handleBack}
              disabled={currentStep === 0 || isLoading}
              variant="outline"
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              {t('back') || 'Back'}
            </Button>
            <Button
              onClick={handleNext}
              disabled={isLoading}
              className="flex items-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t('generating') || 'Generating...'}
                </>
              ) : (
                <>
                  {currentStep === steps.length - 1 ? (t('preferences.completeSetup') || 'Create My Plan') : (t('next') || 'Next')}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
