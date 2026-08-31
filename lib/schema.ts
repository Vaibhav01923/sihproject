// Row shapes for every table, matching prisma/migrations/*/migration.sql
// exactly (column names, nullability). These replace the types Prisma used
// to generate automatically - there is no compile-time check anymore that
// a query actually matches these, so keep this file in sync with the SQL
// by hand if the schema ever changes.

export interface UserRow {
  id: string;
  name: string;
  employeeId: string;
  passwordHash: string;
  role: string;
  office: string;
  isAdmin: boolean;
  reportingOfficerId: string | null;
  createdAt: string;
}

export interface CompetencyDomainRow {
  id: string;
  code: string;
  name: string;
  description: string;
  order: number;
}

export interface RoleBenchmarkRow {
  id: string;
  role: string;
  domainId: string;
  requiredLevel: number;
}

export interface QuestionRow {
  id: string;
  domainId: string;
  text: string;
  options: string;
  correctIndex: number;
  difficulty: string;
  explanation: string;
}

export interface AssessmentAttemptRow {
  id: string;
  userId: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
  endorsedByUserId: string | null;
  endorsedAt: string | null;
}

export interface AssessmentAnswerRow {
  id: string;
  attemptId: string;
  questionId: string;
  domainId: string;
  orderIndex: number;
  pickedIndex: number;
  correct: boolean;
  difficulty: string;
  answeredAt: string;
}

export interface CompetencyScoreRow {
  id: string;
  userId: string;
  domainId: string;
  attemptId: string | null;
  level: number;
  ratio: number;
  isCurrent: boolean;
  computedAt: string;
}

export interface CourseRow {
  id: string;
  title: string;
  description: string;
  source: string;
  hours: number;
  mandatory: boolean;
  externalId: string | null;
}

export interface CourseDomainRow {
  id: string;
  courseId: string;
  domainId: string;
  weight: number;
}

export interface EnrollmentRow {
  id: string;
  userId: string;
  courseId: string;
  status: string;
  progressPct: number;
  enrolledAt: string;
  completedAt: string | null;
}

export interface LearningPathRow {
  id: string;
  userId: string;
  attemptId: string | null;
  generatedAt: string;
  weeksTotal: number;
  hoursTotal: number;
}

export interface LearningPathItemRow {
  id: string;
  pathId: string;
  courseId: string;
  orderIndex: number;
  weekStart: number;
  weekEnd: number;
  rationale: string;
}

export interface DocumentRow {
  id: string;
  userId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  pageCount: number | null;
  conceptCount: number | null;
  extractedText: string;
  status: string;
  uploadedAt: string;
}

export interface ChatMessageRow {
  id: string;
  documentId: string;
  userId: string;
  role: string;
  content: string;
  createdAt: string;
}

export interface GeneratedQuestionRow {
  id: string;
  documentId: string;
  domainId: string | null;
  text: string;
  options: string;
  correctIndex: number;
  difficulty: string;
  page: number | null;
  status: string;
  generatedBy: string;
  createdAt: string;
}

export interface IgotSyncLogRow {
  id: string;
  userId: string | null;
  kind: string;
  simulated: boolean;
  payload: string;
  createdAt: string;
}
