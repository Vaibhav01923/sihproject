# Sankhya Kaushal

**SIH26101** — an AI-enabled learning platform that identifies competency gaps,
recommends personalised training through integration with the iGOT Karmayogi
ecosystem, and generates quizzes/MCQs from uploaded learning material, to
strengthen capacity building in India's Official Statistical System (MoSPI /
NSTA).

This is a working prototype, not a mockup: every screen is backed by a real
database, a real (non-fake) adaptive scoring engine, a real recommendation
engine, and real PDF-to-MCQ generation.

## Quick start

```bash
npm install
cp .env.example .env      # defaults work as-is (SQLite, no API keys needed)
npx prisma migrate dev    # creates the local SQLite DB and runs it once
npm run dev                # http://localhost:3000
```

Log in with the seeded demo account:

- **Employee ID:** `MOSPI-00001`
- **Password:** `demo1234`

To start over with a fresh seed at any point: `npx prisma migrate reset --force`.

## What's real vs. simulated, and why

| Piece | Status | Why |
|---|---|---|
| Auth, diagnostic, scoring, gap analysis, recommendations, learning path | **Real** | All computed from the database, nothing hardcoded |
| Quiz generation from uploaded PDFs/text | **Real**, two modes | See below |
| AI tutor chat grounded in a document | **Real**, two modes | See below |
| iGOT Karmayogi integration | **Simulated by default** | See below |

**Quiz generation & AI tutor** run on the OpenAI API if `OPENAI_API_KEY` is
set in `.env`. If it's not set, both features fall back to a fully offline,
genuinely-functioning alternative rather than failing:
- Quiz generation falls back to a **cloze-deletion heuristic** (`lib/llm/quizgen.ts`):
  it scores sentences for "concept density" (definition phrasing, numbers,
  salient terms), blanks out the most salient term in the best sentences, and
  builds distractors from other terms found elsewhere in the document.
- The AI tutor falls back to a **keyword search** over the document text and
  returns the closest-matching passages, clearly labelled as such.

Both paths are visibly labelled in the UI (`heuristic` vs `llm:<model>`) so
it's never ambiguous which one answered.

**iGOT Karmayogi** (`lib/igot/client.ts`) has no public self-serve API — real
access requires a government sandbox onboarding process this prototype
doesn't have. The connector is written to the shape a real integration would
have (base URL + bearer key, one function per integration point:
`fetchCourseCatalog`, `pushProgress`, `syncCompetencyPassbook`,
`publishQuizToKarmayogi`) and runs in **simulated mode** by default: it
returns realistic mock responses with an artificial delay and logs every call
it *would* make to `IgotSyncLog`, which is what drives the "synced HH:MM"
badges in the UI. Setting `IGOT_API_BASE_URL` and `IGOT_API_KEY` switches it
to live mode with no other code changes.

## Tech stack

- **Next.js 15** (App Router, TypeScript) — one full-stack app; API routes
  double as the backend, no separate server to run
- **Prisma + SQLite** — zero setup (a local file, created automatically);
  swap the `DATABASE_URL` for Postgres later with no code changes
- **JWT in an httpOnly cookie**, bcrypt password hashing (login is by
  Employee ID, matching how staff actually identify themselves, not email)
- **OpenAI API** (`openai`, default model `gpt-4o-mini`) for quiz generation
  and the AI tutor, both with the offline fallbacks described above
- **pdf-parse** for PDF text extraction

## How the scoring actually works

**Diagnostic.** 8 NSTA competency domains × 3 difficulty tiers (easy/moderate/
hard) = 24 questions. The engine serves one domain per "round" in a fixed
round-robin (`lib/assessment.ts`): round 1 always serves the moderate item;
round 2 serves hard if you got the moderate item right, easy if you didn't;
round 3 serves whichever of easy/hard is left. Every domain ends up with all
three difficulty tiers answered regardless of path — the branching changes
the *pacing* of difficulty, not which questions ultimately count, which keeps
final scoring identical in shape across every user.

**Level.** Per domain: `earned = Σ(difficulty weight of each correct answer)`
where easy/moderate/hard = 1/2/3 points, out of a 6-point max. That ratio maps
onto a 1-5 level: `level = round(1 + ratio × 4)`.

**Gap.** `required (from the NSTA role-benchmark table for your declared
designation) − current level`. Gap ≥ 2 is `CRITICAL`, gap = 1 is `HIGH`,
gap ≤ 0 is `MET`.

**Recommendations.** Every course in the catalog is tagged to one or more
domains with a relevance weight. A course's match score is
`Σ(gap severity of each domain it covers × relevance weight)`, normalised to
a percentage. The learning path is a greedy set-cover over your open
(`CRITICAL`/`HIGH`) gaps by that same ranking, laid out sequentially assuming
a 4 study-hour/week pace.

## Project structure

```
app/
  (app)/            authenticated pages: overview, assessment, gaps, path,
                     catalog, studio (quiz authoring), tutor, admin
  api/               route handlers - the "backend"
  login/, register/  auth pages
lib/
  assessment.ts      adaptive question selection + scoring
  recommend.ts        recommendation engine + learning path generation
  analytics.ts        competency index, cohort benchmarking, admin aggregates
  domains.ts           the 8 NSTA domains + role benchmark table (edit here
                        to add a designation or retune a benchmark)
  llm/quizgen.ts       LLM + heuristic MCQ generation
  llm/tutor.ts         LLM + keyword-search AI tutor
  igot/client.ts       the iGOT Karmayogi connector (simulated/live)
prisma/
  schema.prisma        data model
  seed.ts               question bank, course catalog, demo user + a seeded
                         pilot cohort across 6 offices for admin analytics
```

## Notes on scope

The office-analytics numbers are a small seeded pilot cohort (~90 synthetic
staff across 6 offices), not the mockup's original placeholder figures —
they're real aggregate queries over real (seeded) rows, not decoration.
