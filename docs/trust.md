# Trust and reputation

Flyco exposes objective indicators rather than an opaque score. `profile_trust` contains verified email/phone/identity flags, completion counters, review count and rating sum, cancellation count and dispute count. Everyone may read it; members cannot write it.

Account age is derived from `member_profiles.created_at`. Average rating is derived from rating sum and count. Future booking, review, dispute and verification commands will update projections in the same transaction as their source event, while source rows remain authoritative and projections remain rebuildable.

Email verification is initialized from Supabase Auth and refreshed from `auth.users` by an actor-bound function whenever the member account shell loads; the client supplies neither the user ID nor the value. Phone verification is represented by system-controlled `profiles.phone_verified_at`; changing the editable phone clears it. Identity verification changes only through a future trusted provider/staff command. Phase 1B adds no KYC provider or client-writable verification path.
