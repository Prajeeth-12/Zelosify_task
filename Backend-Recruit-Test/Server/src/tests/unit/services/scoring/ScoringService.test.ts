/**
 * ScoringService Unit Tests
 * =========================
 * Validates the Deterministic AI Scoring Agent against:
 *   - Mandatory formula: FinalScore = 0.5×Skill + 0.3×Exp + 0.2×Loc
 *   - Experience boundary conditions (0, exact, under, over)
 *   - Skill overlap edge cases (none, partial, full, superset)
 *   - Location match (exact, mismatch, empty)
 *   - Confidence thresholds (HIGH ≥ 0.75, MEDIUM ≥ 0.45, LOW < 0.45)
 *   - Determinism: same inputs → same outputs
 */

import { describe, it, expect } from "vitest";
import {
  scoreCandidateForJob,
  type ScoringInput,
  type ScoringOutput,
} from "@/services/scoring/ScoringService";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildInput(overrides: Partial<ScoringInput> = {}): ScoringInput {
  return {
    candidateSkills: ["TypeScript", "React", "Node.js"],
    candidateExperience: 5,
    candidateLocation: "Bangalore",
    jobRequiredSkills: ["TypeScript", "React", "Node.js"],
    jobRequiredExperience: 5,
    jobRequiredLocation: "Bangalore",
    ...overrides,
  };
}

/** Round to 4 decimal places like the service does. */
function r4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

// ─── Test suites ─────────────────────────────────────────────────────────────

