import { useCallback, useRef, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { usePathname } from "next/navigation";
import {
  fetchOpenings,
  fetchProfiles,
  submitProfile,
  clearError,
  clearLastSubmitResult,
  selectOpenings,
  selectProfiles,
  selectIsLoadingOpenings,
  selectIsLoadingProfiles,
  selectIsSubmitting,
  selectLastSubmitResult,
  selectHiringError,
} from "@/redux/features/Dashboard/Hiring/hiringSlice";

/**
 * Custom hook for hiring management functionality.
 * Wraps Redux selectors + dispatch for openings, profiles, and uploads.
 *
 * @param {Object} options
 * @param {boolean} [options.autoFetchOpenings=false] - Fetch openings on mount
 * @param {boolean} [options.autoFetchProfiles=false] - Fetch profiles on mount
 */
export default function useHiring({
  autoFetchOpenings = false,
  autoFetchProfiles = false,
} = {}) {
  const dispatch = useDispatch();
  const pathname = usePathname();
  const hasFetchedOpeningsRef = useRef(false);
  const hasFetchedProfilesRef = useRef(false);

  // ── Selectors ──
  const openings = useSelector(selectOpenings);
  const profiles = useSelector(selectProfiles);
  const isLoadingOpenings = useSelector(selectIsLoadingOpenings);
  const isLoadingProfiles = useSelector(selectIsLoadingProfiles);
  const isSubmitting = useSelector(selectIsSubmitting);
  const lastSubmitResult = useSelector(selectLastSubmitResult);
  const error = useSelector(selectHiringError);

  // ── Auto-fetch openings ──
  useEffect(() => {
    if (autoFetchOpenings && !hasFetchedOpeningsRef.current) {
      hasFetchedOpeningsRef.current = true;
      dispatch(fetchOpenings());
    }
  }, [autoFetchOpenings, dispatch, pathname]);

  // ── Auto-fetch profiles ──
  useEffect(() => {
    if (autoFetchProfiles && !hasFetchedProfilesRef.current) {
      hasFetchedProfilesRef.current = true;
      dispatch(fetchProfiles());
    }
  }, [autoFetchProfiles, dispatch, pathname]);

  // ── Handlers ──
  const handleFetchOpenings = useCallback(() => {
    return dispatch(fetchOpenings());
  }, [dispatch]);

  const handleFetchProfiles = useCallback(() => {
    return dispatch(fetchProfiles());
  }, [dispatch]);

  /**
   * Submit a candidate profile with PDF resume.
   * Skills, experience, location, and education are auto-extracted by the backend.
   * @param {Object} data
   * @param {File} data.file - The PDF file
   * @param {string} data.openingId - Job opening ID
   */
  const handleSubmitProfile = useCallback(
    (data) => {
      return dispatch(submitProfile(data));
    },
    [dispatch]
  );

  const handleClearError = useCallback(() => {
    dispatch(clearError());
  }, [dispatch]);

  const handleClearLastResult = useCallback(() => {
    dispatch(clearLastSubmitResult());
  }, [dispatch]);

  return {
    // Data
    openings,
    profiles,
    lastSubmitResult,
    error,

    // Loading states
    isLoadingOpenings,
    isLoadingProfiles,
    isSubmitting,

    // Handlers
    handleFetchOpenings,
    handleFetchProfiles,
    handleSubmitProfile,
    handleClearError,
    handleClearLastResult,
  };
}
