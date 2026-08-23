# Yield — US Product Architecture

> Target market: US independent restaurants (starting California)  
> Stack mirrors Reverto IL — Netlify + Supabase + vanilla JS PWA

---

## Overview

Yield is a cost-control SaaS for US restaurant operators. It tracks food cost, parses invoices from distributors (Sysco, US Foods, PFG), surfaces USDA market prices, and helps operators make purchasing decisions.

---

## Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Frontend | Vanilla JS PWA (no framework) | Zero build step, fast load, offline support; proven in Reverto IL |
| Hosting | Netlify | Free tier, serverless functions, easy deploys |
| Database | Supabase (US East — N. Virginia) | Postgres + REST API + auth; data stays in US |
| Auth | Custom JWT (HS256) via Netlify Function | No Supabase Auth dependency; same pattern as Reverto IL |
| Payments | Stripe (USD) | PCI SAQ A compliant; Stripe Billing for subscriptions |
| Email | Resend (or SendGrid) | Transactional email with unsubscribe management |
| Invoice OCR | Azure Document Intelligence (Form Recognizer) | Structured field extraction; far better than raw OCR |
| Market Prices | USDA AMS API (free, daily) | Real wholesale produce/protein prices |
| Push Notifications | Web Push API + VAPID | Same as Reverto IL |
| Scheduled Jobs | GitHub Actions (cron) | Market price sync, push notifications |

---

## Database Schema

> The runnable source of truth is `db/schema.sql`. The listing below is the
> narrative version; if the two ever disagree, the `.sql` file wins.

### Core Tables

