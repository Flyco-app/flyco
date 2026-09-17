# Observability and operations

## Current structure

Sentry Next.js SDK is installed. `src/instrumentation.ts` validates environment at Node runtime start and initializes Sentry only if SENTRY_DSN is supplied. No DSN means telemetry is explicitly unconfigured; provider calls never return mock success. `onRequestError` captures server request failures when configured. The scrubber constructs an allowlist of valid event ID, numeric timestamp, approved environment and redacted exceptions with numeric frame coordinates. It drops tags, transaction names, fingerprints, log entries, stack paths/function names/local variables/source context and all other free-form fields. This intentionally reduces grouping/source-map detail until reviewed safe source mapping exists. Tracing is off until safe attribute policies and sampling budgets exist.

Browser/edge instrumentation, error boundary capture, private source-map upload, release tagging and live alert routing are not configured yet. Add these with the first interactive UI/verified Sentry project; tests must prove no PII/URLs/session tokens leak. Never expose SENTRY_AUTH_TOKEN publicly. Source-map builds must fail visibly if an enabled upload fails; missing integration must not be reported as successful.

## Signals to implement

Structured logs with request ID, safe event code, environment, release, duration and outcome. Allowlist attributes; no message bodies, addresses, declared contents, code values, secrets, raw webhook payloads or signed URLs. Use pseudonymous resource IDs only where operationally necessary and covered by retention policy. Avoid catch-and-ignore: classify expected validation/business errors separately from internal failures, return safe errors and capture diagnosable context.

Metrics: request error/latency, auth rejection/rate-limit counts, matching candidate counts/latency, reservation conflicts, stuck booking age, webhook ingest/processing lag, retry/dead-letter count, reconciliation differences, refund/transfer/payout failures and email bounces. Do not use high-cardinality private IDs as metric labels.

Proposed launch objectives: 99.9% successful application availability over 30 days; webhook intake p95 <2s; normal notification/outbox processing p95 <60s. These are targets awaiting load tests and operational ownership, not current SLAs. Alert on sustained 5xx, missing successful webhook processing, any reconciliation imbalance, dead jobs, payout failures and backup failures. Rate-limit/deduplicate alerts; page only actionable incidents with runbook and owner.

## Audit vs telemetry

Audit events are durable database records appended in the mutation transaction, access-restricted and retained under policy. Sentry/logs are diagnostic and may be sampled/dropped; never use them as payment audit evidence. Audit metadata is allowlisted by action and includes actor kind, resource, reason and request ID. Operator access to sensitive evidence is itself audited.

## Operations before launch

Verify end-to-end test error reaches correct environment/release, alert recipient acknowledges, secret/PII redaction works, source map resolves safely, and recovery runbook succeeds. Review retention and EU data-processing settings. Assign an incident owner and escalation hours; add provider status checks and synthetic non-mutating probes. No monitor should send live booking/payment requests.
