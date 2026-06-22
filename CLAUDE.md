# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Session start

At the start of every new conversation, before taking any task:
1. Run `git log --oneline -5` and `git status`
2. Read relevant memory files from `C:\Users\neoli\.claude\projects\d--lms\memory\`
3. Output a brief summary: last commits, dirty files, current migration version, key reminders from memory

## Self-review after writing code

After writing or editing any JS code, before reporting the task as done, always review your own output for:
1. **XSS** — every DB string in `innerHTML` must be wrapped in `Fmt.esc()`. Exceptions: UUIDs, Fmt.* output, intentional HTML (Quill). URLs from DB must use `Fmt.safeUrl()`.
2. **onclick injection** — non-UUID strings passed to onclick must use `data-*` attribute pattern, not string interpolation. UUIDs are safe with single quotes.
3. **UTC date bugs** — never use `new Date(dateStr + 'T00:00:00').toISOString()` — it shifts UTC+ users by one day. Use `new Date(Date.UTC(y, m-1, d)).toISOString()` or `_fmtLocal()`.
4. **Missing await** — async calls inside loops or sequences must be awaited; fire-and-forget only when intentional.
5. **Silent error swallow** — `.catch(() => {})` hides real failures. Only swallow when genuinely non-critical; otherwise `.catch(e => console.error(...))` or rethrow.
6. **Badge/counter drift** — only update UI counters (badges, counts) after confirming the DB operation succeeded, not unconditionally.

## Project Overview

LMS "Скарбниця" — a learning management system for a Ukrainian pawnshop chain. Vanilla JS SPA deployed on Vercel, backed by Supabase (PostgreSQL + Auth + Storage).

**No build step.** Open `index.html` directly in a browser or use any static file server. All dependencies load from CDN.

## Architecture

### Request flow

```
index.html
  → js/config.js   (Supabase client, AppState, APP_CONFIG)
  → js/utils.js    (Toast, Modal, Loader, Fmt, Dom, Theme, UI)
  → js/api.js      (all Supabase calls, organized by domain)
  → js/auth.js     (login/logout, session restore, block-status watcher)
  → js/router.js   (hash-based SPA router)
  → js/app.js      (boots app, defines all routes, renders sidebar)
  → js/pages/*.js  (one object per page, each has .init(container, params))
```

Scripts must load in this exact order — they rely on globals set by earlier scripts.

### Routing

Hash-based: `#/courses/123` → route `courses/:id`. Defined in `js/app.js` via `Router.define({...})`. Each route calls `PageModule.init(container, params)`. Routes can return a cleanup function.

### Role system

Six roles checked via `AppState`: `owner > admin > smm > teacher > manager > user`. Key helpers:

| Helper | Roles included |
|--------|---------------|
| `AppState.isOwner()` | owner |
| `AppState.isAdmin()` | admin, owner |
| `AppState.isStaff()` | owner, admin, smm, teacher |
| `AppState.canSchedule()` | owner, admin, manager |
| `AppState.isManager()` | manager only |

Default redirect after login: staff → `dashboard`, user/manager → `knowledge-base`. Pages redirect to `dashboard` (or `knowledge-base`) if the user lacks the required role.

### Impersonation

Admins can preview the app as another user. Key methods on `AppState`:
- `AppState.impersonate(targetProfile)` — saves real profile to `_realProfile`, swaps `AppState.profile`, re-renders sidebar and navigation
- `AppState.stopImpersonating()` — restores real profile
- `AppState.isImpersonating()` — returns `true` when impersonation is active

`ImpersonationBanner` (global, defined in `js/app.js`) shows/hides the banner UI. When writing permission checks, use `AppState.profile.role` — it already reflects the impersonated role.

### Global objects (all window-scoped)

| Object | Purpose |
|--------|---------|
| `supabase` | Supabase JS client |
| `AppState` | Current user, profile, role helpers |
| `APP_CONFIG` | Bucket names, roles, app metadata |
| `API` | All DB calls (namespaced: `API.tests`, `API.courses`, etc.) |
| `Router` | Navigation: `Router.go('path')` |
| `Toast` | `Toast.success/error/warning/info(title, body)` |
| `Modal` | `Modal.open({title, body, footer})`, `Modal.confirm(msg)` |
| `Loader` | `Loader.show()` / `Loader.hide()` (ref-counted) |
| `Fmt` | Date/time formatting: `Fmt.date`, `Fmt.dateShort`, `Fmt.datetime` |
| `Dom` | `Dom.val(id)` → `getElementById(id).value` |
| `UI` | Breadcrumb, sidebar, theme. News popup bell: `UI.toggleNewsPopup()` — `.np-hero` / `.np-hero-bg` / `.np-hero-img` / `.np-hero-grad` styles defined inline in `js/utils.js` → `toggleNewsPopup()`. |

### Page module pattern

Every page in `js/pages/` exports a single object with at least `init(container, params)`:

```js
const SomePage = {
    async init(container, params = {}) {
        if (!AppState.isStaff()) { Router.go('dashboard'); return; }
        // render HTML into container
        container.innerHTML = `...`;
        // wire up events, fetch data
    }
};
```

### API layer (`js/api.js`)

All Supabase calls live here, grouped by domain. Always throws on error so callers can try/catch.

Full namespace list: `API.profiles`, `API.courses`, `API.enrollments`, `API.lessons`, `API.resources`, `API.scorm`, `API.tests`, `API.questions`, `API.testImages`, `API.notifications`, `API.attempts`, `API.progress`, `API.pages`, `API.pageAttachments`, `API.news`, `API.directories`, `API.dovirenosti`, `API.documentDownloads`, `API.birthdays`, `API.accessGroups`, `API.analytics`, `API.system`, `API.surveys`, `API.redFolderItems`, `API.companyBdayMessages`.

### Database migrations

`sql/schema.sql` — consolidated schema snapshot of the current DB state. All migrations v2–v109 have been merged into this single file. When adding a new column/table, create `sql/migration_v124.sql` (increment from 124) and run it in the Supabase SQL Editor. **Latest is v123**.

When writing a migration, always include `IF NOT EXISTS` / `IF EXISTS` guards and end with RLS + policies.

## Key files

| File | What it does |
|------|-------------|
| `js/config.js` | Supabase credentials, `AppState`, `APP_CONFIG` (buckets, roles, `pageSize: 12`) |
| `js/app.js` | Route definitions, sidebar rendering, post-login bootstrap, `ImpersonationBanner` |
| `js/api.js` | All DB/storage access — add new methods here, never call `supabase` from page files |
| `js/pages/dashboard.js` | Main dashboard: 2-row CSS grid layout (docs/notif/calendar + continue/news), Realtime notification badge. `CompanyBirthdayModal._initDashboardChat()` called on init — renders birthday chat card in `.db-cal-col` (visible only on 9 Nov or via `demo()`). News modal: `DashboardPage._openNewsModal(id)` — `.dnm-hero` / `.dnm-hero-bg` / `.dnm-hero-img` styles defined inline inside `_openNewsModal`. |
| `js/pages/tests-manager.js` | Largest page (~2300 lines): test builder, question editor (Quill), auto-assign, results |
| `js/pages/admin.js` | Multi-tab admin panel: users, courses, tests, logs |
| `js/pages/scheduler.js` | Schedule management (owner/admin/manager only — `canSchedule()`) |
| `js/pages/schedule-graph.js` | Visual schedule graph |
| `js/pages/access-groups.js` | Access group management (city/position/department/label filters) |
| `js/pages/label-access.js` | Label-based content access rules |
| `js/pages/expert-path.js` | Expert learning paths — tabs: шляхи / курси / тести / опитування |
| `js/pages/surveys.js` | Surveys module — entry: `SurveysPage.renderInTab(area)`; embedded in expert-path tab |
| `js/pages/analytics.js` | Usage analytics dashboard |
| `js/pages/branch-docs.js` | Куточок споживача — tab embedded in documents (`ResourcesPage`), entry: `BranchDocsPage.renderInTab(area)` |
| `js/pages/red-folder.js` | Червона папка — tab embedded in documents, entry: `RedFolderPage.renderInTab(area)` |
| `css/main.css` | Single stylesheet, CSS variables for light/dark theming (`--primary`, `--bg-surface`, `--border`, etc.) |

### Pagination

`APP_CONFIG.pageSize = 12`. Use this constant (not a hardcoded number) when fetching paginated lists.

## CDN dependencies (available globally)

| Global | Library | Version |
|--------|---------|---------|
| `supabase` | Supabase JS | 2.x |
| `Quill` | Quill editor | 1.3.7 |
| `Chart` | Chart.js | 4.4.0 |
| `XLSX` | SheetJS | 0.20.1 |
| `JSZip` | JSZip | 3.10.1 |
| `FontAwesome` | FA 6 (CSS) | — |

No npm, no build step — all loaded from CDN in `index.html`.

## Database schema (key tables)

All PKs are UUID. All tables have `created_at TIMESTAMPTZ DEFAULT NOW()`. Tables with mutable data also have `updated_at` maintained by trigger. snake_case everywhere.

| Table | Key columns | Notes |
|-------|-------------|-------|
| `profiles` | `id` (= auth.uid), `email`, `full_name`, `role`, `avatar_url`, `is_active`, `is_blocked`, `job_position`, `city`, `subdivision`, `gender`, `label` | Extends `auth.users`; auto-created by trigger on signup. `label`: `intern`\|`mentor` (v49). `gender`: `male`\|`female`\|`other` |
| `courses` | `title`, `teacher_id`, `category`, `level`, `is_published`, `is_featured`, `tags TEXT[]` | |
| `enrollments` | `user_id`, `course_id`, `progress_percentage`, `completed_at` | UNIQUE(user_id, course_id) |
| `lessons` | `course_id`, `title`, `order_index`, `is_published`, `is_free_preview` | |
| `resources` | `lesson_id`, `course_id`, `title`, `type` (pdf/video/link/scorm/file/image/document), `storage_path`, `url`, `requires_ack`, `deadline_days`, `is_deleted`, `display_block` (branch-docs block key), `dovirenost_id` (direct FK for branch-docs/red-folder uploads), `red_folder_item_id` (FK → red_folder_items) | Used for KB, documents, branch-docs, and red-folder |
| `red_folder_items` | `id`, `number`, `title`, `documents`, `responsible`, `icon` | Items in Червона папка; resources linked via `red_folder_item_id` |
| `resource_dovirenosti` | `resource_id`, `dovirenost_id` | Many-to-many for regular docs (documents view); branch-docs and red-folder use direct `dovirenost_id` on resources instead |
| `tests` | `course_id`, `lesson_id`, `title`, `passing_score`, `max_attempts`, `time_limit_minutes`, `randomize_questions`, `is_published`, `allow_skip` | |
| `questions` | `test_id`, `question_text`, `question_type` (single/multiple/true_false), `points`, `order_index` | |
| `answers` | `question_id`, `answer_text`, `is_correct`, `order_index`, `image_url`, `image_align` | `answer_text` stores Quill HTML |
| `test_attempts` | `user_id`, `test_id`, `attempt_number`, `score`, `percentage`, `passed`, `completed_at` | |
| `news` | `title`, `content`, `excerpt`, `thumbnail_url`, `thumbnail_position`, `author_id`, `is_published`, `is_pinned` | `thumbnail_position`: `left`\|`center`\|`right` — apply via `background-position` on div, not `object-position` on img |
| `notifications` | `user_id`, `title`, `message`, `type`, `is_read`, `link` | |
| `company_bday_messages` | `user_id`, `message`, `year` | Chat for company birthday (9 Nov); Realtime enabled; v89 |
| `pages` | `title`, `slug`, `content` (HTML), `is_published`, `access_type` | CMS pages for collections |
| `schedule_events` | `title`, `start_time`, `end_time`, `location_id`, `created_by` | |
| `access_groups` | `name`, `cities`, `positions`, `departments`, `labels` | Filter groups for content access |
| `dovirenosti` | document approval/acknowledgement records | |
| `surveys` | `title`, `description`, `created_by`, `is_published`, `is_anonymous`, `deadline_at`, `access_group_id` | v50 |
| `survey_questions` | `survey_id`, `text`, `type` (`single`\|`multiple`\|`text`\|`rating`\|`scale`), `options` (jsonb), `is_required`, `order_index` | |
| `survey_responses` | `survey_id`, `user_id`, `session_id`, `submitted_at` | |
| `survey_answers` | `response_id`, `question_id`, `value`, `selected_options` (jsonb) | |

> `schema.sql` is the baseline. Migrations `v2–v50` add columns — check the latest migration for the most current column list on any table.

## All routes

| Route | Page module | Notes |
|-------|-------------|-------|
| `dashboard` | `DashboardPage` | |
| `knowledge-base` | `ResourcesPage` | `view: 'kb'`; default for user/manager |
| `documents` | `ResourcesPage` | `view: 'docs'`; tabs include Куточок споживача (`branch-docs`) and Червона папка (`red-folder`) |
| `branch-docs` | `BranchDocsPage` | Accessible directly but **not in sidebar** — only tab in Документи |
| `resource/:id` | `ResourceViewPage` | |
| `courses` | `CoursesPage` | |
| `courses/:id` | `CourseViewPage` | |
| `lessons/:id` | `LessonViewPage` | |
| `tests/:id` | `TestsPage` | |
| `my-tests` | `MyTestsPage` | |
| `tests-manager` | — | Redirects → `admin?tab=tests` |
| `analytics` | `AnalyticsPage` | Has `destroy()` cleanup |
| `admin` | `AdminPage` | Accepts `?tab=` param |
| `collections` | `CollectionsPage` | |
| `collections/:id` | `CollectionsPage.initView` | |
| `news` / `news/:id` | `NewsPage` | |
| `scheduler` | `SchedulerPage` | canSchedule() roles |
| `schedule-graph` | `ScheduleGraphPage` / `ScheduleGraphEmployee` | `?view=employee` switches module |
| `schedule-view` | `ScheduleViewPage` | |
| `my-calendar` | `MyCalendarPage` | |
| `notifications` | `NotificationsPage` | Has `destroy()` cleanup |
| `contacts` | `ContactsPage` | |
| `bookmarks` | `BookmarksPage` | |
| `label-access` | `LabelAccessPage` | owner/admin only |
| `expert-path` | `ExpertPathPage` | |
| `profile` | inline in `App` | |
| `results` | inline in `App` | |

## Utility API reference

### Toast
```js
Toast.success(title, message?)
Toast.error(title, message?)
Toast.warning(title, message?)
Toast.info(title, message?)
```

### Modal
```js
Modal.open({ title, body, footer, size, onClose })
// size: 'sm' | 'lg' | 'xl' | '' (default)
// body/footer accept raw HTML

Modal.close()

const confirmed = await Modal.confirm({ title?, message, confirmText?, danger? })
// Returns Promise<boolean>. danger:true → red confirm button.
```

### Loader
```js
Loader.show()   // ref-counted
Loader.hide()   // decrement; hides when count reaches 0
```

### Fmt
```js
Fmt.date(d)              // '12 травня 2026'
Fmt.dateShort(d)         // '12.05.26'
Fmt.time(d)              // '14:30'
Fmt.datetime(d)          // '12.05.26 14:30'
Fmt.duration(minutes)    // '2год 15хв'
Fmt.fileSize(bytes)      // '1.4 МБ'
Fmt.pct(n)               // '73%'
Fmt.num(n)               // localized number
Fmt.role(r)              // 'Адміністратор'
Fmt.roleBadge(r)         // HTML <span class="badge ...">
Fmt.level(l)             // 'Початковий'
Fmt.initials(name)       // 'ІП'
Fmt.slug(str)            // url-safe slug
Fmt.esc(str)             // HTML-escape for innerHTML
Fmt.safeUrl(url)         // blocks javascript:/data: schemes
Fmt.parseDatePaste(e, input)  // handles DD.MM.YYYY paste into date input
Fmt.completionStatus(s)  // SCORM completion label
Fmt.successStatus(s)     // SCORM success label
```

### Dom
```js
Dom.val(id)              // getElementById(id).value
Dom.setVal(id, val)      // getElementById(id).value = val
Dom.qs(sel, parent?)     // querySelector
Dom.qsa(sel, parent?)    // querySelectorAll → Array
Dom.on(el, event, fn)    // addEventListener helper
Dom.createDropZone(container, { accept, label, hint })
```

### Page cleanup pattern

Pages with timers or subscriptions implement an optional `destroy()` method. The router calls it on navigation away:

```js
// In app.js route definition:
'my-route': async ({ container }) => {
    await MyPage.init(container);
    return () => MyPage.destroy?.();
}

// In the page module:
const MyPage = {
    _timer: null,
    async init(container) { this._timer = setInterval(...); },
    destroy() { clearInterval(this._timer); }
};
```

Currently only `analytics` and `notifications` routes use this pattern.

## Adding a new page

1. Create `js/pages/my-page.js` with the page module pattern (see above)
2. Add `<script src="js/pages/my-page.js"></script>` in `index.html` **before** `<script src="js/app.js"></script>` (last script)
3. Add a route in `js/app.js` inside `Router.define({...})`
4. Add a sidebar entry in `UI._getNavItems(role)` in **`js/utils.js`** (not app.js) for the appropriate role(s)

## Sidebar navigation

`UI.renderNavigation(role)` and `UI._getNavItems(role)` live in `js/utils.js`, not `js/app.js`.

Nav items visible per role:

| Role | Sections |
|------|---------|
| owner / admin | Навчання, Управління (Аналітика + Планування + Адміністрування + Обмеження доступу), Особисте |
| manager | Навчання, Управління (Планування only), Особисте |
| smm | Навчання, Управління (Аналітика + **Контент** + Планування), Особисте |
| teacher | Навчання, Управління (Аналітика + Планування), Особисте |
| user | Навчання, Особисте (+ Планування hidden) |

Note: `smm` sees the `admin` route labelled **"Контент"** — same page, different label.

`contentItems` (shared across all roles) includes: Головна, Skill Up, Новини, База знань, Документи (with badge), Меню порталу. **Куточок споживача is intentionally NOT in the sidebar** — it's accessible only as a tab inside the Документи page.

## Storage URLs

- **Public buckets** (`course-thumbnails`, `news-images`, `avatars`): use `APP_CONFIG.storagePublicUrl + '/' + bucket + '/' + path`
- **Private buckets** (`lesson-resources`, `scorm-packages`, `page-files`, `test-images`): use `API.*` methods that call `createSignedUrl()` — URLs expire in 1 hour (`APP_CONFIG.signedUrlExpiry = 3600`). Never cache signed URLs between user sessions.

## RLS reminder

Every new table needs RLS enabled + at least one policy or all queries will be silently blocked. Include in every migration:
```sql
ALTER TABLE my_table ENABLE ROW LEVEL SECURITY;
-- then add policies
```

## Tests-manager specifics (most complex module)

- **Quill 1.3.7** used for question and answer editors. Load order matters: icons and attributors must be registered via `_quillSetup()` before any `new Quill(...)` call.
- `quill.root.innerHTML = text` to load content (not `dangerouslyPasteHTML` — it strips inline styles).
- Image resize/alignment overlays attach to `.ql-container` (parent), not `.ql-editor`, to avoid Quill's MutationObserver errors.
- AbortController pattern: `_initImageResize(quill)` returns an `AbortController`; call `ac.abort()` to remove all listeners when switching questions.
- Font/size use `attributors/style/*` (inline styles), not the default class-based attributors.
- Toolbar font/size labels need CSS `content: attr(data-value)` overrides — Quill's Snow theme only has built-in labels for its own preset values.
- answer_text for single/multiple questions stores Quill HTML — render with `innerHTML`, not as plain text.

## Storage buckets

Defined in `APP_CONFIG.buckets`. Each bucket needs a migration for creation + RLS policies before use:
- `course-thumbnails`, `lesson-resources`, `scorm-packages`, `news-images`, `avatars`, `page-files`, `test-images`

## CSS conventions

All colours and spacing use CSS variables from `css/main.css`. Always use `var(--primary)`, `var(--border)`, `var(--bg-surface)`, etc. — never hardcode hex values except in one-off inline styles inside JS template literals where a variable isn't accessible.

## Security — write safe HTML from the start

These rules are mandatory whenever writing template literals in `js/pages/*.js`. Do not add them as a cleanup step — apply them immediately.

### Rule 1 — `Fmt.esc()` for any DB value in innerHTML

Every string from the database inserted into an HTML template must be wrapped in `Fmt.esc()`. This includes `full_name`, `email`, `title`, `description`, `category`, `excerpt`, `job_position`, `city`, `subdivision`, `bio`, `name`, `label`, tags, and any other user-supplied text.

```js
// WRONG
`<div>${user.full_name}</div>`

// RIGHT
`<div>${Fmt.esc(user.full_name)}</div>`
```

Exceptions (safe without escaping): values returned by `Fmt.*` functions, hardcoded string literals, UUIDs, content intentionally stored as HTML (Quill editor output).

### Rule 2 — `JSON.stringify` for string args in onclick

Never pass user-controlled strings into onclick via single-quote interpolation. The `.replace(/'/g, "\\'")`  pattern has a backslash bypass vulnerability. Use `JSON.stringify` instead.

```js
// WRONG
`onclick="doSomething('${title.replace(/'/g, "\\'")}')"`

// RIGHT
`onclick="doSomething(${JSON.stringify(title).replace(/"/g, '&quot;')})"`
```

UUIDs are safe to interpolate directly with single quotes: `'${record.id}'`.

### Rule 3 — `Fmt.safeUrl()` for user-entered URLs in href/src

Any URL from a DB field (not a Supabase storage signed URL) must go through `Fmt.safeUrl()` to block `javascript:`, `data:`, and `vbscript:` schemes.

```js
// WRONG
`<a href="${resource.url}">Відкрити</a>`

// RIGHT
`<a href="${Fmt.safeUrl(resource.url)}" rel="noopener noreferrer">Відкрити</a>`
```

Also add `rel="noopener noreferrer"` to every `target="_blank"` link.

### Rule 4 — `data-*` attribute pattern for display-only values in onclick

When a value is only used for display (toast message, confirm dialog text), store it in a `data-*` attribute and read via `this.dataset.*`. This avoids passing the value through JS string context entirely.

```js
`<button data-name="${Fmt.esc(user.full_name)}"
         onclick="doSomething('${user.id}', this.dataset.name)">
    Action
</button>`
```

### Security utilities available in `Fmt` (`js/utils.js`)

| Function | Purpose |
|----------|---------|
| `Fmt.esc(str)` | HTML-escape `< > " ' &` for safe innerHTML insertion |
| `Fmt.safeUrl(url)` | Returns `#` if URL uses `javascript:`, `data:`, or `vbscript:` |

## Known gotchas

### Router.go() on the current route does nothing
`Router.go('news')` when already on `#/news` does **not** re-render. To refresh the current page call `PageModule.init(container, {})` directly:
```js
const container = document.getElementById('page-content');
if (container) await SomePage.init(container, {});
else Router.go('some-route');
```

### setBreadcrumb onClick
`UI.setBreadcrumb` supports an `onClick` callback for items that need in-page navigation instead of a route change:
```js
UI.setBreadcrumb([
    { label: 'Новини', onClick: () => NewsPage._backToList() },
    { label: 'Редагування' }
]);
```

### FA icons in onclick handlers
Setting icon via `this.textContent = '<i class="fa...">'` renders literal tags. Always use `this.innerHTML`. When building the icon HTML inside an onclick attribute, escape quotes: `&lt;i class=&quot;fa-solid fa-eye&quot;&gt;&lt;/i&gt;` — or better, toggle a CSS class instead.

### Password / icon toggle buttons inside inputs
Wrap the input in `position:relative` container. Button style: `position:absolute;right:10px;top:50%;transform:translateY(-50%)`. Set icon with `btn.innerHTML = '<i class="fa-solid fa-eye"></i>'`, not `textContent`.

### Contacts page — gender colour themes
`ContactsPage._genderTheme(gender)` returns gradient stops:
- `female`: `#ec4899` → `#8b5cf6`
- `male`: `#3b82f6` → `#6366f1`
- `other` / null: `#10b981` → `#0ea5e9`

### Profile label field (v49)
`profiles.label` is `intern` | `mentor` | null (CHECK constraint). Render as:
- `intern` → `badge-success` + "🌱 Стажер"
- `mentor` → `badge-warning` + "⭐ Наставник"
In forms, use `<select>` — never a free text input. Only `owner`/`admin` can set it.

## schedule-graph.js specifics (second largest module, ~6200 lines)

Three objects in one file: `ScheduleGraphPage` (manager view), `ScheduleGraphEmployee` (employee view), `ScheduleViewPage` (read-only viewer).

### Key state fields — ScheduleGraphPage
| Field | Purpose |
|-------|---------|
| `_locations` | All locations the manager owns/views |
| `_locId` | Currently selected location id (`'all'` = all-locs view) |
| `_assignments` | Employees assigned to current location |
| `_entries` | `{userId_date → entry}` for current month |
| `_tab` | `'schedule'` \| `'subst'` \| `'log'` \| `'trash'` |
| `_quickType` | Active quick-fill shift type key, or null |
| `_locSortAlpha` | Sort sidebar A→Z (owner only), persisted in localStorage |
| `_locCreators` | `{created_by → full_name}` for owner display in header bar |
| `_pastMonthUnlocked` | Whether past month editing is unlocked |

### Render flow
`_render(container)` → sets full `container.innerHTML`. After innerHTML: applies saved sidebar width from `localStorage('sg_sidebar_w')`. Always call `_render(this._container)` to refresh UI — never patch DOM directly.

### Tabs
- Single location: `📅 Графік | 🔄 Підміни | 📋 Журнал змін` + trash button
- `_locId === 'all'`: only `🔄 Підміни` tab + trash button

### Assignments — is_primary
`schedule_assignments.is_primary boolean DEFAULT true`. `false` = substitute (підміна). In `_nameCell`: filled `fa-solid fa-star` = primary, outline `fa-regular fa-star` = substitute. Badge `sg-temp-badge` shown inline for substitutes.

### Shift cell coloring
`sg-cell-sub` class added to cell when `!a.is_primary && dispShift` — substitutes get lighter styling. `dispType`: if `!a.is_primary` and `shift_type === 'work'` → display as `day_off` (substitute's "work" looks like day off for them).

### CSS styles location
All CSS is inside `_styles()` method at the bottom of `ScheduleGraphPage`. `ScheduleViewPage` has its own `_styles()`. Both are injected via template literal at end of `_render()` innerHTML.

### Sidebar resize
Drag handle between sidebar and content (`sg-sidebar-resizer`). Width saved to `localStorage('sg_sidebar_w')`, CSS var `--sg-sidebar-w`. Restored after every `_render`.

### ScheduleViewPage — location picker
Replaces tab bar with searchable dropdown (`sgv-loc-search` + `sgv-loc-dropdown`). On focus → `_openLocList()` shows all; on input → `_filterLocs(q)` filters; on select → `_pickLoc(locId, name)`. Works for 200+ locations.

## Notification logic for documents

Two functions send notifications when a document is saved/updated (called from `ResourcesPage.saveResource`):

| Function | When | Recipients |
|----------|------|-----------|
| `API.documentDownloads.notifyOnPublish(resource, isUpdate)` | `is_tracked_download = true` | Staff + users who have a matching dovirenost in `resource_dovirenosti` → `profile_dovirenosti`. **No fallback to all users.** If no dovirenosti assigned — only staff. |
| `API.notifications.notifyResourcePublished(resource, link, isUpdate)` | `is_tracked_download = false` | Staff + `_resolveNotifyUserIds()`: checks `resource_dovirenosti` first, then `access_group_id`, then all users as last resort. |

**Critical order in `saveResource` for updates:** `setDovirenosti` must be called and **awaited** before the notify function — otherwise `_resolveNotifyUserIds` queries stale data from `resource_dovirenosti`.

**`openForm()` guard:** Before opening the edit form, always ensure `_accessGroups` and `_allDovirenosti` are loaded. `openForm()` already does this — do not remove the guard. If either is empty when the form is saved, `access_group_id` gets reset to `null` and `resource_dovirenosti` gets wiped, causing notify to fall back to all users.

## CompanyBirthdayModal (`js/app.js`)

Celebrates company birthday (9 November). Active only that day; use `CompanyBirthdayModal.demo()` to test.

- **Compact card** in `.db-cal-col` — always rendered when `_initDashboardChat()` is called; shows message count badge
- **Fullscreen overlay** — opens on card click; backdrop blur, Esc/backdrop to close
- **Realtime** — channel `cbd-chat-{year}` on `company_bday_messages` filtered by `year`
- **Table** `company_bday_messages`: `user_id`, `message` (1–500 chars), `year` — `API.companyBdayMessages.getByYear(year)` / `.add(text)` / `.remove(id)`
- **Delete** — user can delete only their own messages (RLS + ✕ button shown only for `isMe`)

## dashboard.js specifics

### Layout
Two-row CSS grid (`db-main-grid`): `grid-template-columns: 1fr 1fr 390px`.
- Row 1: `db-alerts-docs` | `db-alerts-notif` | `db-cal-widget`
- Row 2: `db-continue` (350px wide wrapper) | empty | `db-news-widget`

### Notifications — Supabase Realtime
`UI._subscribeNotifications()` in `js/utils.js` opens a Realtime channel on `notifications` table filtered by `user_id`. Called once after `UI.loadNotificationCount()`. The `notifications` table must be in `supabase_realtime` publication (added in migration v63).

### Date formatting in calendar
**Never use `.toISOString().slice(0,10)`** — it converts local midnight to UTC causing a +1 day shift for UTC+ users. Always use local formatter:
```js
const _pad = n => String(n).padStart(2, '0');
const _fmtLocal = d => `${d.getFullYear()}-${_pad(d.getMonth()+1)}-${_pad(d.getDate())}`;
```

### Theme-aware sidebar logo
`index.html` sidebar has two `<img>` tags inside `.logo-icon`: `.logo-dark` (shown by default) and `.logo-light` (shown when `body.light-theme`). CSS in `main.css` toggles `display` based on theme class.

### Notification insert (tests-manager.js)
Supabase JS v2 `.insert()` never throws — always returns `{data, error}`. Check `r.error` explicitly after `Promise.all`. Type `'test_assigned'` is valid (constraint dropped in v63).

### Schedule entries in dashboard calendar
`_renderCalWidget(calEvents, today, scheduleEntries)` stores shifts in `this._calViewShifts = { date → entry }`. `_drawCalWidget()` renders a colored dot on grid cells and shift cards in today/future sections. `_calNav(dir)` fetches both `personal_cal_events` and `schedule_entries` in parallel for the new month. Shift color map: `work=#10b981`, `day_off=#8b5cf6`, `vacation=#f59e0b`, `sick=#ef4444`.

### Unacked docs badge — dovirenost filtering
Both `DashboardPage._getUnackedDocs()` and `UI.loadDocBadge()` filter tracked docs by the user's dovirenosti for non-admin/non-manager users. Pattern:
```js
const seeAll = AppState.isAdmin() || AppState.isManager();
// fetch docs with resource_dovirenosti(dovirenost_id)
// if (!seeAll): get myDovs via API.dovirenosti.getForProfile(), filter docs
// docs with no resource_dovirenosti entries are visible to all
```

## branch-docs.js and red-folder.js specifics

Both modules are tabs inside the Документи page (`ResourcesPage`). Entry point: `BranchDocsPage.renderInTab(area)` / `RedFolderPage.renderInTab(area)`.

### Dovirenost filtering
- `canManage = AppState.isAdmin()` — only admins can add/edit/delete items
- `seeAll = AppState.isAdmin() || AppState.isManager()` — managers see all docs
- Regular users: fetch `API.dovirenosti.getForProfile(userId)` → build `myDovIds` Set → filter docs where `!d.dovirenost_id || myDovIds.has(d.dovirenost_id)`
- Branch-docs and red-folder use `dovirenost_id` column **directly on the resource** (not `resource_dovirenosti` join table)

### File upload — safe filename
Always sanitize filename before upload: `file.name.replace(/[^a-zA-Z0-9._-]/g, '_')`. Raw Cyrillic filenames cause Supabase Storage 400 errors.

### Loader.show/hide in renderInTab
**Never call `Loader.show()` / `Loader.hide()` inside `renderInTab()`** — it creates a full-screen overlay blocking tab clicks. Use a local inline spinner instead.

### API.resources.getAll() exclusions
`getAll()` excludes branch-docs and red-folder resources automatically:
- `.is('display_block', null)` — excludes branch-docs
- `.is('red_folder_item_id', null)` — excludes red-folder docs

### resources.js docs view — pagination
Docs view loads `pageSize: 500, page: 0` to get all docs at once, then filters frontend-side by dovirenost. Pagination count uses `filtered.length` (not the DB `count`) to avoid mismatch after frontend filtering. Category chips are built from the full loaded list, not the current page.

### RedFolderPage state
| Field | Purpose |
|-------|---------|
| `_items` | All red_folder_items rows |
| `_docs` | All red-folder resources (filtered by dovirenost) |
| `_iconOptions` | 7 icon options (same set as branch-docs) |

### API.redFolderItems
`getAll()`, `create(fields)`, `update(id, fields)`, `remove(id)` — CRUD for `red_folder_items` table.

### API.resources.getRedFolderDocs()
Returns resources where `red_folder_item_id IS NOT NULL`. Selects `id, title, red_folder_item_id, type, storage_path, dovirenost_id`.

## surveys.js specifics

Entry point: `SurveysPage.renderInTab(area)` — called from `ExpertPathPage._renderSurveys(area)`.

### Visibility logic
- `canManage` (admin/smm/owner): sees all surveys
- `isStaff` (teacher): sees published surveys
- regular user/manager: sees only assigned surveys via `survey_assignments` table

### State fields (avoid passing through onclick attrs)
| Field | Purpose |
|-------|---------|
| `_takeState` | `{surveyId, questions}` — set before `_submitResponse()` |
| `_builderSurveyId` | Current survey id in builder |
| `_builderQuestions` | Questions array in builder |

### onclick patterns — survey-specific
- Survey card open: `onclick="SurveysPage.openBuilder('${s.id}')"` — UUID with single quotes, safe
- Delete with title: `data-title="${Fmt.esc(s.title)}" onclick="SurveysPage._deleteSurvey('${s.id}',this.dataset.title)"`
- Never `JSON.stringify(uuid)` — generates `"uuid"` with double quotes that break HTML attribute parsing

### Image upload
Uses `test-images` bucket (private), path `surveys/{qid}/timestamp.ext`. `_uploadQImage(qid, input)` / `_removeQImage(qid)`.

## Known onclick/HTML gotchas (hard-won lessons)

### `<\i>` and `<\button>` cause "Unexpected end of input"
Backslash in closing tags (`<\i>`, `<\button>`) inside template literals causes JS parse error at eval time. Always `</i>`, `</button>`.

### JSON.stringify(uuid) breaks onclick
`JSON.stringify(record.id)` produces `"uuid-string"` with double quotes — browser truncates `onclick="..."` attribute at the first `"`. Use `'${record.id}'` (single-quote interpolation) for UUIDs only.

### Passing objects/arrays through onclick
Never stringify complex data into onclick. Store in page-level state (`this._someState = data`) and call method with no args.

### supabase .in() with null values
If array passed to `.in('id', ids)` contains `null`, query may error or behave unexpectedly. Always `.filter(Boolean)` before `.in()`.

### API.profiles.getAll() returns {data, count}
Not a flat array — destructure: `const { data } = await ...` or use `data || []`.

### hash-based TOC links trigger router
`<a href="#section-id">` changes the URL hash → SPA router fires → navigates away. Use `<button onclick="document.getElementById('id').scrollIntoView({behavior:'smooth'})">` instead.

### Modal scoped CSS
When embedding rich HTML in `Modal.open({body})`, prefix all CSS classes to avoid collisions with global LMS styles. E.g. `.sg-man .mock-table thead { background: transparent }` to override LMS global `thead` background.

### _render() resets DOM completely
After `container.innerHTML = ...` all DOM state is lost. Restore persistent UI state (sidebar width, etc.) immediately after assignment, not in event handlers.

## Доступ для недовіреної мережі

За замовчуванням більшість розділів заблоковані поза довіреною мережею (`AppState.isTrustedNetwork === false`). Щоб відкрити конкретний розділ або вкладку — потрібно зробити три речі:

### 1. Роутер (`js/app.js`) — пропустити `requireTrusted()`

У функції роуту `admin` додай окрему гілку **до** виклику `requireTrusted()`:

```js
'admin': async ({ container, params }) => {
    if (!AppState.isTrustedNetwork && AppState.isAdmin()) {
        if (params.tab === 'my-tab') {
            UI.setBreadcrumb([{ label: 'Назва' }]);
            // Варіант А — iframe (окремий HTML-файл):
            container.innerHTML = `<div style="height:calc(100vh - 120px)">
                <iframe src="/my-file.html" style="width:100%;height:100%;border:none;border-radius:var(--radius-lg)"></iframe>
            </div>`;
            // Варіант Б — метод AdminPage напряму (без вкладок):
            // container.innerHTML = '<div id="admin-content"></div>';
            // await AdminPage._renderMyTab(container.querySelector('#admin-content'));
            return;
        }
    }
    if (!requireTrusted()) return;
    await AdminPage.init(container, params);
},
```

> **Важливо:** завжди викликай конкретний метод `AdminPage._renderXxx()` або рендери iframe напряму — **ніколи** не викликай `AdminPage.init()` для недовіреної мережі, бо це рендерить усі вкладки і дає доступ до всього розділу.

### 2. Мобільний nav (`js/utils.js`) — додати маршрут до `allowed`

У `applyMobNavRestrictions()` додай маршрут до множини `allowed` щоб кнопка не блокувалась іконкою заборони:

```js
if (AppState.isAdmin()) {
    allowed.add('admin');      // вже є
    allowed.add('my-route');   // додай свій
}
```

### 3. Мобільний nav (`js/utils.js`) — замінити кнопку (якщо потрібно)

Якщо хочеш показати окрему кнопку в мобільному меню для недовіреної мережі — зроби це в `applyMobNavRestrictions()` через `getElementById` + умову `AppState.isAdmin()`:

```js
const btn = document.getElementById('mob-some-btn');
if (btn) {
    if (AppState.isAdmin()) {
        btn.onclick = () => Router.go('admin?tab=my-tab');
        btn.dataset.route = 'admin';
        btn.innerHTML = '<i class="fa-solid fa-icon"></i><span>Назва</span>';
    } else {
        // відновити дефолт
    }
}
```

### Поточні винятки для недовіреної мережі

| Маршрут | Роль | Що рендериться |
|---------|------|----------------|
| `admin?tab=pleso` | admin/owner | iframe `/admin_pleso.html` |
| `admin?tab=trusted-ips` | admin/owner | `AdminPage._renderTrustedIps()` напряму |
