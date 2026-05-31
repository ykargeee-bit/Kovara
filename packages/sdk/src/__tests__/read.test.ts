import { LinkoraClient } from "../client";
import { Profile, Post, Pool } from "../types";

const mockSimulate = jest.fn();
const mockCall = jest.fn();
const mockBuild = jest.fn();
const mockToEnvelope = jest.fn();
const mockToXDR = jest.fn();
const mockAddOperation = jest.fn();
const mockSetTimeout = jest.fn();

jest.mock("@stellar/stellar-sdk", () => ({
  rpc: {
    Server: jest.fn(() => ({
      simulateTransaction: mockSimulate,
    })),
    Api: {
      isSimulationError: (r: unknown) => !!(r as { error?: unknown }).error,
      isSimulationSuccess: (r: unknown) => !!(r as { result?: unknown }).result,
    },
  },
  Contract: jest.fn(() => ({
    call: mockCall,
  })),
  nativeToScVal: jest.fn((val: unknown, opts?: unknown) => ({
    _type: "scval",
    _val: val,
    _opts: opts,
  })),
  scValToNative: jest.fn((scv: unknown) => {
    const v = (scv as { _val: unknown })._val;
    if (typeof v === "object" && v !== null && "_type" in (v as object)) {
      return (v as { _val: unknown })._val;
    }
    return v;
  }),
  TransactionBuilder: jest.fn(() => ({
    addOperation: mockAddOperation,
  })),
  Account: jest.fn(),
  Keypair: {
    random: jest.fn(() => ({
      publicKey: () => "GDUMMYKEYPAIRXXXXXXXXXXXXXXXXXXXXXX",
    })),
  },
  xdr: {},
}));

