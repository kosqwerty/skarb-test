-- ================================================================
-- LMS "Скарбниця" — Consolidated schema (migration v109)
-- Generated from live Supabase database
-- ================================================================

CREATE TABLE IF NOT EXISTS public.access_group_cities (
    group_id uuid NOT NULL,
    city text NOT NULL,
    CONSTRAINT access_group_cities_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.access_groups(id) ON DELETE CASCADE,
    CONSTRAINT access_group_cities_pkey PRIMARY KEY (group_id,city)
);

CREATE TABLE IF NOT EXISTS public.access_group_departments (
    group_id uuid NOT NULL,
    department text NOT NULL,
    CONSTRAINT access_group_departments_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.access_groups(id) ON DELETE CASCADE,
    CONSTRAINT access_group_departments_pkey PRIMARY KEY (group_id,department)
);

CREATE TABLE IF NOT EXISTS public.access_group_labels (
    group_id uuid NOT NULL,
    label text NOT NULL,
    CONSTRAINT access_group_labels_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.access_groups(id) ON DELETE CASCADE,
    CONSTRAINT access_group_labels_pkey PRIMARY KEY (group_id,label)
);

CREATE TABLE IF NOT EXISTS public.access_group_positions (
    group_id uuid NOT NULL,
    position text NOT NULL,
    CONSTRAINT access_group_positions_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.access_groups(id) ON DELETE CASCADE,
    CONSTRAINT access_group_positions_pkey PRIMARY KEY (group_id,position)
);

CREATE TABLE IF NOT EXISTS public.access_groups (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    name text NOT NULL,
    description text,
    is_public bool DEFAULT false NOT NULL,
    created_by uuid,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    CONSTRAINT access_groups_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL,
    CONSTRAINT access_groups_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.activity_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    action text NOT NULL,
    entity_type text,
    entity_id uuid,
    entity_title text,
    page text,
    details jsonb DEFAULT '{}'::jsonb,
    ua text,
    created_at timestamptz DEFAULT now(),
    CONSTRAINT activity_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
    CONSTRAINT activity_log_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.activity_logs (
    id int8 DEFAULT nextval('activity_logs_id_seq'::regclass) NOT NULL,
    user_id uuid,
    actor_name text,
    actor_role text,
    action text NOT NULL,
    entity_type text,
    entity_name text,
    meta jsonb,
    created_at timestamptz DEFAULT now(),
    CONSTRAINT activity_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.null(null) ON DELETE SET NULL,
    CONSTRAINT activity_logs_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.answers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    question_id uuid NOT NULL,
    answer_text text DEFAULT ''::text NOT NULL,
    is_correct bool DEFAULT false,
    order_index int4 DEFAULT 0,
    image_url text,
    image_align text DEFAULT 'left'::text,
    CONSTRAINT answers_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.questions(id) ON DELETE CASCADE,
    CONSTRAINT answers_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.assistant_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    created_at timestamptz DEFAULT now(),
    CONSTRAINT assistant_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
    CONSTRAINT assistant_logs_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.attempt_answers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    attempt_id uuid NOT NULL,
    question_id uuid NOT NULL,
    selected_answer_ids uuid[] DEFAULT '{}'::uuid[],
    is_correct bool DEFAULT false,
    points_earned numeric DEFAULT 0,
    CONSTRAINT attempt_answers_attempt_id_fkey FOREIGN KEY (attempt_id) REFERENCES public.test_attempts(id) ON DELETE CASCADE,
    CONSTRAINT attempt_answers_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.questions(id) ON DELETE CASCADE,
    CONSTRAINT attempt_answers_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.bd_tabs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    order_index int4 DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    dov_ids uuid[] DEFAULT '{}'::uuid[],
    CONSTRAINT bd_tabs_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.birthday_reminders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_by uuid NOT NULL,
    target_id uuid NOT NULL,
    days_before int4 DEFAULT 7 NOT NULL,
    is_active bool DEFAULT true NOT NULL,
    notified_year int4,
    created_at timestamptz DEFAULT now(),
    CONSTRAINT birthday_reminders_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE CASCADE,
    CONSTRAINT birthday_reminders_target_id_fkey FOREIGN KEY (target_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
    CONSTRAINT birthday_reminders_pkey PRIMARY KEY (id),
    CONSTRAINT birthday_reminders_created_by_target_id_key UNIQUE (created_by,target_id)
);

CREATE TABLE IF NOT EXISTS public.bookmarks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    type text DEFAULT 'resource'::text NOT NULL,
    title text NOT NULL,
    icon text DEFAULT '📌'::text,
    route text NOT NULL,
    subtitle text,
    created_at timestamptz DEFAULT now(),
    CONSTRAINT bookmarks_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.null(null) ON DELETE CASCADE,
    CONSTRAINT bookmarks_pkey PRIMARY KEY (id),
    CONSTRAINT bookmarks_user_id_route_key UNIQUE (user_id,route)
);

CREATE TABLE IF NOT EXISTS public.branch_doc_blocks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    number int4 NOT NULL,
    title text NOT NULL,
    dept text,
    order_index int4 DEFAULT 0 NOT NULL,
    created_at timestamptz DEFAULT now(),
    icon text,
    page_ids uuid[] DEFAULT '{}'::uuid[],
    tov_text text,
    tab_id uuid,
    CONSTRAINT branch_doc_blocks_tab_id_fkey FOREIGN KEY (tab_id) REFERENCES public.bd_tabs(id) ON DELETE SET NULL,
    CONSTRAINT branch_doc_blocks_pkey PRIMARY KEY (id),
    CONSTRAINT branch_doc_blocks_number_key UNIQUE (number)
);

CREATE TABLE IF NOT EXISTS public.cities (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    name text NOT NULL,
    created_at timestamptz DEFAULT now(),
    CONSTRAINT cities_pkey PRIMARY KEY (id),
    CONSTRAINT cities_name_key UNIQUE (name)
);

CREATE TABLE IF NOT EXISTS public.collection_items (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    collection_id uuid NOT NULL,
    resource_id uuid NOT NULL,
    order_index int4 DEFAULT 0 NOT NULL,
    note text,
    CONSTRAINT collection_items_collection_id_fkey FOREIGN KEY (collection_id) REFERENCES public.collections(id) ON DELETE CASCADE,
    CONSTRAINT collection_items_resource_id_fkey FOREIGN KEY (resource_id) REFERENCES public.resources(id) ON DELETE CASCADE,
    CONSTRAINT collection_items_pkey PRIMARY KEY (id),
    CONSTRAINT collection_items_collection_id_resource_id_key UNIQUE (collection_id,resource_id)
);

CREATE TABLE IF NOT EXISTS public.collections (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    title text NOT NULL,
    description text,
    cover_emoji text DEFAULT '📁'::text,
    created_by uuid,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    CONSTRAINT collections_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL,
    CONSTRAINT collections_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.company_bday_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    message text NOT NULL,
    year int4 DEFAULT EXTRACT(year FROM now()) NOT NULL,
    created_at timestamptz DEFAULT now(),
    CONSTRAINT company_bday_messages_message_check CHECK (((char_length(message) >= 1) AND (char_length(message) <= 500))),
    CONSTRAINT company_bday_messages_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
    CONSTRAINT company_bday_messages_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.course_runs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    course_id uuid NOT NULL,
    title text DEFAULT ''::text NOT NULL,
    start_date date,
    end_date date,
    created_at timestamptz DEFAULT now(),
    start_time time,
    end_time time,
    CONSTRAINT course_runs_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE,
    CONSTRAINT course_runs_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.course_teachers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    course_id uuid NOT NULL,
    user_id uuid NOT NULL,
    label text,
    is_active bool DEFAULT true NOT NULL,
    created_at timestamptz DEFAULT now(),
    CONSTRAINT course_teachers_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE,
    CONSTRAINT course_teachers_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
    CONSTRAINT course_teachers_pkey PRIMARY KEY (id),
    CONSTRAINT course_teachers_course_id_user_id_key UNIQUE (course_id,user_id)
);

CREATE TABLE IF NOT EXISTS public.courses (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    title text NOT NULL,
    description text,
    thumbnail_url text,
    teacher_id uuid,
    category text DEFAULT 'general'::text,
    level text DEFAULT 'beginner'::text,
    duration_hours int4 DEFAULT 0,
    is_published bool DEFAULT false,
    is_featured bool DEFAULT false,
    slug text,
    tags text[],
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    schedule jsonb DEFAULT '[]'::jsonb,
    course_info jsonb DEFAULT '{}'::jsonb,
    badge_url text,
    CONSTRAINT courses_level_check CHECK ((level = ANY (ARRAY['beginner'::text, 'intermediate'::text, 'advanced'::text]))),
    CONSTRAINT courses_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES public.profiles(id) ON DELETE SET NULL,
    CONSTRAINT courses_pkey PRIMARY KEY (id),
    CONSTRAINT courses_slug_key UNIQUE (slug)
);

CREATE TABLE IF NOT EXISTS public.custom_pages (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    title text NOT NULL,
    html_content text DEFAULT ''::text NOT NULL,
    css_content text DEFAULT ''::text NOT NULL,
    is_published bool DEFAULT false NOT NULL,
    created_by uuid,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    allowed_labels text[] DEFAULT '{}'::text[] NOT NULL,
    is_home bool DEFAULT false NOT NULL,
    updated_by uuid,
    search_enabled bool DEFAULT false NOT NULL,
    CONSTRAINT custom_pages_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL,
    CONSTRAINT custom_pages_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE SET NULL,
    CONSTRAINT custom_pages_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.doc_deadline_reminders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    resource_id uuid NOT NULL,
    user_id uuid NOT NULL,
    notified_at timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT doc_deadline_reminders_resource_id_fkey FOREIGN KEY (resource_id) REFERENCES public.resources(id) ON DELETE CASCADE,
    CONSTRAINT doc_deadline_reminders_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.null(null) ON DELETE CASCADE,
    CONSTRAINT doc_deadline_reminders_pkey PRIMARY KEY (id),
    CONSTRAINT doc_deadline_reminders_resource_id_user_id_key UNIQUE (resource_id,user_id)
);

