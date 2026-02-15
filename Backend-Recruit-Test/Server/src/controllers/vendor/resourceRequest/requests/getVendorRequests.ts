import type { Response } from "express";
import type { AuthenticatedRequest } from "../../../../types/common.js";
import prisma from "../../../../config/prisma/prisma.js";
import { logger } from "../../../../utils/logger/logger.js";

/**
 * Fetch vendor resource requests scoped strictly to the authenticated user's tenant.
 * Every query MUST include a tenantId filter to prevent cross-tenant data leakage.
 * A VENDOR_MANAGER can only see users/resources within their own tenant.
 */
export async function fetchRequestData(req: AuthenticatedRequest, res: Response) {
  try {
    // ── Tenant guard: reject if tenantId is missing from the JWT-populated user ──
    const tenantId = req.user?.tenant?.tenantId;
    if (!tenantId) {
      return res.status(403).json({
        message: "Tenant context missing. Access denied.",
      });
    }

    const userId = req.user?.id;

    // ── All queries are scoped to the caller's tenantId ──
    const vendorUsers = await prisma.user.findMany({
      where: {
        tenantId,       // strict tenant isolation
        role: "IT_VENDOR", // only IT vendors within this tenant
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
      requestedBy: userId,
      count: vendorUsers.length,
      data: vendorUsers,
    });
  } catch (err: any) {
    if (err.code === "P2025") {
      return res.status(404).json({ message: "Data not found" });
    }
    logger.error("getVendorRequests: query failed", {
      tenantId,
      meta: { error: err.message },
    });
    return res.status(500).json({ message: "Internal server error" });
  }
}
