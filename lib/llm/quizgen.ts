import OpenAI from "openai";

export type DomainRef = { id: string; code: string; name: string; description: string };

export type QuestionDraft = {
  text: string;
  options: [string, string, string, string];
  correctIndex: number;
  difficulty: "EASY" | "MODERATE" | "HARD";
  domainId: string | null;
  page: number | null;
};

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

export function llmAvailable() {
  return Boolean(OPENAI_API_KEY);
}

export async function generateQuestions(
  text: string,
  domains: DomainRef[],
  count: number,
  pageCount: number | null
): Promise<{ questions: QuestionDraft[]; generatedBy: string }> {
  if (llmAvailable()) {
    try {
      const questions = await generateWithLLM(text, domains, count, pageCount);
      return { questions, generatedBy: `llm:${MODEL}` };
    } catch (err) {
      console.error("LLM quiz generation failed, falling back to heuristic:", err);
    }
  }
  return { questions: generateHeuristic(text, domains, count, pageCount), generatedBy: "heuristic" };
}

// --- LLM-backed generation --------------------------------------------------

async function generateWithLLM(
  text: string,
  domains: DomainRef[],
  count: number,
  pageCount: number | null
): Promise<QuestionDraft[]> {
  const client = new OpenAI({ apiKey: OPENAI_API_KEY });
  const domainList = domains.map((d) => `${d.code}: ${d.name} - ${d.description}`).join("\n");
  const truncated = text.slice(0, 40000); // keep prompt + cost bounded for a prototype

  const tool: OpenAI.Chat.ChatCompletionTool = {
    type: "function",
    function: {
      name: "emit_questions",
      description: "Emit the generated multiple-choice questions.",
      parameters: {
        type: "object",
        properties: {
          questions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                text: { type: "string", description: "The question stem." },
                options: {
                  type: "array",
                  items: { type: "string" },
                  minItems: 4,
                  maxItems: 4,
                  description: "Exactly four answer options.",
                },
                correctIndex: { type: "integer", minimum: 0, maximum: 3 },
                difficulty: { type: "string", enum: ["EASY", "MODERATE", "HARD"] },
                domainCode: {
                  type: "string",
                  description: "Best-matching competency domain code from the provided list, or \"NONE\".",
                },
                approxPage: {
                  type: "integer",
                  description: pageCount
                    ? `Best-guess source page number, 1 to ${pageCount}.`
                    : "Best-guess source page number, or 1 if unknown.",
                },
              },
              required: ["text", "options", "correctIndex", "difficulty", "domainCode"],
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
        content: `You are helping build a training-assessment tool for officials in India's Official Statistical System (MoSPI). Read the source material below and write exactly ${count} multiple-choice questions that test genuine understanding of it (not trivia about formatting). Each question needs 4 plausible options with exactly one correct answer, a difficulty rating, and the single best-matching competency domain from this list (use "NONE" if nothing fits well):

${domainList}

Source material:
"""
${truncated}
"""`,
      },
    ],
  });

  const toolCall = completion.choices[0]?.message.tool_calls?.[0];
  if (!toolCall || toolCall.type !== "function") throw new Error("Model did not return structured output");
  type RawQuestion = {
    text: string;
    options: unknown;
    correctIndex: unknown;
    difficulty: string;
    domainCode: string;
    approxPage?: number;
  };
  const input = JSON.parse(toolCall.function.arguments) as { questions: RawQuestion[] };

  const domainByCode = new Map(domains.map((d) => [d.code, d.id]));
  return input.questions.slice(0, count).map((q) => ({
    text: String(q.text),
    options: normaliseOptions(q.options),
    correctIndex: clampIndex(q.correctIndex),
    difficulty: (["EASY", "MODERATE", "HARD"].includes(q.difficulty) ? q.difficulty : "MODERATE") as QuestionDraft["difficulty"],
    domainId: domainByCode.get(q.domainCode) ?? null,
    page: pageCount && q.approxPage ? Math.min(pageCount, Math.max(1, Math.round(q.approxPage))) : null,
  }));
}

function normaliseOptions(options: unknown): [string, string, string, string] {
  const arr = Array.isArray(options) ? options.map(String) : [];
  while (arr.length < 4) arr.push("None of the above");
  return [arr[0], arr[1], arr[2], arr[3]];
}

function clampIndex(i: unknown) {
  const n = Number(i);
  return Number.isInteger(n) && n >= 0 && n <= 3 ? n : 0;
}

// --- Heuristic fallback (no API key needed) --------------------------------
//
// Cloze-deletion generation: find concept-bearing sentences, blank out their
// most salient term, and build distractors from other salient terms found
// elsewhere in the document. Works fully offline; used automatically when
// OPENAI_API_KEY is not configured, or if the LLM call fails.

