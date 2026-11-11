// Built-in library of movement patterns: an animated stick-figure demo plus short technique notes.
// Works offline and in demo mode; the AI can add a detailed guide on top (see explainExercise in gemini.ts).

export type Text = [en: string, uk: string, ru: string]
export type Point = [x: number, y: number]

/** Key joints of the figure, drawn from the side in a 200x190 box (the floor is at y = 177). */
export interface Pose {
  hip: Point
  sh: Point // shoulder
  hand: Point
  foot: Point
  hand2?: Point // far-side limbs, only when they move differently
  foot2?: Point
  head?: Point // overrides the default "in line with the torso" position
}

export interface ExerciseDemo {
  key: string
  name: Text
  muscles: Text
  steps: Text[]
  mistake: Text
  a: Pose // start position
  b: Pose // end position
  knee: 1 | -1 // which side the knee and elbow bend to
  elbow: 1 | -1
  effort?: 'a' | 'b' // the pose you move towards while exhaling
  hold?: boolean // static exercise
  period?: number // seconds per repetition
  swingLegs?: boolean // the leg stays straight and swings from the hip
  highlight: 'legs' | 'arms' | 'core'
  prop?: 'dumbbell' | 'barbell' | 'bar' | 'platform'
  scene?: 'bench' | 'seat' | 'mat' | 'bars'
  view?: 'front' // drawn facing the viewer, both sides mirrored; default is a side view
  match: RegExp
}

const STAND = { hip: [100, 108] as Point, sh: [100, 64] as Point, foot: [100, 176] as Point }

