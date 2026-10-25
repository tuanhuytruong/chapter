---
type: architecture
title: Frontend Architecture
description: Overview of the React-based frontend application, including entrypoints, routing, and layout components.
tags: [frontend, architecture, react, routing, components, state]
sources:
  - id: openwiki-source-54631e6ebf1d3b815c4a5eed
    resource: repo://src/App.tsx
  - id: openwiki-source-697840bf3d8ff80c42e7f8b4
    resource: repo://src/components/AppShell.tsx
  - id: openwiki-source-d9d8bf4d1ec3b639a557849b
    resource: repo://src/components/DaySummary.tsx
  - id: openwiki-source-95bfccfd0c712f6e72040e0d
    resource: repo://src/main.tsx
  - id: openwiki-source-6c571afea29ef711af933305
    resource: repo://src/pages/PlaybookDetail.tsx
generated: { by: "openwiki/0.6.1", at: "2026-10-01T21:48:18.718Z" }
verified:
  - by: openwiki/0.6.1
    at: 2026-10-01T21:48:18.718Z
---

# Frontend Architecture

The frontend is a single-page React application built with TypeScript, React Router, Vite, and Tailwind CSS. State management is facilitated through custom React hooks and context providers, notably `AuthContext` for user sessions.

## Entrypoints & Initialization

- **Root Entrypoint**: `/src/main.tsx` mounts the `<App />` component inside React's `StrictMode` onto the `#root` DOM element (`repo://src/main.tsx`).

## Routing & Navigation

Client-side routing is configured in `/src/App.tsx` using `react-router-dom`. The application differentiates between authenticated and guest states by conditionally rendering the `AppShell` layout or authentication-specific routes (`repo://src/App.tsx#L46-L70`).

## Component Structure & Layout

The `AppShell` component orchestrates the UI layout and provides persistent navigation (`repo://src/components/AppShell.tsx`).
- **Desktop Navigation**: Includes branding, primary links, journey drawers, theme switching, and user menus.
- **Mobile Navigation**: Provided via a collapsible menu accessible through a button and a persistent bottom navigation bar.

## Component Interactions & Data Flow

Key components act as domain-specific containers for data orchestration:
- **`DaySummary`**: Manages reading insights, illustrating source material, and persisting user notes and markers (`repo://src/components/DaySummary.tsx`).
- **`PlaybookDetail`**: Orchestrates complex views, utilizing shared layouts to maintain navigational consistency (`repo://src/pages/PlaybookDetail.tsx`).
- **Authentication**: `AuthProvider` manages global user identity, controlling route access and component visibility across the lifecycle (`repo://src/AuthContext.tsx`).
