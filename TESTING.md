# Testing FamilyFin on real phones

## Android (no store, no account)

1. Send the file `FamilyFin.apk` to the phone (WhatsApp, email, Google Drive, USB…).
2. Tap the file. Android will ask to **allow installs from this source** (e.g. "Allow from WhatsApp / Files"). Allow it.
3. Tap **Install**. If Play Protect warns about an unknown app, tap **More details → Install anyway** (this happens for any app not from the Play Store).
4. Open **FamilyFin** and tap **Explore with demo data**, or set up your own accounts.

Updating: install a newer APK over the old one. Data stays, because test builds are always signed with the same key.

Uninstalling the app deletes its data unless you backed it up (Settings → Share backup file).

### Building a new APK yourself
- **On Expo's cloud (easiest):** `npm install`, then `npx eas-cli@latest login`, then `npm run build:apk`. You get a download link and a QR code for testers.
- **Locally:** you need Android Studio's SDK and JDK 17. Run `npx expo prebuild --platform android`, then `cd android && ./gradlew assembleRelease`.
  The APK is in `android/app/build/outputs/apk/release/`.

## iPhone (TestFlight), before publishing on the App Store

iPhone apps can only be built on Apple computers. FamilyFin uses **Expo's cloud build (EAS)**, which runs on Macs in the
cloud, so you can start it from any Windows, Mac or Linux computer. Testers install the app with Apple's **TestFlight** app.

### One-time setup
1. **Join the Apple Developer Program** (US$99 a year) at developer.apple.com/programs. Approval can take a day or two.
2. **Create a free Expo account** at expo.dev.
3. On your computer, install Node.js 22 or newer and Git, then run:
   ```bash
   git clone https://github.com/rafficncc/Mynotes.git familyfin
   cd familyfin
   git checkout claude/family-expense-tracker-qjfk4m
   npm install
   npx eas-cli@latest login      # your Expo account
   npx eas-cli@latest init       # links the project to Expo (commit the change it makes to app.json)
   ```

### Build and send to TestFlight
4. Run:
   ```bash
   npm run build:testflight
   ```
   The first time, EAS asks you to **log in with your Apple ID** (with the 2-factor code). It then creates the App ID,
   certificates and provisioning profile for you. Answer **Yes** to its questions. The cloud build takes about 15–30 minutes,
   then it uploads to **App Store Connect** automatically.
   - If it says the bundle ID `com.familyfin.app` is taken, change `ios.bundleIdentifier` in `app.json` (e.g.
     `com.yourname.familyfin`) and run the command again.
5. Open **appstoreconnect.apple.com → your app → TestFlight**. Wait about 10–30 minutes until the build says
   "Ready to Submit" or "Ready to test".

### Invite testers
- **You and your team (up to 100 people):** TestFlight → Internal Testing → add their Apple IDs under Users and Access. They can test at once.
- **Friends (up to 10,000):** TestFlight → External Testing → create a group, add the build, fill in "What to test",
  and turn on a **public link**. Apple does a short Beta App Review first (usually within a day). Then share the link.
- Testers install the free **TestFlight** app from the App Store, open your link and tap **Install**.
- Each new build is uploaded the same way (`npm run build:testflight`); testers get an update in TestFlight. Builds last 90 days.

### Test Premium purchase on iPhone
In App Store Connect → your app → **In-App Purchases**, create a **Non-Consumable** product with the ID
`familyfin_premium_lifetime` and a price. In TestFlight, purchases use Apple's test (sandbox) payment, so no real money is charged.

### Good to know
- iPhones running iOS 16.4 or newer are supported.
- Encryption question: `app.json` declares `usesNonExemptEncryption: false`, because the app only uses Apple's built-in encryption
  (to protect data on the phone). That's why App Store Connect doesn't ask about it on every upload. Confirm this
  is still true if you add other encryption later.
- The free Expo plan includes a limited number of cloud builds each month; check expo.dev/pricing if you build often.
- Only want to try it on your own iPhone without TestFlight? `npm run build:ios` makes an "internal" build, but each
  iPhone must first be registered with `npx eas-cli@latest device:create`. TestFlight is easier for friends.

## What to test
- **New in this build:** More → Security (turn on App lock and try fingerprint), voice entry, Lend & borrow, Split a bill (Add expense), Reports → Share as PDF, Year in review → Share, Challenges, Settings → Language (Hindi/Malayalam/Tamil/Arabic) and Theme (dark), and delete a transaction then tap Undo.
- Long-press the FamilyFin icon for the shortcuts (Voice expense, Scan a bill, Add expense).
- **Scan a bill** (Home → Scan a bill): try a supermarket, restaurant and fuel bill. Check the shop, date, total and payment account it fills in. Then try a crumpled or tilted bill.
- Add an expense, income and transfer. Try the calendar date picker.
- Credit card: add billing and due days, then check the **Cards** tab and the card tip when adding an expense.
- **Actions** tab: pay a bill with *Pay & record*, or use *Mark paid*.
- Settings: change the **spending cycle** day and the **currency**, then check the Home and Insights tabs.
- Bills, EMIs and documents: set "remind me N days before", then allow notifications (Settings → Schedule reminders now).
- Not yet available in test builds: Google sign-in and Drive backup (they need the app's Google client IDs) and real Premium payment (use "Unlock for testing").
