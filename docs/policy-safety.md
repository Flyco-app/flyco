# Marketplace policy and safety

Phase 1H adds a small, versioned policy layer around delivery-request publication and booking acceptance. It is product guidance, not legal advice. Terms and privacy routes are explicitly pre-launch structures and must not be treated as approved legal documents.

## Implemented technical rules

- Publication requires active sender confirmations for accurate contents, non-prohibition, appropriate packaging and awareness of possible cross-border requirements.
- Traveler acceptance requires active confirmation after reviewing available item information and current safety guidance.
- The database chooses the policy version; clients send only an explicit boolean. Evidence is append-only and inaccessible for direct application-role writes.
- Public request projections still exclude descriptions, contents, notes, photos and storage paths. Booking participants receive those details. Private photos use five-minute signed URLs after booking and Storage authorization.
- Cancellation behavior is unchanged: either participant may cancel a proposed or accepted pre-payment booking, and accepted cancellation releases capacity atomically.

## Provisional business policy

Flyco does not facilitate weapons, explosives, illegal drugs, hazardous substances, stolen or illegal goods, live animals, or highly dangerous materials. This conservative list is non-exhaustive and centralized in `src/modules/policy/config.ts`.

The sender declaration identifies the request version it covered. The domain currently permits limited published edits; whether material edits require a renewed acknowledgement must be decided before launch.

## Requires legal review

- Final prohibited and conditionally allowed items by corridor, including France–Morocco customs treatment.
- Marketplace terms, privacy notice, platform role, liability, insurance, cancellation/payment/refund rights, governing law, retention and international-transfer language.
- Changed-policy re-acknowledgement rules.
- Customer-support contact, escalation process and reporting workflows.

## Versions and evidence

Current identifiers are `sender-safety-2026-09-v1` and `traveler-safety-2026-09-v1`. Draft terms and privacy use `prelaunch-2026-09-draft` in application configuration but are not acknowledgement events.

`policy_acknowledgements` records the authenticated user, controlled policy type/version, delivery request or booking, resulting resource version and server timestamp. Unique constraints prevent duplicate evidence for the same version. Publication and acceptance write evidence in their lifecycle transaction.

## Visibility and support

After a booking proposal exists, its sender and traveler can review the description, declared contents, handling notes and ready photos. Third parties and anonymous visitors remain denied. Localized Help, Safety, Terms and Privacy routes provide guidance without pretending that support or reporting backends exist; the preview explicitly says that no support request is sent.
