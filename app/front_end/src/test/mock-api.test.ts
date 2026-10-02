// Demo mode runs on the mock API, so it must behave like the server (API_CONTRACT.md).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockApi } from "@/lib/mock-api";
import type { JobInput } from "@/lib/types";

// Mock calls and the simulated background generation both run on timers.
async function settle<T>(p: Promise<T>): Promise<T> {
  // The caller checks the outcome. This only stops a rejection from counting as unhandled while
  // the timers run.
  p.catch(() => {});
  await vi.advanceTimersByTimeAsync(10_000);
  return p;
}
const pdf = (name: string) => new File(["%PDF-1.4"], name, { type: "application/pdf" });
const JOB: JobInput = {
  title: "Backend Engineer", description: "Owns the API.", skills: [], existing_questions: null, coding_brief: null,
  starter_code: true, questions: [{ type: "technical", count: 2 }, { type: "debugging", count: 1 }],
};

// The mock keeps its data in localStorage, which setup.ts empties after every test.
describe("demo-mode mock API", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it("generates one question per count, in type order, for each uploaded resume", async () => {
    const job = await settle(mockApi.createJob({ ...JOB, starter_code: false }));
    expect(job.questions.map((q) => q.type)).toEqual(["debugging", "technical"]);

    const [created] = await settle(mockApi.uploadResumes(job.id, [pdf("ada_lovelace_resume.pdf")]));
    expect(created?.status).toBe("pending");
    await vi.advanceTimersByTimeAsync(10_000);

    const c = await settle(mockApi.getCandidate(created!.id));
    expect(c.status).toBe("ready");
    expect(c.name).toBe("Ada Lovelace");
    expect(c.questions.map((q) => q.type)).toEqual(["debugging", "technical", "technical"]);
    expect(c.coding_challenge).toMatchObject({ starter_code: null, tests: null });
  });

  it("fails a resume named 'fail' so the failed state can be tried, and retry fixes it", async () => {
    const job = await settle(mockApi.createJob(JOB));
    const [created] = await settle(mockApi.uploadResumes(job.id, [pdf("fail_me.pdf")]));
    await vi.advanceTimersByTimeAsync(10_000);
    expect((await settle(mockApi.getCandidate(created!.id))).status).toBe("failed");

    await settle(mockApi.retryCandidate(created!.id));
    await vi.advanceTimersByTimeAsync(10_000);
    expect((await settle(mockApi.getCandidate(created!.id))).status).toBe("ready");
  });

  it("applies the server's rules", async () => {
    const job = await settle(mockApi.createJob(JOB));
    await expect(settle(mockApi.uploadResumes(job.id, [new File(["x"], "cv.docx")]))).rejects.toMatchObject({ status: 400 });
    await expect(settle(mockApi.createJob({ ...JOB, questions: [{ type: "behavioral", count: 11 }] }))).rejects.toMatchObject({ status: 422 });

    const [created] = await settle(mockApi.uploadResumes(job.id, [pdf("grace_hopper.pdf")]));
    await vi.advanceTimersByTimeAsync(10_000);
    // Starter code and tests are set or cleared together.
    await expect(settle(mockApi.editCodingChallenge(created!.id, { tests: null }))).rejects.toMatchObject({ status: 400 });
    expect((await settle(mockApi.editCodingChallenge(created!.id, { tests: null, starter_code: null }))).tests).toBeNull();
  });
});
