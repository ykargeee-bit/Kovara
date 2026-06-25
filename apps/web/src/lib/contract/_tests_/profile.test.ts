import { setProfile } from '../profile';

describe('setProfile', () => {
  it('throws when contract id is missing', async () => {
    delete process.env.NEXT_PUBLIC_PROFILE_CONTRACT_ID;

    await expect(
      setProfile({
        address: 'test',
        username: 'user',
        creatorToken: 'token',
      }),
    ).rejects.toThrow();
  });
});


export async function getProfile(address: string) {
  const contractId =
    process.env.NEXT_PUBLIC_PROFILE_CONTRACT_ID;

  if (!contractId) {
    throw new Error("Profile contract not configured");
  }

  // Real contract query goes here
}