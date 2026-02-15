import type { Response } from "express";
import type { AuthenticatedRequest } from "../../types/common.js";
import prisma from "../../config/prisma/prisma.js";
import { logger } from "../../utils/logger/logger.js";

/**
 * GET /api/v1/hiring-manager/profiles
 *
 * Returns all scored hiring profiles scoped to the authenticated user's tenant.
 * Includes the related job opening title for display.
 */
export async function listProfiles(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const tenantId = req.user?.tenant?.tenantId;

  if (!tenantId) {
    res.status(403).json({ message: "Tenant context missing. Access denied." });
    return;
  }

  try {
    const profiles = await prisma.hiringProfile.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      include: {
        opening: {
          select: { title: true },
        },
        user: {
          select: { firstName: true, lastName: true, email: true },
        },
      },
    });

    logger.info("listProfiles: fetched profiles", {
      tenantId,
      meta: { count: profiles.length },
    });

    res.json({
      message: "success",
      data: profiles.map((p) => ({
        id: p.id,
        s3Filename: p.s3Filename,
        candidateSkills: p.candidateSkills,
        candidateExperience: p.candidateExperience,
        candidateLocation: p.candidateLocation,
        jobTitle: p.opening?.title ?? "N/A",
        openingId: p.openingId,
        finalScore: p.finalScore,
        skillMatchScore: p.skillMatchScore,
        experienceMatchScore: p.experienceMatchScore,
        locationMatchScore: p.locationMatchScore,
        confidence: p.confidence,
        reason: p.reason,
        recommendationLatencyMs: p.recommendationLatencyMs,
        submittedBy: p.user
          ? `${p.user.firstName ?? ""} ${p.user.lastName ?? ""}`.trim() ||
            p.user.email
          : "Unknown",
        createdAt: p.createdAt,
      })),
    });
  } catch (err: any) {
    logger.error("listProfiles: query failed", {
      tenantId,
      meta: { error: err.message },
    });
    res.status(500).json({ message: "Internal server error" });
  }
}
