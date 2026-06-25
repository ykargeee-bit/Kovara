'use client';

import { useState } from 'react';
import { useCreatePost } from '../hooks/useCreatePost';

export default function PostComposer() {
  const [content, setContent] =
    useState('');

  const { loading, createPost } =
    useCreatePost();

  const handleSubmit = async () => {
    if (!content.trim()) return;

    try {
      await createPost(content);

      setContent('');
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="border rounded-lg p-4 bg-white">
      <textarea
        value={content}
        placeholder="What's happening?"
        onChange={(e) =>
          setContent(e.target.value)
        }
        className="w-full border rounded p-3"
        rows={4}
      />

      <button
        onClick={handleSubmit}
        disabled={loading}
        className="mt-4 bg-black text-white px-4 py-2 rounded"
      >
        {loading
          ? 'Publishing...'
          : 'Publish Post'}
      </button>
    </div>
  );
}