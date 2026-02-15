import prisma from "../../config/prisma/prisma.js";
import { logger } from "../logger/logger.js";

export default async function connectPrisma() {
  try {
    await prisma.$connect();
    logger.info("Connected to PostgreSQL");
  } catch (error) {
    logger.error("Failed to connect to PostgreSQL", {
      meta: { error: String(error) },
    });
    process.exit(1);
  }
}
