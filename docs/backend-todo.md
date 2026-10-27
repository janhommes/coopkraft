# Backend todo

Lovable adds a line here whenever the backend has to follow a UI change: a new data area, a new or changed role/action, a change to `resolveRoles` or `DEFAULT_SSO_CONFIG`. Claude works through the list and deletes finished entries.

## Open
- _nothing yet_

## Phase 2 (planned)
- Move workflows to server commands: `approveMembership` / `recomputeMemberStatus`, `confirmPayment`, terminations (including `processDueTerminations` as a daily job instead of running in a staff member's browser), transfers, member numbers, audit log.
- Then tighten `backend/src/Acl.php` from "staff may write all business data" to per-action role checks (self-approval, required approvers from the workflow config).
- Public signup: spam protection (rate limit or honeypot).
