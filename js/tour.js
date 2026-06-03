// ================================================================
// TourManager — покрокові тури для нових користувачів
// ================================================================

const TourManager = {
    _steps:   [],
    _current: 0,
    _onDone:  null,
    _cleanup: null,

    // ── Публічний API ────────────────────────────────────────────

    start(tourId, steps, { onDone, force = false } = {}) {
        if (!force) {
            // Спочатку перевіряємо localStorage (швидко)
            if (localStorage.getItem(`tour_done_${tourId}`)) return;
            // Потім перевіряємо profile з БД (вже завантажений в AppState)
            if (API.profiles.isTourDone(tourId)) {
                localStorage.setItem(`tour_done_${tourId}`, '1'); // кешуємо локально
                return;
            }
        }
        this._tourId  = tourId;
        this._steps   = steps;
        this._current = 0;
        this._onDone  = onDone || null;
        this._build();
        this._show(0);
    },

    reset(tourId) {
        localStorage.removeItem(`tour_done_${tourId}`);
        // Скидаємо також в БД
        if (AppState.profile?.completed_tours) {
            AppState.profile.completed_tours = AppState.profile.completed_tours.filter(t => t !== tourId);
            supabase.from('profiles')
                .update({ completed_tours: AppState.profile.completed_tours })
                .eq('id', AppState.user.id).then(() => {});
        }
    },

    resetAll() {
        Object.keys(localStorage)
            .filter(k => k.startsWith('tour_done_'))
            .forEach(k => localStorage.removeItem(k));
    },

    // ── Побудова DOM ─────────────────────────────────────────────

    _build() {
        this._destroy();

        const el = document.createElement('div');
        el.id = 'tour-root';
        el.innerHTML = `
<style>
#tour-root{position:fixed;inset:0;z-index:99990;pointer-events:none}
#tour-backdrop{position:absolute;inset:0;pointer-events:all;cursor:default}
#tour-backdrop svg{position:absolute;inset:0;width:100%;height:100%}
#tour-highlight{position:absolute;border-radius:12px;box-shadow:0 0 0 4px var(--primary),0 0 0 8px rgba(99,102,241,.25);pointer-events:none;transition:all .3s cubic-bezier(.4,0,.2,1);z-index:99993}
#tour-tip{position:absolute;z-index:99994;pointer-events:all;width:680px;background:var(--bg-surface);border:1.5px solid var(--border);border-radius:24px;box-shadow:0 24px 64px rgba(0,0,0,.32);overflow:hidden;transition:all .25s cubic-bezier(.4,0,.2,1)}
.tour-tip-accent{height:5px;background:linear-gradient(90deg,var(--primary),#818cf8)}
.tour-tip-body{padding:2rem 2.2rem 1.4rem}
.tour-tip-step{font-size:1rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--primary);margin-bottom:.55rem}
.tour-tip-title{font-size:1.6rem;font-weight:700;color:var(--text-primary);margin-bottom:.7rem;line-height:1.25}
.tour-tip-text{font-size:1.1rem;color:var(--text-secondary);line-height:1.6}
.tour-tip-icon{font-size:3.2rem;margin-bottom:.9rem}
.tour-tip-footer{display:flex;align-items:center;gap:.75rem;padding:1.1rem 2.2rem;border-top:1px solid var(--border);background:var(--bg-raised)}
.tour-btn{border:none;border-radius:12px;padding:.6rem 1.5rem;font-size:1rem;font-weight:600;cursor:pointer;transition:opacity .15s}
.tour-btn:hover{opacity:.85}
.tour-btn-next{background:var(--primary);color:#fff}
.tour-btn-prev{background:var(--bg-base);color:var(--text-secondary);border:1px solid var(--border)}
.tour-btn-skip{background:none;color:var(--text-muted);font-size:.95rem;margin-right:auto;padding:.6rem .75rem}
.tour-btn-skip:hover{color:var(--text-primary)}
.tour-dots{display:flex;gap:.45rem;align-items:center;margin-right:auto}
.tour-dot{width:8px;height:8px;border-radius:50%;background:var(--border);transition:background .2s,width .2s}
.tour-dot.active{background:var(--primary);width:22px}
#tour-skip-all{position:fixed;top:20px;right:20px;z-index:99995;pointer-events:all;background:rgba(0,0,0,.55);color:#fff;border:none;border-radius:24px;padding:.45rem 1.2rem;font-size:.95rem;cursor:pointer;backdrop-filter:blur(8px)}
</style>
<div id="tour-backdrop"></div>
<div id="tour-highlight"></div>
<div id="tour-tip">
    <div class="tour-tip-accent"></div>
    <div class="tour-tip-body">
        <div class="tour-tip-icon" id="tour-icon"></div>
        <div class="tour-tip-step" id="tour-step-label"></div>
        <div class="tour-tip-title" id="tour-title"></div>
        <div class="tour-tip-text" id="tour-text"></div>
    </div>
    <div class="tour-tip-footer">
        <button class="tour-btn tour-btn-skip" id="tour-skip">Пропустити тур</button>
        <div class="tour-dots" id="tour-dots"></div>
        <button class="tour-btn tour-btn-prev" id="tour-prev">‹ Назад</button>
        <button class="tour-btn tour-btn-next" id="tour-next">Далі ›</button>
    </div>
</div>
<button id="tour-skip-all">✕ Пропустити</button>`;

        document.body.appendChild(el);

        document.getElementById('tour-next').onclick  = () => this._next();
        document.getElementById('tour-prev').onclick  = () => this._prev();
        document.getElementById('tour-skip').onclick  = () => this._finish();
        document.getElementById('tour-skip-all').onclick = () => this._finish();

        // Backdrop click outside highlight — advance
        document.getElementById('tour-backdrop').onclick = (e) => {
            const hl = document.getElementById('tour-highlight');
            if (!hl) return;
            const r = hl.getBoundingClientRect();
            const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
            if (!inside) this._next();
        };

        const onKey = (e) => { if (e.key === 'Escape') this._finish(); if (e.key === 'ArrowRight') this._next(); if (e.key === 'ArrowLeft') this._prev(); };
        document.addEventListener('keydown', onKey);
        this._cleanup = () => document.removeEventListener('keydown', onKey);
    },

    // ── Відображення кроку ────────────────────────────────────────

    _show(index) {
        const step = this._steps[index];
        if (!step) { this._finish(); return; }

        // Texts
        document.getElementById('tour-icon').innerHTML    = step.icon || '';
        document.getElementById('tour-icon').style.display = step.icon ? '' : 'none';
        document.getElementById('tour-step-label').textContent = `Крок ${index + 1} з ${this._steps.length}`;
        document.getElementById('tour-title').textContent = step.title || '';
        document.getElementById('tour-text').innerHTML    = step.text || '';

        // Dots
        const dotsEl = document.getElementById('tour-dots');
        dotsEl.innerHTML = this._steps.map((_, i) =>
            `<div class="tour-dot${i === index ? ' active' : ''}"></div>`).join('');

        // Buttons
        document.getElementById('tour-prev').style.display = index === 0 ? 'none' : '';
        const nextBtn = document.getElementById('tour-next');
        nextBtn.textContent = index === this._steps.length - 1 ? '✓ Завершити' : 'Далі ›';

        // Step callback (e.g. show a demo popup / render elements needed for targeting)
        if (step.onShow) step.onShow();

        // Scroll first (instant) so getBoundingClientRect gives correct viewport coords
        const target = this._resolveTarget(step.target);
        if (target) target.scrollIntoView({ behavior: 'instant', block: 'center' });

        // Highlight & position after scroll settled (rAF ensures layout is recalculated)
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                this._positionHighlight(target, step.position || 'bottom');
                // Apply tipStyle AFTER _positionHighlight so it wins
                if (step.tipStyle) {
                    const tip = document.getElementById('tour-tip');
                    if (tip) Object.assign(tip.style, step.tipStyle);
                }
                // noBackdrop — must run AFTER _positionHighlight to win
                if (step.noBackdrop) {
                    const bd = document.getElementById('tour-backdrop');
                    if (bd) { bd.innerHTML = ''; bd.style.background = 'transparent'; bd.style.pointerEvents = 'none'; }
                    const hl = document.getElementById('tour-highlight');
                    if (hl) hl.style.display = 'none';
                }
            });
        });
    },

    // Повертає перший видимий DOM-елемент зі списку селекторів (або null)
    _resolveTarget(sel) {
        if (!sel) return null;
        const list = Array.isArray(sel) ? sel : [sel];
        for (const s of list) {
            const el = document.querySelector(s);
            if (!el) continue;
            const r = el.getBoundingClientRect();
            if (r.width > 4 && r.height > 4) return el;
        }
        return null;
    },

    _positionHighlight(target, placement) {
        const hl  = document.getElementById('tour-highlight');
        const tip = document.getElementById('tour-tip');
        const PAD = 8;

        // Fallback to centered if target missing or invisible (zero size)
        const r = target ? target.getBoundingClientRect() : null;
        const isVisible = r && r.width > 4 && r.height > 4;
        const bd = document.getElementById('tour-backdrop');

        if (!target || !isVisible) {
            hl.style.cssText = 'display:none';
            bd.innerHTML = '';
            bd.style.background = 'rgba(0,0,0,.65)';
            bd.onclick = () => this._next();
            tip.style.cssText = `width:680px;top:50%;left:50%;transform:translate(-50%,-50%)`;
            return;
        }

        bd.style.background = '';
        const sw = window.innerWidth, sh = window.innerHeight;

        // Highlight
        hl.style.cssText = `
            display:block;
            top:${r.top - PAD}px;
            left:${r.left - PAD}px;
            width:${r.width + PAD * 2}px;
            height:${r.height + PAD * 2}px`;

        // Draw SVG cutout backdrop
        const bx = r.left - PAD, by = r.top - PAD, bw = r.width + PAD*2, bh = r.height + PAD*2;
        bd.style.background = '';
        bd.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg">
            <defs>
                <mask id="tour-mask">
                    <rect width="100%" height="100%" fill="white"/>
                    <rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="12" fill="black"/>
                </mask>
            </defs>
            <rect width="100%" height="100%" fill="rgba(0,0,0,.62)" mask="url(#tour-mask)"/>
        </svg>`;
        // Re-attach click after innerHTML reset
        bd.onclick = (e) => {
            const inside = e.clientX >= bx && e.clientX <= bx+bw && e.clientY >= by && e.clientY <= by+bh;
            if (!inside) this._next();
        };

        // Position tooltip
        const TIP_W = 680, TIP_H = 320;
        let top, left;

        if (placement === 'left') {
            top  = Math.min(Math.max(r.top + r.height/2 - TIP_H/2, 8), sh - TIP_H - 8);
            left = Math.max(r.left - TIP_W - PAD - 12, 8);
        } else if (placement === 'right') {
            top  = Math.min(Math.max(r.top + r.height/2 - TIP_H/2, 8), sh - TIP_H - 8);
            left = Math.min(r.right + PAD + 12, sw - TIP_W - 8);
        } else if (placement === 'top' && r.top - TIP_H - 16 > 0) {
            top  = r.top - PAD - TIP_H - 12;
            left = Math.min(Math.max(r.left + r.width/2 - TIP_W/2, 8), sw - TIP_W - 8);
        } else {
            // bottom (default) — якщо не влізає знизу, ставимо зверху
            if (r.bottom + TIP_H + 16 < sh) {
                top = r.bottom + PAD + 12;
            } else {
                top = Math.max(r.top - PAD - TIP_H - 12, 8);
            }
            left = Math.min(Math.max(r.left + r.width/2 - TIP_W/2, 8), sw - TIP_W - 8);
        }

        tip.style.cssText = `width:${TIP_W}px;top:${top}px;left:${left}px;transform:none`;
    },

    // ── Навігація ─────────────────────────────────────────────────

    _next() {
        const step = this._steps[this._current];
        if (step?.onLeave) step.onLeave();
        if (this._current < this._steps.length - 1) {
            this._current++;
            this._show(this._current);
        } else {
            this._finish();
        }
    },

    _prev() {
        if (this._current > 0) {
            this._current--;
            this._show(this._current);
        }
    },

    _finish() {
        localStorage.setItem(`tour_done_${this._tourId}`, '1');
        // Зберігаємо в БД — щоб на іншому пристрої тур не повторювався
        API.profiles.markTourDone(this._tourId).catch(() => {});
        this._destroy();
        if (this._onDone) this._onDone();
    },

    _destroy() {
        document.getElementById('tour-root')?.remove();
        if (this._cleanup) { this._cleanup(); this._cleanup = null; }
    },
};
