# Claude Research — результаты по точкам сложности студентов CBT при case formulation

> **Контекст:** этот файл — результат Deep Research, запущенного для проектирования программы по книге Frank & Davidson «The Transdiagnostic Road Map» (slug: `transdiagnostic-cbt`). Промпт DR — в плане `C:\Users\Administrator\.claude\plans\book-to-modes-sorted-shamir.md` (секция «Заготовка промпта для Claude Research»). Дата запуска: 2026-05-19.

---

# Типичные ошибки и трудности начинающих CBT-терапевтов в освоении case formulation: синтез для дизайна обучающего AI-симулятора

## TL;DR

- Эмпирически наиболее устойчивые ошибки начинающих CBT-терапевтов в case formulation — это (а) застревание на описательном уровне без перехода к объяснительному (Eells, Kendjelic & Lucas, 1998, на выборке 56 интейков: только 43% формулировок содержали гипотезу о психологическом механизме), (б) confirmation bias и неспособность переcмотреть гипотезу при противоречащих данных (CCCRS Coding Manual, 2011), (в) разрыв между декларативным и процедурным знанием по DPR-модели Bennett-Levy (2006), и (г) смешение origins/precipitants с maintaining mechanisms (Persons & Tompkins, 2007).
- Конкретная пара «vulnerability vs response» из Frank & Davidson **в основных первичных источниках в этих терминах не обсуждается** — её ближайшие соответствия: «predisposing vs maintaining factors» (Kuyken et al., 2008) и «origins vs precipitants» (Persons & Tompkins, 2007); этот зазор должен быть явно отражён в TDM-глоссарии симулятора.
- Симулятор будет максимально эффективен, если он совмещает: (1) трёхуровневые шаблоны Куйкена (descriptive/cross-sectional/longitudinal), (2) обязательный нарратив-абзац вместо bullet-list, (3) встроенные «исключающие данные» для тренировки гипотезо-тестирования, и (4) рефлексивные циклы по DPR-модели — это эмпирически подтверждено в Kendjelic & Eells (2007), где двухчасовая структурированная тренировка дала результат: «the average clinician in the training group produced a better formulation than 86% of those in the control group».

---

## Key Findings

1. **Стажёры в большинстве своём не доходят от описания к объяснению.** Это эмпирически задокументировано: Eells, Kendjelic & Lucas (1998), анализируя 56 рандомизированно отобранных интейков амбулаторной психиатрической клиники с межоценщатой надёжностью κ = 0.86, обнаружили, что лишь 43% формулировок содержали гипотезу о психологическом механизме, 37% — предрасполагающие факторы, 16% — преципитант. Они заключили: «clinicians used the formulation primarily to summarize descriptive information rather than to integrate it into a hypothesis».
2. **Confirmation bias — центральная процедурная слабость**, операционализированная в CCCRS-шкале (Padesky, Kuyken & Dudley, 2011). На нулевом уровне «Once a model is chosen, there is no test for 'fit'… Spontaneously reported examples of how the model does or does not 'fit' client experience are ignored».
3. **Различение origins/precipitants/mechanisms** — главный практический эквивалент пары vulnerability/response Frank & Davidson; стажёры путают эти уровни и предлагают вмешательства, нацеленные на этиологию, а не на текущее поддержание.
4. **DPR-модель Bennett-Levy (2006)** объясняет, почему стажёр «знает в декларативном смысле» (model of panic), но «не делает в процедурном» (не вытаскивает safety behaviour в реальном времени).
5. **Структурированная тренировка работает**: Kendjelic & Eells (2007) и Haarhoff, Gibson & Flett (2011) показали значительный эффект структурированной тренировки и SP/SR.
6. **Трансдиагностическая трудность** — отказ от disorder-specific шаблона. Барлоу (Unified Protocol) и Harvey et al. (2004) показывают: тренировать мышление на уровне процессов, а не на уровне DSM-категорий.

---

## Details

### Раздел 1. Концептуальные различения, которые даются труднее всего

**1.1. Симптом vs механизм.** Самая глубокая и устойчивая ошибка. Eells, Kendjelic и Lucas (1998), на выборке из 56 интейков случайно отобранных в университетской амбулаторной психиатрической клинике (межоценщательная надёжность κ = 0.86), нашли: «Although 95% of the formulations included descriptive information, only 37% addressed hypothesized predisposing life events… 16% included a precipitating stressor. Only 43% inferred a psychological mechanism, 2% inferred a biological mechanism, and 2% mentioned sociocultural factors… clinicians used the formulation primarily to summarize descriptive information rather than to integrate it into a hypothesis about the causes, precipitants, and maintaining influences» (Eells, Kendjelic, & Lucas, 1998).

Persons и Tompkins: «The heart of the formulation is a description of mechanisms or processes (e.g., schemas) that are causing and maintaining the patient's problems» (Persons & Tompkins, 2007, p. 294). Без понимания различия симптом/механизм формулировка превращается в «list of disparate unrelated facts» (Persons & Tompkins, 2007, p. 295).

