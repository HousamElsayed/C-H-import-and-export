# Clinic CRM

A complete management system for a single-location beauty clinic: clients and
their clinical records, the appointment diary, point of sale, stock control with
internal usage billing, marketing, and reporting.

Built with Next.js 16 (App Router), Prisma 7 and PostgreSQL.

---

## Running it locally

You need Node.js 20.19+ and a PostgreSQL 14+ database.

```bash
cd clinic-crm
npm install                   # also generates the Prisma client

cp .env.example .env          # then edit it — see below
npx prisma migrate deploy     # create the schema
npm run db:seed               # optional: a realistic demo clinic
npm run dev                   # http://localhost:3000
```

Two values in `.env` must be set before the first command that touches the
database:

```ini
DATABASE_URL="postgresql://crm:crm_dev_password@localhost:5432/clinic_crm?schema=public"
AUTH_SECRET="paste the output of: openssl rand -base64 32"
```

The `DATABASE_URL` above matches the bundled `docker-compose.yml`. Point it at
your own PostgreSQL instead if you have one.

Open http://localhost:3000. The seed creates these logins (all with the password
`Password123!` — change them before going anywhere near real data):

| Email | Role | Sees |
|---|---|---|
| `owner@salaclinic.com` | Owner | everything |
| `manager@salaclinic.com` | Manager | everything except clinic settings |
| `reception@salaclinic.com` | Receptionist | diary, clients, till, stock usage |
| `ayse@salaclinic.com` | Therapist | own diary, clinical notes, stock usage |
| `accounts@salaclinic.com` | Accountant | billing, reports, stock, no clinical notes |

### With Docker

```bash
docker compose up -d db       # Postgres on localhost:5432
npm run db:migrate
npm run db:seed
npm run dev
```

---

## How the system works

### Roles and access

Five roles map to a permission matrix in `src/lib/rbac.ts`. Permissions are
enforced in three places, not one: the navigation hides what you cannot reach,
every page calls `requirePermission`, and **every server action calls
`authorize` again** — because a server action is a public HTTP endpoint and UI
gating alone protects nothing.

Sessions are opaque random tokens stored as SHA-256 hashes; the raw token only
ever lives in an httpOnly cookie. Changing someone's password revokes all of
their sessions. `src/proxy.ts` does a cheap cookie check to bounce signed-out
traffic, but never trusts it — the real check hits the database on every request.

### Money

Every monetary value is an **integer in minor units** (kuruş, cents) and every
rate is in **basis points** (2000 = 20%). Nothing in the system uses a float for
money, so totals cannot drift. `src/lib/money.ts` is the only place that
converts to and from what a person types, and it understands both `1.250,50` and
`1,250.50`.

### The daily loop

1. **Book** — `/calendar`. Conflicts with the therapist's diary, the room and
   booked time off are checked *inside the transaction that writes the booking*,
   so two receptionists cannot both take the same slot. Softer problems —
   allergies on file, missing consent, a required patch test, an out-of-shift
   time, a client with repeat no-shows — are shown as warnings rather than
   blocks, because the front desk often has context the system does not.
2. **Check in** — the appointment moves `SCHEDULED → CONFIRMED → ARRIVED →
   IN_PROGRESS → COMPLETED`. Illegal jumps are rejected.
3. **Complete** — the products the treatment consumes leave stock automatically
   and the client's visit history updates. This happens on completion, not on
   payment, because the stock left the shelf regardless of who pays.
4. **Take payment** — `/invoices/new` opens pre-filled from the appointment. One
   transaction handles package redemption, package sales, retail stock, split
   payments, loyalty points earned and spent, staff commission and the client's
   lifetime value. If any part fails, none of it is written.

### Stock

`src/lib/inventory.ts` is the single writer for stock. Every movement — a
purchase, a treatment, a retail sale, a correction, a stock take — goes through
`applyStockMovement`, which updates the balance and writes the ledger row
together. The ledger and the balance therefore cannot disagree, and every unit
that left the building has a reason attached to it.

**Usage bills** (`/inventory/consumption`) are the answer to "where did all the
product go?". They are itemised, costed documents for stock consumed *inside*
the clinic — back-bar restocks, training, testers, breakage, expiry — attributed
to a cost centre, a staff member or a room. They are deliberately **not**
invoices: they carry no tax, no payment and no revenue, so they never pollute
sales reporting. Issuing one takes the stock out; cancelling an issued one puts
it back.

The stock dashboard (`/inventory`) shows value on hand, cost consumed, the
reorder queue, expiry warnings, where stock went over the last eight weeks, and
the month's biggest consumers.

### Messaging

`src/lib/messaging.ts` renders `{{token}}` templates and queues messages.
**With no provider credentials configured it runs in simulated mode**: messages
are logged and marked sent, so the whole flow works without a gateway or a bill.
Add a real SMS/email/WhatsApp adapter in `deliver()` when you are ready.

Appointment reminders are transactional and ignore marketing opt-in; campaigns
respect it per channel. Both are visible in `/messages`.

Point a cron job at the scheduler once an hour:

```bash
curl -X POST -H "authorization: Bearer $CRON_SECRET" https://your-host/api/cron
```

It queues due reminders, expires stale packages and flushes the message queue.

---

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | development server |
| `npm run build` / `npm start` | production build and serve |
| `npm test` | unit tests (money, dates, templates) |
| `npm run smoke` | end-to-end browser test against a running server |
| `npm run db:migrate` | create and apply a migration |
| `npm run db:seed` | reset to the demo clinic |
| `npm run db:studio` | browse the database |
| `npm run typecheck` | TypeScript, no emit |

`npm run smoke` signs in, loads every page, books an appointment, proves a double
booking is rejected, completes it, takes payment, and issues a usage bill —
checking that stock actually moved.

---

## Deploying

1. Provision PostgreSQL and set `DATABASE_URL`.
2. Set `AUTH_SECRET` to a long random string (`openssl rand -base64 32`) and
   `CRON_SECRET` to another.
3. `npm ci && npx prisma migrate deploy && npm run build && npm start`.
4. Serve over HTTPS — session cookies are marked `secure` in production.
5. Schedule the `/api/cron` call.

### Before real client data

This system stores health information and before/after photographs. Three things
are not done for you:

- **Encryption at rest** for the database and uploaded files.
- **Backups**, tested by actually restoring one.
- **A retention policy** — how long records are kept and how a client's data is
  removed on request. `Client.isDeleted` archives rather than erases, which is
  the right default for clinical history but is not the same as deletion.

The audit log (`/audit`) records who did what, which is a requirement in most
jurisdictions and useful in all of them.

---

## Layout

```
prisma/schema.prisma          data model
prisma/seed.ts                demo clinic
src/app/(app)/                authenticated pages, one folder per module
src/app/api/cron/             scheduler entry point
src/components/ui/            design-system primitives
src/components/charts/        server-rendered SVG charts, no chart library
src/lib/auth.ts               sessions, hashing, permission guards
src/lib/billing.ts            checkout: one transaction, everything or nothing
src/lib/booking.ts            conflict rules and booking warnings
src/lib/inventory.ts          the single writer for stock
src/lib/messaging.ts          templates, queue and provider adapters
src/lib/money.ts              integer money, basis points, invoice totals
```

Adding a module means: a folder under `src/app/(app)/`, an `actions.ts` whose
every export starts with `authorize(...)`, and pages that call
`requirePermission(...)`.
