"use client";

/**
 * ProfilesSkeleton — Skeleton loader for the Candidate Profiles list.
 * Mimics the expandable ProfileCard rows for smooth perceived loading.
 */
export default function ProfilesSkeleton() {
  return (
    <div className="p-6 space-y-6 animate-pulse">
      {/* Header skeleton */}
      <div className="flex items-center gap-3">
        <div className="h-6 w-6 rounded bg-gray-200 dark:bg-gray-700" />
        <div className="h-7 w-44 rounded bg-gray-200 dark:bg-gray-700" />
        <div className="h-5 w-8 rounded-full bg-gray-200 dark:bg-gray-700 ml-2" />
      </div>

      {/* Profile card rows — 5 rows */}
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 px-5 py-4 flex items-center gap-4"
          >
            {/* Score circle */}
            <div className="flex-shrink-0 w-14 h-14 rounded-full bg-gray-200 dark:bg-gray-700" />

            {/* Main info */}
            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex items-center gap-2">
                <div className="h-3.5 w-3.5 rounded bg-gray-200 dark:bg-gray-700" />
                <div
                  className="h-4 rounded bg-gray-200 dark:bg-gray-700"
                  style={{ width: `${120 + (i * 30) % 80}px` }}
                />
              </div>
              <div className="h-3 w-56 rounded bg-gray-200 dark:bg-gray-700" />
              <div className="h-3 w-40 rounded bg-gray-100 dark:bg-gray-700/50" />
            </div>

            {/* Confidence badge */}
            <div className="flex-shrink-0 h-6 w-16 rounded-full bg-gray-200 dark:bg-gray-700" />

            {/* Latency */}
            <div className="flex-shrink-0 h-4 w-16 rounded bg-gray-200 dark:bg-gray-700" />

            {/* Chevron */}
            <div className="flex-shrink-0 h-4 w-4 rounded bg-gray-200 dark:bg-gray-700" />
          </div>
        ))}
      </div>
    </div>
  );
}
