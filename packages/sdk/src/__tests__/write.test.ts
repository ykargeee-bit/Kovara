import { LinkoraClient } from "../client";

const mockCall = jest.fn();
const mockBuild = jest.fn();
const mockToEnvelope = jest.fn();
const mockToXDR = jest.fn();
const mockAddOperation = jest.fn();
const mockSetTimeout = jest.fn();

jest.mock("@stellar/stellar-sdk", () => ({
  rpc: {
    Server: jest.fn(),
    Api: {
      isSimulationError: jest.fn(),
      isSimulationSuccess: jest.fn(),
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
  scValToNative: jest.fn(),
  TransactionBuilder: jest.fn(() => ({
    addOperation: mockAddOperation,
  })),
  Account: jest.fn(),
  Keypair: {
    random: jest.fn(() => ({
      publicKey: () => "GWRITEKEYXXXXXXXXXXXXXXXXXXXXXXXXXX",
    })),
  },
  xdr: {},
}));

describe("LinkoraClient write methods", () => {
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

  describe("createPost", () => {
    it("builds an XDR envelope for creating a post", () => {
      const xdr = client.createPost("GAUTHOR", "Hello world");

      expect(mockCall).toHaveBeenCalledWith(
        "create_post",
        expect.objectContaining({ _val: "GAUTHOR" }),
        expect.objectContaining({ _val: "Hello world" })
      );
      expect(xdr).toBe("AAAAfakexdrbase64encodedstring");
    });
  });

  describe("deletePost", () => {
    it("builds an XDR envelope for deleting a post", () => {
      const xdr = client.deletePost("GAUTHOR", 42);

      expect(mockCall).toHaveBeenCalledWith(
        "delete_post",
        expect.objectContaining({ _val: "GAUTHOR" }),
        expect.objectContaining({ _val: 42 })
      );
      expect(xdr).toBe("AAAAfakexdrbase64encodedstring");
    });
  });

  describe("follow", () => {
    it("builds an XDR envelope for following a user", () => {
      const xdr = client.follow("GFOLLOWER", "GTOFOLLOW");

      expect(mockCall).toHaveBeenCalledWith(
        "follow",
        expect.objectContaining({ _val: "GFOLLOWER" }),
        expect.objectContaining({ _val: "GTOFOLLOW" })
      );
      expect(xdr).toBe("AAAAfakexdrbase64encodedstring");
    });
  });

  describe("unfollow", () => {
    it("builds an XDR envelope for unfollowing a user", () => {
      const xdr = client.unfollow("GFOLLOWER", "GTOUNFOLLOW");

      expect(mockCall).toHaveBeenCalledWith(
        "unfollow",
        expect.objectContaining({ _val: "GFOLLOWER" }),
        expect.objectContaining({ _val: "GTOUNFOLLOW" })
      );
      expect(xdr).toBe("AAAAfakexdrbase64encodedstring");
    });
  });

  describe("like", () => {
    it("builds an XDR envelope for liking a post", () => {
      const xdr = client.like("GLIKER", 7);

      expect(mockCall).toHaveBeenCalledWith(
        "like",
        expect.objectContaining({ _val: "GLIKER" }),
        expect.objectContaining({ _val: 7 })
      );
      expect(xdr).toBe("AAAAfakexdrbase64encodedstring");
    });
  });

  describe("unlike", () => {
    it("builds an XDR envelope for unliking a post", () => {
      const xdr = client.unlike("GLIKER", 7);

      expect(mockCall).toHaveBeenCalledWith(
        "unlike",
        expect.objectContaining({ _val: "GLIKER" }),
        expect.objectContaining({ _val: 7 })
      );
      expect(xdr).toBe("AAAAfakexdrbase64encodedstring");
    });
  });

  describe("tip", () => {
    it("builds an XDR envelope for tipping a post", () => {
      const xdr = client.tip("GSENDER", 3, 500);

      expect(mockCall).toHaveBeenCalledWith(
        "tip",
        expect.objectContaining({ _val: "GSENDER" }),
        expect.objectContaining({ _val: 3 }),
        expect.objectContaining({ _val: 500 })
      );
      expect(xdr).toBe("AAAAfakexdrbase64encodedstring");
    });

    it("accepts a bigint amount", () => {
      const xdr = client.tip("GSENDER", 3, 1000n);

      expect(mockCall).toHaveBeenCalledWith(
        "tip",
        expect.anything(),
        expect.anything(),
        expect.objectContaining({ _val: 1000n })
      );
      expect(xdr).toBe("AAAAfakexdrbase64encodedstring");
    });
  });

  describe("createPool", () => {
    it("builds an XDR envelope for creating a pool", () => {
      const xdr = client.createPool("GADMIN", "TOKEN", ["GA", "GB"], 2);

      expect(mockCall).toHaveBeenCalledWith(
        "create_pool",
        expect.objectContaining({ _val: "GADMIN" }),
        expect.objectContaining({ _val: "TOKEN" }),
        expect.objectContaining({
          _val: [expect.objectContaining({ _val: "GA" }), expect.objectContaining({ _val: "GB" })],
        }),
        expect.objectContaining({ _val: 2 })
      );
      expect(xdr).toBe("AAAAfakexdrbase64encodedstring");
    });
  });

  describe("deposit", () => {
    it("builds an XDR envelope for depositing into a pool", () => {
      const xdr = client.deposit("GDEPOSITOR", "pool-1", "TOKEN", 1000);

      expect(mockCall).toHaveBeenCalledWith(
        "deposit",
        expect.objectContaining({ _val: "GDEPOSITOR" }),
        expect.objectContaining({ _val: "pool-1" }),
        expect.objectContaining({ _val: "TOKEN" }),
        expect.objectContaining({ _val: 1000 })
      );
      expect(xdr).toBe("AAAAfakexdrbase64encodedstring");
    });
  });

  describe("withdraw", () => {
    it("builds an XDR envelope for withdrawing from a pool", () => {
      const xdr = client.withdraw(["GA", "GB"], "pool-1", 500, "GRECIPIENT");

      expect(mockCall).toHaveBeenCalledWith(
        "withdraw",
        expect.objectContaining({
          _val: [expect.objectContaining({ _val: "GA" }), expect.objectContaining({ _val: "GB" })],
        }),
        expect.objectContaining({ _val: "pool-1" }),
        expect.objectContaining({ _val: 500 }),
        expect.objectContaining({ _val: "GRECIPIENT" })
      );
      expect(xdr).toBe("AAAAfakexdrbase64encodedstring");
    });
  });

  describe("block", () => {
    it("builds an XDR envelope for blocking a user", () => {
      const xdr = client.block("GBLOCKER", "GBLOCKED");

      expect(mockCall).toHaveBeenCalledWith(
        "block",
        expect.objectContaining({ _val: "GBLOCKER" }),
        expect.objectContaining({ _val: "GBLOCKED" })
      );
      expect(xdr).toBe("AAAAfakexdrbase64encodedstring");
    });
  });

  describe("unblock", () => {
    it("builds an XDR envelope for unblocking a user", () => {
      const xdr = client.unblock("GBLOCKER", "GBLOCKED");

      expect(mockCall).toHaveBeenCalledWith(
        "unblock",
        expect.objectContaining({ _val: "GBLOCKER" }),
        expect.objectContaining({ _val: "GBLOCKED" })
      );
      expect(xdr).toBe("AAAAfakexdrbase64encodedstring");
    });
  });
});
