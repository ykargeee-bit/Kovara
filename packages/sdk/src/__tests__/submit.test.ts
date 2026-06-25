/**
 * Tests for the sign-and-submit (keypair) overloads of KovaraClient write methods.
 * Covers issue #93 (SDK tests) and verifies the real wallet integration from issue #94.
 */

import { KovaraClient } from "../client";
import * as sdk from "@stellar/stellar-sdk";

const FAKE_XDR = "AAAAfakexdrbase64encodedstring";
const FAKE_HASH = "deadbeef1234";

// Duck-typed keypair — isKeypair() only checks for a .sign method.
const fakeKeypair = { sign: jest.fn() };

jest.mock("@stellar/stellar-sdk", () => {
  const addOperation = jest.fn();
  const setTimeout = jest.fn();
  const build = jest.fn();
  const toEnvelope = jest.fn();
  const toXDR = jest.fn();

  const MockBuilder = jest.fn(() => ({ addOperation })) as jest.Mock & { fromXDR: jest.Mock };
  MockBuilder.fromXDR = jest.fn();

  // Wire the TransactionBuilder chain so buildTx() returns a base64 XDR string.
  addOperation.mockReturnValue({ setTimeout });
  setTimeout.mockReturnValue({ build });
  build.mockReturnValue({ toEnvelope });
  toEnvelope.mockReturnValue({ toXDR });
  toXDR.mockReturnValue("AAAAfakexdrbase64encodedstring");

  return {
    rpc: {
      Server: jest.fn(() => ({
        simulateTransaction: jest.fn(),
        prepareTransaction: jest.fn(),
        sendTransaction: jest.fn(),
        getTransaction: jest.fn(),
      })),
      Api: {
        isSimulationError: (r: unknown) => !!(r as { error?: unknown }).error,
        isSimulationSuccess: (r: unknown) => !!(r as { result?: unknown }).result,
        GetTransactionStatus: {
          NOT_FOUND: "NOT_FOUND",
          FAILED: "FAILED",
          SUCCESS: "SUCCESS",
        },
      },
    },
    Contract: jest.fn(() => ({ call: jest.fn() })),
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
    TransactionBuilder: MockBuilder,
    Account: jest.fn(),
    Keypair: {
      random: jest.fn(() => ({ publicKey: () => "GDUMMY", sign: jest.fn() })),
    },
    Transaction: jest.fn(),
    xdr: {},
  };
});

/** Helper to get the server instance created by the last KovaraClient constructor */
function getServerInstance() {
  const ServerMock = sdk.rpc.Server as unknown as jest.MockedClass<typeof sdk.rpc.Server>;
  return ServerMock.mock.results[ServerMock.mock.results.length - 1]?.value as {
    simulateTransaction: jest.Mock;
    prepareTransaction: jest.Mock;
    sendTransaction: jest.Mock;
    getTransaction: jest.Mock;
  };
}

function getContractInstance() {
  const ContractMock = sdk.Contract as unknown as jest.MockedClass<typeof sdk.Contract>;
  return ContractMock.mock.results[ContractMock.mock.results.length - 1]?.value as {
    call: jest.Mock;
  };
}

