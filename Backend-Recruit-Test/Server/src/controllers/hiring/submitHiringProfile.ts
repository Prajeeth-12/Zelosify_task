/**
 * submitHiringProfile Controller
 * ================================
 * Handles the file-upload + **automated resume parsing** + scoring flow
 * using a **Prisma Interactive Transaction** (`prisma.$transaction`).
 *
 * Accepts multipart/form-data with ONLY:
 *   - resume   (PDF file via multer)
 *   - openingId (the job opening being applied to)
 *
 * Candidate skills, experience, and location are **automatically extracted**
 * from the resume using the ResumeParser → FeatureExtractor pipeline.
 * Manual entry of these fields has been eliminated.
 *
 * Pipeline:
 *   1. Parse PDF buffer → raw text   (ResumeParserService)
 *   2. Extract features from text     (FeatureExtractorService)
 *   3. Score candidate vs job reqs    (ScoringService)
 *   4. Persist everything atomically  (Prisma $transaction)
 *
 * If ANY step fails the entire transaction rolls back — no orphaned records.
 *
 * Latency is tracked with `performance.now()` and persisted to the
 * `recommendationLatencyMs` column.
 */

import type { Response } from "express";
import type { AuthenticatedRequest } from "../../types/common.js";
import prisma from "../../config/prisma/prisma.js";
import {
  scoreCandidateForJob,
  type ScoringInput,
} from "../../services/scoring/ScoringService.js";
import { parseResume } from "../../services/resume/ResumeParserService.js";
import { extractFeatures } from "../../services/resume/FeatureExtractorService.js";
import { logger } from "../../utils/logger/logger.js";
import { performance } from "perf_hooks";

/**
 * POST /api/v1/hiring-manager/profile
 *
 * Accepts a PDF resume via FormData + openingId. Candidate features are
 * automatically extracted from the resume — no manual entry required.
 * Scores the candidate inside a Prisma interactive transaction.
 */