Сигнал у стажёра: на вопрос «почему она избегает?» — отвечает повторением симптома («у неё социальная тревога»), а не гипотезой о механизме.

**1.2. Description vs explanation — центральное различение Куйкена/Падески.** Kuyken, Padesky и Dudley (2009; 2008) выстраивают трёхуровневую модель: descriptive → cross-sectional (explanatory) → longitudinal. «While CBT therapists tend to agree on more descriptive levels of conceptualization (e.g. the presenting issues), reliability becomes poor at levels requiring greater inference (e.g. central beliefs, maintenance factors)» (Kuyken, Padesky, & Dudley, 2008, p. 760). И далее: «Initial conceptualizations are typically quite descriptive… Following initial descriptions of presenting issues, case conceptualizations become more explanatory, identifying triggers and maintenance factors… In middle and later stages of CBT, conceptualization uses higher levels of inference to explain how predisposing and protective factors contribute» (Kuyken et al., 2008, pp. 761–763; в книге 2009 г. — pp. 29–44).

Стажёрская ошибка: либо застрять на descriptive (5-part diagram как конечная цель), либо перескочить descriptive и сразу выдать гипотезу о схемах детства. Eells (2010, p. 237) описывает «ordinary formulations»: «more general and vague, and to offer inferences without having established a solid foundation in the case material… they leapt past that material and proceeded to a treatment plan».

**1.3. Hypothesis vs observation.** Persons: «empirical hypothesis-testing approach to clinical work with three key elements: assessment, formulation, and intervention» (Persons & Tompkins, 2007, p. 291). Формулировка — это гипотеза, не утверждение факта. CCCRS уровень «0»: «Once a model is chosen, there is no test for 'fit.' Therapist does not use the conceptualization to make predictions or test hypotheses within or between sessions. Spontaneously reported examples of how the model does or does not 'fit' client experience are ignored» (CCCRS Coding Manual, 2011, p. 18).

**1.4. DSM-диагноз vs функциональная формулировка.** Persons: «instead of simply placing social phobia on the Problem List, John's therapist listed some of the key behavioral, cognitive, emotional, and somatic aspects of John's social anxiety» (Persons & Tompkins, 2007, p. 300). Диагноз — это anchoring diagnosis для выбора номотетической модели, но не формулировка.

**1.5. Уровни когниции (АТ vs убеждения vs схемы vs метакогниции).** В первоисточниках это различение не выделено как отдельная тема ошибок. Близкое — «overinference»: стажёры заявляют о схеме там, где данных хватает только на горячую мысль. В источниках речь идёт об «уровне инференции», а не «уровне когниции».

**1.6. Vulnerability vs response (Frank & Davidson) — честный gap-маркер.** Пара «vulnerability vs response» в основных источниках (Kuyken, Persons, Eells, Bennett-Levy, Roth & Pilling) в этих терминах не обсуждается. Близкие различения:
- «predisposing factors vs maintaining factors» (Kuyken et al., 2008, p. 763);
- «origins of the mechanisms vs precipitants of the current problems» (Persons & Tompkins, 2007, pp. 294–295);
- «distal causal factors vs proximal causal factors» (там же).

Persons прямо: «'Origins' part of the formulation describes how John learned the schemas that cause his problems… (in contrast to mechanisms, which can be seen as proximal or immediate causal factors)» (Persons & Tompkins, 2007, pp. 294–295). Типичная ошибка стажёра — путать «потому что у неё абьюзивный отец в детстве» (origin) с «потому что она проверяет реакции собеседника» (maintaining mechanism), и предлагать вмешательство на уровень origin (бесполезное для текущего поддержания).

**1.7. Maintaining vs etiological mechanisms.** Связано с 1.6. В трансдиагностической литературе (Harvey, Watkins, Mansell & Shafran, 2004) акцент именно на maintaining processes — поскольку именно они мишень лечения. Стажёр формулирует прошлое и не доходит до того, что прямо сейчас поддерживает проблему.

### Раздел 2. Категории механизмов, наиболее трудные для распознавания

В литературе **нет прямого ранжирования** «список 1–6». Это надо честно отметить. Ниже — рабочая иерархия, выведенная из косвенных эмпирических указателей:

