<!-- DRAFT — attorney review recommended before publishing. This is a working draft prepared by a non-lawyer research assistant, not final legal advice. A licensed California attorney should review the final language before Reverto relies on it or invites real users. Remove this comment line when published. -->

# Privacy Policy

**Effective date: «EFFECTIVE DATE — fill in the date you publish this»**

This Privacy Policy explains how **Reverto** ("Reverto," "we," "us," or "our") collects, uses, and shares information when you use our website and application (the "Service"). Reverto is a cost-control tool for independent restaurants that reads distributor invoices, calculates true unit costs, compares them against public USDA market prices, and tracks food-cost percentage against the sales figures you enter.

Reverto is currently operated by an individual founder as an early-stage product. It is **not yet organized as a registered legal entity (such as an LLC or corporation)**. «If/when Reverto is incorporated, replace this paragraph with the registered entity name and address.»

If you have any questions about this policy or your data, contact us at **revertoo.ino@gmail.com**.

> Note to founder: double-check this email address for typos before publishing — it appears in legally binding text and is the address users will rely on to reach you.

---

## 1. Who this policy covers

Reverto is a business-to-business tool intended for restaurant owners, operators, and their staff who are **18 or older**. The Service is not directed to children, and we do not knowingly collect personal information from anyone under 13. If you believe a child has provided us information, contact us and we will delete it.

---

## 2. Information we collect

We collect only what we need to run the Service.

### a. Account information
When you sign up, we collect:
- Your **name**
- Your **email address**
- Your **business name**
- A **password**, which we never store in plain text — we store only a one-way **bcrypt hash** of it

### b. Information you upload or enter
- **Distributor invoices** you upload (images or PDFs), stored as files
- **Line-item data parsed from those invoices** — for example product descriptions, pack sizes, case prices, and computed unit costs
- **Daily sales figures** you enter to track food-cost percentage

### c. Technical information
When you use the Service, our hosting and infrastructure providers automatically process standard technical data such as your IP address and basic request/log information, for security, debugging, and to deliver the Service. We use your browser's **local storage and session storage** to keep you logged in (see Section 7, Cookies and Local Storage).

### d. Information we do *not* collect
- We do **not** currently use third-party advertising or marketing tracking pixels.
- We do **not** collect payment card data directly. «If you add paid plans, payments will be handled by a third-party processor such as Stripe, which collects card data on its own systems — update this section before turning on billing.»
- We do not send any personally identifying information to the USDA market-price data source; that integration only pulls public price data into Reverto.

---

## 3. Why we use your information

We use the information above to:
- Create and secure your account and log you in
- Parse your invoices and calculate unit costs and food-cost metrics
- Provide, maintain, troubleshoot, and improve the Service
- Communicate with you about your account or support requests
- Comply with legal obligations and enforce our Terms

We do **not** use your business or invoice data to train advertising profiles, and we do not sell it.

---

## 4. How we share information (third-party processors)

We do not sell your personal information and we do not share it for cross-context behavioral advertising. We do rely on the following third-party service providers ("subprocessors") to operate the Service. Each processes data only to provide services to us:

| Provider | What it does | What data it handles |
|---|---|---|
| **Netlify** | Website and serverless function hosting | Technical/request data, data in transit |
| **Supabase** | Database and file storage (United States, US-East region) | Account data, parsed invoice data, daily sales, uploaded invoice files |
| **Microsoft Azure (Document Intelligence)** | Optical character recognition / invoice parsing | The contents of invoice files you upload, sent for processing |
| **USDA AMS (Agricultural Marketing Service)** | Public market-price reference data | None of your personal data is sent to USDA — this is a one-way pull of public data |

We work to have an appropriate data processing agreement (DPA) in place with each provider that handles personal information. We may also disclose information if required by law, to respond to lawful requests, to protect our rights or users' safety, or in connection with a future business transfer (for example if Reverto is acquired or reorganized into a company), in which case we will continue to protect your information under this policy.

---

## 5. Where your data is stored

Your data is stored and processed in the **United States** (our database and file storage are hosted in a US-East region). If you access the Service from outside the US, you understand your data will be processed in the US.

---

## 6. Data retention

