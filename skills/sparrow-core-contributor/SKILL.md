---
name: sparrow-core-contributor
description: Modify Sparrow runtime, AI playground, guides, views, or public exports for this repo. Use when asked to add or change chart behavior, prompt rules, runtime APIs, guide/view logic, or the developer workflow around those modules.
---

# Sparrow Core Contributor

## Overview

Work on Sparrow's runtime and AI-facing surfaces without drifting from the repo's architecture or tests.

## Workflow

1. Read `references/architecture.md` to locate the affected layer and public touchpoints.
2. Read `references/testing.md` to map the change to the smallest relevant test files first.
3. Patch the source at the layer that owns the behavior instead of adding glue in unrelated files.
4. Update docs and prompt artifacts when the public contract changes.
5. Self-check that exports, README guidance, and tests stay aligned.

## Notes

- Preserve Sparrow's small, composable API shape.
- Do not silently widen the AI contract; if a new type becomes supported, update the runtime, tests, and prompt references together.
- Prefer targeted changes in `src/plot`, `src/guide`, `src/views`, and their matching tests over broad refactors.
