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
                .upload(path, file, { upsert: true });
            if (error) throw error;
            const url = `${APP_CONFIG.storagePublicUrl}/${APP_CONFIG.buckets.thumbnails}/${path}`;
            await this.update(courseId, { thumbnail_url: url });
            return url;
        }
    },

    // ── Enrollments ─────────────────────────────────────────────────
    enrollments: {
        async getMyEnrollments() {
            const { data, error } = await supabase.from('enrollments')
                .select(`*, course:courses(*, teacher:profiles!teacher_id(full_name))`)
                .eq('user_id', AppState.user.id)
                .order('enrolled_at', { ascending: false });
            if (error) throw error;
            return data;
        },

        async isEnrolled(courseId) {
            const { data } = await supabase.from('enrollments')
                .select('id').eq('user_id', AppState.user.id).eq('course_id', courseId).single();
            return !!data;
        },

        async enroll(courseId) {
            const { data, error } = await supabase.from('enrollments')
                .insert({ user_id: AppState.user.id, course_id: courseId })
                .select().single();
            if (error) throw error;
            return data;
        },

        async getCourseEnrollments(courseId) {
            const { data, error } = await supabase.from('enrollments')
                .select(`*, user:profiles!user_id(id, full_name, email, avatar_url)`)
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

        async getAll({ courseId, search, category, page = 0, pageSize = 20, includeLessonResources = false, studentOnly = false, trackedOnly = false, docsOnly = false } = {}) {
            let q = supabase.from('resources')
                .select(`*, course:courses(id,title), creator:profiles!created_by(full_name),
                    access_group:access_groups(id,name,is_public,
                        cities:access_group_cities(city),
                        positions:access_group_positions(position),
                        departments:access_group_departments(department),
                        labels:access_group_labels(label))`, { count: 'exact' });
            if (!includeLessonResources) q = q.is('lesson_id', null);
            if (courseId) q = q.eq('course_id', courseId);
            if (category) q = q.eq('category', category);
            if (search) q = q.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
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
                        labels:access_group_labels(label))`).eq('id', id).single();
            if (error) throw error;
            return data;
        },

        async getCategories({ trackedOnly = false, docsOnly = false } = {}) {
            let q = supabase.from('resources')
                .select('category', { distinct: true })
                .order('category', { ascending: true });
            if (trackedOnly) q = q.eq('is_tracked_download', true);
            if (docsOnly) q = q.neq('type', 'video').neq('type', 'link').neq('type', 'scorm');
            const { data, error } = await q;
            if (error) throw error;
            return (data || []).map(r => r.category).filter(Boolean);
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
                .select(`*, questions(*, answers(*))`)
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
            if (!answers.length) return;
            const { error } = await supabase.from('answers').insert(
                answers.map((a, i) => ({
                    question_id: questionId,
                    answer_text: a.text,
                    is_correct: a.is_correct,
                    order_index: i
                }))
            );
            if (error) throw error;
        }
    },

    // ── Attempts ─────────────────────────────────────────────────────
    attempts: {
        async getByTest(testId) {
            const { data, error } = await supabase.from('test_attempts')
                .select('*')
                .eq('user_id', AppState.user.id)
                .eq('test_id', testId)
                .order('started_at', { ascending: false });
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

        async create(testId) {
            const prev = await this.getByTest(testId);
            const { data, error } = await supabase.from('test_attempts')
                .insert({
                    user_id: AppState.user.id,
                    test_id: testId,
                    attempt_number: prev.length + 1
                }).select().single();
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
                .select(`*, author:profiles!author_id(full_name)`, { count: 'exact' });
            if (published !== undefined) q = q.eq('is_published', published);
            q = q.order('published_at', { ascending: false, nullsFirst: false })
                 .order('created_at', { ascending: false })
                 .range(page * pageSize, (page + 1) * pageSize - 1);
            const { data, error, count } = await q;
            if (error) throw error;
            return { data, count };
        },

        async getById(id) {
            const { data, error } = await supabase.from('news')
                .select(`*, author:profiles!author_id(full_name)`)
                .eq('id', id).single();
            if (error) throw error;
            return data;
        },

        async create(fields) {
            const slug = Fmt.slug(fields.title) + '-' + Date.now().toString(36);
            const { data, error } = await supabase.from('news')
                .insert({ ...fields, slug, author_id: AppState.profile.id })
                .select().single();
            if (error) throw error;
            return data;
        },

        async update(id, fields) {
            const { data, error } = await supabase.from('news')
                .update(fields).eq('id', id).select().single();
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
                .select('id, full_name, job_position, role')
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
        async notifyOnPublish(resource) {
            let userIds = [];
            if (resource.access_group) {
                const ag = resource.access_group;
                let q = supabase.from('profiles').select('id');
                if (!ag.is_public) {
                    if (ag.cities?.length)     q = q.in('city', ag.cities.map(c => c.city));
                    if (ag.positions?.length)  q = q.in('job_position', ag.positions.map(p => p.position));
                    if (ag.departments?.length) q = q.in('subdivision', ag.departments.map(d => d.department));
                    if (ag.labels?.length)     q = q.in('label', ag.labels.map(l => l.label));
                }
                const { data } = await q.catch(() => ({ data: [] }));
                userIds = (data || []).map(p => p.id);
            } else {
                const { data } = await supabase.from('profiles').select('id').catch(() => ({ data: [] }));
                userIds = (data || []).map(p => p.id);
            }
            if (!userIds.length) return;
            const rows = userIds.map(uid => ({
                user_id:    uid,
                title:      '📋 Новий документ для ознайомлення',
                message:    `З'явився новий документ «${resource.title}», який потребує вашого ознайомлення.${resource.deadline_days ? ` Термін: ${resource.deadline_days} дн.` : ''}`,
                type:       'general',
                created_by: AppState.user.id
            }));
            await supabase.from('notifications').insert(rows).catch(() => {});
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
    }
};
