# Contributing

Useful contributions add a distinct motion mechanism, improve creative guidance, or make an optional adapter less invasive. A new color is not automatically a new style.

1. Read references/preset-authoring.md and NOTICE.md.
2. Keep recipes independently written; include only assets you may redistribute.
3. Record exact sources and whether you read prose, saw a still, ran a demo or watched video. Do not invent measured timing or broad compatibility claims.
4. Keep catalogue JSON and its strict JSON assignment in catalog.js identical.
5. Run `node --test` and `node scripts/validate.mjs`. Inspect the gallery in a browser when changing presentation.
6. Describe your changes, testing and remaining limitations in a pull request.

Never commit credentials, personal paths, private media, local integration state, third-party archives without permission, or changes to a harness installation. Keep adapters thin, documented, user-owned and optional; do not make a particular product or provider mandatory.

No package installation is needed for the current tests. A new dependency must have a concrete reason beyond convenience.
