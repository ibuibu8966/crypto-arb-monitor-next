"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
      <h2 className="text-xl font-bold text-red-400 mb-2">
        エラーが発生しました
      </h2>
      <p className="text-gray-400 text-sm mb-4">
        しばらくしてからもう一度お試しください
      </p>
      <button
        onClick={reset}
        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg cursor-pointer"
      >
        再試行
      </button>
    </div>
  );
}