1. **Когнитивные** (АТ, убеждения) — лучше всего распознаются (базовая модель 5-part Гринбергер–Падески).
2. **Поведенческие явные** (избегание, ритуалы) — распознаются хорошо.
3. **Поведенческие тонкие — safety behaviors, subtle avoidance** — распознаются плохо. Salkovskis (1991), Rachman, Radomsky & Shafran (2008): «we are still in an early stage in our understanding of their role in maintaining anxiety… clinicians should devote time and attention to understanding the idiosyncratic function of patient behaviours in order to discriminate between helpful coping strategies and safety behaviours» (Thwaites & Freeston, 2005).
4. **Эмоциональные механизмы — emotion regulation, experiential avoidance** — центр Unified Protocol Барлоу. В стандартной когнитивной модели часто тонут под когнитивными переменными. Барлоу: «aversive, avoidant reactions to emotions that, while providing relief in the short term, increase the likelihood of future negative emotions» (Barlow et al., 2017).
5. **Интерперсональные паттерны** — слепая зона. Bennett-Levy и Thwaites (2007, *Behavioural and Cognitive Psychotherapy* 35:591–612) выделили четыре именованных элемента интерперсональных навыков: (1) **interpersonal perceptual skills** (empathic attunement), (2) **therapist attitude/stance**, (3) **interpersonal relational skills**, (4) **interpersonal knowledge / empathy knowledge** — поскольку «interpersonal perceptual skills are some of the most important skills… [they] are some of the least researched, acknowledged or understood» (Bennett-Levy, 2006).
6. **Метакогнитивные убеждения** (Wells; Harvey et al., 2004). Стажёры путают AT («я тупой») с метакогнитивным убеждением («я обязан контролировать свои мысли, иначе сойду с ума»).
7. **Нейрофизиологические механизмы** (сон, исполнительные функции) — наименее распознаются. Harvey et al. (2004) включают «sleep» в трансдиагностические процессы, но в обычной подготовке этому мало времени.

**Caveat:** строгого эмпирического ранжирования не существует.

### Раздел 3. Ошибки при сборке рабочей гипотезы

**3.1. Descriptive vs explanatory formulations.** CCCRS Item 9 rating 1 описывает типичный стажёрский профиль: «Therapist attempts to personalize a model, but does not fully incorporate person specific information… few attempts to make predictions based on the model… some mismatches may be noted, other discrepant client experiences are missed, explained away or discounted» (CCCRS Coding Manual, 2011, p. 19).

**3.2. Linear vs interactive models.** Persons: «Often causal arrows go in more than one direction» (Persons & Tompkins, 2007, p. 302). Стажёры строят линейные цепочки А→Б→В, тогда как реальная формулировка содержит петли обратной связи. Метафора «conceptualization crucible» у Kuyken et al. (2008) — образ взаимодействия элементов, а не линейности.

**3.3. «Список механизмов» vs связное повествование.** Eells (2010): «The PD and CB formulations rated highest in quality differed from those at the 25th percentile primarily in being more comprehensive, in following a systematic process, and in being more coherent» (Eells, 2010, p. 228). Persons: «One purpose of a formulation is to tie together the elements of a case (origins, mechanisms, precipitants, problems) into a coherent narrative so they can be understood as a whole rather than as a list of disparate unrelated facts» (Persons & Tompkins, 2007, p. 295).

**3.4. Confirmation bias vs hypothesis-testing.** CCCRS уровень 3: «Therapist openly tests the conceptualization by seeking counter examples or exceptions to the rule. Therapist is alert to notice when client experience is consistent or inconsistent with the conceptualization» (CCCRS Coding Manual, 2011, p. 19). И на выдающемся уровне: «If this process is done particularly proficiently the therapist spends equal time on examples that do and do not fit the conceptualization… Discrepancies are not viewed as a threat to the therapist's status… but rather as useful information». Kuyken et al. (2008, pp. 763–764): «When conceptualization is collaborative, clients are more likely to provide checks and balances to therapist reasoning errors».

**3.5. Декларативное vs процедурное знание (Bennett-Levy).** Bennett-Levy (2006): три системы — declarative, procedural, reflective. «Declarative knowledge is inert factual knowledge ('knowing that') such as knowing the CBT model of panic. Procedural skills are the rules and guidance which lead directly to the implementation of skills ('when to' and 'how to')» (Bennett-Levy, 2006). Импликация: симулятор должен тренировать procedural — не «знаешь ли ты, что такое safety behaviour», а **в какой момент диалога ты задашь вопрос, который её выявит**.

### Раздел 4. Трансдиагностические специфические трудности

**4.1. Protocol-thinking блокирует mechanism-thinking.** Harvey, Watkins, Mansell & Shafran (2004): внимание, память, рассуждение, мысли, поведение имеют трансдиагностические инварианты. Стажёр, обученный OCD-протоколу, видя руминации, идёт в OCD-протокол, даже если механизм — «repetitive negative thinking» (Ehring & Watkins, 2008), общий для депрессии, ГАД, ПТСР.

Барлоу — в интервью Rachel Allman, опубликованном 7 ноября 2023 г. в Psychology Tools («Dr David H. Barlow And The Unified Protocol»): «So, the development of the Unified Protocol for The Transdiagnostic Treatment of Emotional Disorders is to take all those decision points and essentially make them unnecessary for the clinician. Instead, you can just say: 'Okay, you've got a variety of difficulties with anxiety and depression. Let's see if we can kind of get to the bottom of it and solve these problems'».

