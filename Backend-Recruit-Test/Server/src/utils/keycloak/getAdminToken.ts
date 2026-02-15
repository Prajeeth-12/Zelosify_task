import axios from "axios";
import { logger } from "../logger/logger.js";

export async function getAdminToken() {
  try {
    logger.debug("Attempting to get admin token from Keycloak");
    const response = await axios.post(
      `${process.env.KEYCLOAK_URL}/realms/master/protocol/openid-connect/token`,
      new URLSearchParams({
        grant_type: "password",
        client_id: "admin-cli",
        username: process.env.KEYCLOAK_ADMIN || "admin",
        password: process.env.KEYCLOAK_ADMIN_PASSWORD || "admin",
        scope: "openid",
      }).toString(),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );
    logger.info("Admin token obtained successfully");
    return response.data.access_token;
  } catch (error) {
    logger.error("Error getting admin token", {
      meta: { error: String(error) },
    });
    if (axios.isAxiosError(error)) {
      logger.error("Admin token response details", {
        meta: {
          data: error.response?.data,
          status: error.response?.status,
        },
      });
    }
    throw error;
  }
}
