---
type: architecture
title: Frontend
description: Frontend React application, page components, state management, and routing structure.
tags: [frontend, architecture, react, routing, components, state]
verified:
  - by: openwiki/0.5.0
    at: 2026-09-09T19:45:31.755Z
sources:
  - id: openwiki-source-54631e6ebf1d3b815c4a5eed
    resource: repo://src/App.tsx
  - id: openwiki-source-697840bf3d8ff80c42e7f8b4
    resource: repo://src/components/AppShell.tsx
  - id: openwiki-source-95bfccfd0c712f6e72040e0d
    resource: repo://src/main.tsx
generated: { by: "openwiki/0.5.0", at: "2026-09-09T19:45:31.755Z" }
---

# Frontend Architecture

The frontend is a single-page React application built with TypeScript, React Router, Vite, and Tailwind CSS.

## Entrypoints & Initialization

- **Root Entrypoint**: `/src/main.tsx` mounts the `<App />` component inside React's `StrictMode` onto the `#root` DOM element (`repo://src/main.tsx`).
- **Application Router**: `/src/App.tsx` configures the authentication wrapper (`AuthProvider`) and the `AppRoutes` component, which manages conditional routing based on authentication state.

## Routing & Navigation

Client-side routing is configured in `/src/App.tsx` using `react-router-dom`. The router manages authentication, switching between unauthenticated views (login/signup/reset) and authenticated views wrapped in the `<AppShell />` layout component.

## Component Structure & Layout

The UI layout is orchestrated by `/src/components/AppShell.tsx`, which includes:

- **Header**: Persistent top navigation bar containing branding, primary navigation links (Today, Library, Returns), journey drawer toggle, theme switcher, membership tier badge, profile and account links, and sign-out controls.
- **Mobile Navigation**: Handled via a responsive collapsible menu and a bottom tab bar.
- **Content Area**: Renders nested route elements via `Outlet`.
