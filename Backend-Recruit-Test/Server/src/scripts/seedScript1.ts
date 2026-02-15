import prisma from "../config/prisma/prisma.js";

/**
 * Seeds the database with a demo tenant and an admin user.
 * Safe to re-run — uses upsert for idempotency.
 */
async function seedTenantAndUser() {
  try {
    console.log("🌱 Seeding tenant & admin user...");

    // 1. Upsert a demo tenant
    const tenant = await prisma.tenants.upsert({
      where: { tenantId: "demo-tenant-001" },
      update: {},
      create: {
        tenantId: "demo-tenant-001",
        companyName: "Zelosify Demo Corp",
      },
    });
    console.log(`✅ Tenant ready: ${tenant.companyName} (${tenant.tenantId})`);

    // 2. Upsert a demo admin user linked to that tenant
    const user = await prisma.user.upsert({
      where: { externalId: "demo-admin-001" },
      update: {},
      create: {
        externalId: "demo-admin-001",
        email: "admin@zelosify-demo.com",
        firstName: "Demo",
        lastName: "Admin",
        username: "demo-admin",
        role: "ADMIN",
        tenantId: tenant.tenantId,
        provider: "KEYCLOAK",
        profileComplete: true,
      },
    });
    console.log(`✅ Admin user ready: ${user.email} (${user.id})`);

    console.log("\n🎉 Tenant & user seed complete.");
  } catch (error) {
    console.error("❌ Seed failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

seedTenantAndUser();
