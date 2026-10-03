# PASS — Security Specification

**Security posture:** non-custodial, explicit user authorization, provider-bounded execution.

## 1. Threat model

Assume attackers may:

- compromise a user's browser session;
- craft malicious Pass URLs;
- tamper with client requests;
- replay signed requests;
- manipulate stale market data;
- abuse OAuth callbacks;
- exploit X/extension DOM injection;
- exploit backend provider credentials;
- attempt duplicate order submission;
- impersonate identities.

## 2. Custody rule

PASS must never request, collect, store, or transmit a user's seed phrase or master private key.

The user's master wallet establishes ownership/authorization. Trading may use a Hyperliquid API/agent wallet approved by the user.

## 3. Agent-key model

MVP design:

1. Generate the agent/API key in the trusted client context.
2. User approves it through Hyperliquid.
3. Keep the agent private key client-controlled.
4. Do not persist it on PASS servers.
5. Do not expose it to content scripts.
6. Do not send it to browser extension popup or remote logs.
7. Use secure browser storage where necessary and provide clear recovery/re-authorization behavior.

The implementation must follow current Hyperliquid documentation for API-wallet registration and signing.

## 4. Key storage

Do not use `localStorage` for private keys.

Prefer a platform-appropriate secure storage boundary. Browser implementations must document their security assumptions and limitations.

The extension must not be treated as secure key storage.

## 5. Signed execution boundary

The user must explicitly review and approve the exact trade intent.

A signed action must be bound to:

- authenticated user context;
- Pass ID/version;
- intended order parameters;
- fresh nonce/time constraints;
- client request ID;
- expiration where supported.

## 6. Replay protection

Use Hyperliquid's nonce rules as required by the signing implementation. PASS also uses its own idempotency key for duplicate request protection.

Do not reuse agent wallet addresses after deregistration without rechecking Hyperliquid's current guidance; the official documentation notes that nonce state for deregistered API wallets can be pruned and recommends new agent addresses for future use.

## 7. Server trust boundary

The backend is trusted for:

- validation;
- Pass state;
- provider communication;
- execution tracking.

The backend is not trusted with:

- master private keys;
- seed phrases;
- client agent private keys.

## 8. OAuth security

For X:

- use OAuth state;
- use PKCE where supported/appropriate;
- validate callback parameters;
- exchange codes only server-side where required;
- encrypt any persisted refresh/access tokens;
- store token expiry/scopes;
- support disconnect/revocation.

## 9. CSRF

Protect all state-changing browser endpoints.

GET endpoints must not mutate state.

## 10. Authorization

Every authenticated mutation must verify ownership server-side.

Never trust `userId`, `traderId`, or `accountId` supplied by the client without resolving ownership from the authenticated session.

## 11. Pass tampering

A Pass URL is public. Public visibility is not permission to modify.

Only the Trader who owns the Pass can mutate it.

## 12. Historical integrity

Once an execution references a Pass version, the exact version snapshot must remain reconstructable.

## 13. Extension security

Manifest V3.

Minimize:

- host permissions;
- API permissions;
- stored data;
- privileged operations.

Do not inject remote executable code. Do not use arbitrary webpage text as trusted HTML. Sanitize all DOM content. Prefer DOM APIs over unsafe HTML injection.

## 14. X content injection

X page content is untrusted input.

Do not construct extension UI with `innerHTML` from raw post/profile content. Escape/encode any displayed username, post text, URLs, IDs, and external data.

Use MutationObserver carefully and throttle DOM rescans.

## 15. Provider credentials

Server-side X/Ethos credentials must be stored in managed secret storage/environment variables, never source control.

Use separate preview and production credentials.

## 16. Logging

Never log:

- private keys;
- seed phrases;
- OAuth refresh/access tokens;
- signed payloads containing sensitive secrets;
- raw authorization headers.

Redact provider IDs only when they are classified as sensitive; public wallet/account addresses can still be personal data in context and should not be sprayed into logs unnecessarily.

## 17. Rate limiting / abuse

Protect:

- auth endpoints;
- public Pass resolution;
- Ethos lookups;
- execution endpoints;
- extension resolution APIs.

Use per-IP and per-user strategies as appropriate.

## 18. XSS / injection

Apply output encoding, CSP, safe URL handling, and framework defaults. External URLs must be validated before rendering as links.

## 19. Database security

- least-privilege DB role;
- migrations through reviewed code;
- backups;
- no production DB credentials in client bundles;
- parameterized queries/ORM bindings.

## 20. Financial safety UX

The UI must make clear that:

- the Taker is choosing their own size;
- execution is on Hyperliquid;
- prices can move;
- a Pass can become stale;
- execution may be rejected;
- displayed historical performance is not a guarantee.

Do not provide guaranteed-return language.
