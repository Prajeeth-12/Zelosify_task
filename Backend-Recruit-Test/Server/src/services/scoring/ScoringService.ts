/**
 * ScoringService – Deterministic AI Scoring Agent
 * ================================================
 * This is NOT an LLM call.  It is a pure, reproducible scoring engine that
 * evaluates a candidate's features against a job opening's requirements and
 * returns a weighted final score, a confidence level, and a human-readable
 * reason string.
 *
 * Mandatory formula
 * -----------------
 *   FinalScore = (0.5 × skillMatchScore)
 *              + (0.3 × experienceMatchScore)
 *              + (0.2 × locationMatchScore)
 *
 * Each sub-score is normalised to the [0 – 1] range so the FinalScore is
 * also in [0 – 1].  All arithmetic is deterministic — the same inputs will
 * always produce the same outputs.
 */

import { canonicalizeSkill } from "../resume/FeatureExtractorService.js";

// ─── Public types ────────────────────────────────────────────────────────────

/** Input payload accepted by the scoring agent. */
export interface ScoringInput {
  /** Skills the candidate claims (e.g. ["TypeScript", "React", "Node.js"]) */
  candidateSkills: string[];
  /** Candidate's total years of experience */
  candidateExperience: number;
  /** Candidate's current location */
  candidateLocation: string;

  /** Skills required by the job opening */
  jobRequiredSkills: string[];
  /** Minimum years of experience required */
  jobRequiredExperience: number;
  /** Preferred location for the role */
  jobRequiredLocation: string;
}

/** Output produced by the scoring agent. */
export interface ScoringOutput {
  /** Normalised skill-match score  [0 – 1] */
  skillMatchScore: number;
  /** Normalised experience-match score  [0 – 1] */
  experienceMatchScore: number;
  /** Normalised location-match score  [0 – 1] */
  locationMatchScore: number;
  /** Weighted final score  [0 – 1] */
  finalScore: number;
  /** Confidence bucket: HIGH | MEDIUM | LOW */
  confidence: "HIGH" | "MEDIUM" | "LOW";
  /** Human-readable explanation of how the score was derived */
  reason: string;
}

// ─── Weights (from the mandatory formula) ────────────────────────────────────

const WEIGHT_SKILL = 0.5;
const WEIGHT_EXPERIENCE = 0.3;
const WEIGHT_LOCATION = 0.2;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Normalise a string for case-insensitive, whitespace-tolerant comparison.
 *   "Type Script" → "typescript"
 */
function norm(s: string): string {
  return s.trim().toLowerCase().replace(/[\s\-_]+/g, "");
}

// ─── Core scoring functions ──────────────────────────────────────────────────

/**
 * Skill match: Overlap between candidate and required skill sets.
 *   score = |intersection| / |requiredSkills|
 *
 * Both candidate and required skills are canonicalised through the shared
 * alias map so that "ReactJS" (candidate) matches "React" (required),
 * "Postgres" matches "PostgreSQL", etc.
 *
 * If the job requires no skills the score defaults to 1 (no filter).
 */
function computeSkillMatch(
  candidateSkills: string[],
  requiredSkills: string[]
): { score: number; matched: string[]; missing: string[] } {
  if (requiredSkills.length === 0) {
    return { score: 1, matched: [], missing: [] };
  }

  // Canonicalize candidate skills into a Set for O(1) lookup
  const candidateSet = new Set(candidateSkills.map((s) => canonicalizeSkill(s)));

  const matched: string[] = [];
  const missing: string[] = [];

  for (const skill of requiredSkills) {
    const canonical = canonicalizeSkill(skill);
    if (candidateSet.has(canonical)) {
      matched.push(skill);
    } else {
      missing.push(skill);
    }
  }

  const score = matched.length / requiredSkills.length;
  return { score, matched, missing };
}

/**
 * Experience match: ratio capped at 1.
 *   score = min(candidateExp / requiredExp, 1)
 * If requiredExp ≤ 0 the score defaults to 1.
 */
function computeExperienceMatch(
  candidateExperience: number,
  requiredExperience: number
): { score: number; detail: string } {
  if (requiredExperience <= 0) {
    return { score: 1, detail: "No experience requirement." };
  }

  const raw = candidateExperience / requiredExperience;
  const score = Math.min(raw, 1);
  const detail =
    score >= 1
      ? `Candidate has ${candidateExperience} yrs (≥ ${requiredExperience} required).`
      : `Candidate has ${candidateExperience} yrs (< ${requiredExperience} required, ${(score * 100).toFixed(0)}% match).`;

  return { score, detail };
}

