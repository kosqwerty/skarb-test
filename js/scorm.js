// ================================================================
// EduFlow LMS — SCORM 2004 Runtime Player
// ================================================================

// ── SCORM 2004 API Implementation ──────────────────────────────────
class SCORM2004Runtime {
    constructor(packageId, initialData = {}, onCommit) {
        this.packageId   = packageId;
        this.onCommit    = onCommit;
        this.initialized = false;
        this.terminated  = false;
        this.lastError   = '0';
        this._startTime  = Date.now();

        // CMI data model
        this.data = {
            'cmi.completion_status':  initialData.completion_status  || 'not attempted',
            'cmi.success_status':     initialData.success_status     || 'unknown',
            'cmi.progress_measure':   String(initialData.progress_measure || 0),
            'cmi.score.raw':          String(initialData.score_raw   || ''),
            'cmi.score.min':          String(initialData.score_min   || 0),
            'cmi.score.max':          String(initialData.score_max   || 100),
            'cmi.score.scaled':       String(initialData.score_scaled || ''),
            'cmi.total_time':         this._secToISO(initialData.total_time_seconds || 0),
            'cmi.session_time':       'PT0S',
            'cmi.location':           initialData.location     || '',
            'cmi.suspend_data':       initialData.suspend_data || '',
            'cmi.entry':              (initialData.completion_status === 'incomplete') ? 'resume' : 'ab-initio',
            'cmi.exit':               '',
            'cmi.mode':               'normal',
            'cmi.learner_id':         AppState.user?.id || '',
            'cmi.learner_name':       AppState.profile?.full_name || '',
            'cmi.credit':             'credit',
            'cmi.completion_threshold': '0.7',
            'cmi.scaled_passing_score': '0.7'
        };
    }

    // ── SCORM 2004 API Methods ──────────────────────────────────────
    Initialize(param) {
        if (this.terminated) { this.lastError = '104'; return 'false'; }
        if (this.initialized) { this.lastError = '103'; return 'false'; }
        this.initialized = true;
        this.lastError   = '0';
        console.log('[SCORM] Initialize()');
        return 'true';
    }

    Terminate(param) {
        if (!this.initialized) { this.lastError = '301'; return 'false'; }
        if (this.terminated)   { this.lastError = '304'; return 'false'; }
        this.Commit('');
        this.terminated  = true;
        this.lastError   = '0';
        console.log('[SCORM] Terminate()');
        return 'true';
    }

    GetValue(element) {
        if (!this.initialized) { this.lastError = '301'; return ''; }
        this.lastError = '0';
        const val = this.data[element];
        if (val === undefined) { this.lastError = '401'; return ''; }
        console.log(`[SCORM] GetValue(${element}) = ${val}`);
        return val;
    }

    SetValue(element, value) {
        if (!this.initialized) { this.lastError = '301'; return 'false'; }
        this.lastError = '0';
        this.data[element] = String(value);
        console.log(`[SCORM] SetValue(${element}, ${value})`);

        // Auto-commit on important changes
        if (['cmi.completion_status', 'cmi.success_status', 'cmi.score.raw'].includes(element)) {
            this._asyncCommit();
        }
        return 'true';
    }

    Commit(param) {
        if (!this.initialized) { this.lastError = '301'; return 'false'; }
        this.lastError = '0';

        const sessionSec = Math.floor((Date.now() - this._startTime) / 1000);
        const payload = {
            completion_status:    this.data['cmi.completion_status'],
            success_status:       this.data['cmi.success_status'],
            progress_measure:     parseFloat(this.data['cmi.progress_measure']) || 0,
            score_raw:            this.data['cmi.score.raw'] ? parseFloat(this.data['cmi.score.raw']) : null,
            score_min:            parseFloat(this.data['cmi.score.min']) || 0,
            score_max:            parseFloat(this.data['cmi.score.max']) || 100,
            score_scaled:         this.data['cmi.score.scaled'] ? parseFloat(this.data['cmi.score.scaled']) : null,
            total_time_seconds:   sessionSec,
            session_time_seconds: sessionSec,
            suspend_data:         this.data['cmi.suspend_data'],
            location:             this.data['cmi.location']
        };

        if (this.onCommit) this.onCommit(payload);
        console.log('[SCORM] Commit() →', payload);
        return 'true';
    }

