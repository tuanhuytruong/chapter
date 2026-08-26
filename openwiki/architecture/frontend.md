---
type: architecture
title: Frontend Architecture
description: Frontend React application, page components, state management, and routing structure.
tags: [frontend, architecture, react, routing, components, state]
verified:
  - by: openwiki/0.4.0
    at: 2026-08-26T19:17:20.603Z
sources:
  - id: openwiki-source-54631e6ebf1d3b815c4a5eed
    resource: repo://src/App.tsx
  - id: openwiki-source-697840bf3d8ff80c42e7f8b4
    resource: repo://src/components/AppShell.tsx
  - id: openwiki-source-95bfccfd0c712f6e72040e0d
    resource: repo://src/main.tsx
generated: {by: "openwiki/0.4.0", at: "2026-08-26T19:17:20.603Z"}
---

# Frontend Architecture

The frontend is a single-page React application built with TypeScript, React Router, Vite, and Tailwind CSS. It powers a clean, content-first reading and learning companion application ("Chapter").

## Entrypoints & Initialization

- **HTML Shell**: `/index.html` provides the base markup and font imports.
- **Root Entrypoint**: `/src/main.tsx` mounts the `<App />` component inside React's `StrictMode` onto the `#root` DOM element (`repo://src/main.tsx`).
- **Application Router**: `/src/App.tsx` configures the authentication wrapper (`AuthProvider`) and the `AppRoutes` component, which manages conditional routing based on authentication state (`repo://src/App.tsx#L22-L29`).

## Routing & Navigation

The application uses `react-router-dom` for client-side routing. Routes are divided into unauthenticated (auth modals/pages) and authenticated application views wrapped in an `<AppShell />` layout component (`repo://src/App.tsx#L25-L28`).

### Core Routes
- `*` / `/`: Library (`repo://src/pages/Library.tsx`) — Main book collection view.
- `/today`: Today (`repo://src/pages/Today.tsx`) — Daily summary, streak, and momentum overview.
- `/books/:id`: Book Detail (`repo://src/pages/BookDetail.tsx`) — Deep dive into a specific book, chapters, audio player, and highlights.
- `/insights`: Insights (`repo://src/pages/Insights.tsx`) — Cross-book learning connections and analytics.
- `/review`: Review (`repo://src/pages/Review.tsx`) — Spaced repetition and recall flashcards.
- `/calendar`: Reading Calendar (`repo://src/pages/Calendar.tsx`) — Historical reading activity.
- `/momentum`: Momentum (`repo://src/pages/Momentum.tsx`) — Momentum score and metrics.
- `/achievements`: Achievements (`repo://src/pages/Achievements.tsx`) — Gamification milestones.
- `/profile`: Profile (`repo://src/pages/Profile.tsx`) — User avatar and preferences.
- `/account`: Account & Settings (`repo://src/pages/Account.tsx`) — Telegram settings, subscription management, and logout.
- `/pricing`: Pricing (`repo://src/pages/Pricing.tsx`) — Membership tiers and checkout.
- `/quotes`: Quotes (`repo://src/pages/Quotes.tsx`) — Wall of saved quotes.

## Component Structure & Layout

The UI layout is orchestrated by `/src/components/AppShell.tsx`, which includes:
- **Header**: Responsive top navigation bar containing branding, primary navigation links (Today, Library, Review with due badge), journey drawer toggle, theme switcher, membership tier badge, profile link, account/settings, and sign-out controls (`repo://src/components/AppShell.tsx#L65-L89`).
- **Mobile Navigation**: Bottom tab bar and collapsible menu for smaller viewports (`repo://src/components/AppShell.tsx#L93-L100`).
- **Content Area**: Renders nested route elements via `Outlet` (`repo://src/components/AppShell.tsx`).
- **Swipe Navigation**: Integrated mobile gesture navigation via `/src/hooks/useSwipeNav.ts`.

## State Management & Authentication

- **Auth Context**: `/src/AuthContext.tsx` handles user session state, login, signup, logout, and token validation.
- **Membership & Entitlements**: Cached via `/src/membershipCache.ts` and fetched from the API backend.
- **Review Events**: Custom event dispatcher (`REVIEWS_CHANGED_EVENT`) in `/src/reviewEvents.ts` synchronizes review due counts across components.
- **Theme Management**: Persisted in `localStorage` and toggled via HTML document classes (`dark`).
