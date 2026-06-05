// ================================================================
// EduFlow LMS — Мої сповіщення
// Access: all authenticated users
//
// SQL (run once in Supabase SQL Editor):
// ----------------------------------------------------------------
// CREATE TABLE IF NOT EXISTS notifications (
//   id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
//   user_id    uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
//   title      text NOT NULL,
//   message    text NOT NULL,
//   type       text NOT NULL DEFAULT 'general'
//                CHECK (type IN ('gold','tech','general','system')),
//   is_read    boolean NOT NULL DEFAULT false,
//   created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
//   task_id    uuid REFERENCES scheduled_notifications(id) ON DELETE SET NULL,
//   created_at timestamptz DEFAULT now()
// );
// ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
//
// -- Run this block to fix all policies:
// DROP POLICY IF EXISTS "own_notifications"  ON notifications;
// DROP POLICY IF EXISTS "read_notifications" ON notifications;
// DROP POLICY IF EXISTS "admins_insert"      ON notifications;
//
// -- SELECT: own rows + admins/senders see what they sent
// CREATE POLICY "ntf_select" ON notifications FOR SELECT
//   USING (
//     user_id = auth.uid()
//     OR created_by = auth.uid()
//     OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('owner','admin','manager'))
//   );
// -- INSERT: admins/managers only
// CREATE POLICY "ntf_insert" ON notifications FOR INSERT
//   WITH CHECK (EXISTS (
//     SELECT 1 FROM profiles WHERE id = auth.uid()
//     AND role IN ('owner','admin','manager')
//   ));
// -- UPDATE: users can mark their own as read
// CREATE POLICY "ntf_update" ON notifications FOR UPDATE
//   USING (user_id = auth.uid())
//   WITH CHECK (user_id = auth.uid());
// -- DELETE: users can delete their own
// CREATE POLICY "ntf_delete" ON notifications FOR DELETE
//   USING (user_id = auth.uid());
// ================================================================

