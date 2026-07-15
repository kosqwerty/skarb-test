-- ================================================================
-- LMS "Скарбниця" — Consolidated schema (migration v152)
-- Generated from live Supabase database via pg_catalog introspection
-- (pg_dump/docker unavailable in this environment — same coverage:
--  tables, columns, constraints, indexes, RLS, policies, functions,
--  triggers, sequences for the public schema)
-- ================================================================


-- ── Sequences ────────────────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS public.activity_logs_id_seq;

CREATE TABLE IF NOT EXISTS public.access_group_cities (
    group_id uuid NOT NULL,
    city text NOT NULL
);

CREATE TABLE IF NOT EXISTS public.access_group_departments (
    group_id uuid NOT NULL,
    department text NOT NULL
);

CREATE TABLE IF NOT EXISTS public.access_group_labels (
    group_id uuid NOT NULL,
    label text NOT NULL
);

CREATE TABLE IF NOT EXISTS public.access_group_positions (
    group_id uuid NOT NULL,
    position text NOT NULL
);

CREATE TABLE IF NOT EXISTS public.access_groups (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    name text NOT NULL,
    description text,
    is_public boolean DEFAULT false NOT NULL,
    created_by uuid,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
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
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.activity_logs (
    id bigint DEFAULT nextval('activity_logs_id_seq'::regclass) NOT NULL,
    user_id uuid,
    actor_name text,
    actor_role text,
    action text NOT NULL,
    entity_type text,
    entity_name text,
    meta jsonb,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.answers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    question_id uuid NOT NULL,
    answer_text text DEFAULT ''::text NOT NULL,
    is_correct boolean DEFAULT false,
    order_index integer DEFAULT 0,
    image_url text,
    image_align text DEFAULT 'left'::text
);

CREATE TABLE IF NOT EXISTS public.assistant_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.attempt_answers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    attempt_id uuid NOT NULL,
    question_id uuid NOT NULL,
    selected_answer_ids uuid[] DEFAULT '{}'::uuid[],
    is_correct boolean DEFAULT false,
    points_earned numeric DEFAULT 0,
    answer_text text,
    review_comment text
);

CREATE TABLE IF NOT EXISTS public.bd_tabs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    order_index integer DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    dov_ids uuid[] DEFAULT '{}'::uuid[]
);

CREATE TABLE IF NOT EXISTS public.birthday_reminders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_by uuid NOT NULL,
    target_id uuid NOT NULL,
    days_before integer DEFAULT 7 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    notified_year integer,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.bookmarks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    type text DEFAULT 'resource'::text NOT NULL,
    title text NOT NULL,
    icon text DEFAULT '📌'::text,
    route text NOT NULL,
    subtitle text,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.branch_doc_blocks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    number integer NOT NULL,
    title text NOT NULL,
    dept text,
    order_index integer DEFAULT 0 NOT NULL,
    created_at timestamptz DEFAULT now(),
    icon text,
    page_ids uuid[] DEFAULT '{}'::uuid[],
    tov_text text,
    tab_id uuid
);

CREATE TABLE IF NOT EXISTS public.cities (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    name text NOT NULL,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.collection_items (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    collection_id uuid NOT NULL,
    resource_id uuid NOT NULL,
    order_index integer DEFAULT 0 NOT NULL,
    note text
);

CREATE TABLE IF NOT EXISTS public.collections (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    title text NOT NULL,
    description text,
    cover_emoji text DEFAULT '📁'::text,
    created_by uuid,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.company_bday_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    message text NOT NULL,
    year integer DEFAULT EXTRACT(year FROM now()) NOT NULL,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.course_runs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    course_id uuid NOT NULL,
    title text DEFAULT ''::text NOT NULL,
    start_date date,
    end_date date,
    created_at timestamptz DEFAULT now(),
    start_time time without time zone,
    end_time time without time zone
);

CREATE TABLE IF NOT EXISTS public.course_teachers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    course_id uuid NOT NULL,
    user_id uuid NOT NULL,
    label text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.courses (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    title text NOT NULL,
    description text,
    thumbnail_url text,
    teacher_id uuid,
    category text DEFAULT 'general'::text,
    level text DEFAULT 'beginner'::text,
    duration_hours integer DEFAULT 0,
    is_published boolean DEFAULT false,
    is_featured boolean DEFAULT false,
    slug text,
    tags text[],
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    schedule jsonb DEFAULT '[]'::jsonb,
    course_info jsonb DEFAULT '{}'::jsonb,
    badge_url text
);

CREATE TABLE IF NOT EXISTS public.custom_pages (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    title text NOT NULL,
    html_content text DEFAULT ''::text NOT NULL,
    css_content text DEFAULT ''::text NOT NULL,
    is_published boolean DEFAULT false NOT NULL,
    created_by uuid,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    allowed_labels text[] DEFAULT '{}'::text[] NOT NULL,
    is_home boolean DEFAULT false NOT NULL,
    updated_by uuid,
    search_enabled boolean DEFAULT false NOT NULL
);

CREATE TABLE IF NOT EXISTS public.doc_deadline_reminders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    resource_id uuid NOT NULL,
    user_id uuid NOT NULL,
    notified_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.document_downloads (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    resource_id uuid NOT NULL,
    user_id uuid NOT NULL,
    location_id uuid,
    downloaded_at timestamptz DEFAULT now() NOT NULL,
    is_off_shift boolean DEFAULT false NOT NULL,
    doc_version integer DEFAULT 1 NOT NULL
);

CREATE TABLE IF NOT EXISTS public.dovirenosti (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.enrollments (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    course_id uuid NOT NULL,
    enrolled_at timestamptz DEFAULT now(),
    completed_at timestamptz,
    progress_percentage integer DEFAULT 0,
    run_id uuid
);

CREATE TABLE IF NOT EXISTS public.feedback_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    feedback_id uuid NOT NULL,
    sender_id uuid,
    sender_role text NOT NULL,
    body text NOT NULL,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.feedback_reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    type text DEFAULT 'other'::text NOT NULL,
    priority text DEFAULT 'medium'::text NOT NULL,
    title text,
    message text NOT NULL,
    screenshot_urls text[] DEFAULT '{}'::text[],
    context jsonb DEFAULT '{}'::jsonb,
    status text DEFAULT 'new'::text NOT NULL,
    reply text,
    replied_by uuid,
    replied_at timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    is_deleted boolean DEFAULT false NOT NULL
);

CREATE TABLE IF NOT EXISTS public.intern_disciplines (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    intern_id uuid NOT NULL,
    discipline_name text NOT NULL,
    date date,
    address text,
    mentor_id uuid,
    is_completed boolean DEFAULT false NOT NULL,
    notes text,
    order_index integer DEFAULT 0 NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    hours text,
    place text,
    cabinet text,
    row_type text DEFAULT 'normal'::text NOT NULL
);

CREATE TABLE IF NOT EXISTS public.intern_job_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    job_position text NOT NULL,
    training_days integer DEFAULT 0 NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    position_id uuid
);

CREATE TABLE IF NOT EXISTS public.intern_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    actor_id uuid,
    intern_id uuid,
    action text NOT NULL,
    details jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.intern_schedule_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    job_position text DEFAULT ''::text NOT NULL,
    rows jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    preview_dow smallint DEFAULT 1 NOT NULL
);

CREATE TABLE IF NOT EXISTS public.intern_viewers (
    profile_id uuid NOT NULL,
    granted_by uuid,
    granted_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.interns (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    profile_id uuid,
    manager_id uuid,
    start_date date,
    planned_end_date date,
    actual_end_date date,
    status text DEFAULT 'active'::text NOT NULL,
    status_changed_at timestamptz,
    notes text,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    group_number text,
    profile_snapshot jsonb,
    employment_info jsonb DEFAULT '{}'::jsonb NOT NULL,
    characteristic jsonb DEFAULT '{}'::jsonb NOT NULL,
    mentors_info jsonb DEFAULT '[]'::jsonb NOT NULL,
    praktyka_score text,
    praktyka_dm_score text,
    praktyka_comment text,
    praktyka_dm_comment text,
    position_id uuid
);

CREATE TABLE IF NOT EXISTS public.label_restrictions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    label text NOT NULL,
    section text NOT NULL,
    created_by uuid,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.lecture_enrollments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    lecture_id uuid NOT NULL,
    user_id uuid NOT NULL,
    enrolled_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.lecture_lecturers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    lecture_id uuid NOT NULL,
    profile_id uuid NOT NULL
);

CREATE TABLE IF NOT EXISTS public.lecture_materials (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    lecture_id uuid NOT NULL,
    kind text NOT NULL,
    ref_id uuid NOT NULL,
    note text,
    order_index integer DEFAULT 0 NOT NULL,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.lectures (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    description text,
    cover_image text,
    start_date date NOT NULL,
    duration_days integer DEFAULT 1 NOT NULL,
    is_published boolean DEFAULT true NOT NULL,
    created_by uuid,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    is_recurring boolean DEFAULT false NOT NULL,
    recurrence_parent_id uuid,
    recurrence_interval_weeks integer DEFAULT 1 NOT NULL,
    start_time time without time zone,
    instructions text
);

CREATE TABLE IF NOT EXISTS public.lesson_progress (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    lesson_id uuid NOT NULL,
    completed boolean DEFAULT false,
    time_spent_seconds integer DEFAULT 0,
    last_accessed_at timestamptz DEFAULT now(),
    completed_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.lessons (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    course_id uuid NOT NULL,
    title text NOT NULL,
    description text,
    content text,
    order_index integer DEFAULT 0,
    duration_minutes integer DEFAULT 0,
    is_published boolean DEFAULT false,
    is_free_preview boolean DEFAULT false,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
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
    views integer DEFAULT 0,
    is_published boolean DEFAULT false,
    is_featured boolean DEFAULT false,
    published_at timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    allow_reactions boolean DEFAULT true NOT NULL,
    expires_at timestamptz,
    access_group_id uuid,
    thumbnail_position text DEFAULT 'center'::text
);

CREATE TABLE IF NOT EXISTS public.news_reactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    news_id uuid NOT NULL,
    user_id uuid NOT NULL,
    type text DEFAULT 'emoji'::text NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    emoji text
);

CREATE TABLE IF NOT EXISTS public.news_reads (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    news_id uuid NOT NULL,
    read_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    type text DEFAULT 'general'::text NOT NULL,
    is_read boolean DEFAULT false NOT NULL,
    created_by uuid,
    task_id uuid,
    created_at timestamptz DEFAULT now(),
    read_at timestamptz,
    link text
);

CREATE TABLE IF NOT EXISTS public.page_attachments (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    page_id uuid NOT NULL,
    file_name text NOT NULL,
    storage_path text NOT NULL,
    file_type text,
    file_size bigint,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.page_dovirenosti (
    page_id uuid NOT NULL,
    dovirenost_id uuid NOT NULL
);

CREATE TABLE IF NOT EXISTS public.personal_cal_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    title text NOT NULL,
    date date NOT NULL,
    time time without time zone,
    notes text,
    color text DEFAULT '#6366f1'::text,
    created_at timestamptz DEFAULT now(),
    repeat_type text DEFAULT 'none'::text,
    is_important boolean DEFAULT false,
    is_done boolean DEFAULT false,
    acked_date date,
    end_time time without time zone,
    remind_before_days smallint,
    lecture_id uuid
);

CREATE TABLE IF NOT EXISTS public.personal_cal_viewers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_id uuid NOT NULL,
    viewer_id uuid NOT NULL,
    granted_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.positions (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    name text NOT NULL,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.profile_dovirenosti (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    profile_id uuid NOT NULL,
    dovirenost_id uuid NOT NULL,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid NOT NULL,
    email text NOT NULL,
    full_name text DEFAULT ''::text NOT NULL,
    role text DEFAULT 'user'::text NOT NULL,
    avatar_url text,
    bio text,
    telegram_id text,
    is_active boolean DEFAULT true,
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
    is_hidden boolean DEFAULT false NOT NULL,
    label_set_by text,
    hired_at date,
    position_since date,
    ui_prefs jsonb DEFAULT '{}'::jsonb,
    dismissed_news uuid[] DEFAULT '{}'::uuid[],
    force_logout boolean DEFAULT false,
    last_seen_at timestamptz,
    birth_date_privacy text DEFAULT 'full'::text,
    completed_tours text[] DEFAULT '{}'::text[],
    position_id uuid
);

CREATE TABLE IF NOT EXISTS public.questions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    test_id uuid NOT NULL,
    question_text text DEFAULT ''::text NOT NULL,
    question_type text DEFAULT 'single'::text NOT NULL,
    points integer DEFAULT 1 NOT NULL,
    order_index integer DEFAULT 0,
    explanation text,
    created_at timestamptz DEFAULT now(),
    images text[] DEFAULT '{}'::text[]
);

CREATE TABLE IF NOT EXISTS public.red_folder_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    number integer NOT NULL,
    title text DEFAULT ''::text NOT NULL,
    documents text DEFAULT ''::text,
    responsible text DEFAULT ''::text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    icon text,
    page_id uuid,
    page_ids uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    tov_text text,
    tab_id uuid
);

CREATE TABLE IF NOT EXISTS public.registry_docs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    registry_item_id uuid NOT NULL,
    type text NOT NULL,
    resource_id uuid NOT NULL,
    order_index integer DEFAULT 0 NOT NULL,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.registry_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    topic text NOT NULL,
    order_index integer DEFAULT 0 NOT NULL,
    created_at timestamptz DEFAULT now(),
    section_id uuid
);

CREATE TABLE IF NOT EXISTS public.registry_section_docs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    section_id uuid NOT NULL,
    resource_id uuid NOT NULL,
    order_index integer DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    dovirenost_id uuid
);

CREATE TABLE IF NOT EXISTS public.registry_sections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    order_index integer DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    dovirenost_id uuid,
    description text
);

CREATE TABLE IF NOT EXISTS public.resource_dovirenosti (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    resource_id uuid NOT NULL,
    dovirenost_id uuid NOT NULL,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.resources (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    lesson_id uuid,
    title text NOT NULL,
    type text NOT NULL,
    url text,
    storage_path text,
    file_size bigint,
    duration_seconds integer,
    order_index integer DEFAULT 0,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now(),
    course_id uuid,
    description text,
    file_url text,
    file_type text,
    category text DEFAULT 'general'::text,
    download_allowed boolean DEFAULT true,
    updated_at timestamptz DEFAULT now(),
    created_by uuid,
    access_group_id uuid,
    is_tracked_download boolean DEFAULT false NOT NULL,
    deadline_days integer,
    doc_version integer DEFAULT 1 NOT NULL,
    deleted_at timestamptz,
    deleted_by uuid,
    original_name text,
    display_block text,
    tov_label text,
    dovirenost_id uuid,
    red_folder_item_id uuid,
    tab_id uuid
);

CREATE TABLE IF NOT EXISTS public.rf_tabs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    order_index integer DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    dov_ids uuid[] DEFAULT '{}'::uuid[]
);

CREATE TABLE IF NOT EXISTS public.schedule_assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    location_id uuid,
    user_id uuid,
    created_by uuid,
    created_at timestamptz DEFAULT now(),
    employee_name text,
    original_user_id uuid,
    is_primary boolean DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.schedule_entries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    location_id uuid,
    user_id uuid,
    date date NOT NULL,
    shift_type text DEFAULT 'work'::text NOT NULL,
    shift_start time without time zone,
    shift_end time without time zone,
    notes text,
    updated_by uuid,
    updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.schedule_locations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    created_by uuid,
    created_at timestamptz DEFAULT now(),
    deleted_at timestamptz,
    locked boolean DEFAULT false,
    work_start time without time zone,
    work_end time without time zone,
    locked_months text[] DEFAULT ARRAY[]::text[],
    address text,
    phone text,
    node_type text
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
    changed_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.schedule_partners (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_id uuid,
    partner_id uuid,
    status text DEFAULT 'pending'::text,
    created_at timestamptz DEFAULT now(),
    block_name text
);