CREATE TABLE IF NOT EXISTS public.document_downloads (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    resource_id uuid NOT NULL,
    user_id uuid NOT NULL,
    location_id uuid,
    downloaded_at timestamptz DEFAULT now() NOT NULL,
    is_off_shift bool DEFAULT false NOT NULL,
    doc_version int4 DEFAULT 1 NOT NULL,
    CONSTRAINT document_downloads_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.schedule_locations(id) ON DELETE SET NULL,
    CONSTRAINT document_downloads_resource_id_fkey FOREIGN KEY (resource_id) REFERENCES public.resources(id) ON DELETE CASCADE,
    CONSTRAINT document_downloads_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.null(null) ON DELETE CASCADE,
    CONSTRAINT document_downloads_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.dovirenosti (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    created_at timestamptz DEFAULT now(),
    CONSTRAINT dovirenosti_pkey PRIMARY KEY (id),
    CONSTRAINT dovirenosti_name_key UNIQUE (name)
);

CREATE TABLE IF NOT EXISTS public.enrollments (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    course_id uuid NOT NULL,
    enrolled_at timestamptz DEFAULT now(),
    completed_at timestamptz,
    progress_percentage int4 DEFAULT 0,
    run_id uuid,
    CONSTRAINT enrollments_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE,
    CONSTRAINT enrollments_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.course_runs(id) ON DELETE SET NULL,
    CONSTRAINT enrollments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
    CONSTRAINT enrollments_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.label_restrictions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    label text NOT NULL,
    section text NOT NULL,
    created_by uuid,
    created_at timestamptz DEFAULT now(),
    CONSTRAINT label_restrictions_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.null(null),
    CONSTRAINT label_restrictions_pkey PRIMARY KEY (id),
    CONSTRAINT label_restrictions_label_section_key UNIQUE (label,section)
);

CREATE TABLE IF NOT EXISTS public.lesson_progress (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    lesson_id uuid NOT NULL,
    completed bool DEFAULT false,
    time_spent_seconds int4 DEFAULT 0,
    last_accessed_at timestamptz DEFAULT now(),
    completed_at timestamptz,
    CONSTRAINT lesson_progress_lesson_id_fkey FOREIGN KEY (lesson_id) REFERENCES public.lessons(id) ON DELETE CASCADE,
    CONSTRAINT lesson_progress_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
    CONSTRAINT lesson_progress_pkey PRIMARY KEY (id),
    CONSTRAINT lesson_progress_user_id_lesson_id_key UNIQUE (user_id,lesson_id)
);

CREATE TABLE IF NOT EXISTS public.lessons (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    course_id uuid NOT NULL,
    title text NOT NULL,
    description text,
    content text,
    order_index int4 DEFAULT 0,
    duration_minutes int4 DEFAULT 0,
    is_published bool DEFAULT false,
    is_free_preview bool DEFAULT false,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    CONSTRAINT lessons_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE,
    CONSTRAINT lessons_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.news (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    title text NOT NULL,
    slug text,
    content text NOT NULL,
    excerpt text,
    thumbnail_url text,
    author_id uuid,
    category text DEFAULT 'general'::text,
    tags text[],
    views int4 DEFAULT 0,
    is_published bool DEFAULT false,
    is_featured bool DEFAULT false,
    published_at timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    allow_reactions bool DEFAULT true NOT NULL,
    expires_at timestamptz,
    access_group_id uuid,
    thumbnail_position text DEFAULT 'center'::text,
    CONSTRAINT news_access_group_id_fkey FOREIGN KEY (access_group_id) REFERENCES public.access_groups(id) ON DELETE SET NULL,
    CONSTRAINT news_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.profiles(id) ON DELETE SET NULL,
    CONSTRAINT news_pkey PRIMARY KEY (id),
    CONSTRAINT news_slug_key UNIQUE (slug)
);

CREATE TABLE IF NOT EXISTS public.news_reactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    news_id uuid NOT NULL,
    user_id uuid NOT NULL,
    type text DEFAULT 'emoji'::text NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    emoji text,
    CONSTRAINT news_reactions_news_id_fkey FOREIGN KEY (news_id) REFERENCES public.news(id) ON DELETE CASCADE,
    CONSTRAINT news_reactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.null(null) ON DELETE CASCADE,
    CONSTRAINT news_reactions_pkey PRIMARY KEY (id),
    CONSTRAINT news_reactions_news_id_user_id_key UNIQUE (news_id,user_id)
);

CREATE TABLE IF NOT EXISTS public.news_reads (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    news_id uuid NOT NULL,
    read_at timestamptz DEFAULT now(),
    CONSTRAINT news_reads_news_id_fkey FOREIGN KEY (news_id) REFERENCES public.news(id) ON DELETE CASCADE,
    CONSTRAINT news_reads_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
    CONSTRAINT news_reads_pkey PRIMARY KEY (id),
    CONSTRAINT news_reads_user_id_news_id_key UNIQUE (user_id,news_id)
);

CREATE TABLE IF NOT EXISTS public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    type text DEFAULT 'general'::text NOT NULL,
    is_read bool DEFAULT false NOT NULL,
    created_by uuid,
    task_id uuid,
    created_at timestamptz DEFAULT now(),
    read_at timestamptz,
    link text,
    CONSTRAINT notifications_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL,
    CONSTRAINT notifications_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.scheduled_notifications(id) ON DELETE SET NULL,
    CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
    CONSTRAINT notifications_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.page_attachments (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    page_id uuid NOT NULL,
    file_name text NOT NULL,
    storage_path text NOT NULL,
    file_type text,
    file_size int8,
    created_at timestamptz DEFAULT now(),
    CONSTRAINT page_attachments_page_id_fkey FOREIGN KEY (page_id) REFERENCES public.custom_pages(id) ON DELETE CASCADE,
    CONSTRAINT page_attachments_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.page_dovirenosti (
    page_id uuid NOT NULL,
    dovirenost_id uuid NOT NULL,
    CONSTRAINT page_dovirenosti_dovirenost_id_fkey FOREIGN KEY (dovirenost_id) REFERENCES public.dovirenosti(id) ON DELETE CASCADE,
    CONSTRAINT page_dovirenosti_page_id_fkey FOREIGN KEY (page_id) REFERENCES public.custom_pages(id) ON DELETE CASCADE,
    CONSTRAINT page_dovirenosti_pkey PRIMARY KEY (page_id,dovirenost_id)
);

CREATE TABLE IF NOT EXISTS public.personal_cal_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    title text NOT NULL,
    date date NOT NULL,
    time time,
    notes text,
    color text DEFAULT '#6366f1'::text,
    created_at timestamptz DEFAULT now(),
    repeat_type text DEFAULT 'none'::text,
    is_important bool DEFAULT false,
    is_done bool DEFAULT false,
    acked_date date,
    end_time time,
    remind_before_days int2,
    CONSTRAINT personal_cal_events_remind_before_days_check CHECK (((remind_before_days IS NULL) OR (remind_before_days = ANY (ARRAY[1, 2])))),
    CONSTRAINT personal_cal_events_repeat_type_check CHECK ((repeat_type = ANY (ARRAY['none'::text, 'weekly'::text, 'monthly'::text]))),
    CONSTRAINT personal_cal_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.null(null) ON DELETE CASCADE,
    CONSTRAINT personal_cal_events_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.personal_cal_viewers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_id uuid NOT NULL,
    viewer_id uuid NOT NULL,
    granted_at timestamptz DEFAULT now(),
    CONSTRAINT personal_cal_viewers_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.null(null) ON DELETE CASCADE,
    CONSTRAINT personal_cal_viewers_viewer_id_fkey FOREIGN KEY (viewer_id) REFERENCES public.null(null) ON DELETE CASCADE,
    CONSTRAINT personal_cal_viewers_pkey PRIMARY KEY (id),
    CONSTRAINT personal_cal_viewers_owner_id_viewer_id_key UNIQUE (owner_id,viewer_id)
);

CREATE TABLE IF NOT EXISTS public.positions (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    name text NOT NULL,
    created_at timestamptz DEFAULT now(),
    CONSTRAINT positions_pkey PRIMARY KEY (id),
    CONSTRAINT positions_name_key UNIQUE (name)
);

CREATE TABLE IF NOT EXISTS public.profile_dovirenosti (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    profile_id uuid NOT NULL,
    dovirenost_id uuid NOT NULL,
    created_at timestamptz DEFAULT now(),
    CONSTRAINT profile_dovirenosti_dovirenost_id_fkey FOREIGN KEY (dovirenost_id) REFERENCES public.dovirenosti(id) ON DELETE CASCADE,
    CONSTRAINT profile_dovirenosti_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
    CONSTRAINT profile_dovirenosti_pkey PRIMARY KEY (id),
    CONSTRAINT profile_dovirenosti_profile_id_dovirenost_id_key UNIQUE (profile_id,dovirenost_id)
);

CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid NOT NULL,
    email text NOT NULL,
    full_name text DEFAULT ''::text NOT NULL,
    role text DEFAULT 'user'::text NOT NULL,
    avatar_url text,
    bio text,
    telegram_id text,
    is_active bool DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    city text,
    gender text,
    job_position text,
    label text,
    phone text,
    subdivision text,
    birth_date date,
    manager_id uuid,
    login text,
    last_name text,
    first_name text,
    patronymic text,
    ui_theme text DEFAULT 'dark'::text,
    is_hidden bool DEFAULT false NOT NULL,
    label_set_by text,
    hired_at date,
    position_since date,
    ui_prefs jsonb DEFAULT '{}'::jsonb,
    dismissed_news uuid[] DEFAULT '{}'::uuid[],
    force_logout bool DEFAULT false,
    last_seen_at timestamptz,
    birth_date_privacy text DEFAULT 'full'::text,
    completed_tours text[] DEFAULT '{}'::text[],
    CONSTRAINT profiles_birth_date_privacy_check CHECK ((birth_date_privacy = ANY (ARRAY['full'::text, 'no_year'::text, 'hidden'::text]))),
    CONSTRAINT profiles_gender_check CHECK ((gender = ANY (ARRAY['male'::text, 'female'::text, 'other'::text]))),
    CONSTRAINT profiles_role_check CHECK ((role = ANY (ARRAY['owner'::text, 'ceo'::text, 'admin'::text, 'smm'::text, 'teacher'::text, 'manager'::text, 'user'::text]))),
    CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES public.null(null) ON DELETE CASCADE,
    CONSTRAINT profiles_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES public.profiles(id) ON DELETE SET NULL,
    CONSTRAINT profiles_pkey PRIMARY KEY (id),
    CONSTRAINT profiles_email_key UNIQUE (email),
    CONSTRAINT profiles_login_key UNIQUE (login)
);

