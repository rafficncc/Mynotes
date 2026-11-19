# Publishing FamilyFin on Google Play

You already have a Play Console developer account. This is everything still needed, in order.
Steps marked **(you)** are done in a browser; nobody can do them for you.

## 0. Decide the package name now (it can never change)
The app is set to `com.familyfin.app` (`android.package` in `app.json`). After the first upload to Play it is permanent.
Since you will publish more apps under one studio name, consider `com.<studio>.familyfin` (e.g. `com.brightnest.familyfin`).
Change it in `app.json` (`android.package` and `ios.bundleIdentifier`) **before** step 2.

## 1. One-time setup on your computer
```bash
git clone https://github.com/rafficncc/Mynotes.git familyfin && cd familyfin
git checkout claude/family-expense-tracker-qjfk4m
npm install
npx eas-cli@latest login     # free Expo account
npx eas-cli@latest init      # links the project; commit the change it makes to app.json
```

## 2. Build the store file (.aab)
```bash
npm run build:aab
```
- First time, answer **Yes** to "Generate a new Android Keystore". EAS keeps this **upload key** safe in your Expo account.
  Back it up too: `npx eas-cli@latest credentials -p android` → download keystore. If you lose it you need Google support to reset it.
- Store builds automatically **hide "Unlock for testing"** on the Premium screen (see `app.config.js`).
- Each build gets a new version code automatically.

## 3. Create the app in Play Console (you)
Play Console → **Create app**: name *FamilyFin – Family Expense Tracker*, default language, **App**, **Free** (Premium is an in-app purchase), accept the declarations.

## 4. Upload the first build by hand (you)
Google requires the very first upload to be manual: **Test and release → Testing → Internal testing → Create new release**,
upload the `.aab` from step 2 (download link is on expo.dev), and accept **Play App Signing** (Google holds the final signing key).
Add your own Gmail as an internal tester and install from the opt-in link.

## 5. Fill in "App content" (you) — Policy → App content
| Item | What to answer for FamilyFin |
|---|---|
| Privacy policy | A public URL. Host `PRIVACY.md` (Google Sites, GitHub Pages or your studio site) after filling in the contact email. |
| Ads | No ads |
| App access | All features usable without a login (Google sign-in is optional, for backup only) |
| Content rating | Fill the questionnaire: utility/productivity, no violence etc. → usually "Everyone"/"3+" |
| Target audience | 18 and over |
| Data safety | See the table below |
| Financial features | Declare **Personal finance → budgeting / expense tracking**. FamilyFin does **not** lend money, hold deposits, trade, or process payments. |
| Government app / News / Health | No |

