// ================================================================
// EduFlow LMS — News / Portal Page
// ================================================================

const NewsPage = {
    _page: 0,

    async init(container, params) {
        // Single article view
        if (params.id) {
            await this._viewArticle(container, params.id);
            return;
        }

        UI.setBreadcrumb([{ label: 'Новости' }]);
        this._page = 0;

        container.innerHTML = `
            <div class="page-header">
                <div class="page-title">
                    <h1>📰 Новини та оголошення</h1>
                    <p>Последние события и обновления</p>
                </div>
                <div class="page-actions">
                    ${AppState.isStaff() ? `<button class="btn btn-primary" onclick="NewsPage.openCreate()">+ Написать новость</button>` : ''}
                </div>
            </div>

            <div id="featured-news" style="margin-bottom:2rem"></div>

            <div style="display:flex;gap:1rem;margin-bottom:1.5rem;flex-wrap:wrap">
                <input type="text" id="news-search" placeholder="Поиск новостей..." style="flex:1;min-width:200px"
                       onkeyup="NewsPage.onSearch(event)">
                <select id="news-category" onchange="NewsPage.load()" style="width:auto">
                    <option value="">Все категории</option>
                    <option value="general">Общее</option>
                    <option value="announcements">Объявления</option>
                    <option value="updates">Обновления</option>
                    <option value="events">События</option>
                </select>
            </div>

            <div id="news-grid" class="news-grid"></div>
            <div id="news-pagination" style="display:flex;justify-content:center;gap:.5rem;margin-top:2rem"></div>`;

        await this.load();
    },

    onSearch(e) {
        this._search = e.target.value;
        clearTimeout(this._searchTimer);
        this._searchTimer = setTimeout(() => this.load(), 350);
    },

    async load() {
        const grid = document.getElementById('news-grid');
        if (!grid) return;
        grid.innerHTML = `<div style="grid-column:1/-1;display:flex;justify-content:center;padding:2rem"><div class="spinner"></div></div>`;

        try {
            const { data, count } = await API.news.getAll({ published: !AppState.isStaff() || undefined, page: this._page });

            // Featured news (is_featured)
            const featured = data.filter(n => n.is_featured).slice(0, 1)[0];
            if (featured) this._renderFeatured(featured);

            const regular = data.filter(n => !n.is_featured || data.indexOf(n) > 0);

            if (!regular.length && !featured) {
                grid.innerHTML = `
                    <div class="empty-state" style="grid-column:1/-1">
                        <div class="empty-icon">📰</div>
                        <h3>Новостей пока нет</h3>
                        ${AppState.isStaff() ? `<button class="btn btn-primary" onclick="NewsPage.openCreate()">Написать первую новость</button>` : ''}
                    </div>`;
                return;
            }

            grid.innerHTML = regular.map(n => this._renderCard(n)).join('');
            this._renderPagination(count);
        } catch(e) {
            grid.innerHTML = `<div style="grid-column:1/-1;color:var(--danger)">${e.message}</div>`;
        }
    },

    _renderFeatured(news) {
        const el = document.getElementById('featured-news');
        if (!el) return;

        el.innerHTML = `
            <div onclick="Router.go('news/${news.id}')" style="
                display:grid;grid-template-columns:1fr 1fr;gap:2rem;
                background:var(--bg-surface);border:1px solid var(--border);border-radius:var(--radius-xl);
                overflow:hidden;cursor:pointer;transition:all var(--transition)" class="featured-card"
                onmouseenter="this.style.borderColor='var(--primary)'" onmouseleave="this.style.borderColor='var(--border)'">
                ${news.thumbnail_url ? `
                    <div style="height:280px;overflow:hidden">
                        <img src="${news.thumbnail_url}" style="width:100%;height:100%;object-fit:cover">
                    </div>` : `<div style="height:280px;background:linear-gradient(135deg,rgba(99,102,241,.1),rgba(139,92,246,.1));display:flex;align-items:center;justify-content:center;font-size:5rem">📰</div>`}
                <div style="padding:2rem;display:flex;flex-direction:column;justify-content:center">
                    <span style="color:var(--primary);font-size:.75rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;margin-bottom:.75rem">
                        ⭐ ${news.category || 'Главная новость'}
                    </span>
                    <h2 style="margin-bottom:1rem;line-height:1.4">${news.title}</h2>
                    <p style="color:var(--text-secondary);font-size:.9rem;line-height:1.7;margin-bottom:1.5rem;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden">
                        ${news.excerpt || news.content.slice(0, 200).replace(/<[^>]+>/g, '')}...
                    </p>
                    <div style="display:flex;align-items:center;justify-content:space-between">
                        <span style="font-size:.8rem;color:var(--text-muted)">
                            👤 ${news.author?.full_name || 'Редакция'} • ${Fmt.date(news.published_at || news.created_at, { day:'numeric',month:'long' })}
                        </span>
                        <span class="btn btn-primary btn-sm">Читать →</span>
                    </div>
                </div>
            </div>`;
    },

    _renderCard(news) {
        return `
            <div class="news-card" onclick="Router.go('news/${news.id}')">
                <div class="news-thumb">
                    ${news.thumbnail_url
                        ? `<img src="${news.thumbnail_url}" alt="${news.title}" loading="lazy">`
                        : `<div style="height:100%;background:linear-gradient(135deg,rgba(99,102,241,.08),rgba(139,92,246,.08));display:flex;align-items:center;justify-content:center;font-size:3rem">📰</div>`}
                </div>
                <div class="news-body">
                    <div class="news-category">${news.category || 'Общее'}</div>
                    <h4 class="news-title">${news.title}</h4>
                    <p class="news-excerpt">${news.excerpt || (news.content || '').replace(/<[^>]+>/g, '').slice(0, 150)}</p>
                </div>
                <div class="news-footer">
                    <span>👤 ${news.author?.full_name || '—'}</span>
                    <div style="display:flex;align-items:center;gap:.75rem">
                        ${!news.is_published ? '<span class="badge badge-muted">Черновик</span>' : ''}
                        <span>${Fmt.date(news.published_at || news.created_at, { day:'numeric', month:'short' })}</span>
                        ${AppState.isStaff() ? `
                            <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();NewsPage.openEdit('${news.id}')">✏️</button>
                            <button class="btn btn-danger btn-sm" onclick="event.stopPropagation();NewsPage.deleteNews('${news.id}','${news.title.replace(/'/g,"\\'").replace(/"/g,'\\"')}')">🗑</button>
                        ` : ''}
                    </div>
                </div>
            </div>`;
    },

    _renderPagination(total) {
        const el    = document.getElementById('news-pagination');
        const pages = Math.ceil(total / 12);
        if (!el || pages <= 1) { if (el) el.innerHTML = ''; return; }
        el.innerHTML = Array.from({ length: pages }, (_, i) => `
            <button class="btn ${i === this._page ? 'btn-primary' : 'btn-ghost'} btn-sm"
                    onclick="NewsPage._page=${i};NewsPage.load()">${i + 1}</button>
        `).join('');
    },

    // ── Article View ──────────────────────────────────────────────
    async _viewArticle(container, id) {
        container.innerHTML = `<div style="display:flex;justify-content:center;padding:3rem"><div class="spinner"></div></div>`;

        try {
            const news = await API.news.getById(id);
            UI.setBreadcrumb([{ label: 'Новости', route: 'news' }, { label: news.title }]);

            container.innerHTML = `
                <div style="max-width:800px;margin:0 auto">
                    <button class="btn btn-ghost btn-sm" onclick="Router.go('news')" style="margin-bottom:1.5rem">
                        ← Назад к новостям
                    </button>

                    ${news.thumbnail_url ? `
                        <div style="border-radius:var(--radius-xl);overflow:hidden;margin-bottom:2rem;height:400px">
                            <img src="${news.thumbnail_url}" style="width:100%;height:100%;object-fit:cover">
                        </div>` : ''}

                    <div class="card">
                        <div class="card-body" style="padding:2.5rem">
                            <div style="display:flex;align-items:center;gap:.75rem;margin-bottom:1rem;flex-wrap:wrap">
                                <span class="badge badge-primary">${news.category || 'Общее'}</span>
                                ${news.is_featured ? '<span class="badge badge-warning">⭐ Главная</span>' : ''}
                                ${!news.is_published ? '<span class="badge badge-muted">Черновик</span>' : ''}
                            </div>

                            <h1 style="font-size:2rem;line-height:1.3;margin-bottom:1rem">${news.title}</h1>

                            <div style="display:flex;align-items:center;gap:1.5rem;color:var(--text-muted);font-size:.875rem;margin-bottom:2rem;padding-bottom:1.5rem;border-bottom:1px solid var(--border)">
                                <span>👤 ${news.author?.full_name || 'Редакция'}</span>
                                <span>📅 ${Fmt.date(news.published_at || news.created_at)}</span>
                                ${news.views ? `<span>👁 ${news.views} просмотров</span>` : ''}
                            </div>

                            ${news.excerpt ? `<p style="font-size:1.1rem;color:var(--text-secondary);margin-bottom:1.5rem;font-style:italic">${news.excerpt}</p>` : ''}

                            <div style="line-height:1.9;color:var(--text-primary)">
                                ${news.content}
                            </div>

                            ${news.tags?.length ? `
                                <div style="margin-top:2rem;display:flex;gap:.5rem;flex-wrap:wrap">
                                    ${news.tags.map(t => `<span class="badge badge-muted">#${t}</span>`).join('')}
                                </div>` : ''}
                        </div>
                    </div>

                    ${AppState.isStaff() ? `
                        <div style="display:flex;gap:.75rem;margin-top:1rem;justify-content:flex-end">
                            <button class="btn btn-secondary" onclick="NewsPage.openEdit('${news.id}')">✏️ Редактировать</button>
                            <button class="btn btn-danger" onclick="NewsPage.deleteNews('${news.id}','${news.title}')">🗑️ Удалить</button>
                        </div>` : ''}
                </div>`;
        } catch(e) {
            container.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><h3>Новость не найдена</h3><button class="btn btn-primary" onclick="Router.go('news')">← Назад</button></div>`;
        }
    },

    // ── Create / Edit ──────────────────────────────────────────────
    openCreate() {
        this._openForm(null);
    },

    async openEdit(id) {
        Loader.show();
        try {
            const news = await API.news.getById(id);
            this._openForm(news);
        } finally { Loader.hide(); }
    },

    _openForm(news) {
        Modal.open({
            title: news ? '✏️ Редактировать новость' : '+ Новая новость',
            size: 'xl',
            body: `
                <div class="form-row">
                    <div class="form-group" style="grid-column:1/-1">
                        <label>Заголовок *</label>
                        <input id="n-title" type="text" value="${news?.title || ''}" placeholder="Заголовок новости">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Категория</label>
                        <select id="n-category">
                            ${['general','announcements','updates','events'].map(c =>
                                `<option value="${c}" ${news?.category === c ? 'selected' : ''}>${{general:'Общее',announcements:'Объявления',updates:'Обновления',events:'События'}[c]}</option>`
                            ).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Теги (через запятую)</label>
                        <input id="n-tags" type="text" value="${news?.tags?.join(', ') || ''}" placeholder="тег1, тег2">
                    </div>
                </div>
                <div class="form-group">
                    <label>Краткое описание (для превью)</label>
                    <textarea id="n-excerpt" style="min-height:60px" placeholder="Краткое описание...">${news?.excerpt || ''}</textarea>
                </div>
                <div class="form-group">
                    <label>Содержание *</label>
                    <div id="n-editor-container">
                        <div id="n-editor"></div>
                    </div>
                </div>
                <div class="form-group">
                    <label>Обложка</label>
                    <div id="news-img-zone"></div>
                    ${news?.thumbnail_url ? `<img src="${news.thumbnail_url}" style="max-height:60px;margin-top:.5rem;border-radius:var(--radius-sm)">` : ''}
                </div>
                <div style="display:flex;gap:1.5rem;flex-wrap:wrap">
                    <label class="checkbox-item" style="cursor:pointer">
                        <input type="checkbox" id="n-published" ${news?.is_published ? 'checked' : ''}>
                        <span>Опубликовать</span>
                    </label>
                    <label class="checkbox-item" style="cursor:pointer">
                        <input type="checkbox" id="n-featured" ${news?.is_featured ? 'checked' : ''}>
                        <span>Главная новость</span>
                    </label>
                </div>`,
            footer: `
                <button class="btn btn-secondary" onclick="Modal.close()">Отмена</button>
                <button class="btn btn-primary" onclick="NewsPage.saveNews('${news?.id || ''}')">Сохранить</button>`
        });

        // Init Quill editor
        setTimeout(() => {
            this._quill = new Quill('#n-editor', {
                theme: 'snow',
                modules: { toolbar: [
                    ['bold','italic','underline','strike'],
                    ['blockquote','code-block'],
                    [{ header: [1,2,3,false] }],
                    [{ list: 'ordered' }, { list: 'bullet' }],
                    ['link','image'],
                    ['clean']
                ]}
            });
            if (news?.content) this._quill.root.innerHTML = news.content;

            // Image upload zone
            this._newsImgFile = null;
            const zone = document.getElementById('news-img-zone');
            if (zone) {
                const input = FileUpload.createDropZone(zone, { accept: 'image/*', label: 'Загрузить обложку', hint: 'PNG, JPG до 5 МБ' });
                input.addEventListener('change', () => { this._newsImgFile = input.files[0]; });
            }
        }, 100);
    },

    async saveNews(id) {
        const title = Dom.val('n-title').trim();
        if (!title) { Toast.error('Ошибка', 'Введите заголовок'); return; }

        const content = this._quill?.root.innerHTML || '';
        if (!content || content === '<p><br></p>') { Toast.error('Ошибка', 'Добавьте содержание'); return; }

        const tagsRaw = Dom.val('n-tags').trim();
        const tags    = tagsRaw ? tagsRaw.split(',').map(t => t.trim()).filter(Boolean) : [];

        const fields = {
            title,
            content,
            excerpt:     Dom.val('n-excerpt').trim() || null,
            category:    Dom.val('n-category'),
            tags:        tags.length ? tags : null,
            is_published: document.getElementById('n-published').checked,
            is_featured:  document.getElementById('n-featured').checked,
            published_at: document.getElementById('n-published').checked ? new Date().toISOString() : null
        };

        Loader.show();
        Modal.close();
        try {
            let news;
            if (id) news = await API.news.update(id, fields);
            else    news = await API.news.create(fields);

            if (this._newsImgFile) {
                const imgUrl = await API.news.uploadImage(news.id, this._newsImgFile);
                await API.news.update(news.id, { thumbnail_url: imgUrl });
            }

            Toast.success('Сохранено!', `Новость "${title}" ${id ? 'обновлена' : 'создана'}`);
            Router.go('news');
        } catch(e) {
            Toast.error('Ошибка', e.message);
        } finally { Loader.hide(); }
    },

    async deleteNews(id, title) {
        const ok = await Modal.confirm({
            title: 'Удалить новость',
            message: `Удалить новость "${title}"?`,
            confirmText: 'Удалить',
            danger: true
        });
        if (!ok) return;
        Loader.show();
        try {
            await API.news.delete(id);
            Toast.success('Новость удалена');
            Router.go('news');
        } catch(e) { Toast.error('Ошибка', e.message); }
        finally { Loader.hide(); }
    }
};