CREATE TABLE IF NOT EXISTS public.schedule_shift_config (
    user_id uuid NOT NULL,
    config jsonb DEFAULT '{}'::jsonb NOT NULL,
    updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.schedule_viewers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    location_id uuid,
    granted_by uuid,
    created_at timestamptz DEFAULT now()
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
    updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.scorm_packages (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    resource_id uuid,
    manifest_path text DEFAULT 'imsmanifest.xml'::text NOT NULL,
    entry_point text NOT NULL,
    scorm_version text DEFAULT '2004'::text,
    title text,
    description text,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.scorm_progress (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    scorm_package_id uuid NOT NULL,
    completion_status text DEFAULT 'not attempted'::text,
    success_status text DEFAULT 'unknown'::text,
    progress_measure numeric(5,4) DEFAULT 0,
    score_raw numeric(10,2),
    score_min numeric(10,2) DEFAULT 0,
    score_max numeric(10,2) DEFAULT 100,
    score_scaled numeric(5,4),
    total_time_seconds integer DEFAULT 0,
    session_time_seconds integer DEFAULT 0,
    suspend_data text,
    location text,
    interactions jsonb DEFAULT '[]'::jsonb,
    objectives jsonb DEFAULT '[]'::jsonb,
    updated_at timestamptz DEFAULT now(),
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.subdivisions (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    name text NOT NULL,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.survey_answers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    response_id uuid NOT NULL,
    question_id uuid NOT NULL,
    value text,
    selected_options jsonb DEFAULT '[]'::jsonb
);

CREATE TABLE IF NOT EXISTS public.survey_assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    survey_id uuid NOT NULL,
    user_id uuid NOT NULL,
    assigned_by uuid,
    deadline_at timestamptz,
    created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.survey_questions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    survey_id uuid NOT NULL,
    text text NOT NULL,
    type text NOT NULL,
    options jsonb DEFAULT '[]'::jsonb,
    is_required boolean DEFAULT true NOT NULL,
    order_index integer DEFAULT 0 NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    image_url text
);

CREATE TABLE IF NOT EXISTS public.survey_responses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    survey_id uuid NOT NULL,
    user_id uuid,
    session_id text,
    submitted_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.surveys (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    description text,
    created_by uuid,
    is_published boolean DEFAULT false NOT NULL,
    is_anonymous boolean DEFAULT false NOT NULL,
    deadline_at timestamptz,
    access_group_id uuid,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.test_assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    test_id uuid NOT NULL,
    user_id uuid NOT NULL,
    assigned_by uuid,
    deadline_at timestamptz,
    created_at timestamptz DEFAULT now(),
    group_id uuid
);

CREATE TABLE IF NOT EXISTS public.test_attempt_grants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    test_id uuid NOT NULL,
    user_id uuid NOT NULL,
    granted_by uuid NOT NULL,
    granted_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.test_attempts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    test_id uuid NOT NULL,
    user_id uuid NOT NULL,
    attempt_number integer DEFAULT 1,
    score numeric DEFAULT 0,
    max_score numeric DEFAULT 0,
    percentage numeric DEFAULT 0,
    passed boolean DEFAULT false,
    time_spent_seconds integer,
    started_at timestamptz DEFAULT now(),
    completed_at timestamptz,
    run_id uuid,
    needs_review boolean DEFAULT false NOT NULL,
    reviewed_by uuid,
    reviewed_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.test_group_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    group_id uuid NOT NULL,
    test_id uuid NOT NULL,
    order_index integer DEFAULT 0 NOT NULL,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.test_groups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    description text,
    cover_image text,
    is_sequential boolean DEFAULT true NOT NULL,
    created_by uuid,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    course_id uuid,
    title text NOT NULL,
    description text,
    instructions text,
    passing_score integer DEFAULT 70 NOT NULL,
    max_attempts integer DEFAULT 3,
    time_limit_minutes integer,
    order_index integer DEFAULT 0,
    is_published boolean DEFAULT false,
    randomize_questions boolean DEFAULT false,
    show_results boolean DEFAULT true,
    created_by uuid,
    created_at timestamptz DEFAULT now(),
    auto_assign_positions text[] DEFAULT '{}'::text[],
    cover_image text,
    allow_back_navigation boolean DEFAULT false,
    allow_restart boolean DEFAULT false,
    show_answer_feedback boolean DEFAULT false,
    show_wrong_answers boolean DEFAULT false,
    allow_skip boolean DEFAULT false,
    intern_category text,
    stretch_cover_image boolean DEFAULT false NOT NULL,
    grant_attempt_on_reassign boolean DEFAULT false NOT NULL
);

CREATE TABLE IF NOT EXISTS public.trash (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    type text NOT NULL,
    item_id uuid NOT NULL,
    item_data jsonb NOT NULL,
    deleted_by uuid,
    deleted_at timestamptz DEFAULT now() NOT NULL,
    expires_at timestamptz DEFAULT (now() + '7 days'::interval) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.trusted_ips (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ip text NOT NULL,
    label text,
    created_by uuid,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_login_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    started_at timestamptz DEFAULT now() NOT NULL,
    ended_at timestamptz,
    ua text,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_nav_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    from_route text,
    to_route text NOT NULL,
    session_id uuid,
    ts timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_token text NOT NULL,
    user_id uuid,
    user_agent text,
    last_seen_at timestamptz DEFAULT now(),
    created_at timestamptz DEFAULT now()
);

-- ── Constraints ──────────────────────────────────────────────
ALTER TABLE access_group_cities ADD CONSTRAINT access_group_cities_group_id_fkey FOREIGN KEY (group_id) REFERENCES access_groups(id) ON DELETE CASCADE;
ALTER TABLE access_group_cities ADD CONSTRAINT access_group_cities_pkey PRIMARY KEY (group_id, city);
ALTER TABLE access_group_departments ADD CONSTRAINT access_group_departments_group_id_fkey FOREIGN KEY (group_id) REFERENCES access_groups(id) ON DELETE CASCADE;
ALTER TABLE access_group_departments ADD CONSTRAINT access_group_departments_pkey PRIMARY KEY (group_id, department);
ALTER TABLE access_group_labels ADD CONSTRAINT access_group_labels_group_id_fkey FOREIGN KEY (group_id) REFERENCES access_groups(id) ON DELETE CASCADE;
ALTER TABLE access_group_labels ADD CONSTRAINT access_group_labels_pkey PRIMARY KEY (group_id, label);
ALTER TABLE access_group_positions ADD CONSTRAINT access_group_positions_group_id_fkey FOREIGN KEY (group_id) REFERENCES access_groups(id) ON DELETE CASCADE;
ALTER TABLE access_group_positions ADD CONSTRAINT access_group_positions_pkey PRIMARY KEY (group_id, "position");
ALTER TABLE access_groups ADD CONSTRAINT access_groups_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE access_groups ADD CONSTRAINT access_groups_pkey PRIMARY KEY (id);
ALTER TABLE activity_log ADD CONSTRAINT activity_log_pkey PRIMARY KEY (id);
ALTER TABLE activity_log ADD CONSTRAINT activity_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE activity_logs ADD CONSTRAINT activity_logs_pkey PRIMARY KEY (id);
ALTER TABLE activity_logs ADD CONSTRAINT activity_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE answers ADD CONSTRAINT answers_pkey PRIMARY KEY (id);
ALTER TABLE answers ADD CONSTRAINT answers_question_id_fkey FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE;
ALTER TABLE assistant_logs ADD CONSTRAINT assistant_logs_pkey PRIMARY KEY (id);
ALTER TABLE assistant_logs ADD CONSTRAINT assistant_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE attempt_answers ADD CONSTRAINT attempt_answers_attempt_id_fkey FOREIGN KEY (attempt_id) REFERENCES test_attempts(id) ON DELETE CASCADE;
ALTER TABLE attempt_answers ADD CONSTRAINT attempt_answers_pkey PRIMARY KEY (id);
ALTER TABLE attempt_answers ADD CONSTRAINT attempt_answers_question_id_fkey FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE;
ALTER TABLE bd_tabs ADD CONSTRAINT bd_tabs_pkey PRIMARY KEY (id);
ALTER TABLE birthday_reminders ADD CONSTRAINT birthday_reminders_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE birthday_reminders ADD CONSTRAINT birthday_reminders_created_by_target_id_key UNIQUE (created_by, target_id);
ALTER TABLE birthday_reminders ADD CONSTRAINT birthday_reminders_pkey PRIMARY KEY (id);
ALTER TABLE birthday_reminders ADD CONSTRAINT birthday_reminders_target_id_fkey FOREIGN KEY (target_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE bookmarks ADD CONSTRAINT bookmarks_pkey PRIMARY KEY (id);
ALTER TABLE bookmarks ADD CONSTRAINT bookmarks_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE bookmarks ADD CONSTRAINT bookmarks_user_id_route_key UNIQUE (user_id, route);
ALTER TABLE branch_doc_blocks ADD CONSTRAINT branch_doc_blocks_number_key UNIQUE (number);
ALTER TABLE branch_doc_blocks ADD CONSTRAINT branch_doc_blocks_pkey PRIMARY KEY (id);
ALTER TABLE branch_doc_blocks ADD CONSTRAINT branch_doc_blocks_tab_id_fkey FOREIGN KEY (tab_id) REFERENCES bd_tabs(id) ON DELETE SET NULL;
ALTER TABLE cities ADD CONSTRAINT cities_name_key UNIQUE (name);
ALTER TABLE cities ADD CONSTRAINT cities_pkey PRIMARY KEY (id);
ALTER TABLE collection_items ADD CONSTRAINT collection_items_collection_id_fkey FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE;
ALTER TABLE collection_items ADD CONSTRAINT collection_items_collection_id_resource_id_key UNIQUE (collection_id, resource_id);
ALTER TABLE collection_items ADD CONSTRAINT collection_items_pkey PRIMARY KEY (id);
ALTER TABLE collection_items ADD CONSTRAINT collection_items_resource_id_fkey FOREIGN KEY (resource_id) REFERENCES resources(id) ON DELETE CASCADE;
ALTER TABLE collections ADD CONSTRAINT collections_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE collections ADD CONSTRAINT collections_pkey PRIMARY KEY (id);
ALTER TABLE company_bday_messages ADD CONSTRAINT company_bday_messages_message_check CHECK (((char_length(message) >= 1) AND (char_length(message) <= 500)));
ALTER TABLE company_bday_messages ADD CONSTRAINT company_bday_messages_pkey PRIMARY KEY (id);
ALTER TABLE company_bday_messages ADD CONSTRAINT company_bday_messages_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE course_runs ADD CONSTRAINT course_runs_course_id_fkey FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE;
ALTER TABLE course_runs ADD CONSTRAINT course_runs_pkey PRIMARY KEY (id);
ALTER TABLE course_teachers ADD CONSTRAINT course_teachers_course_id_fkey FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE;
ALTER TABLE course_teachers ADD CONSTRAINT course_teachers_course_id_user_id_key UNIQUE (course_id, user_id);
ALTER TABLE course_teachers ADD CONSTRAINT course_teachers_pkey PRIMARY KEY (id);
ALTER TABLE course_teachers ADD CONSTRAINT course_teachers_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE courses ADD CONSTRAINT courses_level_check CHECK ((level = ANY (ARRAY['beginner'::text, 'intermediate'::text, 'advanced'::text])));
ALTER TABLE courses ADD CONSTRAINT courses_pkey PRIMARY KEY (id);
ALTER TABLE courses ADD CONSTRAINT courses_slug_key UNIQUE (slug);
ALTER TABLE courses ADD CONSTRAINT courses_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE custom_pages ADD CONSTRAINT custom_pages_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE custom_pages ADD CONSTRAINT custom_pages_pkey PRIMARY KEY (id);
ALTER TABLE custom_pages ADD CONSTRAINT custom_pages_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE doc_deadline_reminders ADD CONSTRAINT doc_deadline_reminders_pkey PRIMARY KEY (id);
ALTER TABLE doc_deadline_reminders ADD CONSTRAINT doc_deadline_reminders_resource_id_fkey FOREIGN KEY (resource_id) REFERENCES resources(id) ON DELETE CASCADE;
ALTER TABLE doc_deadline_reminders ADD CONSTRAINT doc_deadline_reminders_resource_id_user_id_key UNIQUE (resource_id, user_id);
ALTER TABLE doc_deadline_reminders ADD CONSTRAINT doc_deadline_reminders_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE document_downloads ADD CONSTRAINT document_downloads_location_id_fkey FOREIGN KEY (location_id) REFERENCES schedule_locations(id) ON DELETE SET NULL;
ALTER TABLE document_downloads ADD CONSTRAINT document_downloads_pkey PRIMARY KEY (id);
ALTER TABLE document_downloads ADD CONSTRAINT document_downloads_resource_id_fkey FOREIGN KEY (resource_id) REFERENCES resources(id) ON DELETE CASCADE;
ALTER TABLE document_downloads ADD CONSTRAINT document_downloads_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE dovirenosti ADD CONSTRAINT dovirenosti_name_key UNIQUE (name);
ALTER TABLE dovirenosti ADD CONSTRAINT dovirenosti_pkey PRIMARY KEY (id);
ALTER TABLE enrollments ADD CONSTRAINT enrollments_course_id_fkey FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE;
ALTER TABLE enrollments ADD CONSTRAINT enrollments_pkey PRIMARY KEY (id);
ALTER TABLE enrollments ADD CONSTRAINT enrollments_run_id_fkey FOREIGN KEY (run_id) REFERENCES course_runs(id) ON DELETE SET NULL;
ALTER TABLE enrollments ADD CONSTRAINT enrollments_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE feedback_messages ADD CONSTRAINT feedback_messages_feedback_id_fkey FOREIGN KEY (feedback_id) REFERENCES feedback_reports(id) ON DELETE CASCADE;
ALTER TABLE feedback_messages ADD CONSTRAINT feedback_messages_pkey PRIMARY KEY (id);
ALTER TABLE feedback_messages ADD CONSTRAINT feedback_messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE feedback_messages ADD CONSTRAINT feedback_messages_sender_role_check CHECK ((sender_role = ANY (ARRAY['user'::text, 'admin'::text])));
ALTER TABLE feedback_reports ADD CONSTRAINT feedback_reports_pkey PRIMARY KEY (id);
ALTER TABLE feedback_reports ADD CONSTRAINT feedback_reports_priority_check CHECK ((priority = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'urgent'::text])));
ALTER TABLE feedback_reports ADD CONSTRAINT feedback_reports_replied_by_fkey FOREIGN KEY (replied_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE feedback_reports ADD CONSTRAINT feedback_reports_status_check CHECK ((status = ANY (ARRAY['new'::text, 'seen'::text, 'in_progress'::text, 'resolved'::text])));
ALTER TABLE feedback_reports ADD CONSTRAINT feedback_reports_type_check CHECK ((type = ANY (ARRAY['bug'::text, 'suggestion'::text, 'question'::text, 'other'::text])));
ALTER TABLE feedback_reports ADD CONSTRAINT feedback_reports_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE intern_disciplines ADD CONSTRAINT intern_disciplines_intern_id_fkey FOREIGN KEY (intern_id) REFERENCES interns(id) ON DELETE CASCADE;
ALTER TABLE intern_disciplines ADD CONSTRAINT intern_disciplines_mentor_id_fkey FOREIGN KEY (mentor_id) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE intern_disciplines ADD CONSTRAINT intern_disciplines_pkey PRIMARY KEY (id);
ALTER TABLE intern_job_settings ADD CONSTRAINT intern_job_settings_days_chk CHECK ((training_days >= 0));
ALTER TABLE intern_job_settings ADD CONSTRAINT intern_job_settings_pkey PRIMARY KEY (id);
ALTER TABLE intern_job_settings ADD CONSTRAINT intern_job_settings_pos_uq UNIQUE (job_position);
ALTER TABLE intern_job_settings ADD CONSTRAINT intern_job_settings_position_id_fkey FOREIGN KEY (position_id) REFERENCES positions(id) ON DELETE SET NULL;
ALTER TABLE intern_logs ADD CONSTRAINT intern_logs_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE intern_logs ADD CONSTRAINT intern_logs_intern_id_fkey FOREIGN KEY (intern_id) REFERENCES interns(id) ON DELETE CASCADE;
ALTER TABLE intern_logs ADD CONSTRAINT intern_logs_pkey PRIMARY KEY (id);
ALTER TABLE intern_schedule_templates ADD CONSTRAINT intern_schedule_templates_pkey PRIMARY KEY (id);
ALTER TABLE intern_schedule_templates ADD CONSTRAINT intern_schedule_templates_preview_dow_check CHECK (((preview_dow >= 0) AND (preview_dow <= 6)));
ALTER TABLE intern_viewers ADD CONSTRAINT intern_viewers_granted_by_fkey FOREIGN KEY (granted_by) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE intern_viewers ADD CONSTRAINT intern_viewers_pkey PRIMARY KEY (profile_id);
ALTER TABLE intern_viewers ADD CONSTRAINT intern_viewers_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE interns ADD CONSTRAINT interns_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE interns ADD CONSTRAINT interns_pkey PRIMARY KEY (id);
ALTER TABLE interns ADD CONSTRAINT interns_position_id_fkey FOREIGN KEY (position_id) REFERENCES positions(id) ON DELETE SET NULL;
ALTER TABLE interns ADD CONSTRAINT interns_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE interns ADD CONSTRAINT interns_status_check CHECK ((status = ANY (ARRAY['active'::text, 'completed'::text, 'dropped'::text])));
ALTER TABLE label_restrictions ADD CONSTRAINT label_restrictions_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);
ALTER TABLE label_restrictions ADD CONSTRAINT label_restrictions_label_section_key UNIQUE (label, section);
ALTER TABLE label_restrictions ADD CONSTRAINT label_restrictions_pkey PRIMARY KEY (id);
ALTER TABLE lecture_enrollments ADD CONSTRAINT lecture_enrollments_lecture_id_fkey FOREIGN KEY (lecture_id) REFERENCES lectures(id) ON DELETE CASCADE;
ALTER TABLE lecture_enrollments ADD CONSTRAINT lecture_enrollments_lecture_id_user_id_key UNIQUE (lecture_id, user_id);
ALTER TABLE lecture_enrollments ADD CONSTRAINT lecture_enrollments_pkey PRIMARY KEY (id);
ALTER TABLE lecture_enrollments ADD CONSTRAINT lecture_enrollments_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE lecture_enrollments ADD CONSTRAINT lecture_enrollments_user_id_profiles_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE lecture_lecturers ADD CONSTRAINT lecture_lecturers_lecture_id_fkey FOREIGN KEY (lecture_id) REFERENCES lectures(id) ON DELETE CASCADE;
ALTER TABLE lecture_lecturers ADD CONSTRAINT lecture_lecturers_lecture_id_profile_id_key UNIQUE (lecture_id, profile_id);
ALTER TABLE lecture_lecturers ADD CONSTRAINT lecture_lecturers_pkey PRIMARY KEY (id);
ALTER TABLE lecture_lecturers ADD CONSTRAINT lecture_lecturers_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE lecture_materials ADD CONSTRAINT lecture_materials_kind_check CHECK ((kind = ANY (ARRAY['test'::text, 'test_group'::text, 'course'::text, 'resource'::text])));
ALTER TABLE lecture_materials ADD CONSTRAINT lecture_materials_lecture_id_fkey FOREIGN KEY (lecture_id) REFERENCES lectures(id) ON DELETE CASCADE;
ALTER TABLE lecture_materials ADD CONSTRAINT lecture_materials_pkey PRIMARY KEY (id);
ALTER TABLE lectures ADD CONSTRAINT lectures_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE lectures ADD CONSTRAINT lectures_pkey PRIMARY KEY (id);
ALTER TABLE lectures ADD CONSTRAINT lectures_recurrence_parent_id_fkey FOREIGN KEY (recurrence_parent_id) REFERENCES lectures(id) ON DELETE SET NULL;
ALTER TABLE lesson_progress ADD CONSTRAINT lesson_progress_lesson_id_fkey FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE;
ALTER TABLE lesson_progress ADD CONSTRAINT lesson_progress_pkey PRIMARY KEY (id);
ALTER TABLE lesson_progress ADD CONSTRAINT lesson_progress_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE lesson_progress ADD CONSTRAINT lesson_progress_user_id_lesson_id_key UNIQUE (user_id, lesson_id);
ALTER TABLE lessons ADD CONSTRAINT lessons_course_id_fkey FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE;
ALTER TABLE lessons ADD CONSTRAINT lessons_pkey PRIMARY KEY (id);
ALTER TABLE news ADD CONSTRAINT news_access_group_id_fkey FOREIGN KEY (access_group_id) REFERENCES access_groups(id) ON DELETE SET NULL;
ALTER TABLE news ADD CONSTRAINT news_author_id_fkey FOREIGN KEY (author_id) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE news ADD CONSTRAINT news_pkey PRIMARY KEY (id);
ALTER TABLE news ADD CONSTRAINT news_slug_key UNIQUE (slug);
ALTER TABLE news_reactions ADD CONSTRAINT news_reactions_news_id_fkey FOREIGN KEY (news_id) REFERENCES news(id) ON DELETE CASCADE;
ALTER TABLE news_reactions ADD CONSTRAINT news_reactions_news_id_user_id_key UNIQUE (news_id, user_id);
ALTER TABLE news_reactions ADD CONSTRAINT news_reactions_pkey PRIMARY KEY (id);
ALTER TABLE news_reactions ADD CONSTRAINT news_reactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE news_reads ADD CONSTRAINT news_reads_news_id_fkey FOREIGN KEY (news_id) REFERENCES news(id) ON DELETE CASCADE;
ALTER TABLE news_reads ADD CONSTRAINT news_reads_pkey PRIMARY KEY (id);
ALTER TABLE news_reads ADD CONSTRAINT news_reads_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE news_reads ADD CONSTRAINT news_reads_user_id_news_id_key UNIQUE (user_id, news_id);
ALTER TABLE notifications ADD CONSTRAINT notifications_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE notifications ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);
ALTER TABLE notifications ADD CONSTRAINT notifications_task_id_fkey FOREIGN KEY (task_id) REFERENCES scheduled_notifications(id) ON DELETE SET NULL;
ALTER TABLE notifications ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE page_attachments ADD CONSTRAINT page_attachments_page_id_fkey FOREIGN KEY (page_id) REFERENCES custom_pages(id) ON DELETE CASCADE;
ALTER TABLE page_attachments ADD CONSTRAINT page_attachments_pkey PRIMARY KEY (id);
ALTER TABLE page_dovirenosti ADD CONSTRAINT page_dovirenosti_dovirenost_id_fkey FOREIGN KEY (dovirenost_id) REFERENCES dovirenosti(id) ON DELETE CASCADE;
ALTER TABLE page_dovirenosti ADD CONSTRAINT page_dovirenosti_page_id_fkey FOREIGN KEY (page_id) REFERENCES custom_pages(id) ON DELETE CASCADE;
ALTER TABLE page_dovirenosti ADD CONSTRAINT page_dovirenosti_pkey PRIMARY KEY (page_id, dovirenost_id);
ALTER TABLE personal_cal_events ADD CONSTRAINT personal_cal_events_lecture_id_fkey FOREIGN KEY (lecture_id) REFERENCES lectures(id) ON DELETE CASCADE;
ALTER TABLE personal_cal_events ADD CONSTRAINT personal_cal_events_pkey PRIMARY KEY (id);
ALTER TABLE personal_cal_events ADD CONSTRAINT personal_cal_events_remind_before_days_check CHECK (((remind_before_days IS NULL) OR (remind_before_days = ANY (ARRAY[1, 2]))));
ALTER TABLE personal_cal_events ADD CONSTRAINT personal_cal_events_repeat_type_check CHECK ((repeat_type = ANY (ARRAY['none'::text, 'weekly'::text, 'monthly'::text])));
ALTER TABLE personal_cal_events ADD CONSTRAINT personal_cal_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE personal_cal_viewers ADD CONSTRAINT personal_cal_viewers_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE personal_cal_viewers ADD CONSTRAINT personal_cal_viewers_owner_id_viewer_id_key UNIQUE (owner_id, viewer_id);
ALTER TABLE personal_cal_viewers ADD CONSTRAINT personal_cal_viewers_pkey PRIMARY KEY (id);
ALTER TABLE personal_cal_viewers ADD CONSTRAINT personal_cal_viewers_viewer_id_fkey FOREIGN KEY (viewer_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE positions ADD CONSTRAINT positions_name_key UNIQUE (name);
ALTER TABLE positions ADD CONSTRAINT positions_pkey PRIMARY KEY (id);
ALTER TABLE profile_dovirenosti ADD CONSTRAINT profile_dovirenosti_dovirenost_id_fkey FOREIGN KEY (dovirenost_id) REFERENCES dovirenosti(id) ON DELETE CASCADE;
ALTER TABLE profile_dovirenosti ADD CONSTRAINT profile_dovirenosti_pkey PRIMARY KEY (id);
ALTER TABLE profile_dovirenosti ADD CONSTRAINT profile_dovirenosti_profile_id_dovirenost_id_key UNIQUE (profile_id, dovirenost_id);
ALTER TABLE profile_dovirenosti ADD CONSTRAINT profile_dovirenosti_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE profiles ADD CONSTRAINT profiles_birth_date_privacy_check CHECK ((birth_date_privacy = ANY (ARRAY['full'::text, 'no_year'::text, 'hidden'::text])));
ALTER TABLE profiles ADD CONSTRAINT profiles_email_key UNIQUE (email);
ALTER TABLE profiles ADD CONSTRAINT profiles_gender_check CHECK ((gender = ANY (ARRAY['male'::text, 'female'::text, 'other'::text])));
ALTER TABLE profiles ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE profiles ADD CONSTRAINT profiles_login_key UNIQUE (login);
ALTER TABLE profiles ADD CONSTRAINT profiles_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE profiles ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);
ALTER TABLE profiles ADD CONSTRAINT profiles_position_id_fkey FOREIGN KEY (position_id) REFERENCES positions(id) ON DELETE SET NULL;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check CHECK ((role = ANY (ARRAY['owner'::text, 'admin'::text, 'smm'::text, 'teacher'::text, 'manager'::text, 'user'::text, 'intern'::text, 'student'::text, 'ceo'::text])));
ALTER TABLE questions ADD CONSTRAINT questions_pkey PRIMARY KEY (id);
ALTER TABLE questions ADD CONSTRAINT questions_test_id_fkey FOREIGN KEY (test_id) REFERENCES tests(id) ON DELETE CASCADE;
ALTER TABLE red_folder_items ADD CONSTRAINT red_folder_items_page_id_fkey FOREIGN KEY (page_id) REFERENCES custom_pages(id) ON DELETE SET NULL;
ALTER TABLE red_folder_items ADD CONSTRAINT red_folder_items_pkey PRIMARY KEY (id);
ALTER TABLE red_folder_items ADD CONSTRAINT red_folder_items_tab_id_fkey FOREIGN KEY (tab_id) REFERENCES rf_tabs(id) ON DELETE SET NULL;
ALTER TABLE registry_docs ADD CONSTRAINT registry_docs_pkey PRIMARY KEY (id);
ALTER TABLE registry_docs ADD CONSTRAINT registry_docs_registry_item_id_fkey FOREIGN KEY (registry_item_id) REFERENCES registry_items(id) ON DELETE CASCADE;
ALTER TABLE registry_docs ADD CONSTRAINT registry_docs_resource_id_fkey FOREIGN KEY (resource_id) REFERENCES resources(id) ON DELETE CASCADE;
ALTER TABLE registry_docs ADD CONSTRAINT registry_docs_type_check CHECK ((type = ANY (ARRAY['order'::text, 'disposition'::text])));
ALTER TABLE registry_items ADD CONSTRAINT registry_items_pkey PRIMARY KEY (id);
ALTER TABLE registry_items ADD CONSTRAINT registry_items_section_id_fkey FOREIGN KEY (section_id) REFERENCES registry_sections(id) ON DELETE SET NULL;
ALTER TABLE registry_section_docs ADD CONSTRAINT registry_section_docs_dovirenost_id_fkey FOREIGN KEY (dovirenost_id) REFERENCES dovirenosti(id) ON DELETE SET NULL;
ALTER TABLE registry_section_docs ADD CONSTRAINT registry_section_docs_pkey PRIMARY KEY (id);
ALTER TABLE registry_section_docs ADD CONSTRAINT registry_section_docs_resource_id_fkey FOREIGN KEY (resource_id) REFERENCES resources(id) ON DELETE CASCADE;
ALTER TABLE registry_section_docs ADD CONSTRAINT registry_section_docs_section_id_fkey FOREIGN KEY (section_id) REFERENCES registry_sections(id) ON DELETE CASCADE;
ALTER TABLE registry_section_docs ADD CONSTRAINT registry_section_docs_section_id_resource_id_key UNIQUE (section_id, resource_id);
ALTER TABLE registry_sections ADD CONSTRAINT registry_sections_dovirenost_id_fkey FOREIGN KEY (dovirenost_id) REFERENCES dovirenosti(id) ON DELETE SET NULL;
ALTER TABLE registry_sections ADD CONSTRAINT registry_sections_pkey PRIMARY KEY (id);
ALTER TABLE resource_dovirenosti ADD CONSTRAINT resource_dovirenosti_dovirenost_id_fkey FOREIGN KEY (dovirenost_id) REFERENCES dovirenosti(id) ON DELETE CASCADE;
ALTER TABLE resource_dovirenosti ADD CONSTRAINT resource_dovirenosti_pkey PRIMARY KEY (id);
ALTER TABLE resource_dovirenosti ADD CONSTRAINT resource_dovirenosti_resource_id_dovirenost_id_key UNIQUE (resource_id, dovirenost_id);
ALTER TABLE resource_dovirenosti ADD CONSTRAINT resource_dovirenosti_resource_id_fkey FOREIGN KEY (resource_id) REFERENCES resources(id) ON DELETE CASCADE;
ALTER TABLE resources ADD CONSTRAINT resources_access_group_id_fkey FOREIGN KEY (access_group_id) REFERENCES access_groups(id) ON DELETE SET NULL;
ALTER TABLE resources ADD CONSTRAINT resources_course_id_fkey FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL;
ALTER TABLE resources ADD CONSTRAINT resources_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE resources ADD CONSTRAINT resources_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE resources ADD CONSTRAINT resources_dovirenost_id_fkey FOREIGN KEY (dovirenost_id) REFERENCES dovirenosti(id) ON DELETE SET NULL;
ALTER TABLE resources ADD CONSTRAINT resources_lesson_id_fkey FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE;
ALTER TABLE resources ADD CONSTRAINT resources_pkey PRIMARY KEY (id);
ALTER TABLE resources ADD CONSTRAINT resources_red_folder_item_id_fkey FOREIGN KEY (red_folder_item_id) REFERENCES red_folder_items(id) ON DELETE SET NULL;
ALTER TABLE resources ADD CONSTRAINT resources_tab_id_fkey FOREIGN KEY (tab_id) REFERENCES rf_tabs(id) ON DELETE SET NULL;
ALTER TABLE resources ADD CONSTRAINT resources_type_check CHECK ((type = ANY (ARRAY['pdf'::text, 'video'::text, 'link'::text, 'scorm'::text, 'file'::text, 'image'::text, 'document'::text])));
ALTER TABLE rf_tabs ADD CONSTRAINT rf_tabs_pkey PRIMARY KEY (id);
ALTER TABLE schedule_assignments ADD CONSTRAINT schedule_assignments_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);
ALTER TABLE schedule_assignments ADD CONSTRAINT schedule_assignments_location_id_fkey FOREIGN KEY (location_id) REFERENCES schedule_locations(id) ON DELETE CASCADE;
ALTER TABLE schedule_assignments ADD CONSTRAINT schedule_assignments_location_id_user_id_key UNIQUE (location_id, user_id);
ALTER TABLE schedule_assignments ADD CONSTRAINT schedule_assignments_pkey PRIMARY KEY (id);
ALTER TABLE schedule_assignments ADD CONSTRAINT schedule_assignments_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE schedule_entries ADD CONSTRAINT schedule_entries_location_id_fkey FOREIGN KEY (location_id) REFERENCES schedule_locations(id) ON DELETE CASCADE;
ALTER TABLE schedule_entries ADD CONSTRAINT schedule_entries_location_id_user_id_date_key UNIQUE (location_id, user_id, date);
ALTER TABLE schedule_entries ADD CONSTRAINT schedule_entries_pkey PRIMARY KEY (id);
ALTER TABLE schedule_entries ADD CONSTRAINT schedule_entries_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id);
ALTER TABLE schedule_locations ADD CONSTRAINT schedule_locations_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);
ALTER TABLE schedule_locations ADD CONSTRAINT schedule_locations_node_type_check CHECK ((node_type = ANY (ARRAY['universal'::text, 'technical'::text, 'gold'::text, 'universal_seller'::text, 'technical_seller'::text])));
ALTER TABLE schedule_locations ADD CONSTRAINT schedule_locations_pkey PRIMARY KEY (id);
ALTER TABLE schedule_log ADD CONSTRAINT schedule_log_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES auth.users(id);
ALTER TABLE schedule_log ADD CONSTRAINT schedule_log_pkey PRIMARY KEY (id);
ALTER TABLE schedule_partners ADD CONSTRAINT schedule_partners_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE schedule_partners ADD CONSTRAINT schedule_partners_owner_id_partner_id_key UNIQUE (owner_id, partner_id);
ALTER TABLE schedule_partners ADD CONSTRAINT schedule_partners_partner_id_fkey FOREIGN KEY (partner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE schedule_partners ADD CONSTRAINT schedule_partners_pkey PRIMARY KEY (id);
ALTER TABLE schedule_shift_config ADD CONSTRAINT schedule_shift_config_pkey PRIMARY KEY (user_id);
ALTER TABLE schedule_shift_config ADD CONSTRAINT schedule_shift_config_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE schedule_viewers ADD CONSTRAINT schedule_viewers_granted_by_fkey FOREIGN KEY (granted_by) REFERENCES auth.users(id);
ALTER TABLE schedule_viewers ADD CONSTRAINT schedule_viewers_location_id_fkey FOREIGN KEY (location_id) REFERENCES schedule_locations(id) ON DELETE CASCADE;
ALTER TABLE schedule_viewers ADD CONSTRAINT schedule_viewers_pkey PRIMARY KEY (id);
ALTER TABLE schedule_viewers ADD CONSTRAINT schedule_viewers_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE scheduled_notifications ADD CONSTRAINT scheduled_notifications_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE scheduled_notifications ADD CONSTRAINT scheduled_notifications_pkey PRIMARY KEY (id);
ALTER TABLE scheduled_notifications ADD CONSTRAINT scheduled_notifications_repeat_type_check CHECK ((repeat_type = ANY (ARRAY['none'::text, 'daily'::text, 'weekly'::text])));
ALTER TABLE scheduled_notifications ADD CONSTRAINT scheduled_notifications_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'sent'::text, 'cancelled'::text])));
ALTER TABLE scheduled_notifications ADD CONSTRAINT scheduled_notifications_type_check CHECK ((type = ANY (ARRAY['gold'::text, 'tech'::text, 'general'::text])));
ALTER TABLE scorm_packages ADD CONSTRAINT scorm_packages_pkey PRIMARY KEY (id);
ALTER TABLE scorm_packages ADD CONSTRAINT scorm_packages_resource_id_fkey FOREIGN KEY (resource_id) REFERENCES resources(id) ON DELETE CASCADE;
ALTER TABLE scorm_packages ADD CONSTRAINT scorm_packages_resource_id_key UNIQUE (resource_id);
ALTER TABLE scorm_progress ADD CONSTRAINT scorm_progress_completion_status_check CHECK ((completion_status = ANY (ARRAY['not attempted'::text, 'incomplete'::text, 'completed'::text, 'unknown'::text])));
ALTER TABLE scorm_progress ADD CONSTRAINT scorm_progress_pkey PRIMARY KEY (id);
ALTER TABLE scorm_progress ADD CONSTRAINT scorm_progress_progress_measure_check CHECK (((progress_measure >= (0)::numeric) AND (progress_measure <= (1)::numeric)));
ALTER TABLE scorm_progress ADD CONSTRAINT scorm_progress_scorm_package_id_fkey FOREIGN KEY (scorm_package_id) REFERENCES scorm_packages(id) ON DELETE CASCADE;
ALTER TABLE scorm_progress ADD CONSTRAINT scorm_progress_success_status_check CHECK ((success_status = ANY (ARRAY['passed'::text, 'failed'::text, 'unknown'::text])));
ALTER TABLE scorm_progress ADD CONSTRAINT scorm_progress_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE scorm_progress ADD CONSTRAINT scorm_progress_user_id_scorm_package_id_key UNIQUE (user_id, scorm_package_id);
ALTER TABLE subdivisions ADD CONSTRAINT subdivisions_name_key UNIQUE (name);
ALTER TABLE subdivisions ADD CONSTRAINT subdivisions_pkey PRIMARY KEY (id);
ALTER TABLE survey_answers ADD CONSTRAINT survey_answers_pkey PRIMARY KEY (id);
ALTER TABLE survey_answers ADD CONSTRAINT survey_answers_question_id_fkey FOREIGN KEY (question_id) REFERENCES survey_questions(id) ON DELETE CASCADE;
ALTER TABLE survey_answers ADD CONSTRAINT survey_answers_response_id_fkey FOREIGN KEY (response_id) REFERENCES survey_responses(id) ON DELETE CASCADE;
ALTER TABLE survey_assignments ADD CONSTRAINT survey_assignments_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE survey_assignments ADD CONSTRAINT survey_assignments_pkey PRIMARY KEY (id);
ALTER TABLE survey_assignments ADD CONSTRAINT survey_assignments_survey_id_fkey FOREIGN KEY (survey_id) REFERENCES surveys(id) ON DELETE CASCADE;
ALTER TABLE survey_assignments ADD CONSTRAINT survey_assignments_survey_id_user_id_key UNIQUE (survey_id, user_id);
ALTER TABLE survey_assignments ADD CONSTRAINT survey_assignments_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE survey_questions ADD CONSTRAINT survey_questions_pkey PRIMARY KEY (id);
ALTER TABLE survey_questions ADD CONSTRAINT survey_questions_survey_id_fkey FOREIGN KEY (survey_id) REFERENCES surveys(id) ON DELETE CASCADE;
ALTER TABLE survey_questions ADD CONSTRAINT survey_questions_type_check CHECK ((type = ANY (ARRAY['single'::text, 'multiple'::text, 'text'::text, 'rating'::text, 'scale'::text])));
ALTER TABLE survey_responses ADD CONSTRAINT survey_responses_pkey PRIMARY KEY (id);
ALTER TABLE survey_responses ADD CONSTRAINT survey_responses_survey_id_fkey FOREIGN KEY (survey_id) REFERENCES surveys(id) ON DELETE CASCADE;
ALTER TABLE survey_responses ADD CONSTRAINT survey_responses_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE surveys ADD CONSTRAINT surveys_access_group_id_fkey FOREIGN KEY (access_group_id) REFERENCES access_groups(id) ON DELETE SET NULL;
ALTER TABLE surveys ADD CONSTRAINT surveys_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE surveys ADD CONSTRAINT surveys_pkey PRIMARY KEY (id);
ALTER TABLE test_assignments ADD CONSTRAINT test_assignments_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE test_assignments ADD CONSTRAINT test_assignments_group_id_fkey FOREIGN KEY (group_id) REFERENCES test_groups(id) ON DELETE SET NULL;
ALTER TABLE test_assignments ADD CONSTRAINT test_assignments_pkey PRIMARY KEY (id);
ALTER TABLE test_assignments ADD CONSTRAINT test_assignments_test_id_fkey FOREIGN KEY (test_id) REFERENCES tests(id) ON DELETE CASCADE;
ALTER TABLE test_assignments ADD CONSTRAINT test_assignments_test_id_user_id_key UNIQUE (test_id, user_id);
ALTER TABLE test_assignments ADD CONSTRAINT test_assignments_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE test_assignments ADD CONSTRAINT test_assignments_user_id_profiles_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE test_attempt_grants ADD CONSTRAINT test_attempt_grants_granted_by_fkey FOREIGN KEY (granted_by) REFERENCES profiles(id);
ALTER TABLE test_attempt_grants ADD CONSTRAINT test_attempt_grants_pkey PRIMARY KEY (id);
ALTER TABLE test_attempt_grants ADD CONSTRAINT test_attempt_grants_test_id_fkey FOREIGN KEY (test_id) REFERENCES tests(id) ON DELETE CASCADE;
ALTER TABLE test_attempt_grants ADD CONSTRAINT test_attempt_grants_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE test_attempts ADD CONSTRAINT test_attempts_pkey PRIMARY KEY (id);
ALTER TABLE test_attempts ADD CONSTRAINT test_attempts_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE test_attempts ADD CONSTRAINT test_attempts_run_id_fkey FOREIGN KEY (run_id) REFERENCES course_runs(id) ON DELETE SET NULL;
ALTER TABLE test_attempts ADD CONSTRAINT test_attempts_test_id_fkey FOREIGN KEY (test_id) REFERENCES tests(id) ON DELETE CASCADE;
ALTER TABLE test_attempts ADD CONSTRAINT test_attempts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE test_attempts ADD CONSTRAINT test_attempts_user_id_profiles_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE test_group_items ADD CONSTRAINT test_group_items_group_id_fkey FOREIGN KEY (group_id) REFERENCES test_groups(id) ON DELETE CASCADE;
ALTER TABLE test_group_items ADD CONSTRAINT test_group_items_group_id_test_id_key UNIQUE (group_id, test_id);
ALTER TABLE test_group_items ADD CONSTRAINT test_group_items_pkey PRIMARY KEY (id);
ALTER TABLE test_group_items ADD CONSTRAINT test_group_items_test_id_fkey FOREIGN KEY (test_id) REFERENCES tests(id) ON DELETE CASCADE;
ALTER TABLE test_groups ADD CONSTRAINT test_groups_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE test_groups ADD CONSTRAINT test_groups_pkey PRIMARY KEY (id);
ALTER TABLE tests ADD CONSTRAINT tests_course_id_fkey FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE;
ALTER TABLE tests ADD CONSTRAINT tests_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE tests ADD CONSTRAINT tests_intern_category_check CHECK ((intern_category = ANY (ARRAY['техніка'::text, 'оцінка_техніки'::text, 'магазин'::text, 'драг_метали'::text, 'оцінка_драг_метали'::text, 'загальний'::text])));
ALTER TABLE tests ADD CONSTRAINT tests_pkey PRIMARY KEY (id);
ALTER TABLE trash ADD CONSTRAINT trash_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE trash ADD CONSTRAINT trash_pkey PRIMARY KEY (id);
ALTER TABLE trash ADD CONSTRAINT trash_type_check CHECK ((type = ANY (ARRAY['page'::text, 'news'::text, 'resource'::text, 'user'::text])));
ALTER TABLE trusted_ips ADD CONSTRAINT trusted_ips_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE trusted_ips ADD CONSTRAINT trusted_ips_ip_key UNIQUE (ip);
ALTER TABLE trusted_ips ADD CONSTRAINT trusted_ips_pkey PRIMARY KEY (id);
ALTER TABLE user_login_sessions ADD CONSTRAINT user_login_sessions_pkey PRIMARY KEY (id);
ALTER TABLE user_login_sessions ADD CONSTRAINT user_login_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE user_nav_log ADD CONSTRAINT user_nav_log_pkey PRIMARY KEY (id);
ALTER TABLE user_nav_log ADD CONSTRAINT user_nav_log_session_id_fkey FOREIGN KEY (session_id) REFERENCES user_login_sessions(id) ON DELETE SET NULL;
ALTER TABLE user_nav_log ADD CONSTRAINT user_nav_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE user_sessions ADD CONSTRAINT user_sessions_pkey PRIMARY KEY (id);
ALTER TABLE user_sessions ADD CONSTRAINT user_sessions_session_token_key UNIQUE (session_token);
ALTER TABLE user_sessions ADD CONSTRAINT user_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- ── Indexes ──────────────────────────────────────────────────
CREATE UNIQUE INDEX access_group_cities_pkey ON public.access_group_cities USING btree (group_id, city);
CREATE UNIQUE INDEX access_group_departments_pkey ON public.access_group_departments USING btree (group_id, department);
CREATE UNIQUE INDEX access_group_labels_pkey ON public.access_group_labels USING btree (group_id, label);
CREATE UNIQUE INDEX access_group_positions_pkey ON public.access_group_positions USING btree (group_id, "position");
CREATE UNIQUE INDEX access_groups_pkey ON public.access_groups USING btree (id);
CREATE INDEX idx_access_groups_created_by ON public.access_groups USING btree (created_by);
CREATE UNIQUE INDEX activity_log_pkey ON public.activity_log USING btree (id);
CREATE INDEX idx_activity_log_created ON public.activity_log USING btree (created_at DESC);
CREATE INDEX idx_activity_log_user ON public.activity_log USING btree (user_id, created_at DESC);
CREATE UNIQUE INDEX activity_logs_pkey ON public.activity_logs USING btree (id);
CREATE UNIQUE INDEX answers_pkey ON public.answers USING btree (id);
CREATE UNIQUE INDEX assistant_logs_pkey ON public.assistant_logs USING btree (id);
CREATE INDEX idx_assistant_logs_user_date ON public.assistant_logs USING btree (user_id, created_at);
CREATE UNIQUE INDEX attempt_answers_pkey ON public.attempt_answers USING btree (id);
CREATE UNIQUE INDEX bd_tabs_pkey ON public.bd_tabs USING btree (id);
CREATE UNIQUE INDEX birthday_reminders_created_by_target_id_key ON public.birthday_reminders USING btree (created_by, target_id);
CREATE UNIQUE INDEX birthday_reminders_pkey ON public.birthday_reminders USING btree (id);
CREATE UNIQUE INDEX bookmarks_pkey ON public.bookmarks USING btree (id);
CREATE UNIQUE INDEX bookmarks_user_id_route_key ON public.bookmarks USING btree (user_id, route);
CREATE UNIQUE INDEX branch_doc_blocks_number_key ON public.branch_doc_blocks USING btree (number);
CREATE UNIQUE INDEX branch_doc_blocks_pkey ON public.branch_doc_blocks USING btree (id);
CREATE UNIQUE INDEX cities_name_key ON public.cities USING btree (name);
CREATE UNIQUE INDEX cities_pkey ON public.cities USING btree (id);
CREATE UNIQUE INDEX collection_items_collection_id_resource_id_key ON public.collection_items USING btree (collection_id, resource_id);
CREATE UNIQUE INDEX collection_items_pkey ON public.collection_items USING btree (id);
CREATE INDEX idx_collection_items_collection ON public.collection_items USING btree (collection_id, order_index);
CREATE INDEX idx_collection_items_resource ON public.collection_items USING btree (resource_id);
CREATE UNIQUE INDEX collections_pkey ON public.collections USING btree (id);
CREATE UNIQUE INDEX company_bday_messages_pkey ON public.company_bday_messages USING btree (id);
CREATE UNIQUE INDEX course_runs_pkey ON public.course_runs USING btree (id);
CREATE UNIQUE INDEX course_teachers_course_id_user_id_key ON public.course_teachers USING btree (course_id, user_id);
CREATE UNIQUE INDEX course_teachers_pkey ON public.course_teachers USING btree (id);
CREATE UNIQUE INDEX courses_pkey ON public.courses USING btree (id);
CREATE UNIQUE INDEX courses_slug_key ON public.courses USING btree (slug);
CREATE INDEX idx_courses_published ON public.courses USING btree (is_published);
CREATE INDEX idx_courses_teacher ON public.courses USING btree (teacher_id);
CREATE UNIQUE INDEX custom_pages_pkey ON public.custom_pages USING btree (id);
CREATE UNIQUE INDEX idx_custom_pages_one_home ON public.custom_pages USING btree (is_home) WHERE (is_home = true);
CREATE INDEX ddr_user_idx ON public.doc_deadline_reminders USING btree (user_id);
CREATE UNIQUE INDEX doc_deadline_reminders_pkey ON public.doc_deadline_reminders USING btree (id);
CREATE UNIQUE INDEX doc_deadline_reminders_resource_id_user_id_key ON public.doc_deadline_reminders USING btree (resource_id, user_id);
CREATE INDEX dd_location_idx ON public.document_downloads USING btree (location_id);
CREATE INDEX dd_resource_idx ON public.document_downloads USING btree (resource_id);
CREATE INDEX dd_user_idx ON public.document_downloads USING btree (user_id);
CREATE UNIQUE INDEX document_downloads_pkey ON public.document_downloads USING btree (id);
CREATE UNIQUE INDEX dovirenosti_name_key ON public.dovirenosti USING btree (name);
CREATE UNIQUE INDEX dovirenosti_pkey ON public.dovirenosti USING btree (id);
CREATE UNIQUE INDEX enrollments_pkey ON public.enrollments USING btree (id);
CREATE UNIQUE INDEX enrollments_user_course_run_key ON public.enrollments USING btree (user_id, course_id, COALESCE(run_id, '00000000-0000-0000-0000-000000000000'::uuid));
CREATE INDEX idx_enrollments_course ON public.enrollments USING btree (course_id);
CREATE INDEX idx_enrollments_user ON public.enrollments USING btree (user_id);
CREATE UNIQUE INDEX feedback_messages_pkey ON public.feedback_messages USING btree (id);
CREATE INDEX fm_feedback_id_idx ON public.feedback_messages USING btree (feedback_id, created_at);
CREATE INDEX feedback_reports_created_at_idx ON public.feedback_reports USING btree (created_at DESC);
CREATE UNIQUE INDEX feedback_reports_pkey ON public.feedback_reports USING btree (id);
CREATE INDEX feedback_reports_status_idx ON public.feedback_reports USING btree (status);
CREATE INDEX feedback_reports_user_id_idx ON public.feedback_reports USING btree (user_id);
CREATE UNIQUE INDEX intern_disciplines_pkey ON public.intern_disciplines USING btree (id);
CREATE UNIQUE INDEX intern_job_settings_pkey ON public.intern_job_settings USING btree (id);
CREATE UNIQUE INDEX intern_job_settings_pos_uq ON public.intern_job_settings USING btree (job_position);
CREATE UNIQUE INDEX intern_job_settings_position_id_key ON public.intern_job_settings USING btree (position_id) WHERE (position_id IS NOT NULL);
CREATE INDEX idx_intern_logs_actor ON public.intern_logs USING btree (actor_id);
CREATE INDEX idx_intern_logs_created ON public.intern_logs USING btree (created_at DESC);
CREATE INDEX idx_intern_logs_intern ON public.intern_logs USING btree (intern_id, created_at DESC);
CREATE UNIQUE INDEX intern_logs_pkey ON public.intern_logs USING btree (id);
CREATE INDEX idx_ist_job ON public.intern_schedule_templates USING btree (job_position);
CREATE UNIQUE INDEX intern_schedule_templates_pkey ON public.intern_schedule_templates USING btree (id);
CREATE UNIQUE INDEX intern_viewers_pkey ON public.intern_viewers USING btree (profile_id);
CREATE UNIQUE INDEX interns_pkey ON public.interns USING btree (id);
CREATE UNIQUE INDEX label_restrictions_label_section_key ON public.label_restrictions USING btree (label, section);
CREATE UNIQUE INDEX label_restrictions_pkey ON public.label_restrictions USING btree (id);
CREATE UNIQUE INDEX lecture_enrollments_lecture_id_user_id_key ON public.lecture_enrollments USING btree (lecture_id, user_id);
CREATE UNIQUE INDEX lecture_enrollments_pkey ON public.lecture_enrollments USING btree (id);
CREATE UNIQUE INDEX lecture_lecturers_lecture_id_profile_id_key ON public.lecture_lecturers USING btree (lecture_id, profile_id);
CREATE UNIQUE INDEX lecture_lecturers_pkey ON public.lecture_lecturers USING btree (id);
CREATE UNIQUE INDEX lecture_materials_pkey ON public.lecture_materials USING btree (id);
CREATE UNIQUE INDEX lectures_pkey ON public.lectures USING btree (id);
CREATE UNIQUE INDEX lectures_recurrence_unique ON public.lectures USING btree (recurrence_parent_id, start_date) WHERE (recurrence_parent_id IS NOT NULL);
CREATE INDEX idx_lesson_progress_user ON public.lesson_progress USING btree (user_id);
CREATE UNIQUE INDEX lesson_progress_pkey ON public.lesson_progress USING btree (id);
CREATE UNIQUE INDEX lesson_progress_user_id_lesson_id_key ON public.lesson_progress USING btree (user_id, lesson_id);
CREATE INDEX idx_lessons_course ON public.lessons USING btree (course_id, order_index);
CREATE UNIQUE INDEX lessons_pkey ON public.lessons USING btree (id);
CREATE INDEX idx_news_access_group ON public.news USING btree (access_group_id);
CREATE INDEX idx_news_published ON public.news USING btree (is_published, published_at DESC);
CREATE UNIQUE INDEX idx_news_slug ON public.news USING btree (slug) WHERE (slug IS NOT NULL);
CREATE UNIQUE INDEX news_pkey ON public.news USING btree (id);
CREATE UNIQUE INDEX news_slug_key ON public.news USING btree (slug);
CREATE UNIQUE INDEX news_reactions_news_id_user_id_key ON public.news_reactions USING btree (news_id, user_id);
CREATE UNIQUE INDEX news_reactions_pkey ON public.news_reactions USING btree (id);
CREATE INDEX idx_news_reads_news ON public.news_reads USING btree (news_id);
CREATE INDEX idx_news_reads_user ON public.news_reads USING btree (user_id);
CREATE UNIQUE INDEX news_reads_pkey ON public.news_reads USING btree (id);
CREATE UNIQUE INDEX news_reads_user_id_news_id_key ON public.news_reads USING btree (user_id, news_id);
CREATE UNIQUE INDEX notifications_pkey ON public.notifications USING btree (id);
CREATE INDEX idx_page_att_page ON public.page_attachments USING btree (page_id);
CREATE UNIQUE INDEX page_attachments_pkey ON public.page_attachments USING btree (id);
CREATE UNIQUE INDEX page_dovirenosti_pkey ON public.page_dovirenosti USING btree (page_id, dovirenost_id);
CREATE INDEX idx_personal_cal_events_lecture_id ON public.personal_cal_events USING btree (lecture_id);
CREATE UNIQUE INDEX personal_cal_events_pkey ON public.personal_cal_events USING btree (id);
CREATE UNIQUE INDEX personal_cal_viewers_owner_id_viewer_id_key ON public.personal_cal_viewers USING btree (owner_id, viewer_id);
CREATE UNIQUE INDEX personal_cal_viewers_pkey ON public.personal_cal_viewers USING btree (id);
CREATE UNIQUE INDEX positions_name_key ON public.positions USING btree (name);
CREATE UNIQUE INDEX positions_pkey ON public.positions USING btree (id);
CREATE UNIQUE INDEX profile_dovirenosti_pkey ON public.profile_dovirenosti USING btree (id);
CREATE UNIQUE INDEX profile_dovirenosti_profile_id_dovirenost_id_key ON public.profile_dovirenosti USING btree (profile_id, dovirenost_id);
CREATE INDEX idx_profiles_last_seen ON public.profiles USING btree (last_seen_at DESC);
CREATE INDEX idx_profiles_role ON public.profiles USING btree (role);
CREATE UNIQUE INDEX profiles_email_key ON public.profiles USING btree (email);
CREATE UNIQUE INDEX profiles_login_key ON public.profiles USING btree (login);
CREATE UNIQUE INDEX profiles_login_lower_idx ON public.profiles USING btree (lower(login));
CREATE UNIQUE INDEX profiles_pkey ON public.profiles USING btree (id);
CREATE UNIQUE INDEX questions_pkey ON public.questions USING btree (id);
CREATE INDEX idx_red_folder_items_page_id ON public.red_folder_items USING btree (page_id) WHERE (page_id IS NOT NULL);
CREATE UNIQUE INDEX red_folder_items_pkey ON public.red_folder_items USING btree (id);
CREATE INDEX registry_docs_item_idx ON public.registry_docs USING btree (registry_item_id);
CREATE UNIQUE INDEX registry_docs_pkey ON public.registry_docs USING btree (id);
CREATE INDEX registry_docs_resource_idx ON public.registry_docs USING btree (resource_id);
CREATE UNIQUE INDEX registry_items_pkey ON public.registry_items USING btree (id);
CREATE INDEX registry_items_section_idx ON public.registry_items USING btree (section_id);
CREATE INDEX registry_section_docs_dov_idx ON public.registry_section_docs USING btree (dovirenost_id);
CREATE UNIQUE INDEX registry_section_docs_pkey ON public.registry_section_docs USING btree (id);
CREATE INDEX registry_section_docs_res_idx ON public.registry_section_docs USING btree (resource_id);
CREATE INDEX registry_section_docs_sec_idx ON public.registry_section_docs USING btree (section_id);
CREATE UNIQUE INDEX registry_section_docs_section_id_resource_id_key ON public.registry_section_docs USING btree (section_id, resource_id);
CREATE INDEX registry_sections_dov_idx ON public.registry_sections USING btree (dovirenost_id);
CREATE UNIQUE INDEX registry_sections_pkey ON public.registry_sections USING btree (id);
CREATE UNIQUE INDEX resource_dovirenosti_pkey ON public.resource_dovirenosti USING btree (id);
CREATE UNIQUE INDEX resource_dovirenosti_resource_id_dovirenost_id_key ON public.resource_dovirenosti USING btree (resource_id, dovirenost_id);
CREATE INDEX idx_resources_access_group ON public.resources USING btree (access_group_id);
CREATE INDEX idx_resources_category ON public.resources USING btree (category);
CREATE INDEX idx_resources_course ON public.resources USING btree (course_id);
CREATE INDEX idx_resources_created_by ON public.resources USING btree (created_by);
CREATE INDEX idx_resources_deleted_at ON public.resources USING btree (deleted_at);
CREATE INDEX idx_resources_lesson ON public.resources USING btree (lesson_id);
CREATE INDEX resources_display_block_idx ON public.resources USING btree (display_block) WHERE (display_block IS NOT NULL);
CREATE INDEX resources_dovirenost_idx ON public.resources USING btree (dovirenost_id) WHERE (dovirenost_id IS NOT NULL);
CREATE UNIQUE INDEX resources_pkey ON public.resources USING btree (id);
CREATE UNIQUE INDEX rf_tabs_pkey ON public.rf_tabs USING btree (id);
CREATE UNIQUE INDEX schedule_assignments_location_id_user_id_key ON public.schedule_assignments USING btree (location_id, user_id);
CREATE UNIQUE INDEX schedule_assignments_pkey ON public.schedule_assignments USING btree (id);
CREATE UNIQUE INDEX schedule_entries_location_id_user_id_date_key ON public.schedule_entries USING btree (location_id, user_id, date);
CREATE UNIQUE INDEX schedule_entries_pkey ON public.schedule_entries USING btree (id);
CREATE UNIQUE INDEX schedule_locations_pkey ON public.schedule_locations USING btree (id);
CREATE UNIQUE INDEX schedule_log_pkey ON public.schedule_log USING btree (id);
CREATE UNIQUE INDEX schedule_partners_owner_id_partner_id_key ON public.schedule_partners USING btree (owner_id, partner_id);
CREATE UNIQUE INDEX schedule_partners_pkey ON public.schedule_partners USING btree (id);
CREATE UNIQUE INDEX schedule_shift_config_pkey ON public.schedule_shift_config USING btree (user_id);
CREATE UNIQUE INDEX schedule_viewers_pkey ON public.schedule_viewers USING btree (id);
CREATE UNIQUE INDEX scheduled_notifications_pkey ON public.scheduled_notifications USING btree (id);
CREATE UNIQUE INDEX scorm_packages_pkey ON public.scorm_packages USING btree (id);
CREATE UNIQUE INDEX scorm_packages_resource_id_key ON public.scorm_packages USING btree (resource_id);
CREATE INDEX idx_scorm_progress_package ON public.scorm_progress USING btree (scorm_package_id);
CREATE INDEX idx_scorm_progress_user ON public.scorm_progress USING btree (user_id);
CREATE UNIQUE INDEX scorm_progress_pkey ON public.scorm_progress USING btree (id);
CREATE UNIQUE INDEX scorm_progress_user_id_scorm_package_id_key ON public.scorm_progress USING btree (user_id, scorm_package_id);
CREATE UNIQUE INDEX subdivisions_name_key ON public.subdivisions USING btree (name);
CREATE UNIQUE INDEX subdivisions_pkey ON public.subdivisions USING btree (id);
CREATE UNIQUE INDEX survey_answers_pkey ON public.survey_answers USING btree (id);
CREATE UNIQUE INDEX survey_assignments_pkey ON public.survey_assignments USING btree (id);
CREATE UNIQUE INDEX survey_assignments_survey_id_user_id_key ON public.survey_assignments USING btree (survey_id, user_id);
CREATE UNIQUE INDEX survey_questions_pkey ON public.survey_questions USING btree (id);
CREATE UNIQUE INDEX survey_responses_pkey ON public.survey_responses USING btree (id);
CREATE UNIQUE INDEX surveys_pkey ON public.surveys USING btree (id);
CREATE UNIQUE INDEX test_assignments_pkey ON public.test_assignments USING btree (id);
CREATE UNIQUE INDEX test_assignments_test_id_user_id_key ON public.test_assignments USING btree (test_id, user_id);
CREATE UNIQUE INDEX test_attempt_grants_pkey ON public.test_attempt_grants USING btree (id);
CREATE INDEX idx_test_attempts_needs_review ON public.test_attempts USING btree (needs_review) WHERE (needs_review = true);
CREATE UNIQUE INDEX test_attempts_pkey ON public.test_attempts USING btree (id);
CREATE UNIQUE INDEX test_group_items_group_id_test_id_key ON public.test_group_items USING btree (group_id, test_id);
CREATE UNIQUE INDEX test_group_items_pkey ON public.test_group_items USING btree (id);
CREATE UNIQUE INDEX test_groups_pkey ON public.test_groups USING btree (id);
CREATE UNIQUE INDEX tests_pkey ON public.tests USING btree (id);
CREATE INDEX idx_trash_expires ON public.trash USING btree (expires_at);
CREATE INDEX idx_trash_type ON public.trash USING btree (type);
CREATE UNIQUE INDEX trash_pkey ON public.trash USING btree (id);
CREATE UNIQUE INDEX trusted_ips_ip_key ON public.trusted_ips USING btree (ip);
CREATE UNIQUE INDEX trusted_ips_pkey ON public.trusted_ips USING btree (id);
CREATE UNIQUE INDEX user_login_sessions_pkey ON public.user_login_sessions USING btree (id);
CREATE INDEX user_login_sessions_started_at_idx ON public.user_login_sessions USING btree (started_at DESC);
CREATE INDEX user_login_sessions_user_id_idx ON public.user_login_sessions USING btree (user_id);
CREATE UNIQUE INDEX user_nav_log_pkey ON public.user_nav_log USING btree (id);
CREATE INDEX user_nav_log_session_idx ON public.user_nav_log USING btree (session_id);
CREATE INDEX user_nav_log_ts_idx ON public.user_nav_log USING btree (ts DESC);
CREATE INDEX user_nav_log_user_id_idx ON public.user_nav_log USING btree (user_id);
CREATE UNIQUE INDEX user_sessions_pkey ON public.user_sessions USING btree (id);
CREATE UNIQUE INDEX user_sessions_session_token_key ON public.user_sessions USING btree (session_token);

