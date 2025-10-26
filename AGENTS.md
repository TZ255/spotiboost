# Spoti Boost SMM Panel — Implementation Blueprint

This document refines the original brief into a clear, implementation-ready plan. It specifies structure, routes, models, environment, coding standards, and acceptance criteria to enable fast, consistent delivery by a small team or an AI agent.

Last Synced: 2025-10-26T19:41:43.945Z

## Change Discipline
- Always update both `AGENTS.md` and `/LOGS/UPDATES.log` for every change.
- Use `npm run sync:docs` to stamp and log changes quickly.
- Significant decisions go to `/LOGS/COMMENTS.md`; features to `CHANGELOG.md`.

## Overview
- Goal: Build a Swahili-language SMM panel for Tanzania named Spoti Boost (www.spoti.co.tz).
- Stack: Express.js, EJS (layouts + partials), MongoDB (Mongoose), Bootstrap 5, HTMX, Passport + express-session.
- Priorities: Swahili-first UX, simplicity, modular code, admin-ready foundation.

## Environment & Setup
- Node: 18+ (LTS recommended)
- MongoDB: 6+
- Package manager: npm
- .env variables (required):
  - `PORT=3000`
  - `MONGODB_URI=mongodb://localhost:27017/spotiboost`
  - `SESSION_SECRET=<strong-random-string>`
  - `SESSION_NAME=sb.sid`
  - `BASE_URL=http://localhost:3000`
  - `RESEND_API_KEY=<resend-api-key>`
  - `RESEND_FROM="Spoti Boost <no-reply@spoti.co.tz>"`
  - Phone format (TZ): accept only numbers starting with `+255`, `255`, or `0`.
    - `+255` must have 13 characters total; `255` → 12; `0` → 10.
    - Implemented in `utils/phone.js#normalizePhone` and applied during registration.
- Scripts (recommended in `package.json`):
  - `dev`: `nodemon index.js`
  - `start`: `node index.js`

## Folder Structure
spotiboost/
│
├── index.js
├── package.json
├── .env
│
├── /config
│   ├── db.js             # Mongoose connection
│   └── passport.js       # Local strategy + serialize/deserialize
│
├── /models               # Mongoose schemas
│   ├── User.js
│   ├── Service.js
│   ├── Order.js
│   └── Transaction.js
│
├── /routes               # Express routers (mounted under index.js)
│   ├── index.js          # Home + static pages
│   ├── auth.js           # Login/register/logout/reset
│   ├── dashboard.js      # User area (guarded)
│   ├── api.js            # HTMX endpoints + JSON APIs
│   ├── blog.js           # Blog listing + post view
│   └── admin.js          # Admin-only routes (guarded by role)
│
├── /views
│   ├── /layouts
│   │   └── main.ejs
│   ├── /partials         # Header, footer, nav, alerts
│   ├── /fragments        # HTMX partial responses
│   ├── /index            # Landing page
│   │   └── index.ejs
│   ├── /auth             # Auth screens
│   │   ├── index.ejs     # Optional: auth hub
│   │   ├── login.ejs
│   │   ├── register.ejs
│   │   └── reset.ejs
│   ├── /dashboard        # User portal
│   │   ├── index.ejs
│   │   ├── add-funds.ejs
│   │   ├── services.ejs
│   │   ├── new-order.ejs
│   │   └── orders.ejs
│   ├── /admin            # Admin portal (role: admin)
│   │   ├── index.ejs     # Overview metrics
│   │   ├── services.ejs  # CRUD services
│   │   ├── orders.ejs    # Moderate orders
│   │   ├── users.ejs     # List/promote/ban users
│   │   └── transactions.ejs # Manual credit/debit
│   ├── /blog
│   │   └── index.ejs     # Start with list-only
│   └── /errors
│       ├── 404.ejs
│       └── 500.ejs
│
├── /public
│   ├── /css
│   ├── /js
│   ├── /images
│   └── /uploads
│
├── /middlewares
│   ├── authCheck.js        # ensureAuth, ensureGuest helpers
│   ├── adminCheck.js       # ensureAdmin (role-based guard)
│   ├── attachLocals.js     # expose user, flashes to views
│   ├── rateLimiter.js      # optional, basic limiter for auth/api
│   └── errorHandler.js     # Centralized error handler
│
└── /LOGS                 # AI-assisted project logbook
    ├── README.md
    ├── CHANGELOG.md
    ├── COMMENTS.md
    └── UPDATES.log

