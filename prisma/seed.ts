import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { DOMAINS, OFFICES, ROLE_BENCHMARKS, ROLES } from "../lib/domains";
import { generateHeuristic } from "../lib/llm/quizgen";
import { Difficulty, CourseSource, GenStatus } from "../lib/types";
import { QUESTIONS } from "./questionData";

const prisma = new PrismaClient();

const COURSES: {
  title: string;
  description: string;
  source: CourseSource;
  hours: number;
  mandatory?: boolean;
  domains: { code: string; weight: number }[];
}[] = [
  {
    title: "Sampling Techniques for Large-Scale Household Surveys",
    description: "Stratification, PPS selection, multi-stage designs and variance estimation.",
    source: "IGOT_KARMAYOGI",
    hours: 8,
    domains: [{ code: "NSTA-C1", weight: 1 }, { code: "NSTA-C2", weight: 0.3 }],
  },
  {
    title: "Managing Non-Response and Non-Sampling Error",
    description: "Response homogeneity groups, adjustment weights, casualty handling.",
    source: "MOSPI_NSTA",
    hours: 5,
    domains: [{ code: "NSTA-C2", weight: 1 }],
  },
  {
    title: "Field Supervision and Data Quality Assurance",
    description: "Applying sampling and non-sampling error control to day-to-day field supervision.",
    source: "MOSPI_NSTA",
    hours: 6,
    domains: [{ code: "NSTA-C2", weight: 0.7 }, { code: "NSTA-C1", weight: 0.4 }],
  },
  {
    title: "SDG Indicator Reporting: Tiers and Metadata",
    description: "Tier classification, custodian agencies, national metadata templates.",
    source: "IGOT_KARMAYOGI",
    hours: 4,
    domains: [{ code: "NSTA-C5", weight: 1 }],
  },
  {
    title: "SDG Localisation: India's National Indicator Framework",
    description: "How the NIF adapts the global SDG framework to national data sources.",
    source: "IGOT_KARMAYOGI",
    hours: 3,
    domains: [{ code: "NSTA-C5", weight: 1 }],
  },
  {
    title: "Applied Statistical Computing in R for Survey Data",
    description: "Weighted estimation, complex-design variance, reproducible pipelines.",
    source: "MOSPI_NSTA",
    hours: 7,
    domains: [{ code: "NSTA-C6", weight: 1 }, { code: "NSTA-C1", weight: 0.3 }],
  },
  {
    title: "Python for Official Statistics: Data Pipelines",
    description: "Reproducible ETL and estimation pipelines for official statistics production.",
    source: "IGOT_KARMAYOGI",
    hours: 6,
    domains: [{ code: "NSTA-C6", weight: 1 }, { code: "NSTA-C7", weight: 0.3 }],
  },
  {
    title: "Variance Estimation for Complex Survey Designs",
    description: "Taylor linearisation, jackknife and bootstrap methods for multi-stage samples.",
    source: "MOSPI_NSTA",
    hours: 6,
    domains: [{ code: "NSTA-C1", weight: 0.6 }, { code: "NSTA-C6", weight: 0.6 }],
  },
  {
    title: "Official Statistics: Confidentiality and Ethics",
    description: "Statistics Act obligations, micro-data release, disclosure control.",
    source: "IGOT_KARMAYOGI",
    hours: 3,
    mandatory: true,
    domains: [{ code: "NSTA-C8", weight: 1 }],
  },
  {
    title: "Statistical Disclosure Control for Micro-data Release",
    description: "Suppression, perturbation, and safe-release standards for unit-record files.",
    source: "IGOT_KARMAYOGI",
    hours: 4,
    domains: [{ code: "NSTA-C8", weight: 1 }, { code: "NSTA-C7", weight: 0.2 }],
  },
  {
    title: "National Accounts: Concepts and Compilation",
    description: "Production boundary, GVA compilation, deflators and base revision.",
    source: "IGOT_KARMAYOGI",
    hours: 6,
    domains: [{ code: "NSTA-C3", weight: 1 }],
  },
  {
    title: "Base Revision and National Accounts Splicing",
    description: "Re-weighting, re-basing, and communicating methodology breaks in a published series.",
    source: "MOSPI_NSTA",
    hours: 3,
    domains: [{ code: "NSTA-C3", weight: 0.8 }, { code: "NSTA-C7", weight: 0.3 }],
  },
  {
    title: "Consumer Price Index: Methodology and Practice",
    description: "Index number construction, weighting diagrams, price collection methodology.",
    source: "MOSPI_NSTA",
    hours: 5,
    domains: [{ code: "NSTA-C4", weight: 1 }],
  },
  {
    title: "Wholesale Price Index: Weighting and Collection",
    description: "WPI-specific weighting diagram construction and producer-price collection.",
    source: "MOSPI_NSTA",
    hours: 4,
    domains: [{ code: "NSTA-C4", weight: 0.9 }],
  },
  {
    title: "Effective Data Visualisation for Public Dashboards",
    description: "Publication standards, chart design, and honest representation of official data.",
    source: "IGOT_KARMAYOGI",
    hours: 4,
    domains: [{ code: "NSTA-C7", weight: 1 }],
  },
  {
    title: "Foundations of the National Statistical System",
    description: "Induction to the Official Statistical System, its mandate and its governing framework.",
    source: "IGOT_KARMAYOGI",
    hours: 2,
    mandatory: true,
    domains: [{ code: "NSTA-C1", weight: 0.2 }, { code: "NSTA-C8", weight: 0.2 }],
  },
];

