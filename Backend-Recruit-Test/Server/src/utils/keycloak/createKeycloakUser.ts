import axios from "axios";
import { logger } from "../logger/logger.js";

export async function createKeycloakUser(adminToken: string, userData: any) {
  try {
    logger.info("Creating user in Keycloak");
    const response = await axios.post(
      `${process.env.KEYCLOAK_URL}/admin/realms/${process.env.KEYCLOAK_REALM}/users`,
      {
        username: userData.username,
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        enabled: true,
        credentials: userData.credentials,
        requiredActions: [], // No required actions for now
        emailVerified: true,
      },
      {
        headers: {
          Authorization: `Bearer ${adminToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    // Get the user ID from the location header
    const locationHeader = response.headers.location;
    if (!locationHeader) {
      throw new Error("User created but no location header returned");
    }
    const userId = locationHeader.split("/").pop();
    logger.info("User created in Keycloak", {
      meta: { keycloakUserId: userId },
    });
    return { id: userId };
  } catch (error) {
    logger.error("Error creating Keycloak user", {
      meta: { error: String(error) },
    });
    if (axios.isAxiosError(error)) {
      logger.error("Keycloak create user response", {
        meta: {
          data: error.response?.data,
          status: error.response?.status,
        },
      });
    }
    throw error;
  }
}