Notes on /LOGS
- Purpose: ensure continuity across contributors/agents.
- Use exactly this folder (/LOGS). Remove references to "/llm"; consolidate in /LOGS.
- Files:
  - README.md: explains logging practices and file purposes.
  - CHANGELOG.md: features, fixes, improvements per release.
  - COMMENTS.md: rationale for key decisions and trade-offs.
  - UPDATES.log: timestamped summaries per edit or instruction.

## Dependencies
- Runtime: express, express-session, passport, passport-local, mongoose, connect-mongo, ejs, express-ejs-layouts, dotenv, htmx.org, bcryptjs, morgan, compression, connect-flash
- Dev: nodemon

## Data Models (Mongoose)
User
- fields:
  - email: String, required, unique, lowercase, trim
  - passwordHash: String, required
  - name: String, required
  - phone: String, required, normalized E.164-like for TZ (`+255XXXXXXXXX`)
  - balance: Number, default 0
  - role: String, enum ["user", "admin"], default "user"
  - createdAt, updatedAt: Date
- indexes:
  - unique on email

Service
- fields:
  - name: String, required
  - category: String, required
  - description: String
  - pricePerUnit: Number, required
  - min: Number, default 10
  - max: Number, default 10000
  - isActive: Boolean, default true
  - createdAt, updatedAt: Date

Order
- fields:
  - userId: ObjectId<User>, required, indexed
  - serviceId: ObjectId<Service>, required
  - quantity: Number, required
  - link: String, required
  - status: String, enum ["pending", "processing", "completed", "failed"], default "pending"
  - price: Number, required
  - createdAt, updatedAt: Date

Transaction
- fields:
  - userId: ObjectId<User>, required, indexed
  - type: String, enum ["credit", "debit"], required
  - amount: Number, required
  - balanceAfter: Number, required
  - reference: String, optional (e.g., M-Pesa code)
  - createdAt: Date

## Routes & Views
Conventions
- All user-facing text in Swahili.
- Guarded routes require `authCheck.ensureAuth`.
- Use standard HTTP status codes and redirects.

Public
- `GET /` → `views/index/index.ejs` (Landing). Includes sections: hero, huduma (services highlight), bei (pricing preview), CTA "Jiunge".
- `GET /blog` → `views/blog/index.ejs` (List-only initially). Optional single post route later.

Auth
- `GET /auth/login` → login form
- `POST /auth/login` → authenticate (Passport local). On success → `/dashboard`, on failure → back with flash.
- `GET /auth/register` → register form
- `POST /auth/register` → if email exists: update that user’s name, phone, and password; otherwise create; auto-login then redirect to `/dashboard`.
- `GET /auth/reset` → reset form (email-only placeholder)
- `POST /auth/reset` → flash success message in Swahili; actual email integration later.
- `POST /auth/logout` → destroy session; redirect `/` with flash.
 

Dashboard (guarded)
- `GET /dashboard` → overview: salio (balance), shughuli za karibuni (recent orders/transactions).
- `GET /dashboard/services` → list all active services and prices.
- `GET /dashboard/new-order` → order form (select service, quantity, link). Shows computed total.
- `POST /dashboard/new-order` → create order; debit balance; create transaction.
- `GET /dashboard/orders` → user orders table with status.
- `GET /dashboard/add-funds` → add funds screen (placeholder for payment integration).
- `POST /dashboard/add-funds` → mock credit transaction for now; update balance.

HTMX Endpoints (progressive enhancement)
- Use forms that work without JS; enhance with HTMX where helpful.
- Suggested endpoints returning fragments under `views/fragments/`:
  - `GET /api/price?serviceId=...&qty=...` → returns `fragments/price.ejs` showing computed total.
  - `POST /api/orders` → returns `fragments/order-row.ejs` to prepend into orders table.
  - `POST /api/funds` → returns `fragments/balance.ejs` to update balance display.

Auth via HTMX
- Forms (register/login/reset) submit with `hx-post` to `/auth/*` endpoints and target a `#auth-messages` container per page.
- On success, server responds with `HX-Redirect` header to navigate (e.g., to `/dashboard`).
- On validation errors, return `views/fragments/auth-message.ejs` with messages array and a `kind` (`success|info|warning|danger`).

