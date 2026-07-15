// ================================================================
// EduFlow LMS — Перевірка відкритих (text) питань тестів
// Вкладка для staff у «Моє навчання» → «Перевірка»
// ================================================================

const TestReviewPage = {
    _pending: [],

    async renderInTab(area) {
        area.innerHTML = `<div style="display:flex;justify-content:center;padding:3rem"><div class="spinner"></div></div>`;
        try {
            this._pending = await API.attempts.getPendingReview();
        } catch(e) {
            area.innerHTML = `<div class="ep-empty"><div class="ep-empty-icon"><i class="fa-solid fa-triangle-exclamation"></i></div><div class="ep-empty-title">${Fmt.esc(e.message)}</div></div>`;
            return;
        }

        if (!this._pending.length) {
            area.innerHTML = `
<div class="ep-empty">
    <div class="ep-empty-icon"><i class="fa-solid fa-clipboard-check"></i></div>
    <div class="ep-empty-title">Немає спроб на перевірці</div>
    <div class="ep-empty-sub">Тут з'являться тести з відкритими питаннями, які чекають на вашу оцінку</div>
</div>`;
            return;
        }

        area.innerHTML = `
<style>
.trv-grid{display:flex;flex-direction:column;gap:10px}
.trv-card{background:var(--bg-surface);border:1px solid var(--border);border-radius:14px;padding:14px 18px;display:flex;align-items:center;gap:14px}
.trv-icon{width:42px;height:42px;border-radius:12px;background:rgba(245,158,11,.14);color:#f59e0b;display:flex;align-items:center;justify-content:center;font-size:1.1rem;flex-shrink:0}
.trv-info{flex:1;min-width:0}
.trv-title{font-weight:700;font-size:.9rem;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.trv-meta{font-size:.78rem;color:var(--text-muted);margin-top:2px}
.trv-btn{padding:.55rem 1rem;border-radius:10px;border:none;background:var(--primary);color:#fff;font-weight:700;font-size:.82rem;cursor:pointer;white-space:nowrap;display:inline-flex;align-items:center;gap:6px}
.trv-btn:hover{opacity:.9}
</style>
<div class="trv-grid">
    ${this._pending.map((p, i) => `
    <div class="trv-card">
        <div class="trv-icon"><i class="fa-solid fa-hourglass-half"></i></div>
        <div class="trv-info">
            <div class="trv-title">${Fmt.esc(p.test?.title || 'Тест')}</div>
            <div class="trv-meta">${Fmt.esc(p.user?.full_name || '—')}${p.user?.job_position ? ' · ' + Fmt.esc(p.user.job_position) : ''} · здано ${Fmt.datetime(p.completed_at)}</div>
        </div>
        <button type="button" class="trv-btn" onclick="TestReviewPage._openGrading(${i})"><i class="fa-solid fa-pen"></i> Перевірити</button>
    </div>`).join('')}
</div>`;
    },

    async _openGrading(idx) {
        const p = this._pending[idx];
        if (!p) return;
        Loader.show();
        let answers = [];
        try { answers = await API.attempts.getTextAnswersForGrading(p.id); }
        catch(e) { Loader.hide(); Toast.error('Помилка', e.message); return; }
        Loader.hide();

        this._gradingAnswers = answers;
        this._gradingAttemptId = p.id;

        Modal.open({
            title: `Перевірка: ${Fmt.esc(p.test?.title || 'Тест')}`,
            size: 'lg',
            body: `
<style>
.trg-user{font-size:.85rem;color:var(--text-muted);margin-bottom:16px}
.trg-q{background:var(--bg-raised);border:1px solid var(--border);border-radius:14px;padding:16px;margin-bottom:12px}
.trg-q-text{font-weight:700;font-size:.9rem;color:var(--text-primary);margin-bottom:10px}
.trg-answer{background:var(--bg-surface);border:1px solid var(--border);border-radius:10px;padding:10px 12px;font-size:.86rem;color:var(--text-secondary);white-space:pre-line;margin-bottom:12px}
.trg-row{display:flex;align-items:center;gap:14px;flex-wrap:wrap}
.trg-toggle{display:flex;gap:6px}
.trg-tbtn{padding:.4rem .9rem;border-radius:9px;border:1.5px solid var(--border);background:transparent;font-size:.8rem;font-weight:700;cursor:pointer;color:var(--text-secondary)}
.trg-tbtn.correct.active{background:rgba(16,185,129,.14);border-color:var(--success);color:var(--success)}
.trg-tbtn.wrong.active{background:rgba(239,68,68,.1);border-color:var(--danger);color:var(--danger)}
.trg-pts{display:flex;align-items:center;gap:6px;font-size:.82rem;color:var(--text-muted);white-space:nowrap;flex-shrink:0}
.trg-pts select{padding:.35rem .5rem;border-radius:8px;border:1.5px solid var(--border);background:var(--bg-surface);color:var(--text-primary);font-size:.85rem;cursor:pointer;flex-shrink:0}
.trg-pts-max{white-space:nowrap}
.trg-comment{width:100%;margin-top:10px;padding:8px 10px;border-radius:8px;border:1.5px solid var(--border);background:var(--bg-surface);color:var(--text-primary);font-size:.83rem;font-family:inherit;resize:vertical;min-height:44px}
.trg-comment:focus{border-color:var(--primary);outline:none}
.trg-comment-label{font-size:.72rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:.04em;margin-top:10px;display:block}
</style>
<div class="trg-user"><i class="fa-regular fa-circle-user"></i> ${Fmt.esc(p.user?.full_name || '—')}</div>
${answers.map((a, i) => `
<div class="trg-q" id="trg-q-${i}" data-correct="${a.is_correct === true ? '1' : a.is_correct === false ? '0' : ''}">
    <div class="trg-q-text">${i + 1}. ${Fmt.esc(this._stripHtml(a.question?.question_text || ''))}</div>
    <div class="trg-answer">${Fmt.esc(a.answer_text || '(без відповіді)')}</div>
    <div class="trg-row">
        <div class="trg-toggle">
            <button type="button" class="trg-tbtn correct${a.is_correct === true ? ' active' : ''}" onclick="TestReviewPage._setCorrect(${i},true,this)"><i class="fa-solid fa-check"></i> Зараховано</button>
            <button type="button" class="trg-tbtn wrong${a.is_correct === false ? ' active' : ''}" onclick="TestReviewPage._setCorrect(${i},false,this)"><i class="fa-solid fa-xmark"></i> Не зараховано</button>
        </div>
        <div class="trg-pts">
            <span>Бали:</span>
            <select id="trg-pts-${i}" data-max="${a.question?.points || 0}">${this._ptsOptionsHtml(a.question?.points || 0, a.points_earned ?? (a.is_correct ? (a.question?.points || 0) : 0))}</select>
            <span class="trg-pts-max">з ${a.question?.points || 0}</span>
        </div>
    </div>
    <label class="trg-comment-label" for="trg-comment-${i}">Коментар для співробітника (необов'язково)</label>
    <textarea class="trg-comment" id="trg-comment-${i}" placeholder="Що можна покращити у відповіді...">${Fmt.esc(a.review_comment || '')}</textarea>
</div>`).join('')}`,
            footer: `
<button class="btn btn-secondary" onclick="Modal.close()">Скасувати</button>
<button class="btn btn-primary" onclick="TestReviewPage._saveGrading()"><i class="fa-solid fa-check"></i> Зберегти оцінку</button>`
        });
    },

    _setCorrect(i, correct, btn) {
        const wrap = document.getElementById(`trg-q-${i}`);
        wrap?.querySelectorAll('.trg-tbtn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const ptsInput = document.getElementById(`trg-pts-${i}`);
        if (ptsInput && correct && Number(ptsInput.value) === 0) {
            ptsInput.value = Number(ptsInput.dataset.max) || 0;
        }
        if (ptsInput && !correct) ptsInput.value = 0;
        wrap?.dataset && (wrap.dataset.correct = correct ? '1' : '0');
    },

    async _saveGrading() {
        const answers = this._gradingAnswers || [];
        const grades = answers.map((a, i) => {
            const wrap = document.getElementById(`trg-q-${i}`);
            const raw = wrap?.dataset?.correct;
            const isCorrect = raw === '1' ? true : raw === '0' ? false : null;
            const ptsInput = document.getElementById(`trg-pts-${i}`);
            const pointsEarned = ptsInput ? Math.max(0, Math.min(Number(ptsInput.value) || 0, a.question?.points || 0)) : 0;
            const comment = document.getElementById(`trg-comment-${i}`)?.value.trim() || '';
            return { answerId: a.id, isCorrect, pointsEarned, comment };
        });
        if (grades.some(g => g.isCorrect === null)) {
            Toast.warning('Позначте кожну відповідь як зараховану або незараховану'); return;
        }
        Loader.show();
        try {
            await API.attempts.gradeTextAnswers(this._gradingAttemptId, grades);
            Toast.success('Оцінку збережено');
            Modal.close();
            const area = document.getElementById('ep-content');
            if (area) await this.renderInTab(area);
            ExpertPathPage._fetchAndShowCounts?.();
        } catch(e) { Toast.error('Помилка', e.message); }
        finally { Loader.hide(); }
    },

    _ptsOptionsHtml(max, selected) {
        const opts = [];
        for (let v = 0; v <= max + 1e-9; v += 0.5) opts.push(Math.round(v * 2) / 2);
        if (!opts.length) opts.push(0);
        const sel = Math.round((Number(selected) || 0) * 2) / 2;
        return opts.map(v => `<option value="${v}"${v === sel ? ' selected' : ''}>${v}</option>`).join('');
    },

    _stripHtml(html) {
        const d = document.createElement('div');
        d.innerHTML = html || '';
        return d.textContent || '';
    }
};
