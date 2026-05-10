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

Six roles checked via `AppState`: `owner > admin > smm > teacher > manager > user`. Key helpers: `AppState.isAdmin()`, `AppState.isStaff()`, `AppState.canSchedule()`. Pages redirect to dashboard if the user lacks the required role.

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

All Supabase calls live here, grouped by domain: `API.profiles`, `API.courses`, `API.lessons`, `API.tests`, `API.questions`, `API.testImages`, `API.notifications`, `API.attempts`, etc. Always throws on error so callers can try/catch.

### Database migrations

`sql/migration_v*.sql` — incremental, numbered. The current schema is the result of applying all migrations in order. When adding a new column/table, create `migration_v{N+1}.sql` and run it in the Supabase SQL Editor. Latest is v33 (`answers.image_align`).

## Key files

| File | What it does |
|------|-------------|
| `js/config.js` | Supabase credentials, `AppState`, `APP_CONFIG` (buckets, roles) |
| `js/app.js` | Route definitions, sidebar rendering, post-login bootstrap |
| `js/api.js` | All DB/storage access — add new methods here, never call `supabase` from page files |
| `js/pages/tests-manager.js` | Largest page (~2300 lines): test builder, question editor (Quill), auto-assign, results |
| `js/pages/admin.js` | Multi-tab admin panel: users, courses, tests, logs |
| `css/main.css` | Single stylesheet, CSS variables for light/dark theming (`--primary`, `--bg-surface`, `--border`, etc.) |

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
