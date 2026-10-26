# ZimMarket Expo app

ZimMarket is a Zimbabwe-focused marketplace. This repository contains the Expo / React Native application configured to use the existing Firebase project `zimmarket-d4b35`.

## Implemented in this repository

- Expo Router mobile app and branded marketplace home.
- Live Firestore product browsing with search, category filtering, currency filters, name sorting, and price sorting within one selected currency.
- Public seller storefronts that display only approved listings.
- Save-for-later wish list and a dedicated Saved Items screen (stored locally on the device).
- **Approved-only** public listings; no seeded demo products or fabricated reviews.
- Product detail page with legacy field compatibility for older product documents, plus save-for-later action.
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

## Firebase security rules and production safeguards

The canonical marketplace rules are now in the repository root:

- `firestore.rules` — restricts profiles, seller applications, product moderation, and buyer/seller order-request access.
- `storage.rules` — permits public reads of product images and limits uploads to approved sellers' image folders.
- `firebase.json` points to these rule files.
- `scripts/test-firebase-rules.mjs` runs 12 emulator-backed allow/deny tests for approved listings, seller approval, product moderation, order privacy/price integrity, and seller image uploads. `.github/workflows/firebase-rules-check.yml` runs those tests against the Firestore and Storage emulators on changes.
- `.github/workflows/deploy-firebase-security-rules.yml` is manual-only, requires the exact confirmation `DEPLOY`, and uses a separate repository secret named `FIREBASE_RULES_SERVICE_ACCOUNT_ZIMMARKET_D4B35`.

**These files are not yet deployed to the live Firebase project.** Firebase rules deployment replaces the corresponding rules currently in the console. Before deployment, compare the current production rules with `firestore.rules` and `storage.rules`, including any legacy collections or fields in use. The currently deployed older website must also be updated to query only `status == "approved"` before restrictive product-read rules are activated; otherwise its product browsing could break. Hosting deployments do not deploy these security rules.

The service-account secret must contain valid JSON for project `zimmarket-d4b35` and have permission to deploy Firestore and Storage rules. Store it only as a GitHub Actions secret, never in the repository. A missing secret or absent permissions must stop deployment.

Administrator access is granted by the trusted project owner, not public sign-up. After a trusted administrator registers, the project owner must set `role: "admin"` on that user's Firestore profile through the Firebase Console. Regular users cannot elevate themselves through the app.

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

A standalone Android preview APK workflow is configured at `.github/workflows/build-android-apk.yml`. It verifies the Android JavaScript bundle, regenerates the native project, builds the release variant, verifies the APK signature and uploads `ZimMarket-standalone-preview.apk` without requiring an Expo token. The EAS preview and production profiles are also configured in `eas.json`; the EAS workflow is manual-only and requires the `EXPO_TOKEN` GitHub secret. **The latest standalone preview APK was successfully built on 2026-10-26** (workflow run `40339344678`, commit `55b3c38029b391ed754328472f2688cbc0f8a3bb`). The bundle and signature checks pass, but installation and launch on a physical Android device have not yet been verified. This is a preview build, not a signed Play Store release.

## Amazon-style roadmap and current scope

ZimMarket is being developed as a Zimbabwe-focused marketplace inspired by the customer journey of large marketplaces such as Amazon: discovery, search, category browsing, saved items, a cart, order tracking, seller tools, moderation and trust/safety. It is not a copy of Amazon and does not yet have Amazon-scale fulfilment, verified product reviews, a logistics network, guaranteed delivery, or integrated payments. No ratings, stock counts, seller badges, delivery promises, or product data are fabricated. Prices in USD and ZWL are displayed as listed and must not be compared as though they are the same currency.

The latest customer-facing additions include saved products stored on this device, public seller storefronts, currency filters, alphabetical listing sorting and price sorting within a selected currency. Cross-device wishlist sync, verified ratings/reviews, stock management, shipping workflows, seller analytics and real payment integrations remain future work, and should only be added after the data model, rules and service providers are verified.

## Web/PWA and Firebase Hosting

