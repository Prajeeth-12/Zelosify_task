/**
 * FeatureExtractorService – NLP/Regex Feature Extraction
 * =======================================================
 * Takes raw resume text (from ResumeParserService) and extracts structured
 * candidate features required by the ScoringService:
 *
 *   • skills: string[]         — matched against job requirements for accuracy
 *   • experience: number       — total years of professional experience
 *   • location: string         — candidate's city / region
 *   • education: string        — highest degree or qualification
 *
 * This is a **deterministic, rule-based extractor** — no LLM calls.
 * It uses pattern matching, keyword dictionaries, and heuristics to keep
 * the pipeline fast, reproducible, and side-effect-free.
 *
 * Pipeline position:
 *   Buffer → ResumeParserService → rawText → **FeatureExtractorService** → ScoringService
 */

import { logger } from "../../utils/logger/logger.js";

// ─── Public types ────────────────────────────────────────────────────────────

export interface ExtractedFeatures {
  /** Skills found in the resume (normalised, deduplicated) */
  skills: string[];
  /** Total years of experience (best estimate) */
  experience: number;
  /** Candidate location (city / region, or "Unknown") */
  location: string;
  /** Highest education qualification found, or "Not specified" */
  education: string;
  /** Extraction confidence metadata */
  extractionMeta: {
    skillsFoundCount: number;
    experiencePatternMatched: boolean;
    locationPatternMatched: boolean;
    educationPatternMatched: boolean;
  };
}

// ─── Canonical skill alias map ───────────────────────────────────────────────
// Maps EVERY known surface form (lowercase) → canonical display name.
// This is the single source of truth for skill identity across the pipeline.
// When the extractor finds any alias in the resume text, it records the
// canonical name. The scorer also canonicalises job-required skills through
// the same map, ensuring both sides always compare identical strings.

