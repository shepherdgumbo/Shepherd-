# ZimMarket — Expo mobile app

ZimMarket is a marketplace for Zimbabwe. This repository contains an Expo / React Native mobile app intended to use the existing Firebase project `zimmarket-d4b35`.

## Current scope

- Expo Router app shell and mobile-first marketplace screen.
- Firebase client configured through Expo public environment variables.
- Email/password sign-in and account registration.
- Approved-only product browsing (`products.status == "approved"`).
- Seller listing submission with `status: "pending"`.
- USD and ZWL price entry.
- Empty, loading, and error states rather than fabricated product data.

## Firebase configuration

1. In Firebase Console, open project `zimmarket-d4b35` and go to Project settings > Your apps.
2. Use the existing web app configuration values. Do not create or upload a service-account key.
3. Copy `.env.example` to a local `.env` file and fill in the values.
4. Enable the Email/Password sign-in provider if it is not already enabled.
5. Confirm Firestore security rules before testing account creation and listing submissions.

Expo public variables are bundled into the client. Firebase web config is not a substitute for security rules. Never place service-account JSON, private API keys, or admin credentials in this app.

## Existing data and approval workflow

This app intentionally reuses the existing Firebase project. It does not modify Firestore rules, delete data, or change authentication providers. The client reads only products whose status is exactly `approved`. New seller listings are submitted with status `pending`.

**Important:** client-side filtering is not a security boundary. Firestore rules must enforce that customers can read only approved products and that sellers cannot self-approve listings. Existing admin approval logic must be verified before production use.

## Run locally

```bash
npm install
npx expo start
```

For type checking:

```bash
npm run typecheck
```

## Before production release

- Add the real Firebase app configuration in the Expo/EAS environment.
- Verify the actual Firestore field names and existing rules.
- Test registration, sign-in, seller profile creation, pending listing submission, and administrator approval.
- Confirm only approved products are readable to customers through both the app and Firestore rules.
- Add product image upload with Firebase Storage rules, order management, and payment integrations only after their backend contracts are confirmed.
- Build and test an Android preview with Expo EAS before publishing.

No production build or deployment is claimed by this repository setup alone.