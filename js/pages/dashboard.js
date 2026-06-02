// ================================================================
// EduFlow LMS — Головна сторінка (Dashboard) — WOW redesign
// ================================================================

// ── Свята України ────────────────────────────────────────────────
const UA_HOLIDAYS = {
    '01-01': { name: 'Новий рік', emoji: '🎆', type: 'state', tag: 'Вихідний' },
    '03-08': { name: 'Міжнародний жіночий день', emoji: '💐', type: 'state', tag: 'Вихідний' },
    '04-12': { name: 'Великдень (Пасха) 2026', emoji: '🐣', type: 'state', tag: 'Вихідний' },
    '05-01': { name: 'День праці', emoji: '⚒️', type: 'state', tag: 'Вихідний' },
    '05-08': { name: "День пам'яті та перемоги над нацизмом", emoji: '🌻', type: 'state', tag: 'Вихідний' },
    '06-04': { name: 'День захисту дітей', emoji: '👧', type: 'professional', tag: 'Міжнародне' },
    '06-06': { name: 'День довкілля', emoji: '🌿', type: 'professional', tag: 'Професійне' },
    '06-07': { name: 'День Святої Трійці (П\'ятидесятниця)', emoji: '🕊️', type: 'religious', tag: 'Релігійне' },
    '06-12': { name: 'День боротьби з дитячою працею', emoji: '🌐', type: 'professional', tag: 'Міжнародне' },
    '06-13': { name: "День пам'яті жертв депортації кримськотатарського народу", emoji: '🕯️', type: 'memorial', tag: "Пам'ятна дата" },
    '06-27': { name: 'День медичного працівника', emoji: '🏥', type: 'professional', tag: 'Професійне' },
    '06-28': { name: 'День Конституції України', emoji: '📜', type: 'state', tag: 'Вихідний' },
    '07-01': { name: 'День архітектора України', emoji: '🏗️', type: 'professional', tag: 'Професійне' },
    '07-08': { name: 'День родини', emoji: '💞', type: 'professional', tag: 'Міжнародне' },
    '07-16': { name: 'День Декларації про суверенітет України', emoji: '🏛️', type: 'memorial', tag: "Пам'ятна дата" },
    '07-19': { name: 'День металурга', emoji: '⚗️', type: 'professional', tag: 'Професійне' },
    '07-26': { name: 'День Військово-морських сил', emoji: '⚓', type: 'professional', tag: 'Професійне' },
    '07-31': { name: 'День рятувальника', emoji: '🌊', type: 'professional', tag: 'Професійне' },
    '08-02': { name: 'День Повітряно-десантних військ', emoji: '🪂', type: 'professional', tag: 'Військово-проф.' },
    '08-06': { name: 'Преображення Господнє (Яблучний Спас)', emoji: '✨', type: 'religious', tag: 'Релігійне' },
    '08-23': { name: 'День Державного прапора України', emoji: '🏳️', type: 'state', tag: 'Державна дата' },
    '08-24': { name: 'День незалежності України', emoji: '🌻', type: 'state', tag: 'Вихідний' },
    '08-29': { name: 'День шахтаря', emoji: '⛏️', type: 'professional', tag: 'Професійне' },
    '08-30': { name: 'День авіації України', emoji: '✈️', type: 'professional', tag: 'Професійне' },
    '09-01': { name: 'День знань', emoji: '🎒', type: 'professional', tag: 'Загальноукраїнське' },
    '09-06': { name: 'День Національної поліції', emoji: '👮', type: 'professional', tag: 'Професійне' },
    '09-17': { name: 'День фермера (День аграрія)', emoji: '🌾', type: 'professional', tag: 'Професійне' },
    '09-22': { name: 'День партизанської слави', emoji: '🌍', type: 'memorial', tag: "Пам'ятна дата" },
    '09-27': { name: 'День вихователя та педагогів / День туризму', emoji: '👩‍🏫', type: 'professional', tag: 'Міжнародне' },
    '09-28': { name: 'Міжнародний день ломбардів', emoji: '💎', type: 'professional', tag: 'Професійне' },
    '10-01': { name: 'День захисників і захисниць України', emoji: '🛡️', type: 'state', tag: 'Вихідний' },
    '10-05': { name: 'День вчителя', emoji: '🍎', type: 'professional', tag: 'Професійне' },
    '10-11': { name: 'День місцевого самоврядування', emoji: '🏘️', type: 'professional', tag: 'Професійне' },
    '10-14': { name: 'Покрова Пресвятої Богородиці', emoji: '🙏', type: 'religious', tag: 'Релігійне' },
    '10-25': { name: 'Перехід на зимовий час / День ООН', emoji: '🌙', type: 'professional', tag: 'Загальноукраїнське' },
    '11-09': { name: 'День народження Ломбарду «Скарбниця»', emoji: '💎', type: 'state', tag: '🏆 Наш день!' },
    '11-06': { name: "День пам'яті жертв Голодомору", emoji: '🖤', type: 'memorial', tag: 'День жалоби' },
    '11-19': { name: 'День прокуратури / Міжнародний день чоловіків', emoji: '⚖️', type: 'professional', tag: 'Міжнародне' },
    '11-21': { name: 'День Гідності та Свободи', emoji: '🕊️', type: 'state', tag: 'Державна дата' },
    '11-28': { name: "День пам'яті жертв Голодомору (4-та субота)", emoji: '🕯️', type: 'memorial', tag: 'День жалоби' },
    '12-01': { name: 'День боротьби зі СНІДом / референдум 1991', emoji: '🎗️', type: 'professional', tag: 'Міжнародне' },
    '12-06': { name: 'День Збройних сил України', emoji: '⚔️', type: 'state', tag: 'Державна дата' },
    '12-10': { name: 'День прав людини', emoji: '🌏', type: 'professional', tag: 'Міжнародне' },
    '12-25': { name: 'Різдво Христове', emoji: '⭐', type: 'state', tag: 'Вихідний' },
};

// ── Recently Viewed tracker (global, localStorage-based) ─────────
const RecentlyViewed = {
    _max: 20,
    _k() { return 'lms_rv_' + (AppState.user?.id || 'anon'); },
    track({ type, id, title, thumbnail = null, route, color = '#6366f1', icon = 'fa-file' }) {
        let items = this.get();
        items = items.filter(i => !(i.type === type && i.id === id));
        items.unshift({ type, id, title, thumbnail, route, color, icon, viewedAt: Date.now() });
        if (items.length > this._max) items = items.slice(0, this._max);
        try { localStorage.setItem(this._k(), JSON.stringify(items)); } catch {}
        this._updateBadge(items.length);
    },
    get() {
        try { return JSON.parse(localStorage.getItem(this._k()) || '[]'); } catch { return []; }
    },
    _updateBadge(count) {
        const badge = document.getElementById('history-bell-badge');
        if (!badge) return;
        if (count > 0) { badge.textContent = count > 99 ? '99+' : count; badge.classList.remove('hidden'); }
        else badge.classList.add('hidden');
    },
    init() { this._updateBadge(this.get().length); }
};

