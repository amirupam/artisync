# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**ArtInYou** is a Next.js-based artist discovery and booking platform that allows artists to create profiles and clients to browse and book them. The application uses Firebase for authentication, database (Firestore), and file storage.

## Tech Stack

- **Framework**: Next.js 15.5.0 (Pages Router)
- **React**: 19.1.0
- **TypeScript**: 5.x
- **Styling**: Tailwind CSS 4 with PostCSS
- **Backend/Database**: Firebase (Auth, Firestore, Storage)
- **Linting**: ESLint 9 with Next.js/TypeScript configuration

## Development Commands

```bash
# Start development server (http://localhost:3000)
npm run dev

# Build for production
npm run build

# Run production server
npm start

# Run linting
npm run lint
```

## Architecture & Project Structure

### Directory Layout

```
├── pages/                    # Next.js Pages Router
│   ├── _app.tsx             # App wrapper with global styles
│   ├── _document.tsx        # HTML structure and metadata
│   ├── index.tsx            # Home landing page
│   ├── signup.tsx           # Authentication (signup/signin mode toggle)
│   ├── signin.tsx           # Signin wrapper
│   ├── create-profile.tsx   # Artist profile creation/editing form
│   ├── profile-preview.tsx  # Artist profile display
│   └── api/
│       └── hello.ts         # Example API route
├── lib/
│   └── firebaseClient.ts    # Firebase initialization and client setup
├── styles/
│   └── globals.css          # Global Tailwind CSS imports and theme variables
├── public/                  # Static assets (images, videos)
├── next.config.ts           # Next.js configuration
├── tsconfig.json            # TypeScript configuration
├── tailwind.config.js       # Tailwind CSS configuration (uses Tailwind v4)
└── eslint.config.mjs        # ESLint rules for Next.js and TypeScript
```

### Routing Structure

The app uses **Next.js Pages Router** (not the new App Router):
- **`/`** - Landing page with role selection (Artist/Client)
- **`/signup`** - Signup/signin form (supports query param `role` for role selection)
- **`/signin`** - Wrapper that redirects to signup page
- **`/create-profile`** - Artist profile creation and management
- **`/profile-preview`** - Artist profile view
- **`/api/hello`** - Example API endpoint
- Future: `/artists` route for clients to browse artists (referenced but not yet implemented)

### Data Layer: Firebase

**Firebase Integration** (`lib/firebaseClient.ts`):
- Initializes Firebase app, Auth, Firestore, and Storage once per session (cached singleton pattern)
- Requires environment variables in `.env.local`:
  - `NEXT_PUBLIC_FIREBASE_API_KEY`
  - `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
  - `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
  - `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
  - `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
  - `NEXT_PUBLIC_FIREBASE_APP_ID`

**Firestore Collections**:
- **`artists/{userId}`** - Artist profile documents containing:
  - Identity: fullName, bio, profilePictureUrl, coverBannerUrl
  - Art form: artForm (string), artSubForms (string[])
  - Performance: experience, languages (string[]), eventTypes (string[]), priceRange
  - Media: youtubeVideos (string[] — up to 6 URLs); legacy field youtubeVideo (string) still read for backward compat
  - Photos: performanceImageUrls (string[] — up to 12 performance image URLs from Storage)
  - Location: state, city, area, country (state drives city dropdown via INDIA_STATES map in create-profile.tsx)
  - Contact: phone, email
  - Social: instagram, facebook, youtube
  - Timestamps: createdAt, updatedAt

**Firebase Storage**:
- Used for uploading profile pictures and cover banners

### Authentication Flow

1. **Firebase Auth** with two methods:
   - Email/Password (signup or signin)
   - Google OAuth via `GoogleAuthProvider`
2. Role-based routing:
   - **Artists**: After signup → `/create-profile`
   - **Clients**: After signup → `/artists` (not yet implemented)
3. Protected pages check auth state via `onAuthStateChanged()` and redirect to signup if unauthenticated

### Key Components & Patterns

**Create Profile Page** (`pages/create-profile.tsx`):
- Form with multi-step flow for artist profile creation
- File uploads for profile picture and cover banner
- Firestore document save with server timestamp
- Loads existing profile data on mount for editing capability
- Field visibility toggles for social media links

**Profile Preview Page** (`pages/profile-preview.tsx`):
- Reads artist profile from Firestore
- Embeds YouTube videos using extracted video ID
- Protected by auth check with error handling

**Styling Approach**:
- Tailwind CSS v4 (uses `@import "tailwindcss"` syntax)
- Custom CSS variables for light/dark mode support
- Uses backdrops and overlays for modern glassmorphism effects (landing page)
- Responsive design with mobile-first approach

### Authentication & Authorization

- Auth state is checked on protected pages using Firebase's `onAuthStateChanged()`
- No backend session management yet (Firebase handles auth token)
- Role distinction (artist/client) is handled at the UI routing level via query params, not enforced in backend

## Configuration Files

- **next.config.ts** - Minimal config with `reactStrictMode: true`
- **tsconfig.json** - Strict mode enabled, path alias `@/*` for imports
- **tailwind.config.js** - Uses Tailwind CSS v4 with PostCSS plugin
- **.eslintrc** - Extends Next.js core Web Vitals and TypeScript rules

## Environment Setup

Create `.env.local` with Firebase credentials (see lib/firebaseClient.ts for required vars). The app will throw an error during development if required vars are missing, or warn in production.

