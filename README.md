# This is Us

Private, minimal photo-sharing app for couples built with React, Vite, Capacitor, and Firebase. Capture a moment, add an intimate caption overlay, sync it with your partner in real time, and receive gentle notifications when a new memory arrives.

## Features

- Capture photos with the Capacitor Camera plugin and apply custom text overlays
- Quick download and local caching through Capacitor Filesystem for offline safety
- Firebase Storage + Firestore pipeline for uploads, metadata, and real-time feed updates
- Push notifications via Capacitor Push Notifications & Firebase Cloud Messaging
- Offline support that queues photos while disconnected and syncs once online
- Light/dark theme toggle, subtle feed animations, and mobile-first layout (max width 500px)
- PWA shortcuts to jump directly to "Send Photo" or "View Today"

## Getting Started

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Configure Firebase**

   - Create a Firebase project with Authentication, Firestore, Storage, and Cloud Messaging.
   - Copy your project credentials into `src/services/firebase.ts` under `firebaseConfig`.
   - Enable anonymous authentication in Firebase Authentication settings.
   - Create a Cloud Messaging server key for push notifications.

3. **Capacitor platform setup**

   ```bash
   npx cap add ios
   npx cap add android
   ```

4. **Run locally**

   ```bash
   npm run dev
   ```

5. **Build & sync for native**

   ```bash
   npm run build
   npx cap copy
   npx cap open ios   # or android
   ```

6. **Push notifications**
   - For Android, place the `google-services.json` file inside `android/app/` before opening Android Studio.
   - For iOS, add the APNs key/certificate and `GoogleService-Info.plist`, then enable push capability in Xcode.

## Firebase Security

For production, tighten Firestore & Storage rules. Example scaffold:

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /couples/{coupleId}/photos/{photoId} {
      allow read, write: if request.auth != null && request.auth.token.coupleId == coupleId;
    }
  }
}
```

## Scripts

- `npm run dev` – start Vite dev server
- `npm run build` – type check + production build
- `npm run preview` – preview production build locally
- `npm run lint` – run ESLint over the project

## Notes

- Update `public/firebase-messaging-sw.js` with your Firebase messaging logic before shipping.
- `setActiveCoupleId` relies on a shared code per couple; store/verify securely in Firestore for production hardening.
- Review Capacitor plugin docs for platform-specific permission text or background behavior tweaks.
