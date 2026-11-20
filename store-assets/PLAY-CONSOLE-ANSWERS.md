# FamilyFin: answers for every Play Console setup page

Copy these into **Play Console → Dashboard → "Provide app information and create your store listing"**, one page at a time,
then press **Save** on each page.

Things to replace: **`<your support email>`** and **`<privacy policy URL>`**.

---

## A. Tell Google about your app's content (Policy → App content)

### 1. Privacy policy
Paste a public web address for the policy. **Free, 5-minute way: Google Sites.**
1. Go to sites.google.com → **Blank site** → title it "FamilyFin Privacy Policy".
2. Paste the text from `PRIVACY.md` (in the project), with your support email filled in.
3. Click **Publish**, choose a web address (e.g. `familyfin-privacy`), then check it opens in a private browser window.
4. Paste that URL into Play Console.

### 2. App access (Sign-in details)
Choose **"All functionality in my app is available without any access restrictions"**.
(No login is needed. Google sign-in is optional and only for backup; the PIN is set by the user on their own phone.)

### 3. Ads
**No, my app does not contain ads.**

### 4. Content rating
Start the questionnaire:
- Email: `<your support email>`
- Category: **All other app types** (it's not a game, social or news app)
- Violence, sexuality, language, controlled substances, gambling, horror: **No** to all
- Does the app let users interact or exchange content with each other? **No**
- Does the app share the user's current location with other users? **No**
- Does the app allow users to purchase digital goods? **Yes** (Premium unlock)
- Does it contain gambling or simulated gambling? **No**
- Is the app a web browser or search engine? **No**

Expected result: **Everyone / 3+**. Save, then **Apply** the rating.

### 5. Target audience and content
- Target age groups: tick **18 and over** only
- Could the app unintentionally appeal to children? **No**
- (Because no child age groups are selected, the Families policy questions don't apply.)

### 6. Data safety
**Section: Data collection and security**
- Does your app collect or share any of the required user data types? **Yes**
- Is all user data collected by your app encrypted in transit? **Yes**
- Do you provide a way for users to request that their data is deleted? **Yes**
  (users erase everything in Settings → Erase all data, and remove the Drive backup from their Google account)

**Section: Data types**: tick only these:

| Data type | Collected | Shared | Processed ephemerally | Required or optional | Purpose |
|---|---|---|---|---|---|
| Personal info → **Name** | Yes | No | No | Optional | Account management |
| Personal info → **Email address** | Yes | No | No | Optional | Account management |
| Financial info → **Other financial info** | Yes | No | No | Optional | App functionality (Google Drive backup) |

Do **not** tick location, contacts, messages, photos, audio, health, device IDs, app activity or purchase history:
- Bill photos and scanned text stay on the phone (text reading is on-device).
- Voice entry uses the phone's own speech service; FamilyFin doesn't store or send the audio.
- Play handles the Premium payment itself; the app gets no card or payment details.
- The app has no analytics, crash reporting or ads SDK.

Why "collected" at all: Google counts data as collected when it leaves the phone. Data only goes out when the user chooses to
connect Google and back up to **their own** Drive. Declaring it is the safe answer and matches the privacy policy.

### 7. Government apps
**No.** The app is not developed by or for a government.

### 8. Financial features
FamilyFin only **tracks** money the user types in. It does not lend, hold money, make payments, trade or connect to banks.
- If the list has a **personal finance / budgeting / expense management** option, tick only that.
- If it doesn't, choose **"My app doesn't provide any financial features"**.
- Don't tick banking, loans, payments, transfers, investing/trading, insurance or crypto. The app tracks loans, EMIs, FDs and
  insurance policies but provides none of them.

### 9. Health
**My app does not have any health features.** (Medical claims are only tracked as expenses.)

### 10. If Play asks about other declarations
- **News app:** No
- **COVID-19 contact tracing:** No
- **Advertising ID:** **No**, the app doesn't use it
- **Photo & video permissions:** the app uses the system photo picker, so no declaration is needed. If Play asks, the use is "attach a bill photo / scan a bill".

---

## B. Organise and present the app

### 11. App category and contact details (Store settings)
- App or game: **App**
- Category: **Finance**
- Tags: choose up to 5 that fit, e.g. Budget, Expense tracker, Personal finance, Bill reminder, Money manager
- Email: `<your support email>` (shown publicly)
- Phone: optional, leave empty
- Website: optional (your Google Sites page is fine)
- External marketing: leave **on**

### 12. Main store listing (Grow → Store presence → Main store listing)

**App name** (max 30): `FamilyFin: Family Budget`

**Short description** (max 80):
```
Family budget, card bills, reminders & savings. Private, simple, in one app.
```

**Full description** (max 4,000):
```
FamilyFin is the money app for the whole family. Track every rupee, pay every bill on time, use the right credit card, and see where you can save. Your data stays on your phone.

★ SEE YOUR FAMILY'S MONEY AT A GLANCE
• Spending this cycle, income, net worth and cash in hand on one screen
• A Family Money Health score with simple tips to improve it
• Set your cycle to your salary day, not just the calendar month

★ EVERY ACCOUNT IN ONE PLACE
• Bank, cash, UPI wallets, debit and credit cards
• Fixed deposits, mutual funds/SIPs, gold, property and loans
• Transfers between accounts, credit card bill payments and ATM withdrawals keep every balance right

★ USE THE RIGHT CREDIT CARD
• Enter your billing and due dates and FamilyFin tells you which card gives the most interest-free days today
• See amount due, unbilled spends and available limit for each card
• Track card rewards and convert purchases to EMI

★ NEVER MISS A DUE DATE
• Actions tab lists everything to pay this cycle: card bills, EMIs, rent, school fees, mobile and internet bills, insurance premiums
• Reminders a set number of days before each due date
• Expiry alerts for passport, visa, Emirates ID, driving licence and other documents
• Mark a bill paid and choose the account it was paid from

★ ADD EXPENSES IN SECONDS
• Scan a bill: shop, date and total are filled in from the photo, read on your phone
• Voice entry: say "450 petrol with HDFC card"
• Split bills, attach bill photos, keep warranty dates

★ FAMILY BUDGETS
• Budgets by category and an allowance for each family member
• Family group: members log their spending and send it to you
• Savings goals, challenges and badges to keep everyone motivated

★ LEND & BORROW
• Record money lent to or borrowed from relatives and friends
• See who owes whom, with every repayment and the account it came from

★ MONEY VAULT: DON'T LEAVE YOUR MONEY UNATTENDED
If something happens to you, would your family know where everything is? Keep accounts, lockers, insurance policies, nominees and emergency contacts in one PIN-protected place for your loved ones.

★ SMART INSIGHTS & REPORTS
• Personal saving suggestions for your region and currency
• Reports for any dates, month-to-month comparison, net worth trend
• Share reports as PDF; year-in-review summary

★ MADE FOR FAMILIES EVERYWHERE
• 25+ currencies, including INR, AED, SAR, QAR, USD, GBP and EUR
• English, Hindi, Malayalam, Tamil and Arabic
• Dark mode, large text and screen reader support
• Tracks money sent home, foreign-currency spending, trips and events, vehicle fuel, and medical claims

★ PRIVATE BY DESIGN
• No bank login needed and no SMS reading
• Data is encrypted and stays on your phone
• App lock with PIN or fingerprint; hide amounts with one tap
• Optional backup to your own Google Drive

FamilyFin is free to use. FamilyFin Premium is a one-time lifetime purchase that removes account limits.
```

**Graphics** (all in the `store-assets` folder):
| Field | File |
|---|---|
| App icon (512×512) | `play-icon-512.png` |
| Feature graphic (1024×500) | `feature-graphic-1024x500.png` |
| Phone screenshots (2–8) | `screenshots/screenshot-01.png` … pick your best 8 (suggested: 01, 02, 03, 04, 05, 06, 07, 11) |
| Video (optional) | A YouTube link. Upload `FamilyFin-reel.mp4` to YouTube as public or unlisted first. |

Tablet screenshots are optional; skip them.

---

## C. Pricing and the Premium purchase

### 13. Set the price of your app (Monetize → App pricing)
Choose **Free**. Premium is sold inside the app.
⚠️ A free app can **never** be changed to paid later. That's fine: Premium is an in-app purchase.

### 14. Create a merchant account (Settings → Payments profile, or Monetize → Monetization setup)
You need this to sell Premium. Have ready:
- Legal name and address (as on your PAN/bank account)
- Bank account for payouts (account number, IFSC). Google sends a small test deposit to verify it.
- Tax details: **PAN**, plus GSTIN if you're registered (individuals can usually continue without GST at first)
- Public merchant name shown on receipts, e.g. "FamilyFin"

### 15. Create the Premium product (Monetize → Products → One-time products, or "In-app products")
- Product ID: **`familyfin_premium_lifetime`** (must match exactly)
- Name: `FamilyFin Premium (Lifetime)`
- Description: `Unlimited accounts and cards, forever. One-time payment.`
- Price: **₹2,500.** Use "Update exchange rates" or set local prices (e.g. AED 105, SAR 109, USD 28.99, which is what the in-app Premium screen shows).
- Status: **Active**

Then **Settings → License testing**: add your Gmail and your testers' Gmail addresses so test purchases are free.

---

## Done check
When every item on the Dashboard has a green tick, the closed test can be reviewed and later you can **Apply for production**.