describe("KovaraClient submit (sign-and-submit) methods", () => {
  let client: KovaraClient;
  let server: ReturnType<typeof getServerInstance>;
  let preparedTx: { sign: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();

    // Re-wire the builder chain after clearAllMocks()
    const MockBuilder = sdk.TransactionBuilder as unknown as jest.Mock & { fromXDR: jest.Mock };
    const addOperation = jest.fn();
    const setTimeoutFn = jest.fn();
    const build = jest.fn();
    const toEnvelope = jest.fn();
    const toXDR = jest.fn();
    MockBuilder.mockImplementation(() => ({ addOperation }));
    addOperation.mockReturnValue({ setTimeout: setTimeoutFn });
    setTimeoutFn.mockReturnValue({ build });
    build.mockReturnValue({ toEnvelope });
    toEnvelope.mockReturnValue({ toXDR });
    toXDR.mockReturnValue(FAKE_XDR);

    // KovaraClient creates its own rpc.Server on each call, but the constructor
    // call in new KovaraClient() just stores config; Server is created per-call.
    client = new KovaraClient({
      contractId: "CDUMMYCONTRACTXXXXXXXXXXXXXXXXXXXXXXXXXXX",
      rpcUrl: "https://dummy-rpc.example.com",
    });

    // Set up Server mock for the next call
    preparedTx = { sign: jest.fn() };
    (sdk.rpc.Server as unknown as jest.Mock).mockImplementation(() => ({
      simulateTransaction: jest.fn().mockResolvedValue({
        result: { retval: { _type: "scval", _val: 5 } },
      }),
      prepareTransaction: jest.fn().mockResolvedValue(preparedTx),
      sendTransaction: jest.fn().mockResolvedValue({ status: "PENDING", hash: FAKE_HASH }),
      getTransaction: jest.fn().mockResolvedValue({ status: "SUCCESS" }),
    }));
  });

  describe("submitTx", () => {
    it("prepares, signs, and sends the transaction", async () => {
      const MockBuilder = sdk.TransactionBuilder as unknown as jest.Mock & { fromXDR: jest.Mock };
      MockBuilder.fromXDR = jest.fn().mockReturnValue({ sign: jest.fn() });

      const result = await client.submitTx(fakeKeypair as never, FAKE_XDR);

      expect(MockBuilder.fromXDR).toHaveBeenCalledWith(FAKE_XDR, expect.any(String));
      server = getServerInstance();
      expect(server.prepareTransaction).toHaveBeenCalled();
      expect(preparedTx.sign).toHaveBeenCalledWith(fakeKeypair);
      expect(server.sendTransaction).toHaveBeenCalled();
      expect(result).toEqual({ txHash: FAKE_HASH });
    });

    it("polls until transaction is no longer NOT_FOUND", async () => {
      const MockBuilder = sdk.TransactionBuilder as unknown as jest.Mock & { fromXDR: jest.Mock };
      MockBuilder.fromXDR = jest.fn().mockReturnValue({ sign: jest.fn() });

      (sdk.rpc.Server as unknown as jest.Mock).mockImplementation(() => ({
        simulateTransaction: jest.fn(),
        prepareTransaction: jest.fn().mockResolvedValue(preparedTx),
        sendTransaction: jest.fn().mockResolvedValue({ status: "PENDING", hash: FAKE_HASH }),
        getTransaction: jest
          .fn()
          .mockResolvedValueOnce({ status: "NOT_FOUND" })
          .mockResolvedValueOnce({ status: "SUCCESS" }),
      }));

      const result = await client.submitTx(fakeKeypair as never, FAKE_XDR);
      server = getServerInstance();
      expect(server.getTransaction).toHaveBeenCalledTimes(2);
      expect(result.txHash).toBe(FAKE_HASH);
    });

    it("throws when sendTransaction returns ERROR status", async () => {
      const MockBuilder = sdk.TransactionBuilder as unknown as jest.Mock & { fromXDR: jest.Mock };
      MockBuilder.fromXDR = jest.fn().mockReturnValue({ sign: jest.fn() });

      (sdk.rpc.Server as unknown as jest.Mock).mockImplementation(() => ({
        simulateTransaction: jest.fn(),
        prepareTransaction: jest.fn().mockResolvedValue(preparedTx),
        sendTransaction: jest.fn().mockResolvedValue({
          status: "ERROR",
          errorResult: { result: () => "host invocation failed" },
        }),
        getTransaction: jest.fn(),
      }));

      await expect(client.submitTx(fakeKeypair as never, FAKE_XDR)).rejects.toThrow();
    });

    it("throws when transaction fails on-chain", async () => {
      const MockBuilder = sdk.TransactionBuilder as unknown as jest.Mock & { fromXDR: jest.Mock };
      MockBuilder.fromXDR = jest.fn().mockReturnValue({ sign: jest.fn() });

      (sdk.rpc.Server as unknown as jest.Mock).mockImplementation(() => ({
        simulateTransaction: jest.fn(),
        prepareTransaction: jest.fn().mockResolvedValue(preparedTx),
        sendTransaction: jest.fn().mockResolvedValue({ status: "PENDING", hash: FAKE_HASH }),
        getTransaction: jest.fn().mockResolvedValue({ status: "FAILED" }),
      }));

      await expect(client.submitTx(fakeKeypair as never, FAKE_XDR)).rejects.toThrow(
        "Transaction failed on-chain"
      );
    });
  });

  // For the remaining write-method tests we just need to ensure:
  // 1. The correct contract method is called with the right args (via Contract.call mock)
  // 2. submitTx is invoked and returns { txHash }

  function wireSubmit() {
    const MockBuilder = sdk.TransactionBuilder as unknown as jest.Mock & { fromXDR: jest.Mock };
    MockBuilder.fromXDR = jest.fn().mockReturnValue({ sign: jest.fn() });
  }

  describe("createPost with keypair", () => {
    it("builds, submits, and returns txHash + postId", async () => {
      wireSubmit();
      const contract = getContractInstance() ?? { call: jest.fn() };
      (sdk.Contract as unknown as jest.Mock).mockImplementation(() => contract);

      const result = await client.createPost(fakeKeypair as never, "GAUTHOR", {
        author: "GAUTHOR",
        content: "Hello",
      });

      expect(result.txHash).toBe(FAKE_HASH);
      expect(typeof result.postId).toBe("number");
    });
  });

  describe("setProfile with keypair", () => {
    it("builds and submits set_profile", async () => {
      wireSubmit();
      const callMock = jest.fn();
      (sdk.Contract as unknown as jest.Mock).mockImplementation(() => ({ call: callMock }));

      const result = await client.setProfile(fakeKeypair as never, "GUSER", {
        user: "GUSER",
        username: "alice",
        creator_token: "GTOKEN",
      });

      expect(callMock).toHaveBeenCalledWith(
        "set_profile",
        expect.objectContaining({ _val: "GUSER" }),
        expect.objectContaining({ _val: "alice" }),
        expect.objectContaining({ _val: "GTOKEN" })
      );
      expect(result).toEqual({ txHash: FAKE_HASH });
    });
  });

  describe("deletePost with keypair", () => {
    it("builds and submits delete_post", async () => {
      wireSubmit();
      const callMock = jest.fn();
      (sdk.Contract as unknown as jest.Mock).mockImplementation(() => ({ call: callMock }));

      const result = await client.deletePost(fakeKeypair as never, "GAUTHOR", 10);

      expect(callMock).toHaveBeenCalledWith(
        "delete_post",
        expect.objectContaining({ _val: "GAUTHOR" }),
        expect.objectContaining({ _val: 10 })
      );
      expect(result).toEqual({ txHash: FAKE_HASH });
    });
  });

  describe("follow with keypair", () => {
    it("builds and submits follow", async () => {
      wireSubmit();
      const callMock = jest.fn();
      (sdk.Contract as unknown as jest.Mock).mockImplementation(() => ({ call: callMock }));

      const result = await client.follow(fakeKeypair as never, "GFOLLOWER", "GFOLLOWED");

      expect(callMock).toHaveBeenCalledWith(
        "follow",
        expect.objectContaining({ _val: "GFOLLOWER" }),
        expect.objectContaining({ _val: "GFOLLOWED" })
      );
      expect(result).toEqual({ txHash: FAKE_HASH });
    });
  });

  describe("unfollow with keypair", () => {
    it("builds and submits unfollow", async () => {
      wireSubmit();
      const callMock = jest.fn();
      (sdk.Contract as unknown as jest.Mock).mockImplementation(() => ({ call: callMock }));

      const result = await client.unfollow(fakeKeypair as never, "GFOLLOWER", "GFOLLOWED");
      expect(callMock).toHaveBeenCalledWith("unfollow", expect.anything(), expect.anything());
      expect(result).toEqual({ txHash: FAKE_HASH });
    });
  });

  describe("like with keypair", () => {
    it("builds and submits like", async () => {
      wireSubmit();
      const callMock = jest.fn();
      (sdk.Contract as unknown as jest.Mock).mockImplementation(() => ({ call: callMock }));

      const result = await client.like(fakeKeypair as never, "GLIKER", 3);
      expect(callMock).toHaveBeenCalledWith(
        "like",
        expect.objectContaining({ _val: "GLIKER" }),
        expect.objectContaining({ _val: 3 })
      );
      expect(result).toEqual({ txHash: FAKE_HASH });
    });
  });

  describe("unlike with keypair", () => {
    it("builds and submits unlike", async () => {
      wireSubmit();
      const callMock = jest.fn();
      (sdk.Contract as unknown as jest.Mock).mockImplementation(() => ({ call: callMock }));

      const result = await client.unlike(fakeKeypair as never, "GLIKER", 3);
      expect(callMock).toHaveBeenCalledWith("unlike", expect.anything(), expect.anything());
      expect(result).toEqual({ txHash: FAKE_HASH });
    });
  });

  describe("tip with keypair", () => {
    it("builds and submits tip", async () => {
      wireSubmit();
      const callMock = jest.fn();
      (sdk.Contract as unknown as jest.Mock).mockImplementation(() => ({ call: callMock }));

      const result = await client.tip(fakeKeypair as never, "GSENDER", 5, 100n);
      expect(callMock).toHaveBeenCalledWith(
        "tip",
        expect.objectContaining({ _val: "GSENDER" }),
        expect.objectContaining({ _val: 5 }),
        expect.objectContaining({ _val: 100n })
      );
      expect(result).toEqual({ txHash: FAKE_HASH });
    });
  });

  describe("block/unblock with keypair", () => {
    it("builds and submits block", async () => {
      wireSubmit();
      const callMock = jest.fn();
      (sdk.Contract as unknown as jest.Mock).mockImplementation(() => ({ call: callMock }));

      const result = await client.block(fakeKeypair as never, "GBLOCKER", "GBLOCKED");
      expect(callMock).toHaveBeenCalledWith(
        "block",
        expect.objectContaining({ _val: "GBLOCKER" }),
        expect.objectContaining({ _val: "GBLOCKED" })
      );
      expect(result).toEqual({ txHash: FAKE_HASH });
    });

    it("builds and submits unblock", async () => {
      wireSubmit();
      const callMock = jest.fn();
      (sdk.Contract as unknown as jest.Mock).mockImplementation(() => ({ call: callMock }));

      const result = await client.unblock(fakeKeypair as never, "GBLOCKER", "GBLOCKED");
      expect(callMock).toHaveBeenCalledWith("unblock", expect.anything(), expect.anything());
      expect(result).toEqual({ txHash: FAKE_HASH });
    });
  });

  describe("createPool with keypair", () => {
    it("builds and submits create_pool", async () => {
      wireSubmit();
      const callMock = jest.fn();
      (sdk.Contract as unknown as jest.Mock).mockImplementation(() => ({ call: callMock }));

      const result = await client.createPool(
        fakeKeypair as never,
        "GADMIN",
        "TOKEN",
        ["GA", "GB"],
        2
      );
      expect(callMock).toHaveBeenCalledWith(
        "create_pool",
        expect.objectContaining({ _val: "GADMIN" }),
        expect.objectContaining({ _val: "TOKEN" }),
        expect.anything(),
        expect.objectContaining({ _val: 2 })
      );
      expect(result).toEqual({ txHash: FAKE_HASH });
    });
  });

  describe("deposit with keypair", () => {
    it("builds and submits deposit", async () => {
      wireSubmit();
      const callMock = jest.fn();
      (sdk.Contract as unknown as jest.Mock).mockImplementation(() => ({ call: callMock }));

      const result = await client.deposit(
        fakeKeypair as never,
        "GDEPOSITOR",
        "pool-1",
        "TOKEN",
        500
      );
      expect(callMock).toHaveBeenCalledWith(
        "deposit",
        expect.objectContaining({ _val: "GDEPOSITOR" }),
        expect.objectContaining({ _val: "pool-1" }),
        expect.objectContaining({ _val: "TOKEN" }),
        expect.objectContaining({ _val: 500 })
      );
      expect(result).toEqual({ txHash: FAKE_HASH });
    });
  });

  describe("withdraw with keypair", () => {
    it("builds and submits withdraw", async () => {
      wireSubmit();
      const callMock = jest.fn();
      (sdk.Contract as unknown as jest.Mock).mockImplementation(() => ({ call: callMock }));

      const result = await client.withdraw(
        fakeKeypair as never,
        ["GA", "GB"],
        "pool-1",
        300,
        "GRECIPIENT"
      );
      expect(callMock).toHaveBeenCalledWith(
        "withdraw",
        expect.anything(),
        expect.objectContaining({ _val: "pool-1" }),
        expect.objectContaining({ _val: 300 }),
        expect.objectContaining({ _val: "GRECIPIENT" })
      );
      expect(result).toEqual({ txHash: FAKE_HASH });
    });
  });
});
