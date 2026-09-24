---
type: architecture
title: Frontend Architecture
description: Overview of the React-based frontend application, including entrypoints, routing, and layout components.
tags: [frontend, architecture, react, routing, components, state]
verified:
  - by: openwiki/0.6.0
    at: 2026-09-24T20:28:57.073Z
sources:
  - id: openwiki-source-54631e6ebf1d3b815c4a5eed
    resource: repo://src/App.tsx
  - id: openwiki-source-697840bf3d8ff80c42e7f8b4
    resource: repo://src/components/AppShell.tsx
  - id: openwiki-source-95bfccfd0c712f6e72040e0d
    resource: repo://src/main.tsx
generated: { by: "openwiki/0.6.0", at: "2026-09-24T20:28:57.073Z" }
---

# Frontend Architecture

The frontend is a single-page React application built with TypeScript, React Router, Vite, and Tailwind CSS.

## Entrypoints & Initialization

- **Root Entrypoint**: `/src/main.tsx` mounts the `<App />` component inside React's `StrictMode` onto the `#root` DOM element (`repo://src/main.tsx`).

## Routing & Navigation

Client-side routing is configured in `/src/App.tsx` using `react-router-dom`, which handles authentication states by conditionally rendering the application shell or login routes (`repo://src/App.tsx#L46-L70`).

## Component Structure & Layout

The `AppShell` component orchestrates the UI layout and provides persistent navigation. 
- **Desktop Navigation**: Includes branding, primary links (Today, Library, Returns, Playbooks), a journey drawer toggle, theme switcher, membership tier badge, and a comprehensive user menu.
- **Mobile Navigation**: Provided via a collapsible menu accessible through a button and a persistent bottom navigation bar (`repo://src/components/AppShell.tsx#L48-L55`).
