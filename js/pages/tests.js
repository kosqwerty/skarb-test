// ================================================================
// EduFlow LMS — Тести (проходження + управління)
// ================================================================

const TestsPage = {
    _test:          null,
    _attempt:       null,
    _answers:       {},
    _textAnswers:   {},
    _confirmedSet:  null,
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

            if (this._from === 'expert-path') {
                UI.setBreadcrumb([
                    { label: 'Шлях експерта', route: 'expert-path' },
                    { label: test.title }
                ]);
            } else {
                UI.setBreadcrumb([
                    { label: 'Курси', route: 'courses' },
                    { label: test.course?.title || 'Курс', route: `courses/${test.course_id}` },
                    { label: test.title }
                ]);
            }

            const attempts      = await API.attempts.getByTest(testId);
            const best          = attempts.reduce((b,a) => (!b || (a.percentage||0) > (b.percentage||0)) ? a : b, null);
            const attemptsLeft  = test.max_attempts ? test.max_attempts - attempts.filter(a => a.completed_at).length : null;

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
                .ti-wrap{max-width:1200px}
                .ti-stats{display:flex;gap:.75rem;flex-wrap:wrap;margin-bottom:1.5rem}
                .ti-stat{flex:1;min-width:120px;padding:.9rem 1.1rem;border-radius:var(--radius-md);border:1px solid var(--border);background:var(--bg-surface)}
                .ti-stat-val{font-size:1.3rem;font-weight:700;color:var(--text-primary);margin-bottom:.15rem}
                .ti-stat-lbl{font-size:.72rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:.04em}
            </style>
            <div class="ti-wrap">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1.25rem">
                    <h2 style="margin:0"><i class="fa-solid fa-file-pen" style="color:var(--primary);margin-right:.4rem"></i>${test.title}</h2>
                    <button class="btn btn-ghost btn-sm" onclick="Router.go('${this._from==='expert-path'?'expert-path':'courses/'+test.course_id}')">
                        <i class="fa-solid fa-arrow-left"></i> ${this._from==='expert-path'?'Шлях експерта':'Назад до курсу'}
                    </button>
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
                                { icon:'fa-question',    label:'Запитань',         value: test.questions?.length || 0 },
                                { icon:'fa-bullseye',    label:'Прохідний бал',    value: test.passing_score + '%' },
                                { icon:'fa-rotate-right',label:'Спроб залишилось', value: attemptsLeft === null ? '∞' : attemptsLeft },
                                { icon:'fa-clock',       label:'Час',              value: test.time_limit_minutes ? test.time_limit_minutes + ' хв' : 'Без ліміту' }
                            ].map(s => `
                                <div class="ti-stat">
                                    <div class="ti-stat-val">${s.value}</div>
                                    <div class="ti-stat-lbl"><i class="fa-solid ${s.icon}"></i> ${s.label}</div>
                                </div>`).join('')}
                        </div>

                        ${best ? `
                            <div style="display:inline-flex;align-items:center;gap:.75rem;padding:.875rem 1rem;border-radius:var(--radius-md);border:1px solid ${best.passed ? 'rgba(16,185,129,.3)' : 'rgba(239,68,68,.3)'};background:${best.passed ? 'rgba(16,185,129,.06)' : 'rgba(239,68,68,.06)'};margin-bottom:.75rem">
                                <span style="color:var(--text-muted);font-size:.875rem">Ваш найкращий результат:</span>
                                <span style="font-size:1.2rem;font-weight:700;color:${best.passed ? 'var(--success)' : 'var(--danger)'}">${Math.round(best.percentage||0)}%</span>
                                <span class="badge ${best.passed ? 'badge-success' : 'badge-danger'}">${best.passed ? 'Зараховано' : 'Не зараховано'}</span>
                            </div><br>` : ''}

                        ${canAttempt
                            ? saved
                                ? `<div style="display:flex;align-items:center;gap:.75rem;flex-wrap:wrap;margin-bottom:1.5rem">
                                       <button class="btn btn-primary" onclick="TestsPage.startTest(true)">
                                           <i class="fa-solid fa-play"></i> Продовжити (${(saved.confirmedIds||[]).length}/${(saved.questionOrder||[]).length})
                                       </button>
                                       ${test.allow_restart ? `<button class="btn btn-ghost btn-sm" onclick="TestsPage.startTest(false)">
                                           <i class="fa-solid fa-rotate-right"></i> Почати заново
                                       </button>` : ''}
                                   </div>`
                                : `<button class="btn btn-primary" style="margin-bottom:1.5rem" onclick="TestsPage.startTest()">
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
                confirmedIds: [...this._confirmedSet],
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
                    this._confirmedSet = new Set(saved.confirmedIds || []);
                    this._curQIdx      = saved.curQIdx      || 0;
                    this._startTime    = saved.startTime    || Date.now();
                    const qMap         = new Map((this._test.questions || []).map(q => [q.id, q]));
                    this._questions    = (saved.questionOrder || []).map(id => qMap.get(id)).filter(Boolean);
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
            this._confirmedSet = new Set();
            this._curQIdx      = 0;
            this._startTime    = Date.now();

            let questions = [...(this._test.questions || [])];
            if (this._test.randomize_questions) questions = questions.sort(() => Math.random() - 0.5);
            this._questions = questions;

            this._renderTest();
            if (this._test.time_limit_minutes) this._startTimer(this._test.time_limit_minutes * 60);
        } catch(e) { Toast.error('Помилка', e.message); }
        finally { Loader.hide(); }
    },

    _renderTest() {
        const container = document.getElementById('page-content');
        const qs = this._questions;

        container.innerHTML = `
            <style>
                .tq-wrap{max-width:1200px}
                .tq-topbar{display:flex;align-items:center;gap:.75rem;margin-bottom:1.25rem;padding-bottom:1rem;border-bottom:1px solid var(--border)}
                .tq-prog-row{display:flex;align-items:center;gap:.75rem;margin-bottom:1.75rem}
                .tq-prog-bar{flex:1;height:6px;background:var(--border);border-radius:3px;overflow:hidden}
                .tq-prog-fill{height:100%;background:var(--primary);border-radius:3px;transition:width .35s}
                .tq-prog-text{font-size:.75rem;color:var(--text-muted);white-space:nowrap}
                #timer{font-size:.85rem;font-weight:700;color:var(--primary);background:var(--bg-raised);padding:.28rem .65rem;border-radius:var(--radius-sm);border:1px solid var(--border);white-space:nowrap}
.tq-type-badge{display:inline-flex;align-items:center;gap:.4rem;padding:.35rem .85rem;border-radius:20px;font-size:.78rem;font-weight:700;margin-bottom:1rem}
                .tq-type-single{background:rgba(99,102,241,.12);color:var(--primary);border:1.5px solid rgba(99,102,241,.3)}
                .tq-type-multiple{background:rgba(16,185,129,.12);color:var(--success);border:1.5px solid rgba(16,185,129,.3)}
                .tq-type-text{background:rgba(245,158,11,.12);color:var(--warning);border:1.5px solid rgba(245,158,11,.3)}
                .tq-points-badge{display:inline-flex;align-items:center;gap:.35rem;padding:.28rem .7rem;border-radius:20px;font-size:.72rem;font-weight:700;background:rgba(245,158,11,.1);color:var(--warning);border:1.5px solid rgba(245,158,11,.25);margin-left:.5rem}
                .tq-qtext{font-size:1.08rem;font-weight:400;line-height:1.7;color:var(--text-primary);margin-bottom:1.4rem;flex:1;min-width:0}
                .tq-qtext p{margin:0;padding:0}
                .tq-qtext img{max-width:100%;height:auto;border-radius:4px}
                .tq-answer{display:flex;align-items:center;gap:.85rem;padding:.75rem 1rem;border-radius:var(--radius-md);border:none;background:transparent;cursor:pointer;transition:background .12s;margin-bottom:.2rem;user-select:none}
                .tq-answer:hover{background:var(--primary-glow,rgba(99,102,241,.07))}
                .tq-answer.selected{background:var(--primary-glow,rgba(99,102,241,.1))}
                .tq-answer input{display:none}
                .tq-marker{width:20px;height:20px;border-radius:50%;border:2px solid var(--border-light,#CBD5E1);flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:.55rem;color:#fff;transition:all .12s}
                .tq-answer.selected .tq-marker{background:var(--primary);border-color:var(--primary)}
                .tq-marker-sq{border-radius:5px}
                .tq-atext{font-size:.93rem;line-height:1.4;color:var(--text-primary);flex:1;min-width:0}
                .tq-atext p{margin:0;padding:0}
                .tq-atext img{max-width:100%;height:auto;border-radius:4px}
                .tq-botbar{display:flex;align-items:center;justify-content:space-between;gap:1rem;margin-top:1.5rem;padding-top:1rem;border-top:1px solid var(--border)}
                .tq-textarea{width:100%;resize:vertical;padding:.75rem;border-radius:var(--radius-md);border:1.5px solid var(--border);background:var(--bg-surface);color:var(--text-primary);font-size:.93rem;box-sizing:border-box;transition:border-color .15s;font-family:inherit}
                .tq-textarea:focus{outline:none;border-color:var(--primary)}
                @keyframes tq-in{from{opacity:0;transform:translateX(14px)}to{opacity:1;transform:translateX(0)}}
                .tq-anim{animation:tq-in .18s ease}
            </style>

            <div class="tq-wrap" id="test-taking">
                <div class="tq-topbar">
                    <button class="btn btn-ghost btn-sm" onclick="TestsPage.cancelTest()">
                        <i class="fa-solid fa-xmark"></i> Скасувати
                    </button>
                    <span style="font-size:.95rem;font-weight:600;color:var(--text-primary);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${this._test.title}</span>
                    ${this._test.time_limit_minutes ? `<div id="timer">--:--</div>` : ''}
                    <button class="btn btn-secondary btn-sm" onclick="TestsPage.submitTest()">
                        <i class="fa-solid fa-flag-checkered"></i> Завершити тест
                    </button>
                </div>

                <div class="tq-prog-row">
                    <div class="tq-prog-bar"><div class="tq-prog-fill" id="tq-prog-fill" style="width:0%"></div></div>
                    <div class="tq-prog-text" id="tq-prog-text">0 / ${qs.length}</div>
                </div>

                <div id="tq-question-area"></div>

                <div class="tq-botbar">
                    ${this._test.allow_back_navigation
                        ? `<button class="btn btn-secondary" id="tq-btn-prev" onclick="TestsPage._prevQuestion()">
                               <i class="fa-solid fa-arrow-left"></i> Назад
                           </button>`
                        : `<span></span>`}
                    <button class="btn btn-primary" id="tq-btn-confirm" onclick="TestsPage._confirmAnswer()">
                        Відповісти <i class="fa-solid fa-arrow-right"></i>
                    </button>
                </div>
            </div>`;

        this._showQuestion(this._curQIdx);
        this._updateProgress();
    },

    _showQuestion(idx) {
        const questions = this._questions;
        if (idx < 0 || idx >= questions.length) return;
        this._curQIdx = idx;

        const q          = questions[idx];
        const isMultiple = q.question_type === 'multiple';
        const isText     = q.question_type === 'text';
        const selected   = this._answers[q.id] || [];
        const textVal    = this._textAnswers[q.id] || '';

        let answersHtml;
        if (isText) {
            answersHtml = `<textarea class="tq-textarea" rows="4" placeholder="Введіть відповідь..."
                oninput="TestsPage._onTextAnswer('${q.id}',this.value)">${textVal}</textarea>`;
        } else {
            answersHtml = (q.answers || []).map(a => {
                const isSel = selected.includes(a.id);
                const icon  = isSel ? (isMultiple ? '<i class="fa-solid fa-check"></i>' : '<i class="fa-solid fa-circle" style="font-size:.4rem"></i>') : '';
                return `
                    <label class="tq-answer${isSel ? ' selected' : ''}" onclick="if(event.target.tagName==='INPUT')return; TestsPage.onAnswer('${q.id}','${a.id}',${isMultiple})">
                        <input type="${isMultiple ? 'checkbox' : 'radio'}" name="q-${q.id}" value="${a.id}" ${isSel ? 'checked' : ''}>
                        <div class="tq-marker${isMultiple ? ' tq-marker-sq' : ''}">${icon}</div>
                        <div class="tq-atext">${a.answer_text}</div>
                    </label>`;
            }).join('');
        }

        const typeBadge = isText
            ? `<span class="tq-type-badge tq-type-text"><i class="fa-solid fa-pen-line"></i> Відповідь текстом</span>`
            : isMultiple
                ? `<span class="tq-type-badge tq-type-multiple"><i class="fa-solid fa-list-check"></i> Кілька правильних відповідей</span>`
                : `<span class="tq-type-badge tq-type-single"><i class="fa-solid fa-circle-dot"></i> Одна правильна відповідь</span>`;
        const pointsBadge = q.points > 1
            ? `<span class="tq-points-badge"><i class="fa-solid fa-star"></i> ${q.points} балів</span>`
            : '';

        const area = document.getElementById('tq-question-area');
        if (!area) return;
        area.classList.remove('tq-anim');
        void area.offsetWidth;
        area.classList.add('tq-anim');
        area.innerHTML = `
            <div class="ql-snow" style="margin-bottom:.9rem">${typeBadge}${pointsBadge}</div>
            <div style="display:flex;gap:.5rem;align-items:baseline;margin-bottom:1.4rem" class="ql-snow">
                <span style="color:var(--text-muted);font-weight:600;font-size:1.08rem;flex-shrink:0">${idx + 1}.</span>
                <div class="tq-qtext">${q.question_text}</div>
            </div>
            <div style="display:flex;flex-direction:column;gap:0" class="ql-snow">${answersHtml}</div>`;

        const prev    = document.getElementById('tq-btn-prev');
        const confirm = document.getElementById('tq-btn-confirm');
        const isLast  = idx === questions.length - 1;
        if (prev)    prev.style.visibility = idx === 0 ? 'hidden' : 'visible';
        if (confirm) confirm.innerHTML = isLast
            ? `<i class="fa-solid fa-flag-checkered"></i> Завершити тест`
            : `Відповісти <i class="fa-solid fa-arrow-right"></i>`;
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
        document.querySelectorAll('.tq-answer').forEach(label => {
            const input  = label.querySelector('input');
            const marker = label.querySelector('.tq-marker');
            if (!input || !marker) return;
            const isSel = selected.includes(input.value);
            label.classList.toggle('selected', isSel);
            marker.innerHTML = isSel
                ? (isMultiple ? '<i class="fa-solid fa-check"></i>' : '<i class="fa-solid fa-circle" style="font-size:.4rem"></i>')
                : '';
        });
    },

    _confirmAnswer() {
        const q      = this._questions[this._curQIdx];
        const isLast = this._curQIdx === this._questions.length - 1;
        this._confirmedSet.add(q.id);
        this._updateProgress();
        if (this._test.show_answer_feedback) {
            this._showFeedback(q, isLast);
        } else {
            if (isLast) { this._saveProgress(); this.submitTest(); }
            else        { this._nextQuestion(); this._saveProgress(); }
        }
    },

    _proceedNext() {
        const isLast = this._curQIdx === this._questions.length - 1;
        if (isLast) { this._saveProgress(); this.submitTest(); }
        else        { this._nextQuestion(); this._saveProgress(); }
    },

    _showFeedback(q, isLast) {
        const isText     = q.question_type === 'text';
        const isMultiple = q.question_type === 'multiple';
        const selected   = this._answers[q.id] || [];
        const correctIds = isText ? [] : (q.answers || []).filter(a => a.is_correct).map(a => a.id);

        let isCorrect = false;
        if (!isText) {
            isCorrect = isMultiple
                ? correctIds.length === selected.length && correctIds.every(id => selected.includes(id))
                : selected.length === 1 && correctIds.includes(selected[0]);

            document.querySelectorAll('.tq-answer').forEach(label => {
                const input    = label.querySelector('input');
                const marker   = label.querySelector('.tq-marker');
                if (!input) return;
                const id       = input.value;
                const isSel    = selected.includes(id);
                const isCorr   = correctIds.includes(id);
                label.style.pointerEvents = 'none';
                if (isCorr && isSel) {
                    label.style.background = 'rgba(16,185,129,.13)';
                    if (marker) { marker.style.background = 'var(--success)'; marker.style.borderColor = 'var(--success)'; }
                } else if (isCorr && !isSel) {
                    label.style.outline = '1.5px solid var(--success)';
                } else if (!isCorr && isSel) {
                    label.style.background = 'rgba(239,68,68,.1)';
                    if (marker) { marker.style.background = 'var(--danger)'; marker.style.borderColor = 'var(--danger)'; }
                }
            });
        }

        const color = isText ? 'var(--primary)' : isCorrect ? 'var(--success)' : 'var(--danger)';
        const bg    = isText ? 'rgba(99,102,241,.08)' : isCorrect ? 'rgba(16,185,129,.1)' : 'rgba(239,68,68,.08)';
        const icon  = isText ? 'fa-pen' : isCorrect ? 'fa-circle-check' : 'fa-circle-xmark';
        const text  = isText ? 'Відповідь прийнята' : isCorrect ? 'Правильно!' : 'Неправильно';

        const area = document.getElementById('tq-question-area');
        if (area) {
            const fb = document.createElement('div');
            fb.style.cssText = `margin-top:1rem;padding:.875rem 1rem;border-radius:var(--radius-md);background:${bg};border:1.5px solid ${color}`;
            fb.innerHTML = `
                <div style="font-weight:700;color:${color};margin-bottom:${q.explanation?'.4rem':'0'}">
                    <i class="fa-solid ${icon}"></i> ${text}
                </div>
                ${q.explanation ? `<div style="font-size:.875rem;color:var(--text-secondary)">${q.explanation}</div>` : ''}`;
            area.appendChild(fb);
        }

        const btn = document.getElementById('tq-btn-confirm');
        if (btn) {
            btn.innerHTML = isLast
                ? `<i class="fa-solid fa-flag-checkered"></i> Завершити тест`
                : `Далі <i class="fa-solid fa-arrow-right"></i>`;
            btn.onclick = () => TestsPage._proceedNext();
        }
    },

    _onTextAnswer(qId, val) {
        if (val.trim()) this._textAnswers[qId] = val;
        else            delete this._textAnswers[qId];
    },

    _nextQuestion() {
        if (this._curQIdx < this._questions.length - 1) this._showQuestion(this._curQIdx + 1);
    },

    _prevQuestion() {
        if (this._curQIdx > 0) this._showQuestion(this._curQIdx - 1);
    },

    _updateProgress() {
        const answered = this._confirmedSet.size;
        const total    = this._questions.length;
        const pct      = total ? (answered / total * 100) : 0;
        const fill = document.getElementById('tq-prog-fill');
        const text = document.getElementById('tq-prog-text');
        if (fill) fill.style.width = pct + '%';
        if (text) text.textContent = `${answered} / ${total}`;
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

    cancelTest() { clearInterval(this._timer); Router.go('courses/' + this._test.course_id); },

    async submitTest(isTimeout = false) {
        clearInterval(this._timer);

        if (!isTimeout) {
            const answered = this._confirmedSet.size;
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

    _renderResult(result, timeSpent) {
        const container = document.getElementById('page-content');
        const pct = Math.round(result.percentage);

        container.innerHTML = `
            <div class="test-container">
                <div class="card">
                    <div class="card-body">
                        <div class="test-result">
                            <div class="result-score-circle ${result.passed ? 'passed' : 'failed'}">
                                <div class="result-pct" style="color:${result.passed ? 'var(--success)' : 'var(--danger)'}">${pct}%</div>
                                <div class="result-label">результат</div>
                            </div>
                            <h2 style="margin-bottom:.5rem">${result.passed ? '🎉 Тест зараховано!' : '❌ Тест не зараховано'}</h2>
                            <p style="color:var(--text-muted);margin-bottom:2rem">
                                ${result.passed
                                    ? 'Вітаємо! Ви успішно склали тест.'
                                    : `Набрано ${pct}% з ${this._test.passing_score}% необхідних. Спробуйте ще раз.`}
                            </p>
                            <div class="stats-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:2rem;max-width:500px;margin-left:auto;margin-right:auto">
                                ${[
                                    { icon:'🎯', label:'Результат',  value: `${result.score}/${result.maxScore}` },
                                    { icon:'📊', label:'Відсоток',   value: `${pct}%` },
                                    { icon:'⏱', label:'Час',         value: timeSpent < 60 ? `${timeSpent}с` : `${Math.floor(timeSpent/60)}хв` },
                                    { icon:'🏆', label:'Поріг',       value: `${this._test.passing_score}%` }
                                ].map(s => `
                                    <div class="stat-card" style="padding:.875rem">
                                        <div style="font-size:1.3rem">${s.icon}</div>
                                        <div style="font-size:1.1rem;font-weight:700">${s.value}</div>
                                        <div style="font-size:.72rem;color:var(--text-muted)">${s.label}</div>
                                    </div>`).join('')}
                            </div>
                            <div style="display:flex;gap:1rem;justify-content:center;flex-wrap:wrap">
                                <button class="btn btn-secondary" onclick="Router.go('courses/${this._test.course_id}')">← До курсу</button>
                                <button class="btn btn-ghost" onclick="TestsPage.init(document.getElementById('page-content'),{id:'${this._test.id}'})">🔄 Спробувати знову</button>
                                ${this._test.show_results ? `<button class="btn btn-primary" onclick="TestsPage.showAnswerReview()">📋 Розбір відповідей</button>` : ''}
                            </div>
                        </div>
                        ${this._test.show_results ? `
                            <div id="answer-review" style="margin-top:2rem;display:none">
                                <h3 style="margin-bottom:1rem">Розбір запитань</h3>
                                ${this._renderAnswerReview(result.answers)}
                            </div>` : ''}
                        ${this._test.show_wrong_answers ? this._renderWrongAnswersProtocol(result.answers) : ''}
                    </div>
                </div>
            </div>`;
    },

    _renderWrongAnswersProtocol(answers) {
        const wrong = answers.map((a, i) => ({ a, q: this._questions[i] }))
                             .filter(({ a, q }) => q && !a.isCorrect && q.question_type !== 'text');
        if (!wrong.length) return `
            <div style="margin-top:2rem;padding:1.25rem;border-radius:var(--radius-md);border:1px solid rgba(16,185,129,.3);background:rgba(16,185,129,.06);text-align:center">
                <i class="fa-solid fa-circle-check" style="color:var(--success);font-size:1.4rem;margin-bottom:.4rem;display:block"></i>
                <div style="font-weight:700;color:var(--success)">Помилок немає — всі відповіді правильні!</div>
            </div>`;

        return `
            <div style="margin-top:2rem;text-align:left">
                <div style="display:flex;align-items:center;gap:.6rem;margin-bottom:1rem;padding-bottom:.75rem;border-bottom:1px solid var(--border)">
                    <i class="fa-solid fa-circle-xmark" style="color:var(--danger)"></i>
                    <h3 style="margin:0;font-size:1rem">Протокол помилок <span style="font-size:.85rem;font-weight:400;color:var(--text-muted)">(${wrong.length} з ${answers.length})</span></h3>
                </div>
                <style>
                    .wp-item{border:1px solid var(--border);border-radius:var(--radius-md);margin-bottom:.75rem;overflow:hidden}
                    .wp-qhead{display:flex;gap:.75rem;align-items:baseline;padding:.875rem 1rem;background:var(--bg-raised);border-bottom:1px solid var(--border)}
                    .wp-qnum{font-size:.72rem;font-weight:800;color:var(--danger);background:rgba(239,68,68,.1);border:1.5px solid rgba(239,68,68,.3);border-radius:6px;padding:.15rem .45rem;flex-shrink:0}
                    .wp-qtext{font-size:.9rem;font-weight:600;color:var(--text-primary);line-height:1.5}
                    .wp-qtext p{margin:0}
                    .wp-answers{padding:.75rem 1rem;display:flex;flex-direction:column;gap:.4rem}
                    .wp-ans{display:flex;align-items:center;gap:.65rem;padding:.5rem .75rem;border-radius:var(--radius-sm);font-size:.88rem}
                    .wp-ans-correct{background:rgba(16,185,129,.1);border:1px solid rgba(16,185,129,.3)}
                    .wp-ans-wrong{background:rgba(239,68,68,.07);border:1px solid rgba(239,68,68,.25)}
                    .wp-ans-neutral{background:transparent;color:var(--text-muted)}
                    .wp-exp{padding:.6rem 1rem .875rem;font-size:.82rem;color:var(--text-secondary);border-top:1px dashed var(--border)}
                </style>
                ${wrong.map(({ a, q }, idx) => {
                    const correctIds = (q.answers || []).filter(ans => ans.is_correct).map(ans => ans.id);
                    const answersHtml = (q.answers || []).map(ans => {
                        const isSel  = a.selectedIds?.includes(ans.id);
                        const isCorr = ans.is_correct;
                        if (!isSel && !isCorr) return '';
                        const cls  = isCorr ? 'wp-ans-correct' : 'wp-ans-wrong';
                        const icon = isCorr
                            ? `<i class="fa-solid fa-check" style="color:var(--success);flex-shrink:0"></i>`
                            : `<i class="fa-solid fa-xmark" style="color:var(--danger);flex-shrink:0"></i>`;
                        const label = isCorr && !isSel ? ' <span style="font-size:.72rem;color:var(--success);opacity:.8">(правильна)</span>' : '';
                        return `<div class="wp-ans ${cls}">${icon}<span>${ans.answer_text}${label}</span></div>`;
                    }).join('');
                    return `
                        <div class="wp-item">
                            <div class="wp-qhead">
                                <span class="wp-qnum">✗ ${answers.indexOf(a) + 1}</span>
                                <div class="wp-qtext ql-snow">${q.question_text}</div>
                            </div>
                            <div class="wp-answers">${answersHtml}</div>
                            ${q.explanation ? `<div class="wp-exp"><i class="fa-solid fa-lightbulb" style="color:var(--warning)"></i> ${q.explanation}</div>` : ''}
                        </div>`;
                }).join('')}
            </div>`;
    },

    showAnswerReview() {
        const el = document.getElementById('answer-review');
        if (el) { el.style.display = 'block'; el.scrollIntoView({ behavior:'smooth' }); }
    },

    _renderAnswerReview(answers) {
        return answers.map((a, i) => {
            const q = this._questions[i];
            if (!q) return '';
            const borderColor = a.isCorrect ? 'rgba(16,185,129,.4)' : 'rgba(239,68,68,.4)';
            const numBg       = a.isCorrect ? 'rgba(16,185,129,.15)' : 'rgba(239,68,68,.15)';
            const numColor    = a.isCorrect ? 'var(--success)' : 'var(--danger)';

            let answersBlock;
            if (q.question_type === 'text') {
                answersBlock = `<div style="padding:.75rem;background:var(--bg-raised);border-radius:var(--radius-sm);font-size:.9rem;color:var(--text-secondary);font-style:italic">${a.textAnswer || '(без відповіді)'}</div>`;
            } else {
                answersBlock = `<div class="answer-options">
                    ${(q.answers || []).map(ans => {
                        const wasSelected = a.selectedIds?.includes(ans.id);
                        const cls = ans.is_correct ? 'correct' : (wasSelected ? 'wrong' : '');
                        return `
                            <div class="answer-option ${cls}" style="cursor:default">
                                <div class="answer-marker">${ans.is_correct ? '✓' : wasSelected ? '✗' : ''}</div>
                                <span class="answer-text">${ans.answer_text}</span>
                            </div>`;
                    }).join('')}
                </div>`;
            }

            return `
                <div class="question-card" style="border-color:${borderColor}">
                    <div class="question-header">
                        <div class="question-num" style="background:${numBg};color:${numColor}">
                            ${a.isCorrect ? '✓' : '✗'}
                        </div>
                        <div>
                            <div class="question-text">${q.question_text}</div>
                            <div class="question-points">${a.isCorrect ? `+${a.pointsEarned} балів` : '0 балів'}</div>
                        </div>
                    </div>
                    ${answersBlock}
                    ${q.explanation ? `<div style="margin-top:.75rem;padding:.75rem;background:var(--bg-raised);border-radius:var(--radius-sm);font-size:.85rem;color:var(--text-secondary)"><i class="fa-solid fa-lightbulb" style="color:var(--warning)"></i> ${q.explanation}</div>` : ''}
                </div>`;
        }).join('');
    },

    // ── Управління тестами ────────────────────────────────────────
    _openTestForm(test, courseId) {
        Modal.open({
            title: test ? '✏️ Редагувати тест' : '+ Створити тест',
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
                <button class="btn btn-primary" onclick="TestsPage.saveTest('${test?.id || ''}')">Зберегти</button>`
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
                            onclick="TestsPage.addQuestion('${testId}')">+ Додати запитання</button>`,
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
                        <button class="btn btn-danger btn-sm" onclick="TestsPage.deleteQuestion('${q.id}')">🗑</button>
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
                    <button class="btn btn-ghost btn-sm" style="margin-top:.75rem" onclick="TestsPage.editQuestion(${JSON.stringify(q).replace(/"/g,'&quot;')})">✏️ Змінити</button>
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
            title: q ? '✏️ Змінити запитання' : '+ Нове запитання',
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
                        + Додати варіант
                    </button>
                </div>
                <input type="hidden" id="qf-test-id" value="${testId}">`,
            footer: `
                <button class="btn btn-secondary" onclick="TestsPage.openQuestionEditor('${testId}')">← Назад</button>
                <button class="btn btn-primary" onclick="TestsPage.saveQuestion('${q?.id || ''}','${testId}')">Зберегти</button>`
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