export async function submitHiringProfile(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const tenantId = req.user?.tenant?.tenantId;
  const userId = req.user?.id;

  // ── Guard: tenant + user context ──
  if (!tenantId || !userId) {
    logger.warn("submitHiringProfile: missing tenant or user context", {
      meta: { tenantId, userId },
    });
    res.status(403).json({ message: "Tenant/user context missing. Access denied." });
    return;
  }

  // ── Extract fields from FormData body ──
  const { openingId } = req.body;
  const file = (req as any).file as Express.Multer.File | undefined;

  // ── Validate required fields (only file + openingId now) ──
  if (!openingId || !file) {
    res.status(400).json({
      message: "Missing required fields: openingId and resume file.",
    });
    return;
  }

  try {
    // ── Idempotency check ──────────────────────────────────────────────
    const existingProfile = await prisma.hiringProfile.findFirst({
      where: {
        s3Filename: file.originalname,
        openingId,
        userId,
        tenantId,
      },
      orderBy: { createdAt: "desc" },
    });

    if (existingProfile) {
      logger.info("Idempotency hit — returning existing profile", {
        tenantId,
        meta: {
          profileId: existingProfile.id,
          s3Filename: existingProfile.s3Filename,
          openingId,
        },
      });

      res.status(200).json({
        message: "Already processed. Returning existing scored profile.",
        idempotent: true,
        data: {
          id: existingProfile.id,
          finalScore: existingProfile.finalScore,
          confidence: existingProfile.confidence,
          reason: existingProfile.reason,
          recommendationLatencyMs: existingProfile.recommendationLatencyMs,
          skillMatchScore: existingProfile.skillMatchScore,
          experienceMatchScore: existingProfile.experienceMatchScore,
          locationMatchScore: existingProfile.locationMatchScore,
          candidateSkills: existingProfile.candidateSkills,
          candidateExperience: existingProfile.candidateExperience,
          candidateLocation: existingProfile.candidateLocation,
          candidateEducation: existingProfile.candidateEducation,
        },
      });
      return;
    }

    // ── Start latency timer ──
    const t0 = performance.now();

    // ══════════════════════════════════════════════════════════════════
    // STAGE 1: Parse resume → raw text (before transaction for speed)
    // ══════════════════════════════════════════════════════════════════
    const parsed = await parseResume(
      file.buffer,
      file.mimetype,
      file.originalname
    );

    const tParsed = performance.now();

    logger.info("Pipeline Stage 1 complete: PDF parsed", {
      tenantId,
      meta: {
        filename: file.originalname,
        pages: parsed.pageCount,
        textLength: parsed.rawText.length,
        parsingTimeMs: Math.round((tParsed - t0) * 100) / 100,
      },
    });

    if (parsed.rawText.length === 0) {
      res.status(422).json({
        message:
          "Could not extract text from the uploaded PDF. " +
          "The file may be a scanned image. Please upload a text-based PDF.",
      });
      return;
    }

    /**
     * Prisma Interactive Transaction
     * All steps share the transactional `tx` client.
     * If any step throws, everything rolls back automatically.
     */
    const result = await prisma.$transaction(async (tx) => {
      // ── Resolve the job opening to get requirements ──
      const opening = await tx.jobOpening.findUnique({
        where: { id: openingId },
      });

      if (!opening || opening.tenantId !== tenantId) {
        throw new Error("JOB_OPENING_NOT_FOUND");
      }

      // ════════════════════════════════════════════════════════════════
      // STAGE 2: Extract features from raw text (NLP / regex)
      // ════════════════════════════════════════════════════════════════
      const features = extractFeatures(parsed.rawText, opening.requiredSkills);

      const tExtracted = performance.now();

      logger.info("Pipeline Stage 2 complete: features extracted", {
        tenantId,
        meta: {
          skills: features.skills,
          experience: features.experience,
          location: features.location,
          education: features.education,
          extractionMeta: features.extractionMeta,
          extractionTimeMs: Math.round((tExtracted - tParsed) * 100) / 100,
        },
      });

      // Build a deterministic S3 key (file is stored in memory by multer)
      const timestamp = Date.now();
      const s3Key = `resumes/${tenantId}/${openingId}/${timestamp}_${file.originalname}`;
      const s3Filename = file.originalname;
      const s3Bucket = process.env.S3_BUCKET_NAME || "zelosify-recruit-test";

      // ── Step 1: Save resume metadata + extracted features → HiringProfile ──
      const profile = await tx.hiringProfile.create({
        data: {
          s3Key,
          s3Filename,
          s3Bucket,
          openingId,
          candidateSkills: features.skills,
          candidateExperience: features.experience,
          candidateLocation: features.location,
          candidateEducation: features.education,
          rawResumeText: parsed.rawText.slice(0, 50000), // cap at 50KB for DB
          jobRequiredSkills: opening.requiredSkills,
          jobRequiredExperience: opening.requiredExperience,
          jobRequiredLocation: opening.location,
          tenantId,
          userId,
        },
      });

      logger.info("Step 1 complete: HiringProfile row created", {
        tenantId,
        meta: { profileId: profile.id, openingId },
      });

      // ════════════════════════════════════════════════════════════════
      // STAGE 3: Trigger the deterministic Scoring Agent
      // ════════════════════════════════════════════════════════════════
      const scoringInput: ScoringInput = {
        candidateSkills: features.skills,
        candidateExperience: features.experience,
        candidateLocation: features.location,
        jobRequiredSkills: opening.requiredSkills,
        jobRequiredExperience: opening.requiredExperience,
        jobRequiredLocation: opening.location,
      };

      const scoringResult = scoreCandidateForJob(scoringInput);

      const tScored = performance.now();

      logger.info("Step 2 complete: ScoringService returned result", {
        tenantId,
        meta: {
          profileId: profile.id,
          finalScore: scoringResult.finalScore,
          confidence: scoringResult.confidence,
          matchingTimeMs: Math.round((tScored - tExtracted) * 100) / 100,
        },
      });

      // ── Step 3: Update profile with score + latency ──
      const latencyMs = Math.round((performance.now() - t0) * 100) / 100;

      const updatedProfile = await tx.hiringProfile.update({
        where: { id: profile.id },
        data: {
          skillMatchScore: scoringResult.skillMatchScore,
          experienceMatchScore: scoringResult.experienceMatchScore,
          locationMatchScore: scoringResult.locationMatchScore,
          finalScore: scoringResult.finalScore,
          confidence: scoringResult.confidence,
          reason: scoringResult.reason,
          recommendationLatencyMs: latencyMs,
        },
      });

      logger.info("Step 3 complete: Profile updated with score & latency", {
        tenantId,
        meta: {
          profileId: updatedProfile.id,
          recommendationLatencyMs: latencyMs,
        },
      });

      return updatedProfile;
    });

    // ── Pipeline summary log (structured, all timing in one object) ──
    const totalLatencyMs = Math.round((performance.now() - t0) * 100) / 100;
    const parsingTimeMs = Math.round((tParsed - t0) * 100) / 100;
    logger.info("Pipeline complete: upload scored", {
      tenantId,
      meta: {
        profileId: result.id,
        startTime: new Date(Date.now() - totalLatencyMs).toISOString(),
        parsingTimeMs,
        matchingTimeMs: Math.round((totalLatencyMs - parsingTimeMs) * 100) / 100,
        totalLatencyMs,
        finalScore: result.finalScore,
        confidence: result.confidence,
      },
    });

    // ── Success response ──
    res.status(201).json({
      message: "Profile submitted and scored successfully (automated extraction).",
      data: {
        id: result.id,
        finalScore: result.finalScore,
        confidence: result.confidence,
        reason: result.reason,
        recommendationLatencyMs: result.recommendationLatencyMs,
        skillMatchScore: result.skillMatchScore,
        experienceMatchScore: result.experienceMatchScore,
        locationMatchScore: result.locationMatchScore,
        candidateSkills: result.candidateSkills,
        candidateExperience: result.candidateExperience,
        candidateLocation: result.candidateLocation,
        candidateEducation: result.candidateEducation,
      },
    });
  } catch (err: any) {
    if (err.message === "JOB_OPENING_NOT_FOUND") {
      res.status(404).json({ message: "Job opening not found or access denied." });
      return;
    }
    logger.error("submitHiringProfile: transaction failed — rolled back", {
      tenantId,
      meta: { error: err.message, stack: err.stack },
    });
    res.status(500).json({ message: "Internal server error. Transaction rolled back." });
  }
}
