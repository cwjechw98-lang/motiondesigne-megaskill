<div align="center">
<img src="assets/banner.svg" alt="Motion Design Megaskill — think, move, adapt" width="100%">

# A creative partner, not a shell patch

**Portable motion-design skill, visual atlas and creative knowledge base.**

[Русский](README.md) · [Install](docs/INSTALLATION.md) · [Architecture](docs/ARCHITECTURE.md)
</div>

## What it does

The skill complements an existing agent instead of replacing its role or memory. On invocation, the agent helps turn a brief into useful creative directions, recommends an approach and proceeds with the tools actually available. Presets are optional: the knowledge base teaches deriving material, movement and composition from meaning.

The package includes 21 independently authored directions, three spatial modifiers, a local searchable gallery and 24 preview illustrations. The nine foundational previews and three spatial studies are original SVGs; twelve exploratory previews are AI-generated images created for this project. All are static illustrations, not tested animations. Numbers and lettering in generated images are not factual data.

## Start

Install this folder as a user skill using your agent's documented mechanism. SKILL.md must be at the skill root. If native discovery is unsupported, the agent can read SKILL.md as supplemental instructions; this is not a claim of official product integration.

Then ask:

> Use motion-design-megaskill. I want a short film about turning a chaotic set of ideas into a clear plan. Suggest distinct creative approaches, recommend one and help implement it with the tools available here.

Or:

> Don't pick a preset. Build an original visual language for my story and explain how material and motion support the meaning.

The instructions and current creative references are primarily Russian. An agent can respond in your preferred language; no professionally reviewed English translation of every reference is claimed.

## Browse locally

Open gallery.html from the downloaded folder in a browser. No server, external fonts, dependency installation or API keys are required. GitHub's file view does not execute the gallery; download or clone first. [Text catalogue](references/preset-catalog.md).

Selecting a card assembles text for copying. It does not send chat messages, execute code or start rendering. An optional, explicitly enabled draft-only iframe message contract is documented in [integration-contract.md](docs/integration-contract.md).

## Adapt to the harness, not the other way around

Integration is optional and separate from creating a film. The agent should inspect actual capabilities and choose the smallest useful path: standalone gallery, native artifact viewer, user command, or documented user extension. It must not patch application resources, node_modules, global prompts or provider settings.

The content stays outside the application's installation. This reduces update fragility but cannot guarantee eternal API compatibility. A thin adapter may need updating; the local skill and gallery remain a fallback. No universal host plugin is included.

## Optional local installer

Node.js 20+ is required only for the installer and checks, not for reading instructions or browsing the gallery. No npm dependencies are needed.

```sh
node scripts/install.mjs --help
node scripts/install.mjs --target "<absolute-skill-directory>" --dry-run
node scripts/install.mjs --target "<absolute-skill-directory>"
```

Use your actual absolute destination, not the placeholder. Existing targets are refused unless --replace is explicit; replacement preserves a backup. Keep personal presets and adapter settings outside the replaced release folder. [Detailed instructions](docs/INSTALLATION.md).

Checks:

```sh
node --test
node scripts/validate.mjs
```

The CI configuration targets Linux, Windows and macOS on Node 20/22/24; it is not a claim that every host and platform has already been tested. Rendering requires a suitable existing renderer; the package does not bundle a video engine or paid provider.

## Sources and rights

Initial inspiration: the public [VIZAVI lesson](https://vizavi.academy/lesson-motion/). Further learning sources include Codrops, Animography and Motionographer. [Research notes](references/research-notes.md) distinguish text access from actual live-demo observation; this is not a complete survey of every video.

This is independent and unofficial. The original VIZAVI archive, instructions, verbatim prompts and preview assets are not redistributed. See [NOTICE.md](NOTICE.md) for provenance and AI-image limitations. Code/documentation: [MIT](LICENSE). [Contribute](CONTRIBUTING.md) · [Security](SECURITY.md).
