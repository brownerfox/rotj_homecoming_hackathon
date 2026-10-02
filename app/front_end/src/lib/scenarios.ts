// Used only by mock mode. Gives the question generator concrete, work-like material: the company's
// domain is inferred from what the recruiter wrote, then each question gets a real schema, sample
// data and an expected answer that is computed here, not typed by hand, so it cannot drift.
// The real server's agent does this with the LLM (see app/agents/assessment-question-generator.md).
import type { CandidateLevel } from "./types";

export interface Domain {
  key: string;
  subject: string; // the person or account the product tracks
  subjects: string;
  record: string; // the thing the subject does that the product stores
  records: string;
  subjectTable: string;
  recordTable: string;
  fk: string;
  dateCol: string;
  amountCol: string;
  names: [string, string, string, string, string];
  keywords: string[];
}

const DOMAINS: Domain[] = [
  {
    key: "commerce", subject: "customer", subjects: "customers", record: "order", records: "orders",
    subjectTable: "customers", recordTable: "orders", fk: "customer_id", dateCol: "ordered_at", amountCol: "total_amount",
    names: ["Ava Chen", "Ben Ortiz", "Cara Singh", "Dev Patel", "Eli Brown"],
    keywords: ["order", "e-commerce", "ecommerce", "retail", "shop", "store", "checkout", "purchase", "marketplace", "cart"],
  },
  {
    key: "logistics", subject: "shipper", subjects: "shippers", record: "shipment", records: "shipments",
    subjectTable: "shippers", recordTable: "shipments", fk: "shipper_id", dateCol: "shipped_at", amountCol: "freight_cost",
    names: ["Acme Freight", "Brightline Foods", "Cobalt Retail", "Delta Parts", "Evergreen Co"],
    keywords: ["shipment", "logistics", "delivery", "freight", "fleet", "shipping", "warehouse", "carrier", "telemetry"],
  },
  {
    key: "fintech", subject: "account", subjects: "accounts", record: "payment", records: "payments",
    subjectTable: "accounts", recordTable: "payments", fk: "account_id", dateCol: "posted_at", amountCol: "amount",
    names: ["Maple Bakery", "Northside Dental", "Oak Studio", "Pine Realty", "Quill Books"],
    keywords: ["payment", "bank", "transaction", "lending", "fintech", "invoice", "billing", "ledger"],
  },
  {
    key: "health", subject: "patient", subjects: "patients", record: "appointment", records: "appointments",
    subjectTable: "patients", recordTable: "appointments", fk: "patient_id", dateCol: "scheduled_at", amountCol: "fee",
    names: ["Rae Adams", "Sam Lee", "Tia Nguyen", "Uma Rao", "Vic Hall"],
    keywords: ["patient", "clinic", "health", "appointment", "hospital", "medical", "care"],
  },
];

// Neutral default: matches the common "did this user buy something" product question.
const GENERAL: Domain = {
  key: "general", subject: "user", subjects: "users", record: "order", records: "orders",
  subjectTable: "users", recordTable: "orders", fk: "user_id", dateCol: "ordered_at", amountCol: "total_amount",
  names: ["Ava Chen", "Ben Ortiz", "Cara Singh", "Dev Patel", "Eli Brown"], keywords: [],
};

export function detectDomain(text: string): Domain {
  const t = text.toLowerCase();
  let best: { d: Domain; hits: number } | null = null;
  for (const d of DOMAINS) {
    const hits = d.keywords.filter((k) => t.includes(k)).length;
    if (hits > (best?.hits ?? 0)) best = { d, hits };
  }
  return best?.d ?? GENERAL;
}

export const AS_OF = "2025-06-30";
const WINDOW_START = "2025-05-31"; // the 30 days up to and including AS_OF

interface Rec { id: number; subject: number; date: string; amount: number; status: "completed" | "cancelled" }
// Subject 5 has never placed anything, subject 3 only has an old record, subject 2 has a cancelled one.
const RECORDS: Rec[] = [
  { id: 1, subject: 1, date: "2025-06-25", amount: 120, status: "completed" },
  { id: 2, subject: 1, date: "2025-05-02", amount: 80, status: "completed" },
  { id: 3, subject: 2, date: "2025-06-10", amount: 45.5, status: "completed" },
  { id: 4, subject: 2, date: "2025-06-12", amount: 300, status: "cancelled" },
  { id: 5, subject: 3, date: "2025-04-01", amount: 60, status: "completed" },
  { id: 6, subject: 4, date: "2025-06-28", amount: 15, status: "completed" },
  { id: 7, subject: 4, date: "2025-06-29", amount: 22, status: "completed" },
  { id: 8, subject: 1, date: "2025-06-29", amount: 99, status: "cancelled" },
];

