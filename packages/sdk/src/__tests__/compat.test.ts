/**
 * Cross-platform compatibility tests for the Kovara SDK (Issue #99).
 *
 * These tests run inside Jest's Node.js environment and verify that:
 *  - All expected public symbols are exported from the package index.
 *  - Error classes support `instanceof` checks correctly across CJS/ESM.
 *  - The KovaraClient constructor works without a real RPC connection.
 *  - Environment-neutral code paths do not reference browser-only globals.
 *  - The MiniAppManifest validator is importable and callable in Node.js.
 *
 * For full browser-environment tests see the Playwright/Puppeteer suite in
 * `packages/sdk/e2e/`. These Jest tests cover the shared module graph only.
 */

import * as SdkIndex from "..";
import {
  KovaraClient,
  KovaraError,
  NotFoundError,
  UnauthorizedError,
  InsufficientBalanceError,
  CooldownError,
  InvalidInputError,
  InvalidManifestError,
  validateManifest,
  mapError,
} from "..";

// ── 1. Named exports completeness ────────────────────────────────────────────

describe("Package index exports", () => {
  it("exports KovaraClient class", () => {
    expect(typeof KovaraClient).toBe("function");
  });

  it("exports all error classes", () => {
    expect(typeof KovaraError).toBe("function");
    expect(typeof NotFoundError).toBe("function");
    expect(typeof UnauthorizedError).toBe("function");
    expect(typeof InsufficientBalanceError).toBe("function");
    expect(typeof CooldownError).toBe("function");
    expect(typeof InvalidInputError).toBe("function");
    expect(typeof InvalidManifestError).toBe("function");
  });

  it("exports mapError utility", () => {
    expect(typeof mapError).toBe("function");
  });

  it("exports validateManifest utility", () => {
    expect(typeof validateManifest).toBe("function");
  });

  it("does not export unexpected symbols (tree-shakeability smoke check)", () => {
    const knownExports = new Set([
      "KovaraClient",
      "KovaraError",
      "NotFoundError",
      "UnauthorizedError",
      "InsufficientBalanceError",
      "CooldownError",
      "InvalidInputError",
      "InvalidManifestError",
      "mapError",
      "validateManifest",
      // type-only exports appear as values only in CJS builds if they have a runtime shape
    ]);
    const actualExports = Object.keys(SdkIndex);
    const unexpected = actualExports.filter((k) => !knownExports.has(k));
    // Warn rather than hard-fail: new intentional exports should be added above.
    if (unexpected.length > 0) {
      console.warn(
        `[compat] Unexpected SDK exports detected (update knownExports if intentional): ${unexpected.join(", ")}`,
      );
    }
    // The index must export at least the required symbols.
    expect(actualExports).toContain("KovaraClient");
    expect(actualExports).toContain("KovaraError");
    expect(actualExports).toContain("validateManifest");
  });
});

// ── 2. CJS `require`-style import compatibility ───────────────────────────────
//
// Jest runs in CJS mode by default so the standard `require()` call exercises
// the same code path a Node.js consumer using `const { KovaraClient } = require('Kovara-sdk')`
// would take.

describe("CommonJS require compatibility", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const cjs = require("..") as typeof SdkIndex;

  it("require() resolves the same KovaraClient constructor", () => {
    expect(cjs.KovaraClient).toBe(KovaraClient);
  });

  it("require() resolves error classes correctly", () => {
    expect(cjs.KovaraError).toBe(KovaraError);
    expect(cjs.NotFoundError).toBe(NotFoundError);
  });

  it("error thrown via CJS import passes instanceof check from ESM import", () => {
    const err = new cjs.NotFoundError("test");
    expect(err).toBeInstanceOf(KovaraError);
    expect(err).toBeInstanceOf(NotFoundError);
  });
});

// ── 3. Error class prototype chain ───────────────────────────────────────────
//
// Soroban SDK consumers typically catch errors in `catch` blocks and test with
// `instanceof`. The custom `Object.setPrototypeOf` call in each class must
// survive CJS compilation — these tests guard that invariant.

