// Used only by mock mode. The real FastAPI server parses the resume (pdf/docx/txt) and returns
// ResumeInsights. This mirrors that for plain-text resumes so the demo can tailor questions from
// real resume content.
import type { ResumeInsights } from "./types";

// A trailing "*" means prefix match ("optimiz*" matches "optimized"); otherwise whole-word match.
const KEYWORDS: Record<string, string[]> = {
  "Database retrieval": ["database*", "postgres*", "mysql", "sqlite", "mongodb", "query", "queries", "sql"],
  SQL: ["sql", "postgres*", "mysql", "sqlite"],
  "REST APIs": ["rest", "restful", "api", "apis", "fastapi", "flask", "django", "express", "endpoint*"],
  "API design": ["api design", "openapi", "swagger", "graphql", "endpoint*"],
  Authentication: ["auth*", "oauth", "jwt", "sso"],
  "Data processing": ["etl", "pipeline*", "pandas", "spark", "airflow", "kafka", "batch"],
  "Data modeling": ["schema*", "data model*", "orm"],
  Caching: ["cache", "caching", "cached", "redis", "memcached"],
  "Performance optimization": ["latency", "optimiz*", "performance", "profil*", "throughput"],
  "Machine learning": ["machine learning", "pytorch", "tensorflow", "scikit-learn", "classifier*"],
  "Natural language processing": ["nlp", "natural language", "spacy", "transformers"],
  "Retrieval-Augmented Generation": ["rag", "retrieval-augmented", "retrieval augmented", "langchain", "llamaindex"],
  "Vector databases": ["vector*", "pinecone", "weaviate", "pgvector", "faiss", "chroma"],
  Embeddings: ["embedding*"],
  "Model integration": ["openai", "anthropic", "llm*", "model api*"],
  "AI agents": ["agent*"],
  "Data preprocessing": ["preprocess*", "feature engineering", "data cleaning"],
  "Object-oriented programming": ["object-oriented", "oop", "design pattern*"],
  "Functional programming": ["functional programming", "haskell", "scala", "immutab*"],
  Algorithms: ["algorithm*", "leetcode"],
  "Data structures": ["data structure*"],
  "Error handling": ["error handling", "retry", "retries", "fault toleran*", "exception*"],
  Testing: ["unit test*", "integration test*", "pytest", "jest", "junit", "tdd"],
  Debugging: ["debug*", "root cause", "incident*"],
  "Code architecture": ["architecture", "refactor*", "modular*"],
  "Design patterns": ["design pattern*"],
  "Cloud computing": ["aws", "gcp", "azure", "cloud", "lambda"],
  "Distributed systems": ["distributed", "kafka", "microservice*", "rabbitmq", "queue*"],
  Docker: ["docker*", "kubernetes", "k8s", "container*"],
  "CI/CD": ["ci/cd", "github actions", "jenkins", "continuous integration"],
  Networking: ["tcp", "http", "socket*", "dns"],
  Scalability: ["scal*", "load balanc*", "high availability"],
  "UI development": ["react", "css", "frontend", "front-end", "ui"],
  "State management": ["redux", "state management", "zustand"],
  "API integration": ["api integration*", "third-party api*"],
  "Rate limiting": ["rate limit*", "throttl*"],
  "Event streaming": ["kafka", "kinesis", "event stream*", "pub/sub", "event-driven"],
};

const TECHNOLOGIES = [
  "Python", "Java", "JavaScript", "TypeScript", "C++", "C#", "Rust", "SQL", "PostgreSQL", "MySQL", "SQLite",
  "MongoDB", "Redis", "Memcached", "Kafka", "RabbitMQ", "FastAPI", "Flask", "Django", "Express", "React",
  "Node.js", "Docker", "Kubernetes", "AWS", "GCP", "Azure", "Pinecone", "Weaviate", "pgvector", "FAISS",
  "PyTorch", "TensorFlow", "LangChain", "Pandas", "Spark", "Airflow", "GraphQL", "Terraform", "Kinesis",
];

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
const word = (s: string) => new RegExp(`(?<![A-Za-z0-9])${esc(s)}(?![A-Za-z0-9])`, "i");

function keywordRegex(kw: string): RegExp {
  return kw.endsWith("*") ? new RegExp(`(?<![A-Za-z0-9])${esc(kw.slice(0, -1))}[A-Za-z0-9]*`, "i") : word(kw);
}

function keywordsFor(requirement: string): string[] {
  if (KEYWORDS[requirement]) return KEYWORDS[requirement];
  const lower = requirement.toLowerCase();
  return [lower, ...lower.split(/[^a-z0-9]+/).filter((w) => w.length > 3)];
}

export function matchesRequirement(text: string, requirement: string): boolean {
  return keywordsFor(requirement).some((k) => keywordRegex(k).test(text));
}

export function analyzeResumeText(fileName: string, text: string, requirements: string[]): ResumeInsights {
  const technologies = TECHNOLOGIES.filter((t) => word(t).test(text));
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/^[\s\-*•\d.)]+/, "").trim())
    .filter((l) => l.length >= 25 && l.length <= 240);
  // Skill lists ("Skills: Python, Redis...") name technologies but are not evidence of experience.
  const evidence = lines.filter((l) => !/^(technical )?(skills?|technologies|tools|languages)\s*:/i.test(l));
  const relevant: ResumeInsights["relevant_experience"] = [];
  for (const req of requirements) {
    // The bullet with the most keyword hits wins; one bullet may support several requirements.
    let best: { line: string; hits: number } | null = null;
    for (const line of evidence) {
      const hits = keywordsFor(req).filter((k) => keywordRegex(k).test(line)).length;
      if (hits > (best?.hits ?? 0)) best = { line, hits };
    }
    if (best) relevant.push({ experience: best.line, related_requirement: req });
  }
  return { file_name: fileName, technologies, relevant_experience: relevant };
}