const money = (n: number) => n.toFixed(2);
const table = (headers: string[], rows: (string | number)[][]) =>
  [`| ${headers.join(" | ")} |`, `| ${headers.map(() => "---").join(" | ")} |`, ...rows.map((r) => `| ${r.join(" | ")} |`)].join("\n");

const nameOf = (d: Domain, id: number) => d.names[id - 1];
const completed = RECORDS.filter((r) => r.status === "completed");
const inWindow = (r: Rec) => r.date >= WINDOW_START && r.date <= AS_OF;

export function recentSubjectIds(): number[] {
  return [...new Set(completed.filter(inWindow).map((r) => r.subject))].sort((x, y) => x - y);
}

export function hasRecent(subject: number): boolean {
  return recentSubjectIds().includes(subject);
}

export function schemaBlock(d: Domain): string {
  return `**Schema** (SQL)

\`\`\`sql
CREATE TABLE ${d.subjectTable} (
  id   INTEGER PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE ${d.recordTable} (
  id          INTEGER PRIMARY KEY,
  ${d.fk.padEnd(11)} INTEGER NOT NULL REFERENCES ${d.subjectTable}(id),
  ${d.dateCol.padEnd(11)} DATE NOT NULL,
  ${d.amountCol.padEnd(11)} NUMERIC(10,2) NOT NULL,
  status      TEXT NOT NULL   -- 'completed' or 'cancelled'
);
\`\`\`

**Sample data**

${table(["id", "name"], d.names.map((n, i) => [i + 1, n]))}

${table(["id", d.fk, d.dateCol, d.amountCol, "status"], RECORDS.map((r) => [r.id, r.subject, r.date, money(r.amount), r.status]))}

"Today" for every example in this problem is **${AS_OF}**.`;
}

export function sqlTasks(d: Domain, level: CandidateLevel): { tasks: string[]; expected: string } {
  const tasks: string[] = [];
  const expected: string[] = [];

  const recent = recentSubjectIds();
  tasks.push(`List every ${d.subject} (id, name) who has at least one **completed** ${d.record} in the 30 days up to and including ${AS_OF}, ordered by id. This is how the product answers "did this ${d.subject} order recently?".`);
  expected.push(`Task 1\n\n${table(["id", "name"], recent.map((id) => [id, nameOf(d, id)]))}`);

  if (level !== "intern") {
    const never = d.names.map((_, i) => i + 1).filter((id) => !RECORDS.some((r) => r.subject === id));
    tasks.push(`List the ${d.subjects} who have never placed any ${d.records} of any status (id, name).`);
    expected.push(`Task 2\n\n${table(["id", "name"], never.map((id) => [id, nameOf(d, id)]))}`);
  }

  if (level === "mid" || level === "senior") {
    const totals = d.names.map((_, i) => i + 1).map((id) => {
      const rs = completed.filter((r) => r.subject === id);
      return { id, count: rs.length, total: rs.reduce((s, r) => s + r.amount, 0) };
    }).filter((t) => t.count > 0).sort((x, y) => y.total - x.total || x.id - y.id).slice(0, 2);
    tasks.push(`For the two ${d.subjects} with the highest combined ${d.amountCol} across completed ${d.records}, return id, name, number of completed ${d.records}, and the total. Break ties by lower id.`);
    expected.push(`Task 3\n\n${table(["id", "name", `completed_${d.records}`, "total"], totals.map((t) => [t.id, nameOf(d, t.id), t.count, money(t.total)]))}`);
    tasks.push(`The ${d.recordTable} table will have 50 million rows. Name the index you would add so Task 1 stays fast, give its column order, and say why.`);
  }

  if (level === "senior") {
    const latest = d.names.map((_, i) => i + 1).map((id) => completed.filter((r) => r.subject === id).sort((x, y) => y.date.localeCompare(x.date))[0]).filter(Boolean);
    tasks.push(`Using a window function, return each ${d.subject}'s most recent completed ${d.record} (${d.subject} id, ${d.record} id, ${d.dateCol}). Omit ${d.subjects} with none.`);
    expected.push(`Task ${tasks.length}\n\n${table([d.fk, `${d.record}_id`, d.dateCol], latest.map((r) => [r.subject, r.id, r.date]))}`);
  }

  return { tasks, expected: expected.join("\n\n") };
}