-- ── RLS enabled ──────────────────────────────────────────────
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
ALTER TABLE public.feedback_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intern_disciplines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intern_job_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intern_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intern_schedule_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intern_viewers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.label_restrictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lecture_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lecture_lecturers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lecture_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lectures ENABLE ROW LEVEL SECURITY;
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
ALTER TABLE public.test_group_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trash ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trusted_ips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_login_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_nav_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

-- ── Policies ─────────────────────────────────────────────────
CREATE POLICY "ag_cities: all" ON public.access_group_cities AS PERMISSIVE FOR ALL TO {authenticated}
    USING (is_admin())
    WITH CHECK (is_admin());

CREATE POLICY "ag_cities_mgr" ON public.access_group_cities AS PERMISSIVE FOR ALL TO {authenticated}
    USING ((get_current_role() = ANY (ARRAY['admin'::text, 'owner'::text])))
    WITH CHECK ((get_current_role() = ANY (ARRAY['admin'::text, 'owner'::text])));

CREATE POLICY "ag_cities_sel" ON public.access_group_cities AS PERMISSIVE FOR SELECT TO {authenticated}
    USING (true);

CREATE POLICY "ag_dept_mgr" ON public.access_group_departments AS PERMISSIVE FOR ALL TO {authenticated}
    USING ((get_current_role() = ANY (ARRAY['admin'::text, 'owner'::text])))
    WITH CHECK ((get_current_role() = ANY (ARRAY['admin'::text, 'owner'::text])));

