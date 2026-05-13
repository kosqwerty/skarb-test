# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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
| `UI` | Breadcrumb, sidebar, theme |

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

Full namespace list: `API.profiles`, `API.courses`, `API.enrollments`, `API.lessons`, `API.resources`, `API.scorm`, `API.tests`, `API.questions`, `API.testImages`, `API.notifications`, `API.attempts`, `API.progress`, `API.pages`, `API.pageAttachments`, `API.news`, `API.directories`, `API.dovirenosti`, `API.documentDownloads`, `API.birthdays`, `API.accessGroups`, `API.analytics`, `API.system`, `API.surveys`.

### Database migrations

`sql/migration_v*.sql` — incremental, numbered. The current schema is the result of applying all migrations in order. When adding a new column/table, create `migration_v{N+1}.sql` and run it in the Supabase SQL Editor. **Latest is v52** (`image_url` on `survey_questions`).

When writing a migration, always include `IF NOT EXISTS` / `IF EXISTS` guards and end with RLS + policies.

## Key files

| File | What it does |
|------|-------------|
| `js/config.js` | Supabase credentials, `AppState`, `APP_CONFIG` (buckets, roles, `pageSize: 12`) |
| `js/app.js` | Route definitions, sidebar rendering, post-login bootstrap, `ImpersonationBanner` |
| `js/api.js` | All DB/storage access — add new methods here, never call `supabase` from page files |
| `js/pages/tests-manager.js` | Largest page (~2300 lines): test builder, question editor (Quill), auto-assign, results |
| `js/pages/admin.js` | Multi-tab admin panel: users, courses, tests, logs |
| `js/pages/scheduler.js` | Schedule management (owner/admin/manager only — `canSchedule()`) |
| `js/pages/schedule-graph.js` | Visual schedule graph |
| `js/pages/access-groups.js` | Access group management (city/position/department/label filters) |
| `js/pages/label-access.js` | Label-based content access rules |
| `js/pages/expert-path.js` | Expert learning paths — tabs: шляхи / курси / тести / опитування |
| `js/pages/surveys.js` | Surveys module — entry: `SurveysPage.renderInTab(area)`; embedded in expert-path tab |
| `js/pages/analytics.js` | Usage analytics dashboard |
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
| `resources` | `lesson_id`, `course_id`, `title`, `type` (pdf/video/link/scorm/file/image/document), `storage_path`, `url`, `requires_ack`, `deadline_days`, `is_deleted` | Used for both KB and documents |
| `tests` | `course_id`, `lesson_id`, `title`, `passing_score`, `max_attempts`, `time_limit_minutes`, `randomize_questions`, `is_published`, `allow_skip` | |
| `questions` | `test_id`, `question_text`, `question_type` (single/multiple/true_false), `points`, `order_index` | |
| `answers` | `question_id`, `answer_text`, `is_correct`, `order_index`, `image_url`, `image_align` | `answer_text` stores Quill HTML |
| `test_attempts` | `user_id`, `test_id`, `attempt_number`, `score`, `percentage`, `passed`, `completed_at` | |
| `news` | `title`, `content`, `excerpt`, `thumbnail_url`, `thumbnail_position`, `author_id`, `is_published`, `is_pinned` | `thumbnail_position`: `left`\|`center`\|`right` — apply via `background-position` on div, not `object-position` on img |
| `notifications` | `user_id`, `title`, `message`, `type`, `is_read`, `link` | |
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
| `documents` | `ResourcesPage` | `view: 'docs'` |
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
