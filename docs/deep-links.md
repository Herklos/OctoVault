# Deep links & universal / App Links

Domain: **`oc.drakkar.software`** (serves the OctoVault web app and the link
association files).

OctoVault opens from links three ways:

| Link form | Example | Works |
| --- | --- | --- |
| **Web URL** | `https://oc.drakkar.software/join#<token>` | Web app (always) |
| **Custom scheme** | `octovault://join#<token>` | Native, once installed |
| **Universal / App Link** | `https://oc.drakkar.software/join#<token>` | Native, opens the app directly (web fallback if not installed) |

Expo Router maps file routes to URLs automatically, so `octovault://rooms`,
`octovault://room/<id>`, `octovault://join`, `octovault://search` already resolve
in any standalone/dev build — `scheme: "octovault"` is set in `app.json`.

## Invite link types

OctoVault issues two kinds of invite links, both encoded as a `#fragment` in the
`/join` URL. `previewInvite()` (from `@drakkar.software/octospaces-sdk`) classifies
the fragment into a discriminated union before the user confirms:

| Kind | Created by | Fragment carries | Join call |
|---|---|---|---|
| `space-link` | `createSpaceInviteLink` | space cap + ephemeral key + `write` flag | `joinSpaceByLink(session, token)` |
| `node-link` | `createNodeInviteLink` | per-node cap + ephemeral key | `joinNodeByLink(session, token)` |
| `member-bundle` | `inviteToSpace` (direct invite) | serialised member cap JSON | `acceptSpaceInvite(session, inviteJson)` |

The `/join` screen calls `previewInvite(fragment)`, shows a consent card with the
space/node name and issuer fingerprint, then dispatches the appropriate join call on
confirm. No join is initiated without user confirmation.

## Done in the repo

- **`scheme: "octovault"`** in `app.json` → custom-scheme deep links route via
  Expo Router on native.
- **Invite-link handler** — `src/lib/use-invite-link.ts` (`useInviteFragment`)
  reads the credential `#fragment` from the launch URL on **web** (`location.hash`)
  and **native** (raw `Linking.getInitialURL()` + `url` event — the fragment is
  read from the raw URL, never through a parser, which would drop it).
  `src/app/join.tsx` consumes it, calls `previewInvite` to classify it, and joins
  the space or node once the user confirms.
- **`WEB_BASE`** (`src/lib/starfish/config.ts`, from `EXPO_PUBLIC_WEB_URL`) — the
  public origin used to build shareable invite links on native (web uses the live
  `window.location.origin`). Passed to `createSpaceInviteLink` / `createNodeInviteLink`.
- **Native association config** in `app.json` — `ios.associatedDomains:
  ["applinks:oc.drakkar.software"]` and an Android `intentFilters` entry for
  `https://oc.drakkar.software/join*` with `autoVerify: true`.
- **`EXPO_PUBLIC_WEB_URL=https://oc.drakkar.software`** in all three `eas.json`
  build profiles, so native-built invite links emit the full `https://…/join#…`.

So `octovault://join#<token>` auto-joins on native **today**. The `https://` form
opening the app needs the two hosted files below — plus a rebuild (the `app.json`
native keys only take effect in a fresh build).

> Scope is deliberately **`/join` only** (the one link the app generates). The
> Android `pathPrefix: "/join"` is essential: without it `autoVerify` would claim
> the *entire* host and every `https://oc.drakkar.software/…` link — the web app
> included — would open the native app on Android. Only widen the AASA `paths` /
> Android `pathPrefix` when you actually ship `/space|/node` link-sharing **and**
> make those screens robust to missing params + membership.

## Remaining: host two association files on `oc.drakkar.software`

Both need two values not in the repo:

- **`<APPLE_TEAM_ID>`** — Apple Developer → Membership, or `eas credentials` → iOS.
- **`<ANDROID_SHA256>`** — signing-cert SHA-256, via `eas credentials` → Android.
  List **every** keystore to verify (EAS dev/preview and Play App Signing differ).

Serve both over **HTTPS**, no redirects.

**`https://oc.drakkar.software/.well-known/apple-app-site-association`** — no
extension, `Content-Type: application/json`:

```json
{
  "applinks": {
    "apps": [],
    "details": [
      {
        "appID": "<APPLE_TEAM_ID>.com.drakkarsoftware.octovault",
        "paths": ["/join", "/join/*"]
      }
    ]
  }
}
```

**`https://oc.drakkar.software/.well-known/assetlinks.json`** —
`Content-Type: application/json`:

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.drakkarsoftware.octovault",
      "sha256_cert_fingerprints": ["<ANDROID_SHA256>"]
    }
  }
]
```

The OctoVault web app serves static files from `apps/mobile/public/` (Expo
`web.output: "single"`). Since `oc.drakkar.software` is the OctoVault web app, drop
the two files into `apps/mobile/public/.well-known/` so they ship with the web
export — **but only with the real values filled in**: confirm the host serves the
extension-less AASA as `application/json` and does not rewrite `/.well-known/*`
into the SPA. Otherwise host them via Infra.

> Do not commit a placeholder AASA to the live `.well-known/` path: Apple's CDN
> caches it and Android verifies App Links at install. Fill the real values first.

## Testing

**Custom scheme (works now, no build config):**

```sh
npx uri-scheme open 'octovault://join#<token>' --ios
npx uri-scheme open 'octovault://room/<roomId>' --android
# Expo Go uses exp:// — prefix the path with /--/:
npx uri-scheme open 'exp://127.0.0.1:8081/--/join' --ios
```

**Universal / App Links** can't be verified locally — they need:
- the AASA + `assetlinks.json` actually served on `oc.drakkar.software` (validate
  the AASA via a validator / the Apple App Search API; check Android with
  `adb shell pm get-app-links com.drakkarsoftware.octovault`), **and**
- a **signed device build** (Apple CDN-caches the AASA; Android verifies at install).

Tapping `https://oc.drakkar.software/join#<token>` in Messages/Notes (iOS) or via
`adb shell am start -a android.intent.action.VIEW -d 'https://oc.drakkar.software/join#<token>'`
(Android) should open the app and auto-join.
