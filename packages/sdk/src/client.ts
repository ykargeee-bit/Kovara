import {
  rpc,
  Contract,
  nativeToScVal,
  scValToNative,
  TransactionBuilder,
  Account,
  Keypair,
  xdr,
} from "@stellar/stellar-sdk";
import { Profile, Post, Pool } from "./types";
import { mapError } from "./errors";

const { isSimulationError, isSimulationSuccess } = rpc.Api;

const DEFAULT_NETWORK = "Test SDF Network ; September 2015";
const DEFAULT_TIMEOUT = 30;

function scvAddress(value: string): xdr.ScVal {
  return nativeToScVal(value, { type: "address" });
}

function scvString(value: string): xdr.ScVal {
  return nativeToScVal(value);
}

function scvU64(value: number): xdr.ScVal {
  return nativeToScVal(value);
}

function scvI128(value: number | bigint): xdr.ScVal {
  return nativeToScVal(value);
}

/**
 * Configuration options for the SDK client
 */
export interface ClientConfig {
  contractId: string;
  rpcUrl: string;
  networkPassphrase?: string;
}

/**
 * Typed client for all Linkora social contract read methods
 */
export class LinkoraClient {
  private contractId: string;
  private rpcUrl: string;
  private networkPassphrase: string;

  constructor(config: ClientConfig) {
    this.contractId = config.contractId;
    this.rpcUrl = config.rpcUrl;
    this.networkPassphrase = config.networkPassphrase || DEFAULT_NETWORK;
  }

