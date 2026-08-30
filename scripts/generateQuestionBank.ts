// One-off script: drafts 5 additional questions per (domain x difficulty)
// slot via the OpenAI API, so the diagnostic has a real pool instead of one
// fixed question per slot. Output is written to a JSON file for manual
// review - nothing here writes to the database or the seed script directly,
// since a wrong answer key would silently corrupt scoring.
//
// Run with: set -a; source .env; set +a; npx tsx scripts/generateQuestionBank.ts

import OpenAI from "openai";
import { writeFileSync } from "fs";
import { DOMAINS } from "../lib/domains";
import { QUESTIONS as EXISTING } from "../db/questionData";

const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

type Difficulty = "EASY" | "MODERATE" | "HARD";

type DraftQuestion = {
  domain: string;
  difficulty: Difficulty;
  text: string;
  options: [string, string, string, string];
  correctIndex: number;
  explanation: string;
};

async function generateForDomain(client: OpenAI, domain: (typeof DOMAINS)[number]): Promise<DraftQuestion[]> {
  const existingForDomain = EXISTING.filter((q) => q.domain === domain.code);
  const existingText = existingForDomain.map((q) => `- (${q.difficulty}) ${q.text}`).join("\n");

  const tool: OpenAI.Chat.ChatCompletionTool = {
    type: "function",
    function: {
      name: "emit_questions",
      description: "Emit newly drafted multiple-choice diagnostic questions.",
      parameters: {
        type: "object",
        properties: {
          questions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                difficulty: { type: "string", enum: ["EASY", "MODERATE", "HARD"] },
                text: { type: "string" },
                options: { type: "array", items: { type: "string" }, minItems: 4, maxItems: 4 },
                correctIndex: { type: "integer", minimum: 0, maximum: 3 },
                explanation: { type: "string", description: "One sentence on why the correct answer is right." },
              },
              required: ["difficulty", "text", "options", "correctIndex", "explanation"],
            },
          },
        },
        required: ["questions"],
      },
    },
  };

  const completion = await client.chat.completions.create({
    model: MODEL,
    tools: [tool],
    tool_choice: { type: "function", function: { name: "emit_questions" } },
    messages: [
      {
        role: "user",
        content: `You are writing diagnostic assessment questions for a competency test taken by officials in India's Official Statistical System (MoSPI/NSSO), for the domain "${domain.name}" (${domain.description}).

Write exactly 5 EASY, 5 MODERATE, and 5 HARD multiple-choice questions (15 total) that test genuine technical understanding of this domain, suitable for a government statistician. Each needs exactly 4 options with exactly one unambiguously correct answer - no "all of the above" / "none of the above" options, no trick questions, no ambiguity. EASY should be testable by someone with basic exposure to the topic; HARD should require real applied understanding, not just recall.

Do not repeat or closely rephrase any of these existing questions already in the bank for this domain:
${existingText || "(none yet)"}

Write in the same register as those existing questions: precise, technical, realistic scenarios from Indian official statistics practice where relevant.`,
      },
    ],
  });

  const toolCall = completion.choices[0]?.message.tool_calls?.[0];
  if (!toolCall || toolCall.type !== "function") throw new Error(`No structured output for ${domain.code}`);
  const parsed = JSON.parse(toolCall.function.arguments) as { questions: Omit<DraftQuestion, "domain">[] };

  return parsed.questions.map((q) => ({ ...q, domain: domain.code }));
}

async function main() {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const all: DraftQuestion[] = [];

  for (const domain of DOMAINS) {
    console.log(`Generating for ${domain.code} - ${domain.name}...`);
    const drafted = await generateForDomain(client, domain);
    console.log(`  got ${drafted.length} questions`);
    all.push(...drafted);
  }

  const outPath = "scripts/questionBank.draft.json";
  writeFileSync(outPath, JSON.stringify(all, null, 2));
  console.log(`\nWrote ${all.length} drafted questions to ${outPath}`);
  console.log("Review before merging into db/questionData.ts");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