## Middlewares
- `authCheck.ensureAuth(req, res, next)` → if not logged in, redirect `/auth/login` with flash.
- `authCheck.ensureGuest(req, res, next)` → if logged in, redirect to `/dashboard`.
- `adminCheck.ensureAdmin(req, res, next)` → require `req.user.role === 'admin'`; else 403 or redirect with flash.
- `attachLocals(req, res, next)` → sets `res.locals.BASE_URL`, `canonical`, `siteName`, `path`, and default `title|description|keywords` fallbacks; used by layout for meta tags.
- Flash handling: only read/clear flashes if `req.session.flash` has keys to avoid creating/updating empty sessions (`saveUninitialized:false`).
- `rateLimiter` (optional) → lightweight limiter for `/auth/*` and `/api/*` (e.g., IP+route window counter). Keep configurable; can be a no-op in dev.
- `errorHandler` → centralized error capture; render `errors/500.ejs` with user-friendly Swahili message; log stack in server console only.

## Authentication (Passport Local)
- Username field: `email` (unique)
- Verify function: compare `bcryptjs.compare` on `password` vs `passwordHash`.
- Sessions: `express-session` + `connect-mongo` with TTL (7 days) and Mongo collection `sessions`.
- Cookie: `httpOnly`, `sameSite=lax`, `maxAge=7d`; store `ttl=7d`, `collectionName='sessions'`, `autoRemove='native'`.
- Serialize: by user `_id`. Minimal session payload.

## UI & EJS Conventions
- Layout: `layouts/main.ejs` contains `<header>`, `<nav>`, `<main>`, `<footer>`; yield with `<%- body %>`.
- Partials: `partials/nav.ejs`, `partials/alerts.ejs`, `partials/footer.ejs`.
- Alerts: use `connect-flash` keys `success`, `error`, `info`; render with Bootstrap alerts.
- Toasts: render flash messages via Bootstrap toast partial `views/partials/toasts.ejs`; errors use red (bg-danger), show on page load.
- Bootstrap: use grid + cards; avoid custom CSS unless necessary.
- Swahili copy: short, clear, and consistent; use Tanzanian context (TZS, M-Pesa).
- Navbar logic: if `res.locals.user` exists, show `Dashibodi` and `Toka`; otherwise show `Ingia`.

## SEO & Metadata
- Every `res.render(view, data)` MUST include: `title`, `description`, `keywords`, and `page`.
- `page` values: `home`, `blog`, `blog-post`, `dashboard`, `orders`, `services`, `new-order`, `add-funds`, `auth-login`, `auth-register`, `404`, `500`, etc.
- Keep `title` and `description` in clear Swahili. `keywords` as a comma-separated Swahili list.
- Layout must output `<title>`, `<meta name="description">`, `<meta name="keywords">`. Optionally include Open Graph tags.
- Example: `res.render('index/index', { title: 'Karibu Spoti Boost', description: 'Paneli ya SMM kwa Tanzania', keywords: 'smm, mitandao ya kijamii, tanzania, bei nafuu', page: 'home' })`.

## Nav Activeness
- Determine active navbar links using the `page` variable, not `req.path`.
- Mapping guideline:
  - Home: `page === 'home'`
  - Blog: `page in {'blog','blog-post'}`
  - Dashboard: `page in {'dashboard','orders','services','new-order','add-funds'}`
- Implement with EJS conditionals or a helper; ensure a single `active` class is present at a time.

## HTMX Practices (Critical)
- Always return HTTP 200 for HTMX responses; avoid 4xx/5xx for validation.
- Render fragments with `layout: false` so only the intended HTML swaps in.
- Use `HX-Redirect` header for navigation after success.
- Keep endpoints small and predictable; respond with a single fragment or redirect header only.

## Theme & Design System
- Design goal: clean, trustworthy, mobile-first dashboard with minimal custom CSS.
- Source of truth: Bootstrap 5 with a thin theme layer under `/public/css/theme.css`.

