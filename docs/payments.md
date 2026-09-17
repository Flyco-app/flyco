# Payments and marketplace money movement

Status: design and SDK factory only. No checkout, webhook, charge, transfer or refund endpoints implemented. Development account selected by owner: Flyco test mode (not the separate Flyco sandbox). Production credentials must never enter local/preview/staging.

## Launch blocker: payout geography

A travel route does not determine a connected account's country. Determine traveler legal residence/bank country and Flyco legal entity before promising payments. Stripe's current self-serve cross-border Connect documentation lists US, UK, EEA, Canada and Switzerland; Morocco falls outside that list. Stripe says other corridors require contacting sales. Obtain written confirmation of the actual platform/recipient arrangement; otherwise restrict the pilot to supported eligible recipients or choose another approved payout arrangement. Do not mislabel residency, bypass KYC or assume Global payouts is available to a French entity.

Source checked 2026-09-17: [Stripe cross-border payouts](https://docs.stripe.com/connect/cross-border-payouts). This is a technical launch dependency, not a legal opinion.

## Proposed funds flow (pending business/Stripe approval)

Hosted Checkout Sessions for collection; Connect Accounts v2 onboarding with provider-hosted/embedded collection of identity details. Separate charges and transfers is the candidate because traveler transfer should become eligible after delivery and the approved dispute window. Platform retains the commission by transferring less; do not combine this flow with application_fee_amount. Final merchant-of-record, fee payer, negative-balance liability, dashboard access and tax obligations require explicit approval before implementation. Destination charges transfer immediately and do not satisfy a promised delayed-release flow.

Do not advertise escrow. Card authorization cannot be held indefinitely until an arbitrarily distant departure. Decide charge timing, cancellation policy, allowed booking horizon, permitted holding duration and reserves with Stripe/legal review. A platform transfer is not a bank payout: model both separately. Snapshot accepted gross, commission, traveler net, currency and fee-policy version. Stripe fees, tax and FX are distinct accounting entries; no implied margin guarantee. V1 proposes EUR settlement only, subject to approval.

## Collection state machine (per attempt)

| From                         | Valid next states                                                                              | Trigger                                          |
| ---------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| created                      | requires_payment_method, requires_action, processing, authorized, succeeded, failed, cancelled | Provider creates/initializes attempt             |
| requires_payment_method      | requires_action, processing, authorized, succeeded, failed, cancelled                          | Sender supplies payment method/provider confirms |
| requires_action              | requires_payment_method, processing, authorized, succeeded, failed, cancelled                  | Authentication result                            |
| processing                   | requires_payment_method, requires_action, authorized, succeeded, failed, cancelled             | Authoritative provider update                    |
| authorized                   | succeeded, cancelled                                                                           | Capture or authorization expiry/cancel           |
| succeeded, failed, cancelled | none                                                                                           | Terminal collection outcome                      |

A retry after a terminal failure creates another payment attempt. Reconciliation can ingest missed intermediate provider states by verifying current provider object and recording a reconciliation event, not accepting arbitrary user changes. At most one outstanding collection per booking; cancel/reconcile an ambiguous attempt before starting another. Success is not changed to failed by an older event.

Refunds are separate rows: pending → succeeded | failed | cancelled. Aggregate summary: unrefunded / partially_refunded / fully_refunded, derived from successful refund totals, bounded by collected amount under payment lock. No terminal `refunded` booking state. Chargebacks have their own provider dispute state (open → won | lost), and may occur after a full customer refund; never overwrite collection history.

Transfers: pending → submitted → succeeded | failed, succeeded → partially_reversed | reversed. A timeout stays submitted/unknown until reconciled; no blind new transfer. Payouts: pending → in_transit | paid | failed | cancelled; in_transit → paid | failed; paid → failed only for documented late bank return. Provider balance transactions/allocations connect batched payouts to transfers; one payout is not necessarily one booking. Refund does not automatically reverse a transfer or recover a paid payout: enqueue and audit explicit compensation.

## Concurrency, audit and operations

Provider IDs unique by account/mode, idempotency keys stable per financial operation, webhook IDs unique. Inbox/outbox atomically coordinate application and provider effects. Store amount in integer minor units; currency immutable. Balance/ledger entries append-only with reversals, unique source keys and per-currency balancing. Webhooks verify raw body/signature/tolerance, expected account and livemode before persistence. Never log webhook bodies or client_secret. Reconcile daily and after ambiguous timeouts against provider objects/balance transactions. Alert on amount mismatch, stuck inbox/outbox, duplicate transfers and negative balances.

A refund command locks payment and sums pending+succeeded refunds before admitting another. Transfer eligibility checks fulfilled booking, no open dispute, KYC/capability readiness, current restrictions and sufficient ledger balance. Payout failure never changes delivered/completed history. Finance operator actions require MFA, reason and audit; large amounts require dual approval threshold agreed by business.

## Required tests

Invalid/missing signature, mismatched account/mode/currency/amount, duplicate/out-of-order delivery, network timeout after successful API call, two refunds racing, late payment after reservation expiry, disputed completed booking, refund after transfer, failed bank payout, disabled payout capabilities, partial refunds/reversals and reconciliation drift. Test-only provider fixtures must be clearly labeled; no production fake successes.
