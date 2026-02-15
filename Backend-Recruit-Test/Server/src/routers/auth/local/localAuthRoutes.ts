// src/routers/auth/normalAuthRoutes.ts
import {
  Router,
  Request,
  Response,
  NextFunction,
  RequestHandler,
} from "express";
import asyncHandler from "../../../utils/handler/asyncHandler.js";
import { authenticateUser } from "../../../middlewares/auth/authenticateMiddleware.js";
import {
  logout,
  register,
  verifyLogin,
  verifyTOTP,
} from "../../../controllers/controllers.js";
import { AuthenticatedRequest } from "../../../types/common.js";

/**
 * Wraps async handlers to ensure void return type
 * @param handler - The request handler to wrap
 * @returns Wrapped RequestHandler with proper error handling
 */
const wrapHandler = (handler: RequestHandler): RequestHandler =>
  asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    await handler(req, res, next);
  });

/**
 * Wraps async handlers for middleware-protected routes
 * @param handler - The request handler to wrap
 * @returns Wrapped RequestHandler with proper error handling
 */
const wrapProtectedHandler = (handler: RequestHandler): RequestHandler =>
  asyncHandler(
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      await handler(req, res, next);
    }
  );

const router = Router();

/**
 * =============================================================================
 * LOCAL AUTHENTICATION ROUTES
 * =============================================================================
 */

/**
 * POST /tenant - Find or create a tenant by company name
 * Returns the tenantId for use in registration
 */
router.post("/tenant", wrapHandler(async (req: Request, res: Response) => {
  const prisma = (await import("../../../config/prisma/prisma.js")).default;
  const { companyName } = req.body;
  if (!companyName) {
    res.status(400).json({ message: "Company name is required" });
    return;
  }
  let tenant = await prisma.tenants.findFirst({ where: { companyName } });
  if (!tenant) {
    tenant = await prisma.tenants.create({ data: { companyName } });
  }
  res.status(200).json({ tenantId: tenant.tenantId, companyName: tenant.companyName });
}));

/**
 * POST /register - Register new user account
 * Creates a new user account with provided credentials
 */
router.post("/register", wrapHandler(register));

/**
 * POST /verify-login - Verify user login credentials
 * Validates user credentials and initiates login process
 */
router.post("/verify-login", wrapHandler(verifyLogin));

/**
 * POST /verify-totp - Verify TOTP for two-factor authentication
 * Validates TOTP code for users with 2FA enabled
 */
router.post("/verify-totp", wrapHandler(verifyTOTP));

/**
 * POST /logout - Logout authenticated user
 * Requires authentication middleware to access user session
 */
router.post("/logout", authenticateUser, wrapProtectedHandler(logout));

export default router;