const STOPWORDS = new Set(
  "the a an of to and in on for is are was were be been being this that these those as by with from at into over under between within about which who whom whose it its their his her they he she we you your our not no shall must may can will would should could than then also such more most less least each per".split(
    " "
  )
);

// Line breaks are treated as hard sentence boundaries *before* punctuation
// splitting, otherwise an unpunctuated heading ("Chapter 5: Field Procedures")
// silently glues onto the next paragraph's first sentence once whitespace is
// collapsed, producing nonsensical cloze blanks.
export function splitSentences(text: string): string[] {
  return text
    .split(/\n+/)
    .flatMap((line) =>
      line
        .replace(/\s+/g, " ")
        .trim()
        .split(/(?<=[.!?])\s+(?=[A-Z0-9])/)
    )
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function estimateConceptCount(text: string): number {
  const sentences = splitSentences(text);
  const terms = new Set<string>();
  for (const s of sentences) for (const t of salientTerms(s)) terms.add(t.toLowerCase());
  return terms.size;
}

function salientTerms(sentence: string): string[] {
  const words = sentence.match(/[A-Za-z][A-Za-z\-]{2,}/g) ?? [];
  const candidates = new Set<string>();
  // Multi-word capitalised phrases (likely proper nouns / technical terms)
  const phraseMatches = sentence.match(/\b([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){0,2})\b/g) ?? [];
  for (const p of phraseMatches) if (p.split(" ").length <= 3) candidates.add(p);
  // Standalone longer lowercase content words
  for (const w of words) {
    const lw = w.toLowerCase();
    if (w.length >= 6 && !STOPWORDS.has(lw)) candidates.add(w);
  }
  return Array.from(candidates);
}

function scoreSentence(sentence: string): number {
  const wordCount = sentence.split(" ").length;
  if (wordCount < 8 || wordCount > 40) return 0;
  let score = 0;
  if (/\b(is defined as|refers to|is known as|means|is calculated as|consists of|is measured by)\b/i.test(sentence)) score += 3;
  if (/\d/.test(sentence)) score += 1;
  score += Math.min(2, salientTerms(sentence).length * 0.5);
  return score;
}

function domainForSentence(sentence: string, domains: DomainRef[]): string | null {
  const lower = sentence.toLowerCase();
  let best: { id: string; score: number } | null = null;
  for (const d of domains) {
    const keywords = `${d.name} ${d.description}`.toLowerCase().match(/[a-z]{4,}/g) ?? [];
    let score = 0;
    for (const kw of new Set(keywords)) if (lower.includes(kw)) score += 1;
    if (score > 0 && (!best || score > best.score)) best = { id: d.id, score };
  }
  return best?.id ?? null;
}

export function generateHeuristic(text: string, domains: DomainRef[], count: number, pageCount: number | null): QuestionDraft[] {
  const sentences = splitSentences(text);
  const scored = sentences
    .map((s, idx) => ({ s, idx, score: scoreSentence(s) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  // Global term pool for distractors, harvested from the whole document.
  const globalTerms = Array.from(new Set(sentences.flatMap(salientTerms))).filter((t) => t.length <= 32);

  const questions: QuestionDraft[] = [];
  const usedSentences = new Set<number>();

  for (const candidate of scored) {
    if (questions.length >= count) break;
    if (usedSentences.has(candidate.idx)) continue;
    const terms = salientTerms(candidate.s).sort((a, b) => b.length - a.length);
    if (terms.length === 0) continue;
    const answer = terms[0];

    const distractorPool = globalTerms.filter(
      (t) => t.toLowerCase() !== answer.toLowerCase() && !candidate.s.includes(t)
    );
    if (distractorPool.length < 3) continue;
    const distractors = shuffle(distractorPool).slice(0, 3);

    const blanked = candidate.s.replace(new RegExp(escapeRegExp(answer)), "_____");
    if (blanked === candidate.s) continue; // safety: blank must have applied

    const options = shuffle([answer, ...distractors]);
    const correctIndex = options.indexOf(answer);
    const wordCount = candidate.s.split(" ").length;

    questions.push({
      text: `Fill in the blank: "${blanked}"`,
      options: [options[0], options[1], options[2], options[3]],
      correctIndex,
      difficulty: wordCount > 25 ? "HARD" : answer.length <= 8 ? "EASY" : "MODERATE",
      domainId: domainForSentence(candidate.s, domains),
      page: pageCount ? Math.min(pageCount, Math.max(1, Math.round(((candidate.idx + 1) / sentences.length) * pageCount))) : null,
    });
    usedSentences.add(candidate.idx);
  }

  return questions;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
