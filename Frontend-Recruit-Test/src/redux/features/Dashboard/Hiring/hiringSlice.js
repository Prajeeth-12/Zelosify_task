import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axiosInstance from "@/utils/Axios/AxiosInstance";

// ─── Async Thunks ─────────────────────────────────────────────────────────────

/**
 * Fetch all job openings for the current user's tenant.
 * GET /api/v1/hiring-manager/openings
 */
export const fetchOpenings = createAsyncThunk(
  "hiring/fetchOpenings",
  async (_, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.get("/hiring-manager/openings");
      return response.data.data;
    } catch (error) {
      const message =
        error?.response?.data?.message || error.message || "Failed to fetch openings";
      return rejectWithValue({ message, status: error?.response?.status });
    }
  }
);

/**
 * Fetch all scored hiring profiles for the current user's tenant.
 * GET /api/v1/hiring-manager/profiles
 */
export const fetchProfiles = createAsyncThunk(
  "hiring/fetchProfiles",
  async (_, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.get("/hiring-manager/profiles");
      return response.data.data;
    } catch (error) {
      const message =
        error?.response?.data?.message || error.message || "Failed to fetch profiles";
      return rejectWithValue({ message, status: error?.response?.status });
    }
  }
);

/**
 * Submit a candidate profile with a PDF resume.
 * POST /api/v1/hiring-manager/profile (multipart/form-data)
 * Skills, experience, location, and education are auto-extracted by the backend.
 *
 * @param {Object} payload
 * @param {File} payload.file - The PDF resume file
 * @param {string} payload.openingId - The job opening ID
 */
export const submitProfile = createAsyncThunk(
  "hiring/submitProfile",
  async (payload, { rejectWithValue }) => {
    try {
      const formData = new FormData();
      formData.append("resume", payload.file);
      formData.append("openingId", payload.openingId);

      const response = await axiosInstance.post(
        "/hiring-manager/profile",
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        }
      );
      return response.data.data;
    } catch (error) {
      const status = error?.response?.status;
      let message = "Upload failed";

      if (status === 413) {
        message = "File too large. Maximum size is 100 MB.";
      } else if (status === 500) {
        message =
          error?.response?.data?.message ||
          "Transaction failed. The upload was rolled back.";
      } else if (error?.response?.data?.message) {
        message = error.response.data.message;
      }

      return rejectWithValue({ message, status });
    }
  }
);

// ─── Slice ────────────────────────────────────────────────────────────────────

const initialState = {
  openings: [],
  profiles: [],
  isLoadingOpenings: false,
  isLoadingProfiles: false,
  isSubmitting: false,
  lastSubmitResult: null,
  error: null,
};

const hiringSlice = createSlice({
  name: "hiring",
  initialState,
  reducers: {
    clearError(state) {
      state.error = null;
    },
    clearLastSubmitResult(state) {
      state.lastSubmitResult = null;
    },
    resetHiring() {
      return initialState;
    },
  },
  extraReducers: (builder) => {
    // ── fetchOpenings ──
    builder
      .addCase(fetchOpenings.pending, (state) => {
        state.isLoadingOpenings = true;
        state.error = null;
      })
      .addCase(fetchOpenings.fulfilled, (state, action) => {
        state.isLoadingOpenings = false;
        state.openings = action.payload;
      })
      .addCase(fetchOpenings.rejected, (state, action) => {
        state.isLoadingOpenings = false;
        state.error = action.payload?.message || "Failed to load openings";
      });

    // ── fetchProfiles ──
    builder
      .addCase(fetchProfiles.pending, (state) => {
        state.isLoadingProfiles = true;
        state.error = null;
      })
      .addCase(fetchProfiles.fulfilled, (state, action) => {
        state.isLoadingProfiles = false;
        state.profiles = action.payload;
      })
      .addCase(fetchProfiles.rejected, (state, action) => {
        state.isLoadingProfiles = false;
        state.error = action.payload?.message || "Failed to load profiles";
      });

    // ── submitProfile ──
    builder
      .addCase(submitProfile.pending, (state) => {
        state.isSubmitting = true;
        state.error = null;
        state.lastSubmitResult = null;
      })
      .addCase(submitProfile.fulfilled, (state, action) => {
        state.isSubmitting = false;
        state.lastSubmitResult = action.payload;
      })
      .addCase(submitProfile.rejected, (state, action) => {
        state.isSubmitting = false;
        state.error = action.payload?.message || "Upload failed";
      });
  },
});

// ─── Exports ──────────────────────────────────────────────────────────────────

export const { clearError, clearLastSubmitResult, resetHiring } =
  hiringSlice.actions;

// Selectors
export const selectOpenings = (state) => state.hiring.openings;
export const selectProfiles = (state) => state.hiring.profiles;
export const selectIsLoadingOpenings = (state) => state.hiring.isLoadingOpenings;
export const selectIsLoadingProfiles = (state) => state.hiring.isLoadingProfiles;
export const selectIsSubmitting = (state) => state.hiring.isSubmitting;
export const selectLastSubmitResult = (state) => state.hiring.lastSubmitResult;
export const selectHiringError = (state) => state.hiring.error;

export default hiringSlice.reducer;
