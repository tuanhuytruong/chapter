---
type: architecture
title: Frontend
description: Frontend React application, page components, state management, and routing structure.
tags: [frontend, architecture, react, routing, components, state]
sources:
  - id: openwiki-source-54631e6ebf1d3b815c4a5eed
    resource: repo://src/App.tsx
  - id: openwiki-source-697840bf3d8ff80c42e7f8b4
    resource: repo://src/components/AppShell.tsx
  - id: openwiki-source-95bfccfd0c712f6e72040e0d
    resource: repo://src/main.tsx
generated: { by: "openwiki/0.5.2", at: "2026-09-16T20:06:06.880Z" }
verified:
  - by: openwiki/0.5.2
    at: 2026-09-16T20:06:06.880Z
---

# Frontend Architecture

The frontend is a single-page React application built with TypeScript, React Router, Vite, and Tailwind CSS.

## Entrypoints & Initialization

- **Root Entrypoint**: `/src/main.tsx` mounts the `<App />` component inside React's `StrictMode` onto the `#root` DOM element (`repo://src/main.tsx`).
- **Application Router**: `/src/App.tsx` configures the authentication wrapper (`AuthProvider`) and the `AppRoutes` component, which manages conditional routing based on authentication state.

## Routing & Navigation

Client-side routing is configured in `/src/App.tsx` using `react-router-dom`, which handles authentication states by conditionally rendering the application shell or login routes (`repo://src/App.tsx#L44-L65`).

## Component Structure & Layout

The `AppShell` component orchestrates the UI layout and provides persistent navigation. Desktop navigation includes branding, primary links (Today, Library, Returns), a journey drawer toggle, theme switcher, membership tier badge, and a comprehensive user menu. Mobile navigation is provided via a collapsible menu accessible through a button and a persistent bottom navigation bar (`repo://src/components/AppShell.tsx#L48-L54`).