Design Tokens (CSS variables)
- Define in `:root` within `/public/css/theme.css`:
  - Colors: `--sb-primary` (#0d6efd), `--sb-secondary` (#6c757d), `--sb-success` (#198754), `--sb-warning` (#ffc107), `--sb-danger` (#dc3545), `--sb-info` (#0dcaf0), `--sb-bg` (#f8f9fa), `--sb-surface` (#ffffff), `--sb-text` (#212529), `--sb-muted` (#6c757d).
  - Radii: `--sb-radius-sm: 0.25rem;`, `--sb-radius: 0.5rem;`, `--sb-radius-lg: 0.75rem`.
  - Spacing scale (4/8 rule): `--sb-space-1: 0.25rem; --sb-space-2: 0.5rem; --sb-space-3: 0.75rem; --sb-space-4: 1rem; --sb-space-6: 1.5rem; --sb-space-8: 2rem`.
  - Shadows: `--sb-shadow-sm`, `--sb-shadow` (subtle), `--sb-shadow-lg`.
  - Typography: prefer system stack: `-apple-system, Segoe UI, Roboto, Noto Sans, Ubuntu, Cantarell, Helvetica Neue, Arial, sans-serif`.

Bootstrap Integration
- Map Bootstrap variables to theme tokens where possible (override in `:root`):
  - `--bs-primary: var(--sb-primary);` etc. Do not scatter hard-coded colors.
- Do not write per-page CSS; prefer Bootstrap utilities (`.pt-4`, `.mb-3`, `.text-muted`).
- Keep custom classes prefixed with `sb-` for clarity (e.g., `sb-card`, `sb-badge-soft`).

Layout & Spacing
- Use `.container` + `.row` + `.col-*` grid; max width via Bootstrap defaults.
- Global sections: top/bottom padding `--sb-space-6` on landing; `--sb-space-4` within dashboard.
- Cards: apply `border-radius: var(--sb-radius); box-shadow: var(--sb-shadow-sm); background: var(--sb-surface)`.
- Dashboard nav: top navbar + simple subnav breadcrumbs; avoid sidebars unless necessary.

Components (standardize usage)
- Buttons: use Bootstrap variants only (`.btn-primary`, `.btn-outline-secondary`). Sizes: `btn-sm`, `btn`.
- Forms: always include `<label>` with `for`, placeholders optional; help text via `.form-text`.
- Tables: `.table .table-hover .align-middle`; truncate long text with utility classes; use badges for statuses.
- Badges for order status: `pending=secondary`, `processing=info`, `completed=success`, `failed=danger`.
- Alerts: `success`, `danger`, `warning`, `info`; avoid custom colors.

Spoti Boost UI helpers (prefix `sb-`)
- `sb-card`: elevated card with larger radius and shadow for auth/hero sections.
- `sb-auth`: section wrapper with minimum viewport height for auth pages.
- `sb-hero-icon`: circular icon chip (`primary|success|warning` variants) for page headers.
- `sb-input-group`: styled input group that blends icon and input seamlessly.
- `sb-navbar-cta`: align nav CTA buttons nicely on large screens.

Responsive Rules
- Mobile-first. Breakpoints: use Bootstrap (`sm=576`, `md=768`, `lg=992`).
- On small screens: single-column cards; table overflow with `.table-responsive`.
- Avoid hidden content; collapse secondary actions into dropdowns on mobile.

Accessibility
- Ensure 4.5:1 contrast for text; do not lower contrast of `--sb-text` on `--sb-bg`.
- Visible focus styles: keep Bootstrap focus ring; do not remove outlines.
- Provide `aria-label`/`aria-live` for HTMX updates; associate labels and inputs.

Icons & Imagery
- Use Font Awesome 6. Keep size consistent (`fa-sm` for inline, `fa-lg` in nav) and prefer outlined/solid variants per context.
- Avoid heavy imagery; use SVG where possible; compress raster assets.

Dark Mode (optional, future)
- Support via `[data-theme="dark"]` switching: redefine only CSS variables (`--sb-bg`, `--sb-surface`, `--sb-text`, `--bs-*`).
- Do not write component-specific dark CSS; rely on variables.

Content & Copy (Swahili)
- Buttons/CTAs are verbs: "Weka Oda", "Ongeza Salio", "Hifadhi".
- Currency: `TZS 12,345` (use non-breaking space between code and number if possible).
- Dates: `DD/MM/YYYY` for UI; ISO for logs.

Assets & Structure
- Add `/public/css/theme.css`; include in `layouts/main.ejs` after Bootstrap CSS.
- Optional `/public/js/ui.js` for small UI hooks (e.g., htmx loading spinners); keep under 100 lines.

Design Acceptance
- No inline styles; zero hard-coded colors in views.
- All components render correctly at `sm`, `md`, `lg` breakpoints.
- Status colors and variants match the mapping above consistently.

## Security & Hardening
- No Helmet/CSP enforced during development to avoid friction with CDNs.
- Production note (future): prefer self-hosted assets and enable CSP/headers; when ready, add Helmet back with a strict config (documented in COMMENTS.md).
- Session cookie: `name=SESSION_NAME`, `httpOnly=true`, `sameSite=lax`, `secure=prod-only`.
- Rate limiting (optional later) on auth and API endpoints.
- Validate user inputs on server (simple checks: required fields, min/max quantity).

## Error Handling & 404
- Unmatched routes → render `errors/404.ejs`.
- Known failures → flash in Swahili with guidance (e.g., "Tafadhali jaribu tena"), not raw errors.

## Logging & Change Tracking (/LOGS)
- On each significant change, append to `UPDATES.log` with ISO timestamp, author (or "AI"), and 1–2 line summary.
- For features/bugfixes, update `CHANGELOG.md` under Unreleased → Released when deploying.
- Document important decisions in `COMMENTS.md` with context and options considered.
- Enforce: every code or docs change must update both `AGENTS.md` and `/LOGS/UPDATES.log`. Use `npm run sync:docs`.

## Coding Standards
- Async/await with try/catch; never leave unhandled promise rejections.
- Controllers in route files should remain small; extract helpers if >50 lines.
- Name style: camelCase for JS, kebab-case for filenames, PascalCase for models.
- HTTP: use appropriate status codes and redirect-after-POST on standard flows.
- Database writes: check for sufficient balance before debiting; wrap debit+order creation in a transaction if using Mongo sessions (optional).

## Localization (Swahili)
- All user-facing strings in Swahili, including errors and flashes.
- Examples:
  - Success login: "Umeingia kwa mafanikio. Karibu tena!"
  - Auth required: "Tafadhali ingia kwanza kuendelea."
  - Insufficient balance: "Salio halitoshi kukamilisha oda hii."

## Implementation Phases
1) Bootstrap app: config, DB, layouts, landing, 404/500
2) Auth: register/login/logout, sessions, flashes
3) Dashboard skeleton: balance, recent items, services list
4) New order + balance debit + transactions
5) Add funds (mock) + HTMX partial updates
6) Blog list for SEO + content placeholders
7) Admin basics: ensureAdmin middleware, `/routes/admin.js`, `/views/admin/index.ejs`
8) Admin CRUD for services, order moderation, users/transactions list
9) Polish: security headers, copy, empty states, basic rate limiting (optional)