**Data safety answers**
- *Does your app collect or share user data?* — Data stays on the phone (encrypted). Google sign-in reads the user's **name and email** only on the device, and the backup goes to the user's **own** Google Drive (app folder). The developer receives nothing.
  The safe answer is: **Personal info → Name, Email address: collected, not shared, processed on device only, optional, purpose: account management (backup)**. Financial info is **not collected** (it never leaves the device except into the user's own Drive at their request).
- Data is encrypted in transit: **Yes** (HTTPS to Google). Users can delete data: **Yes** (Settings → Erase all data, protected by the app PIN).

## 6. Store listing (you) — Grow → Store presence → Main store listing
- **Short description** (≤ 80 chars): `Family budget, card bills & lending in one simple, private expense tracker.`
- **Full description** (≤ 4,000): list the features (accounts & cards, best card to use, bills/EMI reminders, scan a bill, voice entry, lend & borrow, family budgets, reports, Hindi/Malayalam/Tamil/Arabic, PIN lock, data stays on your phone).
- **App icon** 512×512 PNG (`assets/images/icon.png` resized), **feature graphic** 1024×500 PNG, **at least 2 phone screenshots** (take them from the APK with demo data loaded; 4–8 is better).
- Category: **Finance**. Contact email: your support email.

## 7. Premium purchase (you) — Monetize with Play
1. **Set up a payments profile** (Monetize → Monetization setup) with your bank account — needed to sell anything.
2. Monetize → Products → **One-time products** → **Create**:
   - Product ID: **`familyfin_premium_lifetime`** (exactly this; the app asks Play for this ID)
   - Name *FamilyFin Premium (lifetime)*, price **₹2,500**. Use "Set prices for all countries" to convert, then round per country as you like. Activate it.
   - The product page only unlocks after a build with billing (step 4) is uploaded.
3. Settings → **License testing**: add your Gmail and testers. Their purchases are free test purchases.
4. Test: install from the internal testing link → More → Premium → Buy → it should show Play's payment sheet.
   Uninstall/reinstall and tap **Restore purchase** to check that it comes back.

## 8. Google sign-in + Drive backup (you, in Google Cloud Console)
1. console.cloud.google.com → create project *FamilyFin* (or one project for your studio).
2. **APIs & Services → Library → Google Drive API → Enable.**
3. **OAuth consent screen** (Google Auth Platform): External, app name, support email, privacy policy URL, home page.
   Scopes: `openid`, `email`, `profile`, `.../auth/drive.appdata` (the app only sees its own backup file, never the user's other files).
   Add yourself as a test user, then **Publish app** when ready. Google may ask for verification of the consent screen; follow its checklist.
4. **Credentials → Create OAuth client ID**, three times:
   - **Android**: package name from step 0; SHA-1 = **App signing key certificate** from Play Console → Test and release → App integrity → App signing.
     Create a **second Android client** with the **upload key** SHA-1 (`npx eas-cli@latest credentials -p android` shows it) so APKs you install directly also work.
   - **iOS**: bundle ID (for later).
   - **Web application** (needed by the sign-in library).
5. Put the IDs in `app.json` → `expo.extra.google` (`androidClientId`, `iosClientId`, `webClientId`), commit, and build again (step 2).
6. Test on the internal-testing build: More → Settings → Connect Google → Back up now.

⚠️ **Known risk to test first:** the app signs in with `expo-auth-session` (browser redirect). Google has been tightening redirect rules for
Android OAuth clients. If sign-in fails with "invalid request / custom scheme" on the Play build, the fix is to switch to the native
Google Sign-In library (`@react-native-google-signin/google-signin`). Ask me and I'll make that change; the Drive backup code stays the same.

## 9. Testing before production (you)
- **New personal developer accounts must run a closed test with at least 12 testers for 14 days in a row** before Play allows a
  production release. Create **Closed testing → track**, add 12+ Gmail addresses (friends and family) or a Google Group, and ask them to
  keep the app installed and use it. Organisation accounts are exempt.
- After 14 days: Dashboard → **Apply for production**, answer the questions about your test, then create a production release
  (promote the tested build). First review usually takes a few days.

## 10. Later uploads (no browser needed)
1. Play Console → Setup → API access → create a **service account** with "Release manager" rights, download its JSON key,
   save it as `play-service-account.json` in the project folder (already git-ignored, never commit it).
2. `npm run build:aab` then `npm run submit:android` uploads it to the **internal** track as a draft (see `eas.json`). Promote it in Play Console.

## Your Play account ID
The developer account ID (5446870138831669423) is not needed in the app code. You'll see it in Play Console URLs and use it when contacting Google support.

## Checklist
- [ ] Package name decided (step 0)
- [ ] First `.aab` uploaded, Play App Signing accepted
- [ ] Privacy policy URL live
- [ ] App content: ads, rating, audience, data safety, financial features
- [ ] Store listing: descriptions, icon, feature graphic, screenshots
- [ ] Payments profile + `familyfin_premium_lifetime` product active + license testers
- [ ] Google Cloud: Drive API, consent screen, Android (×2) / Web client IDs in `app.json`
- [ ] Closed test: 12 testers × 14 days
- [ ] Apply for production
