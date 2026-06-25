# SDK Changelog and Breaking-Change Guidance

This document explains how `Kovara-sdk` versions align with `KovaraContract` API
changes, what constitutes a breaking change for SDK consumers, and how to migrate
between releases.

---

## Versioning policy

`Kovara-sdk` follows [Semantic Versioning 2.0.0](https://semver.org/) with the
following contract-specific rules layered on top.

| Version component | When it changes |
|---|---|
| **MAJOR** (`X.y.z`) | A contract API change breaks the existing SDK surface (removed method, changed argument type, renamed return field). |
| **MINOR** (`x.Y.z`) | New contract entrypoints are added without removing or altering any existing ones. New SDK helper methods or types are introduced. |
| **PATCH** (`x.y.Z`) | Bug fixes in the SDK adapter layer, documentation updates, or internal refactors that do not affect the public API. |

> **Contract upgrades do not automatically require an SDK major bump.**
> A contract upgrade that only adds new storage keys, internal helpers, or
> administrative endpoints that are not exposed through `KovaraClient` is a
> minor version increment.

---

## What counts as a breaking change

Any of the following require a **MAJOR** version bump and a migration guide entry
in this file:

- **Removing a public method** from `KovaraClient` (e.g. removing `getProfile`).
- **Changing a method's signature** — adding or removing required parameters,
  changing parameter order, changing parameter type.
- **Changing a method's return type** — narrowing, widening, or restructuring the
  returned object shape (e.g. renaming a field in `Profile`, `Post`, or `Pool`).
- **Removing or renaming a public type** (`Profile`, `Post`, `Pool`, error classes).
- **Changing error class hierarchy** — making an existing error class no longer
  extend `KovaraError` would break `instanceof` checks.
- **Changing the module entry point** — altering `main`, `types`, or `exports` in
  `package.json` so that existing `import`/`require` paths no longer resolve.
- **Dropping Node.js version support** without a major bump.

The following are **not** breaking changes (safe for patch or minor releases):

- Adding new optional parameters to existing methods.
- Adding new fields to returned objects (existing fields remain unchanged).
- Adding new exported types or error subclasses.
- Adding new optional methods to `KovaraClient`.
- Internal implementation changes (swapping RPC strategies, caching, etc.) that
  do not alter observable output.

---

## Release checklist for SDK maintainers

When cutting a new SDK release, follow these steps before tagging:

1. **Identify the change type** using the table above.
2. **Update `packages/sdk/package.json`** — bump the version field to match.
3. **Add a changelog entry** in the root `CHANGELOG.md` under a new `[SDK/x.y.z]`
   heading (see format below).
4. **Write a migration guide** in the `## Migration guides` section of this file
   if the release is a MAJOR bump.
5. **Regenerate bindings** if the contract WASM changed:
   ```bash
   pnpm build:contracts
   bash packages/sdk/generate.sh
   ```
6. **Build and verify** the SDK:
   ```bash
   pnpm --filter sdk build
   pnpm --filter sdk test
   ```
7. **Tag and push** — the `publish-sdk.yml` CI workflow triggers on `sdk/v*` tags
   and validates the package before publishing to npm.

---

## CHANGELOG entry format

Add a new block in `CHANGELOG.md` immediately below `## [Unreleased]`:

```markdown
## [SDK/x.y.z] - YYYY-MM-DD

### Breaking Changes
<!-- Only present for MAJOR releases. List removed/changed methods and types. -->

- Removed `KovaraClient.getSomeOldMethod()` — use `getNewMethod()` instead.
- `Profile.legacy_field` renamed to `Profile.new_field`.

### Added
<!-- New methods, types, or features. -->

- `KovaraClient.getNewContractEntrypoint()` — wraps the new `get_new_thing`
  contract function added in contract release v0.3.0.

### Changed
<!-- Non-breaking changes to existing methods or types. -->

- `getPost()` now returns `null` instead of throwing `NotFoundError` for
  unknown post IDs, consistent with `getProfile()` behaviour.

### Fixed
<!-- Bug fixes in the SDK adapter layer. -->

- `mapError()` now correctly classifies `"low balance"` as
  `InsufficientBalanceError` instead of the generic `KovaraError`.

### Deprecated
<!-- Features that will be removed in the next major release. -->

- `KovaraClient.getLegacyPool()` is deprecated. Use `getPool()` instead.
  The legacy method will be removed in SDK v2.0.0.
```

---

## Migration guides

### SDK 0.1.x → SDK 0.2.x (no breaking changes)

The 0.1.x → 0.2.x transition introduced new read methods and internal
refactoring. No public API was removed. Update the package version and
re-run your import — no code changes required.

```bash
pnpm add Kovara-sdk@^0.2.0
```

### Future major releases

Migration guides for future breaking releases will be added here following the
same format. Each guide will include:

- **What changed** and why.
- **Before / after** code examples for every breaking method or type.
- **Automated codemod** instructions if a script is available.

---

## Aligning SDK and contract releases

The contract (`packages/contracts`) and the SDK (`packages/sdk`) are versioned
independently so that documentation patches or SDK helper additions do not force
a contract rebuild and re-deploy.

Use the table below to track which SDK version wraps which contract interface:

| SDK version | Compatible contract version | Notes |
|---|---|---|
| `0.1.x` | `0.1.0` | Initial release. Core social graph, posts, tips, and pools. |
| `0.2.x` | `0.2.0` | Typed storage keys; `get_address_by_username` added. |

When a new contract version is deployed, update this table in the PR that bumps
the SDK version.

---

## Automated binding verification

The SDK ships an integration test (`packages/sdk/src/__tests__/bindings.test.ts`)
that asserts the current `KovaraClient` surface matches the expected contract API.
Run it before every release:

```bash
pnpm --filter sdk test -- --testPathPattern=bindings
```

The test will fail if a contract method is present in the expected surface but
absent from `KovaraClient`, or if a type field is missing — acting as a compile-time
guard against accidental regressions in the generated bindings.
