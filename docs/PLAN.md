# Yield — Product Plan (US Market)

---

## Mission

Help independent US restaurant operators cut food cost by giving them the price clarity their distributors intentionally hide. Every invoice becomes actionable data: cost per pound, cost per ounce, market comparison, trend.

---

## Phase 1 — MVP (Day 1 Launch)

### Core Loop
1. Operator uploads Sysco invoice (PDF/photo)
2. Yield parses it: line items, cost per lb/oz, fuel surcharge attribution, catch weight correction
3. Yield shows true cost per unit vs USDA market price (daily feed)
4. Operator enters daily Z report (net sales)
5. Yield shows food cost % (invoice cost / sales)

### Phase 1 Feature Set

| Feature | Priority | Notes |
|---------|----------|-------|
| Auth (signup/login/JWT) | P0 | Email + bcrypt |
| Business onboarding | P0 | Name, type, location(s), cuisine |
| Supplier setup | P0 | Name, rep, payment terms |
| Invoice upload | P0 | PDF + image; Supabase Storage |
| **Sysco OCR parser** | P0 | Azure Doc Intelligence; true cost/unit |
| Cost-per-unit display | P0 | Per lb, per oz, per each |
| **USDA market prices** | P0 | Daily sync; comparison column |
| Daily Z report entry | P0 | Net sales, covers |
| Food cost % dashboard | P0 | Invoice cost / sales |
| Pro plan billing | P0 | Stripe Checkout; $49/mo |
| Privacy Policy | P0 | CCPA/CalOPPA mandatory |
| Terms of Service | P0 | Arbitration clause, liability cap |
| Accessibility | P0 | WCAG 2.1 AA; Lighthouse ≥ 90 |
| CCPA data export | P0 | Download all user data |
| CCPA account deletion | P0 | Full erasure flow |
| Cookie consent banner | P0 | CIPA compliance |
| Push notifications | P1 | Operational reminders |
| Item master | P1 | Learn Sysco codes → common names |

### Phase 1 Non-Goals (explicitly deferred to Phase 2)
- US Foods / PFG parsers
- Recipe costing
- Inventory management
- Multi-user / staff logins
- Mobile native app
- API access
- Vendor price comparison (same item, multiple suppliers)

---

## Phase 2 — Growth

| Feature | Why |
|---------|-----|
| US Foods + PFG parsers | Expand addressable invoices |
| Recipe costing | Map invoice items → menu items → theoretical food cost |
| Theoretical vs actual food cost | The gold standard metric operators want |
| Multi-user (staff/manager) | Enterprise sales unlock |
| Multi-location dashboard | Chain restaurants |
| Inventory tracking | Variance analysis |
| Vendor comparison | Same item, lowest price suggestion |
| Mobile app (Capacitor) | iOS/Android store presence |
| Enterprise API | Integration with POS systems (Toast, Square) |
| Weekly supplier report | Email digest for ops managers |

---

## Go-To-Market

### Target Customer (Phase 1)
- Independent restaurants, 1–3 locations
- California (starting Bay Area + LA)
- Sysco customer (primary distributor)
- Owner-operated or small ops team
- Food cost is a daily concern (as it should be for any restaurant)
- Not using any cost-control software today

### Acquisition Strategy
- **Direct outreach**: Cold email/DM to restaurant owners (LinkedIn, Instagram)
- **Sysco rep relationships**: Sysco reps want their customers to stay; help them show value
- **Restaurant associations**: CA Restaurant Association, local groups
- **Content**: "Here's what Sysco doesn't want you to know about your invoice" — high shareability
- **Referral**: Operators talk to each other; offer 1 month free per referral

### Pricing Rationale
- $49/mo = less than 1 hour of labor at CA minimum wage
- A single insight (paying 20% above market on chicken breast) can save hundreds/month
- No annual commitment initially — reduce friction to trial
- Offer 14-day free trial (no credit card required)

---

## Success Metrics (Phase 1)

| Metric | Target (Month 3) | Target (Month 6) |
|--------|-----------------|-----------------|
| Paying customers | 20 | 75 |
| MRR | $980 | $3,675 |
| Invoice parse accuracy | 95%+ | 97%+ |
| Churn (monthly) | < 10% | < 7% |
| NPS | > 30 | > 45 |
| Time-to-first-insight | < 5 min from signup | < 3 min |

---

## Technical Milestones

| Week | Deliverable |
|------|------------|
| 1–2 | Auth, onboarding, DB schema |
| 3–4 | Invoice upload + Azure Doc Intelligence integration |
| 5–6 | Sysco parser (full cost computation) |
| 7 | USDA price sync + comparison UI |
| 8 | Z report + food cost % dashboard |
| 9 | Stripe billing + Pro plan gate |
| 10 | Legal pages (Privacy Policy, ToS, Accessibility) |
| 11 | Accessibility audit + fixes |
| 12 | Beta launch (invite-only, 10 operators) |
| 13–14 | Beta feedback + parser improvements |
| 15 | Public launch |

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Sysco changes invoice format | Medium | High | Parser is modular; update per format version; test corpus |
| Azure Doc Intelligence costs scale unexpectedly | Low | Medium | Cache parsed results; OCR only on new uploads; monitor usage |
| ADA accessibility lawsuit | Low | High | Lighthouse ≥ 90 before launch; document all a11y tests |
| CCPA data breach | Low | High | Supabase RLS; no card data stored; audit log |
| Stripe payment failure churn | Medium | Medium | Dunning emails; 3-attempt retry; grace period |
| Low parser confidence on non-Sysco invoices | High (Phase 1) | Low | Phase 1 explicitly Sysco-only; generic parser for Phase 2 |
| Restaurant operators distrust cloud | Medium | Medium | Emphasize data privacy; show SOC 2 path in roadmap |
