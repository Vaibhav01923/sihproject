import { z } from "zod";
import { OFFICES, ROLES } from "./domains";

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Name is too short").max(100),
  employeeId: z
    .string()
    .trim()
    .min(3, "Employee ID is too short")
    .max(40)
    .regex(/^[A-Za-z0-9-]+$/, "Employee ID may only contain letters, numbers, and hyphens"),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
  role: z.enum(ROLES as [string, ...string[]]),
  office: z.enum(OFFICES),
});

export const loginSchema = z.object({
  employeeId: z.string().trim().min(1, "Employee ID is required"),
  password: z.string().min(1, "Password is required"),
});

export const answerSchema = z.object({
  attemptId: z.string().min(1),
  questionId: z.string().min(1),
  pickedIndex: z.number().int().min(0).max(3),
});

export const chatSchema = z.object({
  message: z.string().trim().min(1).max(2000),
});

export const questionReviewSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED", "DRAFT"]),
});
