import prisma from "../config/prisma/prisma.js";

/**
 * Master seed script — chains all individual seed operations.
 * Invoked by `npx prisma db seed`.
 */
async function main() {
  console.log("🌱 Running full database seed...\n");

  // ── Step 1: Tenant + Admin User ──
  const tenant = await prisma.tenants.upsert({
    where: { tenantId: "demo-tenant-001" },
    update: {},
    create: {
      tenantId: "demo-tenant-001",
      companyName: "Zelosify Demo Corp",
    },
  });
  console.log(`✅ Tenant ready: ${tenant.companyName} (${tenant.tenantId})`);

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

  // ── Step 2: Job Openings ──
  const openings = [
    { title: "Senior Full-Stack Engineer", department: "Engineering", location: "Bangalore", requiredSkills: ["TypeScript", "React", "Node.js", "PostgreSQL"], requiredExperience: 5, description: "Build and maintain core platform services with a focus on scalability and reliability." },
    { title: "DevOps Engineer", department: "Infrastructure", location: "Hyderabad", requiredSkills: ["AWS", "Docker", "Kubernetes", "Terraform", "CI/CD"], requiredExperience: 4, description: "Design and manage cloud infrastructure, CI/CD pipelines, and monitoring systems." },
    { title: "Frontend Developer", department: "Engineering", location: "Bangalore", requiredSkills: ["React", "Next.js", "Tailwind CSS", "TypeScript"], requiredExperience: 3, description: "Develop responsive and accessible user interfaces for enterprise applications." },
    { title: "Backend Developer", department: "Engineering", location: "Mumbai", requiredSkills: ["Node.js", "Express", "PostgreSQL", "Redis"], requiredExperience: 3, description: "Build RESTful APIs and microservices for high-throughput workloads." },
    { title: "Machine Learning Engineer", department: "AI & Data", location: "Bangalore", requiredSkills: ["Python", "TensorFlow", "PyTorch", "SQL", "MLOps"], requiredExperience: 4, description: "Design and deploy ML models for recommendation and scoring engines." },
    { title: "Data Analyst", department: "AI & Data", location: "Pune", requiredSkills: ["SQL", "Python", "Tableau", "Excel"], requiredExperience: 2, description: "Analyze business data and create dashboards for executive decision-making." },
    { title: "Product Manager", department: "Product", location: "Mumbai", requiredSkills: ["Agile", "JIRA", "User Research", "Roadmapping"], requiredExperience: 5, description: "Lead product strategy, prioritize features, and coordinate cross-functional teams." },
    { title: "QA Engineer", department: "Quality Assurance", location: "Hyderabad", requiredSkills: ["Selenium", "Cypress", "Jest", "API Testing"], requiredExperience: 3, description: "Develop and execute automated test suites for web and API services." },
    { title: "Security Engineer", department: "Security", location: "Bangalore", requiredSkills: ["OWASP", "Penetration Testing", "IAM", "SIEM"], requiredExperience: 4, description: "Conduct security assessments and implement enterprise security controls." },
    { title: "Technical Writer", department: "Documentation", location: "Remote", requiredSkills: ["Markdown", "API Documentation", "Technical Writing"], requiredExperience: 2, description: "Create and maintain API docs, user guides, and architecture decision records." },
    { title: "Mobile Developer", department: "Engineering", location: "Chennai", requiredSkills: ["React Native", "Flutter", "TypeScript", "Firebase"], requiredExperience: 3, description: "Build cross-platform mobile applications with native-like performance." },
    { title: "Cloud Architect", department: "Infrastructure", location: "Bangalore", requiredSkills: ["AWS", "Azure", "Terraform", "Kubernetes", "Networking"], requiredExperience: 7, description: "Design cloud-native architectures and lead migration initiatives." },
  ];

  let created = 0;
  let skipped = 0;
  for (const o of openings) {
    const existing = await prisma.jobOpening.findFirst({
      where: { title: o.title, tenantId: tenant.tenantId },
    });
    if (existing) {
      skipped++;
    } else {
      await prisma.jobOpening.create({
        data: { ...o, tenantId: tenant.tenantId },
      });
      created++;
    }
  }
  console.log(`✅ Openings: ${created} created, ${skipped} skipped (already exist)`);

  console.log("\n🎉 Full seed complete.");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