export const SKILL_ALIAS_MAP: Record<string, string> = {
  // ── JavaScript family ──
  "javascript": "JavaScript", "js": "JavaScript", "ecmascript": "JavaScript",
  "es6": "JavaScript", "es2015": "JavaScript", "es2020": "JavaScript",
  "vanilla js": "JavaScript", "vanilla javascript": "JavaScript",

  "typescript": "TypeScript", "ts": "TypeScript",

  // ── React ecosystem ──
  "react": "React", "reactjs": "React", "react.js": "React",
  "react js": "React",
  "redux": "Redux", "react-redux": "Redux", "redux toolkit": "Redux",
  "rtk": "Redux",
  "next.js": "Next.js", "nextjs": "Next.js", "next": "Next.js",
  "next js": "Next.js",

  // ── Vue ecosystem ──
  "vue": "Vue", "vuejs": "Vue", "vue.js": "Vue", "vue js": "Vue",
  "nuxt.js": "Nuxt.js", "nuxtjs": "Nuxt.js", "nuxt": "Nuxt.js",

  // ── Angular ──
  "angular": "Angular", "angularjs": "Angular", "angular.js": "Angular",
  "angular js": "Angular",

  // ── Other frontend frameworks ──
  "svelte": "Svelte", "sveltekit": "Svelte",
  "gatsby": "Gatsby", "gatsbyjs": "Gatsby",
  "remix": "Remix",
  "astro": "Astro",
  "solid.js": "SolidJS", "solidjs": "SolidJS",

  // ── CSS / Styling ──
  "tailwind": "Tailwind CSS", "tailwindcss": "Tailwind CSS",
  "tailwind css": "Tailwind CSS", "tailwind-css": "Tailwind CSS",
  "bootstrap": "Bootstrap",
  "material ui": "Material UI", "mui": "Material UI", "material-ui": "Material UI",
  "chakra ui": "Chakra UI", "chakra": "Chakra UI",
  "ant design": "Ant Design", "antd": "Ant Design",
  "styled-components": "Styled Components", "styled components": "Styled Components",
  "css": "CSS", "css3": "CSS",
  "sass": "SASS", "scss": "SASS",
  "less": "LESS",
  "html": "HTML", "html5": "HTML",

  // ── Build tools ──
  "webpack": "Webpack",
  "vite": "Vite", "vitejs": "Vite",
  "rollup": "Rollup",
  "parcel": "Parcel",
  "esbuild": "esbuild",
  "turbopack": "Turbopack",

  // ── Testing ──
  "jest": "Jest",
  "vitest": "Vitest",
  "mocha": "Mocha",
  "chai": "Chai",
  "cypress": "Cypress",
  "playwright": "Playwright",
  "puppeteer": "Puppeteer",
  "testing library": "Testing Library", "react testing library": "Testing Library",
  "enzyme": "Enzyme",
  "selenium": "Selenium", "selenium webdriver": "Selenium",
  "api testing": "API Testing", "api test": "API Testing",

  // ── Node.js / Backend JS ──
  "node.js": "Node.js", "nodejs": "Node.js", "node": "Node.js",
  "node js": "Node.js",
  "express": "Express", "express.js": "Express", "expressjs": "Express",
  "express js": "Express",
  "fastify": "Fastify",
  "nestjs": "NestJS", "nest.js": "NestJS", "nest": "NestJS",
  "koa": "Koa", "koa.js": "Koa",
  "hapi": "Hapi", "hapijs": "Hapi",

  // ── Python ──
  "python": "Python", "python3": "Python", "py": "Python",
  "django": "Django",
  "flask": "Flask",
  "fastapi": "FastAPI", "fast api": "FastAPI",

  // ── Java / JVM ──
  "java": "Java",
  "spring": "Spring", "spring boot": "Spring Boot", "springboot": "Spring Boot",
  "spring framework": "Spring",
  "kotlin": "Kotlin",
  "scala": "Scala",

  // ── .NET ──
  ".net": ".NET", "dotnet": ".NET", "dot net": ".NET",
  "asp.net": "ASP.NET", "aspnet": "ASP.NET",
  "asp.net core": "ASP.NET Core", "aspnet core": "ASP.NET Core",
  "c#": "C#", "csharp": "C#", "c sharp": "C#",

  // ── Other Languages ──
  "c++": "C++", "cpp": "C++",
  "c": "C",
  "go": "Go", "golang": "Go",
  "rust": "Rust",
  "ruby": "Ruby",
  "php": "PHP",
  "swift": "Swift",
  "objective-c": "Objective-C", "objc": "Objective-C",
  "r": "R",
  "matlab": "MATLAB",
  "perl": "Perl",
  "lua": "Lua",
  "dart": "Dart",
  "elixir": "Elixir",
  "haskell": "Haskell",
  "shell": "Shell", "bash": "Shell", "zsh": "Shell", "sh": "Shell",
  "powershell": "PowerShell",

  // ── Ruby frameworks ──
  "rails": "Ruby on Rails", "ruby on rails": "Ruby on Rails",

  // ── PHP frameworks ──
  "laravel": "Laravel",
  "symfony": "Symfony",

  // ── Databases ──
  "postgresql": "PostgreSQL", "postgres": "PostgreSQL", "pg": "PostgreSQL",
  "mysql": "MySQL",
  "mariadb": "MariaDB",
  "sqlite": "SQLite",
  "sql": "SQL", "structured query language": "SQL",
  "nosql": "NoSQL", "no-sql": "NoSQL",
  "mongodb": "MongoDB", "mongo": "MongoDB", "mongoose": "MongoDB",
  "dynamodb": "DynamoDB", "dynamo db": "DynamoDB", "dynamo": "DynamoDB",
  "cassandra": "Cassandra",
  "couchdb": "CouchDB",
  "redis": "Redis",
  "memcached": "Memcached",
  "elasticsearch": "Elasticsearch", "elastic search": "Elasticsearch",
  "elastic": "Elasticsearch", "opensearch": "OpenSearch",
  "neo4j": "Neo4j",
  "influxdb": "InfluxDB",
  "sql server": "SQL Server", "mssql": "SQL Server",
  "microsoft sql server": "SQL Server",
  "oracle": "Oracle", "oracle db": "Oracle",

  // ── ORMs ──
  "prisma": "Prisma",
  "sequelize": "Sequelize",
  "typeorm": "TypeORM",
  "knex": "Knex",
  "drizzle": "Drizzle",

  // ── API / Protocols ──
  "graphql": "GraphQL", "graph ql": "GraphQL",
  "rest": "REST", "restful": "REST", "rest api": "REST",
  "rest apis": "REST", "restful api": "REST", "restful apis": "REST",
  "grpc": "gRPC", "g-rpc": "gRPC",
  "websocket": "WebSocket", "websockets": "WebSocket", "socket.io": "WebSocket",
  "web socket": "WebSocket",
  "microservices": "Microservices", "micro services": "Microservices",
  "micro-services": "Microservices", "microservice": "Microservices",
  "microservice architecture": "Microservices",
  "serverless": "Serverless",
  "lambda": "AWS Lambda", "aws lambda": "AWS Lambda",
  "api design": "API Design", "api development": "API Design",
  "rest api design": "API Design",

  // ── Cloud providers ──
  "aws": "AWS", "amazon web services": "AWS", "amazon aws": "AWS",
  "azure": "Azure", "microsoft azure": "Azure",
  "gcp": "GCP", "google cloud": "GCP", "google cloud platform": "GCP",

  // ── DevOps / Infra ──
  "docker": "Docker", "containerization": "Docker", "containers": "Docker",
  "kubernetes": "Kubernetes", "k8s": "Kubernetes", "kube": "Kubernetes",
  "helm": "Helm",
  "terraform": "Terraform",
  "pulumi": "Pulumi",
  "ansible": "Ansible",
  "chef": "Chef",
  "puppet": "Puppet",
  "vagrant": "Vagrant",
  "ci/cd": "CI/CD", "cicd": "CI/CD", "ci cd": "CI/CD",
  "continuous integration": "CI/CD", "continuous deployment": "CI/CD",
  "continuous delivery": "CI/CD",
  "ci/cd pipeline": "CI/CD", "ci/cd pipelines": "CI/CD",
  "jenkins": "Jenkins",
  "github actions": "GitHub Actions",
  "gitlab ci": "GitLab CI", "gitlab-ci": "GitLab CI",
  "circleci": "CircleCI", "circle ci": "CircleCI",
  "travis ci": "Travis CI", "travis": "Travis CI",
  "argo cd": "Argo CD", "argocd": "Argo CD",
  "nginx": "Nginx",
  "apache": "Apache",
  "linux": "Linux", "ubuntu": "Linux", "centos": "Linux", "debian": "Linux",
  "redhat": "Linux", "rhel": "Linux",
  "cloudflare": "Cloudflare",
  "vercel": "Vercel",
  "netlify": "Netlify",
  "heroku": "Heroku",
  "digitalocean": "DigitalOcean",

  // ── Data / ML ──
  "machine learning": "Machine Learning", "ml": "Machine Learning",
  "deep learning": "Deep Learning", "dl": "Deep Learning",
  "neural networks": "Neural Networks", "neural network": "Neural Networks",
  "tensorflow": "TensorFlow", "tf": "TensorFlow",
  "pytorch": "PyTorch", "torch": "PyTorch",
  "keras": "Keras",
  "scikit-learn": "Scikit-Learn", "sklearn": "Scikit-Learn",
  "scikit learn": "Scikit-Learn",
  "pandas": "Pandas",
  "numpy": "NumPy",
  "scipy": "SciPy",
  "matplotlib": "Matplotlib",
  "seaborn": "Seaborn",
  "nlp": "NLP", "natural language processing": "NLP",
  "computer vision": "Computer Vision", "cv": "Computer Vision",
  "opencv": "OpenCV",
  "hugging face": "Hugging Face", "huggingface": "Hugging Face",
  "transformers": "Transformers",
  "langchain": "LangChain",
  "spark": "Apache Spark", "apache spark": "Apache Spark", "pyspark": "Apache Spark",
  "hadoop": "Hadoop",
  "airflow": "Airflow", "apache airflow": "Airflow",
  "kafka": "Kafka", "apache kafka": "Kafka",
  "flink": "Flink",
  "tableau": "Tableau",
  "power bi": "Power BI", "powerbi": "Power BI",
  "looker": "Looker",
  "metabase": "Metabase",
  "etl": "ETL", "data pipeline": "ETL", "data pipelines": "ETL",
  "data warehouse": "Data Warehouse", "data warehousing": "Data Warehouse",
  "snowflake": "Snowflake",
  "databricks": "Databricks",
  "bigquery": "BigQuery", "big query": "BigQuery",
  "mlops": "MLOps", "ml ops": "MLOps", "ml engineering": "MLOps",

  // ── Mobile ──
  "react native": "React Native", "react-native": "React Native",
  "reactnative": "React Native",
  "flutter": "Flutter",
  "ionic": "Ionic",
  "xamarin": "Xamarin",
  "android": "Android",
  "ios": "iOS",
  "swiftui": "SwiftUI",
  "jetpack compose": "Jetpack Compose",

  // ── Tools / Version Control ──
  "git": "Git",
  "github": "GitHub",
  "gitlab": "GitLab",
  "bitbucket": "Bitbucket",
  "jira": "JIRA",
  "confluence": "Confluence",
  "trello": "Trello",
  "asana": "Asana",
  "figma": "Figma",
  "sketch": "Sketch",
  "adobe xd": "Adobe XD",

  // ── Practices / Methodology ──
  "agile": "Agile", "agile methodology": "Agile",
  "scrum": "Scrum", "scrum master": "Scrum",
  "kanban": "Kanban",
  "tdd": "TDD", "test driven development": "TDD",
  "test-driven development": "TDD",
  "bdd": "BDD", "behavior driven development": "BDD",
  "design patterns": "Design Patterns",
  "solid principles": "SOLID Principles", "solid": "SOLID Principles",
  "clean architecture": "Clean Architecture",
  "system design": "System Design",
  "ddd": "DDD", "domain driven design": "DDD",
  "domain-driven design": "DDD",
  "event-driven architecture": "Event-Driven Architecture",
  "event driven architecture": "Event-Driven Architecture",
  "event driven": "Event-Driven Architecture",

  // ── Auth / Security ──
  "oauth": "OAuth", "oauth2": "OAuth", "oauth 2.0": "OAuth",
  "jwt": "JWT", "json web token": "JWT", "json web tokens": "JWT",
  "openid": "OpenID", "openid connect": "OpenID", "oidc": "OpenID",
  "saml": "SAML",
  "keycloak": "Keycloak",
  "iam": "IAM", "identity and access management": "IAM",
  "identity management": "IAM",
  "rbac": "RBAC", "role based access control": "RBAC",
  "role-based access control": "RBAC",
  "owasp": "OWASP",
  "penetration testing": "Penetration Testing", "pen testing": "Penetration Testing",
  "pentest": "Penetration Testing", "pentesting": "Penetration Testing",
  "cybersecurity": "Cybersecurity", "cyber security": "Cybersecurity",
  "information security": "Cybersecurity", "infosec": "Cybersecurity",
  "encryption": "Encryption",
  "ssl": "SSL/TLS", "tls": "SSL/TLS", "ssl/tls": "SSL/TLS", "https": "SSL/TLS",
  "firewall": "Firewall",
  "vpn": "VPN",
  "siem": "SIEM",

  // ── Monitoring / Observability ──
  "monitoring": "Monitoring",
  "observability": "Observability",
  "prometheus": "Prometheus",
  "grafana": "Grafana",
  "datadog": "Datadog",
  "new relic": "New Relic", "newrelic": "New Relic",
  "sentry": "Sentry",
  "elk stack": "ELK Stack", "elk": "ELK Stack",
  "opentelemetry": "OpenTelemetry", "otel": "OpenTelemetry",

  // ── Misc ──
  "blockchain": "Blockchain",
  "solidity": "Solidity",
  "web3": "Web3",
  "firebase": "Firebase",
  "supabase": "Supabase",
  "storybook": "Storybook",

  // ── PM / Business ──
  "user research": "User Research",
  "roadmapping": "Roadmapping", "product roadmap": "Roadmapping",
  "roadmap": "Roadmapping",
  "excel": "Excel", "microsoft excel": "Excel", "ms excel": "Excel",
  "spreadsheet": "Excel", "spreadsheets": "Excel",
  "technical writing": "Technical Writing", "tech writing": "Technical Writing",
  "api documentation": "API Documentation", "api docs": "API Documentation",
  "api doc": "API Documentation",
  "markdown": "Markdown", "md": "Markdown",

  // ── REST API variations (important for job matching) ──
  "restful services": "REST",
  "restful web services": "REST", "rest services": "REST",
  "rest api development": "REST",
};

