/**
 * Скарбниця LMS — PDF-презентация из папки present-img
 * Запуск: node scripts/make-pdf.js
 */

const fs   = require('fs');
const path = require('path');

const IMG_DIR  = path.join(__dirname, '../present-img');
const OUT_HTML = path.join(__dirname, '../presentation.html');
const OUT_PDF  = path.join(__dirname, '../presentation.pdf');

// ── Разделы: номер → название + описание
const SECTIONS = {
    1: {
        title: 'Головна сторінка',
        sub:   'Дашборд — центральний екран платформи',
        points: [
            'Привітання користувача з незавершеним курсом та прогресом',
            'Банер днів народжень колег з кнопкою привітання',
            'Блок важливих подій дня з часом та пріоритетом',
            'Документи — швидкий доступ до актуальних реєстрів',
            'Сповіщення — всі непрочитані повідомлення в одному місці',
            'Новини компанії з фото та датою публікації',
            'Особистий календар з подіями на поточний місяць',
        ],
    },
    2: {
        title: 'Skill Up — Навчання',
        sub:   'Персональний навчальний маршрут співробітника',
        points: [
            'Всі доступні курси в одному місці з прогресом проходження',
            'Фільтри: всі курси / записані / завершені',
            'Відсоток виконання та кнопка продовження курсу',
            'Відкриття курсу з переліком уроків та ресурсів',
            'Прив\'язка тестів та опитувань до навчального маршруту',
        ],
    },
    3: {
        title: 'База знань',
        sub:   'Централізоване сховище навчальних матеріалів',
        points: [
            'PDF, відео, посилання, файли та зображення в одному місці',
            'Пошук та фільтрація за категоріями і типами',
            'Перегляд у режимі сітки або списку',
            'Контроль доступу до кожного ресурсу окремо',
            'Трекінг завантажень та перегляду матеріалів',
        ],
    },
    4: {
        title: 'Тести та Оцінювання',
        sub:   'Перевірка знань з автоматичною оцінкою',
        points: [
            'Типи питань: одиночний / множинний вибір, правда-неправда',
            'Налаштування: прохідний бал, ліміт спроб, таймер, рандомізація',
            'Авто-перевірка з балами за кожне питання',
            'Детальний розбір відповідей після завершення',
            'Перегляд результатів та статистики спроб',
        ],
    },
    5: {
        title: 'Документи',
        sub:   'Корпоративна документація з контролем ознайомлення',
        points: [
            'Реєстри ТОВ та нормативно-правові акти по кожній компанії мережі',
            'Обов\'язкове підтвердження ознайомлення з документом',
            'Версіонування документів та трекінг завантажень',
            'Сортування за пріоритетом та датою оновлення',
            'Доступ за роллю: менеджер, касир, адміністратор',
        ],
    },
    6: {
        title: 'Розклад та Планування',
        sub:   'Графік змін для всієї мережі',
        points: [
            'Візуальна сітка графіку змін для 200+ локацій',
            'Управління підмінами зі статусом основний / замісник',
            'Журнал змін з повним аудит-логом',
            'Фільтр по локаціях та співробітниках',
            'Кошик видалених записів з можливістю відновлення',
        ],
    },
    7: {
        title: 'Адміністрування',
        sub:   'Повне управління платформою та користувачами',
        points: [
            'Управління користувачами: додавання, редагування, імпорт',
            '6 ролей доступу: owner / admin / smm / teacher / manager / user',
            'Групи доступу за містом, посадою, підрозділом та міткою',
            'Режим імперсонації — перегляд системи очима будь-якого юзера',
            'Журнал активності та кошик видалених об\'єктів',
        ],
    },
    8: {
        title: 'Особистий кабінет',
        sub:   'Профіль та особистий простір співробітника',
        points: [
            'Профіль: аватар, посада, місто, контактні дані',
            'Особистий календар з кольоровими подіями та нагадуваннями',
            'Нагадування за 1–2 дні до важливих подій',
            'Закладки — збережені курси, тести та матеріали',
            'Перегляд власних результатів тестів та прогресу курсів',
        ],
    },
    9: {
        title: 'Контакти та Команда',
        sub:   'Каталог співробітників мережі',
        points: [
            'Перелік усіх співробітників з аватарами та посадами',
            'Пошук за іменем, містом, підрозділом',
            'Мітки: Стажер 🌱 та Наставник ⭐',
            'Дні народження з можливістю надіслати привітання',
            'Відстеження дати прийому на роботу та стажу',
        ],
    },
};

