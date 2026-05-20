---
name: senior-web-design
description: >
  Принципы senior UI-дизайна для написания кода в проекте LMS "Скарбниця".
  Используй ВСЕГДА когда создаёшь или редактируешь UI-компоненты: страницы,
  карточки, модалки, кнопки, бары, виджеты, декорации, пустые состояния.
  Цель — код, который выглядит как продукт уровня Linear/Vercel/Stripe,
  а не как шаблонный Bootstrap.
---

# Senior UI Design — правила для кода

---

## 1. Визуальная иерархия

**Три уровня текста, не больше:**
- Primary: `var(--text-primary)` — заголовки, ключевые значения
- Secondary: `var(--text-secondary)` — подписи, описания
- Muted: `var(--text-muted)` — метаданные, placeholders

**Размеры шрифтов в компонентах:**
- Заголовок карточки/секции: `.78rem`, `font-weight:700`, `text-transform:uppercase`, `letter-spacing:.07em`
- Основной контент: `.82rem–.88rem`, `font-weight:500–600`
- Метаданные/даты/лейблы: `.68rem–.75rem`, `font-weight:500`
- Большие числа/статы: `1.6rem–2rem`, `font-weight:800`

**Правило:** никогда не используй `font-size` меньше `.65rem` и больше `1.1rem` внутри карточек/виджетов.

---

## 2. Цвет — как использовать акцент

Акцентный цвет (`var(--primary)` или роль-специфичный hex) только для:
- Активных состояний, hover border
- CTA-кнопок
- Прогресс-баров
- Accent-линий (top border 3px на карточках)
- Иконок в icon-box

**Приглушённые вариации акцента для фонов:**
```css
background: rgba(ACCENT, 0.08–0.12)  /* icon-box, chip background */
border: rgba(ACCENT, 0.25–0.35)       /* subtle border */
box-shadow: 0 0 0 3px rgba(ACCENT, 0.15) /* focus ring */
```

**Никогда:** не используй акцент как фон больших блоков — только маленькие элементы.

---

## 3. Карточки — анатомия premium

```css
/* Базовая карточка */
background: var(--bg-surface);
border: 1px solid var(--border);
border-radius: var(--radius-xl);
overflow: hidden;

/* Accent top-line (обязательно для виджетов/дашборда) */
position: relative;
&::before {
  content: '';
  position: absolute; top: 0; left: 0; right: 0;
  height: 3px;
  background: ACCENT_COLOR;  /* или gradient */
  z-index: 1;
}

/* Hover-эффект на кликабельных карточках */
transition: transform .15s, box-shadow .15s, border-color .15s;
&:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
  border-color: var(--primary);
}
```

**Заголовок карточки:**
```css
padding: .75rem 1.1rem;
border-bottom: 1px solid var(--border);
background: rgba(99,102,241,.025);  /* едва заметный tint */
display: flex; align-items: center; justify-content: space-between;
```

---

## 4. Кнопки

**Primary CTA:**
```css
background: ACCENT; color: #fff;
border: none; border-radius: var(--radius-md);
padding: .38rem .85rem;
font-size: .78rem; font-weight: 700;
transition: opacity .15s, transform .1s;
&:hover { opacity: .88; transform: translateY(-1px); }
&:active { transform: translateY(0); }
```

**Ghost/Secondary:**
```css
background: var(--bg-raised);
border: 1px solid var(--border);
border-radius: var(--radius-md);
color: var(--text-muted);
&:hover { border-color: ACCENT; color: ACCENT; background: var(--bg-surface); }
```

**Icon button (круглый):**
```css
width: 28–32px; height: 28–32px;
border-radius: 50%;
border: 1px solid var(--border);
background: var(--bg-raised);
display: flex; align-items: center; justify-content: center;
font-size: .65rem;
transition: all .15s;
&:hover { background: rgba(ACCENT,.1); border-color: rgba(ACCENT,.4); color: ACCENT; }
```

---

## 5. Icon-box паттерн

Всегда оборачивай иконки в квадратный контейнер:
```css
width: 32–40px; height: 32–40px;
border-radius: 8–10px;
background: rgba(ACCENT, 0.10–0.14);
color: ACCENT;
display: flex; align-items: center; justify-content: center;
font-size: .85–1rem;
flex-shrink: 0;
```

Никогда не ставь голую FA-иконку рядом с текстом без box — это выглядит дёшево.

---

## 6. Списки и строки (item rows)

**Стандартная строка в виджете:**
```css
display: flex; align-items: center; gap: .6–.75rem;
padding: .55–.65rem .9–1rem;
border-bottom: 1px solid var(--border);
cursor: pointer;
transition: background .12s;
&:hover { background: var(--bg-raised); }
&:last-child { border-bottom: none; }
```

**Разделители между секциями** — всегда `border-bottom`, никогда `margin` между элементами.

---

## 7. Пустые состояния (empty state)

```html
<div style="display:flex;flex-direction:column;align-items:center;
            justify-content:center;padding:2.5rem 1rem;gap:.6rem;
            color:var(--text-muted);text-align:center">
  <!-- иконка в circle bubble -->
  <div style="width:52px;height:52px;border-radius:50%;
              background:var(--bg-raised);display:flex;
              align-items:center;justify-content:center;
              font-size:1.4rem;opacity:.5;margin-bottom:.25rem">
    <i class="fa-..."></i>
  </div>
  <div style="font-size:.88rem;font-weight:700;color:var(--text-primary)">Заголовок</div>
  <div style="font-size:.78rem;max-width:220px;line-height:1.5">Подпись</div>
</div>
```

---

## 8. Badges / Chips

