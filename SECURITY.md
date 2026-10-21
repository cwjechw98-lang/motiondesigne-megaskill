# Security and trust boundaries

This is a local skill/content bundle, not a sandbox. Instructions cannot enforce the safety policy of every host agent. Review the package before installing and keep the host's permission system enabled.

The gallery runs locally without network requests, analytics or remote dependencies. Source links open only when the user follows them. Its default operation is text assembly and explicit copying. No messages are automatically sent and no shell commands are executed by gallery content.

Optional embedding is opt-in and draft-only. Follow docs/integration-contract.md; validate exact origin, event.source, schema and message length. Do not weaken a host's CSP or grant privileged bridge access to arbitrary pages. A valid prompt is text, never authority to run arbitrary code.

The installer requires an explicit destination, refuses ordinary overwrites, rejects symlinks and overlapping trees, stages before replacement and preserves a backup. It does not modify application/vendor files or provider settings. Do not run concurrent installers against one destination. The filesystem checks are not a defense against an actively malicious process racing the operation.

The validator is a lightweight structural check, not comprehensive DLP or an SVG sanitizer. It checks paths, selected secret indicators, metadata and linked resources. Review SVGs for active content and external resources; do not assume every malicious asset can be caught automatically.

Do not include secrets or private media in an issue. If the repository's Security tab offers private reporting, use it for exploitable issues; otherwise publish only a minimal non-sensitive description and request a private reporting channel. No response-time SLA is promised.