describe("LinkoraClient read methods", () => {
  let client: LinkoraClient;

  beforeEach(() => {
    jest.clearAllMocks();
    client = new LinkoraClient({
      contractId: "CDUMMYCONTRACTXXXXXXXXXXXXXXXXXXXXXXXXXXX",
      rpcUrl: "https://dummy-rpc.example.com",
    });

    mockAddOperation.mockReturnValue({ setTimeout: mockSetTimeout });
    mockSetTimeout.mockReturnValue({ build: mockBuild });
    mockBuild.mockReturnValue({
      toEnvelope: mockToEnvelope,
    });
    mockToEnvelope.mockReturnValue({
      toXDR: mockToXDR,
    });
    mockToXDR.mockReturnValue("AAAAfakexdrbase64encodedstring");
  });

  function mockSuccessResult(retval: unknown) {
    mockSimulate.mockResolvedValue({
      result: { retval: { _type: "scval", _val: retval } },
    });
  }

  function mockNotFound() {
    mockSimulate.mockResolvedValue({ result: null });
  }

  function mockError(msg: string) {
    mockSimulate.mockResolvedValue({ error: msg });
  }

  describe("getProfile", () => {
    it("returns a profile when the contract responds", async () => {
      const profile: Profile = {
        address: "GCKFBEIYTKP6RCZNVPH73XL7XFWTEOAO4MKONX7HOILHDVBMW5EVPOPZ",
        username: "alice",
        creator_token: "TOKEN1",
        follower_count: 42,
        following_count: 10,
      };
      mockSuccessResult(profile);

      const result = await client.getProfile(
        "GCKFBEIYTKP6RCZNVPH73XL7XFWTEOAO4MKONX7HOILHDVBMW5EVPOPZ"
      );

      expect(mockCall).toHaveBeenCalledWith(
        "get_profile",
        expect.objectContaining({
          _val: "GCKFBEIYTKP6RCZNVPH73XL7XFWTEOAO4MKONX7HOILHDVBMW5EVPOPZ",
        })
      );
      expect(result).toEqual(profile);
    });

    it("returns null when profile is not found", async () => {
      mockNotFound();
      const result = await client.getProfile(
        "GCKFBEIYTKP6RCZNVPH73XL7XFWTEOAO4MKONX7HOILHDVBMW5EVPOPZ"
      );
      expect(result).toBeNull();
    });

    it("throws a mapped error on simulation failure", async () => {
      mockError("not found");
      await expect(client.getProfile("GABCDEF123")).rejects.toThrow(
        "The requested resource was not found."
      );
    });
  });

  describe("getPost", () => {
    it("returns a post when found", async () => {
      const post: Post = {
        id: 1,
        author: "GAUTHOR",
        username: "bob",
        content: "Hello world",
        tip_total: 100,
        timestamp: 1234567890,
        like_count: 5,
      };
      mockSuccessResult(post);

      const result = await client.getPost(1);
      expect(mockCall).toHaveBeenCalledWith("get_post", expect.objectContaining({ _val: 1 }));
      expect(result).toEqual(post);
    });

    it("returns null when post does not exist", async () => {
      mockNotFound();
      const result = await client.getPost(999);
      expect(result).toBeNull();
    });
  });

  describe("getPostCount", () => {
    it("returns the post count", async () => {
      mockSuccessResult(42);
      const result = await client.getPostCount();
      expect(mockCall).toHaveBeenCalledWith("get_post_count");
      expect(result).toBe(42);
    });

    it("returns 0 when the result is null", async () => {
      mockNotFound();
      const result = await client.getPostCount();
      expect(result).toBe(0);
    });
  });

  describe("getFollowing", () => {
    it("returns a list of addresses", async () => {
      const addresses = ["GA", "GB", "GC"];
      mockSuccessResult(addresses);
      const result = await client.getFollowing("GUSER");
      expect(mockCall).toHaveBeenCalledWith(
        "get_following",
        expect.objectContaining({ _val: "GUSER" })
      );
      expect(result).toEqual(addresses);
    });

    it("returns empty array when null", async () => {
      mockNotFound();
      const result = await client.getFollowing("GUSER");
      expect(result).toEqual([]);
    });
  });

  describe("getFollowers", () => {
    it("returns a list of addresses", async () => {
      const addresses = ["GX", "GY"];
      mockSuccessResult(addresses);
      const result = await client.getFollowers("GUSER");
      expect(mockCall).toHaveBeenCalledWith(
        "get_followers",
        expect.objectContaining({ _val: "GUSER" })
      );
      expect(result).toEqual(addresses);
    });

    it("returns empty array when null", async () => {
      mockNotFound();
      const result = await client.getFollowers("GUSER");
      expect(result).toEqual([]);
    });
  });

  describe("getPool", () => {
    it("returns a pool when found", async () => {
      const pool: Pool = {
        pool_id: "pool-1",
        token: "TOKEN",
        balance: 1000n,
        admins: ["GA", "GB"],
        threshold: 2,
      };
      mockSuccessResult(pool);
      const result = await client.getPool("pool-1");
      expect(mockCall).toHaveBeenCalledWith(
        "get_pool",
        expect.objectContaining({ _val: "pool-1" })
      );
      expect(result).toEqual(pool);
    });

    it("returns null when pool does not exist", async () => {
      mockNotFound();
      const result = await client.getPool("pool-missing");
      expect(result).toBeNull();
    });
  });

  describe("getPoolAdmins", () => {
    it("returns admin addresses", async () => {
      const admins = ["GA", "GB", "GC"];
      mockSuccessResult(admins);
      const result = await client.getPoolAdmins("pool-1");
      expect(mockCall).toHaveBeenCalledWith(
        "get_pool_admins",
        expect.objectContaining({ _val: "pool-1" })
      );
      expect(result).toEqual(admins);
    });

    it("returns empty array when null", async () => {
      mockNotFound();
      const result = await client.getPoolAdmins("pool-1");
      expect(result).toEqual([]);
    });
  });

  describe("getFeeBps", () => {
    it("returns the fee in basis points", async () => {
      mockSuccessResult(250);
      const result = await client.getFeeBps();
      expect(mockCall).toHaveBeenCalledWith("get_fee_bps");
      expect(result).toBe(250);
    });

    it("returns 0 when null", async () => {
      mockNotFound();
      const result = await client.getFeeBps();
      expect(result).toBe(0);
    });
  });

  describe("getTreasury", () => {
    it("returns the treasury address", async () => {
      mockSuccessResult("GTREASURY");
      const result = await client.getTreasury();
      expect(mockCall).toHaveBeenCalledWith("get_treasury");
      expect(result).toBe("GTREASURY");
    });

    it("returns empty string when null", async () => {
      mockNotFound();
      const result = await client.getTreasury();
      expect(result).toBe("");
    });
  });

  describe("hasLiked", () => {
    it("returns true when liked", async () => {
      mockSuccessResult(true);
      const result = await client.hasLiked("GUSER", 5);
      expect(mockCall).toHaveBeenCalledWith(
        "has_liked",
        expect.objectContaining({ _val: "GUSER" }),
        expect.objectContaining({ _val: 5 })
      );
      expect(result).toBe(true);
    });

    it("returns false when not liked", async () => {
      mockSuccessResult(false);
      const result = await client.hasLiked("GUSER", 5);
      expect(result).toBe(false);
    });

    it("returns false when null", async () => {
      mockNotFound();
      const result = await client.hasLiked("GUSER", 5);
      expect(result).toBe(false);
    });
  });

  describe("isBlocked", () => {
    it("returns true when blocked", async () => {
      mockSuccessResult(true);
      const result = await client.isBlocked("GBLOCKER", "GBLOCKED");
      expect(mockCall).toHaveBeenCalledWith(
        "is_blocked",
        expect.objectContaining({ _val: "GBLOCKER" }),
        expect.objectContaining({ _val: "GBLOCKED" })
      );
      expect(result).toBe(true);
    });

    it("returns false when not blocked", async () => {
      mockSuccessResult(false);
      const result = await client.isBlocked("GBLOCKER", "GBLOCKED");
      expect(result).toBe(false);
    });
  });

  describe("getLikeCount", () => {
    it("returns the like count", async () => {
      mockSuccessResult(10);
      const result = await client.getLikeCount(3);
      expect(mockCall).toHaveBeenCalledWith("get_like_count", expect.objectContaining({ _val: 3 }));
      expect(result).toBe(10);
    });

    it("returns 0 when null", async () => {
      mockNotFound();
      const result = await client.getLikeCount(3);
      expect(result).toBe(0);
    });
  });
});
