// ================================================================
// EduFlow LMS — Hash-based SPA Router
// ================================================================

const Router = {
    _routes: {},
    _current: null,
    _prevCleanup: null,

    define(routes) {
        this._routes = routes;
    },

    go(path) {
        location.hash = '#/' + path;
    },

    back() {
        history.back();
    },

    current() {
        return this._current;
    },

    params() {
        const hash = location.hash.slice(2) || 'dashboard';
        const [path, qs] = hash.split('?');
        const params = {};
        if (qs) {
            new URLSearchParams(qs).forEach((v, k) => { params[k] = v; });
        }
        return params;
    },

    _parse(hash) {
        const raw    = hash.slice(2) || 'dashboard';
        const [pathWithQs] = raw.split('#');
        const [path, qs] = pathWithQs.split('?');
        const segments = path.split('/').filter(Boolean);
        const params   = {};
        if (qs) new URLSearchParams(qs).forEach((v, k) => { params[k] = v; });
        return { path: segments.join('/'), segments, params };
    },

    _match(segments) {
        // Exact match first
        const key = segments.join('/');
        if (this._routes[key]) return { handler: this._routes[key], params: {} };

        // Pattern match (:param segments)
        for (const [pattern, handler] of Object.entries(this._routes)) {
            const parts = pattern.split('/').filter(Boolean);
            if (parts.length !== segments.length) continue;
            const params = {};
            const match  = parts.every((p, i) => {
                if (p.startsWith(':')) { params[p.slice(1)] = segments[i]; return true; }
                return p === segments[i];
            });
            if (match) return { handler, params };
        }
        return null;
    },

    async _navigate() {
        if (!AppState.user) return; // guard — handled by App

        const { segments, params } = this._parse(location.hash);
        const matched = this._match(segments);

        if (!matched) {
            this.go('dashboard');
            return;
        }

        // Cleanup previous page
        if (this._prevCleanup) {
            try { this._prevCleanup(); } catch(_) {}
            this._prevCleanup = null;
        }

        this._current = segments.join('/');
        UI.updateActiveNav(segments[0]);

        const container = document.getElementById('page-content');
        window.scrollTo({ top: 0, behavior: 'instant' });
        container.innerHTML = `
            <div style="display:flex;align-items:center;justify-content:center;min-height:300px">
                <div class="spinner"></div>
            </div>`;

        try {
            const cleanup = await matched.handler({
                container,
                params: { ...params, ...matched.params },
                segments
            });
            this._prevCleanup = cleanup || null;
        } catch(err) {
            console.error('Router error:', err);
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">⚠️</div>
                    <h3>Произошла ошибка</h3>
                    <p>${err.message || 'Не удалось загрузить страницу'}</p>
                    <button class="btn btn-primary" onclick="Router.go('dashboard')">На главную</button>
                </div>`;
        }
    },

    start() {
        window.addEventListener('hashchange', () => this._navigate());
        this._navigate();
    }
};