const DashboardPage = {
    async init(container) {
        UI.setBreadcrumb([{ label: 'Головна' }]);

        const role   = AppState.profile?.role || 'user';
        const roleColors = {
            owner:   { from: '#7c3aed', to: '#4f46e5' },
            admin:   { from: '#4f46e5', to: '#0ea5e9' },
            smm:     { from: '#ec4899', to: '#8b5cf6' },
            teacher: { from: '#10b981', to: '#0ea5e9' },
            manager: { from: '#f59e0b', to: '#ef4444' },
            user:    { from: '#6366f1', to: '#8b5cf6' },
        };
        const colors = roleColors[role] || roleColors.user;

        container.innerHTML = `
        <style>
            .db-alert{border-radius:var(--radius-lg);padding:1rem 1.25rem;margin-bottom:1.5rem;border:1px solid;display:flex;gap:1rem;align-items:flex-start}
            .db-alert-warn{background:rgba(245,158,11,.08);border-color:rgba(245,158,11,.3)}
            .db-alert-danger{background:rgba(239,68,68,.08);border-color:rgba(239,68,68,.3)}
            .db-alert-icon{font-size:1.5rem;flex-shrink:0;line-height:1}
            .db-alert-body{flex:1;min-width:0}
            .db-alert-title{font-weight:700;margin-bottom:.35rem;font-size:.9rem}
            .db-alert-items{display:flex;flex-wrap:wrap;gap:.4rem}
            .db-alert-chip{display:inline-flex;align-items:center;gap:.3rem;background:var(--bg-raised);border:1px solid var(--border);border-radius:var(--radius-sm);padding:.2rem .6rem;font-size:.78rem;cursor:pointer;transition:border-color .15s}
            .db-alert-chip:hover{border-color:var(--primary)}

            .db-grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:clamp(.75rem,.9vw,1.25rem);margin-bottom:1.5rem}
            .db-grid3>:nth-child(2),.db-grid3>:nth-child(3),.db-grid3>:last-child{align-self:start}
            .db-grid2{display:grid;grid-template-columns:repeat(2,1fr);gap:clamp(.75rem,.9vw,1.25rem);margin-bottom:1.5rem}
            @media(max-width:1050px){.db-grid3{grid-template-columns:1fr 1fr}}
            @media(max-width:700px){.db-grid3,.db-grid2{grid-template-columns:1fr}}

            .db-card{background:var(--bg-surface);border:1px solid var(--border);border-radius:var(--radius-xl);overflow:hidden}
            .db-card-head{padding:.75rem 1.1rem;font-size:1rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;border-bottom:1px solid var(--border);background:rgba(99,102,241,.025);display:flex;align-items:center;justify-content:space-between}
            .db-card-desc{padding:.45rem 1.1rem .55rem;font-size:.72rem;color:var(--text-muted);line-height:1.45;border-bottom:1px solid var(--border);background:var(--bg-raised)}
            .db-card-body{padding:1rem 1.1rem}

            .db-stat-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(clamp(100px,10vw,130px),1fr));gap:clamp(.6rem,.8vw,1rem);margin-bottom:1.5rem}
            .db-stat{background:var(--bg-surface);border:1px solid var(--border);border-radius:var(--radius-xl);padding:1.1rem 1.25rem;display:flex;flex-direction:column;gap:.3rem;position:relative;overflow:hidden;transition:transform .15s,box-shadow .15s}
            .db-stat:hover{transform:translateY(-2px);box-shadow:var(--shadow-md)}
            .db-stat::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:var(--s-color)}
            .db-stat-icon{font-size:1.4rem;margin-bottom:.1rem}
            .db-stat-val{font-size:1.8rem;font-weight:800;color:var(--text-primary);line-height:1}
            .db-stat-label{font-size:.75rem;color:var(--text-muted);font-weight:500}


            .db-pbar{height:6px;background:var(--bg-raised);border-radius:3px;overflow:hidden}
            .db-pbar-fill{height:100%;background:linear-gradient(to right,${colors.from},${colors.to});border-radius:3px;transition:width .6s ease}

            .db-news-mini{display:flex;flex-direction:column}
            .db-news-hero{height:165px;position:relative;overflow:hidden;background:#0f0c29;cursor:pointer}
            .db-news-hero-bg{position:absolute;inset:-8px;background-size:cover;filter:blur(12px) brightness(.4);transform:scale(1.05)}
            .db-news-hero-main{position:absolute;inset:0;background-size:contain;background-repeat:no-repeat;z-index:1}
            .db-news-hero-overlay{position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,.7),transparent);z-index:2}
            .db-news-hero-title{position:absolute;bottom:.75rem;left:.85rem;right:.85rem;z-index:3;font-size:.85rem;font-weight:700;color:#fff;line-height:1.35;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
            .db-news-item{display:flex;gap:.75rem;padding:.6rem .85rem;border-bottom:1px solid var(--border);cursor:pointer;transition:background .15s}
            .db-news-item:hover{background:var(--bg-raised)}
            .db-news-item:last-child{border-bottom:none}
            .db-news-dot{width:6px;height:6px;border-radius:50%;background:var(--primary);flex-shrink:0;margin-top:.4rem}
            .db-news-item-title{font-size:.82rem;font-weight:500;line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;flex:1}
            .db-news-item-date{font-size:.72rem;color:var(--text-muted);flex-shrink:0;margin-top:.1rem}

            .db-event-item{display:flex;gap:.85rem;padding:.75rem 1rem;border-bottom:1px solid var(--border);align-items:flex-start}
            .db-event-item:last-child{border-bottom:none}
            .db-event-dot{width:36px;height:36px;border-radius:var(--radius-md);display:flex;align-items:center;justify-content:center;font-size:.85rem;flex-shrink:0;font-weight:700}
            .db-event-title{font-size:.85rem;font-weight:600;line-height:1.35}
            .db-event-meta{font-size:.73rem;color:var(--text-muted);margin-top:.15rem}

            .db-courses-scroll{display:flex;gap:1rem;overflow-x:auto;padding-bottom:.5rem;scrollbar-width:thin}
            .db-courses-scroll::-webkit-scrollbar{height:4px}
            .db-courses-scroll::-webkit-scrollbar-track{background:var(--bg-raised);border-radius:2px}
            .db-courses-scroll::-webkit-scrollbar-thumb{background:var(--border);border-radius:2px}
            .db-course-card{min-width:220px;max-width:220px;background:var(--bg-surface);border:1px solid var(--border);border-radius:var(--radius-lg);overflow:hidden;cursor:pointer;transition:transform .15s,box-shadow .15s,border-color .15s;flex-shrink:0}
            .db-course-card:hover{transform:translateY(-3px);box-shadow:var(--shadow-md);border-color:var(--primary)}
            .db-course-thumb{height:110px;overflow:hidden;background:var(--bg-raised)}
            .db-course-thumb img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .3s}
            .db-course-card:hover .db-course-thumb img{transform:scale(1.05)}
            .db-course-body{padding:.75rem}
            .db-course-name{font-size:.82rem;font-weight:600;line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;margin-bottom:.5rem}

            .db-main-grid{display:grid;grid-template-columns:1fr 300px;grid-template-rows:auto 1fr;gap:clamp(.5rem,.75vw,.85rem);margin-bottom:1.5rem;min-width:0;width:100%}
            .db-content-cols{display:flex;flex-direction:row;flex-wrap:wrap;gap:clamp(.5rem,.75vw,.85rem);align-items:start;min-width:0}
            .db-content-cols>*{flex:0 0 auto}
            .db-cal-col{grid-column:2;grid-row:1/3;display:flex;flex-direction:column;gap:.75rem;min-width:0;width:100%}
            .db-recent-row{grid-column:1;grid-row:2;min-width:0}
            @media(max-width:1200px){
                .db-main-grid{grid-template-columns:1fr 260px}
            }
            @media(max-width:1000px){
                .db-main-grid{grid-template-columns:1fr;grid-template-rows:auto}
                .db-cal-col{grid-column:1;grid-row:auto}
                .db-recent-row{grid-column:1;grid-row:auto}
            }
            @media(max-width:700px){
                .db-main-grid{grid-template-columns:1fr;gap:.6rem}
                .db-content-cols{grid-template-columns:1fr}
            }
            .db-news-w{background:var(--bg-surface);border:1px solid var(--border);border-radius:var(--radius-xl);overflow:hidden;height:315px;display:flex;flex-direction:column;position:relative;max-width:570px;width:100%}
            .db-news-w::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:#f59e0b;z-index:1}
            .db-news-w-head{padding:.75rem 1rem;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;flex-shrink:0}
            .db-news-w-head-left{display:flex;align-items:center;gap:.55rem}
            .db-news-w-icon{width:32px;height:32px;border-radius:9px;background:rgba(245,158,11,.12);color:#f59e0b;display:flex;align-items:center;justify-content:center;font-size:.9rem;flex-shrink:0}
            .db-news-w-title{font-size:.78rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--text-primary)}
            .db-news-hero{flex:0 0 150px;position:relative;overflow:hidden;cursor:pointer;background:#0f0c29}
            .db-news-hero-img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .4s ease}
            .db-news-hero:hover .db-news-hero-img{transform:scale(1.05)}
            .db-news-hero-ph{width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:3rem;background:linear-gradient(135deg,#1e1b4b,#312e81)}
            .db-news-hero-grad{position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,.85) 0%,rgba(0,0,0,.2) 55%,transparent 100%)}
            .db-news-hero-body{position:absolute;bottom:0;left:0;right:0;padding:.75rem .9rem;z-index:1}
            .db-news-hero-badge{display:inline-block;background:#f59e0b;color:#000;font-size:.6rem;font-weight:800;text-transform:uppercase;letter-spacing:.06em;padding:.1rem .45rem;border-radius:3px;margin-bottom:.35rem}
            .db-news-hero-title{font-size:.88rem;font-weight:700;color:#fff;line-height:1.35;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
            .db-news-hero-date{font-size:.68rem;color:rgba(255,255,255,.5);margin-top:.3rem;text-align:right}
            .db-news-rows{flex:1;overflow-y:auto;display:flex;flex-direction:column;scrollbar-width:thin}
            .db-news-row{display:flex;align-items:center;gap:.65rem;padding:.55rem .9rem;border-bottom:1px solid var(--border);cursor:pointer;transition:background .12s}
            .db-news-row:hover{background:var(--bg-raised)}
            .db-news-row:last-child{border-bottom:none}
            .db-news-row-dot{width:6px;height:6px;border-radius:50%;background:#f59e0b;flex-shrink:0}
            .db-news-row-title{font-size:.8rem;font-weight:500;color:var(--text-primary);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
            .db-news-row-date{font-size:.65rem;color:var(--text-muted);flex-shrink:0}
            .db-news-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;flex:1;gap:.4rem;color:var(--text-muted);font-size:.82rem}
            .db-alc-w{background:var(--bg-surface);border:1px solid var(--border);border-radius:var(--radius-xl);overflow:hidden;height:320px;width:400px;max-width:100%;display:flex;flex-direction:column;position:relative}
            .db-alc-w::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:var(--alc-accent,var(--primary));z-index:1}
            .db-alc-head{padding:.7rem 1rem .7rem 1rem;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;flex-shrink:0;background:linear-gradient(120deg,color-mix(in srgb,var(--alc-accent,var(--primary)) 10%,var(--bg-surface)),var(--bg-surface));position:relative;overflow:hidden}
            .db-alc-head::after{content:'';position:absolute;right:-18px;top:50%;transform:translateY(-50%);width:70px;height:70px;border-radius:50%;background:color-mix(in srgb,var(--alc-accent,var(--primary)) 7%,transparent);pointer-events:none}
            .db-alc-head-left{display:flex;align-items:center;gap:.65rem}
            .db-alc-head-icon{width:36px;height:36px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:1rem;flex-shrink:0;box-shadow:0 2px 8px color-mix(in srgb,var(--alc-accent,var(--primary)) 30%,transparent)}
            .db-alc-head-info{display:flex;flex-direction:column;gap:.05rem}
            .db-alc-head-title{font-size:.78rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--text-primary);line-height:1}
            .db-alc-head-sub{font-size:.66rem;color:var(--text-muted);line-height:1}
            .db-alc-head-right{display:flex;align-items:center;gap:.5rem}
            .db-alc-badge{font-size:.65rem;font-weight:800;padding:.15rem .5rem;border-radius:20px;line-height:1.4}
            .db-alc-goto{width:26px;height:26px;border-radius:50%;border:1px solid var(--border);background:var(--bg-surface);color:var(--text-muted);display:flex;align-items:center;justify-content:center;font-size:.65rem;cursor:pointer;transition:all .15s;flex-shrink:0}
            .db-alc-goto:hover{background:var(--alc-accent,var(--primary));border-color:var(--alc-accent,var(--primary));color:#fff}
            .db-alc-body{flex:1;overflow-y:auto;scrollbar-width:thin;display:flex;flex-direction:column}
            .db-alc-doc-item{display:flex;align-items:center;gap:.6rem;padding:.55rem 1rem;border-bottom:1px solid var(--border);cursor:pointer;transition:background .12s}
            .db-alc-doc-item:hover{background:var(--bg-raised)}
            .db-alc-doc-item:last-child{border-bottom:none}
            .db-alc-doc-icon{width:28px;height:28px;border-radius:7px;display:flex;align-items:center;justify-content:center;font-size:.8rem;flex-shrink:0;background:rgba(239,68,68,.1);color:#ef4444}
            .db-alc-doc-name{font-size:.82rem;font-weight:500;color:var(--text-primary);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
            .db-alc-doc-more{padding:.5rem 1rem;font-size:.75rem;color:var(--primary);cursor:pointer;text-align:center;border-top:1px solid var(--border)}
            .db-alc-doc-more:hover{background:var(--bg-raised)}
            .db-alc-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:.4rem;padding:2rem;text-align:center}
            .db-alc-empty-bubble{width:56px;height:56px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:1.5rem;margin-bottom:.3rem}
            .db-alc-empty-title{font-size:.88rem;font-weight:700;color:var(--text-primary)}
            .db-alc-empty-sub{font-size:.75rem;color:var(--text-muted)}
            .db-alc-nitem{display:flex;align-items:flex-start;gap:.6rem;padding:.6rem 1rem;border-bottom:1px solid var(--border);cursor:pointer;transition:background .12s;position:relative}
            .db-alc-nitem:hover{background:var(--bg-raised)}
            .db-alc-nitem:last-child{border-bottom:none}
            .db-alc-nicon{width:32px;height:32px;border-radius:9px;display:flex;align-items:center;justify-content:center;font-size:.9rem;flex-shrink:0}
            .db-alc-ntitle{font-size:.92rem;font-weight:600;color:var(--text-primary);line-height:1.4;white-space:normal;word-break:break-word}
            .db-alc-nmsg{font-size:.78rem;color:var(--text-muted);margin-top:.1rem;line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
            .db-ntf-check{width:22px;height:22px;border-radius:50%;border:1.5px solid var(--border);background:transparent;color:var(--text-muted);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:.58rem;flex-shrink:0;transition:all .15s;font-family:inherit;opacity:0;margin-top:.05rem}
            .db-alc-nitem:hover .db-ntf-check{opacity:1}
            .db-ntf-check:hover{border-color:#10b981;color:#10b981;background:rgba(16,185,129,.1)}
            .db-alc-notif-meta{display:flex;align-items:center;justify-content:space-between;padding:.45rem 1rem .35rem;border-bottom:1px solid var(--border);background:var(--bg-raised)}
            .db-alc-more-row{padding:.5rem 1rem;font-size:.75rem;color:var(--primary);cursor:pointer;text-align:center}
            .db-alc-more-row:hover{background:var(--bg-raised)}
            .db-cal-w{background:var(--bg-surface);border:1px solid var(--border);border-radius:var(--radius-xl);overflow:hidden}
            .db-cwrap{padding:1rem 1.1rem .75rem}
            .db-cnav{display:flex;align-items:center;justify-content:space-between;margin-bottom:.85rem}
            .db-cnav-left{display:flex;flex-direction:column;gap:.05rem}
            .db-cnav-title{font-size:.95rem;font-weight:700;color:var(--text-primary)}
            .db-cnav-sub{font-size:.72rem;color:var(--text-muted);font-weight:500;text-transform:capitalize}
            .db-cnav-arrows{display:flex;gap:.3rem}
            .db-cnav-btn{width:26px;height:26px;border-radius:50%;border:1px solid var(--border);background:var(--bg-raised);color:var(--text-muted);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:.65rem;transition:all .15s;font-family:inherit}
            .db-cnav-btn:hover{background:rgba(99,102,241,.1);border-color:rgba(99,102,241,.4);color:var(--primary)}
            .db-cgrid{display:grid;grid-template-columns:repeat(7,1fr);gap:1px}
            .db-cdow{font-size:.6rem;font-weight:600;color:var(--text-muted);text-align:center;padding:.15rem 0 .4rem;letter-spacing:.02em}
            .db-cday{width:30px;height:30px;display:flex;align-items:center;justify-content:center;border-radius:50%;font-size:.75rem;font-weight:500;color:var(--text-primary);cursor:pointer;transition:all .15s;margin:1px auto}
            .db-cday:hover:not(.db-today):not(.db-othm){background:rgba(99,102,241,.08)}
            .db-today{background:var(--primary);color:#fff;font-weight:700;box-shadow:0 3px 12px rgba(99,102,241,.4)}
            .db-has-ev:not(.db-today){background:rgba(99,102,241,.13);color:var(--primary);font-weight:600}
            .db-othm{color:var(--text-muted);opacity:.28;cursor:default;pointer-events:none}
            .db-cup-wrap{border-top:1px solid rgba(16,185,129,.2);padding:.75rem 1.1rem .65rem;background:rgba(16,185,129,.04)}
            .db-cup-title{font-size:.85rem;font-weight:700;color:var(--text-primary);margin-bottom:.55rem}
            .db-cup-list{display:flex;flex-direction:column;gap:.2rem;max-height:120px;overflow-y:auto;scrollbar-width:thin;padding-right:.2rem}
            .db-cup-list::-webkit-scrollbar{width:3px}
            .db-cup-list::-webkit-scrollbar-thumb{background:var(--border);border-radius:2px}
            .db-cup-item{display:flex;gap:.65rem;align-items:flex-start;padding:.45rem .4rem;border-radius:var(--radius-md);cursor:pointer;transition:background .12s}
            .db-cup-item:hover{background:var(--bg-raised)}
            .db-cup-item.db-cup-done .db-cup-name{opacity:.4}
            .db-cup-item.db-cup-done{opacity:.55}
            .db-cup-check{width:22px;height:22px;border-radius:50%;border:1.5px solid var(--border);background:var(--bg-raised);color:var(--text-muted);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:.6rem;flex-shrink:0;transition:all .18s;font-family:inherit}
            .db-cup-check:hover{border-color:var(--success);color:var(--success);background:rgba(16,185,129,.08)}
            .db-cup-check.done{border-color:var(--success);background:rgba(16,185,129,.12);color:var(--success)}
            .db-cup-check.done:hover{border-color:var(--text-muted);color:var(--text-muted);background:var(--bg-raised)}
            .db-cup-acc-hdr{display:flex;align-items:center;justify-content:space-between;padding:.45rem .9rem .3rem;cursor:pointer;user-select:none}
            .db-cup-acc-hdr span{font-size:.75rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--text-muted)}
            .db-cup-acc-hdr:hover span{color:var(--text-secondary)}
            .db-cup-acc-icon{font-size:.55rem;color:var(--text-muted);transition:transform .22s cubic-bezier(.4,0,.2,1)}
            .db-cup-acc-body{display:none}
            .db-cup-acc-body.open{display:block}
            .db-cup-empty{text-align:center;font-size:.8rem;color:var(--text-muted);padding:.75rem .5rem;display:flex;align-items:center;justify-content:center;gap:.4rem}
            .db-cup-badge{min-width:38px;padding:.3rem .2rem;border-radius:8px;background:rgba(99,102,241,.07);border:1px solid rgba(99,102,241,.12);display:flex;flex-direction:column;align-items:center;flex-shrink:0;line-height:1.15}
            .db-cup-bday{font-size:.9rem;font-weight:800;color:var(--primary)}
            .db-cup-bmon{font-size:.55rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.03em}
            .db-cup-body{flex:1;min-width:0}
            .db-cup-name{font-size:.78rem;font-weight:600;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
            .db-cup-chip{display:inline-flex;align-items:center;gap:.25rem;font-size:.65rem;font-weight:500;padding:.1rem .4rem;border-radius:999px;margin-top:.15rem}
            .db-cup-chip-dot{width:5px;height:5px;border-radius:50%;flex-shrink:0}
        </style>

        <!-- ── Welcome hero ── -->
        <div id="db-welcome"></div>

        <!-- ── Birthdays ── -->
        <div id="db-birthdays"></div>

        <!-- ── Main grid: [docs | notif | news] | calendar / carousel ── -->
        <div class="db-main-grid">
            <div class="db-content-cols">
                <div id="db-alerts-docs"></div>
                <div id="db-alerts-notif"></div>
            </div>
            <div class="db-cal-col">
                <div id="db-cal-tour-target">
                    <div id="db-cal-widget"></div>
                    <div id="db-important"></div>
                </div>
                <div id="db-bday-chat"></div>
            </div>
        </div>

        `;

        // Load all data in parallel
        const _pad = n => String(n).padStart(2, '0');
        const _fmtLocal = d => `${d.getFullYear()}-${_pad(d.getMonth()+1)}-${_pad(d.getDate())}`;
        const today = _fmtLocal(new Date());
        const in7   = _fmtLocal(new Date(Date.now() + 7 * 86400000));
        const _mn   = new Date();
        const monthStart = `${_mn.getFullYear()}-${_pad(_mn.getMonth()+1)}-01`;
        const monthEnd   = _fmtLocal(new Date(_mn.getFullYear(), _mn.getMonth() + 1, 0));

        const [enrollments, newsRes, birthdays, recentNotifs, calEvents, scheduleEntries] = await Promise.all([
            API.enrollments.getMyEnrollments().catch(() => []),
            API.news.getAll({ published: true, pageSize: 5 }).catch(() => ({ data: [] })),
            API.birthdays.getToday().catch(() => []),
            API.notifications.getMine().then(all => all.filter(n => !n.is_read)).catch(() => []),
            supabase.from('personal_cal_events')
                .select('id,title,date,time,end_time,color,is_important,is_done,acked_date,repeat_type,remind_before_days')
                .eq('user_id', AppState.user.id)
                .gte('date', monthStart)
                .lte('date', monthEnd)
                .order('date').order('time', { nullsFirst: true })
                .then(r => r.data || [])
                .catch(() => []),
            supabase.from('schedule_entries')
                .select('date,shift_type,notes,location_id,schedule_locations(name)')
                .eq('user_id', AppState.user.id)
                .gte('date', monthStart)
                .lte('date', monthEnd)
                .then(r => r.data || [])
                .catch(() => []),
        ]);
        const unreadCount = recentNotifs.length;

        // Unacked docs + pending assignments
        const [unackedDocs, testsCount, surveysCount] = await Promise.all([
            this._getUnackedDocs().catch(() => []),
            API.tests.getMyPendingCount().catch(() => 0),
            API.surveys.getMyPendingCount().catch(() => 0),
        ]);

        this._renderWelcome(enrollments, testsCount, surveysCount);
        this._renderCalWidget(calEvents, today, scheduleEntries);
        this._renderImportantEvents(calEvents, today);
        this._renderAlerts(unackedDocs, recentNotifs);
        UI._setNotificationBadge(recentNotifs.length);
        this._renderBirthdays(birthdays);
        CompanyBirthdayModal._initDashboardChat();

        // Показати головну новину один раз за сесію (якщо не відхилено назавжди)
        const featured = (newsRes.data || []).find(n => n.is_featured || n.is_pinned);
        this._featuredNewsId = featured?.id || null;
        const hasFeaturedNews = !!(() => {
            if (!featured) return false;
            const sessionKey = `db_featured_news_${featured.id}`;
            const dismissed = AppState.profile?.dismissed_news || [];
            return !sessionStorage.getItem(sessionKey) && !dismissed.includes(featured.id);
        })();

        if (hasFeaturedNews) {
            const sessionKey = `db_featured_news_${featured.id}`;
            sessionStorage.setItem(sessionKey, '1');
            setTimeout(() => this._openNewsModal(featured.id), 800);
        } else {
            // План дня — тільки якщо немає featured news що відкривається
            this._showDayPlanPopup(scheduleEntries, calEvents, today);
        }

        // Тур для нових користувачів (запускаємо після рендеру)
        setTimeout(() => this._startTour(), 1800);
    },

    _startTour() {
        const steps = [
            {
                icon: '👋',
                title: 'Ласкаво просимо до Скарбниці!',
                text: 'Це ваша особиста сторінка — <strong>Головна</strong>. Давайте пройдемось по основних можливостях порталу. Це займе лише хвилину.',
            },
            {
                target: ['#db-alerts-docs', '#db-content-cols'],
                position: 'right',
                icon: '📋',
                title: 'Документи для ознайомлення',
                text: 'Тут відображаються документи, з якими вам потрібно ознайомитись та підписати. Цифра показує кількість непрочитаних.',
            },
            {
                target: ['#db-alerts-notif', '#db-alerts-docs', '#db-content-cols'],
                position: 'right',
                icon: '🔔',
                title: 'Сповіщення',
                text: 'Нові сповіщення від адміністрації, призначені тести та курси — все тут. Кнопка <em>«Прочитати всі»</em> миттєво очищає список.',
            },
            {
                target: '#db-cal-tour-target',
                position: 'left',
                icon: '📅',
                title: 'Календар та важливі події',
                text: 'Ваш особистий календар — <strong>натисніть на дату</strong> щоб додати подію або нагадування. Для кожної події можна встановити <strong>нагадування за N днів</strong> — прийде сповіщення заздалегідь. Кнопка <strong>🎉 Свята</strong> показує українські державні свята на місяць. Нижче відображаються <strong>важливі події сьогодні</strong> та майбутні. При вході в портал автоматично відкривається <strong>вікно з планом дня</strong>.',
            },
            {
                target: ['#db-birthdays', '#db-cal-widget'],
                position: 'bottom',
                icon: '🎂',
                title: 'Дні народження колег',
                text: 'Портал автоматично нагадує про <strong>дні народження</strong> колег. Коли у когось ДН — з\'являється яскравий банер з можливістю надіслати привітання прямо в системі.',
            },
            {
                target: '#db-bday-chat',
                position: 'left',
                icon: '💎',
                title: 'День народження Скарбниці',
                text: `9 листопада — день народження компанії! З'являється святкова картка з <strong>чатом привітань</strong>. Натисніть картку щоб відкрити повноекранний чат і написати привітання.<br><br>
<div style="background:linear-gradient(135deg,rgba(201,162,39,.12),rgba(255,215,0,.06));border:1.5px solid rgba(201,162,39,.4);border-radius:12px;padding:.65rem 1rem;display:flex;align-items:center;gap:.6rem;margin-top:.25rem">
  <span style="font-size:1.2rem">💎</span>
  <div style="flex:1;min-width:0">
    <div style="font-size:.82rem;font-weight:700;color:var(--text-primary)">Вітаємо Скарбницю!</div>
    <div style="font-size:.68rem;color:#C9A227">День народження компанії · 2026</div>
  </div>
  <span style="background:linear-gradient(135deg,#C9A227,#FFD700);color:#0f0c29;font-size:.7rem;font-weight:800;border-radius:20px;padding:.15rem .55rem">12</span>
  <i class="fa-solid fa-up-right-and-down-left-from-center" style="font-size:.72rem;color:rgba(201,162,39,.6)"></i>
</div>`,
                tipStyle: { top: '50%', bottom: 'auto', left: '24px', right: 'auto', transform: 'translateY(-50%)' },
                noBackdrop: true,
                onShow: () => {
                    CompanyBirthdayModal.demo();
                    const tourRoot = document.getElementById('tour-root');
                    if (tourRoot) tourRoot.style.zIndex = '10102';
                },
                onLeave: () => {
                    document.getElementById('company-bday-modal')?.remove();
                    document.getElementById('cbd-topbar-badge')?.remove();
                    document.getElementById('cbd-emoji-rain')?.remove();
                    const tourRoot = document.getElementById('tour-root');
                    if (tourRoot) tourRoot.style.zIndex = '99990';
                },
            },
            {
                icon: '🎉',
                title: 'Ваш день народження',
                text: 'Якщо сьогодні <strong>ваш день народження</strong> — портал зустріне вас ось таким святковим вікном при вході!',
                tipStyle: { top: '50%', bottom: 'auto', left: 'auto', right: '24px', transform: 'translateY(-50%)', width: '680px' },
                noBackdrop: true,
                onShow: () => {
                    BirthdayModal._show({ ...AppState.profile, birth_date: new Date().toISOString().slice(0,10) });
                    const tourRoot = document.getElementById('tour-root');
                    if (tourRoot) tourRoot.style.zIndex = '10100';
                },
                onLeave: () => {
                    // Закриваємо без анімації польоту — інакше лишається бейдж тортика в топбарі
                    const modal = document.getElementById('birthday-modal');
                    if (modal) { modal.style.transition = 'opacity .2s'; modal.style.opacity = '0'; setTimeout(() => { modal.remove(); document.getElementById('bd-topbar-cake')?.remove(); }, 220); }
                    const tourRoot = document.getElementById('tour-root');
                    if (tourRoot) tourRoot.style.zIndex = '99990';
                },
            },
            {
                target: '.nav-item[data-route="news"]',
                position: 'right',
                icon: '📰',
                title: 'Новини компанії',
                text: 'Розділ <strong>Новини</strong> доступний у бічному меню. А іконка 📣 у шапці показує лічильник нових новин — натисніть щоб побачити превью останньої без переходу в розділ.',
            },
            {
                target: '#ntf-bell',
                position: 'left',
                icon: '🛎️',
                title: 'Дзвоник сповіщень',
                text: 'Оновлення в реальному часі — нові призначення, нагадування, повідомлення від адміністрації. Число оновлюється автоматично.',
            },
            {
                target: '.sidebar-nav',
                position: 'right',
                icon: '🚀',
                title: 'Ви готові!',
                text: (() => {
                    const r = AppState.profile?.role;
                    const isStaff = ['owner','admin','smm','teacher'].includes(r);
                    const isMgr   = r === 'manager';
                    if (isStaff) return 'Досліджуйте портал через бокове меню: <strong>Skill Up</strong>, <strong>Новини</strong>, <strong>База знань</strong>, <strong>Документи</strong>, <strong>Меню порталу</strong>. В розділі <strong>Управління</strong> — аналітика, планування та адміністрування. Успіхів!';
                    if (isMgr)   return 'Досліджуйте портал через бокове меню: <strong>Skill Up</strong>, <strong>Новини</strong>, <strong>База знань</strong>, <strong>Документи</strong>. В розділі <strong>Управління</strong> є <strong>Розділ планування</strong>. Успіхів!';
                    return 'Досліджуйте портал через бокове меню. Успіхів!';
                })(),
            },
        ];

        if (localStorage.getItem('tour_done_dashboard')) return;
        this._injectTourDemo();
        TourManager.start('dashboard', steps, {
            force: true, // прапорець вже перевірили вище
            onDone: () => this._cleanupTourDemo(),
        });
    },

    _injectTourDemo() {
        const today = new Date().toISOString().slice(0, 10);

        // Документи для ознайомлення
        this._renderAlerts(
            [
                { id: 'demo-doc-1', title: 'Наказ №15 — Охорона праці 2026' },
                { id: 'demo-doc-2', title: 'Інструкція з обслуговування клієнтів' },
                { id: 'demo-doc-3', title: 'Положення про преміювання співробітників' },
            ],
            [
                { id: 'demo-ntf-1', title: 'Призначено новий тест', message: 'Оцінка техніки безпеки', type: 'test_assigned', is_read: false, link: 'my-tests' },
                { id: 'demo-ntf-2', title: 'Новий курс для вас', message: 'Клієнтський сервіс 2026', type: 'course_enrolled', is_read: false, link: 'courses' },
                { id: 'demo-ntf-3', title: 'Нагадування', message: 'Перегляньте оновлені документи', type: 'doc_reminder', is_read: false, link: 'documents' },
            ]
        );

        // Дні народження
        this._renderBirthdays([
            { id: 'b1', full_name: 'Іванченко Марія Петрівна', avatar_url: null, job_position: 'Менеджер', city: 'Київ' },
            { id: 'b2', full_name: 'Коваль Олексій Вікторович', avatar_url: null, job_position: 'Касир', city: 'Львів' },
        ]);

        // Важливі події
        this._renderImportantEvents([
            { id: 'ie1', title: 'Термінова нарада', date: today, time: '10:00', is_important: true, acked_date: null, color: '#ef4444' },
            { id: 'ie2', title: 'Дедлайн звіту Q2', date: today, time: '18:00', is_important: true, acked_date: null, color: '#f59e0b' },
        ], today);

        // Дзвоник сповіщень — показуємо бейдж
        UI._setNotificationBadge(5);

        // Іконка новин — показуємо бейдж і підставляємо демо-новину для popup
        UI._newsPopupLatest = {
            id: 'demo-news-1',
            title: 'Оновлення умов преміювання на 2026 рік',
            excerpt: 'Ознайомтесь з новими умовами нарахування премій та бонусів для всіх підрозділів.',
            thumbnail_url: null,
            thumbnail_position: 'center',
            published_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
        };
        const newsBadge = document.getElementById('news-bell-badge');
        const newsBell  = document.getElementById('news-bell');
        if (newsBadge) { newsBadge.textContent = '3'; newsBadge.classList.remove('hidden'); }
        if (newsBell)  newsBell.classList.add('has-unread');

        // Чат ДР компанії — рендеруємо картку щоб highlight спрацював на кроці
        const chatEl = document.getElementById('db-bday-chat');
        if (chatEl) CompanyBirthdayModal._renderChatCard(chatEl);

        this._tourDemoActive = true;
    },

    _cleanupTourDemo() {
        if (!this._tourDemoActive) return;
        this._tourDemoActive = false;
        UI._newsPopupLatest = null;
        document.getElementById('news-popup')?.remove();
        document.getElementById('birthday-modal')?.remove();
        document.getElementById('bd-topbar-cake')?.remove();
        // Відновлюємо реальні значення бейджів топбару
        UI.loadNotificationCount();
        UI.loadNewsCount();
        // Перезапускаємо init щоб відновити реальні дані
        const container = document.getElementById('page-content');
        if (container) this.init(container);
    },


    _renderRecentlyViewed() {
        const el = document.getElementById('db-recent-courses');
        if (!el) return;

        const items = RecentlyViewed.get().slice(0, 15);
        if (!items.length) { el.innerHTML = ''; return; }

        const typeLabel = { course: 'Курс', news: 'Новина', document: 'Документ', test: 'Тест', survey: 'Опитування', resource: 'Матеріал' };

        const cards = items.map(item => {
            const thumb = item.thumbnail ? Fmt.safeUrl(item.thumbnail) : null;
            const thumbBg = thumb
                ? `background-image:url('${thumb}')`
                : `background:linear-gradient(135deg,${item.color}33,${item.color}88)`;
            const thumbContent = thumb
                ? `<div class="dbrc-thumb-grad"></div>`
                : `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:2.5rem;opacity:.35;color:${item.color}"><i class="fa-solid ${item.icon}"></i></div><div class="dbrc-thumb-grad"></div>`;
            const badge = typeLabel[item.type] || item.type;
            const ago = (() => {
                const m = Math.floor((Date.now() - item.viewedAt) / 60000);
                if (m < 1) return 'щойно';
                if (m < 60) return `${m} хв тому`;
                const h = Math.floor(m / 60);
                if (h < 24) return `${h} год тому`;
                return `${Math.floor(h / 24)} дн тому`;
            })();
            return `
            <div class="dbrc-card" onclick="Router.go(${JSON.stringify(item.route).replace(/"/g,'&quot;')})">
                <div class="dbrc-thumb" style="${thumbBg}">
                    ${thumbContent}
                    <div class="dbrc-thumb-body">
                        <span class="dbrc-level" style="color:${item.color}">${badge.toUpperCase()}</span>
                        <div class="dbrc-title">${Fmt.esc(item.title)}</div>
                    </div>
                </div>
                <div class="dbrc-footer">
                    <i class="fa-solid ${item.icon}" style="font-size:.7rem;color:${item.color};flex-shrink:0"></i>
                    <span class="dbrc-ago">${ago}</span>
                </div>
            </div>`;
        }).join('');

        el.innerHTML = `
        <style>
            .dbrc-wrap{background:var(--bg-surface);border:1px solid var(--border);border-radius:var(--radius-xl);overflow:hidden;position:relative;display:flex;flex-direction:column;min-height:160px}
            .dbrc-wrap::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:#6366f1;z-index:1}
            .dbrc-head{display:flex;align-items:center;justify-content:space-between;padding:.75rem 1rem;border-bottom:1px solid var(--border);background:var(--bg-surface)}
            .dbrc-head-left{display:flex;align-items:center;gap:.55rem}
            .dbrc-head-icon{width:32px;height:32px;border-radius:9px;background:rgba(99,102,241,.12);color:#6366f1;display:flex;align-items:center;justify-content:center;font-size:.9rem;flex-shrink:0}
            .dbrc-head-title{font-size:.78rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--text-primary)}
            .dbrc-arrows{display:flex;gap:.35rem}
            .dbrc-arrow{width:28px;height:28px;border-radius:50%;border:1px solid var(--border);background:var(--bg-raised);color:var(--text-muted);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:.65rem;transition:all .15s;font-family:inherit}
            .dbrc-arrow:hover{border-color:#6366f1;color:#6366f1}
            .dbrc-scroll{display:flex;align-items:flex-start;gap:.75rem;overflow-x:auto;padding:.75rem 1rem;scrollbar-width:none;background:var(--bg-raised);flex:1}
            .dbrc-scroll::-webkit-scrollbar{display:none}
            .dbrc-card{flex:0 0 clamp(150px,14vw,185px);border-radius:var(--radius-lg);overflow:hidden;cursor:pointer;border:1px solid var(--border);transition:transform .18s,box-shadow .18s,border-color .18s;flex-shrink:0;background:var(--bg-surface);display:flex;flex-direction:column}
            .dbrc-card:hover{transform:translateY(-3px);box-shadow:0 8px 24px rgba(0,0,0,.14);border-color:#6366f1}
            .dbrc-thumb{height:100px;position:relative;background-size:cover;background-position:center;background-repeat:no-repeat;overflow:hidden;width:100%;flex-shrink:0}
            .dbrc-thumb-grad{position:absolute;bottom:0;left:0;right:0;height:75%;background:linear-gradient(to top,rgba(0,0,0,.88) 0%,rgba(0,0,0,.3) 60%,transparent 100%)}
            .dbrc-thumb-body{position:absolute;bottom:0;left:0;right:0;padding:.45rem .55rem;z-index:1}
            .dbrc-level{font-size:.56rem;font-weight:800;letter-spacing:.07em;display:block;margin-bottom:.12rem}
            .dbrc-title{font-size:.74rem;font-weight:700;color:#fff;line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
            .dbrc-footer{display:flex;align-items:center;gap:.4rem;padding:.4rem .55rem;border-top:1px solid var(--border);flex-shrink:0}
            .dbrc-ago{font-size:.65rem;color:var(--text-muted);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        </style>
        <div class="dbrc-wrap">
            <div class="dbrc-head">
                <div class="dbrc-head-left">
                    <div class="dbrc-head-icon"><i class="fa-solid fa-clock-rotate-left"></i></div>
                    <span class="dbrc-head-title">Нещодавно переглянуті</span>
                </div>
                <div class="dbrc-arrows">
                    <button class="dbrc-arrow" onclick="document.getElementById('dbrc-scroll').scrollBy({left:-240,behavior:'smooth'})">
                        <i class="fa-solid fa-chevron-left"></i>
                    </button>
                    <button class="dbrc-arrow" onclick="document.getElementById('dbrc-scroll').scrollBy({left:240,behavior:'smooth'})">
                        <i class="fa-solid fa-chevron-right"></i>
                    </button>
                </div>
            </div>
            <div class="dbrc-scroll" id="dbrc-scroll">${cards}</div>
        </div>`;

        // Size "recently viewed" wrap to natural content height (header + scroll padding + card)
        const _sizeRcWrap = () => {
            const wrap = el.querySelector('.dbrc-wrap');
            if (!wrap) return;
            wrap.style.height = 'auto';
        };
        requestAnimationFrame(() => { _sizeRcWrap(); setTimeout(_sizeRcWrap, 200); });
    },

    _renderCalWidget(calEvents, today, scheduleEntries = []) {
        const now = new Date();
        this._calViewYear   = now.getFullYear();
        this._calViewMonth  = now.getMonth();
        this._calViewEvents = calEvents;
        this._calViewToday  = today;
        this._calViewShifts = {};
        scheduleEntries.forEach(e => { this._calViewShifts[e.date] = e; });
        this._drawCalWidget();
    },

    async _addHolidayToCalendar(dateStr, title, emoji, btn) {
        if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; }
        const ok = await MyCalendarPage.addHolidayEvent(dateStr, title, emoji).catch(() => false);
        if (btn) {
            btn.innerHTML = ok
                ? '<i class="fa-solid fa-check"></i> Додано'
                : '<i class="fa-solid fa-bell"></i> Додати нагадування';
            btn.disabled = !ok;
            if (ok) { btn.style.background = 'rgba(16,185,129,.12)'; btn.style.color = '#10b981'; btn.style.borderColor = 'rgba(16,185,129,.3)'; }
        }
    },

    _holidaysViewMonth: null,
    _holidaysViewYear: null,

    _showHolidays(monthOffset = 0) {
        const monthNames = ['Січень','Лютий','Березень','Квітень','Травень','Червень','Липень','Серпень','Вересень','Жовтень','Листопад','Грудень'];
        const typeColors = {
            state:        { bg: 'rgba(0,91,187,.1)',   color: '#005BBB', border: 'rgba(0,91,187,.25)' },
            religious:    { bg: 'rgba(155,89,182,.1)', color: '#7c3aed', border: 'rgba(155,89,182,.25)' },
            memorial:     { bg: 'rgba(107,114,128,.1)',color: '#4b5563', border: 'rgba(107,114,128,.25)' },
            professional: { bg: 'rgba(39,174,96,.1)',  color: '#15803d', border: 'rgba(39,174,96,.25)' },
        };

        // Ініціалізуємо або зсуваємо місяць
        if (this._holidaysViewMonth === null) {
            this._holidaysViewMonth = this._calViewMonth;
            this._holidaysViewYear  = this._calViewYear;
        }
        this._holidaysViewMonth += monthOffset;
        if (this._holidaysViewMonth < 0)  { this._holidaysViewMonth = 11; this._holidaysViewYear--; }
        if (this._holidaysViewMonth > 11) { this._holidaysViewMonth = 0;  this._holidaysViewYear++; }

        const month = this._holidaysViewMonth;
        const year  = this._holidaysViewYear;
        const mm    = String(month + 1).padStart(2, '0');
        const pad2  = n => String(n).padStart(2, '0');

        const monthHolidays = Object.entries(UA_HOLIDAYS)
            .filter(([key]) => key.startsWith(mm + '-'))
            .sort(([a], [b]) => a.localeCompare(b));

        const items = monthHolidays.map(([key, h]) => {
            const day       = parseInt(key.split('-')[1]);
            const dateStr   = `${year}-${mm}-${pad2(day)}`;
            const c         = typeColors[h.type] || typeColors.professional;
            const safeTitle = JSON.stringify(h.name).replace(/"/g,'&quot;');
            const safeEmoji = JSON.stringify(h.emoji).replace(/"/g,'&quot;');
            return `
            <div style="display:flex;align-items:center;gap:.85rem;padding:.65rem .85rem;border-radius:var(--radius-md);border:1px solid ${c.border};background:${c.bg};margin-bottom:.45rem">
                <div style="width:44px;text-align:center;flex-shrink:0">
                    <div style="font-size:1.4rem;font-weight:800;color:${c.color};line-height:1">${day}</div>
                    <div style="font-size:.65rem;color:${c.color};opacity:.75;text-transform:uppercase;letter-spacing:.04em">${monthNames[month].slice(0,3)}</div>
                </div>
                <div style="font-size:1.3rem;flex-shrink:0">${h.emoji}</div>
                <div style="flex:1;min-width:0">
                    <div style="font-size:.875rem;font-weight:600;color:var(--text-primary);line-height:1.3">${h.name}</div>
                    <span style="font-size:.68rem;font-weight:700;color:${c.color};background:${c.bg};border:1px solid ${c.border};border-radius:20px;padding:.1rem .5rem;margin-top:.25rem;display:inline-block;text-transform:uppercase;letter-spacing:.04em">${h.tag}</span>
                </div>
                <button onclick="DashboardPage._addHolidayToCalendar('${dateStr}',${safeTitle},${safeEmoji},this)"
                    title="Додати нагадування в календар"
                    style="flex-shrink:0;border:1.5px solid ${c.border};background:var(--bg-surface);color:${c.color};border-radius:8px;padding:.3rem .6rem;cursor:pointer;font-size:.72rem;font-weight:600;font-family:inherit;transition:all .15s;display:flex;align-items:center;gap:.3rem;white-space:nowrap"
                    onmouseenter="this.style.background='${c.bg}'"
                    onmouseleave="this.style.background='var(--bg-surface)'">
                    <i class="fa-solid fa-bell" style="font-size:.68rem"></i> Додати нагадування
                </button>
            </div>`;
        }).join('');

        const listHtml = monthHolidays.length
            ? `<div style="max-height:65vh;overflow-y:auto;padding:.1rem 0">${items}</div>`
            : `<div style="text-align:center;padding:2.5rem;color:var(--text-muted)"><div style="font-size:2.5rem;margin-bottom:.5rem">🎉</div>Свят у цьому місяці немає</div>`;

        const navHtml = `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:.5rem .25rem .75rem;border-bottom:1px solid var(--border);margin-bottom:.75rem">
            <button class="btn btn-ghost btn-sm" onclick="DashboardPage._showHolidays(-1)">
                <i class="fa-solid fa-chevron-left"></i> ${monthNames[(month + 11) % 12]}
            </button>
            <span style="font-size:.95rem;font-weight:700;color:var(--text-primary)">${monthNames[month]} ${year}</span>
            <button class="btn btn-ghost btn-sm" onclick="DashboardPage._showHolidays(1)">
                ${monthNames[(month + 1) % 12]} <i class="fa-solid fa-chevron-right"></i>
            </button>
        </div>`;

        Modal.open({
            title: `Свята України — ${monthNames[month]} ${year}`,
            size: 'lg',
            body: navHtml + listHtml,
            footer: `<button class="btn btn-ghost" onclick="Modal.close();DashboardPage._holidaysViewMonth=null;">Закрити</button>`,
            onClose: () => { this._holidaysViewMonth = null; }
        });
    },

    async _calNav(dir) {
        this._calViewMonth += dir;
        if (this._calViewMonth < 0)  { this._calViewMonth = 11; this._calViewYear--; }
        if (this._calViewMonth > 11) { this._calViewMonth = 0;  this._calViewYear++; }
        const _p2 = n => String(n).padStart(2, '0');
        const _fl = d => `${d.getFullYear()}-${_p2(d.getMonth()+1)}-${_p2(d.getDate())}`;
        const ms = `${this._calViewYear}-${_p2(this._calViewMonth+1)}-01`;
        const me = _fl(new Date(this._calViewYear, this._calViewMonth + 1, 0));
        const [{ data }, shiftRes] = await Promise.all([
            supabase.from('personal_cal_events')
                .select('id,title,date,time,end_time,color,is_important,is_done,acked_date,repeat_type,remind_before_days')
                .eq('user_id', AppState.user.id)
                .gte('date', ms).lte('date', me)
                .order('date').order('time', { nullsFirst: true }),
            supabase.from('schedule_entries')
                .select('date,shift_type,notes,location_id,schedule_locations(name)')
                .eq('user_id', AppState.user.id)
                .gte('date', ms).lte('date', me)
                .then(r => r.data || []).catch(() => [])
        ]);
        this._calViewEvents = data || [];
        this._calViewShifts = {};
        (Array.isArray(shiftRes) ? shiftRes : []).forEach(e => { this._calViewShifts[e.date] = e; });
        this._drawCalWidget();
    },

    _drawCalWidget() {
        const el = document.getElementById('db-cal-widget');
        if (!el) return;
        const _prevOpen = { today: document.getElementById('db-cup-today-body')?.classList.contains('open') ?? true, future: document.getElementById('db-cup-future-body')?.classList.contains('open') ?? true };

        const { _calViewYear: year, _calViewMonth: month, _calViewEvents: calEvents, _calViewToday: today, _calViewShifts: shifts = {} } = this;
        const now = new Date();

        // Build event map by date
        const evByDate = {};
        calEvents.forEach(ev => {
            if (!evByDate[ev.date]) evByDate[ev.date] = [];
            evByDate[ev.date].push(ev);
        });

        // Month grid cells (Mon-first)
        const firstDay = new Date(year, month, 1);
        const lastDay  = new Date(year, month + 1, 0);
        let startDow = firstDay.getDay();
        if (startDow === 0) startDow = 7;
        startDow -= 1;

        const cells = [];
        const _pd = n => String(n).padStart(2, '0');
        const _fd = d => `${d.getFullYear()}-${_pd(d.getMonth()+1)}-${_pd(d.getDate())}`;
        for (let i = 0; i < startDow; i++) {
            const d = new Date(year, month, 1 - startDow + i);
            cells.push({ date: _fd(d), day: d.getDate(), other: true });
        }
        for (let d = 1; d <= lastDay.getDate(); d++) {
            cells.push({ date: `${year}-${_pd(month+1)}-${_pd(d)}`, day: d, other: false });
        }
        const tail = cells.length % 7 ? 7 - (cells.length % 7) : 0;
        for (let i = 1; i <= tail; i++) {
            cells.push({ date: `${year}-${_pd(month+1 > 11 ? 1 : month+2)}-${_pd(i)}`, day: i, other: true });
        }

        const dows = ['Пн','Вт','Ср','Чт','Пт','Сб','Нд'];
        const monthLabel = new Date(year, month, 1).toLocaleDateString('uk-UA', { month: 'long', year: 'numeric' });
        const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();

        const _shiftMeta = {
            work:     { color: '#10b981', label: 'Зміна' },
            day_off:  { color: '#8b5cf6', label: 'Підміна' },
            vacation: { color: '#f59e0b', label: 'Відпустка' },
            sick:     { color: '#ef4444', label: 'Лікарняний' },
        };
        const gridHtml = cells.map(c => {
            const evs = c.other ? [] : (evByDate[c.date] || []);
            const shift = !c.other ? shifts[c.date] : null;
            const isToday = c.date === today;
            const hasEv = !c.other && (evs.length || shift);
            const cls = ['db-cday',
                isToday ? 'db-today' : '',
                hasEv && !isToday ? 'db-has-ev' : '',
                c.other ? 'db-othm' : ''
            ].filter(Boolean).join(' ');
            const tips = [...evs.map(e => Fmt.esc(e.title))];
            if (shift && _shiftMeta[shift.shift_type]) tips.push(_shiftMeta[shift.shift_type].label);
            const tipAttr = tips.length ? ` title="${tips.join(', ')}"` : '';
            const dayOnclick = c.other ? `Router.go('my-calendar')` : `DashboardPage._calDayClick('${c.date}')`;
            const shiftDot = shift && _shiftMeta[shift.shift_type]
                ? `<span style="position:absolute;bottom:2px;left:50%;transform:translateX(-50%);width:5px;height:5px;border-radius:50%;background:${_shiftMeta[shift.shift_type].color}"></span>`
                : '';
            return `<div class="${cls}" style="position:relative" onclick="${dayOnclick}"${tipAttr}>${c.day}${shiftDot}</div>`;
        }).join('');

        const fmtBadge = dateStr => {
            const d = new Date(dateStr + 'T00:00:00');
            return { day: d.getDate(), mon: d.toLocaleDateString('uk-UA', { month: 'short' }).replace('.', '') };
        };

        const chipHtml = ev => {
            const color = ev.color || '#6366f1';
            const hex22 = color + '22';
            if (ev.is_important) return `<span class="db-cup-chip" style="background:rgba(245,158,11,.1);color:#b45309"><span class="db-cup-chip-dot" style="background:#f59e0b"></span>Важлива</span>`;
            if (ev.time) return `<span class="db-cup-chip" style="background:${hex22};color:${color}"><span class="db-cup-chip-dot" style="background:${color}"></span>${ev.time.slice(0, 5)}${ev.end_time ? '–' + ev.end_time.slice(0, 5) : ''}</span>`;
            if (ev.repeat_type && ev.repeat_type !== 'none') return `<span class="db-cup-chip" style="background:rgba(16,185,129,.1);color:#059669"><span class="db-cup-chip-dot" style="background:#10b981"></span>Повторюється</span>`;
            return `<span class="db-cup-chip" style="background:${hex22};color:${color}"><span class="db-cup-chip-dot" style="background:${color}"></span>Весь день</span>`;
        };

        // Shift chip helper
        const shiftChipHtml = shift => {
            const sm = _shiftMeta[shift.shift_type];
            if (!sm) return '';
            const loc = shift.schedule_locations?.name ? ` · ${Fmt.esc(shift.schedule_locations.name)}` : '';
            return `<span class="db-cup-chip" style="background:${sm.color}22;color:${sm.color}"><span class="db-cup-chip-dot" style="background:${sm.color}"></span>${sm.label}${loc}</span>`;
        };

        const todayShift = isCurrentMonth ? shifts[today] : null;

        // Split: today vs future
        const todayEvs  = isCurrentMonth
            ? calEvents.filter(ev => ev.date === today).sort((a, b) => (a.is_done ? 1 : 0) - (b.is_done ? 1 : 0) || (a.time || '').localeCompare(b.time || ''))
            : [];
        const futureEvs = calEvents
            .filter(ev => ev.date > today)
            .sort((a, b) => a.date.localeCompare(b.date) || (a.time || '').localeCompare(b.time || ''))
            .slice(0, 8);
        // Future shifts (up to 8 upcoming, excluding today)
        const futureShifts = Object.entries(shifts)
            .filter(([d]) => d > today)
            .sort(([a], [b]) => a.localeCompare(b))
            .slice(0, 8)
            .map(([, s]) => s);

        const todayItemHtml = ev => `
            <div class="db-cup-item${ev.is_done ? ' db-cup-done' : ''}" id="db-cal-ev-${ev.id}" onclick="DashboardPage._calToggleDone('${ev.id}',this.querySelector('.db-cup-check'))" style="cursor:pointer">
                <button class="db-cup-check${ev.is_done ? ' done' : ''}" onclick="event.stopPropagation();DashboardPage._calToggleDone('${ev.id}',this)" title="${ev.is_done ? 'Відновити' : 'Виконано'}">
                    <i class="fa-solid ${ev.is_done ? 'fa-rotate-left' : 'fa-check'}"></i>
                </button>
                <div class="db-cup-body" style="flex:1;min-width:0">
                    <div class="db-cup-name">${Fmt.esc(ev.title)}</div>
                    ${chipHtml(ev)}
                </div>
            </div>`;

        const futureItemHtml = ev => {
            const b = fmtBadge(ev.date);
            return `
            <div class="db-cup-item" onclick="DashboardPage._calEditEvent('${ev.id}')" style="cursor:pointer">
                <div class="db-cup-badge">
                    <span class="db-cup-bday">${b.day}</span>
                    <span class="db-cup-bmon">${b.mon}</span>
                </div>
                <div class="db-cup-body">
                    <div class="db-cup-name">${Fmt.esc(ev.title)}</div>
                    ${chipHtml(ev)}
                </div>
            </div>`;
        };

        const futureShiftItemHtml = s => {
            const b = fmtBadge(s.date);
            return `
            <div class="db-cup-item">
                <div class="db-cup-badge">
                    <span class="db-cup-bday">${b.day}</span>
                    <span class="db-cup-bmon">${b.mon}</span>
                </div>
                <div class="db-cup-body">
                    <div class="db-cup-name">Мій графік</div>
                    ${shiftChipHtml(s)}
                </div>
            </div>`;
        };

        const todayShiftHtml = todayShift
            ? `<div class="db-cup-item">
                <div style="width:36px;height:36px;border-radius:var(--radius-md);display:flex;align-items:center;justify-content:center;font-size:1rem;flex-shrink:0;background:${(_shiftMeta[todayShift.shift_type]?.color||'#6366f1')}22;color:${_shiftMeta[todayShift.shift_type]?.color||'#6366f1'}"><i class="fa-solid fa-briefcase"></i></div>
                <div class="db-cup-body" style="flex:1;min-width:0">
                    <div class="db-cup-name">Мій графік</div>
                    ${shiftChipHtml(todayShift)}
                </div>
               </div>` : '';

        const todayHasContent = todayEvs.length || todayShift;
        const todaySection = isCurrentMonth ? `
            <div class="db-cup-acc-hdr" onclick="DashboardPage._toggleAcc('db-cup-today-body')">
                <span>Сьогодні</span>
                <i class="fa-solid fa-chevron-down db-cup-acc-icon" id="db-cup-today-icon"></i>
            </div>
            <div class="db-cup-acc-body" id="db-cup-today-body">
                <div class="db-cup-list" id="db-cup-today">
                    ${todayShiftHtml}
                    ${todayEvs.length
                        ? todayEvs.map(todayItemHtml).join('')
                        : (!todayShift ? `<div class="db-cup-empty"><i class="fa-regular fa-calendar-check"></i> Вільний день</div>` : '')}
                </div>
            </div>` : '';

        // Merge future events + shifts, sorted by date, deduplicate by date preferring both
        const allFutureItems = [
            ...futureEvs.map(e => ({ _type: 'ev', _date: e.date, ev: e })),
            ...futureShifts.map(s => ({ _type: 'sh', _date: s.date, sh: s }))
        ].sort((a, b) => a._date.localeCompare(b._date)).slice(0, 10);

        const futureSection = allFutureItems.length ? `
            ${isCurrentMonth ? '<div style="height:1px;background:var(--border);margin:.25rem .9rem"></div>' : ''}
            <div class="db-cup-acc-hdr" onclick="DashboardPage._toggleAcc('db-cup-future-body')">
                <span>Майбутні події</span>
                <i class="fa-solid fa-chevron-down db-cup-acc-icon" id="db-cup-future-icon"></i>
            </div>
            <div class="db-cup-acc-body" id="db-cup-future-body">
                <div class="db-cup-list">
                    ${allFutureItems.map(it => it._type === 'ev' ? futureItemHtml(it.ev) : futureShiftItemHtml(it.sh)).join('')}
                </div>
            </div>` : '';

        el.innerHTML = `
            <div class="db-cal-w">
                <div class="db-cwrap">
                    <div class="db-cnav">
                        <div class="db-cnav-left">
                            <div class="db-cnav-title">Мій календар</div>
                            <div class="db-cnav-sub">${monthLabel}</div>
                        </div>
                        <div class="db-cnav-arrows">
                            <button class="db-cnav-btn" onclick="DashboardPage._calNav(-1)" title="Попередній місяць"><i class="fa-solid fa-chevron-left"></i></button>
                            <button class="db-cnav-btn" onclick="DashboardPage._calNav(1)" title="Наступний місяць"><i class="fa-solid fa-chevron-right"></i></button>
                            <button onclick="DashboardPage._showHolidays()" title="Свята України"
                                style="display:inline-flex;align-items:center;gap:.35rem;padding:.28rem .75rem;border-radius:20px;border:none;cursor:pointer;font-size:.78rem;font-weight:700;background:linear-gradient(135deg,#005BBB,#0073e6);color:#fff;box-shadow:0 2px 8px rgba(0,91,187,.35);transition:all .15s;letter-spacing:.02em;font-family:inherit"
                                onmouseenter="this.style.transform='translateY(-1px)';this.style.boxShadow='0 4px 14px rgba(0,91,187,.45)'"
                                onmouseleave="this.style.transform='';this.style.boxShadow='0 2px 8px rgba(0,91,187,.35)'">
                                🎉 <span>Свята</span>
                            </button>
                        </div>
                    </div>
                    <div class="db-cgrid">
                        ${dows.map(d => `<div class="db-cdow">${d}</div>`).join('')}
                        ${gridHtml}
                    </div>
                </div>
                <div class="db-cup-wrap">
                    ${todaySection}
                    ${futureSection}
                    ${!todayHasContent && !allFutureItems.length ? `<div class="db-cup-empty" style="padding:1.25rem"><i class="fa-regular fa-calendar-check"></i> Подій немає</div>` : ''}
                </div>
            </div>`;

        // restore accordion state
        const todayAllDone = todayEvs.length > 0 && todayEvs.every(ev => ev.is_done);
        const todayEmpty = todayEvs.length === 0;
        ['today','future'].forEach(key => {
            const body = document.getElementById(`db-cup-${key}-body`);
            const icon = document.getElementById(`db-cup-${key}-icon`);
            if (!body) return;
            let open;
            if (key === 'today') {
                // auto-close if empty or all done; otherwise restore previous state (default open)
                open = (todayEmpty || todayAllDone) ? false : (_prevOpen[key] !== false);
            } else {
                open = _prevOpen[key] !== false;
            }
            if (open) { body.classList.add('open'); if (icon) icon.style.transform = 'rotate(180deg)'; }
        });
    },

    async _getUnackedDocs() {
        const seeAll = AppState.isAdmin() || AppState.isManager();
        const { data } = await supabase.from('resources')
            .select('id, title, deadline_days, doc_version, resource_dovirenosti(dovirenost_id)')
            .eq('is_tracked_download', true)
            .is('deleted_at', null)
            .limit(50);
        if (!data?.length) return [];

        let filtered = data;
        if (!seeAll) {
            const myDovs = await API.dovirenosti.getForProfile(AppState.user.id).catch(() => []);
            const myDovIds = new Set(myDovs.map(d => d.id));
            filtered = data.filter(d => {
                const linked = d.resource_dovirenosti || [];
                if (!linked.length) return true; // no restriction — everyone sees it
                return linked.some(r => myDovIds.has(r.dovirenost_id));
            });
        }

        if (!filtered.length) return [];
        const ackMap = await API.documentDownloads.getMyLatest(filtered.map(d => d.id));
        // Unacked = never downloaded OR downloaded version is older than current
        return filtered.filter(d => {
            const ack = ackMap[d.id];
            if (!ack) return true;
            return (ack.version || 1) < (d.doc_version || 1);
        });
    },

    _renderImportantEvents(calEvents, today) {
        const el = document.getElementById('db-important');
        if (!el) return;
        const important = calEvents.filter(ev => ev.is_important && ev.date === today);
        if (!important.length) return;

        // Filter out already acknowledged (acked_date stored in DB)
        const pending = important.filter(ev => ev.acked_date !== today);
        if (!pending.length) return;

        // Lightning bolt badge on home nav icon
        const boltBadge = document.getElementById('nav-imp-bolt');
        if (boltBadge) boltBadge.classList.remove('hidden');

        el.innerHTML = `<style>
            @keyframes db-imp-pulse{0%,100%{opacity:1}50%{opacity:.6}}
            .db-imp-row{display:flex;flex-direction:column;gap:.75rem}
            .db-imp-bar{width:100%;position:relative;overflow:hidden;border-radius:var(--radius-xl);
                background:linear-gradient(100deg,#fffbeb,#fef3c7 60%,#fff7ed);
                border:1.5px solid rgba(245,158,11,.45);
                box-shadow:0 2px 16px rgba(245,158,11,.12),0 1px 4px rgba(0,0,0,.04)}
            body.dark-theme .db-imp-bar{background:linear-gradient(100deg,rgba(120,70,0,.35),rgba(100,50,0,.25) 60%,rgba(130,60,0,.2));border-color:rgba(245,158,11,.4)}
            .db-imp-stripe{position:absolute;left:0;top:0;bottom:0;width:4px;background:linear-gradient(to bottom,#f59e0b,#d97706)}
            .db-imp-inner{display:flex;align-items:center;gap:1.1rem;padding:.85rem 1.1rem .85rem 1.4rem}
            .db-imp-icon{width:38px;height:38px;border-radius:10px;background:linear-gradient(135deg,#f59e0b,#d97706);
                display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:1.1rem;
                box-shadow:0 3px 10px rgba(245,158,11,.35)}
            .db-imp-label{font-size:.65rem;font-weight:700;text-transform:uppercase;letter-spacing:.09em;color:#b45309;margin-bottom:.18rem}
            body.dark-theme .db-imp-label{color:#fbbf24}
            .db-imp-title{font-weight:700;font-size:.95rem;color:#1c1917;line-height:1.3}
            body.dark-theme .db-imp-title{color:#fef3c7}
            .db-imp-time{display:inline-flex;align-items:center;gap:.3rem;font-size:.73rem;color:#92400e;margin-top:.2rem;font-weight:500}
            body.dark-theme .db-imp-time{color:#fcd34d}
            .db-imp-ack{margin-left:auto;flex-shrink:0;display:inline-flex;align-items:center;gap:.45rem;
                padding:.5rem 1.1rem;border-radius:var(--radius-lg);border:none;cursor:pointer;
                font-size:.82rem;font-weight:700;font-family:inherit;
                background:linear-gradient(135deg,#f59e0b,#d97706);color:#fff;
                box-shadow:0 2px 8px rgba(245,158,11,.4);transition:opacity .15s,transform .1s}
            .db-imp-ack:hover{opacity:.9;transform:translateY(-1px)}
            .db-imp-ack:active{transform:translateY(0)}
        </style><div class="db-imp-row">` + pending.map(ev => `
            <div id="db-imp-${ev.id}" class="db-imp-bar">
                <div class="db-imp-stripe"></div>
                <div class="db-imp-inner">
                    <div class="db-imp-icon"><i class="fa-solid fa-bolt" style="color:#fff;filter:drop-shadow(0 1px 3px rgba(0,0,0,.25))"></i></div>
                    <div style="flex:1;min-width:0">
                        <div class="db-imp-label">Важлива подія сьогодні</div>
                        <div class="db-imp-title">${Fmt.esc(ev.title)}</div>
                        ${ev.time ? `<div class="db-imp-time"><i class="fa-regular fa-clock"></i>${ev.time.slice(0,5)}</div>` : ''}
                    </div>
                    <button class="db-imp-ack" onclick="DashboardPage._ackImportant('${ev.id}','${today}')" title="Підтверджую">
                        <i class="fa-solid fa-check"></i>
                    </button>
                </div>
            </div>`).join('') + `</div>`;
    },


    async _ackImportant(eventId, date) {
        const { error } = await supabase.from('personal_cal_events')
            .update({ acked_date: date, is_done: true })
            .eq('id', eventId).eq('user_id', AppState.user.id);
        if (error) { Toast.error('Помилка збереження'); return; }
        const el = document.getElementById(`db-imp-${eventId}`);
        if (el) { el.style.transition = 'opacity .3s'; el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }
    },

    _showDayPlanPopup(scheduleEntries, calEvents, today) {
        // Show once per day per user
        const storageKey = `dayplan_shown_${AppState.user.id}_${today}`;
        if (localStorage.getItem(storageKey)) return;

        const _pad = n => String(n).padStart(2,'0');
        const todayD = new Date();
        const tomorrowD = new Date(todayD); tomorrowD.setDate(tomorrowD.getDate() + 1);
        const tomorrow = `${tomorrowD.getFullYear()}-${_pad(tomorrowD.getMonth()+1)}-${_pad(tomorrowD.getDate())}`;

        const shiftMeta = { work:{label:'Робоча зміна',color:'#10b981',icon:'fa-briefcase'}, day_off:{label:'Вихідний',color:'#8b5cf6',icon:'fa-couch'}, vacation:{label:'Відпустка',color:'#f59e0b',icon:'fa-umbrella-beach'}, sick:{label:'Лікарняний',color:'#ef4444',icon:'fa-house-medical'} };

        const todayShift    = scheduleEntries.find(e => e.date === today);
        const tomorrowShift = scheduleEntries.find(e => e.date === tomorrow);
        const todayEvs      = calEvents.filter(e => e.date === today);
        const tomorrowEvs   = calEvents.filter(e => e.date === tomorrow);

        // Nothing to show
        if (!todayShift && !tomorrowShift && !todayEvs.length && !tomorrowEvs.length) return;

        const _shiftRow = (s) => {
            if (!s) return '';
            const m = shiftMeta[s.shift_type] || shiftMeta.work;
            const loc = s.schedule_locations?.name ? ` · ${Fmt.esc(s.schedule_locations.name)}` : '';
            return `<div class="dp-row">
                <div class="dp-dot" style="background:${m.color}"></div>
                <div class="dp-rtext">
                    <span class="dp-rtitle">${m.label}${loc}</span>
                    ${s.notes ? `<span class="dp-rsub">${Fmt.esc(s.notes)}</span>` : ''}
                </div>
            </div>`;
        };
        const _evRow = (ev, dateLabel) => {
            const c = ev.color || '#6366f1';
            const time = ev.time ? `${ev.time.slice(0,5)}` : '';
            const meta = [dateLabel, time].filter(Boolean).join(' · ');
            return `<div class="dp-row">
                <div class="dp-dot" style="background:${c}"></div>
                <div class="dp-rtext">
                    <span class="dp-rtitle">${Fmt.esc(ev.title)}</span>
                    ${meta ? `<span class="dp-rsub" style="color:${c};font-weight:600">${meta}</span>` : ''}
                </div>
            </div>`;
        };

        const ua = new Date().toLocaleDateString('uk-UA',{weekday:'long',day:'numeric',month:'long'});
        const ub = tomorrowD.toLocaleDateString('uk-UA',{weekday:'long',day:'numeric',month:'long'});

        const todayShort    = todayD.toLocaleDateString('uk-UA',{day:'numeric',month:'short'});
        const tomorrowShort = tomorrowD.toLocaleDateString('uk-UA',{day:'numeric',month:'short'});

        const secToday = (todayShift || todayEvs.length) ? `
            <div class="dp-day-hdr"><i class="fa-solid fa-sun"></i> Сьогодні · ${ua}</div>
            <div class="dp-day-rows">
                ${_shiftRow(todayShift)}
                ${todayEvs.map(e => _evRow(e, todayShort)).join('')}
            </div>` : '';

        const secTomorrow = (tomorrowShift || tomorrowEvs.length) ? `
            <div class="dp-day-hdr" style="margin-top:.75rem"><i class="fa-regular fa-moon"></i> Завтра · ${ub}</div>
            <div class="dp-day-rows">
                ${_shiftRow(tomorrowShift)}
                ${tomorrowEvs.map(e => _evRow(e, tomorrowShort)).join('')}
            </div>` : '';

        const body = `<style>
            .dp-wrap{padding:.25rem 0}
            .dp-day-hdr{font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--text-muted);margin-bottom:.45rem;display:flex;align-items:center;gap:.4rem}
            .dp-day-rows{display:flex;flex-direction:column;gap:.3rem}
            .dp-row{display:flex;align-items:flex-start;gap:.65rem;padding:.35rem .5rem;border-radius:var(--radius-md);background:var(--bg-raised)}
            .dp-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0;margin-top:.28rem}
            .dp-rtext{display:flex;flex-direction:column;gap:.1rem;min-width:0}
            .dp-rtitle{font-size:.85rem;font-weight:600;color:var(--text-primary)}
            .dp-rsub{font-size:.72rem;color:var(--text-muted)}
        </style>
        <div class="dp-wrap">${secToday}${secTomorrow}</div>`;

        setTimeout(async () => {
            // Не показуємо якщо вже відкрито нагадування з календаря
            // showTodayReminder стартує за 300мс + async запити — чекаємо достатньо
            if (window._calPopupShown) return;
            window._dashPopupShown = true;
            Modal.open({
                title: '📅 План на сьогодні і завтра',
                body,
                footer: `<button class="btn btn-primary" onclick="Modal.close();window._dashPopupShown=false;">Зрозуміло</button>`,
                size: 'sm',
                onClose: () => { window._dashPopupShown = false; }
            });
            localStorage.setItem(storageKey, '1');
        }, 1500);
    },

    _renderAlerts(unackedDocs, recentNotifs) {
        const docsEl  = document.getElementById('db-alerts-docs');
        const notifEl = document.getElementById('db-alerts-notif');
        const unreadCount = recentNotifs.length;

        if (docsEl) {
            const hasIssue = unackedDocs.length > 0;
            if (!hasIssue) { docsEl.style.display = 'none'; }
            else { docsEl.style.display = ''; }
            const accentDoc = hasIssue ? '#ef4444' : '#10b981';
            const iconBg    = hasIssue ? 'rgba(239,68,68,.12)' : 'rgba(16,185,129,.12)';
            const badgeHtml = hasIssue
                ? `<span class="db-alc-badge" style="background:rgba(239,68,68,.12);color:#ef4444">${unackedDocs.length}</span>`
                : `<span class="db-alc-badge" style="background:rgba(16,185,129,.12);color:#10b981"><i class="fa-solid fa-check"></i></span>`;

            const body = hasIssue
                ? `${unackedDocs.slice(0, 9).map(d => `
                    <div class="db-alc-doc-item" onclick="Router.go('resource/${d.id}?from=documents')">
                        <div class="db-alc-doc-icon"><i class="fa-regular fa-file-lines"></i></div>
                        <span class="db-alc-doc-name">${Fmt.esc(d.title)}</span>
                        <i class="fa-solid fa-chevron-right" style="font-size:.6rem;color:var(--text-muted);flex-shrink:0"></i>
                    </div>`).join('')}
                  ${unackedDocs.length > 9 ? `<div class="db-alc-doc-more" onclick="Router.go('documents')">ще ${unackedDocs.length - 9} документів <i class="fa-solid fa-arrow-right"></i></div>` : ''}`
                : `<div class="db-alc-empty">
                    <div class="db-alc-empty-bubble" style="background:rgba(16,185,129,.1);color:#10b981">
                        <i class="fa-solid fa-shield-check"></i>
                    </div>
                    <div class="db-alc-empty-title">Документи в порядку</div>
                    <div class="db-alc-empty-sub">Ви ознайомлені з усіма документами</div>
                   </div>`;

            const docSubtitle = hasIssue
                ? `${unackedDocs.length} потребу${unackedDocs.length === 1 ? 'є' : 'ють'} ознайомлення`
                : 'Всі документи ознайомлені';
            docsEl.innerHTML = `
                <div class="db-alc-w" style="--alc-accent:${accentDoc}">
                    <div class="db-alc-head">
                        <div class="db-alc-head-left">
                            <div class="db-alc-head-icon" style="background:${iconBg};color:${accentDoc}">
                                <i class="fa-regular fa-file-lines"></i>
                            </div>
                            <div class="db-alc-head-info" style="gap:.25rem">
                                <span class="db-alc-head-title">Документи</span>
                                ${hasIssue ? `<span class="db-alc-head-sub" style="margin-top:.15rem">${unackedDocs.length} потребу${unackedDocs.length === 1 ? 'є' : 'ють'} ознайомлення</span>` : ''}
                            </div>
                        </div>
                        <div class="db-alc-head-right">
                            ${badgeHtml}
                            <button class="db-alc-goto" onclick="Router.go('documents')" title="Перейти до документів">
                                <i class="fa-solid fa-arrow-right"></i>
                            </button>
                        </div>
                    </div>
                    <div class="db-alc-body">${body}</div>
                </div>`;
        }

        if (notifEl) {
            if (unreadCount === 0) {
                notifEl.style.display = 'none';
            } else {
                notifEl.style.display = '';
            }
            if (unreadCount > 0) {
            const typeMap = t => {
                if (!t) return { icon:'fa-bell', color:'#8b5cf6', bg:'rgba(139,92,246,.12)' };
                if (t.includes('test'))   return { icon:'fa-clipboard-list',  color:'#f59e0b', bg:'rgba(245,158,11,.12)' };
                if (t.includes('course') || t.includes('enroll')) return { icon:'fa-graduation-cap', color:'#3b82f6', bg:'rgba(59,130,246,.12)' };
                if (t.includes('survey')) return { icon:'fa-chart-bar',       color:'#8b5cf6', bg:'rgba(139,92,246,.12)' };
                if (t.includes('doc') || t.includes('resource')) return { icon:'fa-file-lines', color:'#ef4444', bg:'rgba(239,68,68,.12)' };
                return { icon:'fa-bell', color:'#6366f1', bg:'rgba(99,102,241,.12)' };
            };
            const accentNotif = unreadCount > 0 ? '#6366f1' : '#10b981';
            const badgeNotif = unreadCount > 0
                ? `<span class="db-alc-badge" style="background:rgba(99,102,241,.12);color:#6366f1">${unreadCount}</span>`
                : `<span class="db-alc-badge" style="background:rgba(16,185,129,.12);color:#10b981"><i class="fa-solid fa-check"></i></span>`;

            const body = unreadCount > 0
                ? `<div class="db-alc-notif-meta">
                        <span style="font-size:.72rem;color:var(--text-muted)">${unreadCount} непрочитаних</span>
                        <span style="font-size:.7rem;color:var(--primary);cursor:pointer;font-weight:600" onclick="DashboardPage._dismissNotifAlert()">
                            <i class="fa-solid fa-check-double"></i> Прочитати всі
                        </span>
                   </div>
                   <div id="db-alc-notif">
                        ${recentNotifs.slice(0, 5).map(n => {
                            const m = typeMap(n.type);
                            return `<div class="db-alc-nitem" id="db-ntf-${n.id}" data-link="${Fmt.esc(n.link || 'notifications')}" onclick="DashboardPage._openNotif('${n.id}',this.dataset.link)">
                                <div class="db-alc-nicon" style="background:${m.bg};color:${m.color}"><i class="fa-solid ${m.icon}"></i></div>
                                <div style="flex:1;min-width:0">
                                    <div class="db-alc-ntitle">${Fmt.esc(n.title)}</div>
                                    ${n.message ? `<div class="db-alc-nmsg">${Fmt.esc(n.message)}</div>` : ''}
                                </div>
                                <button class="db-ntf-check" onclick="event.stopPropagation();DashboardPage._markNotifRead('${n.id}')" title="Відмітити прочитаним">
                                    <i class="fa-solid fa-check"></i>
                                </button>
                            </div>`;
                        }).join('')}
                        ${recentNotifs.length > 5 ? `<div class="db-alc-more-row" onclick="Router.go('notifications')">ще ${recentNotifs.length - 5}… <i class="fa-solid fa-arrow-right"></i></div>` : ''}
                   </div>`
                : `<div class="db-alc-empty">
                    <div class="db-alc-empty-bubble" style="background:rgba(16,185,129,.1);color:#10b981">
                        <i class="fa-solid fa-bell-slash"></i>
                    </div>
                    <div class="db-alc-empty-title">Немає сповіщень</div>
                    <div class="db-alc-empty-sub">Усі сповіщення прочитані</div>
                   </div>`;

            notifEl.innerHTML = `
                <div class="db-alc-w" style="--alc-accent:${accentNotif}">
                    <div class="db-alc-head">
                        <div class="db-alc-head-left">
                            <div class="db-alc-head-icon" style="background:rgba(99,102,241,.12);color:#6366f1">
                                <i class="fa-regular fa-bell"></i>
                            </div>
                            <span class="db-alc-head-title">Сповіщення</span>
                        </div>
                        ${badgeNotif}
                    </div>
                    <div class="db-alc-body">${body}</div>
                </div>`;
            } // end if unreadCount > 0
        }

    },

    async _calToggleDone(eventId, btn) {
        const item = document.getElementById(`db-cal-ev-${eventId}`);
        if (!item) return;
        const isDone = item.classList.contains('db-cup-done');
        const newDone = !isDone;
        await supabase.from('personal_cal_events').update({ is_done: newDone }).eq('id', eventId).eq('user_id', AppState.user.id);
        item.classList.toggle('db-cup-done', newDone);
        btn.classList.toggle('done', newDone);
        btn.innerHTML = `<i class="fa-solid ${newDone ? 'fa-rotate-left' : 'fa-check'}"></i>`;
        btn.title = newDone ? 'Відновити' : 'Виконано';
        // Move to bottom of today list
        const list = document.getElementById('db-cup-today');
        if (list) {
            if (newDone) list.appendChild(item);
            else list.prepend(item);
        }
    },

    _calEditEvent(eventId) {
        if (!document.getElementById('mc-styles')) {
            document.head.insertAdjacentHTML('beforeend', MyCalendarPage._styles().replace('<style>', '<style id="mc-styles">'));
        }
        const ev = (this._calViewEvents || []).find(e => e.id === eventId);
        if (!ev) return;
        MyCalendarPage._events = this._calViewEvents || [];
        MyCalendarPage._openEventModal(ev.date, eventId);
    },

    _calDayClick(date) {
        if (!document.getElementById('mc-styles')) {
            document.head.insertAdjacentHTML('beforeend', MyCalendarPage._styles().replace('<style>', '<style id="mc-styles">'));
        }
        MyCalendarPage._openEventModal(date);
    },

    _toggleAcc(bodyId) {
        const body = document.getElementById(bodyId);
        if (!body) return;
        const isOpen = body.classList.toggle('open');
        const iconId = bodyId.replace('-body', '-icon');
        const icon = document.getElementById(iconId);
        if (icon) icon.style.transform = isOpen ? 'rotate(180deg)' : '';
    },

    async _refreshCalWidget() {
        if (!document.getElementById('db-cal-widget')) return;
        const now = new Date();
        const year  = this._calViewYear  ?? now.getFullYear();
        const month = this._calViewMonth ?? now.getMonth();
        if (!this._calViewYear)  this._calViewYear  = year;
        if (!this._calViewMonth && this._calViewMonth !== 0) this._calViewMonth = month;
        if (!this._calViewToday) {
            const _p = n => String(n).padStart(2, '0');
            this._calViewToday = `${now.getFullYear()}-${_p(now.getMonth()+1)}-${_p(now.getDate())}`;
        }
        const _p2 = n => String(n).padStart(2, '0');
        const ms = `${year}-${_p2(month+1)}-01`;
        const me = `${year}-${_p2(month+1)}-${_p2(new Date(year, month+1, 0).getDate())}`;
        const { data } = await supabase.from('personal_cal_events')
            .select('id,title,date,time,end_time,color,is_important,is_done,acked_date,repeat_type,remind_before_days')
            .eq('user_id', AppState.user.id)
            .gte('date', ms).lte('date', me)
            .order('date').order('time', { nullsFirst: true });
        this._calViewEvents = data || [];
        this._drawCalWidget();
    },

    async _openNotif(id, link) {
        const ok = await API.notifications.markRead(id).then(() => true).catch(() => false);
        if (ok) UI.updateNotificationBadge(-1);
        Router.go(link);
    },

    async _markNotifRead(id) {
        const ok = await API.notifications.markRead(id).then(() => true).catch(() => false);
        if (ok) UI.updateNotificationBadge(-1);
        const el = document.getElementById(`db-ntf-${id}`);
        if (el) {
            el.style.transition = 'opacity .25s, transform .25s';
            el.style.opacity = '0';
            el.style.transform = 'translateX(12px)';
            setTimeout(() => {
                el.remove();
                // if no more notif items left — hide whole widget
                const container = document.getElementById('db-alc-notif');
                if (container && !container.querySelector('.db-alc-nitem')) {
                    this._hideNotifWidget();
                }
            }, 260);
        }
    },

    _hideNotifWidget() {
        const notifEl = document.getElementById('db-alerts-notif');
        if (!notifEl) return;
        notifEl.style.transition = 'opacity .3s';
        notifEl.style.opacity = '0';
        setTimeout(() => { notifEl.style.display = 'none'; notifEl.style.opacity = ''; notifEl.style.transition = ''; }, 310);
    },

    async _dismissNotifAlert() {
        await API.notifications.markAllRead().catch(() => {});
        UI.loadNotificationCount();
        this._hideNotifWidget();
    },

    _renderBirthdays(people) {
        const el = document.getElementById('db-birthdays');
        if (!el || !people.length) return;

        this._bdayPeople = people;

        const cards = people.map((p, i) => {
            const initials = Fmt.initials(p.full_name || '?');
            const fallbackHtml = `<span style="font-size:1.1rem;font-weight:800;color:#fff;line-height:1">${Fmt.esc(initials)}</span>`;
            const avatarHtml = p.avatar_url
                ? `<img src="${p.avatar_url}" alt="${Fmt.esc(p.full_name)}" style="width:100%;height:100%;object-fit:cover;display:block"
                       onerror="this.replaceWith(Object.assign(document.createElement('span'),{innerHTML:'${Fmt.esc(initials)}',style:'font-size:1.1rem;font-weight:800;color:#fff;line-height:1'}))">`
                : fallbackHtml;
            return `
                <div class="db-bday-card" style="animation-delay:${i * 0.07}s">
                    <div class="db-bday-avatar-ring">
                        <div class="db-bday-avatar">${avatarHtml}</div>
                    </div>
                    <div class="db-bday-info">
                        <div class="db-bday-name">${Fmt.esc(p.full_name || '—')}</div>
                        ${p.job_position ? `<div class="db-bday-pos">${Fmt.esc(p.job_position)}</div>` : ''}
                    </div>
                    ${p.id !== AppState.user?.id ? `
                    <button class="db-bday-wish-btn"
                        data-bday-btn="${p.id}"
                        onclick="DashboardPage._openWishModal('${p.id}')">
                        💌 Привітати
                    </button>` : `<span class="db-bday-self-badge">🎂 Це ви!</span>`}
                </div>`;
        }).join('');

        el.innerHTML = `
            <style>
                @keyframes db-confetti-fall{0%{transform:translateY(-10px) rotate(0deg);opacity:1}100%{transform:translateY(60px) rotate(720deg);opacity:0}}
                @keyframes db-bday-glow{0%,100%{box-shadow:0 0 0 0 rgba(245,158,11,.5)}50%{box-shadow:0 0 0 8px rgba(245,158,11,0)}}
                @keyframes db-bday-pop{0%{transform:scale(.82) translateY(6px);opacity:0}100%{transform:scale(1) translateY(0);opacity:1}}
                @keyframes db-wish-in{0%{transform:translateY(12px);opacity:0}100%{transform:translateY(0);opacity:1}}
                .db-bday-wrap{display:flex;align-items:center;width:100%;position:relative;overflow:hidden;border-radius:var(--radius-xl);
                    margin-bottom:1.5rem;gap:1.25rem;padding:.9rem 1.5rem;
                    background:linear-gradient(100deg,#fffbeb 0%,#fef3c7 45%,#fff7ed 100%);
                    border:1.5px solid rgba(245,158,11,.45);
                    box-shadow:0 2px 20px rgba(245,158,11,.1),0 1px 4px rgba(0,0,0,.04)}
                body.dark-theme .db-bday-wrap{background:linear-gradient(100deg,rgba(120,80,0,.4) 0%,rgba(160,100,0,.28) 50%,rgba(120,70,0,.32) 100%);border-color:rgba(245,158,11,.4)}
                .db-bday-confetti{position:absolute;top:0;left:0;right:0;bottom:0;pointer-events:none;overflow:hidden}
                .db-bday-conf-dot{position:absolute;border-radius:2px;animation:db-confetti-fall linear infinite}
                .db-bday-left{display:flex;align-items:center;gap:.9rem;flex-shrink:0}
                .db-bday-icon-box{width:52px;height:52px;border-radius:14px;
                    background:linear-gradient(135deg,#f59e0b,#d97706);
                    display:flex;align-items:center;justify-content:center;font-size:1.55rem;
                    box-shadow:0 4px 14px rgba(245,158,11,.45);flex-shrink:0}
                .db-bday-headline{font-size:.95rem;font-weight:800;color:#92400e;letter-spacing:-.01em;line-height:1.2}
                body.dark-theme .db-bday-headline{color:#fcd34d}
                .db-bday-sub{font-size:.72rem;color:#b45309;opacity:.8;margin-top:.15rem}
                body.dark-theme .db-bday-sub{color:#fbbf24}
                .db-bday-divider{width:1px;height:48px;background:rgba(245,158,11,.35);flex-shrink:0}
                .db-bday-scroll{display:flex;gap:.75rem;overflow-x:auto;flex:1;align-items:center;scrollbar-width:none;padding:.1rem 0}
                .db-bday-scroll::-webkit-scrollbar{display:none}
                .db-bday-card{display:flex;align-items:center;gap:.65rem;flex-shrink:0;
                    padding:.5rem .85rem .5rem .55rem;border-radius:var(--radius-lg);
                    background:rgba(255,255,255,.7);border:1px solid rgba(245,158,11,.25);
                    animation:db-bday-pop .4s ease both;transition:box-shadow .15s,border-color .15s}
                body.dark-theme .db-bday-card{background:rgba(255,255,255,.06);border-color:rgba(245,158,11,.2)}
                .db-bday-card:hover{box-shadow:0 4px 16px rgba(245,158,11,.18);border-color:rgba(245,158,11,.5)}
                .db-bday-avatar-ring{width:46px;height:46px;border-radius:50%;padding:2px;
                    background:linear-gradient(135deg,#f59e0b,#ef4444,#ec4899);
                    animation:db-bday-glow 2.2s ease-in-out infinite;flex-shrink:0}
                .db-bday-avatar{width:100%;height:100%;border-radius:50%;
                    background:linear-gradient(135deg,#f59e0b,#d97706);
                    display:flex;align-items:center;justify-content:center;overflow:hidden;border:2px solid #fff}
                .db-bday-info{min-width:0}
                .db-bday-name{font-size:.82rem;font-weight:700;color:#1c1917;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:150px}
                body.dark-theme .db-bday-name{color:#fef3c7}
                .db-bday-pos{font-size:.68rem;color:#78350f;opacity:.8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:150px;margin-top:.1rem}
                body.dark-theme .db-bday-pos{color:#fcd34d;opacity:.65}
                .db-bday-wish-btn{display:inline-flex;align-items:center;gap:.35rem;
                    background:linear-gradient(135deg,#f59e0b,#d97706);color:#fff;border:none;
                    border-radius:var(--radius-md);padding:.38rem .85rem;font-size:.76rem;font-weight:700;
                    cursor:pointer;transition:opacity .15s,transform .1s;white-space:nowrap;font-family:inherit;
                    flex-shrink:0;box-shadow:0 2px 8px rgba(245,158,11,.35)}
                .db-bday-wish-btn:hover{opacity:.9;transform:translateY(-1px)}
                .db-bday-wish-btn:active{transform:translateY(0)}
                .db-bday-wish-btn:disabled{opacity:.45;cursor:default;transform:none}
                .db-bday-self-badge{display:inline-flex;align-items:center;gap:.3rem;font-size:.72rem;font-weight:700;
                    background:rgba(245,158,11,.18);border:1px solid rgba(245,158,11,.35);border-radius:999px;
                    padding:.25rem .7rem;color:#92400e;white-space:nowrap;flex-shrink:0}
                body.dark-theme .db-bday-self-badge{color:#fcd34d;background:rgba(245,158,11,.12)}
            </style>
            <div class="db-bday-wrap">
                <div class="db-bday-confetti" id="db-bday-conf"></div>
                <div class="db-bday-left">
                    <div class="db-bday-icon-box">🎂</div>
                    <div>
                        <div class="db-bday-headline">День народження!</div>
                        <div class="db-bday-sub">Вітаємо колег з особливим днем</div>
                    </div>
                </div>
                <div class="db-bday-divider"></div>
                <div class="db-bday-scroll">${cards}</div>
            </div>`;

        const confEl = document.getElementById('db-bday-conf');
        if (confEl) {
            const colors = ['#f59e0b','#ef4444','#ec4899','#8b5cf6','#10b981','#3b82f6','#f97316'];
            for (let i = 0; i < 32; i++) {
                const d = document.createElement('div');
                d.className = 'db-bday-conf-dot';
                d.style.cssText = `left:${Math.random()*100}%;top:${Math.random()*-20}%;background:${colors[i%colors.length]};width:${5+Math.random()*7}px;height:${5+Math.random()*7}px;animation-duration:${2.5+Math.random()*3}s;animation-delay:${Math.random()*4}s`;
                confEl.appendChild(d);
            }
        }
    },

    _openWishModal(personId) {
        const p = (this._bdayPeople || []).find(x => x.id === personId);
        if (!p) return;
        Modal.open({
            title: `🎂 Привітання для ${Fmt.esc(p.full_name || '?')}`,
            size: 'sm',
            body: `
                <div style="margin-bottom:.65rem;font-size:.82rem;color:var(--text-muted)">
                    Привітання прийде у сповіщення іменинника
                </div>
                <textarea id="db-bday-wish-text" rows="4" style="width:100%;border:1px solid var(--border);
                    border-radius:var(--radius-md);padding:.65rem .85rem;font-size:.9rem;line-height:1.55;
                    resize:none;background:var(--bg-surface);color:var(--text-primary);font-family:inherit;
                    box-sizing:border-box;outline:none;transition:border-color .15s"
                    placeholder="Щиро вітаю з Днем народження! Бажаю…"
                    onfocus="this.style.borderColor='var(--primary)'" onblur="this.style.borderColor='var(--border)'"></textarea>`,
            footer: `
                <button class="btn btn-secondary" onclick="Modal.close()">Скасувати</button>
                <button class="btn btn-primary" id="db-bday-send-btn"
                    onclick="DashboardPage._sendBdayWish('${personId}', this)"
                    style="background:linear-gradient(135deg,#f59e0b,#d97706);border-color:transparent">
                    🎊 Надіслати
                </button>`
        });
        setTimeout(() => document.getElementById('db-bday-wish-text')?.focus(), 100);
    },

    async _sendBdayWish(personId, btn) {
        const text = (document.getElementById('db-bday-wish-text')?.value || '').trim();
        if (!text) { Toast.warning('Порожнє поле', 'Напишіть привітання перед відправкою'); return; }
        btn.disabled = true;
        btn.textContent = 'Надсилаю…';
        const from = AppState.profile?.full_name || 'Колега';
        const p = (this._bdayPeople || []).find(x => x.id === personId);
        try {
            await API.notifications.create({
                user_id: personId,
                title: `🎂 Привітання від ${from}`,
                message: text,
                type: 'birthday_wish',
                link: null
            });
            Modal.close();
            const btn = document.querySelector(`[data-bday-btn="${personId}"]`);
            if (btn) { btn.textContent = '✅ Надіслано'; btn.disabled = true; btn.style.opacity = '.5'; }
            Toast.success('Надіслано! 🎉', `Привітання для ${p?.full_name || ''} відправлено`);
        } catch(e) {
            btn.disabled = false;
            btn.textContent = '🎊 Надіслати';
            Toast.error('Помилка', e.message);
        }
    },

    async _dismissNews(newsId, btn) {
        // Заповнити кнопку жовтим
        if (btn) {
            btn.disabled = true;
            btn.style.background = '#f59e0b';
            btn.style.color = '#fff';
            btn.style.borderColor = '#f59e0b';
            btn.innerHTML = '<i class="fa-solid fa-bell-slash"></i> Збережено';
        }

        // Зберегти в базу
        const current = AppState.profile?.dismissed_news || [];
        if (!current.includes(newsId)) {
            const updated = [...current, newsId];
            try {
                await API.profiles.update(AppState.user.id, { dismissed_news: updated });
                if (AppState.profile) AppState.profile.dismissed_news = updated;
            } catch(e) { /* не критично */ }
        }

        // Затухання модалки через 1.5с
        setTimeout(() => {
            const backdrop = document.getElementById('modal-backdrop');
            const container = document.getElementById('modal-container');
            if (backdrop)  { backdrop.style.transition  = 'opacity .4s'; backdrop.style.opacity  = '0'; }
            if (container) { container.style.transition = 'opacity .4s, transform .4s'; container.style.opacity = '0'; container.style.transform = 'scale(.95)'; }
            setTimeout(() => {
                Modal.close();
                if (backdrop)  { backdrop.style.transition  = ''; backdrop.style.opacity  = ''; }
                if (container) { container.style.transition = ''; container.style.opacity = ''; container.style.transform = ''; }
            }, 400);
        }, 1500);
    },


    _renderWelcome(enrollments, testsCount = 0, surveysCount = 0) {
        const el = document.getElementById('db-welcome');
        if (!el) return;

        const role = AppState.profile?.role || 'user';
        const accent = { owner:'#2563eb', admin:'#2563eb', smm:'#ec4899', teacher:'#10b981', manager:'#f59e0b', user:'#3b82f6' }[role] || '#3b82f6';

        const fullName  = AppState.profile?.full_name || '';
        const parts = fullName.trim().split(/\s+/);
        const firstName = parts[1] || parts[0] || 'Привіт';
        const h = new Date().getHours();
        const greeting  = h < 6 ? 'Добраніч' : h < 12 ? 'Доброго ранку' : h < 18 ? 'Добрий день' : 'Добрий вечір';

        const avatar   = AppState.profile?.avatar_url;
        const initials = Fmt.initials(fullName || '?');
        const avatarHtml = avatar
            ? `<img src="${avatar}" style="width:100%;height:100%;object-fit:cover;display:block">`
            : `<span style="font-size:.85rem;font-weight:800;color:#fff;line-height:1">${Fmt.esc(initials)}</span>`;

        const next  = enrollments.find(e => !e.completed_at && (e.progress_percentage || 0) > 0)
                   || enrollments.find(e => !e.completed_at);
        const incompleteCount = enrollments.filter(e => !e.completed_at).length;
        const pct   = next?.progress_percentage || 0;
        const title = next?.course?.title || '';
        const cid   = next?.course?.id || '';

        const courseHtml = next ? `
            <div class="dbw-sep"></div>
            <div class="dbw-course-block">
                <span class="dbw-course-hint">Незавершений курс</span>
                <span class="dbw-course-name">${Fmt.esc(title)}</span>
            </div>
            <div class="dbw-pbar-wrap">
                <div class="dbw-pbar"><div class="dbw-pbar-fill" style="width:${pct}%;background:${accent}"></div></div>
                <span class="dbw-pct">${pct}%</span>
            </div>
            <button class="dbw-btn" style="--ac:${accent}" onclick="Router.go('courses/${cid}?from=expert-path')">
                <i class="fa-solid fa-play"></i> Продовжити
            </button>` : `
            <div class="dbw-sep"></div>
            <span class="dbw-course-hint">🏆 Всі курси завершено</span>
            <button class="dbw-btn" style="--ac:${accent}" onclick="Router.go('courses')">Знайти нові <i class="fa-solid fa-arrow-right"></i></button>`;

        const _cap = n => n > 9 ? '9+' : String(n);
        const _courseLabel = n => n === 1 ? 'курс' : n < 5 ? 'курси' : 'курсів';
        const _testLabel   = n => n === 1 ? 'тест' : n < 5 ? 'тести' : 'тестів';
        const _hex2rgb = h => [parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)].join(',');
        const chipDefs = [
            { icon:'fa-book-open',             count:incompleteCount, label:`${_cap(incompleteCount)} ${_courseLabel(incompleteCount)}`, route:'expert-path', color:'#6366f1', title:'Незавершені курси' },
            { icon:'fa-file-pen',              count:testsCount,      label:`${_cap(testsCount)} ${_testLabel(testsCount)}`,             route:'my-tests',    color:'#f59e0b', title:'Тести' },
            { icon:'fa-square-poll-horizontal', count:surveysCount,    label:`${_cap(surveysCount)} опитувань`,                           route:'expert-path', color:'#8b5cf6', title:'Опитування' },
        ];
        const chips = chipDefs.map(c => {
            const done = c.count === 0;
            const col  = done ? '#10b981' : c.color;
            const rgb  = _hex2rgb(col);
            return `<button class="dbw-chip" style="--cc:${col};--cc-rgb:${rgb}" onclick="Router.go('${c.route}')" title="${c.title}">
                <i class="fa-solid ${c.icon}"></i>${c.label}${done ? '<i class="fa-solid fa-check dbw-chip-check"></i>' : ''}
            </button>`;
        });
        const chipsHtml = `<div class="dbw-sep"></div><div class="dbw-chips">${chips.join('')}</div>`;

        el.innerHTML = `
        <style>
            @keyframes dbw-in{0%{opacity:0;transform:translateY(-6px)}100%{opacity:1;transform:translateY(0)}}
            .db-welcome-bar{display:flex;align-items:center;gap:1rem;padding:.75rem 1.25rem;
                background:var(--bg-surface);border:1px solid var(--border);border-radius:var(--radius-xl);
                margin-bottom:0.85rem;border-left:4px solid ${accent};
                box-shadow:var(--shadow-sm);animation:dbw-in .3s ease both;flex-wrap:wrap;
                position:relative;overflow:hidden}
            .dbw-deco{position:absolute;right:0;top:0;height:100%;width:min(65%,620px);pointer-events:none;flex-shrink:0}
            .dbw-ava{width:36px;height:36px;border-radius:50%;overflow:hidden;flex-shrink:0;
                background:${accent};display:flex;align-items:center;justify-content:center}
            .dbw-greet{font-size:.8rem;color:var(--text-muted);flex-shrink:0}
            .dbw-greet strong{color:var(--text-primary);font-weight:700}
            .dbw-sep{width:1px;height:20px;background:var(--border);flex-shrink:0}
            .dbw-course-block{display:flex;flex-direction:column;min-width:0}
            .dbw-course-hint{font-size:.68rem;color:var(--text-muted);font-weight:600;text-transform:uppercase;letter-spacing:.05em;line-height:1}
            .dbw-course-name{font-size:.82rem;font-weight:600;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:clamp(140px,18vw,260px)}
            .dbw-pbar-wrap{display:flex;align-items:center;gap:.5rem;flex-shrink:0}
            .dbw-pbar{width:clamp(60px,8vw,100px);height:5px;background:var(--bg-raised);border-radius:3px;overflow:hidden;flex-shrink:0}
            .dbw-pbar-fill{height:100%;border-radius:3px;transition:width .6s ease}
            .dbw-pct{font-size:.72rem;font-weight:700;color:var(--text-muted);min-width:26px}
            .dbw-btn{display:inline-flex;align-items:center;gap:.35rem;background:var(--ac,${accent});
                border:none;border-radius:var(--radius-md);color:#fff;padding:.38rem .85rem;
                font-size:.78rem;font-weight:700;cursor:pointer;font-family:inherit;
                transition:opacity .15s,transform .1s;flex-shrink:0;white-space:nowrap}
            .dbw-btn:hover{opacity:.88;transform:translateY(-1px)}
            .dbw-btn:active{transform:translateY(0)}
            .dbw-chips{display:flex;gap:.4rem;align-items:center;flex-wrap:wrap}
            .dbw-chip{display:inline-flex;align-items:center;gap:.35rem;
                border-radius:999px;padding:.28rem .75rem;
                font-size:.8rem;font-weight:700;line-height:1;
                color:var(--cc);
                background:rgba(var(--cc-rgb),.09);
                border:1px solid rgba(var(--cc-rgb),.28);
                cursor:pointer;font-family:inherit;white-space:nowrap;
                transition:all .18s ease}
            .dbw-chip:hover{background:rgba(var(--cc-rgb),.16);border-color:rgba(var(--cc-rgb),.55);
                box-shadow:0 0 0 3px rgba(var(--cc-rgb),.12);transform:translateY(-1px)}
            .dbw-chip:active{transform:translateY(0)}
            .dbw-chip-check{font-size:.58rem;margin-left:.1rem}
        </style>
        <div class="db-welcome-bar">
            <div class="dbw-ava">${avatarHtml}</div>
            <div class="dbw-greet">${greeting}, <strong>${Fmt.esc(firstName)}!</strong></div>
            ${courseHtml}
            ${chipsHtml}
            <svg class="dbw-deco" viewBox="0 0 620 80" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" preserveAspectRatio="xMaxYMid slice">
                <defs>
                    <filter id="dbw-f-glow" x="-60%" y="-60%" width="220%" height="220%">
                        <feGaussianBlur stdDeviation="18"/>
                    </filter>
                    <linearGradient id="dbw-g-fade" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%"   stop-color="${accent}" stop-opacity="0"/>
                        <stop offset="40%"  stop-color="${accent}" stop-opacity="0.04"/>
                        <stop offset="100%" stop-color="${accent}" stop-opacity="0.10"/>
                    </linearGradient>
                </defs>
                <!-- background gradient wash -->
                <rect x="0" y="0" width="620" height="80" fill="url(#dbw-g-fade)"/>
                <!-- glow blobs -->
                <circle cx="530" cy="40" r="70" fill="${accent}" fill-opacity="0.11" filter="url(#dbw-f-glow)"/>
                <circle cx="320" cy="20" r="35" fill="${accent}" fill-opacity="0.07" filter="url(#dbw-f-glow)"/>
                <!-- main ring group — right anchor -->
                <circle cx="560" cy="40" r="130" fill="none" stroke="${accent}" stroke-width=".5"  opacity="0.08"/>
                <circle cx="560" cy="40" r="100" fill="none" stroke="${accent}" stroke-width=".7"  opacity="0.11"/>
                <circle cx="560" cy="40" r="74"  fill="none" stroke="${accent}" stroke-width="1.0" opacity="0.16"/>
                <circle cx="560" cy="40" r="50"  fill="none" stroke="${accent}" stroke-width="1.3" opacity="0.22"/>
                <circle cx="560" cy="40" r="30"  fill="none" stroke="${accent}" stroke-width="1.7" opacity="0.30"/>
                <circle cx="560" cy="40" r="14"  fill="${accent}" fill-opacity="0.16"/>
                <circle cx="560" cy="40" r="5.5" fill="${accent}" fill-opacity="0.35"/>
                <!-- mid ring cluster -->
                <circle cx="370" cy="55" r="52"  fill="none" stroke="${accent}" stroke-width=".6"  opacity="0.09"/>
                <circle cx="370" cy="55" r="34"  fill="none" stroke="${accent}" stroke-width=".9"  opacity="0.13"/>
                <circle cx="370" cy="55" r="18"  fill="none" stroke="${accent}" stroke-width="1.1" opacity="0.18"/>
                <circle cx="370" cy="55" r="6.5" fill="${accent}" fill-opacity="0.13"/>
                <!-- small top cluster -->
                <circle cx="270" cy="12" r="28"  fill="none" stroke="${accent}" stroke-width=".6"  opacity="0.09"/>
                <circle cx="270" cy="12" r="15"  fill="none" stroke="${accent}" stroke-width=".9"  opacity="0.13"/>
                <circle cx="270" cy="12" r="5"   fill="${accent}" fill-opacity="0.12"/>
                <!-- scattered dots -->
                <circle cx="200" cy="62" r="2.8" fill="${accent}" fill-opacity="0.20"/>
                <circle cx="240" cy="38" r="1.8" fill="${accent}" fill-opacity="0.15"/>
                <circle cx="310" cy="68" r="2.2" fill="${accent}" fill-opacity="0.18"/>
                <circle cx="430" cy="8"  r="2.5" fill="${accent}" fill-opacity="0.18"/>
                <circle cx="460" cy="70" r="1.8" fill="${accent}" fill-opacity="0.14"/>
                <circle cx="490" cy="14" r="2.0" fill="${accent}" fill-opacity="0.16"/>
                <circle cx="185" cy="20" r="1.5" fill="${accent}" fill-opacity="0.12"/>
            </svg>
        </div>`;
    },


    _renderNewsWidget(items) {
        const el = document.getElementById('db-news-widget');
        if (!el) return;

        items.forEach(n => { this._newsCache[n.id] = n; });

        let body = '';
        if (!items.length) {
            body = `<div class="db-news-empty"><i class="fa-regular fa-newspaper" style="font-size:2rem;opacity:.3"></i><span>Новин поки немає</span></div>`;
        } else {
            const [hero, ...rest] = items;
            const heroUrl = Fmt.safeUrl(hero.thumbnail_url);
            const heroImg = hero.thumbnail_url
                ? `<img class="db-news-hero-img" src="${heroUrl}" alt="" loading="lazy">`
                : `<div class="db-news-hero-ph">📰</div>`;
            const pinnedBadge = hero.is_pinned ? `<span class="db-news-hero-badge">Закріплено</span><br>` : '';
            body = `
                <div class="db-news-hero" onclick="DashboardPage._openNewsModal('${hero.id}')">
                    ${heroImg}
                    <div class="db-news-hero-grad"></div>
                    <div class="db-news-hero-body">
                        ${pinnedBadge}
                        <div class="db-news-hero-title">${Fmt.esc(hero.title)}</div>
                        <div class="db-news-hero-date">${Fmt.dateShort(hero.published_at || hero.created_at)}</div>
                    </div>
                </div>
                <div class="db-news-rows">
                    ${rest.slice(0, 3).map(n => `
                        <div class="db-news-row" onclick="DashboardPage._openNewsModal('${n.id}')">
                            <div class="db-news-row-dot"></div>
                            <span class="db-news-row-title">${Fmt.esc(n.title)}</span>
                            <span class="db-news-row-date">${Fmt.dateShort(n.published_at || n.created_at)}</span>
                        </div>`).join('')}
                </div>`;
        }

        el.innerHTML = `
            <div class="db-news-w">
                <div class="db-news-w-head">
                    <div class="db-news-w-head-left">
                        <div class="db-news-w-icon"><i class="fa-regular fa-newspaper"></i></div>
                        <span class="db-news-w-title">Новини</span>
                    </div>
                    <button class="btn btn-ghost btn-sm" onclick="Router.go('news')" style="font-size:.68rem">Всі <i class="fa-solid fa-arrow-right"></i></button>
                </div>
                ${body}
            </div>`;
    },

    destroy() {
        document.getElementById('page-content')?.classList.remove('no-scroll');
    },

    _newsCache: {},

    async _toggleEmoji(newsId, emoji, btn) {
        try {
            const { added, prev } = await API.news.toggleEmoji(newsId, emoji);
            const wrap = btn.closest(`#dnm-reactions-${newsId}`);
            // Deactivate previous reaction if switched
            if (prev && prev !== emoji && wrap) {
                const prevBtn = wrap.querySelector(`[data-emoji="${prev}"]`);
                if (prevBtn) {
                    prevBtn.classList.remove('active');
                    const c = prevBtn.querySelector('.dnm-r-count');
                    c.textContent = Math.max(0, (parseInt(c.textContent) || 0) - 1) || '';
                }
            }
            btn.classList.toggle('active', added);
            const countEl = btn.querySelector('.dnm-r-count');
            let count = parseInt(countEl.textContent) || 0;
            countEl.textContent = (added ? count + 1 : Math.max(0, count - 1)) || '';
            btn.style.transform = 'scale(1.25)';
            setTimeout(() => { btn.style.transform = ''; }, 200);
        } catch(e) { Toast.error('Помилка', e.message); }
    },

    async _toggleNewsBm(id, title, btn) {
        await Bookmarks.toggleNews(id, title);
        const bookmarked = Bookmarks.isBookmarked(`news/${id}`);
        btn.classList.toggle('bookmarked', bookmarked);
        btn.innerHTML = bookmarked ? '<i class="fa-solid fa-bookmark"></i>' : '<i class="fa-regular fa-bookmark"></i>';
        btn.style.transform = 'scale(1.3)';
        setTimeout(() => { btn.style.transform = ''; }, 200);
    },

    async _openNewsModal(id) {
        let n = this._newsCache[id];
        if (!n) {
            try {
                const { data } = await API.news.getById(id);
                n = data;
                this._newsCache[id] = n;
            } catch(e) { Toast.error('Помилка завантаження новини'); return; }
        }

        const url = n.thumbnail_url ? Fmt.safeUrl(n.thumbnail_url) : null;
        const pos = n.thumbnail_position || 'center';
        const date = Fmt.date(n.published_at || n.created_at);

        const body = `
        <style>
        .dnm-wrap { font-family: inherit; }
        .dnm-hero {
            width: calc(100% + 3rem);
            margin: -1.5rem -1.5rem 1.25rem;
            height: 220px;
            background: #0f1f42;
            position: relative;
            overflow: hidden;
        }
        .dnm-hero-bg {
            position: absolute; inset: -12px;
            background-image: url('${url || ''}');
            background-size: cover;
            background-position: ${pos};
            filter: blur(18px) brightness(.35);
            transform: scale(1.1);
        }
        .dnm-hero-img {
            position: absolute; inset: 0;
            background-image: url('${url || ''}');
            background-size: contain;
            background-repeat: no-repeat;
            background-position: center;
            z-index: 1;
        }
        .dnm-hero-grad {
            position: absolute; inset: 0;
            background: linear-gradient(to top, rgba(0,0,0,.7) 0%, transparent 60%);
            z-index: 2;
        }
        .dnm-meta {
            display: flex; align-items: center; justify-content: space-between;
            margin-bottom: .75rem;
        }
        .dnm-date {
            font-size: .75rem;
            color: var(--text-muted);
            display: flex; align-items: center; gap: .4rem;
        }
        .dnm-bm-btn {
            background: none; border: none; cursor: pointer;
            font-size: 1.15rem; color: var(--text-muted);
            transition: color .2s, transform .2s;
            padding: .2rem .4rem;
            border-radius: 6px;
            line-height: 1;
        }
        .dnm-bm-btn:hover { color: var(--primary); transform: scale(1.15); }
        .dnm-bm-btn.bookmarked { color: #f59e0b; }
        .dnm-bm-btn.bookmarked:hover { color: #d97706; }
        .dnm-reactions { display: flex; gap: .4rem; flex-wrap: wrap; margin-bottom: 1rem; }
        .dnm-reaction {
            display: inline-flex; align-items: center; gap: .3rem;
            padding: .25rem .6rem;
            border-radius: 99px;
            border: 1.5px solid var(--border);
            background: var(--bg-raised);
            cursor: pointer; font-size: .95rem;
            transition: all .18s cubic-bezier(.4,0,.2,1);
            user-select: none;
        }
        .dnm-reaction:hover { border-color: var(--primary); background: rgba(37,99,235,.07); transform: scale(1.08); }
        .dnm-reaction.active { border-color: #f59e0b; background: rgba(245,158,11,.12); }
        .dnm-reaction .dnm-r-count { font-size: .72rem; font-weight: 600; color: var(--text-muted); min-width: 8px; }
        .dnm-content { position: relative; max-height: 220px; overflow: hidden; }
        .dnm-content::after { content:''; position:absolute; bottom:0; left:0; right:0; height:60px; background:linear-gradient(to bottom, transparent, var(--bg-surface)); pointer-events:none; }
        .dnm-footer { display: flex; justify-content: flex-end; gap: .5rem; padding-top: .5rem; }
        </style>
        <div class="dnm-wrap">
            ${url ? `<div class="dnm-hero"><div class="dnm-hero-bg"></div><div class="dnm-hero-img"></div><div class="dnm-hero-grad"></div></div>` : ''}
            <div class="dnm-meta">
                <div class="dnm-date"><i class="fa-regular fa-calendar"></i> ${date}</div>
                <button class="dnm-bm-btn ${Bookmarks.isBookmarked(`news/${n.id}`) ? 'bookmarked' : ''}" id="dnm-bm-${n.id}" onclick="DashboardPage._toggleNewsBm('${n.id}', ${JSON.stringify(n.title).replace(/"/g,'&quot;')}, this)" title="Закладки">
                    ${Bookmarks.isBookmarked(`news/${n.id}`) ? '<i class="fa-solid fa-bookmark"></i>' : '<i class="fa-regular fa-bookmark"></i>'}
                </button>
            </div>
            <div class="dnm-reactions" id="dnm-reactions-${n.id}">
                ${['👍','❤️','😂','😮','👏','🔥'].map(e => `
                <button class="dnm-reaction" data-emoji="${e}" onclick="DashboardPage._toggleEmoji('${n.id}', '${e}', this)">
                    ${e} <span class="dnm-r-count">0</span>
                </button>`).join('')}
            </div>
            <div class="dnm-content news-content-body">${n.content || n.excerpt || ''}</div>
        </div>`;

        const dismissed   = AppState.profile?.dismissed_news || [];
        const showDismiss = id === this._featuredNewsId && !dismissed.includes(id);

        const dismissBtn = showDismiss
            ? `<button class="btn btn-ghost btn-sm" id="dnm-dismiss-btn" style="color:#92400e;font-size:.75rem;border:1px solid #f59e0b;border-radius:var(--radius-md);transition:background .3s,color .3s"
                onclick="DashboardPage._dismissNews('${n.id}', this)"
                title="Ця новина більше не з'являтиметься при вході">
                <i class="fa-regular fa-bell-slash"></i> Не нагадувати
               </button>`
            : '';

        const footer = `
        <div class="dnm-footer" style="justify-content:space-between;width:100%">
            ${dismissBtn}
            <div style="display:flex;gap:.5rem;margin-left:auto">
                <button class="btn btn-ghost btn-sm" onclick="Modal.close()">Закрити</button>
                <button class="btn btn-primary btn-sm" onclick="Modal.close();Router.go('news/${n.slug || n.id}')">
                    Читати повністю <i class="fa-solid fa-arrow-right"></i>
                </button>
            </div>
        </div>`;

        RecentlyViewed.track({ type: 'news', id: n.id, title: n.title, thumbnail: n.thumbnail_url || null, route: `news/${n.slug || n.id}`, color: '#f59e0b', icon: 'fa-newspaper' });
        Modal.open({ title: Fmt.esc(n.title), body, footer, size: 'lg' });

        // завантажити реакції
        API.news.getEmojiReactions(n.id).then(({ counts, myEmojis }) => {
            const wrap = document.getElementById(`dnm-reactions-${n.id}`);
            if (!wrap) return;
            const btns = [...wrap.querySelectorAll('.dnm-reaction')];
            btns.forEach(btn => {
                const e = btn.dataset.emoji;
                btn.querySelector('.dnm-r-count').textContent = counts[e] || '';
                if (myEmojis.has(e)) btn.classList.add('active');
            });
            const sorted = [...btns].sort((a, b) => (counts[b.dataset.emoji] || 0) - (counts[a.dataset.emoji] || 0));
            sorted.forEach(btn => wrap.appendChild(btn));
        }).catch(() => {});

        // вау-анімація появи модального вікна
        requestAnimationFrame(() => {
            const box = document.getElementById('modal-box');
            if (!box) return;
            box.style.opacity = '0';
            box.style.transform = 'translateY(30px) scale(0.97)';
            box.style.transition = 'none';
            requestAnimationFrame(() => {
                box.style.transition = 'opacity .4s cubic-bezier(.4,0,.2,1), transform .4s cubic-bezier(.34,1.56,.64,1)';
                box.style.opacity = '1';
                box.style.transform = 'translateY(0) scale(1)';
            });
        });
    },

};