// Order matters: the first pattern whose `match` fits the exercise name wins.
export const EXERCISE_DEMOS: ExerciseDemo[] = [
  {
    key: 'legpress',
    name: ['Leg press', 'Жим ногами', 'Жим ногами'],
    muscles: ['Quads, glutes', 'Квадрицепси, сідниці', 'Квадрицепсы, ягодицы'],
    steps: [
      ['Sit in the machine, back and hips pressed into the seat', 'Сядьте в тренажер, спина й таз притиснуті до сидіння', 'Сядьте в тренажёр, спина и таз прижаты к сиденью'],
      ['Feet shoulder-width apart in the middle of the platform', 'Стопи на ширині плечей посередині платформи', 'Стопы на ширине плеч посередине платформы'],
      ['Lower the platform until your knees are bent to about 90°', 'Опускайте платформу, доки коліна не зігнуться приблизно до 90°', 'Опускайте платформу, пока колени не согнутся примерно до 90°'],
      ['Press it away without locking your knees', 'Вичавіть платформу, не випрямляючи коліна до упору', 'Выжмите платформу, не выпрямляя колени до упора'],
    ],
    mistake: ['Locking the knees or lifting the hips off the seat', 'Повне «замикання» колін або відрив таза від сидіння', 'Полное «замыкание» коленей или отрыв таза от сиденья'],
    a: { hip: [70, 150], sh: [44, 115], hand: [74, 144], foot: [112, 118] },
    b: { hip: [70, 150], sh: [44, 115], hand: [74, 144], foot: [124, 110] },
    knee: -1,
    elbow: 1,
    effort: 'b',
    highlight: 'legs',
    prop: 'platform',
    scene: 'seat',
    match: /leg press|жим ног/i,
  },
  {
    key: 'pullup',
    name: ['Pull-up', 'Підтягування', 'Подтягивания'],
    muscles: ['Lats, biceps, upper back', "Найширші м'язи спини, біцепси, верх спини", 'Широчайшие мышцы спины, бицепсы, верх спины'],
    steps: [
      ['Grip the bar slightly wider than shoulders and hang with straight arms', 'Візьміться за турнік трохи ширше плечей і повисніть на прямих руках', 'Возьмитесь за турник чуть шире плеч и повисните на прямых руках'],
      ['Pull your shoulder blades down and together', 'Опустіть і зведіть лопатки', 'Опустите и сведите лопатки'],
      ['Pull up until your chin is over the bar, elbows going down', 'Тягніться вгору, доки підборіддя не опиниться над перекладиною; лікті спрямовуйте вниз', 'Тянитесь вверх, пока подбородок не окажется над перекладиной; локти направляйте вниз'],
      ['Lower slowly under control', 'Повільно й підконтрольно опустіться', 'Медленно и подконтрольно опуститесь'],
    ],
    mistake: ['Swinging and jerking instead of a controlled pull', 'Розгойдування та ривки замість підконтрольного руху', 'Раскачивание и рывки вместо подконтрольного движения'],
    a: { hip: [100, 110], sh: [100, 66], hand: [108, 22], foot: [94, 170] },
    b: { hip: [98, 82], sh: [98, 38], hand: [108, 22], foot: [92, 142] },
    knee: -1,
    elbow: 1,
    effort: 'b',
    highlight: 'arms',
    prop: 'bar',
    match: /pull[- ]?up|chin[- ]?up|lat pull|pulldown|підтяг|подтяг|тяга верхн/i,
  },
  {
    key: 'dip',
    name: ['Dips', 'Віджимання на брусах', 'Отжимания на брусьях'],
    muscles: ['Triceps, chest, front delts', 'Трицепси, груди, передні дельти', 'Трицепсы, грудь, передние дельты'],
    steps: [
      ['Support yourself on the bars with straight arms, shoulders down', 'Вийдіть в упор на брусах на прямих руках, плечі опущені', 'Выйдите в упор на брусьях на прямых руках, плечи опущены'],
      ['Lean slightly forward and bend your elbows, lowering under control', 'Трохи нахиліться вперед і згинайте лікті, плавно опускаючись', 'Слегка наклонитесь вперёд и сгибайте локти, плавно опускаясь'],
      ['Stop when your shoulders are level with your elbows', 'Зупиніться, коли плечі опиняться на рівні ліктів', 'Остановитесь, когда плечи окажутся на уровне локтей'],
      ['Press up until your arms are straight', 'Вичавіть себе вгору до випрямлення рук', 'Выжмите себя вверх до выпрямления рук'],
    ],
    mistake: ['Dropping too deep or shrugging the shoulders up to the ears', 'Занадто глибоке опускання або плечі, підтягнуті до вух', 'Слишком глубокое опускание или плечи, поднятые к ушам'],
    a: { hip: [98, 110], sh: [100, 66], hand: [103, 110], foot: [84, 158] },
    b: { hip: [94, 132], sh: [106, 90], hand: [103, 110], foot: [80, 174] },
    knee: -1,
    elbow: 1,
    effort: 'a',
    highlight: 'arms',
    scene: 'bars',
    match: /\bdips?\b|брус/i,
  },
  {
    key: 'lateral',
    name: ['Lateral raise', 'Розведення рук у сторони', 'Разведение рук в стороны'],
    muscles: ['Side delts, upper traps', 'Середні дельти, верх трапецій', 'Средние дельты, верх трапеций'],
    steps: [
      ['Stand tall, weights at your sides, elbows slightly bent', 'Станьте рівно, вага вздовж тіла, лікті трохи зігнуті', 'Встаньте ровно, вес вдоль тела, локти слегка согнуты'],
      ['Raise your arms out to the sides up to shoulder height', 'Піднімайте руки через сторони до рівня плечей', 'Поднимайте руки через стороны до уровня плеч'],
      ['Pause for a moment at the top, wrists no higher than elbows', "Затримайтеся на мить угорі, зап'ястя не вище ліктів", 'Задержитесь на мгновение вверху, запястья не выше локтей'],
      ['Lower slowly', 'Повільно опустіть', 'Медленно опустите'],
    ],
    mistake: ['Swinging the weights up with the body', 'Закидання ваги ривком корпуса', 'Забрасывание веса рывком корпуса'],
    a: { hip: [100, 108], sh: [100, 64], hand: [118, 107], foot: [108, 176] },
    b: { hip: [100, 108], sh: [100, 64], hand: [156, 66], foot: [108, 176] },
    knee: -1,
    elbow: -1,
    view: 'front',
    effort: 'b',
    highlight: 'arms',
    prop: 'dumbbell',
    match: /lateral raise|side raise|розведення[^,;]*(сторон|стоячи)|махи[^,;]*сторон|разведени[ея][^,;]*сторон|махи[^,;]*в стороны/i,
  },
  {
    key: 'jack',
    name: ['Jumping jacks', 'Стрибки «Джампінг Джек»', 'Прыжки «Джампинг Джек»'],
    muscles: ['Whole body, heart and lungs', 'Усе тіло, серцево-судинна система', 'Всё тело, сердечно-сосудистая система'],
    steps: [
      ['Stand with feet together, arms at your sides', 'Станьте, ноги разом, руки вздовж тіла', 'Встаньте, ноги вместе, руки вдоль тела'],
      ['Jump your feet apart while raising your arms overhead', 'У стрибку розведіть ноги й підніміть руки над головою', 'В прыжке разведите ноги и поднимите руки над головой'],
      ['Jump back to the start, landing softly on the balls of your feet', "Стрибком поверніться назад, м'яко приземляючись на носки", 'Прыжком вернитесь назад, мягко приземляясь на носки'],
      ['Keep an even rhythm and breathe steadily', 'Тримайте рівний ритм і дихайте спокійно', 'Держите ровный ритм и дышите спокойно'],
    ],
    mistake: ['Landing on stiff legs or flat feet', 'Приземлення на прямі ноги або всю стопу', 'Приземление на прямые ноги или всю стопу'],
    a: { hip: [100, 108], sh: [100, 64], hand: [118, 106], foot: [108, 176] },
    b: { hip: [100, 106], sh: [100, 62], hand: [136, 24], foot: [134, 174] },
    knee: -1,
    elbow: -1,
    view: 'front',
    period: 1.1,
    highlight: 'legs',
    match: /jumping jack|star jump|джампінг|джампинг|джек|стрибки[^,;]*розведенн|прыжки[^,;]*разведени/i,
  },
  {
    key: 'pushup',
    name: ['Push-up', 'Віджимання', 'Отжимания'],
    muscles: ['Chest, triceps, shoulders, core', 'Груди, трицепси, плечі, кор', 'Грудь, трицепсы, плечи, кор'],
    steps: [
      ['Hands slightly wider than shoulders, body in a straight line', 'Долоні трохи ширше плечей, тіло — пряма лінія', 'Ладони чуть шире плеч, тело — прямая линия'],
      ['Tighten your abs and glutes', 'Напружте прес і сідниці', 'Напрягите пресс и ягодицы'],
      ['Bend your elbows at about 45° and lower your chest to the floor', 'Згинайте лікті під кутом близько 45° та опускайте груди до підлоги', 'Сгибайте локти под углом около 45° и опускайте грудь к полу'],
      ['Push the floor away until your arms are straight', 'Виштовхніть себе вгору до повного випрямлення рук', 'Вытолкните себя вверх до полного выпрямления рук'],
    ],
    mistake: ['Sagging hips or elbows flared straight out to the sides', 'Провисання таза або лікті, розведені суто в сторони', 'Провисание таза или локти, разведённые строго в стороны'],
    a: { hip: [92, 149], sh: [132, 132], hand: [134, 176], foot: [30, 176] },
    b: { hip: [97, 166], sh: [141, 160], hand: [134, 176], foot: [30, 176] },
    knee: -1,
    elbow: 1,
    effort: 'a',
    highlight: 'arms',
    match: /push[- ]?up|press[- ]?up|віджим|отжим/i,
  },
  {
    key: 'bench',
    name: ['Bench press', 'Жим лежачи', 'Жим лёжа'],
    muscles: ['Chest, triceps, front delts', 'Груди, трицепси, передні дельти', 'Грудь, трицепсы, передние дельты'],
    steps: [
      ['Lie on the bench, feet flat on the floor, shoulder blades squeezed', 'Ляжте на лаву, стопи на підлозі, лопатки зведені', 'Лягте на скамью, стопы на полу, лопатки сведены'],
      ['Hold the weight above your chest with straight arms', 'Тримайте вагу над грудьми на прямих руках', 'Держите вес над грудью на прямых руках'],
      ['Lower it to mid-chest, elbows at about 45° to the body', 'Опустіть до середини грудей, лікті під кутом близько 45° до тіла', 'Опустите к середине груди, локти под углом около 45° к телу'],
      ['Press back up without bouncing', 'Вичавіть угору без відбиву', 'Выжмите вверх без отбива'],
    ],
    mistake: ['Lifting the hips off the bench or bouncing the weight off the chest', 'Відрив таза від лави або відбив ваги від грудей', 'Отрыв таза от скамьи или отбив веса от груди'],
    a: { hip: [114, 132], sh: [70, 132], hand: [72, 112], foot: [140, 176] },
    b: { hip: [114, 132], sh: [70, 132], hand: [70, 88], foot: [140, 176] },
    knee: -1,
    elbow: 1,
    effort: 'b',
    highlight: 'arms',
    prop: 'barbell',
    scene: 'bench',
    match: /bench|chest press|floor press|chest fl|жим[^,;]*(леж|лёж|груд)|розвед[^,;]*леж|развед[^,;]*л[её]ж/i,
  },
  {
    key: 'press',
    name: ['Overhead press', 'Жим над головою', 'Жим над головой'],
    muscles: ['Shoulders, triceps, upper chest', 'Плечі, трицепси, верх грудей', 'Плечи, трицепсы, верх груди'],
    steps: [
      ['Hold the weight at shoulder height, elbows under wrists', "Тримайте вагу на рівні плечей, лікті під зап'ястями", 'Держите вес на уровне плеч, локти под запястьями'],
      ['Brace your core and glutes', 'Напружте кор і сідниці', 'Напрягите кор и ягодицы'],
      ['Press straight up until your arms are extended', 'Вичавіть вагу вгору до випрямлення рук', 'Выжмите вес вверх до выпрямления рук'],
      ['Lower back to shoulder height under control', 'Підконтрольно опустіть до рівня плечей', 'Подконтрольно опустите до уровня плеч'],
    ],
    mistake: ['Arching the lower back', 'Прогин у попереку', 'Прогиб в пояснице'],
    a: { ...STAND, hand: [112, 60] },
    b: { ...STAND, hand: [106, 20] },
    knee: -1,
    elbow: 1,
    effort: 'b',
    highlight: 'arms',
    prop: 'dumbbell',
    match: /overhead|shoulder press|military|arnold|жим/i,
  },
  {
    key: 'squat',
    name: ['Squat', 'Присідання', 'Приседания'],
    muscles: ['Quads, glutes, core', 'Квадрицепси, сідниці, кор', 'Квадрицепсы, ягодицы, кор'],
    steps: [
      ['Stand with feet shoulder-width apart, toes slightly out', 'Станьте, ноги на ширині плечей, носки трохи назовні', 'Встаньте, ноги на ширине плеч, носки слегка наружу'],
      ['Push your hips back and bend your knees as if sitting on a chair', 'Відведіть таз назад і згинайте коліна, ніби сідаєте на стілець', 'Отведите таз назад и сгибайте колени, будто садитесь на стул'],
      ['Lower until your thighs are parallel to the floor, back straight', 'Опустіться до паралелі стегон із підлогою, спина рівна', 'Опуститесь до параллели бёдер с полом, спина ровная'],
      ['Push through your heels to stand up', "Відштовхніться п'ятами та підніміться", 'Оттолкнитесь пятками и поднимитесь'],
    ],
    mistake: ['Knees caving in or heels lifting off the floor', "Коліна завалюються всередину або п'яти відриваються від підлоги", 'Колени заваливаются внутрь или пятки отрываются от пола'],
    a: { ...STAND, hand: [138, 70] },
    b: { hip: [84, 142], sh: [100, 102], hand: [140, 104], foot: [100, 176] },
    knee: -1,
    elbow: 1,
    effort: 'a',
    highlight: 'legs',
    match: /squat|присід|присед/i, // split squats are sent to the lunge demo in findDemo
  },
  {
    key: 'lunge',
    name: ['Lunge', 'Випади', 'Выпады'],
    muscles: ['Quads, glutes, hamstrings', 'Квадрицепси, сідниці, задня поверхня стегна', 'Квадрицепсы, ягодицы, задняя поверхность бедра'],
    steps: [
      ['Take a big step forward, torso upright', 'Зробіть широкий крок уперед, корпус тримайте рівно', 'Сделайте широкий шаг вперёд, корпус держите ровно'],
      ['Lower until both knees are bent to about 90°', 'Опускайтеся, доки обидва коліна не зігнуться приблизно до 90°', 'Опускайтесь, пока оба колена не согнутся примерно до 90°'],
      ['The back knee hovers just above the floor', 'Заднє коліно зависає трохи над підлогою', 'Заднее колено зависает чуть над полом'],
      ['Push through the front heel to rise, then switch legs', "Відштовхніться п'ятою передньої ноги, підніміться і змініть ногу", 'Оттолкнитесь пяткой передней ноги, поднимитесь и смените ногу'],
    ],
    mistake: ['Front knee collapsing inward or torso leaning forward', 'Переднє коліно завалюється всередину або корпус нахиляється вперед', 'Переднее колено заваливается внутрь или корпус наклоняется вперёд'],
    a: { hip: [100, 114], sh: [100, 70], hand: [106, 112], foot: [126, 176], foot2: [74, 176] },
    b: { hip: [100, 136], sh: [100, 92], hand: [106, 134], foot: [126, 176], foot2: [74, 176] },
    knee: -1,
    elbow: 1,
    effort: 'a',
    highlight: 'legs',
    match: /lunge|split|step[- ]?up|випад|выпад/i,
  },
  {
    key: 'deadlift',
    name: ['Hip hinge / deadlift', 'Нахил із вагою / станова тяга', 'Наклон с весом / становая тяга'],
    muscles: ['Hamstrings, glutes, lower back', 'Задня поверхня стегна, сідниці, розгиначі спини', 'Задняя поверхность бедра, ягодицы, разгибатели спины'],
    steps: [
      ['Stand with feet hip-width apart, weight close to your legs', 'Станьте, стопи на ширині таза, вага близько до ніг', 'Встаньте, стопы на ширине таза, вес близко к ногам'],
      ['Push your hips back with a flat back and soft knees', 'Відводьте таз назад із рівною спиною, коліна трохи зігнуті', 'Отводите таз назад с ровной спиной, колени слегка согнуты'],
      ['Lower the weight along your legs until you feel a stretch in the hamstrings', 'Опускайте вагу вздовж ніг до відчуття розтягнення задньої поверхні стегна', 'Опускайте вес вдоль ног до ощущения растяжения задней поверхности бедра'],
      ['Drive your hips forward to stand tall', 'Подайте таз уперед і випряміться', 'Подайте таз вперёд и выпрямитесь'],
    ],
    mistake: ['Rounding the lower back', 'Округлення попереку', 'Округление поясницы'],
    a: { hip: [80, 118], sh: [120, 100], hand: [120, 144], foot: [100, 176] },
    b: { ...STAND, hand: [104, 108] },
    knee: -1,
    elbow: 1,
    effort: 'b',
    highlight: 'legs',
    prop: 'barbell',
    match: /deadlift|rdl|good morning|hinge|kettlebell swing|станов|мертва|мёртвая|румунськ|румынск|махи гир/i,
  },
  {
    key: 'row',
    name: ['Bent-over row', 'Тяга в нахилі', 'Тяга в наклоне'],
    muscles: ['Lats, rhomboids, rear delts, biceps', 'Найширші, ромбоподібні, задні дельти, біцепси', 'Широчайшие, ромбовидные, задние дельты, бицепсы'],
    steps: [
      ['Hinge at the hips with a flat back, knees slightly bent', 'Нахиліться вперед із рівною спиною, коліна злегка зігнуті', 'Наклонитесь вперёд с ровной спиной, колени слегка согнуты'],
      ['Let the weight hang under your shoulder', 'Вага вільно висить під плечем', 'Вес свободно висит под плечом'],
      ['Pull your elbow back toward your hip, squeezing the shoulder blade', 'Тягніть лікоть назад до пояса, зводячи лопатку', 'Тяните локоть назад к поясу, сводя лопатку'],
      ['Lower the weight slowly', 'Повільно опустіть вагу', 'Медленно опустите вес'],
    ],
    mistake: ['Rounding the back or yanking with the torso', 'Округлення спини або ривки корпусом', 'Округление спины или рывки корпусом'],
    a: { hip: [84, 116], sh: [122, 94], hand: [122, 138], foot: [100, 176] },
    b: { hip: [84, 116], sh: [122, 94], hand: [106, 112], foot: [100, 176] },
    knee: -1,
    elbow: 1,
    effort: 'b',
    highlight: 'arms',
    prop: 'dumbbell',
    match: /\brows?\b|тяга/i,
  },
  {
    key: 'curl',
    name: ['Biceps curl', 'Згинання рук на біцепс', 'Сгибание рук на бицепс'],
    muscles: ['Biceps, forearms', 'Біцепси, передпліччя', 'Бицепсы, предплечья'],
    steps: [
      ['Stand tall, arms down, palms facing forward', 'Станьте рівно, руки опущені, долоні вперед', 'Встаньте ровно, руки опущены, ладони вперёд'],
      ['Keep your elbows pinned to your sides', 'Лікті притиснуті до корпусу', 'Локти прижаты к корпусу'],
      ['Curl the weight up to your shoulders', 'Зігніть руки, піднімаючи вагу до плечей', 'Согните руки, поднимая вес к плечам'],
      ['Lower slowly to full extension', 'Повільно опустіть до повного розгинання', 'Медленно опустите до полного разгибания'],
    ],
    mistake: ['Swinging the torso to lift the weight', 'Розгойдування корпусом', 'Раскачивание корпусом'],
    a: { ...STAND, hand: [104, 108] },
    b: { ...STAND, hand: [110, 68] },
    knee: -1,
    elbow: 1,
    effort: 'b',
    highlight: 'arms',
    prop: 'dumbbell',
    match: /curl|біцепс|бицепс|згинання рук|сгибани[ея] рук/i,
  },
  {
    key: 'plank',
    name: ['Plank', 'Планка', 'Планка'],
    muscles: ['Abs, lower back, shoulders', 'Прес, поперек, плечі', 'Пресс, поясница, плечи'],
    steps: [
      ['Place your forearms on the floor, elbows under shoulders', 'Поставте передпліччя на підлогу, лікті під плечима', 'Поставьте предплечья на пол, локти под плечами'],
      ['Step your feet back; body in a straight line from head to heels', "Відставте ноги назад; тіло — пряма лінія від голови до п'ят", 'Отставьте ноги назад; тело — прямая линия от головы до пяток'],
      ['Brace your abs and glutes, breathe evenly', 'Напружте прес і сідниці, дихайте рівно', 'Напрягите пресс и ягодицы, дышите ровно'],
      ['Hold for the planned time', 'Утримуйте положення запланований час', 'Удерживайте положение запланированное время'],
    ],
    mistake: ['Hips sagging or raised too high', 'Таз провисає або піднятий надто високо', 'Таз провисает или поднят слишком высоко'],
    a: { hip: [85, 160], sh: [128, 150], hand: [150, 173], foot: [19, 176] },
    b: { hip: [85, 158], sh: [128, 149], hand: [150, 173], foot: [19, 176] },
    knee: -1,
    elbow: 1,
    hold: true,
    highlight: 'core',
    scene: 'mat',
    match: /plank|планк|mountain climber|альпініст|скелелаз|скалолаз/i,
  },
  {
    key: 'superman',
    name: ['Superman', 'Супермен', 'Супермен'],
    muscles: ['Lower back, glutes, rear delts', 'Розгиначі спини, сідниці, задні дельти', 'Разгибатели спины, ягодицы, задние дельты'],
    steps: [
      ['Lie face down, arms extended in front', 'Ляжте на живіт, руки витягнуті вперед', 'Лягте на живот, руки вытянуты вперёд'],
      ['Lift your arms, chest and legs off the floor at the same time', 'Одночасно підніміть руки, груди та ноги від підлоги', 'Одновременно поднимите руки, грудь и ноги от пола'],
      ['Hold for 1–2 seconds, looking at the floor', 'Затримайтеся на 1–2 секунди, погляд у підлогу', 'Задержитесь на 1–2 секунды, взгляд в пол'],
      ['Lower smoothly', 'Плавно опустіться', 'Плавно опуститесь'],
    ],
    mistake: ['Throwing the head back or jerking upward', 'Закидання голови або ривок угору', 'Запрокидывание головы или рывок вверх'],
    a: { hip: [96, 171], sh: [140, 171], hand: [184, 171], foot: [28, 171] },
    b: { hip: [96, 171], sh: [138, 157], hand: [180, 143], foot: [30, 157] },
    knee: -1,
    elbow: 1,
    effort: 'b',
    highlight: 'core',
    scene: 'mat',
    match: /superman|супермен|hyperext|гіперекст|гиперэкст|bird[- ]?dog/i,
  },
  {
    key: 'bridge',
    name: ['Glute bridge', 'Сідничний місток', 'Ягодичный мостик'],
    muscles: ['Glutes, hamstrings, core', 'Сідниці, задня поверхня стегна, кор', 'Ягодицы, задняя поверхность бедра, кор'],
    steps: [
      ['Lie on your back, knees bent, feet close to your hips', 'Ляжте на спину, коліна зігнуті, стопи близько до таза', 'Лягте на спину, колени согнуты, стопы близко к тазу'],
      ['Push through your heels and lift your hips', "Відштовхуючись п'ятами, підніміть таз", 'Отталкиваясь пятками, поднимите таз'],
      ['Squeeze your glutes at the top: shoulders, hips and knees in one line', 'Стисніть сідниці у верхній точці: плечі, таз і коліна на одній лінії', 'Сожмите ягодицы в верхней точке: плечи, таз и колени на одной линии'],
      ['Lower slowly', 'Повільно опустіться', 'Медленно опуститесь'],
    ],
    mistake: ['Over-arching the lower back at the top', 'Надмірний прогин у попереку у верхній точці', 'Чрезмерный прогиб в пояснице в верхней точке'],
    a: { hip: [100, 169], sh: [56, 170], hand: [98, 173], foot: [136, 176], head: [42, 168] },
    b: { hip: [93, 147], sh: [56, 170], hand: [98, 173], foot: [136, 176], head: [42, 168] },
    knee: -1,
    elbow: -1,
    effort: 'b',
    highlight: 'legs',
    scene: 'mat',
    match: /bridge|hip thrust|місток|мостик|сідничн|ягодичн/i,
  },
  {
    key: 'legraise',
    name: ['Lying leg raise', 'Підйом ніг лежачи', 'Подъём ног лёжа'],
    muscles: ['Lower abs, hip flexors', 'Нижня частина преса, згиначі стегна', 'Нижняя часть пресса, сгибатели бедра'],
    steps: [
      ['Lie on your back, arms along your body, lower back pressed to the floor', 'Ляжте на спину, руки вздовж тіла, поперек притиснутий до підлоги', 'Лягте на спину, руки вдоль тела, поясница прижата к полу'],
      ['Raise your legs until they point to the ceiling', 'Підніміть ноги до вертикалі', 'Поднимите ноги до вертикали'],
      ['Lower them slowly without touching the floor', 'Повільно опускайте, не торкаючись підлоги', 'Медленно опускайте, не касаясь пола'],
    ],
    mistake: ['Lower back lifting off the floor', 'Поперек відривається від підлоги', 'Поясница отрывается от пола'],
    a: { hip: [94, 170], sh: [50, 170], hand: [90, 174], foot: [162, 166] },
    b: { hip: [94, 170], sh: [50, 170], hand: [90, 174], foot: [100, 102] },
    knee: -1,
    elbow: -1,
    swingLegs: true,
    effort: 'b',
    highlight: 'core',
    scene: 'mat',
    match: /leg raise|knee raise|підйом[^,;]* ніг|підйоми ніг|подъ[её]м[^,;]* ног/i,
  },
  {
    key: 'crunch',
    name: ['Crunch', 'Скручування', 'Скручивания'],
    muscles: ['Abs, obliques', "Прямий і косі м'язи живота", 'Прямая и косые мышцы живота'],
    steps: [
      ['Lie on your back, knees bent, feet on the floor', 'Ляжте на спину, коліна зігнуті, стопи на підлозі', 'Лягте на спину, колени согнуты, стопы на полу'],
      ['Hands at your temples, elbows wide', 'Руки біля скронь, лікті розведені', 'Руки у висков, локти разведены'],
      ['Curl your shoulder blades off the floor using your abs', 'Силою преса відірвіть лопатки від підлоги', 'Силой пресса оторвите лопатки от пола'],
      ['Lower slowly without fully relaxing', 'Повільно опустіться, не розслабляючись повністю', 'Медленно опуститесь, не расслабляясь полностью'],
    ],
    mistake: ['Pulling the head with the hands', 'Тягнути голову руками', 'Тянуть голову руками'],
    a: { hip: [110, 169], sh: [66, 168], hand: [54, 160], foot: [150, 176] },
    b: { hip: [110, 169], sh: [76, 141], hand: [66, 127], foot: [150, 176] },
    knee: -1,
    elbow: 1,
    effort: 'b',
    highlight: 'core',
    scene: 'mat',
    match: /crunch|sit[- ]?up|russian twist|скручув|скручив|на прес|для прес/i,
  },
  {
    key: 'run',
    name: ['Running in place / cardio', 'Біг на місці / кардіо', 'Бег на месте / кардио'],
    muscles: ['Legs, heart and lungs', 'Ноги, серцево-судинна система', 'Ноги, сердечно-сосудистая система'],
    steps: [
      ['Stand tall, core lightly braced', 'Станьте рівно, кор злегка напружений', 'Встаньте ровно, кор слегка напряжён'],
      ['Lift your knees in turn, landing softly on the balls of your feet', "По черзі піднімайте коліна, м'яко приземляючись на передню частину стопи", 'Поочерёдно поднимайте колени, мягко приземляясь на переднюю часть стопы'],
      ['Swing your arms in rhythm, elbows bent', 'Працюйте руками в ритм, лікті зігнуті', 'Работайте руками в ритм, локти согнуты'],
      ['Keep a pace at which you can breathe evenly', 'Тримайте темп, за якого можете рівно дихати', 'Держите темп, при котором можете ровно дышать'],
    ],
    mistake: ['Landing hard on the heels', "Жорстке приземлення на п'яти", 'Жёсткое приземление на пятки'],
    a: { hip: [100, 106], sh: [104, 62], hand: [118, 84], hand2: [90, 98], foot: [112, 140], foot2: [96, 176] },
    b: { hip: [100, 106], sh: [104, 62], hand: [90, 98], hand2: [118, 84], foot: [96, 176], foot2: [112, 140] },
    knee: -1,
    elbow: 1,
    period: 1.1,
    highlight: 'legs',
    match: /\brun|jog|high knees|cardio|treadmill|біг|бег|кардіо|кардио|високі коліна|высокие колени/i,
  },
]

