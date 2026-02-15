import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import jwksClient from "jwks-rsa";
import prisma from "../../config/prisma/prisma.js";
import { logger } from "../../utils/logger/logger.js";
import { Role, AuthProvider } from "@prisma/client";

const KEYCLOAK_URL = process.env.KEYCLOAK_URL || "http://localhost:8080/auth";
const REALM_NAME = process.env.KEYCLOAK_REALM || "Zelosify";

const keycloakJwksClient = jwksClient({
  jwksUri: `${KEYCLOAK_URL}/realms/${REALM_NAME}/protocol/openid-connect/certs`,
  cache: true,
  cacheMaxAge: 86400000, // 24 hours
  rateLimit: true,
  jwksRequestsPerMinute: 10,
});

// ✅ Extend Express Request to Include User Property
declare module "express-serve-static-core" {
  interface Request {
    user?: any;
  }
}

// Cache for user data
const userCache = new Map();
const USER_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// 🔹 Middleware: Authenticate User & Refresh Token If Expired
export const authenticateUser = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token =
      req.headers.authorization?.split(" ")[1] || req.cookies.access_token;

    if (!token) {
      res.status(401).json({ message: "Authentication required" });
      return;
    }

    const decoded = jwt.decode(token, { complete: true });
    if (!decoded || !decoded.payload) {
      res.status(401).json({ message: "Invalid token format" });
      return;
    }

    // Verify token
    try {
      const key = await keycloakJwksClient.getSigningKey(decoded.header.kid);
      const signingKey = key.getPublicKey();

      const verified = jwt.verify(token, signingKey, {
        algorithms: ["RS256"],
        issuer: `${KEYCLOAK_URL}/realms/${REALM_NAME}`,
      }) as jwt.JwtPayload;

      if (!verified || typeof verified !== "object") {
        throw new Error("Token verification failed");
      }

      // Check cache first
      const cachedUser = userCache.get(verified.sub);
      if (cachedUser && cachedUser.timestamp > Date.now() - USER_CACHE_TTL) {
        req.user = cachedUser.data;
        return next();
      }

      const user = await prisma.user.findUnique({
        where: { externalId: verified.sub },
        select: {
          id: true,
          username: true,
          email: true,
          role: true,
          department: true,
          provider: true,
          tenant: {
            select: {
              tenantId: true,
              companyName: true,
            },
          },
        },
      });

      if (!user) {
        // Auto-provision: the JWT is Keycloak-verified but the DB record is
        // missing (e.g. after a database reset). Create the user on the fly.
        logger.info(`Auto-provisioning authenticated user from JWT: ${verified.sub}`);

        // Find or create a tenant
        let tenant = await prisma.tenants.findFirst();
        if (!tenant) {
          tenant = await prisma.tenants.create({
            data: { companyName: "Zelosify Demo Corp" },
          });
        }

        // Map Keycloak realm roles to Prisma Role
        const validRoles = new Set<string>(Object.values(Role));
        const realmRoles: string[] = (verified as any).realm_access?.roles || [];
        let role: Role = "ADMIN" as Role;
        for (const r of realmRoles) {
          if (validRoles.has(r)) { role = r as Role; break; }
        }

        const newUser = await prisma.user.create({
          data: {
            externalId: verified.sub!,
            email: (verified as any).email || `${verified.sub}@keycloak`,
            username: (verified as any).preferred_username || null,
            firstName: (verified as any).given_name || null,
            lastName: (verified as any).family_name || null,
            role,
            tenantId: tenant.tenantId,
            provider: AuthProvider.KEYCLOAK,
            profileComplete: true,
          },
          select: {
            id: true,
            username: true,
            email: true,
            role: true,
            department: true,
            provider: true,
            tenant: {
              select: {
                tenantId: true,
                companyName: true,
              },
            },
          },
        });

        logger.info("Auto-provisioned user in authenticate middleware", {
          tenantId: newUser.tenant?.tenantId,
          meta: { userId: newUser.id, email: newUser.email, role: newUser.role },
        });

        userCache.set(verified.sub, { data: newUser, timestamp: Date.now() });
        req.user = newUser;
        return next();
      }

      // Update cache
      userCache.set(verified.sub, {
        data: user,
        timestamp: Date.now(),
      });
      logger.info("Authenticate Middleware Passed", {
        tenantId: user.tenant?.tenantId,
        meta: { userId: user.id, role: user.role },
      });

      req.user = user;
      next();
    } catch (error) {
      logger.error("Token verification failed", {
        meta: { error: String(error) },
      });
      res.status(401).json({ message: "Invalid or expired token" });
      return;
    }
  } catch (error) {
    logger.error("Authentication error", {
      meta: { error: String(error) },
    });
    res.status(500).json({ message: "Internal server error" });
  }
};