describe("ScoringService — scoreCandidateForJob", () => {
  // ── 1. Mandatory Weighting Formula ──────────────────────────────────────

  describe("Mandatory formula: 50% Skill / 30% Exp / 20% Loc", () => {
    it("perfect match → finalScore = 1.0", () => {
      const result = scoreCandidateForJob(buildInput());
      expect(result.finalScore).toBe(1);
      expect(result.skillMatchScore).toBe(1);
      expect(result.experienceMatchScore).toBe(1);
      expect(result.locationMatchScore).toBe(1);
    });

    it("applies 0.5 weight to skill score", () => {
      // 2 of 4 skills → skill score = 0.5
      const result = scoreCandidateForJob(
        buildInput({
          candidateSkills: ["TypeScript", "React"],
          jobRequiredSkills: ["TypeScript", "React", "AWS", "Docker"],
          candidateExperience: 10,
          jobRequiredExperience: 5,
        })
      );
      // Skill = 0.5, Exp = 1.0 (capped), Loc = 1.0
      // Final = 0.5*0.5 + 0.3*1.0 + 0.2*1.0 = 0.25 + 0.30 + 0.20 = 0.75
      expect(result.skillMatchScore).toBe(0.5);
      expect(result.finalScore).toBe(0.75);
    });

    it("applies 0.3 weight to experience score", () => {
      // Half experience → exp score = 0.5
      const result = scoreCandidateForJob(
        buildInput({
          candidateExperience: 3,
          jobRequiredExperience: 6,
        })
      );
      // Skill = 1.0, Exp = 0.5, Loc = 1.0
      // Final = 0.5*1.0 + 0.3*0.5 + 0.2*1.0 = 0.50 + 0.15 + 0.20 = 0.85
      expect(result.experienceMatchScore).toBe(0.5);
      expect(result.finalScore).toBe(0.85);
    });

    it("applies 0.2 weight to location score", () => {
      // Location mismatch → loc score = 0
      const result = scoreCandidateForJob(
        buildInput({
          candidateLocation: "Mumbai",
          jobRequiredLocation: "Bangalore",
        })
      );
      // Skill = 1.0, Exp = 1.0, Loc = 0.0
      // Final = 0.5*1.0 + 0.3*1.0 + 0.2*0.0 = 0.50 + 0.30 + 0.00 = 0.80
      expect(result.locationMatchScore).toBe(0);
      expect(result.finalScore).toBe(0.8);
    });

    it("combined partial scores follow the formula precisely", () => {
      // 1/3 skills, 2/4 exp, location mismatch
      const result = scoreCandidateForJob(
        buildInput({
          candidateSkills: ["React"],
          jobRequiredSkills: ["React", "Vue", "Angular"],
          candidateExperience: 2,
          jobRequiredExperience: 4,
          candidateLocation: "Delhi",
          jobRequiredLocation: "Remote",
        })
      );
      // Skill = 1/3 ≈ 0.3333, Exp = 2/4 = 0.5, Loc = 0
      const expectedSkill = r4(1 / 3);
      const expectedFinal = r4(0.5 * expectedSkill + 0.3 * 0.5 + 0.2 * 0);
      expect(result.skillMatchScore).toBe(expectedSkill);
      expect(result.experienceMatchScore).toBe(0.5);
      expect(result.locationMatchScore).toBe(0);
      expect(result.finalScore).toBe(expectedFinal);
    });

    it("all zeros → finalScore = 0", () => {
      const result = scoreCandidateForJob(
        buildInput({
          candidateSkills: [],
          jobRequiredSkills: ["Python", "Go"],
          candidateExperience: 0,
          jobRequiredExperience: 5,
          candidateLocation: "Mars",
          jobRequiredLocation: "Earth",
        })
      );
      expect(result.skillMatchScore).toBe(0);
      expect(result.experienceMatchScore).toBe(0);
      expect(result.locationMatchScore).toBe(0);
      expect(result.finalScore).toBe(0);
    });
  });

  // ── 2. Experience Boundary Conditions ───────────────────────────────────

  describe("Experience boundaries", () => {
    it("candidate has exact required experience → score = 1.0", () => {
      const result = scoreCandidateForJob(
        buildInput({ candidateExperience: 5, jobRequiredExperience: 5 })
      );
      expect(result.experienceMatchScore).toBe(1);
    });

    it("candidate exceeds required experience → score capped at 1.0", () => {
      const result = scoreCandidateForJob(
        buildInput({ candidateExperience: 10, jobRequiredExperience: 3 })
      );
      expect(result.experienceMatchScore).toBe(1);
    });

    it("candidate has less than required experience → proportional score", () => {
      const result = scoreCandidateForJob(
        buildInput({ candidateExperience: 2, jobRequiredExperience: 8 })
      );
      // 2/8 = 0.25
      expect(result.experienceMatchScore).toBe(0.25);
    });

    it("candidate has 0 experience → score = 0 when job requires > 0", () => {
      const result = scoreCandidateForJob(
        buildInput({ candidateExperience: 0, jobRequiredExperience: 5 })
      );
      expect(result.experienceMatchScore).toBe(0);
    });

    it("job requires 0 experience → score defaults to 1.0", () => {
      const result = scoreCandidateForJob(
        buildInput({ candidateExperience: 0, jobRequiredExperience: 0 })
      );
      expect(result.experienceMatchScore).toBe(1);
    });

    it("job requires negative experience → score defaults to 1.0", () => {
      const result = scoreCandidateForJob(
        buildInput({ candidateExperience: 2, jobRequiredExperience: -1 })
      );
      expect(result.experienceMatchScore).toBe(1);
    });

    it("fractional experience is handled correctly", () => {
      const result = scoreCandidateForJob(
        buildInput({ candidateExperience: 2.5, jobRequiredExperience: 5 })
      );
      // 2.5/5 = 0.5
      expect(result.experienceMatchScore).toBe(0.5);
    });
  });

  // ── 3. Skill Overlap ───────────────────────────────────────────────────

  describe("Skill overlap", () => {
    it("no matching skills → skillMatchScore = 0", () => {
      const result = scoreCandidateForJob(
        buildInput({
          candidateSkills: ["Rust", "Go"],
          jobRequiredSkills: ["Python", "Java"],
        })
      );
      expect(result.skillMatchScore).toBe(0);
    });

    it("partial overlap → proportional score", () => {
      const result = scoreCandidateForJob(
        buildInput({
          candidateSkills: ["TypeScript", "Go"],
          jobRequiredSkills: ["TypeScript", "React", "Node.js", "Docker"],
        })
      );
      // 1/4 = 0.25
      expect(result.skillMatchScore).toBe(0.25);
    });

    it("full overlap → skillMatchScore = 1.0", () => {
      const result = scoreCandidateForJob(
        buildInput({
          candidateSkills: ["TypeScript", "React", "Node.js"],
          jobRequiredSkills: ["TypeScript", "React", "Node.js"],
        })
      );
      expect(result.skillMatchScore).toBe(1);
    });

    it("superset of skills → score still capped at 1.0", () => {
      const result = scoreCandidateForJob(
        buildInput({
          candidateSkills: ["TypeScript", "React", "Node.js", "AWS", "Docker", "Go"],
          jobRequiredSkills: ["TypeScript", "React"],
        })
      );
      // 2/2 = 1.0
      expect(result.skillMatchScore).toBe(1);
    });

    it("case-insensitive skill matching", () => {
      const result = scoreCandidateForJob(
        buildInput({
          candidateSkills: ["typescript", "REACT", "Node.JS"],
          jobRequiredSkills: ["TypeScript", "React", "Node.js"],
        })
      );
      expect(result.skillMatchScore).toBe(1);
    });

    it("whitespace-tolerant skill matching", () => {
      const result = scoreCandidateForJob(
        buildInput({
          candidateSkills: ["Type Script", " React ", "node.js"],
          jobRequiredSkills: ["TypeScript", "React", "Node.js"],
        })
      );
      expect(result.skillMatchScore).toBe(1);
    });

    it("job requires no skills → skillMatchScore defaults to 1.0", () => {
      const result = scoreCandidateForJob(
        buildInput({ jobRequiredSkills: [] })
      );
      expect(result.skillMatchScore).toBe(1);
    });

    it("candidate has no skills but job requires some → score = 0", () => {
      const result = scoreCandidateForJob(
        buildInput({
          candidateSkills: [],
          jobRequiredSkills: ["Python"],
        })
      );
      expect(result.skillMatchScore).toBe(0);
    });
  });

  // ── 4. Location Match ──────────────────────────────────────────────────

  describe("Location match", () => {
    it("exact match → locationMatchScore = 1", () => {
      const result = scoreCandidateForJob(
        buildInput({
          candidateLocation: "Bangalore",
          jobRequiredLocation: "Bangalore",
        })
      );
      expect(result.locationMatchScore).toBe(1);
    });

    it("case-insensitive match", () => {
      const result = scoreCandidateForJob(
        buildInput({
          candidateLocation: "bangalore",
          jobRequiredLocation: "BANGALORE",
        })
      );
      expect(result.locationMatchScore).toBe(1);
    });

    it("mismatch → locationMatchScore = 0", () => {
      const result = scoreCandidateForJob(
        buildInput({
          candidateLocation: "Mumbai",
          jobRequiredLocation: "Bangalore",
        })
      );
      expect(result.locationMatchScore).toBe(0);
    });

    it("empty job location → defaults to 1.0 (no constraint)", () => {
      const result = scoreCandidateForJob(
        buildInput({ jobRequiredLocation: "" })
      );
      expect(result.locationMatchScore).toBe(1);
    });

    it("empty candidate location → defaults to 1.0 (no constraint)", () => {
      const result = scoreCandidateForJob(
        buildInput({ candidateLocation: "" })
      );
      expect(result.locationMatchScore).toBe(1);
    });
  });

  // ── 5. Confidence Thresholds ───────────────────────────────────────────

  describe("Confidence thresholds", () => {
    it("finalScore >= 0.75 → HIGH confidence", () => {
      // Perfect match → 1.0
      const result = scoreCandidateForJob(buildInput());
      expect(result.confidence).toBe("HIGH");
    });

    it("finalScore = 0.75 exactly → HIGH confidence", () => {
      // 2/4 skills, full exp, full loc → 0.5*0.5 + 0.3*1 + 0.2*1 = 0.75
      const result = scoreCandidateForJob(
        buildInput({
          candidateSkills: ["TypeScript", "React"],
          jobRequiredSkills: ["TypeScript", "React", "AWS", "Docker"],
          candidateExperience: 10,
          jobRequiredExperience: 5,
        })
      );
      expect(result.finalScore).toBe(0.75);
      expect(result.confidence).toBe("HIGH");
    });

    it("finalScore in [0.45, 0.75) → MEDIUM confidence", () => {
      // 1/3 skills, full exp, full loc → 0.5*(1/3) + 0.3*1 + 0.2*1
      // = 0.1667 + 0.3 + 0.2 = 0.6667
      const result = scoreCandidateForJob(
        buildInput({
          candidateSkills: ["TypeScript"],
          jobRequiredSkills: ["TypeScript", "React", "Node.js"],
        })
      );
      expect(result.finalScore).toBeGreaterThanOrEqual(0.45);
      expect(result.finalScore).toBeLessThan(0.75);
      expect(result.confidence).toBe("MEDIUM");
    });

    it("finalScore = 0.45 exactly → MEDIUM confidence", () => {
      // Need: 0.5*s + 0.3*e + 0.2*l = 0.45
      // s=0.5, e=0, l=1 → 0.5*0.5 + 0.3*0 + 0.2*1 = 0.25 + 0 + 0.2 = 0.45
      const result = scoreCandidateForJob(
        buildInput({
          candidateSkills: ["React"],
          jobRequiredSkills: ["React", "Vue"],
          candidateExperience: 0,
          jobRequiredExperience: 5,
          candidateLocation: "Bangalore",
          jobRequiredLocation: "Bangalore",
        })
      );
      expect(result.finalScore).toBe(0.45);
      expect(result.confidence).toBe("MEDIUM");
    });

    it("finalScore < 0.45 → LOW confidence", () => {
      const result = scoreCandidateForJob(
        buildInput({
          candidateSkills: [],
          jobRequiredSkills: ["Python", "Java", "Go"],
          candidateExperience: 1,
          jobRequiredExperience: 10,
          candidateLocation: "Mars",
          jobRequiredLocation: "Earth",
        })
      );
      expect(result.finalScore).toBeLessThan(0.45);
      expect(result.confidence).toBe("LOW");
    });
  });

  // ── 6. Determinism ─────────────────────────────────────────────────────

  describe("Determinism", () => {
    it("same inputs always produce the same output", () => {
      const input = buildInput({
        candidateSkills: ["React", "TypeScript"],
        jobRequiredSkills: ["TypeScript", "React", "Docker"],
        candidateExperience: 3,
        jobRequiredExperience: 5,
        candidateLocation: "Mumbai",
        jobRequiredLocation: "Delhi",
      });

      const results: ScoringOutput[] = [];
      for (let i = 0; i < 100; i++) {
        results.push(scoreCandidateForJob(input));
      }

      const first = results[0];
      for (const r of results) {
        expect(r.finalScore).toBe(first.finalScore);
        expect(r.skillMatchScore).toBe(first.skillMatchScore);
        expect(r.experienceMatchScore).toBe(first.experienceMatchScore);
        expect(r.locationMatchScore).toBe(first.locationMatchScore);
        expect(r.confidence).toBe(first.confidence);
        expect(r.reason).toBe(first.reason);
      }
    });
  });

  // ── 7. Output Shape ────────────────────────────────────────────────────

  describe("Output shape", () => {
    it("returns all required fields", () => {
      const result = scoreCandidateForJob(buildInput());
      expect(result).toHaveProperty("skillMatchScore");
      expect(result).toHaveProperty("experienceMatchScore");
      expect(result).toHaveProperty("locationMatchScore");
      expect(result).toHaveProperty("finalScore");
      expect(result).toHaveProperty("confidence");
      expect(result).toHaveProperty("reason");
    });

    it("all scores are in [0, 1] range", () => {
      const result = scoreCandidateForJob(buildInput());
      for (const key of [
        "skillMatchScore",
        "experienceMatchScore",
        "locationMatchScore",
        "finalScore",
      ] as const) {
        expect(result[key]).toBeGreaterThanOrEqual(0);
        expect(result[key]).toBeLessThanOrEqual(1);
      }
    });

    it("confidence is one of HIGH | MEDIUM | LOW", () => {
      const result = scoreCandidateForJob(buildInput());
      expect(["HIGH", "MEDIUM", "LOW"]).toContain(result.confidence);
    });

    it("reason is a non-empty string", () => {
      const result = scoreCandidateForJob(buildInput());
      expect(typeof result.reason).toBe("string");
      expect(result.reason.length).toBeGreaterThan(0);
    });
  });
});