**4.2. Как стажёров учат переходить от disorder-specific к transdiagnostic.** В UP-обучении используется Unified Protocol Case Conceptualization Worksheet, рациональ обсуждается через язык «эмоциональных расстройств» вместо отдельных диагнозов (Barlow et al., UP Therapist Guide). Persons предлагает другой путь: «select an 'anchoring diagnosis'… select a nomothetic formulation… individualize the template» (Persons & Tompkins, 2007, p. 297).

**4.3. Общее между Frank & Davidson и Барлоу.** Оба отказываются от disorder-specific логики. Общая трудность стажёра: отказ от удобного протокольного шаблона требует мышления на уровне процессов. Mansell et al. (2008): «transdiagnostic processes responsible for maintaining symptoms… shared across psychological disorders».

### Раздел 5. Успешные педагогические стратегии

**5.1. Self-Practice/Self-Reflection (SP/SR).** Haarhoff, Gibson & Flett (2011, *Behavioural and Cognitive Psychotherapy* 39(3):323–339): «Sixteen recent graduates of a postgraduate diploma in cognitive behaviour therapy» (Massey University, Новая Зеландия) проработали SP/SR-воркбук независимо. «The participants' self-reflections were thematically analyzed and uncovered the following inter-related themes: increased theoretical understanding of the CBT model, self-awareness, empathy, conceptualization of the therapeutic relationship, and adaptation of clinical interventions and practice… targeted self-practice/self-reflection enhanced case conceptualization skill by consolidating the Declarative, Procedural and Reflective systems».

**5.2. DPR-модель Bennett-Levy (2006).** «Building on Binder's earlier declarative-procedural model, the present model introduces a third information processing system, the reflective system, which gives dynamism to the process of learning, and in particular explains how therapists gain additional skills and expertise, once they have learned basic concepts and techniques» (Bennett-Levy, 2006). Импликация: рефлексивная петля обязательна после каждого упражнения.

**5.3. Case-based learning с обратной связью.** Kendjelic & Eells (2007, *Psychotherapy* 44(1):66–77) сравнили 20 клиницистов, прошедших двухчасовой структурированный тренинг по формулировке, с 23 необученными контрольными в университетской амбулаторной психиатрической клинике: «Clinicians in the training group produced formulations rated as higher in overall quality and as more elaborated, comprehensive, complex, and precise. These formulations were also more likely to address precipitants, predisposing factors, and an inferred mechanism… Effect sizes indicated that the average clinician in the training group produced a better formulation than 86% of those in the control group». Это ключевой эмпирический аргумент за симулятор.

**5.4. Concept mapping в супервизии.** Liese & Esterline (2015): «Concept mapping facilitates case conceptualization skills through… methodically creating graphic representations of clients' problems and dynamic relationships between these problems… a highly structured and practical 4-stage approach to supervision that effectively introduces case formulation skills to novice therapists».

**5.5. Roth & Pilling (2007) — компетенции и метакомпетенции.** Пять CBT-специфических метакомпетенций (Roth & Pilling, 2007, Figure 2, p. 12): «(1) capacity to implement CBT in a manner consonant with its underlying philosophy; (2) capacity to formulate and to apply CBT models to the individual client; (3) capacity to select and apply most appropriate BT & CBT method; (4) capacity to structure sessions and maintain appropriate pacing; (5) capacity to manage obstacles to CBT therapy». И описание формулировки-компетенции: «Closely linked to this facility is the capacity to derive a formulation which accounts for the development and maintenance of the client's problems and which helps to create a framework for the application of specific therapy techniques» (Roth & Pilling, 2007, p. 17).

**5.6. Milne и BABCP-руководства по супервизии.** Milne & Reiser (2017) — manual supervisor с шестью эвиденс-бэйз гайдлайнами. Опросник SAGE — инструмент оценки. Ключевой вывод: для развития навыков формулировки нужны experiential methods (rehearsal, role-play), не только дискуссия.

### Раздел 6. Синтез для дизайна симулятора (РАСШИРЕННЫЙ)

Ниже — **семь точек приоритета**, каждая с описанием ошибки, источниками, идеей модуля и набросками виньеток/реплик клиента/типов ошибок в экзамене.

#### Приоритет 1. Стажёр не доходит от описания к объяснению (descriptive → explanatory)
**Источник:** Kuyken, Padesky & Dudley (2008, pp. 760, 761–763; книга 2009, pp. 29–44); Eells, Kendjelic & Lucas (1998) — на выборке 56 интейков лишь 43% инферировали психологический механизм.

**Ошибка:** Стажёр составляет хорошее описание (5-part модель), но не предлагает гипотезы, **почему** именно эти мысли активируются у этого клиента в этих ситуациях.

**Идея модуля:** В режиме «Свой случай» и «Мастерская сборки гипотезы» — шаблон с обязательной парой полей: «Описание (что происходит)» и **«Объяснение (почему именно так)»**. AI отказывается принимать формулировку без объяснительного блока.