CREATE TABLE IF NOT EXISTS public.questions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    test_id uuid NOT NULL,
    question_text text DEFAULT ''::text NOT NULL,
    question_type text DEFAULT 'single'::text NOT NULL,
    points int4 DEFAULT 1 NOT NULL,
    order_index int4 DEFAULT 0,
    explanation text,
    created_at timestamptz DEFAULT now(),
    images text[] DEFAULT '{}'::text[],
    CONSTRAINT questions_test_id_fkey FOREIGN KEY (test_id) REFERENCES public.tests(id) ON DELETE CASCADE,
    CONSTRAINT questions_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.red_folder_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    number int4 NOT NULL,
    title text DEFAULT ''::text NOT NULL,
    documents text DEFAULT ''::text,
    responsible text DEFAULT ''::text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    icon text,
    page_id uuid,
    page_ids uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    tov_text text,
    tab_id uuid,
    CONSTRAINT red_folder_items_page_id_fkey FOREIGN KEY (page_id) REFERENCES public.custom_pages(id) ON DELETE SET NULL,
    CONSTRAINT red_folder_items_tab_id_fkey FOREIGN KEY (tab_id) REFERENCES public.rf_tabs(id) ON DELETE SET NULL,
    CONSTRAINT red_folder_items_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.registry_docs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    registry_item_id uuid NOT NULL,
    type text NOT NULL,
    resource_id uuid NOT NULL,
    order_index int4 DEFAULT 0 NOT NULL,
    created_at timestamptz DEFAULT now(),
    CONSTRAINT registry_docs_type_check CHECK ((type = ANY (ARRAY['order'::text, 'disposition'::text]))),
    CONSTRAINT registry_docs_registry_item_id_fkey FOREIGN KEY (registry_item_id) REFERENCES public.registry_items(id) ON DELETE CASCADE,
    CONSTRAINT registry_docs_resource_id_fkey FOREIGN KEY (resource_id) REFERENCES public.resources(id) ON DELETE CASCADE,
    CONSTRAINT registry_docs_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.registry_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    topic text NOT NULL,
    order_index int4 DEFAULT 0 NOT NULL,
    created_at timestamptz DEFAULT now(),
    section_id uuid,
    CONSTRAINT registry_items_section_id_fkey FOREIGN KEY (section_id) REFERENCES public.registry_sections(id) ON DELETE SET NULL,
    CONSTRAINT registry_items_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.registry_section_docs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    section_id uuid NOT NULL,
    resource_id uuid NOT NULL,
    order_index int4 DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    dovirenost_id uuid,
    CONSTRAINT registry_section_docs_dovirenost_id_fkey FOREIGN KEY (dovirenost_id) REFERENCES public.dovirenosti(id) ON DELETE SET NULL,
    CONSTRAINT registry_section_docs_resource_id_fkey FOREIGN KEY (resource_id) REFERENCES public.resources(id) ON DELETE CASCADE,
    CONSTRAINT registry_section_docs_section_id_fkey FOREIGN KEY (section_id) REFERENCES public.registry_sections(id) ON DELETE CASCADE,
    CONSTRAINT registry_section_docs_pkey PRIMARY KEY (id),
    CONSTRAINT registry_section_docs_section_id_resource_id_key UNIQUE (section_id,resource_id)
);

CREATE TABLE IF NOT EXISTS public.registry_sections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    order_index int4 DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    dovirenost_id uuid,
    description text,
    CONSTRAINT registry_sections_dovirenost_id_fkey FOREIGN KEY (dovirenost_id) REFERENCES public.dovirenosti(id) ON DELETE SET NULL,
    CONSTRAINT registry_sections_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.resource_dovirenosti (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    resource_id uuid NOT NULL,
    dovirenost_id uuid NOT NULL,
    created_at timestamptz DEFAULT now(),
    CONSTRAINT resource_dovirenosti_dovirenost_id_fkey FOREIGN KEY (dovirenost_id) REFERENCES public.dovirenosti(id) ON DELETE CASCADE,
    CONSTRAINT resource_dovirenosti_resource_id_fkey FOREIGN KEY (resource_id) REFERENCES public.resources(id) ON DELETE CASCADE,
    CONSTRAINT resource_dovirenosti_pkey PRIMARY KEY (id),
    CONSTRAINT resource_dovirenosti_resource_id_dovirenost_id_key UNIQUE (resource_id,dovirenost_id)
);

CREATE TABLE IF NOT EXISTS public.resources (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    lesson_id uuid,
    title text NOT NULL,
    type text NOT NULL,
    url text,
    storage_path text,
    file_size int8,
    duration_seconds int4,
    order_index int4 DEFAULT 0,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now(),
    course_id uuid,
    description text,
    file_url text,
    file_type text,
    category text DEFAULT 'general'::text,
    download_allowed bool DEFAULT true,
    updated_at timestamptz DEFAULT now(),
    created_by uuid,
    access_group_id uuid,
    is_tracked_download bool DEFAULT false NOT NULL,
    deadline_days int4,
    doc_version int4 DEFAULT 1 NOT NULL,
    deleted_at timestamptz,
    deleted_by uuid,
    original_name text,
    display_block text,
    tov_label text,
    dovirenost_id uuid,
    red_folder_item_id uuid,
    tab_id uuid,
    CONSTRAINT resources_type_check CHECK ((type = ANY (ARRAY['pdf'::text, 'video'::text, 'link'::text, 'scorm'::text, 'file'::text, 'image'::text, 'document'::text]))),
    CONSTRAINT resources_access_group_id_fkey FOREIGN KEY (access_group_id) REFERENCES public.access_groups(id) ON DELETE SET NULL,
    CONSTRAINT resources_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE SET NULL,
    CONSTRAINT resources_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL,
    CONSTRAINT resources_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES public.profiles(id) ON DELETE SET NULL,
    CONSTRAINT resources_dovirenost_id_fkey FOREIGN KEY (dovirenost_id) REFERENCES public.dovirenosti(id) ON DELETE SET NULL,
    CONSTRAINT resources_lesson_id_fkey FOREIGN KEY (lesson_id) REFERENCES public.lessons(id) ON DELETE CASCADE,
    CONSTRAINT resources_red_folder_item_id_fkey FOREIGN KEY (red_folder_item_id) REFERENCES public.red_folder_items(id) ON DELETE SET NULL,
    CONSTRAINT resources_tab_id_fkey FOREIGN KEY (tab_id) REFERENCES public.rf_tabs(id) ON DELETE SET NULL,
    CONSTRAINT resources_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.rf_tabs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    order_index int4 DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    dov_ids uuid[] DEFAULT '{}'::uuid[],
    CONSTRAINT rf_tabs_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.schedule_assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    location_id uuid,
    user_id uuid,
    created_by uuid,
    created_at timestamptz DEFAULT now(),
    employee_name text,
    original_user_id uuid,
    is_primary bool DEFAULT true,
    CONSTRAINT schedule_assignments_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.null(null),
    CONSTRAINT schedule_assignments_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.schedule_locations(id) ON DELETE CASCADE,
    CONSTRAINT schedule_assignments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.null(null) ON DELETE SET NULL,
    CONSTRAINT schedule_assignments_pkey PRIMARY KEY (id),
    CONSTRAINT schedule_assignments_location_id_user_id_key UNIQUE (location_id,user_id)
);

CREATE TABLE IF NOT EXISTS public.schedule_entries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    location_id uuid,
    user_id uuid,
    date date NOT NULL,
    shift_type text DEFAULT 'work'::text NOT NULL,
    shift_start time,
    shift_end time,
    notes text,
    updated_by uuid,
    updated_at timestamptz DEFAULT now(),
    CONSTRAINT schedule_entries_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.schedule_locations(id) ON DELETE CASCADE,
    CONSTRAINT schedule_entries_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.null(null),
    CONSTRAINT schedule_entries_pkey PRIMARY KEY (id),
    CONSTRAINT schedule_entries_location_id_user_id_date_key UNIQUE (location_id,user_id,date)
);

CREATE TABLE IF NOT EXISTS public.schedule_locations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    created_by uuid,
    created_at timestamptz DEFAULT now(),
    deleted_at timestamptz,
    locked bool DEFAULT false,
    work_start time,
    work_end time,
    locked_months text[] DEFAULT ARRAY[]::text[],
    address text,
    phone text,
    CONSTRAINT schedule_locations_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.null(null),
    CONSTRAINT schedule_locations_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.schedule_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    location_id uuid,
    user_id uuid,
    date date,
    employee_name text,
    old_value jsonb,
    new_value jsonb,
    changed_by uuid,
    changed_at timestamptz DEFAULT now(),
    CONSTRAINT schedule_log_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.null(null),
    CONSTRAINT schedule_log_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.schedule_partners (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_id uuid,
    partner_id uuid,
    status text DEFAULT 'pending'::text,
    created_at timestamptz DEFAULT now(),
    block_name text,
    CONSTRAINT schedule_partners_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.null(null) ON DELETE CASCADE,
    CONSTRAINT schedule_partners_partner_id_fkey FOREIGN KEY (partner_id) REFERENCES public.null(null) ON DELETE CASCADE,
    CONSTRAINT schedule_partners_pkey PRIMARY KEY (id),
    CONSTRAINT schedule_partners_owner_id_partner_id_key UNIQUE (owner_id,partner_id)
);

CREATE TABLE IF NOT EXISTS public.schedule_shift_config (
    user_id uuid NOT NULL,
    config jsonb DEFAULT '{}'::jsonb NOT NULL,
    updated_at timestamptz DEFAULT now(),
    CONSTRAINT schedule_shift_config_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.null(null) ON DELETE CASCADE,
    CONSTRAINT schedule_shift_config_pkey PRIMARY KEY (user_id)
);

CREATE TABLE IF NOT EXISTS public.schedule_viewers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    location_id uuid,
    granted_by uuid,
    created_at timestamptz DEFAULT now(),
    CONSTRAINT schedule_viewers_granted_by_fkey FOREIGN KEY (granted_by) REFERENCES public.null(null),
    CONSTRAINT schedule_viewers_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.schedule_locations(id) ON DELETE CASCADE,
    CONSTRAINT schedule_viewers_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.null(null) ON DELETE CASCADE,
    CONSTRAINT schedule_viewers_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.scheduled_notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    scheduled_at timestamptz NOT NULL,
    type text DEFAULT 'general'::text NOT NULL,
    recipients jsonb DEFAULT '[]'::jsonb NOT NULL,
    repeat_type text DEFAULT 'none'::text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    created_by uuid,
    sent_at timestamptz,
    send_log jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    CONSTRAINT scheduled_notifications_repeat_type_check CHECK ((repeat_type = ANY (ARRAY['none'::text, 'daily'::text, 'weekly'::text]))),
    CONSTRAINT scheduled_notifications_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'sent'::text, 'cancelled'::text]))),
    CONSTRAINT scheduled_notifications_type_check CHECK ((type = ANY (ARRAY['gold'::text, 'tech'::text, 'general'::text]))),
    CONSTRAINT scheduled_notifications_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL,
    CONSTRAINT scheduled_notifications_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.scorm_packages (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    resource_id uuid,
    manifest_path text DEFAULT 'imsmanifest.xml'::text NOT NULL,
    entry_point text NOT NULL,
    scorm_version text DEFAULT '2004'::text,
    title text,
    description text,
    created_at timestamptz DEFAULT now(),
    CONSTRAINT scorm_packages_resource_id_fkey FOREIGN KEY (resource_id) REFERENCES public.resources(id) ON DELETE CASCADE,
    CONSTRAINT scorm_packages_pkey PRIMARY KEY (id),
    CONSTRAINT scorm_packages_resource_id_key UNIQUE (resource_id)
);

CREATE TABLE IF NOT EXISTS public.scorm_progress (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    scorm_package_id uuid NOT NULL,
    completion_status text DEFAULT 'not attempted'::text,
    success_status text DEFAULT 'unknown'::text,
    progress_measure numeric DEFAULT 0,
    score_raw numeric,
    score_min numeric DEFAULT 0,
    score_max numeric DEFAULT 100,
    score_scaled numeric,
    total_time_seconds int4 DEFAULT 0,
    session_time_seconds int4 DEFAULT 0,
    suspend_data text,
    location text,
    interactions jsonb DEFAULT '[]'::jsonb,
    objectives jsonb DEFAULT '[]'::jsonb,
    updated_at timestamptz DEFAULT now(),
    created_at timestamptz DEFAULT now(),
    CONSTRAINT scorm_progress_completion_status_check CHECK ((completion_status = ANY (ARRAY['not attempted'::text, 'incomplete'::text, 'completed'::text, 'unknown'::text]))),
    CONSTRAINT scorm_progress_progress_measure_check CHECK (((progress_measure >= (0)::numeric) AND (progress_measure <= (1)::numeric))),
    CONSTRAINT scorm_progress_success_status_check CHECK ((success_status = ANY (ARRAY['passed'::text, 'failed'::text, 'unknown'::text]))),
    CONSTRAINT scorm_progress_scorm_package_id_fkey FOREIGN KEY (scorm_package_id) REFERENCES public.scorm_packages(id) ON DELETE CASCADE,
    CONSTRAINT scorm_progress_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
    CONSTRAINT scorm_progress_pkey PRIMARY KEY (id),
    CONSTRAINT scorm_progress_user_id_scorm_package_id_key UNIQUE (user_id,scorm_package_id)
);

