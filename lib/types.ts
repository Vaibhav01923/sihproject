// SQLite has no native enum support, so the Prisma schema stores these as
// plain strings. These union types are the single source of truth for the
// allowed values everywhere in application code.

export type Difficulty = "EASY" | "MODERATE" | "HARD";
export type AttemptStatus = "IN_PROGRESS" | "COMPLETED";
export type CourseSource = "IGOT_KARMAYOGI" | "MOSPI_NSTA";
export type EnrollmentStatus = "RECOMMENDED" | "ENROLLED" | "IN_PROGRESS" | "COMPLETED";
export type DocumentStatus = "PROCESSING" | "PARSED" | "FAILED";
export type ChatRole = "USER" | "ASSISTANT";
export type GenStatus = "DRAFT" | "APPROVED" | "REJECTED" | "PUBLISHED";
export type IgotLogKind = "CATALOG_FETCH" | "PROGRESS_PUSH" | "PASSBOOK_SYNC" | "QUIZ_PUBLISH";
