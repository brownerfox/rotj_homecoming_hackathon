// Works out the candidate's name from an uploaded resume, so the user never types it.

// Words that open many resumes but are never part of a name.
const NOT_A_NAME = new Set([
  "resume", "cv", "curriculum", "vitae", "profile", "summary", "objective", "contact", "experience", "education",
  "skills", "senior", "junior", "lead", "staff", "principal", "software", "engineer", "developer", "manager",
  "designer", "analyst", "scientist", "data", "backend", "frontend", "full", "stack", "intern", "student", "graduate",
  "document", "doc", "file", "scan", "untitled", "application", "my", "new", "the",
]);

// Two to four capitalized words made of letters, such as "Jordan Patel" or "Mary-Jane O'Neil".
function looksLikeName(s: string): boolean {
  const words = s.split(/\s+/).filter(Boolean);
  return words.length >= 2 && words.length <= 4 && words.every((w) =>
    w.length <= 20 && /^\p{Lu}[\p{L}'’-]*$/u.test(w) && !NOT_A_NAME.has(w.toLowerCase()));
}

const titleCase = (s: string) =>
  s.split(" ").map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");

// Returns the name, or null when it cannot be read with confidence.
export function nameFromResume(text: string, fileName: string): string | null {
  // Resumes almost always open with the name, so try the first few lines of text.
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0).slice(0, 3);
  for (const line of lines) {
    // "Jordan Patel. Backend engineer" or "Jordan Patel | jordan@mail.com": keep what comes before the separator.
    const lead = (line.split(/\s[-–—|•·]\s|[.,|(@\d]/)[0] ?? "").trim();
    if (looksLikeName(lead)) return lead === lead.toUpperCase() ? titleCase(lead) : lead;
  }

  // Otherwise use the file name: "jordan_patel_resume.pdf" becomes "Jordan Patel".
  const base = fileName
    .replace(/\.[^.]+$/, "")
    .replace(/[_.\s-]+/g, " ")
    .replace(/\b(resume|cv|final|draft|updated|copy)\b/gi, " ")
    .replace(/\d+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const fromFile = titleCase(base);
  return looksLikeName(fromFile) ? fromFile : null;
}