## Acceptance Criteria
- User can register, login, logout; sessions persist across refreshes.
- Dashboard shows balance and recent orders/transactions.
- User can place an order; balance updates; order appears with status.
- User can add mock funds; balance updates immediately (HTMX fragment updates work).
- All primary pages render with consistent layout and Swahili copy.
- 404 and 500 pages render with helpful messaging.
- Logs in /LOGS are updated for features delivered.

Admin Acceptance
- Non-admins cannot access `/admin` routes (403 or redirect with flash in Swahili).
- Admin can create/edit/deactivate services.
- Admin can change order statuses; failed orders can trigger optional refunds.
- Admin can promote/demote user roles and view balances.
- Admin can adjust balances via transactions with clear audit trail.

## Admin Module
- Roles: `user`, `admin` (stored on `User.role`). Default `user`.
- Access control: `ensureAdmin` guards all `/admin/*` routes.
- Navigation: show admin link only when `user.role === 'admin'`.
- Scope: service CRUD, order moderation, users/transactions views, manual adjustments.
- Auditing: every admin action should create an entry in `COMMENTS.md` (summary + rationale) and `UPDATES.log` (timestamp + author + action).

## Notes
- Keep scope tight; focus on a functional user flow before integrations.
- Prefer server-rendered HTML with small HTMX interactions over heavy front-end logic.
Admin (guarded by ensureAdmin)
- Mount under `/admin`; prefix all links with admin breadcrumb.
- `GET /admin` → overview metrics: users count, active services, pending orders, total TZS credited (mock).
- `GET /admin/services` → list services; actions: create, edit, activate/deactivate.
- `POST /admin/services` → create service (validate name, category, price, min/max).
- `POST /admin/services/:id` → update service fields; toggle `isActive`.
- `POST /admin/services/:id/delete` → soft delete or deactivate (prefer deactivate first).
- `GET /admin/orders` → filterable list by status; actions: set status, view details.
- `POST /admin/orders/:id/status` → update status; if marking failed, optionally refund.
- `GET /admin/users` → list users; actions: promote/demote role, ban (soft flag), view balances.
- `POST /admin/users/:id/role` → set role to `user|admin`.
- `GET /admin/transactions` → list transactions; manual adjust form.
- `POST /admin/transactions/adjust` → admin credit/debit: change user balance and create a Transaction with `reference="ADMIN-ADJUST"`.