const OFFICE_READINESS: Record<string, number> = {
  "NSO — Field Operations Division": 0.61,
  "NSO — Survey Design & Research": 0.78,
  "National Accounts Division": 0.69,
  "Price Statistics Division": 0.72,
  "State Directorate — Maharashtra": 0.52,
  "State Directorate — Assam": 0.47,
};

const FIRST_NAMES = ["Aarav", "Priya", "Rohan", "Sneha", "Vikram", "Ananya", "Karan", "Meera", "Arjun", "Divya", "Sanjay", "Neha", "Rahul", "Pooja", "Amit"];
const LAST_NAMES = ["Sharma", "Verma", "Iyer", "Nair", "Reddy", "Gupta", "Bose", "Menon", "Rao", "Kulkarni", "Joshi", "Chatterjee", "Pillai", "Desai"];

const SAMPLE_DOCUMENT_TEXT = `NSS 78th Round - Field Instruction Manual (Sample Excerpt)

Chapter 4: Sample Design and Selection

The survey follows a stratified multi-stage sample design. The first-stage units (FSUs) are villages in the rural sector, drawn from the latest Census frame, and urban frame survey blocks in the urban sector. Within each stratum, FSUs are selected with probability proportional to size using systematic sampling. This gives larger villages and blocks a proportionally higher chance of selection, which reduces the variance of the estimated totals when population sizes vary widely across first-stage units.

Chapter 5: Field Procedures and Non-Sampling Error

Investigators must minimise non-sampling error, which is defined as error arising from causes other than sampling itself, such as respondent recall lapses, interviewer bias, or data entry mistakes. A household that cannot be surveyed after repeated visits is recorded as a casualty. The manual instructs that a casualty must be handled by recording it as such and applying the prescribed substitution order, not by informal replacement with a convenient neighbouring household.

Multipliers computed for a stratum must be adjusted for non-response and casualty within the sub-sample before they are applied to raw counts. Failing to apply this adjustment introduces a systematic bias toward the characteristics of easy-to-reach respondents.

Chapter 7: Data Dissemination

Estimates from the round are released according to a pre-announced release calendar, and the same release standard is applied to all users simultaneously. This principle of simultaneous release is a cornerstone of the integrity of official statistics, and investigators and supervisors must not share provisional estimates with any party ahead of the public release date.

Chapter 9: Confidentiality

All individual schedules collected under this survey are protected under the Statistics Act framework. Data collected is used only for statistical purposes, and no individual response may be disclosed in any form that could identify the respondent. Any published table with a small, dominated cell must be suppressed or aggregated before release.`;

