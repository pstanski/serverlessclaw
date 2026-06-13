'use client';

import React from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error('[GlobalError] Caught unhandled error:', error);
  }, [error]);

  return (
    <html>
      <body className="bg-black text-white font-mono p-8 flex flex-col items-center justify-center min-h-screen">
        <h2 className="text-red-500 font-bold text-xl mb-4">SYSTEM_ERROR // LINK_SEVERED</h2>
        <pre className="bg-white/5 p-4 rounded text-xs max-w-xl overflow-auto border border-white/10 mb-6">
          {error.message || 'An unexpected error occurred.'}
        </pre>
        <button
          onClick={() => reset()}
          className="px-4 py-2 bg-red-600 hover:bg-red-500 rounded text-xs font-bold uppercase transition-colors"
        >
          Re-initialize Link
        </button>
      </body>
    </html>
  );
}
