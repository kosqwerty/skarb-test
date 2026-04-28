// ================================================================
// EduFlow LMS — Сторінки (Custom Pages) з HTML/CSS редактором
// ================================================================

const CollectionsPage = {

    _navHandler: null,
    _themeHandler: null,
    _pageTrail: [],      // history of pages visited via in-page links
    _currentPage: null,  // page currently displayed

    // ── List ─────────────────────────────────────────────────────
    async init(container) {
        if (this._navHandler) {
            window.removeEventListener('message', this._navHandler);
            this._navHandler = null;
        }
        if (this._themeHandler) {
            window.removeEventListener('lms-theme-change', this._themeHandler);
            this._themeHandler = null;
        }
        this._pageTrail  = [];
        this._currentPage = null;
        UI.setBreadcrumb([{ label: 'Меню порталу' }]);

        // Звичайний юзер → одразу відкриває головну сторінку
        if (!AppState.isStaff()) {
            container.innerHTML = `<div style="display:flex;justify-content:center;padding:3rem"><div class="spinner"></div></div>`;
            try {
                const pages = await API.pages.getAll();
                const home = pages.find(p => p.is_home && p.is_published)
                           || pages.find(p => p.is_published);
                if (home) {
                    Router.go(`collections/${home.id}`);
                } else {
                    container.innerHTML = `<div class="empty-state"><div class="empty-icon">🖥</div><h3>Сторінок поки немає</h3></div>`;
                }
            } catch(e) {
                container.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><h3>${e.message}</h3></div>`;
            }
            return;
        }

        container.innerHTML = `
            <div class="page-header">
                <div class="page-title">
                    <h1>🖥 Меню порталу</h1>
                    <p>Власні HTML-сторінки з довільним стилем та посиланнями.</p>
                </div>
                <div class="page-actions">
                    <button class="btn btn-primary" onclick="CollectionsPage.openEditor()">+ Нова сторінка</button>
                </div>
            </div>
            <div id="pages-list"></div>`;
        await this._loadList();
    },

    async _loadList() {
        const el = document.getElementById('pages-list');
        if (!el) return;
        el.innerHTML = `<div style="display:flex;justify-content:center;padding:3rem"><div class="spinner"></div></div>`;
        try {
            const pages = await API.pages.getAll();
            const userLabel = AppState.profile?.label;
            const visible = AppState.isStaff()
                ? pages
                : pages.filter(p => {
                    if (!p.is_published) return false;
                    if (!p.allowed_labels?.length) return true;
                    return userLabel && p.allowed_labels.includes(userLabel);
                });
            if (!visible.length) {
                el.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-icon">🖥</div>
                        <h3>Сторінок поки немає</h3>
                        ${AppState.isStaff() ? '<p>Створіть першу сторінку.</p>' : ''}
                    </div>`;
                return;
            }
            el.innerHTML = `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:1.25rem">
                ${visible.map(p => this._renderCard(p)).join('')}
            </div>`;
        } catch (e) {
            el.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><h3>${e.message}</h3></div>`;
        }
    },

    _renderCard(p) {
        const badge = p.is_published
            ? `<span style="font-size:.7rem;padding:2px 8px;border-radius:20px;background:rgba(16,185,129,.15);color:#10b981;border:1px solid rgba(16,185,129,.3)">опубліковано</span>`
            : `<span style="font-size:.7rem;padding:2px 8px;border-radius:20px;background:var(--bg-raised);color:var(--text-muted);border:1px solid var(--border)">чернетка</span>`;

        const homeBadge = p.is_home
            ? `<span style="font-size:.7rem;padding:2px 8px;border-radius:20px;background:rgba(99,102,241,.15);color:var(--primary);border:1px solid rgba(99,102,241,.3)">🏠 Головна</span>`
            : '';

        const adminBtns = AppState.isStaff() ? `
            <div style="display:flex;gap:.4rem" onclick="event.stopPropagation()">
                ${!p.is_home && AppState.isOwner() ? `<button onclick="CollectionsPage.setHome('${p.id}')"
                        style="width:30px;height:30px;border-radius:50%;border:1.5px solid var(--border);background:var(--bg-raised);color:var(--text-secondary);font-size:.85rem;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:border-color var(--transition)"
                        onmouseenter="this.style.borderColor='var(--primary)'"
                        onmouseleave="this.style.borderColor='var(--border)'"
                        title="Зробити головною">🏠</button>` : ''}
                <button onclick="CollectionsPage.openEditor('${p.id}')"
                        style="width:30px;height:30px;border-radius:50%;border:1.5px solid var(--border);background:var(--bg-raised);color:var(--text-secondary);font-size:.85rem;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:border-color var(--transition)"
                        onmouseenter="this.style.borderColor='var(--primary)'"
                        onmouseleave="this.style.borderColor='var(--border)'"
                        title="Редагувати">✏️</button>
                <button onclick="CollectionsPage.deletePage('${p.id}')"
                        style="width:30px;height:30px;border-radius:50%;border:1.5px solid var(--border);background:var(--bg-raised);color:var(--text-secondary);font-size:.85rem;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:border-color var(--transition)"
                        onmouseenter="this.style.borderColor='var(--danger)'"
                        onmouseleave="this.style.borderColor='var(--border)'"
                        title="Видалити">🗑</button>
            </div>` : '';

        return `
            <div onclick="Router.go('collections/${p.id}')"
                 style="background:var(--bg-surface);border:1px solid var(--border);border-radius:var(--radius-lg);padding:1.25rem;cursor:pointer;transition:border-color var(--transition),box-shadow var(--transition)"
                 onmouseenter="this.style.borderColor='var(--primary)';this.style.boxShadow='var(--shadow-md)'"
                 onmouseleave="this.style.borderColor='var(--border)';this.style.boxShadow='none'">
                <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:.5rem;margin-bottom:.75rem">
                    <span style="font-size:1.75rem">🖥</span>
                    <div style="display:flex;align-items:center;gap:.4rem" onclick="event.stopPropagation()">
                        <button class="res-star-btn${Bookmarks.isBookmarked('collections/'+p.id) ? ' active' : ''}"
                            data-bm-route="collections/${p.id}"
                            title="${Bookmarks.isBookmarked('collections/'+p.id) ? 'Видалити з закладок' : 'Зберегти в закладки'}"
                            onclick="Bookmarks.toggleCollection('${p.id}','${p.title.replace(/'/g,"\\'")}')">★</button>
                        ${adminBtns}
                    </div>
                </div>
                <div style="font-weight:600;font-size:.95rem;margin-bottom:.4rem">${p.title}</div>
                ${p.allowed_labels?.length ? `
                <div style="display:flex;flex-wrap:wrap;gap:.3rem;margin-top:.5rem">
                    ${p.allowed_labels.map(l => `<span style="font-size:.7rem;padding:2px 7px;border-radius:20px;background:rgba(99,102,241,.1);color:var(--primary);border:1px solid rgba(99,102,241,.2)">🏷 ${l}</span>`).join('')}
                </div>` : ''}
                <div style="display:flex;align-items:center;gap:.4rem;flex-wrap:wrap;margin-top:.75rem">
                    ${badge}
                    ${homeBadge}
                    <span style="font-size:.75rem;color:var(--text-muted);margin-left:auto">${Fmt.date(p.updated_at || p.created_at)}</span>
                </div>
            </div>`;
    },

    // ── View ──────────────────────────────────────────────────────
    async initView(container, { id } = {}) {
        if (!id) { Router.go('collections'); return; }
        container.innerHTML = `<div style="display:flex;justify-content:center;padding:3rem"><div class="spinner"></div></div>`;
        try {
            const [page, attachments] = await Promise.all([
                API.pages.getById(id),
                API.pageAttachments.getAll(id)
            ]);
            this._attachments = attachments;
            if (!page.is_published && !AppState.isStaff()) {
                Toast.error('Доступ заборонено');
                Router.go('collections');
                return;
            }
            // Label-based access check
            if (!AppState.isStaff() && page.allowed_labels?.length) {
                const userLabel = AppState.profile?.label;
                if (!userLabel || !page.allowed_labels.includes(userLabel)) {
                    container.innerHTML = `
                        <div class="empty-state">
                            <div class="empty-icon">🔒</div>
                            <h3>Доступ обмежено</h3>
                            <p style="color:var(--text-muted)">Ця сторінка доступна лише для певних груп користувачів</p>
                            <button class="btn btn-primary" onclick="Router.back()" style="margin-top:1rem">← Назад</button>
                        </div>`;
                    return;
                }
            }
            this._currentPage = { id: page.id, label: page.title };
            const breadcrumbEl = document.getElementById('breadcrumb');
            if (breadcrumbEl) {
                const parts = this._pageTrail.map((p, i) =>
                    `<a href="javascript:void(0)" onclick="CollectionsPage._trailBack(${i})">${p.label}</a><span>›</span>`
                );
                parts.push(`<span class="current">${page.title}</span>`);
                breadcrumbEl.innerHTML = parts.join('');
            }
            const resolvedHtml = await this._resolveAttachmentUrls(page.html_content || '');
            this._renderView(container, { ...page, html_content: resolvedHtml });
        } catch (e) {
            container.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><h3>${e.message}</h3>
                <button class="btn btn-primary" onclick="Router.go('collections')">← Назад</button></div>`;
        }
    },

    _renderView(container, page) {
        // Remove previous message listener if any
        if (this._navHandler) {
            window.removeEventListener('message', this._navHandler);
            this._navHandler = null;
        }

        const editBtn = AppState.isStaff() ? `
            <button onclick="CollectionsPage.openEditor('${page.id}')"
                    title="Редагувати"
                    style="flex-shrink:0;width:32px;height:32px;border-radius:50%;border:1.5px solid var(--border);background:var(--bg-raised);color:var(--text-secondary);font-size:.9rem;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background var(--transition),border-color var(--transition)"
                    onmouseenter="this.style.background='var(--bg-hover)';this.style.borderColor='var(--primary)'"
                    onmouseleave="this.style.background='var(--bg-raised)';this.style.borderColor='var(--border)'">✏️</button>` : '';

        container.innerHTML = `
            <div style="display:flex;flex-direction:column;gap:1rem">
                <div style="display:flex;align-items:center;gap:.75rem;flex-wrap:wrap">
                    ${page.is_home ? '' : '<button class="btn btn-ghost btn-sm" onclick="Router.back()" style="flex-shrink:0">← Назад</button>'}
                    <div style="display:flex;align-items:center;gap:.5rem;flex:1;min-width:0">
                        <h1 style="margin:0;font-size:1.4rem;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${page.title}</h1>
                        <button class="res-star-btn${Bookmarks.isBookmarked('collections/'+page.id) ? ' active' : ''}"
                            data-bm-route="collections/${page.id}"
                            title="${Bookmarks.isBookmarked('collections/'+page.id) ? 'Видалити з закладок' : 'Зберегти в закладки'}"
                            onclick="Bookmarks.toggleCollection('${page.id}','${page.title.replace(/'/g,"\\'")}')">★</button>
                        ${editBtn}
                    </div>
                </div>
                <div id="page-rendered" style="width:fit-content;max-width:100%">
                    <iframe id="page-iframe" style="width:100%;max-width:100%;border:none;display:block" scrolling="no"
                            sandbox="allow-scripts allow-forms allow-popups allow-top-navigation-by-user-activation"></iframe>
                </div>
            </div>`;

        // Intercept messages from iframe
        this._navHandler = e => {
            if (e.data?.type === 'lms-navigate') {
                if (this._currentPage) this._pageTrail.push(this._currentPage);
                Router.go(e.data.route);
            }
            if (e.data?.type === 'lms-resize') {
                const iframe = document.getElementById('page-iframe');
                if (!iframe) return;
                if (e.data.height > 0) iframe.style.height = e.data.height + 'px';
                if (e.data.width  > 0) iframe.style.width  = e.data.width  + 'px';
            }
        };
        window.addEventListener('message', this._navHandler);

        // Apply dark-mode filter and handle theme changes
        if (this._themeHandler) {
            window.removeEventListener('lms-theme-change', this._themeHandler);
        }
        const applyIframeTheme = (iframe, isLight) => {
            iframe.style.filter = isLight ? '' : 'invert(1) hue-rotate(180deg)';
            if (iframe.contentWindow) {
                iframe.contentWindow.postMessage({ type: 'lms-theme-change', isLight }, '*');
            }
        };
        this._themeHandler = e => {
            const iframe = document.getElementById('page-iframe');
            if (iframe) applyIframeTheme(iframe, e.detail.theme === 'light');
        };
        window.addEventListener('lms-theme-change', this._themeHandler);

        const iframe = document.getElementById('page-iframe');
        this._renderIframe(iframe, page.html_content, page.css_content, true);
        applyIframeTheme(iframe, document.body.classList.contains('light-theme'));
    },

    _renderIframe(iframe, html, css, interceptLinks = false) {
        const iframeScript = `
<script>
(function() {
  window.addEventListener('message', function(e) {
    if (!e.data || e.data.type !== 'lms-theme-change') return;
    document.documentElement.classList.toggle('lms-dark', !e.data.isLight);
  });
  function sendSize(buffer) {
    var last = document.body.lastElementChild;
    var fromContent = last ? last.getBoundingClientRect().bottom + window.scrollY : 0;
    var h = Math.max(document.body.offsetHeight, fromContent) + (buffer || 0);
    var w = Math.max(document.body.scrollWidth, document.body.offsetWidth,
                     document.documentElement.scrollWidth, document.documentElement.offsetWidth);
    if (h > 0) window.parent.postMessage({ type: 'lms-resize', height: h, width: w }, '*');
  }
  var collapseTimer;
  document.addEventListener('mousedown', function() {
    clearTimeout(collapseTimer);
    sendSize(400);
  });
  document.addEventListener('click', function() {
    clearTimeout(collapseTimer);
    collapseTimer = setTimeout(function() { sendSize(0); }, 600);
  });
  document.addEventListener('DOMContentLoaded', function() {
    sendSize(0);
    if (typeof ResizeObserver !== 'undefined') {
      new ResizeObserver(function() { sendSize(0); }).observe(document.body);
    }
  });
  window.addEventListener('load', function() { sendSize(0); });
})();
<\/script>`;

        const linkScript = interceptLinks ? `
<script>
document.addEventListener('click', function(e) {
  var a = e.target.closest('a[href]');
  if (!a) return;
  var href = a.getAttribute('href');
  if (href && href.startsWith('#')) {
    e.preventDefault();
    window.parent.postMessage({ type: 'lms-navigate', route: href.slice(1) }, '*');
  }
});
<\/script>` : '';

        const doc = `<!DOCTYPE html><html><head><meta charset="UTF-8">${iframeScript}
<style>
  @font-face { font-family: 'Fixel Display'; src: url('/font/FixelDisplay-Regular.woff2') format('woff2'); font-weight: 400; }
  @font-face { font-family: 'Fixel Display'; src: url('/font/FixelDisplay-Medium.woff2') format('woff2'); font-weight: 500; }
  @font-face { font-family: 'Fixel Display'; src: url('/font/FixelDisplay-SemiBold.woff2') format('woff2'); font-weight: 600; }
  @font-face { font-family: 'Fixel Display'; src: url('/font/FixelDisplay-Bold.woff2') format('woff2'); font-weight: 700; }
  body { margin: 0; padding: 0; font-family: 'Fixel Display', sans-serif; }
  img, video, canvas, picture, svg { max-width: 100%; }
  /* Re-invert media in dark mode so photos look natural under the iframe filter */
  html.lms-dark img, html.lms-dark video, html.lms-dark canvas, html.lms-dark picture {
    filter: invert(1) hue-rotate(180deg);
  }
  ${css || ''}
</style></head><body>${html || ''}${linkScript}</body></html>`;
        iframe.srcdoc = doc;
        iframe.onload = () => {
            try {
                const d = iframe.contentDocument;
                const last = d.body.lastElementChild;
                const fromContent = last ? last.getBoundingClientRect().bottom : 0;
                const h = Math.max(d.body.offsetHeight, fromContent);
                const w = Math.max(d.body.scrollWidth,  d.body.offsetWidth,  d.documentElement.scrollWidth,  d.documentElement.offsetWidth);
                if (h > 0) iframe.style.height = h + 'px';
                if (w > 0) iframe.style.width  = w + 'px';
            } catch (_) {}
        };
    },

    // ── Editor ────────────────────────────────────────────────────
    _editingPageId: null,
    _attachments:   [],
    _savedCursor:   null,

    async openEditor(id = null) {
        this._editingPageId = id;
        this._attachments   = [];
        this._savedCursor   = null;
        // Create a history entry so Router.back() returns to previous page
        const editHash = '#/' + (id ? `collections/${id}/edit` : 'collections/new');
        if (location.hash !== editHash) history.pushState(null, '', editHash);
        let page = null, attachments = [];
        if (id) {
            Loader.show();
            try {
                [page, attachments] = await Promise.all([
                    API.pages.getById(id),
                    API.pageAttachments.getAll(id)
                ]);
            }
            catch (e) { Toast.error('Помилка', e.message); Loader.hide(); return; }
            finally { Loader.hide(); }
        }

        const container = document.getElementById('page-content');
        UI.setBreadcrumb([
            { label: 'Меню порталу', link: 'collections' },
            { label: id ? 'Редагувати' : 'Нова сторінка' }
        ]);
        container.innerHTML = this._editorHtml(page);
        this._initEditor(page);
        this._renderAttachmentGrid(attachments);
    },

    _editorHtml(page) {
        return `
        <div style="display:flex;flex-direction:column;height:calc(100vh - 120px);gap:0">

            <!-- Top bar -->
            <div style="display:flex;align-items:center;gap:.75rem;padding:.75rem 1rem;background:var(--bg-surface);border:1px solid var(--border);border-radius:var(--radius-lg);margin-bottom:.75rem;flex-wrap:wrap">
                <button class="btn btn-ghost btn-sm" onclick="Router.back()">← Назад</button>
                <input id="page-title-input" type="text" value="${page?.title || ''}" placeholder="Назва сторінки..."
                       style="flex:1;min-width:160px;font-size:1rem;font-weight:600;border:none;background:transparent;color:var(--text-primary);outline:none">
                <label style="display:flex;align-items:center;gap:.4rem;font-size:.85rem;color:var(--text-secondary);cursor:pointer;flex-shrink:0">
                    <input type="checkbox" id="page-published" ${page?.is_published ? 'checked' : ''}>
                    Опублікувати
                </label>
                <div style="display:flex;align-items:center;gap:.4rem;flex-shrink:0" title="Мітки доступу (через кому). Порожньо = всі користувачі.">
                    <span style="font-size:.8rem;color:var(--text-muted);white-space:nowrap">🏷 Мітки:</span>
                    <input id="page-labels" type="text"
                           value="${(page?.allowed_labels || []).join(', ')}"
                           placeholder="Техніка, Золото, ..."
                           style="width:160px;font-size:.8rem;padding:4px 8px;border-radius:var(--radius-md);border:1px solid var(--border);background:var(--bg-raised);color:var(--text-primary);outline:none">
                </div>
                <button class="btn btn-ghost btn-sm" onclick="CollectionsPage._insertResourceLink()">+ Ресурс</button>
                <button class="btn btn-secondary btn-sm" onclick="CollectionsPage._openPreviewModal()">👁 Перегляд</button>
                <button class="btn btn-primary btn-sm" onclick="CollectionsPage.savePage('${page?.id || ''}')">💾 Зберегти</button>
            </div>

            <!-- Code panel (full width) -->
            <div style="display:flex;flex-direction:column;flex:1;min-height:0;border:1px solid var(--border);border-radius:var(--radius-lg);overflow:hidden;margin-bottom:.75rem">
                <!-- Tabs -->
                <div style="display:flex;background:var(--bg-raised);border-bottom:1px solid var(--border)">
                    <button id="tab-html" onclick="CollectionsPage._switchTab('html')"
                            style="padding:.5rem 1.25rem;font-size:.8rem;font-weight:600;letter-spacing:.05em;border:none;cursor:pointer;background:var(--bg-surface);color:var(--text-primary);border-right:1px solid var(--border);border-bottom:2px solid var(--primary)">HTML</button>
                    <button id="tab-css" onclick="CollectionsPage._switchTab('css')"
                            style="padding:.5rem 1.25rem;font-size:.8rem;font-weight:600;letter-spacing:.05em;border:none;cursor:pointer;background:var(--bg-raised);color:var(--text-muted);border-right:1px solid var(--border);border-bottom:2px solid transparent">CSS</button>
                </div>
                <!-- Formatting toolbar (HTML only) -->
                ${this._toolbarHtml()}
                <textarea id="editor-html" spellcheck="false"
                          style="flex:1;padding:1.25rem;background:var(--bg-surface);color:var(--text-primary);border:none;outline:none;resize:none;font-family:'Courier New',monospace;font-size:.9rem;line-height:1.7;tab-size:2"
                          oninput="CollectionsPage._updatePreview()">${this._esc(page?.html_content || this._defaultHtml())}</textarea>
                <textarea id="editor-css" spellcheck="false"
                          style="flex:1;padding:1.25rem;background:var(--bg-surface);color:var(--text-primary);border:none;outline:none;resize:none;font-family:'Courier New',monospace;font-size:.9rem;line-height:1.7;tab-size:2;display:none"
                          oninput="CollectionsPage._updatePreview()">${this._esc(page?.css_content || this._defaultCss())}</textarea>
            </div>

            <!-- Attachment panel -->
            <div id="attachment-panel"
                 style="flex-shrink:0;border:1px solid var(--border);border-radius:var(--radius-lg);background:var(--bg-surface);overflow:hidden">
                <div style="display:flex;align-items:center;justify-content:space-between;padding:.45rem .875rem;background:var(--bg-raised);border-bottom:1px solid var(--border)">
                    <span style="font-size:.8rem;font-weight:600;color:var(--text-muted);letter-spacing:.03em">📎 Прикріплені файли</span>
                    ${page?.id ? `
                    <label style="cursor:pointer">
                        <span class="btn btn-ghost btn-sm" style="pointer-events:none">+ Додати</span>
                        <input type="file" multiple style="display:none" onchange="CollectionsPage._onAttachFiles(this)">
                    </label>` : `<span style="font-size:.75rem;color:var(--text-muted)">Збережіть сторінку щоб додавати файли</span>`}
                </div>
                <div id="attachment-grid"
                     style="display:flex;flex-wrap:wrap;gap:.5rem;padding:.625rem .875rem;min-height:96px;align-items:flex-start;overflow-y:auto;max-height:180px">
                    ${page?.id ? '' : '<span style="font-size:.8rem;color:var(--text-muted);align-self:center">—</span>'}
                </div>
            </div>
        </div>`;
    },

    async _openPreviewModal() {
        const rawHtml = document.getElementById('editor-html')?.value || '';
        const css     = document.getElementById('editor-css')?.value  || '';
        const html    = await this._resolveAttachmentUrls(rawHtml);

        const backdrop = document.createElement('div');
        backdrop.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:1000;display:flex;align-items:center;justify-content:center;padding:2rem';
        backdrop.id = 'preview-modal';

        const box = document.createElement('div');
        box.style.cssText = 'background:var(--bg-surface);border-radius:var(--radius-lg);box-shadow:var(--shadow-lg);width:100%;max-width:900px;height:85vh;display:flex;flex-direction:column;overflow:hidden';

        box.innerHTML = `
            <div style="display:flex;align-items:center;justify-content:space-between;padding:.75rem 1.25rem;border-bottom:1px solid var(--border);background:var(--bg-raised);flex-shrink:0">
                <span style="font-weight:600;font-size:.95rem">👁 Попередній перегляд</span>
                <button onclick="document.getElementById('preview-modal').remove()"
                        style="width:32px;height:32px;border-radius:50%;border:1px solid var(--border);background:var(--bg-surface);color:var(--text-primary);cursor:pointer;font-size:1rem;display:flex;align-items:center;justify-content:center">✕</button>
            </div>
            <iframe id="preview-modal-iframe" style="flex:1;border:none;background:#fff"
                    sandbox="allow-scripts allow-forms allow-popups allow-top-navigation-by-user-activation"></iframe>`;

        backdrop.appendChild(box);
        backdrop.addEventListener('click', e => { if (e.target === backdrop) backdrop.remove(); });
        document.addEventListener('keydown', function esc(e) {
            if (e.key === 'Escape') { backdrop.remove(); document.removeEventListener('keydown', esc); }
        });
        document.body.appendChild(backdrop);

        const iframe = box.querySelector('#preview-modal-iframe');
        this._renderIframe(iframe, html, css);
    },

    // ── Formatting toolbar ────────────────────────────────────────
    _toolbarHtml() {
        const B = (label, fn, tip) =>
            `<button title="${tip}" onclick="${fn}"
                     onmouseenter="this.style.background='var(--bg-hover)'"
                     onmouseleave="this.style.background='var(--bg-surface)'"
                     style="min-width:34px;height:34px;padding:0 7px;border:1px solid var(--border);border-radius:6px;background:var(--bg-surface);color:var(--text-primary);cursor:pointer;font-size:.95rem;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0">${label}</button>`;
        const S = `<span style="width:1px;height:22px;background:var(--border);margin:0 4px;flex-shrink:0;display:inline-block"></span>`;

        return `
        <div id="editor-toolbar" style="display:flex;flex-wrap:wrap;gap:3px;padding:.45rem .75rem;background:var(--bg-raised);border-bottom:1px solid var(--border);align-items:center">
            <select onchange="CollectionsPage._insertHeading(this.value);this.selectedIndex=0"
                    style="height:34px;font-size:.85rem;padding:0 8px;border-radius:6px;border:1px solid var(--border);background:var(--bg-surface);color:var(--text-primary);cursor:pointer;flex-shrink:0">
                <option>Стиль</option>
                <option value="h1">H1 — Заголовок</option>
                <option value="h2">H2 — Підзаголовок</option>
                <option value="h3">H3 — Розділ</option>
                <option value="p">P — Абзац</option>
                <option value="blockquote">❝ Цитата</option>
            </select>
            ${S}
            ${B('<b style="font-size:1rem">B</b>',                "CollectionsPage._fmtWrap('strong')",  'Жирний')}
            ${B('<i style="font-family:serif;font-size:1rem">I</i>', "CollectionsPage._fmtWrap('em')",   'Курсив')}
            ${B('<u style="font-size:.9rem">U</u>',                "CollectionsPage._fmtWrap('u')",      'Підкреслення')}
            ${B('<s style="font-size:.9rem">S</s>',                "CollectionsPage._fmtWrap('s')",      'Закреслення')}
            ${B('<code style="font-size:.75rem;background:var(--bg-raised);padding:1px 3px;border-radius:3px">&lt;/&gt;</code>', "CollectionsPage._fmtWrap('code')", 'Код')}
            ${S}
            <select onchange="CollectionsPage._wrapSize(this.value);this.selectedIndex=0"
                    style="height:34px;font-size:.85rem;padding:0 8px;border-radius:6px;border:1px solid var(--border);background:var(--bg-surface);color:var(--text-primary);cursor:pointer;flex-shrink:0">
                <option>Розмір</option>
                ${[11,12,13,14,16,18,20,24,28,32,36,48,64].map(s => `<option value="${s}">${s}px</option>`).join('')}
            </select>
            ${S}
            ${B('←≡', "CollectionsPage._wrapLeft()",   'Ліворуч')}
            ${B('≡',   "CollectionsPage._wrapCenter()", 'По центру')}
            ${B('≡→',  "CollectionsPage._wrapRight()",  'Праворуч')}
            ${S}
            <label title="Колір тексту" style="min-width:34px;height:34px;padding:0 6px;border:1px solid var(--border);border-radius:6px;background:var(--bg-surface);cursor:pointer;display:inline-flex;align-items:center;justify-content:center;position:relative;overflow:hidden;flex-shrink:0">
                <b style="font-size:1rem;text-decoration:underline;text-decoration-color:#e74c3c;text-underline-offset:3px">A</b>
                <input type="color" value="#e74c3c" onchange="CollectionsPage._wrapColor('color',this.value)"
                       style="opacity:0;position:absolute;inset:0;cursor:pointer">
            </label>
            <label title="Заливка фону" style="min-width:34px;height:34px;padding:0 6px;border:1px solid var(--border);border-radius:6px;background:var(--bg-surface);cursor:pointer;display:inline-flex;align-items:center;justify-content:center;position:relative;overflow:hidden;flex-shrink:0">
                <span style="font-size:1rem">🖌</span>
                <input type="color" value="#fef9c3" onchange="CollectionsPage._wrapColor('background',this.value)"
                       style="opacity:0;position:absolute;inset:0;cursor:pointer">
            </label>
            ${S}
            ${B('• ≡', "CollectionsPage._insertUL()",    'Маркований список')}
            ${B('1 ≡', "CollectionsPage._insertOL()",    'Нумерований список')}
            ${S}
            ${B('⊞',   "CollectionsPage._insertTable()", 'Таблиця')}
            ${B('━',   "CollectionsPage._insertHR()",    'Роздільник')}
            ${B('🔗',  "CollectionsPage._insertLink()",  'Гіперпосилання')}
            ${B('🃏',  "CollectionsPage._insertCard()",  'Картка-блок')}
            ${B('😊',  "CollectionsPage._toggleEmoji(event)", 'Вставити emoji')}
        </div>`;
    },

    // ── Toolbar helpers ───────────────────────────────────────────
    _getActiveTA() {
        // If a cursor was saved (e.g. after clicking attachment card), use that textarea
        if (this._savedCursor) return this._savedCursor.ta;
        const css = document.getElementById('editor-css');
        return (css && css.style.display !== 'none') ? css : document.getElementById('editor-html');
    },

    _getCursor(ta) {
        // Use saved position if this textarea lost focus
        if (this._savedCursor?.ta === ta && document.activeElement !== ta) {
            return { start: this._savedCursor.start, end: this._savedCursor.end };
        }
        return { start: ta.selectionStart, end: ta.selectionEnd };
    },

    _wrap(before, after) {
        const ta = this._getActiveTA();
        if (!ta) return;
        const { start: s, end: e } = this._getCursor(ta);
        const sel = ta.value.slice(s, e) || 'текст';
        const ins = before + sel + after;
        ta.value = ta.value.slice(0, s) + ins + ta.value.slice(e);
        ta.selectionStart = s + before.length;
        ta.selectionEnd   = s + before.length + sel.length;
        ta.focus();
        this._updatePreview();
    },

    _insertSnippet(snippet) {
        const ta = this._getActiveTA();
        if (!ta) return;
        const { start: s } = this._getCursor(ta);
        ta.value = ta.value.slice(0, s) + snippet + ta.value.slice(s);
        ta.selectionStart = ta.selectionEnd = s + snippet.length;
        this._savedCursor = { ta, start: ta.selectionStart, end: ta.selectionEnd };
        ta.focus();
        this._updatePreview();
    },

    _fmtWrap(tag)           { this._wrap(`<${tag}>`, `</${tag}>`); },
    _wrapSize(px)           { if (px) this._wrap(`<span style="font-size:${px}px">`, '</span>'); },
    _wrapLeft()             { this._wrap('<div style="text-align:left">',    '</div>'); },
    _wrapCenter()           { this._wrap('<div style="text-align:center">',  '</div>'); },
    _wrapRight()            { this._wrap('<div style="text-align:right">',   '</div>'); },
    _wrapColor(prop, val)   { this._wrap(`<span style="${prop}:${val}">`, '</span>'); },

    _insertHeading(tag) {
        if (!tag) return;
        this._wrap(`<${tag}>`, `</${tag}>\n`);
    },

    _insertUL() {
        this._insertSnippet('<ul>\n  <li>Пункт 1</li>\n  <li>Пункт 2</li>\n  <li>Пункт 3</li>\n</ul>\n');
    },

    _insertOL() {
        this._insertSnippet('<ol>\n  <li>Пункт 1</li>\n  <li>Пункт 2</li>\n  <li>Пункт 3</li>\n</ol>\n');
    },

    _insertHR() {
        this._insertSnippet('<hr style="border:none;border-top:2px solid #e2e8f0;margin:1.5rem 0">\n');
    },

    _insertTable() {
        this._insertSnippet(
`<table>
  <thead>
    <tr>
      <th>Заголовок 1</th>
      <th>Заголовок 2</th>
      <th>Заголовок 3</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Комірка</td><td>Комірка</td><td>Комірка</td>
    </tr>
    <tr>
      <td>Комірка</td><td>Комірка</td><td>Комірка</td>
    </tr>
  </tbody>
</table>\n`);
    },

    _insertCard() {
        this._insertSnippet(
`<div class="card">
  <h3>Заголовок картки</h3>
  <p>Текст або опис.</p>
</div>\n`);
    },

    _insertLink() {
        const ta = this._getActiveTA();
        if (!ta) return;
        const sel = ta.value.slice(ta.selectionStart, ta.selectionEnd);
        const url = prompt('URL посилання:', 'https://');
        if (!url) return;
        if (sel) {
            this._wrap(`<a href="${url}">`, '</a>');
        } else {
            const text = prompt('Текст посилання:', 'Посилання') || 'Посилання';
            this._insertSnippet(`<a href="${url}">${text}</a>`);
        }
    },

    _toggleEmoji(e) {
        e.stopPropagation();
        const existing = document.getElementById('emoji-panel');
        if (existing) { existing.remove(); return; }

        const groups = [
            { label: 'Емоції',  items: ['😀','😂','😊','😍','🤔','😎','🥳','😢','😡','🤩','🙄','😴','🤗','😇','🫡'] },
            { label: 'Жести',   items: ['👍','👎','👏','🙌','🤝','✌️','☝️','💪','🖐','🫶','👋','🤜','🤞','🫵','✅'] },
            { label: 'Символи', items: ['❌','⚠️','ℹ️','❓','❗','🔴','🟡','🟢','🔵','⭐','🔥','💡','💯','🆕','🔝'] },
            { label: 'Робота',  items: ['📌','📎','🔗','📊','📋','📁','📝','📅','💼','🔑','🔒','📢','📞','✉️','💻'] },
            { label: 'Інше',    items: ['🚀','🎯','🏆','🎉','❤️','💰','🌐','🕐','🖨','🔔','📢','🎓','🏅','🎁','🌟'] },
        ];

        const panel = document.createElement('div');
        panel.id = 'emoji-panel';
        panel.style.cssText = 'position:fixed;z-index:9999;background:var(--bg-surface);border:1px solid var(--border);border-radius:var(--radius-lg);padding:.5rem;box-shadow:var(--shadow-lg);width:260px;max-height:320px;overflow-y:auto';

        groups.forEach(g => {
            const label = document.createElement('div');
            label.textContent = g.label;
            label.style.cssText = 'font-size:.65rem;font-weight:600;color:var(--text-muted);letter-spacing:.08em;text-transform:uppercase;padding:.2rem .25rem .1rem;margin-top:.25rem';
            panel.appendChild(label);

            const row = document.createElement('div');
            row.style.cssText = 'display:flex;flex-wrap:wrap;gap:1px';
            g.items.forEach(em => {
                const b = document.createElement('button');
                b.textContent = em;
                b.title = em;
                b.style.cssText = 'width:32px;height:32px;border:none;background:none;cursor:pointer;font-size:1.1rem;border-radius:4px;display:flex;align-items:center;justify-content:center';
                b.onmouseenter = () => b.style.background = 'var(--bg-hover)';
                b.onmouseleave = () => b.style.background = 'none';
                b.onclick = ev => { ev.stopPropagation(); this._insertSnippet(em); panel.remove(); };
                row.appendChild(b);
            });
            panel.appendChild(row);
        });

        const btn = e.target.closest('button');
        const rect = btn.getBoundingClientRect();
        panel.style.top  = (rect.bottom + 6) + 'px';
        panel.style.left = Math.min(rect.left, window.innerWidth - 270) + 'px';
        document.body.appendChild(panel);
        setTimeout(() => document.addEventListener('click', () => panel.remove(), { once: true }), 0);
    },

    _switchTab(tab) {
        this._savedCursor = null;
        const htmlTA  = document.getElementById('editor-html');
        const cssTA   = document.getElementById('editor-css');
        const toolbar = document.getElementById('editor-toolbar');
        const tabHtml = document.getElementById('tab-html');
        const tabCss  = document.getElementById('tab-css');

        const setActive = btn => {
            btn.style.background   = 'var(--bg-surface)';
            btn.style.color        = 'var(--text-primary)';
            btn.style.borderBottom = '2px solid var(--primary)';
        };
        const setInactive = btn => {
            btn.style.background   = 'var(--bg-raised)';
            btn.style.color        = 'var(--text-muted)';
            btn.style.borderBottom = '2px solid transparent';
        };

        if (tab === 'html') {
            htmlTA.style.display = 'flex'; htmlTA.style.flex = '1';
            cssTA.style.display  = 'none';
            if (toolbar) toolbar.style.display = '';
            setActive(tabHtml); setInactive(tabCss);
        } else {
            cssTA.style.display  = 'flex'; cssTA.style.flex = '1';
            htmlTA.style.display = 'none';
            if (toolbar) toolbar.style.display = 'none';
            setActive(tabCss); setInactive(tabHtml);
        }
    },

    _initEditor(page) {
        this._updatePreview();
        // Drag-and-drop files onto attachment panel
        const panel = document.getElementById('attachment-panel');
        if (panel && this._editingPageId) {
            panel.addEventListener('dragover', e => {
                e.preventDefault();
                panel.style.outline = '2px dashed var(--primary)';
                panel.style.outlineOffset = '-2px';
            });
            panel.addEventListener('dragleave', () => { panel.style.outline = ''; });
            panel.addEventListener('drop', e => {
                e.preventDefault();
                panel.style.outline = '';
                const files = Array.from(e.dataTransfer.files);
                if (files.length) this._uploadFiles(this._editingPageId, files);
            });
        }
        // Track cursor position so clicks outside textarea don't lose it
        ['editor-html', 'editor-css'].forEach(id => {
            const ta = document.getElementById(id);
            if (!ta) return;
            const save = () => {
                if (ta.style.display !== 'none') {
                    this._savedCursor = { ta, start: ta.selectionStart, end: ta.selectionEnd };
                }
            };
            ta.addEventListener('keyup',   save);
            ta.addEventListener('mouseup', save);
            ta.addEventListener('blur',    save);
            ta.addEventListener('keydown', e => {
                if (e.key === 'Tab') {
                    e.preventDefault();
                    const s = ta.selectionStart, en = ta.selectionEnd;
                    ta.value = ta.value.substring(0, s) + '  ' + ta.value.substring(en);
                    ta.selectionStart = ta.selectionEnd = s + 2;
                    this._updatePreview();
                }
            });
        });
    },

    _updatePreview() {
        // No live preview panel — preview opens in modal via _openPreviewModal()
    },

    _esc(str) {
        return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    },

    _defaultHtml() {
        return `<h1>Заголовок сторінки</h1>
<p>Опис або вступний текст.</p>

<h2>Розділ 1</h2>
<p>Текст розділу. Можна додавати посилання, списки, таблиці.</p>
<ul>
  <li>Пункт 1</li>
  <li>Пункт 2</li>
</ul>

<!-- Посилання на ресурс: замініть # на справжній URL -->
<a href="#" class="resource-link">📄 Назва документу</a>`;
    },

    _defaultCss() {
        return `body {
  max-width: 800px;
  margin: 0 auto;
  font-family: 'Fixel Display', sans-serif;
  color: #1e293b;
  line-height: 1.7;
}

h1 { color: #6366f1; border-bottom: 2px solid #e2e8f0; padding-bottom: .5rem; }
h2 { color: #475569; margin-top: 2rem; }
h3 { color: #64748b; }

blockquote {
  border-left: 4px solid #6366f1;
  margin: 1rem 0;
  padding: .5rem 1rem;
  background: #f5f3ff;
  color: #4338ca;
  border-radius: 0 8px 8px 0;
}

code {
  background: #f1f5f9;
  color: #e11d48;
  padding: .1em .35em;
  border-radius: 4px;
  font-size: .875em;
}

table {
  width: 100%;
  border-collapse: collapse;
  margin: 1rem 0;
  font-size: .9rem;
}
th {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  padding: .5rem .75rem;
  text-align: left;
  font-weight: 600;
  color: #475569;
}
td {
  border: 1px solid #e2e8f0;
  padding: .5rem .75rem;
}
tr:hover td { background: #f8fafc; }

.card {
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 1.25rem 1.5rem;
  margin: 1rem 0;
  background: #f8fafc;
  box-shadow: 0 1px 3px rgba(0,0,0,.06);
}
.card h3 { margin: 0 0 .5rem; color: #6366f1; }

.resource-link {
  display: inline-block;
  padding: .4rem 1rem;
  background: #eff6ff;
  color: #3b82f6;
  border: 1px solid #bfdbfe;
  border-radius: 8px;
  text-decoration: none;
  margin: .25rem 0;
}
.resource-link:hover { background: #dbeafe; }`;
    },

    // ── Insert resource link ──────────────────────────────────────
    async _insertResourceLink() {
        Loader.show();
        try {
            const { data } = await API.resources.getAll({ pageSize: 200 });
            if (!data?.length) { Toast.info('Ресурсів немає'); return; }

            const icon = r => {
                const t = (r.type || '').toLowerCase();
                if (t === 'pdf')   return '📄';
                if (t === 'video') return '🎥';
                if (t === 'image') return '🖼️';
                return '📎';
            };

            Modal.open({
                title: 'Вставити посилання на ресурс',
                size: 'md',
                body: `
                    <input type="text" placeholder="Пошук..." style="width:100%;margin-bottom:.75rem"
                           oninput="CollectionsPage.__filterRes(this.value)">
                    <div id="res-link-list" style="max-height:360px;overflow-y:auto;display:flex;flex-direction:column;gap:.35rem">
                        ${data.map(r => `
                            <div onclick="CollectionsPage.__pickRes('${r.id}','${r.title.replace(/'/g,"\\'")}','${r.type||''}')"
                                 style="display:flex;align-items:center;gap:.75rem;padding:.6rem .75rem;border:1px solid var(--border);border-radius:var(--radius-md);cursor:pointer;transition:background var(--transition)"
                                 onmouseenter="this.style.background='var(--bg-hover)'" onmouseleave="this.style.background=''">
                                <span>${icon(r)}</span>
                                <span style="font-size:.875rem">${r.title}</span>
                            </div>`).join('')}
                    </div>`,
                footer: `<button class="btn btn-secondary" onclick="Modal.close()">Скасувати</button>`
            });
        } catch (e) {
            Toast.error('Помилка', e.message);
        } finally {
            Loader.hide();
        }
    },

    __filterRes(q) {
        document.querySelectorAll('#res-link-list > div').forEach(el => {
            el.style.display = el.textContent.toLowerCase().includes(q.toLowerCase()) ? '' : 'none';
        });
    },

    __pickRes(id, title, type) {
        const icon = type === 'pdf' ? '📄' : type === 'video' ? '🎥' : type === 'image' ? '🖼️' : '📎';
        const link = `<a href="#resource/${id}" class="resource-link">${icon} ${title}</a>`;
        const ta = document.getElementById('editor-html');
        if (ta) {
            const pos = ta.selectionStart;
            ta.value = ta.value.slice(0, pos) + link + ta.value.slice(pos);
            ta.selectionStart = ta.selectionEnd = pos + link.length;
            this._updatePreview();
        }
        Modal.close();
    },

    // ── Save ──────────────────────────────────────────────────────
    async savePage(id) {
        const title = document.getElementById('page-title-input')?.value.trim();
        if (!title) { Toast.error('Помилка', 'Вкажіть назву сторінки'); return; }
        const labelsRaw = document.getElementById('page-labels')?.value || '';
        const allowed_labels = labelsRaw.split(',').map(s => s.trim()).filter(Boolean);
        const fields = {
            title,
            html_content:   document.getElementById('editor-html')?.value || '',
            css_content:    document.getElementById('editor-css')?.value  || '',
            is_published:   document.getElementById('page-published')?.checked || false,
            allowed_labels
        };
        Loader.show();
        try {
            if (id) {
                await API.pages.update(id, fields);
                Loader.hide();
                Toast.success('Збережено');
                Router.back();
            } else {
                const created = await API.pages.create(fields);
                Loader.hide();
                Toast.success('Сторінку створено — можна додати файли');
                await this.openEditor(created.id);
            }
        } catch (e) {
            Toast.error('Помилка', e.message);
            Loader.hide();
        }
    },

    // ── Delete ────────────────────────────────────────────────────
    _trailBack(index) {
        const target = this._pageTrail[index];
        if (!target) return;
        this._pageTrail = this._pageTrail.slice(0, index);
        Router.go(`collections/${target.id}`);
    },

    async setHome(id) {
        const ok = await Modal.confirm({
            title: 'Зробити головною?',
            message: 'Ця сторінка стане головною для всіх користувачів. Попередня головна сторінка втратить цей статус.',
            confirmText: 'Так, зробити головною',
            cancelText: 'Скасувати',
            danger: false
        });
        if (!ok) return;
        try {
            await API.pages.setHome(id);
            Toast.success('Головну сторінку встановлено');
            await this._loadList();
        } catch(e) {
            Toast.error('Помилка', e.message);
        }
    },

    async deletePage(id) {
        const ok = await Modal.confirm({
            title: 'Видалити сторінку?',
            message: 'Всі прикріплені файли також будуть видалені назавжди.',
            confirmText: 'Видалити',
            danger: true
        });
        if (!ok) return;
        Loader.show();
        try {
            await API.pageAttachments.deleteAllForPage(id);
            await API.pages.delete(id);
            Toast.success('Сторінку видалено');
            await this._loadList();
        } catch (e) {
            Toast.error('Помилка', e.message);
        } finally {
            Loader.hide();
        }
    },

    // ── Attachment panel ──────────────────────────────────────────
    async _renderAttachmentGrid(attachments) {
        this._attachments = attachments;
        const grid = document.getElementById('attachment-grid');
        if (!grid) return;
        if (!attachments.length) {
            grid.innerHTML = `<span style="font-size:.8rem;color:var(--text-muted);align-self:center">Немає файлів — натисніть «+ Додати» або перетягніть сюди</span>`;
            return;
        }
        // Generate signed URLs for image thumbnails
        const cards = await Promise.all(attachments.map(async att => {
            let previewUrl = null;
            if (att.file_type?.startsWith('image/')) {
                try { previewUrl = await API.pageAttachments.getSignedUrl(att.storage_path); } catch(_) {}
            }
            return this._attachCardHtml(att, previewUrl);
        }));
        grid.innerHTML = cards.join('');
    },

    _attachCardHtml(att, previewUrl) {
        const ext   = att.file_name.split('.').pop().toLowerCase();
        const isPdf = ext === 'pdf' || att.file_type?.includes('pdf');
        const isImg = att.file_type?.startsWith('image/') || ['jpg','jpeg','png','gif','webp','svg'].includes(ext);
        const icons = { doc:'📝',docx:'📝',xls:'📊',xlsx:'📊',ppt:'📊',pptx:'📊',
                        txt:'📄',csv:'📋',zip:'🗜',rar:'🗜',mp4:'🎥',mp3:'🎵',mp3:'🎵' };

        const inner = isImg && previewUrl
            ? `<img src="${previewUrl}" style="width:100%;height:100%;object-fit:cover">`
            : isPdf
            ? `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;height:100%">
                 <div style="font-size:1.6rem">📄</div>
                 <div style="background:#ef4444;color:#fff;font-size:.5rem;font-weight:700;padding:1px 5px;border-radius:2px;letter-spacing:.08em">PDF</div>
               </div>`
            : `<div style="font-size:2rem;display:flex;align-items:center;justify-content:center;height:100%">${icons[ext] || '📎'}</div>`;

        const name = att.file_name.length > 11 ? att.file_name.slice(0,9) + '…' : att.file_name;

        return `
        <div style="position:relative;flex-shrink:0;cursor:pointer"
             onclick="CollectionsPage._insertAttachmentLink('${att.id}')"
             onmouseenter="this.querySelector('.adel').style.display='flex'"
             onmouseleave="this.querySelector('.adel').style.display='none'"
             title="${att.file_name}">
            <div style="width:76px;height:76px;border:1px solid var(--border);border-radius:8px;overflow:hidden;background:var(--bg-raised)">
                ${inner}
            </div>
            <div style="width:76px;font-size:.65rem;color:var(--text-muted);text-align:center;margin-top:.2rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${name}</div>
            <button class="adel"
                    onclick="event.stopPropagation();CollectionsPage._deleteAttachment('${att.id}')"
                    style="display:none;position:absolute;top:-5px;right:-5px;width:20px;height:20px;border-radius:50%;background:#ef4444;color:#fff;border:none;cursor:pointer;font-size:.65rem;align-items:center;justify-content:center;z-index:2;font-weight:700">✕</button>
        </div>`;
    },

    async _onAttachFiles(input) {
        const pageId = this._editingPageId;
        if (!pageId) { Toast.warning('Збережіть сторінку спочатку'); return; }
        const files = Array.from(input.files);
        if (!files.length) return;
        await this._uploadFiles(pageId, files);
        input.value = '';
    },

    async _uploadFiles(pageId, files) {
        const grid = document.getElementById('attachment-grid');
        if (!grid) return;
        // Clear empty placeholder text
        if (grid.querySelector('span')) grid.innerHTML = '';

        for (const file of files) {
            const ph = document.createElement('div');
            ph.style.cssText = 'width:76px;height:76px;border:1px dashed var(--border);border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0';
            ph.innerHTML = '<div class="spinner" style="width:20px;height:20px"></div>';
            grid.appendChild(ph);
            try {
                const att = await API.pageAttachments.upload(pageId, file);
                this._attachments.push(att);
                let previewUrl = att.signed_url && att.file_type?.startsWith('image/') ? att.signed_url : null;
                const wrap = document.createElement('div');
                wrap.innerHTML = this._attachCardHtml(att, previewUrl);
                ph.replaceWith(wrap.firstElementChild);
            } catch(e) {
                ph.remove();
                Toast.error(`Помилка: ${file.name}`, e.message);
            }
        }
    },

    async _deleteAttachment(attId) {
        if (!confirm('Видалити файл?')) return;
        Loader.show();
        try {
            await API.pageAttachments.delete(attId);
            this._attachments = this._attachments.filter(a => a.id !== attId);
            await this._renderAttachmentGrid(this._attachments);
        } catch(e) {
            Toast.error('Помилка', e.message);
        } finally {
            Loader.hide();
        }
    },

    _insertAttachmentLink(attId) {
        const att = this._attachments.find(a => a.id === attId);
        if (!att) return;
        const ext   = att.file_name.split('.').pop().toLowerCase();
        const isPdf = ext === 'pdf' || att.file_type?.includes('pdf');
        const isImg = att.file_type?.startsWith('image/') || ['jpg','jpeg','png','gif','webp','svg'].includes(ext);
        // Insert short placeholder — resolved to real URL on preview/view
        if (isImg) {
            this._insertSnippet(`<img src="att:${attId}" alt="${att.file_name}" style="max-width:100%;border-radius:8px;margin:.5rem 0">\n`);
        } else if (isPdf) {
            this._insertSnippet(`<a href="att:${attId}" data-att-pdf="1" data-att-name="${att.file_name}" target="_blank" class="resource-link">📄 ${att.file_name}</a>\n`);
        } else {
            this._insertSnippet(`<a href="att:${attId}" target="_blank" class="resource-link">📎 ${att.file_name}</a>\n`);
        }
        Toast.success('Посилання вставлено');
    },

    // Resolve att:UUID → real signed URLs before rendering
    async _resolveAttachmentUrls(html) {
        const ids = [...new Set([...html.matchAll(/(?:href|src)="att:([0-9a-f-]{36})"/g)].map(m => m[1]))];
        if (!ids.length) return html;

        const urlMap = {};
        await Promise.all(ids.map(async id => {
            const att = this._attachments.find(a => a.id === id);
            if (!att) return;
            try {
                const url = await API.pageAttachments.getSignedUrl(att.storage_path);
                const ext   = att.file_name.split('.').pop().toLowerCase();
                const isPdf = ext === 'pdf' || att.file_type?.includes('pdf');
                urlMap[id] = isPdf
                    ? `pdf-viewer.html?file=${encodeURIComponent(url)}&title=${encodeURIComponent(att.file_name)}&download=1`
                    : url;
            } catch(_) {}
        }));

        return html.replace(/(?:href|src)="att:([0-9a-f-]{36})"/g, (match, id) =>
            urlMap[id] ? match.replace(`att:${id}`, urlMap[id]) : match
        );
    }
};
