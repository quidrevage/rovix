import jsPDF from 'jspdf'

// Sections are rendered from HTML to images because jsPDF's built-in fonts have no Cyrillic glyphs.

const LABELS: Record<string, Record<string, string>> = {
  en: { meal: 'Meal Plan', workout: 'Workout Plan', for: 'Generated for', date: 'Date', day: 'Day', cal: 'cal', sets: 'Sets', reps: 'Reps', rest: 'Rest', sec: 's' },
  uk: { meal: 'План харчування', workout: 'План тренувань', for: 'Створено для', date: 'Дата', day: 'День', cal: 'ккал', sets: 'Підходи', reps: 'Повтори', rest: 'Відпочинок', sec: 'с' },
  ru: { meal: 'План питания', workout: 'План тренировок', for: 'Создано для', date: 'Дата', day: 'День', cal: 'ккал', sets: 'Подходы', reps: 'Повторы', rest: 'Отдых', sec: 'с' },
}

const PAGE_WIDTH = 210
const PAGE_HEIGHT = 297
const MARGIN = 10

const esc = (value: unknown) =>
  String(value ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

const labelsFor = (locale: string) => LABELS[locale] || LABELS.en
const fileDate = () => new Date().toISOString().split('T')[0]

function headerSection(title: string, userData: any, locale: string) {
  const l = labelsFor(locale)
  const date = new Date().toLocaleDateString(locale)
  return `<div style="background:#ff6b35;color:#fff;padding:28px 32px">
    <div style="font-size:30px;font-weight:700">Rovix: ${esc(title)}</div>
    <div style="font-size:15px;margin-top:8px">${esc(l.for)}: ${esc(userData?.name || '-')}</div>
    <div style="font-size:15px;margin-top:4px">${esc(l.date)}: ${esc(date)}</div>
  </div>`
}

const dayHeader = (left: string, right = '') =>
  `<div style="background:#f0f0f0;padding:10px 16px;display:flex;justify-content:space-between;font-size:17px;font-weight:700;color:#1f2937">
    <span>${esc(left)}</span><span style="font-size:13px;font-weight:400">${esc(right)}</span>
  </div>`

function mealSections(mealPlans: any[], locale: string) {
  const l = labelsFor(locale)
  return mealPlans.map((plan) => {
    const macros = `${plan.totalCalories} ${l.cal} | P: ${plan.totalProtein} | C: ${plan.totalCarbs} | F: ${plan.totalFats}`
    const meals = (plan.meals || [])
      .map((meal: any) => `<div style="padding:8px 16px">
        <div style="font-size:15px;font-weight:700;color:#ff6b35">${esc(meal.name || meal.meal)}</div>
        <div style="font-size:13px;color:#1f2937;margin-top:3px">${esc(meal.description)}</div>
      </div>`)
      .join('')
    return `${dayHeader(`${l.day} ${plan.day}`, macros)}${meals}`
  })
}

function workoutSections(workoutPlans: any[], locale: string) {
  const l = labelsFor(locale)
  return workoutPlans.map((plan) => {
    const exercises = (plan.exercises || [])
      .map((ex: any) => `<div style="padding:8px 16px">
        <div style="font-size:15px;font-weight:700;color:#ff6b35">${esc(ex.name)}</div>
        <div style="font-size:13px;color:#1f2937;margin-top:3px">${esc(l.sets)}: ${esc(ex.sets)} | ${esc(l.reps)}: ${esc(ex.reps)}${ex.weight ? ` | ${esc(ex.weight)}` : ''}${ex.restSeconds ? ` | ${esc(l.rest)}: ${esc(ex.restSeconds)}${esc(l.sec)}` : ''}</div>
        ${ex.notes ? `<div style="font-size:12px;color:#4b5563;margin-top:3px">${esc(ex.notes)}</div>` : ''}
      </div>`)
      .join('')
    return `${dayHeader(`${l.day} ${plan.day}`, plan.focus || '')}${exercises}`
  })
}

async function renderPDF(sections: string[], filename: string) {
  const { default: html2canvas } = await import('html2canvas')
  const doc = new jsPDF()
  const container = document.createElement('div')
  container.style.cssText = 'position:fixed;left:-10000px;top:0;width:760px;background:#fff;font-family:Arial,Helvetica,sans-serif'
  document.body.appendChild(container)

  try {
    let y = MARGIN
    const width = PAGE_WIDTH - MARGIN * 2
    const maxHeight = PAGE_HEIGHT - MARGIN * 2 - 8 // room for the page number

    for (const html of sections) {
      const block = document.createElement('div')
      block.innerHTML = html
      container.appendChild(block)
      const canvas = await html2canvas(block, { scale: 2, backgroundColor: '#ffffff', logging: false })
      container.removeChild(block)

      const height = Math.min((canvas.height * width) / canvas.width, maxHeight)
      if (y + height > MARGIN + maxHeight) {
        doc.addPage()
        y = MARGIN
      }
      doc.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', MARGIN, y, width, height)
      y += height + 4
    }

    const totalPages = doc.getNumberOfPages()
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i)
      doc.setFontSize(8)
      doc.setTextColor(150, 150, 150)
      doc.text(`${i} / ${totalPages}`, PAGE_WIDTH / 2, PAGE_HEIGHT - 8, { align: 'center' })
    }

    doc.save(filename)
  } finally {
    document.body.removeChild(container)
  }
}

export function exportMealPlanPDF(userData: any, mealPlans: any[], locale: string = 'en') {
  return renderPDF(
    [headerSection(labelsFor(locale).meal, userData, locale), ...mealSections(mealPlans, locale)],
    `meal-plan-${userData?.name || 'user'}-${fileDate()}.pdf`
  )
}

export function exportWorkoutPlanPDF(userData: any, workoutPlans: any[], locale: string = 'en') {
  return renderPDF(
    [headerSection(labelsFor(locale).workout, userData, locale), ...workoutSections(workoutPlans, locale)],
    `workout-plan-${userData?.name || 'user'}-${fileDate()}.pdf`
  )
}

export function exportCombinedPDF(userData: any, mealPlans: any[], workoutPlans: any[], locale: string = 'en') {
  const l = labelsFor(locale)
  return renderPDF(
    [
      headerSection(l.meal, userData, locale),
      ...mealSections(mealPlans, locale),
      headerSection(l.workout, userData, locale),
      ...workoutSections(workoutPlans, locale),
    ],
    `fitness-plan-${userData?.name || 'user'}-${fileDate()}.pdf`
  )
}
