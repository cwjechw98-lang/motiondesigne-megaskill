# Gallery integration contract

The gallery is a portable static page: open `gallery.html` with `gallery.css`, `gallery.js`, `catalog.js` and relative `assets/presets/` beside it. No server, package dependency, shell API or particular assistant is required. `catalog.js` sets `window.MOTION_LIBRARY` before `gallery.js` runs; `catalog.json` is the equivalent machine-readable catalog, not fetched by this page.

## Default: copy only

The page builds a text instruction. Its default action writes to the clipboard after an explicit click; denied or unavailable Clipboard API falls back to selecting the visible textarea and legacy copy. If that also fails, copy the selection manually (Ctrl+C, Command+C, or the mobile selection menu). This works without accessing a parent document or relying on same-origin iframe privileges. No code runs, no render starts, no chat submits, and no host document is mutated.

For an iframe, retain a visible standalone/open-in-new-tab link in the host UI. Clipboard permission can be granted with `allow="clipboard-write"` where supported, but is optional: the textarea/manual-copy fallback must remain available. Do not hide the gallery's copy controls. A restrictive sandbox may disable scripting; include `allow-scripts` if interactive gallery behavior is desired. Never add `allow-same-origin` merely to make copying work. In particular, the combination of scripts and same-origin on an untrusted same-origin frame is not a security boundary.

## Optional, explicit draft handoff

Only an embedded page with both `integration=postmessage` and an exact HTTP(S) `parentOrigin` enables the separate **Передать черновик** button. For example:

```html
<iframe title="Motion Design Megaskill" src="gallery.html?integration=postmessage&amp;parentOrigin=https%3A%2F%2Feditor.example"></iframe>
```

A host constructing `srcdoc` may instead set `window.MOTION_LIBRARY_INTEGRATION = 'postmessage'` and `window.MOTION_LIBRARY_PARENT_ORIGIN = 'https://editor.example'` before loading `gallery.js`. Origin must contain only scheme, authority and optional trailing slash: no credentials, query, fragment or path. There is no wildcard target and no implicit referrer-based trust. Local `file:` parents use copy-only mode.

A click posts this exact shape to the configured parent origin:

```json
{"type":"motion-library:apply","version":1,"action":"draft","prompt":"…"}
```

`prompt` is a string of at most 16,000 JavaScript UTF-16 code units. Oversized drafts are not posted; the user can shorten or copy them. Brief input is limited to 8,000 code units. No automatic messages are emitted on selection or page load. This is fire-and-forget, with no delivery acknowledgment; the UI must not claim a host accepted a draft.

A receiver MUST validate all of these before handling any message:

- `event.source === theExpectedIframe.contentWindow` (not merely any child frame).
- `event.origin === theConfiguredGalleryOrigin` as an exact origin, never substring matching. Origin must correspond to the actual deployment, not the parent target origin. Prefer a non-opaque HTTP(S) gallery origin; do not accept arbitrary `null` origins or use wildcard trust for file/srcdoc/sandbox frames. Copy mode remains available when a frame cannot be safely authenticated.
- `event.data` is a non-null object, not an array; its only own keys are `type`, `version`, `action`, `prompt`; the first three match the literal schema above; prompt is a string with length from 1 through 16,000. Reject all other versions/actions and malformed messages.

Treat prompt content as untrusted text, even after envelope validation. Assign it to a draft field using the host's deliberate draft API or a textarea value, never `innerHTML`, evaluation, a shell, or an automatic submit path. This event authorizes COPY/DRAFT ONLY: it must never send a chat message, invoke an agent/tool, render media, execute code or change system settings. Require a separate explicit user action for any subsequent send or execution. Hosts that cannot honor this boundary should not opt in.

The gallery has no inbound message handler. There are no assumed global host APIs, DOM selectors, assistant names, or operating-system paths.

## Embedding choices and asset trust

Use the standalone relative files directly; embed them with an iframe; or bundle the same CSS, catalog and JavaScript into a self-contained document in that order. For a self-contained document, provide a suitable base URL or rewrite catalog image paths to trusted packaged `assets/presets/` resources. Do not rewrite them to data URLs: the image allowlist intentionally rejects data SVG, other data URLs, remote URLs, query strings, nested paths and traversal.

Only `assets/presets/<safe-basename>.svg`, `.webp`, `.png`, `.jpg`, `.jpeg`, or `.avif` previews are accepted. SVGs are trusted authored repository assets loaded as images, not arbitrary uploaded SVG or executable inline markup. Review any catalog and assets before distribution. A missing or rejected preview leaves a useful unavailable state.

Collection labels describe the gallery grouping (`foundations`: classic, `explorations`: experimental), not third-party ownership. `previewKind: 'authored-svg'` identifies an own vector demonstration; `'generated-style-illustration'` identifies an AI-generated static illustration. Neither means animation, a rendered deliverable, or a claim about available rendering capabilities. The universal instruction helper remains tool-neutral. Creative guidance is linked relatively at `references/creative-grammar.md`.
