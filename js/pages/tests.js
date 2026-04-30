// ================================================================
// EduFlow LMS — Тести (проходження + управління)
// ================================================================

const TestsPage = {
    _test: null,
    _attempt: null,
    _answers: {},
    _startTime: null,
    _timer: null,

    async init(container, params) {
        const testId = params.id;
        UI.setBreadcrumb([{ label: 'Курси', route: 'courses' }, { label: 'Тест' }]);
        container.innerHTML = `<div style="display:flex;justify-content:center;padding:3rem"><div class="spinner"></div></div>`;

        try {
            const test = await API.tests.getById(testId);
            this._test = test;
            UI.setBreadcrumb([
                { label: 'Курси', route: 'courses' },
                { label: test.course?.title || 'Курс', route: `courses/${test.course_id}` },
                { label: test.title }
            ]);

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

        container.innerHTML = `
            <div class="test-container">
                <div class="card">
                    <div class="card-header">
                        <h2>📝 ${test.title}</h2>
                        <button class="btn btn-ghost btn-sm" onclick="Router.go('courses/${test.course_id}')">← Назад до курсу</button>
                    </div>
                    <div class="card-body">
                        ${test.description  ? `<p style="color:var(--text-secondary);margin-bottom:1.5rem">${test.description}</p>` : ''}
                        ${test.instructions ? `
                            <div style="background:var(--bg-raised);border:1px solid var(--border);border-radius:var(--radius-md);padding:1rem;margin-bottom:1.5rem">
                                <strong>📋 Інструкції:</strong><br>
                                <span style="color:var(--text-secondary)">${test.instructions}</span>
                            </div>` : ''}

                        <div class="stats-grid" style="grid-template-columns:repeat(auto-fill,minmax(160px,1fr));margin-bottom:1.5rem">
                            ${[
                                { icon:'❓', label:'Запитань',         value: test.questions?.length || 0 },
                                { icon:'🎯', label:'Прохідний бал',    value: test.passing_score + '%' },
                                { icon:'🔄', label:'Спроб залишилось', value: attemptsLeft === null ? '∞' : attemptsLeft },
                                { icon:'⏱', label:'Час',               value: test.time_limit_minutes ? test.time_limit_minutes + ' хв' : 'Без ліміту' }
                            ].map(s => `
                                <div class="stat-card" style="padding:1rem">
                                    <div style="font-size:1.5rem;margin-bottom:.25rem">${s.icon}</div>
                                    <div style="font-size:1.25rem;font-weight:700">${s.value}</div>
                                    <div class="stat-label">${s.label}</div>
                                </div>`).join('')}
                        </div>

                        ${best ? `
                            <div style="background:${best.passed ? 'rgba(16,185,129,.1)' : 'rgba(239,68,68,.1)'};border:1px solid ${best.passed ? 'rgba(16,185,129,.3)' : 'rgba(239,68,68,.3)'};border-radius:var(--radius-md);padding:1rem;margin-bottom:1.5rem">
                                <strong>Ваш найкращий результат:</strong>
                                <span style="margin-left:1rem;font-size:1.25rem;font-weight:700;color:${best.passed ? 'var(--success)' : 'var(--danger)'}">${Math.round(best.percentage||0)}%</span>
                                <span class="badge ${best.passed ? 'badge-success' : 'badge-danger'}" style="margin-left:.5rem">${best.passed ? 'Зараховано' : 'Не зараховано'}</span>
                            </div>` : ''}

                        ${completedAttempts.length ? `
                            <details style="margin-bottom:1.5rem">
                                <summary style="cursor:pointer;color:var(--text-muted);font-size:.875rem">Історія спроб (${completedAttempts.length})</summary>
                                <div class="table-wrapper" style="margin-top:.75rem">
                                    <table>
                                        <thead><tr><th>#</th><th>Дата</th><th>Результат</th><th>Час</th><th>Статус</th></tr></thead>
                                        <tbody>
                                            ${completedAttempts.map(a => `
                                                <tr>
                                                    <td>${a.attempt_number}</td>
                                                    <td style="color:var(--text-muted)">${Fmt.datetime(a.completed_at)}</td>
                                                    <td><strong>${Math.round(a.percentage||0)}%</strong></td>
                                                    <td style="color:var(--text-muted)">${a.time_spent_seconds ? Math.floor(a.time_spent_seconds/60)+' хв' : '—'}</td>
                                                    <td><span class="badge ${a.passed ? 'badge-success' : 'badge-danger'}">${a.passed ? 'Зараховано' : 'Не зараховано'}</span></td>
                                                </tr>`).join('')}
                                        </tbody>
                                    </table>
                                </div>
                            </details>` : ''}

                        ${canAttempt
                            ? `<button class="btn btn-primary btn-lg btn-full" onclick="TestsPage.startTest()">🚀 Розпочати тест</button>`
                            : `<div class="empty-state" style="padding:1rem"><p style="color:var(--danger)">Ви вичерпали всі спроби для цього тесту</p></div>`}
                    </div>
                </div>
            </div>`;
    },

    async startTest() {
        Loader.show();
        try {
            this._attempt   = await API.attempts.create(this._test.id);
            this._answers   = {};
            this._startTime = Date.now();

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
        const questions = this._questions;

        container.innerHTML = `
            <div class="test-container" id="test-taking">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1.5rem">
                    <h2>📝 ${this._test.title}</h2>
                    <div style="display:flex;align-items:center;gap:1rem">
                        ${this._test.time_limit_minutes ? `
                            <div id="timer" style="font-size:1.25rem;font-weight:700;color:var(--primary);background:var(--bg-raised);padding:.5rem 1rem;border-radius:var(--radius-md)">⏱ --:--</div>` : ''}
                        <button class="btn btn-secondary" onclick="TestsPage.cancelTest()">Скасувати</button>
                    </div>
                </div>

                <div class="test-progress-bar">
                    <div class="progress-bar"><div class="progress-fill" id="test-prog-fill" style="width:0%"></div></div>
                    <span class="test-progress-text" id="test-prog-text">0 / ${questions.length}</span>
                </div>

                <div id="questions-area">
                    ${questions.map((q, i) => this._renderQuestion(q, i)).join('')}
                </div>

                <div style="display:flex;justify-content:flex-end;margin-top:2rem">
                    <button class="btn btn-primary btn-lg" onclick="TestsPage.submitTest()">✓ Завершити тест</button>
                </div>
            </div>`;

        container.addEventListener('change', () => this._updateProgress());
    },

    _renderQuestion(q, i) {
        const isMultiple = q.question_type === 'multiple';
        return `
            <div class="question-card" id="q-${q.id}">
                <div class="question-header">
                    <div class="question-num">${i + 1}</div>
                    <div>
                        <div class="question-text">${q.question_text}</div>
                        <div class="question-points">${q.points} бал(ів) ${isMultiple ? '• Кілька відповідей' : '• Одна відповідь'}</div>
                    </div>
                </div>
                <div class="answer-options">
                    ${q.answers.map(a => `
                        <label class="answer-option" for="ans-${a.id}">
                            <div class="answer-marker"></div>
                            <input type="${isMultiple ? 'checkbox' : 'radio'}"
                                   id="ans-${a.id}" name="q-${q.id}" value="${a.id}" style="display:none"
                                   onchange="TestsPage.onAnswer('${q.id}','${a.id}',${isMultiple})">
                            <span class="answer-text">${a.answer_text}</span>
                        </label>`).join('')}
                </div>
            </div>`;
    },

    onAnswer(questionId, answerId, isMultiple) {
        if (isMultiple) {
            if (!this._answers[questionId]) this._answers[questionId] = [];
            const idx = this._answers[questionId].indexOf(answerId);
            if (idx > -1) this._answers[questionId].splice(idx, 1);
            else          this._answers[questionId].push(answerId);
        } else {
            this._answers[questionId] = [answerId];
        }
        const questionEl = document.getElementById(`q-${questionId}`);
        questionEl?.querySelectorAll('.answer-option').forEach(opt => {
            const input = opt.querySelector('input');
            opt.classList.toggle('selected', input?.checked || false);
            opt.querySelector('.answer-marker').textContent = input?.checked ? '✓' : '';
        });
        this._updateProgress();
    },

    _updateProgress() {
        const answered = Object.keys(this._answers).length;
        const total    = this._questions.length;
        const pct      = total ? (answered / total * 100) : 0;
        const fill = document.getElementById('test-prog-fill');
        const text = document.getElementById('test-prog-text');
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
            el.textContent = `⏱ ${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
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
            const answered = Object.keys(this._answers).length;
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
            this._renderResult(result, timeSpent);
        } catch(e) { Toast.error('Помилка', e.message); }
        finally { Loader.hide(); }
    },

    _grade() {
        let score = 0, maxScore = 0;
        const answers = [];
        for (const q of this._questions) {
            const correctIds  = q.answers.filter(a => a.is_correct).map(a => a.id);
            const selectedIds = this._answers[q.id] || [];
            maxScore += q.points;
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
                    </div>
                </div>
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
            return `
                <div class="question-card" style="border-color:${a.isCorrect ? 'rgba(16,185,129,.4)' : 'rgba(239,68,68,.4)'}">
                    <div class="question-header">
                        <div class="question-num" style="background:${a.isCorrect ? 'rgba(16,185,129,.15)' : 'rgba(239,68,68,.15)'};color:${a.isCorrect ? 'var(--success)' : 'var(--danger)'}">
                            ${a.isCorrect ? '✓' : '✗'}
                        </div>
                        <div>
                            <div class="question-text">${q.question_text}</div>
                            <div class="question-points">${a.isCorrect ? `+${a.pointsEarned} балів` : '0 балів'}</div>
                        </div>
                    </div>
                    <div class="answer-options">
                        ${q.answers.map(ans => {
                            const wasSelected = a.selectedIds?.includes(ans.id);
                            const cls = ans.is_correct ? 'correct' : (wasSelected ? 'wrong' : '');
                            return `
                                <div class="answer-option ${cls}" style="cursor:default">
                                    <div class="answer-marker">${ans.is_correct ? '✓' : wasSelected ? '✗' : ''}</div>
                                    <span class="answer-text">${ans.answer_text}</span>
                                </div>`;
                        }).join('')}
                    </div>
                    ${q.explanation ? `<div style="margin-top:.75rem;padding:.75rem;background:var(--bg-raised);border-radius:var(--radius-sm);font-size:.85rem;color:var(--text-secondary)">💡 ${q.explanation}</div>` : ''}
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