    GetLastError()               { return this.lastError; }
    GetErrorString(errorCode)    { return SCORM2004Runtime.ERROR_STRINGS[errorCode] || 'Unknown Error'; }
    GetDiagnostic(errorCode)     { return `SCORM Error Diagnostic: ${errorCode}`; }

    _asyncCommit() {
        clearTimeout(this._commitTimer);
        this._commitTimer = setTimeout(() => this.Commit(''), 2000);
    }

    _secToISO(seconds) {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return `PT${h}H${m}M${s}S`;
    }

    static ERROR_STRINGS = {
        '0':   'No Error',
        '101': 'General Exception',
        '102': 'General Initialization Failure',
        '103': 'Already Initialized',
        '104': 'Content Instance Terminated',
        '111': 'General Termination Failure',
        '112': 'Termination Before Initialization',
        '113': 'Termination After Termination',
        '122': 'Retrieve Data Before Initialization',
        '123': 'Retrieve Data After Termination',
        '132': 'Store Data Before Initialization',
        '133': 'Store Data After Termination',
        '142': 'Commit Before Initialization',
        '143': 'Commit After Termination',
        '301': 'Not Initialized',
        '351': 'Already Initialized',
        '391': 'Already Terminated',
        '401': 'Undefined Data Model Element',
        '402': 'Unimplemented Data Model Element',
        '403': 'Data Model Element Value Not Initialized',
        '404': 'Data Model Element Is Read Only',
        '405': 'Data Model Element Is Write Only',
        '406': 'Data Model Element Type Mismatch',
        '407': 'Data Model Element Value Out Of Range',
        '408': 'Data Model Dependency Not Established'
    };
}

