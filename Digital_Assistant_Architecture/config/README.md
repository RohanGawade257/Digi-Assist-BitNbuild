# Quota configuration

Copy quota-policy.example.json to quota-policy.json. This is a proposed application schema, not a provider-issued file. Fill actual limits per group/model/operation using the account dashboard, document verification, and set verified true only after checking. Null means unknown; it must fail live readiness rather than mean unlimited. If a dimension does not apply, record that explicitly in the implemented schema and validator.

All same-project Gemini keys share the same group. Treat Sarvam keys conservatively as same-account shared limits until verified. The app must enforce the most restrictive applicable group/account and local application cap; do not assume each operation has an independent allowance. Extend the schema for shared cross-operation/account buckets when the account requires them.

The API mounts the operator's file read-only. App readiness must reject missing, unverified or malformed policy, unknown configured groups/models and inconsistent limits. No keys belong in this JSON. This kit supplies the example and mount, not the scheduler implementation.
