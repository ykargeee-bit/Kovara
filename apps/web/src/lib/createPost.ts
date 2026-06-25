export async function createPostOnChain(
    content: string
  ) {
    /**
     * SDK integration goes here
     *
     * Example:
     *
     * await sdk.posts.create({
     *   content
     * })
     */
  
    console.log(
      'Creating post:',
      content
    );
  
    return {
      success: true,
    };
  }