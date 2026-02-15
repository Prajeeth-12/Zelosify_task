import prisma from "../config/prisma/prisma.js";

/**
 * Seeds the database with 12 sample job openings for testing purposes.
 * Openings are linked to the first tenant found in the database.
 */
async function seedOpenings() {
  try {
    console.log("🌱 Seeding openings data...");

    // Find the first tenant to attach openings to
    const tenant = await prisma.tenants.findFirst();
    if (!tenant) {
      console.error("❌ No tenant found. Please seed a user/tenant first.");
      return;
    }

    const tenantId = tenant.tenantId;
    console.log(`📌 Using tenant: ${tenant.companyName} (${tenantId})`);

    const openings = [
      {
        title: "Senior Full-Stack Engineer",
        department: "Engineering",
        location: "Bangalore",
        requiredSkills: ["TypeScript", "React", "Node.js", "PostgreSQL"],
        requiredExperience: 5,
        description: "Build and maintain core platform services with a focus on scalability and reliability.",
      },
      {
        title: "DevOps Engineer",
        department: "Infrastructure",
        location: "Hyderabad",
        requiredSkills: ["AWS", "Docker", "Kubernetes", "Terraform", "CI/CD"],
        requiredExperience: 4,
        description: "Design and manage cloud infrastructure, CI/CD pipelines, and monitoring systems.",
      },
      {
        title: "Frontend Developer",
        department: "Engineering",
        location: "Bangalore",
        requiredSkills: ["React", "Next.js", "Tailwind CSS", "TypeScript"],
        requiredExperience: 3,
        description: "Develop responsive and accessible user interfaces for enterprise applications.",
      },
      {
        title: "Backend Developer",
        department: "Engineering",
        location: "Mumbai",
        requiredSkills: ["Node.js", "Express", "PostgreSQL", "Redis"],
        requiredExperience: 3,
        description: "Build RESTful APIs and microservices for high-throughput workloads.",
      },
      {
        title: "Machine Learning Engineer",
        department: "AI & Data",
        location: "Bangalore",
        requiredSkills: ["Python", "TensorFlow", "PyTorch", "SQL", "MLOps"],
        requiredExperience: 4,
        description: "Design and deploy ML models for recommendation and scoring engines.",
      },
      {
        title: "Data Analyst",
        department: "AI & Data",
        location: "Pune",
        requiredSkills: ["SQL", "Python", "Tableau", "Excel"],
        requiredExperience: 2,
        description: "Analyze business data and create dashboards for executive decision-making.",
      },
      {
        title: "Product Manager",
        department: "Product",
        location: "Mumbai",
        requiredSkills: ["Agile", "JIRA", "User Research", "Roadmapping"],
        requiredExperience: 5,
        description: "Lead product strategy, prioritize features, and coordinate cross-functional teams.",
      },
      {
        title: "QA Engineer",
        department: "Quality Assurance",
        location: "Hyderabad",
        requiredSkills: ["Selenium", "Cypress", "Jest", "API Testing"],
        requiredExperience: 3,
        description: "Develop and execute automated test suites for web and API services.",
      },
      {
        title: "Security Engineer",
        department: "Security",
        location: "Bangalore",
        requiredSkills: ["OWASP", "Penetration Testing", "IAM", "SIEM"],
        requiredExperience: 4,
        description: "Conduct security assessments and implement enterprise security controls.",
      },
      {
        title: "Technical Writer",
        department: "Documentation",
        location: "Remote",
        requiredSkills: ["Markdown", "API Documentation", "Technical Writing"],
        requiredExperience: 2,
        description: "Create and maintain API docs, user guides, and architecture decision records.",
      },
      {
        title: "Mobile Developer",
        department: "Engineering",
        location: "Chennai",
        requiredSkills: ["React Native", "TypeScript", "REST APIs", "Firebase"],
        requiredExperience: 3,
        description: "Build cross-platform mobile applications for iOS and Android.",
      },
      {
        title: "Cloud Architect",
        department: "Infrastructure",
        location: "Bangalore",
        requiredSkills: ["AWS", "Azure", "Microservices", "Event-Driven Architecture"],
        requiredExperience: 7,
        description: "Design cloud-native architectures and lead migration initiatives.",
      },
    ];

    // Upsert openings (skip if title + tenantId already exists)
    let created = 0;
    let skipped = 0;

    for (const opening of openings) {
      const existing = await prisma.jobOpening.findFirst({
        where: { title: opening.title, tenantId },
      });

      if (existing) {
        skipped++;
        continue;
      }

      await prisma.jobOpening.create({
        data: { ...opening, tenantId },
      });
      created++;
    }

    console.log(`✅ Seeding complete: ${created} created, ${skipped} skipped (already exist).`);
  } catch (error) {
    console.error("❌ Error seeding openings:", error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the seed function
seedOpenings();
