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
            const url = `${APP_CONFIG.storagePublicUrl}/${APP_CONFIG.buckets.avatars}/${path}`;
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
                .insert(fields).select().single();
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

        async getAll({ courseId, search, category, page = 0, pageSize = 20, includeLessonResources = false } = {}) {
            let q = supabase.from('resources')
                .select('*, course:courses(id,title)', { count: 'exact' });
            if (!includeLessonResources) q = q.is('lesson_id', null);
            if (courseId) q = q.eq('course_id', courseId);
            if (category) q = q.eq('category', category);
            if (search) q = q.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
            q = q.order('created_at', { ascending: false })
                 .range(page * pageSize, (page + 1) * pageSize - 1);
            const { data, error, count } = await q;
            if (error) throw error;
            return { data, count };
        },

        async getById(id) {
            const { data, error } = await supabase.from('resources')
                .select('*, course:courses(id,title)').eq('id', id).single();
            if (error) throw error;
            return data;
        },

        async getCategories() {
            const { data, error } = await supabase.from('resources')
                .select('category', { distinct: true })
                .order('category', { ascending: true });
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

    // ── Іменинники ───────────────────────────────────────────────────
    birthdays: {
        async getToday() {
            const { data, error } = await supabase.rpc('get_today_birthdays');
            if (error) throw error;
            return data || [];
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
