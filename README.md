# Røket

A location-based social discovery app that lets you see who's nearby and what they're up to. Built with React Native (iOS/Android) and a companion Progressive Web App.

## Links

- Landing page: [roketapp.eu](https://roketapp.eu/)
- Web app: [roket-web.web.app](https://roket-web.web.app/)
- Android: [Google Play](https://play.google.com/store/apps/details?id=com.roket)

## Features

- **Proximity grid** — See nearby users sorted by distance, with real-time status updates
- **Real-time chat** — 1-on-1 messaging with photo sharing and 12h expiring images
- **Status-based profiles** — Users share what they're doing, not just who they are
- **PWA** — Full web app mirroring the mobile experience
- **Multi-language** — Danish, English, Spanish, German, French, Portuguese
- **Dark/light mode** — Automatic or manual theme switching

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Mobile** | React Native, TypeScript |
| **Web** | Vite, React, TypeScript |
| **Backend** | Firebase (Auth, Firestore, Storage, Cloud Functions, Cloud Messaging) |
| **Moderation** | Google Cloud Vision API (SafeSearch) |
| **Geo** | Geohash-based proximity queries |

## Architecture

```
src/                  # React Native mobile app
├── features/         # Feature-based folder structure
├── components/       # Shared UI components
├── services/         # NotificationService, etc.
└── translations.ts   # i18n for 6 languages

web/                  # Vite + React PWA
├── src/features/     # Mirrors mobile feature structure
└── public/           # Service worker, manifest

functions/            # Firebase Cloud Functions
                      # Chat notifications, moderation, content safety
```

The web app shares translations and types with the mobile app via a `@shared` path alias, ensuring consistency across platforms.

## Key Technical Decisions

- **Geohash proximity** — Users are queried by geohash prefix for efficient Firestore lookups without full-table scans
- **Status over profiles** — Grid cards show user status instead of name/age to differentiate from dating apps
- **Shared translations** — Single source of truth (`translations.ts`) used by both mobile and web via path aliasing
- **Firestore security rules** — Chat participants must be set before messages can be read, preventing unauthorized access

## Screenshots

*Coming soon*

## Setup

### Prerequisites
- Node.js 18+
- React Native development environment ([setup guide](https://reactnative.dev/docs/set-up-your-environment))
- Firebase project with Firestore, Auth, Storage, and Cloud Functions enabled

### Mobile
```bash
npm install
npx react-native run-android  # or run-ios
```

### Web
```bash
cd web
npm install
npm run dev
```

### Firebase
```bash
# Deploy Cloud Functions
cd functions && npm install
firebase deploy --only functions

# Deploy web app
firebase deploy --only hosting
```
