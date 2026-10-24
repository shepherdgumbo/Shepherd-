# ZimMarket Expo app

ZimMarket is a Zimbabwe-focused marketplace. This repository contains the Expo / React Native application configured to use the existing Firebase project `zimmarket-d4b35`.

## Implemented in this repository

- Expo Router mobile app and branded marketplace home.
- Live Firestore product browsing with search and category filtering.
- **Approved-only** public listings; no seeded demo products or fabricated reviews.
- Product detail page with legacy field compatibility for older product documents.
- Firebase email/password sign-in and registration, including password reset.
- Customer and seller account roles.
- Seller product submission with USD/ZWL pricing and pending review status.
- Optional product-photo selection and Firebase Storage upload.
- Seller “My listings” view showing review status.
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

These are review templates only. No Firebase rules have been changed or deployed by this repository. **Do not paste them over your production rules without reviewing the current rules first.** The currently deployed web page has legacy product-query/demo-fallback behavior that must be updated to respect `status == "approved"` before applying rules that deny unfiltered public product queries. A rules change without that frontend fix could break the old website.

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

An EAS internal preview profile is configured in `eas.json` to produce an APK; the production profile creates an Android App Bundle. An actual APK has not been produced or installed on a device yet.

## Not yet production-verified

- Firestore and Storage rules need to be compared against the existing production rules and tested with customer, seller, and administrator accounts.
- Seller submissions and photo uploads need a live rules-backed test.
- The existing public website needs a separate update so it does not expose pending listings or display demo fallback products.
- Orders, payment processing (EcoCash, OneMoney, cash on delivery and bank transfer), shipping, and refunds are not yet implemented.
- A successful EAS Android build, installation test, and production deployment still need to be completed.

The application must not be advertised as fully launched until the remaining backend/security and device-build checks pass.

## Producing an installable APK

The workflow `.github/workflows/build-android-preview.yml` is configured to create an Expo EAS preview APK whenever app files change. It requires a GitHub repository Actions secret named `EXPO_TOKEN` with an Expo access token. The first run stopped because that secret is not present, so **no APK has been created yet**.

Add the secret in GitHub: **Settings → Secrets and variables → Actions → New repository secret**. Use the name `EXPO_TOKEN` and paste an Expo access token as the value. Do not put the token in source code or commit it. Then open **Actions → Build ZimMarket Android preview** and rerun the workflow.
