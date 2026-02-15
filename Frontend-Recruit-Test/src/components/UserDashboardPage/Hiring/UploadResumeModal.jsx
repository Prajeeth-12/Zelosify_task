"use client";

import { useState, useCallback } from "react";
import { X, Upload, FileText, Loader2, Brain, MapPin, GraduationCap, Briefcase } from "lucide-react";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";
import useHiring from "@/hooks/Dashboard/Hiring/useHiring";

/**
 * UploadResumeModal — Modal dialog for uploading a candidate resume PDF.
 * Skills, experience, location, and education are automatically extracted
 * from the resume by the backend NLP pipeline. Displays AI scoring results on success.
 *
 * @param {Object} props
 * @param {Object} props.opening - The job opening being applied to
 * @param {Function} props.onClose - Callback to close the modal
 * @param {Function} props.onSuccess - Callback after successful upload
 */
export default function UploadResumeModal({ opening, onClose, onSuccess }) {
  const { handleSubmitProfile, handleFetchProfiles, isSubmitting } = useHiring();

  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);

  // Dropzone config
  const onDrop = useCallback((acceptedFiles) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    maxFiles: 1,
    maxSize: 100 * 1024 * 1024, // 100 MB
    onDropRejected: (rejections) => {
      const error = rejections[0]?.errors?.[0];
      if (error?.code === "file-too-large") {
        toast.error("File too large. Maximum size is 100 MB.");
      } else {
        toast.error(error?.message || "Invalid file. Please upload a PDF.");
      }
    },
  });

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!file) {
      toast.error("Please select a PDF file.");
      return;
    }

    try {
      const action = await handleSubmitProfile({
        file,
        openingId: opening.id,
      });

      if (action.meta?.requestStatus === "fulfilled") {
        const data = action.payload;
        setResult(data);
        toast.success(
          `Profile scored! Final Score: ${(data.finalScore * 100).toFixed(1)}% (${data.confidence})`
        );
        // Refresh profiles list in the background
        handleFetchProfiles();
        onSuccess?.();
      } else {
        // Rejected — payload contains { message, status }
        const err = action.payload || {};
        if (err.status === 413) {
          toast.error("File too large. Maximum upload size is 100 MB.");
        } else if (err.status === 422) {
          toast.error(err.message || "Could not extract text from PDF. Please upload a text-based PDF.");
        } else if (err.status === 500) {
          toast.error(
            `Transaction failed: ${err.message || "The upload was rolled back. Please try again."}`
          );
        } else {
          toast.error(err.message || "Upload failed. Please try again.");
        }
      }
    } catch {
      toast.error("An unexpected error occurred.");
    }
  };

  const getConfidenceBadge = (confidence) => {
    const styles = {
      HIGH: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
      MEDIUM: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
      LOW: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    };
    return styles[confidence] || styles.LOW;
  };

  const getDecisionLabel = (score) => {
    if (score >= 0.75) return { label: "Recommended", style: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" };
    if (score >= 0.5) return { label: "Borderline", style: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400" };
    return { label: "Not Recommended", style: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" };
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Upload Resume
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              {opening.title} — {opening.department}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Result view (after successful scoring) */}
        {result ? (
          <div className="p-6 space-y-4">
            <div className="text-center space-y-2">
              <div className="text-4xl font-bold text-gray-900 dark:text-gray-100">
                {(result.finalScore * 100).toFixed(1)}%
              </div>
              <span
                className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${getConfidenceBadge(
                  result.confidence
                )}`}
              >
                {result.confidence} Confidence
              </span>
              <span
                className={`inline-block px-3 py-1 rounded-full text-sm font-semibold mt-1 ${getDecisionLabel(result.finalScore).style}`}
              >
                {getDecisionLabel(result.finalScore).label}
              </span>
            </div>

            {/* Score breakdown */}
            <div className="space-y-2">
              <ScoreBar label="Skill Match" value={result.skillMatchScore} />
              <ScoreBar
                label="Experience Match"
                value={result.experienceMatchScore}
              />
              <ScoreBar
                label="Location Match"
                value={result.locationMatchScore}
              />
            </div>

            {/* Latency */}
            <div className="text-center text-xs text-gray-500 dark:text-gray-400">
              Processed in {result.recommendationLatencyMs?.toFixed(1)} ms
            </div>

            {/* Auto-extracted features */}
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 space-y-2">
              <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider flex items-center gap-1">
                <Brain className="h-3.5 w-3.5" /> Auto-Extracted from Resume
              </p>
              {result.candidateSkills?.length > 0 && (
                <div className="flex items-start gap-2">
                  <span className="text-xs text-blue-700 dark:text-blue-300 font-medium w-20 shrink-0">Skills:</span>
                  <div className="flex flex-wrap gap-1">
                    {result.candidateSkills.map((skill, i) => (
                      <span key={i} className="inline-block px-1.5 py-0.5 text-xs rounded bg-blue-100 dark:bg-blue-800/40 text-blue-700 dark:text-blue-300">
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex items-center gap-2 text-xs text-blue-700 dark:text-blue-300">
                <Briefcase className="h-3 w-3 shrink-0" />
                <span className="font-medium w-20 shrink-0">Experience:</span>
                <span>{result.candidateExperience} years</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-blue-700 dark:text-blue-300">
                <MapPin className="h-3 w-3 shrink-0" />
                <span className="font-medium w-20 shrink-0">Location:</span>
                <span>{result.candidateLocation}</span>
              </div>
              {result.candidateEducation && (
                <div className="flex items-center gap-2 text-xs text-blue-700 dark:text-blue-300">
                  <GraduationCap className="h-3 w-3 shrink-0" />
                  <span className="font-medium w-20 shrink-0">Education:</span>
                  <span>{result.candidateEducation}</span>
                </div>
              )}
            </div>

            {/* Reason */}
            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
              <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                {result.reason}
              </p>
            </div>

            <button
              onClick={onClose}
              className="w-full py-2 px-4 rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition"
            >
              Done
            </button>
          </div>
        ) : (
          /* Upload form */
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {/* Dropzone */}
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                isDragActive
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-900/10"
                  : file
                  ? "border-green-400 bg-green-50 dark:bg-green-900/10"
                  : "border-gray-300 dark:border-gray-600 hover:border-gray-400"
              }`}
            >
              <input {...getInputProps()} />
              {file ? (
                <div className="flex items-center justify-center gap-2">
                  <FileText className="h-5 w-5 text-green-600" />
                  <span className="text-sm font-medium text-green-700 dark:text-green-400">
                    {file.name}
                  </span>
                  <span className="text-xs text-gray-500">
                    ({(file.size / 1024).toFixed(0)} KB)
                  </span>
                </div>
              ) : (
                <div className="space-y-1">
                  <Upload className="h-8 w-8 mx-auto text-gray-400" />
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Drag & drop a PDF here, or click to browse
                  </p>
                  <p className="text-xs text-gray-400">Max 100 MB</p>
                </div>
              )}
            </div>

            {/* Auto-extraction notice */}
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 flex items-start gap-2">
              <Brain className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-blue-700 dark:text-blue-300">Automated Extraction</p>
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">
                  Skills, experience, location, and education will be automatically extracted from the resume using NLP.
                </p>
              </div>
            </div>

            {/* Job requirements info */}
            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 space-y-1">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Job Requirements (auto-filled)
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                <span className="font-medium">Skills:</span>{" "}
                {opening.requiredSkills.join(", ")}
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                <span className="font-medium">Experience:</span>{" "}
                {opening.requiredExperience}+ years
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                <span className="font-medium">Location:</span>{" "}
                {opening.location}
              </p>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Parsing & Scoring...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Upload & Auto-Score
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

/**
 * ScoreBar — Horizontal progress bar for individual score components.
 */
function ScoreBar({ label, value }) {
  const pct = ((value ?? 0) * 100).toFixed(0);
  const color =
    value >= 0.75
      ? "bg-green-500"
      : value >= 0.45
      ? "bg-yellow-500"
      : "bg-red-500";

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-600 dark:text-gray-400 w-28 text-right">
        {label}
      </span>
      <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 w-10">
        {pct}%
      </span>
    </div>
  );
}
