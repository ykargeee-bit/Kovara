import {
  LinkoraError,
  NotFoundError,
  UnauthorizedError,
  InsufficientBalanceError,
  CooldownError,
  InvalidInputError,
  mapError,
} from "../errors";

describe("Error classes", () => {
  it("LinkoraError sets name and message correctly", () => {
    const err = new LinkoraError("Something went wrong");
    expect(err.message).toBe("Something went wrong");
    expect(err.name).toBe("LinkoraError");
    expect(err.originalError).toBeUndefined();
  });

  it("LinkoraError preserves original error", () => {
    const original = new Error("network failure");
    const err = new LinkoraError("SDK error", original);
    expect(err.originalError).toBe(original);
  });

  it("NotFoundError is an instance of LinkoraError", () => {
    const err = new NotFoundError("not found");
    expect(err).toBeInstanceOf(LinkoraError);
    expect(err).toBeInstanceOf(NotFoundError);
    expect(err.name).toBe("NotFoundError");
  });

  it("UnauthorizedError is an instance of LinkoraError", () => {
    const err = new UnauthorizedError("unauthorized");
    expect(err).toBeInstanceOf(LinkoraError);
    expect(err).toBeInstanceOf(UnauthorizedError);
  });

  it("InsufficientBalanceError is an instance of LinkoraError", () => {
    const err = new InsufficientBalanceError("low balance");
    expect(err).toBeInstanceOf(LinkoraError);
    expect(err).toBeInstanceOf(InsufficientBalanceError);
  });

  it("CooldownError is an instance of LinkoraError", () => {
    const err = new CooldownError("cooldown active");
    expect(err).toBeInstanceOf(LinkoraError);
    expect(err).toBeInstanceOf(CooldownError);
  });

  it("InvalidInputError is an instance of LinkoraError", () => {
    const err = new InvalidInputError("bad input");
    expect(err).toBeInstanceOf(LinkoraError);
    expect(err).toBeInstanceOf(InvalidInputError);
  });

  it("supports instanceof checks in compiled output", () => {
    const err = new NotFoundError("test");
    expect(Object.getPrototypeOf(err)).toBe(NotFoundError.prototype);
  });
});

describe("mapError", () => {
  describe("NotFoundError", () => {
    it("matches 'not found'", () => {
      const result = mapError("resource not found");
      expect(result).toBeInstanceOf(NotFoundError);
      expect(result.message).toBe("The requested resource was not found.");
    });

    it("matches 'does not exist'", () => {
      const result = mapError("post does not exist");
      expect(result).toBeInstanceOf(NotFoundError);
    });

    it("preserves the original error", () => {
      const original = new Error("not found");
      const result = mapError(original);
      expect(result).toBeInstanceOf(NotFoundError);
      expect((result as NotFoundError).originalError).toBe(original);
    });
  });

  describe("UnauthorizedError", () => {
    it("matches 'unauthorized'", () => {
      const result = mapError("unauthorized action");
      expect(result).toBeInstanceOf(UnauthorizedError);
      expect(result.message).toBe("Unauthorized operation. You do not have permission.");
    });

    it("matches 'not admin'", () => {
      const result = mapError("only admin can call this");
      expect(result).toBeInstanceOf(UnauthorizedError);
    });

    it("matches 'only author'", () => {
      const result = mapError("only author can edit");
      expect(result).toBeInstanceOf(UnauthorizedError);
    });

    it("matches 'blocked'", () => {
      const result = mapError("user has blocked you");
      expect(result).toBeInstanceOf(UnauthorizedError);
      expect(result.message).toBe("Operation rejected: user has blocked you.");
    });
  });

  describe("InsufficientBalanceError", () => {
    it("matches 'insufficient allowance'", () => {
      const result = mapError("insufficient allowance");
      expect(result).toBeInstanceOf(InsufficientBalanceError);
      expect(result.message).toBe("Insufficient allowance to complete transaction.");
    });

    it("matches 'low balance'", () => {
      const result = mapError("low balance");
      expect(result).toBeInstanceOf(InsufficientBalanceError);
      expect(result.message).toBe("Insufficient account balance for this transaction.");
    });

    it("matches 'insufficient balance'", () => {
      const result = mapError("insufficient balance");
      expect(result).toBeInstanceOf(InsufficientBalanceError);
    });
  });

  describe("CooldownError", () => {
    it("matches 'cooldown'", () => {
      const result = mapError("cooldown period not expired");
      expect(result).toBeInstanceOf(CooldownError);
      expect(result.message).toBe("Tipping cooldown has not expired yet.");
    });
  });

  describe("InvalidInputError", () => {
    it("matches 'invalid'", () => {
      const result = mapError("invalid username");
      expect(result).toBeInstanceOf(InvalidInputError);
      expect(result.message).toContain("invalid username");
    });

    it("matches 'too long'", () => {
      const result = mapError("content too long");
      expect(result).toBeInstanceOf(InvalidInputError);
    });

    it("matches 'must be positive'", () => {
      const result = mapError("amount must be positive");
      expect(result).toBeInstanceOf(InvalidInputError);
    });

    it("matches 'cannot exceed'", () => {
      const result = mapError("amount cannot exceed limit");
      expect(result).toBeInstanceOf(InvalidInputError);
    });
  });

  describe("default fallback", () => {
    it("returns a generic LinkoraError for unknown errors", () => {
      const result = mapError("something unexpected happened");
      expect(result).toBeInstanceOf(LinkoraError);
      expect(result).not.toBeInstanceOf(NotFoundError);
      expect(result.message).toBe("something unexpected happened");
    });

    it("handles Error objects", () => {
      const error = new Error("custom runtime error");
      const result = mapError(error);
      expect(result).toBeInstanceOf(LinkoraError);
      expect(result.message).toBe("custom runtime error");
    });
  });
});
