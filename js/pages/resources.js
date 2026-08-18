// ================================================================
// EduFlow LMS — Модуль ресурсів / База знань
// ================================================================

const ResourcesPage = {
    _page: 0,
    _search: '',
    _category: '',
    _courseId: '',
    _view: 'kb',
    _pageSize: APP_CONFIG.pageSize,
    _courses: [],
    _categories: [],
    _accessGroups: [],
    _resourceFile: null,
    _myDownloads: {},
    _myLocations: [],
    _activeTab: 'registry',
    _pendingResource: null,
    _pendingDownloadFile: false,
    _kbViewMode: localStorage.getItem('kb_view') || 'grid',
    _kbSort: 'newest',
    _kbTypeFilter: 'all',
    _kbCatFilter: 'all',
    _kbPageSize: 10,
    _kbAllItems: [],
    _uploadQueue: [],
    _docsSort: 'priority',
    _docsTreeStatus: '',
    _docsTreeTov: '',
    _docsShowAll: false,
    _allDovirenosti: [],
    _myDovirenosti: [],

    async init(container, { view = 'kb', tab = '', cat = '' } = {}) {
        this._initTab = tab;
        this._initCat = cat;
        this._page = 0;
        this._search = '';
        this._category = '';
        this._courseId = '';
        this._view = view;
        this._resourceFile = null;
        this._myDownloads = {};
        this._myLocations = [];
        this._activeTab = view === 'docs' ? 'registry' : 'list';

        if (view === 'admin' && !AppState.isStaff()) {
            Toast.error('Заборонено', 'Тільки адміністратори та викладачі можуть керувати ресурсами');
            Router.go('dashboard');
            return;
        }

        if (view === 'docs' && AppState.isIntern()) {
            Router.go('dashboard');
            return;
        }

        if (view === 'kb' && (AppState.isIntern() || AppState.profile?.role === 'user')) {
            Router.go('dashboard');
            return;
        }

        if (view === 'kb' && !AccessRestrictions.canAccess('knowledge-base')) {
            UI.setBreadcrumb([{ label: 'База знань' }]);
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">🔒</div>
                    <h3>Доступ обмежено</h3>
                    <p>У вас немає доступу до розділу «База знань».</p>
                </div>`;
            return;
        }

        if (view === 'docs' && !AccessRestrictions.canAccess('documents')) {
            UI.setBreadcrumb([{ label: 'Документи' }]);
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">🔒</div>
                    <h3>Доступ обмежено</h3>
                    <p>У вас немає доступу до розділу «Документи».</p>
                </div>`;
            return;
        }

        if (view === 'docs') {
            UI.setBreadcrumb([{ label: 'Документи' }]);
            const isManager = AppState.canSchedule();
            container.innerHTML = `
                <div class="page-header">
                    <div class="page-title">
                        <h1>📋 Документи</h1>
                        <p>Обов'язкові документи для ознайомлення та підтвердження</p>
                    </div>
                    <div class="page-actions">
                        <div style="display:flex;gap:.75rem;flex-wrap:wrap;align-items:center">
                        ${AppState.isStaff() && AppState.canMutate() ? '<button class="btn btn-primary" onclick="ResourcesPage.openForm()"><i class="fa-solid fa-plus"></i> Додати</button>' : ''}
                            ${AppState.isSuperAdmin() ? '<button class="btn btn-ghost btn-sm" onclick="ResourcesPage._openTrash()" title="Кошик"><i class="fa-solid fa-trash"></i> Кошик</button>' : ''}
                        ${HelpTip.render('docs', {
                    icon: 'fa-file-lines',
                    gradient: '135deg,#ef4444,#f97316',
                    title: 'Як користуватись розділом «Документи»',
                    items: [
                        { icon: 'fa-eye', text: 'Перегляньте документ — натисніть на нього, щоб відкрити та ознайомитись.' },
                        { icon: 'fa-check-circle', color: '#10b981', text: 'Після прочитання підтвердіть ознайомлення кнопкою «Ознайомився». Це знімає сповіщення на дашборді.' },
                        { icon: 'fa-circle-exclamation', color: '#ef4444', text: 'Документи з червоним індикатором — нові або оновлені, потребують підтвердження.' },
                        { icon: 'fa-magnifying-glass', text: 'Використовуйте пошук та фільтр категорій для швидкого знаходження потрібного документа.' },
                        { icon: 'fa-plus', color: '#8b5cf6', text: 'Кнопка «Додати» дозволяє завантажити новий документ для всієї команди.', roles: ['staff'] },
                        { icon: 'fa-chart-bar', color: '#6366f1', text: 'Вкладка «Статус» — показує хто з команди ознайомився з кожним документом.', roles: ['manager'] },
                    ]
                })}
                    </div>
                </div>
                </div>
                <style>
                .dtab-bar{display:flex;align-items:center;gap:.3rem;background:var(--bg-surface);border:1px solid var(--border);
                    border-radius:var(--radius-xl);padding:.4rem;margin-bottom:1.25rem;overflow-x:auto;scrollbar-width:none;
                    flex-wrap:wrap;box-shadow:0 2px 12px rgba(15,23,42,.05)}
                body:not(.light-theme) .dtab-bar{box-shadow:0 2px 16px rgba(0,0,0,.22)}
                .dtab-bar::-webkit-scrollbar{display:none}
                .dtab-sep{width:1px;height:22px;background:var(--border);margin:0 .15rem;flex-shrink:0}
                .dtab{display:inline-flex;align-items:center;gap:.5rem;padding:.42rem .95rem .42rem .42rem;font-size:.85rem;
                    font-weight:600;font-family:inherit;color:var(--text-muted);background:none;border:none;
                    border-radius:var(--radius-lg);cursor:pointer;white-space:nowrap;
                    transition:background .18s ease,color .18s ease,transform .12s ease;flex-shrink:0}
                .dtab:hover{color:var(--text-primary);background:var(--bg-hover);transform:translateY(-1px)}
                .dtab:active{transform:translateY(0)}
                .dtab.active{color:var(--tab-accent,var(--primary));
                    background:color-mix(in srgb,var(--tab-accent,var(--primary)) 14%,var(--bg-surface));font-weight:700}
                .dtab.active .dtab-ic{background:color-mix(in srgb,var(--tab-accent,var(--primary)) 22%,transparent);
                    color:var(--tab-accent,var(--primary))}
                .dtab-ic{width:28px;height:28px;border-radius:9px;display:flex;align-items:center;justify-content:center;
                    font-size:.92rem;background:var(--bg-hover);color:var(--text-muted);transition:all .18s ease;flex-shrink:0}
                .dtab-ic-registry{background:color-mix(in srgb,#6366f1 14%,transparent);color:#6366f1}
                .dtab-ic-branch{background:color-mix(in srgb,#10b981 14%,transparent);color:#10b981}
                .dtab-ic-npa{background:color-mix(in srgb,#f59e0b 14%,transparent);color:#f59e0b}
                .dtab-ic-nakaz{background:color-mix(in srgb,#3b82f6 14%,transparent);color:#3b82f6}
                .dtab-ic-rozp{background:color-mix(in srgb,#a855f7 14%,transparent);color:#a855f7}
                .dtab-ic-all{background:color-mix(in srgb,#6b7280 14%,transparent);color:#6b7280}
                .dtab-ic-status{background:color-mix(in srgb,#14b8a6 14%,transparent);color:#14b8a6}
                .dtab-ic-red{background:color-mix(in srgb,#ef4444 14%,transparent);color:#ef4444}
                .res-ic-wrap{position:relative;flex-shrink:0}
                .res-ack-dot{position:absolute;top:6px;left:6px;width:9px;height:9px;border-radius:50%;border:2px solid var(--bg-surface);z-index:1}
                .res-ack-dot.res-unread{background:#ef4444;box-shadow:0 0 0 0 rgba(239,68,68,.6);animation:res-pulse 1.4s ease-in-out infinite}
                .res-ack-dot.res-read{background:#10b981}
                @keyframes res-pulse{0%{box-shadow:0 0 0 0 rgba(239,68,68,.6)}70%{box-shadow:0 0 0 5px rgba(239,68,68,0)}100%{box-shadow:0 0 0 0 rgba(239,68,68,0)}}
                </style>
                <div id="docs-tabs-bar" class="dtab-bar">
                    <button id="docs-tab-registry" class="dtab active" style="--tab-accent:#6366f1" onclick="ResourcesPage.switchTab('registry',this)"><span class="dtab-ic dtab-ic-registry"><i class="fa-solid fa-table-list"></i></span>Реєстри</button>
                    <div class="dtab-sep"></div>
                    <button id="docs-tab-red-folder" class="dtab" style="--tab-accent:#ef4444" onclick="ResourcesPage.switchTab('red-folder',this)"><span class="dtab-ic dtab-ic-red"><i class="fa-solid fa-folder"></i></span>Червона папка</button>
                    <div class="dtab-sep"></div>
                    <button id="docs-tab-branch" class="dtab" style="--tab-accent:#10b981" onclick="ResourcesPage.switchTab('branch',this)"><span class="dtab-ic dtab-ic-branch"><i class="fa-solid fa-scale-balanced"></i></span>Куточок споживача</button>
                    <div class="dtab-sep"></div>
                    <button id="docs-tab-list" class="dtab" style="--tab-accent:#6b7280" onclick="ResourcesPage.switchTabList(this)"><span class="dtab-ic dtab-ic-all"><i class="fa-solid fa-layer-group"></i></span>Всі документи</button>
                    ${isManager ? '<div class="dtab-sep"></div><button id="docs-tab-status" class="dtab" style="--tab-accent:#14b8a6" onclick="ResourcesPage.switchTab(\'status\',this)"><span class="dtab-ic dtab-ic-status"><i class="fa-solid fa-chart-bar"></i></span>Статус</button>' : ''}
                    <div id="docs-cat-chips" style="display:none"></div>
                </div>
                <div id="docs-tab-content">
                    <div id="resource-list" class="resource-list-docs"></div>
                    <div id="resources-pagination" style="display:flex;justify-content:center;gap:.5rem;margin-top:1.5rem;margin-bottom:2rem"></div>
                </div>`;

            await this._loadFilters();
            // Відновлюємо вкладку або відкриваємо дефолтну (registry)
            const restoreTab = this._initTab || 'registry';
            this._activeTab = ''; // скидаємо щоб switchTab не вийшов достроково
            if (restoreTab === 'list') {
                const savedCat = this._initCat;
                const tabListBtn = document.getElementById('docs-tab-list');
                this.switchTab('list', tabListBtn, { skipLoad: true });
                if (savedCat) {
                    this._category = savedCat;
                }
                await this.load();
            } else {
                const tabBtn = document.getElementById(`docs-tab-${restoreTab}`);
                if (tabBtn) this.switchTab(restoreTab, tabBtn);
            }
            return;
        }

        UI.setBreadcrumb([{ label: 'База знань' }]);
        this._kbTypeFilter = 'all';
        this._kbCatFilter = 'all';
        this._kbSort = 'newest';

        container.innerHTML = `
<style>
/* ── KB Hero (компактна версія) ── */
.kb-hero{position:relative;overflow:hidden;border-radius:16px;padding:14px 22px;margin-bottom:14px;
    background:linear-gradient(120deg,#2563eb 0%,#4338ca 55%,#7c3aed 100%);
    box-shadow:0 6px 20px rgba(37,99,235,.14)}
.kb-hero-inner{display:flex;align-items:center;justify-content:space-between;gap:18px;flex-wrap:wrap}
.kb-hero-left{display:flex;align-items:center;gap:12px;min-width:0}
.kb-hero-icon{width:36px;height:36px;border-radius:10px;background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.25);display:flex;align-items:center;justify-content:center;font-size:1rem;color:#fff;flex-shrink:0}
.kb-hero-title{margin:0;font-size:1.2rem;font-weight:800;color:#fff;letter-spacing:-.02em;line-height:1.2}
.kb-hero-sub{margin:0;color:rgba(255,255,255,.68);font-size:.76rem;line-height:1.3}
.kb-hero-stats{display:flex;align-items:center;gap:16px;flex-shrink:0}
.kb-hero-stat{display:flex;flex-direction:column;align-items:flex-end;line-height:1.15}
.kb-hero-stat-val{font-size:1.1rem;font-weight:800;color:#fff}
.kb-hero-stat-label{font-size:.6rem;text-transform:uppercase;letter-spacing:.05em;color:rgba(255,255,255,.6);font-weight:600;margin-top:1px;white-space:nowrap}
.kb-hero-sep{width:1px;height:24px;background:rgba(255,255,255,.22);flex-shrink:0}
@media(max-width:900px){.kb-hero-stats{display:none}}
.kb-search-bar{margin-bottom:22px;display:flex;align-items:center;gap:.75rem}
.kb-search-wrap{position:relative;flex:1;max-width:640px}
.kb-search-wrap input{width:100%;height:58px;padding:0 20px 0 54px;border-radius:20px;
    border:1.5px solid rgba(255,255,255,.85);background:rgba(255,255,255,.78);
    backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);
    color:#1e293b;font-size:1rem;font-weight:500;outline:none;
    transition:border-color .2s,box-shadow .2s;box-sizing:border-box;
    box-shadow:0 10px 35px rgba(15,23,42,.06);font-family:inherit}
.kb-search-wrap input::placeholder{color:#94a3b8;font-weight:400}
.kb-search-wrap input:focus{border-color:var(--primary);
    box-shadow:0 0 0 4px rgba(99,102,241,.12),0 20px 45px rgba(99,102,241,.1)}
body:not(.light-theme) .kb-search-wrap input{background:var(--bg-surface);backdrop-filter:none;-webkit-backdrop-filter:none;border-color:var(--border);color:var(--text-primary)}
.kb-search-icon{position:absolute;left:18px;top:50%;transform:translateY(-50%);color:#94a3b8;pointer-events:none;font-size:1rem;z-index:2}
body:not(.light-theme) .kb-search-icon{color:var(--text-muted)}

/* ── KB Toolbar ── */
.kb-toolbar{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:20px}
.kb-type-chips{display:inline-flex;gap:4px;flex-wrap:wrap;padding:5px;background:var(--bg-surface);border:1px solid var(--border);border-radius:16px;box-shadow:0 2px 10px rgba(15,23,42,.05)}
body:not(.light-theme) .kb-type-chips{box-shadow:0 2px 14px rgba(0,0,0,.2)}
.kb-type-chip{display:inline-flex;align-items:center;gap:9px;padding:9px 16px 9px 10px;border-radius:12px;
    background:transparent;border:none;color:var(--text-muted);font-size:.85rem;font-weight:600;
    cursor:pointer;transition:background .18s ease,color .18s ease,transform .12s ease;white-space:nowrap}
.kb-type-chip:hover:not(.active){color:var(--text-primary);background:var(--bg-hover);transform:translateY(-1px)}
.kb-type-chip.active{color:var(--tab-accent,var(--primary));background:color-mix(in srgb,var(--tab-accent,var(--primary)) 12%,var(--bg-surface))}
.kb-type-chip.active .kb-type-ic{background:var(--tab-accent,var(--primary));color:#fff}
.kb-type-ic{width:26px;height:26px;border-radius:8px;display:flex;align-items:center;justify-content:center;
    font-size:.85rem;background:var(--bg-hover);color:var(--text-muted);transition:all .18s ease}

.kb-toolbar-right{display:flex;align-items:center;gap:8px}
.kb-sort-select{width:auto;height:44px;padding:0 19px;border-radius:14px;border:1.5px solid var(--border);background:var(--bg-surface);color:var(--text-secondary);font-size:.82rem;cursor:pointer;outline:none}
#kb-cat-filter{padding:0 24px}
.kb-view-toggle{display:flex;gap:4px;background:var(--bg-raised);border:1.5px solid var(--border);border-radius:14px;padding:3px}
.kb-view-btn{display:flex;align-items:center;justify-content:center;width:36px;height:36px;background:transparent;border:none;cursor:pointer;color:var(--text-muted);font-size:.9rem;border-radius:10px;transition:background .15s,color .15s,box-shadow .15s}
.kb-view-btn:hover{background:var(--bg-hover);color:var(--text-primary)}
.kb-view-btn.active{background:var(--primary);color:#fff;box-shadow:0 2px 8px rgba(99,102,241,.35)}

/* ── KB Secondary toolbar ── */
.kb-filters-row{display:flex;gap:8px;margin-bottom:20px;flex-wrap:wrap;align-items:center}
.kb-filter-sel{height:40px;padding:0 12px;border-radius:12px;border:1.5px solid var(--border);background:var(--bg-surface);color:var(--text-secondary);font-size:.82rem;outline:none;cursor:pointer;width:auto;max-width:200px}
.kb-add-btn{margin-left:auto}

/* ── Grid ── */
.kb-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:20px;animation:kb-in .35s ease}
@keyframes kb-in{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}

.kb-card{background:rgba(255,255,255,.88);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);
    border:1px solid rgba(255,255,255,.95);border-radius:28px;overflow:hidden;display:flex;flex-direction:column;
    transition:box-shadow .25s,transform .25s,border-color .25s;cursor:pointer;position:relative;
    box-shadow:0 8px 28px rgba(15,23,42,.07)}
.kb-card:hover{box-shadow:0 28px 60px rgba(37,99,235,.14);transform:translateY(-8px);border-color:rgba(255,255,255,1)}
body:not(.light-theme) .kb-card{background:var(--bg-surface);backdrop-filter:none;-webkit-backdrop-filter:none;border-color:var(--border);box-shadow:0 4px 20px rgba(0,0,0,.2)}
body:not(.light-theme) .kb-card:hover{box-shadow:0 16px 40px rgba(0,0,0,.3);border-color:var(--border-light)}
.kb-card-accent{height:4px;width:100%;flex-shrink:0}
.kb-card-body{padding:22px 22px 14px;flex:1;display:flex;flex-direction:column;gap:12px}
.kb-card-top{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}
.kb-card-type-box{width:62px;height:62px;border-radius:20px;display:flex;align-items:center;justify-content:center;font-size:1.75rem;flex-shrink:0}
.kb-card-badges{display:flex;gap:5px;flex-wrap:wrap;align-items:flex-start;padding-top:4px}
.kb-card-title{font-weight:700;font-size:1.05rem;color:var(--text-primary);line-height:1.38;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.kb-card-desc{font-size:.8rem;color:var(--text-muted);line-height:1.6;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.kb-card-meta{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
.kb-badge{display:inline-flex;align-items:center;padding:4px 10px;border-radius:20px;font-size:.7rem;font-weight:600;white-space:nowrap}
.kb-badge-new{background:rgba(16,185,129,.15);color:#10b981;border:1px solid rgba(16,185,129,.25)}
.kb-badge-cat{background:var(--bg-raised);color:var(--text-muted);border:1px solid var(--border)}
.kb-badge-course{background:rgba(99,102,241,.1);color:#6366f1;border:1px solid rgba(99,102,241,.2)}
.kb-badge-type{font-weight:700;font-size:.65rem;letter-spacing:.04em}
.kb-card-footer{padding:12px 22px 18px;display:flex;align-items:center;justify-content:space-between;gap:8px;border-top:1px solid rgba(148,163,184,.13);margin-top:auto}
body:not(.light-theme) .kb-card-footer{border-top-color:var(--border)}
.kb-card-actions{display:flex;gap:6px;align-items:center}
.kb-btn-open{display:inline-flex;align-items:center;gap:5px;height:38px;padding:0 18px;border-radius:12px;
    border:none;background:linear-gradient(135deg,var(--primary),#4338ca);color:#fff;
    font-size:.82rem;font-weight:700;cursor:pointer;transition:opacity .15s,transform .1s;font-family:inherit;
    box-shadow:0 4px 14px rgba(99,102,241,.3)}
.kb-btn-open:hover{opacity:.9;transform:translateY(-1px)}
.kb-btn-dl{display:inline-flex;align-items:center;padding:9px 10px;border-radius:12px;border:1.5px solid var(--border);background:transparent;color:var(--text-muted);font-size:.85rem;cursor:pointer;transition:background .15s,border-color .15s,color .15s}
.kb-btn-dl:hover{border-color:var(--primary);color:var(--primary)}
.kb-btn-edit{display:inline-flex;align-items:center;padding:7px 9px;border-radius:10px;border:1.5px solid var(--border);background:transparent;color:var(--text-muted);font-size:.82rem;cursor:pointer;transition:all .15s}
.kb-btn-edit:hover{border-color:var(--primary);color:var(--primary)}
.kb-btn-del{display:inline-flex;align-items:center;padding:7px 9px;border-radius:10px;border:1.5px solid var(--border);background:transparent;color:var(--text-muted);font-size:.82rem;cursor:pointer;transition:all .15s}
.kb-btn-del:hover{border-color:#ef4444;color:#ef4444;background:rgba(239,68,68,.06)}
.res-del-btn:hover{border-color:#ef4444!important;color:#ef4444!important}
.kb-star{width:32px;height:32px;border-radius:10px;border:1.5px solid var(--border);background:transparent;color:var(--text-muted);display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:1rem;transition:all .15s;flex-shrink:0}
.kb-star:hover,.kb-star.active{border-color:#f59e0b;color:#f59e0b;background:rgba(245,158,11,.1)}

/* ── List ── */
.kb-list{display:flex;flex-direction:column;gap:8px;animation:kb-in .3s ease}
.kb-row{position:relative;background:var(--bg-surface);border:1px solid var(--border);border-radius:14px;padding:14px 16px;display:flex;align-items:center;gap:14px;transition:box-shadow .15s,border-color .15s,transform .15s;cursor:pointer}
.kb-row:hover{box-shadow:0 4px 16px rgba(0,0,0,.08);border-color:var(--border-light);transform:translateX(2px)}
/* "Розтягнуте посилання" — невидимий <a>, що покриває весь рядок, аби
   правий клік/клік колесом миші працювали в будь-якій точці рядка (не
   лише на кнопці "Відкрити"). Флекс-елементи (icon/info) фарбуються як
   позиціоновані по порядку в DOM, тож без додаткових заходів вони лежали б
   поверх абсолютного посилання і блокували клік — тому їм задано
   pointer-events:none (клік проходить наскрізь до посилання під ними), а
   .kb-row-actions отримує вищий z-index, щоб кнопки лишались клікабельними. */
.kb-row-stretched-link{position:absolute;inset:0;border-radius:inherit}
.kb-row-icon{width:42px;height:42px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:1.3rem;flex-shrink:0;pointer-events:none}
.kb-row-info{flex:1;min-width:0;pointer-events:none}
.kb-row-title{font-weight:600;font-size:.92rem;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.kb-row-meta{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-top:3px}
.kb-row-actions{position:relative;z-index:1;display:flex;gap:6px;align-items:center;flex-shrink:0}

/* ── Type colors ── */
.kb-t-pdf   .kb-card-accent,.kb-t-pdf   .kb-row-left-bar{background:linear-gradient(90deg,#f97316,#fb923c)}
.kb-t-video .kb-card-accent,.kb-t-video .kb-row-left-bar{background:linear-gradient(90deg,#a855f7,#8b5cf6)}
.kb-t-image .kb-card-accent,.kb-t-image .kb-row-left-bar{background:linear-gradient(90deg,#06b6d4,#0891b2)}
.kb-t-link  .kb-card-accent,.kb-t-link  .kb-row-left-bar{background:linear-gradient(90deg,#3b82f6,#2563eb)}
.kb-t-scorm .kb-card-accent,.kb-t-scorm .kb-row-left-bar{background:linear-gradient(90deg,#10b981,#059669)}
.kb-t-file  .kb-card-accent,.kb-t-file  .kb-row-left-bar{background:linear-gradient(90deg,#64748b,#94a3b8)}
.kb-t-pdf   .kb-card-type-box,.kb-t-pdf   .kb-row-icon{background:rgba(249,115,22,.12)}
.kb-t-video .kb-card-type-box,.kb-t-video .kb-row-icon{background:rgba(168,85,247,.12)}
.kb-t-image .kb-card-type-box,.kb-t-image .kb-row-icon{background:rgba(6,182,212,.12)}
.kb-t-link  .kb-card-type-box,.kb-t-link  .kb-row-icon{background:rgba(59,130,246,.12)}
.kb-t-scorm .kb-card-type-box,.kb-t-scorm .kb-row-icon{background:rgba(16,185,129,.12)}
.kb-t-file  .kb-card-type-box,.kb-t-file  .kb-row-icon{background:rgba(100,116,139,.1)}

.kb-dot-pdf{background:#f97316}.kb-dot-video{background:#a855f7}.kb-dot-image{background:#06b6d4}
.kb-dot-link{background:#3b82f6}.kb-dot-scorm{background:#10b981}.kb-dot-file{background:#64748b}

.kb-badge-pdf{background:rgba(249,115,22,.12);color:#f97316}
.kb-badge-video{background:rgba(168,85,247,.12);color:#a855f7}
.kb-badge-image{background:rgba(6,182,212,.12);color:#0891b2}
.kb-badge-link{background:rgba(59,130,246,.12);color:#3b82f6}
.kb-badge-scorm{background:rgba(16,185,129,.12);color:#10b981}
.kb-badge-file{background:rgba(100,116,139,.1);color:#64748b}

.kb-empty{display:flex;flex-direction:column;align-items:center;padding:5rem 2rem;text-align:center;grid-column:1/-1}
.kb-empty-ico{font-size:4rem;margin-bottom:1rem;opacity:.35}
.kb-empty-head{font-size:1.2rem;font-weight:700;color:var(--text-primary);margin-bottom:.5rem}
.kb-empty-txt{font-size:.875rem;color:var(--text-muted);max-width:360px;line-height:1.6}

@media(max-width:640px){
  .kb-hero{padding:12px 16px}.kb-hero-title{font-size:1.05rem}
  .kb-hero-icon{width:32px;height:32px;font-size:.9rem}
  .kb-grid{grid-template-columns:1fr}
}
</style>

<div class="kb-hero">
    <div class="kb-hero-inner">
        <div class="kb-hero-left">
            <div class="kb-hero-icon"><i class="fa-solid fa-book-open"></i></div>
            <div>
                <h1 class="kb-hero-title">База знань</h1>
                <p class="kb-hero-sub">Навчальні матеріали та довідкові ресурси</p>
            </div>
        </div>
        <div class="kb-hero-stats">
            <div class="kb-hero-stat">
                <span class="kb-hero-stat-val" id="kb-stat-total">—</span>
                <span class="kb-hero-stat-label">Матеріалів</span>
            </div>
            <div class="kb-hero-sep"></div>
            <div class="kb-hero-stat">
                <span class="kb-hero-stat-val" id="kb-stat-new">—</span>
                <span class="kb-hero-stat-label">Нових за тиждень</span>
            </div>
            ${AppState.isAdmin() ? '<div class="kb-hero-sep"></div><div id="kb-db-size"></div>' : ''}
        </div>
    </div>
</div>

<div class="kb-search-bar">
    <div class="kb-search-wrap search-clear-wrap">
        <span class="kb-search-icon"><i class="fa-solid fa-magnifying-glass"></i></span>
        <input type="text" id="resource-search" placeholder="Пошук за назвою або описом..." value="${this._search}" oninput="ResourcesPage.onSearch(event)">
        <button type="button" class="search-clear-btn" onclick="UI.clearSearchInput(this)"><i class="fa-solid fa-xmark"></i></button>
    </div>
    <div style="display:flex;align-items:center;gap:.5rem;flex-shrink:0">
        ${AppState.isStaff() && AppState.canMutate() ? '<button class="btn btn-primary kb-add-btn" onclick="ResourcesPage.openForm()"><i class="fa-solid fa-plus"></i> Додати ресурс</button>' : ''}
        ${AppState.isSuperAdmin() ? '<button class="btn btn-ghost btn-sm kb-add-btn" onclick="ResourcesPage._openTrash()" title="Кошик"><i class="fa-solid fa-trash"></i> Кошик</button>' : ''}
    </div>
</div>

<div class="kb-toolbar">
    <div class="kb-type-chips" id="kb-type-chips">
        ${this._kbTypeChips()}
    </div>
    <div class="kb-toolbar-right">
        <select class="kb-sort-select" id="kb-cat-filter" onchange="ResourcesPage._kbSetCat(this.value)">
            <option value="all">Всі категорії</option>
        </select>
        <select class="kb-sort-select" id="kb-sort" onchange="ResourcesPage._kbSetSort(this.value)">
            <option value="newest">↓ Новіші</option>
            <option value="oldest">↑ Старіші</option>
            <option value="name_az">A → Z</option>
            <option value="name_za">Z → A</option>
        </select>
        <div class="kb-view-toggle">
            <button class="kb-view-btn${this._kbViewMode==='grid'?' active':''}" title="Сітка" onclick="ResourcesPage._kbSetView('grid',this)"><i class="fa-solid fa-grip"></i></button>
            <button class="kb-view-btn${this._kbViewMode==='list'?' active':''}" title="Список" onclick="ResourcesPage._kbSetView('list',this)"><i class="fa-solid fa-list"></i></button>
        </div>
        ${HelpTip.render('kb', {
            icon: 'fa-book-open',
            gradient: '135deg,#2563eb,#6366f1',
            title: 'Як користуватись Базою знань',
            items: [
                { icon: 'fa-magnifying-glass', text: 'Шукайте матеріали за назвою через рядок пошуку або фільтруйте за типом (PDF, відео, посилання, SCORM) та категорією.' },
                { icon: 'fa-hand-pointer', color: '#6366f1', text: 'Натисніть на картку, щоб відкрити матеріал. Для PDF та відео — перегляд прямо в браузері.' },
                { icon: 'fa-star', color: '#f59e0b', text: 'Додавайте матеріали в закладки (⭐), щоб швидко знаходити їх у розділі «Закладки».' },
                { icon: 'fa-table-list', text: 'Перемикайте вигляд між сіткою та списком кнопками у правому кутку панелі інструментів.' },
                { icon: 'fa-graduation-cap', color: '#10b981', text: 'Матеріали з позначкою «Курс» прив\'язані до конкретного курсу — прогрес враховується автоматично.' },
                { icon: 'fa-plus', color: '#8b5cf6', text: 'Кнопка «Додати» дозволяє завантажити новий матеріал для бази знань.', roles: ['staff'] },
                { icon: 'fa-trash', color: '#ef4444', text: 'Кошик зберігає видалені матеріали — їх можна відновити протягом 30 днів.', roles: ['superadmin'] },
            ]
        })}
    </div>
</div>

<div id="resource-list"></div>
<div id="resources-pagination" style="display:flex;justify-content:center;gap:.5rem;margin-top:1.5rem;margin-bottom:2rem"></div>`;

        await Promise.all([this._loadFilters(), this.load(true)]);
        if (AppState.isAdmin()) this._loadDbSize();
    },

    async _loadDbSize() {
        try {
            const data = await API.system.getDbSize();
            const el = document.getElementById('kb-db-size');
            if (!el) return;

            const maxGb = APP_CONFIG.dbQuotaGb || 0.5;

            const fmt = bytes => {
                const gb = bytes / 1073741824;
                return gb >= 0.1 ? `${gb.toFixed(2)} ГБ` : `${(bytes / 1048576).toFixed(1)} МБ`;
            };

            const bar = (bytes, max, color) => {
                const pct = Math.min(100, (bytes / (max * 1073741824)) * 100);
                const c = pct > 85 ? '#ef4444' : pct > 60 ? '#f59e0b' : color;
                return `<div style="height:3px;width:70px;border-radius:4px;background:rgba(255,255,255,.18);overflow:hidden;margin-top:3px">
    <div style="height:100%;width:${pct.toFixed(1)}%;background:${c};border-radius:4px"></div>
  </div>`;
            };

            el.innerHTML = `
<div style="display:flex;flex-direction:column;align-items:flex-end;color:#fff">
  <span class="kb-hero-stat-val" style="font-size:.85rem">${fmt(data.storage_bytes)}</span>
  <span class="kb-hero-stat-label">Storage / ${maxGb} ГБ</span>
  ${bar(data.storage_bytes, maxGb, '#60a5fa')}
</div>`;
        } catch (_) {}
    },

    switchTabList(el) {
        this._category = '';
        document.querySelectorAll('#docs-tabs-bar .dtab').forEach(b => b.classList.remove('active'));
        document.getElementById('docs-tab-list')?.classList.add('active');
        if (this._activeTab === 'list') {
            this._page = 0;
            this.load();
        } else {
            this.switchTab('list', el);
        }
    },

    _ensureDocsTableStyles() {
        if (document.getElementById('docs-tree-styles')) return;
        const st = document.createElement('style');
        st.id = 'docs-tree-styles';
        st.textContent = `
            .dtl-toolbar { display:flex;gap:.6rem;flex-wrap:nowrap;align-items:center;margin-bottom:.7rem }
            .dtl-sel { width:220px;flex-shrink:0;padding:.6rem .8rem;border-radius:var(--radius-md);border:1px solid var(--border);background:var(--bg-surface);color:var(--text-primary);font-size:.82rem;font-family:inherit;outline:none }
            .dtl-chip-row { display:flex;gap:.4rem;flex-wrap:wrap;margin-bottom:1rem }
            .dtl-chip { display:inline-flex;align-items:center;gap:.35rem;padding:.4rem .8rem;border-radius:999px;border:1.5px solid var(--border);background:var(--bg-surface);color:var(--text-secondary);font-size:.8rem;font-weight:600;cursor:pointer;font-family:inherit;transition:all .15s }
            .dtl-chip:hover { border-color:var(--primary);color:var(--text-primary) }
            .dtl-chip .n { font-size:.68rem;opacity:.75 }
            .dtl-chip.on { border-color:var(--primary);background:rgba(99,102,241,.14);color:var(--primary) }
            .dtl-chip.unread { border-color:rgba(239,68,68,.35) }
            .dtl-chip.unread .dot { width:6px;height:6px;border-radius:50%;background:#ef4444;display:inline-block }
            .dtl-reset { display:inline-flex;align-items:center;gap:.3rem;padding:.4rem .7rem;border-radius:999px;border:1.5px dashed var(--border);background:transparent;color:#ef4444;font-size:.78rem;font-weight:600;cursor:pointer;font-family:inherit;flex-shrink:0;white-space:nowrap }
            .dtl-reset:hover { border-color:#ef4444;background:rgba(239,68,68,.06) }
            .dtl-tbl-wrap { border:1px solid var(--border);border-radius:var(--radius-lg);overflow:hidden;background:var(--bg-surface) }
            .dtl-tbl-wrap table { width:100%;border-collapse:collapse }
            .dtl-tbl-wrap thead th { text-align:center;font-size:.68rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted);padding:.65rem .9rem;border-bottom:1px solid var(--border);background:var(--bg-raised);white-space:nowrap }
            .dtl-tbl-wrap thead th.sortable { cursor:pointer;user-select:none }
            .dtl-tbl-wrap thead th.sortable .sort-ic { margin-left:.3rem;font-size:.6rem;opacity:.35 }
            .dtl-tbl-wrap thead th.sorted { color:var(--primary) }
            .dtl-tbl-wrap thead th.sorted .sort-ic { opacity:1 }
            .dtl-tbl-wrap thead th.dtl-col-fit { text-align:center }
            .dtl-row { border-bottom:1px solid var(--border);cursor:pointer;transition:background .1s }
            .dtl-row:last-child { border-bottom:none }
            .dtl-row:hover { background:var(--bg-hover) }
            .dtl-row td { padding:.6rem .9rem;font-size:.83rem;vertical-align:middle }
            .dtl-td-doc { display:flex;align-items:center;gap:.65rem;min-width:420px }
            .dtl-col-doc { width:45% }
            .dtl-doc-ic { width:34px;height:34px;border-radius:8px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:.85rem }
            .dtl-doc-title { font-weight:700;color:var(--text-primary);line-height:1.3;display:flex;align-items:center;gap:.4rem;flex-wrap:wrap }
            .dtl-doc-desc { font-size:.72rem;color:var(--text-muted);margin-top:2px;max-width:540px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap }
            .dtl-type-pill { display:inline-flex;align-items:center;gap:.35rem;font-size:.76rem;font-weight:600;color:var(--text-secondary);white-space:nowrap }
            .dtl-type-pill .sw { width:7px;height:7px;border-radius:50%;flex-shrink:0 }
            .dtl-tov { font-size:.76rem;color:var(--text-secondary) }
            .dtl-col-fit { width:165px;white-space:nowrap;text-align:center }
            .dtl-col-type { width:150px;white-space:nowrap }
            .dtl-status { display:flex;flex-direction:column;align-items:center;gap:.2rem;white-space:nowrap }
            .dtl-row-actions { display:flex;gap:.3rem;justify-content:flex-end }
            .dtl-icon-btn { width:28px;height:28px;border-radius:6px;border:1px solid var(--border);background:transparent;color:var(--text-muted);display:inline-flex;align-items:center;justify-content:center;font-size:.75rem;cursor:pointer;text-decoration:none }
            .dtl-icon-btn:hover { border-color:var(--primary);color:var(--primary) }
            .dtl-dov-row { display:flex;gap:.3rem;flex-wrap:wrap;margin-top:.3rem }
            .dtl-dov-chip { display:inline-flex;align-items:center;gap:.3rem;font-size:.68rem;font-weight:600;padding:.1rem .5rem;border-radius:999px;border:1px solid transparent;white-space:nowrap }
            .dtl-dov-chip.has { background:rgba(245,158,11,.08);color:#d97706;border-color:rgba(245,158,11,.25) }
            .dtl-dov-chip.all { background:rgba(16,185,129,.08);color:#059669;border-color:rgba(16,185,129,.25) }

            /* ── Right-click context menu on document title ─────────── */
            .dtl-ctxmenu { position:fixed;z-index:100000;min-width:220px;background:var(--bg-surface);border:1px solid var(--border);border-radius:var(--radius-md);box-shadow:0 12px 32px rgba(0,0,0,.28);padding:.3rem;animation:dtlCtxIn .12s cubic-bezier(.4,0,.2,1) }
            @keyframes dtlCtxIn { from{opacity:0;transform:scale(.96)} to{opacity:1;transform:scale(1)} }
            .dtl-ctxmenu-item { display:flex;align-items:center;gap:.6rem;width:100%;padding:.5rem .7rem;border:none;background:transparent;color:var(--text-primary);font-size:.85rem;font-family:inherit;text-align:left;cursor:pointer;border-radius:var(--radius-sm);text-decoration:none;box-sizing:border-box }
            .dtl-ctxmenu-item:hover { background:var(--bg-hover);color:var(--primary) }
            .dtl-ctxmenu-item i { width:16px;text-align:center;flex-shrink:0;color:var(--text-muted) }
            .dtl-ctxmenu-item:hover i { color:var(--primary) }

            /* ── Status detail modal — sectioned layout ─────────────── */
            .stm-sec { display:flex;flex-direction:column;gap:.6rem;padding:.9rem 1rem;border:1px solid var(--border);border-radius:var(--radius-lg);background:var(--bg-raised) }
            .stm-sec-hdr { display:flex;align-items:center;gap:.55rem }
            .stm-ico { width:26px;height:26px;border-radius:7px;display:flex;align-items:center;justify-content:center;font-size:.75rem;flex-shrink:0 }
            .stm-sec-title { font-size:.82rem;font-weight:700;color:var(--text-primary) }
            .stm-pct { margin-left:auto;font-size:1.05rem;font-weight:800 }
            .stm-bar { background:var(--bg-base);border-radius:6px;height:8px;overflow:hidden }
            .stm-bar-fill { height:100%;transition:width .4s }
            .stm-stat-row { display:flex;gap:.5rem;flex-wrap:wrap }
            .stm-stat { display:inline-flex;align-items:center;gap:.35rem;font-size:.76rem;font-weight:600;padding:.3rem .65rem;border-radius:999px;border:1px solid transparent }
            .stm-stat b { font-weight:800 }
            .stm-stat.ok { background:rgba(16,185,129,.1);color:#10b981;border-color:rgba(16,185,129,.25) }
            .stm-stat.pending { background:var(--bg-base);color:var(--text-muted);border-color:var(--border) }
            .stm-stat.overdue { background:rgba(239,68,68,.1);color:#ef4444;border-color:rgba(239,68,68,.25) }
            .stm-count-badge { margin-left:auto;font-size:.68rem;font-weight:700;padding:.15rem .55rem;border-radius:999px;background:var(--bg-base);color:var(--text-muted);border:1px solid var(--border) }
            .stm-search { position:relative }
            .stm-search input { width:100%;height:40px;padding:0 2.4rem;border-radius:var(--radius-md);border:1px solid var(--border);background:var(--bg-surface);color:var(--text-primary);font-size:.84rem;font-family:inherit;outline:none;box-sizing:border-box;transition:border-color .15s }
            .stm-search input:focus { border-color:var(--primary) }
            .stm-search i.fa-magnifying-glass { position:absolute;left:.8rem;top:50%;transform:translateY(-50%);color:var(--text-muted);font-size:.8rem }
            .stm-list { display:flex;flex-direction:column;gap:.4rem;max-height:360px;overflow-y:auto;padding-right:.2rem }
            .stm-row { display:flex;align-items:center;gap:.7rem;padding:.55rem .7rem;border:1px solid var(--border);border-left:3px solid transparent;border-radius:var(--radius-md);background:var(--bg-surface);transition:background .1s }
            .stm-row:hover { background:var(--bg-hover) }
            .stm-row.acked { border-left-color:#10b981 }
            .stm-row.overdue { border-left-color:#ef4444 }
            .stm-row.soon { border-left-color:#f59e0b }
            .stm-avatar { width:32px;height:32px;border-radius:50%;background:rgba(99,102,241,.12);color:var(--primary);display:flex;align-items:center;justify-content:center;font-size:.72rem;font-weight:800;flex-shrink:0 }
            .stm-row-body { flex:1;min-width:0 }
            .stm-row-name { font-size:.85rem;font-weight:600;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis }
            .stm-row-pos { font-size:.72rem;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis }
            .stm-row-status { font-size:.78rem;font-weight:600;white-space:nowrap;flex-shrink:0 }
            .stm-empty { text-align:center;padding:2rem 1rem;color:var(--text-muted);font-size:.85rem }
        `;
        document.head.appendChild(st);
    },

    switchTab(tab, el, { skipLoad = false } = {}) {
        if (this._activeTab === tab) return; // повторний клік — нічого не робимо
        this._activeTab = tab;
        // Оновлюємо URL тихо — щоб history.back() повертав на правильну вкладку
        if (this._view === 'docs') {
            const newHash = tab === 'list' ? '#/documents' : `#/documents?tab=${tab}`;
            history.replaceState(null, '', newHash);
        }
        // скидаємо всі таби і кат-кнопки
        document.querySelectorAll('#docs-tabs-bar .dtab').forEach(btn => btn.classList.remove('active'));
        document.getElementById(`docs-tab-${tab}`)?.classList.add('active');
        const content = document.getElementById('docs-tab-content');
        if (!content) return;
        clearInterval(this._statusRefreshTimer);

        // reset category chips on any tab switch
        this._category = '';
        this._docsTreeStatus = '';
        this._docsTreeTov = '';
        this._docsShowAll = false;
        document.querySelectorAll('.docs-cat-chip').forEach(b => { b.classList.remove('btn-primary'); b.classList.add('btn-ghost'); });

        if (tab === 'list') {
            this._ensureDocsTableStyles();
            content.innerHTML = `
                <div class="dtl-toolbar">
                    <div class="search-clear-wrap" style="position:relative;flex:1;min-width:200px;max-width:360px">
                        <i class="fa-solid fa-magnifying-glass" style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--text-muted);font-size:.85rem;pointer-events:none"></i>
                        <input type="text" id="resource-search" placeholder="Пошук за назвою або описом..." value="${this._search}"
                               style="width:100%;padding-left:2.1rem;box-sizing:border-box" oninput="ResourcesPage.onSearch(event)">
                        <button type="button" class="search-clear-btn" onclick="UI.clearSearchInput(this)"><i class="fa-solid fa-xmark"></i></button>
                    </div>
                    <select id="docs-sort-sel" onchange="ResourcesPage._docsSetSort(this.value)" style="width:auto;flex-shrink:0">
                        <option value="priority" ${this._docsSort==='priority'?'selected':''}>🔴 Нові / оновлені першими</option>
                        <option value="newest" ${this._docsSort==='newest'?'selected':''}>↓ Дата додавання</option>
                        <option value="name_az" ${this._docsSort==='name_az'?'selected':''}>A → Я назва</option>
                        <option value="status_asc" ${this._docsSort==='status_asc'?'selected':''}>✅ Ознайомлені першими</option>
                    </select>
                    <div id="docs-facet-sels" style="display:flex;gap:.6rem;flex-shrink:0">
                        <div style="padding:.6rem;color:var(--text-muted);font-size:.85rem"><i class="fa-solid fa-spinner fa-spin"></i></div>
                    </div>
                </div>
                <div class="dtl-chip-row" id="docs-cat-chip-row"></div>
                <div class="dtl-tbl-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th class="sortable dtl-col-doc" onclick="ResourcesPage._docsSetSort('name_az')" data-sort="name_az">Документ <i class="fa-solid fa-arrow-down sort-ic"></i></th>
                                <th class="sortable dtl-col-type" onclick="ResourcesPage._docsSetSort('type_az')" data-sort="type_az">Тип <i class="fa-solid fa-arrow-down sort-ic"></i></th>
                                <th class="sortable" onclick="ResourcesPage._docsSetSort('tov_az')" data-sort="tov_az">ТОВ <i class="fa-solid fa-arrow-down sort-ic"></i></th>
                                <th class="sortable dtl-col-fit" onclick="ResourcesPage._docsSetSort('status_asc')" data-sort="status_asc">Статус <i class="fa-solid fa-arrow-down sort-ic"></i></th>
                                <th class="sortable dtl-col-fit" onclick="ResourcesPage._docsSetSort('newest')" data-sort="newest">Оновлено <i class="fa-solid fa-arrow-down sort-ic"></i></th>
                                <th>Дії</th>
                            </tr>
                        </thead>
                        <tbody id="resource-list"></tbody>
                    </table>
                </div>
                <div id="resources-pagination" style="display:flex;justify-content:center;gap:.5rem;margin-top:1.5rem;margin-bottom:2rem"></div>`;
            if (!skipLoad) this.load();
        } else if (tab === 'branch') {
            content.innerHTML = `
                <div id="bd-tab-area" style="width:1000px"></div>`;
            BranchDocsPage.renderInTab(document.getElementById('bd-tab-area'));
        } else if (tab === 'red-folder') {
            content.innerHTML = `<div id="rf-tab-area" style="width:1000px"></div>`;
            RedFolderPage.renderInTab(document.getElementById('rf-tab-area'));
        } else if (tab === 'registry') {
            content.innerHTML = `<div id="rg-tab-area"></div>`;
            RegistryPage.renderInTab(document.getElementById('rg-tab-area'));
        } else if (tab === 'status') {
            this._statusCache = null;
            this._renderStatusTab(content);
        }
    },

    _statusCache: null, // { docs, employees, allEmps, ackMap, mgrOptions }
    _statusRaw: null,   // { allDocs, allEmps } — сирі дані, щоб перерендерювати без повторного запиту
    _modalState: { docId: null, filter: 'all', search: '', page: 0, mgrFilter: 'all' },
    _modalPageSize: 25,
    _renderToken: 0,

    // Рекурсивно збирає всіх підлеглих (прямих і непрямих) заданого керівника
    _collectDescendants(rootId, allEmps) {
        const out = [];
        const queue = [rootId];
        while (queue.length) {
            const cur = queue.shift();
            for (const e of allEmps) {
                if (e.manager_id === cur) { out.push(e); queue.push(e.id); }
            }
        }
        return out;
    },

    // Документ без прив'язаних довіреностей видно всім; якщо довіреності
    // задані — стосується лише тих, у кого є хоч одна з них.
    _docAppliesToEmployee(doc, employee) {
        const rdovs = doc.resource_dovirenosti || [];
        if (!rdovs.length) return true;
        const empDovIds = new Set((employee.profile_dovirenosti || []).map(d => d.dovirenost_id));
        return rdovs.some(rd => empDovIds.has(rd.dovirenost_id));
    },

    async _renderStatusTab(content) {
        const token = ++this._renderToken;
        this._ensureDocsTableStyles();
        content.innerHTML = `<div style="display:flex;justify-content:center;padding:3rem"><div class="spinner"></div></div>`;
        try {
            const [docsRes, allEmps] = await Promise.all([
                API.resources.getAll({ trackedOnly: true, pageSize: 200 }),
                API.documentDownloads.getAllEmployees()
            ]);
            if (token !== this._renderToken) return;
            this._statusRaw = { allDocs: docsRes.data || [], allEmps };
            await this._renderStatusContent(content, token);
        } catch (e) {
            content.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><h3>${Fmt.esc(e.message)}</h3></div>`;
        }
    },

    async _renderStatusContent(content, token) {
        const { allDocs, allEmps } = this._statusRaw;
        try {
            const isOwner = AppState.isSuperAdmin();
            let docs = AppState.canSchedule() ? allDocs : allDocs.filter(r => AccessGroupsPage.checkAccess(r.access_group));

            // "Моя команда" — усі підлеглі керівника, прямі й непрямі (наприклад,
            // користувачі підпорядкованого керівника теж входять сюди). Власник
            // (superadmin) бачить компанію повністю без обмеження по команді.
            let myTeam = allEmps;
            let myDirects = [];
            let mgrOptions = [];
            if (!isOwner) {
                const myId = AppState.profile.id;
                myTeam = this._collectDescendants(myId, allEmps);
                if (!myTeam.length) {
                    content.innerHTML = `<div class="empty-state"><div class="empty-icon">👤</div><h3>Немає підлеглих</h3><p>Жодного співробітника не призначено до вас як керівника.</p></div>`;
                    return;
                }
                myDirects = allEmps.filter(e => e.manager_id === myId && e.role !== 'manager');
                mgrOptions = myTeam.filter(e => e.role === 'manager');
            } else {
                mgrOptions = allEmps.filter(e => e.role === 'manager');
            }

            // Фільтр "показати команду конкретного підпорядкованого керівника"
            // живе в модалці "Деталі" (§ Фільтр), а не тут — таблиця завжди
            // показує статистику по всій команді.
            const employees = myTeam;

            if (!isOwner) {
                // Залишаємо тільки документи релевантні для команди керівника
                // (усіх підлеглих, а не лише прямих): документ без довіреностей —
                // видний всім, документ з довіреностями — тільки якщо хоча б
                // хтось із команди має таку довіреність
                const subDovIds = new Set(
                    myTeam.flatMap(e => (e.profile_dovirenosti || []).map(d => d.dovirenost_id))
                );
                docs = docs.filter(doc => {
                    const rdovs = doc.resource_dovirenosti || [];
                    if (rdovs.length === 0) return true;
                    return rdovs.some(rd => subDovIds.has(rd.dovirenost_id));
                });
            }

            if (!docs.length) {
                content.innerHTML = `<div class="empty-state"><div class="empty-icon">📊</div><h3>Немає відстежуваних документів</h3></div>`;
                return;
            }

            if (!employees.length) {
                content.innerHTML = `<div class="empty-state"><div class="empty-icon">👤</div><h3>Немає співробітників для відображення</h3></div>`;
                return;
            }

            const ackMap = await API.documentDownloads.getAckStatus(docs.map(d => d.id));
            if (token !== this._renderToken) return;
            this._statusCache = { docs, employees, allEmps, ackMap, mgrOptions, myDirects, isOwner };

            const cards = docs.map(doc => {
                // Рахуємо тільки тих, у кого справді є доступ до цього
                // документа (за довіреністю) — інакше люди без доступу
                // штучно занижують % і показуються як "не ознайомились".
                const relevantEmployees = employees.filter(e => this._docAppliesToEmployee(doc, e));
                const acks = ackMap[doc.id] || [];
                const ackedIds = new Set(acks.filter(a => (a.version || 1) >= (doc.doc_version || 1)).map(a => a.userId));
                const ackedCount = relevantEmployees.filter(e => ackedIds.has(e.id)).length;
                const total = relevantEmployees.length;
                const notDoneCount = total - ackedCount;
                const pct = total ? Math.round(ackedCount / total * 100) : 0;
                const barColor = pct === 100 ? '#10b981' : pct >= 60 ? '#f59e0b' : '#ef4444';
                const countColor = pct === 100 ? '#10b981' : pct >= 60 ? '#f59e0b' : '#ef4444';

                let overdueCount = 0;
                if (doc.deadline_days) {
                    const dl = new Date(doc.created_at).getTime() + doc.deadline_days * 86400000;
                    if (dl < Date.now()) overdueCount = notDoneCount;
                }

                let deadlineInfo = '';
                if (doc.deadline_days) {
                    const deadlineMs = new Date(doc.created_at).getTime() + doc.deadline_days * 86400000;
                    const daysLeft = Math.ceil((deadlineMs - Date.now()) / 86400000);
                    deadlineInfo = daysLeft <= 0
                        ? `<span style="font-size:.7rem;color:#dc2626;font-weight:500">🔴 Дедлайн прострочено</span>`
                        : `<span style="font-size:.7rem;color:var(--text-muted)">📅 до ${Fmt.dateShort(new Date(deadlineMs))}</span>`;
                }

                const versionBadge = doc.doc_version > 1
                    ? `<span style="font-size:.7rem;background:var(--bg-base);color:var(--text-muted);padding:1px 6px;border-radius:8px;border:1px solid var(--border)">v${doc.doc_version}</span>`
                    : '';

                const dovNames = (doc.resource_dovirenosti || []).map(rd => rd.dovirenosti?.name).filter(Boolean);
                const dovRow = dovNames.length
                    ? `<div class="dtl-dov-row">${dovNames.map(n => `<span class="dtl-dov-chip has"><i class="fa-solid fa-building" style="font-size:.6rem"></i>${Fmt.esc(n)}</span>`).join('')}</div>`
                    : `<div class="dtl-dov-row"><span class="dtl-dov-chip all"><i class="fa-solid fa-globe" style="font-size:.6rem"></i>Для всіх ТОВ</span></div>`;

                const statusLine = pct === 100
                    ? `<span style="font-size:.8rem;color:#10b981">✅ Всі ознайомились</span>`
                    : `<span style="font-size:.8rem;color:var(--text-muted)">${notDoneCount} не ознайомились${overdueCount ? ` · <span style="color:#dc2626">🔴 ${overdueCount} прострочено</span>` : ''}</span>`;

                return `
                <tr class="dtl-row" onclick="ResourcesPage._openStatusModal('${doc.id}')">
                    <td>
                        <div class="dtl-td-doc">
                            <div class="dtl-doc-ic resource-icon pdf"><i class="fa-regular fa-file-pdf"></i></div>
                            <div style="min-width:0">
                                <div class="dtl-doc-title">${Fmt.esc(doc.title)}${versionBadge}</div>
                                ${dovRow}
                            </div>
                        </div>
                    </td>
                    <td>
                        <div style="display:flex;align-items:center;gap:.6rem">
                            <div style="flex:1;min-width:80px;background:var(--bg-base);border-radius:4px;height:6px;overflow:hidden">
                                <div style="height:100%;width:${pct}%;background:${barColor};transition:width .4s"></div>
                            </div>
                            <span style="font-size:.8rem;font-weight:700;color:${countColor};white-space:nowrap">${ackedCount}/${total}</span>
                        </div>
                    </td>
                    <td class="dtl-col-fit">${statusLine}</td>
                    <td class="dtl-col-fit">${deadlineInfo || '—'}</td>
                    <td onclick="event.stopPropagation()" style="text-align:center">
                        <button class="dtl-icon-btn" title="Деталі" onclick="ResourcesPage._openStatusModal('${doc.id}')"><i class="fa-solid fa-eye"></i></button>
                    </td>
                </tr>`;
            }).join('');

            if (token !== this._renderToken) return;

            content.innerHTML = `
                <div class="dtl-tbl-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th class="dtl-col-doc">Документ</th>
                                <th>Прогрес</th>
                                <th class="dtl-col-fit">Статус</th>
                                <th class="dtl-col-fit">Дедлайн</th>
                                <th style="width:60px">Дії</th>
                            </tr>
                        </thead>
                        <tbody>${cards}</tbody>
                    </table>
                </div>`;

            // Автооновлення кожні 30 секунд поки вкладка активна
            clearInterval(ResourcesPage._statusRefreshTimer);
            ResourcesPage._statusRefreshTimer = setInterval(() => {
                const el = document.getElementById('docs-tab-content');
                if (el && ResourcesPage._activeTab === 'status') {
                    ResourcesPage._renderStatusTab(el);
                } else {
                    clearInterval(ResourcesPage._statusRefreshTimer);
                }
            }, 30000);

        } catch (e) {
            content.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><h3>${Fmt.esc(e.message)}</h3></div>`;
        }
    },

    _statusRefreshTimer: null,

    _openStatusModal(docId) {
        if (!this._statusCache) return;
        const defaultFilter = AppState.isSuperAdmin() ? 'all' : 'acked';
        this._modalState = { docId, filter: defaultFilter, search: '', page: 0, mgrFilter: 'all' };
        const doc = this._statusCache.docs.find(d => d.id === docId);
        if (!doc) return;
        Modal.open({
            title: `📊 ${doc.title}`,
            size: 'lg',
            body: this._buildStatusModalBody(),
            footer: ''
        });
    },

    _buildStatusModalBody() {
        const { docId, filter, search, page, mgrFilter } = this._modalState;
        const { docs, employees: teamEmployees, allEmps, ackMap, mgrOptions, myDirects, isOwner } = this._statusCache;
        const doc = docs.find(d => d.id === docId);
        const teamScoped = mgrFilter === 'all' ? teamEmployees
            : mgrFilter === 'mine' ? myDirects
            : this._collectDescendants(mgrFilter, allEmps);
        // Лише ті, у кого справді є доступ (довіреність) до цього документа
        const employees = teamScoped.filter(e => this._docAppliesToEmployee(doc, e));
        const acks = ackMap[docId] || [];
        const ackedMap = {};
        acks.filter(a => (a.version || 1) >= (doc.doc_version || 1))
            .forEach(a => { ackedMap[a.userId] = a; });

        const deadlineMs = doc.deadline_days
            ? new Date(doc.created_at).getTime() + doc.deadline_days * 86400000
            : null;

        const ackedRows = employees.filter(e => ackedMap[e.id])
            .map(e => ({ ...e, ack: ackedMap[e.id], status: 'acked', sortKey: 0 }));

        const notAckedRows = employees.filter(e => !ackedMap[e.id]).map(e => {
            let status, sortKey;
            if (deadlineMs && deadlineMs < Date.now()) {
                status = 'overdue'; sortKey = 1;
            } else if (deadlineMs) {
                const d = Math.ceil((deadlineMs - Date.now()) / 86400000);
                status = d <= 3 ? 'soon' : 'pending';
                sortKey = d <= 3 ? 2 : 3;
            } else {
                status = 'pending'; sortKey = 3;
            }
            return { ...e, ack: null, status, sortKey };
        });

        const rows = [...ackedRows, ...notAckedRows];

        // Counts for filter tabs
        const counts = { all: rows.length, acked: 0, pending: 0, overdue: 0 };
        rows.forEach(r => {
            if (r.status === 'acked') counts.acked++;
            else if (r.status === 'overdue') counts.overdue++;
            else counts.pending++;
        });

        // Filter + search
        let filtered = rows;
        if (filter === 'acked')   filtered = rows.filter(r => r.status === 'acked');
        if (filter === 'pending') filtered = rows.filter(r => r.status !== 'acked');
        if (filter === 'overdue') filtered = rows.filter(r => r.status === 'overdue');
        if (search) {
            const q = search.toLowerCase();
            filtered = filtered.filter(r => r.full_name?.toLowerCase().includes(q) || r.job_position?.toLowerCase().includes(q));
        }
        filtered.sort((a, b) => a.sortKey - b.sortKey || (a.full_name || '').localeCompare(b.full_name || '', 'uk'));

        // Pagination
        const totalPages = Math.ceil(filtered.length / this._modalPageSize);
        const curPage = Math.min(page, Math.max(0, totalPages - 1));
        const pageRows = filtered.slice(curPage * this._modalPageSize, (curPage + 1) * this._modalPageSize);

        // Progress bar
        const pct = rows.length ? Math.round(counts.acked / rows.length * 100) : 0;
        const barColor = pct === 100 ? '#10b981' : pct >= 60 ? '#f59e0b' : '#ef4444';

        // Row HTML
        const rowsHtml = pageRows.map(r => {
            let statusHtml, rowClass;
            if (r.status === 'acked') {
                rowClass = 'acked';
                statusHtml = `<span style="color:#10b981"><i class="fa-solid fa-check"></i> ${Fmt.dateShort(r.ack.at)}</span>`;
            } else if (r.status === 'overdue') {
                rowClass = 'overdue';
                statusHtml = `<span style="color:#ef4444"><i class="fa-solid fa-triangle-exclamation"></i> Прострочено</span>`;
            } else if (r.status === 'soon') {
                rowClass = 'soon';
                const d = Math.ceil((deadlineMs - Date.now()) / 86400000);
                statusHtml = `<span style="color:#f59e0b"><i class="fa-solid fa-hourglass-half"></i> ${d} ${d === 1 ? 'день' : 'дні'}</span>`;
            } else {
                rowClass = '';
                statusHtml = `<span style="color:var(--text-muted)">— Не ознайомлено</span>`;
            }
            return `
            <div class="stm-row ${rowClass}">
                <div class="stm-avatar">${Fmt.esc(Fmt.initials(r.full_name || '?'))}</div>
                <div class="stm-row-body">
                    <div class="stm-row-name">${Fmt.esc(r.full_name || '—')}</div>
                    ${r.job_position ? `<div class="stm-row-pos">${Fmt.esc(r.job_position)}</div>` : ''}
                </div>
                <div class="stm-row-status">${statusHtml}</div>
            </div>`;
        }).join('') || `<div class="stm-empty"><i class="fa-solid fa-magnifying-glass" style="font-size:1.4rem;opacity:.3;display:block;margin-bottom:.5rem"></i>Нічого не знайдено</div>`;

        // Pagination HTML
        const pagesHtml = totalPages > 1 ? `
            <div style="display:flex;align-items:center;justify-content:center;gap:.5rem;margin-top:.2rem;flex-wrap:wrap">
                <button class="btn btn-ghost btn-sm" ${curPage === 0 ? 'disabled' : ''}
                    onclick="ResourcesPage._statusModalPage(${curPage - 1})" style="display:inline-flex;align-items:center;gap:.35rem"><i class="fa-solid fa-angle-left"></i></button>
                <span style="font-size:.8rem;color:var(--text-muted)">${curPage + 1} / ${totalPages}</span>
                <button class="btn btn-ghost btn-sm" ${curPage >= totalPages - 1 ? 'disabled' : ''}
                    onclick="ResourcesPage._statusModalPage(${curPage + 1})">›</button>
            </div>` : '';

        const chipCls = (f) => `dtl-chip${filter === f ? ' on' : ''}`;

        return `
            <div style="display:flex;flex-direction:column;gap:.9rem">

                <!-- §1 Прогрес -->
                <div class="stm-sec">
                    <div class="stm-sec-hdr">
                        <span class="stm-ico" style="background:rgba(16,185,129,.12);color:#10b981"><i class="fa-solid fa-chart-simple"></i></span>
                        <span class="stm-sec-title">Прогрес ознайомлення</span>
                        <span class="stm-pct" style="color:${barColor}">${pct}%</span>
                    </div>
                    <div class="stm-bar"><div class="stm-bar-fill" style="width:${pct}%;background:${barColor}"></div></div>
                    <div class="stm-stat-row">
                        <span class="stm-stat ok"><i class="fa-solid fa-check"></i> Ознайомились <b>${counts.acked}</b></span>
                        <span class="stm-stat pending"><i class="fa-solid fa-hourglass-half"></i> Не ознайомились <b>${counts.all - counts.acked}</b></span>
                        ${counts.overdue ? `<span class="stm-stat overdue"><i class="fa-solid fa-triangle-exclamation"></i> Прострочено <b>${counts.overdue}</b></span>` : ''}
                    </div>
                    <div class="dtl-dov-row">${
                        (doc.resource_dovirenosti || []).map(rd => rd.dovirenosti?.name).filter(Boolean).length
                            ? doc.resource_dovirenosti.map(rd => rd.dovirenosti?.name).filter(Boolean).map(n => `<span class="dtl-dov-chip has"><i class="fa-solid fa-building" style="font-size:.6rem"></i>${Fmt.esc(n)}</span>`).join('')
                            : `<span class="dtl-dov-chip all"><i class="fa-solid fa-globe" style="font-size:.6rem"></i>Для всіх ТОВ</span>`
                    }</div>
                </div>

                <!-- §2 Фільтр і пошук -->
                <div class="stm-sec">
                    <div class="stm-sec-hdr">
                        <span class="stm-ico" style="background:rgba(99,102,241,.12);color:#6366f1"><i class="fa-solid fa-filter"></i></span>
                        <span class="stm-sec-title">Фільтр і пошук</span>
                        <button class="dtl-icon-btn" title="Експорт у файл" onclick="ResourcesPage._exportStatusList()" style="margin-left:auto"><i class="fa-solid fa-download"></i></button>
                    </div>
                    ${mgrOptions.length ? `
                    <select class="dtl-sel" style="width:100%" onchange="ResourcesPage._statusModalSetMgrFilter(this.value)">
                        <option value="all"${mgrFilter==='all'?' selected':''}>👥 ${isOwner ? 'Всі користувачі' : 'Мій блок'} (${teamEmployees.length})</option>
                        ${myDirects.length ? `<option value="mine"${mgrFilter==='mine'?' selected':''}>🙋 Мої експерти (${myDirects.length})</option>` : ''}
                        ${mgrOptions.map(m => {
                            const cnt = this._collectDescendants(m.id, allEmps).length;
                            return `<option value="${m.id}"${mgrFilter===m.id?' selected':''}>${Fmt.esc(m.full_name)} (${cnt})</option>`;
                        }).join('')}
                    </select>` : ''}
                    <div class="dtl-chip-row" style="margin-bottom:0">
                        <button type="button" class="${chipCls('all')}" onclick="ResourcesPage._statusModalFilter('all')">Всі <span class="n">${counts.all}</span></button>
                        <button type="button" class="${chipCls('acked')}" onclick="ResourcesPage._statusModalFilter('acked')"><i class="fa-solid fa-check" style="font-size:.65rem;color:#10b981;margin-right:.15rem"></i>Ознайомились <span class="n">${counts.acked}</span></button>
                        <button type="button" class="${chipCls('pending')}" onclick="ResourcesPage._statusModalFilter('pending')"><i class="fa-solid fa-hourglass-half" style="font-size:.65rem;color:var(--text-muted);margin-right:.15rem"></i>Не ознайомились <span class="n">${counts.all - counts.acked}</span></button>
                        ${counts.overdue ? `<button type="button" class="${chipCls('overdue')}" onclick="ResourcesPage._statusModalFilter('overdue')"><i class="fa-solid fa-triangle-exclamation" style="font-size:.65rem;color:#ef4444;margin-right:.15rem"></i>Прострочені <span class="n">${counts.overdue}</span></button>` : ''}
                    </div>
                    <div class="stm-search">
                        <i class="fa-solid fa-magnifying-glass"></i>
                        <input type="text" placeholder="Пошук за іменем або посадою…" value="${Fmt.esc(search)}" oninput="ResourcesPage._statusModalSearch(this.value)">
                    </div>
                </div>

                <!-- §3 Список співробітників -->
                <div class="stm-sec">
                    <div class="stm-sec-hdr">
                        <span class="stm-ico" style="background:rgba(245,158,11,.12);color:#f59e0b"><i class="fa-solid fa-users"></i></span>
                        <span class="stm-sec-title">Співробітники</span>
                        <span class="stm-count-badge">${filtered.length}</span>
                    </div>
                    <div class="stm-list">${rowsHtml}</div>
                    ${pagesHtml}
                </div>

            </div>`;
    },

    _statusModalFilter(filter) {
        this._modalState.filter = filter;
        this._modalState.page = 0;
        const body = document.getElementById('modal-body');
        if (body) body.innerHTML = this._buildStatusModalBody();
    },

    _statusModalSetMgrFilter(val) {
        this._modalState.mgrFilter = val;
        this._modalState.page = 0;
        const body = document.getElementById('modal-body');
        if (body) body.innerHTML = this._buildStatusModalBody();
    },

    _statusModalSearch(val) {
        this._modalState.search = val;
        this._modalState.page = 0;
        const body = document.getElementById('modal-body');
        if (body) body.innerHTML = this._buildStatusModalBody();
    },

    _statusModalPage(p) {
        this._modalState.page = p;
        const body = document.getElementById('modal-body');
        if (body) body.innerHTML = this._buildStatusModalBody();
    },

    _exportStatusList() {
        const { docId, filter, search, mgrFilter } = this._modalState;
        const { docs, employees: teamEmployees, allEmps, ackMap, myDirects } = this._statusCache;
        const doc = docs.find(d => d.id === docId);
        if (!doc) return;
        const teamScoped = mgrFilter === 'all' ? teamEmployees
            : mgrFilter === 'mine' ? myDirects
            : this._collectDescendants(mgrFilter, allEmps);
        const employees = teamScoped.filter(e => this._docAppliesToEmployee(doc, e));

        const acks = ackMap[docId] || [];
        const ackedMap = {};
        acks.filter(a => (a.version || 1) >= (doc.doc_version || 1))
            .forEach(a => { ackedMap[a.userId] = a; });

        const deadlineMs = doc.deadline_days
            ? new Date(doc.created_at).getTime() + doc.deadline_days * 86400000
            : null;

        let rows = employees.map(e => {
            if (ackedMap[e.id]) return { ...e, status: 'acked', ackAt: ackedMap[e.id].at };
            if (deadlineMs && deadlineMs < Date.now()) return { ...e, status: 'overdue', ackAt: null };
            return { ...e, status: 'pending', ackAt: null };
        });

        if (filter === 'acked')   rows = rows.filter(r => r.status === 'acked');
        if (filter === 'pending') rows = rows.filter(r => r.status !== 'acked');
        if (filter === 'overdue') rows = rows.filter(r => r.status === 'overdue');
        if (search) {
            const q = search.toLowerCase();
            rows = rows.filter(r => r.full_name?.toLowerCase().includes(q) || r.job_position?.toLowerCase().includes(q));
        }
        rows.sort((a, b) => (a.full_name || '').localeCompare(b.full_name || '', 'uk'));

        const statusLabel = { acked: 'Ознайомлений', pending: 'Не ознайомлено', overdue: 'Прострочено' };
        const data = [
            ['ПІБ', 'Посада', 'Місто', 'Підрозділ', 'Статус', 'Дата ознайомлення'],
            ...rows.map(r => [
                r.full_name || '',
                r.job_position || '',
                r.city || '',
                r.subdivision || '',
                statusLabel[r.status] || '',
                r.ackAt ? Fmt.dateShort(r.ackAt) : ''
            ])
        ];

        const ws = XLSX.utils.aoa_to_sheet(data);
        ws['!cols'] = [40, 30, 20, 25, 20, 20].map(w => ({ wch: w }));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Ознайомлення');
        const filterSuffix = filter === 'pending' ? '_не_ознайомились' : filter === 'overdue' ? '_прострочені' : filter === 'acked' ? '_ознайомились' : '_всі';
        XLSX.writeFile(wb, `${Fmt.slug(doc.title)}${filterSuffix}.xlsx`);
    },

    async _loadFilters() {
        try {
            const courseArgs = AppState.isStaff() ? { pageSize: 200 } : { published: true, pageSize: 200 };
            const [coursesRes, categories, accessGroups, allDov] = await Promise.all([
                API.courses.getAll(courseArgs).catch(() => ({ data: [] })),
                API.resources.getCategories({ docsOnly: this._view === 'docs' }).catch(() => []),
                API.accessGroups.getAll().catch(() => []),
                API.dovirenosti.getAll().catch(() => [])
            ]);
            this._courses          = coursesRes.data || [];
            this._categories       = categories;
            this._accessGroups     = accessGroups;
            this._allDovirenosti   = allDov;
            if (!AppState.canSchedule()) {
                this._myDovirenosti = await API.dovirenosti.getForProfile(AppState.profile.id).catch(() => []);
            }
            this._renderFilterOptions();
        } catch (e) {
            console.warn('[ResourcesPage] filter load error', e);
        }
    },

    _renderFilterOptions() {
        const courseSelect = document.getElementById('resource-course');
        if (courseSelect) {
            courseSelect.innerHTML = `<option value="">Всі курси</option>` +
                this._courses.map(c => `<option value="${c.id}">${c.title}</option>`).join('');
        }

        // docs-cat-chips are built dynamically in load() from actual documents
    },

    _highlightCatBtn(activeBtn, cat) {
        // скидаємо всі таби
        document.querySelectorAll('#docs-tabs-bar .dtab').forEach(b => b.classList.remove('active'));
        if (cat && activeBtn) {
            activeBtn.classList.add('active');
        } else {
            document.getElementById('docs-tab-list')?.classList.add('active');
        }
    },

    _setCatFilter(cat, btn) {
        if (this._category === cat && cat !== '') return; // повторний клік — нічого не робимо
        this._category = cat;
        // if not on list tab — switch first (skipLoad=true), then load once with category
        if (this._activeTab !== 'list') {
            const savedCat = this._category;
            this.switchTab('list', document.getElementById('docs-tab-list'), { skipLoad: true });
            // restore category (switchTab reset it to '')
            this._category = savedCat;
            this._page = 0;
            this._highlightCatBtn(btn, savedCat);
            this.load();
            return;
        }
        this._highlightCatBtn(btn, this._category);
        this._page = 0;
        // Оновлюємо URL щоб history.back() повернув з активним чіпом
        const catParam = this._category ? `&cat=${encodeURIComponent(this._category)}` : '';
        history.replaceState(null, '', `#/documents?tab=list${catParam}`);
        this.load();
    },

    // ── Docs sort ────────────────────────────────────────────────────

    _docsSetSort(val) {
        this._docsSort = val;
        const sel = document.getElementById('docs-sort-sel');
        if (sel) sel.value = val;
        this.load();
    },

    _syncSortHeaders() {
        document.querySelectorAll('.dtl-tbl-wrap thead th.sortable').forEach(th => {
            th.classList.toggle('sorted', th.dataset.sort === this._docsSort);
        });
    },

    _docsResetFilters() {
        this._category = '';
        this._docsTreeStatus = '';
        this._docsTreeTov = '';
        this._page = 0;
        this.load();
    },

    _docsSetStatus(val) {
        this._docsTreeStatus = this._docsTreeStatus === val ? '' : val;
        this._page = 0;
        this.load();
    },

    _docsSetTov(val) {
        this._docsTreeTov = this._docsTreeTov === val ? '' : val;
        this._page = 0;
        this.load();
    },

    _docsSetStatusSel(val) {
        this._docsTreeStatus = val;
        this._page = 0;
        this.load();
    },

    _docsSetTovSel(val) {
        this._docsTreeTov = val;
        this._page = 0;
        this.load();
    },

    // Category color/icon lookup shared between the filter chips and the
    // "Тип" column of the docs table.
    _docCatDefs: [
        { key: 'Наказ',          label: 'Накази',         icon: 'fa-gavel',         color: '#ef4444' },
        { key: 'Розпорядження',  label: 'Розпорядження',  icon: 'fa-file-contract', color: '#f59e0b' },
        { key: 'Список НПА',     label: 'Список НПА',     icon: 'fa-book',          color: '#6366f1' },
    ],

    _renderDocsFilters(allDocs) {
        const chipWrap   = document.getElementById('docs-cat-chip-row');
        const facetWrap  = document.getElementById('docs-facet-sels');
        if (!chipWrap || !facetWrap) return;

        const catDefs = this._docCatDefs;
        const otherCats = [...new Set(allDocs.map(r => r.category).filter(c => c && !catDefs.find(d => d.key === c) && c.toLowerCase() !== 'general' && c.toLowerCase() !== 'реєстри нпа' && c.toLowerCase() !== 'реєстри' && c.toLowerCase() !== 'анкета'))].sort();

        // Status counts — за тим самим статусом, що видно на бейджі кожного
        // документа в таблиці (усі документи, не лише "трековані").
        const unreadCount = allDocs.filter(r => { const dl = this._myDownloads[r.id]; return !dl || r.doc_version > (dl.version||1); }).length;
        const readCount   = allDocs.length - unreadCount;

        // TOV counts
        const tovMap = {};
        allDocs.forEach(r => {
            const dovs = r.resource_dovirenosti || [];
            if (!dovs.length) {
                tovMap['__all__'] = (tovMap['__all__'] || 0) + 1;
            } else {
                dovs.forEach(rd => {
                    const n = rd.dovirenosti?.name;
                    if (n) tovMap[n] = (tovMap[n] || 0) + 1;
                });
            }
        });
        const _isPtZt = s => s.startsWith('ПТ');
        const _allEntries = Object.entries(tovMap).filter(([k]) => k !== '__all__');
        const _regular = _allEntries.filter(([k]) => !_isPtZt(k)).sort((a,b) => a[0].localeCompare(b[0], 'uk'));
        const _ptzt    = _allEntries.filter(([k]) =>  _isPtZt(k)).sort((a,b) => a[0].localeCompare(b[0], 'uk'));
        const tovEntries = [..._regular, ..._ptzt];

        // ── Category chip row ──
        const mkChip = (isActive, onclick, iconHtml, label, count) => `
            <button type="button" class="dtl-chip${isActive ? ' on' : ''}" onclick="${onclick}">${iconHtml}${Fmt.esc(label)} <span class="n">${count}</span></button>`;

        const catChips = [
            mkChip(!this._category, "ResourcesPage._setCatFilter('',null)", '', 'Всі', allDocs.length),
            ...catDefs.map(c => {
                const cnt = allDocs.filter(r => r.category === c.key).length;
                if (!cnt) return '';
                return mkChip(this._category === c.key, `ResourcesPage._setCatFilter(${JSON.stringify(c.key).replace(/"/g,'&quot;')},null)`,
                    `<i class="fa-solid ${c.icon}" style="font-size:.7rem;color:${c.color};margin-right:.3rem"></i>`, c.label, cnt);
            }),
            ...otherCats.map(c => {
                const cnt = allDocs.filter(r => r.category === c).length;
                return mkChip(this._category === c, `ResourcesPage._setCatFilter(${JSON.stringify(c).replace(/"/g,'&quot;')},null)`,
                    `<i class="fa-solid fa-tag" style="font-size:.7rem;color:var(--text-muted);margin-right:.3rem"></i>`, c, cnt);
            }),
        ].filter(Boolean).join('');

        const unreadChip = allDocs.length
            ? `<button type="button" class="dtl-chip unread${this._docsTreeStatus==='unread' ? ' on' : ''}" onclick="ResourcesPage._docsSetStatus('unread')"><span class="dot"></span>Не ознайомлені <span class="n">${unreadCount}</span></button>`
            : '';

        chipWrap.innerHTML = catChips + unreadChip;

        // ── ТОВ / Статус facet selects ──
        const tovOptions = `<option value="">ТОВ: усі</option>` +
            tovEntries.map(([n, cnt]) => `<option value="${Fmt.esc(n)}"${this._docsTreeTov===n?' selected':''}>${Fmt.esc(n)} (${cnt})</option>`).join('');
        const statusOptions = `
            <option value="">Статус: усі</option>
            <option value="unread"${this._docsTreeStatus==='unread'?' selected':''}>Не ознайомлені (${unreadCount})</option>
            <option value="read"${this._docsTreeStatus==='read'?' selected':''}>Ознайомлені (${readCount})</option>`;

        const hasFilter = this._category || this._docsTreeStatus || this._docsTreeTov;

        facetWrap.innerHTML = `
            ${tovEntries.length ? `<select class="dtl-sel" onchange="ResourcesPage._docsSetTovSel(this.value)">${tovOptions}</select>` : ''}
            ${allDocs.length ? `<select class="dtl-sel" onchange="ResourcesPage._docsSetStatusSel(this.value)">${statusOptions}</select>` : ''}
            ${hasFilter ? `<button type="button" class="dtl-reset" onclick="ResourcesPage._docsResetFilters()"><i class="fa-solid fa-xmark"></i> Скинути фільтри</button>` : ''}
        `;
    },

    _docsPriority(resource) {
        const dl = this._myDownloads[resource.id];
        const isNewVersion = dl && resource.doc_version > (dl.version || 1);
        if (!dl || isNewVersion) return 0;   // потребує ознайомлення / оновлено
        return 1;                             // вже ознайомлено
    },

    _docTovLabel(resource) {
        return (resource.resource_dovirenosti || []).length
            ? resource.resource_dovirenosti.map(rd => rd.dovirenosti?.name).filter(Boolean).join(', ')
            : 'Для всіх ТОВ';
    },

    _sortDocs(items) {
        const dl = this._myDownloads;
        const sorts = {
            priority: (a, b) => {
                const pa = this._docsPriority(a), pb = this._docsPriority(b);
                if (pa !== pb) return pa - pb;
                return new Date(b.created_at) - new Date(a.created_at);
            },
            newest:   (a, b) => new Date(b.created_at) - new Date(a.created_at),
            name_az:  (a, b) => (a.title || '').localeCompare(b.title || '', 'uk'),
            status_asc: (a, b) => {
                const pa = this._docsPriority(a), pb = this._docsPriority(b);
                if (pa !== pb) return pb - pa; // ознайомлені першими
                return new Date(b.created_at) - new Date(a.created_at);
            },
            type_az: (a, b) => (a.category || '').localeCompare(b.category || '', 'uk') || (a.title || '').localeCompare(b.title || '', 'uk'),
            tov_az: (a, b) => this._docTovLabel(a).localeCompare(this._docTovLabel(b), 'uk') || (a.title || '').localeCompare(b.title || '', 'uk'),
        };
        return [...items].sort(sorts[this._docsSort] || sorts.priority);
    },

    // ── KB helpers ───────────────────────────────────────────────────

    _kbTypeKey(resource) {
        const t = resource.type || '';
        const ext = (resource.storage_path || '').split('.').pop().toLowerCase();
        if (t === 'pdf' || ext === 'pdf') return 'pdf';
        if (t === 'video' || ['mp4','webm','ogg','avi','mov'].includes(ext)) return 'video';
        if (t === 'image' || ['jpg','jpeg','png','gif','svg','webp'].includes(ext)) return 'image';
        if (t === 'link') return 'link';
        if (t === 'scorm') return 'scorm';
        return 'file';
    },

    _kbTypeLabel(key) {
        return { pdf:'PDF', video:'Відео', image:'Зображення', link:'Посилання', scorm:'SCORM', file:'Файл' }[key] || 'Файл';
    },

    _kbTypeIcon(key) {
        return {
            pdf:      '<i class="fa-regular fa-file-pdf"></i>',
            video:    '<i class="fa-solid fa-video"></i>',
            image:    '<i class="fa-regular fa-file-image"></i>',
            scorm:    '<i class="fa-regular fa-file-zipper"></i>',
            document: '<i class="fa-regular fa-file-word"></i>',
            link:     '<i class="fa-regular fa-link"></i>',
            file:     '<i class="fa-regular fa-file"></i>',
        }[key] || '<i class="fa-regular fa-file"></i>';
    },

    _isNew(resource) {
        if (!resource.created_at) return false;
        return (Date.now() - new Date(resource.created_at).getTime()) < 7 * 86400000;
    },

    _kbTypeChips() {
        const types = [
            { key:'all',   label:'Всі',         icon:'fa-solid fa-layer-group',      color:'#6366f1' },
            { key:'pdf',   label:'PDF',          icon:'fa-regular fa-file-pdf',       color:'#f97316' },
            { key:'video', label:'Відео',        icon:'fa-solid fa-clapperboard',     color:'#a855f7' },
            { key:'image', label:'Зображення',   icon:'fa-regular fa-image',          color:'#06b6d4' },
            { key:'link',  label:'Посилання',    icon:'fa-solid fa-arrow-up-right-from-square', color:'#3b82f6' },
            { key:'scorm', label:'SCORM',        icon:'fa-solid fa-graduation-cap',   color:'#10b981' },
            { key:'file',  label:'Файл',         icon:'fa-regular fa-file',           color:'#64748b' },
        ];
        return types.map(t => {
            const active = this._kbTypeFilter === t.key;
            return `
            <button class="kb-type-chip${active?' active':''}" style="--tab-accent:${t.color}"
                onclick="ResourcesPage._kbSetType('${t.key}',this)">
                <span class="kb-type-ic"><i class="${t.icon}"></i></span>${t.label}
            </button>`;
        }).join('');
    },

    _kbSetType(key) {
        this._kbTypeFilter = key;
        const wrap = document.getElementById('kb-type-chips');
        if (wrap) wrap.innerHTML = this._kbTypeChips();
        this._page = 0;
        this._kbRerender();
    },

    _kbSetSort(val) {
        this._kbSort = val;
        this._page = 0;
        this._kbRerender();
    },

    _kbSetCat(val) {
        this._kbCatFilter = val;
        this._page = 0;
        this._kbRerender();
    },

    _kbSetView(mode, btn) {
        this._kbViewMode = mode;
        localStorage.setItem('kb_view', mode);
        document.querySelectorAll('.kb-view-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this._kbRerender();
    },

    _kbRerender() {
        const list = document.getElementById('resource-list');
        if (!list || !this._kbAllItems) return;
        let items = this._kbAllItems;
        if (this._kbTypeFilter !== 'all') {
            items = items.filter(r => this._kbTypeKey(r) === this._kbTypeFilter);
        }
        if (this._kbCatFilter !== 'all') {
            items = items.filter(r => r.category === this._kbCatFilter);
        }
        const sorts = {
            newest:  (a,b) => new Date(b.created_at) - new Date(a.created_at),
            oldest:  (a,b) => new Date(a.created_at) - new Date(b.created_at),
            name_az: (a,b) => (a.title||'').localeCompare(b.title||'', 'uk'),
            name_za: (a,b) => (b.title||'').localeCompare(a.title||'', 'uk'),
        };
        items = [...items].sort(sorts[this._kbSort] || sorts.newest);

        // Заповнити hero-stats. Якщо активний фільтр типу/категорії — показуємо
        // кількість ВІДФІЛЬТРОВАНИХ матеріалів (саме її й ділить на сторінки
        // пагінація нижче), інакше цифра "Матеріалів" не збігалась би з тим,
        // скільки сторінок реально показано, і виглядало це як баг пагінації.
        const totalEl = document.getElementById('kb-stat-total');
        const newEl   = document.getElementById('kb-stat-new');
        const hasFilter = this._kbTypeFilter !== 'all' || this._kbCatFilter !== 'all';
        if (totalEl) totalEl.textContent = hasFilter ? items.length : this._kbAllItems.length;
        if (newEl) {
            const weekAgo = Date.now() - 7 * 86400000;
            newEl.textContent = this._kbAllItems.filter(r => new Date(r.created_at).getTime() > weekAgo).length;
        }

        const totalPages = Math.max(1, Math.ceil(items.length / this._kbPageSize));
        if (this._page >= totalPages) this._page = totalPages - 1;
        if (this._page < 0) this._page = 0;
        const start = this._page * this._kbPageSize;
        const pageItems = items.slice(start, start + this._kbPageSize);

        list.className = this._kbViewMode === 'list' ? 'kb-list' : 'kb-grid';
        list.innerHTML = pageItems.length
            ? pageItems.map(r => this._renderResourceItem(r)).join('')
            : `<div class="kb-empty"><div class="kb-empty-ico">🔍</div><div class="kb-empty-head">Нічого не знайдено</div><div class="kb-empty-txt">Спробуйте інший фільтр або пошуковий запит</div></div>`;

        this._kbRenderPagination(items.length);
    },

    _kbSetPage(page) {
        this._page = page;
        this._kbRerender();
        document.getElementById('resource-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },

    _kbRenderPagination(total) {
        const container = document.getElementById('resources-pagination');
        if (!container) return;
        const pages = Math.ceil(total / this._kbPageSize);
        if (pages <= 1) { container.innerHTML = ''; return; }
        const cur = this._page;
        const btn = (i) => `<button class="btn ${i === cur ? 'btn-primary' : 'btn-ghost'} btn-sm" onclick="ResourcesPage._kbSetPage(${i})">${i + 1}</button>`;
        const dot = `<span style="align-self:center;color:var(--text-muted);padding:0 .1rem">…</span>`;
        const indices = new Set([0, 1, pages - 2, pages - 1, cur - 1, cur, cur + 1].filter(i => i >= 0 && i < pages));
        const sorted = [...indices].sort((a, b) => a - b);
        let html = '';
        let prev = -1;
        for (const i of sorted) {
            if (prev !== -1 && i > prev + 1) html += dot;
            html += btn(i);
            prev = i;
        }
        container.innerHTML = html;
    },

    _kbCardHtml(resource, icon) {
        const tkey = this._kbTypeKey(resource);
        const isNew = this._isNew(resource);
        const isBm = Bookmarks.isBookmarked('resource/'+resource.id);
        const safeTitle = JSON.stringify(resource.title||'').replace(/"/g,'&quot;');
        const safeIcon = JSON.stringify(icon||'').replace(/"/g,'&quot;');
        const safeCat = JSON.stringify(resource.category||'').replace(/"/g,'&quot;');
        const desc = resource.description ? Fmt.esc(resource.description) : '';
        return `
<div class="kb-card kb-t-${tkey}" onclick="ResourcesPage.openViewer('${resource.id}')">
    <div class="kb-card-accent"></div>
    <div class="kb-card-body">
        <div class="kb-card-top">
            <div class="kb-card-type-box">${this._kbTypeIcon(tkey)}</div>
            <div class="kb-card-badges">
                ${isNew ? '<span class="kb-badge kb-badge-new">✦ Нове</span>' : ''}
                <span class="kb-badge kb-badge-type kb-badge-${tkey}">${this._kbTypeLabel(tkey)}</span>
            </div>
        </div>
        <div class="kb-card-title">${this._highlight(resource.title, this._search)}</div>
        ${desc ? `<div class="kb-card-desc">${this._highlight(resource.description, this._search)}</div>` : ''}
        <div class="kb-card-meta">
            ${resource.category ? `<span class="kb-badge kb-badge-cat">${Fmt.esc(resource.category)}</span>` : ''}
            ${resource.course?.title ? `<span class="kb-badge kb-badge-course">📚 ${Fmt.esc(resource.course.title)}</span>` : ''}
        </div>
    </div>
    <div class="kb-card-footer" onclick="event.stopPropagation()">
        <div class="kb-card-actions">
            <a class="kb-btn-open" href="#/resource/${resource.id}?from=${this._view === 'docs' ? 'documents' : 'knowledge-base'}" onclick="return ResourcesPage._onOpenClick(event,'${resource.id}')"><i class="fa-solid fa-eye"></i> Відкрити</a>
            <a class="kb-btn-dl" href="#/resource/${resource.id}?from=${this._view === 'docs' ? 'documents' : 'knowledge-base'}" target="_blank" rel="noopener noreferrer" title="Відкрити в новому вікні"><i class="fa-solid fa-up-right-from-square"></i></a>
            ${resource.download_allowed && resource.type !== 'scorm' ? `<button class="kb-btn-dl" title="Завантажити" onclick="ResourcesPage.downloadResource('${resource.id}')"><i class="fa-solid fa-download"></i></button>` : ''}
            ${AppState.isAdmin() || AppState.isManager() ? `<button class="kb-btn-dl" title="Статистика перегляду" onclick="ResourcesPage.openViewStats('${resource.id}',${safeTitle})"><i class="fa-solid fa-chart-simple"></i></button>` : ''}
            ${AppState.isAdmin() && resource.type === 'scorm' ? `<button class="kb-btn-dl" title="Статистика проходження курсу" onclick="ResourcesPage.openScormStats('${resource.id}',${safeTitle})"><i class="fa-solid fa-graduation-cap"></i></button>` : ''}
            ${AppState.isStaff() && AppState.canMutate() ? `<button class="kb-btn-edit" title="Редагувати" onclick="ResourcesPage.openEdit('${resource.id}')"><i class="fa-solid fa-pen"></i></button><button class="kb-btn-del" title="Видалити" onclick="ResourcesPage.deleteResource('${resource.id}',${safeTitle})"><i class="fa-solid fa-trash"></i></button>` : ''}
        </div>
        <button class="kb-star res-star-btn${isBm?' active':''}"
            data-bm-route="resource/${resource.id}"
            title="${isBm?'Видалити з закладок':'Зберегти в закладки'}"
            onclick="Bookmarks.toggleResource('${resource.id}',${safeTitle},${safeIcon},${safeCat})">${isBm ? '<i class="fa-solid fa-bookmark"></i>' : '<i class="fa-regular fa-bookmark"></i>'}</button>
    </div>
</div>`;
    },

    _kbRowHtml(resource, icon) {
        const tkey = this._kbTypeKey(resource);
        const isNew = this._isNew(resource);
        const isBm = Bookmarks.isBookmarked('resource/'+resource.id);
        const safeTitle = JSON.stringify(resource.title||'').replace(/"/g,'&quot;');
        const safeIcon = JSON.stringify(icon||'').replace(/"/g,'&quot;');
        const safeCat = JSON.stringify(resource.category||'').replace(/"/g,'&quot;');
        return `
<div class="kb-row kb-t-${tkey}">
    <a class="kb-row-stretched-link" href="#/resource/${resource.id}?from=${this._view === 'docs' ? 'documents' : 'knowledge-base'}" onclick="return ResourcesPage._onOpenClick(event,'${resource.id}')" aria-label="${Fmt.esc(resource.title || 'Відкрити')}"></a>
    <div class="kb-row-icon">${this._kbTypeIcon(tkey)}</div>
    <div class="kb-row-info">
        <div class="kb-row-title">${this._highlight(resource.title, this._search)}</div>
        <div class="kb-row-meta">
            <span class="kb-badge kb-badge-type kb-badge-${tkey}">${this._kbTypeLabel(tkey)}</span>
            ${resource.category ? `<span class="kb-badge kb-badge-cat">${Fmt.esc(resource.category)}</span>` : ''}
            ${resource.course?.title ? `<span class="kb-badge kb-badge-course">📚 ${Fmt.esc(resource.course.title)}</span>` : ''}
            ${isNew ? '<span class="kb-badge kb-badge-new">✦ Нове</span>' : ''}
        </div>
    </div>
    <div class="kb-row-actions" onclick="event.stopPropagation()">
        <a class="kb-btn-open" href="#/resource/${resource.id}?from=${this._view === 'docs' ? 'documents' : 'knowledge-base'}" onclick="return ResourcesPage._onOpenClick(event,'${resource.id}')"><i class="fa-solid fa-eye"></i> Відкрити</a>
        <a class="kb-btn-dl" href="#/resource/${resource.id}?from=${this._view === 'docs' ? 'documents' : 'knowledge-base'}" target="_blank" rel="noopener noreferrer" title="Відкрити в новому вікні"><i class="fa-solid fa-up-right-from-square"></i></a>
        ${resource.download_allowed && resource.type !== 'scorm' ? `<button class="kb-btn-dl" title="Завантажити" onclick="ResourcesPage.downloadResource('${resource.id}')"><i class="fa-solid fa-download"></i></button>` : ''}
        ${AppState.isAdmin() || AppState.isManager() ? `<button class="kb-btn-dl" title="Статистика перегляду" onclick="ResourcesPage.openViewStats('${resource.id}',${safeTitle})"><i class="fa-solid fa-chart-simple"></i></button>` : ''}
            ${AppState.isAdmin() && resource.type === 'scorm' ? `<button class="kb-btn-dl" title="Статистика проходження курсу" onclick="ResourcesPage.openScormStats('${resource.id}',${safeTitle})"><i class="fa-solid fa-graduation-cap"></i></button>` : ''}
        ${AppState.isStaff() && AppState.canMutate() ? `<button class="kb-btn-edit" title="Редагувати" onclick="ResourcesPage.openEdit('${resource.id}')"><i class="fa-solid fa-pen"></i></button><button class="kb-btn-del" title="Видалити" onclick="ResourcesPage.deleteResource('${resource.id}',${safeTitle})"><i class="fa-solid fa-trash"></i></button>` : ''}
        <button class="kb-star res-star-btn${isBm?' active':''}"
            data-bm-route="resource/${resource.id}"
            title="${isBm?'Видалити з закладок':'Зберегти в закладки'}"
            onclick="Bookmarks.toggleResource('${resource.id}',${safeTitle},${safeIcon},${safeCat})">${isBm ? '<i class="fa-solid fa-bookmark"></i>' : '<i class="fa-regular fa-bookmark"></i>'}</button>
    </div>
</div>`;
    },

    _highlight(text, query) {
        if (!query || !text) return Fmt.esc(text || '');
        const escaped = Fmt.esc(text);
        const escQ = Fmt.esc(query).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return escaped.replace(new RegExp('(' + escQ + ')', 'gi'),
            '<mark style="background:#fde047;color:#1e1e1e;border-radius:2px;padding:0 1px">$1</mark>');
    },

    onSearch(e) {
        this._search = e.target.value.trim();
        this._page = 0;
        clearTimeout(this._searchTimer);
        this._searchTimer = setTimeout(() => this.load(), 300);
    },

    applyFilters() {
        this._courseId = Dom.val('resource-course') || undefined;
        this._page = 0;
        this.load();
    },

    async load(skipSpinner = false) {
        const list = document.getElementById('resource-list');
        if (!list) return;
        if (!skipSpinner) {
            list.innerHTML = `<div style="display:flex;justify-content:center;padding:3rem"><div class="spinner"></div></div>`;
        }
        try {
            const isKb = this._view === 'kb';
            const isDocs = this._view === 'docs';
            const { data, count } = await API.resources.getAll({
                courseId: this._courseId || undefined,
                search: this._search || undefined,
                // docs view: load all at once, category filtered frontend-side to avoid race conditions
                category: isDocs ? undefined : (this._category || undefined),
                page: (isKb || isDocs) ? 0 : this._page,
                pageSize: (isKb || isDocs) ? 500 : this._pageSize,
                includeLessonResources: false,
                studentOnly: isKb && !AppState.isStaff(),
                docsOnly: isDocs
            });

            // Frontend access filter: staff and managers in docs view see all
            let filtered = data;
            const bypassFilter = AppState.isStaff() || (this._view === 'docs' && AppState.isManager());
            if (!bypassFilter) {
                filtered = data.filter(r => AccessGroupsPage.checkAccess(r.access_group));
            }

            // Довіреності filter: docs view, non-privileged users
            if (this._view === 'docs' && !bypassFilter) {
                const myDovIds = new Set(this._myDovirenosti.map(d => d.id));
                filtered = filtered.filter(r => {
                    const rdovs = r.resource_dovirenosti || [];
                    if (rdovs.length === 0) return true;
                    return rdovs.some(rd => myDovIds.has(rd.dovirenost_id));
                });
            }

            // База знань: тільки публічні + нетраковані ресурси
            if (this._view === 'kb') {
                filtered = filtered.filter(r => {
                    if (r.is_tracked_download) return false;
                    if (r.access_group && !r.access_group.is_public) return false;
                    return true;
                });
            }

            // Документи: тільки з обмеженнями (трековані АБО обмежена група АБО з довіреностями)
            if (this._view === 'docs') {
                filtered = filtered.filter(r =>
                    r.is_tracked_download ||
                    (r.access_group && !r.access_group.is_public) ||
                    (r.resource_dovirenosti && r.resource_dovirenosti.length > 0)
                );
            }

            // Cache docs list for PDF drawer lookup
            if (this._view === 'docs') this._docsCache = filtered;

            // Load per-user download state for docs view
            if (this._view === 'docs' && filtered.length) {
                this._myDownloads = await API.documentDownloads
                    .getMyLatest(filtered.map(r => r.id)).catch(() => ({}));
                // Fire-and-forget: remind user about overdue docs (once per doc via DB dedup)
                const withDeadlines = filtered.filter(r => r.deadline_days);
                if (withDeadlines.length) {
                    API.documentDownloads.checkAndSendReminders(withDeadlines).catch(() => {});
                }
            }

            if (!filtered || !filtered.length) {
                if (this._view === 'docs') {
                    list.innerHTML = `<tr><td colspan="6"><div class="empty-state" style="border:none"><div class="empty-icon">📋</div><h3>Документів не знайдено</h3><p>Спробуйте змінити пошук або фільтри.</p></div></td></tr>`;
                } else {
                    list.className = '';
                    list.innerHTML = `
                    <div class="${this._view === 'kb' ? 'kb-empty' : 'empty-state'}" style="${this._view!=='kb'?'grid-column:1/-1':''}">
                        <div class="${this._view==='kb'?'kb-empty-ico':'empty-icon'}">📚</div>
                        ${this._view==='kb'
                            ? `<div class="kb-empty-head">Матеріали не знайдені</div><div class="kb-empty-txt">Спробуйте змінити пошук або фільтри</div>`
                            : `<h3>Документів не знайдено</h3><p>Спробуйте змінити пошук або фільтри.</p>`}
                    </div>`;
                }
                document.getElementById('resources-pagination').innerHTML = '';
                return;
            }

            if (this._view === 'kb') {
                this._kbAllItems = filtered;
                // категорії будуються з повного невідфільтрованого списку — так само як у Документах
                const cats = [...new Set(filtered.map(r => r.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'uk'));
                const catSelect = document.getElementById('kb-cat-filter');
                if (catSelect) {
                    if (this._kbCatFilter !== 'all' && !cats.includes(this._kbCatFilter)) this._kbCatFilter = 'all';
                    catSelect.innerHTML = `<option value="all">Всі категорії</option>` +
                        cats.map(c => `<option value="${Fmt.esc(c)}"${this._kbCatFilter === c ? ' selected' : ''}>${Fmt.esc(c)}</option>`).join('');
                }
                this._kbRerender();
                return;
            }

            if (this._view === 'docs') {
                // always rebuild category chips from full unfiltered visible list
                const cats = [...new Set(filtered.map(r => r.category).filter(c => c && c.toLowerCase() !== 'general' && c.toLowerCase() !== 'реєстри нпа' && c.toLowerCase() !== 'реєстри' && c.toLowerCase() !== 'список нпа' && c.toLowerCase() !== 'наказ' && c.toLowerCase() !== 'розпорядження' && c.toLowerCase() !== 'анкета'))].sort();
                const catChips = document.getElementById('docs-cat-chips');
                if (catChips) {
                    catChips.innerHTML = cats.map(c => `
                        <button class="btn btn-sm docs-cat-chip ${this._category === c ? 'btn-primary' : 'btn-ghost'}"
                                onclick="ResourcesPage._setCatFilter(${JSON.stringify(c).replace(/"/g,'&quot;')},this)">
                            ${Fmt.esc(c)}
                        </button>`).join('');
                }

                // Populate facet selects + category chips (use full unfiltered docs for counts)
                this._renderDocsFilters(filtered);

                // apply category filter frontend-side
                if (this._category) {
                    filtered = filtered.filter(r => r.category === this._category);
                }
                // apply tree status filter — за тим самим статусом, що й
                // видно на бейджі кожного документа (усі документи, не
                // лише "трековані" — is_tracked_download більше не звужує
                // цей фільтр, щоб лічильник збігався з тим, що видно в таблиці)
                if (this._docsTreeStatus === 'unread') {
                    filtered = filtered.filter(r => {
                        const dl = this._myDownloads[r.id];
                        return !dl || r.doc_version > (dl.version || 1);
                    });
                } else if (this._docsTreeStatus === 'read') {
                    filtered = filtered.filter(r => {
                        const dl = this._myDownloads[r.id];
                        return dl && !(r.doc_version > (dl.version || 1));
                    });
                }
                // apply tree TOV filter
                if (this._docsTreeTov) {
                    filtered = filtered.filter(r => (r.resource_dovirenosti||[]).some(rd => rd.dovirenosti?.name === this._docsTreeTov));
                }
                filtered = this._sortDocs(filtered);
            }

            if (this._view === 'docs') {
                this._syncSortHeaders();
                const start = this._page * this._pageSize;
                const pageItems = this._docsShowAll ? filtered : filtered.slice(start, start + this._pageSize);
                list.innerHTML = pageItems.map(resource => this._renderResourceItem(resource)).join('');
                this._renderPagination(filtered.length);
            } else {
                list.innerHTML = filtered.map(resource => this._renderResourceItem(resource)).join('');
                this._renderPagination(count);
            }
        } catch (e) {
            list.innerHTML = this._view === 'docs'
                ? `<tr><td colspan="6"><div class="empty-state" style="border:none"><div class="empty-icon">⚠️</div><h3>${Fmt.esc(e.message)}</h3></div></td></tr>`
                : `<div class="empty-state"><div class="empty-icon">⚠️</div><h3>${Fmt.esc(e.message)}</h3></div>`;
            document.getElementById('resources-pagination').innerHTML = '';
        }
    },

    _renderResourceItem(resource) {
        const icon = this._resourceIcon(resource.type || resource.file_type || 'file');
        const courseLabel = resource.course?.title ? `Курс: ${resource.course.title}` : '';
        const adminMeta = this._view === 'admin' ? [
            `👤 ${resource.creator?.full_name || 'Невідомо'}`,
            resource.created_at ? `🕐 ${Fmt.date(resource.created_at)}` : ''
        ].filter(Boolean).join(' · ') : '';

        if (this._view === 'docs') {
            const dlStatus = this._myDownloads[resource.id]; // { at, version } | null
            const dlAt = dlStatus?.at;
            const isNewVersion = dlStatus && resource.doc_version > (dlStatus.version || 1);

            // Візуальний статус "Ознайомлено"/"Не ознайомлено" тепер однаковий
            // для ВСІХ документів (трекованих і ні) — раніше нетраковані
            // показували нейтральне сіре "Відкрито", що виглядало
            // неузгоджено. is_tracked_download і далі впливає лише на фільтр
            // "Статус" (_renderDocsFilters) — туди потрапляють тільки
            // трековані документи.
            let statusBadge;
            if (isNewVersion) {
                statusBadge = `<span style="display:inline-flex;align-items:center;gap:.3rem;font-size:.73rem;color:#d97706;font-weight:500"><i class="fa-solid fa-rotate" style="font-size:.65rem"></i> Нова версія</span>`;
            } else if (dlAt) {
                statusBadge = `<span style="display:inline-flex;align-items:center;gap:.3rem;font-size:.73rem;color:#10b981;font-weight:500"><i class="fa-solid fa-check" style="font-size:.65rem"></i> ${this._ackLabel()} ${Fmt.dateShort(dlAt)}</span>`;
            } else {
                statusBadge = `<span style="display:inline-flex;align-items:center;gap:.3rem;font-size:.73rem;color:#ef4444;font-weight:500"><i class="fa-solid fa-circle-exclamation" style="font-size:.65rem"></i> Не ознайомлено</span>`;
            }

            const deadlineBadge = this._deadlineBadge(resource, dlStatus);

            const ackDotClass = (dlAt && !isNewVersion) ? 'res-read' : 'res-unread';
            const ackDotTitle = (dlAt && !isNewVersion) ? 'Ознайомлено' : (isNewVersion ? 'Нова версія — потрібне повторне ознайомлення' : 'Не ознайомлено');
            const ackDot = `<span class="res-ack-dot ${ackDotClass}" title="${ackDotTitle}" data-doc-dot="${resource.id}"></span>`;

            const catDef = this._docCatDefs.find(c => c.key === resource.category);
            const typeSwatch = catDef ? catDef.color : (resource.category ? 'var(--text-muted)' : 'transparent');
            const typeLabel = resource.category ? Fmt.esc(resource.category) : '—';

            const tovLabel = Fmt.esc(this._docTovLabel(resource));

            const lockIcon = resource.download_allowed === false
                ? `<i class="fa-solid fa-ban" style="font-size:.65rem;color:#ef4444" title="Тільки перегляд"></i>`
                : '';
            const accessIcon = resource.access_group
                ? `<i class="fa-solid ${resource.access_group.is_public ? 'fa-globe' : 'fa-lock'}" style="font-size:.65rem;color:var(--primary)" title="${Fmt.esc(resource.access_group.name)}"></i>`
                : '';

            return `
                <tr class="dtl-row" data-id="${resource.id}" onclick="ResourcesPage.openViewer('${resource.id}')">
                    <td>
                        <div class="dtl-td-doc">
                            <div class="res-ic-wrap">${ackDot}<div class="dtl-doc-ic resource-icon ${resource.type || 'file'}">${icon}</div></div>
                            <div style="min-width:0">
                                <div class="dtl-doc-title" oncontextmenu="return ResourcesPage._docCtxMenu(event,'${resource.id}')">${this._highlight(resource.title, this._search)}${lockIcon}${accessIcon}</div>
                                ${resource.description ? `<div class="dtl-doc-desc" title="${Fmt.esc(resource.description)}">${this._highlight(resource.description, this._search)}</div>` : ''}
                            </div>
                        </div>
                    </td>
                    <td class="dtl-col-type" style="text-align:center"><span class="dtl-type-pill"><span class="sw" style="background:${typeSwatch}"></span>${typeLabel}</span></td>
                    <td style="text-align:center"><span class="dtl-tov">${tovLabel}</span></td>
                    <td class="dtl-col-fit"><div class="dtl-status" data-status-row>${statusBadge}${deadlineBadge}</div></td>
                    <td class="dtl-col-fit" style="color:var(--text-muted)">${dlAt ? Fmt.dateShort(dlAt) : (resource.created_at ? Fmt.dateShort(resource.created_at) : '—')}</td>
                    <td onclick="event.stopPropagation()">
                        <div class="dtl-row-actions">
                            <a class="dtl-icon-btn" href="#/resource/${resource.id}?from=documents" onclick="return ResourcesPage._onOpenClick(event,'${resource.id}')" title="Відкрити"><i class="fa-solid fa-eye"></i></a>
                            <a class="dtl-icon-btn" href="#/resource/${resource.id}?from=documents" target="_blank" rel="noopener noreferrer" title="Відкрити в новому вікні"><i class="fa-solid fa-up-right-from-square"></i></a>
                            ${AppState.isStaff() && AppState.canMutate() ? `<button class="dtl-icon-btn" title="Редагувати" onclick="ResourcesPage.openEdit('${resource.id}')"><i class="fa-solid fa-pen"></i></button><button class="dtl-icon-btn res-del-btn" title="Видалити" onclick="ResourcesPage.deleteResource('${resource.id}',${JSON.stringify(resource.title||'').replace(/"/g,'&quot;')})"><i class="fa-solid fa-trash"></i></button>` : ''}
                        </div>
                    </td>
                </tr>`;
        }

        return this._kbViewMode === 'list'
            ? this._kbRowHtml(resource, icon)
            : this._kbCardHtml(resource, icon);
    },

    _ackLabel() {
        return AppState.user?.gender === 'female' ? 'Ознайомлена' : 'Ознайомлений';
    },

    _deadlineBadge(resource, dlStatus) {
        const needsAck = !dlStatus || (resource.doc_version > (dlStatus.version || 1));
        if (!needsAck || !resource.deadline_days) return '';
        const deadlineMs = new Date(resource.created_at).getTime() + resource.deadline_days * 86400000;
        const daysLeft = Math.ceil((deadlineMs - Date.now()) / 86400000);
        if (daysLeft <= 0) return `<span style="font-size:.7rem;background:#fef2f2;color:#dc2626;padding:2px 7px;border-radius:10px;font-weight:500">🔴 Прострочено</span>`;
        if (daysLeft <= 3) return `<span style="font-size:.7rem;background:#fef3c7;color:#d97706;padding:2px 7px;border-radius:10px;font-weight:500">⏰ ${daysLeft} ${daysLeft === 1 ? 'день' : 'дні'}</span>`;
        return `<span style="font-size:.7rem;background:#ecfdf5;color:#059669;padding:2px 7px;border-radius:10px;font-weight:500">📅 до ${Fmt.dateShort(new Date(deadlineMs))}</span>`;
    },

    _buildFilename(resource) {
        const ext = resource.storage_path
            ? '.' + resource.storage_path.split('.').pop().toLowerCase()
            : '';
        const base = (resource.title || resource.storage_path?.split('/').pop() || 'download')
            .replace(/[/\\:*?"<>|]/g, '_').trim();
        return ext && !base.toLowerCase().endsWith(ext) ? base + ext : base;
    },

    _fileLabel(resource) {
        const ext = resource.storage_path
            ? resource.storage_path.split('.').pop().toLowerCase()
            : '';
        const mime = (resource.file_type || '').toLowerCase();
        if (resource.type === 'pdf' || ext === 'pdf') return 'PDF';
        if (resource.type === 'video' || ['mp4','webm','ogg','avi','mov'].includes(ext)) return 'VIDEO';
        if (resource.type === 'image' || ['jpg','jpeg','png','gif','svg','webp'].includes(ext)) return 'IMAGE';
        if (resource.type === 'scorm') return 'SCORM';
        if (resource.type === 'link') return 'LINK';
        if (ext === 'doc'  || mime.includes('msword'))                                    return 'WORD';
        if (ext === 'docx' || mime.includes('wordprocessingml'))                          return 'WORD';
        if (ext === 'xls'  || mime.includes('ms-excel'))                                  return 'EXCEL';
        if (ext === 'xlsx' || mime.includes('spreadsheetml'))                             return 'EXCEL';
        if (ext === 'ppt'  || mime.includes('ms-powerpoint'))                             return 'PPT';
        if (ext === 'pptx' || mime.includes('presentationml'))                            return 'PPT';
        if (ext === 'zip'  || mime.includes('zip'))                                       return 'ZIP';
        if (ext === 'rar'  || mime.includes('rar'))                                       return 'RAR';
        if (ext === '7z')                                                                  return '7Z';
        if (ext === 'txt'  || mime.includes('text/plain'))                                return 'TXT';
        if (ext === 'csv'  || mime.includes('text/csv'))                                  return 'CSV';
        if (ext)                                                                           return ext.toUpperCase();
        return 'FILE';
    },

    _resourceIcon(type) {
        switch (type) {
            case 'pdf':      return '<i class="fa-regular fa-file-pdf"></i>';
            case 'video':    return '<i class="fa-solid fa-video"></i>';
            case 'image':    return '<i class="fa-regular fa-file-image"></i>';
            case 'scorm':    return '<i class="fa-regular fa-file-zipper"></i>';
            case 'document': return '<i class="fa-regular fa-file-word"></i>';
            case 'file':     return '<i class="fa-regular fa-file"></i>';
            default:         return '<i class="fa-regular fa-file"></i>';
        }
    },

    // "Відкрити" зроблено справжнім <a href> (не тільки <button onclick>),
    // щоб правий клік давав нативний пункт браузера "Відкрити посилання в
    // новій вкладці/вікні" — на звичайній кнопці без href браузер показує
    // лише загальне меню сторінки. Лівий клік і далі йде через openViewer()
    // з усією особливою логікою (PDF-шухляда, трекінг перегляду тощо).
    _onOpenClick(e, id) {
        e.preventDefault();
        this.openViewer(id);
        return false;
    },

    // Праве клацання по назві документа в таблиці — контекстне меню
    // "Відкрити" / "Відкрити в новому вікні".
    _docCtxMenu(e, id) {
        e.preventDefault();
        e.stopPropagation();
        document.getElementById('dtl-ctxmenu')?.remove();

        const menu = document.createElement('div');
        menu.id = 'dtl-ctxmenu';
        menu.className = 'dtl-ctxmenu';
        menu.innerHTML = `
            <button type="button" class="dtl-ctxmenu-item" onclick="ResourcesPage._ctxMenuOpen('${id}')"><i class="fa-solid fa-eye"></i> Відкрити</button>
            <a class="dtl-ctxmenu-item" href="#/resource/${id}?from=documents" target="_blank" rel="noopener noreferrer" onclick="ResourcesPage._closeCtxMenu()"><i class="fa-solid fa-up-right-from-square"></i> Відкрити в новому вікні</a>`;
        document.body.appendChild(menu);

        // Позиціонуємо біля курсора, але не даємо вилізти за край екрана
        const { innerWidth: vw, innerHeight: vh } = window;
        const { offsetWidth: mw, offsetHeight: mh } = menu;
        menu.style.left = Math.min(e.clientX, vw - mw - 8) + 'px';
        menu.style.top = Math.min(e.clientY, vh - mh - 8) + 'px';

        setTimeout(() => document.addEventListener('click', ResourcesPage._closeCtxMenu, { once: true }), 0);
        return false;
    },

    _ctxMenuOpen(id) {
        this._closeCtxMenu();
        this.openViewer(id);
    },

    _closeCtxMenu() {
        document.getElementById('dtl-ctxmenu')?.remove();
    },

    openViewer(id) {
        if (this._view === 'docs') {
            const resource = (this._docsCache || []).find(r => r.id === id);
            const ext = resource?.storage_path?.split('.').pop().toLowerCase() || '';
            const isPdf = resource && (resource.type === 'pdf' || ext === 'pdf');

            if (isPdf && window.innerWidth >= 1400) {
                this._openPdfDrawer(resource);
                return;
            }
            // Трекання ознайомлення тепер лише в самому переглядачі:
            // PDF — скрол до кінця, відео — перегляд до заданого відсотка
            // (_setupUnlockListeners). Зображення/інші iframe-документи не
            // трекаються взагалі — немає надійного сигналу "прочитано".
        }
        const from = this._view === 'admin' ? 'resources' : this._view === 'docs' ? 'documents' : 'knowledge-base';
        let route = `resource/${id}?from=${from}`;
        if (this._view === 'docs') {
            const tab = this._activeTab || 'list';
            route += `&tab=${tab}`;
            if (this._category) route += `&cat=${encodeURIComponent(this._category)}`;
        }
        Router.go(route);
    },

    // Спільна шухляда для перегляду PDF праворуч — викликається не лише зі
    // списку Документів, а й з Реєстрів/Червоної папки/Куточка споживача,
    // де свого кешу ResourcesPage._myDownloads немає. Тому статус
    // ознайомлення підвантажуємо тут же, якщо він ще не відомий цій сесії.
    async _openPdfDrawer(resource) {
        // Remove existing drawer if any
        document.getElementById('pdf-drawer')?.remove();
        document.getElementById('pdf-drawer-backdrop')?.remove();

        if (!this._myDownloads) this._myDownloads = {};
        if (!(resource.id in this._myDownloads)) {
            try {
                const latest = await API.documentDownloads.getMyLatest([resource.id]);
                this._myDownloads[resource.id] = latest[resource.id] || null;
            } catch (_) { this._myDownloads[resource.id] = null; }
        }

        let url;
        try {
            url = await this._getResourceUrl(resource);
        } catch (e) {
            Toast.error('Помилка', 'Не вдалося завантажити файл');
            return;
        }

        const dl = resource.download_allowed !== false ? '1' : '0';
        const viewerUrl = `pdf-viewer.html?file=${encodeURIComponent(url)}&title=${encodeURIComponent(resource.title || 'PDF')}&download=${dl}&panel=closed`;

        const dlStatus = (this._myDownloads || {})[resource.id];
        const isBm = Bookmarks.isBookmarked('resource/' + resource.id);
        const safeTitle = JSON.stringify(resource.title || '').replace(/"/g, '&quot;');
        const safeIcon  = JSON.stringify('<i class="fa-regular fa-file-pdf"></i>').replace(/"/g, '&quot;');
        const safeCat   = JSON.stringify(resource.category || '').replace(/"/g, '&quot;');

        // "Ознайомлено"/"Не ознайомлено" однаково для трекованих і
        // нетрекованих (як тепер і в списку) — is_tracked_download більше
        // не впливає на візуальний статус самого документа.
        const ackBadge = dlStatus
            ? `<span class="pdf-drawer-ack pdf-drawer-ack--done" id="pdf-drawer-ack">
                   <i class="fa-solid fa-check"></i> ${this._ackLabel()} ${Fmt.dateShort(dlStatus.at)}
               </span>`
            : `<span class="pdf-drawer-ack pdf-drawer-ack--pending" id="pdf-drawer-ack">
                   <i class="fa-regular fa-clock"></i> Не ознайомлено
               </span>`;

        const backdrop = document.createElement('div');
        backdrop.id = 'pdf-drawer-backdrop';
        backdrop.className = 'pdf-drawer-backdrop';
        backdrop.onclick = () => ResourcesPage._closePdfDrawer();

        const drawer = document.createElement('div');
        drawer.id = 'pdf-drawer';
        drawer.className = 'pdf-drawer';
        drawer.innerHTML = `
            <div class="pdf-drawer-header">
                <div class="pdf-drawer-title"><i class="fa-regular fa-file-pdf" style="color:var(--danger)"></i> ${Fmt.esc(resource.title || 'PDF')}</div>
                <div class="pdf-drawer-meta">
                    ${ackBadge}
                    <button class="pdf-drawer-bm${isBm ? ' active' : ''}" id="pdf-drawer-bm"
                        title="${isBm ? 'Видалити з закладок' : 'Зберегти в закладки'}"
                        onclick="ResourcesPage._toggleDrawerBookmark('${resource.id}',${safeTitle},${safeIcon},${safeCat})">
                        <i class="${isBm ? 'fa-solid' : 'fa-regular'} fa-bookmark"></i>
                    </button>
                </div>
                <button class="pdf-drawer-close" onclick="ResourcesPage._closePdfDrawer()" title="Закрити"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <div class="pdf-drawer-body">
                <iframe src="${viewerUrl}" style="width:100%;height:100%;border:none"></iframe>
            </div>`;

        this._drawerResource = resource;

        // Блокуємо скрол сторінки позаду — інакше наведення курсору поза
        // межами шухляди й прокрутка колесом гортає фоновий список
        // документів, а не саму шухляду.
        document.body.style.overflow = 'hidden';

        document.body.appendChild(backdrop);
        document.body.appendChild(drawer);

        // Animate in
        requestAnimationFrame(() => {
            backdrop.classList.add('pdf-drawer-backdrop--open');
            drawer.classList.add('pdf-drawer--open');
        });

        // Track as read after scrolling to end
        this._drawerScrollHandler = e => {
            if (e.data?.type === 'pdf-scroll-end') {
                API.documentDownloads.track(resource.id).catch(() => {});
                if (!this._myDownloads) this._myDownloads = {};
                if (!this._myDownloads[resource.id]) {
                    const now = new Date().toISOString();
                    this._myDownloads[resource.id] = { at: now, version: resource.doc_version || 1 };
                    UI.loadDocBadge();
                    // Update ack badge in drawer header
                    const badge = document.getElementById('pdf-drawer-ack');
                    if (badge) {
                        badge.className = 'pdf-drawer-ack pdf-drawer-ack--done';
                        badge.innerHTML = `<i class="fa-solid fa-check"></i> ${this._ackLabel()} ${Fmt.dateShort(now)}`;
                    }
                    // Шухляда — це оверлей ПОВЕРХ списку, а не окрема сторінка,
                    // тому рядок у списку позаду треба оновити вручну — інакше
                    // він лишається зі старим статусом навіть після ознайомлення.
                    this._refreshDocCard(resource);
                    // Реєстри/Червона папка/Куточок споживача відкривають цю ж
                    // шухляду, але мають власні індикатори "ознайомлено" —
                    // подія дозволяє їм синхронізуватись, не знаючи одне про одного.
                    window.dispatchEvent(new CustomEvent('doc-acked', { detail: { resourceId: resource.id, version: resource.doc_version || 1, at: now } }));
                }
                window.removeEventListener('message', this._drawerScrollHandler);
                this._drawerScrollHandler = null;
            }
        };
        window.addEventListener('message', this._drawerScrollHandler);

        // Close on Escape
        this._drawerEscHandler = e => { if (e.key === 'Escape') ResourcesPage._closePdfDrawer(); };
        document.addEventListener('keydown', this._drawerEscHandler);
    },

    _refreshDocCard(resource) {
        const card = document.querySelector(`.dtl-row[data-id="${resource.id}"]`);
        if (!card) return;
        const dlStatus = (this._myDownloads || {})[resource.id];
        const dlAt = dlStatus?.at;
        const isNewVersion = dlStatus && resource.doc_version > (dlStatus.version || 1);

        // Update status badge — однаково для трекованих і нетрекованих
        // (is_tracked_download впливає лише на розділ "Статус" у сайдбарі)
        const statusRow = card.querySelector('[data-status-row]');
        if (statusRow) {
            let statusBadge;
            if (isNewVersion) {
                statusBadge = `<span style="display:inline-flex;align-items:center;gap:.3rem;font-size:.73rem;color:#d97706;font-weight:500"><i class="fa-solid fa-rotate" style="font-size:.65rem"></i> Нова версія</span>`;
            } else if (dlAt) {
                statusBadge = `<span style="display:inline-flex;align-items:center;gap:.3rem;font-size:.73rem;color:#10b981;font-weight:500"><i class="fa-solid fa-check" style="font-size:.65rem"></i> ${this._ackLabel()} ${Fmt.dateShort(dlAt)}</span>`;
            } else {
                statusBadge = `<span style="display:inline-flex;align-items:center;gap:.3rem;font-size:.73rem;color:#ef4444;font-weight:500"><i class="fa-solid fa-circle-exclamation" style="font-size:.65rem"></i> Не ознайомлено</span>`;
            }
            statusRow.innerHTML = statusBadge + this._deadlineBadge(resource, dlStatus);
        }

        // Update ack dot
        const dot = card.querySelector(`[data-doc-dot="${resource.id}"]`);
        if (dot) {
            const isRead = dlAt && !isNewVersion;
            dot.className = `res-ack-dot ${isRead ? 'res-read' : 'res-unread'}`;
            dot.title = isRead ? 'Ознайомлено' : (isNewVersion ? 'Нова версія — потрібне повторне ознайомлення' : 'Не ознайомлено');
        }

    },

    _toggleDrawerBookmark(id, title, icon, category) {
        Bookmarks.toggleResource(id, title, icon, category);
        const isBm = Bookmarks.isBookmarked('resource/' + id);
        const btn = document.getElementById('pdf-drawer-bm');
        if (btn) {
            btn.classList.toggle('active', isBm);
            btn.title = isBm ? 'Видалити з закладок' : 'Зберегти в закладки';
            btn.innerHTML = `<i class="${isBm ? 'fa-solid' : 'fa-regular'} fa-bookmark"></i>`;
        }
    },

    _closePdfDrawer() {
        const drawer = document.getElementById('pdf-drawer');
        const backdrop = document.getElementById('pdf-drawer-backdrop');
        if (!drawer) return;
        drawer.classList.remove('pdf-drawer--open');
        backdrop?.classList.remove('pdf-drawer-backdrop--open');
        document.body.style.overflow = '';
        setTimeout(() => {
            drawer.remove();
            backdrop?.remove();
        }, 300);
        if (this._drawerEscHandler) {
            document.removeEventListener('keydown', this._drawerEscHandler);
            this._drawerEscHandler = null;
        }
        if (this._drawerScrollHandler) {
            window.removeEventListener('message', this._drawerScrollHandler);
            this._drawerScrollHandler = null;
        }
        if (this._drawerResource) {
            this._refreshDocCard(this._drawerResource);
            this._drawerResource = null;
        }
    },

    async _getResourceUrl(resource) {
        if (resource.file_url) return resource.file_url;
        if (resource.storage_path) return await API.resources.getSignedUrl(resource.storage_path);
        throw new Error('Файл не знайдено');
    },

    _buildViewerContent(resource, url) {
        const ext = resource.storage_path
            ? resource.storage_path.split('.').pop().toLowerCase()
            : (resource.file_type?.split('/').pop() || '');
        const description = resource.description ? `<p style="margin:0 0 1rem;color:var(--text-muted)">${resource.description}</p>` : '';

        if (resource.type === 'pdf' || ext === 'pdf') {
            const downloadAllowed = resource.download_allowed !== false ? '1' : '0';
            const viewerUrl = `pdf-viewer.html?file=${encodeURIComponent(url)}&title=${encodeURIComponent(resource.title || 'PDF')}&download=${downloadAllowed}`;
            return `${description}<iframe src="${viewerUrl}" style="width:100%;height:85vh;border:none"></iframe>`;
        }

        if (resource.type === 'video' || ['mp4','webm','ogg'].includes(ext)) {
            const noDownload = resource.download_allowed === false ? 'controlsList="nodownload"' : '';
            return `${description}<video controls ${noDownload} src="${url}" style="width:100%;max-height:75vh;background:#000"></video>`;
        }

        if (resource.type === 'image' || ['jpg','jpeg','png','gif','svg'].includes(ext)) {
            return `${description}<div style="text-align:center"><img src="${url}" style="max-width:100%;max-height:75vh;object-fit:contain"></div>`;
        }

        if (['doc','docx','xls','xlsx','ppt','pptx','txt','csv'].includes(ext)) {
            const gViewUrl = `https://docs.google.com/gview?url=${encodeURIComponent(url)}`;
            return `${description}
                <div style="padding:2rem;text-align:center;color:var(--text-muted)">
                    <p style="margin-bottom:1rem">Попередній перегляд ${ext.toUpperCase()}-файлів недоступний онлайн.</p>
                    <div style="display:flex;gap:.75rem;justify-content:center;flex-wrap:wrap">
                        <a href="${Fmt.safeUrl(url)}" target="_blank" rel="noopener noreferrer" class="btn btn-primary"><i class="fa-solid fa-download"></i> Завантажити</a>
                        <a href="${gViewUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-ghost">🔗 Відкрити в Google Docs</a>
                    </div>
                </div>`;
        }

        return `${description}<div style="padding:2rem;text-align:center;color:var(--text-muted)">Файл не підтримується для перегляду онлайн.</div>
            <div style="text-align:center;margin-top:1rem"><a href="${Fmt.safeUrl(url)}" target="_blank" rel="noopener noreferrer" class="btn btn-primary"><i class='fa-solid fa-arrow-up-right-from-square'></i> Відкрити в новому вікні</a></div>`;
    },

    async downloadResource(id) {
        Loader.show();
        try {
            const resource = await API.resources.getById(id);
            const filename = this._buildFilename(resource);

            let url;
            if (resource.storage_path) {
                url = await API.resources.getSignedDownloadUrl(resource.storage_path, filename);
            } else {
                url = resource.file_url;
            }

            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.target = '_blank';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            ActivityTracker.track('file_download', { entity_type: 'resource', entity_id: id, entity_title: resource.title });
        } catch (e) {
            Toast.error('Помилка', e.message);
        } finally {
            Loader.hide();
        }
    },

    // Статистика перегляду ресурсу: хто, скільки разів, коли востаннє.
    // RPC сама обмежує вибірку за роллю — admin/superadmin бачать усіх,
    // manager лише своїх підлеглих (profiles.manager_id = auth.uid()).
    async openViewStats(id, title) {
        if (!AppState.isAdmin() && !AppState.isManager()) return;
        Loader.show();
        let rows;
        try {
            rows = await API.resources.getViewStats(id);
        } catch (e) {
            Loader.hide();
            Toast.error('Помилка', e.message);
            return;
        }
        Loader.hide();
        this._viewStatsAll = rows;
        this._viewStatsSearch = '';
        this._viewStatsTitle = title || '';
        Modal.open({
            title: `<i class="fa-solid fa-chart-simple"></i> Статистика перегляду`,
            size: 'lg',
            body: this._buildViewStatsBody()
        });
    },

    _buildViewStatsBody() {
        const q = (this._viewStatsSearch || '').toLowerCase();
        const rows = (this._viewStatsAll || []).filter(r =>
            !q || (r.full_name || '').toLowerCase().includes(q) || (r.job_position || '').toLowerCase().includes(q));

        const rowsHtml = rows.length ? rows.map(r => `
            <div style="display:flex;align-items:center;padding:.55rem .25rem;border-bottom:1px solid var(--border);gap:.75rem">
                <div style="flex:1;min-width:0">
                    <div style="font-size:.875rem;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${Fmt.esc(r.full_name || '—')}</div>
                    <div style="font-size:.75rem;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${Fmt.esc([r.job_position, r.city, r.subdivision].filter(Boolean).join(' · ') || '—')}</div>
                </div>
                <span style="font-size:.8rem;color:var(--text-secondary);white-space:nowrap">×${r.views_count}</span>
                <span style="font-size:.8rem;color:var(--text-muted);white-space:nowrap;min-width:110px;text-align:right">${Fmt.datetime(r.last_viewed_at)}</span>
            </div>`).join('')
            : `<div style="padding:1.5rem;text-align:center;color:var(--text-muted)">
                ${(this._viewStatsAll || []).length ? 'Нічого не знайдено' : `Ще ніхто не переглядав${AppState.isManager() && !AppState.isAdmin() ? ' серед ваших підлеглих' : ''}`}
              </div>`;

        return `
            <div style="display:flex;flex-direction:column;gap:.875rem">
                <div style="font-size:.85rem;color:var(--text-muted)">${Fmt.esc(this._viewStatsTitle || '')}</div>
                <div class="search-clear-wrap" style="width:100%">
                    <input type="text" placeholder="Пошук за іменем або посадою…" value="${Fmt.esc(this._viewStatsSearch || '')}"
                        style="width:100%" oninput="ResourcesPage._viewStatsSetSearch(this.value)">
                    <button type="button" class="search-clear-btn" onclick="UI.clearSearchInput(this)"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div style="display:flex;align-items:center;padding:0 .25rem .4rem;gap:.75rem;border-bottom:1px solid var(--border);color:var(--text-muted);font-size:.72rem;font-weight:600;text-transform:uppercase">
                    <div style="flex:1">Співробітник</div>
                    <span>Переглядів</span>
                    <span style="min-width:110px;text-align:right">Востаннє</span>
                </div>
                <div style="max-height:420px;overflow-y:auto">
                    ${rowsHtml}
                </div>
            </div>`;
    },

    _viewStatsSetSearch(val) {
        this._viewStatsSearch = val;
        const body = document.getElementById('modal-body');
        if (body) body.innerHTML = this._buildViewStatsBody();
    },

    // Статистика проходження SCORM-курсу: статус, оцінка, час, коли востаннє
    // оновлювалось + ручна зміна статусу (для пакетів, які самі технічно
    // не репортують completion_status через погане авторське налаштування).
    // RPC — лише admin/superadmin.
    async openScormStats(id, title) {
        if (!AppState.isAdmin()) return;
        Loader.show();
        let rows;
        try {
            rows = await API.scorm.getProgressStats(id);
        } catch (e) {
            Loader.hide();
            Toast.error('Помилка', e.message);
            return;
        }
        Loader.hide();
        this._scormStatsAll = rows;
        this._scormStatsSearch = '';
        this._scormStatsTitle = title || '';
        Modal.open({
            title: `<i class="fa-solid fa-graduation-cap"></i> Статистика проходження курсу`,
            size: 'lg',
            body: this._buildScormStatsBody()
        });
    },

    _scormStatusLabel(status) {
        return { completed: 'Завершено', incomplete: 'В процесі', 'not attempted': 'Не розпочато' }[status] || status || '—';
    },

    _buildScormStatsBody() {
        const q = (this._scormStatsSearch || '').toLowerCase();
        const rows = (this._scormStatsAll || []).filter(r =>
            !q || (r.full_name || '').toLowerCase().includes(q) || (r.job_position || '').toLowerCase().includes(q));

        const statusMeta = {
            completed:       { label: 'Завершено',   color: '#10b981' },
            incomplete:      { label: 'В процесі',    color: '#f59e0b' },
            'not attempted': { label: 'Не розпочато', color: 'var(--text-muted)' }
        };
        const statuses = ['not attempted', 'incomplete', 'completed'];

        const rowsHtml = rows.length ? rows.map(r => {
            const meta = statusMeta[r.completion_status] || statusMeta['not attempted'];
            return `
            <div class="scorm-stat-row">
                <div class="scorm-stat-info">
                    <div class="scorm-stat-name">${Fmt.esc(r.full_name || 'Без імені')}</div>
                    <div class="scorm-stat-meta">${Fmt.esc([r.job_position, r.city, r.subdivision].filter(Boolean).join(' · ') || '—')}</div>
                </div>
                <div class="scorm-stat-fact">
                    <span class="scorm-stat-fact-label">Бал</span>
                    <span class="scorm-stat-fact-val">${r.score_raw != null ? Fmt.esc(String(r.score_raw)) : '—'}</span>
                </div>
                <div class="scorm-stat-fact">
                    <span class="scorm-stat-fact-label">Час</span>
                    <span class="scorm-stat-fact-val">${Fmt.duration(Math.round((r.total_time_seconds || 0) / 60)) || '0хв'}</span>
                </div>
                <div class="scorm-stat-fact">
                    <span class="scorm-stat-fact-label">Оновлено</span>
                    <span class="scorm-stat-fact-val">${Fmt.dateShort(r.updated_at)}</span>
                </div>
                <div class="scorm-stat-status-wrap">
                    <span class="scorm-stat-dot" style="background:${meta.color}"></span>
                    <select class="scorm-stat-select" style="color:${meta.color}"
                        onchange="ResourcesPage._scormStatsSetStatus('${r.user_id}','${r.scorm_package_id}',this.value)">
                        ${statuses.map(s => `<option value="${s}" ${r.completion_status === s ? 'selected' : ''}>${Fmt.esc(statusMeta[s].label)}</option>`).join('')}
                    </select>
                </div>
            </div>`;
        }).join('')
            : `<div style="padding:1.5rem;text-align:center;color:var(--text-muted)">
                ${(this._scormStatsAll || []).length ? 'Нічого не знайдено' : 'Ще ніхто не розпочинав цей курс'}
              </div>`;

        return `
            <style>
                .scorm-stat-row{display:flex;align-items:center;gap:.7rem;padding:.65rem .25rem;border-bottom:1px solid var(--border)}
                .scorm-stat-row:last-child{border-bottom:none}
                .scorm-stat-info{flex:1;min-width:0}
                .scorm-stat-name{font-size:.9rem;font-weight:600;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
                .scorm-stat-meta{font-size:.75rem;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:1px}
                .scorm-stat-fact{display:flex;flex-direction:column;align-items:center;min-width:58px;flex-shrink:0}
                .scorm-stat-fact-label{font-size:.63rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:.03em}
                .scorm-stat-fact-val{font-size:.8rem;color:var(--text-secondary);font-weight:600;margin-top:2px;white-space:nowrap}
                .scorm-stat-status-wrap{display:flex;align-items:center;gap:.4rem;flex-shrink:0;min-width:150px}
                .scorm-stat-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}
                .scorm-stat-select{border:1px solid var(--border);background:var(--bg-raised);border-radius:8px;
                    padding:.3rem .5rem;font-size:.78rem;font-weight:600;cursor:pointer;flex:1;min-width:0}
            </style>
            <div style="display:flex;flex-direction:column;gap:.875rem">
                <div style="font-size:.85rem;color:var(--text-muted)">${Fmt.esc(this._scormStatsTitle || '')}</div>
                <div class="search-clear-wrap" style="width:100%">
                    <input type="text" placeholder="Пошук за іменем або посадою…" value="${Fmt.esc(this._scormStatsSearch || '')}"
                        style="width:100%" oninput="ResourcesPage._scormStatsSetSearch(this.value)">
                    <button type="button" class="search-clear-btn" onclick="UI.clearSearchInput(this)"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div style="max-height:440px;overflow-y:auto">
                    ${rowsHtml}
                </div>
            </div>`;
    },

    _scormStatsSetSearch(val) {
        this._scormStatsSearch = val;
        const body = document.getElementById('modal-body');
        if (body) body.innerHTML = this._buildScormStatsBody();
    },

    async _scormStatsSetStatus(userId, scormPackageId, status) {
        try {
            await API.scorm.adminSetStatus(userId, scormPackageId, status);
            const row = (this._scormStatsAll || []).find(r => r.user_id === userId && r.scorm_package_id === scormPackageId);
            if (row) row.completion_status = status;
        } catch (e) {
            Toast.error('Помилка', e.message);
        }
    },

    async downloadTracked(id) {
        await this._trackedAction(id, true);
    },

    // Автоматичне ознайомлення (скрол PDF/перегляд відео до кінця) — жодного
    // кліку користувача немає, тому не показуємо повноекранний Loader: він
    // виглядав як несподіване перезавантаження сторінки просто під час
    // читання. Статус оновлюється мовчки (бейдж у футері + крапка в списку).
    async acknowledgeDoc(id) {
        await this._trackedAction(id, false, { silent: true });
    },

    async _trackedAction(id, downloadFile, { silent = false } = {}) {
        if (!silent) Loader.show();
        try {
            const resource = await API.resources.getById(id);
            const shiftLoc = await API.documentDownloads.getTodayShiftLocation().catch(() => null);
            if (shiftLoc) {
                await this._doTrackedDownload(resource, shiftLoc.id, false, downloadFile, { silent });
            } else {
                await this._doTrackedDownload(resource, null, true, downloadFile, { silent });
            }
        } catch (e) {
            Toast.error('Помилка', e.message);
        } finally {
            if (!silent) Loader.hide();
        }
    },

    async _showLocationModal(resource, downloadFile) {
        let allLocs = this._myLocations;
        if (!allLocs.length) {
            allLocs = await API.documentDownloads.getAllLocations().catch(() => []);
        }
        const options = allLocs.map(l => `<option value="${l.id}">${l.name}</option>`).join('');
        const actionLabel = downloadFile ? 'Завантажити' : 'Підтвердити';
        Modal.open({
            title: downloadFile ? '📥 Завантажити документ' : '✅ Підтвердити ознайомлення',
            size: 'sm',
            body: `
                <p style="color:var(--text-muted);margin-bottom:1rem">Ви не у зміні. Оберіть локацію, до якої відносите це ознайомлення.</p>
                <div class="form-group">
                    <label>Локація</label>
                    <select id="dl-location-sel">
                        <option value="">— Без локації —</option>
                        ${options}
                    </select>
                </div>`,
            footer: `
                <button class="btn btn-secondary" onclick="Modal.close()">Скасувати</button>
                <button class="btn btn-primary" onclick="ResourcesPage._confirmLocationDownload()">${actionLabel}</button>`
        });
        this._pendingResource = resource;
        this._pendingDownloadFile = downloadFile;
    },

    async _confirmLocationDownload() {
        const locId = Dom.val('dl-location-sel') || null;
        Modal.close();
        const resource = this._pendingResource;
        const downloadFile = this._pendingDownloadFile;
        this._pendingResource = null;
        this._pendingDownloadFile = false;
        if (!resource) return;
        await this._doTrackedDownload(resource, locId, true, downloadFile);
    },

    async _doTrackedDownload(resource, locationId, isOffShift, downloadFile = true, { silent = false } = {}) {
        if (!silent) Loader.show();
        try {
            if (downloadFile) {
                const filename = this._buildFilename(resource);

                let url;
                if (resource.storage_path) {
                    url = await API.resources.getSignedDownloadUrl(resource.storage_path, filename);
                } else {
                    url = resource.file_url;
                }

                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                a.target = '_blank';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
            }

            await API.documentDownloads.track(resource.id, { locationId, isOffShift, docVersion: resource.doc_version || 1 });
            ActivityTracker.track('file_download', { entity_type: 'document', entity_id: resource.id, entity_title: resource.title });

            this._myDownloads[resource.id] = { at: new Date().toISOString(), version: resource.doc_version || 1 };
            UI.loadDocBadge();

            // Update viewer action footer if currently open
            const viewerAction = document.getElementById('doc-viewer-action');
            if (viewerAction) {
                const dateStr = Fmt.dateShort(this._myDownloads[resource.id].at);
                const btnBase = 'display:inline-flex;align-items:center;gap:6px;padding:8px 20px;border-radius:20px;font-size:.875rem;font-weight:500;cursor:pointer;transition:background var(--transition),color var(--transition)';
                viewerAction.style.cssText = 'flex-shrink:0;display:inline-flex;align-items:center;gap:.6rem';
                viewerAction.innerHTML = `<span style="display:inline-flex;align-items:center;gap:.3rem;color:#10b981;font-weight:500;font-size:.85rem;white-space:nowrap">✅ ${this._ackLabel()} ${dateStr}</span>`;
            }

            // Update the acknowledged item in the list (no re-fetch needed) —
            // єдина спільна функція, щоб клас/колір смужки/текст/крапка-індикатор
            // (res-ack-dot) завжди оновлювались разом, а не розбіжними шляхами.
            this._refreshDocCard(resource);
        } catch (e) {
            Toast.error('Помилка', e.message);
        } finally {
            if (!silent) Loader.hide();
        }
    },

    async openEdit(id) {
        Loader.show();
        try {
            const resource = await API.resources.getById(id);
            this.openForm(resource);
        } catch (e) {
            Toast.error('Помилка', e.message);
        } finally {
            Loader.hide();
        }
    },

    async openForm(resource = null) {
        if (!this._accessGroups?.length) {
            this._accessGroups = await API.accessGroups.getAll().catch(() => []);
        }
        if (!this._allDovirenosti?.length) {
            this._allDovirenosti = await API.dovirenosti.getAll().catch(() => []);
        }
        const isEdit = !!resource;
        const fileHint = resource && resource.storage_path
            ? (resource.original_name || resource.storage_path.split('/').pop().replace(/^\d+_/, ''))
            : 'Оберіть файл для завантаження';
        const courseOptions = this._courses.map(c => `<option value="${c.id}" ${resource?.course_id === c.id ? 'selected' : ''}>${c.title}</option>`).join('');

        // Тумблер (checkbox під капотом — читається так само через .checked)
        const toggle = (id, checked, onchange = '') => `
            <label class="rf-switch">
                <input type="checkbox" id="${id}" ${checked ? 'checked' : ''} ${onchange ? `onchange="${onchange}"` : ''}>
                <span class="rf-switch-track"></span>
            </label>`;

        Modal.open({
            title: isEdit ? '<i class="fa-solid fa-pen"></i> Редагувати ресурс' : '<i class="fa-solid fa-plus"></i> Додати ресурс',
            size: 'lg',
            body: `
                <style>
                    #rfg{display:grid;grid-template-columns:1fr 1fr;gap:7px}
                    #rfg > .rf-sec.rf-span2{grid-column:1/-1}
                    #rfg .rf-sec{
                        display:flex;flex-direction:column;
                        border:1px solid var(--border);border-radius:14px;background:var(--bg-surface);
                        transition:border-color .15s,box-shadow .15s;

                        .rf-toggle-row{display:flex;align-items:flex-start;justify-content:space-between;gap:.75rem;
                            padding:.4rem 0;border-bottom:1px solid var(--border)}
                        .rf-sec-body.rf-col1 .rf-toggle-row:last-child,
                        .rf-sub-panel .rf-toggle-row{border-bottom:none;padding-bottom:0}
                        .rf-sec-body.rf-col1 .rf-toggle-row:first-child{padding-top:0}
                        .rf-toggle-row > .rf-switch{margin-top:1px}
                        .rf-toggle-label{display:flex;align-items:center;gap:.5rem;font-size:.83rem;color:var(--text-primary);font-weight:500;line-height:1.3}
                        .rf-toggle-label i{color:var(--sec-accent);width:16px;text-align:center;font-size:.82rem;flex-shrink:0}
                        .rf-toggle-desc{font-size:.7rem;color:var(--text-muted);margin-top:2px;line-height:1.35}

                        .rf-switch{position:relative;display:inline-flex;width:36px;height:20px;flex-shrink:0;cursor:pointer}
                        .rf-switch input{position:absolute;opacity:0;width:0;height:0}
                        .rf-switch-track{position:absolute;inset:0;background:var(--border);border-radius:20px;transition:background .2s}
                        .rf-switch-track::before{content:'';position:absolute;width:14px;height:14px;left:3px;top:3px;
                            background:#fff;border-radius:50%;transition:transform .2s;box-shadow:0 1px 3px rgba(0,0,0,.3)}
                        .rf-switch input:checked + .rf-switch-track{background:var(--sec-accent, var(--primary))}
                        .rf-switch input:checked + .rf-switch-track::before{transform:translateX(16px)}
                    }
                    #rfg .rf-sec-head{display:flex;align-items:center;gap:.5rem;padding:.5rem .9rem;
                        border-radius:13px 13px 0 0;
                        background:color-mix(in srgb, var(--sec-accent) 7%, var(--bg-raised));border-bottom:1px solid var(--border)}
                    #rfg .rf-sec-ic{width:23px;height:23px;border-radius:7px;display:flex;align-items:center;justify-content:center;
                        background:var(--sec-accent);color:#fff;font-size:.7rem;flex-shrink:0;
                        box-shadow:0 2px 8px color-mix(in srgb, var(--sec-accent) 45%, transparent)}
                    #rfg .rf-sec-title{font-size:.82rem;font-weight:700;color:var(--text-primary)}
                    #rfg .rf-sec-sub{font-size:.7rem;color:var(--text-muted);margin-left:auto}
                    #rfg .rf-sec-body{flex:1;align-content:start;padding:.55rem .9rem;display:grid;grid-template-columns:1fr 1fr;gap:.45rem .8rem}
                    #rfg .rf-sec-body.rf-col1{grid-template-columns:1fr;gap:.4rem}
                    #rfg .rf-sec:hover{border-color:color-mix(in srgb, var(--sec-accent) 35%, var(--border));
                        box-shadow:0 2px 12px color-mix(in srgb, var(--sec-accent) 10%, transparent)}
                    #rfg .rf-field{display:flex;flex-direction:column;gap:.25rem;min-width:0}
                    #rfg .rf-field.full{grid-column:1/-1}
                    #rfg .rf-field label{font-size:.76rem;font-weight:500;color:var(--text-secondary)}
                    #rfg .rf-hint{font-size:.7rem;color:var(--text-muted)}
                    #rfg textarea{height:32px;min-height:32px;resize:none;padding-top:.5rem;padding-bottom:.5rem}

                    #rfg .rf-sub-panel{margin-top:.4rem;padding:.55rem .7rem;border-radius:10px;
                        background:color-mix(in srgb, var(--sec-accent) 6%, var(--bg-raised));
                        border:1px solid color-mix(in srgb, var(--sec-accent) 25%, var(--border));
                        display:flex;flex-direction:column;gap:.4rem}

                    /* Базовий .file-upload-* — спільний глобальний компонент (фіксовані
                       180×150px під квадратні мініатюри в інших розділах). У широкій секції
                       "Файл" він губився маленькою коробкою, тож тут повністю переозначений:
                       на всю ширину, пунктирна рамка в тон акценту секції (зелений). */
                    #rfg .file-upload-frame{width:100%;padding:0;border-radius:14px;background:none}
                    #rfg .file-upload-area{
                        width:100%;height:auto;min-height:96px;padding:1.1rem 1rem;gap:.3rem;
                        border:1.5px dashed color-mix(in srgb, var(--sec-accent) 40%, var(--border));
                        border-radius:14px;background:color-mix(in srgb, var(--sec-accent) 4%, var(--bg-raised))}
                    #rfg .file-upload-area::before{display:none}
                    #rfg .file-upload-area:hover,
                    #rfg .file-upload-area.drag-over{
                        border-color:var(--sec-accent);
                        background:color-mix(in srgb, var(--sec-accent) 8%, var(--bg-raised))}
                    #rfg .file-upload-icon{width:38px;height:38px;border-radius:11px;box-shadow:none;
                        background:color-mix(in srgb, var(--sec-accent) 16%, transparent);
                        border:1.5px solid color-mix(in srgb, var(--sec-accent) 30%, transparent)}
                    #rfg .file-upload-icon i{font-size:1rem;color:var(--sec-accent)}
                    #rfg .file-upload-area:hover .file-upload-icon,
                    #rfg .file-upload-area.drag-over .file-upload-icon{
                        transform:translateY(-2px) scale(1.04);
                        box-shadow:0 6px 16px color-mix(in srgb, var(--sec-accent) 30%, transparent)}
                    #rfg .file-upload-label{font-size:.82rem}
                    #rfg .file-upload-hint{font-size:.7rem}
                </style>
                <div id="rfg">

                    <!-- Основна інформація -->
                    <div class="rf-sec rf-span2" style="--sec-accent:#3b82f6">
                        <div class="rf-sec-head">
                            <span class="rf-sec-ic"><i class="fa-solid fa-file-lines"></i></span>
                            <span class="rf-sec-title">Основна інформація</span>
                        </div>
                        <div class="rf-sec-body">
                            <div class="rf-field">
                                <label>Назва *</label>
                                <input id="res-title" type="text" value="${(resource?.title || '').replace(/"/g, '&quot;')}" placeholder="Назва ресурсу">
                            </div>
                            <div class="rf-field">
                                <label>Категорія</label>
                                <input id="res-category" type="text" value="${(resource?.category || '').replace(/"/g, '&quot;')}" placeholder="Наприклад: Документація">
                            </div>
                            <div class="rf-field full">
                                <label>Опис</label>
                                <textarea id="res-desc" placeholder="Короткий опис ресурсу" lang="uk" spellcheck="true">${resource?.description || ''}</textarea>
                            </div>
                        </div>
                    </div>

                    <!-- Доступ -->
                    <div class="rf-sec" style="--sec-accent:#8b5cf6">
                        <div class="rf-sec-head">
                            <span class="rf-sec-ic"><i class="fa-solid fa-lock"></i></span>
                            <span class="rf-sec-title">Доступ</span>
                        </div>
                        <div class="rf-sec-body rf-col1">
                            <div class="rf-field">
                                <label>Група доступу</label>
                                <select id="res-access-group">
                                    <option value="">🌐 Публічний (без обмежень)</option>
                                    ${(this._accessGroups || []).map(g =>
                                        `<option value="${g.id}" ${resource?.access_group_id === g.id ? 'selected' : ''}>${g.is_public ? '🌐' : '🔐'} ${g.name}</option>`
                                    ).join('')}
                                </select>
                            </div>
                            <div class="rf-field">
                                <label>Доступ по довіреності</label>
                                ${CreatableMultiSelect.html('res-dovirenosti', false)}
                                <span class="rf-hint">Без тегу — видний всім</span>
                            </div>
                        </div>
                    </div>

                    <!-- Параметри -->
                    <div class="rf-sec" style="--sec-accent:#f59e0b">
                        <div class="rf-sec-head">
                            <span class="rf-sec-ic"><i class="fa-solid fa-sliders"></i></span>
                            <span class="rf-sec-title">Параметри</span>
                        </div>
                        <div class="rf-sec-body rf-col1">
                            <div class="rf-toggle-row">
                                <span class="rf-toggle-label"><i class="fa-solid fa-download"></i> Дозволити завантаження</span>
                                ${toggle('res-download', resource?.download_allowed !== false)}
                            </div>
                            <div class="rf-toggle-row">
                                <span class="rf-toggle-label"><i class="fa-regular fa-bell"></i> Надіслати сповіщення</span>
                                ${toggle('res-notify', !isEdit)}
                            </div>
                            <div class="rf-toggle-row">
                                <div>
                                    <span class="rf-toggle-label"><i class="fa-regular fa-clipboard"></i> Відстежуваний документ</span>
                                    <div class="rf-toggle-desc">Фіксує ознайомлення користувачів, показує в бейджі "непрочитане"</div>
                                </div>
                                ${toggle('res-tracked', !!resource?.is_tracked_download, 'ResourcesPage._toggleDeadlineRow(this.checked)')}
                            </div>

                            <div id="res-deadline-row" class="rf-sub-panel" style="display:${resource?.is_tracked_download ? 'flex' : 'none'}">
                                <div class="rf-toggle-row">
                                    <span class="rf-toggle-label"><i class="fa-regular fa-calendar-days"></i> Встановити дедлайн</span>
                                    ${toggle('res-has-deadline', !!resource?.deadline_days, 'ResourcesPage._toggleDeadlineDays(this.checked)')}
                                </div>
                                <div id="res-deadline-days-wrap" style="display:${resource?.deadline_days ? 'flex' : 'none'};align-items:center;gap:.4rem">
                                    <input type="number" id="res-deadline-days" min="1" max="90" value="${resource?.deadline_days || 3}"
                                        style="width:58px;padding:3px 7px;border-radius:7px;border:1.5px solid var(--border);background:var(--bg-surface);color:var(--text-primary);font-size:.8rem">
                                    <span class="rf-hint">днів після публікації</span>
                                </div>
                                ${resource?.doc_version ? `<div style="display:flex;align-items:center;gap:.35rem">
                                    <span class="rf-hint">Версія: <b id="res-version-label" style="color:var(--text-primary)">${resource.doc_version}</b></span>
                                    <button type="button" onclick="ResourcesPage._bumpVersion()"
                                        style="padding:2px 7px;border-radius:7px;border:1.5px solid var(--border);background:var(--bg-surface);font-size:.73rem;cursor:pointer;color:var(--text-muted)">
                                        ↑ нова версія
                                    </button>
                                </div>` : ''}
                                <input type="hidden" id="res-bump-version" value="0">
                            </div>
                        </div>
                    </div>

                    <!-- Файл -->
                    <div class="rf-sec rf-span2" style="--sec-accent:#10b981">
                        <div class="rf-sec-head">
                            <span class="rf-sec-ic"><i class="fa-solid fa-cloud-arrow-up"></i></span>
                            <span class="rf-sec-title">Файл</span>
                            <span class="rf-sec-sub">до ${Fmt.fileSize(APP_CONFIG.resourceMaxSizeMb * 1024 * 1024)}</span>
                        </div>
                        <div class="rf-sec-body rf-col1">
                            <div id="resource-file-upload"></div>
                            <span class="rf-hint">${fileHint}</span>
                        </div>
                    </div>

                </div>`,
            footer: `
                <button class="btn btn-secondary" onclick="Modal.close()">Скасувати</button>
                <button class="btn btn-primary" onclick="ResourcesPage.saveResource(${resource ? `'${resource.id}'` : ''})">${isEdit ? '<i class="fa-regular fa-floppy-disk"></i> Зберегти' : '<i class="fa-solid fa-plus"></i> Додати'}</button>`
        });

        const selectedDovs = (resource?.resource_dovirenosti || [])
            .map(rd => rd.dovirenosti).filter(Boolean);
        CreatableMultiSelect.init(
            'res-dovirenosti',
            this._allDovirenosti.map(d => ({ id: d.id, name: d.name })),
            selectedDovs
        );

        this._resourceFile = null;
        const uploadContainer = document.getElementById('resource-file-upload');
        if (uploadContainer) {
            const input = FileUpload.createDropZone(uploadContainer, {
                accept: '*/*',
                label: 'Перетягніть файл сюди або натисніть для вибору',
                hint: 'PDF, DOCX, XLSX, MP4, зображення, архіви'
            });
            input.addEventListener('change', () => {
                const file = input.files[0];
                if (!file) return;
                const maxBytes = APP_CONFIG.resourceMaxSizeMb * 1024 * 1024;
                if (file.size > maxBytes) {
                    Toast.error('Файл занадто великий', `«${file.name}» — ${Fmt.fileSize(file.size)}, максимум ${Fmt.fileSize(maxBytes)}`);
                    input.value = '';
                    this._resourceFile = null;
                    return;
                }
                this._resourceFile = file;
                const titleInput = document.getElementById('res-title');
                if (titleInput && !titleInput.value.trim()) {
                    titleInput.value = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
                }
            });
        }
    },

    _toggleDeadlineRow(show) {
        const el = document.getElementById('res-deadline-row');
        if (el) el.style.display = show ? 'flex' : 'none';
        if (el && show) el.style.flexDirection = 'column';
    },

    _toggleDeadlineDays(show) {
        document.getElementById('res-deadline-days-wrap').style.display = show ? 'flex' : 'none';
    },

    _bumpVersion() {
        const el = document.getElementById('res-bump-version');
        if (el) el.value = '1';
        Toast.info('Нова версія', 'При збереженні версія буде збільшена — всі ознайомлення скинуться');
    },

    // ── Фонова черга завантажень ────────────────────────────────────
    // Панель монтується напряму в document.body (а не в container сторінки),
    // тож переживає навігацію по SPA й перерендери container.innerHTML —
    // завантаження триває у фоні, поки користувач працює з іншими розділами
    // або відкриває нову форму додавання ресурсу.

    _uqEnsureStyles() {
        if (document.getElementById('res-uq-styles')) return;
        const style = document.createElement('style');
        style.id = 'res-uq-styles';
        style.textContent = `
            .res-uq-panel{position:fixed;bottom:20px;right:20px;z-index:9998;width:300px;max-height:70vh;overflow-y:auto;
                background:var(--bg-surface);border:1px solid var(--border);border-radius:16px;
                box-shadow:0 12px 40px rgba(0,0,0,.18);animation:res-uq-in .25s ease}
            @keyframes res-uq-in{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
            .res-uq-head{display:flex;align-items:center;gap:.5rem;padding:.7rem .9rem;font-size:.82rem;font-weight:600;
                color:var(--text-primary);border-bottom:1px solid var(--border)}
            .res-uq-head i{color:var(--primary)}
            .res-uq-list{display:flex;flex-direction:column}
            .res-uq-item{padding:.6rem .9rem;border-bottom:1px solid var(--border)}
            .res-uq-item:last-child{border-bottom:none}
            .res-uq-row{display:flex;align-items:center;justify-content:space-between;gap:.5rem;margin-bottom:.35rem}
            .res-uq-title{font-size:.8rem;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1}
            .res-uq-pct{font-size:.74rem;color:var(--text-muted);flex-shrink:0}
            .res-uq-item.res-uq-done .res-uq-pct{color:#10b981}
            .res-uq-close{background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:.8rem;padding:2px;flex-shrink:0}
            .res-uq-close:hover{color:var(--danger)}
            .res-uq-bar{height:5px;border-radius:20px;background:var(--bg-raised);overflow:hidden}
            .res-uq-fill{height:100%;background:var(--primary);border-radius:20px;transition:width .2s ease}
            .res-uq-item.res-uq-done .res-uq-fill{background:#10b981}
            .res-uq-item.res-uq-error .res-uq-fill{background:var(--danger)}
            .res-uq-status{margin-top:.25rem;font-size:.7rem;color:var(--text-muted)}
            .res-uq-item.res-uq-error .res-uq-status{color:var(--danger)}
        `;
        document.head.appendChild(style);
    },

    _uqAdd(title) {
        this._uqEnsureStyles();
        const id = 'uq_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
        this._uploadQueue.push({ id, title, progress: 0, status: 'uploading', error: '' });
        this._uqRender();
        return id;
    },

    _uqUpdate(id, patch) {
        const item = this._uploadQueue.find(q => q.id === id);
        if (!item) return;
        Object.assign(item, patch);
        this._uqRender();
    },

    _uqRemove(id) {
        this._uploadQueue = this._uploadQueue.filter(q => q.id !== id);
        this._uqRender();
    },

    _uqRender() {
        let panel = document.getElementById('res-upload-queue');
        if (!this._uploadQueue.length) {
            panel?.remove();
            return;
        }
        if (!panel) {
            panel = document.createElement('div');
            panel.id = 'res-upload-queue';
            panel.className = 'res-uq-panel';
            document.body.appendChild(panel);
        }
        const statusLabel = { uploading: 'Завантаження…', saving: 'Збереження…', done: 'Готово', error: 'Помилка' };
        panel.innerHTML = `
            <div class="res-uq-head"><i class="fa-solid fa-cloud-arrow-up"></i> Завантаження файлів (${this._uploadQueue.length})</div>
            <div class="res-uq-list">
                ${this._uploadQueue.map(q => `
                    <div class="res-uq-item res-uq-${q.status}">
                        <div class="res-uq-row">
                            <span class="res-uq-title" title="${Fmt.esc(q.title)}">${Fmt.esc(q.title)}</span>
                            ${q.status === 'error'
                                ? `<button class="res-uq-close" onclick="ResourcesPage._uqRemove('${q.id}')" title="Закрити"><i class="fa-solid fa-xmark"></i></button>`
                                : `<span class="res-uq-pct">${q.status === 'done' ? '<i class="fa-solid fa-check"></i>' : q.progress + '%'}</span>`}
                        </div>
                        <div class="res-uq-bar"><div class="res-uq-fill" style="width:${q.status === 'done' ? 100 : q.progress}%"></div></div>
                        <div class="res-uq-status">${q.status === 'error' ? Fmt.esc(q.error || 'Помилка') : statusLabel[q.status]}</div>
                    </div>
                `).join('')}
            </div>`;
    },

    async saveResource(resourceId) {
        const title = Dom.val('res-title').trim();
        if (!title) { Toast.error('Помилка', 'Вкажіть назву ресурсу'); return; }

        const isTracked = document.getElementById('res-tracked')?.checked === true;
        const hasDeadline = document.getElementById('res-has-deadline')?.checked === true;
        const deadlineDays = hasDeadline ? (parseInt(document.getElementById('res-deadline-days')?.value) || 3) : null;
        const bumpVersion = document.getElementById('res-bump-version')?.value === '1';

        const fields = {
            title,
            description:          Dom.val('res-desc').trim() || null,
            category:             Dom.val('res-category').trim() || null,
            course_id:            null,
            access_group_id:      Dom.val('res-access-group') || null,
            download_allowed:     document.getElementById('res-download')?.checked === true,
            is_tracked_download:  isTracked,
            deadline_days:        deadlineDays
        };
        // hidden input set by _bumpVersion
        if (bumpVersion) fields._bump_version = true;

        if (!resourceId && !this._resourceFile) {
            Toast.error('Помилка', 'Оберіть файл для завантаження');
            return;
        }

        // Попередження про дублікат — лише при створенні нового ресурсу
        // (при редагуванні існуючого перевіряти нема сенсу).
        if (!resourceId) {
            try {
                const dupes = await API.resources.findByTitle(title);
                if (dupes.length) {
                    const ok = await Modal.confirm({
                        title: 'Схожий файл вже існує',
                        message: `Ресурс із назвою «${Fmt.esc(title)}» вже є в базі (${dupes.length}). Додати ще один?`,
                        confirmText: 'Так, додати',
                        danger: false
                    });
                    if (!ok) return;
                }
            } catch (_) {}
        }

        // Читаємо все з DOM ДО закриття модалки — вона може закритись одразу
        // (фоновий шлях завантаження файлу), тож поля треба захопити зараз.
        const file = this._resourceFile;
        const dovIds = CreatableMultiSelect.getValues('res-dovirenosti');
        const sendNotify = document.getElementById('res-notify')?.checked === true;
        const notifyLink = this._view === 'docs' ? 'documents' : 'knowledge-base';
        const ctx = { resourceId, fields, dovIds, sendNotify, notifyLink };

        if (!file) {
            // Без файлу зберігати швидко — блокуючий Loader як і раніше.
            Loader.show();
            try {
                await this._persistResource(ctx);
                Modal.close();
                await this._afterSaveResource();
            } catch (e) {
                Toast.error('Помилка', e.message);
            } finally {
                Loader.hide();
            }
            return;
        }

        // З файлом — вантажимо у фоні: модалку закриваємо одразу, прогрес
        // показуємо у плаваючій панелі, користувач може відкрити нову форму
        // й запустити ще одне завантаження паралельно.
        Modal.close();
        const qid = this._uqAdd(title);
        try {
            // .zip з imsmanifest.xml всередині — це SCORM-курс, вантажимо в
            // окремий бакет scorm-packages і після збереження ресурсу створюємо
            // (чи оновлюємо) запис у scorm_packages. Звичайний .zip без
            // маніфесту — просто файл, як і раніше.
            const scormMeta = await ScormUpload.parseAndUpload(file, pct => this._uqUpdate(qid, { progress: pct }));
            const upload = scormMeta
                ? { storage_path: scormMeta.storage_path, original_name: scormMeta.original_name, file_type: 'application/zip', type: 'scorm', file_url: null }
                : await API.resources.uploadToStorageWithProgress(file, pct => this._uqUpdate(qid, { progress: pct }));
            Object.assign(fields, upload);
            this._uqUpdate(qid, { status: 'saving', progress: 100 });
            const savedId = await this._persistResource(ctx);
            if (scormMeta) {
                const pkgFields = { manifest_path: 'imsmanifest.xml', entry_point: scormMeta.entryPoint, scorm_version: scormMeta.version, title: scormMeta.title };
                const existingPkg = resourceId ? await API.scorm.getPackage(resourceId).catch(() => null) : null;
                if (existingPkg) await API.scorm.updatePackage(existingPkg.id, pkgFields);
                else await API.scorm.createPackage({ ...pkgFields, resource_id: savedId });
            }
            this._uqUpdate(qid, { status: 'done' });
            setTimeout(() => this._uqRemove(qid), 3000);
            await this._afterSaveResource();
        } catch (e) {
            this._uqUpdate(qid, { status: 'error', error: e.message });
            Toast.error('Помилка завантаження', `«${title}»: ${e.message}`);
        }
    },

    // DB-частина збереження (виклик storage upload уже завершено, якщо був файл).
    async _persistResource({ resourceId, fields, dovIds, sendNotify, notifyLink }) {
        let savedId = resourceId;
        if (resourceId) {
            // Bump doc_version if file changed or manually requested
            if (fields._bump_version || fields.storage_path) {
                const current = await API.resources.getById(resourceId).catch(() => null);
                if (current) fields.doc_version = (current.doc_version || 1) + 1;
            }
            delete fields._bump_version;
            await API.resources.update(resourceId, fields);
            await API.resources.setDovirenosti(resourceId, dovIds).catch(() => {});
            if (sendNotify) {
                if (fields.is_tracked_download) {
                    API.documentDownloads.notifyOnPublish({ ...fields, id: resourceId }, true).catch(e => console.error('[notify] notifyOnPublish error:', e));
                } else {
                    API.notifications.notifyResourcePublished({ ...fields, id: resourceId }, notifyLink, true).catch(e => console.error('[notify] notifyResourcePublished error:', e));
                }
            }
            Toast.success('Збережено', 'Ресурс оновлено' + (fields.doc_version ? ` (версія ${fields.doc_version})` : ''));
        } else {
            delete fields._bump_version;
            fields.doc_version = 1;
            const created = await API.resources.create(fields);
            savedId = created.id;
            // Save dovirenosti first so notify functions can query them
            await API.resources.setDovirenosti(savedId, dovIds).catch(() => {});
            if (sendNotify && created) {
                if (fields.is_tracked_download) {
                    API.documentDownloads.notifyOnPublish({ ...fields, id: created.id }).catch(e => console.error('[notify] notifyOnPublish error:', e));
                } else {
                    API.notifications.notifyResourcePublished({ ...fields, id: created.id }, notifyLink).catch(e => console.error('[notify] notifyResourcePublished error:', e));
                }
            }
            Toast.success('Додано', 'Новий ресурс успішно створено');
        }
        return savedId;
    },

    async _afterSaveResource() {
        await Promise.all([this.load(), this._loadFilters()]);
        if (AppState.isAdmin()) this._loadDbSize();
        // If editing from resource view page (no list in DOM), refresh the viewer
        if (!document.getElementById('resource-list')) {
            const hash = window.location.hash;
            const match = hash.match(/#\/resource\/([^?]+)/);
            if (match) {
                const from = new URLSearchParams(hash.split('?')[1] || '').get('from') || '';
                const container = document.getElementById('page-content');
                if (container) await ResourceViewPage.init(container, { id: match[1], from });
            }
        }
    },

    setPage(page) {
        this._page = page;
        this.load();
    },

    _renderPagination(total) {
        const container = document.getElementById('resources-pagination');
        if (!container) return;

        if (this._view === 'docs' && this._docsShowAll) {
            container.innerHTML = `
                <span style="color:var(--text-muted);font-size:.82rem">Показано всі ${total} документів</span>
                <button class="btn btn-ghost btn-sm" onclick="ResourcesPage._docsToggleShowAll(false)"><i class="fa-solid fa-table-list"></i> Розбити на сторінки</button>`;
            return;
        }

        const pages = Math.ceil(total / this._pageSize);
        if (pages <= 1) { container.innerHTML = ''; return; }
        const cur = this._page;
        const btn = (i) => `<button class="btn ${i === cur ? 'btn-primary' : 'btn-ghost'} btn-sm" onclick="ResourcesPage.setPage(${i})">${i + 1}</button>`;
        const dot = `<span style="align-self:center;color:var(--text-muted);padding:0 .1rem">…</span>`;
        const indices = new Set([0, 1, pages - 2, pages - 1, cur - 1, cur, cur + 1].filter(i => i >= 0 && i < pages));
        const sorted = [...indices].sort((a, b) => a - b);
        let html = '';
        let prev = -1;
        for (const i of sorted) {
            if (prev !== -1 && i > prev + 1) html += dot;
            html += btn(i);
            prev = i;
        }
        if (this._view === 'docs') {
            html += `<button class="btn btn-ghost btn-sm" style="margin-left:.5rem" onclick="ResourcesPage._docsToggleShowAll(true)"><i class="fa-solid fa-list"></i> Показати всі ${total}</button>`;
        }
        container.innerHTML = html;
    },

    _docsToggleShowAll(val) {
        this._docsShowAll = val;
        this._page = 0;
        this.load();
    },

    // Центрована модалка (не глобальний Modal.open — той відкривається
    // боковою панеллю на весь екран праворуч, для такого маленького
    // підтвердження це виглядає незручно).
    deleteResource(id, title) {
        document.getElementById('res-delete-confirm')?.remove();
        const el = document.createElement('div');
        el.id = 'res-delete-confirm';
        el.className = 'center-confirm-backdrop';
        el.innerHTML = `
            <div class="center-confirm-box">
                <h3>Видалити файл?</h3>
                <p>«<strong style="color:var(--text-primary)">${Fmt.esc(title)}</strong>» буде переміщено до кошика.<br>
                    Власник може відновити або видалити назавжди.</p>
                <div class="center-confirm-actions">
                    <button class="btn btn-ghost" onclick="document.getElementById('res-delete-confirm').remove()">Скасувати</button>
                    <button class="btn btn-danger" id="confirm-del-btn" onclick="ResourcesPage._confirmDelete('${id}')">Видалити</button>
                </div>
            </div>`;
        document.body.appendChild(el);
        el.addEventListener('click', e => { if (e.target === el) el.remove(); });
    },

    async _confirmDelete(id) {
        const btn = document.getElementById('confirm-del-btn');
        if (btn) { btn.disabled = true; btn.textContent = '...'; }
        try {
            await API.resources.softDelete(id);
            API.notifications.deleteByLink(`resource/${id}`).catch(() => {});
            document.getElementById('res-delete-confirm')?.remove();
            Toast.success('Переміщено до кошика');
            await this.load();
            if (AppState.isAdmin()) this._loadDbSize();
        } catch(e) {
            Toast.error('Помилка', e.message);
            if (btn) { btn.disabled = false; btn.textContent = 'Видалити'; }
        }
    },

    async _openTrash() {
        Modal.open({
            title: '<i class="fa-solid fa-trash"></i> Кошик',
            size: 'lg',
            body: `<div style="text-align:center;padding:2rem"><div class="spinner"></div></div>`,
            footer: `<button class="btn btn-ghost" onclick="Modal.close()">Закрити</button>`
        });
        try {
            const items = await API.resources.getTrash();
            const body = document.getElementById('modal-body');
            const footer = document.querySelector('.modal-footer');
            if (!body) return;
            if (!items.length) {
                body.innerHTML = `<div style="text-align:center;padding:2rem;color:var(--text-muted)"><div style="font-size:2.5rem;margin-bottom:.5rem"><i class="fa-solid fa-trash"></i></div>Кошик порожній</div>`;
                return;
            }
            body.innerHTML = `
                <style>
                .trash-item{display:flex;align-items:center;gap:.75rem;padding:.6rem .75rem;border:1px solid var(--border);border-radius:var(--radius-md);background:var(--bg-raised);transition:background .1s}
                .trash-item.selected{background:rgba(239,68,68,.06);border-color:rgba(239,68,68,.3)}
                .trash-cb{width:16px;height:16px;cursor:pointer;accent-color:#ef4444;flex-shrink:0}
                </style>
                <div style="display:flex;align-items:center;gap:.75rem;padding:.4rem .75rem .75rem;border-bottom:1px solid var(--border);margin-bottom:.5rem">
                    <input type="checkbox" class="trash-cb" id="trash-sel-all" onchange="ResourcesPage._trashToggleAll(this.checked)" title="Вибрати всі">
                    <label for="trash-sel-all" style="font-size:.82rem;color:var(--text-muted);cursor:pointer;user-select:none">Вибрати всі</label>
                    <span id="trash-sel-count" style="font-size:.78rem;color:#ef4444;font-weight:600;display:none"></span>
                </div>
                <div style="display:flex;flex-direction:column;gap:.4rem;max-height:400px;overflow-y:auto" id="trash-list">
                    ${items.map(r => `
                    <div class="trash-item" id="trash-row-${r.id}">
                        <input type="checkbox" class="trash-cb trash-item-cb" data-id="${r.id}" onchange="ResourcesPage._trashSelChange()" title="Вибрати">
                        <div style="font-size:1.2rem;flex-shrink:0">${this._resourceIcon(r.type||r.file_type||'file')}</div>
                        <div style="flex:1;min-width:0">
                            <div style="font-weight:600;font-size:.88rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${Fmt.esc(r.title)}</div>
                            <div style="font-size:.73rem;color:var(--text-muted)">Видалено ${Fmt.dateShort(r.deleted_at)}${r.deleter?.full_name ? ' · ' + Fmt.esc(r.deleter.full_name) : ''}</div>
                        </div>
                        <button class="btn btn-ghost btn-sm" onclick="ResourcesPage._restoreResource('${r.id}')">↩ Відновити</button>
                        <button class="btn btn-sm" style="background:rgba(239,68,68,.1);color:#ef4444;border:1px solid rgba(239,68,68,.2)" onclick="ResourcesPage._hardDelete('${r.id}',${JSON.stringify(r.title||'').replace(/"/g,'&quot;')})">✕</button>
                    </div>`).join('')}
                </div>`;
            if (footer) footer.innerHTML = `
                <button class="btn btn-danger" id="trash-del-sel-btn" style="display:none" onclick="ResourcesPage._hardDeleteSelected()"><i class="fa-solid fa-trash"></i> Видалити вибрані (<span id="trash-del-count">0</span>)</button>
                <div style="flex:1"></div>
                <button class="btn btn-ghost" onclick="Modal.close()">Закрити</button>`;
        } catch(e) {
            const body = document.getElementById('modal-body');
            if (body) body.innerHTML = `<div style="color:var(--danger);padding:1rem">${e.message}</div>`;
        }
    },

    _trashSelChange() {
        const cbs = document.querySelectorAll('.trash-item-cb');
        const checked = [...cbs].filter(c => c.checked);
        document.querySelectorAll('.trash-item').forEach(row => {
            const cb = row.querySelector('.trash-item-cb');
            row.classList.toggle('selected', cb?.checked || false);
        });
        const countEl = document.getElementById('trash-sel-count');
        const delBtn = document.getElementById('trash-del-sel-btn');
        const delCount = document.getElementById('trash-del-count');
        const selAll = document.getElementById('trash-sel-all');
        if (countEl) { countEl.style.display = checked.length ? '' : 'none'; countEl.textContent = `${checked.length} вибрано`; }
        if (delBtn) delBtn.style.display = checked.length ? '' : 'none';
        if (delCount) delCount.textContent = checked.length;
        if (selAll) selAll.indeterminate = checked.length > 0 && checked.length < cbs.length;
        if (selAll && checked.length === cbs.length && cbs.length > 0) selAll.checked = true;
    },

    _trashToggleAll(checked) {
        document.querySelectorAll('.trash-item-cb').forEach(cb => { cb.checked = checked; });
        this._trashSelChange();
    },

    async _hardDeleteSelected() {
        const cbs = [...document.querySelectorAll('.trash-item-cb:checked')];
        if (!cbs.length) return;
        const ids = cbs.map(c => c.dataset.id);
        if (!await Modal.confirm({ message: `Видалити ${ids.length} файл(ів) назавжди? Це незворотна дія.`, danger: true, confirmText: 'Видалити назавжди' })) return;
        const btn = document.getElementById('trash-del-sel-btn');
        if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Видалення...'; }
        try {
            await Promise.all(ids.map(id => {
                API.notifications.deleteByLink(`resource/${id}`).catch(() => {});
                return API.resources.delete(id);
            }));
            Toast.success('Видалено', `${ids.length} файл(ів) видалено назавжди`);
            await this._openTrash();
            await this.load();
            if (AppState.isAdmin()) this._loadDbSize();
        } catch(e) {
            Toast.error('Помилка', e.message);
            if (btn) { btn.disabled = false; btn.innerHTML = `<i class="fa-solid fa-trash"></i> Видалити вибрані`; }
        }
    },

    async _restoreResource(id) {
        try {
            await API.resources.restore(id);
            Toast.success('Відновлено');
            await this._openTrash();
            await this.load();
        } catch(e) {
            Toast.error('Помилка', e.message);
        }
    },

    async _hardDelete(id, title) {
        if (!await Modal.confirm(`Видалити «${title}» назавжди? Це незворотна дія.`)) return;
        try {
            await API.resources.delete(id);
            API.notifications.deleteByLink(`resource/${id}`).catch(() => {});
            Toast.success('Видалено назавжди');
            await this._openTrash();
            await this.load();
            if (AppState.isAdmin()) this._loadDbSize();
        } catch(e) {
            Toast.error('Помилка', e.message);
        }
    },
};

// ================================================================
// ResourceViewPage — inline resource viewer (full page, no modal)
// ================================================================

const ResourceViewPage = {

    // Завжди справжній перехід назад в історії браузера (як натискання
    // кнопки "Назад" у самому браузері) — незалежно від того, звідки
    // відкрили ресурс. Раніше тут була "розумна" навігація на фіксовану
    // сторінку (documents/knowledge-base/admin) залежно від `from`, але це
    // не відповідало реальній історії переходів користувача.
    _goBack() {
        Router.back();
    },

    async init(container, { id, from } = {}) {
        if (!id) { Router.back(); return; }

        UI.setBreadcrumb([{ label: 'Назад', onClick: () => ResourceViewPage._goBack() }, { label: 'Перегляд' }]);

        container.innerHTML = `
            <div style="display:flex;align-items:center;justify-content:center;min-height:300px">
                <div class="spinner"></div>
            </div>`;

        try {
            const resource = await API.resources.getById(id);
            if (resource.deleted_at) {
                container.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-icon">🗑️</div>
                        <h3>Документ видалено</h3>
                        <p style="color:var(--text-muted)">Цей файл було переміщено до кошика і більше недоступний.</p>
                        <button class="btn btn-primary" onclick="Router.go('documents')" style="display:inline-flex;align-items:center;gap:.35rem"><i class="fa-solid fa-angle-left"></i> До документів</button>
                    </div>`;
                return;
            }

            // ── Перевірка доступу для не-staff (враховує preview-режим) ──
            // Менеджери бачать всі документи (як у docs list view)
            if (!AppState.isStaff() && !AppState.isManager()) {
                // 1. Access group
                if (!AccessGroupsPage.checkAccess(resource.access_group)) {
                    container.innerHTML = `
                        <div class="empty-state">
                            <div class="empty-icon">🔒</div>
                            <h3>Немає доступу</h3>
                            <p style="color:var(--text-muted)">У вас немає прав для перегляду цього документа.</p>
                            <button class="btn-back" onclick="Router.back()"><i class="fa-solid fa-arrow-left"></i> Назад</button>
                        </div>`;
                    return;
                }
                // 2. Dovirenosti (тільки для docs — ресурси курсів не перевіряємо)
                const rdovs = resource.resource_dovirenosti || [];
                if (rdovs.length > 0) {
                    const myDovs = await API.dovirenosti.getForProfile(AppState.user.id).catch(() => []);
                    const myIds  = new Set(myDovs.map(d => d.id));
                    const hasAccess = rdovs.some(rd => myIds.has(rd.dovirenost_id));
                    if (!hasAccess) {
                        container.innerHTML = `
                            <div class="empty-state">
                                <div class="empty-icon">🔒</div>
                                <h3>Немає доступу</h3>
                                <p style="color:var(--text-muted)">Цей документ доступний лише для певних категорій співробітників.</p>
                                <button class="btn-back" onclick="Router.back()"><i class="fa-solid fa-arrow-left"></i> Назад</button>
                            </div>`;
                        return;
                    }
                }
            }

            const url      = await this._getUrl(resource);
            const isDoc = from === 'documents';
            RecentlyViewed.track({ type: isDoc ? 'document' : 'resource', id: resource.id, title: resource.title, thumbnail: null, route: `resource/${resource.id}${from ? '?from='+from : ''}`, color: isDoc ? '#ef4444' : '#3b82f6', icon: isDoc ? 'fa-file-lines' : 'fa-paperclip' });
            ActivityTracker.track(isDoc ? 'doc_view' : 'doc_view', { entity_type: isDoc ? 'document' : 'resource', entity_id: resource.id, entity_title: resource.title, page: `resource/${resource.id}` });
            let dlStatus = null;
            if (from === 'documents') {
                const map = await API.documentDownloads.getMyLatest([id]).catch(() => ({}));
                dlStatus = map[id] || null;
            }
            this._render(container, resource, url, from, dlStatus);
        } catch (e) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">⚠️</div>
                    <h3>${e.message}</h3>
                    <button class="btn-back" onclick="Router.back()"><i class="fa-solid fa-arrow-left"></i> Назад</button>
                </div>`;
        }
    },

    async _getUrl(resource) {
        // SCORM-файл лежить в окремому бакеті scorm-packages (не lesson-resources),
        // і сам _render() для isScorm цей url не використовує — програвач
        // (ScormPlayer) сам створює підписане посилання в потрібному бакеті.
        if (resource.type === 'scorm') return null;
        if (resource.file_url)    return resource.file_url;
        if (resource.storage_path) return await API.resources.getSignedUrl(resource.storage_path);
        throw new Error('Файл не знайдено');
    },

    // Викликається роутером при переході з цього роуту (js/app.js, resource/:id).
    // Без цього: якщо відео відкрите в нативному Picture-in-Picture і користувач
    // переходить в інший розділ SPA, router одразу перезаписує #page-content
    // (innerHTML) — <video> знищується, але браузер не зупиняє відтворення
    // detached-елемента, тож звук продовжує грати без картинки, а кнопка
    // "повернутись у вкладку" на PiP-вікні просто перемикає фокус вкладки, не
    // повертаючи SPA-роут. Тому явно закриваємо PiP і ставимо на паузу.
    destroy() {
        const video = document.getElementById('rv-video');
        if (video) {
            if (document.pictureInPictureElement === video) {
                document.exitPictureInPicture().catch(() => {});
            }
            video.pause();
        }
        if (document.getElementById('rv-scorm-frame')) ScormPlayer.closeInline();
    },

    _scormFullscreen() {
        const el = document.getElementById('rv-scorm-wrap');
        if (!el) return;
        if (document.fullscreenElement) document.exitFullscreen();
        else el.requestFullscreen?.();
    },

    _render(container, resource, url, from, dlStatus) {
        const ext = resource.storage_path
            ? resource.storage_path.split('.').pop().toLowerCase()
            : (resource.file_type?.split('/').pop() || '');

        const isPdf   = resource.type === 'pdf' || ext === 'pdf';
        const isVideo = resource.type === 'video' || ['mp4','webm','ogg'].includes(ext);
        const isImage = resource.type === 'image' || ['jpg','jpeg','png','gif','svg','webp'].includes(ext);
        const isDoc   = ['doc','docx','xls','xlsx','ppt','pptx','txt','csv'].includes(ext);
        const isScorm = resource.type === 'scorm';

        const categoryBadge = resource.category
            ? `<span class="badge" style="background:var(--bg-raised);color:var(--text-secondary);font-size:.75rem;padding:3px 10px;border-radius:20px;border:1px solid var(--border)">${resource.category}</span>`
            : '';
        const courseBadge = resource.course?.title
            ? `<span class="badge" style="background:var(--bg-raised);color:var(--text-secondary);font-size:.75rem;padding:3px 10px;border-radius:20px;border:1px solid var(--border)">📚 ${resource.course.title}</span>`
            : '';

        let viewerHtml;

        if (isPdf) {
            const dl = resource.download_allowed !== false ? '1' : '0';
            const viewerUrl = `pdf-viewer.html?file=${encodeURIComponent(url)}&title=${encodeURIComponent(resource.title || 'PDF')}&download=${dl}`;
            viewerHtml = `<iframe src="${viewerUrl}" style="width:100%;height:calc(90vh - 130px);min-height:450px;border:none;display:block"></iframe>`;

        } else if (isVideo) {
            const noDownload = resource.download_allowed === false ? 'controlsList="nodownload"' : '';
            viewerHtml = `
                <div style="background:#000;border-radius:var(--radius-lg);overflow:hidden">
                    <video id="rv-video" controls ${noDownload} src="${url}" style="width:100%;max-height:calc(100vh - 240px);display:block"></video>
                </div>`;

        } else if (isImage) {
            viewerHtml = `
                <div style="background:var(--bg-raised);border-radius:var(--radius-lg);padding:1.5rem;text-align:center;border:1px solid var(--border)">
                    <img src="${url}" style="max-width:100%;max-height:calc(100vh - 280px);object-fit:contain;border-radius:var(--radius-md)">
                </div>`;

        } else if (isScorm) {
            viewerHtml = `
                <div class="rv-scorm-wrap" id="rv-scorm-wrap">
                    <div class="rv-scorm-toolbar">
                        <span class="rv-scorm-status" id="rv-scorm-status"></span>
                        <button class="btn btn-ghost btn-sm" onclick="ResourceViewPage._scormFullscreen()"><i class="fa-solid fa-expand"></i> На весь екран</button>
                    </div>
                    <div class="rv-scorm-gate" id="rv-scorm-gate" style="display:none">
                        <div class="rv-scorm-gate-ico"><i class="fa-solid fa-graduation-cap"></i></div>
                        <div class="rv-scorm-gate-text">Курс ще не розпочато</div>
                        <button class="btn btn-primary" data-scorm-start><i class="fa-solid fa-play"></i> Почати проходження</button>
                    </div>
                    <iframe id="rv-scorm-frame" class="rv-scorm-frame" sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-top-navigation-by-user-activation"></iframe>
                </div>`;

        } else if (isDoc) {
            const gUrl     = `https://docs.google.com/gview?url=${encodeURIComponent(url)}&embedded=true`;
            const gOpenUrl = `https://docs.google.com/gview?url=${encodeURIComponent(url)}`;
            const dlName   = ResourcesPage._buildFilename(resource);
            const dlBtn    = resource.download_allowed !== false
                ? `<a href="${Fmt.safeUrl(url)}" download="${Fmt.esc(dlName)}" class="btn btn-primary"><i class="fa-solid fa-download"></i> Завантажити</a>`
                : '';
            viewerHtml = `
                <div style="position:relative;width:100%;height:calc(100vh - 220px);min-height:500px;border-radius:var(--radius-lg);overflow:hidden;border:1px solid var(--border)">
                    <div id="doc-loader" style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:var(--bg-raised);gap:.75rem;z-index:2">
                        <div class="spinner"></div>
                        <span style="color:var(--text-muted);font-size:.85rem">Завантаження документа…</span>
                    </div>
                    <div id="doc-fallback" style="display:none;position:absolute;inset:0;flex-direction:column;align-items:center;justify-content:center;gap:1rem;background:var(--bg-raised);text-align:center;padding:2rem;z-index:2">
                        <div style="font-size:2.5rem">📄</div>
                        <p style="color:var(--text-muted);font-size:.875rem;margin:0">Не вдалось завантажити попередній перегляд</p>
                        <div style="display:flex;gap:.75rem;flex-wrap:wrap;justify-content:center">
                            ${dlBtn}
                            <button class="btn btn-ghost" onclick="ResourceViewPage._retryDoc()">🔄 Спробувати ще раз</button>
                            <a href="${gOpenUrl}" target="_blank" rel="noopener" class="btn btn-ghost">🔗 Google Docs</a>
                        </div>
                    </div>
                    <iframe id="doc-iframe" src="${gUrl}"
                        style="width:100%;height:100%;border:none;display:block"
                        onload="ResourceViewPage._onDocLoad(this)">
                    </iframe>
                </div>`;

        } else {
            viewerHtml = `
                <div style="text-align:center;padding:3rem;background:var(--bg-raised);border-radius:var(--radius-lg);border:1px solid var(--border);color:var(--text-muted)">
                    <div style="font-size:3rem;margin-bottom:1rem">📎</div>
                    <p style="margin-bottom:1.5rem">Цей тип файлу не підтримується для перегляду онлайн.</p>
                    <a href="${Fmt.safeUrl(url)}" target="_blank" rel="noopener noreferrer" class="btn btn-primary"><i class='fa-solid fa-arrow-up-right-from-square'></i> Відкрити в новому вікні</a>
                </div>`;
        }

        const deadlineBadge = from === 'documents' ? ResourcesPage._deadlineBadge(resource, dlStatus) : '';

        const _alreadyAcked = from === 'documents' && dlStatus && !(resource.doc_version > (dlStatus.version || 1));
        const _ackInline = _alreadyAcked ? (() => {
            const btnBase = 'flex-shrink:0;display:inline-flex;align-items:center;gap:6px;padding:5px 14px;border-radius:20px;font-size:.85rem;font-weight:500;cursor:pointer;transition:background var(--transition),color var(--transition)';
            return `<span style="display:inline-flex;align-items:center;gap:.3rem;color:#10b981;font-weight:500;font-size:.85rem;white-space:nowrap">✅ ${ResourcesPage._ackLabel()} ${Fmt.dateShort(dlStatus.at)}</span>`;
        })() : '';

        container.innerHTML = `
            <div style="display:flex;flex-direction:column;gap:1rem">

                <!-- Header -->
                <div style="display:flex;align-items:flex-start;gap:1rem;flex-wrap:wrap">
                    <button class="btn-back" style="flex-shrink:0;margin-top:.2rem" onclick="ResourceViewPage._goBack()"><i class="fa-solid fa-arrow-left"></i> Назад</button>
                    <div style="flex:1;min-width:0">
                        <div style="display:flex;align-items:center;gap:10px;margin-bottom:.4rem;flex-wrap:wrap">
                            <h1 style="margin:0;font-size:1.4rem;font-weight:700;line-height:1.3">${Fmt.esc(resource.title)}</h1>
                            <button class="res-star-btn${Bookmarks.isBookmarked('resource/'+resource.id) ? ' active' : ''}"
                                data-bm-route="resource/${resource.id}"
                                title="${Bookmarks.isBookmarked('resource/'+resource.id) ? 'Видалити з закладок' : 'Зберегти в закладки'}"
                                onclick="Bookmarks.toggleResource('${resource.id}',${JSON.stringify(resource.title||'').replace(/"/g,'&quot;')},${JSON.stringify(ResourcesPage._resourceIcon(resource.type||resource.file_type||'file')).replace(/"/g,'&quot;')},${JSON.stringify(resource.category||'').replace(/"/g,'&quot;')})">${Bookmarks.isBookmarked('resource/'+resource.id) ? '<i class="fa-solid fa-bookmark"></i>' : '<i class="fa-regular fa-bookmark"></i>'}</button>
                            ${_ackInline}
                        </div>
                        <div style="display:flex;gap:.5rem;flex-wrap:wrap;align-items:center">
                            ${categoryBadge}
                            ${courseBadge}
                            ${resource.download_allowed === false ? `<span class="badge" style="background:rgba(239,68,68,.1);color:#f87171;font-size:.75rem;padding:3px 10px;border-radius:20px;border:1px solid rgba(239,68,68,.2)">тільки перегляд</span>` : ''}
                            ${deadlineBadge}
                        </div>
                        ${resource.description ? `<p style="margin:.6rem 0 0;font-size:.875rem;color:var(--text-muted);background:var(--bg-raised);border-left:3px solid var(--primary);border-radius:0 6px 6px 0;padding:.5rem .75rem">${Fmt.esc(resource.description)}</p>` : ''}
                    </div>
                    ${AppState.isStaff() ? `
                    <button title="Редагувати" onclick="ResourcesPage.openEdit('${resource.id}')"
                            style="flex-shrink:0;width:40px;height:40px;border-radius:50%;border:2px solid var(--border);background:var(--bg-raised);color:var(--text-primary);font-size:1.1rem;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background var(--transition),border-color var(--transition)"
                            onmouseenter="this.style.background='var(--bg-hover)';this.style.borderColor='var(--primary)'"
                            onmouseleave="this.style.background='var(--bg-raised)';this.style.borderColor='var(--border)'">
                        <i class="fa-solid fa-pen"></i>
                    </button>` : ''}
                </div>

                <!-- Action footer (centered, tracked docs only) -->
                <div style="display:flex;justify-content:center">
                    ${this._buildActionFooter(resource, from, dlStatus, isPdf, isVideo)}
                </div>

                <!-- Download bar (above viewer, hidden for PDF — viewer has its own download button) -->
                ${resource.download_allowed !== false && !isPdf && !isScorm
                    ? `<div style="display:flex;justify-content:center;padding:.25rem 0">
                        <a href="${Fmt.safeUrl(url)}" download="${Fmt.esc(ResourcesPage._buildFilename(resource))}"
                            style="display:inline-flex;align-items:center;gap:8px;padding:10px 32px;background:var(--primary);color:#fff;border-radius:24px;font-size:.95rem;font-weight:600;text-decoration:none;box-shadow:0 2px 8px rgba(0,0,0,.15);transition:background var(--transition)"
                            onmouseenter="this.style.background='var(--primary-dark,#1d4ed8)'"
                            onmouseleave="this.style.background='var(--primary)'">
                            <i class="fa-solid fa-download"></i> Завантажити
                        </a>
                    </div>`
                    : ''}

                <!-- Viewer -->
                ${viewerHtml}

            </div>`;

        this._setupUnlockListeners(resource, from, dlStatus, isPdf, isVideo, isImage, isDoc);
        if (isDoc) this._startDocTimeout(url);
        if (isScorm) ScormPlayer.openInline(resource.id, resource.title);
        // Браузер може скролити до iframe автоматично — скидаємо після рендеру
        requestAnimationFrame(() => {
            document.documentElement.scrollTop = 0;
            document.body.scrollTop = 0;
        });
    },

    // Індикатор очікування ознайомлення — без кнопки: підтвердження тепер
    // ставиться автоматично (PDF — скрол до кінця, відео — перегляд до
    // заданого відсотка, див. _setupUnlockListeners), однаково для всіх
    // документів (is_tracked_download більше не впливає на це, лише на
    // розділ "Статус" у сайдбарі). Для зображень/docx/Google Docs вимогу
    // прибрано зовсім — немає надійного сигналу "прочитано".
    _buildActionFooter(resource, from, dlStatus, isPdf, isVideo) {
        if (from !== 'documents' || !(isPdf || isVideo)) {
            return ''; // download handled by centered bar above viewer
        }

        const isNewVersion = dlStatus && resource.doc_version > (dlStatus.version || 1);
        const alreadyAcked = dlStatus && !isNewVersion;
        if (alreadyAcked) {
            return ''; // shown inline in title row
        }

        const lockHint = isPdf
            ? (isNewVersion ? '🔄 Нова версія — пролистайте до кінця' : '📜 Пролистайте документ до кінця')
            : (isNewVersion ? '🔄 Нова версія — перегляньте відео' : '🎬 Перегляньте відео до кінця');
        return `<div id="doc-viewer-action" style="flex-shrink:0;display:inline-flex;align-items:center;gap:.5rem">
            <style>
            @keyframes doc-lock-pulse {
                0%,100%{opacity:1;transform:scale(1)}
                50%{opacity:.55;transform:scale(.97)}
            }
            @keyframes doc-lock-glow {
                0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,0)}
                50%{box-shadow:0 0 0 6px rgba(239,68,68,.22)}
            }
            #doc-viewer-lock {
                animation:doc-lock-pulse 2s ease-in-out infinite,doc-lock-glow 2s ease-in-out infinite;
                display:inline-flex;align-items:center;gap:6px;
                padding:5px 14px;border-radius:20px;
                background:rgba(239,68,68,.1);border:1.5px solid rgba(239,68,68,.35);
                color:#ef4444;font-weight:600;font-size:.82rem;white-space:nowrap;
            }
            </style>
            <span id="doc-viewer-lock">${lockHint}</span>
        </div>`;
    },

    _docTimeoutId: null,
    _docIframeUrl: null,

    _startDocTimeout(url) {
        this._docIframeUrl = url;
        clearTimeout(this._docTimeoutId);
        this._docTimeoutId = setTimeout(() => {
            // If loader is still visible after 20s — show fallback
            const loader = document.getElementById('doc-loader');
            if (loader && loader.style.display !== 'none') {
                this._showDocFallback();
            }
        }, 20000);
    },

    _onDocLoad(iframe) {
        // onload fires even for Google's own error page, so wait briefly
        // then check if content is actually there by seeing if loader still shown
        setTimeout(() => {
            const loader = document.getElementById('doc-loader');
            if (loader) loader.style.display = 'none';
            clearTimeout(this._docTimeoutId);
        }, 800);
    },

    _showDocFallback() {
        const loader   = document.getElementById('doc-loader');
        const fallback = document.getElementById('doc-fallback');
        const iframe   = document.getElementById('doc-iframe');
        if (loader)   loader.style.display   = 'none';
        if (iframe)   iframe.style.display   = 'none';
        if (fallback) fallback.style.display = 'flex';
    },

    _retryDoc() {
        const fallback = document.getElementById('doc-fallback');
        const loader   = document.getElementById('doc-loader');
        const iframe   = document.getElementById('doc-iframe');
        if (!iframe) return;
        if (fallback) fallback.style.display = 'none';
        if (loader)  { loader.style.display  = 'flex'; }
        if (iframe)  { iframe.style.display  = 'block'; iframe.src = iframe.src; }
        if (this._docIframeUrl) this._startDocTimeout(this._docIframeUrl);
    },

    // Автоматичне ознайомлення — без кнопки, однаково для трекованих і
    // нетрекованих документів (is_tracked_download більше не впливає на
    // сам факт ознайомлення — лише на розділ "Статус" у сайдбарі).
    // Спрацьовує лише для PDF (скрол до кінця) і відео (перегляд до
    // VIDEO_ACK_THRESHOLD). Для зображень/docx/Google Docs вимогу
    // прибрано — немає надійного сигналу "прочитано".
    _VIDEO_ACK_THRESHOLD: 0.85,

    _setupUnlockListeners(resource, from, dlStatus, isPdf, isVideo, isImage, isDoc) {
        const isNewVersion = dlStatus && resource.doc_version > (dlStatus.version || 1);
        const needsUnlock = from === 'documents' && (!dlStatus || isNewVersion) && (isPdf || isVideo);
        if (!needsUnlock) return;

        const autoAck = () => { ResourcesPage.acknowledgeDoc(resource.id); };

        if (isPdf) {
            const handler = e => {
                if (e.data?.type === 'pdf-scroll-end') {
                    autoAck();
                    window.removeEventListener('message', handler);
                }
            };
            window.addEventListener('message', handler);
            return;
        }

        // use a short timeout to let the video element appear in DOM
        setTimeout(() => {
            const video = document.querySelector('video');
            if (!video) { autoAck(); return; }
            const handler = () => {
                if (video.duration && video.currentTime / video.duration >= this._VIDEO_ACK_THRESHOLD) {
                    autoAck();
                    video.removeEventListener('timeupdate', handler);
                }
            };
            video.addEventListener('timeupdate', handler);
        }, 200);
    }
};