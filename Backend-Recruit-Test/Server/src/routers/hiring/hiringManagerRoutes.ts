import { Router, type RequestHandler } from "express";
import { authenticateUser } from "../../middlewares/auth/authenticateMiddleware.js";
import { fetchData, submitHiringProfile, listOpenings, listProfiles } from "../../controllers/controllers.js";
import { uploadConfig } from "../../config/multer/multerConfig.js";
import { logger } from "../../utils/logger/logger.js";

const router = Router();

/**
 * Middleware that allows access if the user has EITHER HIRING_MANAGER OR ADMIN role.
 * Relies on `authenticateUser` having already verified the JWT and populated `req.user`.
 * This avoids fragile double-verification with a static public key.
 */
const authorizeHiringOrAdmin: RequestHandler = (req, res, next) => {
  const user = (req as any).user;

  if (!user) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }

  const role: string = user.role || "";
  if (role !== "HIRING_MANAGER" && role !== "ADMIN") {
    res.status(403).json({
      message: "Access Denied: Requires HIRING_MANAGER or ADMIN role",
    });
    return;
  }

  logger.info("authorizeHiringOrAdmin passed", {
    tenantId: user.tenant?.tenantId,
    meta: { role },
  });
  next();
};

/**
 * =============================================================================
 * HIRING MANAGER ROUTES
 * =============================================================================
 */

/**
 * GET /api/v1/hiring-manager
 */
router.get(
  "/",
  authenticateUser as RequestHandler,
  authorizeHiringOrAdmin,
  (async (req, res, next) => {
    try {
      await fetchData(req as any, res);
    } catch (error) {
      next(error);
    }
  }) as RequestHandler
);

/**
 * GET /api/v1/hiring-manager/openings
 * List all job openings for the authenticated user's tenant.
 */
router.get(
  "/openings",
  authenticateUser as RequestHandler,
  authorizeHiringOrAdmin,
  (async (req, res, next) => {
    try {
      await listOpenings(req as any, res);
    } catch (error) {
      next(error);
    }
  }) as RequestHandler
);

/**
 * GET /api/v1/hiring-manager/profiles
 * List all scored hiring profiles for the authenticated user's tenant.
 */
router.get(
  "/profiles",
  authenticateUser as RequestHandler,
  authorizeHiringOrAdmin,
  (async (req, res, next) => {
    try {
      await listProfiles(req as any, res);
    } catch (error) {
      next(error);
    }
  }) as RequestHandler
);

/**
 * POST /api/v1/hiring-manager/profile
 * Submit a candidate profile for scoring.
 * Accepts multipart/form-data with a PDF file, or JSON body with S3 metadata.
 */
router.post(
  "/profile",
  authenticateUser as RequestHandler,
  authorizeHiringOrAdmin,
  uploadConfig.single("resume") as RequestHandler,
  (async (req, res, next) => {
    try {
      await submitHiringProfile(req as any, res);
    } catch (error) {
      next(error);
    }
  }) as RequestHandler
);

export default router;