/**
 * Normalise a location name for comparison, handling common aliases.
 */
const LOCATION_ALIASES: Record<string, string> = {
  bengaluru: "bangalore", bangalore: "bangalore",
  mumbai: "mumbai", bombay: "mumbai",
  delhi: "delhi", "new delhi": "delhi",
  chennai: "chennai", madras: "chennai",
  kolkata: "kolkata", calcutta: "kolkata",
  gurugram: "gurgaon", gurgaon: "gurgaon",
  mysuru: "mysore", mysore: "mysore",
  mangaluru: "mangalore", mangalore: "mangalore",
  thiruvananthapuram: "trivandrum", trivandrum: "trivandrum",
  "work from home": "remote", wfh: "remote", remote: "remote", hybrid: "hybrid",
};

function normLocation(s: string): string {
  const lower = s.trim().toLowerCase().replace(/[\s\-_]+/g, " ");
  return LOCATION_ALIASES[lower] ?? lower;
}

/**
 * Location match: checks normalised location equality including aliases.
 *   "Bengaluru" matches "Bangalore", "New Delhi" matches "Delhi", etc.
 *   score = match ? 1 : 0
 */
function computeLocationMatch(
  candidateLocation: string,
  requiredLocation: string
): { score: number; detail: string } {
  if (!requiredLocation || !candidateLocation) {
    return { score: 1, detail: "No location constraint." };
  }

  const match = normLocation(candidateLocation) === normLocation(requiredLocation);
  const score = match ? 1 : 0;
  const detail = match
    ? `Location match: "${candidateLocation}" equals required "${requiredLocation}".`
    : `Location mismatch: "${candidateLocation}" ≠ required "${requiredLocation}".`;

  return { score, detail };
}

/**
 * Derive a confidence bucket from the final score.
 *   >= 0.75  → HIGH
 *   >= 0.45  → MEDIUM
 *   <  0.45  → LOW
 */
function deriveConfidence(finalScore: number): "HIGH" | "MEDIUM" | "LOW" {
  if (finalScore >= 0.75) return "HIGH";
  if (finalScore >= 0.45) return "MEDIUM";
  return "LOW";
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Deterministic AI Scoring Agent.
 *
 * Takes a candidate's features + a job opening's requirements and returns a
 * weighted score, confidence level, and human-readable reason.
 *
 * This function is **synchronous** and **side-effect-free**; it can be
 * called safely inside a Prisma interactive transaction.
 */
export function scoreCandidateForJob(input: ScoringInput): ScoringOutput {
  // ── Sub-scores ──
  const skill = computeSkillMatch(input.candidateSkills, input.jobRequiredSkills);
  const experience = computeExperienceMatch(
    input.candidateExperience,
    input.jobRequiredExperience
  );
  const location = computeLocationMatch(
    input.candidateLocation,
    input.jobRequiredLocation
  );

  // ── Mandatory formula ──
  const finalScore =
    WEIGHT_SKILL * skill.score +
    WEIGHT_EXPERIENCE * experience.score +
    WEIGHT_LOCATION * location.score;

  // Round to 4 decimal places to avoid floating-point noise
  const roundedFinal = Math.round(finalScore * 10000) / 10000;

  const confidence = deriveConfidence(roundedFinal);

  // ── Build human-readable reason ──
  const reasonParts: string[] = [];

  // Skills
  if (skill.matched.length > 0) {
    reasonParts.push(`Skills matched: [${skill.matched.join(", ")}].`);
  }
  if (skill.missing.length > 0) {
    reasonParts.push(`Skills missing: [${skill.missing.join(", ")}].`);
  }
  reasonParts.push(
    `Skill score: ${(skill.score * 100).toFixed(0)}% (weight ${WEIGHT_SKILL}).`
  );

  // Experience
  reasonParts.push(
    `${experience.detail} Experience score: ${(experience.score * 100).toFixed(0)}% (weight ${WEIGHT_EXPERIENCE}).`
  );

  // Location
  reasonParts.push(
    `${location.detail} Location score: ${(location.score * 100).toFixed(0)}% (weight ${WEIGHT_LOCATION}).`
  );

  // Final
  reasonParts.push(
    `Final weighted score: ${(roundedFinal * 100).toFixed(1)}%. Confidence: ${confidence}.`
  );

  return {
    skillMatchScore: Math.round(skill.score * 10000) / 10000,
    experienceMatchScore: Math.round(experience.score * 10000) / 10000,
    locationMatchScore: Math.round(location.score * 10000) / 10000,
    finalScore: roundedFinal,
    confidence,
    reason: reasonParts.join(" "),
  };
}