```sql
-- Multi-tenant: each restaurant is a "business"
CREATE TABLE businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_id UUID REFERENCES users(id),
  plan TEXT DEFAULT 'free',          -- 'free' | 'pro' | 'enterprise'
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  address TEXT,
  city TEXT,
  state TEXT DEFAULT 'CA',
  zip TEXT,
  phone TEXT,
  cuisine_type TEXT,
  seats INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Users (staff + owners)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES businesses(id),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT DEFAULT 'staff',          -- 'owner' | 'manager' | 'staff'
  name TEXT,
  phone TEXT,
  notification_prefs JSONB DEFAULT '{}',
  working_days TEXT DEFAULT 'Mon,Tue,Wed,Thu,Fri',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Locations / branches (multi-location restaurants)
CREATE TABLE locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES businesses(id),
  name TEXT NOT NULL,
  address TEXT,
  city TEXT,
  active BOOLEAN DEFAULT true
);

-- Suppliers / distributors
CREATE TABLE suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES businesses(id),
  name TEXT NOT NULL,                 -- 'Sysco', 'US Foods', 'PFG', etc.
  rep_name TEXT,
  rep_phone TEXT,
  rep_email TEXT,
  payment_terms TEXT DEFAULT 'net30', -- 'net7'|'net15'|'net30'|'cod'|'ewa'
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Invoice headers
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES businesses(id),
  location_id UUID REFERENCES locations(id),
  supplier_id UUID REFERENCES suppliers(id),
  invoice_number TEXT,
  invoice_date DATE,
  delivery_date DATE,
  total_amount NUMERIC(12,2),
  status TEXT DEFAULT 'pending',      -- 'pending'|'verified'|'paid'
  raw_file_url TEXT,                  -- Supabase Storage path
  parsed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Invoice line items (parsed from OCR)
CREATE TABLE invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
  supplier_item_code TEXT,            -- Sysco item number
  description TEXT,
  category TEXT,                      -- 'produce'|'protein'|'dairy'|'dry'|etc.
  brand TEXT,
  pack_size TEXT,                     -- e.g. "4/5lb", "6/#10 can"
  catch_weight BOOLEAN DEFAULT false, -- true if billed by actual weight
  quantity NUMERIC(10,3),
  unit TEXT,                          -- 'cs' | 'lb' | 'ea'
  unit_price NUMERIC(10,4),           -- price per case
  extended_price NUMERIC(10,2),
  -- Computed cost per smallest unit
  units_per_case NUMERIC(10,3),
  unit_size_oz NUMERIC(10,3),         -- oz per individual unit
  cost_per_lb NUMERIC(10,4),          -- computed
  cost_per_oz NUMERIC(10,4),          -- computed
  cost_per_each NUMERIC(10,4),        -- computed
  -- Surcharges broken out
  fuel_surcharge NUMERIC(10,2) DEFAULT 0,
  split_case_surcharge NUMERIC(10,2) DEFAULT 0,
  -- Market comparison
  usda_price_ref NUMERIC(10,4),       -- USDA AMS price at time of invoice
  variance_pct NUMERIC(6,2),          -- vs USDA (positive = paying more)
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Daily sales (Z report)
CREATE TABLE daily_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES businesses(id),
  location_id UUID REFERENCES locations(id),
  report_date DATE NOT NULL,
  net_sales NUMERIC(12,2),
  tax NUMERIC(10,2),
  tips NUMERIC(10,2),
  covers INTEGER,                     -- number of guests
  food_cost_pct NUMERIC(5,2),         -- computed after invoices matched
  entered_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(location_id, report_date)
);

-- USDA price cache
CREATE TABLE usda_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commodity TEXT NOT NULL,
  grade TEXT,
  region TEXT,
  unit TEXT,
  price_low NUMERIC(10,4),
  price_high NUMERIC(10,4),
  price_avg NUMERIC(10,4),
  report_date DATE NOT NULL,
  source_api TEXT DEFAULT 'usda_ams',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(commodity, grade, region, report_date)
);

-- Parsed item master (learned from invoices)
CREATE TABLE item_master (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES businesses(id),
  supplier_item_code TEXT,
  supplier_id UUID REFERENCES suppliers(id),
  description TEXT,
  common_name TEXT,                   -- user-assigned readable name
  category TEXT,
  pack_size TEXT,
  units_per_case NUMERIC(10,3),
  unit_size_oz NUMERIC(10,3),
  usda_commodity_key TEXT,            -- maps to usda_prices.commodity
  last_price NUMERIC(10,4),
  last_ordered DATE,
  UNIQUE(business_id, supplier_id, supplier_item_code)
);

-- Subscriptions / billing
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES businesses(id) UNIQUE,
  plan TEXT NOT NULL,
  stripe_subscription_id TEXT UNIQUE,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Push notification subscriptions
CREATE TABLE push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT UNIQUE NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Audit log
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  business_id UUID REFERENCES businesses(id),
  action TEXT NOT NULL,               -- 'login'|'invoice_upload'|'delete_item'|etc.
  details JSONB,
  ip TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## Netlify Functions

Netlify only discovers functions at the **top level** of the functions directory —
either `foo.js` or `foo/index.js`. Nested paths like `functions/auth/login.js` are
never deployed as endpoints. So each endpoint is a flat directory named
`<group>-<action>/index.js`, and `netlify.toml` maps it to a nested public path
under `/api`. The frontend only ever calls `/api/...`.

| Public path | Function directory | Status | Purpose |
|-------------|-------------------|--------|---------|
| `POST /api/auth/signup` | `auth-signup/` | built | Create business + owner user, return JWT |
| `POST /api/auth/login` | `auth-login/` | built | Verify credentials, return JWT |
| `GET /api/auth/me` | `auth-me/` | built | Current user + business (app bootstrap) |
| `POST /api/business/setup` | `business-setup/` | built | Save onboarding: business, location, supplier |
| `POST /api/invoices/parse` | `invoices-parse/` | built | Azure DI → supplier parser → `invoice_items` |
| `POST /api/market/sync` | `market-sync/` | built | Cron: upsert USDA AMS prices |
| `POST /api/invoices/upload` | `invoices-upload/` | todo | File → Supabase Storage → trigger parse |
| `GET /api/invoices/list` | `invoices-list/` | todo | Paginated invoice list |
| `GET /api/items/list` | `items-list/` | todo | Item master with last prices |
| `POST /api/sales/save` | `sales-save/` | todo | Save daily Z report |
| `GET /api/sales/report` | `sales-report/` | todo | Food cost report (sales vs invoice cost) |
| `POST /api/suppliers/save` | `suppliers-save/` | todo | Create/update supplier |
| `GET /api/market/prices` | `market-prices/` | todo | Cached USDA prices for tracked commodities |
| `POST /api/billing/checkout` | `billing-checkout/` | todo | Stripe Checkout session |
| `POST /api/billing/webhook` | `billing-webhook/` | todo | Stripe subscription webhooks |
| `POST /api/push/subscribe` | `push-subscribe/` | todo | Save push endpoint |
| `POST /api/push/send` | `push-send/` | todo | Cron: send scheduled notifications |
| `PATCH /api/users/profile` | `users-profile/` | todo | Update profile + notification prefs |
| `GET /api/data/export` | `data-export/` | todo | CCPA data export |
| `DELETE /api/data/delete` | `data-delete/` | todo | CCPA erasure |

### Shared modules

Functions require these from the repo root; `netlify.toml` lists them under
`included_files` so the bundler ships them.

| Module | Purpose |
|--------|---------|
| `lib/http.js` | `handler()` wrapper: CORS preflight, method allowlist, JSON parse, error catch |
| `lib/jwt.js` | HS256 sign/verify (constant-time), `fromEvent()` reads the Authorization header |
| `lib/supabase.js` | PostgREST client: `select`, `selectOne`, `insert`, `upsert`, `update`, `remove` |
| `parsers/*.js` | Supplier-specific invoice parsers |

### Database

`db/schema.sql` is the source of truth and is idempotent — apply it with
`psql "$SUPABASE_DB_URL" -f db/schema.sql`. RLS is enabled on every table with no
permissive policies: all access goes through functions using the service role key,
so a leaked publishable key cannot read tenant data.

## OCR / Invoice Parsing Architecture

See `docs/SYSCO-PARSER.md` for detailed Sysco spec.

### General Flow

```
User uploads PDF/image
  → Netlify Function: invoices/upload
    → Store raw file in Supabase Storage (path: {business_id}/{invoice_id}.pdf)
    → Create invoice row (status: 'pending')
    → Trigger invoices/parse (async via second fetch, or queue)

invoices/parse:
  → Download file from Supabase Storage
  → Call Azure Document Intelligence (prebuilt-invoice model)
  → Post-process output:
      - Identify supplier from header text
      - Route to supplier-specific parser module
      - Extract line items with full detail
      - Compute cost-per-unit fields
      - Match against item_master (create if new)
      - Store invoice_items rows
      - Update invoice status to 'verified'
```

### Supplier-Specific Parsers

```
parsers/
  sysco.js       — Sysco invoice parser (primary, most complex)
  usfoods.js     — US Foods
  pfg.js         — Performance Food Group
  generic.js     — Fallback for unknown suppliers
```

---

## USDA Market Price Integration

### API Details
- **Endpoint**: `https://marsapi.ams.usda.gov/services/v1.2/reports/`
- **Auth**: Free API key registration at mymarketnews.ams.usda.gov
- **Key reports**: 
  - Fruit & Vegetable (daily): Report 1254, 1255, 1256, 1257 (by region)
  - Livestock/Poultry: various report codes
  - Dairy: weekly
- **Update frequency**: Daily (most commodity groups)

### Sync Job (GitHub Actions)
- Runs: Daily at 8 AM PT (15:00 UTC)
- Downloads top 50 commodity price points relevant to restaurant purchasing
- Upserts to `usda_prices` table
- Commodities tracked: chicken breast, ground beef, salmon, avocado, romaine, tomato, onion, potato, shrimp, pork loin, butter, heavy cream, eggs

### UI Display
- "Market prices" tab in dashboard
- Shows current USDA price vs last purchase price per item
- Color-coded: green = paying at or below market, red = paying above market
- Trend sparkline: last 30 days

---

## Authentication Flow

Same pattern as Reverto IL — no Supabase Auth, custom JWT:

1. User submits email + password to `/api/auth/login`
2. Function fetches user row, verifies bcrypt hash (same response for unknown email and bad password)
3. Signs JWT: `{ user_id, business_id, role, exp: now + 7d }` with HS256
4. Frontend stores JWT in `sessionStorage` + `localStorage`
5. Every API call sends `Authorization: Bearer <token>`
6. Netlify Functions verify JWT before any DB operation

### Password Hashing
```js
// bcrypt (10 rounds) — use 'bcryptjs' (pure JS, no native deps)
const bcrypt = require('bcryptjs');
const hash = await bcrypt.hash(password, 10);
const valid = await bcrypt.compare(password, hash);
```

---

## Billing (Stripe)

### Plans
| Plan | Price | Features |
|------|-------|---------|
| Free | $0 | 1 location, 10 invoices/month, no OCR, manual entry only |
| Pro | $49/mo | Unlimited invoices, OCR, USDA prices, multi-location, push notifications |
| Enterprise | Custom | API access, custom integrations, dedicated support |

### Stripe Integration
- Stripe Checkout (hosted page) for subscription signup
- Stripe Customer Portal for plan changes + cancellation
- Webhooks: `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`
- Webhook secret validation via `stripe-signature` header

---

## File Structure

```
reverto.site/
├── index.html              # Landing page / marketing
├── login.html              # Login
├── signup.html             # Account creation
├── onboarding.html         # 3-step setup wizard
├── app.html                # Main application shell
├── privacy.html            # Privacy Policy (CCPA/CalOPPA)   [todo]
├── terms.html              # Terms of Service                [todo]
├── accessibility.html      # Accessibility statement (ADA)   [todo]
├── sw.js                   # Service worker                  [todo]
├── manifest.json           # PWA manifest                    [todo]
├── css/
│   ├── style.css           # Design tokens, buttons, forms, auth pages
│   └── app.css             # App shell: topbar, tabs, stats, tables
├── js/
│   ├── db.js               # Auth store, apiFetch, formatting, plan gating
│   ├── auth.js             # Login + signup pages
│   ├── onboarding.js       # Setup wizard
│   └── app.js              # App shell: tabs, bootstrap from /api/auth/me
├── lib/                    # Shared function modules (bundled via included_files)
│   ├── http.js
│   ├── jwt.js
│   └── supabase.js
├── parsers/                # Invoice parser modules
│   ├── sysco.js
│   ├── generic.js
│   ├── usfoods.js          [todo]
│   └── pfg.js              [todo]
├── netlify/functions/      # One flat directory per endpoint
│   ├── auth-login/         (index.js + package.json — bcryptjs)
│   ├── auth-signup/        (index.js + package.json — bcryptjs)
│   ├── auth-me/
│   ├── business-setup/
│   ├── invoices-parse/
│   └── market-sync/
├── db/
│   └── schema.sql          # Idempotent Postgres schema
├── docs/
│   ├── PLAN.md
│   ├── ARCHITECTURE.md     # this file
│   ├── LEGAL.md
│   └── SYSCO-PARSER.md
├── .github/workflows/
│   ├── market-sync.yml     # Daily USDA price sync
│   └── push-notifications.yml
├── .env.example
├── .gitignore
└── netlify.toml
```

---

## Phase 1 vs Phase 2

### Phase 1 (MVP — Day 1)
- User auth (signup, login, JWT)
- Business + location setup (onboarding)
- Supplier management
- **Invoice upload + Sysco OCR parsing** (critical day-1 requirement)
- **Cost per unit computation** (the core value)
- Daily Z sales entry
- **USDA market price display** (day-1 requirement)
- Food cost % calculation (invoice cost / sales)
- Pro plan billing (Stripe)
- Push notifications (operational reminders)
- Privacy Policy, Terms of Service, Accessibility statement
- CCPA compliance (data export + delete)

### Phase 2 (Growth)
- US Foods + PFG parser modules
- Recipe costing (map invoice items to menu items)
- Theoretical vs actual food cost
- Multi-user (staff logins, roles)
- Multi-location unified dashboard
- Inventory management
- Vendor comparison (same item, different suppliers)
- Mobile app (Capacitor wrapper)
- API access (Enterprise tier)
