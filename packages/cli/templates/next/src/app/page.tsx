export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-950">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-white">
          {{name}}
        </h1>
        <p className="mt-4 text-gray-600 dark:text-gray-400">
          Forged with Next.js + Tailwind v4
        </p>
      </div>
    </main>
  );
}
