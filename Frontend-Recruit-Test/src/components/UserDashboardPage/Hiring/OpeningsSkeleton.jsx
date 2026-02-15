"use client";

/**
 * OpeningsSkeleton — Skeleton loader for the Job Openings grid.
 * Mimics the shape of OpeningsLayout cards for smooth perceived loading.
 */
export default function OpeningsSkeleton() {
  return (
    <div className="p-6 space-y-6 animate-pulse">
      {/* Header skeleton */}
      <div className="flex items-center gap-3">
        <div className="h-6 w-6 rounded bg-gray-200 dark:bg-gray-700" />
        <div className="h-7 w-36 rounded bg-gray-200 dark:bg-gray-700" />
        <div className="h-5 w-8 rounded-full bg-gray-200 dark:bg-gray-700 ml-2" />
      </div>

      {/* Card grid skeleton — 6 cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5 flex flex-col"
          >
            {/* Title + badge */}
            <div className="flex items-start justify-between mb-3">
              <div className="h-5 w-40 rounded bg-gray-200 dark:bg-gray-700" />
              <div className="h-5 w-14 rounded-full bg-gray-200 dark:bg-gray-700" />
            </div>

            {/* Meta lines */}
            <div className="space-y-2 mb-3">
              <div className="h-4 w-28 rounded bg-gray-200 dark:bg-gray-700" />
              <div className="h-4 w-24 rounded bg-gray-200 dark:bg-gray-700" />
              <div className="h-4 w-32 rounded bg-gray-200 dark:bg-gray-700" />
              <div className="h-4 w-20 rounded bg-gray-200 dark:bg-gray-700" />
            </div>

            {/* Description */}
            <div className="h-3 w-full rounded bg-gray-100 dark:bg-gray-700/50 mb-1" />
            <div className="h-3 w-3/4 rounded bg-gray-100 dark:bg-gray-700/50 mb-3" />

            {/* Skill tags */}
            <div className="flex flex-wrap gap-1.5 mb-4">
              {Array.from({ length: 3 + (i % 2) }).map((_, j) => (
                <div
                  key={j}
                  className="h-5 rounded-md bg-gray-200 dark:bg-gray-700"
                  style={{ width: `${50 + (j * 15) % 40}px` }}
                />
              ))}
            </div>

            {/* Button area */}
            <div className="mt-auto pt-3 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <div className="h-8 w-32 rounded-md bg-gray-200 dark:bg-gray-700" />
              <div className="h-4 w-4 rounded bg-gray-200 dark:bg-gray-700" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
