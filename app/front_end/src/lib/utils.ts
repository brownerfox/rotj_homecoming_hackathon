import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { MAX_PDF_MB } from "./constants";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Reads a record id from the address bar. Returns undefined unless it is a positive whole number.
export function toId(value: unknown): number | undefined {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : undefined;
}

// A message for the first file that isn't a PDF or is too large, or null if all are fine.
// The server checks the same rules; checking here first avoids a wasted upload.
export function pdfProblem(files: File[]): string | null {
  for (const f of files) {
    if (!f.name.toLowerCase().endsWith(".pdf")) return `${f.name} isn't a PDF.`;
    if (f.size > MAX_PDF_MB * 1024 * 1024) return `${f.name} is larger than ${MAX_PDF_MB} MB.`;
  }
  return null;
}
