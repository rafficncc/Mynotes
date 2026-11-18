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

## iPhone

Apple does not allow installing apps from a file, so the options are:

| Route | Cost | Testers |
|---|---|---|
| **TestFlight** (recommended) | Apple Developer Program, US$99/year | Up to 10,000, invited by a public link |
| **Ad hoc build** | Same Apple account | Up to 100 registered devices (each iPhone's ID must be added) |
| **Expo Go** | Free | Testers install "Expo Go" and must be members of your Expo account |

### TestFlight steps (once you have an Apple Developer account)
1. Create a free account at expo.dev.
2. On your computer, in this project: `npm install`, then `npx eas-cli@latest login`.
3. Run `npm run build:testflight`. EAS asks for your Apple ID once and creates the certificates and app record for you. Then it builds in the cloud and uploads to App Store Connect.
4. In App Store Connect → TestFlight, add testers or turn on a **public link** and share it.
   Testers install the **TestFlight** app and open the link.

### Apple Simulator only (no Apple account needed)
`npm run build:ios-sim` produces a build for the iOS Simulator on a Mac. This is useful for checking the app, but it can't go on a real iPhone.

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