### Status badge (маленький, без hover)
```css
display: inline-flex; align-items: center; gap: .3rem;
padding: .2rem .55rem;
border-radius: 999px;
font-size: .7rem; font-weight: 700; line-height: 1.4;

/* Цвета */
success: background:rgba(16,185,129,.15);  color:#10b981;
danger:  background:rgba(239,68,68,.15);   color:#ef4444;
warn:    background:rgba(245,158,11,.15);  color:#f59e0b;
info:    background:rgba(99,102,241,.15);  color:#6366f1;
```

### Action chip (кликабельный, с hover — например dbw-chip в welcome-баре)
- **Форма:** `border-radius:999px` (pill), padding `.28rem .75rem`
- **Шрифт:** `font-size:.8rem`, `font-weight:700`, `line-height:1`
- **Каждый чип свой цвет** через CSS vars `--cc` (hex) и `--cc-rgb` (r,g,b):
  - Курси: `#6366f1`, Тести: `#f59e0b`, Опитування: `#8b5cf6`
  - Done-стан (count=0): `#10b981` + иконка `fa-check` справа
- **Фон/бордер:** `background:rgba(var(--cc-rgb),.09)` + `border:1px solid rgba(var(--cc-rgb),.28)`
- **Текст:** `color:var(--cc)`
- **Hover:** фон `.16`, бордер `.55`, `box-shadow:0 0 0 3px rgba(var(--cc-rgb),.12)`, `translateY(-1px)`

```js
/* Генерация --cc-rgb из hex */
const _hex2rgb = h => [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)].join(',');
/* style на кнопке */
style="--cc:${col};--cc-rgb:${_hex2rgb(col)}"
```

---

## 9. Анимации — только эти

```css
/* Появление элемента */
@keyframes fade-up {
  from { opacity:0; transform:translateY(8px); }
  to   { opacity:1; transform:translateY(0); }
}
animation: fade-up .25–.35s ease both;

/* Появление с задержкой для списков */
animation-delay: calc(INDEX * 40ms);

/* Easing для всего */
transition: X .15s ease          /* hover-эффекты */
transition: X .25–.35s ease      /* открытие/закрытие */
transition: X .4–.6s ease        /* прогресс-бары */
```

**Никогда:** `linear` для UI-переходов, `ease-in` для появления, задержки больше 60ms на hover.

---

## 10. Тени — иерархия

```css
--shadow-sm: 0 1px 3px rgba(0,0,0,.08), 0 1px 2px rgba(0,0,0,.04);  /* карточки в покое */
--shadow-md: 0 4px 16px rgba(0,0,0,.12), 0 2px 6px rgba(0,0,0,.06); /* hover, floating */
--shadow-lg: 0 8px 32px rgba(0,0,0,.18), 0 4px 12px rgba(0,0,0,.08); /* модалки, дропдауны */

/* Акцентная тень (кнопки, today-circle и т.п.) */
box-shadow: 0 3px 12px rgba(ACCENT, 0.35–0.4);
```

---

## 11. Декоративные элементы (SVG / градиенты)

Когда есть пустое пространство в хедерах, приветственных барах, hero-блоках:

**Паттерн concentric rings:**
- Главная группа: 4–5 колец, radii нарастают, opacity убывает (от центра к краям: 0.30 → 0.08)
- stroke-width нарастает к центру: 1.7 → 0.5
- Вторичный кластер меньшего размера смещён по диагонали
- 5–7 рассеянных точек разного размера (r: 1.4–2.8)
- Glow blob: большой circle + `filter:blur(16–20px)`, fill-opacity 0.08–0.12
- Линейный градиент-смыв: прозрачный слева → акцентный справа (stop-opacity 0 → 0.08–0.12)

**Overflow:** всегда `overflow:hidden` + `position:relative` на контейнере.
**Pointer-events:** всегда `pointer-events:none` на SVG.
**Цвет:** всегда роль-специфичный `accent`, не хардкодить.

---

## 12. Что делает дизайн "дешёвым" — избегать

- Жёсткие `border-radius: 4px` на карточках — использовать `var(--radius-xl)` (12–16px)
- `border: 2px solid` без необходимости — акцентные бордеры только `3–4px` и только слева/сверху
- `color: #000` / `color: #fff` внутри компонентов — только CSS vars
- Одинаковый `font-weight` для всего текста — обязательно контраст 500/700
- Иконки без box-контейнера в строках и карточках
- `margin-bottom` между строками списка вместо `border-bottom`
- Hover только через `background-color` без `border-color` изменения
- Отсутствие `transition` на интерактивных элементах
- `box-shadow: none` на hover-состоянии кликабельных карточек
- Пустые состояния просто как текст без иконки и структуры

---

## 13. Специфика этого проекта

- **Тема:** dark по умолчанию (`var(--bg-base)` тёмный), light опциональна — всегда тестить оба
- **Цветовые переменные:** `--bg-base < --bg-surface < --bg-raised` (тёмный → светлее)
- **Border:** всегда `var(--border)`, никогда хардкод
- **Роль-акценты:** `owner/admin:#2563eb`, `smm:#ec4899`, `teacher:#10b981`, `manager:#f59e0b`, `user:#3b82f6`
- **Скролл внутри виджетов:** `scrollbar-width:thin` + `overflow-y:auto`, высота фиксирована через `height:Xpx`
- **Grid на дашборде:** `grid-template-columns:1fr 1fr 1fr 390px` — последняя колонка всегда календарь
- **Accent top-line на виджетах:** docs=`#ef4444`, notif=`var(--primary)`, news=`#f59e0b`, calendar=`#10b981`
