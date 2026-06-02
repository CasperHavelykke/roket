# Røket

An anti-loneliness app for doing things with people nearby. See what people around you are up to right now, post or join open invitations, and turn a quiet moment into something real — coffee, a walk, a group hangout. Built with React Native (iOS/Android) and Firebase.

## Links

- Landing page: [roketapp.eu](https://roketapp.eu/)
- Android: [Google Play](https://play.google.com/store/apps/details?id=com.roket)
- iOS: in App Store review

## Features

- **Proximity grid** — Nearby people sorted by distance, real-time updates. Cards lead with what someone is up to, not who they are.
- **Events / open invitations** — Post an activity you want to do (coffee, run, study, drinks) and let people nearby join. Every event gets its own group chat.
- **Group & 1-on-1 chat** — Talk around an event with the participants, or message someone directly. Photos shared in chat auto-expire after 12 hours and are scanned for safety on upload.
- **Status-based profiles** — A short status + optional activity tag (15 tags: coffee, workout, hike, …) is the primary identity on the grid. The whole UX is designed to differentiate from dating apps.
- **Multi-language** — Danish, English, Spanish, German, French, Portuguese, sharing one source of truth.
- **Dark/light mode** — Automatic from system, or manually overridden.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Mobile** | React Native (New Architecture / Fabric), TypeScript |
| **Backend** | Firebase (Auth, Firestore, Storage, Cloud Functions, Cloud Messaging) |
| **Image moderation** | Google Cloud Vision API (SafeSearch) on upload |
| **Geo** | Lat/lng with client-side Haversine distance; geohash on the roadmap for scale |

## Architecture

```
src/                  # React Native mobile app
├── features/         # Feature-based folders (home, chat, events, profile, …)
├── components/       # Shared UI components
├── services/         # LocationService, NotificationService
├── utils/            # Pure helpers (eventTime, userInfo, …)
└── translations.ts   # i18n for 6 languages

functions/            # Firebase Cloud Functions
                      # Chat notifications, image safety, content moderation

__tests__/            # Jest unit tests (pure-logic coverage, growing)
```

## Key Technical Decisions

- **Event-driven backend on Cloud Functions** — Firestore/Storage triggers, scheduled jobs, and callable admin endpoints handle push notifications, expiring-image cleanup, and admin tasks — keeping privileged logic off the client.
- **Automated + human content moderation** — Uploaded images are scanned by Google Cloud Vision SafeSearch via a Storage trigger, with NSFW content auto-removed and logged to an audit trail — backing a human layer of reports, warnings, and bans.
- **Native permission handling** — Cross-platform location permissions and a location watch tied to AppState, so the app stays stable when permissions change in the background.
- **Resilient real-time data layer** — `onSnapshot` listeners drive the UI, with bans enforced only on server-confirmed data, atomic `FieldValue` updates, and clean listener teardown on logout.
- **Type-safe internationalization** — UI copy lives in one `translations.ts` with the type derived from a single locale, so a missing key in any of 6 languages fails at compile time.

## Screenshots

<p align="center">
  <img src="docs/demo.gif" width="150" alt="Røket — browsing the proximity feed" />&nbsp;
  <img src="docs/screenshots/play-store/homeScreen.png" width="150" alt="Proximity feed" />&nbsp;
  <img src="docs/screenshots/play-store/eventSheet.png" width="150" alt="Event details" />&nbsp;
  <img src="docs/screenshots/play-store/profileScreen.png" width="150" alt="User profile" />&nbsp;
  <img src="docs/screenshots/play-store/chatScreen.png" width="150" alt="Group chat" />
</p>

## Setup

### Prerequisites
- Node.js 20+
- React Native development environment ([setup guide](https://reactnative.dev/docs/set-up-your-environment))
- A Firebase project with Firestore, Auth, Storage, and Cloud Functions enabled

### Mobile
```bash
npm install
npx react-native run-android  # or run-ios
```

### Tests
```bash
npm test
```

### Cloud Functions
```bash
cd functions && npm install
firebase deploy --only functions
```