**Виньетка для экзамена:**
> «Анна, 28 лет. Жалуется на тревогу перед публичными выступлениями. На работе уже трижды отказалась от презентаций. Перед потенциальным выступлением просыпается в 4 утра, проигрывает в голове "сейчас все увидят, что я тупая". Чувствует жар, потливость рук. В день презентации звонит и говорит "заболела". Иногда выпивает бокал вина перед звонком руководителю.»

**Реплики клиента для ролевой игры:**
- «Я не знаю, почему именно сейчас, это всегда было.»
- «Кажется, что все замечают, когда я волнуюсь.»
- «На прошлой неделе я нормально провела встречу 1-на-1, но не понимаю почему — может, потому что начальницы не было.»

**Тип ошибки стажёра:** Принять «Анна тревожится в социальных ситуациях, избегает их, использует алкоголь» как готовую формулировку. AI: «Это описание. А что **поддерживает** тревогу? Что Анна делает в момент презентации, что мешает ей убедиться, что она справляется?»

**Экзаменационный вариант ошибки** — выбрать explanatory:
- (A) «У Анны социофобия с избеганием.» — descriptive, неверно
- (B) «Анна избегает выступлений из-за тревоги.» — циркулярно, неверно
- (C) «Анна интерпретирует физические сигналы (потливость, жар) как „все видят мою некомпетентность“ → смещает внимание на самонаблюдение → усиливает физ. симптомы → отказывается от выступления → не получает опровержения; алкоголь — safety behaviour, мешающий новому научению.» — **explanatory, верно**
- (D) «У Анны было трудное детство.» — etiology без объяснения поддержания

#### Приоритет 2. Confirmation bias — стажёр подгоняет данные под гипотезу
**Источник:** CCCRS Coding Manual (2011, pp. 18–19); Kuyken et al. (2008, pp. 763–764).

**Ошибка:** Выбрав модель «социальная тревога с убеждением „я неадекватна“», стажёр игнорирует, что клиентка свободно общается в одном контексте, или интерпретирует это как «там у неё safety behaviour, поэтому исключение подтверждает правило».

**Идея модуля:** В «Симуляции клиента» клиент **систематически выдаёт data inconsistent with the current hypothesis**. AI-супервизор отслеживает, заметил ли стажёр исключения и встроил ли их в пересмотр гипотезы.

**Реплики клиента-исключения:**
- «А вот с тренером по йоге я могу болтать сколько угодно, и не волнуюсь.»
- «Когда я выпью, мне всё равно, что про меня думают — но мне не нравится себя такой.»
- «На сцене в любительском театре мне нормально — там роль, как будто не я.»

**Тип ошибки в экзамене:** Виньетка с тремя противоречащими фактами; варианты:
- (A) Игнорировать исключения — **неверно**
- (B) Объяснить исключения как варианты безопасного поведения без проверки — частично
- (C) **Сформулировать новую гипотезу:** «Возможно, ключевой механизм — не „общая социальная некомпетентность“, а специфический сценарий „меня будут оценивать как профессионала“. Спросить клиентку про субъективное различие контекстов» — **верно**
- (D) Перейти к behavioural experiment без пересмотра гипотезы

#### Приоритет 3. Линейная vs интерактивная модель
**Источник:** Persons & Tompkins (2007, p. 302); Kuyken et al. (2008, метафора «crucible»).

**Ошибка:** Стажёр рисует A→B→C, не замечает обратных связей.

**Идея модуля:** Графический редактор формулировки **требует минимум одной петли обратной связи**. AI подсвечивает связи без обратной стрелки и спрашивает: «Может ли C влиять на A?»

**Виньетка:** Игорь, 32, депрессия, после потери работы спит до 14:00, не выходит из дома, избегает старых друзей; убеждение «я никчёмный».
- Линейная (ошибочная): потеря работы → убеждение → депрессия → избегание.
- Интерактивная (верная): потеря работы активирует «я никчёмный» → снижение активности → отсутствие подкреплений → усиление «я ни на что не способен» → ещё большее избегание → разрыв соцконтактов → подтверждение «я никому не нужен». Плюс соматическая петля: сон 14 ч → утомление → меньше энергии → меньше активности.

#### Приоритет 4. Safety behaviours и тонкое избегание — слепая зона
**Источник:** Salkovskis (1991); Rachman, Radomsky & Shafran (2008); Roth & Pilling (2007) — «knowledge of the role of safety-seeking behaviours».

**Ошибка:** Стажёр видит явное избегание, пропускает: дыхательные техники, «безопасный предмет», ментальные ритуалы, проверки, in-situation чтение тела.

**Идея модуля:** Симуляция с тонкими safety behaviours, которые клиент сам не идентифицирует как проблему.

