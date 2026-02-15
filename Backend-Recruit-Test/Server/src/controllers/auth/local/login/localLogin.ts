import axios from "axios";
import { Request, Response } from "express";
import prisma from "../../../../config/prisma/prisma.js";
import { getKeycloakClientSecret } from "../../../../utils/keycloak/getKeycloakClientSecret.js";
import {
  LoginSuccessResponse,
  LoginTOTPRequiredResponse,
} from "../../../../types/auth.js";
import { generateTempToken } from "../../../../utils/jwt/generateTempToken.js";
import { logger } from "../../../../utils/logger/logger.js";
import jwt from "jsonwebtoken";
import { Role, AuthProvider } from "@prisma/client";

const KEYCLOAK_URL = process.env.KEYCLOAK_URL || "http://localhost:8080/auth";
const REALM_NAME = process.env.KEYCLOAK_REALM || "Zelosify";
const CLIENT_ID = process.env.KEYCLOAK_CLIENT_ID || "dynamic-client";

/** Map a Keycloak realm role name to a Prisma Role enum value */
const mapKeycloakRoleToPrisma = (roles: string[]): Role => {
  const validRoles = new Set<string>(Object.values(Role));
  // Priority order: first valid Prisma role found
  for (const r of roles) {
    if (validRoles.has(r)) return r as Role;
  }
  return "ADMIN" as Role; // fallback — admin created this user originally
};

/**
 * Verify user login credentials (step 1 of 2FA)
 * @param req - Express request with LoginCredentials body
 * @param res - Express response with login status
 */