CREATE TABLE IF NOT EXISTS public.subdivisions (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    name text NOT NULL,
    created_at timestamptz DEFAULT now(),
    CONSTRAINT subdivisions_pkey PRIMARY KEY (id),
    CONSTRAINT subdivisions_name_key UNIQUE (name)
);

CREATE TABLE IF NOT EXISTS public.survey_answers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    response_id uuid NOT NULL,
    question_id uuid NOT NULL,
    value text,
    selected_options jsonb DEFAULT '[]'::jsonb,
    CONSTRAINT survey_answers_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.survey_questions(id) ON DELETE CASCADE,
    CONSTRAINT survey_answers_response_id_fkey FOREIGN KEY (response_id) REFERENCES public.survey_responses(id) ON DELETE CASCADE,
    CONSTRAINT survey_answers_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.survey_assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    survey_id uuid NOT NULL,
    user_id uuid NOT NULL,
    assigned_by uuid,
    deadline_at timestamptz,
    created_at timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT survey_assignments_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES public.profiles(id) ON DELETE SET NULL,
    CONSTRAINT survey_assignments_survey_id_fkey FOREIGN KEY (survey_id) REFERENCES public.surveys(id) ON DELETE CASCADE,
    CONSTRAINT survey_assignments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
    CONSTRAINT survey_assignments_pkey PRIMARY KEY (id),
    CONSTRAINT survey_assignments_survey_id_user_id_key UNIQUE (survey_id,user_id)
);

CREATE TABLE IF NOT EXISTS public.survey_questions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    survey_id uuid NOT NULL,
    text text NOT NULL,
    type text NOT NULL,
    options jsonb DEFAULT '[]'::jsonb,
    is_required bool DEFAULT true NOT NULL,
    order_index int4 DEFAULT 0 NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    image_url text,
    CONSTRAINT survey_questions_type_check CHECK ((type = ANY (ARRAY['single'::text, 'multiple'::text, 'text'::text, 'rating'::text, 'scale'::text]))),
    CONSTRAINT survey_questions_survey_id_fkey FOREIGN KEY (survey_id) REFERENCES public.surveys(id) ON DELETE CASCADE,
    CONSTRAINT survey_questions_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.survey_responses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    survey_id uuid NOT NULL,
    user_id uuid,
    session_id text,
    submitted_at timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT survey_responses_survey_id_fkey FOREIGN KEY (survey_id) REFERENCES public.surveys(id) ON DELETE CASCADE,
    CONSTRAINT survey_responses_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL,
    CONSTRAINT survey_responses_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.surveys (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    description text,
    created_by uuid,
    is_published bool DEFAULT false NOT NULL,
    is_anonymous bool DEFAULT false NOT NULL,
    deadline_at timestamptz,
    access_group_id uuid,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT surveys_access_group_id_fkey FOREIGN KEY (access_group_id) REFERENCES public.access_groups(id) ON DELETE SET NULL,
    CONSTRAINT surveys_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL,
    CONSTRAINT surveys_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.test_assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    test_id uuid NOT NULL,
    user_id uuid NOT NULL,
    assigned_by uuid,
    deadline_at timestamptz,
    created_at timestamptz DEFAULT now(),
    CONSTRAINT test_assignments_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES public.null(null) ON DELETE SET NULL,
    CONSTRAINT test_assignments_test_id_fkey FOREIGN KEY (test_id) REFERENCES public.tests(id) ON DELETE CASCADE,
    CONSTRAINT test_assignments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.null(null) ON DELETE CASCADE,
    CONSTRAINT test_assignments_user_id_profiles_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
    CONSTRAINT test_assignments_pkey PRIMARY KEY (id),
    CONSTRAINT test_assignments_test_id_user_id_key UNIQUE (test_id,user_id)
);

CREATE TABLE IF NOT EXISTS public.test_attempt_grants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    test_id uuid NOT NULL,
    user_id uuid NOT NULL,
    granted_by uuid NOT NULL,
    granted_at timestamptz DEFAULT now(),
    CONSTRAINT test_attempt_grants_granted_by_fkey FOREIGN KEY (granted_by) REFERENCES public.profiles(id),
    CONSTRAINT test_attempt_grants_test_id_fkey FOREIGN KEY (test_id) REFERENCES public.tests(id) ON DELETE CASCADE,
    CONSTRAINT test_attempt_grants_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
    CONSTRAINT test_attempt_grants_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.test_attempts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    test_id uuid NOT NULL,
    user_id uuid NOT NULL,
    attempt_number int4 DEFAULT 1,
    score numeric DEFAULT 0,
    max_score numeric DEFAULT 0,
    percentage numeric DEFAULT 0,
    passed bool DEFAULT false,
    time_spent_seconds int4,
    started_at timestamptz DEFAULT now(),
    completed_at timestamptz,
    run_id uuid,
    CONSTRAINT test_attempts_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.course_runs(id) ON DELETE SET NULL,
    CONSTRAINT test_attempts_test_id_fkey FOREIGN KEY (test_id) REFERENCES public.tests(id) ON DELETE CASCADE,
    CONSTRAINT test_attempts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.null(null) ON DELETE CASCADE,
    CONSTRAINT test_attempts_user_id_profiles_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
    CONSTRAINT test_attempts_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.tests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    course_id uuid,
    title text NOT NULL,
    description text,
    instructions text,
    passing_score int4 DEFAULT 70 NOT NULL,
    max_attempts int4 DEFAULT 3,
    time_limit_minutes int4,
    order_index int4 DEFAULT 0,
    is_published bool DEFAULT false,
    randomize_questions bool DEFAULT false,
    show_results bool DEFAULT true,
    created_by uuid,
    created_at timestamptz DEFAULT now(),
    auto_assign_positions text[] DEFAULT '{}'::text[],
    cover_image text,
    allow_back_navigation bool DEFAULT false,
    allow_restart bool DEFAULT false,
    show_answer_feedback bool DEFAULT false,
    show_wrong_answers bool DEFAULT false,
    allow_skip bool DEFAULT false,
    CONSTRAINT tests_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE,
    CONSTRAINT tests_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.null(null) ON DELETE SET NULL,
    CONSTRAINT tests_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.trash (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    type text NOT NULL,
    item_id uuid NOT NULL,
    item_data jsonb NOT NULL,
    deleted_by uuid,
    deleted_at timestamptz DEFAULT now() NOT NULL,
    expires_at timestamptz DEFAULT (now() + '7 days'::interval) NOT NULL,
    CONSTRAINT trash_type_check CHECK ((type = ANY (ARRAY['page'::text, 'news'::text, 'resource'::text, 'user'::text]))),
    CONSTRAINT trash_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES public.profiles(id) ON DELETE SET NULL,
    CONSTRAINT trash_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.trusted_ips (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ip text NOT NULL,
    label text,
    created_by uuid,
    created_at timestamptz DEFAULT now(),
    CONSTRAINT trusted_ips_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL,
    CONSTRAINT trusted_ips_pkey PRIMARY KEY (id),
    CONSTRAINT trusted_ips_ip_key UNIQUE (ip)
);

CREATE TABLE IF NOT EXISTS public.user_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    session_token text NOT NULL,
    user_agent text,
    last_seen_at timestamptz DEFAULT now() NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT user_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.null(null) ON DELETE CASCADE,
    CONSTRAINT user_sessions_pkey PRIMARY KEY (id),
    CONSTRAINT user_sessions_session_token_key UNIQUE (session_token)
);

-- Indexes
CREATE INDEX idx_access_groups_created_by ON public.access_groups USING btree (created_by);
CREATE INDEX idx_activity_log_created ON public.activity_log USING btree (created_at DESC);
CREATE INDEX idx_activity_log_user ON public.activity_log USING btree (user_id, created_at DESC);
CREATE INDEX idx_assistant_logs_user_date ON public.assistant_logs USING btree (user_id, created_at);
CREATE INDEX idx_collection_items_collection ON public.collection_items USING btree (collection_id, order_index);
CREATE INDEX idx_collection_items_resource ON public.collection_items USING btree (resource_id);
CREATE INDEX idx_courses_published ON public.courses USING btree (is_published);
CREATE INDEX idx_courses_teacher ON public.courses USING btree (teacher_id);
CREATE UNIQUE INDEX idx_custom_pages_one_home ON public.custom_pages USING btree (is_home) WHERE (is_home = true);
CREATE INDEX ddr_user_idx ON public.doc_deadline_reminders USING btree (user_id);
CREATE INDEX dd_location_idx ON public.document_downloads USING btree (location_id);
CREATE INDEX dd_resource_idx ON public.document_downloads USING btree (resource_id);
CREATE INDEX dd_user_idx ON public.document_downloads USING btree (user_id);
CREATE UNIQUE INDEX enrollments_user_course_run_key ON public.enrollments USING btree (user_id, course_id, COALESCE(run_id, '00000000-0000-0000-0000-000000000000'::uuid));
CREATE INDEX idx_enrollments_course ON public.enrollments USING btree (course_id);
CREATE INDEX idx_enrollments_user ON public.enrollments USING btree (user_id);
CREATE INDEX idx_lesson_progress_user ON public.lesson_progress USING btree (user_id);
CREATE INDEX idx_lessons_course ON public.lessons USING btree (course_id, order_index);
CREATE INDEX idx_news_access_group ON public.news USING btree (access_group_id);
CREATE INDEX idx_news_published ON public.news USING btree (is_published, published_at DESC);
CREATE UNIQUE INDEX idx_news_slug ON public.news USING btree (slug) WHERE (slug IS NOT NULL);
CREATE INDEX idx_news_reads_news ON public.news_reads USING btree (news_id);
CREATE INDEX idx_news_reads_user ON public.news_reads USING btree (user_id);
CREATE INDEX idx_page_att_page ON public.page_attachments USING btree (page_id);
CREATE INDEX idx_profiles_last_seen ON public.profiles USING btree (last_seen_at DESC);
CREATE INDEX idx_profiles_role ON public.profiles USING btree (role);
CREATE UNIQUE INDEX profiles_login_lower_idx ON public.profiles USING btree (lower(login));
CREATE INDEX idx_red_folder_items_page_id ON public.red_folder_items USING btree (page_id) WHERE (page_id IS NOT NULL);
CREATE INDEX registry_docs_item_idx ON public.registry_docs USING btree (registry_item_id);
CREATE INDEX registry_docs_resource_idx ON public.registry_docs USING btree (resource_id);
CREATE INDEX registry_items_section_idx ON public.registry_items USING btree (section_id);
CREATE INDEX registry_section_docs_dov_idx ON public.registry_section_docs USING btree (dovirenost_id);
CREATE INDEX registry_section_docs_res_idx ON public.registry_section_docs USING btree (resource_id);
CREATE INDEX registry_section_docs_sec_idx ON public.registry_section_docs USING btree (section_id);
CREATE INDEX registry_sections_dov_idx ON public.registry_sections USING btree (dovirenost_id);
CREATE INDEX idx_resources_access_group ON public.resources USING btree (access_group_id);
CREATE INDEX idx_resources_category ON public.resources USING btree (category);
CREATE INDEX idx_resources_course ON public.resources USING btree (course_id);
CREATE INDEX idx_resources_created_by ON public.resources USING btree (created_by);
CREATE INDEX idx_resources_deleted_at ON public.resources USING btree (deleted_at);
CREATE INDEX idx_resources_lesson ON public.resources USING btree (lesson_id);
CREATE INDEX resources_display_block_idx ON public.resources USING btree (display_block) WHERE (display_block IS NOT NULL);
CREATE INDEX resources_dovirenost_idx ON public.resources USING btree (dovirenost_id) WHERE (dovirenost_id IS NOT NULL);
CREATE INDEX idx_scorm_progress_package ON public.scorm_progress USING btree (scorm_package_id);
CREATE INDEX idx_scorm_progress_user ON public.scorm_progress USING btree (user_id);
CREATE INDEX idx_trash_expires ON public.trash USING btree (expires_at);
CREATE INDEX idx_trash_type ON public.trash USING btree (type);
CREATE INDEX user_sessions_last_seen_at_idx ON public.user_sessions USING btree (last_seen_at);
CREATE INDEX user_sessions_user_id_idx ON public.user_sessions USING btree (user_id);