export function sqlMaterials(d: Domain, level: CandidateLevel): string {
  const { expected } = sqlTasks(d, level);
  return `${schemaBlock(d)}\n\n**Expected output for the sample data**\n\n${expected}`;
}

export function retrievalMaterials(d: Domain): string {
  const check = (id: number) => `${d.subject} ${id} (${nameOf(d, id)}) -> ${hasRecent(id) ? "True" : "False"}`;
  return `${schemaBlock(d)}

**Expected results for the sample data**

- ${check(2)}
- ${check(3)}
- ${check(5)}`;
}

export function restMaterials(d: Domain): string {
  const latest = completed.filter((r) => r.subject === 2 && inWindow(r)).sort((x, y) => y.date.localeCompare(x.date))[0];
  return `**Example request and response**

\`\`\`
GET /${d.subjects}/2/${d.records}/recent?days=30

200 OK
{ "${d.fk}": 2, "has_recent_${d.record}": true,
  "latest_${d.record}": { "id": ${latest.id}, "${d.dateCol}": "${latest.date}", "${d.amountCol}": ${money(latest.amount)} } }

GET /${d.subjects}/3/${d.records}/recent?days=30
200 OK   { "${d.fk}": 3, "has_recent_${d.record}": false, "latest_${d.record}": null }

GET /${d.subjects}/99/${d.records}/recent       -> 404 { "detail": "${d.subject} not found" }
GET /${d.subjects}/2/${d.records}/recent?days=0 -> 422 { "detail": "days must be between 1 and 365" }
\`\`\`

Use the sample data from the schema below.

${schemaBlock(d)}`;
}

export function cachingMaterials(d: Domain): string {
  return `**Required behavior, in order** (using the ${d.subject} 3 from the sample data, who has no recent ${d.record})

1. \`GET /${d.subjects}/3/${d.records}/recent\` returns \`false\` and reads the database (cache miss).
2. The same request 10 seconds later returns \`false\` without reading the database (cache hit).
3. A new completed ${d.record} is created for ${d.subject} 3.
4. The same request now returns \`true\` immediately, not after the 60 seconds expire.
5. A request for ${d.subject} 4 is unaffected by step 3.`;
}

export function slowPathMaterials(d: Domain): string {
  return `**Current code** (pseudocode; the real starter file is in your language)

\`\`\`
cutoff = today - 30 days
${d.subjects} = db.query("SELECT id, name FROM ${d.subjectTable}")
result = []
for s in ${d.subjects}:
    rows = db.query("SELECT * FROM ${d.recordTable} WHERE ${d.fk} = ?", [s.id])   # one query per ${d.subject}
    if any(r.status == "completed" and r.${d.dateCol} >= cutoff for r in rows):
        result.append(s)
return result
\`\`\`

**Observed:** takes about 40 seconds with 50,000 ${d.subjects} and 2 million ${d.records}. It must stay correct for the sample data: ${recentSubjectIds().map((id) => `${d.subject} ${id}`).join(", ")} are the expected results.

${schemaBlock(d)}`;
}

export function importMaterials(d: Domain): string {
  return `**Nightly partner file** (CSV)

\`\`\`
${d.record}_id,${d.fk},${d.dateCol},${d.amountCol},status
9,2,2025-06-30,25.00,completed
10,99,2025-06-30,10.00,completed
11,3,2025-13-01,40.00,completed
12,4,2025-06-30,-5.00,completed
13,1,2025-06-30,12.00,shipped
14,5,2025-06-29,70.00,cancelled
\`\`\`

**Expected outcome for the sample data and the ${d.subjects} below**

${table(["row", "result", "reason"], [
    [9, "imported", ""], [10, "quarantined", `unknown ${d.subject} 99`], [11, "quarantined", "invalid date"],
    [12, "quarantined", `negative ${d.amountCol}`], [13, "quarantined", "unknown status 'shipped'"], [14, "imported", ""],
  ])}

The run summary must read: 2 imported, 4 quarantined. Valid statuses are 'completed' and 'cancelled'.

${schemaBlock(d)}`;
}