**Реплики клиента (тонкие safety behaviours для распознавания):**
- «Я всегда сажусь у выхода — на всякий случай.»
- «Я ношу с собой бутылочку воды, чтобы если что — попить.»
- «Мне нужно посмотреть в зеркало перед выходом, проверить, что лицо не красное.»
- «Я повторяю в голове, что я скажу, перед каждой репликой.»
- «Я выпиваю четверть таблетки клоназепама перед собранием — я знаю, дозировка не лечебная, но мне так спокойнее.»

**Тип ошибки в экзамене:** Из транскрипта первой консультации **выделить шесть конкретных safety behaviours**. Стандартная ошибка — пометить 2–3 явных (избегание метро, презентаций) и пропустить тонкие.

#### Приоритет 5. Этиология vs поддержание — «лечить прошлое» вместо «лечить настоящее»
**Источник:** Persons & Tompkins (2007, pp. 294–295); Harvey et al. (2004); **прямой gap-маркер для пары vulnerability/response Frank & Davidson**.

**Ошибка:** Имея «материал детства», стажёр строит формулировку как «потому что у клиентки был холодный отец». На вопрос «что вы будете делать?» — «работать со схемами». Без механизмов поддержания лечение зависает на «исследованиях прошлого».

**Идея модуля:** В «Мастерской сборки» обязательная двухколоночная форма: «Vulnerability/origins (что сделало её уязвимой)» **vs** «Response/maintaining factors (что прямо сейчас удерживает проблему)». AI не принимает формулировку, если правая колонка пустая или дублирует левую.

**Виньетка:** Марина, 35, обратилась с социальной тревогой. В анамнезе — критикующая мать, развод родителей в 12 лет, буллинг в подростковом возрасте.
- Левая (vulnerability): критикующая мать → схема «я недостаточно хороша»; буллинг → схема «другие враждебны».
- Правая (maintaining): на работе — гиперподготовка к каждому письму (3 редакции), интерпретация молчания коллег как «они осуждают», избегание спонтанных разговоров, после соцконтакта — руминация «как я выглядела» 1–2 часа.

**Ошибка в экзамене:** Стажёр предлагает «работу со схемами раннего возраста» как первое вмешательство. Верный ответ: сначала поведенческие эксперименты по подрыву сегодняшних поддерживающих факторов.

#### Приоритет 6. Symptom-list vs coherent narrative
**Источник:** Eells (2010, pp. 228, 237); Persons & Tompkins (2007, p. 295).

**Ошибка:** Формулировка как набор маркеров, без причинно-следственного текста.

**Идея модуля:** В экзамене стажёр **пишет формулировку абзацем на 150–250 слов**, связывающим origins → mechanisms → precipitants → problems. AI оценивает coherence (есть ли связки «поскольку…», «что приводит к…», «активируется когда…»).

**Эталонный абзац (для тренировки):**
> «На фоне взросления в семье, где мать систематически критиковала любые проявления уязвимости (origin), у Марины сформировались убеждения „я должна быть идеальной, чтобы меня приняли“ и „проявить слабость = быть отвергнутой“ (mechanism — beliefs). После переезда в новый город и смены работы (precipitant) эти убеждения активировались: Марина начала готовить каждое письмо коллегам по 3 раза, репетировать small talk перед чаепитием, избегать спонтанных встреч (mechanism — safety behaviours). Это поддерживает её тревогу через два пути: (а) она не получает опыта „я могу импровизировать и быть принятой“; (б) гиперподготовка создаёт чувство, что без неё она бы „провалилась“, усиливая „я не справлюсь без идеальной подготовки“. Результат — нарастающая социальная изоляция (problem) и эпизоды плача по вечерам (problem).»

**Ошибка экзамена:** Из четырёх формулировок — выбрать ту, где есть нарратив с явными причинными связями, не bullet-list.

#### Приоритет 7. Декларативное vs процедурное — стажёр «знает», но не «делает»
**Источник:** Bennett-Levy (2006); Haarhoff, Gibson & Flett (2011, на выборке 16 выпускников программы Massey University).

**Ошибка:** На экзамене стажёр корректно определяет safety behaviour, но в ролевой игре — пропускает её, не задаёт ключевой вопрос вовремя, не интегрирует новую информацию «в реальном времени».

**Идея модуля:** Центральный аргумент для модуля «Симуляция клиента» с обязательной **post-session reflection** по DPR-структуре:
- Declarative: «Что я знал теоретически?»
- Procedural: «Что я сделал? Какие вопросы задал? Какие пропустил?»
- Reflective: «Что меня удивило? Что не совпало с ожиданиями? Что сделаю иначе?»

**Сцена для симуляции:**
- Клиент: «У меня была паника в метро на прошлой неделе.»
- Декларативно стажёр знает: panic-cycle Кларка.
- Процедурный экзамен: какой следующий вопрос?
  - (A) «А раньше у вас были такие?» — история, не текущий механизм
  - (B) «Что вы подумали в момент, когда стало плохо?» — **верно** (mechanism)
  - (C) «Вы записывались уже куда-то на консультацию?» — нерелевантно
  - (D) «Расскажите про ваше детство.» — неверная иерархия
  - (E) «Что вы сделали, чтобы успокоиться?» — **верно** (safety behaviour)

