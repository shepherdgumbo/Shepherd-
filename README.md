# ZimMarket Expo app

ZimMarket is a Zimbabwe-focused marketplace. This repository contains the Expo / React Native application configured to use the existing Firebase project `zimmarket-d4b35`.

## Implemented in this repository

- Expo Router mobile app and branded marketplace home.
- Live Firestore product browsing with search and category filtering.
- **Approved-only** public listings; no seeded demo products or fabricated reviews.
- Product detail page with legacy field compatibility for older product documents.
- Firebase email/password sign-in and registration, including password reset.
- Customer and seller account roles.
- Seller application queue: new seller accounts start pending and must be approved by an administrator before listing products.
- Seller product submission with USD/ZWL pricing, seller/business name, city/area, optional photo upload and pending product review.
- Optional product-photo selection and Firebase Storage upload.
- Seller “My listings” view showing review status.
- Persistent local cart with live price refresh, seller contact, shareable enquiries, and saved unpaid order requests.
- Buyer order tracking and a seller inbox to accept/reject requests and mark accepted requests complete.
- Buyer contact consent and Firestore rules that restrict order records to their buyer, seller, or administrator.
- Admin review screen to approve or reject pending listings.
- Loading, empty, offline/error states, and basic shop-safety guidance.
- Expo EAS preview and production build profiles.
- GitHub Actions TypeScript check and Android JavaScript bundle smoke test.

## Firebase project

The client configuration matches the public Firebase web-app configuration already published by the existing ZimMarket website. It can be overridden with `EXPO_PUBLIC_FIREBASE_*` environment variables. Firebase client configuration is not an admin credential; Firestore and Storage rules remain the security boundary.

The app uses:
- Project ID: `zimmarket-d4b35`
- Firestore collections: `users`, `products`
- Firebase Storage for optional listing photos

Enable Email/Password sign-in in Firebase Authentication if it is not already enabled.

## Product moderation and compatibility

The Expo app writes product documents with explicit fields and `status: "pending"`. Its public marketplace queries only products whose status is exactly `approved`. Admin approval changes the status to `approved`; rejection changes it to `rejected`. The UI itself is not a security boundary: Firestore rules must independently prevent sellers from approving their own products.

The existing website uses older product field names such as `n`, `p`, `c`, `i`, and `d`; the Expo screens can map those fields for already-approved records. Legacy documents without an explicit approved status are intentionally not shown. They must be reviewed before anyone sets them to approved.

## Security rules templates — not deployed

- `firebase/firestore.rules.example`
- `firebase/storage.rules.example`

These are review templates only. No Firebase rules have been changed or deployed by this repository. The order request, seller approval, and product approval features will be rejected by Firebase until the corresponding rules are carefully reconciled with the current production rules. **Do not paste these templates over production rules without reviewing the current rules first.** The currently deployed web page has legacy product-query/demo-fallback behavior that must be updated to respect `status == "approved"` before applying rules that deny unfiltered public product queries. A rules change without that frontend fix could break the old website.

Administrator access is granted by the trusted project owner, not by a public sign-up option. To use the review screen, a trusted administrator account must have `role: "admin"` in its user profile, and production rules must enforce admin-only changes server-side.

## Run locally

```bash
npm install
npx expo start
```

For static bundle and type checks:

```bash
npm run typecheck
npx expo export --platform android
```

## Android build

An Android debug APK workflow is configured at `.github/workflows/build-android-apk.yml`. It builds the native Android project and uploads `app-debug.apk` as a GitHub Actions artifact without needing an Expo token. The EAS preview and production profiles are also configured in `eas.json`; the EAS workflow is manual-only and requires the `EXPO_TOKEN` GitHub secret. A successful APK artifact and a real-device install still need verification.

## Not yet production-verified

- Firestore and Storage rules need to be compared against the existing production rules and tested with customer, seller, and administrator accounts.
- Seller submissions and photo uploads need a live rules-backed test.
- The existing public website needs a separate update so it does not expose pending listings or display demo fallback products.
- Order requests are implemented, but they remain unpaid until sellers confirm details. Real payment processing for EcoCash, OneMoney, bank transfer, or cards; shipping integrations; and refunds are not implemented.
- A successful EAS Android build, installation test, and production deployment still need to be completed.

The application must not be advertised as fully launched until the remaining backend/security and device-build checks pass.

## Producing an installable APK

The recommended no-token preview build is `.github/workflows/build-android-apk.yml`. Open **Actions → Build ZimMarket Android APK** and run it, or push a change to an app file. When successful, download the `zimmarket-android-debug-apk` artifact from that workflow run and install it on an Android test device.

For cloud-managed EAS builds, `.github/workflows/build-android-preview.yml` is manual-only and requires the repository Actions secret `EXPO_TOKEN`. Add it under **Settings → Secrets and variables → Actions → New repository secret**. Never commit the token into source code.
