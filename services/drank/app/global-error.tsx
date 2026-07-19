'use client';

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html>
      <body>
        <div className="p-8 text-center">
          <h2 className="text-lg font-semibold mb-2">Something went wrong</h2>
          <button onClick={reset} className="underline">
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
