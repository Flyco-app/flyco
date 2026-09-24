# Phase 1G — product experience

## Internal operations surface

Phase 1J `/admin` is visually separate from the consumer shell: dense bounded tables, explicit evidence disclosure and named confirmations. It remains usable on mobile but prioritizes operational clarity. Staff without AAL2 see only TOTP enrollment/verification. The internal interface is English in Phase 1J; consumer FR/EN/AR behavior is unchanged.

Phase 1I adds Messages navigation, a mobile-first booking inbox, contextual conversation screen, unread count, bounded plain-text composer and accessible private-report disclosures. FR/EN/AR copy uses logical layout for RTL. Explicit refresh is the V1 fallback.

## Baseline audit (before implementation)

Inspected all routes under `src/app`, both domain forms, profile image rendering, auth/domain dictionaries, query DTOs and existing browser tests on merged main `ad7daaf`.

Route inventory: `/` preparation page; `/{fr,en,ar}` placeholder home; login, signup, check-email, reset-password, new-password, unavailable; `/auth/confirm`; profile, settings, members/[id]; trips list/new/detail/edit/public detail/matches; delivery-requests list/new/detail/edit/public detail/matches; bookings list/detail. Admin intentionally returns 404.

Navigation currently puts profile, settings, trips, requests, bookings and three languages into a wrapping header inside a 32rem container. Logo sends authenticated members to profile. No marketplace explanation, sender/traveler entry points or contextual activity home. Locale links discard the current page.

Repeated patterns: bordered cards, route text, trust rows, status pills, pagination, submit buttons and cancellation forms. Black booking buttons conflict with teal auth buttons. Public request trust labels use untranslated Email/ID. Identity states are raw internal values. Matching exposes algorithm version and minute slack. Profile shows empty future ratings/activity as if already meaningful.

Mobile/accessibility: single narrow column wastes desktop space; headings/actions do not consistently wrap; category checkboxes have small targets; no explicit shared focus treatment, skip link, pending controls, loading skeletons, recoverable route errors or custom not-found page. Cancellation is adjacent to routine actions with little hierarchy. Labels mostly wrap native controls correctly. Existing forms retain browser validation. Arabic direction exists at document level but literal right arrows do not mirror. Confirmation and unavailable pages contain English-only copy. Long French labels need wrapping and small-width verification.

## Product decisions

Home explains the two roles and links directly to protected create flows. Authenticated home includes activity shortcuts. Primary navigation: Home, My requests, My trips, Bookings, Profile. Settings remains within profile/account. Matches remain contextual to each published listing; there is no misleading global discovery/search backend.

Desktop uses a horizontal header and wide container. Mobile uses the same five destinations in a scroll-free bottom navigation, with compact header and language control. Native links remain keyboard accessible. Locale switching preserves pathname but intentionally drops query parameters (including auth tokens/errors).

Visual direction: warm ivory canvas, white cards, deep teal primary actions, sand accent, dark ink text. No fabricated testimonials, metrics, payments or delivery guarantees. Typography uses local system fonts with Arabic fallbacks; no runtime external font dependency.

Forms use one page with numbered route, dates and item/capacity sections. Native selects/date controls remain; unnecessary combobox/dialog libraries are avoided. Photo upload and publish remain on the saved request review page, preserving existing commands. Cancellation is a disclosed destructive section requiring an explicit second action; booking rejection uses an explicit confirmation control.

## Implementation and verification

### Information architecture and navigation

The authenticated header and mobile navigation expose five destinations: Home, My requests, My trips, Bookings and Profile. Account settings is reached from Profile. The two marketplace actions remain prominent on Home: Send an item and I’m traveling. Match results stay contextual to their trip or request because Flyco has no general discovery backend yet.

Desktop navigation is horizontal. Below 800px it becomes a five-item bottom bar with icons and safe-area padding. The compact header retains the Flyco home link and language controls. Locale switching preserves the route path. The logo always leads home and reuses an existing authenticated session.

### Design system

Tokens in `globals.css` define warm ivory background, white surfaces, deep teal primary actions, sand accents, semantic success/warning/danger surfaces, two radii, one card shadow, reading and application widths, and responsive behavior. The typography stack uses local system fonts with Arabic fallbacks and requires no font download. All transitions are CSS-only and disabled for reduced-motion users.

Shared components cover navigation, language selection, icons, status badges, routes, guided form sections, empty states, destructive disclosures, trust indicators and pending submit buttons. Native controls are retained for dates, files and selects. This keeps keyboard behavior and payload contracts stable and avoids another client dependency.

### Responsive and RTL strategy

Layouts begin as one column. Cards and detail grids expand at available widths, while the homepage hero becomes two columns on desktop. Form sections use two columns when space permits and collapse below 480px. Touch targets are at least 44px. `bdi` isolates city names, logical properties control spacing, and directional route/action arrows mirror under RTL. Arabic uses true document direction rather than text alignment alone.

### Accessibility

The shell provides a keyboard-visible skip link and focus target. Every submit action announces and disables its pending state. Focus rings, contrast-aware semantic colors, native labels, alert/status roles, meaningful headings, disclosed destructive actions, loading skeleton status, empty states and a localized not-found recovery path are consistent across the application. Decorative homepage artwork is hidden from assistive technology. Existing shadcn/native interaction behavior is not replaced.

### Status vocabulary

Status styling is central: green for active/successful states, amber for pending/proposed states, red for cancelled/rejected states, and neutral for drafts, expiry and completion. Domain dictionaries provide the human-readable label; raw database values are never used as customer copy. Verification uses the same vocabulary without inventing a trust score.

### UX choices

Trip and request forms are single-page, numbered sections for Route, Dates, and Capacity or Item. This gives guidance without introducing client-side wizard state. A saved request remains the review/publish/photo-management surface. Match cards explain compatibility in natural language and no longer expose algorithm version or slack diagnostics. Booking detail shows proposal progress and three distinct capacity measures. Cancellation and rejection are placed behind explicit disclosures.

Backend schemas, RLS, validation, concurrency, audit and state machines did not change. No migration or dependency was added.

### Verification

Automated coverage exercises the public shell at 360px, 768px and 1440px in French, English and Arabic, checks overflow and RTL, keyboard skip navigation, localized not-found recovery, complete Auth/profile/trip/request flows and the two-party booking lifecycle. The exact implementation-head Vercel preview was inspected in English and Arabic, including the authentication surface. Commit, check and deployment evidence is recorded in `docs/verification.md`.

## Phase 1H disclosures

Safety confirmation stays close to commitment: publication for senders and acceptance for travelers. Checkboxes are never preselected. Concise summaries link to dedicated detail pages. Help, Safety, Terms and Privacy remain available in the shared footer in all locales; draft legal pages display a prominent pre-launch/legal-review notice and use the application RTL shell.