// ── SCORM Player (UI + iframe management) ──────────────────────────
const ScormPlayer = {
    _api: null,
    _packageId: null,
    _statusElId: 'scorm-status',
    _entryBlobUrl: null,

    async open(resourceId, title = '') {
        Loader.show();
        try {
            const pkg = await API.scorm.getPackage(resourceId);
            if (!pkg) { Toast.error('Ошибка', 'SCORM пакет не найден'); Loader.hide(); return; }

            this._packageId = pkg.id;
            this._statusElId = 'scorm-status';

            const progress = await API.scorm.getProgress(pkg.id);
            this._api = new SCORM2004Runtime(pkg.id, progress || {}, async (data) => {
                this._updateStatusBadge(data);
                try { await API.scorm.saveProgress(pkg.id, data); } catch(e) { console.error('[SCORM] Save error:', e); }
            });

            const overlay = document.getElementById('scorm-overlay');
            const frame   = document.getElementById('scorm-frame');
            const gate    = document.getElementById('scorm-gate');
            document.getElementById('scorm-title').textContent = title || pkg.title || 'SCORM';
            this._updateStatusBadge(progress);

            overlay.classList.remove('hidden');
            Loader.hide();

            this._gateOrLoad(pkg, frame, gate, progress);

        } catch(e) {
            Loader.hide();
            Toast.error('Ошибка SCORM', e.message);
        }
    },

    // Той самий програвач, але вбудований прямо в сторінку ресурсу (не
    // перекриває сайдбар/топбар глобальним оверлеєм) — для перегляду SCORM
    // з Бази знань. Очікує, що виклик вже вставив у DOM
    // #rv-scorm-frame + #rv-scorm-gate (+ опційно #rv-scorm-status).
    async openInline(resourceId, title = '') {
        const frame = document.getElementById('rv-scorm-frame');
        const gate  = document.getElementById('rv-scorm-gate');
        if (!frame) return;
        Loader.show();
        try {
            const pkg = await API.scorm.getPackage(resourceId);
            if (!pkg) { Toast.error('Помилка', 'SCORM пакет не знайдено'); Loader.hide(); return; }

            this._packageId = pkg.id;
            this._statusElId = 'rv-scorm-status';

            const progress = await API.scorm.getProgress(pkg.id);
            this._api = new SCORM2004Runtime(pkg.id, progress || {}, async (data) => {
                this._updateStatusBadge(data);
                try { await API.scorm.saveProgress(pkg.id, data); } catch(e) { console.error('[SCORM] Save error:', e); }
            });
            this._updateStatusBadge(progress);
            Loader.hide();

            this._gateOrLoad(pkg, frame, gate, progress);
        } catch(e) {
            Loader.hide();
            Toast.error('Помилка SCORM', e.message);
        }
    },

    // Якщо курс ще не розпочато — показує "ворота" з кнопкою "Почати" й НЕ
    // завантажує контент в iframe взагалі (щоб не можна було проходити курс
    // повз явний старт). Якщо прогрес уже є — одразу продовжує з того місця.
    _gateOrLoad(pkg, frame, gate, progress) {
        const started = progress && progress.completion_status && progress.completion_status !== 'not attempted';
        if (started || !gate) {
            if (gate) gate.style.display = 'none';
            frame.style.display = '';
            this._loadContent(pkg, frame);
            return;
        }
        gate.style.display = 'flex';
        frame.style.display = 'none';
        const btn = gate.querySelector('[data-scorm-start]');
        if (btn) btn.onclick = () => this._beginCourse(pkg, frame, gate);
    },

    async _beginCourse(pkg, frame, gate) {
        try {
            await API.scorm.saveProgress(pkg.id, { completion_status: 'incomplete' });
        } catch (e) {
            Toast.error('Помилка', e.message);
            return;
        }
        if (this._api) this._api.data['cmi.completion_status'] = 'incomplete';
        this._updateStatusBadge({ completion_status: 'incomplete' });
        gate.style.display = 'none';
        frame.style.display = '';
        Loader.show();
        await this._loadContent(pkg, frame);
        Loader.hide();
    },

    async _loadContent(pkg, frame) {
        try {
            // Пакет розпаковується один раз при ЗАВАНТАЖЕННІ (ScormUpload —
            // кожен файл заливається в Storage окремо, під реальним шляхом).
            // Але Supabase Storage навмисно НЕ віддає завантажений HTML із
            // Content-Type: text/html через публічний URL (захист від
            // збереженого XSS — інакше будь-який залитий HTML виконувався б
            // як повноцінна сторінка з того ж домену) — тому просте
            // `frame.src = entryUrl` не працює, браузер показує сирий текст.
            //
            // Тому саму точку входу качаємо через fetch() і обгортаємо в
            // blob з явним text/html (це обходить серверний Content-Type —
            // тип blob визначає клієнт). Усередину додаємо <base href> на
            // реальну публічну папку пакета — це змушує браузer правильно
            // резолвити ВСІ відносні посилання (і статичні src/href, і
            // динамічні fetch()/XHR усередині курсу) відносно реальних
            // файлів, без розпаковки чи переписування решти пакета.
            const resource = await supabase.from('resources')
                .select('storage_path').eq('id', pkg.resource_id).single();

            if (resource.error || !resource.data?.storage_path) {
                throw new Error('Storage path not found');
            }

            const folder = resource.data.storage_path.replace(/\/?$/, '/'); // гарантуємо кінцевий "/"
            const folderUrl = `${APP_CONFIG.storagePublicUrl}/${APP_CONFIG.buckets.scorm}/${folder}`;
            const entryPath = folder + pkg.entry_point.split('/').map(encodeURIComponent).join('/');
            const entryUrl = `${APP_CONFIG.storagePublicUrl}/${APP_CONFIG.buckets.scorm}/${entryPath}`;

            const entryDir = pkg.entry_point.includes('/')
                ? pkg.entry_point.slice(0, pkg.entry_point.lastIndexOf('/') + 1)
                : '';
            const baseUrl = folderUrl + entryDir.split('/').filter(Boolean).map(encodeURIComponent).join('/') + (entryDir ? '/' : '');

            const response = await fetch(entryUrl);
            if (!response.ok) throw new Error(`Не вдалося завантажити точку входу (${response.status})`);
            let html = await response.text();
            html = /<head[^>]*>/i.test(html)
                ? html.replace(/<head([^>]*)>/i, `<head$1><base href="${baseUrl}">`)
                : `<base href="${baseUrl}">` + html;

            this._setupFrameBridge(frame);
            this._entryBlobUrl = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
            frame.src = this._entryBlobUrl;

        } catch(e) {
            console.error('[SCORM] Load error:', e);
            frame.src = `about:blank`;
            frame.srcdoc = `<html><body style="font-family:sans-serif;padding:2rem;color:#333">
                <h2>SCORM Player</h2>
                <p>Не удалось загрузить пакет: ${e.message}</p>
            </body></html>`;
        }
    },

    _setupFrameBridge(frame) {
        const api = this._api;

        // Inject API when frame loads
        frame.addEventListener('load', () => {
            try {
                const win = frame.contentWindow;
                if (!win) return;

                // Inject SCORM 2004 API
                win.API_1484_11 = {
                    Initialize:    (p) => api.Initialize(p),
                    Terminate:     (p) => api.Terminate(p),
                    GetValue:      (e) => api.GetValue(e),
                    SetValue:      (e,v) => api.SetValue(e,v),
                    Commit:        (p) => api.Commit(p),
                    GetLastError:  ()  => api.GetLastError(),
                    GetErrorString:(c) => api.GetErrorString(c),
                    GetDiagnostic: (c) => api.GetDiagnostic(c)
                };

                // Also inject SCORM 1.2 API for compatibility
                win.API = {
                    LMSInitialize:    (p) => { api.Initialize(p); return 'true'; },
                    LMSFinish:        (p) => { api.Terminate(p); return 'true'; },
                    LMSGetValue:      (e) => api.GetValue(e),
                    LMSSetValue:      (e,v) => api.SetValue(e,v),
                    LMSCommit:        (p) => api.Commit(p),
                    LMSGetLastError:  () => api.GetLastError(),
                    LMSGetErrorString:(c) => api.GetErrorString(c),
                    LMSGetDiagnostic: (c) => api.GetDiagnostic(c)
                };

                // Update status badge
                this._updateStatusBadge(api.data);

            } catch(e) {
                // Cross-origin restriction — expected for blob URLs usually works
                console.warn('[SCORM] Could not inject API:', e.message);
            }
        }, { once: false });

        // Listen for postMessage from SCORM content (fallback)
        window._scormMessageHandler = (event) => {
            if (event.data?.type === 'scorm') {
                const { method, args } = event.data;
                let result = '';
                if (api[method]) result = api[method](...(args || []));
                event.source?.postMessage({ type: 'scorm_reply', id: event.data.id, result }, '*');
            }
        };
        window.addEventListener('message', window._scormMessageHandler);
    },

    _updateStatusBadge(data) {
        const el = document.getElementById(this._statusElId);
        if (!el) return;
        const status = data?.completion_status || data?.['cmi.completion_status'] || 'not attempted';
        el.textContent = Fmt.completionStatus(status);
        el.style.background = {
            'completed': 'rgba(16,185,129,0.15)',
            'incomplete': 'rgba(245,158,11,0.15)',
            'not attempted': 'var(--bg-raised)'
        }[status] || 'var(--bg-raised)';
    },

    close() {
        this._teardown();
        const frame = document.getElementById('scorm-frame');
        if (frame) frame.src = 'about:blank';
        document.getElementById('scorm-overlay')?.classList.add('hidden');
    },

    // Викликається при переході зі сторінки ресурсу (ResourceViewPage.destroy) —
    // фіксує прогрес, прибирає слухачі й звільняє blob-URL точки входу.
    // Сам iframe #rv-scorm-frame знищиться разом з рештою контейнера сторінки.
    closeInline() {
        this._teardown();
    },

    _teardown() {
        // Final commit
        if (this._api) {
            this._api.Commit('');
            this._api = null;
        }

        // Remove message listener
        if (window._scormMessageHandler) {
            window.removeEventListener('message', window._scormMessageHandler);
            window._scormMessageHandler = null;
        }

        if (this._entryBlobUrl) {
            URL.revokeObjectURL(this._entryBlobUrl);
            this._entryBlobUrl = null;
        }

        this._packageId = null;
    },

    _getMimeType(filename) {
        const ext = filename.split('.').pop().toLowerCase();
        const map = {
            'html': 'text/html', 'htm': 'text/html',
            'js':   'application/javascript',
            'css':  'text/css',
            'png':  'image/png', 'jpg': 'image/jpeg', 'jpeg': 'image/jpeg',
            'gif':  'image/gif', 'svg': 'image/svg+xml',
            'xml':  'application/xml', 'json': 'application/json',
            'mp4':  'video/mp4', 'mp3': 'audio/mpeg',
            'pdf':  'application/pdf', 'woff': 'font/woff', 'woff2': 'font/woff2'
        };
        return map[ext] || 'application/octet-stream';
    }
};

