# Repository guidance

This repository follows the standalone Ankhorage package structure: keep cross-package imports on published public APIs, preserve module-owned source and templates here, and keep generic reusable behavior in its owning package.

The narrow rule in `eslint.local.config.mjs` covers existing oversized config and module test callbacks exposed by the Devtools 1.6 migration. New or materially changed code must satisfy the canonical Devtools rules; do not expand the file list, and remove each exception when that legacy test is structurally split.