-- Row Level Security
ALTER TABLE public.access_group_cities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_group_departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_group_labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_group_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assistant_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attempt_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bd_tabs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.birthday_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branch_doc_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collection_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_bday_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doc_deadline_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_downloads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dovirenosti ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.label_restrictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.page_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.page_dovirenosti ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_cal_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_cal_viewers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_dovirenosti ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.red_folder_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registry_docs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registry_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registry_section_docs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registry_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resource_dovirenosti ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rf_tabs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_shift_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_viewers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scorm_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scorm_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subdivisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survey_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survey_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survey_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survey_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_attempt_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trash ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trusted_ips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "ag_cities: all" ON public.access_group_cities AS PERMISSIVE FOR ALL TO authenticated
    USING (is_admin())
    WITH CHECK (is_admin());

CREATE POLICY "ag_cities_mgr" ON public.access_group_cities AS PERMISSIVE FOR ALL TO authenticated
    USING ((get_current_role() = ANY (ARRAY['admin'::text, 'owner'::text])))
    WITH CHECK ((get_current_role() = ANY (ARRAY['admin'::text, 'owner'::text])));

CREATE POLICY "ag_cities_sel" ON public.access_group_cities AS PERMISSIVE FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "ag_dept_mgr" ON public.access_group_departments AS PERMISSIVE FOR ALL TO authenticated
    USING ((get_current_role() = ANY (ARRAY['admin'::text, 'owner'::text])))
    WITH CHECK ((get_current_role() = ANY (ARRAY['admin'::text, 'owner'::text])));

CREATE POLICY "ag_dept_sel" ON public.access_group_departments AS PERMISSIVE FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "ag_depts: all" ON public.access_group_departments AS PERMISSIVE FOR ALL TO authenticated
    USING (is_admin())
    WITH CHECK (is_admin());

CREATE POLICY "ag_labels: all" ON public.access_group_labels AS PERMISSIVE FOR ALL TO authenticated
    USING (is_admin())
    WITH CHECK (is_admin());

CREATE POLICY "ag_lbl_mgr" ON public.access_group_labels AS PERMISSIVE FOR ALL TO authenticated
    USING ((get_current_role() = ANY (ARRAY['admin'::text, 'owner'::text])))
    WITH CHECK ((get_current_role() = ANY (ARRAY['admin'::text, 'owner'::text])));

CREATE POLICY "ag_lbl_sel" ON public.access_group_labels AS PERMISSIVE FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "ag_pos_mgr" ON public.access_group_positions AS PERMISSIVE FOR ALL TO authenticated
    USING ((get_current_role() = ANY (ARRAY['admin'::text, 'owner'::text])))
    WITH CHECK ((get_current_role() = ANY (ARRAY['admin'::text, 'owner'::text])));

CREATE POLICY "ag_pos_sel" ON public.access_group_positions AS PERMISSIVE FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "ag_positions: all" ON public.access_group_positions AS PERMISSIVE FOR ALL TO authenticated
    USING (is_admin())
    WITH CHECK (is_admin());

CREATE POLICY "access_groups: read" ON public.access_groups AS PERMISSIVE FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "access_groups: write" ON public.access_groups AS PERMISSIVE FOR ALL TO authenticated
    USING (is_admin())
    WITH CHECK (is_admin());

CREATE POLICY "ag_manage" ON public.access_groups AS PERMISSIVE FOR ALL TO authenticated
    USING ((get_current_role() = ANY (ARRAY['admin'::text, 'owner'::text])))
    WITH CHECK ((get_current_role() = ANY (ARRAY['admin'::text, 'owner'::text])));

CREATE POLICY "ag_select" ON public.access_groups AS PERMISSIVE FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "activity_log_insert_own" ON public.activity_log AS PERMISSIVE FOR INSERT TO authenticated
    WITH CHECK ((user_id = auth.uid()));

CREATE POLICY "activity_log_select_own" ON public.activity_log AS PERMISSIVE FOR SELECT TO authenticated
    USING ((user_id = auth.uid()));

CREATE POLICY "activity_log_select_owner" ON public.activity_log AS PERMISSIVE FOR SELECT TO authenticated
    USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'owner'::text)))));

CREATE POLICY "activity_logs: insert authenticated" ON public.activity_logs AS PERMISSIVE FOR INSERT TO authenticated
    WITH CHECK (true);

CREATE POLICY "activity_logs: read admin" ON public.activity_logs AS PERMISSIVE FOR SELECT TO authenticated
    USING (is_admin());

CREATE POLICY "answers_delete" ON public.answers AS PERMISSIVE FOR DELETE TO public
    USING ((auth.uid() IS NOT NULL));

CREATE POLICY "answers_insert" ON public.answers AS PERMISSIVE FOR INSERT TO public
    WITH CHECK ((auth.uid() IS NOT NULL));

CREATE POLICY "answers_select" ON public.answers AS PERMISSIVE FOR SELECT TO public
    USING (true);

CREATE POLICY "answers_update" ON public.answers AS PERMISSIVE FOR UPDATE TO public
    USING ((auth.uid() IS NOT NULL));

CREATE POLICY "assistant_logs_admin" ON public.assistant_logs AS PERMISSIVE FOR SELECT TO authenticated
    USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['owner'::text, 'admin'::text]))))));

CREATE POLICY "assistant_logs_insert" ON public.assistant_logs AS PERMISSIVE FOR INSERT TO service_role
    WITH CHECK (true);

CREATE POLICY "assistant_logs_select" ON public.assistant_logs AS PERMISSIVE FOR SELECT TO authenticated
    USING ((user_id = auth.uid()));

CREATE POLICY "aansw_insert" ON public.attempt_answers AS PERMISSIVE FOR INSERT TO public
    WITH CHECK ((auth.uid() IS NOT NULL));

CREATE POLICY "aansw_select" ON public.attempt_answers AS PERMISSIVE FOR SELECT TO public
    USING ((auth.uid() IS NOT NULL));

CREATE POLICY "bd_tabs_delete" ON public.bd_tabs AS PERMISSIVE FOR DELETE TO public
    USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));

CREATE POLICY "bd_tabs_insert" ON public.bd_tabs AS PERMISSIVE FOR INSERT TO public
    WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));

CREATE POLICY "bd_tabs_select" ON public.bd_tabs AS PERMISSIVE FOR SELECT TO public
    USING ((auth.role() = 'authenticated'::text));

CREATE POLICY "bd_tabs_update" ON public.bd_tabs AS PERMISSIVE FOR UPDATE TO public
    USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));

CREATE POLICY "birthday_reminders: own or admin" ON public.birthday_reminders AS PERMISSIVE FOR ALL TO authenticated
    USING (((created_by = auth.uid()) OR is_admin()))
    WITH CHECK (((created_by = auth.uid()) OR is_admin()));

CREATE POLICY "bookmarks_delete" ON public.bookmarks AS PERMISSIVE FOR DELETE TO public
    USING ((user_id = auth.uid()));

CREATE POLICY "bookmarks_insert" ON public.bookmarks AS PERMISSIVE FOR INSERT TO public
    WITH CHECK ((user_id = auth.uid()));

CREATE POLICY "bookmarks_select" ON public.bookmarks AS PERMISSIVE FOR SELECT TO public
    USING ((user_id = auth.uid()));

CREATE POLICY "bookmarks_update" ON public.bookmarks AS PERMISSIVE FOR UPDATE TO public
    USING ((user_id = auth.uid()))
    WITH CHECK ((user_id = auth.uid()));

CREATE POLICY "blocks_admin" ON public.branch_doc_blocks AS PERMISSIVE FOR ALL TO public
    USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['owner'::text, 'admin'::text]))))));

CREATE POLICY "blocks_read" ON public.branch_doc_blocks AS PERMISSIVE FOR SELECT TO public
    USING (true);

CREATE POLICY "cities: read" ON public.cities AS PERMISSIVE FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "cities: write" ON public.cities AS PERMISSIVE FOR ALL TO authenticated
    USING (is_admin())
    WITH CHECK (is_admin());

CREATE POLICY "cities_manage" ON public.cities AS PERMISSIVE FOR ALL TO authenticated
    USING ((get_current_role() = ANY (ARRAY['admin'::text, 'owner'::text])))
    WITH CHECK ((get_current_role() = ANY (ARRAY['admin'::text, 'owner'::text])));

CREATE POLICY "coll_items_manage" ON public.collection_items AS PERMISSIVE FOR ALL TO authenticated
    USING (public.is_teacher_or_admin());

CREATE POLICY "coll_items_select" ON public.collection_items AS PERMISSIVE FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "collections_manage" ON public.collections AS PERMISSIVE FOR ALL TO authenticated
    USING (public.is_teacher_or_admin());

CREATE POLICY "collections_select" ON public.collections AS PERMISSIVE FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "company_bday_messages_delete" ON public.company_bday_messages AS PERMISSIVE FOR DELETE TO public
    USING ((auth.uid() = user_id));

CREATE POLICY "company_bday_messages_insert" ON public.company_bday_messages AS PERMISSIVE FOR INSERT TO public
    WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "company_bday_messages_select" ON public.company_bday_messages AS PERMISSIVE FOR SELECT TO public
    USING ((auth.uid() IS NOT NULL));

