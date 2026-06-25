# Kovara Contract Upgrade Guide

This document covers everything you need to know before upgrading the Kovara
on-chain contract: preconditions that must be satisfied, how invalid or missing
WASM hashes are handled, the security model, and the step-by-step runbook.

---

## Table of Contents

1. [How Soroban Upgrades Work](#how-soroban-upgrades-work)
2. [Upgrade Preconditions](#upgrade-preconditions)
3. [Invalid and Missing WASM Hashes](#invalid-and-missing-wasm-hashes)
4. [Security Model](#security-model)
5. [State Preservation](#state-preservation)
6. [Step-by-Step Runbook](#step-by-step-runbook)
7. [Verifying a Successful Upgrade](#verifying-a-successful-upgrade)
8. [Rollback](#rollback)
9. [Indexer Coordination](#indexer-coordination)
10. [Frequently Asked Questions](#frequently-asked-questions)

---

## How Soroban Upgrades Work

Soroban contracts are upgraded by replacing the WASM bytecode associated with
the contract's address.  The contract ID and all on-chain storage remain
unchanged; only the executable code is swapped.

The Kovara contract exposes a single upgrade entry point:

```rust
pub fn upgrade(env: Env, new_wasm_hash: BytesN<32>)
```

Internally it:

1. Bumps the instance-storage TTL (to keep state alive through the upgrade).
2. Verifies that the caller is the stored admin address (`require_admin`).
3. Calls `env.deployer().update_current_contract_wasm(new_wasm_hash)` — the
   Soroban host replaces the bytecode and validates the hash.
4. Emits a `ContractUpgraded` event containing the new WASM hash.

The new code is active from the very next ledger.

---

## Upgrade Preconditions

All of the following must be true before `upgrade()` will succeed:

| # | Precondition | What happens if violated |
|---|---|---|
| 1 | The contract must be **initialized** (`initialize()` called at least once) | Panics with `"not initialized"` |
| 2 | The **caller must be the stored admin** address | `require_auth()` raises an auth error |
| 3 | The `new_wasm_hash` must reference a **WASM blob that has been uploaded** to the Stellar ledger via `stellar contract upload` | The Soroban host raises a storage error |

Preconditions are checked in this order:

```
bump_instance()        ← TTL extension (no auth required)
require_admin()        ← initialization guard + auth check  [stops here if uninitialized or wrong caller]
update_current_contract_wasm()   ← hash validation by host  [stops here if hash not in ledger]
ContractUpgraded.publish()       ← event emission
```

Because the initialization guard fires before the WASM lookup, supplying an
invalid hash to an uninitialized contract will panic with `"not initialized"`,
not with a host storage error.

---

## Invalid and Missing WASM Hashes

### What counts as an invalid hash?

A `BytesN<32>` value is syntactically valid as long as it is exactly 32 bytes.
Semantic validity — whether the hash refers to a real WASM blob — is enforced
by the Soroban host, not by the contract itself.

| Hash value | Classification | Host behaviour |
|---|---|---|
| `[0u8; 32]` (all zeros) | Syntactically valid, semantically invalid | Host rejects — no blob with this hash exists |
| `[0xffu8; 32]` (all 0xff) | Syntactically valid, semantically invalid | Host rejects — no blob with this hash exists |
| Any 32-byte value not previously uploaded | Syntactically valid, semantically invalid | Host rejects |
| Hash returned by `stellar contract upload` | Syntactically and semantically valid | Host accepts and swaps WASM |

### Why the contract does not validate hashes itself

Validating a WASM hash inside the contract would require the contract to read
and compare the WASM store — an operation only available to the host.  Instead,
the contract delegates hash validation entirely to
`env.deployer().update_current_contract_wasm()`, which is the correct and safe
approach on Soroban.

### Common mistakes

**Passing a hash that was never uploaded**

```bash
# ✗ Wrong — hash not on the ledger yet
stellar contract invoke --id $CONTRACT_ID -- upgrade --new-wasm-hash deadbeef...

# ✓ Correct — upload first, then use the printed hash
stellar contract upload --wasm Kovara_contracts.wasm   # prints wasm_hash
stellar contract invoke --id $CONTRACT_ID -- upgrade --new-wasm-hash <wasm_hash>
```

**Uploading to the wrong network**

A hash uploaded to Testnet is not available on Mainnet and vice versa.  Always
upload and invoke `upgrade` against the same `--network` flag.

**Using a stale hash from a previous build**

After rebuilding the contract (`pnpm build:contracts`), the WASM bytes change
and the hash changes with them.  Re-run `stellar contract upload` after every
build.

---

## Security Model

### Admin-only access

`upgrade()` is protected by `require_admin()`, which reads the `ADMIN` key from
instance storage and calls `admin.require_auth()`.  No other address can trigger
an upgrade.

Consequences:
- Losing access to the admin key makes future upgrades impossible without a
  recovery mechanism.
- The admin account should be a hardware-wallet-backed or multisig address on
  Mainnet.

### No re-entrancy risk

The WASM swap performed by the host is atomic with respect to the current
transaction.  There is no window where the contract is partially upgraded.

### Event trail

Every successful upgrade emits a `ContractUpgraded` event on-chain (see
[EVENTS.md](../packages/contracts/contracts/linkora-contracts/EVENTS.md)).
Indexers and monitors should subscribe to this event to detect unexpected
upgrades.

```
Topic 0:  Kovara
Topic 1:  upgraded
Topic 2:  v1
Data:     ContractUpgraded { new_wasm_hash: BytesN<32> }
```

### TTL bump before auth check

`bump_instance()` is called before `require_admin()`.  This means the instance
TTL extension happens even if the auth check subsequently fails.  This is
intentional: a failed upgrade attempt should not accidentally expire the
contract's instance storage.  The TTL bump itself carries no privilege and does
not expose any state.

---

## State Preservation

Soroban upgrades replace only the WASM bytecode; all storage is preserved.

| Storage tier | Preserved? | Notes |
|---|---|---|
| Instance | ✅ Yes | `INIT`, `ADMIN`, `TREASURY`, `FEE_BPS`, counters |
| Persistent | ✅ Yes | Posts, profiles, pools, follow graph, likes, blocks |
| Temporary | ✅ Yes (until TTL expires) | Tip cooldown entries |

### Storage layout compatibility

If the new WASM changes the layout of any `#[contracttype]` struct or renames
a `StorageKey` variant, existing storage entries will be **unreadable** by the
new code.  Before deploying a breaking storage change:

1. Audit every `StorageKey` variant for additions, removals, and renames.
2. Audit every `#[contracttype]` struct for field additions or type changes.
3. Add a migration function or deploy a side-car migration contract if needed.

The current contract version does **not** include an on-chain migration helper.
All storage-breaking changes require coordination with the indexer team before
upgrade.

---

## Step-by-Step Runbook

### Prerequisites

- `stellar-cli` 22.8.1 or later
- Admin account alias configured in your stellar-cli keystore
- Funded account with enough XLM for upload and invocation fees

### 1. Build the new WASM

```bash
pnpm build:contracts
```

Artifact location:

```
packages/contracts/contracts/Kovara-contracts/target/wasm32v1-none/release/Kovara_contracts.wasm
```

### 2. Upload the WASM to the ledger

```bash
WASM_HASH=$(stellar contract upload \
  --network testnet \
  --source-account <DEPLOYER_ALIAS> \
  --wasm packages/contracts/contracts/Kovara-contracts/target/wasm32v1-none/release/Kovara_contracts.wasm)

echo "WASM hash: $WASM_HASH"
```

Save `WASM_HASH`.  This hash is what you pass to `upgrade`.

### 3. Invoke the upgrade function

```bash
stellar contract invoke \
  --network testnet \
  --source-account <ADMIN_ALIAS> \
  --id <CONTRACT_ID> \
  -- upgrade \
  --new-wasm-hash "$WASM_HASH"
```

The call will fail with a host error if:
- `WASM_HASH` was not returned by step 2 (hash not in ledger).
- `ADMIN_ALIAS` is not the stored admin address (auth error).
- The contract has not been initialized (panics with `"not initialized"`).

### 4. Verify

```bash
# Any read call proves the new WASM is executing
stellar contract invoke \
  --network testnet \
  --id <CONTRACT_ID> \
  -- get_fee_bps
```

Check for the `ContractUpgraded` event in the transaction result or via:

```bash
stellar events \
  --id <CONTRACT_ID> \
  --network testnet \
  --topic "Kovara, upgraded, v1" \
  --start-ledger <LEDGER_BEFORE_UPGRADE>
```

---

## Verifying a Successful Upgrade

After the transaction confirms, verify that:

1. The `ContractUpgraded` event appears in the committed events for the
   transaction.
2. The `new_wasm_hash` in the event matches the hash printed by
   `stellar contract upload`.
3. Any new contract methods introduced in the upgrade are callable.
4. Existing read methods (`get_profile`, `get_post`, etc.) still return correct
   data — confirming that persistent storage was not corrupted.

---

## Rollback

Soroban does not provide a native rollback for WASM upgrades.  To revert:

1. Re-upload the previous WASM artifact (or use its cached hash if it is still
   in the ledger).
2. Call `upgrade` again with the old WASM hash.

Keep previous WASM artifacts and their hashes in your release notes for exactly
this reason.

---

## Indexer Coordination

After an upgrade that introduces new event types or changes event schemas:

1. Redeploy the indexer with the updated event handlers **before** the new
   events start arriving on-chain.
2. If the upgrade adds new `StorageKey` variants that the indexer reads
   directly, update the indexer's storage-reading logic first.
3. Notify the team before triggering the upgrade on Mainnet so all dependent
   services are ready.

---

## Frequently Asked Questions

**Can I call `upgrade` twice in the same transaction?**

No.  After the first `upgrade` call the WASM is replaced; the second call would
execute against the new code, which may have a different `upgrade` function
signature or different admin stored.  Do not batch multiple upgrade calls.

**What happens if I pass a hash of 32 zero bytes?**

Authorization is checked first.  If the caller is not the admin the call panics
on auth.  If auth passes, the host tries to find a WASM blob matching the
all-zeros hash.  No such blob exists, so the host raises a storage error and
the transaction fails.  No state is changed.

**Does the contract ID change after an upgrade?**

No.  The contract ID is derived from the deployer and a nonce at deployment
time and never changes.  All client references to the contract ID remain valid
after an upgrade.

**Can a non-admin observe the WASM hash of the current contract?**

Yes.  The `stellar contract info` command returns the current WASM hash for any
contract without requiring authentication:

```bash
stellar contract info --id <CONTRACT_ID> --network testnet
```

**What is the `bump_instance` call doing before `require_admin`?**

It extends the TTL of the contract's instance storage so that even a failed
upgrade attempt (wrong auth, bad hash) does not accidentally reduce the
remaining TTL below the threshold.  It has no effect on access control.