**Reflective prompt после сессии:** «Заметили ли вы, что клиент упомянул „я держался за поручень так, что побелели костяшки“? Это была safety behaviour. Что бы вы спросили ещё, чтобы её раскрыть?»

---

## Recommendations

**Стадия 1 (MVP симулятора):**
1. Реализовать **двухколоночный шаблон формулировки** (vulnerability/origins vs response/maintaining) с обязательным заполнением правой колонки и валидатором против дублирования.
2. Встроить **обязательный нарративный абзац** на 150–250 слов как финальный артефакт в режиме «Свой случай» и «Мастерская сборки гипотезы»; AI оценивает наличие причинных связок.
3. Базовая библиотека из 10–15 виньеток, в каждой — встроенные данные-исключения для тренировки гипотезо-тестирования.

**Стадия 2 (компетентностный уровень):**
4. Модуль «Симуляция клиента» с обязательной **post-session reflection** по DPR-схеме (Declarative / Procedural / Reflective вопросы).
5. Экзаменационный режим с типизированными «ловушками»: descriptive-вместо-explanatory, циркулярная формулировка, propose-treatment-without-formulation, etiology-without-maintenance.
6. TDM-глоссарий с **явной кросс-таблицей** Frank & Davidson ↔ Kuyken (predisposing/maintaining) ↔ Persons (origins/mechanisms/precipitants).

**Стадия 3 (трансдиагностическая зрелость):**
7. Виньетки с коморбидностью, где стажёр должен выбрать между protocol-thinking и process-thinking; интеграция UP Worksheet Барлоу.
8. Тонкие safety behaviours и эмоциональное избегание в каждом «продвинутом» случае — это слепые зоны новичков по литературе.

**Пороги, при которых рекомендации меняются:**
- Если пилотные данные покажут, что **более 60% стажёров доходят до explanatory уровня** в режиме «Свой случай» — сместить фокус на confirmation bias и интерактивные модели (приоритеты 2, 3).
- Если **более 60% застревают на descriptive** — усилить scaffolding Куйкена и шаблоны Persons (приоритет 1).
- Если в симуляции клиента **более 50% стажёров пропускают тонкие safety behaviours** — увеличить плотность таких реплик и сделать их экзаменационным ядром (приоритет 4).
- Если post-session reflection даёт реплики типа «всё нормально, я бы сделал так же» у >40% стажёров — внедрить принудительные структурированные DPR-промпты (приоритет 7).

---

## Caveats

1. **Книга Kuyken/Padesky/Dudley 2009 г.** не доступна постранично онлайн; верифицировано через статью 2008 г. тех же авторов и CCCRS Coding Manual 2011 г. с прямыми ссылками на страницы книги (levels — pp. 29–44; empiricism — pp. 44–51, 68–83; strengths — pp. 93–120).
2. **Пара vulnerability/response Frank & Davidson** в первичных источниках в этих терминах не обсуждается; соответствует predisposing/maintaining у Kuyken, origins/precipitants у Persons. Это **ключевой gap**, который нужно отразить в глоссарии симулятора, чтобы избежать терминологической путаницы.
3. **Ранжирование механизмов по сложности распознавания** (раздел 2) — рабочее, выведено из суммы источников, прямой эмпирической базы нет.
4. **Eells et al. (2005)** — полный текст за paywall; цитаты приведены из abstract и реанализа Eells (2010).
5. **Контекст:** большинство исследований — UK NHS/IAPT, USA (Eells, Persons), Новая Зеландия (Haarhoff); перенос на русскоязычный контекст требует валидизации, но базовые когнитивные ошибки в формулировке универсальны.
6. **Конкурирующий взгляд:** Kuyken et al. (2008, p. 760) сами фиксируют: «strong evidence that conceptualization enhances CBT outcomes is strikingly absent» — то есть весь предмет тренинга держится на профессиональном консенсусе и косвенных доказательствах (как Kendjelic & Eells, 2007), а не на строгих RCT с пациентскими исходами.
7. **Bennett-Levy DPR-модель** имеет высокую цитируемость и широкое применение, но является **теоретической рамкой**, не прошедшей RCT-валидацию против альтернативных моделей развития терапевта.

---

## Библиография