CREATE POLICY "runs_delete" ON public.course_runs AS PERMISSIVE FOR DELETE TO authenticated
    USING (is_admin());

CREATE POLICY "runs_insert" ON public.course_runs AS PERMISSIVE FOR INSERT TO authenticated
    WITH CHECK (is_admin());

CREATE POLICY "runs_select" ON public.course_runs AS PERMISSIVE FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "runs_update" ON public.course_runs AS PERMISSIVE FOR UPDATE TO authenticated
    USING (is_admin());

CREATE POLICY "course_teachers_read" ON public.course_teachers AS PERMISSIVE FOR SELECT TO public
    USING (true);

CREATE POLICY "course_teachers_write" ON public.course_teachers AS PERMISSIVE FOR ALL TO public
    USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['owner'::text, 'admin'::text, 'smm'::text, 'teacher'::text]))))));

CREATE POLICY "courses: read" ON public.courses AS PERMISSIVE FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "courses: write" ON public.courses AS PERMISSIVE FOR ALL TO authenticated
    USING (is_staff())
    WITH CHECK (is_staff());

CREATE POLICY "courses_insert" ON public.courses AS PERMISSIVE FOR INSERT TO authenticated
    WITH CHECK (public.is_teacher_or_admin());

CREATE POLICY "custom_pages: read" ON public.custom_pages AS PERMISSIVE FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "custom_pages: write" ON public.custom_pages AS PERMISSIVE FOR ALL TO authenticated
    USING (is_staff())
    WITH CHECK (is_staff());

CREATE POLICY "pages_manage" ON public.custom_pages AS PERMISSIVE FOR ALL TO authenticated
    USING ((get_current_role() = ANY (ARRAY['owner'::text, 'admin'::text, 'smm'::text, 'teacher'::text])))
    WITH CHECK ((get_current_role() = ANY (ARRAY['owner'::text, 'admin'::text, 'smm'::text, 'teacher'::text])));

CREATE POLICY "pages_select" ON public.custom_pages AS PERMISSIVE FOR SELECT TO authenticated
    USING (((get_current_role() = ANY (ARRAY['owner'::text, 'admin'::text, 'smm'::text, 'teacher'::text])) OR ((is_published = true) AND ((array_length(allowed_labels, 1) IS NULL) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.label = ANY (custom_pages.allowed_labels)))))))));

CREATE POLICY "doc_deadline_reminders: insert" ON public.doc_deadline_reminders AS PERMISSIVE FOR INSERT TO authenticated
    WITH CHECK (true);

CREATE POLICY "doc_deadline_reminders: read own" ON public.doc_deadline_reminders AS PERMISSIVE FOR SELECT TO authenticated
    USING (((user_id = auth.uid()) OR is_admin()));

CREATE POLICY "dd_insert" ON public.document_downloads AS PERMISSIVE FOR INSERT TO authenticated
    WITH CHECK ((user_id = auth.uid()));

CREATE POLICY "dd_select" ON public.document_downloads AS PERMISSIVE FOR SELECT TO authenticated
    USING (((user_id = auth.uid()) OR is_admin() OR (get_current_role() = 'manager'::text)));

CREATE POLICY "doc_downloads: insert own" ON public.document_downloads AS PERMISSIVE FOR INSERT TO authenticated
    WITH CHECK ((user_id = auth.uid()));

CREATE POLICY "admin manage dovirenosti" ON public.dovirenosti AS PERMISSIVE FOR ALL TO authenticated
    USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'owner'::text]))))))
    WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));

CREATE POLICY "dov: read" ON public.dovirenosti AS PERMISSIVE FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "dov: write" ON public.dovirenosti AS PERMISSIVE FOR ALL TO authenticated
    USING (is_admin())
    WITH CHECK (is_admin());

CREATE POLICY "read dovirenosti" ON public.dovirenosti AS PERMISSIVE FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "enroll_delete" ON public.enrollments AS PERMISSIVE FOR DELETE TO authenticated
    USING (((user_id = auth.uid()) OR is_admin()));

CREATE POLICY "enroll_select" ON public.enrollments AS PERMISSIVE FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "enrollments: delete admin" ON public.enrollments AS PERMISSIVE FOR DELETE TO authenticated
    USING (is_admin());

CREATE POLICY "enrollments: insert own or admin" ON public.enrollments AS PERMISSIVE FOR INSERT TO authenticated
    WITH CHECK (((user_id = auth.uid()) OR is_admin()));

CREATE POLICY "enrollments: read own or admin" ON public.enrollments AS PERMISSIVE FOR SELECT TO authenticated
    USING (((user_id = auth.uid()) OR is_admin()));

CREATE POLICY "enrollments: update admin" ON public.enrollments AS PERMISSIVE FOR UPDATE TO authenticated
    USING (is_admin());

CREATE POLICY "label_restr: all" ON public.label_restrictions AS PERMISSIVE FOR ALL TO authenticated
    USING (is_admin())
    WITH CHECK (is_admin());

CREATE POLICY "lesson_progress: own" ON public.lesson_progress AS PERMISSIVE FOR ALL TO authenticated
    USING ((user_id = auth.uid()))
    WITH CHECK ((user_id = auth.uid()));

CREATE POLICY "lp_insert" ON public.lesson_progress AS PERMISSIVE FOR INSERT TO authenticated
    WITH CHECK ((user_id = auth.uid()));

CREATE POLICY "lp_select" ON public.lesson_progress AS PERMISSIVE FOR SELECT TO authenticated
    USING (((user_id = auth.uid()) OR public.is_teacher_or_admin()));

CREATE POLICY "lp_update" ON public.lesson_progress AS PERMISSIVE FOR UPDATE TO authenticated
    USING ((user_id = auth.uid()));

CREATE POLICY "lessons: read" ON public.lessons AS PERMISSIVE FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "lessons: write" ON public.lessons AS PERMISSIVE FOR ALL TO authenticated
    USING (is_staff())
    WITH CHECK (is_staff());

CREATE POLICY "lessons_manage" ON public.lessons AS PERMISSIVE FOR ALL TO authenticated
    USING (public.is_teacher_or_admin());

CREATE POLICY "lessons_select" ON public.lessons AS PERMISSIVE FOR SELECT TO authenticated
    USING (((EXISTS ( SELECT 1
   FROM enrollments
  WHERE ((enrollments.user_id = auth.uid()) AND (enrollments.course_id = lessons.course_id)))) OR public.is_teacher_or_admin()));

CREATE POLICY "news: read" ON public.news AS PERMISSIVE FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "news: write" ON public.news AS PERMISSIVE FOR ALL TO authenticated
    USING (is_staff())
    WITH CHECK (is_staff());

CREATE POLICY "news_manage" ON public.news AS PERMISSIVE FOR ALL TO authenticated
    USING ((get_current_role() = ANY (ARRAY['owner'::text, 'admin'::text, 'smm'::text, 'teacher'::text])))
    WITH CHECK ((get_current_role() = ANY (ARRAY['owner'::text, 'admin'::text, 'smm'::text, 'teacher'::text])));

CREATE POLICY "news_select" ON public.news AS PERMISSIVE FOR SELECT TO authenticated
    USING (((is_published = true) OR (get_current_role() = ANY (ARRAY['owner'::text, 'admin'::text, 'smm'::text, 'teacher'::text]))));

CREATE POLICY "news_reactions: own" ON public.news_reactions AS PERMISSIVE FOR ALL TO authenticated
    USING ((user_id = auth.uid()))
    WITH CHECK ((user_id = auth.uid()));

CREATE POLICY "news_reactions: read" ON public.news_reactions AS PERMISSIVE FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "reactions_delete" ON public.news_reactions AS PERMISSIVE FOR DELETE TO public
    USING ((auth.uid() = user_id));

CREATE POLICY "reactions_insert" ON public.news_reactions AS PERMISSIVE FOR INSERT TO public
    WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "reactions_select" ON public.news_reactions AS PERMISSIVE FOR SELECT TO public
    USING (true);

CREATE POLICY "reactions_update" ON public.news_reactions AS PERMISSIVE FOR UPDATE TO authenticated
    USING ((user_id = auth.uid()))
    WITH CHECK ((user_id = auth.uid()));

CREATE POLICY "news_reads_delete" ON public.news_reads AS PERMISSIVE FOR DELETE TO authenticated
    USING ((user_id = auth.uid()));

CREATE POLICY "news_reads_insert" ON public.news_reads AS PERMISSIVE FOR INSERT TO authenticated
    WITH CHECK ((user_id = auth.uid()));

CREATE POLICY "news_reads_select" ON public.news_reads AS PERMISSIVE FOR SELECT TO authenticated
    USING ((user_id = auth.uid()));

CREATE POLICY "news_reads_update" ON public.news_reads AS PERMISSIVE FOR UPDATE TO authenticated
    USING ((user_id = auth.uid()));

CREATE POLICY "notif_insert" ON public.notifications AS PERMISSIVE FOR INSERT TO public
    WITH CHECK ((auth.uid() IS NOT NULL));

CREATE POLICY "notif_select" ON public.notifications AS PERMISSIVE FOR SELECT TO public
    USING ((auth.uid() = user_id));

CREATE POLICY "notif_update" ON public.notifications AS PERMISSIVE FOR UPDATE TO public
    USING ((auth.uid() = user_id));

CREATE POLICY "notifications: own or admin" ON public.notifications AS PERMISSIVE FOR ALL TO authenticated
    USING (((user_id = auth.uid()) OR is_admin()))
    WITH CHECK ((is_admin() OR (user_id = auth.uid())));

CREATE POLICY "page_att: read" ON public.page_attachments AS PERMISSIVE FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "page_att: write" ON public.page_attachments AS PERMISSIVE FOR ALL TO authenticated
    USING (is_staff())
    WITH CHECK (is_staff());

CREATE POLICY "page_att_manage" ON public.page_attachments AS PERMISSIVE FOR ALL TO authenticated
    USING ((get_current_role() = ANY (ARRAY['owner'::text, 'admin'::text, 'smm'::text, 'teacher'::text])))
    WITH CHECK ((get_current_role() = ANY (ARRAY['owner'::text, 'admin'::text, 'smm'::text, 'teacher'::text])));

CREATE POLICY "page_att_select" ON public.page_attachments AS PERMISSIVE FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "page_dovirenosti_delete" ON public.page_dovirenosti AS PERMISSIVE FOR DELETE TO authenticated
    USING ((get_current_role() = ANY (ARRAY['owner'::text, 'admin'::text, 'smm'::text])));

CREATE POLICY "page_dovirenosti_insert" ON public.page_dovirenosti AS PERMISSIVE FOR INSERT TO authenticated
    WITH CHECK ((get_current_role() = ANY (ARRAY['owner'::text, 'admin'::text, 'smm'::text])));

CREATE POLICY "page_dovirenosti_select" ON public.page_dovirenosti AS PERMISSIVE FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "cal_events: select" ON public.personal_cal_events AS PERMISSIVE FOR SELECT TO authenticated
    USING (((user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM personal_cal_viewers
  WHERE ((personal_cal_viewers.viewer_id = auth.uid()) AND (personal_cal_viewers.owner_id = personal_cal_events.user_id))))));