## 🎨 Spoti Boost Theme Guide (MVP Style)

A minimal, modern, and mobile-first visual theme for **Spoti Boost**, the Swahili SMM panel for Tanzania.

---

## 🏷️ Theme Identity
- **Style:** Clean, minimal, premium tech look  
- **Tone:** Trustworthy, youthful, and Tanzanian  
- **Goal:** Deliver a simple experience that looks professional and feels local  

---

## 🌈 Color Palette
| Usage | Color | Description |
|--------|--------|-------------|
| Primary | `#0066cc` | Deep modern blue – main brand color |
| Accent | `#FFD700` | Gold – VIP/premium highlights |
| Background | `#f8f9fa` | Light gray-white for clean mobile comfort |
| Text | `#212529` | Neutral dark gray for high contrast |
| Success | `#1B5E20` | Deep green for confirmations or balance increase |
| Error | `#dc3545` | Red for alerts and validation errors |
| Borders | `#dee2e6` | Light gray lines for separation |

---

## 🧱 Typography
- **Font Family:** System default or Bootstrap default (Arial, Helvetica, sans-serif)
- **Headings:** Bold, uppercase optional for emphasis  
- **Body Text:** Medium weight, high contrast against background  
- **Size:** Base 15–16px for readability on mobile  
- **Color:** Use `#212529` for all text to maintain accessibility  

---

## 🪟 Layout Principles
- Use **Bootstrap 5 grid system** with `.container-fluid` and `.row` for full responsiveness  
- Keep **max content width between 480px–600px** for centered mobile design  
- Maintain **ample spacing (1–2rem)** between sections for breathing room  
- Use **shadow-sm** and **rounded corners** for cards and containers  
- Stick to **flat elements** (no gradients or excessive shadows)  
- Navigation and footer should stay **consistent across pages**  

---

## 🧭 Navigation
- Minimal links: **Nyumbani**, **Huduma**, **Oda Zangu**, **Salio**, **Akaunti**  
- Use simple icons (FontAwesome) next to text for clarity  
- The brand logo or name “Spoti Boost” stays visible on all pages  
- Navbar background: white with subtle border for separation  

---

## 🧩 Buttons & Links
- **Primary Buttons:** Deep blue background, white text, rounded edges  
- **Accent Buttons:** Gold background for VIP or premium actions  
- **Outline Buttons:** White background with blue border for secondary actions  
- **Hover States:** Slightly darker blue tone or reduced brightness for feedback  
- **Disabled States:** Gray tone, reduced opacity  
- **Link Text:** Blue with no underline (underline only on hover)  
- **Mobile Buttons:** Full width with clear padding for thumb comfort  
- Use clear Swahili verbs like *“Nunua Wafuasi”*, *“Ongeza Salio”*, *“Tuma Oda”*

---

## 🧾 Cards & Sections
- Use **Bootstrap cards** for all content blocks (services, balance, orders)  
- Background white with **shadow-sm** for depth  
- Rounded corners for modern smooth look  
- Each card must have clear titles and icons for quick scanning  
- Cards on dashboard should highlight:
  - Current balance 💰  
  - New order 📝  
  - Available services 🛒  
  - Order history 📋  

---

## 🪄 Forms & Inputs
- Rounded, border-light inputs with enough padding  
- Labels should be **bold and in Swahili** (e.g., “Barua Pepe”, “Nenosiri”)  
- Use placeholder hints for clarity  
- Form buttons follow the primary color  
- Validation messages appear in red below the field  

---

## 📱 Mobile UX
- Design for **one-thumb navigation**  
- Keep text and elements large and well-spaced  
- Collapse non-essential elements  
- Use **HTMX fragments** for dynamic sections to avoid reloads  
- Maintain consistent padding (`p-3`) on all pages  

---

## 💡 Visual Personality
- Feels **premium but simple**  
- Emphasizes **trust and speed**  
- Uses color sparingly — **blue for actions**, **gold for highlights**, **green for success**  
- Avoids clutter; focus on the **core goal: making orders and tracking results easily**

---

## 🧭 Overall Feel
> “A fast, clean, and proudly Swahili SMM panel... simple enough for anyone to use, elegant enough to be trusted.”
