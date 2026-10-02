import { QueryClient } from "@tanstack/react-query";
import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { cleanup, render, waitFor } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { routeTree } from "@/routeTree.gen";

// The root route's shell renders a whole document (<html>, <head>, <body>) for server rendering.
// jsdom already has a document and can't mount a second one, so the router never finishes. These
// tests render the app inside jsdom's document without the shell. (TanStack Start accepts
// `shellComponent` on the root route, but the stored options' type doesn't list it, hence the cast.)
const rootOptions = routeTree.options as { shellComponent?: unknown };
const shell = rootOptions.shellComponent;
beforeAll(() => { delete rootOptions.shellComponent; });
afterAll(() => { rootOptions.shellComponent = shell; });

function renderAt(path: string) {
  const queryClient = new QueryClient();
  const router = createRouter({
    routeTree,
    context: { queryClient },
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  return { router, ...render(<RouterProvider router={router} />) };
}

// A crashed page still paints (the root error screen), so also check that nothing threw. React and
// the root error screen both log the thrown Error object; ordinary warnings are strings.
function thrownErrors(consoleError: { mock: { calls: unknown[][] } }) {
  return consoleError.mock.calls.flat().filter((arg) => arg instanceof Error);
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// Assert only that the router mounts and paints without crashing, never page content:
// routes are rewritten as the app is built and this must keep passing.
describe("App routing", () => {
  it("renders the index route", async () => {
    const consoleError = vi.spyOn(console, "error");

    const { container, router } = renderAt("/");

    await waitFor(() => expect(router.state.status).toBe("idle"));
    await waitFor(() => expect(container.firstChild).not.toBeNull());
    expect(thrownErrors(consoleError)).toEqual([]);
  });

  it("renders the not-found route", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const consoleError = vi.spyOn(console, "error");

    const { container, router } = renderAt("/this-route-does-not-exist");

    await waitFor(() => expect(router.state.status).toBe("idle"));
    await waitFor(() => expect(container.firstChild).not.toBeNull());
    expect(thrownErrors(consoleError)).toEqual([]);
  });
});
