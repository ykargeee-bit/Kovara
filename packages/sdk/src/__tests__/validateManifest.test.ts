import { validateManifest, MiniAppManifest } from "..";
import { InvalidManifestError } from "../errors";

const validManifest: MiniAppManifest = {
  name: "Test Mini App",
  version: "1.0.0",
  description: "A description",
  entryPoint: "https://example.com/mini",
  icon: "https://example.com/icon.png",
  permissions: ["wallet.read", "post.create"],
};

describe("validateManifest", () => {
  // ── Happy path ────────────────────────────────────────────────────────────

  it("accepts a fully-populated valid manifest", () => {
    const result = validateManifest(validManifest);
    expect(result).toEqual(validManifest);
  });

  it("accepts a minimal manifest with only required fields", () => {
    const minimal = {
      name: "Min App",
      version: "0.0.1",
      entryPoint: "https://min.example.com",
      permissions: ["wallet.read"],
    };
    expect(validateManifest(minimal)).toEqual(minimal);
  });

  it("accepts all valid permission scopes together", () => {
    const all = {
      ...validManifest,
      permissions: ["wallet.read", "wallet.sign", "profile.read", "post.create"],
    };
    expect(() => validateManifest(all)).not.toThrow();
  });

  it("accepts optional author field", () => {
    const withAuthor = { ...validManifest, author: "Alice" };
    const result = validateManifest(withAuthor);
    expect(result.author).toBe("Alice");
  });

  it("accepts optional homepage field when it is an HTTPS URL", () => {
    const withHomepage = { ...validManifest, homepage: "https://myapp.dev" };
    const result = validateManifest(withHomepage);
    expect(result.homepage).toBe("https://myapp.dev");
  });

  // ── Required fields ───────────────────────────────────────────────────────

  it("throws when name is missing", () => {
    const { name: _n, ...rest } = validManifest;
    expect(() => validateManifest(rest)).toThrow(InvalidManifestError);
  });

  it("throws when version is missing", () => {
    const { version: _v, ...rest } = validManifest;
    expect(() => validateManifest(rest)).toThrow(InvalidManifestError);
  });

  it("throws when entryPoint is missing", () => {
    const { entryPoint: _e, ...rest } = validManifest;
    expect(() => validateManifest(rest)).toThrow(InvalidManifestError);
  });

  it("throws when permissions is missing", () => {
    const { permissions: _p, ...rest } = validManifest;
    expect(() => validateManifest(rest)).toThrow(InvalidManifestError);
  });

  // ── Name constraints ──────────────────────────────────────────────────────

  it("throws when name is empty string", () => {
    expect(() => validateManifest({ ...validManifest, name: "" })).toThrow(InvalidManifestError);
  });

  it("throws when name exceeds 50 characters", () => {
    expect(() =>
      validateManifest({ ...validManifest, name: "A".repeat(51) }),
    ).toThrow(InvalidManifestError);
  });

  it("accepts name at exactly 50 characters", () => {
    expect(() =>
      validateManifest({ ...validManifest, name: "A".repeat(50) }),
    ).not.toThrow();
  });

  // ── Version constraints ───────────────────────────────────────────────────

  it("throws when version does not follow semver format", () => {
    expect(() => validateManifest({ ...validManifest, version: "v1.0" })).toThrow(
      InvalidManifestError,
    );
  });

  it("throws when version has extra labels (e.g. pre-release tags)", () => {
    expect(() =>
      validateManifest({ ...validManifest, version: "1.0.0-beta" }),
    ).toThrow(InvalidManifestError);
  });

  it("accepts a three-part numeric version string", () => {
    expect(() => validateManifest({ ...validManifest, version: "10.20.300" })).not.toThrow();
  });

  // ── entryPoint HTTPS constraint ───────────────────────────────────────────

  it("throws when entryPoint uses HTTP instead of HTTPS", () => {
    expect(() =>
      validateManifest({ ...validManifest, entryPoint: "http://example.com/mini" }),
    ).toThrow(InvalidManifestError);
  });

  it("throws when entryPoint is a relative path", () => {
    expect(() =>
      validateManifest({ ...validManifest, entryPoint: "/mini-app/index.html" }),
    ).toThrow(InvalidManifestError);
  });

  it("throws when entryPoint is not a string", () => {
    expect(() =>
      validateManifest({ ...validManifest, entryPoint: 42 }),
    ).toThrow(InvalidManifestError);
  });

  // ── icon HTTPS constraint (optional field) ────────────────────────────────

  it("throws when icon is present but uses HTTP", () => {
    expect(() =>
      validateManifest({ ...validManifest, icon: "http://example.com/icon.png" }),
    ).toThrow(InvalidManifestError);
  });

  it("accepts manifest with no icon field", () => {
    const { icon: _i, ...rest } = validManifest;
    expect(() => validateManifest(rest)).not.toThrow();
  });

  // ── permissions constraints ───────────────────────────────────────────────

  it("throws when permissions is empty", () => {
    expect(() => validateManifest({ ...validManifest, permissions: [] })).toThrow(
      InvalidManifestError,
    );
  });

  it("throws when permissions contains an unrecognised scope", () => {
    expect(() =>
      validateManifest({ ...validManifest, permissions: ["wallet.read", "data.export"] }),
    ).toThrow(InvalidManifestError);
  });

  it("throws when permissions contains duplicate entries", () => {
    expect(() =>
      validateManifest({ ...validManifest, permissions: ["wallet.read", "wallet.read"] }),
    ).toThrow(InvalidManifestError);
  });

  // ── author constraints (optional) ─────────────────────────────────────────

  it("throws when author is present but empty", () => {
    expect(() => validateManifest({ ...validManifest, author: "" })).toThrow(InvalidManifestError);
  });

  it("throws when author exceeds 100 characters", () => {
    expect(() =>
      validateManifest({ ...validManifest, author: "A".repeat(101) }),
    ).toThrow(InvalidManifestError);
  });

  // ── homepage constraints (optional) ──────────────────────────────────────

  it("throws when homepage uses HTTP", () => {
    expect(() =>
      validateManifest({ ...validManifest, homepage: "http://myapp.dev" }),
    ).toThrow(InvalidManifestError);
  });

  // ── additionalProperties ──────────────────────────────────────────────────

  it("throws when manifest has unknown extra properties", () => {
    expect(() =>
      validateManifest({ ...validManifest, unknownField: "value" }),
    ).toThrow(InvalidManifestError);
  });

  // ── type guards ───────────────────────────────────────────────────────────

  it("throws when manifest is null", () => {
    expect(() => validateManifest(null)).toThrow(InvalidManifestError);
  });

  it("throws when manifest is a string", () => {
    expect(() => validateManifest("not-an-object")).toThrow(InvalidManifestError);
  });

  it("throws when manifest is an array", () => {
    expect(() => validateManifest([])).toThrow(InvalidManifestError);
  });

  // ── error instance check ──────────────────────────────────────────────────

  it("error message includes the violated field name", () => {
    try {
      validateManifest({ ...validManifest, version: "bad" });
    } catch (err) {
      expect(err).toBeInstanceOf(InvalidManifestError);
      expect((err as Error).message).toMatch(/version/);
    }
  });
});
