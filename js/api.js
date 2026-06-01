// ================================================================
// EduFlow LMS — API Layer (Supabase wrapper)
// ================================================================

const API = {

    // ── Profiles ────────────────────────────────────────────────────
    profiles: {
        async me() {
            const { data, error } = await supabase
                .from('profiles').select('*')
                .eq('id', AppState.user.id).single();
            if (error) throw error;
            return data;
        },

        async getAll({ role, search, page = 0, pageSize = 20 } = {}) {
            let q = supabase.from('profiles').select('*', { count: 'exact' });
            if (role)   q = q.eq('role', role);
            if (search) q = q.ilike('full_name', `%${search}%`);
            q = q.order('created_at', { ascending: false })
                 .range(page * pageSize, (page + 1) * pageSize - 1);
            const { data, error, count } = await q;
            if (error) throw error;
            return { data, count };
        },

        async update(id, fields) {
            const { data, error } = await supabase
                .from('profiles').update(fields).eq('id', id).select().single();
            if (error) throw error;
            return data;
        },

        async updateRole(id, role) {
            return this.update(id, { role });
        },

        async forceLogout(id) {
            const { data, error } = await supabase
                .from('profiles')
                .update({ force_logout: true })
                .eq('id', id)
                .select('force_logout')
                .single();
            if (error) throw error;
            // RLS може мовчки заблокувати update — перевіряємо реальний результат
            if (!data || data.force_logout !== true) {
                throw new Error('Не вдалося змінити профіль — перевірте RLS (migration_v83.sql)');
            }
        },

        async clearForceLogout(id) {
            await supabase.from('profiles').update({ force_logout: false }).eq('id', id);
        },

        async updateUiPrefs(prefs) {
            const id = AppState.user?.id;
            if (!id) return;
            const merged = { ...(AppState.profile?.ui_prefs || {}), ...prefs };
            const { error } = await supabase.from('profiles').update({ ui_prefs: merged }).eq('id', id);
            if (!error && AppState.profile) AppState.profile.ui_prefs = merged;
        },

        async markTourDone(tourId) {
            const id = AppState.user?.id;
            if (!id) return;
            const current = AppState.profile?.completed_tours || [];
            if (current.includes(tourId)) return;
            const updated = [...current, tourId];
            const { error } = await supabase.from('profiles')
                .update({ completed_tours: updated }).eq('id', id);
            if (!error && AppState.profile) AppState.profile.completed_tours = updated;
        },

        isTourDone(tourId) {
            return (AppState.profile?.completed_tours || []).includes(tourId);
        },

        async getSubordinates(managerId) {
            const { data, error } = await supabase
                .from('profiles')
                .select('id, full_name, avatar_url, job_position, subdivision, email')
                .eq('manager_id', managerId)
                .eq('is_active', true);
            if (error) throw error;
            return data || [];
        },

        async uploadAvatar(file) {
            const ext  = file.name.split('.').pop();
            const path = `${AppState.user.id}/avatar.${ext}`;
            const { error } = await supabase.storage
                .from(APP_CONFIG.buckets.avatars).upload(path, file, { upsert: true });
            if (error) throw error;
            const url = `${APP_CONFIG.storagePublicUrl}/${APP_CONFIG.buckets.avatars}/${path}?t=${Date.now()}`;
            await this.update(AppState.user.id, { avatar_url: url });
            return url;
        }
    },

    // ── Courses ─────────────────────────────────────────────────────
    courses: {
        async getAll({ published, search, page = 0, pageSize = APP_CONFIG.pageSize } = {}) {
            let q = supabase.from('courses')
                .select('*, teacher:profiles!teacher_id(full_name, avatar_url)', { count: 'exact' });
            if (published !== undefined) q = q.eq('is_published', published);
            if (search) q = q.ilike('title', `%${search}%`);
            q = q.order('created_at', { ascending: false })
                 .range(page * pageSize, (page + 1) * pageSize - 1);
            const { data, error, count } = await q;
            if (error) throw error;
            return { data, count };
        },

        async getById(id) {
            const { data, error } = await supabase.from('courses')
                .select(`*,
                    teacher:profiles!teacher_id(id, full_name, avatar_url),
                    lessons(*, resources(*, scorm_packages(*)))
                `)
                .eq('id', id).single();
            if (error) throw error;
            return data;
        },

        async getBySlug(slug) {
            const { data, error } = await supabase.from('courses')
                .select(`*,
                    teacher:profiles!teacher_id(id, full_name),
                    lessons(id, title, order_index, is_published, duration_minutes, is_free_preview)
                `)
                .eq('slug', slug).single();
            if (error) throw error;
            return data;
        },

        async create(fields) {
            const slug = fields.slug || Fmt.slug(fields.title) + '-' + Date.now().toString(36);
            const { data, error } = await supabase.from('courses')
                .insert({ ...fields, slug, teacher_id: AppState.profile.id })
                .select().single();
            if (error) throw error;
            return data;
        },

        async update(id, fields) {
            const { data, error } = await supabase.from('courses')
                .update(fields).eq('id', id).select().single();
            if (error) throw error;
            return data;
        },

        async delete(id) {
            const { error } = await supabase.from('courses').delete().eq('id', id);
            if (error) throw error;
        },

        async uploadThumbnail(courseId, file) {
            const ext  = file.name.split('.').pop();
            const path = `${courseId}/thumbnail.${ext}`;
            const { error } = await supabase.storage
                .from(APP_CONFIG.buckets.thumbnails)
                .upload(path, file, { upsert: true, contentType: file.type });
            if (error) throw error;
            const url = `${APP_CONFIG.storagePublicUrl}/${APP_CONFIG.buckets.thumbnails}/${path}?v=${Date.now()}`;
            await this.update(courseId, { thumbnail_url: url });
            return url;
        },

        async uploadBadge(courseId, file) {
            const ext  = file.name.split('.').pop();
            const path = `${courseId}/badge.${ext}`;
            const { error } = await supabase.storage
                .from(APP_CONFIG.buckets.thumbnails)
                .upload(path, file, { upsert: true, contentType: file.type });
            if (error) throw error;
            const url = `${APP_CONFIG.storagePublicUrl}/${APP_CONFIG.buckets.thumbnails}/${path}?v=${Date.now()}`;
            await this.update(courseId, { badge_url: url });
            return url;
        },

        async removeBadge(courseId) {
            await this.update(courseId, { badge_url: null });
        }
    },

    // ── Course teachers ─────────────────────────────────────────────
    // ── Course Runs (потоки) ──────────────────────────────────────────
    courseRuns: {
        async getByCourse(courseId) {
            const { data, error } = await supabase.from('course_runs')
                .select('*')
                .eq('course_id', courseId)
                .order('start_date', { ascending: false });
            if (error) throw error;
            return data || [];
        },

        async getActive(courseId) {
            const today = new Date().toISOString().slice(0, 10);
            const { data } = await supabase.from('course_runs')
                .select('*')
                .eq('course_id', courseId)
                .or(`end_date.is.null,end_date.gte.${today}`)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();
            return data;
        },

        async create(courseId, { title, start_date, end_date, start_time, end_time }) {
            const { data, error } = await supabase.from('course_runs')
                .insert({ course_id: courseId, title, start_date: start_date || null, end_date: end_date || null, start_time: start_time || null, end_time: end_time || null })
                .select().single();
            if (error) throw error;
            return data;
        },

        async update(id, { title, start_date, end_date, start_time, end_time }) {
            const { error } = await supabase.from('course_runs')
                .update({ title, start_date: start_date || null, end_date: end_date || null, start_time: start_time || null, end_time: end_time || null })
                .eq('id', id);
            if (error) throw error;
        },

        async remove(id) {
            const { error } = await supabase.from('course_runs').delete().eq('id', id);
            if (error) throw error;
        },
    },

    courseTeachers: {
        async getByCourse(courseId) {
            const { data, error } = await supabase.from('course_teachers')
                .select('*, profile:profiles(id, full_name, avatar_url, job_position)')
                .eq('course_id', courseId)
                .eq('is_active', true)
                .order('created_at');
            if (error) throw error;
            return data || [];
        },

        async setMe(courseId, label) {
            const { error } = await supabase.from('course_teachers')
                .insert({ course_id: courseId, user_id: AppState.user.id, label: label || null, is_active: true });
            if (error) throw error;
        },

        async updateLabel(id, label) {
            const { error } = await supabase.from('course_teachers')
                .update({ label }).eq('id', id);
            if (error) throw error;
        },

        async remove(id) {
            const { error } = await supabase.from('course_teachers').delete().eq('id', id);
            if (error) throw error;
        }
    },

    // ── Enrollments ─────────────────────────────────────────────────
    enrollments: {
        async getMyEnrollments() {
            const { data, error } = await supabase.from('enrollments')
                .select(`*, course:courses(*, teacher:profiles!teacher_id(full_name)), run:course_runs(id, title, start_date, end_date)`)
                .eq('user_id', AppState.user.id)
                .order('enrolled_at', { ascending: false });
            if (error) throw error;
            return data;
        },

        async getMyCompleted() {
            const today = new Date().toISOString().slice(0, 10);
            const { data, error } = await supabase.from('enrollments')
                .select(`*, course:courses(id, title, thumbnail_url), run:course_runs(id, title, start_date, end_date)`)
                .eq('user_id', AppState.user.id)
                .order('enrolled_at', { ascending: false });
            if (error) throw error;
            return (data || []).filter(e =>
                (e.completed_at) ||
                (e.run && e.run.end_date && e.run.end_date < today)
            );
        },

        async getRunParticipants(courseId, runId) {
            const { data, error } = await supabase.from('enrollments')
                .select(`user:profiles!user_id(id, full_name, avatar_url, city)`)
                .eq('course_id', courseId)
                .eq('run_id', runId);
            if (error) throw error;
            return (data || []).map(e => e.user).filter(Boolean);
        },

        async isEnrolled(courseId, runId = null) {
            let q = supabase.from('enrollments')
                .select('id, run_id, completed_at')
                .eq('user_id', AppState.user.id)
                .eq('course_id', courseId);
            if (runId) q = q.eq('run_id', runId);
            const { data } = await q.order('enrolled_at', { ascending: false }).limit(1).maybeSingle();
            return data || null;
        },

        async getEnrollments(courseId) {
            const { data } = await supabase.from('enrollments')
                .select('id, run_id, completed_at, progress_percentage, created_at')
                .eq('user_id', AppState.user.id)
                .eq('course_id', courseId)
                .order('created_at', { ascending: false });
            return data || [];
        },

        async enroll(courseId, runId = null) {
            const row = { user_id: AppState.user.id, course_id: courseId };
            if (runId) row.run_id = runId;
            const { error } = await supabase.from('enrollments').insert(row);
            if (error && error.code !== '23505') throw error;
        },

        async unenroll(courseId) {
            const { error } = await supabase.from('enrollments')
                .delete().eq('course_id', courseId).eq('user_id', (await supabase.auth.getUser()).data.user.id);
            if (error) throw error;
        },

        async resetCourse(courseId) {
            const { error } = await supabase.from('enrollments').delete().eq('course_id', courseId);
            if (error) throw error;
        },

        async getCourseEnrollments(courseId) {
            const { data, error } = await supabase.from('enrollments')
                .select(`*, user:profiles!user_id(id, full_name, email, avatar_url, role, city)`)
                .eq('course_id', courseId)
                .order('enrolled_at', { ascending: false });
            if (error) throw error;
            return data;
        },

        async getAll() {
            const { data, error } = await supabase.from('enrollments')
                .select(`
                    *,
                    user:profiles!user_id(id, full_name, email),
                    course:courses(id, title)
                `).order('enrolled_at', { ascending: false });
            if (error) throw error;
            return data;
        }
    },

    // ── Lessons ─────────────────────────────────────────────────────
    lessons: {
        async getByCourse(courseId) {
            const { data, error } = await supabase.from('lessons')
                .select(`*, resources(*, scorm_packages(*))`)
                .eq('course_id', courseId)
                .order('order_index');
            if (error) throw error;
            return data;
        },

        async getById(id) {
            const { data, error } = await supabase.from('lessons')
                .select(`*, resources(*, scorm_packages(*)), course:courses(id, title)`)
                .eq('id', id).single();
            if (error) throw error;
            return data;
        },

        async create(fields) {
            const { data, error } = await supabase.from('lessons')
                .insert(fields).select().single();
            if (error) throw error;
            return data;
        },

        async update(id, fields) {
            const { data, error } = await supabase.from('lessons')
                .update(fields).eq('id', id).select().single();
            if (error) throw error;
            return data;
        },

        async delete(id) {
            const { error } = await supabase.from('lessons').delete().eq('id', id);
            if (error) throw error;
        },

        async reorder(lessons) {
            const updates = lessons.map((l, i) => ({ id: l.id, order_index: i }));
            const { error } = await supabase.from('lessons').upsert(updates);
            if (error) throw error;
        }
    },

    // ── Resources ────────────────────────────────────────────────────
    resources: {
        async create(fields) {
            const { data, error } = await supabase.from('resources')
                .insert({ ...fields, created_by: AppState.user.id }).select().single();
            if (error) throw error;
            return data;
        },

        async update(id, fields) {
            const { data, error } = await supabase.from('resources')
                .update(fields).eq('id', id).select().single();
            if (error) throw error;
            return data;
        },

        async delete(id) {
            const { error } = await supabase.from('resources').delete().eq('id', id);
            if (error) throw error;
        },

        async softDelete(id) {
            const { error } = await supabase.from('resources')
                .update({ deleted_at: new Date().toISOString(), deleted_by: AppState.user.id })
                .eq('id', id);
            if (error) throw error;
        },

        async restore(id) {
            const { error } = await supabase.from('resources')
                .update({ deleted_at: null, deleted_by: null })
                .eq('id', id);
            if (error) throw error;
        },

        async getTrash() {
            const { data, error } = await supabase.from('resources')
                .select('*, deleter:profiles!deleted_by(full_name)')
                .not('deleted_at', 'is', null)
                .order('deleted_at', { ascending: false });
            if (error) throw error;
            return data || [];
        },

        async getAll({ courseId, search, category, page = 0, pageSize = 20, includeLessonResources = false, studentOnly = false, trackedOnly = false, docsOnly = false } = {}) {
            let q = supabase.from('resources')
                .select(`*, course:courses(id,title), creator:profiles!created_by(full_name),
                    access_group:access_groups(id,name,is_public,
                        cities:access_group_cities(city),
                        positions:access_group_positions(position),
                        departments:access_group_departments(department),
                        labels:access_group_labels(label)),
                    resource_dovirenosti(dovirenost_id, dovirenosti(id,name))`, { count: 'exact' });
            q = q.is('deleted_at', null);
            q = q.is('display_block', null);
            q = q.is('red_folder_item_id', null);
            if (!includeLessonResources) q = q.is('lesson_id', null);
            if (courseId) q = q.eq('course_id', courseId);
            if (category) q = q.eq('category', category);
            if (search) {
                // Normalize spaces between digits so "12 105" and "12105" match each other
                let compact = search.trim();
                while (/\d\s+\d/.test(compact)) compact = compact.replace(/(\d)\s+(\d)/g, '$1$2');
                const esc = compact.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const pattern = esc.replace(/(\d)(?=\d)/g, '$1\\s*');
                q = q.or(`title.imatch.${pattern},description.imatch.${pattern}`);
            }
            if (studentOnly) q = q.is('course_id', null);
            if (trackedOnly) q = q.eq('is_tracked_download', true);
            // docs section: exclude video, link, scorm — keep pdf/file/image/doc types
            if (docsOnly) q = q.neq('type', 'video').neq('type', 'link').neq('type', 'scorm');
            q = q.order('created_at', { ascending: false })
                 .range(page * pageSize, (page + 1) * pageSize - 1);
            const { data, error, count } = await q;
            if (error) throw error;
            return { data, count };
        },

        async getById(id) {
            const { data, error } = await supabase.from('resources')
                .select(`*, course:courses(id,title), creator:profiles!created_by(full_name),
                    access_group:access_groups(id,name,is_public,
                        cities:access_group_cities(city),
                        positions:access_group_positions(position),
                        departments:access_group_departments(department),
                        labels:access_group_labels(label)),
                    resource_dovirenosti(dovirenost_id, dovirenosti(id,name))`).eq('id', id).single();
            if (error) throw error;
            return data;
        },

        async setDovirenosti(resourceId, ids) {
            await supabase.from('resource_dovirenosti').delete().eq('resource_id', resourceId);
            if (ids.length) {
                const rows = ids.map(id => ({ resource_id: resourceId, dovirenost_id: id }));
                const { error } = await supabase.from('resource_dovirenosti').insert(rows);
                if (error) throw error;
            }
        },

        async getCategories({ trackedOnly = false, docsOnly = false } = {}) {
            let q = supabase.from('resources')
                .select('category', { distinct: true })
                .order('category', { ascending: true });
            if (trackedOnly) q = q.eq('is_tracked_download', true);
            if (docsOnly) q = q.neq('type', 'video').neq('type', 'link').neq('type', 'scorm');
            const { data, error } = await q;
            if (error) throw error;
            return [...new Set((data || []).map(r => r.category).filter(Boolean))].sort();
        },

        async getSignedUrl(storagePath) {
            if (!storagePath) throw new Error('Storage path not specified');
            const { data, error } = await supabase.storage
                .from(APP_CONFIG.buckets.resources)
                .createSignedUrl(storagePath, APP_CONFIG.signedUrlExpiry);
            if (error) throw error;
            return data.signedUrl;
        },

        async getSignedDownloadUrl(storagePath, filename) {
            if (!storagePath) throw new Error('Storage path not specified');
            const { data, error } = await supabase.storage
                .from(APP_CONFIG.buckets.resources)
                .createSignedUrl(storagePath, APP_CONFIG.signedUrlExpiry, { download: filename || true });
            if (error) throw error;
            return data.signedUrl;
        },

        async uploadToStorage(file) {
            const ext = file.name.split('.').pop().toLowerCase();
            const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
            const path = `resources/${Date.now()}_${safeName}`;
            const { error } = await supabase.storage
                .from(APP_CONFIG.buckets.resources)
                .upload(path, file, { upsert: true, contentType: file.type || undefined });
            if (error) throw error;
            return {
                storage_path: path,
                original_name: file.name,
                file_type: file.type || this._mimeTypeByExt(ext),
                type: this._resourceTypeByExt(ext),
                file_url: null
            };
        },

        async createWithFile(file, fields) {
            const upload = await this.uploadToStorage(file);
            return this.create({ ...fields, ...upload });
        },

        _resourceTypeByExt(ext) {
            const map = {
                pdf: 'pdf',
                mp4: 'video', webm: 'video', ogg: 'video',
                jpg: 'image', jpeg: 'image', png: 'image', gif: 'image', svg: 'image',
                doc: 'file', docx: 'file', xls: 'file', xlsx: 'file', ppt: 'file', pptx: 'file',
                txt: 'file', zip: 'file', rar: 'file', csv: 'file'
            };
            return map[ext] || 'file';
        },

        _mimeTypeByExt(ext) {
            const map = {
                pdf: 'application/pdf',
                mp4: 'video/mp4', webm: 'video/webm', ogg: 'video/ogg',
                jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', svg: 'image/svg+xml',
                doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                ppt: 'application/vnd.ms-powerpoint', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
                txt: 'text/plain', csv: 'text/csv', zip: 'application/zip', rar: 'application/vnd.rar'
            };
            return map[ext] || 'application/octet-stream';
        },

        async getRedFolderDocs() {
            const { data, error } = await supabase.from('resources')
                .select('id, title, red_folder_item_id, type, storage_path, dovirenost_id')
                .not('red_folder_item_id', 'is', null)
                .order('created_at');
            if (error) throw error;
            return data || [];
        },

        async getBranchDocs(dovirenostId) {
            let q = supabase.from('resources')
                .select('id, title, display_block, type, storage_path, url, dovirenost_id, dovirenosti(id,name)')
                .not('display_block', 'is', null)
                .is('lesson_id', null)
                .order('display_block');
            // dovirenost_id filter added after migration v68 is applied
            // if (dovirenostId) q = q.or(`dovirenost_id.eq.${dovirenostId},dovirenost_id.is.null`);
            const { data, error } = await q;
            if (error) throw error;
            return data || [];
        }
    },

    // ── SCORM ────────────────────────────────────────────────────────
    scorm: {
        async getPackage(resourceId) {
            const { data, error } = await supabase.from('scorm_packages')
                .select('*').eq('resource_id', resourceId).single();
            if (error && error.code !== 'PGRST116') throw error;
            return data;
        },

        async createPackage(fields) {
            const { data, error } = await supabase.from('scorm_packages')
                .insert(fields).select().single();
            if (error) throw error;
            return data;
        },

        async getProgress(scormPackageId) {
            const { data, error } = await supabase.from('scorm_progress')
                .select('*')
                .eq('user_id', AppState.user.id)
                .eq('scorm_package_id', scormPackageId).single();
            if (error && error.code !== 'PGRST116') throw error;
            return data;
        },

        async saveProgress(scormPackageId, progressData) {
            const payload = {
                user_id: AppState.user.id,
                scorm_package_id: scormPackageId,
                ...progressData
            };
            const { error } = await supabase.from('scorm_progress').upsert(payload, {
                onConflict: 'user_id,scorm_package_id'
            });
            if (error) throw error;
        },

        async getAllProgress(courseId) {
            const { data, error } = await supabase.from('scorm_progress')
                .select(`
                    *,
                    user:profiles!user_id(full_name, email),
                    package:scorm_packages(id, title)
                `)
                .order('updated_at', { ascending: false });
            if (error) throw error;
            return data;
        }
    },

    // ── Tests ────────────────────────────────────────────────────────
    tests: {
        async getByCourse(courseId) {
            const { data, error } = await supabase.from('tests')
                .select('*').eq('course_id', courseId).order('order_index');
            if (error) throw error;
            return data;
        },

        async getById(id) {
            const { data, error } = await supabase.from('tests')
                .select(`*, course:courses(id,title), questions(*, answers(*))`)
                .eq('id', id).single();
            if (error) throw error;
            // Sort questions and answers by order_index
            data.questions?.sort((a,b) => a.order_index - b.order_index);
            data.questions?.forEach(q => q.answers?.sort((a,b) => a.order_index - b.order_index));
            return data;
        },

        async create(fields) {
            const { data, error } = await supabase.from('tests')
                .insert(fields).select().single();
            if (error) throw error;
            return data;
        },

        async update(id, fields) {
            const { data, error } = await supabase.from('tests')
                .update(fields).eq('id', id).select().single();
            if (error) throw error;
            return data;
        },

        async delete(id) {
            const { error } = await supabase.from('tests').delete().eq('id', id);
            if (error) throw error;
        },

        async getAll() {
            const { data, error } = await supabase.from('tests')
                .select('*, course:courses(title)').order('created_at', { ascending: false });
            if (error) throw error;
            return data;
        },

        async getMyPendingCount() {
            const uid = AppState.user?.id;
            if (!uid) return 0;
            const { data: assignments } = await supabase.from('test_assignments')
                .select('test_id').eq('user_id', uid);
            if (!assignments?.length) return 0;
            const testIds = assignments.map(a => a.test_id);
            const { data: done } = await supabase.from('test_attempts')
                .select('test_id').eq('user_id', uid).not('completed_at', 'is', null).in('test_id', testIds);
            const doneIds = new Set((done || []).map(a => a.test_id));
            return testIds.filter(id => !doneIds.has(id)).length;
        }
    },

    // ── Questions & Answers ──────────────────────────────────────────
    questions: {
        async create(fields) {
            const { data, error } = await supabase.from('questions')
                .insert(fields).select().single();
            if (error) throw error;
            return data;
        },

        async update(id, fields) {
            const { data, error } = await supabase.from('questions')
                .update(fields).eq('id', id).select().single();
            if (error) throw error;
            return data;
        },

        async delete(id) {
            const { error } = await supabase.from('questions').delete().eq('id', id);
            if (error) throw error;
        },

        async createAnswer(fields) {
            const { data, error } = await supabase.from('answers')
                .insert(fields).select().single();
            if (error) throw error;
            return data;
        },

        async deleteAnswer(id) {
            const { error } = await supabase.from('answers').delete().eq('id', id);
            if (error) throw error;
        },

        async upsertAnswers(questionId, answers) {
            await supabase.from('answers').delete().eq('question_id', questionId);
            if (!answers.length) return [];
            const { data, error } = await supabase.from('answers').insert(
                answers.map((a, i) => ({
                    question_id: questionId,
                    answer_text: a.text,
                    is_correct:  a.is_correct,
                    image_url:   a.image_url   || null,
                    image_align: a.image_align || 'left',
                    order_index: i
                }))
            ).select();
            if (error) throw error;
            return data || [];
        }
    },

    // ── Test Images (Storage) ────────────────────────────────────────
    testImages: {
        async upload(file, testId, questionId) {
            const ext  = file.name.split('.').pop().toLowerCase();
            const path = `${testId}/${questionId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
            const opts = { upsert: false };
            if (file.type) opts.contentType = file.type;
            const { error } = await supabase.storage
                .from(APP_CONFIG.buckets.testImages)
                .upload(path, file, opts);
            if (error) throw error;
            const url = `${APP_CONFIG.storagePublicUrl}/${APP_CONFIG.buckets.testImages}/${path}`;
            return { url, path };
        },

        async remove(url) {
            const prefix = `${APP_CONFIG.storagePublicUrl}/${APP_CONFIG.buckets.testImages}/`;
            const path   = url.startsWith(prefix) ? url.slice(prefix.length) : null;
            if (!path) return;
            await supabase.storage.from(APP_CONFIG.buckets.testImages).remove([path]);
        }
    },

    // ── Notifications ────────────────────────────────────────────────
    notifications: {
        async getMine() {
            const { data, error } = await supabase.from('notifications')
                .select('*')
                .eq('user_id', AppState.user.id)
                .order('created_at', { ascending: false })
                .limit(50);
            if (error) throw error;
            return data || [];
        },

        async getUnreadCount() {
            const { count, error } = await supabase.from('notifications')
                .select('id', { count: 'exact', head: true })
                .eq('user_id', AppState.user.id)
                .eq('is_read', false);
            if (error) return 0;
            return count || 0;
        },

        async markRead(id) {
            await supabase.from('notifications')
                .update({ is_read: true })
                .eq('id', id).eq('user_id', AppState.user.id);
        },

        async markAllRead() {
            await supabase.from('notifications')
                .update({ is_read: true })
                .eq('user_id', AppState.user.id)
                .eq('is_read', false);
        },

        async create({ user_id, title, message, type = 'info', link = null }) {
            const { error } = await supabase.from('notifications').insert({
                user_id, title, message, type, link,
                created_by: AppState.user?.id || null,
                is_read: false
            });
            if (error) throw error;
        },

        async deleteByLink(link) {
            await supabase.from('notifications').delete().eq('link', link);
        },

        // Визначає яким звичайним користувачам надіслати сповіщення з урахуванням довіреностей та access_group
        async _resolveNotifyUserIds(resourceId, accessGroupId) {
            if (!resourceId) return [];
            // 1. Перевіряємо довіреності документа
            const { data: resDovs } = await supabase.from('resource_dovirenosti').select('dovirenost_id').eq('resource_id', resourceId);
            const dovIds = (resDovs || []).map(r => r.dovirenost_id);
            if (dovIds.length) {
                const { data: profDovs } = await supabase.from('profile_dovirenosti').select('profile_id').in('dovirenost_id', dovIds);
                return [...new Set((profDovs || []).map(r => r.profile_id))];
            }
            // 2. Якщо є access_group — фільтруємо за її критеріями
            if (accessGroupId) {
                const { data: ag } = await supabase.from('access_groups')
                    .select('is_public, cities:access_group_cities(city), positions:access_group_positions(position), departments:access_group_departments(department), labels:access_group_labels(label)')
                    .eq('id', accessGroupId).single();
                if (!ag) return []; // групу видалено — нікому не надсилаємо
                if (ag.is_public) {
                    const { data: all } = await supabase.from('profiles').select('id').eq('is_active', true).eq('role', 'user');
                    return (all || []).map(p => p.id);
                }
                // Будуємо фільтр за містами/посадами/підрозділами/мітками
                let q = supabase.from('profiles').select('id').eq('is_active', true).eq('role', 'user');
                const cities = (ag.cities || []).map(c => c.city).filter(Boolean);
                const positions = (ag.positions || []).map(p => p.position).filter(Boolean);
                const depts = (ag.departments || []).map(d => d.department).filter(Boolean);
                const labels = (ag.labels || []).map(l => l.label).filter(Boolean);
                if (cities.length) q = q.in('city', cities);
                if (positions.length) q = q.in('job_position', positions);
                if (depts.length) q = q.in('subdivision', depts);
                if (labels.length) q = q.in('label', labels);
                const { data: filtered } = await q;
                return (filtered || []).map(p => p.id);
            }
            // 3. Без обмежень — всі активні користувачі
            const { data: allUsers } = await supabase.from('profiles').select('id').eq('is_active', true).eq('role', 'user');
            return (allUsers || []).map(p => p.id);
        },

        async notifyResourcePublished(resource, overrideLink = null, isUpdate = false) {
            const staffRoles = ['owner', 'admin', 'smm', 'teacher', 'manager'];
            const { data: staffData } = await supabase.from('profiles').select('id').eq('is_active', true).in('role', staffRoles);
            const staffIds = (staffData || []).map(p => p.id);
            const regularIds = await this._resolveNotifyUserIds(resource.id, resource.access_group_id);

            const userIds = [...new Set([...staffIds, ...regularIds])];
            if (!userIds.length) return;
            const isDoc = resource.is_tracked_download;
            const link = resource.id ? `resource/${resource.id}` : (overrideLink || (isDoc ? 'documents' : 'knowledge-base'));
            const typeIcon = isDoc ? '📋' : '📁';
            const action = isUpdate ? 'Оновлено' : 'Новий';
            const actionTitle = `${typeIcon} ${action}${resource.category ? ` · ${resource.category}` : ''}`;
            const actionMsg = `«${resource.title}»${resource.description ? ': ' + resource.description.slice(0, 100) : ''}.`;
            const rows = userIds.map(uid => ({
                user_id:    uid,
                title:      actionTitle,
                message:    actionMsg,
                type:       'general',
                link,
                created_by: AppState.user.id,
                is_read:    false
            }));
            await supabase.from('notifications').insert(rows);
        }
    },

    // ── Attempts ─────────────────────────────────────────────────────
    attempts: {
        async getByTest(testId, runId = null) {
            let q = supabase.from('test_attempts')
                .select('*')
                .eq('user_id', AppState.user.id)
                .eq('test_id', testId);
            if (runId) q = q.eq('run_id', runId);
            const { data, error } = await q.order('started_at', { ascending: false });
            if (error) throw error;
            return data;
        },

        async getAllForTest(testId) {
            const { data, error } = await supabase.from('test_attempts')
                .select(`*, user:profiles!user_id(full_name, email)`)
                .eq('test_id', testId)
                .order('completed_at', { ascending: false });
            if (error) throw error;
            return data;
        },

        async create(testId, runId = null) {
            const prev = await this.getByTest(testId, runId);
            const row = {
                user_id: AppState.user.id,
                test_id: testId,
                attempt_number: prev.length + 1,
            };
            if (runId) row.run_id = runId;
            const { data, error } = await supabase.from('test_attempts')
                .insert(row).select().single();
            if (error) throw error;
            return data;
        },

        async complete(attemptId, { score, maxScore, percentage, passed, timeSpent, answers }) {
            // Save attempt result
            const { error: e1 } = await supabase.from('test_attempts')
                .update({
                    score, max_score: maxScore,
                    percentage, passed,
                    completed_at: new Date().toISOString(),
                    time_spent_seconds: timeSpent
                }).eq('id', attemptId);
            if (e1) throw e1;

            // Save per-question answers
            if (answers?.length) {
                const { error: e2 } = await supabase.from('attempt_answers').insert(
                    answers.map(a => ({
                        attempt_id: attemptId,
                        question_id: a.questionId,
                        selected_answer_ids: a.selectedIds,
                        is_correct: a.isCorrect,
                        points_earned: a.pointsEarned
                    }))
                );
                if (e2) throw e2;
            }
        },

        async getAnswers(attemptId) {
            const { data, error } = await supabase.from('attempt_answers')
                .select('*').eq('attempt_id', attemptId);
            if (error) throw error;
            return data;
        },

        async getAll() {
            const { data, error } = await supabase.from('test_attempts')
                .select(`
                    *,
                    user:profiles!user_id(full_name, email),
                    test:tests(title, passing_score, course:courses(title))
                `)
                .not('completed_at', 'is', null)
                .order('completed_at', { ascending: false });
            if (error) throw error;
            return data;
        },

        async getMyGrants(testId) {
            const { data, error } = await supabase.from('test_attempt_grants')
                .select('id')
                .eq('test_id', testId)
                .eq('user_id', AppState.user.id);
            if (error) throw error;
            return (data || []).length;
        },

        async getGrantsForTest(testId) {
            const { data, error } = await supabase.from('test_attempt_grants')
                .select('user_id')
                .eq('test_id', testId);
            if (error) throw error;
            const counts = {};
            (data || []).forEach(r => { counts[r.user_id] = (counts[r.user_id] || 0) + 1; });
            return counts;
        },

        async grantExtra(testId, userId) {
            const { error } = await supabase.from('test_attempt_grants').insert({
                test_id:    testId,
                user_id:    userId,
                granted_by: AppState.user.id
            });
            if (error) throw error;
        }
    },

    // ── Lesson Progress ──────────────────────────────────────────────
    progress: {
        async getByLesson(lessonId) {
            const { data } = await supabase.from('lesson_progress')
                .select('*').eq('user_id', AppState.user.id).eq('lesson_id', lessonId).single();
            return data;
        },

        async getForCourse(courseId) {
            const { data, error } = await supabase.from('lesson_progress')
                .select('*, lesson:lessons(course_id)')
                .eq('user_id', AppState.user.id);
            if (error) throw error;
            return data?.filter(p => p.lesson?.course_id === courseId) || [];
        },

        async markComplete(lessonId, courseId) {
            const { error } = await supabase.from('lesson_progress').upsert({
                user_id: AppState.user.id,
                lesson_id: lessonId,
                completed: true,
                completed_at: new Date().toISOString(),
                last_accessed_at: new Date().toISOString()
            }, { onConflict: 'user_id,lesson_id' });
            if (error) throw error;
            // Recalculate course progress
            await supabase.rpc('update_course_progress', {
                p_user_id: AppState.user.id,
                p_course_id: courseId
            });
        }
    },

    // ── Custom Pages (Сторінки) ──────────────────────────────────────
    pages: {
        async getAll() {
            const { data, error } = await supabase
                .from('custom_pages')
                .select('id, title, is_published, is_home, allowed_labels, created_at, updated_at, creator:profiles!created_by(full_name)')
                .order('created_at', { ascending: false });
            if (error) throw error;
            const pages = data || [];
            if (AppState.isStaff()) return pages;
            // додаткова фронтова перевірка
            const userLabel = AppState.profile?.label || null;
            return pages.filter(p =>
                p.is_published && (
                    !p.allowed_labels?.length ||
                    (userLabel && p.allowed_labels.includes(userLabel))
                )
            );
        },

        async getById(id) {
            const { data, error } = await supabase
                .from('custom_pages')
                .select('*, creator:profiles!created_by(full_name)')
                .eq('id', id).single();
            if (error) throw error;
            return data;
        },

        async create(fields) {
            const { data, error } = await supabase
                .from('custom_pages')
                .insert({ ...fields, created_by: AppState.user.id })
                .select().single();
            if (error) throw error;
            return data;
        },

        async update(id, fields) {
            const { data, error } = await supabase
                .from('custom_pages')
                .update(fields).eq('id', id).select().single();
            if (error) throw error;
            return data;
        },

        async setHome(id) {
            // Знімаємо is_home з усіх, потім ставимо на обрану
            await supabase.from('custom_pages').update({ is_home: false }).eq('is_home', true);
            const { error } = await supabase.from('custom_pages').update({ is_home: true }).eq('id', id);
            if (error) throw error;
        },

        async delete(id) {
            const { error } = await supabase.from('custom_pages').delete().eq('id', id);
            if (error) throw error;
        }
    },

    // ── Page Attachments ─────────────────────────────────────────────
    pageAttachments: {
        async getAll(pageId) {
            const { data, error } = await supabase
                .from('page_attachments').select('*')
                .eq('page_id', pageId).order('created_at');
            if (error) throw error;
            return data || [];
        },

        async upload(pageId, file) {
            const safeName = file.name.replace(/[^\w.\-]/g, '_');
            const path = `pages/${pageId}/${Date.now()}_${safeName}`;
            const { error: upErr } = await supabase.storage
                .from(APP_CONFIG.buckets.pageFiles).upload(path, file);
            if (upErr) throw upErr;
            const { data: signData } = await supabase.storage
                .from(APP_CONFIG.buckets.pageFiles)
                .createSignedUrl(path, 365 * 24 * 3600);
            const { data, error } = await supabase.from('page_attachments').insert({
                page_id:      pageId,
                file_name:    file.name,
                storage_path: path,
                file_type:    file.type || '',
                file_size:    file.size
            }).select().single();
            if (error) throw error;
            return { ...data, signed_url: signData?.signedUrl };
        },

        async delete(id) {
            const { data, error: fe } = await supabase
                .from('page_attachments').select('storage_path').eq('id', id).single();
            if (fe) throw fe;
            await supabase.storage.from(APP_CONFIG.buckets.pageFiles).remove([data.storage_path]);
            const { error } = await supabase.from('page_attachments').delete().eq('id', id);
            if (error) throw error;
        },

        async deleteAllForPage(pageId) {
            const { data } = await supabase
                .from('page_attachments').select('storage_path').eq('page_id', pageId);
            if (data?.length) {
                await supabase.storage.from(APP_CONFIG.buckets.pageFiles)
                    .remove(data.map(f => f.storage_path));
            }
        },

        async getSignedUrl(storagePath) {
            const { data, error } = await supabase.storage
                .from(APP_CONFIG.buckets.pageFiles)
                .createSignedUrl(storagePath, 365 * 24 * 3600);
            if (error) throw error;
            return data.signedUrl;
        }
    },

    // ── News ─────────────────────────────────────────────────────────
    news: {
        async getAll({ published, page = 0, pageSize = 12 } = {}) {
            let q = supabase.from('news')
                .select(`*, author:profiles!author_id(full_name),
                    access_group:access_groups(id,name,is_public,
                        cities:access_group_cities(city),
                        positions:access_group_positions(position),
                        departments:access_group_departments(department),
                        labels:access_group_labels(label))`, { count: 'exact' });
            if (published !== undefined) q = q.eq('is_published', published);
            q = q.order('published_at', { ascending: false, nullsFirst: false })
                 .order('created_at', { ascending: false })
                 .range(page * pageSize, (page + 1) * pageSize - 1);
            const { data, error, count } = await q;
            if (error) throw error;
            return { data, count };
        },

        async getById(idOrSlug) {
            if (!idOrSlug) throw new Error('news id or slug required');
            const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);
            const sel = `*, author:profiles!author_id(full_name),
                    access_group:access_groups(id,name,is_public,
                        cities:access_group_cities(city),
                        positions:access_group_positions(position),
                        departments:access_group_departments(department),
                        labels:access_group_labels(label))`;
            if (isUuid) {
                const { data, error } = await supabase.from('news').select(sel).eq('id', idOrSlug).single();
                if (error) throw error;
                return data;
            }
            // slug lookup with full fallback to id on any error
            const { data, error } = await supabase.from('news').select(sel).eq('slug', idOrSlug).maybeSingle();
            if (!error && data) return data;
            // fallback: try as id (column missing, no rows, old links)
            const { data: d2, error: e2 } = await supabase.from('news').select(sel).eq('id', idOrSlug).single();
            if (e2) throw e2;
            return d2;
        },

        async create(fields) {
            let slug = Fmt.slug(fields.title);
            const { data, error } = await supabase.from('news')
                .insert({ ...fields, slug, author_id: AppState.profile.id })
                .select().single();
            if (error) {
                if (error.code === '23505') {
                    // slug collision — append short unique suffix
                    slug = slug + '-' + Date.now().toString(36).slice(-4);
                    const { data: d2, error: e2 } = await supabase.from('news')
                        .insert({ ...fields, slug, author_id: AppState.profile.id })
                        .select().single();
                    if (e2) throw e2;
                    return d2;
                }
                throw error;
            }
            return data;
        },

        async update(id, fields) {
            // generate slug if title changed and slug not yet set
            const updateFields = { ...fields };
            if (fields.title && !fields.slug) {
                const { data: current } = await supabase.from('news').select('slug').eq('id', id).single();
                if (!current?.slug) updateFields.slug = Fmt.slug(fields.title);
            }
            const { data, error } = await supabase.from('news')
                .update(updateFields).eq('id', id).select().single();
            if (error) throw error;
            return data;
        },

        async delete(id) {
            const { error } = await supabase.from('news').delete().eq('id', id);
            if (error) throw error;
        },

        async uploadImage(newsId, file) {
            const ext  = file.name.split('.').pop();
            const path = `${newsId}/${Date.now()}.${ext}`;
            const { error } = await supabase.storage
                .from(APP_CONFIG.buckets.newsImages).upload(path, file, { upsert: true });
            if (error) throw error;
            return `${APP_CONFIG.storagePublicUrl}/${APP_CONFIG.buckets.newsImages}/${path}`;
        },

        async getReactions(newsId) {
            const [{ data: all }, { data: mine }] = await Promise.all([
                supabase.from('news_reactions').select('type').eq('news_id', newsId),
                supabase.from('news_reactions').select('type')
                    .eq('news_id', newsId).eq('user_id', AppState.user.id).maybeSingle()
            ]);
            const up   = all?.filter(r => r.type === 'up').length  || 0;
            const down = all?.filter(r => r.type === 'down').length || 0;
            return { up, down, mine: mine?.type || null };
        },

        async getEmojiReactions(newsId) {
            const [{ data: all }, { data: mine }] = await Promise.all([
                supabase.from('news_reactions').select('emoji').eq('news_id', newsId),
                supabase.from('news_reactions').select('emoji').eq('news_id', newsId).eq('user_id', AppState.user.id)
            ]);
            const counts = {};
            (all || []).forEach(r => { counts[r.emoji] = (counts[r.emoji] || 0) + 1; });
            const myEmojis = new Set((mine || []).map(r => r.emoji));
            return { counts, myEmojis };
        },

        async toggleEmoji(newsId, emoji) {
            // One reaction per user per news
            const { data: rows } = await supabase.from('news_reactions')
                .select('emoji').eq('news_id', newsId).eq('user_id', AppState.user.id).limit(1);
            const prev = rows?.[0]?.emoji || null;
            // Delete all existing reactions for this user+news
            await supabase.from('news_reactions').delete().eq('news_id', newsId).eq('user_id', AppState.user.id);
            if (prev === emoji) return { added: false, prev };
            await supabase.from('news_reactions').insert({ news_id: newsId, user_id: AppState.user.id, emoji });
            return { added: true, prev };
        },

        async react(newsId, type) {
            const { data: existing } = await supabase.from('news_reactions')
                .select('id, type').eq('news_id', newsId).eq('user_id', AppState.user.id).maybeSingle();
            if (existing) {
                if (existing.type === type) {
                    const { error } = await supabase.from('news_reactions').delete().eq('id', existing.id);
                    if (error) throw error;
                    return null;
                } else {
                    const { error } = await supabase.from('news_reactions').update({ type }).eq('id', existing.id);
                    if (error) throw error;
                    return type;
                }
            } else {
                const { error } = await supabase.from('news_reactions')
                    .insert({ news_id: newsId, type, user_id: AppState.user.id });
                if (error) throw error;
                return type;
            }
        }
    },

    // ── Довідники ────────────────────────────────────────────────────
    directories: {
        async getAll(table) {
            const { data, error } = await supabase.from(table).select('*').order('name');
            if (error) throw error;
            return data || [];
        },
        async create(table, name) {
            const { data, error } = await supabase.from(table).insert({ name }).select().single();
            if (error) throw error;
            return data;
        },
        async update(table, id, name) {
            const { data, error } = await supabase.from(table).update({ name }).eq('id', id).select().single();
            if (error) throw error;
            return data;
        },
        async delete(table, id) {
            const { error } = await supabase.from(table).delete().eq('id', id);
            if (error) throw error;
        }
    },

    // ── Довіреності ──────────────────────────────────────────────────
    dovirenosti: {
        async getAll() {
            const { data, error } = await supabase.from('dovirenosti').select('*').order('name');
            if (error) throw error;
            return data || [];
        },
        async create(name) {
            const { data, error } = await supabase.from('dovirenosti').insert({ name }).select().single();
            if (error) throw error;
            return data;
        },
        async getForProfile(profileId) {
            const { data, error } = await supabase
                .from('profile_dovirenosti')
                .select('dovirenost_id, dovirenosti(id, name)')
                .eq('profile_id', profileId);
            if (error) throw error;
            return (data || []).map(r => r.dovirenosti).filter(Boolean);
        },
        async setForProfile(profileId, dovirenostIds) {
            await supabase.from('profile_dovirenosti').delete().eq('profile_id', profileId);
            if (dovirenostIds.length) {
                const rows = dovirenostIds.map(id => ({ profile_id: profileId, dovirenost_id: id }));
                const { error } = await supabase.from('profile_dovirenosti').insert(rows);
                if (error) throw error;
            }
        }
    },

    // ── Document Downloads ───────────────────────────────────────────
    documentDownloads: {
        async track(resourceId, { locationId = null, isOffShift = false, docVersion = 1 } = {}) {
            const { error } = await supabase.from('document_downloads').insert({
                resource_id:  resourceId,
                user_id:      AppState.user.id,
                location_id:  locationId,
                is_off_shift: isOffShift,
                doc_version:  docVersion
            });
            if (error) throw error;
        },

        // Returns map { resourceId → { at, version } }
        async getMyLatest(resourceIds) {
            if (!resourceIds.length) return {};
            const { data, error } = await supabase.from('document_downloads')
                .select('resource_id, downloaded_at, doc_version')
                .eq('user_id', AppState.user.id)
                .in('resource_id', resourceIds)
                .order('downloaded_at', { ascending: false });
            if (error) throw error;
            const map = {};
            (data || []).forEach(d => {
                if (!map[d.resource_id]) map[d.resource_id] = { at: d.downloaded_at, version: d.doc_version || 1 };
            });
            return map;
        },

        // Per-document status for manager/admin: { resourceId → [{ userId, fullName, at, version }] }
        async getAckStatus(resourceIds) {
            if (!resourceIds.length) return {};
            const { data, error } = await supabase.from('document_downloads')
                .select('resource_id, user_id, downloaded_at, doc_version')
                .in('resource_id', resourceIds)
                .order('downloaded_at', { ascending: false });
            if (error) throw error;
            const rows = data || [];
            const userIds = [...new Set(rows.map(r => r.user_id))];
            let profileMap = {};
            if (userIds.length) {
                const { data: profiles } = await supabase.from('profiles')
                    .select('id, full_name, job_position').in('id', userIds);
                profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p]));
            }
            const result = {};
            rows.forEach(d => {
                if (!result[d.resource_id]) result[d.resource_id] = [];
                if (!result[d.resource_id].find(x => x.userId === d.user_id)) {
                    const p = profileMap[d.user_id] || {};
                    result[d.resource_id].push({
                        userId:   d.user_id,
                        fullName: p.full_name || '—',
                        position: p.job_position || '',
                        at:       d.downloaded_at,
                        version:  d.doc_version || 1
                    });
                }
            });
            return result;
        },

        // Returns Set of user_ids assigned to given locations (for manager's employee filter)
        async getEmployeeIdsForLocations(locationIds) {
            if (!locationIds.length) return new Set();
            const { data, error } = await supabase.from('schedule_assignments')
                .select('user_id').in('location_id', locationIds);
            if (error) throw error;
            return new Set((data || []).map(r => r.user_id));
        },

        // Returns all employee profiles (for "who hasn't acknowledged" calculation)
        async getAllEmployees() {
            const { data, error } = await supabase.from('profiles')
                .select('id, full_name, job_position, city, subdivision, role, manager_id, profile_dovirenosti(dovirenost_id)')
                .in('role', ['user', 'teacher', 'smm', 'manager'])
                .order('full_name');
            if (error) throw error;
            return data || [];
        },

        // Check overdue docs for current user, send notifications if not yet sent
        async checkAndSendReminders(trackedResources) {
            if (!trackedResources.length) return;
            const today = new Date();
            const overdueIds = trackedResources
                .filter(r => {
                    if (!r.deadline_days || !r.created_at) return false;
                    const deadline = new Date(new Date(r.created_at).getTime() + r.deadline_days * 86400000);
                    return deadline < today;
                })
                .map(r => r.id);
            if (!overdueIds.length) return;

            // Check which ones already have reminders sent
            const { data: existing } = await supabase.from('doc_deadline_reminders')
                .select('resource_id')
                .eq('user_id', AppState.user.id)
                .in('resource_id', overdueIds);
            const alreadySent = new Set((existing || []).map(r => r.resource_id));
            const toNotify = overdueIds.filter(id => !alreadySent.has(id));
            if (!toNotify.length) return;

            const resources = trackedResources.filter(r => toNotify.includes(r.id));

            // Send notification to user
            const ntfRows = resources.map(r => ({
                user_id:    AppState.user.id,
                title:      '⏰ Прострочений документ',
                message:    `Термін ознайомлення з документом «${r.title}» закінчився. Будь ласка, ознайомтесь якнайшвидше.`,
                type:       'general',
                created_by: AppState.user.id
            }));
            await supabase.from('notifications').insert(ntfRows).catch(() => {});

            // Mark as notified
            const reminderRows = toNotify.map(rid => ({
                resource_id: rid,
                user_id:     AppState.user.id
            }));
            await supabase.from('doc_deadline_reminders').insert(reminderRows).catch(() => {});
        },

        // Send notifications to all users who have access to a document
        async notifyOnPublish(resource, isUpdate = false) {
            const staffRoles = ['owner', 'admin', 'smm', 'teacher', 'manager'];
            const { data: staffData } = await supabase.from('profiles').select('id').eq('is_active', true).in('role', staffRoles);
            const staffIds = (staffData || []).map(p => p.id);
            const regularIds = await API.notifications._resolveNotifyUserIds(resource.id, resource.access_group_id);

            const userIds = [...new Set([...staffIds, ...regularIds])];
            if (!userIds.length) return;
            const rows = userIds.map(uid => ({
                user_id:    uid,
                title:      `📋 ${isUpdate ? 'Оновлено документ' : 'Новий документ'}${resource.category ? ` · ${resource.category}` : ''}`,
                message:    `«${resource.title}»${resource.deadline_days ? `. Термін ознайомлення: ${resource.deadline_days} дн.` : ''}.`,
                type:       'general',
                link:       resource.id ? `resource/${resource.id}` : 'documents',
                created_by: AppState.user.id,
                is_read:    false
            }));
            await supabase.from('notifications').insert(rows);
        },

        // Tries to find today's active shift location for current user
        async getTodayShiftLocation() {
            const today = new Date().toISOString().slice(0, 10);
            const { data } = await supabase.from('schedule_entries')
                .select('location_id, location:schedule_locations(id, name)')
                .eq('user_id', AppState.user.id)
                .eq('date', today)
                .in('shift_type', ['work', 'day_off'])
                .or('notes.is.null,notes.not.in.("__mgr_help__","__sub__","__needsub__","__sub_confirmed__")')
                .limit(1)
                .maybeSingle();
            return data?.location_id ? { id: data.location_id, name: data.location?.name } : null;
        },

        async getAllLocations() {
            const { data, error } = await supabase.from('schedule_locations')
                .select('id, name').is('deleted_at', null).order('name');
            if (error) throw error;
            return data || [];
        },

        async getManagerLocations() {
            let q = supabase.from('schedule_locations')
                .select('id, name').is('deleted_at', null).order('name');
            if (!AppState.isOwner()) q = q.eq('created_by', AppState.user.id);
            const { data, error } = await q;
            if (error) throw error;
            return data || [];
        },

        // Downloads during shift for given locations (for status matrix)
        async getStatusForLocations(locationIds) {
            if (!locationIds.length) return [];
            const { data, error } = await supabase.from('document_downloads')
                .select('resource_id, location_id, downloaded_at')
                .in('location_id', locationIds)
                .eq('is_off_shift', false);
            if (error) throw error;
            return data || [];
        },

        async getOffShiftForLocations(locationIds) {
            if (!locationIds.length) return [];
            const { data, error } = await supabase.from('document_downloads')
                .select(`resource_id, location_id, downloaded_at, user_id,
                    resource:resources(title),
                    location:schedule_locations(name)`)
                .in('location_id', locationIds)
                .eq('is_off_shift', true)
                .order('downloaded_at', { ascending: false })
                .limit(300);
            if (error) throw error;
            const rows = data || [];
            const userIds = [...new Set(rows.map(d => d.user_id))];
            if (userIds.length) {
                const { data: profiles } = await supabase.from('profiles')
                    .select('id, full_name').in('id', userIds);
                const map = Object.fromEntries((profiles || []).map(p => [p.id, p.full_name]));
                rows.forEach(d => { d.user = { full_name: map[d.user_id] || '—' }; });
            }
            return rows;
        }
    },

    // ── Іменинники ───────────────────────────────────────────────────
    birthdays: {
        async getToday() {
            const { data, error } = await supabase.rpc('get_today_birthdays');
            if (error) throw error;
            return data || [];
        }
    },

    // ── Access Groups ────────────────────────────────────────────────
    accessGroups: {
        _sel: `*, cities:access_group_cities(city), positions:access_group_positions(position), departments:access_group_departments(department), labels:access_group_labels(label)`,

        async getAll() {
            const { data, error } = await supabase
                .from('access_groups').select(this._sel)
                .order('name', { ascending: true });
            if (error) throw error;
            return data || [];
        },

        async getById(id) {
            const { data, error } = await supabase
                .from('access_groups').select(this._sel)
                .eq('id', id).single();
            if (error) throw error;
            return data;
        },

        async create({ name, description, is_public, cities, positions, departments, labels }) {
            const { data, error } = await supabase.from('access_groups')
                .insert({ name, description, is_public, created_by: AppState.user.id })
                .select().single();
            if (error) throw error;
            await this._saveRelations(data.id, cities, positions, departments, labels);
            return data;
        },

        async update(id, { name, description, is_public, cities, positions, departments, labels }) {
            const { data, error } = await supabase.from('access_groups')
                .update({ name, description, is_public }).eq('id', id).select().single();
            if (error) throw error;
            await Promise.all([
                supabase.from('access_group_cities').delete().eq('group_id', id),
                supabase.from('access_group_positions').delete().eq('group_id', id),
                supabase.from('access_group_departments').delete().eq('group_id', id),
                supabase.from('access_group_labels').delete().eq('group_id', id)
            ]);
            await this._saveRelations(id, cities, positions, departments, labels);
            return data;
        },

        async _saveRelations(gid, cities = [], positions = [], departments = [], labels = []) {
            const ops = [];
            if (cities.length)      ops.push(supabase.from('access_group_cities').insert(cities.map(v => ({ group_id: gid, city: v }))));
            if (positions.length)   ops.push(supabase.from('access_group_positions').insert(positions.map(v => ({ group_id: gid, position: v }))));
            if (departments.length) ops.push(supabase.from('access_group_departments').insert(departments.map(v => ({ group_id: gid, department: v }))));
            if (labels.length)      ops.push(supabase.from('access_group_labels').insert(labels.map(v => ({ group_id: gid, label: v }))));
            if (ops.length) await Promise.all(ops);
        },

        async delete(id) {
            const { error } = await supabase.from('access_groups').delete().eq('id', id);
            if (error) throw error;
        },

        async getMembers(id) {
            const group = await this.getById(id);
            let q = supabase.from('profiles')
                .select('id, full_name, email, job_position, subdivision, city, label')
                .eq('is_active', true)
                .order('full_name');
            if (!group.is_public) {
                const cities      = group.cities?.map(c => c.city)             || [];
                const positions   = group.positions?.map(x => x.position)      || [];
                const departments = group.departments?.map(x => x.department)  || [];
                const labels      = group.labels?.map(x => x.label)            || [];
                if (cities.length)      q = q.in('city', cities);
                if (positions.length)   q = q.in('job_position', positions);
                if (departments.length) q = q.in('subdivision', departments);
                if (labels.length)      q = q.in('label', labels);
            }
            const { data, error } = await q.limit(500);
            if (error) throw error;
            return data || [];
        },

        async getDistinctLabels() {
            const { data } = await supabase.from('profiles')
                .select('label').not('label', 'is', null).neq('label', '');
            return [...new Set((data || []).map(p => p.label).filter(Boolean))].sort();
        }
    },

    // ── Analytics ────────────────────────────────────────────────────
    analytics: {
        async getDashboardStats() {
            const [
                { count: totalUsers },
                { count: totalCourses },
                { count: totalEnrollments },
                { count: totalAttempts }
            ] = await Promise.all([
                supabase.from('profiles').select('*', { count: 'exact', head: true }),
                supabase.from('courses').select('*', { count: 'exact', head: true }).eq('is_published', true),
                supabase.from('enrollments').select('*', { count: 'exact', head: true }),
                supabase.from('test_attempts').select('*', { count: 'exact', head: true }).not('completed_at', 'is', null)
            ]);
            return { totalUsers, totalCourses, totalEnrollments, totalAttempts };
        },

        async getCourseStats(courseId) {
            const [enrollment, attempts, progress] = await Promise.all([
                supabase.from('enrollments').select('*, user:profiles!user_id(full_name,email)')
                    .eq('course_id', courseId),
                supabase.from('test_attempts')
                    .select(`*, user:profiles!user_id(full_name), test:tests(title)`)
                    .eq('tests.course_id', courseId).not('completed_at', 'is', null),
                supabase.from('lesson_progress')
                    .select(`*, lesson:lessons(course_id)`)
            ]);
            return {
                enrollments: enrollment.data || [],
                attempts: attempts.data || [],
                progress: progress.data || []
            };
        },

        async getStudentStats(userId) {
            const [enrollments, attempts] = await Promise.all([
                supabase.from('enrollments').select(`*, course:courses(title)`).eq('user_id', userId),
                supabase.from('test_attempts').select(`*, test:tests(title, passing_score)`)
                    .eq('user_id', userId).not('completed_at', 'is', null)
                    .order('completed_at', { ascending: false })
            ]);
            return { enrollments: enrollments.data || [], attempts: attempts.data || [] };
        }
    },

    system: {
        async getDbSize() {
            const { data, error } = await supabase.rpc('get_db_size');
            if (error) throw error;
            return data; // { bytes, pretty }
        }
    },

    // ── Branch Doc Blocks ─────────────────────────────────────────────
    branchDocBlocks: {
        async getAll() {
            const { data, error } = await supabase.from('branch_doc_blocks')
                .select('*').order('order_index').order('number');
            if (error) throw error;
            return data || [];
        },
        async create(fields) {
            const { data, error } = await supabase.from('branch_doc_blocks')
                .insert(fields).select().single();
            if (error) throw error;
            return data;
        },
        async update(id, fields) {
            const { error } = await supabase.from('branch_doc_blocks')
                .update(fields).eq('id', id);
            if (error) throw error;
        },
        async remove(id) {
            const { error } = await supabase.from('branch_doc_blocks').delete().eq('id', id);
            if (error) throw error;
        }
    },

    // ── Red Folder Items ──────────────────────────────────────────────
    redFolderItems: {
        async getAll() {
            const { data, error } = await supabase.from('red_folder_items')
                .select('*').order('number');
            if (error) throw error;
            return data || [];
        },
        async create(fields) {
            const { data, error } = await supabase.from('red_folder_items')
                .insert(fields).select().single();
            if (error) throw error;
            return data;
        },
        async update(id, fields) {
            const { error } = await supabase.from('red_folder_items')
                .update(fields).eq('id', id);
            if (error) throw error;
        },
        async remove(id) {
            const { error } = await supabase.from('red_folder_items').delete().eq('id', id);
            if (error) throw error;
        }
    },

    // ── Registry ──────────────────────────────────────────────────────
    registryItems: {
        async getAll() {
            const { data, error } = await supabase.from('registry_items')
                .select('*').order('order_index').order('created_at');
            if (error) throw error;
            return data || [];
        },
        async create(fields) {
            const { data, error } = await supabase.from('registry_items')
                .insert(fields).select().single();
            if (error) throw error;
            return data;
        },
        async update(id, fields) {
            const { error } = await supabase.from('registry_items')
                .update(fields).eq('id', id);
            if (error) throw error;
        },
        async remove(id) {
            const { error } = await supabase.from('registry_items').delete().eq('id', id);
            if (error) throw error;
        },
        async reorder(ids) {
            // ids — масив UUID в потрібному порядку
            await Promise.all(ids.map((id, i) =>
                supabase.from('registry_items').update({ order_index: i }).eq('id', id)
            ));
        },
    },

    registryDocs: {
        async getAll() {
            const { data, error } = await supabase.from('registry_docs')
                .select('*, resource:resources(id,title,type,storage_path,url,description)')
                .order('order_index').order('created_at');
            if (error) throw error;
            return data || [];
        },
        async add(fields) {
            const { data, error } = await supabase.from('registry_docs')
                .insert(fields).select().single();
            if (error) throw error;
            return data;
        },
        async remove(id) {
            const { error } = await supabase.from('registry_docs').delete().eq('id', id);
            if (error) throw error;
        },
        async reorder(ids) {
            await Promise.all(ids.map((id, i) =>
                supabase.from('registry_docs').update({ order_index: i }).eq('id', id)
            ));
        },
    },

    registrySections: {
        async getAll() {
            const { data, error } = await supabase.from('registry_sections')
                .select('*').order('order_index').order('created_at');
            if (error) throw error;
            return data || [];
        },
        async create(fields) {
            const { data, error } = await supabase.from('registry_sections')
                .insert(fields).select().single();
            if (error) throw error;
            return data;
        },
        async update(id, fields) {
            const { error } = await supabase.from('registry_sections')
                .update(fields).eq('id', id);
            if (error) throw error;
        },
        async remove(id) {
            const { error } = await supabase.from('registry_sections').delete().eq('id', id);
            if (error) throw error;
        },
        async reorder(ids) {
            await Promise.all(ids.map((id, i) =>
                supabase.from('registry_sections').update({ order_index: i }).eq('id', id)
            ));
        },
    },

    registrySectionDocs: {
        async getAll() {
            const { data, error } = await supabase.from('registry_section_docs')
                .select('*, resource:resources(id,title,type,storage_path,url,description)')
                .order('order_index').order('created_at');
            if (error) throw error;
            return data || [];
        },
        async add(fields) {
            const { data, error } = await supabase.from('registry_section_docs')
                .insert(fields).select().single();
            if (error) throw error;
            return data;
        },
        async remove(id) {
            const { error } = await supabase.from('registry_section_docs').delete().eq('id', id);
            if (error) throw error;
        },
    },

    // ── Surveys ───────────────────────────────────────────────────────
    surveys: {
        async getAll({ published } = {}) {
            let q = supabase.from('surveys')
                .select('*, creator:profiles!created_by(full_name), questions:survey_questions(id)', { count: 'exact' })
                .order('created_at', { ascending: false });
            if (published !== undefined) q = q.eq('is_published', published);
            const { data, error } = await q;
            if (error) throw error;
            return data || [];
        },
        async getById(id) {
            const { data, error } = await supabase.from('surveys')
                .select('*, creator:profiles!created_by(full_name)')
                .eq('id', id).single();
            if (error) throw error;
            return data;
        },
        async getQuestions(surveyId) {
            const { data, error } = await supabase.from('survey_questions')
                .select('*').eq('survey_id', surveyId)
                .order('order_index');
            if (error) throw error;
            return data || [];
        },
        async create(fields) {
            const { data, error } = await supabase.from('surveys')
                .insert({ ...fields, created_by: (await supabase.auth.getUser()).data.user.id })
                .select().single();
            if (error) throw error;
            return data;
        },
        async update(id, fields) {
            const { data, error } = await supabase.from('surveys')
                .update(fields).eq('id', id).select().single();
            if (error) throw error;
            return data;
        },
        async delete(id) {
            const { error } = await supabase.from('surveys').delete().eq('id', id);
            if (error) throw error;
        },
        async saveQuestions(surveyId, questions) {
            await supabase.from('survey_questions').delete().eq('survey_id', surveyId);
            if (!questions.length) return;
            const rows = questions.map((q, i) => ({
                survey_id: surveyId, text: q.text, type: q.type,
                options: q.options || [], is_required: q.is_required !== false,
                order_index: i, image_url: q.image_url || null
            }));
            const { error } = await supabase.from('survey_questions').insert(rows);
            if (error) throw error;
        },
        async hasResponded(surveyId) {
            const { data } = await supabase.from('survey_responses')
                .select('id').eq('survey_id', surveyId)
                .eq('user_id', (await supabase.auth.getUser()).data.user.id)
                .maybeSingle();
            return !!data;
        },
        async getMyResponse(surveyId) {
            const uid = (await supabase.auth.getUser()).data.user.id;
            const { data: resp } = await supabase.from('survey_responses')
                .select('id').eq('survey_id', surveyId).eq('user_id', uid).maybeSingle();
            if (!resp) return null;
            const { data: answers } = await supabase.from('survey_answers')
                .select('*').eq('response_id', resp.id);
            return { response: resp, answers: answers || [] };
        },
        async submitResponse(surveyId, answers) {
            const uid = (await supabase.auth.getUser()).data.user.id;
            const { data: resp, error: re } = await supabase.from('survey_responses')
                .insert({ survey_id: surveyId, user_id: uid }).select().single();
            if (re) throw re;
            const rows = answers.map(a => ({
                response_id: resp.id, question_id: a.question_id,
                value: a.value || null, selected_options: a.selected_options || []
            }));
            if (rows.length) {
                const { error: ae } = await supabase.from('survey_answers').insert(rows);
                if (ae) throw ae;
            }
            return resp;
        },
        async getResults(surveyId) {
            const { data: responses, error: re } = await supabase.from('survey_responses')
                .select('id, user_id, submitted_at, user:profiles!user_id(full_name, avatar_url)')
                .eq('survey_id', surveyId).order('submitted_at', { ascending: false });
            if (re) throw re;
            if (!responses?.length) return { responses: [], answers: [] };
            const { data: answers, error: ae } = await supabase.from('survey_answers')
                .select('*').in('response_id', responses.map(r => r.id));
            if (ae) throw ae;
            return { responses: responses || [], answers: answers || [] };
        },
        async getRespondentCount(surveyId) {
            const { count } = await supabase.from('survey_responses')
                .select('id', { count: 'exact', head: true }).eq('survey_id', surveyId);
            return count || 0;
        },
        async getAssignments(surveyId) {
            const { data, error } = await supabase.from('survey_assignments')
                .select('*, user:profiles!user_id(id,full_name,email,job_position)')
                .eq('survey_id', surveyId);
            if (error) throw error;
            return data || [];
        },
        async assign(surveyId, userIds, deadlineAt) {
            const rows = userIds.map(uid => ({
                survey_id: surveyId, user_id: uid,
                assigned_by: AppState.user.id,
                deadline_at: deadlineAt || null
            }));
            const { error } = await supabase.from('survey_assignments')
                .upsert(rows, { onConflict: 'survey_id,user_id', ignoreDuplicates: false });
            if (error) throw error;
        },
        async unassign(surveyId, userId) {
            const { error } = await supabase.from('survey_assignments')
                .delete().eq('survey_id', surveyId).eq('user_id', userId);
            if (error) throw error;
        },

        async getMyPendingCount() {
            const uid = AppState.user?.id;
            if (!uid) return 0;
            const { data: assignments } = await supabase.from('survey_assignments')
                .select('survey_id').eq('user_id', uid);
            if (!assignments?.length) return 0;
            const surveyIds = assignments.map(a => a.survey_id);
            const { data: responses } = await supabase.from('survey_responses')
                .select('survey_id').eq('user_id', uid).in('survey_id', surveyIds);
            const respondedIds = new Set((responses || []).map(r => r.survey_id));
            return surveyIds.filter(id => !respondedIds.has(id)).length;
        }
    },

    // ── Activity Log ────────────────────────────────────────────────
    activityLog: {
        async log(action, { entity_type, entity_id, entity_title, page, details } = {}) {
            const uid = AppState.user?.id;
            if (!uid) return;
            const row = {
                user_id: uid,
                action,
                entity_type:  entity_type  || null,
                entity_id:    entity_id    || null,
                entity_title: entity_title || null,
                page:         page || (location.hash.slice(2) || 'dashboard'),
                details:      details || {},
                ua:           navigator.userAgent,
            };
            // fire-and-forget, never throw
            supabase.from('activity_log').insert(row).then(() => {});
        },

        async getForUser(userId, { limit = 50, offset = 0, action, dateFrom, dateTo } = {}) {
            let q = supabase
                .from('activity_log')
                .select('id,action,entity_type,entity_title,page,details,ua,created_at', { count: 'exact' })
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .range(offset, offset + limit - 1);
            if (action)   q = q.eq('action', action);
            if (dateFrom) q = q.gte('created_at', dateFrom + 'T00:00:00');
            if (dateTo)   q = q.lte('created_at', dateTo   + 'T23:59:59');
            const { data, error, count } = await q;
            if (error) throw error;
            return { data: data || [], count: count || 0 };
        },

        async getStats(userId) {
            const { data } = await supabase
                .from('activity_log')
                .select('action,created_at,page')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(500);
            return data || [];
        }
    },

    // ── User Sessions ──────────────────────────────────────────────────
    userSessions: {
        // Register / refresh current session
        async upsert(token, userAgent) {
            const { error } = await supabase.from('user_sessions')
                .upsert({ session_token: token, user_id: (await supabase.auth.getUser()).data?.user?.id, user_agent: userAgent, last_seen_at: new Date().toISOString() },
                    { onConflict: 'session_token' });
            if (error) throw error;
        },
        // Heartbeat — update last_seen_at
        async ping(token) {
            await supabase.from('user_sessions')
                .update({ last_seen_at: new Date().toISOString() })
                .eq('session_token', token);
        },
        // Remove on logout
        async remove(token) {
            await supabase.from('user_sessions').delete().eq('session_token', token);
        },
        // Count active sessions for a user (admin)
        async countActive(userId, thresholdMs = 3 * 60 * 1000) {
            const since = new Date(Date.now() - thresholdMs).toISOString();
            const { count } = await supabase.from('user_sessions')
                .select('id', { count: 'exact', head: true })
                .eq('user_id', userId)
                .gte('last_seen_at', since);
            return count || 0;
        },
        // Get active sessions list for a user (admin)
        async getActive(userId, thresholdMs = 3 * 60 * 1000) {
            const since = new Date(Date.now() - thresholdMs).toISOString();
            const { data } = await supabase.from('user_sessions')
                .select('id,session_token,user_agent,last_seen_at,created_at')
                .eq('user_id', userId)
                .gte('last_seen_at', since)
                .order('last_seen_at', { ascending: false });
            return data || [];
        },
        // Terminate all sessions for a user (admin force logout)
        async removeAll(userId) {
            await supabase.from('user_sessions').delete().eq('user_id', userId);
        },
        // Cleanup stale sessions (older than 10 min) — call periodically
        async cleanup() {
            const cutoff = new Date(Date.now() - 10 * 60 * 1000).toISOString();
            await supabase.from('user_sessions').delete().lt('last_seen_at', cutoff);
        }
    }
};