CREATE POLICY "cal_events: write own" ON public.personal_cal_events AS PERMISSIVE FOR ALL TO authenticated
    USING ((user_id = auth.uid()))
    WITH CHECK ((user_id = auth.uid()));

CREATE POLICY "cal_viewers: own" ON public.personal_cal_viewers AS PERMISSIVE FOR ALL TO authenticated
    USING (((owner_id = auth.uid()) OR (viewer_id = auth.uid())))
    WITH CHECK ((owner_id = auth.uid()));

CREATE POLICY "positions: read" ON public.positions AS PERMISSIVE FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "positions: write" ON public.positions AS PERMISSIVE FOR ALL TO authenticated
    USING (is_admin())
    WITH CHECK (is_admin());

CREATE POLICY "positions_manage" ON public.positions AS PERMISSIVE FOR ALL TO authenticated
    USING ((get_current_role() = ANY (ARRAY['admin'::text, 'owner'::text])))
    WITH CHECK ((get_current_role() = ANY (ARRAY['admin'::text, 'owner'::text])));

CREATE POLICY "admin manage profile_dovirenosti" ON public.profile_dovirenosti AS PERMISSIVE FOR ALL TO authenticated
    USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'owner'::text]))))))
    WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));

CREATE POLICY "prof_dov: own" ON public.profile_dovirenosti AS PERMISSIVE FOR ALL TO authenticated
    USING (((profile_id = auth.uid()) OR is_admin()))
    WITH CHECK (is_admin());

CREATE POLICY "read profile_dovirenosti" ON public.profile_dovirenosti AS PERMISSIVE FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "profiles: delete admin" ON public.profiles AS PERMISSIVE FOR DELETE TO authenticated
    USING (is_admin());

CREATE POLICY "profiles: insert admin" ON public.profiles AS PERMISSIVE FOR INSERT TO authenticated
    WITH CHECK (is_admin());

CREATE POLICY "profiles: read authenticated" ON public.profiles AS PERMISSIVE FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "profiles: update own or admin" ON public.profiles AS PERMISSIVE FOR UPDATE TO authenticated
    USING (((id = auth.uid()) OR is_admin()));

CREATE POLICY "profiles_admin_force_logout" ON public.profiles AS PERMISSIVE FOR UPDATE TO authenticated
    USING ((EXISTS ( SELECT 1
   FROM profiles profiles_1
  WHERE ((profiles_1.id = auth.uid()) AND (profiles_1.role = ANY (ARRAY['admin'::text, 'owner'::text]))))))
    WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles profiles_1
  WHERE ((profiles_1.id = auth.uid()) AND (profiles_1.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));

CREATE POLICY "questions_delete" ON public.questions AS PERMISSIVE FOR DELETE TO public
    USING ((auth.uid() IS NOT NULL));

CREATE POLICY "questions_insert" ON public.questions AS PERMISSIVE FOR INSERT TO public
    WITH CHECK ((auth.uid() IS NOT NULL));

CREATE POLICY "questions_select" ON public.questions AS PERMISSIVE FOR SELECT TO public
    USING (true);

CREATE POLICY "questions_update" ON public.questions AS PERMISSIVE FOR UPDATE TO public
    USING ((auth.uid() IS NOT NULL));

CREATE POLICY "All authenticated users can read red folder items" ON public.red_folder_items AS PERMISSIVE FOR SELECT TO public
    USING ((auth.uid() IS NOT NULL));

CREATE POLICY "Staff can manage red folder items" ON public.red_folder_items AS PERMISSIVE FOR ALL TO public
    USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['owner'::text, 'admin'::text, 'smm'::text, 'teacher'::text]))))))
    WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['owner'::text, 'admin'::text, 'smm'::text, 'teacher'::text]))))));

CREATE POLICY "registry_docs_admin_delete" ON public.registry_docs AS PERMISSIVE FOR DELETE TO public
    USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));

CREATE POLICY "registry_docs_admin_insert" ON public.registry_docs AS PERMISSIVE FOR INSERT TO public
    WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));

CREATE POLICY "registry_docs_admin_update" ON public.registry_docs AS PERMISSIVE FOR UPDATE TO public
    USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));

CREATE POLICY "registry_docs_select_all" ON public.registry_docs AS PERMISSIVE FOR SELECT TO public
    USING (true);

CREATE POLICY "registry_items_admin_delete" ON public.registry_items AS PERMISSIVE FOR DELETE TO public
    USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));

CREATE POLICY "registry_items_admin_insert" ON public.registry_items AS PERMISSIVE FOR INSERT TO public
    WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));

CREATE POLICY "registry_items_admin_update" ON public.registry_items AS PERMISSIVE FOR UPDATE TO public
    USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));

CREATE POLICY "registry_items_select_all" ON public.registry_items AS PERMISSIVE FOR SELECT TO public
    USING (true);

CREATE POLICY "registry_section_docs_admin_delete" ON public.registry_section_docs AS PERMISSIVE FOR DELETE TO public
    USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['owner'::text, 'admin'::text]))))));

CREATE POLICY "registry_section_docs_admin_insert" ON public.registry_section_docs AS PERMISSIVE FOR INSERT TO public
    WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['owner'::text, 'admin'::text]))))));

CREATE POLICY "registry_section_docs_select_all" ON public.registry_section_docs AS PERMISSIVE FOR SELECT TO public
    USING (true);

CREATE POLICY "registry_sections_admin_delete" ON public.registry_sections AS PERMISSIVE FOR DELETE TO public
    USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['owner'::text, 'admin'::text]))))));

CREATE POLICY "registry_sections_admin_insert" ON public.registry_sections AS PERMISSIVE FOR INSERT TO public
    WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['owner'::text, 'admin'::text]))))));

CREATE POLICY "registry_sections_admin_update" ON public.registry_sections AS PERMISSIVE FOR UPDATE TO public
    USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['owner'::text, 'admin'::text]))))));

CREATE POLICY "registry_sections_select_all" ON public.registry_sections AS PERMISSIVE FOR SELECT TO public
    USING (true);

CREATE POLICY "read resource_dovirenosti" ON public.resource_dovirenosti AS PERMISSIVE FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "resource_dovirenosti_select" ON public.resource_dovirenosti AS PERMISSIVE FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "resource_dovirenosti_write" ON public.resource_dovirenosti AS PERMISSIVE FOR ALL TO authenticated
    USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['owner'::text, 'admin'::text, 'smm'::text, 'teacher'::text]))))))
    WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['owner'::text, 'admin'::text, 'smm'::text, 'teacher'::text]))))));

CREATE POLICY "staff manage resource_dovirenosti" ON public.resource_dovirenosti AS PERMISSIVE FOR ALL TO authenticated
    USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'owner'::text, 'smm'::text, 'teacher'::text, 'manager'::text]))))))
    WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'owner'::text, 'smm'::text, 'teacher'::text, 'manager'::text]))))));

CREATE POLICY "resources: read" ON public.resources AS PERMISSIVE FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "resources: write" ON public.resources AS PERMISSIVE FOR ALL TO authenticated
    USING (is_staff())
    WITH CHECK (is_staff());

CREATE POLICY "resources_select" ON public.resources AS PERMISSIVE FOR SELECT TO authenticated
    USING (((get_current_role() = ANY (ARRAY['owner'::text, 'admin'::text, 'smm'::text, 'teacher'::text])) OR ((lesson_id IS NULL) AND ((access_group_id IS NULL) OR user_has_group_access(access_group_id)) AND ((course_id IS NULL) OR (EXISTS ( SELECT 1
   FROM enrollments e
  WHERE ((e.user_id = auth.uid()) AND (e.course_id = resources.course_id)))))) OR (EXISTS ( SELECT 1
   FROM (lessons l
     JOIN enrollments e ON ((e.course_id = l.course_id)))
  WHERE ((l.id = resources.lesson_id) AND (e.user_id = auth.uid()))))));

CREATE POLICY "resources_write" ON public.resources AS PERMISSIVE FOR ALL TO authenticated
    USING ((get_current_role() = ANY (ARRAY['owner'::text, 'admin'::text, 'smm'::text, 'teacher'::text])))
    WITH CHECK ((get_current_role() = ANY (ARRAY['owner'::text, 'admin'::text, 'smm'::text, 'teacher'::text])));

CREATE POLICY "rf_tabs_delete" ON public.rf_tabs AS PERMISSIVE FOR DELETE TO public
    USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));

CREATE POLICY "rf_tabs_insert" ON public.rf_tabs AS PERMISSIVE FOR INSERT TO public
    WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));

CREATE POLICY "rf_tabs_select" ON public.rf_tabs AS PERMISSIVE FOR SELECT TO public
    USING ((auth.role() = 'authenticated'::text));

CREATE POLICY "rf_tabs_update" ON public.rf_tabs AS PERMISSIVE FOR UPDATE TO public
    USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));

CREATE POLICY "sched_assign: read" ON public.schedule_assignments AS PERMISSIVE FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "sched_assign: write" ON public.schedule_assignments AS PERMISSIVE FOR ALL TO authenticated
    USING (is_manager())
    WITH CHECK (is_manager());

CREATE POLICY "sched_entries: read" ON public.schedule_entries AS PERMISSIVE FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "sched_entries: write" ON public.schedule_entries AS PERMISSIVE FOR ALL TO authenticated
    USING (is_manager())
    WITH CHECK (is_manager());

CREATE POLICY "sentry_delete" ON public.schedule_entries AS PERMISSIVE FOR DELETE TO public
    USING (((auth.uid() = user_id) OR (EXISTS ( SELECT 1
   FROM schedule_locations
  WHERE ((schedule_locations.id = schedule_entries.location_id) AND (schedule_locations.created_by = auth.uid()))))));

