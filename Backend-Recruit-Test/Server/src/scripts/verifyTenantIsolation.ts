/**
 * Verification Script: Tenant Isolation + Atomic Transactions
 * ============================================================
 * Checks:
 * 1. All JobOpenings are grouped by tenantId (expect 12 for Bruce Wayne Corp)
 * 2. No orphan HiringProfiles exist (s3Key IS NULL)
 */
import { PrismaClient, Prisma } from "../../node_modules/.prisma/client/index.js";

const prisma = new PrismaClient();

async function main() {
  console.log("\n🛡️  TEST 1: Tenant Isolation — JobOpening distribution");
  console.log("─".repeat(60));

  const openingsByTenant = await prisma.$queryRaw<
    { tenantId: string; count: bigint }[]
  >(Prisma.sql`SELECT "tenantId", COUNT(*)::int as count FROM "app"."JobOpening" GROUP BY "tenantId"`);

  if (openingsByTenant.length === 0) {
    console.log("  ❌ No job openings found in the database!");
  } else {
    for (const row of openingsByTenant) {
      console.log(`  Tenant: ${row.tenantId}  →  ${row.count} openings`);
    }

    // Verify single tenant owns all 12
    if (openingsByTenant.length === 1 && Number(openingsByTenant[0].count) === 12) {
      console.log("  ✅ PASS — All 12 openings belong to a single tenant.");
    } else if (openingsByTenant.length > 1) {
      console.log("  ❌ FAIL — Openings are spread across multiple tenants!");
    } else {
      console.log(`  ⚠️  Only ${openingsByTenant[0].count} openings found (expected 12).`);
    }
  }

  // Also verify the controller's WHERE clause is tenant-scoped
  const tenant = await prisma.tenants.findFirst();
  if (tenant) {
    const scopedOpenings = await prisma.jobOpening.findMany({
      where: { tenantId: tenant.tenantId },
      select: { id: true, title: true },
    });
    console.log(`  Scoped query for tenant "${tenant.companyName}": ${scopedOpenings.length} openings`);
  }

  console.log("\n⚛️  TEST 2: Atomic Transactions — Orphan profile check");
  console.log("─".repeat(60));

  const orphans = await prisma.$queryRaw<
    { id: string; s3Key: string | null }[]
  >(Prisma.sql`SELECT id, "s3Key" FROM "app"."HiringProfile" WHERE "s3Key" IS NULL`);

  if (orphans.length === 0) {
    console.log("  ✅ PASS — 0 orphan records (all profiles have a valid s3Key).");
  } else {
    console.log(`  ❌ FAIL — ${orphans.length} orphan profiles found without s3Key:`);
    for (const o of orphans) {
      console.log(`    - Profile ID: ${o.id}`);
    }
  }

  // Count total profiles for context
  const totalProfiles = await prisma.hiringProfile.count();
  console.log(`  Total profiles in database: ${totalProfiles}`);

  // Show profiles with scores for quick sanity
  if (totalProfiles > 0) {
    const profiles = await prisma.hiringProfile.findMany({
      select: {
        id: true,
        s3Key: true,
        finalScore: true,
        confidence: true,
        recommendationLatencyMs: true,
        tenantId: true,
      },
      take: 5,
    });
    console.log("\n  📋 Sample profiles:");
    for (const p of profiles) {
      console.log(
        `    ID: ${p.id.slice(0, 8)}…  Score: ${p.finalScore ?? "N/A"}  ` +
        `Confidence: ${p.confidence ?? "N/A"}  Latency: ${p.recommendationLatencyMs ?? "N/A"}ms  ` +
        `Tenant: ${p.tenantId.slice(0, 8)}…`
      );
    }
  }

  console.log("\n" + "═".repeat(60));
  console.log("Verification complete.\n");
}

main()
  .catch((e) => {
    console.error("Verification script error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
