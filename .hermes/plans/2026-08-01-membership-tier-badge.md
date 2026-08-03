# Chapter — Header Membership Tier Badge

## Goal
Show an always-available, quiet membership badge for the signed-in user. Clicking it opens `/pricing` so readers can compare or upgrade plans without hunting through Account.

## UX contract
- **Desktop:** place immediately before the avatar in the header utility cluster.
- **Mobile:** show a full-width menu row directly under Profile.
- **Free:** label `Free · Upgrade`, muted sage outline with a small upward arrow.
- **Plus:** label `Plus`, quiet sage fill.
- **Deep Reader:** label `Deep Reader`, restrained clay/sage treatment; no celebratory/leaderboard language.
- Every badge is a semantic navigation link to `/pricing`, with `title` and accessible label explaining current tier / upgrade destination.
- Do not show pricing, payment details, quota numbers, QR data, or expiry in the header. Account remains the detailed membership/purchase-history surface.
- On entitlement fetch failure: do not guess user status; hide badge quietly while preserving all header navigation.

## Implementation
1. Extract a compact `MembershipTierBadge` component using `EntitlementsResponse` and `NavLink`/`Link`.
2. In authenticated `Layout`, fetch `/api/entitlements/me` once after mount; cancel state update on unmount.
3. Render compact badge next to desktop avatar and mobile-menu row under Profile; preserve existing responsive header geometry.
4. Use server entitlement tier (`free`, `plus`, `deep_reader`) as the only source of truth; no schema/API changes.
5. Add a deterministic source fixture/check covering all tiers, `/pricing` destination, semantic link, and mobile/desktop placements.

## Verification
- `npx tsc --noEmit`, `npm run build`, `git diff --check`.
- Authenticated DEV browser: desktop and ~390px mobile; Free badge visibility, click-through `/pricing`, no overflow or clipped header controls; console clean.
- Assert actual `/api/entitlements/me` tier label is rendered.
- Commit, push `dev`, deploy DEV, health-check.

## Files
- Add `src/components/MembershipTierBadge.tsx`
- Update `src/App.tsx`
- Add narrow source fixture/check only if no existing test convention fits.

## Out of scope
- Checkout changes, tier calculations, billing logic, membership schema, notifications, gamification, and PRD deployment.