We keep your account information, uploaded invoices, parsed data, and sales figures for as long as your account is active or as needed to provide the Service. If you ask us to delete your account, or close it, we will delete or de-identify your personal information within a reasonable period, except where we are required to keep certain records to comply with law, resolve disputes, or enforce our agreements. Backups containing your data may persist for a limited period before being overwritten on our providers' normal cycles.

---

## 7. Cookies and local storage

Reverto does **not** currently use advertising cookies, analytics cookies, or third-party tracking pixels.

To keep you signed in, the app stores your authentication token in your browser's **local storage / session storage**. This is strictly necessary for the Service to function — without it you would be logged out on every page. This information stays in your browser and is sent back to us only to authenticate your requests. Clearing your browser storage will sign you out.

If we add analytics or any non-essential cookies in the future, we will update this policy and provide appropriate notice and choices (including a consent mechanism where required).

---

## 8. "Do Not Track" disclosure (CalOPPA)

Some browsers offer a "Do Not Track" (DNT) signal. There is no industry-standard way to interpret DNT signals. Because Reverto does not track you across third-party websites or over time for advertising, **we do not currently respond differently to DNT signals**. We will update this disclosure if our practices change.

---

## 9. Your California privacy rights (CCPA/CPRA)

If you are a California resident, the California Consumer Privacy Act, as amended by the California Privacy Rights Act, gives you the following rights. We honor these rights for all our users regardless of location.

- **Right to know / access** — You can request the categories and specific pieces of personal information we have collected about you, the sources, the purposes, and the categories of third parties with whom we share it.
- **Right to delete** — You can request that we delete the personal information we hold about you, subject to legal exceptions.
- **Right to correct** — You can request that we correct inaccurate personal information.
- **Right to opt out of "sale" or "sharing"** — We do **not** sell your personal information and we do **not** share it for cross-context behavioral advertising, so there is nothing to opt out of today. If this ever changes, we will provide a clear "Do Not Sell or Share My Personal Information" mechanism.
- **Right to limit use of sensitive personal information** — Some data you enter (such as financial/cost figures about your business) may be sensitive. We use it only to provide the Service and do not use it to infer characteristics about you. We do not use sensitive personal information for any purpose that would trigger the right to limit it.
- **Right to non-discrimination** — We will not deny you service, charge you a different price, or give you a lower quality of service for exercising any of these rights.

### Categories of personal information we collect (CCPA categories)
- **Identifiers** (name, email)
- **Account/commercial information** (business name, uploaded invoices, parsed cost data, sales figures)
- **Internet/network activity and technical data** (IP address, log data)

We collect these for the business purposes described in Section 3. We do not sell or share any of these categories.

### How to exercise your rights
- **Email us at revertoo.ino@gmail.com** with your request and the email address on your account. We will verify your request by confirming control of that account email.
- We aim to respond within **45 days** as required by law (and may extend once by another 45 days where permitted, with notice).
- **In-app self-service:** «PLANNED — a built-in "Export my data" and "Delete my account" feature is on our roadmap. Once live, link it here and reference it as the primary way to exercise access and deletion rights.»

An authorized agent may make a request on your behalf with proof of authorization; we may still require you to verify your identity directly.

---

## 10. Security

We take reasonable measures to protect your information, including:
- Storing passwords only as one-way **bcrypt hashes** (never in plain text)
- Serving the Service over **HTTPS/TLS** (encryption in transit)
- **Access controls** so that each business's data is scoped to that business
- Limiting access to production data and using reputable infrastructure providers

No method of transmission or storage is 100% secure, and we cannot guarantee absolute security. We do not make any specific certification claims (for example, we do not currently claim SOC 2 or independent audits). If we become aware of a data breach affecting your unencrypted personal information, we will notify affected California residents and authorities as required by California law.

---

## 11. Children's privacy

The Service is intended for users 18 and older and is not directed to children under 13. We do not knowingly collect their personal information.

---

## 12. Changes to this policy

We may update this Privacy Policy from time to time. When we do, we will revise the "Effective date" above and, for material changes, take reasonable steps to notify you. Your continued use of the Service after an update means you accept the revised policy.

---

## 13. Contact us

Questions or requests about this policy or your data:

**Reverto** (operated by an individual founder)
Email: **revertoo.ino@gmail.com**
«Mailing address — add a physical mailing address before publishing; California law and email-compliance rules generally expect a contact address.»
