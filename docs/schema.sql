-- Reverto — full database schema.
-- Run once in Supabase → SQL Editor → New query. Idempotent (safe to re-run).
--
-- Notes:
-- * We intentionally do NOT add a users.business_id → businesses.id foreign key.
--   The auth functions may have already created `users` with business_id as TEXT,
--   and Reverto scopes every query by business_id in application code (see CLAUDE.md),
--   so the DB-level FK is unnecessary and was the source of the earlier
--   "incompatible types: text and uuid" error.

-- ── users ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT DEFAULT 'staff',
  name TEXT,
  phone TEXT,
  notification_prefs JSONB DEFAULT '{}',
  working_days TEXT DEFAULT 'Mon,Tue,Wed,Thu,Fri',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── businesses ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_id UUID,
  plan TEXT DEFAULT 'free',
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  address TEXT, city TEXT, state TEXT DEFAULT 'CA', zip TEXT,
  phone TEXT, cuisine_type TEXT, seats INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── locations ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES businesses(id),
  name TEXT NOT NULL, address TEXT, city TEXT, active BOOLEAN DEFAULT true
);

-- ── suppliers ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES businesses(id),
  name TEXT NOT NULL, rep_name TEXT, rep_phone TEXT, rep_email TEXT,
  payment_terms TEXT DEFAULT 'net30', notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── invoices ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES businesses(id),
  location_id UUID REFERENCES locations(id),
  supplier_id UUID REFERENCES suppliers(id),
  vendor_name TEXT,
  invoice_number TEXT, invoice_date DATE, delivery_date DATE,
  total_amount NUMERIC(12,2),
  status TEXT DEFAULT 'pending',
  raw_file_url TEXT,
  parsed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
-- vendor_name may be missing if invoices already existed — add it.
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS vendor_name TEXT;

-- ── invoice_items ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
  supplier_item_code TEXT, description TEXT, category TEXT,
  brand TEXT, pack_size TEXT,
  catch_weight BOOLEAN DEFAULT false,
  quantity NUMERIC(10,3), unit TEXT,
  unit_price NUMERIC(10,4), extended_price NUMERIC(10,2),
  units_per_case NUMERIC(10,3), unit_size_oz NUMERIC(10,3),
  cost_per_lb NUMERIC(10,4), cost_per_oz NUMERIC(10,4), cost_per_each NUMERIC(10,4),
  fuel_surcharge NUMERIC(10,2) DEFAULT 0,
  split_case_surcharge NUMERIC(10,2) DEFAULT 0,
  usda_price_ref NUMERIC(10,4), variance_pct NUMERIC(6,2),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── daily_sales ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS daily_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES businesses(id),
  location_id UUID REFERENCES locations(id),
  report_date DATE NOT NULL,
  net_sales NUMERIC(12,2), tax NUMERIC(10,2), tips NUMERIC(10,2), covers INTEGER,
  food_cost_pct NUMERIC(5,2),
  entered_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(location_id, report_date)
);

-- ── usda_prices ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS usda_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commodity TEXT NOT NULL, grade TEXT, region TEXT, unit TEXT,
  price_low NUMERIC(10,4), price_high NUMERIC(10,4), price_avg NUMERIC(10,4),
  report_date DATE NOT NULL,
  source_api TEXT DEFAULT 'usda_ams',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(commodity, grade, region, report_date)
);

-- ── item_master ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS item_master (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES businesses(id),
  supplier_item_code TEXT, supplier_id UUID REFERENCES suppliers(id),
  description TEXT, common_name TEXT, category TEXT, pack_size TEXT,
  units_per_case NUMERIC(10,3), unit_size_oz NUMERIC(10,3),
  usda_commodity_key TEXT,
  last_price NUMERIC(10,4), last_ordered DATE,
  UNIQUE(business_id, supplier_id, supplier_item_code)
);

-- ── subscriptions ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES businesses(id) UNIQUE,
  plan TEXT NOT NULL,
  stripe_subscription_id TEXT UNIQUE,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── push_subscriptions ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  endpoint TEXT UNIQUE NOT NULL, p256dh TEXT NOT NULL, auth TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── audit_log ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  business_id UUID,
  action TEXT NOT NULL, details JSONB, ip TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