CREATE POLICY "ag_dept_sel" ON public.access_group_departments AS PERMISSIVE FOR SELECT TO {authenticated}
    USING (true);

CREATE POLICY "ag_depts: all" ON public.access_group_departments AS PERMISSIVE FOR ALL TO {authenticated}
    USING (is_admin())
    WITH CHECK (is_admin());

CREATE POLICY "ag_labels: all" ON public.access_group_labels AS PERMISSIVE FOR ALL TO {authenticated}
    USING (is_admin())
    WITH CHECK (is_admin());

CREATE POLICY "ag_lbl_mgr" ON public.access_group_labels AS PERMISSIVE FOR ALL TO {authenticated}
    USING ((get_current_role() = ANY (ARRAY['admin'::text, 'owner'::text])))
    WITH CHECK ((get_current_role() = ANY (ARRAY['admin'::text, 'owner'::text])));

CREATE POLICY "ag_lbl_sel" ON public.access_group_labels AS PERMISSIVE FOR SELECT TO {authenticated}
    USING (true);

CREATE POLICY "ag_pos_mgr" ON public.access_group_positions AS PERMISSIVE FOR ALL TO {authenticated}
    USING ((get_current_role() = ANY (ARRAY['admin'::text, 'owner'::text])))
    WITH CHECK ((get_current_role() = ANY (ARRAY['admin'::text, 'owner'::text])));

