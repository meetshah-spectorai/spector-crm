# Spector.AI CRM

An internal MERN CRM for a small team of two or three people who all work the
same pipeline: a drag-and-drop Kanban board, a note log on every deal, reminders
for the next action with email notifications, and one centralized to-do list
across every deal.

**Everyone is a peer.** There are no roles, no permission tiers and no admin
screen — every signed-in teammate sees and can edit the whole pipeline. `owner`
on a deal and `assignedTo` on a task record *who is working what*, not who is
allowed to. They are filters, never restrictions.

```
CRM/
├── client/          React + Vite + Tailwind SPA  → deploy to Vercel
└── server/          Express + Mongoose REST API  → deploy to Render / Railway
```

---

## Features

| Feature | Where it lives |
|---|---|
| Deals with stage, status and monetary value (9 currencies) | [Deal.js](server/src/models/Deal.js), [DealFormModal.jsx](client/src/components/deals/DealFormModal.jsx) |
| Kanban board with drag-and-drop across stages | [KanbanBoard.jsx](client/src/components/kanban/KanbanBoard.jsx), `PATCH /api/deals/:id/move` |
| **Configurable board columns** — add and rename stages | [Stage.js](server/src/models/Stage.js), [stage.service.js](server/src/services/stage.service.js), [ManageColumnsModal.jsx](client/src/components/kanban/ManageColumnsModal.jsx) |
| Notes on a deal — pin, edit, search the running log | [Note.js](server/src/models/Note.js), [NotesTab.jsx](client/src/components/notes/NotesTab.jsx) |
| Reminders for the next action on a deal | [Reminder.js](server/src/models/Reminder.js), [ReminderFormModal.jsx](client/src/components/reminders/ReminderFormModal.jsx) |
| Email notifications (due-soon + daily digest) | [reminderScheduler.js](server/src/jobs/reminderScheduler.js), [email.service.js](server/src/services/email.service.js) |
| Centralized to-do list across all deals | [Tasks.jsx](client/src/pages/Tasks.jsx), `GET /api/reminders` |
| JWT auth with an httpOnly refresh cookie | [auth.js](server/src/middleware/auth.js) |
| **Sign in with Google** (optional, ID-token flow) | [google.service.js](server/src/services/google.service.js), [GoogleSignInButton.jsx](client/src/components/auth/GoogleSignInButton.jsx) |
| Dashboard with pipeline KPIs and a by-stage chart | [Dashboard.jsx](client/src/pages/Dashboard.jsx) |

Registration is open — anyone who can reach the API can create an account. That
is deliberate for an internal tool behind your own network or a private URL, but
**do not expose this API publicly without putting something in front of it**.

### Board columns

Columns live in the database, not in code. **Deals → Columns** lets you add a
stage or rename one; the board updates immediately. Six defaults (Lead, Qualified,
Proposal Sent, Negotiation, Won, Lost) are created automatically the first time
the API starts against an empty database, and never touched again.

Each column carries:

| Field | What it does |
|---|---|
| `label` | The name shown on the board. Freely renameable. |
| `key` | Immutable slug generated from the first label (`Contract Sent` → `contract_sent`). Deals reference this, so **renaming can never orphan a deal**. |
| `outcome` | `open`, `won` or `lost` — drives the deal's status, `closedAt` and probability. You can have more than one "won" column. |
| `probability` | Default win probability for deals landing there; feeds the weighted forecast. |
| `color` | One of ten palette tokens, used for the column dot and card edge. |
| `order` | Board position. |

Changing a column's `outcome` re-syncs the status of every deal currently in it,
so the board and the data never disagree.

Reordering and deleting columns are not built yet — `order` and `isDefault` are
already on the model, so each is one endpoint plus a UI control away.

---

## Local setup

