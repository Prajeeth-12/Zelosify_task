import type { Response } from "express";
import type { AuthenticatedRequest } from "../../types/common.js";
import prisma from "../../config/prisma/prisma.js";
import { logger } from "../../utils/logger/logger.js";

/**
 * Fetch hiring profiles scoped strictly to the authenticated user's tenant.
 * Every query MUST include a tenantId filter to prevent cross-tenant data leakage.
 */
export async function fetchData(req: AuthenticatedRequest, res: Response) {
  try {
    // ── Tenant guard: reject if tenantId is missing from the JWT-populated user ──
    const tenantId = req.user?.tenant?.tenantId;
    if (!tenantId) {
      return res.status(403).json({
        message: "Tenant context missing. Access denied.",
      });
    }

    // ── All queries are scoped to the caller's tenantId ──
    const users = await prisma.user.findMany({
      where: {
        tenantId,              // strict tenant isolation
        role: "HIRING_MANAGER", // only hiring managers within this tenant
      },
      select: {
        id: true,
        username: true,
        email: true,
        firstName: true,
        lastName: true,
        department: true,
        role: true,
        createdAt: true,
      },
    });

    return res.json({
      message: "success",
      tenantId,
      count: users.length,
      data: users,
    });
  } catch (err: any) {
    if (err.code === "P2025") {
      return res.status(404).json({ message: "Data not found" });
    }
    logger.error("hiringProfileController: query failed", {
      tenantId,
      meta: { error: err.message },
    });
    return res.status(500).json({ message: "Internal server error" });
  }
}