CREATE POLICY "ag_pos_sel" ON public.access_group_positions AS PERMISSIVE FOR SELECT TO {authenticated}
    USING (true);

CREATE POLICY "ag_positions: all" ON public.access_group_positions AS PERMISSIVE FOR ALL TO {authenticated}
    USING (is_admin())
    WITH CHECK (is_admin());

CREATE POLICY "access_groups: read" ON public.access_groups AS PERMISSIVE FOR SELECT TO {authenticated}
    USING (true);

CREATE POLICY "access_groups: write" ON public.access_groups AS PERMISSIVE FOR ALL TO {authenticated}
    USING (is_admin())
    WITH CHECK (is_admin());

CREATE POLICY "ag_manage" ON public.access_groups AS PERMISSIVE FOR ALL TO {authenticated}
    USING ((get_current_role() = ANY (ARRAY['admin'::text, 'owner'::text])))
    WITH CHECK ((get_current_role() = ANY (ARRAY['admin'::text, 'owner'::text])));

CREATE POLICY "ag_select" ON public.access_groups AS PERMISSIVE FOR SELECT TO {authenticated}
    USING (true);

CREATE POLICY "activity_log_insert_own" ON public.activity_log AS PERMISSIVE FOR INSERT TO {authenticated}
    WITH CHECK ((user_id = auth.uid()));

CREATE POLICY "activity_log_select_own" ON public.activity_log AS PERMISSIVE FOR SELECT TO {authenticated}
    USING ((user_id = auth.uid()));

CREATE POLICY "activity_log_select_owner" ON public.activity_log AS PERMISSIVE FOR SELECT TO {authenticated}
    USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'owner'::text)))));

CREATE POLICY "activity_logs: insert authenticated" ON public.activity_logs AS PERMISSIVE FOR INSERT TO {authenticated}
    WITH CHECK (true);

CREATE POLICY "activity_logs: read admin" ON public.activity_logs AS PERMISSIVE FOR SELECT TO {authenticated}
    USING (is_admin());

CREATE POLICY "answers_delete" ON public.answers AS PERMISSIVE FOR DELETE TO {public}
    USING ((auth.uid() IS NOT NULL));

CREATE POLICY "answers_insert" ON public.answers AS PERMISSIVE FOR INSERT TO {public}
    WITH CHECK ((auth.uid() IS NOT NULL));

CREATE POLICY "answers_select" ON public.answers AS PERMISSIVE FOR SELECT TO {public}
    USING (true);

CREATE POLICY "answers_update" ON public.answers AS PERMISSIVE FOR UPDATE TO {public}
    USING ((auth.uid() IS NOT NULL));

CREATE POLICY "assistant_logs_admin" ON public.assistant_logs AS PERMISSIVE FOR SELECT TO {authenticated}
    USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['owner'::text, 'admin'::text]))))));

CREATE POLICY "assistant_logs_insert" ON public.assistant_logs AS PERMISSIVE FOR INSERT TO {service_role}
    WITH CHECK (true);

CREATE POLICY "assistant_logs_select" ON public.assistant_logs AS PERMISSIVE FOR SELECT TO {authenticated}
    USING ((user_id = auth.uid()));

CREATE POLICY "aansw_insert" ON public.attempt_answers AS PERMISSIVE FOR INSERT TO {public}
    WITH CHECK ((auth.uid() IS NOT NULL));

CREATE POLICY "aansw_select" ON public.attempt_answers AS PERMISSIVE FOR SELECT TO {public}
    USING ((auth.uid() IS NOT NULL));

CREATE POLICY "aansw_update_staff" ON public.attempt_answers AS PERMISSIVE FOR UPDATE TO {authenticated}
    USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['owner'::text, 'admin'::text, 'smm'::text, 'teacher'::text]))))));

CREATE POLICY "bd_tabs_delete" ON public.bd_tabs AS PERMISSIVE FOR DELETE TO {public}
    USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));

CREATE POLICY "bd_tabs_insert" ON public.bd_tabs AS PERMISSIVE FOR INSERT TO {public}
    WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));

CREATE POLICY "bd_tabs_select" ON public.bd_tabs AS PERMISSIVE FOR SELECT TO {public}
    USING ((auth.role() = 'authenticated'::text));

CREATE POLICY "bd_tabs_update" ON public.bd_tabs AS PERMISSIVE FOR UPDATE TO {public}
    USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));

CREATE POLICY "birthday_reminders: own or admin" ON public.birthday_reminders AS PERMISSIVE FOR ALL TO {authenticated}
    USING (((created_by = auth.uid()) OR is_admin()))
    WITH CHECK (((created_by = auth.uid()) OR is_admin()));

CREATE POLICY "bookmarks_delete" ON public.bookmarks AS PERMISSIVE FOR DELETE TO {public}
    USING ((user_id = auth.uid()));

CREATE POLICY "bookmarks_insert" ON public.bookmarks AS PERMISSIVE FOR INSERT TO {public}
    WITH CHECK ((user_id = auth.uid()));

CREATE POLICY "bookmarks_select" ON public.bookmarks AS PERMISSIVE FOR SELECT TO {public}
    USING ((user_id = auth.uid()));

CREATE POLICY "bookmarks_update" ON public.bookmarks AS PERMISSIVE FOR UPDATE TO {public}
    USING ((user_id = auth.uid()))
    WITH CHECK ((user_id = auth.uid()));

CREATE POLICY "blocks_admin" ON public.branch_doc_blocks AS PERMISSIVE FOR ALL TO {public}
    USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['owner'::text, 'admin'::text]))))));

CREATE POLICY "blocks_read" ON public.branch_doc_blocks AS PERMISSIVE FOR SELECT TO {public}
    USING (true);

CREATE POLICY "cities: read" ON public.cities AS PERMISSIVE FOR SELECT TO {authenticated}
    USING (true);

CREATE POLICY "cities: write" ON public.cities AS PERMISSIVE FOR ALL TO {authenticated}
    USING (is_admin())
    WITH CHECK (is_admin());

CREATE POLICY "cities_manage" ON public.cities AS PERMISSIVE FOR ALL TO {authenticated}
    USING ((get_current_role() = ANY (ARRAY['admin'::text, 'owner'::text])))
    WITH CHECK ((get_current_role() = ANY (ARRAY['admin'::text, 'owner'::text])));

CREATE POLICY "coll_items_manage" ON public.collection_items AS PERMISSIVE FOR ALL TO {authenticated}
    USING (public.is_teacher_or_admin());

CREATE POLICY "coll_items_select" ON public.collection_items AS PERMISSIVE FOR SELECT TO {authenticated}
    USING (true);

CREATE POLICY "collections_manage" ON public.collections AS PERMISSIVE FOR ALL TO {authenticated}
    USING (public.is_teacher_or_admin());

CREATE POLICY "collections_select" ON public.collections AS PERMISSIVE FOR SELECT TO {authenticated}
    USING (true);

CREATE POLICY "company_bday_messages_delete" ON public.company_bday_messages AS PERMISSIVE FOR DELETE TO {public}
    USING ((auth.uid() = user_id));

CREATE POLICY "company_bday_messages_insert" ON public.company_bday_messages AS PERMISSIVE FOR INSERT TO {public}
    WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "company_bday_messages_select" ON public.company_bday_messages AS PERMISSIVE FOR SELECT TO {public}
    USING ((auth.uid() IS NOT NULL));

CREATE POLICY "runs_delete" ON public.course_runs AS PERMISSIVE FOR DELETE TO {authenticated}
    USING (is_admin());

CREATE POLICY "runs_insert" ON public.course_runs AS PERMISSIVE FOR INSERT TO {authenticated}
    WITH CHECK (is_admin());

CREATE POLICY "runs_select" ON public.course_runs AS PERMISSIVE FOR SELECT TO {authenticated}
    USING (true);

CREATE POLICY "runs_update" ON public.course_runs AS PERMISSIVE FOR UPDATE TO {authenticated}
    USING (is_admin());

CREATE POLICY "course_teachers_read" ON public.course_teachers AS PERMISSIVE FOR SELECT TO {public}
    USING (true);

CREATE POLICY "course_teachers_write" ON public.course_teachers AS PERMISSIVE FOR ALL TO {public}
    USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['owner'::text, 'admin'::text, 'smm'::text, 'teacher'::text]))))));

CREATE POLICY "courses: read" ON public.courses AS PERMISSIVE FOR SELECT TO {authenticated}
    USING (true);

CREATE POLICY "courses: write" ON public.courses AS PERMISSIVE FOR ALL TO {authenticated}
    USING (is_staff())
    WITH CHECK (is_staff());

CREATE POLICY "courses_insert" ON public.courses AS PERMISSIVE FOR INSERT TO {authenticated}
    WITH CHECK (public.is_teacher_or_admin());

CREATE POLICY "custom_pages: read" ON public.custom_pages AS PERMISSIVE FOR SELECT TO {authenticated}
    USING (true);

CREATE POLICY "custom_pages: write" ON public.custom_pages AS PERMISSIVE FOR ALL TO {authenticated}
    USING (is_staff())
    WITH CHECK (is_staff());

CREATE POLICY "pages_manage" ON public.custom_pages AS PERMISSIVE FOR ALL TO {authenticated}
    USING ((get_current_role() = ANY (ARRAY['owner'::text, 'admin'::text, 'smm'::text, 'teacher'::text])))
    WITH CHECK ((get_current_role() = ANY (ARRAY['owner'::text, 'admin'::text, 'smm'::text, 'teacher'::text])));

CREATE POLICY "pages_select" ON public.custom_pages AS PERMISSIVE FOR SELECT TO {authenticated}
    USING (((get_current_role() = ANY (ARRAY['owner'::text, 'admin'::text, 'smm'::text, 'teacher'::text])) OR ((is_published = true) AND ((array_length(allowed_labels, 1) IS NULL) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.label = ANY (custom_pages.allowed_labels)))))))));

CREATE POLICY "doc_deadline_reminders: insert" ON public.doc_deadline_reminders AS PERMISSIVE FOR INSERT TO {authenticated}
    WITH CHECK (true);

CREATE POLICY "doc_deadline_reminders: read own" ON public.doc_deadline_reminders AS PERMISSIVE FOR SELECT TO {authenticated}
    USING (((user_id = auth.uid()) OR is_admin()));

CREATE POLICY "dd_insert" ON public.document_downloads AS PERMISSIVE FOR INSERT TO {authenticated}
    WITH CHECK ((user_id = auth.uid()));

CREATE POLICY "dd_select" ON public.document_downloads AS PERMISSIVE FOR SELECT TO {authenticated}
    USING (((user_id = auth.uid()) OR is_admin() OR (get_current_role() = 'manager'::text)));

CREATE POLICY "doc_downloads: insert own" ON public.document_downloads AS PERMISSIVE FOR INSERT TO {authenticated}
    WITH CHECK ((user_id = auth.uid()));

CREATE POLICY "admin manage dovirenosti" ON public.dovirenosti AS PERMISSIVE FOR ALL TO {authenticated}
    USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'owner'::text]))))))
    WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));

CREATE POLICY "dov: read" ON public.dovirenosti AS PERMISSIVE FOR SELECT TO {authenticated}
    USING (true);

CREATE POLICY "dov: write" ON public.dovirenosti AS PERMISSIVE FOR ALL TO {authenticated}
    USING (is_admin())
    WITH CHECK (is_admin());

CREATE POLICY "read dovirenosti" ON public.dovirenosti AS PERMISSIVE FOR SELECT TO {authenticated}
    USING (true);

CREATE POLICY "enroll_delete" ON public.enrollments AS PERMISSIVE FOR DELETE TO {authenticated}
    USING (((user_id = auth.uid()) OR is_admin()));

CREATE POLICY "enroll_select" ON public.enrollments AS PERMISSIVE FOR SELECT TO {authenticated}
    USING (true);

CREATE POLICY "enrollments: delete admin" ON public.enrollments AS PERMISSIVE FOR DELETE TO {authenticated}
    USING (is_admin());

CREATE POLICY "enrollments: insert own or admin" ON public.enrollments AS PERMISSIVE FOR INSERT TO {authenticated}
    WITH CHECK (((user_id = auth.uid()) OR is_admin()));

CREATE POLICY "enrollments: read own or admin" ON public.enrollments AS PERMISSIVE FOR SELECT TO {authenticated}
    USING (((user_id = auth.uid()) OR is_admin()));

CREATE POLICY "enrollments: update admin" ON public.enrollments AS PERMISSIVE FOR UPDATE TO {authenticated}
    USING (is_admin());

CREATE POLICY "admin_all_fm" ON public.feedback_messages AS PERMISSIVE FOR ALL TO {public}
    USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'owner'::text]))))))
    WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));

CREATE POLICY "own_insert_fm" ON public.feedback_messages AS PERMISSIVE FOR INSERT TO {public}
    WITH CHECK (((sender_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM feedback_reports
  WHERE ((feedback_reports.id = feedback_messages.feedback_id) AND (feedback_reports.user_id = auth.uid()))))));

CREATE POLICY "own_read_fm" ON public.feedback_messages AS PERMISSIVE FOR SELECT TO {public}
    USING (((EXISTS ( SELECT 1
   FROM feedback_reports
  WHERE ((feedback_reports.id = feedback_messages.feedback_id) AND (feedback_reports.user_id = auth.uid())))) OR (sender_id = auth.uid())));

CREATE POLICY "admin_all_feedback" ON public.feedback_reports AS PERMISSIVE FOR ALL TO {public}
    USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));

CREATE POLICY "own_delete_feedback" ON public.feedback_reports AS PERMISSIVE FOR DELETE TO {public}
    USING ((user_id = auth.uid()));

CREATE POLICY "own_insert_feedback" ON public.feedback_reports AS PERMISSIVE FOR INSERT TO {public}
    WITH CHECK ((user_id = auth.uid()));

CREATE POLICY "own_read_feedback" ON public.feedback_reports AS PERMISSIVE FOR SELECT TO {public}
    USING ((user_id = auth.uid()));

CREATE POLICY "user_delete_feedback" ON public.feedback_reports AS PERMISSIVE FOR UPDATE TO {public}
    USING ((auth.uid() = user_id))
    WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "admin_all_disciplines" ON public.intern_disciplines AS PERMISSIVE FOR ALL TO {public}
    USING ((( SELECT profiles.role
   FROM profiles
  WHERE (profiles.id = auth.uid())) = 'admin'::text))
    WITH CHECK ((( SELECT profiles.role
   FROM profiles
  WHERE (profiles.id = auth.uid())) = 'admin'::text));

CREATE POLICY "manager_select_disciplines" ON public.intern_disciplines AS PERMISSIVE FOR SELECT TO {public}
    USING ((EXISTS ( SELECT 1
   FROM interns
  WHERE ((interns.id = intern_disciplines.intern_id) AND (interns.manager_id = auth.uid())))));

CREATE POLICY "owner_all_disciplines" ON public.intern_disciplines AS PERMISSIVE FOR ALL TO {public}
    USING ((( SELECT profiles.role
   FROM profiles
  WHERE (profiles.id = auth.uid())) = 'owner'::text))
    WITH CHECK ((( SELECT profiles.role
   FROM profiles
  WHERE (profiles.id = auth.uid())) = 'owner'::text));

CREATE POLICY "viewer_select_disciplines" ON public.intern_disciplines AS PERMISSIVE FOR SELECT TO {public}
    USING ((EXISTS ( SELECT 1
   FROM intern_viewers
  WHERE (intern_viewers.profile_id = auth.uid()))));

CREATE POLICY "admin_all_job_settings" ON public.intern_job_settings AS PERMISSIVE FOR ALL TO {public}
    USING ((( SELECT profiles.role
   FROM profiles
  WHERE (profiles.id = auth.uid())) = ANY (ARRAY['owner'::text, 'admin'::text])))
    WITH CHECK ((( SELECT profiles.role
   FROM profiles
  WHERE (profiles.id = auth.uid())) = ANY (ARRAY['owner'::text, 'admin'::text])));

CREATE POLICY "select_job_settings" ON public.intern_job_settings AS PERMISSIVE FOR SELECT TO {public}
    USING (true);

CREATE POLICY "intern_logs: insert" ON public.intern_logs AS PERMISSIVE FOR INSERT TO {authenticated}
    WITH CHECK ((actor_id = auth.uid()));

CREATE POLICY "intern_logs: owner read" ON public.intern_logs AS PERMISSIVE FOR SELECT TO {authenticated}
    USING ((get_user_role() = ANY (ARRAY['owner'::text, 'admin'::text])));

CREATE POLICY "ist: admin write" ON public.intern_schedule_templates AS PERMISSIVE FOR ALL TO {authenticated}
    USING ((get_user_role() = ANY (ARRAY['owner'::text, 'admin'::text])))
    WITH CHECK ((get_user_role() = ANY (ARRAY['owner'::text, 'admin'::text])));

CREATE POLICY "ist: staff read" ON public.intern_schedule_templates AS PERMISSIVE FOR SELECT TO {authenticated}
    USING ((get_user_role() = ANY (ARRAY['owner'::text, 'admin'::text, 'teacher'::text, 'smm'::text, 'manager'::text])));

CREATE POLICY "admin_all_viewers" ON public.intern_viewers AS PERMISSIVE FOR ALL TO {public}
    USING ((( SELECT profiles.role
   FROM profiles
  WHERE (profiles.id = auth.uid())) = 'admin'::text))
    WITH CHECK ((( SELECT profiles.role
   FROM profiles
  WHERE (profiles.id = auth.uid())) = 'admin'::text));

CREATE POLICY "owner_all_viewers" ON public.intern_viewers AS PERMISSIVE FOR ALL TO {public}
    USING ((( SELECT profiles.role
   FROM profiles
  WHERE (profiles.id = auth.uid())) = 'owner'::text))
    WITH CHECK ((( SELECT profiles.role
   FROM profiles
  WHERE (profiles.id = auth.uid())) = 'owner'::text));

CREATE POLICY "admin_select_interns" ON public.interns AS PERMISSIVE FOR SELECT TO {public}
    USING ((( SELECT profiles.role
   FROM profiles
  WHERE (profiles.id = auth.uid())) = 'admin'::text));

CREATE POLICY "admin_write_interns" ON public.interns AS PERMISSIVE FOR ALL TO {public}
    USING ((( SELECT profiles.role
   FROM profiles
  WHERE (profiles.id = auth.uid())) = 'admin'::text))
    WITH CHECK ((( SELECT profiles.role
   FROM profiles
  WHERE (profiles.id = auth.uid())) = 'admin'::text));

CREATE POLICY "manager_select_interns" ON public.interns AS PERMISSIVE FOR SELECT TO {public}
    USING ((manager_id = auth.uid()));

CREATE POLICY "owner_all_interns" ON public.interns AS PERMISSIVE FOR ALL TO {public}
    USING ((( SELECT profiles.role
   FROM profiles
  WHERE (profiles.id = auth.uid())) = 'owner'::text))
    WITH CHECK ((( SELECT profiles.role
   FROM profiles
  WHERE (profiles.id = auth.uid())) = 'owner'::text));

CREATE POLICY "viewer_select_interns" ON public.interns AS PERMISSIVE FOR SELECT TO {public}
    USING ((EXISTS ( SELECT 1
   FROM intern_viewers
  WHERE (intern_viewers.profile_id = auth.uid()))));

CREATE POLICY "label_restr: all" ON public.label_restrictions AS PERMISSIVE FOR ALL TO {authenticated}
    USING (is_admin())
    WITH CHECK (is_admin());

CREATE POLICY "lecenr_delete" ON public.lecture_enrollments AS PERMISSIVE FOR DELETE TO {public}
    USING (((user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'owner'::text])))))));

CREATE POLICY "lecenr_insert" ON public.lecture_enrollments AS PERMISSIVE FOR INSERT TO {public}
    WITH CHECK ((user_id = auth.uid()));

CREATE POLICY "lecenr_select" ON public.lecture_enrollments AS PERMISSIVE FOR SELECT TO {public}
    USING ((auth.uid() IS NOT NULL));

CREATE POLICY "leclect_delete" ON public.lecture_lecturers AS PERMISSIVE FOR DELETE TO {public}
    USING ((auth.uid() IS NOT NULL));

CREATE POLICY "leclect_insert" ON public.lecture_lecturers AS PERMISSIVE FOR INSERT TO {public}
    WITH CHECK ((auth.uid() IS NOT NULL));

