# Safety reporting

Phase 1J adds an MFA-enforced staff queue and explicit `open → under_review → resolved|dismissed` transitions. Reporting alone has no automatic punitive effect; a moderator must record a distinct decision. Support sees safe metadata and may add notes. Moderators may read referenced evidence only through a command that records resource, purpose, actor and time. Internal state, notes, decisions and audit data remain invisible to members.

Phase 1I accepts structured reports only inside a booking interaction. A participant may report the counterparty, a counterparty message or a booking concern using controlled reason codes. These are product intake categories, not an exhaustive legal taxonomy.

The command verifies reporter participation, booking/conversation linkage, counterparty identity and optional message ownership. It stores stable references plus a 10–2,000 character note. Message text is not copied because messages are immutable.

Report and report-event tables have RLS enabled, no member SELECT and no direct API writes. The reported user cannot see a report. The reporter receives only a submission acknowledgement. Future staff review requires separate MFA/role authorization and audit. Reporting does not automatically block a user or change a booking.