  private async simulateCall(method: string, ...args: xdr.ScVal[]): Promise<xdr.ScVal | null> {
    const server = new rpc.Server(this.rpcUrl);
    const contract = new Contract(this.contractId);
    const op = contract.call(method, ...args);

    const source = Keypair.random();
    const account = new Account(source.publicKey(), "0");
    const tx = new TransactionBuilder(account, {
      fee: "100",
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(op)
      .setTimeout(DEFAULT_TIMEOUT)
      .build();

    const result = await server.simulateTransaction(tx);

    if (isSimulationError(result)) {
      throw mapError(result.error);
    }
    if (!isSimulationSuccess(result) || !result.result) return null;

    return result.result.retval;
  }

  private buildTx(method: string, ...args: xdr.ScVal[]): string {
    const contract = new Contract(this.contractId);
    const op = contract.call(method, ...args);

    const source = Keypair.random();
    const account = new Account(source.publicKey(), "0");
    const tx = new TransactionBuilder(account, {
      fee: "100",
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(op)
      .setTimeout(DEFAULT_TIMEOUT)
      .build();

    return tx.toEnvelope().toXDR("base64");
  }

  /**
   * Fetches a user profile by their address
   * @param address - The Stellar address of the user
   * @returns A promise resolving to the user Profile, or null if not found
   */
  async getProfile(address: string): Promise<Profile | null> {
    const retval = await this.simulateCall("get_profile", scvAddress(address));
    if (!retval) return null;
    const raw = scValToNative(retval);
    if (raw == null) return null;
    return raw as Profile;
  }

  /**
   * Fetches a post by its ID
   * @param postId - The ID of the post
   * @returns A promise resolving to the Post data, or null if not found
   */
  async getPost(postId: number): Promise<Post | null> {
    const retval = await this.simulateCall("get_post", scvU64(postId));
    if (!retval) return null;
    const raw = scValToNative(retval);
    if (raw == null) return null;
    return raw as Post;
  }

  /**
   * Retrieves the total number of posts created
   * @returns A promise resolving to the total post count
   */
  async getPostCount(): Promise<number> {
    const retval = await this.simulateCall("get_post_count");
    if (!retval) return 0;
    return Number(scValToNative(retval));
  }

  /**
   * Fetches the addresses of users that a specific address is following
   * @param address - The address of the follower
   * @returns A promise resolving to an array of addresses
   */
  async getFollowing(address: string): Promise<string[]> {
    const retval = await this.simulateCall("get_following", scvAddress(address));
    if (!retval) return [];
    return scValToNative(retval) as string[];
  }

  /**
   * Fetches the addresses of users following a specific address
   * @param address - The address of the user being followed
   * @returns A promise resolving to an array of addresses
   */
  async getFollowers(address: string): Promise<string[]> {
    const retval = await this.simulateCall("get_followers", scvAddress(address));
    if (!retval) return [];
    return scValToNative(retval) as string[];
  }

  /**
   * Fetches a pool by its ID
   * @param poolId - The ID of the pool
   * @returns A promise resolving to the Pool data, or null if not found
   */
  async getPool(poolId: string): Promise<Pool | null> {
    const retval = await this.simulateCall("get_pool", scvString(poolId));
    if (!retval) return null;
    const raw = scValToNative(retval);
    if (raw == null) return null;
    return raw as Pool;
  }

  /**
   * Retrieves the administrators of a specific pool
   * @param poolId - The ID of the pool
   * @returns A promise resolving to an array of admin addresses
   */
  async getPoolAdmins(poolId: string): Promise<string[]> {
    const retval = await this.simulateCall("get_pool_admins", scvString(poolId));
    if (!retval) return [];
    return scValToNative(retval) as string[];
  }

  /**
   * Fetches the global platform fee in basis points
   * @returns A promise resolving to the fee in BPS
   */
  async getFeeBps(): Promise<number> {
    const retval = await this.simulateCall("get_fee_bps");
    if (!retval) return 0;
    return Number(scValToNative(retval));
  }

  /**
   * Fetches the treasury address
   * @returns A promise resolving to the treasury address
   */
  async getTreasury(): Promise<string> {
    const retval = await this.simulateCall("get_treasury");
    if (!retval) return "";
    return scValToNative(retval) as string;
  }

  /**
   * Checks if a specific address has liked a specific post
   * @param address - The address of the user
   * @param postId - The ID of the post
   * @returns A promise resolving to true if liked, false otherwise
   */
  async hasLiked(address: string, postId: number): Promise<boolean> {
    const retval = await this.simulateCall("has_liked", scvAddress(address), scvU64(postId));
    if (!retval) return false;
    return scValToNative(retval) as boolean;
  }

  /**
   * Checks if a user has blocked another user
   * @param blocker - The address of the user who is blocking
   * @param blocked - The address of the user who is blocked
   * @returns A promise resolving to true if blocked, false otherwise
   */
  async isBlocked(blocker: string, blocked: string): Promise<boolean> {
    const retval = await this.simulateCall("is_blocked", scvAddress(blocker), scvAddress(blocked));
    if (!retval) return false;
    return scValToNative(retval) as boolean;
  }

  /**
   * Fetches the number of likes a post has received
   * @param postId - The ID of the post
   * @returns A promise resolving to the like count
   */
  async getLikeCount(postId: number): Promise<number> {
    const retval = await this.simulateCall("get_like_count", scvU64(postId));
    if (!retval) return 0;
    return Number(scValToNative(retval));
  }

  /**
   * Builds an XDR envelope for creating a post
   * @param author - The author's Stellar address
   * @param content - The post content
   * @returns The base64-encoded XDR envelope
   */
  createPost(author: string, content: string): string {
    return this.buildTx("create_post", scvAddress(author), scvString(content));
  }

  /**
   * Builds an XDR envelope for deleting a post
   * @param author - The author's Stellar address
   * @param postId - The ID of the post to delete
   * @returns The base64-encoded XDR envelope
   */
  deletePost(author: string, postId: number): string {
    return this.buildTx("delete_post", scvAddress(author), scvU64(postId));
  }

  /**
   * Builds an XDR envelope for following a user
   * @param follower - The follower's Stellar address
   * @param followed - The address to follow
   * @returns The base64-encoded XDR envelope
   */
  follow(follower: string, followed: string): string {
    return this.buildTx("follow", scvAddress(follower), scvAddress(followed));
  }

  /**
   * Builds an XDR envelope for unfollowing a user
   * @param follower - The follower's Stellar address
   * @param followed - The address to unfollow
   * @returns The base64-encoded XDR envelope
   */
  unfollow(follower: string, followed: string): string {
    return this.buildTx("unfollow", scvAddress(follower), scvAddress(followed));
  }

  /**
   * Builds an XDR envelope for liking a post
   * @param liker - The liker's Stellar address
   * @param postId - The ID of the post to like
   * @returns The base64-encoded XDR envelope
   */
  like(liker: string, postId: number): string {
    return this.buildTx("like", scvAddress(liker), scvU64(postId));
  }

  /**
   * Builds an XDR envelope for unliking a post
   * @param liker - The liker's Stellar address
   * @param postId - The ID of the post to unlike
   * @returns The base64-encoded XDR envelope
   */
  unlike(liker: string, postId: number): string {
    return this.buildTx("unlike", scvAddress(liker), scvU64(postId));
  }

  /**
   * Builds an XDR envelope for tipping a post
   * @param sender - The sender's Stellar address
   * @param postId - The ID of the post to tip
   * @param amount - The tip amount
   * @returns The base64-encoded XDR envelope
   */
  tip(sender: string, postId: number, amount: number | bigint): string {
    return this.buildTx("tip", scvAddress(sender), scvU64(postId), scvI128(amount));
  }

  /**
   * Builds an XDR envelope for creating a pool
   * @param admin - The admin's Stellar address
   * @param token - The token address
   * @param initialAdmins - The initial admin addresses
   * @param threshold - The signature threshold
   * @returns The base64-encoded XDR envelope
   */
  createPool(admin: string, token: string, initialAdmins: string[], threshold: number): string {
    return this.buildTx(
      "create_pool",
      scvAddress(admin),
      scvString(token),
      nativeToScVal(
        initialAdmins.map((a) => scvAddress(a)),
        {
          type: "vec",
        }
      ),
      scvU64(threshold)
    );
  }

  /**
   * Builds an XDR envelope for depositing into a pool
   * @param depositor - The depositor's Stellar address
   * @param poolId - The pool ID
   * @param token - The token address
   * @param amount - The deposit amount
   * @returns The base64-encoded XDR envelope
   */
  deposit(depositor: string, poolId: string, token: string, amount: number | bigint): string {
    return this.buildTx(
      "deposit",
      scvAddress(depositor),
      scvString(poolId),
      scvString(token),
      scvI128(amount)
    );
  }

  /**
   * Builds an XDR envelope for withdrawing from a pool
   * @param signers - The signers' addresses
   * @param poolId - The pool ID
   * @param amount - The withdrawal amount
   * @param recipient - The recipient address
   * @returns The base64-encoded XDR envelope
   */
  withdraw(signers: string[], poolId: string, amount: number | bigint, recipient: string): string {
    return this.buildTx(
      "withdraw",
      nativeToScVal(
        signers.map((s) => scvAddress(s)),
        { type: "vec" }
      ),
      scvString(poolId),
      scvI128(amount),
      scvAddress(recipient)
    );
  }

  /**
   * Builds an XDR envelope for blocking a user
   * @param blocker - The blocker's Stellar address
   * @param blocked - The address to block
   * @returns The base64-encoded XDR envelope
   */
  block(blocker: string, blocked: string): string {
    return this.buildTx("block", scvAddress(blocker), scvAddress(blocked));
  }

  /**
   * Builds an XDR envelope for unblocking a user
   * @param blocker - The blocker's Stellar address
   * @param blocked - The address to unblock
   * @returns The base64-encoded XDR envelope
   */
  unblock(blocker: string, blocked: string): string {
    return this.buildTx("unblock", scvAddress(blocker), scvAddress(blocked));
  }
}
