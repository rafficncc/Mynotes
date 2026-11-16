# FamilyFin – the money coach for every family

FamilyFin is a mobile expense tracker (Android + iOS, built with Expo / React Native). It is made for the person who
runs a household budget. It doesn't just record spending: it tells you **where the money goes, how to spend
less, where to buy cheaper, and which credit card to swipe today**.

## Features

### Track every rupee, in every mode
- Accounts of every kind: **cash, bank accounts, debit cards, credit cards, UPI / wallets, other**.
- **Expenses, income and transfers** between accounts (ATM withdrawal, credit card bill payment, wallet top-up).
- Debit cards can be **linked to a bank account**. Spends reduce the bank balance, but reports still show "debit card" as the payment mode.
- Net worth, what you own and what you owe, at a glance.
- Merchant auto-complete: picking a past shop also picks its usual category.
- Spend per **family member** (spouse, kids, parents).

### Smart Card – credit card optimiser (unique)
- When you add a card, the app **asks for its billing (statement) day and due day**, plus the optional limit and reward rate.
- **"Which card should I use?"**: ranks your cards by **interest-free days** for a purchase today or on a future date. It skips cards without enough limit, penalises utilisation above 30%, and uses reward rate as a tie-breaker.
- **A live tip while you add an expense**: "Rewards Card gives 18 more interest-free days. *Use this card*."
- Per card: amount due, due date, unbilled amount, limit used, and the **golden window** (the days right after billing that give the longest free credit).
- One tap to pay a bill (it pre-fills a transfer from your bank).

### Savings coach – suggestions with ₹ amounts
A rule engine (`src/logic/insights.ts`) checks the family's own data and estimates the **monthly saving** of each suggestion:
- Budget exceeded, or on track to be exceeded (with a safe daily spend limit for the rest of the month).
- A category up sharply compared with the same dates last month.
- The "latte factor": many small dining/shopping spends that add up.
- **Cheaper shop for the same item**: "Buy Milk at Kirana Corner – ₹54 vs ₹60 at FreshMart."
- **Cheaper merchant in the same category**: "Your average bill at Cafe Aroma is ₹646 vs ₹410 at …"
- Forgotten **subscriptions** (detected automatically).
- Weekend splurges, a heavy share of cash spending, low savings rate, the 50-30-20 rule, and the emergency fund.
- Credit card dues, overdue bills, high utilisation, and "use your card for float" tips (only if you pay cards in full).

### Price book (unique)
Note prices of items at different shops, or just add *item + quantity* while logging an expense. The app keeps a
per-shop price history and shows the cheapest shop for each item, plus how much you'd save at your usual quantities.

### Insights and charts
- Category donut, payment-mode split, 6-month income vs expense bars, top merchants, spend by family member.
- **Family money health score (0–100)**: savings rate, budget discipline, emergency fund and credit health.
- **Cut-back simulator**: "What if we spend 25% less on dining?" It shows the monthly and yearly saving, what that becomes as a 10-year SIP, and how soon you'd reach your goal.
- **No-splurge streak** to make saving a habit.

### Scan a bill
Take a photo of a bill, or pick one from the gallery, and FamilyFin fills in **one expense for the bill total**: shop, date,
total, category (learned from your past spends) and the payment account (card / UPI / cash, matched by card digits when
printed). The text is read **on the phone** with Google ML Kit, so photos are never uploaded. Works with Indian (GST),
Gulf (VAT), US and European bill formats, including slightly tilted photos. You can also save the bill's item prices to
the price book for "cheaper shop" tips (off by default). Needs the installed app; it doesn't work in Expo Go or the web preview.

### Actions tab: everything due this cycle
One list of what to pay or renew in the current spending cycle: credit card bills, mobile/internet/utility bills,
taxes and fines, EMIs, and document renewals. Items are grouped as **Overdue**, **Due soon** (reminder date reached),
**Later this cycle** and **Done**. Use *Pay & record* (pre-fills the transaction) or *Mark paid*. The tab shows a badge with the number of urgent items.

### Spending cycle
Set the day your month starts (e.g. salary on the 25th). Budgets, reports, insights, allowances and Actions all
follow that cycle instead of the calendar month.

### Bills, reminders and documents
- Bills by type: mobile, internet, electricity, water, gas, rent, school, insurance, **tax, fines/challans, government fees**, subscriptions.
- Repeats monthly, every 3 or 6 months, yearly, or once (fines).
- **"Remind me N days before"** on every bill, EMI, credit card and document. Phone notifications at 9 AM (installed app).
- **Document expiry tracking**: passport, visa, Emirates ID, residence permit, Aadhaar, PAN, driving licence, vehicle registration, health card, insurance policy, plus sensible reminder defaults (e.g. passport 6 months ahead).

### EMIs
- Switch on **"Converted to EMI"** when adding a credit card purchase. The card bill then includes only the monthly instalment, with no-cost or interest EMIs (reducing-balance formula).
- Add running EMIs manually (card EMIs, home/car/personal loans, other instalments): see what's paid, what's left, the end date and the total interest.

### Accounts by category
Savings & cash (bank, cash, UPI/wallet, debit card), Investments (stocks/funds/gold, fixed deposits), Credit cards,
Loans (with interest rate), Real estate, and Other, each with group totals in net worth.

