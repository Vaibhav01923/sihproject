// Single source of truth for the NSTA competency framework used across the
// seed script, scoring engine, and UI. Levels are 1-5.

export const DOMAINS = [
  {
    code: "NSTA-C1",
    name: "Survey design & sampling",
    description:
      "Stratification, multi-stage and PPS selection, sample size and variance estimation for large-scale surveys.",
  },
  {
    code: "NSTA-C2",
    name: "Non-sampling error control",
    description:
      "Non-response treatment, casualty handling, response homogeneity groups, and field supervision quality checks.",
  },
  {
    code: "NSTA-C3",
    name: "National accounts statistics",
    description:
      "Production boundary, GVA compilation, base-year revision, and deflator construction.",
  },
  {
    code: "NSTA-C4",
    name: "Price statistics (CPI / WPI)",
    description:
      "Index number construction, weighting diagrams, and price collection methodology.",
  },
  {
    code: "NSTA-C5",
    name: "SDG indicator framework",
    description:
      "Tier classification, custodian agencies, and national metadata reporting templates.",
  },
  {
    code: "NSTA-C6",
    name: "Statistical computing (R / Python)",
    description:
      "Weighted estimation, complex-design variance, and reproducible analysis pipelines.",
  },
  {
    code: "NSTA-C7",
    name: "Data dissemination & visualisation",
    description:
      "Publication standards, revision policy, and effective statistical communication.",
  },
  {
    code: "NSTA-C8",
    name: "Confidentiality & statistical ethics",
    description:
      "Statistics Act obligations, micro-data release rules, and disclosure control.",
  },
] as const;

export type DomainCode = (typeof DOMAINS)[number]["code"];

export const OFFICES = [
  "NSO — Field Operations Division",
  "NSO — Survey Design & Research",
  "National Accounts Division",
  "Price Statistics Division",
  "State Directorate — Maharashtra",
  "State Directorate — Assam",
] as const;

// Required level (1-5) per domain, keyed by designation. Represents the
// NSTA role-competency mapping. New users pick one of these at registration.
export const ROLE_BENCHMARKS: Record<string, Record<DomainCode, number>> = {
  "Deputy Director, NSO Field Ops": {
    "NSTA-C1": 5,
    "NSTA-C2": 4,
    "NSTA-C3": 4,
    "NSTA-C4": 4,
    "NSTA-C5": 3,
    "NSTA-C6": 4,
    "NSTA-C7": 4,
    "NSTA-C8": 3,
  },
  "Assistant Director, Survey Design": {
    "NSTA-C1": 5,
    "NSTA-C2": 4,
    "NSTA-C3": 3,
    "NSTA-C4": 3,
    "NSTA-C5": 3,
    "NSTA-C6": 5,
    "NSTA-C7": 3,
    "NSTA-C8": 3,
  },
  "Senior Statistical Officer, National Accounts": {
    "NSTA-C1": 3,
    "NSTA-C2": 3,
    "NSTA-C3": 5,
    "NSTA-C4": 4,
    "NSTA-C5": 3,
    "NSTA-C6": 4,
    "NSTA-C7": 4,
    "NSTA-C8": 3,
  },
  "Statistical Officer, State Directorate": {
    "NSTA-C1": 3,
    "NSTA-C2": 3,
    "NSTA-C3": 2,
    "NSTA-C4": 2,
    "NSTA-C5": 2,
    "NSTA-C6": 3,
    "NSTA-C7": 3,
    "NSTA-C8": 3,
  },
};

export const ROLES = Object.keys(ROLE_BENCHMARKS);

export function priorityForGap(current: number, required: number): "CRITICAL" | "HIGH" | "MODERATE" | "MET" {
  const gap = required - current;
  if (gap >= 2) return "CRITICAL";
  if (gap === 1) return "HIGH";
  if (gap === 0) return "MET";
  return "MET"; // current exceeds required
}

export const PRIORITY_COLOR: Record<string, string> = {
  CRITICAL: "oklch(0.52 0.13 25)",
  HIGH: "oklch(0.62 0.11 70)",
  MODERATE: "oklch(0.45 0.09 245)",
  MET: "oklch(0.52 0.09 152)",
};