Requirements: **Node 20+** and a MongoDB you can reach (local `mongod` or a free
[MongoDB Atlas](https://www.mongodb.com/atlas) cluster).

### 1. API

```bash
cd server
npm install
cp .env.example .env        # Windows: copy .env.example .env
```

Edit `server/.env`:

```ini
MONGO_URI=mongodb://127.0.0.1:27017/crm
JWT_ACCESS_SECRET=<48+ random chars>
JWT_REFRESH_SECRET=<a different 48+ random chars>
CLIENT_ORIGINS=http://localhost:5173
```

Generate the secrets with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

The server validates its whole environment at boot and refuses to start with a
clear message if anything is missing, rather than failing later at runtime.

```bash
npm run seed     # optional: three teammates, deals, reminders and notes
npm run dev      # http://localhost:5000
```

Seeded logins (password `Passw0rd!` unless you changed `SEED_PASSWORD`) — all
equal, all sharing one pipeline:

| Email |
|---|
| the address in `SEED_EMAIL` (yours) |
| `alex@example.com` |
| `jordan@example.com` |

`npm run seed -- --wipe` clears deals, reminders and notes first.

### 2. Client

```bash
cd client
npm install
cp .env.example .env        # optional locally — the dev proxy needs no config
npm run dev                 # http://localhost:5173
```

In development Vite proxies `/api` to `http://localhost:5000`, so the browser
sees a single origin and the refresh cookie behaves exactly as it does in
production. Leave `VITE_API_BASE_URL` empty locally.

### 3. Sign in with Google (optional)

Skip this and the CRM stays on email + password; the button is simply not
rendered. To enable it:

1. [Google Cloud console](https://console.cloud.google.com) → **APIs & Services →
   Credentials → Create credentials → OAuth client ID**, type **Web application**.
2. Under **Authorized JavaScript origins** add the URL the app is served from —
   `http://localhost:5173` for local work, plus your deployed frontend URL. (No
   redirect URI is needed: this is the ID-token flow, not a redirect flow.)
3. Put the client id — the same value — in both places, and restart both servers:

```ini
# server/.env
GOOGLE_CLIENT_ID=1234567890-abc123.apps.googleusercontent.com

# client/.env
VITE_GOOGLE_CLIENT_ID=1234567890-abc123.apps.googleusercontent.com
```

There is **no client secret**: the browser hands the API a signed ID token, and
the API verifies it against Google's public keys.

First sign-in with a given Google account creates a CRM account for it (the same
open registration the app already has). If the Google email matches an existing
account, Google is linked to that account instead — Google has verified the
address, and it is the same person either way. Google-created accounts have no
password until the owner sets one under **Settings → Set a password**.

### 4. Tests

```bash
cd server
npm test
```

This boots the real Express app against an in-memory MongoDB and exercises auth,
deal CRUD, the board, the drag-and-drop move endpoint, reminders, the to-do list,
the activity log and the email sweep. The first run downloads a MongoDB binary
(~100 MB), which is cached afterwards.

---

## Email notifications

Emails are sent by [Nodemailer](https://nodemailer.com) over SMTP.

**Leave `SMTP_HOST` empty and emails are printed to the server log instead of
being sent** — the app is fully usable in development without mail credentials.

SendGrid over SMTP:

```ini
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=<your SendGrid API key>
MAIL_FROM="CRM <no-reply@yourdomain.com>"
```

Gmail needs an [app password](https://support.google.com/accounts/answer/185833),
not your account password: `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=587`.

Two jobs run in-process ([node-cron](https://github.com/node-cron/node-cron)):

| Job | Schedule | What it sends |
|---|---|---|
| Reminder sweep | every minute | one email per reminder, `notifyBeforeMinutes` before it is due |
| Daily digest | `DAILY_DIGEST_CRON` (default 08:00) | overdue + today + next 7 days, per user |

`notifiedAt` is stamped **before** the send, so a crash mid-batch risks a missed
email rather than a duplicate — the better failure mode for notifications. Users
can turn either email off in **Settings**.

> On a free Render/Railway instance that sleeps when idle, in-process cron only
> fires while the service is awake. For guaranteed delivery either use a paid
> always-on instance, or set `ENABLE_SCHEDULER=false` and drive
> `sweepDueReminders()` from an external scheduler (Render Cron Job, GitHub
> Actions, cron-job.org) hitting a small authenticated trigger route.

---

## API

All routes are under `/api`. Authenticated routes need `Authorization: Bearer <accessToken>`.

<details>
<summary><strong>Auth</strong></summary>

| Method | Path | Notes |
|---|---|---|
| `POST` | `/auth/register` | Open registration |
| `POST` | `/auth/login` | Sets the httpOnly refresh cookie |
| `POST` | `/auth/google` | `{ credential }` — a Google ID token. Signs in, links the Google account to a matching email, or creates one (`201`) |
| `POST` | `/auth/refresh` | Cookie → new access token |
| `POST` | `/auth/logout` | Clears the cookie |
| `GET` | `/auth/me` | Current user |
| `PATCH` | `/auth/me` | Name, notification preferences |
| `POST` | `/auth/change-password` | Invalidates all existing tokens. Doubles as "set a password" for a Google account that has none |

</details>

<details>
<summary><strong>Stages (board columns)</strong></summary>

| Method | Path | Notes |
|---|---|---|
| `GET` | `/stages` | Columns in board order, each with a live `dealCount` |
| `POST` | `/stages` | Add a column: `{ label, outcome?, probability?, color? }`. The key is generated from the label |
| `PATCH` | `/stages/:id` | Rename / restyle. `key` is never modified |

</details>

<details>
<summary><strong>Deals</strong></summary>

| Method | Path | Notes |
|---|---|---|
| `GET` | `/deals` | Filters: `stage`, `status`, `owner`, `priority`, `search`, `tag`, `archived`, `minValue`, `maxValue`, `sort`, `page`, `limit` |
| `GET` | `/deals/board` | All Kanban columns with per-stage totals and each deal's next action |
| `GET` | `/deals/stats` | Dashboard aggregates |
| `POST` | `/deals` | Create |
| `GET` | `/deals/:id` | Deal + its reminders |
| `PATCH` | `/deals/:id` | Update |
| `PATCH` | `/deals/:id/move` | **Drag-and-drop**: `{ stage, index }` |
| `PATCH` | `/deals/:id/archive` · `/restore` | Archiving cancels pending tasks |
| `DELETE` | `/deals/:id` | Hard delete; reminders and notes go with it |

</details>

<details>
<summary><strong>Notes</strong></summary>

| Method | Path | Notes |
|---|---|---|
| `GET` | `/notes` | A deal's note log. Filters: `deal`, `search`, `page`, `limit`. Pinned first, then newest |
| `POST` | `/notes` | Create: `{ deal, body, pinned? }` |
| `PATCH` | `/notes/:id` | Edit the body or pin it — author only; stamps `editedAt` |
| `DELETE` | `/notes/:id` | Author only |

</details>

<details>
<summary><strong>Reminders and users</strong></summary>

| Method | Path | Notes |
|---|---|---|
| `GET` | `/reminders` | The to-do list. Filters: `status`, `due`, `deal`, `assignedTo`, `sort`; returns urgency `counts` |
| `POST` | `/reminders` | Create; emails the assignee if someone else assigned it |
| `PATCH` | `/reminders/:id` | Rescheduling re-arms the notification |
| `POST` | `/reminders/:id/complete` | One-click done |
| `DELETE` | `/reminders/:id` | |
| `GET` | `/users` | Team roster for the owner / assignee pickers |
| `GET` | `/health` · `/meta` | Probe, and the fixed enums (priorities, currencies, colours) |

</details>

Every response uses the same envelope:

```json
{ "success": true,  "data": …, "meta": { … } }
{ "success": false, "message": "Validation failed", "details": [ { "field": "value", "message": "…" } ] }
```

---

## Deployment

### MongoDB Atlas

1. Create a free **M0** cluster.
2. **Database Access** → add a user with *Read and write to any database*.
3. **Network Access** → add `0.0.0.0/0` (Render and Railway do not publish fixed
   egress IPs on their free tiers).
4. Copy the connection string and append the database name:
   `mongodb+srv://user:pass@cluster.mongodb.net/crm?retryWrites=true&w=majority`

### API on Render

**New → Web Service**, connect the repo, then:

| Setting | Value |
|---|---|
| Root Directory | `server` |
| Build Command | `npm install` |
| Start Command | `npm start` |
| Health Check Path | `/api/health` |

Environment variables:

```ini
NODE_ENV=production
MONGO_URI=<your Atlas URI>
JWT_ACCESS_SECRET=<48+ random chars>
JWT_REFRESH_SECRET=<different 48+ random chars>
CLIENT_ORIGINS=https://your-app.vercel.app
APP_URL=https://your-app.vercel.app
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=<SendGrid API key>
MAIL_FROM="CRM <no-reply@yourdomain.com>"
```

Because registration is open, keep the deployed URL private or put access control
(Vercel password protection, a VPN, an IP allowlist) in front of it.

Railway is the same: set the root directory to `server`, `npm start`, and the
same variables. `PORT` is injected by the platform — do not hard-code it.

### Client on Vercel

**Add New → Project**, import the repo, then:

| Setting | Value |
|---|---|
| Root Directory | `client` |
| Framework Preset | Vite |
| Build Command | `npm run build` |
| Output Directory | `dist` |

Environment variable:

```ini
VITE_API_BASE_URL=https://your-api.onrender.com
```

`client/vercel.json` already rewrites all paths to `index.html` so client-side
routes survive a hard refresh.

### The two settings people get wrong

1. **`CLIENT_ORIGINS` must exactly match your Vercel URL** (scheme, no trailing
   slash). CORS runs with `credentials: true`, so a mismatch silently breaks the
   refresh cookie and users get signed out on every reload.
2. **Cross-site cookies need HTTPS.** In production the refresh cookie is set
   `SameSite=None; Secure`, which only works over HTTPS — fine on Render and
   Vercel, but it will not work if you serve the API over plain HTTP.

`VITE_API_BASE_URL` is baked in at build time: change it and redeploy.

---

## Architecture notes

**Google sign-in.** The browser gets a signed ID token from Google Identity
Services and posts it to `/api/auth/google`; the API verifies the signature
against Google's keys, checks the token was minted for *our* client id, then
issues its own session. No OAuth secret, no redirect leg, and no third-party
session — Google authenticates the person, this app still owns the session.

**Auth.** Short-lived access token (15 min) held **in memory only** — never
`localStorage`, so an XSS bug cannot read it. Sessions survive a page refresh via
an httpOnly, `SameSite=None; Secure` refresh cookie scoped to `/api/auth`. Axios
refreshes transparently on a `401`, de-duplicating parallel refreshes, and one
retry per request. Every token carries a `tokenVersion`; changing a password bumps
it and retires all outstanding tokens immediately.

**No permission layer.** Being signed in *is* the authorisation. That removes an
entire class of bug (row-level scoping that leaks, or over-blocks) and is the right
trade for a small internal team — but it means anyone with an account can delete
any deal. Keep registration behind a private URL or your own network.

**Board ordering.** Each deal carries an `order` within its stage. A move inserts
the card at the midpoint of its neighbours — one write, no column-wide rewrite —
and the column is re-spaced only when the gap gets too tight.

**Stage/status derivation.** `status`, `probability` and `closedAt` all follow from
the column a deal sits in, and those rules need the Stage document — so the Deal
model has no hook for them. `stage.service.applyStageToDeal()` is the single owner,
and every write path (create, edit, drag, outcome change) goes through it.

**Optimistic drag-and-drop.** The reducer moves the card locally before the
request lands and the board refetches from the server if it fails, so a drag
never feels laggy but also never lies.

**Notes.** A deal's running log, attributed to whoever wrote each entry. Anyone
can read them; only the author can edit or delete their own — the server enforces
that, the UI just hides what would be refused.

**Security.** Helmet, a CORS allowlist, rate limits (tighter on credential
routes), bcrypt at cost 12, Zod validation on every body/query/param, a
`$`-operator scrubber against NoSQL injection, `select: false` on password
hashes, and identical errors for unknown-email and wrong-password. Deal updates
go through a field whitelist, so no mass-assignment.

---

## Project layout

```
server/src
├── config/        env validation (fail-fast), mongoose connection
├── models/        User, Deal, Stage, Reminder, Note
├── controllers/   request → response, one file per resource
├── routes/        thin routing, middleware composition
├── services/      stages, email + templates, tokens
├── middleware/    auth, validation, sanitising, rate limits, errors
├── validators/    Zod schemas
├── jobs/          node-cron reminder sweep + daily digest
├── scripts/       seed
└── utils/         ApiError, asyncHandler, logger, constants
```

```
client/src
├── api/           axios instance, refresh interceptor, endpoint wrappers
├── app/           Redux Toolkit store
├── features/      auth · deals · stages · reminders · activities · users slices
├── components/    ui/ · layout/ · kanban/ · deals/ · reminders/ · activity/ · dashboard/
├── pages/         Login · Register · Dashboard · Deals · DealDetail · Tasks · ActivityLog · Settings
├── routes/        ProtectedRoute
└── utils/         formatting, shared constants
```

## Tech stack

**Frontend** React 18 · Vite 6 · Tailwind CSS 3 · Redux Toolkit · React Router 6 ·
dnd-kit · Recharts · date-fns · lucide-react · react-hot-toast

**Backend** Node 20+ · Express 4 · Mongoose 8 · JWT · bcryptjs · Zod ·
Nodemailer · node-cron · Helmet · express-rate-limit