async function main() {
  const existing = await prisma.competencyDomain.count();
  if (existing > 0) {
    console.log("Already seeded (CompetencyDomain rows exist). Skipping. Run `npx prisma migrate reset` to start over.");
    return;
  }

  console.log("Seeding competency domains...");
  const domainRecords = await Promise.all(
    DOMAINS.map((d, i) =>
      prisma.competencyDomain.create({
        data: { code: d.code, name: d.name, description: d.description, order: i },
      })
    )
  );
  const domainByCode = new Map(domainRecords.map((d) => [d.code, d]));

  console.log("Seeding role benchmarks...");
  for (const role of ROLES) {
    const levels = ROLE_BENCHMARKS[role];
    for (const [code, requiredLevel] of Object.entries(levels)) {
      await prisma.roleBenchmark.create({
        data: { role, domainId: domainByCode.get(code)!.id, requiredLevel },
      });
    }
  }

  console.log("Seeding question bank...");
  const questionRecords = await Promise.all(
    QUESTIONS.map((q) =>
      prisma.question.create({
        data: {
          domainId: domainByCode.get(q.domain)!.id,
          text: q.text,
          options: JSON.stringify(q.options),
          correctIndex: q.correctIndex,
          difficulty: q.difficulty,
          explanation: q.explanation,
        },
      })
    )
  );

  console.log("Seeding course catalog...");
  for (const c of COURSES) {
    await prisma.course.create({
      data: {
        title: c.title,
        description: c.description,
        source: c.source,
        hours: c.hours,
        mandatory: c.mandatory ?? false,
        domains: {
          create: c.domains.map((d) => ({ domainId: domainByCode.get(d.code)!.id, weight: d.weight })),
        },
      },
    });
  }

  console.log("Seeding demo user (A. Venkatesan)...");
  const demoPasswordHash = await bcrypt.hash("demo1234", 10);
  const demoUser = await prisma.user.create({
    data: {
      name: "A. Venkatesan",
      employeeId: "MOSPI-00001",
      passwordHash: demoPasswordHash,
      role: "Deputy Director, NSO Field Ops",
      office: "NSO — Field Operations Division",
      isAdmin: true,
    },
  });

  // Demo diagnostic: correctness pattern per domain chosen to land on the
  // same current levels used throughout the original design mock, so the
  // dashboard is populated meaningfully on first login.
  const DEMO_PATTERN: Record<string, { EASY: boolean; MODERATE: boolean; HARD: boolean }> = {
    "NSTA-C1": { EASY: true, MODERATE: true, HARD: false }, // -> level 3
    "NSTA-C2": { EASY: false, MODERATE: true, HARD: false }, // -> level 2
    "NSTA-C3": { EASY: true, MODERATE: true, HARD: false }, // -> level 3
    "NSTA-C4": { EASY: false, MODERATE: true, HARD: true }, // -> level 4
    "NSTA-C5": { EASY: false, MODERATE: true, HARD: false }, // -> level 2
    "NSTA-C6": { EASY: true, MODERATE: true, HARD: false }, // -> level 3
    "NSTA-C7": { EASY: false, MODERATE: true, HARD: true }, // -> level 4
    "NSTA-C8": { EASY: true, MODERATE: true, HARD: false }, // -> level 3
  };

  const attempt = await prisma.assessmentAttempt.create({
    data: { userId: demoUser.id, status: "COMPLETED", completedAt: new Date() },
  });

  let orderIndex = 0;
  const TIER_WEIGHT: Record<Difficulty, number> = { EASY: 1, MODERATE: 2, HARD: 3 };
  for (const domain of DOMAINS) {
    const pattern = DEMO_PATTERN[domain.code];
    let earned = 0;
    for (const difficulty of ["MODERATE", "HARD", "EASY"] as Difficulty[]) {
      const q = questionRecords.find((q) => q.domainId === domainByCode.get(domain.code)!.id && q.difficulty === difficulty)!;
      const correct = pattern[difficulty];
      const pickedIndex = correct ? q.correctIndex : (q.correctIndex + 1) % 4;
      await prisma.assessmentAnswer.create({
        data: {
          attemptId: attempt.id,
          questionId: q.id,
          domainId: q.domainId,
          orderIndex: orderIndex++,
          pickedIndex,
          correct,
          difficulty,
        },
      });
      if (correct) earned += TIER_WEIGHT[difficulty];
    }
    const ratio = earned / 6;
    const level = Math.min(5, Math.max(1, Math.round(1 + ratio * 4)));
    await prisma.competencyScore.create({
      data: { userId: demoUser.id, domainId: domainByCode.get(domain.code)!.id, attemptId: attempt.id, level, ratio, isCurrent: true },
    });
  }

  console.log("Generating demo learning path...");
  const { generateLearningPath } = await import("../lib/recommend");
  const path = await generateLearningPath(demoUser.id, attempt.id);
  if (path.items[0]) {
    await prisma.enrollment.update({
      where: { userId_courseId: { userId: demoUser.id, courseId: path.items[0].courseId } },
      data: { status: "IN_PROGRESS", progressPct: 62 },
    });
  }

  // Baseline mandatory training the demo user completed before onboarding
  // onto this platform, so the overview dashboard isn't empty on first look.
  const priorCourses = await prisma.course.findMany({ where: { mandatory: true } });
  for (const course of priorCourses) {
    await prisma.enrollment.upsert({
      where: { userId_courseId: { userId: demoUser.id, courseId: course.id } },
      create: { userId: demoUser.id, courseId: course.id, status: "COMPLETED", progressPct: 100, completedAt: new Date() },
      update: { status: "COMPLETED", progressPct: 100, completedAt: new Date() },
    });
  }

  console.log("Seeding synthetic office cohort for admin analytics...");
  let empCounter = 2;
  for (const office of OFFICES) {
    const readiness = OFFICE_READINESS[office];
    for (let i = 0; i < 15; i++) {
      const role = ROLES[Math.floor(Math.random() * ROLES.length)];
      const first = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
      const last = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
      const user = await prisma.user.create({
        data: {
          name: `${first} ${last}`,
          employeeId: `MOSPI-${String(empCounter++).padStart(5, "0")}`,
          passwordHash: demoPasswordHash,
          role,
          office,
        },
      });

      const wasDiagnosed = Math.random() < 0.66;
      if (!wasDiagnosed) continue;

      const benchmark = ROLE_BENCHMARKS[role];
      const meetsBenchmark = Math.random() < readiness;
      const weakDomainCount = meetsBenchmark ? 0 : 1 + Math.floor(Math.random() * 4);
      const weakDomains = new Set(
        [...DOMAINS].sort(() => Math.random() - 0.5).slice(0, weakDomainCount).map((d) => d.code)
      );

      for (const domain of DOMAINS) {
        const required = benchmark[domain.code as keyof typeof benchmark];
        const isWeak = weakDomains.has(domain.code);
        const drop = isWeak ? 1 + Math.floor(Math.random() * 2) : 0;
        const level = Math.min(5, Math.max(1, required - drop));
        await prisma.competencyScore.create({
          data: {
            userId: user.id,
            domainId: domainByCode.get(domain.code)!.id,
            level,
            ratio: (level - 1) / 4,
            isCurrent: true,
          },
        });
      }
    }
  }

  console.log("Seeding a sample parsed document with generated MCQs for Quiz Studio...");
  const domainRefs = domainRecords.map((d) => ({ id: d.id, code: d.code, name: d.name, description: d.description }));
  const drafts = generateHeuristic(SAMPLE_DOCUMENT_TEXT, domainRefs, 5, 214);
  const conceptCount = new Set(SAMPLE_DOCUMENT_TEXT.match(/\b[A-Z][a-zA-Z]{4,}\b/g)).size;

  const document = await prisma.document.create({
    data: {
      userId: demoUser.id,
      filename: "NSS 78th Round — Instruction Manual.pdf",
      mimeType: "application/pdf",
      sizeBytes: 842_213,
      pageCount: 214,
      conceptCount,
      extractedText: SAMPLE_DOCUMENT_TEXT,
      status: "PARSED",
    },
  });

  for (const [i, d] of drafts.entries()) {
    await prisma.generatedQuestion.create({
      data: {
        documentId: document.id,
        domainId: d.domainId,
        text: d.text,
        options: JSON.stringify(d.options),
        correctIndex: d.correctIndex,
        difficulty: d.difficulty,
        page: d.page,
        status: (i < 3 ? "APPROVED" : "DRAFT") satisfies GenStatus,
        generatedBy: "heuristic",
      },
    });
  }

  console.log("Seed complete.");
  console.log(`Demo login -> Employee ID: MOSPI-00001, password: demo1234`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