export const verifyLogin = async (
  req: Request<{}, any, { usernameOrEmail: string; password: string }>,
  res: Response
): Promise<void> => {
  try {
    const { usernameOrEmail, password } = req.body;

    if (!usernameOrEmail || !password) {
      res
        .status(400)
        .json({ message: "Username/Email and password are required" });
      return;
    }

    const user = await prisma.user.findFirst({
      where: {
        OR: [{ email: usernameOrEmail }, { username: usernameOrEmail }],
      },
      select: {
        id: true,
        username: true,
        email: true,
        firstName: true,
        lastName: true,
        phoneNumber: true,
        role: true,
        department: true,
        provider: true,
        tenantId: true,
        tenant: {
          select: {
            tenantId: true,
            companyName: true,
          },
        },
      },
    });

    if (!user) {
      // User exists in Keycloak but not in PostgreSQL (e.g. after DB reset).
      // Attempt Keycloak auth first, then auto-provision the local record.
      logger.info("User not found locally, attempting Keycloak auto-provision", {
        meta: { usernameOrEmail },
      });

      let clientSecret: string;
      try {
        clientSecret = await getKeycloakClientSecret();
      } catch {
        res.status(401).json({ message: "User not found" });
        return;
      }

      let tokenResponse;
      try {
        tokenResponse = await axios.post(
          `${KEYCLOAK_URL}/realms/${REALM_NAME}/protocol/openid-connect/token`,
          new URLSearchParams({
            grant_type: "password",
            client_id: CLIENT_ID,
            client_secret: clientSecret,
            username: usernameOrEmail,
            password,
          }),
          { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
        );
      } catch {
        // Keycloak also doesn't know this user → genuine not-found
        res.status(401).json({ message: "User not found" });
        return;
      }

      // Decode the access token to extract user claims
      const decoded = jwt.decode(tokenResponse.data.access_token) as Record<string, any>;
      if (!decoded?.sub) {
        res.status(401).json({ message: "User not found" });
        return;
      }

      // Find or create a tenant for this user
      let tenant = await prisma.tenants.findFirst();
      if (!tenant) {
        tenant = await prisma.tenants.create({
          data: { companyName: "Zelosify Demo Corp" },
        });
      }

      // Extract Keycloak realm roles
      const realmRoles: string[] = decoded.realm_access?.roles || [];
      const role = mapKeycloakRoleToPrisma(realmRoles);

      // Auto-provision the user in PostgreSQL
      const newUser = await prisma.user.create({
        data: {
          externalId: decoded.sub,
          email: decoded.email || usernameOrEmail,
          username: decoded.preferred_username || usernameOrEmail,
          firstName: decoded.given_name || null,
          lastName: decoded.family_name || null,
          role,
          tenantId: tenant.tenantId,
          provider: AuthProvider.KEYCLOAK,
          profileComplete: true,
          accessToken: tokenResponse.data.access_token,
          refreshToken: tokenResponse.data.refresh_token,
        },
        include: { tenant: { select: { tenantId: true, companyName: true } } },
      });

      logger.info("Auto-provisioned user from Keycloak after DB reset", {
        tenantId: tenant.tenantId,
        meta: { userId: newUser.id, email: newUser.email, role: newUser.role },
      });

      // Set cookies and respond (same as seeded-user fast path)
      res.cookie("access_token", tokenResponse.data.access_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 4 * 3600 * 1000,
        path: "/",
      });
      res.cookie("refresh_token", tokenResponse.data.refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 30 * 24 * 60 * 60 * 1000,
        path: "/",
      });

      const getRoleRedirectUrl = (r: string | null) => {
        switch (r) {
          case "IT_VENDOR": return "/vendor/payments";
          case "BUSINESS_USER": return "/business-user/digital-initiative";
          default: return "/user";
        }
      };

      const successResponse: LoginSuccessResponse = {
        success: true,
        message: "Authentication successful",
        user: {
          id: newUser.id,
          username: newUser.username,
          email: newUser.email,
          firstName: newUser.firstName,
          lastName: newUser.lastName,
          phoneNumber: newUser.phoneNumber,
          role: newUser.role,
          department: newUser.department,
          provider: newUser.provider,
          tenantId: newUser.tenantId,
          companyName: newUser.tenant?.companyName || null,
        },
        redirectTo: getRoleRedirectUrl(newUser.role),
      };

      res.json(successResponse);
      return;
    }

    if (user.provider !== "KEYCLOAK") {
      res
        .status(400)
        .json({ message: "This login method is for Keycloak users only" });
      return;
    }

    const clientSecret = await getKeycloakClientSecret();

    logger.info("Attempting Keycloak login", {
      meta: { email: user.email },
    });

    try {
      const tokenResponse = await axios.post(
        `${process.env.KEYCLOAK_URL}/realms/${process.env.KEYCLOAK_REALM}/protocol/openid-connect/token`,
        new URLSearchParams({
          grant_type: "password",
          client_id: process.env.KEYCLOAK_CLIENT_ID!,
          client_secret: clientSecret,
          username: user.email,
          password,
        }),
        { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
      );

      // Special handling for seeded users (user0, user1, etc.)
      // lines 403-446
      if (user.username && /^user\d+$/.test(user.username)) {
        logger.info(`Seeded user ${user.username} detected, bypassing TOTP`, {
          meta: { username: user.username },
        });

        // Extract tokens from Keycloak response
        const { access_token, refresh_token } = tokenResponse.data;

        // Update user's tokens in the database
        await prisma.user.update({
          where: { id: user.id },
          data: {
            accessToken: access_token,
            refreshToken: refresh_token,
          },
        });

        // Set access token in cookie
        res.cookie("access_token", access_token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "strict",
          maxAge: 4 * 3600 * 1000, // 4 hours
          path: "/",
        });

        // Set refresh token in cookie
        res.cookie("refresh_token", refresh_token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "strict",
          maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
          path: "/",
        });

        // Build role-based redirect URL
        const getRoleRedirectUrl = (role: string | null) => {
          switch (role) {
            case "IT_VENDOR":
              return "/vendor/payments";
            case "BUSINESS_USER":
              return "/business-user/digital-initiative";
            default:
              return "/user";
          }
        };

        // Send the response using proper interface
        const successResponse: LoginSuccessResponse = {
          success: true,
          message: "Authentication successful",
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            phoneNumber: user.phoneNumber,
            role: user.role,
            department: user.department,
            provider: user.provider,
            tenantId: user.tenantId,
            companyName: user.tenant?.companyName || null,
          },
          redirectTo: getRoleRedirectUrl(user.role),
        };

        res.json(successResponse);
        return; // Just return without value to satisfy Promise<void>
      }

      // Normal flow for non-seeded users (existing code)
      // Store the refresh token securely
      const refreshToken = tokenResponse.data.refresh_token;

      // Generate a temporary token that includes the refresh token
      const tempToken = generateTempToken(user.id, refreshToken);

      // Store tempToken in cookies
      res.cookie("temp_token", tempToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 5 * 60 * 1000, // 5 minutes
        path: "/",
      });

      const totpResponse: LoginTOTPRequiredResponse = {
        message: "Login verified. Please enter your TOTP code.",
      };

      res.json(totpResponse);
    } catch (error: any) {
      logger.error("Keycloak authentication failed", {
        meta: { error: error.response?.data || error.message },
      });
      res.status(401).json({ message: "Invalid credentials" });
      return;
    }
  } catch (error) {
    logger.error("Error verifying login", {
      meta: { error: String(error) },
    });
    res.status(500).json({ message: "Internal server error" });
  }
};
