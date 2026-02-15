"use client";

import {
  Users,
  Clock,
  FileText,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useState, useRef, useCallback } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import useHiring from "@/hooks/Dashboard/Hiring/useHiring";
import ProfilesSkeleton from "./ProfilesSkeleton";
import ErrorComponent from "@/components/common/ErrorComponent";

/**
 * ProfilesLayout — Displays all scored candidate profiles for the tenant.
 *
 * Uses @tanstack/react-virtual to efficiently render 50+ profile cards
 * in a virtualized list. Only the visible rows (+ overscan) are rendered
 * in the DOM at any time.
 */
export default function ProfilesLayout() {
  const { profiles, isLoadingProfiles, error, handleFetchProfiles } =
    useHiring({ autoFetchProfiles: true });

  // Track which cards are expanded so we can adjust virtual row heights
  const [expandedIds, setExpandedIds] = useState(new Set());

  const toggleExpanded = useCallback((id) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // Virtual list container ref
  const parentRef = useRef(null);

  // Estimated row heights: collapsed ≈ 80px, expanded ≈ 340px
  const COLLAPSED_HEIGHT = 82;
  const EXPANDED_HEIGHT = 360;

  const virtualizer = useVirtualizer({
    count: profiles.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) =>
      expandedIds.has(profiles[index]?.id)
        ? EXPANDED_HEIGHT
        : COLLAPSED_HEIGHT,
    overscan: 8,
    gap: 12,
  });

  if (isLoadingProfiles) {
    return <ProfilesSkeleton />;
  }

  if (error) {
    return (
      <div className="p-6">
        <ErrorComponent message={error} onRetry={handleFetchProfiles} />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Users className="h-6 w-6 text-blue-600 dark:text-blue-400" />
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Candidate Profiles
        </h1>
        <span className="ml-2 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
          {profiles.length}
        </span>
      </div>

      {profiles.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-12">
          <div className="flex flex-col items-center justify-center text-center space-y-4">
            <Users className="h-16 w-16 text-gray-300 dark:text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300">
              No profiles submitted
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md">
              Upload a resume from the Openings page to see AI-scored profiles
              here.
            </p>
          </div>
        </div>
      ) : (
        /* Virtualized scrolling container */
        <div
          ref={parentRef}
          className="overflow-auto"
          style={{ maxHeight: "calc(100vh - 180px)" }}
        >
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: "100%",
              position: "relative",
            }}
          >
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const profile = profiles[virtualRow.index];
              return (
                <div
                  key={virtualRow.key}
                  data-index={virtualRow.index}
                  ref={virtualizer.measureElement}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <ProfileCard
                    profile={profile}
                    expanded={expandedIds.has(profile.id)}
                    onToggle={() => toggleExpanded(profile.id)}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const confidenceStyles = {
  HIGH: {
    bg: "bg-green-100 dark:bg-green-900/30",
    text: "text-green-800 dark:text-green-400",
    ring: "ring-green-500/20",
  },
  MEDIUM: {
    bg: "bg-yellow-100 dark:bg-yellow-900/30",
    text: "text-yellow-800 dark:text-yellow-400",
    ring: "ring-yellow-500/20",
  },
  LOW: {
    bg: "bg-red-100 dark:bg-red-900/30",
    text: "text-red-800 dark:text-red-400",
    ring: "ring-red-500/20",
  },
};

function getScoreColor(val) {
  if (val >= 0.75) return "bg-green-500";
  if (val >= 0.45) return "bg-yellow-500";
  return "bg-red-500";
}

/**
 * Returns the decision label based on finalScore thresholds:
 *   ≥ 0.75 → Recommended
 *   0.50–0.74 → Borderline
 *   < 0.50 → Not Recommended
 */
function getDecisionLabel(score) {
  if (score >= 0.75) return { label: "Recommended", style: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" };
  if (score >= 0.5) return { label: "Borderline", style: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400" };
  return { label: "Not Recommended", style: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" };
}

/**
 * ProfileCard — Expandable card showing candidate score summary & details.
 * Receives expanded state from parent for virtualizer height tracking.
 */
function ProfileCard({ profile, expanded, onToggle }) {
  const conf = confidenceStyles[profile.confidence] || confidenceStyles.LOW;
  const scorePct = ((profile.finalScore ?? 0) * 100).toFixed(1);
  const decision = getDecisionLabel(profile.finalScore ?? 0);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden transition-shadow hover:shadow-sm">
      {/* Summary row */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-4 px-5 py-4 text-left"
      >
        {/* Score circle */}
        <div
          className={`flex-shrink-0 w-14 h-14 rounded-full flex items-center justify-center ring-2 ${conf.ring} ${conf.bg}`}
        >
          <span className={`text-lg font-bold ${conf.text}`}>{scorePct}%</span>
        </div>

        {/* Main info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <FileText className="h-3.5 w-3.5 text-gray-400" />
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
              {profile.s3Filename}
            </span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Applied to: <span className="font-medium">{profile.jobTitle}</span>{" "}
            · {profile.candidateExperience} yrs exp ·{" "}
            {profile.candidateLocation}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-gray-400">
              Skills: {profile.candidateSkills?.join(", ")}
            </span>
          </div>
        </div>

        {/* Decision badge */}
        <span
          className={`flex-shrink-0 px-2.5 py-1 rounded-full text-xs font-semibold ${decision.style}`}
        >
          {decision.label}
        </span>

        {/* Confidence badge */}
        <span
          className={`flex-shrink-0 px-2.5 py-1 rounded-full text-xs font-semibold ${conf.bg} ${conf.text}`}
        >
          {profile.confidence}
        </span>

        {/* Latency */}
        <div className="flex-shrink-0 flex items-center gap-1 text-xs text-gray-400">
          <Clock className="h-3 w-3" />
          {profile.recommendationLatencyMs?.toFixed(1)} ms
        </div>

        {/* Expand toggle */}
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-gray-400 flex-shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0" />
        )}
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="px-5 pb-5 pt-0 border-t border-gray-100 dark:border-gray-700">
          <div className="grid grid-cols-3 gap-4 mb-4 mt-4">
            <ScoreCard
              label="Skill Match"
              value={profile.skillMatchScore}
              weight="50%"
            />
            <ScoreCard
              label="Experience"
              value={profile.experienceMatchScore}
              weight="30%"
            />
            <ScoreCard
              label="Location"
              value={profile.locationMatchScore}
              weight="20%"
            />
          </div>

          {/* Reason text */}
          {profile.reason && (
            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 mt-2">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                AI Analysis
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                {profile.reason}
              </p>
            </div>
          )}

          {/* Submitted info */}
          <div className="flex items-center justify-between mt-3 text-xs text-gray-400">
            <span>Submitted by: {profile.submittedBy}</span>
            <span>
              {new Date(profile.createdAt).toLocaleDateString("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * ScoreCard — Small card showing an individual score component.
 */
function ScoreCard({ label, value, weight }) {
  const pct = ((value ?? 0) * 100).toFixed(0);
  return (
    <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 text-center">
      <div className="text-xl font-bold text-gray-900 dark:text-gray-100">
        {pct}%
      </div>
      <div className="mt-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${getScoreColor(value ?? 0)}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{label}</p>
      <p className="text-[10px] text-gray-400">Weight: {weight}</p>
    </div>
  );
}
