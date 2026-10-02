import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";

// Node 25+ has its own experimental localStorage global, which hides jsdom's and has no working
// methods unless Node is started with --localstorage-file. Tests get a plain in-memory one
// instead, emptied after every test so nothing leaks between them.
const stored = new Map<string, string>();
const memoryStorage: Storage = {
  get length() { return stored.size; },
  clear: () => stored.clear(),
  getItem: (key) => stored.get(key) ?? null,
  key: (index) => [...stored.keys()][index] ?? null,
  removeItem: (key) => { stored.delete(key); },
  setItem: (key, value) => { stored.set(key, String(value)); },
};
Object.defineProperty(window, "localStorage", { value: memoryStorage, configurable: true });
afterEach(() => stored.clear());

Object.defineProperty(window, "scrollTo", {
  writable: true,
  value: () => {},
});

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});
