<!-- DRAFT — for attorney review; not legal advice. This is proposed in-app opt-in consent copy for Reverto's peer-benchmarking feature. A licensed California attorney must review and bless the wording before it is shown to any user or used to collect consent. Do not ship the feature on the strength of this draft. Remove this comment when the attorney signs off. -->

# Peer Benchmarking — Opt-In Consent Copy (in-app)

**Purpose:** exact plain-English copy for a **dedicated, separate opt-in toggle** — NOT bundled into
signup or the Terms of Service. A user who leaves this off still gets full Reverto value (their own
true cost per unit and the USDA market comparison). This must render as its own control (e.g., in
Settings → Data & Privacy, and/or a one-time prompt), with the consent event stored (who, when, copy
version).

Founder facts baked in: product **Reverto**; contact **revertoo.ino@gmail.com**; jurisdiction
California, USA.

---

## 1. The toggle (short form — shown next to the switch)

**Label:** `Share my prices to unlock peer benchmarks`

**One-line summary (next to the toggle):**
> Turn this on to help build (and get access to) "what restaurants like you actually pay" — an
> anonymized median of prices paid by other Reverto restaurants. Optional, and you can turn it off
> anytime.

**Toggle states:**
- OFF (default): `Off — you still get your own costs and USDA market prices.`
- ON: `On — your prices help build anonymized peer benchmarks, and you can see them.`

---

## 2. What you're agreeing to (expandable "Learn more" — long form)

> **Peer benchmarking: what it is**
>
> Normally, Reverto compares your prices against public USDA market data. Peer benchmarking adds a
> second reference point: **the median (middle) price that other Reverto restaurants actually paid**
> for the same commodity. It answers "am I paying more than places like me?" — not just "am I paying
> more than the government average?"
>
> **What you contribute if you turn this on**
> - The **commodity-level prices you paid** (for example, "chicken breast, $/lb"), taken from the
>   invoices you already upload. We use the parsed unit cost, not the raw invoice image.
> - We do **not** contribute your business name, your location beyond your general region, your
>   distributor account, your invoice numbers, or any individual line that could be traced back to
>   you.
>
> **How it's kept anonymous**
> - We only ever show a **median** — never any single restaurant's price.
> - We only show a peer number when **at least 5 different restaurants** are in the sample (and
>   enough line items), so no one business's prices can be singled out or reverse-engineered.
> - The number is shown by **region only** — never your neighborhood, address, or name.
> - It reflects **past prices**, not live quotes, and it's never shared with suppliers or shown as a
>   named competitor's price.
>
> **What you get in return**
> - Access to the peer benchmark ("what restaurants like you pay") blended with USDA data, so you can
>   see whether you're above or below what similar restaurants pay.
>
> **It's optional and reversible**
> - You never have to turn this on. If you leave it off, you still get your own true costs and the
>   USDA comparison — the full core of Reverto.
> - You can turn it off anytime (see "Turning it off" below).
>
> Questions? Email **revertoo.ino@gmail.com**.

---

## 3. The consent action

**Primary button (only enabled when the toggle is ON):** `Turn on peer benchmarking`

**Confirmation microcopy under the button:**
> By turning this on, you agree that Reverto may include your commodity-level prices in anonymized,
> aggregated peer benchmarks as described above and in our Privacy Policy. You can turn this off at
> any time.

---

## 4. Turning it off (revocation wording)

**Shown when the user switches the toggle OFF, and in Settings:**

> **Turning off peer benchmarking**
>
> When you turn this off:
> - We **stop including your prices** in any new peer benchmarks from that point on.
> - Your own data stays exactly as it is for your own cost tracking — turning this off does not
>   delete your invoices or costs.
> - Prices you already contributed have been blended into anonymized medians made up of at least 5
>   restaurants. Because those medians are aggregated and can't be traced back to any single
>   business, we may not be able to pull your contribution back out of numbers already calculated —
>   but you won't be part of any benchmark going forward, and the next time each benchmark is
>   recalculated it no longer uses your data.
> - If you also want your underlying data deleted, use **Delete my data** (or email
>   **revertoo.ino@gmail.com**). See our Privacy Policy for how deletion and anonymized benchmarks
>   work together.
>
> **Confirm button:** `Turn off peer benchmarking`

---

## 5. Implementation notes for the engineer (not user-facing)

- Default state is **OFF**. Contribution and display of peer data require an explicit ON.
- Store a **durable consent record**: user/business id, timestamp, action (opt-in / opt-out), and the
  **version string of this copy** in force at the time.
- The consent toggle and its stored record are a **hard precondition** — the peer aggregation job must
  filter to opted-in businesses only, and must never surface a peer number for a business that has
  not opted in.
- Copy is **DRAFT pending attorney sign-off**; do not ship until blessed.