CREATE POLICY "sentry_insert" ON public.schedule_entries AS PERMISSIVE FOR INSERT TO public
    WITH CHECK (((auth.uid() = user_id) OR (EXISTS ( SELECT 1
   FROM schedule_locations
  WHERE ((schedule_locations.id = schedule_entries.location_id) AND (schedule_locations.created_by = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM schedule_viewers
  WHERE ((schedule_viewers.location_id = schedule_entries.location_id) AND (schedule_viewers.user_id = auth.uid()))))));

CREATE POLICY "sentry_select" ON public.schedule_entries AS PERMISSIVE FOR SELECT TO public
    USING (true);

CREATE POLICY "sentry_update" ON public.schedule_entries AS PERMISSIVE FOR UPDATE TO public
    USING (((auth.uid() = user_id) OR (EXISTS ( SELECT 1
   FROM schedule_locations
  WHERE ((schedule_locations.id = schedule_entries.location_id) AND (schedule_locations.created_by = auth.uid()))))));

CREATE POLICY "sched_loc: read" ON public.schedule_locations AS PERMISSIVE FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "sched_loc: write" ON public.schedule_locations AS PERMISSIVE FOR ALL TO authenticated
    USING (is_manager())
    WITH CHECK (is_manager());

CREATE POLICY "sched_log: insert" ON public.schedule_log AS PERMISSIVE FOR INSERT TO authenticated
    WITH CHECK (true);

CREATE POLICY "sched_log: read" ON public.schedule_log AS PERMISSIVE FOR SELECT TO authenticated
    USING (is_manager());

CREATE POLICY "sched_partners: all" ON public.schedule_partners AS PERMISSIVE FOR ALL TO authenticated
    USING (is_manager())
    WITH CHECK (is_manager());

CREATE POLICY "sched_config: all" ON public.schedule_shift_config AS PERMISSIVE FOR ALL TO authenticated
    USING ((user_id = auth.uid()))
    WITH CHECK ((user_id = auth.uid()));

CREATE POLICY "sched_viewers: all" ON public.schedule_viewers AS PERMISSIVE FOR ALL TO authenticated
    USING (is_manager())
    WITH CHECK (is_manager());

CREATE POLICY "sched_notif: read" ON public.scheduled_notifications AS PERMISSIVE FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "sched_notif: write" ON public.scheduled_notifications AS PERMISSIVE FOR ALL TO authenticated
    USING (is_admin())
    WITH CHECK (is_admin());

CREATE POLICY "scorm_pkg: read" ON public.scorm_packages AS PERMISSIVE FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "scorm_pkg: write" ON public.scorm_packages AS PERMISSIVE FOR ALL TO authenticated
    USING (is_staff())
    WITH CHECK (is_staff());

CREATE POLICY "scorm_pkg_manage" ON public.scorm_packages AS PERMISSIVE FOR ALL TO authenticated
    USING (public.is_teacher_or_admin());

CREATE POLICY "scorm_pkg_select" ON public.scorm_packages AS PERMISSIVE FOR SELECT TO authenticated
    USING (((EXISTS ( SELECT 1
   FROM ((resources r
     JOIN lessons l ON ((l.id = r.lesson_id)))
     JOIN enrollments e ON ((e.course_id = l.course_id)))
  WHERE ((r.id = scorm_packages.resource_id) AND (e.user_id = auth.uid())))) OR public.is_teacher_or_admin()));

CREATE POLICY "scorm_prog_insert" ON public.scorm_progress AS PERMISSIVE FOR INSERT TO authenticated
    WITH CHECK ((user_id = auth.uid()));

CREATE POLICY "scorm_prog_select" ON public.scorm_progress AS PERMISSIVE FOR SELECT TO authenticated
    USING (((user_id = auth.uid()) OR public.is_teacher_or_admin()));

CREATE POLICY "scorm_prog_update" ON public.scorm_progress AS PERMISSIVE FOR UPDATE TO authenticated
    USING ((user_id = auth.uid()));

CREATE POLICY "scorm_progress: own" ON public.scorm_progress AS PERMISSIVE FOR ALL TO authenticated
    USING ((user_id = auth.uid()))
    WITH CHECK ((user_id = auth.uid()));

CREATE POLICY "subdiv: read" ON public.subdivisions AS PERMISSIVE FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "subdiv: write" ON public.subdivisions AS PERMISSIVE FOR ALL TO authenticated
    USING (is_admin())
    WITH CHECK (is_admin());

CREATE POLICY "subdivisions_manage" ON public.subdivisions AS PERMISSIVE FOR ALL TO authenticated
    USING ((get_current_role() = ANY (ARRAY['admin'::text, 'owner'::text])))
    WITH CHECK ((get_current_role() = ANY (ARRAY['admin'::text, 'owner'::text])));

CREATE POLICY "survey_answers_insert" ON public.survey_answers AS PERMISSIVE FOR INSERT TO authenticated
    WITH CHECK (true);

CREATE POLICY "survey_answers_read" ON public.survey_answers AS PERMISSIVE FOR SELECT TO authenticated
    USING ((EXISTS ( SELECT 1
   FROM survey_responses r
  WHERE ((r.id = survey_answers.response_id) AND ((r.user_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM profiles
          WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['owner'::text, 'admin'::text, 'smm'::text, 'teacher'::text, 'manager'::text]))))))))));

CREATE POLICY "survey_assignments_read" ON public.survey_assignments AS PERMISSIVE FOR SELECT TO authenticated
    USING (((user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['owner'::text, 'admin'::text, 'smm'::text, 'teacher'::text, 'manager'::text])))))));

CREATE POLICY "survey_assignments_write" ON public.survey_assignments AS PERMISSIVE FOR ALL TO authenticated
    USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['owner'::text, 'admin'::text, 'smm'::text]))))));

CREATE POLICY "survey_questions_read" ON public.survey_questions AS PERMISSIVE FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "survey_questions_write" ON public.survey_questions AS PERMISSIVE FOR ALL TO authenticated
    USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['owner'::text, 'admin'::text, 'smm'::text]))))));

CREATE POLICY "survey_responses_insert" ON public.survey_responses AS PERMISSIVE FOR INSERT TO authenticated
    WITH CHECK (true);

CREATE POLICY "survey_responses_read_own" ON public.survey_responses AS PERMISSIVE FOR SELECT TO authenticated
    USING (((user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['owner'::text, 'admin'::text, 'smm'::text, 'teacher'::text, 'manager'::text])))))));

CREATE POLICY "surveys_read" ON public.surveys AS PERMISSIVE FOR SELECT TO authenticated
    USING (((is_published = true) OR (created_by = auth.uid()) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['owner'::text, 'admin'::text, 'smm'::text, 'teacher'::text, 'manager'::text])))))));

CREATE POLICY "surveys_write" ON public.surveys AS PERMISSIVE FOR ALL TO authenticated
    USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['owner'::text, 'admin'::text, 'smm'::text]))))));

CREATE POLICY "tassign_delete" ON public.test_assignments AS PERMISSIVE FOR DELETE TO public
    USING ((auth.uid() IS NOT NULL));

CREATE POLICY "tassign_insert" ON public.test_assignments AS PERMISSIVE FOR INSERT TO public
    WITH CHECK ((auth.uid() IS NOT NULL));

CREATE POLICY "tassign_select" ON public.test_assignments AS PERMISSIVE FOR SELECT TO public
    USING ((auth.uid() IS NOT NULL));

CREATE POLICY "admin manage grants" ON public.test_attempt_grants AS PERMISSIVE FOR ALL TO authenticated
    USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'owner'::text, 'teacher'::text]))))))
    WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'owner'::text, 'teacher'::text]))))));

CREATE POLICY "admin read grants" ON public.test_attempt_grants AS PERMISSIVE FOR SELECT TO authenticated
    USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'owner'::text, 'teacher'::text, 'smm'::text, 'manager'::text]))))));

CREATE POLICY "user read own grants" ON public.test_attempt_grants AS PERMISSIVE FOR SELECT TO authenticated
    USING ((user_id = auth.uid()));

CREATE POLICY "tattempts_insert" ON public.test_attempts AS PERMISSIVE FOR INSERT TO public
    WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "tattempts_select" ON public.test_attempts AS PERMISSIVE FOR SELECT TO public
    USING ((auth.uid() IS NOT NULL));

CREATE POLICY "tattempts_update" ON public.test_attempts AS PERMISSIVE FOR UPDATE TO public
    USING ((auth.uid() = user_id));

CREATE POLICY "tests_delete" ON public.tests AS PERMISSIVE FOR DELETE TO public
    USING ((auth.uid() IS NOT NULL));

CREATE POLICY "tests_insert" ON public.tests AS PERMISSIVE FOR INSERT TO public
    WITH CHECK ((auth.uid() IS NOT NULL));

CREATE POLICY "tests_select" ON public.tests AS PERMISSIVE FOR SELECT TO public
    USING (true);

CREATE POLICY "tests_update" ON public.tests AS PERMISSIVE FOR UPDATE TO public
    USING ((auth.uid() IS NOT NULL));

CREATE POLICY "trash: delete" ON public.trash AS PERMISSIVE FOR DELETE TO authenticated
    USING (is_admin());

CREATE POLICY "trash: insert" ON public.trash AS PERMISSIVE FOR INSERT TO authenticated
    WITH CHECK (true);

CREATE POLICY "trash: read" ON public.trash AS PERMISSIVE FOR SELECT TO authenticated
    USING (is_admin());

CREATE POLICY "trash_owner_select" ON public.trash AS PERMISSIVE FOR SELECT TO authenticated
    USING ((get_current_role() = 'owner'::text));

CREATE POLICY "trusted_ips_delete" ON public.trusted_ips AS PERMISSIVE FOR DELETE TO authenticated
    USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['owner'::text, 'admin'::text]))))));

CREATE POLICY "trusted_ips_insert" ON public.trusted_ips AS PERMISSIVE FOR INSERT TO authenticated
    WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['owner'::text, 'admin'::text]))))));

CREATE POLICY "trusted_ips_select" ON public.trusted_ips AS PERMISSIVE FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "user_sessions_admin_read" ON public.user_sessions AS PERMISSIVE FOR SELECT TO authenticated
    USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['owner'::text, 'admin'::text]))))));

CREATE POLICY "user_sessions_own" ON public.user_sessions AS PERMISSIVE FOR ALL TO authenticated
    USING ((user_id = auth.uid()))
    WITH CHECK ((user_id = auth.uid()));

-- Triggers
CREATE OR REPLACE TRIGGER trg_access_groups_upd
    BEFORE UPDATE ON public.access_groups
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE TRIGGER trg_collections_upd
    BEFORE UPDATE ON public.collections
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE TRIGGER trg_courses_upd
    BEFORE UPDATE ON public.courses
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE TRIGGER trg_custom_pages_updated_at
    BEFORE UPDATE ON public.custom_pages
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE TRIGGER trg_pages_to_trash
    BEFORE DELETE ON public.custom_pages
    FOR EACH ROW EXECUTE FUNCTION trg_to_trash('page');

CREATE OR REPLACE TRIGGER trg_lessons_upd
    BEFORE UPDATE ON public.lessons
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE TRIGGER trg_news_to_trash
    BEFORE DELETE ON public.news
    FOR EACH ROW EXECUTE FUNCTION trg_to_trash('news');

CREATE OR REPLACE TRIGGER trg_news_upd
    BEFORE UPDATE ON public.news
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE TRIGGER trg_profile_to_trash
    BEFORE DELETE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION trg_profile_to_trash();

CREATE OR REPLACE TRIGGER trg_profiles_upd
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE TRIGGER trg_single_owner
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION enforce_single_owner();

CREATE OR REPLACE TRIGGER trg_sync_full_name
    BEFORE UPDATE OR INSERT ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION sync_full_name();

CREATE OR REPLACE TRIGGER trg_red_folder_items_updated_at
    BEFORE UPDATE ON public.red_folder_items
    FOR EACH ROW EXECUTE FUNCTION update_red_folder_items_updated_at();

CREATE OR REPLACE TRIGGER resources_updated_at
    BEFORE UPDATE ON public.resources
    FOR EACH ROW EXECUTE FUNCTION resources_set_updated_at();

CREATE OR REPLACE TRIGGER trg_resources_to_trash
    BEFORE DELETE ON public.resources
    FOR EACH ROW EXECUTE FUNCTION trg_to_trash('resource');

CREATE OR REPLACE TRIGGER trg_resources_upd
    BEFORE UPDATE ON public.resources
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE TRIGGER surveys_updated_at
    BEFORE UPDATE ON public.surveys
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