CREATE POLICY "leclect_select" ON public.lecture_lecturers AS PERMISSIVE FOR SELECT TO {public}
    USING ((auth.uid() IS NOT NULL));

CREATE POLICY "lecmat_delete" ON public.lecture_materials AS PERMISSIVE FOR DELETE TO {public}
    USING ((auth.uid() IS NOT NULL));

CREATE POLICY "lecmat_insert" ON public.lecture_materials AS PERMISSIVE FOR INSERT TO {public}
    WITH CHECK ((auth.uid() IS NOT NULL));

CREATE POLICY "lecmat_select" ON public.lecture_materials AS PERMISSIVE FOR SELECT TO {public}
    USING ((auth.uid() IS NOT NULL));

CREATE POLICY "lectures_delete" ON public.lectures AS PERMISSIVE FOR DELETE TO {public}
    USING ((auth.uid() IS NOT NULL));

CREATE POLICY "lectures_insert" ON public.lectures AS PERMISSIVE FOR INSERT TO {public}
    WITH CHECK ((auth.uid() IS NOT NULL));

CREATE POLICY "lectures_select" ON public.lectures AS PERMISSIVE FOR SELECT TO {public}
    USING ((auth.uid() IS NOT NULL));

CREATE POLICY "lectures_update" ON public.lectures AS PERMISSIVE FOR UPDATE TO {public}
    USING ((auth.uid() IS NOT NULL));

CREATE POLICY "lesson_progress: own" ON public.lesson_progress AS PERMISSIVE FOR ALL TO {authenticated}
    USING ((user_id = auth.uid()))
    WITH CHECK ((user_id = auth.uid()));

CREATE POLICY "lp_insert" ON public.lesson_progress AS PERMISSIVE FOR INSERT TO {authenticated}
    WITH CHECK ((user_id = auth.uid()));

CREATE POLICY "lp_select" ON public.lesson_progress AS PERMISSIVE FOR SELECT TO {authenticated}
    USING (((user_id = auth.uid()) OR public.is_teacher_or_admin()));

CREATE POLICY "lp_update" ON public.lesson_progress AS PERMISSIVE FOR UPDATE TO {authenticated}
    USING ((user_id = auth.uid()));

CREATE POLICY "lessons: read" ON public.lessons AS PERMISSIVE FOR SELECT TO {authenticated}
    USING (true);

CREATE POLICY "lessons: write" ON public.lessons AS PERMISSIVE FOR ALL TO {authenticated}
    USING (is_staff())
    WITH CHECK (is_staff());

CREATE POLICY "lessons_manage" ON public.lessons AS PERMISSIVE FOR ALL TO {authenticated}
    USING (public.is_teacher_or_admin());

CREATE POLICY "lessons_select" ON public.lessons AS PERMISSIVE FOR SELECT TO {authenticated}
    USING (((EXISTS ( SELECT 1
   FROM enrollments
  WHERE ((enrollments.user_id = auth.uid()) AND (enrollments.course_id = lessons.course_id)))) OR public.is_teacher_or_admin()));

CREATE POLICY "news: read" ON public.news AS PERMISSIVE FOR SELECT TO {authenticated}
    USING (true);

CREATE POLICY "news: write" ON public.news AS PERMISSIVE FOR ALL TO {authenticated}
    USING (is_staff())
    WITH CHECK (is_staff());

CREATE POLICY "news_manage" ON public.news AS PERMISSIVE FOR ALL TO {authenticated}
    USING ((get_current_role() = ANY (ARRAY['owner'::text, 'admin'::text, 'smm'::text, 'teacher'::text])))
    WITH CHECK ((get_current_role() = ANY (ARRAY['owner'::text, 'admin'::text, 'smm'::text, 'teacher'::text])));

CREATE POLICY "news_select" ON public.news AS PERMISSIVE FOR SELECT TO {authenticated}
    USING (((is_published = true) OR (get_current_role() = ANY (ARRAY['owner'::text, 'admin'::text, 'smm'::text, 'teacher'::text]))));

CREATE POLICY "news_reactions: own" ON public.news_reactions AS PERMISSIVE FOR ALL TO {authenticated}
    USING ((user_id = auth.uid()))
    WITH CHECK ((user_id = auth.uid()));

CREATE POLICY "news_reactions: read" ON public.news_reactions AS PERMISSIVE FOR SELECT TO {authenticated}
    USING (true);

CREATE POLICY "reactions_delete" ON public.news_reactions AS PERMISSIVE FOR DELETE TO {public}
    USING ((auth.uid() = user_id));

CREATE POLICY "reactions_insert" ON public.news_reactions AS PERMISSIVE FOR INSERT TO {public}
    WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "reactions_select" ON public.news_reactions AS PERMISSIVE FOR SELECT TO {public}
    USING (true);

CREATE POLICY "reactions_update" ON public.news_reactions AS PERMISSIVE FOR UPDATE TO {authenticated}
    USING ((user_id = auth.uid()))
    WITH CHECK ((user_id = auth.uid()));

CREATE POLICY "news_reads_delete" ON public.news_reads AS PERMISSIVE FOR DELETE TO {authenticated}
    USING ((user_id = auth.uid()));

CREATE POLICY "news_reads_insert" ON public.news_reads AS PERMISSIVE FOR INSERT TO {authenticated}
    WITH CHECK ((user_id = auth.uid()));

CREATE POLICY "news_reads_select" ON public.news_reads AS PERMISSIVE FOR SELECT TO {authenticated}
    USING ((user_id = auth.uid()));

CREATE POLICY "news_reads_update" ON public.news_reads AS PERMISSIVE FOR UPDATE TO {authenticated}
    USING ((user_id = auth.uid()));

CREATE POLICY "notif_insert" ON public.notifications AS PERMISSIVE FOR INSERT TO {public}
    WITH CHECK ((auth.uid() IS NOT NULL));

CREATE POLICY "notif_select" ON public.notifications AS PERMISSIVE FOR SELECT TO {public}
    USING ((auth.uid() = user_id));

CREATE POLICY "notif_update" ON public.notifications AS PERMISSIVE FOR UPDATE TO {public}
    USING ((auth.uid() = user_id));

CREATE POLICY "notifications: own or admin" ON public.notifications AS PERMISSIVE FOR ALL TO {authenticated}
    USING (((user_id = auth.uid()) OR is_admin()))
    WITH CHECK ((is_admin() OR (user_id = auth.uid())));

CREATE POLICY "page_att: read" ON public.page_attachments AS PERMISSIVE FOR SELECT TO {authenticated}
    USING (true);

CREATE POLICY "page_att: write" ON public.page_attachments AS PERMISSIVE FOR ALL TO {authenticated}
    USING (is_staff())
    WITH CHECK (is_staff());

CREATE POLICY "page_att_manage" ON public.page_attachments AS PERMISSIVE FOR ALL TO {authenticated}
    USING ((get_current_role() = ANY (ARRAY['owner'::text, 'admin'::text, 'smm'::text, 'teacher'::text])))
    WITH CHECK ((get_current_role() = ANY (ARRAY['owner'::text, 'admin'::text, 'smm'::text, 'teacher'::text])));

CREATE POLICY "page_att_select" ON public.page_attachments AS PERMISSIVE FOR SELECT TO {authenticated}
    USING (true);

CREATE POLICY "page_dovirenosti_delete" ON public.page_dovirenosti AS PERMISSIVE FOR DELETE TO {authenticated}
    USING ((get_current_role() = ANY (ARRAY['owner'::text, 'admin'::text, 'smm'::text])));

CREATE POLICY "page_dovirenosti_insert" ON public.page_dovirenosti AS PERMISSIVE FOR INSERT TO {authenticated}
    WITH CHECK ((get_current_role() = ANY (ARRAY['owner'::text, 'admin'::text, 'smm'::text])));

CREATE POLICY "page_dovirenosti_select" ON public.page_dovirenosti AS PERMISSIVE FOR SELECT TO {authenticated}
    USING (true);

CREATE POLICY "cal_events: select" ON public.personal_cal_events AS PERMISSIVE FOR SELECT TO {authenticated}
    USING (((user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM personal_cal_viewers
  WHERE ((personal_cal_viewers.viewer_id = auth.uid()) AND (personal_cal_viewers.owner_id = personal_cal_events.user_id))))));

CREATE POLICY "cal_events: write own" ON public.personal_cal_events AS PERMISSIVE FOR ALL TO {authenticated}
    USING ((user_id = auth.uid()))
    WITH CHECK ((user_id = auth.uid()));

CREATE POLICY "cal_viewers: own" ON public.personal_cal_viewers AS PERMISSIVE FOR ALL TO {authenticated}
    USING (((owner_id = auth.uid()) OR (viewer_id = auth.uid())))
    WITH CHECK ((owner_id = auth.uid()));

CREATE POLICY "positions: read" ON public.positions AS PERMISSIVE FOR SELECT TO {authenticated}
    USING (true);

CREATE POLICY "positions: write" ON public.positions AS PERMISSIVE FOR ALL TO {authenticated}
    USING (is_admin())
    WITH CHECK (is_admin());

CREATE POLICY "positions_manage" ON public.positions AS PERMISSIVE FOR ALL TO {authenticated}
    USING ((get_current_role() = ANY (ARRAY['admin'::text, 'owner'::text])))
    WITH CHECK ((get_current_role() = ANY (ARRAY['admin'::text, 'owner'::text])));

CREATE POLICY "admin manage profile_dovirenosti" ON public.profile_dovirenosti AS PERMISSIVE FOR ALL TO {authenticated}
    USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'owner'::text]))))))
    WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));

CREATE POLICY "prof_dov: own" ON public.profile_dovirenosti AS PERMISSIVE FOR ALL TO {authenticated}
    USING (((profile_id = auth.uid()) OR is_admin()))
    WITH CHECK (is_admin());

CREATE POLICY "read profile_dovirenosti" ON public.profile_dovirenosti AS PERMISSIVE FOR SELECT TO {authenticated}
    USING (true);

CREATE POLICY "profiles: delete admin" ON public.profiles AS PERMISSIVE FOR DELETE TO {authenticated}
    USING (is_admin());

CREATE POLICY "profiles: insert admin" ON public.profiles AS PERMISSIVE FOR INSERT TO {authenticated}
    WITH CHECK (is_admin());

CREATE POLICY "profiles: read authenticated" ON public.profiles AS PERMISSIVE FOR SELECT TO {authenticated}
    USING (true);

CREATE POLICY "profiles: update own or admin" ON public.profiles AS PERMISSIVE FOR UPDATE TO {authenticated}
    USING (((id = auth.uid()) OR is_admin()));

CREATE POLICY "profiles_admin_force_logout" ON public.profiles AS PERMISSIVE FOR UPDATE TO {authenticated}
    USING ((EXISTS ( SELECT 1
   FROM profiles profiles_1
  WHERE ((profiles_1.id = auth.uid()) AND (profiles_1.role = ANY (ARRAY['admin'::text, 'owner'::text]))))))
    WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles profiles_1
  WHERE ((profiles_1.id = auth.uid()) AND (profiles_1.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));

CREATE POLICY "questions_delete" ON public.questions AS PERMISSIVE FOR DELETE TO {public}
    USING ((auth.uid() IS NOT NULL));

CREATE POLICY "questions_insert" ON public.questions AS PERMISSIVE FOR INSERT TO {public}
    WITH CHECK ((auth.uid() IS NOT NULL));

CREATE POLICY "questions_select" ON public.questions AS PERMISSIVE FOR SELECT TO {public}
    USING (true);

CREATE POLICY "questions_update" ON public.questions AS PERMISSIVE FOR UPDATE TO {public}
    USING ((auth.uid() IS NOT NULL));

CREATE POLICY "All authenticated users can read red folder items" ON public.red_folder_items AS PERMISSIVE FOR SELECT TO {public}
    USING ((auth.uid() IS NOT NULL));

CREATE POLICY "Staff can manage red folder items" ON public.red_folder_items AS PERMISSIVE FOR ALL TO {public}
    USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['owner'::text, 'admin'::text, 'smm'::text, 'teacher'::text]))))))
    WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['owner'::text, 'admin'::text, 'smm'::text, 'teacher'::text]))))));

CREATE POLICY "registry_docs_admin_delete" ON public.registry_docs AS PERMISSIVE FOR DELETE TO {public}
    USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));

CREATE POLICY "registry_docs_admin_insert" ON public.registry_docs AS PERMISSIVE FOR INSERT TO {public}
    WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));

CREATE POLICY "registry_docs_admin_update" ON public.registry_docs AS PERMISSIVE FOR UPDATE TO {public}
    USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));

CREATE POLICY "registry_docs_select_all" ON public.registry_docs AS PERMISSIVE FOR SELECT TO {public}
    USING (true);

CREATE POLICY "registry_items_admin_delete" ON public.registry_items AS PERMISSIVE FOR DELETE TO {public}
    USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));

CREATE POLICY "registry_items_admin_insert" ON public.registry_items AS PERMISSIVE FOR INSERT TO {public}
    WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));

CREATE POLICY "registry_items_admin_update" ON public.registry_items AS PERMISSIVE FOR UPDATE TO {public}
    USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));

CREATE POLICY "registry_items_select_all" ON public.registry_items AS PERMISSIVE FOR SELECT TO {public}
    USING (true);

CREATE POLICY "registry_section_docs_admin_delete" ON public.registry_section_docs AS PERMISSIVE FOR DELETE TO {public}
    USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['owner'::text, 'admin'::text]))))));

CREATE POLICY "registry_section_docs_admin_insert" ON public.registry_section_docs AS PERMISSIVE FOR INSERT TO {public}
    WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['owner'::text, 'admin'::text]))))));

CREATE POLICY "registry_section_docs_select_all" ON public.registry_section_docs AS PERMISSIVE FOR SELECT TO {public}
    USING (true);

CREATE POLICY "registry_sections_admin_delete" ON public.registry_sections AS PERMISSIVE FOR DELETE TO {public}
    USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['owner'::text, 'admin'::text]))))));

CREATE POLICY "registry_sections_admin_insert" ON public.registry_sections AS PERMISSIVE FOR INSERT TO {public}
    WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['owner'::text, 'admin'::text]))))));

CREATE POLICY "registry_sections_admin_update" ON public.registry_sections AS PERMISSIVE FOR UPDATE TO {public}
    USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['owner'::text, 'admin'::text]))))));

CREATE POLICY "registry_sections_select_all" ON public.registry_sections AS PERMISSIVE FOR SELECT TO {public}
    USING (true);

CREATE POLICY "read resource_dovirenosti" ON public.resource_dovirenosti AS PERMISSIVE FOR SELECT TO {authenticated}
    USING (true);

CREATE POLICY "resource_dovirenosti_select" ON public.resource_dovirenosti AS PERMISSIVE FOR SELECT TO {authenticated}
    USING (true);

CREATE POLICY "resource_dovirenosti_write" ON public.resource_dovirenosti AS PERMISSIVE FOR ALL TO {authenticated}
    USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['owner'::text, 'admin'::text, 'smm'::text, 'teacher'::text]))))))
    WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['owner'::text, 'admin'::text, 'smm'::text, 'teacher'::text]))))));

CREATE POLICY "staff manage resource_dovirenosti" ON public.resource_dovirenosti AS PERMISSIVE FOR ALL TO {authenticated}
    USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'owner'::text, 'smm'::text, 'teacher'::text, 'manager'::text]))))))
    WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'owner'::text, 'smm'::text, 'teacher'::text, 'manager'::text]))))));

CREATE POLICY "resources: read" ON public.resources AS PERMISSIVE FOR SELECT TO {authenticated}
    USING (true);

CREATE POLICY "resources: write" ON public.resources AS PERMISSIVE FOR ALL TO {authenticated}
    USING (is_staff())
    WITH CHECK (is_staff());

CREATE POLICY "resources_select" ON public.resources AS PERMISSIVE FOR SELECT TO {authenticated}
    USING (((get_current_role() = ANY (ARRAY['owner'::text, 'admin'::text, 'smm'::text, 'teacher'::text])) OR ((lesson_id IS NULL) AND ((access_group_id IS NULL) OR user_has_group_access(access_group_id)) AND ((course_id IS NULL) OR (EXISTS ( SELECT 1
   FROM enrollments e
  WHERE ((e.user_id = auth.uid()) AND (e.course_id = resources.course_id)))))) OR (EXISTS ( SELECT 1
   FROM (lessons l
     JOIN enrollments e ON ((e.course_id = l.course_id)))
  WHERE ((l.id = resources.lesson_id) AND (e.user_id = auth.uid()))))));

CREATE POLICY "resources_write" ON public.resources AS PERMISSIVE FOR ALL TO {authenticated}
    USING ((get_current_role() = ANY (ARRAY['owner'::text, 'admin'::text, 'smm'::text, 'teacher'::text])))
    WITH CHECK ((get_current_role() = ANY (ARRAY['owner'::text, 'admin'::text, 'smm'::text, 'teacher'::text])));

CREATE POLICY "rf_tabs_delete" ON public.rf_tabs AS PERMISSIVE FOR DELETE TO {public}
    USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));

CREATE POLICY "rf_tabs_insert" ON public.rf_tabs AS PERMISSIVE FOR INSERT TO {public}
    WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));

CREATE POLICY "rf_tabs_select" ON public.rf_tabs AS PERMISSIVE FOR SELECT TO {public}
    USING ((auth.role() = 'authenticated'::text));

CREATE POLICY "rf_tabs_update" ON public.rf_tabs AS PERMISSIVE FOR UPDATE TO {public}
    USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));

CREATE POLICY "sched_assign: read" ON public.schedule_assignments AS PERMISSIVE FOR SELECT TO {authenticated}
    USING (true);

CREATE POLICY "sched_assign: write" ON public.schedule_assignments AS PERMISSIVE FOR ALL TO {authenticated}
    USING (is_manager())
    WITH CHECK (is_manager());

CREATE POLICY "sched_entries: read" ON public.schedule_entries AS PERMISSIVE FOR SELECT TO {authenticated}
    USING (true);

CREATE POLICY "sched_entries: write" ON public.schedule_entries AS PERMISSIVE FOR ALL TO {authenticated}
    USING (is_manager())
    WITH CHECK (is_manager());

CREATE POLICY "sentry_delete" ON public.schedule_entries AS PERMISSIVE FOR DELETE TO {public}
    USING (((auth.uid() = user_id) OR (EXISTS ( SELECT 1
   FROM schedule_locations
  WHERE ((schedule_locations.id = schedule_entries.location_id) AND (schedule_locations.created_by = auth.uid()))))));

