# Flyco product specification

## Phase 1C traveler trips

An active verified member can create a traveler trip draft, edit it, publish it, view its narrow public listing and cancel it with a reason. A trip uses canonical Phase 1B location IDs, timezone-safe route instants, integer-gram capacity and normalized accepted categories. Drafts stay private. Current published trips expose only the reviewed marketplace projection. Restricted or suspended accounts cannot create or publish trips.

Phase 1C does not include delivery requests, matching, reservations, bookings, messaging, payments, reviews, disputes, moderation or administration. A published trip represents planned travel and is not evidence that a traveler, route or carried item has been approved by Flyco.

## Phase 1B profile and trust boundary

Members have self-only legal/contact settings (first name, last name, preferred language and E.164 phone), and a separate public marketplace card (display name, short bio, avatar and selected canonical residence). Public pages never expose email, phone, legal names, account controls or verification attempt details. Objective trust indicators are public and system controlled. Locations are selected from Flyco's normalized catalog.

Status: Phase 1B profile, trust, avatar, identity-attempt and normalized-location behavior is implemented. Transactional marketplace behavior below remains planned.

## Purpose and scope

Flyco connects senders with travelers already going between cities. France ↔ Morocco is the first route market. One verified account may send and travel; there are no permanent sender/traveler account types. A trip destination is not evidence of the traveler's residence or payout eligibility.

V1 supports one traveler, one sender and one delivery request per booking. A request contains one or more declared items; all travel together. No partial fulfillment, multi-leg relay, auctions, dynamic AI pricing or algorithmic identity decisions. Each booking has one currency. French is the default, English and Arabic are required before public launch. Dates show the route city's IANA timezone; store absolute instants in UTC. Arabic requires RTL, logical spacing, bidi-isolated IDs, and native-language review.

## Capabilities and acceptance boundaries

| Area           | Planned behavior                                                        | Acceptance requirements                                                                                                      |
| -------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Authentication | Sign-up, verification, login/logout, recovery, profile/settings         | Verified email before publishing or transacting; safe redirects; generic recovery responses; revoked/suspended users blocked |
| Trust          | Identity status, reviews, reports, moderation                           | KYC and Stripe capability checks are distinct; no raw identity docs exposed; appeals and manual review recorded              |
| Trips          | Cities, departure/arrival, capacity, categories                         | Positive grams, ordered times, immutable booked terms, no overselling                                                        |
| Requests       | Route, dates, item list, weight, dimensions, images, declaration, price | Eligibility and contents attestation; private sanitized photos; all items fit one trip                                       |
| Matching       | Explainable ranked compatible trips                                     | Versioned deterministic filters; stale candidates rechecked on acceptance                                                    |
| Booking        | Proposal, agreement, payment, pickup, transit, delivery, completion     | Named transition commands only; transaction locks; immutable terms and history                                               |
| Messaging      | Private matched-party conversations                                     | Participants only, plain text, reportable, durable before realtime delivery                                                  |
| Payments       | Collection, fee, transfer, payout, refund                               | Signed events, idempotency, ledger reconciliation; no fictional escrow promise                                               |
| Delivery       | One-time handoff codes and evidence                                     | Codes hashed, expire, bounded attempts; atomic consume; no code in logs                                                      |
| Notifications  | In-app and transactional email                                          | Durable outbox, retry/deduplication, preferences; SMS/push deferred                                                          |
| Admin          | Verification, reports, disputes, transactions, users, audit             | MFA and scoped roles; reason recorded; no blanket staff read of private messages                                             |

## Invariants

No self-bookings or self-reviews. Only completed bookings produce reviews, one per author. A request cannot have two active accepted bookings. Capacity reservations expire; acceptance/payment races cannot confirm an over-capacity trip. Payment success does not by itself prove pickup/delivery. A refund does not erase delivery history. A dispute can remain open after fulfillment or payout. No object IDs grant authority.

## Operational policy gates

Before enabling real transactions: approve eligible/prohibited items by route and carrier; establish maximum dimensions/weight/value, customs declarations and responsibility, insurance and loss liability, user age/residency rules, identity threshold, fees/tax/currency, cancellation/refund/dispute windows, emergency support and moderation SLAs. These are business/legal decisions, not inferred engineering defaults. Commission numbers, automatic refunds and payout delays remain unset.

Cross-border carriage and customs obligations need qualified review in both countries. Flyco must not imply all items accepted by the software are legally transportable. Do not launch unsupported traveler payouts. See decisions.md and payments.md.
