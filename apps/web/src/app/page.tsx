import PostComposer from '@/components/PostComposer';

export default function Home() {
  return (
    <main className="container mx-auto max-w-2xl py-8">
      <h1 className="text-3xl font-bold mb-6">
        Create Post
      </h1>

      <PostComposer />
    </main>
  );
}