import { prisma } from "../lib/prisma";
import { wizardConfigV1 } from "../lib/wizard/config";

const wizardId = "course_map_v1";
const version = 1;

type RubricRow = {
  stepId: string;
  json: any;
};

const rubrics: RubricRow[] = [
  {
    stepId: "s1_outcomes",
    json: {
      id: "r_outcomes_v1",
      applies_to_step: "s1_outcomes",
      hard_gate: true,
      required_checks: ["measurable_verb", "single_performance", "learner_centered", "assessable"],
      scores: {
        clarity: { min: 1, max: 5, pass_min: 4 },
        measurability: { min: 1, max: 5, pass_min: 4 }
      },
      flags: ["scope_risk", "prereq_risk"],
      banned_verbs: ["understand", "learn", "be familiar with", "know", "appreciate"]
    }
  },
  {
    stepId: "s2_evidence",
    json: {
      id: "r_evidence_v1",
      applies_to_step: "s2_evidence",
      hard_gate: true,
      required_checks: ["evidence_present_per_outcome", "alignment_to_verb", "feasible"],
      scores: {
        alignment: { min: 1, max: 5, pass_min: 4 }
      },
      flags: ["grading_burden_risk", "accessibility_risk"]
    }
  },
  {
    stepId: "s3_learners",
    json: {
      id: "r_learners_v1",
      applies_to_step: "s3_learners",
      hard_gate: false,
      required_checks: [],
      scores: {},
      flags: ["missing_prereqs"]
    }
  },
  {
    stepId: "s4_materials",
    json: {
      id: "r_materials_v1",
      applies_to_step: "s4_materials",
      hard_gate: false,
      required_checks: [],
      scores: {},
      flags: ["licensing_risk", "accessibility_risk", "currency_risk"]
    }
  },
  {
    stepId: "s5_modules",
    json: {
      id: "r_modules_v1",
      applies_to_step: "s5_modules",
      hard_gate: true,
      required_checks: ["covers_all_outcomes", "non_duplicate_modules", "coherent_sequence"],
      scores: {
        coherence: { min: 1, max: 5, pass_min: 4 }
      },
      flags: ["scope_risk"]
    }
  },
  {
    stepId: "s6_practice",
    json: {
      id: "r_practice_v1",
      applies_to_step: "s6_practice",
      hard_gate: false,
      required_checks: [],
      scores: {},
      flags: ["insufficient_practice"]
    }
  }
];

async function main() {
  // Seed wizard config
  await prisma.wizardConfig.upsert({
    where: { id: `${wizardId}:${version}` },
    update: {
      wizardId,
      version,
      json: wizardConfigV1 as any
    },
    create: {
      id: `${wizardId}:${version}`,
      wizardId,
      version,
      json: wizardConfigV1 as any
    }
  });

  // Seed rubrics
  for (const r of rubrics) {
    const id = `${wizardId}:${version}:${r.stepId}`;
    await prisma.rubric.upsert({
      where: { id },
      update: { wizardId, version, stepId: r.stepId, json: r.json },
      create: { id, wizardId, version, stepId: r.stepId, json: r.json }
    });
  }

  // eslint-disable-next-line no-console
  console.log(`Seeded wizard config + ${rubrics.length} rubrics for ${wizardId} v${version}`);
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