CREATE POLICY "sentry_insert" ON public.schedule_entries AS PERMISSIVE FOR INSERT TO {public}
    WITH CHECK (((auth.uid() = user_id) OR (EXISTS ( SELECT 1
   FROM schedule_locations
  WHERE ((schedule_locations.id = schedule_entries.location_id) AND (schedule_locations.created_by = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM schedule_viewers
  WHERE ((schedule_viewers.location_id = schedule_entries.location_id) AND (schedule_viewers.user_id = auth.uid()))))));

CREATE POLICY "sentry_select" ON public.schedule_entries AS PERMISSIVE FOR SELECT TO {public}
    USING (true);

CREATE POLICY "sentry_update" ON public.schedule_entries AS PERMISSIVE FOR UPDATE TO {public}
    USING (((auth.uid() = user_id) OR (EXISTS ( SELECT 1
   FROM schedule_locations
  WHERE ((schedule_locations.id = schedule_entries.location_id) AND (schedule_locations.created_by = auth.uid()))))));

CREATE POLICY "sched_loc: read" ON public.schedule_locations AS PERMISSIVE FOR SELECT TO {authenticated}
    USING (true);

CREATE POLICY "sched_loc: write" ON public.schedule_locations AS PERMISSIVE FOR ALL TO {authenticated}
    USING (is_manager())
    WITH CHECK (is_manager());

CREATE POLICY "sched_log: insert" ON public.schedule_log AS PERMISSIVE FOR INSERT TO {authenticated}
    WITH CHECK (true);

CREATE POLICY "sched_log: read" ON public.schedule_log AS PERMISSIVE FOR SELECT TO {authenticated}
    USING (is_manager());

CREATE POLICY "sched_partners: all" ON public.schedule_partners AS PERMISSIVE FOR ALL TO {authenticated}
    USING (is_manager())
    WITH CHECK (is_manager());

CREATE POLICY "sched_config: all" ON public.schedule_shift_config AS PERMISSIVE FOR ALL TO {authenticated}
    USING ((user_id = auth.uid()))
    WITH CHECK ((user_id = auth.uid()));

CREATE POLICY "sched_viewers: all" ON public.schedule_viewers AS PERMISSIVE FOR ALL TO {authenticated}
    USING (is_manager())
    WITH CHECK (is_manager());

CREATE POLICY "sched_notif: read" ON public.scheduled_notifications AS PERMISSIVE FOR SELECT TO {authenticated}
    USING (true);

CREATE POLICY "sched_notif: write" ON public.scheduled_notifications AS PERMISSIVE FOR ALL TO {authenticated}
    USING (is_admin())
    WITH CHECK (is_admin());

CREATE POLICY "scorm_pkg: read" ON public.scorm_packages AS PERMISSIVE FOR SELECT TO {authenticated}
    USING (true);

CREATE POLICY "scorm_pkg: write" ON public.scorm_packages AS PERMISSIVE FOR ALL TO {authenticated}
    USING (is_staff())
    WITH CHECK (is_staff());

CREATE POLICY "scorm_pkg_manage" ON public.scorm_packages AS PERMISSIVE FOR ALL TO {authenticated}
    USING (public.is_teacher_or_admin());

CREATE POLICY "scorm_pkg_select" ON public.scorm_packages AS PERMISSIVE FOR SELECT TO {authenticated}
    USING (((EXISTS ( SELECT 1
   FROM ((resources r
     JOIN lessons l ON ((l.id = r.lesson_id)))
     JOIN enrollments e ON ((e.course_id = l.course_id)))
  WHERE ((r.id = scorm_packages.resource_id) AND (e.user_id = auth.uid())))) OR public.is_teacher_or_admin()));

CREATE POLICY "scorm_prog_insert" ON public.scorm_progress AS PERMISSIVE FOR INSERT TO {authenticated}
    WITH CHECK ((user_id = auth.uid()));

CREATE POLICY "scorm_prog_select" ON public.scorm_progress AS PERMISSIVE FOR SELECT TO {authenticated}
    USING (((user_id = auth.uid()) OR public.is_teacher_or_admin()));

CREATE POLICY "scorm_prog_update" ON public.scorm_progress AS PERMISSIVE FOR UPDATE TO {authenticated}
    USING ((user_id = auth.uid()));

CREATE POLICY "scorm_progress: own" ON public.scorm_progress AS PERMISSIVE FOR ALL TO {authenticated}
    USING ((user_id = auth.uid()))
    WITH CHECK ((user_id = auth.uid()));

CREATE POLICY "subdiv: read" ON public.subdivisions AS PERMISSIVE FOR SELECT TO {authenticated}
    USING (true);

CREATE POLICY "subdiv: write" ON public.subdivisions AS PERMISSIVE FOR ALL TO {authenticated}
    USING (is_admin())
    WITH CHECK (is_admin());

CREATE POLICY "subdivisions_manage" ON public.subdivisions AS PERMISSIVE FOR ALL TO {authenticated}
    USING ((get_current_role() = ANY (ARRAY['admin'::text, 'owner'::text])))
    WITH CHECK ((get_current_role() = ANY (ARRAY['admin'::text, 'owner'::text])));

CREATE POLICY "survey_answers_insert" ON public.survey_answers AS PERMISSIVE FOR INSERT TO {authenticated}
    WITH CHECK (true);

CREATE POLICY "survey_answers_read" ON public.survey_answers AS PERMISSIVE FOR SELECT TO {authenticated}
    USING ((EXISTS ( SELECT 1
   FROM survey_responses r
  WHERE ((r.id = survey_answers.response_id) AND ((r.user_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM profiles
          WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['owner'::text, 'admin'::text, 'smm'::text, 'teacher'::text, 'manager'::text]))))))))));

CREATE POLICY "survey_assignments_read" ON public.survey_assignments AS PERMISSIVE FOR SELECT TO {authenticated}
    USING (((user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['owner'::text, 'admin'::text, 'smm'::text, 'teacher'::text, 'manager'::text])))))));

CREATE POLICY "survey_assignments_write" ON public.survey_assignments AS PERMISSIVE FOR ALL TO {authenticated}
    USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['owner'::text, 'admin'::text, 'smm'::text]))))));

CREATE POLICY "survey_questions_read" ON public.survey_questions AS PERMISSIVE FOR SELECT TO {authenticated}
    USING (true);

CREATE POLICY "survey_questions_write" ON public.survey_questions AS PERMISSIVE FOR ALL TO {authenticated}
    USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['owner'::text, 'admin'::text, 'smm'::text]))))));

CREATE POLICY "survey_responses_insert" ON public.survey_responses AS PERMISSIVE FOR INSERT TO {authenticated}
    WITH CHECK (true);

CREATE POLICY "survey_responses_read_own" ON public.survey_responses AS PERMISSIVE FOR SELECT TO {authenticated}
    USING (((user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['owner'::text, 'admin'::text, 'smm'::text, 'teacher'::text, 'manager'::text])))))));

CREATE POLICY "surveys_read" ON public.surveys AS PERMISSIVE FOR SELECT TO {authenticated}
    USING (((is_published = true) OR (created_by = auth.uid()) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['owner'::text, 'admin'::text, 'smm'::text, 'teacher'::text, 'manager'::text])))))));

CREATE POLICY "surveys_write" ON public.surveys AS PERMISSIVE FOR ALL TO {authenticated}
    USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['owner'::text, 'admin'::text, 'smm'::text]))))));

CREATE POLICY "tassign_delete" ON public.test_assignments AS PERMISSIVE FOR DELETE TO {public}
    USING ((auth.uid() IS NOT NULL));

CREATE POLICY "tassign_insert" ON public.test_assignments AS PERMISSIVE FOR INSERT TO {public}
    WITH CHECK ((auth.uid() IS NOT NULL));

CREATE POLICY "tassign_select" ON public.test_assignments AS PERMISSIVE FOR SELECT TO {public}
    USING ((auth.uid() IS NOT NULL));

CREATE POLICY "tassign_update" ON public.test_assignments AS PERMISSIVE FOR UPDATE TO {public}
    USING ((auth.uid() IS NOT NULL));

CREATE POLICY "admin manage grants" ON public.test_attempt_grants AS PERMISSIVE FOR ALL TO {authenticated}
    USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'owner'::text, 'teacher'::text]))))))
    WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'owner'::text, 'teacher'::text]))))));

CREATE POLICY "admin read grants" ON public.test_attempt_grants AS PERMISSIVE FOR SELECT TO {authenticated}
    USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'owner'::text, 'teacher'::text, 'smm'::text, 'manager'::text]))))));

CREATE POLICY "user read own grants" ON public.test_attempt_grants AS PERMISSIVE FOR SELECT TO {authenticated}
    USING ((user_id = auth.uid()));

CREATE POLICY "tattempts_insert" ON public.test_attempts AS PERMISSIVE FOR INSERT TO {public}
    WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "tattempts_select" ON public.test_attempts AS PERMISSIVE FOR SELECT TO {public}
    USING ((auth.uid() IS NOT NULL));

CREATE POLICY "tattempts_update" ON public.test_attempts AS PERMISSIVE FOR UPDATE TO {public}
    USING ((auth.uid() = user_id));

CREATE POLICY "tattempts_update_staff" ON public.test_attempts AS PERMISSIVE FOR UPDATE TO {authenticated}
    USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['owner'::text, 'admin'::text, 'smm'::text, 'teacher'::text]))))));

CREATE POLICY "tgitems_delete" ON public.test_group_items AS PERMISSIVE FOR DELETE TO {public}
    USING ((auth.uid() IS NOT NULL));

CREATE POLICY "tgitems_insert" ON public.test_group_items AS PERMISSIVE FOR INSERT TO {public}
    WITH CHECK ((auth.uid() IS NOT NULL));

CREATE POLICY "tgitems_select" ON public.test_group_items AS PERMISSIVE FOR SELECT TO {public}
    USING ((auth.uid() IS NOT NULL));

CREATE POLICY "tgitems_update" ON public.test_group_items AS PERMISSIVE FOR UPDATE TO {public}
    USING ((auth.uid() IS NOT NULL));

CREATE POLICY "tgroups_delete" ON public.test_groups AS PERMISSIVE FOR DELETE TO {public}
    USING ((auth.uid() IS NOT NULL));

CREATE POLICY "tgroups_insert" ON public.test_groups AS PERMISSIVE FOR INSERT TO {public}
    WITH CHECK ((auth.uid() IS NOT NULL));

CREATE POLICY "tgroups_select" ON public.test_groups AS PERMISSIVE FOR SELECT TO {public}
    USING ((auth.uid() IS NOT NULL));

CREATE POLICY "tgroups_update" ON public.test_groups AS PERMISSIVE FOR UPDATE TO {public}
    USING ((auth.uid() IS NOT NULL));

CREATE POLICY "tests_delete" ON public.tests AS PERMISSIVE FOR DELETE TO {public}
    USING ((auth.uid() IS NOT NULL));

CREATE POLICY "tests_insert" ON public.tests AS PERMISSIVE FOR INSERT TO {public}
    WITH CHECK ((auth.uid() IS NOT NULL));

CREATE POLICY "tests_select" ON public.tests AS PERMISSIVE FOR SELECT TO {public}
    USING (true);

CREATE POLICY "tests_update" ON public.tests AS PERMISSIVE FOR UPDATE TO {public}
    USING ((auth.uid() IS NOT NULL));

CREATE POLICY "trash: delete" ON public.trash AS PERMISSIVE FOR DELETE TO {authenticated}
    USING (is_admin());

CREATE POLICY "trash: insert" ON public.trash AS PERMISSIVE FOR INSERT TO {authenticated}
    WITH CHECK (true);

CREATE POLICY "trash: read" ON public.trash AS PERMISSIVE FOR SELECT TO {authenticated}
    USING (is_admin());

CREATE POLICY "trash_owner_select" ON public.trash AS PERMISSIVE FOR SELECT TO {authenticated}
    USING ((get_current_role() = 'owner'::text));

CREATE POLICY "trusted_ips_delete" ON public.trusted_ips AS PERMISSIVE FOR DELETE TO {authenticated}
    USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['owner'::text, 'admin'::text]))))));

CREATE POLICY "trusted_ips_insert" ON public.trusted_ips AS PERMISSIVE FOR INSERT TO {authenticated}
    WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['owner'::text, 'admin'::text]))))));

CREATE POLICY "trusted_ips_select" ON public.trusted_ips AS PERMISSIVE FOR SELECT TO {authenticated}
    USING (true);

CREATE POLICY "admin_read_login_sessions" ON public.user_login_sessions AS PERMISSIVE FOR SELECT TO {public}
    USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));

CREATE POLICY "own_insert_login_session" ON public.user_login_sessions AS PERMISSIVE FOR INSERT TO {public}
    WITH CHECK ((user_id = auth.uid()));

CREATE POLICY "own_update_login_session" ON public.user_login_sessions AS PERMISSIVE FOR UPDATE TO {public}
    USING ((user_id = auth.uid()));

CREATE POLICY "admin_read_nav_log" ON public.user_nav_log AS PERMISSIVE FOR SELECT TO {public}
    USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));

CREATE POLICY "own_insert_nav_log" ON public.user_nav_log AS PERMISSIVE FOR INSERT TO {public}
    WITH CHECK ((user_id = auth.uid()));

CREATE POLICY "admin_all_session" ON public.user_sessions AS PERMISSIVE FOR ALL TO {public}
    USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));

CREATE POLICY "own_all_session" ON public.user_sessions AS PERMISSIVE FOR ALL TO {public}
    USING ((user_id = auth.uid()))
    WITH CHECK ((user_id = auth.uid()));

