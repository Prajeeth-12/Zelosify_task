import type { Response } from "express";
import type { AuthenticatedRequest } from "../../types/common.js";
import prisma from "../../config/prisma/prisma.js";
import { logger } from "../../utils/logger/logger.js";

/**
 * GET /api/v1/hiring-manager/openings
 *
 * Returns all job openings scoped to the authenticated user's tenant,
 * including a count of submitted profiles per opening.
 */
export async function listOpenings(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const tenantId = req.user?.tenant?.tenantId;

  if (!tenantId) {
    res.status(403).json({ message: "Tenant context missing. Access denied." });
    return;
  }

  try {
    const openings = await prisma.jobOpening.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { hiringProfiles: true },
        },
      },
    });

    logger.info("listOpenings: fetched openings", {
      tenantId,
      meta: { count: openings.length },
    });

    res.json({
      message: "success",
      data: openings.map((o) => ({
        id: o.id,
        title: o.title,
        department: o.department,
        location: o.location,
        requiredSkills: o.requiredSkills,
        requiredExperience: o.requiredExperience,
        description: o.description,
        status: o.status,
        profileCount: o._count.hiringProfiles,
        createdAt: o.createdAt,
      })),
    });
  } catch (err: any) {
    logger.error("listOpenings: query failed", {
      tenantId,
      meta: { error: err.message },
    });
    res.status(500).json({ message: "Internal server error" });
  }
}
