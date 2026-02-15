"use client";

import { useState } from "react";
import { Briefcase, MapPin, Clock, Users, Upload, ChevronRight } from "lucide-react";
import useHiring from "@/hooks/Dashboard/Hiring/useHiring";
import UploadResumeModal from "./UploadResumeModal";
import OpeningsSkeleton from "./OpeningsSkeleton";
import ErrorComponent from "@/components/common/ErrorComponent";

/**
 * OpeningsLayout — Displays all job openings for the current tenant.
 * Each job card shows title, department, location, required skills, and
 * an "Upload Resume" button to submit a candidate profile.
 */
export default function OpeningsLayout() {
  const {
    openings,
    isLoadingOpenings,
    error,
    handleFetchOpenings,
  } = useHiring({ autoFetchOpenings: true });

  const [selectedOpening, setSelectedOpening] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleUploadClick = (opening) => {
    setSelectedOpening(opening);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedOpening(null);
  };

  const handleUploadSuccess = () => {
    // Refresh openings to update profile counts
    handleFetchOpenings();
  };

  if (isLoadingOpenings) {
    return <OpeningsSkeleton />;
  }

  if (error) {
    return (
      <div className="p-6">
        <ErrorComponent message={error} onRetry={handleFetchOpenings} />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Briefcase className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Job Openings
          </h1>
          <span className="ml-2 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
            {openings.length}
          </span>
        </div>
      </div>

      {/* Grid of job cards */}
      {openings.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-12">
          <div className="flex flex-col items-center justify-center text-center space-y-4">
            <Briefcase className="h-16 w-16 text-gray-300 dark:text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300">
              No openings yet
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md">
              Job openings created by your organization will appear here.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {openings.map((opening) => (
            <div
              key={opening.id}
              className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5 hover:shadow-md transition-shadow flex flex-col"
            >
              {/* Title & status badge */}
              <div className="flex items-start justify-between mb-3">
                <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 leading-snug pr-2">
                  {opening.title}
                </h3>
                <span
                  className={`flex-shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${
                    opening.status === "OPEN"
                      ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                      : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400"
                  }`}
                >
                  {opening.status}
                </span>
              </div>

              {/* Meta */}
              <div className="space-y-1.5 mb-3 text-sm text-gray-600 dark:text-gray-400">
                <div className="flex items-center gap-2">
                  <Briefcase className="h-3.5 w-3.5" />
                  <span>{opening.department}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-3.5 w-3.5" />
                  <span>{opening.location}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5" />
                  <span>{opening.requiredExperience}+ yrs experience</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="h-3.5 w-3.5" />
                  <span>{opening.profileCount} candidate{opening.profileCount !== 1 ? "s" : ""}</span>
                </div>
              </div>

              {/* Description */}
              {opening.description && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 line-clamp-2">
                  {opening.description}
                </p>
              )}

              {/* Skills tags */}
              <div className="flex flex-wrap gap-1.5 mb-4">
                {opening.requiredSkills.map((skill, i) => (
                  <span
                    key={i}
                    className="px-2 py-0.5 rounded-md text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
                  >
                    {skill}
                  </span>
                ))}
              </div>

              {/* Actions — pushed to bottom */}
              <div className="mt-auto pt-3 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
                <button
                  onClick={() => handleUploadClick(opening)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 transition-colors"
                >
                  <Upload className="h-3.5 w-3.5" />
                  Upload Resume
                </button>
                <ChevronRight className="h-4 w-4 text-gray-400" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload Modal */}
      {isModalOpen && selectedOpening && (
        <UploadResumeModal
          opening={selectedOpening}
          onClose={handleCloseModal}
          onSuccess={handleUploadSuccess}
        />
      )}
    </div>
  );
}