// ── SCORM Upload Helper ────────────────────────────────────────────
const ScormUpload = {
    // Parse imsmanifest.xml to extract entry point
    async parseManifest(zip) {
        const manifestFile = zip.file('imsmanifest.xml');
        if (!manifestFile) throw new Error('imsmanifest.xml не найден в архиве');

        const xml    = await manifestFile.async('string');
        const parser = new DOMParser();
        const doc    = parser.parseFromString(xml, 'text/xml');

        // Get title
        const titleEl = doc.querySelector('organizations organization item title,organizations organization title');
        const title   = titleEl?.textContent?.trim() || 'SCORM Package';

        // Get entry point (launch URL)
        const resourceEl = doc.querySelector('resources resource[href]');
        let entryPoint   = resourceEl?.getAttribute('href') || '';

        // Some manifests use adlcp:masterScore or similar
        if (!entryPoint) {
            const itemEl = doc.querySelector('item[identifierref]');
            const ref    = itemEl?.getAttribute('identifierref');
            if (ref) {
                const res = doc.querySelector(`resource[identifier="${ref}"]`);
                entryPoint = res?.getAttribute('href') || '';
            }
        }

        if (!entryPoint) throw new Error('Не удалось найти точку входа в манифесте');

        // Detect SCORM version
        const schemaEl  = doc.querySelector('metadata schemaversion, metadata schema');
        const version   = schemaEl?.textContent?.includes('2004') ? '2004' : '1.2';

        return { title, entryPoint, version };
    },

    // Заливає КОЖЕН файл архіву окремо в Storage під folderPrefix, зберігаючи
    // внутрішню структуру директорій пакета — так плеєр (ScormPlayer) потім
    // просто відкриває реальний URL точки входу, і браузер сам довантажує
    // решту файлів по мірі потреби (замість розпаковки всього zip у пам'яті
    // на кожен запуск курсу — так було раніше, і це було дуже повільно для
    // важких пакетів).
    async _uploadExtracted(zip, folderPrefix, onProgress) {
        const paths = [];
        zip.forEach((relativePath, zipEntry) => { if (!zipEntry.dir) paths.push(relativePath); });
        if (!paths.length) throw new Error('Архів порожній');

        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
            // Тихий фолбек на anonKey тут раніше давав незрозуміле
            // "violates RLS policy" замість чіткої помилки про сесію.
            throw new Error('Сесію не знайдено — перезайдіть у систему й спробуйте ще раз');
        }
        const token = session.access_token;

        let done = 0;
        const uploadOne = async (relativePath) => {
            const bytes = await zip.file(relativePath).async('arraybuffer');
            const dest = (folderPrefix + relativePath).split('/').map(encodeURIComponent).join('/');
            const url = `${APP_CONFIG.supabaseUrl}/storage/v1/object/${APP_CONFIG.buckets.scorm}/${dest}`;
            await new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhr.open('POST', url, true);
                xhr.setRequestHeader('Authorization', `Bearer ${token}`);
                xhr.setRequestHeader('apikey', APP_CONFIG.anonKey);
                xhr.setRequestHeader('Content-Type', ScormPlayer._getMimeType(relativePath));
                xhr.onload = () => {
                    if (xhr.status >= 200 && xhr.status < 300) { resolve(); return; }
                    let msg = `Не вдалось завантажити ${relativePath} (${xhr.status})`;
                    try { const body = JSON.parse(xhr.responseText); if (body?.message) msg += `: ${body.message}`; } catch (_) {}
                    console.error('[ScormUpload._uploadExtracted] response:', xhr.status, xhr.responseText);
                    reject(new Error(msg));
                };
                xhr.onerror = () => reject(new Error(`Помилка мережі під час завантаження ${relativePath}`));
                xhr.send(bytes);
            });
            done++;
            if (onProgress) onProgress(Math.round((done / paths.length) * 100));
        };

        // Пул конкурентності — по кілька файлів одночасно, а не по одному
        // й не всі разом (сотні паралельних запитів на великий пакет).
        const CONCURRENCY = 5;
        let idx = 0;
        const workers = Array.from({ length: Math.min(CONCURRENCY, paths.length) }, async () => {
            while (idx < paths.length) {
                await uploadOne(paths[idx++]);
            }
        });
        await Promise.all(workers);
    },

    // Upload SCORM zip to storage and create DB record
    async upload(lessonId, file) {
        if (!file.name.endsWith('.zip')) throw new Error('Файл должен быть в формате ZIP');

        Loader.show();
        try {
            const zipData = await file.arrayBuffer();
            const zip     = await JSZip.loadAsync(zipData);
            const { title, entryPoint, version } = await this.parseManifest(zip);

            const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_').replace(/\.zip$/i, '');
            const folder = `${lessonId}/${Date.now()}_${safeName}/`;
            await this._uploadExtracted(zip, folder);

            // Create resource record
            const resource = await API.resources.create({
                lesson_id:    lessonId,
                title:        title || file.name.replace('.zip', ''),
                type:         'scorm',
                storage_path: folder,
                file_size:    file.size
            });

            // Create SCORM package record
            const pkg = await API.scorm.createPackage({
                resource_id:   resource.id,
                manifest_path: 'imsmanifest.xml',
                entry_point:   entryPoint,
                scorm_version: version,
                title
            });

            Toast.success('SCORM загружен', `"${title}" успешно загружен`);
            return { resource, pkg };
        } finally {
            Loader.hide();
        }
    },

    // Чи є в архіві imsmanifest.xml — швидка перевірка "це взагалі SCORM?"
    // без прив'язки до lessonId, для звичайної форми "Додати ресурс" у Базі
    // знань (там немає уроку, resource створюється саме через saveResource()).
    async parseAndUpload(file, onProgress) {
        if (!file.name.toLowerCase().endsWith('.zip')) return null;
        const zipData = await file.arrayBuffer();
        const zip = await JSZip.loadAsync(zipData);
        if (!zip.file('imsmanifest.xml')) return null; // звичайний zip, не SCORM

        const { title, entryPoint, version } = await this.parseManifest(zip);
        const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_').replace(/\.zip$/i, '');
        const folder = `resources/${Date.now()}_${safeName}/`;

        await this._uploadExtracted(zip, folder, onProgress);

        return {
            storage_path: folder,
            original_name: file.name,
            title,
            entryPoint,
            version
        };
    }
};