// Build lookup structures from the alias map
const ALL_ALIASES = Object.keys(SKILL_ALIAS_MAP);

// Multi-word aliases sorted by length desc so longer matches win first
const MULTI_WORD_ALIASES = ALL_ALIASES
  .filter((s) => s.includes(" ") || s.includes(".") || s.includes("/") || s.includes("-"))
  .sort((a, b) => b.length - a.length);

// Single-word aliases (for token matching)
const SINGLE_WORD_ALIAS_SET = new Set(
  ALL_ALIASES.filter(
    (s) => !s.includes(" ") && !s.includes("/") && s.length >= 1
  )
);

/**
 * Canonicalise a skill name. If it's a known alias, return the canonical form.
 * Otherwise return a title-cased version.
 */
export function canonicalizeSkill(skill: string): string {
  const lower = skill.toLowerCase().trim();
  if (SKILL_ALIAS_MAP[lower]) return SKILL_ALIAS_MAP[lower];
  // Try space-stripped version (e.g. "Type Script" → "typescript")
  const stripped = lower.replace(/\s+/g, "");
  if (stripped !== lower && SKILL_ALIAS_MAP[stripped]) return SKILL_ALIAS_MAP[stripped];
  // Try without trailing s (plural → singular)
  if (lower.endsWith("s") && SKILL_ALIAS_MAP[lower.slice(0, -1)]) {
    return SKILL_ALIAS_MAP[lower.slice(0, -1)];
  }
  // Fallback: title-case
  return skill
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

// ─── Education patterns ──────────────────────────────────────────────────────

const EDUCATION_PATTERNS: { pattern: RegExp; label: string }[] = [
  { pattern: /\b(ph\.?d|doctorate|doctor of philosophy)\b/i, label: "PhD" },
  { pattern: /\b(m\.?b\.?a)\b/i, label: "MBA" },
  { pattern: /\b(master(?:'?s)?(?:\s+of\s+\w+)?|m\.?s\.?|m\.?sc\.?|m\.?eng\.?|m\.?tech\.?|m\.?a\.?)\b/i, label: "Master's" },
  { pattern: /\b(bachelor(?:'?s)?(?:\s+of\s+\w+)?|b\.?s\.?|b\.?sc\.?|b\.?eng\.?|b\.?tech\.?|b\.?a\.?|b\.?e\.?)\b/i, label: "Bachelor's" },
  { pattern: /\b(associate(?:'?s)?(?:\s+degree)?)\b/i, label: "Associate's" },
  { pattern: /\b(diploma|certification|certificate)\b/i, label: "Diploma/Certificate" },
  { pattern: /\b(high school|secondary|hsc|ssc|12th|10th)\b/i, label: "High School" },
];

// ─── Location patterns ───────────────────────────────────────────────────────

// Major Indian cities + global tech hubs
const KNOWN_CITIES: string[] = [
  // India
  "bangalore", "bengaluru", "mumbai", "delhi", "new delhi", "hyderabad",
  "chennai", "pune", "kolkata", "ahmedabad", "jaipur", "lucknow",
  "chandigarh", "indore", "bhopal", "nagpur", "visakhapatnam",
  "coimbatore", "kochi", "thiruvananthapuram", "gurgaon", "gurugram",
  "noida", "ghaziabad", "faridabad", "mysore", "mysuru", "mangalore",
  "mangaluru", "surat", "vadodara", "rajkot", "nashik", "aurangabad",
  "patna", "ranchi", "bhubaneswar", "guwahati", "dehradun",
  // US
  "new york", "san francisco", "los angeles", "chicago", "seattle",
  "austin", "boston", "denver", "dallas", "houston", "atlanta",
  "miami", "portland", "phoenix", "san jose", "san diego",
  "washington dc", "washington d.c.", "raleigh", "charlotte",
  "minneapolis", "salt lake city", "philadelphia", "pittsburgh",
  // Global
  "london", "berlin", "amsterdam", "paris", "dublin", "toronto",
  "vancouver", "sydney", "melbourne", "singapore", "tokyo",
  "hong kong", "dubai", "tel aviv", "stockholm", "zurich",
  "barcelona", "lisbon", "warsaw", "prague", "vienna",
  "remote", "work from home", "wfh", "hybrid",
];

const LOCATION_PATTERN =
  /(?:(?:location|city|based (?:in|at)|residing (?:in|at)|current(?:ly)?\s*(?:in|at|location)|address|hometown|lives?\s+in)\s*[:\-–—]?\s*)([A-Z][a-zA-Z\s,]+)/i;

// ─── Experience patterns ─────────────────────────────────────────────────────

const EXPERIENCE_PATTERNS: RegExp[] = [
  // "8+ years of experience", "8 years experience", "8 yrs experience"
  /(\d+(?:\.\d+)?)\+?\s*(?:years?|yrs?)[\s\-]*(?:of\s+)?(?:experience|exp|work)/i,
  // "experience: 8 years", "total experience: 8+ years"
  /(?:total\s+)?experience\s*[:\-–—]\s*(\d+(?:\.\d+)?)\+?\s*(?:years?|yrs?)/i,
  // "over 8 years" / "more than 8 years"
  /(?:over|more than|approx(?:imately)?\.?\s*)\s*(\d+(?:\.\d+)?)\s*(?:years?|yrs?)/i,
  // "professional experience of 8 years"
  /professional\s+experience\s+of\s+(\d+(?:\.\d+)?)\+?\s*(?:years?|yrs?)/i,
];

// ─── Date-range experience calculator ────────────────────────────────────────

const MONTH_MAP: Record<string, number> = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2,
  apr: 3, april: 3, may: 4, jun: 5, june: 5,
  jul: 6, july: 6, aug: 7, august: 7, sep: 8, september: 8,
  oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11,
};

// Matches: "Jan 2018 – Dec 2022", "2018 - 2022", "March 2019 – Present"
const DATE_RANGE_PATTERN =
  /(?:([A-Za-z]+)\s+)?(\d{4})\s*[\-–—to]+\s*(?:([A-Za-z]+)\s+)?(\d{4}|present|current|now|ongoing)/gi;

/**
 * Calculate total experience from date ranges found in the resume.
 * Returns the sum of all date-range durations in years.
 */
function calculateExperienceFromDates(text: string): number {
  let totalMonths = 0;
  let match: RegExpExecArray | null;
  const dateRangeRegex = new RegExp(DATE_RANGE_PATTERN.source, "gi");

  while ((match = dateRangeRegex.exec(text)) !== null) {
    const startMonth = match[1] ? (MONTH_MAP[match[1].toLowerCase()] ?? 0) : 0;
    const startYear = parseInt(match[2], 10);

    let endMonth: number;
    let endYear: number;

    if (/present|current|now|ongoing/i.test(match[4])) {
      const now = new Date();
      endMonth = now.getMonth();
      endYear = now.getFullYear();
    } else {
      endMonth = match[3] ? (MONTH_MAP[match[3].toLowerCase()] ?? 11) : 11;
      endYear = parseInt(match[4], 10);
    }

    const months = (endYear - startYear) * 12 + (endMonth - startMonth);
    if (months > 0 && months < 600) {
      // Sanity: < 50 years
      totalMonths += months;
    }
  }

  return Math.round((totalMonths / 12) * 10) / 10;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Extract structured features from raw resume text.
 *
 * @param rawText           - Full plaintext extracted from the resume
 * @param jobRequiredSkills - Skills required by the job opening (used to
 *                            boost extraction accuracy by actively searching
 *                            for these skills in the text)
 * @returns ExtractedFeatures
 */
export function extractFeatures(
  rawText: string,
  jobRequiredSkills: string[] = []
): ExtractedFeatures {
  const textLower = rawText.toLowerCase();

  const skills = extractSkills(rawText, textLower, jobRequiredSkills);
  const experience = extractExperience(rawText, textLower);
  const location = extractLocation(rawText, textLower);
  const education = extractEducation(textLower);

  const result: ExtractedFeatures = {
    skills: skills.found,
    experience: experience.years,
    location: location.city,
    education: education.level,
    extractionMeta: {
      skillsFoundCount: skills.found.length,
      experiencePatternMatched: experience.matched,
      locationPatternMatched: location.matched,
      educationPatternMatched: education.matched,
    },
  };

  logger.info("FeatureExtractorService: extraction complete", {
    meta: {
      skillsCount: result.skills.length,
      experience: result.experience,
      location: result.location,
      education: result.education,
      extractionMeta: result.extractionMeta,
    },
  });

  return result;
}

// ─── Internal extraction functions ───────────────────────────────────────────

function extractSkills(
  rawText: string,
  textLower: string,
  jobRequiredSkills: string[]
): { found: string[] } {
  const foundSkills = new Set<string>();

  // 1. Check multi-word / dotted / slashed / hyphenated aliases (longer first)
  for (const alias of MULTI_WORD_ALIASES) {
    const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`(?:^|[\\s,;|•\\-\\/\\(])${escaped}(?:[\\s,;|•\\-\\/\\)]|$)`, "i");
    if (regex.test(textLower)) {
      foundSkills.add(SKILL_ALIAS_MAP[alias]);
    }
  }

  // 2. Tokenize and check single-word aliases
  const tokens = textLower
    .replace(/[^a-z0-9#.+\-/\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 1);

  for (const token of tokens) {
    const cleaned = token.replace(/[,;|•()]/g, "");
    if (SINGLE_WORD_ALIAS_SET.has(cleaned) && SKILL_ALIAS_MAP[cleaned]) {
      foundSkills.add(SKILL_ALIAS_MAP[cleaned]);
    }
    // Also check with trailing dot removed (e.g. "node.js." → "node.js")
    const noDot = cleaned.replace(/\.$/, "");
    if (noDot !== cleaned && SINGLE_WORD_ALIAS_SET.has(noDot) && SKILL_ALIAS_MAP[noDot]) {
      foundSkills.add(SKILL_ALIAS_MAP[noDot]);
    }
  }

  // 3. Bigram token matching — catch "React Native", "Spring Boot", etc.
  //    that might not appear with the exact spacing in MULTI_WORD_ALIASES scan
  for (let i = 0; i < tokens.length - 1; i++) {
    const bigram = `${tokens[i]} ${tokens[i + 1]}`.replace(/[,;|•()]/g, "");
    if (SKILL_ALIAS_MAP[bigram]) {
      foundSkills.add(SKILL_ALIAS_MAP[bigram]);
    }
  }
  // Trigram matching (e.g. "Ruby on Rails", "Google Cloud Platform")
  for (let i = 0; i < tokens.length - 2; i++) {
    const trigram = `${tokens[i]} ${tokens[i + 1]} ${tokens[i + 2]}`.replace(/[,;|•()]/g, "");
    if (SKILL_ALIAS_MAP[trigram]) {
      foundSkills.add(SKILL_ALIAS_MAP[trigram]);
    }
  }

  // 4. Actively search for EACH job-required skill and all its known aliases
  //    This is the key to near-100% recall for job-relevant skills
  for (const reqSkill of jobRequiredSkills) {
    const canonical = canonicalizeSkill(reqSkill);

    // Collect all aliases that map to this canonical name
    const aliases = ALL_ALIASES.filter(
      (a) => SKILL_ALIAS_MAP[a] === canonical
    );
    // Also search for the required skill name itself and the canonical name
    const searchTerms = new Set([
      ...aliases,
      reqSkill.toLowerCase().trim(),
      canonical.toLowerCase().trim(),
    ]);

    for (const term of searchTerms) {
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      // Use flexible boundary matching to catch the skill in various contexts
      const regex = new RegExp(
        `(?:^|[\\s,;|•\\-\\/\\(\\[])${escaped}(?:[\\s,;|•\\-\\/\\)\\].,:]|$)`,
        "i"
      );
      if (regex.test(textLower)) {
        foundSkills.add(canonical);
        break; // Found it, no need to check more aliases
      }
    }
  }

  // 5. Contextual phrase matching — catch skills mentioned in sentences
  //    e.g. "developed REST APIs using Node.js" → should find "REST"
  const contextualPatterns: { pattern: RegExp; skill: string }[] = [
    { pattern: /\brest(?:ful)?\s*(?:api|service|endpoint|web)/i, skill: "REST" },
    { pattern: /\bapi\s*(?:design|develop|integrat|gateway)/i, skill: "API Design" },
    { pattern: /\bcontinuous\s*(?:integration|deployment|delivery)/i, skill: "CI/CD" },
    { pattern: /\btest[\s-]*driven/i, skill: "TDD" },
    { pattern: /\bdomain[\s-]*driven/i, skill: "DDD" },
    { pattern: /\bevent[\s-]*driven/i, skill: "Event-Driven Architecture" },
    { pattern: /\bmicroservice\s*(?:architecture|pattern|based)/i, skill: "Microservices" },
    { pattern: /\bcontainer(?:ized|isation|ization)/i, skill: "Docker" },
    { pattern: /\borchestrat(?:e|ion|ing)\s*(?:container|cluster|pod)/i, skill: "Kubernetes" },
    { pattern: /\binfrastructure[\s-]*as[\s-]*code/i, skill: "Terraform" },
    { pattern: /\bml\s*(?:model|pipeline|engineer|ops)/i, skill: "Machine Learning" },
    { pattern: /\bdata\s*(?:pipeline|warehouse|lake|engineer)/i, skill: "ETL" },
    { pattern: /\bfull[\s-]*stack/i, skill: "Full-Stack" },
    { pattern: /\bcloud[\s-]*native/i, skill: "Cloud Native" },
    { pattern: /\bagile\s*(?:methodology|methodologies|development|team|process|framework)/i, skill: "Agile" },
    { pattern: /\bscrum\s*(?:master|team|ceremony|sprint|process)/i, skill: "Scrum" },
  ];

  for (const { pattern, skill } of contextualPatterns) {
    if (pattern.test(textLower)) {
      foundSkills.add(skill);
    }
  }

  return { found: Array.from(foundSkills).sort() };
}

// normalizeSkillName is now replaced by canonicalizeSkill (exported above)

function extractExperience(
  rawText: string,
  textLower: string
): { years: number; matched: boolean } {
  // 1. Try explicit patterns first (most reliable)
  for (const pattern of EXPERIENCE_PATTERNS) {
    const match = textLower.match(pattern);
    if (match && match[1]) {
      const years = parseFloat(match[1]);
      if (years >= 0 && years < 60) {
        return { years, matched: true };
      }
    }
  }

  // 2. Fallback: calculate from date ranges (e.g. "Jan 2018 – Present")
  const dateYears = calculateExperienceFromDates(rawText);
  if (dateYears > 0) {
    return { years: dateYears, matched: true };
  }

  // 3. Default: 0 years (no experience info found)
  return { years: 0, matched: false };
}

function extractLocation(
  rawText: string,
  textLower: string
): { city: string; matched: boolean } {
  // 1. Try structured location patterns (e.g. "Location: Bangalore")
  const structuredMatch = rawText.match(LOCATION_PATTERN);
  if (structuredMatch && structuredMatch[1]) {
    const city = structuredMatch[1].trim().replace(/[,\s]+$/, "");
    if (city.length >= 2 && city.length <= 50) {
      return { city, matched: true };
    }
  }

  // 2. Search for known cities in the text
  for (const city of KNOWN_CITIES) {
    const escaped = city.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`\\b${escaped}\\b`, "i");
    if (regex.test(textLower)) {
      // Capitalize properly
      const capitalized = city
        .split(" ")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
      return { city: capitalized, matched: true };
    }
  }

  return { city: "Unknown", matched: false };
}

function extractEducation(textLower: string): { level: string; matched: boolean } {
  // Return the highest education level found (patterns are ordered high→low)
  for (const { pattern, label } of EDUCATION_PATTERNS) {
    if (pattern.test(textLower)) {
      return { level: label, matched: true };
    }
  }

  return { level: "Not specified", matched: false };
}
