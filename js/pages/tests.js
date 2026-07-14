
// ================================================================
// EduFlow LMS — Тести (проходження + управління)
// ================================================================

const TestsPage = {
    _test:          null,
    _attempt:       null,
    _answers:       {},
    _textAnswers:   {},
    _flaggedSet:    null,
    _lockedSet:     null,
    _startTime:     null,
    _timer:         null,
    _curQIdx:       0,

    async init(container, params) {
        const testId = params.id;
        this._from   = params.from || null;
        UI.setBreadcrumb([{ label: 'Тест' }]);
        container.innerHTML = `<div style="display:flex;justify-content:center;padding:3rem"><div class="spinner"></div></div>`;

        try {
            const test = await API.tests.getById(testId);
            this._test = test;
            RecentlyViewed.track({ type: 'test', id: test.id, title: test.title, thumbnail: null, route: `tests/${test.id}`, color: '#f59e0b', icon: 'fa-file-pen' });
            ActivityTracker.track('test_start', { entity_type: 'test', entity_id: test.id, entity_title: test.title, page: `tests/${test.id}` });

            if (this._from === 'expert-path') {
                UI.setBreadcrumb([
                    { label: 'Моє навчання', route: 'expert-path' },
                    { label: test.title }
                ]);
            } else {
                UI.setBreadcrumb([
                    { label: 'Курси', route: 'courses' },
                    { label: test.course?.title || 'Курс', route: `courses/${test.course_id}` },
                    { label: test.title }
                ]);
            }

            const [attempts, myGrants] = await Promise.all([
                API.attempts.getByTest(testId),
                API.attempts.getMyGrants(testId).catch(() => 0)
            ]);
            const best          = attempts.reduce((b,a) => (!b || (a.percentage||0) > (b.percentage||0)) ? a : b, null);
            const attemptsLeft  = test.max_attempts ? (test.max_attempts + myGrants) - attempts.filter(a => a.completed_at).length : null;

            this._renderIntro(container, test, attempts, best, attemptsLeft);
        } catch(e) {
            container.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><h3>${e.message}</h3></div>`;
        }
    },

    _renderIntro(container, test, attempts, best, attemptsLeft) {
        const canAttempt        = attemptsLeft === null || attemptsLeft > 0;
        const completedAttempts = attempts.filter(a => a.completed_at);
        const saved             = this._loadSavedProgress();

        container.innerHTML = `
            <style>
                .btn-tight{padding:.55rem .8rem;font-size:.8rem;border-radius:8px}
                .btn-primary.btn-tight{border:1px solid transparent}
                .ti-wrap{max-width:1100px}
                .ti-header{display:flex;flex-direction:column;align-items:flex-start;gap:.6rem;margin-bottom:20px}
                .ti-title{margin:0;font-size:1.25rem;font-weight:800;display:flex;align-items:center;gap:12px;letter-spacing:-.01em}
                .ti-title-ico{
                    width:42px;height:42px;border-radius:13px;flex-shrink:0;
                    background:linear-gradient(145deg,var(--primary),var(--secondary));
                    color:#fff;display:flex;align-items:center;justify-content:center;font-size:1.1rem;
                    box-shadow:0 5px 16px color-mix(in srgb,var(--primary) 45%,transparent),inset 0 1px 0 rgba(255,255,255,.35)
                }

                .ti-stats{
                    display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;
                    width:270px;aspect-ratio:1;margin:0 auto 20px;
                    background:var(--bg-surface);border:1px solid var(--border);border-radius:20px;
                    overflow:hidden;box-shadow:0 16px 36px -18px rgba(0,0,0,.22),0 2px 8px rgba(0,0,0,.05)
                }
                .ti-stat{
                    display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:10px
                }
                .ti-stat:nth-child(1),.ti-stat:nth-child(2){border-bottom:1px solid var(--border)}
                .ti-stat:nth-child(odd){border-right:1px solid var(--border)}
                .ti-stat-icon{
                    width:34px;height:34px;border-radius:10px;flex-shrink:0;
                    display:flex;align-items:center;justify-content:center;font-size:.9rem;
                    background:color-mix(in srgb,var(--ti-accent) 14%,transparent);color:var(--ti-accent)
                }
                .ti-stat-val{font-size:1.5rem;font-weight:800;color:var(--text-primary);line-height:1.1;letter-spacing:-.02em}
                .ti-stat-lbl{font-size:.62rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted)}

                .ti-best{
                    display:flex;width:fit-content;max-width:100%;align-items:center;gap:.75rem;
                    padding:14px 20px;border-radius:16px;margin-bottom:16px;
                    box-shadow:0 8px 22px -8px rgba(0,0,0,.18),inset 0 1px 0 rgba(255,255,255,.4)
                }
                .ti-best-ico{
                    width:34px;height:34px;border-radius:50%;flex-shrink:0;
                    display:flex;align-items:center;justify-content:center;font-size:1rem;
                    box-shadow:inset 0 1px 0 rgba(255,255,255,.5)
                }

                .ti-cta{box-shadow:0 10px 26px -6px color-mix(in srgb,var(--primary) 55%,transparent),inset 0 1px 0 rgba(255,255,255,.25)}

                @media(max-width:680px){
                    .ti-stats{width:220px}
                    .ti-stat-val{font-size:1.4rem}
                }
            </style>
            <div class="ti-wrap">
                <div class="ti-header">
                    <button class="btn btn-ghost btn-sm" onclick="Router.go('${this._from==='expert-path'?'expert-path':test.course_id?'courses/'+test.course_id:'dashboard'}')">
                        <i class="fa-solid fa-arrow-left"></i> Назад
                    </button>
                    <h2 class="ti-title"><span class="ti-title-ico"><i class="fa-solid fa-file-pen"></i></span>${test.title}</h2>
                </div>
                <div>
                        ${test.description ? `<p style="color:var(--text-secondary);margin-bottom:1.5rem">${test.description}</p>` : ''}
                        ${test.instructions ? `
                            <div style="background:var(--bg-raised);border:1px solid var(--border);border-radius:var(--radius-md);padding:1rem;margin-bottom:1.5rem">
                                <div style="font-weight:600;margin-bottom:.35rem"><i class="fa-solid fa-circle-info" style="color:var(--primary)"></i> Інструкції</div>
                                <span style="color:var(--text-secondary);font-size:.9rem">${test.instructions}</span>
                            </div>` : ''}

                        <div class="ti-stats">
                            ${[
                                { icon:'fa-question',    label:'Запитань',         value: test.questions?.length || 0,                                          accent:'#6366f1' },
                                { icon:'fa-bullseye',    label:'Прохідний бал',    value: test.passing_score + '%',                                             accent:'#3b82f6' },
                                { icon:'fa-rotate-right',label:'Спроб залишилось', value: attemptsLeft === null ? '∞' : attemptsLeft,                           accent: canAttempt ? '#10b981' : '#ef4444' },
                                { icon:'fa-clock',       label:'Час',              value: test.time_limit_minutes ? test.time_limit_minutes + ' хв' : 'Без ліміту', accent:'#f59e0b' }
                            ].map(s => `
                                <div class="ti-stat" style="--ti-accent:${s.accent}">
                                    <div class="ti-stat-icon"><i class="fa-solid ${s.icon}"></i></div>
                                    <div class="ti-stat-val">${s.value}</div>
                                    <div class="ti-stat-lbl">${s.label}</div>
                                </div>`).join('')}
                        </div>

                        ${best ? `
                            <div class="ti-best" style="border:1px solid ${best.passed ? 'rgba(16,185,129,.3)' : 'rgba(239,68,68,.3)'};background:${best.passed ? 'linear-gradient(135deg,rgba(16,185,129,.1),rgba(16,185,129,.03))' : 'linear-gradient(135deg,rgba(239,68,68,.1),rgba(239,68,68,.03))'}">
                                <div class="ti-best-ico" style="background:${best.passed ? 'rgba(16,185,129,.16)' : 'rgba(239,68,68,.14)'};color:${best.passed ? 'var(--success)' : 'var(--danger)'}">
                                    <i class="fa-solid ${best.passed ? 'fa-trophy' : 'fa-circle-exclamation'}"></i>
                                </div>
                                <span style="color:var(--text-muted);font-size:.875rem">Ваш найкращий результат:</span>
                                <span style="font-size:1.2rem;font-weight:700;color:${best.passed ? 'var(--success)' : 'var(--danger)'}">${Math.round(best.percentage||0)}%</span>
                                <span class="badge ${best.passed ? 'badge-success' : 'badge-danger'}">${best.passed ? 'Зараховано' : 'Не зараховано'}</span>
                            </div>` : ''}

                        ${canAttempt
                            ? saved
                                ? `<div style="display:flex;align-items:center;gap:.75rem;flex-wrap:wrap;margin-bottom:1.5rem">
                                       <button class="btn btn-primary btn-tight ti-cta" onclick="TestsPage.startTest(true)">
                                           <i class="fa-solid fa-play"></i> Продовжити (${(saved.curQIdx ?? 0) + 1}/${(saved.questionOrder||[]).length})
                                       </button>
                                       ${test.allow_restart ? `<button class="btn btn-ghost btn-sm" onclick="TestsPage.startTest(false)">
                                           <i class="fa-solid fa-rotate-right"></i> Почати заново
                                       </button>` : ''}
                                   </div>`
                                : `<button class="btn btn-primary ti-cta" style="margin-bottom:1.5rem" onclick="TestsPage.startTest()">
                                       <i class="fa-solid fa-play"></i> Розпочати тест
                                   </button>`
                            : `<div style="display:inline-flex;padding:.75rem 1rem;border-radius:var(--radius-md);background:rgba(239,68,68,.06);border:1px solid rgba(239,68,68,.2);color:var(--danger);font-size:.875rem;margin-bottom:1.5rem">
                                   <i class="fa-solid fa-ban"></i>&nbsp; Ви вичерпали всі спроби для цього тесту
                               </div>`}

                        ${completedAttempts.length ? `
                            <details>
                                <summary style="cursor:pointer;color:var(--text-muted);font-size:.875rem">
                                    <i class="fa-solid fa-clock-rotate-left"></i> Історія спроб (${completedAttempts.length})
                                </summary>
                                <div class="table-wrapper" style="margin-top:.75rem">
                                    <table>
                                        <thead><tr><th>#</th><th>Дата</th><th>Результат</th><th>Час</th><th>Статус</th><th></th></tr></thead>
                                        <tbody>
                                            ${completedAttempts.map(a => `
                                                <tr>
                                                    <td>${a.attempt_number}</td>
                                                    <td style="color:var(--text-muted)">${Fmt.datetime(a.completed_at)}</td>
                                                    <td><strong>${Math.round(a.percentage||0)}%</strong></td>
                                                    <td style="color:var(--text-muted)">${a.time_spent_seconds ? Math.floor(a.time_spent_seconds/60)+' хв' : '—'}</td>
                                                    <td><span class="badge ${a.passed ? 'badge-success' : 'badge-danger'}">${a.passed ? 'Зараховано' : 'Не зараховано'}</span></td>
                                                    <td><button class="btn btn-ghost btn-sm" id="proto-btn-${a.id}" onclick="TestsPage.showAttemptProtocol('${a.id}', this)">
                                                        <i class="fa-solid fa-list-check"></i> Помилки
                                                    </button></td>
                                                </tr>`).join('')}
                                        </tbody>
                                    </table>
                                </div>
                            </details>
                            <div id="ti-protocol" style="margin-top:1rem"></div>` : ''}
                </div>
            </div>`;
    },

    async showAttemptProtocol(attemptId, btn) {
        const el = document.getElementById('ti-protocol');
        if (!el) return;

        // toggle: якщо цей же attempt вже відкритий — закрити
        if (el.dataset.attemptId === attemptId && el.innerHTML) {
            el.innerHTML = '';
            delete el.dataset.attemptId;
            if (btn) btn.classList.remove('active');
            return;
        }

        // зняти active з усіх кнопок протоколу
        document.querySelectorAll('[id^="proto-btn-"]').forEach(b => b.classList.remove('active'));
        if (btn) btn.classList.add('active');
        el.dataset.attemptId = attemptId;
        el.innerHTML = `<div style="display:flex;justify-content:center;padding:1.5rem"><div class="spinner"></div></div>`;

        try {
            const attemptAnswers = await API.attempts.getAnswers(attemptId);
            const ansMap = new Map(attemptAnswers.map(a => [a.question_id, a]));

            const wrong = (this._test.questions || []).filter(q => {
                if (q.question_type === 'text') return false;
                const aa = ansMap.get(q.id);
                return aa && (aa.selected_answer_ids?.length > 0) && !aa.is_correct;
            });

            if (!wrong.length) {
                el.innerHTML = `
                    <div style="padding:1rem 1.25rem;border-radius:var(--radius-md);border:1px solid rgba(16,185,129,.25);background:rgba(16,185,129,.06);display:flex;align-items:center;gap:.6rem">
                        <i class="fa-solid fa-circle-check" style="color:var(--success)"></i>
                        <span style="font-size:.875rem;color:var(--success);font-weight:600">Помилок немає — всі відповіді правильні</span>
                    </div>`;
                return;
            }

            const totalQ = (this._test.questions || []).filter(q => q.question_type !== 'text').length;

            el.innerHTML = `
                <div style="border:1px solid var(--border);border-radius:var(--radius-md);overflow:hidden">
                    <div style="display:flex;align-items:center;gap:.6rem;padding:.75rem 1rem;background:var(--bg-raised);border-bottom:1px solid var(--border)">
                        <i class="fa-solid fa-circle-xmark" style="color:var(--danger)"></i>
                        <span style="font-weight:700;font-size:.9rem">Протокол помилок</span>
                        <span style="font-size:.8rem;color:var(--text-muted);margin-left:auto">${wrong.length} з ${totalQ} питань</span>
                    </div>
                    <div style="padding:.875rem 1rem;display:flex;flex-direction:column;gap:.75rem">
                        ${wrong.map(q => {
                            const aa       = ansMap.get(q.id);
                            const selected = aa.selected_answer_ids || [];
                            const qNum     = (this._test.questions || []).indexOf(q) + 1;

                            const answersHtml = (q.answers || []).map(ans => {
                                const isSel  = selected.includes(ans.id);
                                const isCorr = ans.is_correct;
                                if (!isSel && !isCorr) return '';
                                const bg     = isCorr ? 'rgba(16,185,129,.1)'  : 'rgba(239,68,68,.08)';
                                const border = isCorr ? 'rgba(16,185,129,.3)'  : 'rgba(239,68,68,.25)';
                                const icon   = isCorr
                                    ? `<i class="fa-solid fa-check" style="color:var(--success);flex-shrink:0"></i>`
                                    : `<i class="fa-solid fa-xmark" style="color:var(--danger);flex-shrink:0"></i>`;
                                const note = isCorr && !isSel
                                    ? `<span style="font-size:.7rem;color:var(--success);opacity:.85;margin-left:.25rem">(правильна)</span>`
                                    : '';
                                return `<div style="display:flex;align-items:center;gap:.55rem;padding:.4rem .65rem;border-radius:6px;margin-bottom:.25rem;background:${bg};border:1px solid ${border};font-size:.85rem">
                                    ${icon}<span class="ql-snow">${ans.answer_text}${note}</span></div>`;
                            }).join('');

                            return `
                                <div style="border:1px solid var(--border);border-radius:var(--radius-sm);overflow:hidden">
                                    <div style="display:flex;gap:.6rem;align-items:baseline;padding:.6rem .875rem;background:var(--bg-raised);border-bottom:1px solid var(--border)">
                                        <span style="font-size:.7rem;font-weight:800;color:var(--danger);background:rgba(239,68,68,.1);border:1.5px solid rgba(239,68,68,.3);border-radius:5px;padding:.1rem .4rem;flex-shrink:0">✗ ${qNum}</span>
                                        <div style="font-size:.875rem;font-weight:600;line-height:1.45;color:var(--text-primary)" class="ql-snow">${q.question_text}</div>
                                    </div>
                                    <div style="padding:.65rem .875rem">${answersHtml}</div>
                                    ${q.explanation ? `<div style="padding:.4rem .875rem .7rem;font-size:.8rem;color:var(--text-secondary);border-top:1px dashed var(--border)">
                                        <i class="fa-solid fa-lightbulb" style="color:var(--warning)"></i> ${q.explanation}</div>` : ''}
                                </div>`;
                        }).join('')}
                    </div>
                </div>`;
        } catch(e) {
            el.innerHTML = `<div style="color:var(--danger);font-size:.875rem;padding:.5rem">${e.message}</div>`;
        }
    },

    // ── Progress persistence ──────────────────────────────────────────
    _progressKey() {
        return `lms_tp_${AppState.user.id}_${this._test.id}`;
    },
    _saveProgress() {
        try {
            localStorage.setItem(this._progressKey(), JSON.stringify({
                attemptId:    this._attempt.id,
                answers:      this._answers,
                textAnswers:  this._textAnswers,
                flaggedIds:   [...this._flaggedSet],
                lockedIds:    [...this._lockedSet],
                curQIdx:      this._curQIdx,
                startTime:    this._startTime,
                questionOrder: this._questions.map(q => q.id)
            }));
        } catch(e) {}
    },
    _clearProgress() {
        try { localStorage.removeItem(this._progressKey()); } catch(e) {}
    },
    _loadSavedProgress() {
        try {
            const raw = localStorage.getItem(this._progressKey());
            return raw ? JSON.parse(raw) : null;
        } catch(e) { return null; }
    },

    async startTest(resume = false) {
        Loader.show();
        try {
            if (resume) {
                const saved = this._loadSavedProgress();
                if (saved) {
                    this._attempt      = { id: saved.attemptId };
                    this._answers      = saved.answers      || {};
                    this._textAnswers  = saved.textAnswers  || {};
                    this._flaggedSet   = new Set(saved.flaggedIds   || []);
                    this._lockedSet    = new Set(saved.lockedIds    || []);
                    this._startTime    = saved.startTime    || Date.now();
                    const qMap         = new Map((this._test.questions || []).map(q => [q.id, q]));
                    this._questions    = (saved.questionOrder || []).map(id => qMap.get(id)).filter(Boolean);
                    const firstUnanswered = this._questions.findIndex(q => !this._isAnswered(q));
                    this._curQIdx      = firstUnanswered !== -1 ? firstUnanswered : (saved.curQIdx || 0);
                    this._renderTest();
                    if (this._test.time_limit_minutes) {
                        const elapsed   = Math.floor((Date.now() - this._startTime) / 1000);
                        const remaining = this._test.time_limit_minutes * 60 - elapsed;
                        if (remaining > 0) this._startTimer(remaining);
                        else               { Loader.hide(); this.submitTest(true); return; }
                    }
                    return;
                }
            }
            // Fresh start
            this._clearProgress();
            this._attempt      = await API.attempts.create(this._test.id);
            this._answers      = {};
            this._textAnswers  = {};
            this._flaggedSet   = new Set();
            this._lockedSet    = new Set();
            this._curQIdx      = 0;
            this._startTime    = Date.now();

            let questions = [...(this._test.questions || [])];
            if (this._test.randomize_questions) questions = this._shuffle(questions);
            this._questions = questions;

            this._renderTest();
            if (this._test.time_limit_minutes) this._startTimer(this._test.time_limit_minutes * 60);
        } catch(e) { Toast.error('Помилка', e.message); }
        finally { Loader.hide(); }
    },

    _shuffle(arr) {
        const a = [...arr];
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    },

    _renderTest() {
        const container = document.getElementById('page-content');
        const qs = this._questions;

        container.innerHTML = `
            <style>
                .btn-tight{padding:.55rem .8rem;font-size:.8rem;border-radius:8px}
                .btn-primary.btn-tight{border:1px solid transparent}
                .tt-wrap{max-width:1300px}
                .tt-topbar{
                    display:flex;align-items:stretch;gap:0;margin-bottom:20px;
                    background:var(--bg-surface);border:1px solid var(--border);border-radius:18px;overflow:hidden
                }
                .tt-top-left{flex:1;display:flex;align-items:center;gap:1.25rem;padding:16px 20px;min-width:0}
                .tt-top-title{font-size:.95rem;font-weight:700;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
                .tt-top-title b{font-weight:800}
                .tt-timer{display:flex;flex-direction:column;align-items:center;flex-shrink:0}
                .tt-timer-val{font-size:1rem;font-weight:800;color:var(--text-primary);display:flex;align-items:center;gap:.4rem}
                .tt-timer-lbl{font-size:.65rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:.03em}
                .tt-top-right{
                    flex:0 0 260px;padding:14px 20px;border-left:1px solid var(--border);
                    display:flex;flex-direction:column;justify-content:center;gap:8px
                }
                .tt-prog-head{display:flex;align-items:center;justify-content:space-between;font-size:.72rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.03em}
                .tt-prog-pct{color:var(--primary);font-weight:800}
                .tt-prog-bar{height:6px;background:var(--border);border-radius:3px;overflow:hidden}
                .tt-prog-fill{height:100%;background:linear-gradient(90deg,var(--primary),var(--secondary));border-radius:3px;transition:width .35s}

                .tt-body{display:grid;grid-template-columns:1fr 300px;gap:20px;align-items:start}
                .tt-main{background:var(--bg-surface);border:1px solid var(--border);border-radius:18px;padding:22px 24px}
                .tt-qhead{display:flex;align-items:center;gap:.6rem;margin-bottom:1.1rem;flex-wrap:wrap}
                .tt-qnum{font-size:.85rem;font-weight:700;color:var(--text-primary)}
                .tt-qpoints{font-size:.72rem;font-weight:700;color:var(--warning);background:rgba(245,158,11,.1);border:1px solid rgba(245,158,11,.25);border-radius:20px;padding:.15rem .6rem}
                .tt-flag-btn{margin-left:auto}
                .tt-flag-btn:hover{border-color:var(--warning);color:var(--warning)}
                .tt-flag-btn.on{background:rgba(245,158,11,.12);border-color:var(--warning);color:var(--warning)}

                .tt-qtext{
                    font-size:1.05rem;font-weight:500;line-height:1.65;color:var(--text-primary);
                    display:flow-root;padding:14px 16px;border-radius:12px;
                    background:color-mix(in srgb,#3b82f6 9%,var(--bg-surface))
                }
                .tt-qtext p{margin:0;padding:0}
                .tt-qtext img{max-width:100%;height:auto;border-radius:4px}
                .tt-divider{height:1px;background:var(--border);margin:1.2rem 0}
                .tt-answer{
                    display:flex;align-items:center;gap:.85rem;padding:.85rem 1rem;
                    border-radius:14px;border:1.5px solid var(--border);
                    background:color-mix(in srgb,#eab308 10%,var(--bg-surface));
                    cursor:pointer;transition:all .15s;margin-bottom:.55rem;user-select:none
                }
                .tt-answer:hover{border-color:color-mix(in srgb,var(--warning) 45%,var(--border))}
                .tt-answer.selected{background:color-mix(in srgb,var(--warning) 20%,var(--bg-surface));border-color:var(--warning)}
                .tt-answer.locked{cursor:default}
                .tt-answer.locked:hover{border-color:var(--border)}
                .tt-answer.locked.selected:hover{border-color:var(--warning)}
                .tt-answer input{display:none}
                .tt-marker{width:20px;height:20px;border-radius:50%;border:2px solid var(--border-light,#CBD5E1);flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:.55rem;color:#fff;transition:all .12s}
                .tt-answer.selected .tt-marker{background:var(--warning);border-color:var(--warning)}
                .tt-marker-sq{border-radius:6px}
                .tt-atext{font-size:.93rem;line-height:1.4;color:var(--text-primary);flex:1;min-width:0;display:flow-root}
                .tt-atext p{margin:0;padding:0}
                .tt-atext img{max-width:100%;height:auto;border-radius:4px}
                .tt-textarea{width:100%;resize:vertical;padding:.75rem;border-radius:var(--radius-md);border:1.5px solid var(--border);background:var(--bg-raised);color:var(--text-primary);font-size:.93rem;box-sizing:border-box;transition:border-color .15s;font-family:inherit}
                .tt-textarea:focus{outline:none;border-color:var(--primary)}
                .tt-textarea:read-only{opacity:.7;cursor:default}
                .tt-confirm-row{display:flex;justify-content:flex-end;margin-top:1rem}
                #tt-btn-confirm:disabled{opacity:.45;cursor:not-allowed}
                .tt-confirmed{
                    display:inline-flex;align-items:center;gap:.4rem;font-size:.82rem;font-weight:700;
                    color:var(--success);background:rgba(16,185,129,.1);border:1.5px solid rgba(16,185,129,.3);
                    border-radius:10px;padding:.4rem .8rem
                }
                .tt-confirmed.wrong{color:var(--danger);background:rgba(239,68,68,.1);border-color:rgba(239,68,68,.3)}
                .tt-fb-wrap{display:flex;flex-direction:column;align-items:flex-end;gap:.5rem;max-width:100%}
                .tt-explanation{
                    font-size:.82rem;color:var(--text-secondary);line-height:1.5;
                    background:var(--bg-raised);border-radius:10px;padding:.6rem .8rem;text-align:left
                }
                .tt-answer.correct{border-color:var(--success);background:color-mix(in srgb,var(--success) 16%,var(--bg-surface))}
                .tt-answer.correct .tt-marker{background:var(--success);border-color:var(--success)}
                .tt-answer.wrong{border-color:var(--danger);background:color-mix(in srgb,var(--danger) 14%,var(--bg-surface))}
                .tt-answer.wrong .tt-marker{background:var(--danger);border-color:var(--danger)}

                .tt-navrow{display:flex;align-items:center;justify-content:space-between;gap:1rem;margin-top:1.5rem;padding-top:1rem;border-top:1px solid var(--border)}

                .tt-side{background:var(--bg-surface);border:1px solid var(--border);border-radius:18px;padding:18px 20px;position:sticky;top:16px}
                .tt-side-title{font-size:.85rem;font-weight:700;color:var(--text-primary);margin-bottom:.9rem}
                .tt-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-bottom:1rem}
                .tt-gitem{
                    position:relative;aspect-ratio:1;border-radius:10px;border:1.5px solid var(--border);
                    background:var(--bg-raised);color:var(--text-secondary);font-size:.8rem;font-weight:700;
                    display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .15s
                }
                .tt-gitem:hover{border-color:var(--primary)}
                .tt-gitem.nonav{cursor:default}
                .tt-gitem.nonav:hover{border-color:var(--border)}
                .tt-gitem.nonav.current:hover{border-color:var(--primary)}
                .tt-gitem.answered{background:rgba(16,185,129,.12);border-color:rgba(16,185,129,.4);color:var(--success)}
                .tt-gitem.current{background:var(--primary);border-color:var(--primary);color:#fff}
                .tt-gitem.flagged::after{
                    content:'';position:absolute;top:-3px;right:-3px;width:9px;height:9px;
                    border-radius:50%;background:var(--warning);border:1.5px solid var(--bg-surface)
                }
                .tt-legend{display:flex;flex-direction:column;gap:.45rem}
                .tt-legend-item{display:flex;align-items:center;gap:.5rem;font-size:.76rem;color:var(--text-muted)}
                .tt-legend-dot{width:9px;height:9px;border-radius:50%;flex-shrink:0}

                @keyframes tt-in{from{opacity:0;transform:translateX(14px)}to{opacity:1;transform:translateX(0)}}
                .tt-anim{animation:tt-in .18s ease}

                @media(max-width:900px){
                    .tt-body{grid-template-columns:1fr}
                    .tt-side{position:static;order:-1}
                    .tt-topbar{flex-direction:column}
                    .tt-top-right{flex:none;border-left:none;border-top:1px solid var(--border)}
                }
            </style>

            <div class="tt-wrap" id="test-taking">
                <div class="tt-topbar">
                    <div class="tt-top-left">
                        <div class="tt-top-title">Тест: <b>${Fmt.esc(this._test.title)}</b></div>
                        ${this._test.time_limit_minutes ? `
                            <div class="tt-timer">
                                <div class="tt-timer-val" id="timer"><i class="fa-regular fa-clock"></i> --:--</div>
                                <div class="tt-timer-lbl">Залишилось часу</div>
                            </div>` : ''}
                        <button class="btn btn-secondary btn-tight" onclick="TestsPage.submitTest()" style="margin-left:auto;flex-shrink:0">
                            <i class="fa-solid fa-flag-checkered"></i> Завершити тест
                        </button>
                    </div>
                    <div class="tt-top-right">
                        <div class="tt-prog-head"><span>Прогрес тесту</span><span class="tt-prog-pct" id="tt-prog-pct">0%</span></div>
                        <div class="tt-prog-bar"><div class="tt-prog-fill" id="tt-prog-fill" style="width:0%"></div></div>
                    </div>
                </div>

                <div class="tt-body">
                    <div class="tt-main">
                        <div id="tt-question-area"></div>
                        ${this._test.allow_skip ? `
                        <div class="tt-navrow">
                            <button class="btn btn-ghost btn-tight" id="tt-btn-prev" onclick="TestsPage._prevQuestion()">
                                <i class="fa-solid fa-arrow-left"></i> Попереднє питання
                            </button>
                            <button class="btn btn-primary btn-tight" id="tt-btn-next" onclick="TestsPage._nextQuestion()">
                                Наступне питання <i class="fa-solid fa-arrow-right"></i>
                            </button>
                        </div>` : ''}
                    </div>
                    <div class="tt-side">
                        <div class="tt-side-title">Питання</div>
                        <div class="tt-grid" id="tt-grid"></div>
                        <div class="tt-legend">
                            <div class="tt-legend-item"><span class="tt-legend-dot" style="background:var(--success)"></span> Відповідь зафіксовано</div>
                            <div class="tt-legend-item"><span class="tt-legend-dot" style="background:var(--primary)"></span> Поточне</div>
                            <div class="tt-legend-item"><span class="tt-legend-dot" style="background:var(--border-light,#CBD5E1)"></span> Без відповіді</div>
                        </div>
                    </div>
                </div>
            </div>`;

        this._renderGrid();
        this._showQuestion(this._curQIdx);
    },

    _isAnswered(q) {
        return q.question_type === 'text'
            ? !!(this._textAnswers[q.id] || '').trim()
            : (this._answers[q.id] || []).length > 0;
    },

    _renderGrid() {
        const grid = document.getElementById('tt-grid');
        if (!grid) return;
        const locked = !this._test.allow_skip;
        grid.innerHTML = this._questions.map((q, i) => {
            const cls = [
                i === this._curQIdx ? 'current' : this._isAnswered(q) ? 'answered' : '',
                this._flaggedSet.has(q.id) ? 'flagged' : '',
                locked ? 'nonav' : ''
            ].filter(Boolean).join(' ');
            return `<div class="tt-gitem ${cls}" ${locked ? '' : `onclick="TestsPage._gotoQuestion(${i})"`}>${i + 1}</div>`;
        }).join('');
    },

    _blockedBySkip(idx) {
        if (this._test.allow_skip) return false;
        return idx !== this._curQIdx;
    },

    _gotoQuestion(idx) {
        if (this._blockedBySkip(idx)) {
            Toast.warning('Дайте відповідь', 'Спочатку дайте відповідь на поточне питання — пропуск питань вимкнено');
            return;
        }
        this._saveProgress();
        this._showQuestion(idx);
    },

    _showQuestion(idx) {
        const questions = this._questions;
        if (idx < 0 || idx >= questions.length) return;
        this._curQIdx = idx;
        this._updateProgress();
        this._renderGrid();

        const q          = questions[idx];
        const isMultiple = q.question_type === 'multiple';
        const isText     = q.question_type === 'text';
        const selected   = this._answers[q.id] || [];
        const textVal    = this._textAnswers[q.id] || '';
        const isLocked   = this._lockedSet.has(q.id);
        const showFb     = isLocked && this._test.show_answer_feedback && !isText;
        const correctIds = showFb ? (q.answers || []).filter(a => a.is_correct).map(a => a.id) : [];
        const isCorrect   = showFb
            ? (isMultiple
                ? correctIds.length === selected.length && correctIds.every(id => selected.includes(id))
                : selected.length === 1 && correctIds.includes(selected[0]))
            : null;

        let answersHtml;
        if (isText) {
            answersHtml = `<textarea class="tt-textarea" rows="4" placeholder="Введіть відповідь..." ${isLocked ? 'readonly' : ''}
                oninput="TestsPage._onTextAnswer('${q.id}',this.value)">${textVal}</textarea>`;
        } else {
            answersHtml = (q.answers || []).map(a => {
                const isSel = selected.includes(a.id);
                const icon  = isSel ? (isMultiple ? '<i class="fa-solid fa-check"></i>' : '<i class="fa-solid fa-circle" style="font-size:.4rem"></i>') : '';
                let fbClass = '';
                if (showFb) {
                    if (a.is_correct)      fbClass = ' correct';
                    else if (isSel)        fbClass = ' wrong';
                }
                return `
                    <label class="tt-answer${isSel ? ' selected' : ''}${isLocked ? ' locked' : ''}${fbClass}" ${isLocked ? '' : `onclick="if(event.target.tagName==='INPUT')return; TestsPage.onAnswer('${q.id}','${a.id}',${isMultiple})"`}>
                        <input type="${isMultiple ? 'checkbox' : 'radio'}" name="q-${q.id}" value="${a.id}" ${isSel ? 'checked' : ''} ${isLocked ? 'disabled' : ''}>
                        <div class="tt-marker${isMultiple ? ' tt-marker-sq' : ''}">${icon}</div>
                        <div class="tt-atext">${a.answer_text}</div>
                    </label>`;
            }).join('');
        }

        const pointsBadge = `<span class="tt-qpoints"><i class="fa-solid fa-star"></i> ${q.points} бал${q.points===1?'':q.points<5?'и':'ів'}</span>`;
        const isFlagged    = this._flaggedSet.has(q.id);
        let confirmHtml;
        if (isLocked) {
            if (showFb) {
                confirmHtml = `<div class="tt-fb-wrap">
                    <div class="tt-confirmed${isCorrect ? '' : ' wrong'}"><i class="fa-solid fa-${isCorrect ? 'circle-check' : 'circle-xmark'}"></i> ${isCorrect ? 'Правильно!' : 'Неправильно'}</div>
                    ${q.explanation ? `<div class="tt-explanation"><i class="fa-solid fa-lightbulb"></i> ${q.explanation}</div>` : ''}
                </div>`;
            } else {
                confirmHtml = `<div class="tt-confirmed"><i class="fa-solid fa-lock"></i> Відповідь підтверджена</div>`;
            }
        } else {
            confirmHtml = `<button class="btn btn-primary btn-tight" id="tt-btn-confirm" ${this._isAnswered(q) ? '' : 'disabled'} onclick="TestsPage._confirmAnswer('${q.id}')">
                   <i class="fa-solid fa-check"></i> Підтвердити відповідь
               </button>`;
        }

        const area = document.getElementById('tt-question-area');
        if (!area) return;
        area.classList.remove('tt-anim');
        void area.offsetWidth;
        area.classList.add('tt-anim');
        area.innerHTML = `
            <div class="tt-qhead">
                <span class="tt-qnum">Питання ${idx + 1} з ${questions.length}</span>
                ${pointsBadge}
                <button class="btn btn-ghost btn-sm tt-flag-btn${isFlagged ? ' on' : ''}" onclick="TestsPage._toggleFlag('${q.id}')">
                    <i class="fa-${isFlagged ? 'solid' : 'regular'} fa-flag"></i> Позначити
                </button>
            </div>
            <div class="tt-qtext ql-snow">${q.question_text}</div>
            <div class="tt-divider"></div>
            <div class="ql-snow">${answersHtml}</div>
            <div class="tt-confirm-row">${confirmHtml}</div>`;

        const prev = document.getElementById('tt-btn-prev');
        const next = document.getElementById('tt-btn-next');
        if (prev) prev.style.visibility = idx === 0 ? 'hidden' : 'visible';
        if (next) {
            const skipBlocked = !this._test.allow_skip && !isLocked;
            next.style.visibility = (idx === questions.length - 1 || skipBlocked) ? 'hidden' : 'visible';
            next.disabled = skipBlocked;
        }
    },

    _toggleFlag(qId) {
        if (this._flaggedSet.has(qId)) this._flaggedSet.delete(qId);
        else                            this._flaggedSet.add(qId);
        this._saveProgress();
        this._renderGrid();
        const btn = document.querySelector('.tt-flag-btn');
        if (btn) {
            const on = this._flaggedSet.has(qId);
            btn.classList.toggle('on', on);
            btn.innerHTML = `<i class="fa-${on ? 'solid' : 'regular'} fa-flag"></i> Позначити`;
        }
    },

    onAnswer(questionId, answerId, isMultiple) {
        if (isMultiple) {
            if (!this._answers[questionId]) this._answers[questionId] = [];
            const pos = this._answers[questionId].indexOf(answerId);
            if (pos > -1) this._answers[questionId].splice(pos, 1);
            else          this._answers[questionId].push(answerId);
        } else {
            this._answers[questionId] = [answerId];
        }

        const selected = this._answers[questionId] || [];
        document.querySelectorAll('.tt-answer').forEach(label => {
            const input  = label.querySelector('input');
            const marker = label.querySelector('.tt-marker');
            if (!input || !marker) return;
            const isSel = selected.includes(input.value);
            label.classList.toggle('selected', isSel);
            marker.innerHTML = isSel
                ? (isMultiple ? '<i class="fa-solid fa-check"></i>' : '<i class="fa-solid fa-circle" style="font-size:.4rem"></i>')
                : '';
        });

        this._updateProgress();
        this._renderGrid();
        this._updateConfirmBtn(this._questions.find(q => q.id === questionId));
        this._saveProgress();
    },

    _onTextAnswer(qId, val) {
        if (val.trim()) this._textAnswers[qId] = val;
        else            delete this._textAnswers[qId];
        this._updateProgress();
        this._renderGrid();
        this._updateConfirmBtn(this._questions.find(q => q.id === qId));
        this._saveProgress();
    },

    _updateConfirmBtn(q) {
        const btn = document.getElementById('tt-btn-confirm');
        if (btn && q) btn.disabled = !this._isAnswered(q);
        const next = document.getElementById('tt-btn-next');
        if (next && q) {
            const skipBlocked = !this._test.allow_skip && !this._lockedSet.has(q.id);
            const isLast = this._curQIdx === this._questions.length - 1;
            next.disabled = skipBlocked;
            next.style.visibility = (isLast || skipBlocked) ? 'hidden' : 'visible';
        }
    },

    _confirmAnswer(qId) {
        const q = this._questions.find(qq => qq.id === qId);
        if (!q || !this._isAnswered(q)) return;
        this._lockedSet.add(qId);
        this._saveProgress();
        if (!this._test.allow_skip && this._curQIdx < this._questions.length - 1) {
            this._showQuestion(this._curQIdx + 1);
        } else {
            this._showQuestion(this._curQIdx);
        }
    },

    _nextQuestion() {
        if (this._blockedBySkip(this._curQIdx + 1)) {
            Toast.warning('Дайте відповідь', 'Спочатку дайте відповідь на поточне питання — пропуск питань вимкнено');
            return;
        }
        if (this._curQIdx < this._questions.length - 1) { this._saveProgress(); this._showQuestion(this._curQIdx + 1); }
    },

    _prevQuestion() {
        if (this._curQIdx > 0) { this._saveProgress(); this._showQuestion(this._curQIdx - 1); }
    },

    _updateProgress() {
        const total    = this._questions.length;
        const answered = this._questions.filter(q => this._isAnswered(q)).length;
        const pct      = total ? Math.round(answered / total * 100) : 0;
        const fill = document.getElementById('tt-prog-fill');
        const text = document.getElementById('tt-prog-pct');
        if (fill) fill.style.width = pct + '%';
        if (text) text.textContent = pct + '%';
    },

    _startTimer(seconds) {
        clearInterval(this._timer);
        let remaining = seconds;
        const update  = () => {
            const el = document.getElementById('timer');
            if (!el)  { clearInterval(this._timer); return; }
            const m = Math.floor(remaining / 60), s = remaining % 60;
            const mm = String(m).padStart(2,'0'), ss = String(s).padStart(2,'0');
            el.innerHTML = `<i class="fa-solid fa-clock"></i> ${mm}:${ss}`;
            if (remaining <= 300) el.style.color = 'var(--warning)';
            if (remaining <= 60)  el.style.color = 'var(--danger)';
            if (remaining <= 0)   { clearInterval(this._timer); this.submitTest(true); return; }
            remaining--;
        };
        update();
        this._timer = setInterval(update, 1000);
    },

    async submitTest(isTimeout = false) {
        clearInterval(this._timer);

        if (!isTimeout) {
            const answered = this._questions.filter(q => this._isAnswered(q)).length;
            const total    = this._questions.length;
            if (answered < total) {
                const ok = await Modal.confirm({
                    title: 'Завершити тест?',
                    message: `Ви відповіли на ${answered} з ${total} запитань. Решта будуть зараховані як неправильні.`,
                    confirmText: 'Завершити'
                });
                if (!ok) return;
            }
        }

        Loader.show();
        try {
            const timeSpent = Math.floor((Date.now() - this._startTime) / 1000);
            const result    = this._grade();
            await API.attempts.complete(this._attempt.id, {
                score: result.score, maxScore: result.maxScore,
                percentage: result.percentage, passed: result.passed,
                timeSpent, answers: result.answers
            });
            this._clearProgress();
            ActivityTracker.track('test_complete', { entity_type: 'test', entity_id: this._test.id, entity_title: this._test.title, page: `tests/${this._test.id}`, details: { score: Math.round(result.percentage), passed: result.passed } });
            this._renderResult(result, timeSpent);
        } catch(e) { Toast.error('Помилка', e.message); }
        finally { Loader.hide(); }
    },

    _grade() {
        let score = 0, maxScore = 0;
        const answers = [];
        for (const q of this._questions) {
            maxScore += q.points;
            if (q.question_type === 'text') {
                const textAnswer = this._textAnswers[q.id] || '';
                const isCorrect  = !!textAnswer.trim();
                const pointsEarned = isCorrect ? q.points : 0;
                score += pointsEarned;
                answers.push({ questionId: q.id, selectedIds: [], textAnswer, isCorrect, pointsEarned });
                continue;
            }
            const correctIds  = (q.answers || []).filter(a => a.is_correct).map(a => a.id);
            const selectedIds = this._answers[q.id] || [];
            const isCorrect = q.question_type === 'multiple'
                ? correctIds.length === selectedIds.length && correctIds.every(id => selectedIds.includes(id))
                : selectedIds.length === 1 && correctIds.includes(selectedIds[0]);
            const pointsEarned = isCorrect ? q.points : 0;
            score += pointsEarned;
            answers.push({ questionId: q.id, selectedIds, isCorrect, pointsEarned });
        }
        const percentage = maxScore > 0 ? (score / maxScore * 100) : 0;
        const passed     = percentage >= this._test.passing_score;
        return { score, maxScore, percentage, passed, answers };
    },

    _fmtHMS(sec) {
        const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = Math.floor(sec % 60);
        const pad = n => String(n).padStart(2, '0');
        return `${pad(h)}:${pad(m)}:${pad(s)}`;
    },

    _stripHtml(html) {
        const d = document.createElement('div');
        d.innerHTML = html || '';
        return d.textContent || '';
    },

    _renderResult(result, timeSpent) {
        const container = document.getElementById('page-content');
        const pct = Math.round(result.percentage);

        const total      = result.answers.length;
        const correctCnt = result.answers.filter(a => a.isCorrect).length;
        const unansCnt   = result.answers.filter(a => !a.isCorrect &&
            (this._questions[result.answers.indexOf(a)]?.question_type === 'text' ? !a.textAnswer?.trim() : !a.selectedIds?.length)
        ).length;
        const wrongCnt   = total - correctCnt - unansCnt;
        const correctPct = total ? (correctCnt / total * 100) : 0;
        const wrongPct   = total ? (wrongCnt   / total * 100) : 0;

        this._lastResult = result;

        container.innerHTML = `
            <style>
                .tr-wrap{max-width:1300px}
                .tr-topbar{
                    display:flex;align-items:stretch;gap:0;margin-bottom:20px;flex-wrap:wrap;
                    background:var(--bg-surface);border:1px solid var(--border);border-radius:18px;overflow:hidden
                }
                .tr-top-left{flex:1;display:flex;align-items:center;gap:1.25rem;padding:16px 20px;min-width:0}
                .tr-top-title{font-size:.95rem;font-weight:700;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
                .tr-top-title b{font-weight:800}
                .tr-timer{display:flex;flex-direction:column;align-items:center;flex-shrink:0}
                .tr-timer-val{font-size:1rem;font-weight:800;color:var(--text-primary);display:flex;align-items:center;gap:.4rem}
                .tr-timer-lbl{font-size:.65rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:.03em}
                .tr-top-actions{display:flex;align-items:center;gap:.6rem;padding:14px 20px;flex-shrink:0}

                .tr-body{display:grid;grid-template-columns:1fr 340px;gap:20px;align-items:stretch;margin-bottom:20px}
                .tr-card{background:var(--bg-surface);border:1px solid var(--border);border-radius:18px;padding:24px}
                .tr-status-icon{width:56px;height:56px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:1.5rem;margin-bottom:1rem}
                .tr-status-icon.pass{background:rgba(16,185,129,.14);color:var(--success)}
                .tr-status-icon.fail{background:rgba(239,68,68,.14);color:var(--danger)}
                .tr-title{font-size:1.2rem;font-weight:800;color:var(--text-primary);margin-bottom:.3rem}
                .tr-sub{font-size:.85rem;color:var(--text-muted);margin-bottom:1.4rem}
                .tr-metrics{display:flex;gap:2rem;flex-wrap:wrap}
                .tr-metric-lbl{font-size:.72rem;color:var(--text-muted);margin-bottom:.3rem}
                .tr-metric-val{font-size:1.15rem;font-weight:800;color:var(--text-primary);display:flex;align-items:center;gap:.5rem}
                .tr-metric-val .pct{font-size:.85rem;font-weight:700;color:var(--success)}

                .tr-donut-title{font-size:.85rem;font-weight:700;color:var(--text-primary);margin-bottom:1rem}
                .tr-donut{width:150px;height:150px;border-radius:50%;margin:0 auto 1.2rem;
                    background:conic-gradient(var(--success) 0 ${correctPct}%, var(--danger) ${correctPct}% ${correctPct+wrongPct}%, var(--border) ${correctPct+wrongPct}% 100%);
                    display:flex;align-items:center;justify-content:center}
                .tr-donut-center{width:104px;height:104px;border-radius:50%;background:var(--bg-surface);display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}
                .tr-donut-pct{font-size:1.5rem;font-weight:800;color:var(--success);line-height:1.1}
                .tr-donut-lbl{font-size:.6rem;color:var(--text-muted);max-width:76px;line-height:1.25;margin-top:.2rem}
                .tr-legend{display:flex;flex-direction:column;gap:.55rem}
                .tr-legend-item{display:flex;align-items:center;gap:.55rem;font-size:.8rem;color:var(--text-secondary)}
                .tr-legend-dot{width:9px;height:9px;border-radius:50%;flex-shrink:0}
                .tr-legend-val{margin-left:auto;font-weight:700;color:var(--text-primary)}

                .qb-wrap{background:var(--bg-surface);border:1px solid var(--border);border-radius:18px;padding:22px 24px}
                .qb-title{font-size:1rem;font-weight:800;color:var(--text-primary);margin-bottom:1rem}
                .qb-item{border:1px solid var(--border);border-radius:14px;margin-bottom:.6rem;overflow:hidden}
                .qb-head{display:flex;align-items:center;gap:.7rem;padding:.75rem 1rem;cursor:pointer;user-select:none}
                .qb-icon{width:22px;height:22px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:.65rem;color:#fff}
                .qb-icon.ok{background:var(--success)}
                .qb-icon.bad{background:var(--danger)}
                .qb-num{font-size:.8rem;font-weight:700;color:var(--text-muted);flex-shrink:0}
                .qb-text{flex:1;min-width:0;font-size:.88rem;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
                .qb-pts{font-size:.75rem;color:var(--text-muted);flex-shrink:0;white-space:nowrap}
                .qb-chev{color:var(--text-muted);transition:transform .18s;flex-shrink:0}
                .qb-item.open .qb-chev{transform:rotate(180deg)}
                .qb-body{display:none;padding:0 1rem 1rem;border-top:1px solid var(--border)}
                .qb-item.open .qb-body{display:block;padding-top:.75rem}
                .qb-ans{display:flex;align-items:center;gap:.65rem;padding:.5rem .75rem;border-radius:var(--radius-sm);font-size:.86rem;margin-bottom:.35rem}
                .qb-ans-correct{background:rgba(16,185,129,.1);border:1px solid rgba(16,185,129,.3)}
                .qb-ans-wrong{background:rgba(239,68,68,.07);border:1px solid rgba(239,68,68,.25)}
                .qb-exp{margin-top:.5rem;padding:.6rem .75rem;font-size:.8rem;color:var(--text-secondary);background:var(--bg-raised);border-radius:var(--radius-sm)}

                @media(max-width:900px){ .tr-body{grid-template-columns:1fr} }
            </style>

            <div class="tr-wrap">
                <div class="tr-topbar">
                    <div class="tr-top-left">
                        <div class="tr-top-title">Тест: <b>${Fmt.esc(this._test.title)}</b></div>
                        <div class="tr-timer">
                            <div class="tr-timer-val"><i class="fa-regular fa-clock"></i> ${this._fmtHMS(timeSpent)}</div>
                            <div class="tr-timer-lbl">Час завершення</div>
                        </div>
                    </div>
                    <div class="tr-top-actions">
                        ${(total && this._test.show_results !== false && this._test.show_wrong_answers !== false) ? `<button class="btn btn-ghost btn-sm" onclick="TestsPage._scrollToBreakdown()">
                            <i class="fa-solid fa-list-check"></i> Переглянути помилки
                        </button>` : ''}
                        <button class="btn btn-warning btn-sm" onclick="TestsPage.init(document.getElementById('page-content'),{id:'${this._test.id}'})">
                            <i class="fa-solid fa-rotate-right"></i> Спробувати ще раз
                        </button>
                    </div>
                </div>

                <div class="tr-body">
                    <div class="tr-card">
                        <div class="tr-status-icon ${result.passed ? 'pass' : 'fail'}">
                            <i class="fa-solid ${result.passed ? 'fa-check' : 'fa-xmark'}"></i>
                        </div>
                        <div class="tr-title">${result.passed ? 'Тест завершено!' : 'Тест не зараховано'}</div>
                        <div class="tr-sub">${result.passed
                            ? 'Ви успішно склали тест.'
                            : `Набрано ${pct}% з ${this._test.passing_score}% необхідних.`}</div>
                        <div class="tr-metrics">
                            <div>
                                <div class="tr-metric-lbl">Ваш результат</div>
                                <div class="tr-metric-val">${result.score} з ${result.maxScore} <span class="pct">${pct}%</span></div>
                            </div>
                            <div>
                                <div class="tr-metric-lbl">Витрачено часу</div>
                                <div class="tr-metric-val">${this._fmtHMS(timeSpent)}</div>
                            </div>
                        </div>
                    </div>
                    <div class="tr-card">
                        <div class="tr-donut-title">Результати тесту</div>
                        <div class="tr-donut"><div class="tr-donut-center">
                            <div class="tr-donut-pct">${pct}%</div>
                            <div class="tr-donut-lbl">правильних відповідей</div>
                        </div></div>
                        <div class="tr-legend">
                            <div class="tr-legend-item"><span class="tr-legend-dot" style="background:var(--success)"></span> Правильних відповідей <span class="tr-legend-val">${correctCnt}</span></div>
                            <div class="tr-legend-item"><span class="tr-legend-dot" style="background:var(--danger)"></span> Неправильних відповідей <span class="tr-legend-val">${wrongCnt}</span></div>
                            <div class="tr-legend-item"><span class="tr-legend-dot" style="background:var(--border-light,#CBD5E1)"></span> Без відповіді <span class="tr-legend-val">${unansCnt}</span></div>
                            <div class="tr-legend-item"><span class="tr-legend-dot" style="background:var(--text-muted)"></span> Всього питань <span class="tr-legend-val">${total}</span></div>
                        </div>
                    </div>
                </div>

                ${(this._test.show_results !== false && this._test.show_wrong_answers !== false) ? `
                    <div class="qb-wrap" id="qb-wrap">
                        <div class="qb-title">Розбір питань</div>
                        ${this._renderQuestionBreakdown(result.answers)}
                    </div>` : ''}

                <div style="display:flex;justify-content:center;margin-top:1.5rem">
                    <button class="btn btn-ghost" onclick="Router.go('${this._from==='expert-path'?'expert-path':this._test.course_id?'courses/'+this._test.course_id:'dashboard'}')">
                        <i class="fa-solid fa-house"></i> На головну
                    </button>
                </div>
            </div>`;
    },

    _scrollToBreakdown() {
        const el = document.getElementById('qb-wrap');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },

    _toggleBreakdown(i) {
        document.getElementById(`qb-item-${i}`)?.classList.toggle('open');
    },

    _renderQuestionBreakdown(answers) {
        return answers.map((a, i) => {
            const q = this._questions[i];
            if (!q) return '';

            let body;
            if (q.question_type === 'text') {
                body = `<div style="padding:.6rem .75rem;background:var(--bg-raised);border-radius:var(--radius-sm);font-size:.86rem;color:var(--text-secondary);font-style:italic">${Fmt.esc(a.textAnswer || '(без відповіді)')}</div>`;
            } else {
                body = (q.answers || []).map(ans => {
                    const isSel  = a.selectedIds?.includes(ans.id);
                    const isCorr = ans.is_correct;
                    if (!isSel && !isCorr) return '';
                    const cls  = isCorr ? 'qb-ans-correct' : 'qb-ans-wrong';
                    const icon = isCorr
                        ? `<i class="fa-solid fa-check" style="color:var(--success);flex-shrink:0"></i>`
                        : `<i class="fa-solid fa-xmark" style="color:var(--danger);flex-shrink:0"></i>`;
                    const label = isCorr && !isSel ? ' <span style="font-size:.7rem;color:var(--success);opacity:.8">(правильна)</span>' : '';
                    return `<div class="qb-ans ${cls}">${icon}<span class="ql-snow">${ans.answer_text}${label}</span></div>`;
                }).join('');
            }

            return `
                <div class="qb-item" id="qb-item-${i}">
                    <div class="qb-head" onclick="TestsPage._toggleBreakdown(${i})">
                        <span class="qb-icon ${a.isCorrect ? 'ok' : 'bad'}"><i class="fa-solid fa-${a.isCorrect ? 'check' : 'xmark'}"></i></span>
                        <span class="qb-num">${i + 1}</span>
                        <span class="qb-text">${Fmt.esc(this._stripHtml(q.question_text))}</span>
                        <span class="qb-pts">${a.isCorrect ? `+${a.pointsEarned}` : '0'} бал${a.pointsEarned===1?'':'ів'}</span>
                        <i class="fa-solid fa-chevron-down qb-chev"></i>
                    </div>
                    <div class="qb-body">
                        ${body}
                        ${q.explanation ? `<div class="qb-exp"><i class="fa-solid fa-lightbulb" style="color:var(--warning)"></i> ${q.explanation}</div>` : ''}
                    </div>
                </div>`;
        }).join('');
    },

    // ── Управління тестами ────────────────────────────────────────
    _openTestForm(test, courseId) {
        Modal.open({
            title: test ? '<i class="fa-solid fa-pen"></i> Редагувати тест' : '+ Створити тест',
            size: 'lg',
            body: `
                <div class="form-group">
                    <label>Назва тесту *</label>
                    <input id="t-title" type="text" value="${test?.title || ''}" placeholder="Назва тесту">
                </div>
                <div class="form-group">
                    <label>Опис</label>
                    <textarea id="t-desc">${test?.description || ''}</textarea>
                </div>
                <div class="form-group">
                    <label>Інструкції для стажерів</label>
                    <textarea id="t-instructions">${test?.instructions || ''}</textarea>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Макс. спроб (0 = без ліміту)</label>
                        <input id="t-attempts" type="number" min="0" value="${test?.max_attempts ?? 3}">
                    </div>
                    <div class="form-group">
                        <label>Час (хв, 0 = без ліміту)</label>
                        <input id="t-time" type="number" min="0" value="${test?.time_limit_minutes || 0}">
                    </div>
                    <div class="form-group">
                        <label>Прохідний бал (%)</label>
                        <input id="t-passing" type="number" min="0" max="100" value="${test?.passing_score ?? 70}">
                    </div>
                </div>
                <div class="form-group">
                    <label class="checkbox-item" style="cursor:pointer">
                        <input type="checkbox" id="t-published" ${test?.is_published ? 'checked' : ''}>
                        <span>Опублікувати тест</span>
                    </label>
                    <label class="checkbox-item" style="cursor:pointer;margin-top:.5rem">
                        <input type="checkbox" id="t-random" ${test?.randomize_questions ? 'checked' : ''}>
                        <span>Перемішувати запитання</span>
                    </label>
                    <label class="checkbox-item" style="cursor:pointer;margin-top:.5rem">
                        <input type="checkbox" id="t-results" ${test?.show_results !== false ? 'checked' : ''}>
                        <span>Показувати розбір відповідей</span>
                    </label>
                </div>
                <input type="hidden" id="t-course-id" value="${test?.course_id || courseId}">`,
            footer: `
                <button class="btn btn-secondary" onclick="Modal.close()">Скасувати</button>
                ${test ? `<button class="btn btn-info" onclick="TestsPage.openQuestionEditor('${test.id}')">📝 Запитання</button>` : ''}
                <button class="btn btn-primary" onclick="TestsPage.saveTest('${test?.id || ''}')"><i class="fa-regular fa-floppy-disk"></i> Зберегти</button>`
        });
    },

    async openEdit(id) {
        Loader.show();
        try { const test = await API.tests.getById(id); this._openTestForm(test, test.course_id); }
        finally { Loader.hide(); }
    },

    async saveTest(id) {
        const title = Dom.val('t-title').trim();
        if (!title) { Toast.error('Помилка', 'Вкажіть назву'); return; }
        const fields = {
            course_id:           Dom.val('t-course-id'),
            title,
            description:         Dom.val('t-desc').trim() || null,
            instructions:        Dom.val('t-instructions').trim() || null,
            max_attempts:        parseInt(Dom.val('t-attempts')) || 3,
            time_limit_minutes:  parseInt(Dom.val('t-time')) || null,
            passing_score:       parseInt(Dom.val('t-passing')) || 70,
            is_published:        document.getElementById('t-published').checked,
            randomize_questions: document.getElementById('t-random').checked,
            show_results:        document.getElementById('t-results').checked
        };
        Loader.show();
        try {
            let test = id ? await API.tests.update(id, fields) : await API.tests.create(fields);
            AuditLog.write(id ? 'test_update' : 'test_create', 'test', title);
            Toast.success('Збережено!');
            Modal.close();
            if (!id) this.openQuestionEditor(test.id);
            else Router.go('courses/' + fields.course_id);
        } catch(e) { Toast.error('Помилка', e.message); }
        finally { Loader.hide(); }
    },

    async deleteTest(id, title) {
        const ok = await Modal.confirm({ title: 'Видалити тест', message: `Видалити тест "${title}"?`, confirmText: 'Видалити', danger: true });
        if (!ok) return;
        Loader.show();
        try { await API.tests.delete(id); AuditLog.write('test_delete', 'test', title); Toast.success('Тест видалено'); history.back(); }
        catch(e) { Toast.error('Помилка', e.message); }
        finally { Loader.hide(); }
    },

    async openQuestionEditor(testId) {
        Loader.show();
        try {
            const test = await API.tests.getById(testId);
            this._editingTest = test;
            Modal.open({
                title: `📝 Запитання: ${test.title}`,
                size: 'xl',
                body: `
                    <div id="questions-editor">${this._renderQuestionsEditor(test.questions || [])}</div>
                    <button class="btn btn-secondary" style="margin-top:1rem;width:100%"
                            onclick="TestsPage.addQuestion('${testId}')"><i class="fa-solid fa-plus"></i> Додати запитання</button>`,
                footer: `<button class="btn btn-secondary" onclick="Modal.close()">Закрити</button>`
            });
        } finally { Loader.hide(); }
    },

    _renderQuestionsEditor(questions) {
        if (!questions.length) return `<div style="text-align:center;padding:2rem;color:var(--text-muted)">Немає запитань. Додайте перше.</div>`;
        return questions.map((q, i) => `
            <div class="card" style="margin-bottom:1rem" id="qcard-${q.id}">
                <div class="card-header" style="background:var(--bg-raised)">
                    <span style="font-weight:600">Запитання ${i + 1}</span>
                    <div style="display:flex;gap:.5rem">
                        <span class="badge ${q.question_type === 'multiple' ? 'badge-info' : 'badge-primary'}">${q.question_type === 'multiple' ? 'Кілька' : 'Одна'}</span>
                        <button class="btn btn-danger btn-sm" onclick="TestsPage.deleteQuestion('${q.id}')"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </div>
                <div class="card-body">
                    <p style="font-weight:500;margin-bottom:.75rem">${q.question_text}</p>
                    <div style="display:flex;flex-direction:column;gap:.4rem">
                        ${q.answers.map(a => `
                            <div style="display:flex;align-items:center;gap:.5rem;padding:.4rem .75rem;border-radius:var(--radius-sm);background:${a.is_correct ? 'rgba(16,185,129,.1)' : 'var(--bg-hover)'}">
                                <span style="color:${a.is_correct ? 'var(--success)' : 'var(--text-muted)'}">${a.is_correct ? '✓' : '○'}</span>
                                <span style="font-size:.875rem">${a.answer_text}</span>
                            </div>`).join('')}
                    </div>
                    <button class="btn btn-ghost btn-sm" style="margin-top:.75rem" onclick="TestsPage.editQuestion(${JSON.stringify(q).replace(/"/g,'&quot;')})"><i class="fa-solid fa-pen"></i> Змінити</button>
                </div>
            </div>`).join('');
    },

    addQuestion(testId)  { this._openQuestionForm(null, testId); },
    editQuestion(q)      { this._openQuestionForm(q, q.test_id); },

    _openQuestionForm(q, testId) {
        const answersHTML = (q?.answers || [{text:'',is_correct:false},{text:'',is_correct:false},{text:'',is_correct:false},{text:'',is_correct:false}])
            .map((a, i) => `
                <div class="answer-row" style="display:flex;align-items:center;gap:.5rem;margin-bottom:.5rem">
                    <input type="text" placeholder="Варіант ${i+1}" value="${a.answer_text || a.text || ''}" class="ans-text" style="flex:1">
                    <label style="display:flex;align-items:center;gap:.3rem;cursor:pointer;white-space:nowrap">
                        <input type="checkbox" class="ans-correct" ${a.is_correct ? 'checked' : ''}> Правильна
                    </label>
                    <button class="btn btn-danger btn-sm" onclick="this.closest('.answer-row').remove()">✕</button>
                </div>`).join('');

        Modal.open({
            title: q ? '<i class="fa-solid fa-pen"></i> Змінити запитання' : '+ Нове запитання',
            size: 'lg',
            body: `
                <div class="form-group">
                    <label>Текст запитання *</label>
                    <textarea id="qf-text" style="min-height:80px">${q?.question_text || ''}</textarea>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Тип запитання</label>
                        <select id="qf-type">
                            <option value="single" ${q?.question_type === 'single' ? 'selected' : ''}>Одна правильна відповідь</option>
                            <option value="multiple" ${q?.question_type === 'multiple' ? 'selected' : ''}>Кілька правильних</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Балів за запитання</label>
                        <input id="qf-points" type="number" min="1" value="${q?.points || 1}">
                    </div>
                </div>
                <div class="form-group">
                    <label>Пояснення (показується після тесту)</label>
                    <input id="qf-explanation" type="text" placeholder="Пояснення правильної відповіді" value="${q?.explanation || ''}">
                </div>
                <div class="form-group">
                    <label>Варіанти відповідей</label>
                    <div id="answers-list">${answersHTML}</div>
                    <button class="btn btn-ghost btn-sm" style="margin-top:.5rem"
                            onclick="document.getElementById('answers-list').insertAdjacentHTML('beforeend','<div class=\\'answer-row\\' style=\\'display:flex;align-items:center;gap:.5rem;margin-bottom:.5rem\\'><input type=\\'text\\' placeholder=\\'Варіант\\' class=\\'ans-text\\' style=\\'flex:1\\'><label style=\\'display:flex;align-items:center;gap:.3rem;cursor:pointer;white-space:nowrap\\'><input type=\\'checkbox\\' class=\\'ans-correct\\'> Правильна</label><button class=\\'btn btn-danger btn-sm\\' onclick=\\'this.closest(\\\\\\'.answer-row\\\\\\').remove()\\'>✕</button></div>')">
                        <i class="fa-solid fa-plus"></i> Додати варіант
                    </button>
                </div>
                <input type="hidden" id="qf-test-id" value="${testId}">`,
            footer: `
                <button class="btn btn-secondary" onclick="TestsPage.openQuestionEditor('${testId}')" style="display:inline-flex;align-items:center;gap:.35rem"><i class="fa-solid fa-angle-left"></i> Назад</button>
                <button class="btn btn-primary" onclick="TestsPage.saveQuestion('${q?.id || ''}','${testId}')"><i class="fa-regular fa-floppy-disk"></i> Зберегти</button>`
        });
    },

    async saveQuestion(qId, testId) {
        const text = Dom.val('qf-text').trim();
        if (!text) { Toast.error('Помилка', 'Введіть текст запитання'); return; }
        const rows    = document.querySelectorAll('#answers-list .answer-row');
        const answers = [...rows].map(row => ({
            text:       row.querySelector('.ans-text')?.value?.trim() || '',
            is_correct: row.querySelector('.ans-correct')?.checked || false
        })).filter(a => a.text);
        if (answers.length < 2) { Toast.error('Помилка', 'Додайте мінімум 2 варіанти відповіді'); return; }
        if (!answers.some(a => a.is_correct)) { Toast.error('Помилка', 'Відмітьте хоча б одну правильну відповідь'); return; }

        const fields = {
            test_id: testId, question_text: text,
            question_type: Dom.val('qf-type'),
            points:        parseInt(Dom.val('qf-points')) || 1,
            explanation:   Dom.val('qf-explanation').trim() || null,
            order_index:   this._editingTest?.questions?.length || 0
        };
        Loader.show();
        try {
            let question = qId ? await API.questions.update(qId, fields) : await API.questions.create(fields);
            await API.questions.upsertAnswers(question.id, answers);
            Toast.success('Запитання збережено');
            await this.openQuestionEditor(testId);
        } catch(e) { Toast.error('Помилка', e.message); }
        finally { Loader.hide(); }
    },

    async deleteQuestion(id) {
        const ok = await Modal.confirm({ title: 'Видалити запитання', message: 'Видалити це запитання?', confirmText: 'Видалити', danger: true });
        if (!ok) return;
        Loader.show();
        try {
            await API.questions.delete(id);
            Toast.success('Запитання видалено');
            await this.openQuestionEditor(this._editingTest.id);
        } catch(e) { Toast.error('Помилка', e.message); }
        finally { Loader.hide(); }
    }
};