const NotificationsPage = {

    _realtimeSub:  null,
    _reminderTimer: null,
    _audioCtx:     null,
    _audioUnlocked: false,

    // ── Sound ────────────────────────────────────────────────────

    _initAudio() {
        if (this._audioCtx) return;
        this._audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        // Unlock audio on first user interaction (browser policy)
        const unlock = () => {
            if (this._audioUnlocked) return;
            this._audioCtx.resume().then(() => { this._audioUnlocked = true; });
            document.removeEventListener('click',     unlock);
            document.removeEventListener('keydown',   unlock);
            document.removeEventListener('touchstart', unlock);
        };
        document.addEventListener('click',     unlock);
        document.addEventListener('keydown',   unlock);
        document.addEventListener('touchstart', unlock);
    },

    playSound() {
        this._initAudio();
        const ctx = this._audioCtx;
        if (!ctx || ctx.state === 'suspended') return;

        // QIP-style: two quick high tones (ding-ding)
        const notes = [
            { freq: 1200, start: 0.00, dur: 0.18 },
            { freq: 1400, start: 0.16, dur: 0.22 },
        ];
        notes.forEach(({ freq, start, dur }) => {
            const osc  = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = 'sine';
            osc.frequency.value = freq;
            const t = ctx.currentTime + start;
            gain.gain.setValueAtTime(0, t);
            gain.gain.linearRampToValueAtTime(0.18, t + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
            osc.start(t);
            osc.stop(t + dur);
        });
    },

    playMessageSound() {
        try {
            const audio = new Audio('/sound/monkey.mp3');
            audio.volume = 0.6;
            audio.play().catch(() => {});
        } catch(e) {}
    },

    playBirthdaySound() {
        this._initAudio();
        const ctx = this._audioCtx;
        if (!ctx || ctx.state === 'suspended') return;

        // Святковий фанфар: до-мі-соль-до↑ + трель
        const notes = [
            { freq: 523.25, start: 0.00, dur: 0.18 },  // C5
            { freq: 659.25, start: 0.16, dur: 0.18 },  // E5
            { freq: 783.99, start: 0.32, dur: 0.18 },  // G5
            { freq: 1046.5, start: 0.48, dur: 0.40 },  // C6 — довша фінальна
            { freq: 1174.7, start: 0.52, dur: 0.15 },  // D6 — трель
            { freq: 1046.5, start: 0.60, dur: 0.15 },
            { freq: 1174.7, start: 0.68, dur: 0.15 },
            { freq: 1046.5, start: 0.76, dur: 0.30 },
        ];
        notes.forEach(({ freq, start, dur }) => {
            const osc  = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = 'triangle';
            osc.frequency.value = freq;
            const t = ctx.currentTime + start;
            gain.gain.setValueAtTime(0, t);
            gain.gain.linearRampToValueAtTime(0.22, t + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
            osc.start(t);
            osc.stop(t + dur);
        });
    },

    // ── Reminder every 5 min while unread exist ──────────────────

    startReminder() {
        this.stopReminder();
        this._reminderTimer = setInterval(async () => {
            if (!AppState.user?.id) { this.stopReminder(); return; }
            const { count } = await supabase
                .from('notifications')
                .select('id', { count: 'exact', head: true })
                .eq('user_id', AppState.user.id)
                .eq('is_read', false);
            if (count > 0) {
                this.playMessageSound();
                Toast.info('🔔 Нагадування', `У вас ${count} непрочитаних сповіщень`);
            } else {
                this.stopReminder();
            }
        }, 5 * 60 * 1000); // 5 minutes
    },

    stopReminder() {
        if (this._reminderTimer) {
            clearInterval(this._reminderTimer);
            this._reminderTimer = null;
        }
    },

    // ── Page init ────────────────────────────────────────────────

    async init(container) {
        UI.setBreadcrumb([{ label: 'Мої сповіщення' }]);
        container.innerHTML = `<div style="display:flex;justify-content:center;padding:3rem"><div class="spinner"></div></div>`;
        await this._render(container);
        this._subscribeRealtime(container);
    },

    async _render(container) {
        const { data: items, error } = await supabase
            .from('notifications')
            .select('*, sender:profiles!created_by(full_name, avatar_url)')
            .eq('user_id', AppState.user.id)
            .order('created_at', { ascending: false })
            .limit(100);

        if (error) { container.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><h3>${error.message}</h3></div>`; return; }

        // Непрочитані вгорі, прочитані внизу
        const sorted = [...(items || [])].sort((a, b) => {
            if (a.is_read === b.is_read) return new Date(b.created_at) - new Date(a.created_at);
            return a.is_read ? 1 : -1;
        });
        container.innerHTML = `
<div class="ntf-page">
    <div class="ntf-header">
        <div>
            <h1 class="ntf-title">🔔 Мої сповіщення</h1>
            <p class="ntf-subtitle">Всі прочитано</p>
        </div>
        <div style="display:flex;gap:8px">
            <button class="ntf-btn-outline" onclick="NotificationsPage._markAllRead()"><i class="fa-solid fa-check-double"></i> Прочитати всі</button>
            <button class="ntf-btn-outline danger" onclick="NotificationsPage._deleteAll()"><i class="fa-solid fa-trash"></i> Очистити</button>
        </div>
    </div>


    <div class="ntf-filters" id="ntf-filters">
        ${['all','general','gold','tech','system'].map(tp => `
            <button class="ntf-filter-btn${tp==='all'?' active':''}" data-type="${tp}"
                onclick="NotificationsPage._filter(this,'${tp}')">
                ${{ all:'Всі', general:'Загальне', gold:'ЗОЛ', tech:'ТЕХ', system:'Системні' }[tp]}
            </button>`).join('')}
        ${AppState.isAdmin() ? `<button class="ntf-filter-btn" data-type="ip" onclick="NotificationsPage._filter(this,'ip')"><i class="fa-solid fa-shield-halved" style="margin-right:.3rem"></i>IP-запити</button>` : ''}
    </div>

    <div id="ntf-list" class="ntf-list">
        ${sorted.length ? sorted.map(n => this._renderItem(n)).join('') : this._emptyHtml()}
    </div>
</div>

<style>
.ntf-page { max-width:1150px; animation:fadeSlideUp .3s cubic-bezier(.16,1,.3,1); }
@keyframes fadeSlideUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
.ntf-header { display:flex;align-items:flex-start;justify-content:space-between;gap:1rem;margin-bottom:1.25rem;flex-wrap:wrap; }
.ntf-title { margin:0;font-size:1.8rem;font-weight:700;color:var(--text-primary);letter-spacing:-.02em; }
.ntf-subtitle { margin:.2rem 0 0;color:var(--text-muted);font-size:.9rem; }
.ntf-unread-count { color:var(--primary);font-weight:600; }
.ntf-btn-outline { display:flex;align-items:center;gap:6px;padding:8px 16px;background:transparent;border:1.5px solid var(--border);border-radius:40px;color:var(--text-secondary);font-size:.85rem;font-weight:500;cursor:pointer;transition:all .15s;white-space:nowrap; }
.ntf-btn-outline:hover { background:var(--bg-hover);border-color:var(--border-light); }
.ntf-btn-outline.danger:hover { border-color:var(--danger);color:var(--danger); }
.ntf-filters { display:flex;gap:4px;background:var(--bg-raised);border-radius:40px;padding:3px;margin-bottom:1rem;width:fit-content; }
.ntf-filter-btn { padding:6px 16px;border:none;border-radius:40px;background:transparent;color:var(--text-secondary);font-size:.82rem;font-weight:500;cursor:pointer;transition:all .15s;white-space:nowrap; }
.ntf-filter-btn.active { background:var(--bg-surface);color:var(--primary);font-weight:600;box-shadow:0 1px 4px rgba(0,0,0,.12); }
.ntf-list { display:flex;flex-direction:column;gap:8px; }
.ntf-item { display:flex;align-items:flex-start;gap:14px;padding:16px 18px;background:var(--bg-surface);border:1px solid var(--border);border-radius:16px;box-shadow:var(--shadow-sm);transition:all .15s;cursor:pointer;position:relative; }
.ntf-item:hover { box-shadow:var(--shadow-md);border-color:var(--border-light); }
.ntf-item.unread { border-left:3px solid var(--primary);background:color-mix(in srgb, var(--bg-surface) 97%, var(--primary)); }
@keyframes ntf-blink{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.3;transform:scale(.7)}}
.ntf-unread-badge{position:absolute;top:14px;right:14px;width:9px;height:9px;border-radius:50%;background:#ef4444;box-shadow:0 0 6px rgba(239,68,68,.6);animation:ntf-blink 1.2s ease-in-out infinite}
.ntf-item.hidden { display:none; }
.ntf-dot { position:absolute;top:16px;right:16px;width:8px;height:8px;border-radius:50%;background:var(--primary); }
.ntf-icon { width:42px;height:42px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:1.2rem;flex-shrink:0; }
.ntf-icon-general { background:rgba(99,102,241,.12); }
.ntf-icon-gold    { background:rgba(245,158,11,.12); }
.ntf-icon-tech    { background:rgba(16,185,129,.12); }
.ntf-icon-system  { background:rgba(156,163,175,.12); }
.ntf-body { flex:1;min-width:0; }
.ntf-item-title { font-weight:600;color:var(--text-primary);margin-bottom:4px;font-size:.95rem; }
.ntf-item-msg { color:var(--text-secondary);font-size:.875rem;line-height:1.5;margin-bottom:6px;white-space:pre-wrap; }
.ntf-item-meta { display:flex;align-items:center;gap:10px;font-size:.75rem;color:var(--text-muted); }
.ntf-type-chip { padding:2px 8px;border-radius:40px;font-weight:600;font-size:.7rem; }
.ntf-actions { display:flex;gap:4px;opacity:0;transition:opacity .15s; }
.ntf-item:hover .ntf-actions { opacity:1; }
.ntf-act { width:28px;height:28px;border:none;border-radius:8px;background:var(--bg-raised);color:var(--text-muted);cursor:pointer;font-size:.8rem;display:flex;align-items:center;justify-content:center;transition:all .12s; }
.ntf-act:hover { background:var(--bg-hover);color:var(--text-primary); }
</style>`;
    },

    _renderItem(n) {
        const typeIcon  = { general:'🔔', gold:'🏆', tech:'🔧', system:'⚙️' }[n.type] || '🔔';
        const typeLabel = { general:'Загальне', gold:'ЗОЛ', tech:'ТЕХ', system:'Система' }[n.type] || '';
        const typeCls   = `ntf-type-chip sch-type-${n.type === 'system' ? 'general' : n.type}`;
        const timeAgo   = this._timeAgo(n.created_at);
        const sender    = n.sender?.full_name || 'Система';

        const clickHandler = `NotificationsPage._openItem('${n.id}',${n.link ? JSON.stringify(n.link).replace(/"/g,'&quot;') : 'null'},this)`;
        const isIpReq = !!(n.message?.includes('з IP:'));
        return `<div class="ntf-item ntf-item-clickable${!n.is_read ? ' unread' : ''}" data-id="${n.id}" data-type="${n.type}" data-is-ip="${isIpReq}" onclick="${clickHandler}">
            ${!n.is_read ? '<span class="ntf-unread-badge" id="ntf-badge-' + n.id + '"></span>' : ''}
            <div class="ntf-icon ntf-icon-${n.type}">${typeIcon}</div>
            <div class="ntf-body">
                <div class="ntf-item-title">${Fmt.esc(n.title)}</div>
                <div class="ntf-item-msg">${(() => {
                    if (AppState.isAdmin() && n.message?.includes('з IP:')) {
                        const ip = (n.message.match(/з IP:\s*([\d.:\w]+)/) || [])[1] || '';
                        if (ip) {
                            const before = Fmt.esc(n.message.replace(`з IP: ${ip}`, '').trim());
                            return `${before} з IP: <span style="font-family:monospace;font-weight:700;color:var(--text-primary)">${Fmt.esc(ip)}</span><button title="Скопіювати IP" data-ip="${Fmt.esc(ip)}" onclick="event.stopPropagation();navigator.clipboard.writeText(this.dataset.ip).then(()=>{this.innerHTML='<i class=\\'fa-solid fa-check\\' style=\\'color:#10b981\\'></i>';setTimeout(()=>this.innerHTML='<i class=\\'fa-regular fa-copy\\'></i>',1500)})" style="background:none;border:none;cursor:pointer;color:var(--text-muted);padding:.1rem .3rem;border-radius:4px;vertical-align:middle;line-height:1;margin-left:.25rem"><i class="fa-regular fa-copy"></i></button>`;
                        }
                    }
                    return Fmt.esc(n.message || '');
                })()}</div>
                <div class="ntf-item-meta">
                    <span class="${typeCls}">${typeLabel}</span>
                    <span>від ${Fmt.esc(sender)}</span>
                    <span>·</span>
                    <span>${timeAgo}</span>
                </div>
            </div>
            <div class="ntf-actions" onclick="event.stopPropagation()">
                <button class="ntf-act" title="Видалити" onclick="NotificationsPage._deleteOne('${n.id}', this.closest('.ntf-item'))"><i class="fa-solid fa-trash"></i></button>
            </div>
            ${n.link ? `<i class="fa-solid fa-chevron-right" style="font-size:.6rem;color:var(--text-muted);align-self:center;flex-shrink:0"></i>` : ''}
        </div>`;
    },

    _emptyHtml() {
        return `<div style="text-align:center;padding:4rem 2rem;color:var(--text-muted)">
            <div style="font-size:3.5rem;margin-bottom:1rem">📭</div>
            <div style="font-size:1.1rem;font-weight:500;color:var(--text-secondary)">Сповіщень немає</div>
            <div style="font-size:.875rem;margin-top:.5rem">Тут з'являться повідомлення від керівника або системи</div>
        </div>`;
    },

    // ── Actions ──────────────────────────────────────────────────

    async _markAllRead() {
        await supabase.from('notifications')
            .update({ is_read: true })
            .eq('user_id', AppState.user.id)
            .eq('is_read', false)
            .catch(() => {});
        UI.updateNotificationBadge(0, true);
        this.stopReminder();
        // Оновлюємо UI — прибираємо точки непрочитаних
        document.querySelectorAll('.ntf-unread-badge').forEach(el => el.remove());
        document.querySelectorAll('.ntf-item').forEach(el => el.classList.remove('unread'));
        Toast.success('Готово', 'Всі сповіщення позначено як прочитані');
    },

    async _markRead(id) {
        await supabase.from('notifications').update({ is_read: true }).eq('id', id);
        const el = document.getElementById(`ntf-${id}`);
        el?.classList.remove('unread');
        document.getElementById(`ntf-badge-${id}`)?.remove();
        UI.updateNotificationBadge(-1);
    },

    async _openItem(id, link, el) {
        const item = el.closest('.ntf-item');
        if (item?.classList.contains('unread')) {
            try { await supabase.from('notifications').update({ is_read: true }).eq('id', id); } catch(_) {}
            item.classList.remove('unread');
            item.querySelector('.ntf-unread-badge')?.remove();
            UI.updateNotificationBadge(-1);
            // Переміщуємо в кінець списку
            const list = document.getElementById('ntf-list');
            if (list && item) list.appendChild(item);
        }
        if (link) Router.go(link);
    },

    async _deleteOne(id, el) {
        await supabase.from('notifications').delete().eq('id', id);
        el?.remove();
        if (!document.querySelector('.ntf-item')) {
            document.getElementById('ntf-list').innerHTML = this._emptyHtml();
        }
    },

    async _deleteAll() {
        const ok = await Modal.confirm({ title: 'Очистити всі сповіщення?', message: 'Всі сповіщення будуть видалені.', confirmText: 'Очистити', danger: true });
        if (!ok) return;
        await supabase.from('notifications').delete().eq('user_id', AppState.user.id);
        document.getElementById('ntf-list').innerHTML = this._emptyHtml();
        UI.updateNotificationBadge(0, true);
        this.stopReminder();
    },

    // ── Filter ───────────────────────────────────────────────────

    _filter(btn, type) {
        document.querySelectorAll('.ntf-filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.querySelectorAll('.ntf-item').forEach(el => {
            if (type === 'all') el.classList.remove('hidden');
            else if (type === 'ip') el.classList.toggle('hidden', el.dataset.isIp !== 'true');
            else el.classList.toggle('hidden', el.dataset.type !== type);
        });
    },

    // ── Realtime ─────────────────────────────────────────────────

    _subscribeRealtime(container) {
        this._realtimeSub?.unsubscribe();
        this._realtimeSub = supabase
            .channel('notifications-' + AppState.user.id)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'notifications',
                filter: `user_id=eq.${AppState.user.id}`
            }, payload => {
                const n = payload.new;
                const list = document.getElementById('ntf-list');
                if (list) {
                    const empty = list.querySelector('div[style*="padding:4rem"]');
                    if (empty) list.innerHTML = '';
                    list.insertAdjacentHTML('afterbegin', this._renderItem(n));
                }
                UI.updateNotificationBadge(1);
                this._showToastNotification(n);
            })
            .subscribe();
    },

    _showToastNotification(n) {
        const icon = { general:'🔔', gold:'🏆', tech:'🔧', system:'⚙️' }[n.type] || '🔔';
        Toast.info(`${icon} ${n.title}`, n.message.slice(0, 80) + (n.message.length > 80 ? '…' : ''));
        this.playSound();
        if (!this._reminderTimer) this.startReminder();
    },

    destroy() {
        this._realtimeSub?.unsubscribe();
        this._realtimeSub = null;
        // Do NOT stop reminder on page leave — keep reminding until read
    },

    // ── Helpers ──────────────────────────────────────────────────

    _timeAgo(iso) {
        const diff = Date.now() - new Date(iso).getTime();
        const m = Math.floor(diff / 60000);
        if (m < 1)  return 'щойно';
        if (m < 60) return `${m} хв тому`;
        const h = Math.floor(m / 60);
        if (h < 24) return `${h} год тому`;
        const d = Math.floor(h / 24);
        if (d < 7)  return `${d} дн тому`;
        return new Date(iso).toLocaleDateString('uk-UA', { day: '2-digit', month: 'short' });
    },

    // ── Static: send notifications (called by scheduler) ─────────

    async send(userIds, { title, message, type = 'general', taskId = null, createdBy = null } = {}) {
        if (!userIds?.length) return;
        const rows = userIds.map(uid => ({
            user_id:    uid,
            title,
            message,
            type,
            task_id:    taskId,
            created_by: createdBy || AppState.user?.id,
        }));
        const { error } = await supabase.from('notifications').insert(rows);
        if (error) console.error('[Notifications.send]', error.message);
        return !error;
    }
};