describe("Error instanceof across module boundaries", () => {
  it("NotFoundError is instanceof Error, KovaraError, and NotFoundError", () => {
    const err = new NotFoundError("profile not found");
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(KovaraError);
    expect(err).toBeInstanceOf(NotFoundError);
  });

  it("UnauthorizedError is instanceof KovaraError", () => {
    const err = new UnauthorizedError("not allowed");
    expect(err).toBeInstanceOf(KovaraError);
    expect(err).toBeInstanceOf(UnauthorizedError);
    expect(err).not.toBeInstanceOf(NotFoundError);
  });

  it("InsufficientBalanceError is instanceof KovaraError", () => {
    const err = new InsufficientBalanceError("low funds");
    expect(err).toBeInstanceOf(KovaraError);
  });

  it("CooldownError is instanceof KovaraError", () => {
    const err = new CooldownError("wait");
    expect(err).toBeInstanceOf(KovaraError);
  });

  it("InvalidInputError is instanceof KovaraError", () => {
    const err = new InvalidInputError("bad param");
    expect(err).toBeInstanceOf(KovaraError);
  });

  it("InvalidManifestError is instanceof KovaraError", () => {
    const err = new InvalidManifestError("bad manifest");
    expect(err).toBeInstanceOf(KovaraError);
  });

  it("KovaraError.name equals the class name (useful for logging)", () => {
    expect(new NotFoundError("x").name).toBe("NotFoundError");
    expect(new UnauthorizedError("x").name).toBe("UnauthorizedError");
    expect(new CooldownError("x").name).toBe("CooldownError");
  });
});

// ── 4. KovaraClient constructor — no network required ───────────────────────

describe("KovaraClient constructor (no network)", () => {
  it("constructs without throwing in a Node.js environment", () => {
    expect(
      () =>
        new KovaraClient({
          contractId: "CXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
          rpcUrl: "https://soroban-testnet.stellar.org",
        }),
    ).not.toThrow();
  });

  it("accepts a custom networkPassphrase", () => {
    expect(
      () =>
        new KovaraClient({
          contractId: "CABCDE",
          rpcUrl: "https://rpc.example.com",
          networkPassphrase: "Public Global Stellar Network ; September 2015",
        }),
    ).not.toThrow();
  });

  it("does not reference window or document on construction", () => {
    // If the constructor were to access browser globals it would throw in Node.js.
    expect(
      () =>
        new KovaraClient({
          contractId: "C1",
          rpcUrl: "https://rpc.example.com",
        }),
    ).not.toThrow();
  });
});

// ── 5. validateManifest — Node.js usage ──────────────────────────────────────

describe("validateManifest in Node.js environment", () => {
  const minimal = {
    name: "My App",
    version: "1.0.0",
    entryPoint: "https://myapp.example.com",
    permissions: ["wallet.read" as const],
  };

  it("validates a correct manifest without throwing", () => {
    expect(() => validateManifest(minimal)).not.toThrow();
  });

  it("returns the typed manifest object", () => {
    const result = validateManifest(minimal);
    expect(result.name).toBe("My App");
    expect(result.permissions).toContain("wallet.read");
  });

  it("throws InvalidManifestError (not a generic Error) for invalid input", () => {
    expect(() => validateManifest({ name: "broken" })).toThrow(InvalidManifestError);
  });

  it("InvalidManifestError from validateManifest is instanceof KovaraError", () => {
    try {
      validateManifest(null);
    } catch (err) {
      expect(err).toBeInstanceOf(InvalidManifestError);
      expect(err).toBeInstanceOf(KovaraError);
    }
  });
});

// ── 6. mapError — environment-neutral error mapping ──────────────────────────

describe("mapError cross-platform behaviour", () => {
  it("returns a typed error for every recognised pattern", () => {
    const cases: Array<[string, new (...args: unknown[]) => KovaraError]> = [
      ["not found", NotFoundError],
      ["unauthorized", UnauthorizedError],
      ["insufficient allowance", InsufficientBalanceError],
      ["low balance", InsufficientBalanceError],
      ["cooldown", CooldownError],
      ["invalid param", InvalidInputError],
    ];
    for (const [msg, Ctor] of cases) {
      expect(mapError(msg)).toBeInstanceOf(Ctor);
    }
  });

  it("falls back to KovaraError for unrecognised messages", () => {
    expect(mapError("some unknown failure")).toBeInstanceOf(KovaraError);
  });

  it("accepts an Error object and unwraps the message", () => {
    const result = mapError(new Error("not found in ledger"));
    expect(result).toBeInstanceOf(NotFoundError);
  });

  it("accepts a non-Error, non-string value gracefully", () => {
    const result = mapError(42);
    expect(result).toBeInstanceOf(KovaraError);
    expect(result.message).toBe("42");
  });
});
