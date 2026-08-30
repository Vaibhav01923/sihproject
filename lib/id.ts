import { randomUUID } from "crypto";

/** Primary keys used to be Prisma's auto-generated cuids; nothing in the
 * app parses their format, so a plain UUID works identically now that
 * inserts are constructed by hand. */
export function newId(): string {
  return randomUUID();
}
