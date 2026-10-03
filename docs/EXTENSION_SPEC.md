# PASS — Chrome Extension Specification

**Status:** First-build requirement
**Platform:** Chrome Manifest V3

## 1. Purpose

The PASS Chrome extension brings PASS discovery/context into X where traders already encounter trade ideas.

It is a companion to the PASS web application, not a second trading platform.

## 2. First-build scope

The initial extension must:

1. run as Manifest V3;
2. detect supported X profile/post surfaces;
3. resolve PASS context through PASS API;
4. inject lightweight, clearly branded PASS UI;
5. deep-link to a Pass or Trader profile;
6. provide a popup with connection/status information;
7. handle loading, not-found, and API-error states gracefully.

## 3. Example behavior

On a detected Trader profile:

```text
@TraderX

PASS
Ethos 1,742
3 Active Passes
[View PASS]
```

On a detected PASS link/post:

```text
PASS
BTC LONG
Entry $113.4K
[View Pass]
```

The exact visual design may evolve during iteration.

## 4. Architecture

```text
extension/
├── manifest.json
├── src/
│   ├── background/
│   │   └── service-worker.ts
│   ├── content/
│   │   ├── x.ts
│   │   ├── detector.ts
│   │   ├── resolver.ts
│   │   └── ui/
│   ├── popup/
│   │   ├── popup.html
│   │   └── popup.tsx
│   ├── shared/
│   │   ├── messages.ts
│   │   ├── config.ts
│   │   └── types.ts
│   └── options/
├── public/
└── build/
```

## 5. Manifest

Use Manifest V3.

The manifest must declare only the minimum required permissions and host permissions.

Initial intended hosts:

- X pages required for the overlay;
- PASS API/web host needed by the extension.

Do not request `*://*/*` unless the implementation proves it necessary.

## 6. Service worker

Responsible for:

- extension lifecycle events;
- message handling;
- API coordination when appropriate;
- opening PASS URLs;
- storage of non-sensitive extension settings.

It must not access the DOM.

## 7. Content script

Responsible for:

- observing X DOM changes;
- detecting eligible profile/post surfaces;
- mounting and updating PASS UI;
- sending messages to the service worker.

Use robust selectors and defensive detection because X is a third-party dynamic UI.

## 8. DOM strategy

Do not rely exclusively on fragile class names.

Prefer semantic attributes, accessible labels, URL structure, and stable data attributes when available.

Use MutationObserver with debounced/throttled rescans.

Avoid full-page scans on every mutation.

## 9. API strategy

Prefer extension requests to the PASS API rather than direct calls to Ethos or Hyperliquid where a PASS-normalized response already exists.

The extension should have a tiny normalized DTO:

```ts
interface XContextCard {
  handle: string;
  profileUrl: string;
  passProfileUrl: string | null;
  ethosScore: number | null;
  activePassCount: number;
  hasActivePass: boolean;
}
```

## 10. Handoff

Clicking an extension CTA opens a normal PASS web URL in a tab.

Example:

`https://pass.example/u/traderx`

or

`https://pass.example/p/8xK29`

## 11. Extension does not trade

The extension should not:

- hold Hyperliquid private keys;
- sign orders;
- manage agent keys;
- submit trades;
- impersonate PASS web application permissions.

Execution stays in the PASS web application.

## 12. Permissions UX

Explain why permissions are needed. Request optional permissions only when possible.

## 13. Storage

Store only:

- extension settings;
- UI preferences;
- non-sensitive cached identifiers.

Never store:

- seed phrases;
- master private keys;
- Hyperliquid agent private keys;
- OAuth refresh tokens.

## 14. Failure handling

Extension must degrade to no overlay when:

- X page structure is unrecognized;
- PASS API is unavailable;
- user is not connected;
- no PASS profile exists;
- browser permissions are restricted.

Do not break X navigation.

## 15. Packaging

Build the extension as a static MV3 bundle. Manifest V3 does not permit remotely hosted executable code; all executable extension code must be packaged and reviewed as part of the extension bundle.

## 16. Testing targets

Test at minimum:

- X home/feed;
- profile page;
- post/tweet detail;
- SPA navigation without page reload;
- scrolling through long feeds;
- profile switching;
- API offline state;
- user without PASS profile;
- user with active Pass;
- user with no active Pass.
