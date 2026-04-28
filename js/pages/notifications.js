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

        // Pleasant 3-note chime: C5 → E5 → G5
        const notes = [
            { freq: 523.25, start: 0.00, dur: 0.35 },
            { freq: 659.25, start: 0.18, dur: 0.35 },
            { freq: 783.99, start: 0.36, dur: 0.50 },
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
            gain.gain.linearRampToValueAtTime(0.25, t + 0.04);
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
                this.playSound();
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

        const unread = (items || []).filter(n => !n.is_read).length;

        container.innerHTML = `
<div class="ntf-page">
    <div class="ntf-header">
        <div>
            <h1 class="ntf-title">🔔 Мої сповіщення</h1>
            <p class="ntf-subtitle">${unread ? `<span class="ntf-unread-count">${unread} непрочитаних</span>` : 'Всі прочитано'}</p>
        </div>
        <div style="display:flex;gap:8px">
            ${unread ? `<button class="ntf-btn-outline" onclick="NotificationsPage._markAllRead()">✓ Всі прочитані</button>` : ''}
            <button class="ntf-btn-outline danger" onclick="NotificationsPage._deleteAll()">🗑 Очистити</button>
        </div>
    </div>

    <div class="ntf-filters" id="ntf-filters">
        ${['all','general','gold','tech','system'].map(tp => `
            <button class="ntf-filter-btn${tp==='all'?' active':''}" data-type="${tp}"
                onclick="NotificationsPage._filter(this,'${tp}')">
                ${{ all:'Всі', general:'Загальне', gold:'ЗОЛ', tech:'ТЕХ', system:'Системні' }[tp]}
            </button>`).join('')}
    </div>

    <div id="ntf-list" class="ntf-list">
        ${(items || []).length ? (items || []).map(n => this._renderItem(n)).join('') : this._emptyHtml()}
    </div>
</div>

<style>
.ntf-page { max-width:800px; animation:fadeSlideUp .3s cubic-bezier(.16,1,.3,1); }
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

        return `<div class="ntf-item${n.is_read ? '' : ' unread'}" data-id="${n.id}" data-type="${n.type}" onclick="NotificationsPage._markRead('${n.id}', this)">
            ${!n.is_read ? '<div class="ntf-dot"></div>' : ''}
            <div class="ntf-icon ntf-icon-${n.type}">${typeIcon}</div>
            <div class="ntf-body">
                <div class="ntf-item-title">${n.title}</div>
                <div class="ntf-item-msg">${n.message}</div>
                <div class="ntf-item-meta">
                    <span class="${typeCls}">${typeLabel}</span>
                    <span>від ${sender}</span>
                    <span>·</span>
                    <span>${timeAgo}</span>
                </div>
            </div>
            <div class="ntf-actions" onclick="event.stopPropagation()">
                ${!n.is_read ? `<button class="ntf-act" title="Позначити прочитаним" onclick="NotificationsPage._markRead('${n.id}', this.closest('.ntf-item'))">✓</button>` : ''}
                <button class="ntf-act" title="Видалити" onclick="NotificationsPage._deleteOne('${n.id}', this.closest('.ntf-item'))">🗑</button>
            </div>
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

    async _markRead(id, el) {
        if (el && !el.classList.contains('unread')) return;
        await supabase.from('notifications').update({ is_read: true }).eq('id', id);
        if (el) {
            el.classList.remove('unread');
            el.querySelector('.ntf-dot')?.remove();
            el.querySelector('[title="Позначити прочитаним"]')?.remove();
        }
        UI.updateNotificationBadge(-1);
    },

    async _markAllRead() {
        await supabase.from('notifications').update({ is_read: true }).eq('user_id', AppState.user.id).eq('is_read', false);
        document.querySelectorAll('.ntf-item.unread').forEach(el => {
            el.classList.remove('unread');
            el.querySelector('.ntf-dot')?.remove();
            el.querySelector('[title="Позначити прочитаним"]')?.remove();
        });
        document.querySelector('.ntf-unread-count')?.closest('p')
            ?.replaceWith(Object.assign(document.createElement('p'), { className: 'ntf-subtitle', textContent: 'Всі прочитано' }));
        document.querySelector('[onclick*="markAllRead"]')?.remove();
        UI.updateNotificationBadge(0, true);
        this.stopReminder();
    },

    async _deleteOne(id, el) {
        await supabase.from('notifications').delete().eq('id', id);
        const wasUnread = el?.classList.contains('unread');
        el?.remove();
        if (wasUnread) UI.updateNotificationBadge(-1);
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
            el.classList.toggle('hidden', type !== 'all' && el.dataset.type !== type);
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
