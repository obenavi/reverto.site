-- Yield — Postgres schema (Supabase)
-- Apply with: psql "$SUPABASE_DB_URL" -f db/schema.sql
-- Safe to re-run: every statement is IF NOT EXISTS / idempotent.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── Businesses ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_id UUID,
  plan TEXT NOT NULL DEFAULT 'free',        -- 'free' | 'pro' | 'enterprise'
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  address TEXT,
  city TEXT,
  state TEXT DEFAULT 'CA',
  zip TEXT,
  phone TEXT,
  cuisine_type TEXT,
  seats INTEGER,
  onboarded BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Users ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'staff',       -- 'owner' | 'manager' | 'staff'
  name TEXT,
  phone TEXT,
  notification_prefs JSONB NOT NULL DEFAULT '{}',
  working_days TEXT DEFAULT 'Mon,Tue,Wed,Thu,Fri',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- businesses.owner_id is set after the first user exists, so the FK is added here
DO $$ BEGIN
  ALTER TABLE businesses
    ADD CONSTRAINT businesses_owner_id_fkey
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Locations ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  city TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Suppliers ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  rep_name TEXT,
  rep_phone TEXT,
  rep_email TEXT,
  payment_terms TEXT DEFAULT 'net30',       -- 'net7'|'net15'|'net30'|'cod'|'ewa'
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Invoices ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  invoice_number TEXT,
  invoice_date DATE,
  delivery_date DATE,
  total_amount NUMERIC(12,2),
  status TEXT NOT NULL DEFAULT 'pending',   -- 'pending'|'verified'|'paid'|'failed'
  raw_file_url TEXT,
  parse_error TEXT,
  parsed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Invoice line items ───────────────────────────────────────────────────────
-- Column set matches exactly what parsers/sysco.js and parsers/generic.js emit.
CREATE TABLE IF NOT EXISTS invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
  supplier_item_code TEXT,
  description TEXT,
  common_name TEXT,                         -- parser-guessed readable name
  category TEXT,
  brand TEXT,
  pack_size TEXT,
  catch_weight BOOLEAN NOT NULL DEFAULT false,
  quantity NUMERIC(10,3),
  unit TEXT,
  unit_price NUMERIC(10,4),
  extended_price NUMERIC(10,2),
  units_per_case NUMERIC(10,3),
  unit_size_oz NUMERIC(10,3),
  total_oz_per_case NUMERIC(12,2),
  actual_weight_lb NUMERIC(10,3),           -- catch-weight items only
  cost_per_case NUMERIC(10,4),
  cost_per_lb NUMERIC(10,4),
  cost_per_oz NUMERIC(10,4),
  cost_per_each NUMERIC(10,4),
  fuel_surcharge NUMERIC(10,2) NOT NULL DEFAULT 0,
  split_case_surcharge NUMERIC(10,2) NOT NULL DEFAULT 0,
  usda_price_ref NUMERIC(10,4),
  variance_pct NUMERIC(6,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Daily sales (Z report) ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS daily_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  location_id UUID REFERENCES locations(id) ON DELETE CASCADE,
  report_date DATE NOT NULL,
  net_sales NUMERIC(12,2),
  tax NUMERIC(10,2),
  tips NUMERIC(10,2),
  covers INTEGER,
  food_cost_pct NUMERIC(5,2),
  entered_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(location_id, report_date)
);

-- ── USDA price cache ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS usda_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commodity TEXT NOT NULL,
  grade TEXT NOT NULL DEFAULT '',
  region TEXT NOT NULL DEFAULT '',
  unit TEXT,
  price_low NUMERIC(10,4),
  price_high NUMERIC(10,4),
  price_avg NUMERIC(10,4),
  report_date DATE NOT NULL,
  source_api TEXT DEFAULT 'usda_ams',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(commodity, grade, region, report_date)
);

-- ── Item master ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS item_master (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE CASCADE,
  supplier_item_code TEXT,
  description TEXT,
  common_name TEXT,
  category TEXT,
  pack_size TEXT,
  units_per_case NUMERIC(10,3),
  unit_size_oz NUMERIC(10,3),
  usda_commodity_key TEXT,
  last_price NUMERIC(10,4),
  last_ordered DATE,
  UNIQUE(business_id, supplier_id, supplier_item_code)
);

-- ── Subscriptions ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID UNIQUE REFERENCES businesses(id) ON DELETE CASCADE,
  plan TEXT NOT NULL,
  stripe_subscription_id TEXT UNIQUE,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Push subscriptions ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT UNIQUE NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Audit log ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  details JSONB,
  ip TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_users_business      ON users(business_id);
CREATE INDEX IF NOT EXISTS idx_locations_business  ON locations(business_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_business  ON suppliers(business_id);
CREATE INDEX IF NOT EXISTS idx_invoices_business   ON invoices(business_id, invoice_date DESC);
CREATE INDEX IF NOT EXISTS idx_invoice_items_inv   ON invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_daily_sales_biz     ON daily_sales(business_id, report_date DESC);
CREATE INDEX IF NOT EXISTS idx_usda_commodity      ON usda_prices(commodity, report_date DESC);
CREATE INDEX IF NOT EXISTS idx_audit_business      ON audit_log(business_id, created_at DESC);

-- ── Row level security ───────────────────────────────────────────────────────
-- All access goes through Netlify Functions using the service role key, which
-- bypasses RLS. RLS is enabled with no permissive policies so that a leaked
-- anon/publishable key cannot read tenant data directly.
ALTER TABLE businesses         ENABLE ROW LEVEL SECURITY;
ALTER TABLE users              ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations          ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers          ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices           ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items      ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_sales        ENABLE ROW LEVEL SECURITY;
ALTER TABLE usda_prices        ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_master        ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log          ENABLE ROW LEVEL SECURITY;