// Names that contain a keyword above but are a different movement: better no demo than a wrong one.
const NO_DEMO =
  /leg curl|hamstring curl|leg extension|calf|upright|згинання ніг|розгинання ніг|сгибани[ея] ног|разгибани[ея] ног|литк|икр|зворотн[^,;]*віджим|обратн[^,;]*отжим/i
const SPLIT_SQUAT = /split squat|болгарськ|болгарск/i

export const DEMO_KEYS = EXERCISE_DEMOS.map((demo) => demo.key)

/**
 * Picks the demo for an exercise. `exact` means the name itself says it is this movement, so the demo's
 * technique notes apply; otherwise the demo is only a similar movement picked by the AI, good for the
 * animation but not for the text.
 */
export function matchDemo(name: string, demoKey?: string): { demo: ExerciseDemo; exact: boolean } | null {
  const byKey = (key: string) => EXERCISE_DEMOS.find((demo) => demo.key === key) || null
  const suggested = demoKey ? byKey(demoKey) : null
  const named = NO_DEMO.test(name || '')
    ? null
    : SPLIT_SQUAT.test(name || '')
    ? byKey('lunge')
    : EXERCISE_DEMOS.find((demo) => demo.match.test(name || '')) || null

  if (named && (!suggested || suggested === named)) return { demo: named, exact: true }
  return suggested ? { demo: suggested, exact: false } : null
}

export const langIndex = (locale: string) => (locale === 'uk' ? 1 : locale === 'ru' ? 2 : 0)