-- ── Functions ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_create_user(p_email text, p_password text, p_full_name text DEFAULT ''::text, p_role text DEFAULT 'user'::text, p_last_name text DEFAULT NULL::text, p_first_name text DEFAULT NULL::text, p_patronymic text DEFAULT NULL::text, p_login text DEFAULT NULL::text, p_phone text DEFAULT NULL::text, p_gender text DEFAULT NULL::text, p_birth_date text DEFAULT NULL::text, p_city text DEFAULT NULL::text, p_job_position text DEFAULT NULL::text, p_subdivision text DEFAULT NULL::text, p_label text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_caller_role TEXT;
    v_user_id     UUID := gen_random_uuid();
BEGIN
    -- Перевірка прав
    SELECT role INTO v_caller_role FROM public.profiles WHERE id = auth.uid();
    IF v_caller_role NOT IN ('owner', 'admin') THEN
        RAISE EXCEPTION 'Access denied: owner or admin required';
    END IF;

    -- Перевірка унікальності email
    IF EXISTS (SELECT 1 FROM auth.users WHERE email = LOWER(TRIM(p_email))) THEN
        RAISE EXCEPTION 'Email % вже зайнятий', p_email;
    END IF;

    -- Перевірка унікальності логіну
    IF p_login IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.profiles WHERE LOWER(login) = LOWER(TRIM(p_login))
    ) THEN
        RAISE EXCEPTION 'Логін % вже зайнятий', p_login;
    END IF;

    -- Створюємо запис в auth.users
    INSERT INTO auth.users (
        id, instance_id,
        aud, role,
        email, encrypted_password,
        email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data,
        is_super_admin,
        created_at, updated_at,
        confirmation_token, recovery_token,
        email_change_token_new, email_change
    ) VALUES (
        v_user_id,
        '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated',
        LOWER(TRIM(p_email)),
        crypt(p_password, gen_salt('bf')),
        NOW(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('full_name', p_full_name, 'role', p_role),
        FALSE,
        NOW(), NOW(),
        '', '', '', ''
    );

    -- Прив'язуємо identity (потрібно для входу email/password)
    INSERT INTO auth.identities (
        id, user_id, provider_id,
        identity_data, provider,
        last_sign_in_at, created_at, updated_at
    ) VALUES (
        gen_random_uuid(),
        v_user_id,
        LOWER(TRIM(p_email)),
        jsonb_build_object('sub', v_user_id::text, 'email', LOWER(TRIM(p_email))),
        'email',
        NOW(), NOW(), NOW()
    );

    -- Оновлюємо профіль (тригер on_auth_user_created вже створив рядок)
    UPDATE public.profiles SET
        full_name    = p_full_name,
        last_name    = p_last_name,
        first_name   = p_first_name,
        patronymic   = p_patronymic,
        role         = p_role,
        login        = p_login,
        phone        = p_phone,
        gender       = p_gender,
        birth_date   = CASE WHEN p_birth_date IS NOT NULL AND p_birth_date != ''
                            THEN p_birth_date::DATE ELSE NULL END,
        city         = p_city,
        job_position = p_job_position,
        subdivision  = p_subdivision,
        label        = p_label
    WHERE id = v_user_id;

    RETURN v_user_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.admin_get_users()
 RETURNS TABLE(id uuid, full_name text, last_name text, first_name text, patronymic text, email text, login text, role text, is_active boolean, is_hidden boolean, avatar_url text, phone text, gender text, birth_date date, city text, job_position text, subdivision text, label text, bio text, manager_id uuid, hired_at date, position_since date, created_at timestamp with time zone, last_sign_in_at timestamp with time zone, last_seen_at timestamp with time zone)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
    SELECT
        p.id, p.full_name, p.last_name, p.first_name, p.patronymic,
        p.email, p.login, p.role, p.is_active, p.is_hidden, p.avatar_url,
        p.phone, p.gender, p.birth_date, p.city,
        p.job_position, p.subdivision, p.label, p.bio, p.manager_id,
        p.hired_at, p.position_since,
        p.created_at,
        u.last_sign_in_at,
        p.last_seen_at
    FROM public.profiles p
    LEFT JOIN auth.users u ON u.id = p.id
    ORDER BY p.created_at DESC;
$function$
;

CREATE OR REPLACE FUNCTION public.admin_set_user_banned(p_user_id uuid, p_banned boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_role TEXT;
BEGIN
    -- Перевірка прав: лише owner або admin
    SELECT role INTO v_role
    FROM public.profiles
    WHERE id = auth.uid();

    IF v_role NOT IN ('owner', 'admin') THEN
        RAISE EXCEPTION 'Access denied: owner or admin required';
    END IF;

    IF p_banned THEN
        -- Забороняємо вхід: JWT буде відхилений при наступному запиті
        UPDATE auth.users
        SET banned_until = 'infinity'::timestamptz
        WHERE id = p_user_id;

        -- Видаляємо всі активні сесії та refresh-токени — миттєве виходження
        DELETE FROM auth.sessions       WHERE user_id = p_user_id;
        DELETE FROM auth.refresh_tokens WHERE user_id = p_user_id;
    ELSE
        -- Знімаємо блокування
        UPDATE auth.users
        SET banned_until = NULL
        WHERE id = p_user_id;
    END IF;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.admin_update_user_email(p_user_id uuid, p_email text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  UPDATE auth.users SET email = p_email, email_confirmed_at = now() WHERE id = p_user_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.admin_update_user_password(p_user_id uuid, p_password text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'extensions', 'public', 'auth'
AS $function$
BEGIN
  UPDATE auth.users
  SET encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf')),
      updated_at = now()
  WHERE id = p_user_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.admin_user_create(p_email text, p_password text, p_full_name text DEFAULT NULL::text, p_role text DEFAULT 'user'::text, p_last_name text DEFAULT NULL::text, p_first_name text DEFAULT NULL::text, p_patronymic text DEFAULT NULL::text, p_login text DEFAULT NULL::text, p_phone text DEFAULT NULL::text, p_gender text DEFAULT NULL::text, p_birth_date text DEFAULT NULL::text, p_city text DEFAULT NULL::text, p_job_position text DEFAULT NULL::text, p_subdivision text DEFAULT NULL::text, p_label text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
    v_caller_role TEXT;
    v_user_id     UUID := gen_random_uuid();
BEGIN
    -- Перевірка прав
    SELECT role INTO v_caller_role FROM public.profiles WHERE id = auth.uid();
    IF v_caller_role NOT IN ('owner', 'admin') THEN
        RAISE EXCEPTION 'Access denied: owner or admin required';
    END IF;

    -- Перевірка унікальності email
    IF EXISTS (SELECT 1 FROM auth.users WHERE email = LOWER(TRIM(p_email))) THEN
        RAISE EXCEPTION 'Email % вже зайнятий', p_email;
    END IF;

    -- Перевірка унікальності логіну
    IF p_login IS NOT NULL AND TRIM(p_login) != '' AND EXISTS (
        SELECT 1 FROM public.profiles WHERE LOWER(login) = LOWER(TRIM(p_login))
    ) THEN
        RAISE EXCEPTION 'Логін % вже зайнятий', p_login;
    END IF;

    -- Створюємо запис в auth.users
    INSERT INTO auth.users (
        id, instance_id,
        aud, role,
        email, encrypted_password,
        email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data,
        is_super_admin,
        created_at, updated_at,
        confirmation_token, recovery_token,
        email_change_token_new, email_change
    ) VALUES (
        v_user_id,
        '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated',
        LOWER(TRIM(p_email)),
        crypt(p_password, gen_salt('bf')),
        NOW(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('full_name', p_full_name, 'role', p_role),
        FALSE,
        NOW(), NOW(),
        '', '', '', ''
    );

    -- Прив'язуємо identity (потрібно для входу email/password)
    INSERT INTO auth.identities (
        id, user_id, provider_id,
        identity_data, provider,
        last_sign_in_at, created_at, updated_at
    ) VALUES (
        gen_random_uuid(),
        v_user_id,
        LOWER(TRIM(p_email)),
        jsonb_build_object('sub', v_user_id::text, 'email', LOWER(TRIM(p_email))),
        'email',
        NOW(), NOW(), NOW()
    );

    -- Оновлюємо профіль (тригер on_auth_user_created вже створив рядок)
    UPDATE public.profiles SET
        full_name    = COALESCE(NULLIF(TRIM(p_full_name), ''), p_email),
        last_name    = p_last_name,
        first_name   = p_first_name,
        patronymic   = p_patronymic,
        role         = p_role,
        login        = p_login,
        phone        = p_phone,
        gender       = p_gender,
        birth_date   = CASE WHEN p_birth_date IS NOT NULL AND p_birth_date != ''
                            THEN p_birth_date::DATE ELSE NULL END,
        city         = p_city,
        job_position = p_job_position,
        subdivision  = p_subdivision,
        label        = p_label
    WHERE id = v_user_id;

    RETURN v_user_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.admin_user_delete(p_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
    v_caller_role TEXT;
    v_target_role TEXT;
BEGIN
    -- Перевірка прав (уникаємо SELECT role INTO — role зарезервоване слово)
    v_caller_role := (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid());
    IF v_caller_role NOT IN ('owner','admin') THEN
        RAISE EXCEPTION 'Access denied: owner or admin required';
    END IF;

    -- Не можна видалити себе
    IF p_user_id = auth.uid() THEN
        RAISE EXCEPTION 'Cannot delete your own account';
    END IF;

    -- Не можна видалити owner
    v_target_role := (SELECT p.role FROM public.profiles p WHERE p.id = p_user_id);
    IF v_target_role = 'owner' THEN
        RAISE EXCEPTION 'Cannot delete the owner account';
    END IF;

    -- Адмін не може видаляти інших адмінів — тільки owner може
    IF v_target_role = 'admin' AND v_caller_role <> 'owner' THEN
        RAISE EXCEPTION 'Only owner can delete admin accounts';
    END IF;

    -- Видаляємо з auth.users (CASCADE видалить profiles через FK)
    DELETE FROM auth.users WHERE id = p_user_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.enforce_single_owner()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    IF NEW.role = 'owner' AND OLD.role <> 'owner' THEN
        -- Знімаємо owner з попереднього власника
        UPDATE public.profiles
        SET role = 'admin'
        WHERE role = 'owner' AND id <> NEW.id;
    END IF;
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.fn_snapshot_intern_on_profile_delete()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    UPDATE public.interns
    SET profile_snapshot = jsonb_build_object(
        'full_name',    OLD.full_name,
        'email',        OLD.email,
        'phone',        OLD.phone,
        'city',         OLD.city,
        'job_position', OLD.job_position,
        'gender',       OLD.gender,
        'avatar_url',   OLD.avatar_url,
        'archived_at',  NOW()
    )
    WHERE profile_id = OLD.id
      AND profile_snapshot IS NULL;  -- don't overwrite existing snapshot
    RETURN OLD;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_current_role()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
    SELECT role FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$function$
;

CREATE OR REPLACE FUNCTION public.get_db_size()
 RETURNS json
 LANGUAGE sql
 SECURITY DEFINER
AS $function$
  SELECT json_build_object(
    'db_bytes',      pg_database_size(current_database()),
    'db_pretty',     pg_size_pretty(pg_database_size(current_database())),
    'storage_bytes', COALESCE(
                       (SELECT SUM((metadata->>'size')::bigint)
                        FROM storage.objects
                        WHERE metadata IS NOT NULL),
                       0),
    'storage_pretty', pg_size_pretty(COALESCE(
                       (SELECT SUM((metadata->>'size')::bigint)
                        FROM storage.objects
                        WHERE metadata IS NOT NULL),
                       0)::bigint)
  );
$function$
;

CREATE OR REPLACE FUNCTION public.get_email_by_login(p_login text)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
    SELECT email FROM public.profiles WHERE LOWER(login) = LOWER(p_login) LIMIT 1;
$function$
;

CREATE OR REPLACE FUNCTION public.get_today_birthdays()
 RETURNS TABLE(id uuid, full_name text, job_position text, subdivision text, city text, avatar_url text, birth_date date)
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
    SELECT id, full_name, job_position, subdivision, city, avatar_url, birth_date
    FROM public.profiles
    WHERE birth_date IS NOT NULL
      AND is_active = true
      AND EXTRACT(month FROM birth_date) = EXTRACT(month FROM CURRENT_DATE)
      AND EXTRACT(day   FROM birth_date) = EXTRACT(day   FROM CURRENT_DATE);
$function$
;

CREATE OR REPLACE FUNCTION public.get_trash_items()
 RETURNS TABLE(id uuid, type text, item_id uuid, item_data jsonb, deleted_by uuid, deleted_by_name text, deleted_at timestamp with time zone, expires_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
    SELECT
        t.id,
        t.type,
        t.item_id,
        t.item_data,
        t.deleted_by,
        COALESCE(p.full_name, p.email, 'Невідомо') AS deleted_by_name,
        t.deleted_at,
        t.expires_at
    FROM public.trash t
    LEFT JOIN public.profiles p ON p.id = t.deleted_by
    WHERE t.expires_at > NOW()
      AND public.get_current_role() = 'owner'
    ORDER BY t.deleted_at DESC;
$function$
;

CREATE OR REPLACE FUNCTION public.get_user_role(uid uuid DEFAULT auth.uid())
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
    SELECT role FROM public.profiles WHERE id = uid;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)),
        COALESCE(NEW.raw_user_meta_data->>'role', 'student')
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.interns_snapshot_on_unlink()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
    p public.profiles%ROWTYPE;
BEGIN
    -- Fire only when profile_id changes from non-null to null
    IF OLD.profile_id IS NOT NULL AND NEW.profile_id IS NULL THEN
        SELECT * INTO p FROM public.profiles WHERE id = OLD.profile_id;
        IF FOUND AND (NEW.profile_snapshot IS NULL OR NEW.profile_snapshot = '{}'::jsonb) THEN
            NEW.profile_snapshot := jsonb_build_object(
                'full_name',    p.full_name,
                'email',        p.email,
                'phone',        p.phone,
                'city',         p.city,
                'job_position', p.job_position,
                'gender',       p.gender,
                'avatar_url',   p.avatar_url,
                'archived_at',  to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
            );
        END IF;
    END IF;
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role IN ('owner','admin')
  );
$function$
;

CREATE OR REPLACE FUNCTION public.is_manager()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role IN ('owner','admin','manager')
  );
$function$
;

CREATE OR REPLACE FUNCTION public.is_owner()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'owner' AND is_active = true
    );
$function$
;

CREATE OR REPLACE FUNCTION public.is_staff()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role IN ('owner','admin','smm','teacher')
  );
$function$
;

CREATE OR REPLACE FUNCTION public.is_teacher_or_admin(uid uuid DEFAULT auth.uid())
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
    SELECT EXISTS(SELECT 1 FROM public.profiles WHERE id = uid AND role IN ('admin','teacher'));
$function$
;

CREATE OR REPLACE FUNCTION public.is_teacher_or_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role IN ('owner','admin','smm','teacher') AND is_active = true
    );
$function$
;

CREATE OR REPLACE FUNCTION public.resources_set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$function$
;

CREATE OR REPLACE FUNCTION public.set_interns_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$function$
;

CREATE OR REPLACE FUNCTION public.sync_full_name()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.full_name := NULLIF(TRIM(
        COALESCE(NEW.last_name, '')
        || CASE WHEN NEW.first_name  IS NOT NULL AND NEW.first_name  <> '' THEN ' ' || NEW.first_name  ELSE '' END
        || CASE WHEN NEW.patronymic  IS NOT NULL AND NEW.patronymic  <> '' THEN ' ' || NEW.patronymic  ELSE '' END
    ), '');
    -- Якщо і ПІБ порожнє — fallback на email
    IF NEW.full_name IS NULL OR NEW.full_name = '' THEN
        NEW.full_name := COALESCE(NULLIF(TRIM(NEW.email), ''), '');
    END IF;
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.sync_intern_position_to_profile()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    -- Only act when position_id actually changes
    IF NEW.position_id IS DISTINCT FROM OLD.position_id THEN
        UPDATE public.profiles
        SET position_id  = NEW.position_id,
            job_position = CASE
                WHEN NEW.position_id IS NULL THEN job_position
                ELSE (SELECT name FROM public.positions WHERE id = NEW.position_id)
            END
        WHERE id = NEW.profile_id;
    END IF;
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.test_create(p_email text, p_password text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_id UUID := gen_random_uuid();
BEGIN
    RETURN v_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.test_ping()
 RETURNS text
 LANGUAGE sql
AS $function$ SELECT 'pong' $function$
;

CREATE OR REPLACE FUNCTION public.trash_cleanup()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE v_count INTEGER;
BEGIN
    DELETE FROM public.trash WHERE expires_at < NOW();
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.trash_restore(p_trash_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'extensions'
AS $function$
DECLARE
    v_type     TEXT;
    v_data     JSONB;
    v_user_id  UUID;
BEGIN
    IF public.get_current_role() <> 'owner' THEN
        RAISE EXCEPTION 'Access denied: owner only';
    END IF;

    v_type := (SELECT t.type      FROM public.trash t WHERE t.id = p_trash_id);
    v_data := (SELECT t.item_data FROM public.trash t WHERE t.id = p_trash_id);

    IF v_type IS NULL THEN
        RAISE EXCEPTION 'Запис у кошику не знайдено';
    END IF;

    IF v_type = 'page' THEN
        IF EXISTS (SELECT 1 FROM public.custom_pages WHERE id = (v_data->>'id')::UUID) THEN
            RAISE EXCEPTION 'Сторінка вже існує';
        END IF;
        INSERT INTO public.custom_pages
        SELECT * FROM jsonb_populate_record(NULL::public.custom_pages,
            v_data || jsonb_build_object('created_by',
                CASE WHEN EXISTS(SELECT 1 FROM public.profiles WHERE id = (v_data->>'created_by')::UUID)
                     THEN v_data->>'created_by' ELSE auth.uid()::text END
            )
        );

    ELSIF v_type = 'news' THEN
        IF EXISTS (SELECT 1 FROM public.news WHERE id = (v_data->>'id')::UUID) THEN
            RAISE EXCEPTION 'Новина вже існує';
        END IF;
        INSERT INTO public.news
        SELECT * FROM jsonb_populate_record(NULL::public.news,
            v_data || jsonb_build_object('author_id',
                CASE WHEN EXISTS(SELECT 1 FROM public.profiles WHERE id = (v_data->>'author_id')::UUID)
                     THEN v_data->>'author_id' ELSE auth.uid()::text END
            )
        );

    ELSIF v_type = 'resource' THEN
        IF EXISTS (SELECT 1 FROM public.resources WHERE id = (v_data->>'id')::UUID) THEN
            RAISE EXCEPTION 'Ресурс вже існує';
        END IF;
        INSERT INTO public.resources
        SELECT * FROM jsonb_populate_record(NULL::public.resources,
            v_data || jsonb_build_object(
                'lesson_id',
                CASE WHEN (v_data->>'lesson_id') IS NOT NULL
                          AND EXISTS(SELECT 1 FROM public.lessons WHERE id = (v_data->>'lesson_id')::UUID)
                     THEN v_data->>'lesson_id' ELSE NULL END,
                'course_id',
                CASE WHEN (v_data->>'course_id') IS NOT NULL
                          AND EXISTS(SELECT 1 FROM public.courses WHERE id = (v_data->>'course_id')::UUID)
                     THEN v_data->>'course_id' ELSE NULL END
            )
        );

    ELSIF v_type = 'user' THEN
        v_user_id := (v_data->>'id')::UUID;

        IF EXISTS (SELECT 1 FROM auth.users WHERE id = v_user_id) THEN
            RAISE EXCEPTION 'Користувач вже існує';
        END IF;
        IF EXISTS (SELECT 1 FROM auth.users WHERE email = LOWER(TRIM(v_data->>'email'))) THEN
            RAISE EXCEPTION 'Email % вже зайнятий', v_data->>'email';
        END IF;

        INSERT INTO auth.users (
            id, instance_id, aud, role,
            email, encrypted_password,
            email_confirmed_at,
            raw_app_meta_data, raw_user_meta_data,
            is_super_admin,
            created_at, updated_at,
            confirmation_token, recovery_token,
            email_change_token_new, email_change
        ) VALUES (
            v_user_id,
            '00000000-0000-0000-0000-000000000000',
            'authenticated', 'authenticated',
            LOWER(TRIM(v_data->>'email')),
            v_data->>'encrypted_password',  -- оригінальний хеш пароля
            NOW(),
            '{"provider":"email","providers":["email"]}'::jsonb,
            jsonb_build_object('role', v_data->>'role'),
            FALSE,
            NOW(), NOW(),
            '', '', '', ''
        );

        INSERT INTO auth.identities (
            id, user_id, provider_id, identity_data, provider,
            last_sign_in_at, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), v_user_id,
            LOWER(TRIM(v_data->>'email')),
            jsonb_build_object('sub', v_user_id::text, 'email', LOWER(TRIM(v_data->>'email'))),
            'email', NOW(), NOW(), NOW()
        );

        UPDATE public.profiles SET
            last_name    = v_data->>'last_name',
            first_name   = v_data->>'first_name',
            patronymic   = v_data->>'patronymic',
            login        = v_data->>'login',
            phone        = v_data->>'phone',
            gender       = v_data->>'gender',
            city         = v_data->>'city',
            job_position = v_data->>'job_position',
            subdivision  = v_data->>'subdivision',
            label        = v_data->>'label',
            bio          = v_data->>'bio',
            role         = v_data->>'role',
            birth_date   = CASE WHEN (v_data->>'birth_date') IS NOT NULL
                                     AND (v_data->>'birth_date') <> 'null'
                                THEN (v_data->>'birth_date')::DATE ELSE NULL END,
            is_active    = TRUE
        WHERE id = v_user_id;

        DELETE FROM public.trash WHERE id = p_trash_id;

        RETURN jsonb_build_object(
            'type',      'user',
            'full_name', COALESCE(v_data->>'full_name', v_data->>'email')
        );
    END IF;

    DELETE FROM public.trash WHERE id = p_trash_id;

    RETURN jsonb_build_object('type', v_type);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.trg_profile_to_trash()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'extensions'
AS $function$
DECLARE
    v_caller      UUID;
    v_enc_pw      TEXT;
BEGIN
    v_caller := auth.uid();
    IF v_caller IS NOT NULL AND v_caller <> OLD.id THEN
        v_enc_pw := (SELECT u.encrypted_password FROM auth.users u WHERE u.id = OLD.id);
        INSERT INTO public.trash (type, item_id, item_data, deleted_by)
        VALUES (
            'user',
            OLD.id,
            row_to_json(OLD)::jsonb || jsonb_build_object('encrypted_password', v_enc_pw),
            v_caller
        );
    END IF;
    RETURN OLD;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.trg_to_trash()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
BEGIN
    INSERT INTO public.trash (type, item_id, item_data, deleted_by)
    VALUES (
        TG_ARGV[0],
        OLD.id,
        row_to_json(OLD)::jsonb,
        auth.uid()   -- ID адміна, що видаляє (з JWT)
    );
    RETURN OLD;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_course_progress(p_user_id uuid, p_course_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_total     INTEGER;
    v_completed INTEGER;
    v_pct       INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_total
    FROM public.lessons WHERE course_id = p_course_id AND is_published = true;

    IF v_total = 0 THEN RETURN; END IF;

    SELECT COUNT(*) INTO v_completed
    FROM public.lesson_progress lp
    JOIN public.lessons l ON l.id = lp.lesson_id
    WHERE lp.user_id = p_user_id AND l.course_id = p_course_id AND lp.completed = true;

    v_pct := (v_completed * 100) / v_total;

    UPDATE public.enrollments
    SET progress_percentage = v_pct,
        completed_at = CASE WHEN v_pct = 100 THEN NOW() ELSE NULL END
    WHERE user_id = p_user_id AND course_id = p_course_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_red_folder_items_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $function$
;

CREATE OR REPLACE FUNCTION public.user_has_group_access(p_group_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles p
        JOIN public.access_groups ag ON ag.id = p_group_id
        WHERE p.id = auth.uid()
          AND p.is_active = true
          AND (
            ag.is_public = true
            OR (
              (NOT EXISTS(SELECT 1 FROM public.access_group_cities      WHERE group_id = ag.id)
               OR p.city         IN (SELECT city       FROM public.access_group_cities      WHERE group_id = ag.id))
              AND
              (NOT EXISTS(SELECT 1 FROM public.access_group_positions   WHERE group_id = ag.id)
               OR p.job_position IN (SELECT position   FROM public.access_group_positions   WHERE group_id = ag.id))
              AND
              (NOT EXISTS(SELECT 1 FROM public.access_group_departments WHERE group_id = ag.id)
               OR p.subdivision  IN (SELECT department FROM public.access_group_departments WHERE group_id = ag.id))
              AND
              (NOT EXISTS(SELECT 1 FROM public.access_group_labels      WHERE group_id = ag.id)
               OR p.label        IN (SELECT label      FROM public.access_group_labels      WHERE group_id = ag.id))
            )
          )
    );
$function$
;

-- ── Triggers ─────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_access_groups_upd ON public.access_groups;
CREATE TRIGGER trg_access_groups_upd BEFORE UPDATE ON public.access_groups FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_collections_upd ON public.collections;
CREATE TRIGGER trg_collections_upd BEFORE UPDATE ON public.collections FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_courses_upd ON public.courses;
CREATE TRIGGER trg_courses_upd BEFORE UPDATE ON public.courses FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_custom_pages_updated_at ON public.custom_pages;
CREATE TRIGGER trg_custom_pages_updated_at BEFORE UPDATE ON public.custom_pages FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_pages_to_trash ON public.custom_pages;
CREATE TRIGGER trg_pages_to_trash BEFORE DELETE ON public.custom_pages FOR EACH ROW EXECUTE FUNCTION trg_to_trash('page');

DROP TRIGGER IF EXISTS feedback_reports_updated_at ON public.feedback_reports;
CREATE TRIGGER feedback_reports_updated_at BEFORE UPDATE ON public.feedback_reports FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_intern_schedule_templates ON public.intern_schedule_templates;
CREATE TRIGGER set_updated_at_intern_schedule_templates BEFORE UPDATE ON public.intern_schedule_templates FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS intern_position_sync ON public.interns;
CREATE TRIGGER intern_position_sync AFTER UPDATE OF position_id ON public.interns FOR EACH ROW EXECUTE FUNCTION sync_intern_position_to_profile();

DROP TRIGGER IF EXISTS interns_snapshot_on_unlink ON public.interns;
CREATE TRIGGER interns_snapshot_on_unlink BEFORE UPDATE ON public.interns FOR EACH ROW EXECUTE FUNCTION interns_snapshot_on_unlink();

DROP TRIGGER IF EXISTS interns_updated_at ON public.interns;
CREATE TRIGGER interns_updated_at BEFORE UPDATE ON public.interns FOR EACH ROW EXECUTE FUNCTION set_interns_updated_at();

DROP TRIGGER IF EXISTS trg_lessons_upd ON public.lessons;
CREATE TRIGGER trg_lessons_upd BEFORE UPDATE ON public.lessons FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_news_to_trash ON public.news;
CREATE TRIGGER trg_news_to_trash BEFORE DELETE ON public.news FOR EACH ROW EXECUTE FUNCTION trg_to_trash('news');

DROP TRIGGER IF EXISTS trg_news_upd ON public.news;
CREATE TRIGGER trg_news_upd BEFORE UPDATE ON public.news FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_profile_to_trash ON public.profiles;
CREATE TRIGGER trg_profile_to_trash BEFORE DELETE ON public.profiles FOR EACH ROW EXECUTE FUNCTION trg_profile_to_trash();

DROP TRIGGER IF EXISTS trg_profiles_upd ON public.profiles;
CREATE TRIGGER trg_profiles_upd BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_single_owner ON public.profiles;
CREATE TRIGGER trg_single_owner BEFORE UPDATE OF role ON public.profiles FOR EACH ROW EXECUTE FUNCTION enforce_single_owner();

DROP TRIGGER IF EXISTS trg_snapshot_intern_on_profile_delete ON public.profiles;
CREATE TRIGGER trg_snapshot_intern_on_profile_delete BEFORE DELETE ON public.profiles FOR EACH ROW EXECUTE FUNCTION fn_snapshot_intern_on_profile_delete();

DROP TRIGGER IF EXISTS trg_sync_full_name ON public.profiles;
CREATE TRIGGER trg_sync_full_name BEFORE INSERT OR UPDATE OF last_name, first_name, patronymic, email ON public.profiles FOR EACH ROW EXECUTE FUNCTION sync_full_name();

DROP TRIGGER IF EXISTS trg_red_folder_items_updated_at ON public.red_folder_items;
CREATE TRIGGER trg_red_folder_items_updated_at BEFORE UPDATE ON public.red_folder_items FOR EACH ROW EXECUTE FUNCTION update_red_folder_items_updated_at();

DROP TRIGGER IF EXISTS resources_updated_at ON public.resources;
CREATE TRIGGER resources_updated_at BEFORE UPDATE ON public.resources FOR EACH ROW EXECUTE FUNCTION resources_set_updated_at();

DROP TRIGGER IF EXISTS trg_resources_to_trash ON public.resources;
CREATE TRIGGER trg_resources_to_trash BEFORE DELETE ON public.resources FOR EACH ROW EXECUTE FUNCTION trg_to_trash('resource');

DROP TRIGGER IF EXISTS trg_resources_upd ON public.resources;
CREATE TRIGGER trg_resources_upd BEFORE UPDATE ON public.resources FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS surveys_updated_at ON public.surveys;
CREATE TRIGGER surveys_updated_at BEFORE UPDATE ON public.surveys FOR EACH ROW EXECUTE FUNCTION set_updated_at();