### Family allowances and group
- Give each member an allowance per cycle and see spent vs left. Choose who uses each phone.
- **Family group without a server**: the organiser shares an invite code; each member logs on their own phone and sends an
  update code; the organiser imports it (duplicates are ignored). Real-time cloud sync is on the roadmap.

### Region-aware
27 currencies. Savings tips change with the country (e.g. India: Jan Aushadhi, fuel surcharge waiver, 80C; UAE/Gulf:
monthly fuel price changes, AC bills, remittance rates; UK: ISA allowance, Railcards; US: 401(k) match, and more).

### Custom categories
Add your own categories with an icon, a colour and a type (need/want/saving/income). Edit or delete them any time.

### Google account and Drive backup
Sign in with Google during onboarding or in Settings. Back up to and restore from the hidden app-data folder of your own Google Drive.

### Free plan and Premium
Free: 4 accounts + 4 credit cards. **Premium: one-time lifetime price of ₹2,500**, shown converted to every supported
currency (e.g. AED 109, $28.99, £21.99). Store billing (Google Play / App Store) still has to be connected before
release. Until then the Premium screen offers a "unlock for testing" option.

### Also included
Monthly budgets (with suggested limits from your 3-month average), bill reminders that auto-mark themselves paid, savings
goals with a required monthly saving, multi-currency, CSV export, JSON backup, demo data and a privacy-first design (no bank login, no SMS reading; data stays on the phone).

## Running the app

```bash
npm install
npx expo start          # scan the QR code with Expo Go (Android/iOS)
npm test                # unit tests for the money logic
npm run typecheck
```

Production builds: `npx eas-cli@latest build -p android` (Play Store) / `-p ios` (App Store).

### One-time setup for Google sign-in and Drive backup
1. In Google Cloud Console, create a project and enable the **Google Drive API**.
2. Configure the OAuth consent screen with the scopes `openid`, `email`, `profile` and `drive.appdata`.
3. Create OAuth client IDs for **Android** (package `com.familyfin.app` + your signing SHA-1), **iOS** (bundle `com.familyfin.app`) and **Web**.
4. Put them in `app.json` → `expo.extra.google` (`androidClientId`, `iosClientId`, `webClientId`) and rebuild.

Until the IDs are set, the Google buttons are shown as disabled with an explanation. Everything else works.

Notifications use `expo-notifications`. Reminders are rescheduled automatically whenever bills, EMIs, cards or documents change.

## Code structure

```
src/
  app/                 Expo Router screens
    (tabs)/            Home, Transactions, Actions, Insights, Cards, More
    add.tsx            Add/edit expense, income, transfer (with live card tip)
    account-form.tsx   Accounts & credit card billing cycle
    budgets, prices, bills, goals, family, simulator, settings, welcome
  logic/               Pure TypeScript – no React, fully unit-tested
    creditCard.ts      Statement/due date maths, card ranking
    insights.ts        Suggestion engine, health score, streak
    analytics.ts       Grouping, trends, projections
    priceBook.ts       Cheapest-shop comparison
    recurring.ts       Bill schedules (all frequencies), subscription detection
    actions.ts         Actions list + reminder schedule
    emi.ts             EMI maths and progress
    region.ts          Currencies, premium pricing, country-specific tips
    familySync.ts      Family group invite/update codes
  services/            Google sign-in + Drive backup, phone notifications
  store/               Zustand store persisted to device storage (with data migrations)
  components/          UI kit and SVG charts
```

## Roadmap to a big app

1. **Faster entry**: SMS/notification parsing of bank alerts on Android (opt-in), receipt scanning (OCR), a home-screen widget, voice entry ("200 rupees milk cash").
2. **Family sync**: shared household with a cloud backend (e.g. Supabase/Firebase) so spouses log on their own phones; pocket-money accounts for kids.
3. **Community price map**: crowd-sourced item prices by locality, so the "cheaper shop" tip works even for shops you haven't visited.
4. **Card benefits database**: reward categories, fuel surcharge waivers and offers per card, so Smart Card picks the card with the best *value*, not just the most days.
5. **Push notifications** for bill due dates, budget breaches and the golden window ("Buy the TV after the 6th").
6. Regional languages (Hindi, Tamil, Telugu, Malayalam…) and dark mode.
7. Account Aggregator (RBI AA framework) integration for automatic bank sync.

## Ways to make money

- **Freemium**: core tracking is free. "FamilyFin Plus" (₹49–99/month) adds family sync, unlimited history, OCR, advanced reports and cloud backup.
- **Credit card / loan referrals**: recommend better-fit cards based on spending patterns (affiliate commissions; keep it transparent and opt-in).
- **Local deals**: shops pay to be shown as the cheaper alternative, clearly labelled as sponsored.
- **Financial products**: referrals for insurance, SIP and emergency-fund products, plus suggestions from the health score.
- **B2B**: anonymised, aggregated price-trend insights (only with explicit consent and strong privacy guarantees).

Growth idea: a share card ("Our family saved ₹8,000 this month with FamilyFin") makes word-of-mouth easy.