// ── Группируем файлы по номеру секции
function groupImages() {
    const files = fs.readdirSync(IMG_DIR).filter(f => f.endsWith('.png')).sort();
    const groups = {};
    for (const f of files) {
        const m = f.match(/^(\d+)/);
        if (!m) continue;
        const n = parseInt(m[1]);
        if (!groups[n]) groups[n] = { main: null, subs: [] };
        if (/^\d+\.png$/.test(f)) groups[n].main = f;
        else groups[n].subs.push(f);
    }
    // Сортируем subs по имени
    for (const n of Object.keys(groups)) {
        groups[n].subs.sort();
    }
    return groups;
}

function toBase64(filename) {
    const full = path.join(IMG_DIR, filename);
    if (!fs.existsSync(full)) return null;
    return `data:image/png;base64,${fs.readFileSync(full).toString('base64')}`;
}

function generateHTML(groups) {
    const sectionNums = Object.keys(groups).map(Number).sort((a, b) => a - b);
    const total = sectionNums.length;

    const sectionsHTML = sectionNums.map((n, idx) => {
        const g    = groups[n];
        const info = SECTIONS[n] || { title: `Розділ ${n}`, sub: '' };
        const mainB64 = g.main ? toBase64(g.main) : null;
        const subsB64 = g.subs.map(f => ({ file: f, b64: toBase64(f) })).filter(s => s.b64);

        const hasSubs = subsB64.length > 0;

        const allImgs = [
            ...(mainB64 ? [mainB64] : []),
            ...subsB64.map(s => s.b64),
        ];

        const mainImgHTML = '';
        const subsHTML    = '';
        const layoutClass = 'prs-layout-col';

        const num = String(idx + 1).padStart(2, '0');
        const tot = String(total).padStart(2, '0');

        const descSlide = `
<div class="prs-desc-slide">
    <div class="prs-desc-num">${num} / ${tot}</div>
    <div class="prs-desc-title">${info.title}</div>
    <div class="prs-desc-sub">${info.sub}</div>
    <ul class="prs-desc-list">
        ${(info.points || []).map(p => `<li>${p}</li>`).join('')}
    </ul>
</div>`;

        const imgSlide = `
<div class="prs-section ${layoutClass}">
    <div class="prs-section-head">
        <div class="prs-section-num">${num} / ${tot} — ${info.title}</div>
    </div>
    <div class="prs-images">
        ${allImgs.map(b64 => `<div class="prs-col-frame"><img src="${b64}" alt=""></div>`).join('')}
    </div>
</div>`;

        return descSlide + imgSlide;
    }).join('\n');

    return `<!DOCTYPE html>
<html lang="uk">
<head>
<meta charset="UTF-8">
<title>Скарбниця LMS — Презентація</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Inter',sans-serif;background:#0f1117;color:#e2e8f0}

/* ── COVER ── */
.prs-cover{
    width:100%;height:100vh;min-height:480px;
    display:flex;flex-direction:column;align-items:center;justify-content:center;
    background:linear-gradient(135deg,#1e1b4b 0%,#0f1117 50%,#0c1a2e 100%);
    position:relative;overflow:hidden;page-break-after:always;
}
.prs-cover-glow{
    position:absolute;width:700px;height:700px;border-radius:50%;
    background:radial-gradient(circle,rgba(99,102,241,.22) 0%,transparent 70%);
    top:50%;left:50%;transform:translate(-50%,-50%);
}
.prs-cover-badge{
    background:rgba(99,102,241,.15);border:1px solid rgba(99,102,241,.4);
    color:#a5b4fc;border-radius:20px;padding:6px 20px;font-size:.78rem;
    font-weight:700;letter-spacing:.08em;text-transform:uppercase;margin-bottom:28px;position:relative;
}
.prs-cover-title{
    font-size:4rem;font-weight:900;text-align:center;position:relative;line-height:1.05;margin-bottom:18px;
    background:linear-gradient(135deg,#fff 30%,#a5b4fc);
    -webkit-background-clip:text;-webkit-text-fill-color:transparent;
}
.prs-cover-sub{
    font-size:1.05rem;color:#94a3b8;text-align:center;max-width:520px;
    position:relative;line-height:1.7;margin-bottom:40px;
}
.prs-cover-pills{display:flex;gap:12px;flex-wrap:wrap;justify-content:center;position:relative}
.prs-cover-pill{
    background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);
    border-radius:20px;padding:7px 18px;font-size:.8rem;color:#cbd5e1;
}

/* ── DESC SLIDE ── */
.prs-desc-slide{
    page-break-before:always;
    width:100%;min-height:100vh;
    display:flex;flex-direction:column;justify-content:center;
    padding:60px 80px;
    background:linear-gradient(135deg,#12131f 0%,#0f1117 60%,#0c1520 100%);
    position:relative;
}
.prs-desc-slide::before{
    content:'';position:absolute;left:0;top:0;bottom:0;width:4px;
    background:linear-gradient(180deg,#6366f1,#8b5cf6);border-radius:0 2px 2px 0;
}
.prs-desc-num{font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.12em;color:#6366f1;margin-bottom:12px}
.prs-desc-title{font-size:2.4rem;font-weight:900;color:#f1f5f9;line-height:1.15;margin-bottom:10px}
.prs-desc-sub{font-size:1rem;color:#94a3b8;margin-bottom:36px;font-weight:500}
.prs-desc-list{list-style:none;display:flex;flex-direction:column;gap:14px}
.prs-desc-list li{
    display:flex;align-items:flex-start;gap:14px;
    font-size:.95rem;color:#cbd5e1;line-height:1.5;
}
.prs-desc-list li::before{
    content:'→';color:#6366f1;font-weight:700;flex-shrink:0;margin-top:1px;font-size:1rem;
}

/* ── SECTION SLIDE ── */
.prs-section{
    page-break-before:always;
    width:100%;min-height:100vh;
    display:flex;flex-direction:column;
    padding:28px 40px 24px;
    background:#0f1117;
}
.prs-section-head{margin-bottom:16px;flex-shrink:0}
.prs-section-num{font-size:.68rem;font-weight:700;text-transform:uppercase;letter-spacing:.12em;color:#6366f1;margin-bottom:5px}
.prs-section-title{font-size:1.35rem;font-weight:800;color:#f1f5f9;line-height:1.2}
.prs-section-sub{font-size:.82rem;color:#64748b;margin-top:5px;line-height:1.5}

.prs-images{flex:1;display:flex;flex-direction:column;gap:10px;min-height:0}

/* Каждая картинка на всю ширину, одна под другой */
.prs-col-frame{
    border-radius:10px;overflow:hidden;
    border:1px solid #1e2840;
    box-shadow:0 8px 32px rgba(0,0,0,.5);
}
.prs-col-frame img{width:100%;height:auto;display:block}

/* ── PRINT ── */
@media print{
    body{background:#fff!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .prs-cover{background:linear-gradient(135deg,#3730a3,#1e1b4b)!important}
    .prs-cover-title{-webkit-text-fill-color:#fff!important}
    .prs-section{background:#f8fafc!important}
    .prs-section-num{color:#4f46e5!important}
    .prs-section-title{color:#0f172a!important}
    .prs-section-sub{color:#64748b!important}
    .prs-main-frame,.prs-sub-frame{border-color:#e2e8f0!important;box-shadow:none!important}
}
</style>
</head>
<body>

<!-- COVER -->
<div class="prs-cover">
    <div class="prs-cover-glow"></div>
    <div class="prs-cover-badge">Корпоративна платформа · 2026</div>
    <div class="prs-cover-title">Скарбниця<br>LMS</div>
    <div class="prs-cover-sub">Єдина платформа навчання, оцінювання та управління персоналом для мережі ломбардів</div>
    <div class="prs-cover-pills">
        <div class="prs-cover-pill">🎓 Курси та тести</div>
        <div class="prs-cover-pill">📊 Аналітика</div>
        <div class="prs-cover-pill">📅 Розклад змін</div>
        <div class="prs-cover-pill">🔔 Real-time сповіщення</div>
        <div class="prs-cover-pill">⚙️ Адміністрування</div>
    </div>
</div>

${sectionsHTML}

</body>
</html>`;
}

async function buildPDF(htmlPath, pdfPath) {
    const { chromium } = require('playwright');
    const browser = await chromium.launch({ headless: true });
    const page    = await browser.newPage();
    await page.goto('file://' + htmlPath, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    await page.pdf({
        path: pdfPath,
        format: 'A4',
        landscape: true,
        printBackground: true,
        margin: { top: '0', right: '0', bottom: '0', left: '0' },
    });
    await browser.close();
}

async function run() {
    console.log('📂  Читаю present-img...');
    const groups = groupImages();
    const found  = Object.keys(groups).length;
    console.log(`✅  Знайдено ${found} розділів, ${Object.values(groups).reduce((a,g)=>a+(g.main?1:0)+g.subs.length,0)} зображень`);

    console.log('🎨  Генерую HTML...');
    const html = generateHTML(groups);
    fs.writeFileSync(OUT_HTML, html, 'utf8');
    console.log(`📄  HTML → presentation.html`);

    console.log('🖨️  Генерую PDF...');
    await buildPDF(OUT_HTML, OUT_PDF);
    console.log(`🎉  PDF → presentation.pdf`);
}

run().catch(e => { console.error('❌', e.message); process.exit(1); });
