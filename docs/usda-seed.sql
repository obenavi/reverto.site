-- Reverto — USDA price seed data (approximate current market prices, per lb unless noted)
-- Source: USDA AMS wholesale market averages, ~June 2026 estimates.
-- Run in Supabase SQL Editor. Safe to re-run (INSERT OR IGNORE on unique key).

INSERT INTO usda_prices (commodity, grade, region, unit, price_low, price_high, price_avg, report_date, source_api)
VALUES
  ('CHICKEN BREAST',   'A',    'National', 'lb', 1.82, 2.10, 1.95, CURRENT_DATE, 'seed'),
  ('GROUND BEEF',      'USDA Choice', 'National', 'lb', 3.90, 4.30, 4.10, CURRENT_DATE, 'seed'),
  ('BEEF TENDERLOIN',  'USDA Choice', 'National', 'lb', 12.50, 14.00, 13.20, CURRENT_DATE, 'seed'),
  ('SALMON',           'A',    'National', 'lb', 5.80, 6.50, 6.10, CURRENT_DATE, 'seed'),
  ('SHRIMP',           '16/20 ct', 'National', 'lb', 6.20, 7.10, 6.60, CURRENT_DATE, 'seed'),
  ('TOMATOES',         'A',    'National', 'lb', 0.95, 1.25, 1.10, CURRENT_DATE, 'seed'),
  ('LETTUCE ROMAINE',  'A',    'National', 'lb', 0.80, 1.10, 0.95, CURRENT_DATE, 'seed'),
  ('ONIONS',           'A',    'National', 'lb', 0.35, 0.55, 0.44, CURRENT_DATE, 'seed'),
  ('POTATOES',         'A',    'National', 'lb', 0.30, 0.48, 0.38, CURRENT_DATE, 'seed'),
  ('AVOCADOS',         'A',    'National', 'lb', 1.20, 1.60, 1.40, CURRENT_DATE, 'seed'),
  ('APPLES',           'A',    'National', 'lb', 0.65, 0.90, 0.76, CURRENT_DATE, 'seed'),
  ('MOZZARELLA',       'A',    'National', 'lb', 2.80, 3.20, 2.98, CURRENT_DATE, 'seed'),
  ('CHEDDAR CHEESE',   'A',    'National', 'lb', 2.60, 3.00, 2.78, CURRENT_DATE, 'seed'),
  ('BUTTER',           'A',    'National', 'lb', 2.90, 3.30, 3.08, CURRENT_DATE, 'seed'),
  ('EGGS',             'Large AA', 'National', 'dozen', 2.80, 3.40, 3.10, CURRENT_DATE, 'seed')
ON CONFLICT (commodity, grade, region, report_date) DO UPDATE
  SET price_low = EXCLUDED.price_low,
      price_high = EXCLUDED.price_high,
      price_avg = EXCLUDED.price_avg;