- Barlow, D. H., Farchione, T. J., Sauer-Zavala, S., et al. (2017). *Unified Protocol for Transdiagnostic Treatment of Emotional Disorders: Therapist Guide* (2nd ed.). New York: Oxford University Press.
- Bennett-Levy, J. (2006). Therapist skills: A cognitive model of their acquisition and refinement. *Behavioural and Cognitive Psychotherapy*, 34(1), 57–78.
- Bennett-Levy, J., & Thwaites, R. (2007). Conceptualizing empathy in cognitive behaviour therapy: Making the implicit explicit. *Behavioural and Cognitive Psychotherapy*, 35, 591–612.
- Bennett-Levy, J., Thwaites, R., Chaddock, A., & Davis, M. (2009). Reflective practice in cognitive behavioural therapy. In J. Stedmon & R. Dallos (Eds.), *Reflective Practice in Psychotherapy and Counselling* (pp. 115–135). Maidenhead: Open University Press.
- Eells, T. D. (Ed.). (2022). *Handbook of Psychotherapy Case Formulation* (3rd ed.). New York: Guilford Press.
- Eells, T. D., Kendjelic, E. M., & Lucas, C. P. (1998). What's in a case formulation? Development and use of a content coding manual. *Journal of Psychotherapy Practice and Research*, 7(2), 144–153.
- Eells, T. D., Lombart, K. G., Kendjelic, E. M., Turner, L. C., & Lucas, C. P. (2005). The quality of psychotherapy case formulations: A comparison of expert, experienced, and novice cognitive-behavioral and psychodynamic therapists. *Journal of Consulting and Clinical Psychology*, 73(4), 579–589.
- Eells, T. D. (2010). The unfolding case formulation: The interplay of description and inference. *Pragmatic Case Studies in Psychotherapy*, 6(4), 225–254.
- Eells, T. D., Lombart, K. G., Salsman, N., Kendjelic, E. M., Schneiderman, C. T., & Lucas, C. P. (2011). Expert reasoning in psychotherapy case formulation. *Psychotherapy Research*, 21(4), 385–399.
- Haarhoff, B., Gibson, K., & Flett, R. (2011). Improving the quality of cognitive behaviour therapy case conceptualization: The role of self-practice/self-reflection. *Behavioural and Cognitive Psychotherapy*, 39(3), 323–339.
- Harvey, A., Watkins, E., Mansell, W., & Shafran, R. (2004). *Cognitive Behavioural Processes Across Psychological Disorders: A Transdiagnostic Approach to Research and Treatment*. Oxford: Oxford University Press.
- Kendjelic, E. M., & Eells, T. D. (2007). Generic psychotherapy case formulation training improves formulation quality. *Psychotherapy: Theory, Research, Practice, Training*, 44(1), 66–77.
- Kuyken, W., Fothergill, C. D., Musa, M., & Chadwick, P. (2005). The reliability and quality of cognitive case formulation. *Behaviour Research and Therapy*, 43(9), 1187–1201.
- Kuyken, W., Padesky, C. A., & Dudley, R. (2008). The science and practice of case conceptualization. *Behavioural and Cognitive Psychotherapy*, 36(6), 757–768.
- Kuyken, W., Padesky, C. A., & Dudley, R. (2009). *Collaborative Case Conceptualization: Working Effectively with Clients in Cognitive-Behavioral Therapy*. New York: Guilford Press.
- Liese, B. S., & Esterline, K. M. (2015). Concept mapping: A supervision strategy for introducing case conceptualization skills to novice therapists. *Psychotherapy*, 52(2), 190–194.
- Mansell, W., Harvey, A., Watkins, E., & Shafran, R. (2008). Cognitive behavioral processes across psychological disorders: A review of the utility and validity of the transdiagnostic approach. *International Journal of Cognitive Therapy*, 1(3), 181–192.
- Milne, D. L., & Reiser, R. P. (2017). *A Manual for Evidence-Based CBT Supervision*. Chichester: Wiley-Blackwell.
- Padesky, C. A., Kuyken, W., & Dudley, R. (2011). *Collaborative Case Conceptualization Rating Scale and Coding Manual* (v5). New York: Guilford Press.
- Persons, J. B. (2008). *The Case Formulation Approach to Cognitive-Behavior Therapy*. New York: Guilford Press.
- Persons, J. B., & Tompkins, M. A. (2007). Cognitive-behavioral case formulation. In T. D. Eells (Ed.), *Handbook of Psychotherapy Case Formulation* (2nd ed., pp. 290–316). New York: Guilford Press.
- Rachman, S., Radomsky, A. S., & Shafran, R. (2008). Safety behaviour: A reconsideration. *Behaviour Research and Therapy*, 46(2), 163–173.
- Roth, A. D., & Pilling, S. (2007). *The Competences Required to Deliver Effective Cognitive and Behavioural Therapy for People with Depression and with Anxiety Disorders*. London: Department of Health.
- Roth, A. D., & Pilling, S. (2008). Using an evidence-based methodology to identify the competences required to deliver effective cognitive and behavioural therapy for depression and anxiety disorders. *Behavioural and Cognitive Psychotherapy*, 36(2), 129–147.
- Salkovskis, P. M. (1991). The importance of behaviour in the maintenance of anxiety and panic: A cognitive account. *Behavioural Psychotherapy*, 19(1), 6–19.
- Thwaites, R., & Freeston, M. H. (2005). Safety-seeking behaviours: Fact or function? *Behavioural and Cognitive Psychotherapy*, 33(2), 177–188.
