// Applies manual review fixes to the LLM-drafted question bank, then merges
// it with the hand-written original 24 into prisma/questionData.ts. See the
// review notes in the conversation for why each patch below exists - these
// are answer-key bugs and ambiguous options found by manual review, not
// stylistic nitpicks.

import { readFileSync, writeFileSync } from "fs";
import { QUESTIONS as ORIGINAL } from "../prisma/questionData";

type Draft = {
  domain: string;
  difficulty: "EASY" | "MODERATE" | "HARD";
  text: string;
  options: [string, string, string, string];
  correctIndex: number;
  explanation: string;
};

const draft: Draft[] = JSON.parse(readFileSync("scripts/questionBank.draft.json", "utf-8"));

// --- Patch 1: wrong answer key (explanation names a different option than correctIndex points to)
const p1 = draft.find((q) => q.text.startsWith("In terms of field supervision, what kind of corrective measures"));
if (!p1) throw new Error("Patch 1 target not found");
p1.correctIndex = 2; // "Provide targeted retraining and feedback sessions" - matches the explanation

// --- Patch 2: wrong definition (Tier II's definition was mislabelled as Tier III)
const p2 = draft.find((q) => q.text.includes("what does Tier III classification signify"));
if (!p2) throw new Error("Patch 2 target not found");
p2.options = [
  "No internationally established methodology or standard yet exists for the indicator",
  "Indicator has an established methodology but data are not yet regularly produced",
  "Indicator is regularly produced and available for at least half of countries",
  "Indicator has been retired from the global SDG framework",
];
p2.correctIndex = 0;
p2.explanation =
  "Tier III means no internationally established methodology or standard is yet available for the indicator - methodology is still under development. (Tier II is 'established but not regularly produced'; Tier I is 'established and regularly produced'.)";

// --- Patch 3: "All of the above" option, and arguably the better answer
const p3 = draft.find((q) => q.text.startsWith("Which of the following methods is commonly used for handling missing responses"));
if (!p3) throw new Error("Patch 3 target not found");
p3.text =
  "Which term describes adjusting sampling weights so that non-respondents' characteristics are represented by similar respondents who did answer?";
p3.options = ["Non-response weighting adjustment", "Data entry validation", "Questionnaire pilot testing", "Sample frame updating"];
p3.correctIndex = 0;
p3.explanation = "Non-response weighting adjustment redistributes the weight of non-responding units onto responding units with similar characteristics.";

// --- Patch 4: two near-synonymous options
const p4 = draft.find((q) => q.text.startsWith("In multi-stage sampling, the primary sampling units (PSUs) are typically selected first"));
if (!p4) throw new Error("Patch 4 target not found");
p4.options = [
  "Select every unit within each sampled PSU with certainty",
  "Select a further sample of sub-units (second-stage units) from within each sampled PSU",
  "Discard the PSUs and draw an entirely fresh sample from the full population",
  "Stop sampling once the PSUs are selected",
];
p4.correctIndex = 1;
p4.explanation =
  "Multi-stage sampling proceeds by drawing a further sample of second-stage units from within each already-selected PSU, rather than enumerating every unit in it.";

// --- Patch 5: incoherent "negative deflator" premise
const p5 = draft.find((q) => q.text.startsWith("What is the impact of a negative deflator"));
if (!p5) throw new Error("Patch 5 target not found");
p5.text =
  "If the GVA deflator for an industry rises faster than its nominal GVA growth in a given year, what does this imply about real GVA?";
p5.options = [
  "Real GVA grew, just more slowly than nominal GVA",
  "Real GVA for that industry contracted (fell) in that year",
  "Real GVA is unaffected by the deflator",
  "Real GVA growth cannot be determined in this case",
];
p5.correctIndex = 1;
p5.explanation = "If prices (the deflator) rise faster than nominal output, deflating (removing price effects) reveals a decline in real (volume) output.";

// --- Merge and emit ---

function tsQuote(s: string) {
  return JSON.stringify(s);
}

function emit(q: Draft) {
  return `  {
    domain: ${tsQuote(q.domain)},
    difficulty: ${tsQuote(q.difficulty)},
    text: ${tsQuote(q.text)},
    options: [${q.options.map(tsQuote).join(", ")}],
    correctIndex: ${q.correctIndex},
    explanation: ${tsQuote(q.explanation)},
  },`;
}

const header = `import { Difficulty } from "../lib/types";

export type QSeed = {
  domain: string;
  difficulty: Difficulty;
  text: string;
  options: [string, string, string, string];
  correctIndex: number;
  explanation: string;
};

// 8 domains x 6 questions per difficulty tier (2 easy/moderate/hard sets)
// = a real pool instead of one fixed question per slot, so retaking the
// diagnostic draws a different (but equally valid) question each time.
// The first question per domain+difficulty is the original hand-written
// set; the rest were drafted with an LLM and manually reviewed/patched -
// see scripts/generateQuestionBank.ts and scripts/mergeQuestionBank.ts.
export const QUESTIONS: QSeed[] = [
`;

const originalBlock = ORIGINAL.map(emit).join("\n");
const draftBlock = draft.map(emit).join("\n");

const out = header + originalBlock + "\n" + draftBlock + "\n];\n";
writeFileSync("prisma/questionData.ts", out);
console.log(`Wrote ${ORIGINAL.length + draft.length} total questions to prisma/questionData.ts`);