The same Expo Router app can be exported as a browser site, so the web experience can use the same approved-product queries, saved items, seller stores, currency-aware filters, cart and order request flows as Android. A PWA manifest, SVG install icons, basic offline app-shell caching and Firebase Hosting configuration are now included.

- Web build check: `npx expo export --platform web`
- Firebase Hosting config: `firebase.json` and `.firebaserc` target `zimmarket-d4b35`.
- Production deployment workflow: [Deploy ZimMarket web to Firebase Hosting](https://github.com/shepherdgumbo/Shepherd-/actions/workflows/deploy-zimmarket-firebase-hosting.yml).

The workflow automatically attempts a **preview-only** deploy after web/app source changes and can also be run manually. The preview channel expires after seven days and never replaces the live website. If the Firebase credential is absent, CI still type-checks and exports the web app, then skips the preview deploy with a notice. A live deployment is separate: choose target `live` and enter the confirmation value `DEPLOY`. It requires the repository secret `FIREBASE_SERVICE_ACCOUNT_ZIMMARKET_D4B35`, containing a Firebase service-account JSON with Hosting deploy permission; otherwise the requested live deploy fails safely. Store service-account JSON only as a GitHub Actions secret, never in the repository.

This source code/configuration does not itself update the old live Firebase website. The existing site will remain in place until a Hosting workflow run succeeds. Review the preview before considering a live deployment. After replacing the old website, verify registration/sign-in, approved-only product browsing, seller/admin permissions, cart/order requests, and PWA install behavior in a real browser. Firestore and Storage rules are deliberately not part of the Hosting deployment.

## Current deployment status (2026-10-26)

- **Vercel web build:** https://zimmarket-expo.vercel.app/ is deployed from commit `d5ebcdc2c0e04b0b84b49d7f540121d2a1803312`. The page responds successfully. The project is not currently listed as Git-linked in the Vercel account, so automatic deploys on every GitHub push are not yet confirmed.
- **Firebase Hosting:** the latest workflow run is [40271618732](https://github.com/shepherdgumbo/Shepherd-/actions/runs/40271618732). TypeScript and Expo web export passed, but the workflow skipped the actual Firebase Hosting deploy because the repository secret `FIREBASE_SERVICE_ACCOUNT_ZIMMARKET_D4B35` is not configured.
- **Production Firebase site:** this Vercel deployment does not replace `https://zimmarket-d4b35.web.app`. That site remains unchanged until a Firebase Hosting deployment succeeds.
- **Security rules:** Firestore and Storage rules have not been deployed by the Hosting workflow. Compare the current production rules with `firestore.rules` and `storage.rules` before any rule replacement; do not loosen the rules to make deployment pass.

## Not yet production-verified

- Firestore and Storage rules need to be compared against the existing production rules and tested with customer, seller, and administrator accounts.
- Seller submissions and photo uploads need a live rules-backed test.
- The existing public website needs a separate update so it does not expose pending listings or display demo fallback products.
- Order requests are implemented, but they remain unpaid until sellers confirm details. Real payment processing for EcoCash, OneMoney, bank transfer, or cards; shipping integrations; and refunds are not implemented.
- A signed production Android build, installation test on a physical device, and production deployment still need to be completed.

The application must not be advertised as fully launched until production rules, live login/listing/order tests, payment/delivery operations and a physical-device test pass.

## Producing an installable APK

The recommended no-token standalone preview build is `.github/workflows/build-android-apk.yml`. The latest successful build is [workflow run 40339344678](https://github.com/shepherdgumbo/Shepherd-/actions/runs/40339344678). Download the `zimmarket-standalone-preview-apk` artifact from that run. If an earlier debug copy is installed, uninstall it first if Android reports a package-signature conflict. Then verify sign-in, approved-only product browsing, seller application approval, product moderation, order requests and seller responses on a physical device before inviting real users.

For cloud-managed EAS builds, `.github/workflows/build-android-preview.yml` is manual-only and requires the repository Actions secret `EXPO_TOKEN`. Add it under **Settings → Secrets and variables → Actions → New repository secret**. Never commit the token into source code.
