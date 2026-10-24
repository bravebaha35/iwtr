import "@testing-library/jest-dom";
import { configure } from "@testing-library/react";

// GitHub's CI machines are several times slower than a dev laptop: give
// findBy*/waitFor up to 5 s (not the default 1 s) and each test 20 s, so a
// page that loads fake data a little slower there does not fail a test.
configure({ asyncUtilTimeout: 5000 });
jest.setTimeout(20000);


// jsdom has no IntersectionObserver — used by SocialFeed's infinite scroll.
// No-op stub: tests exercise pagination via explicit apiGet mocks, not by
// simulating a real scroll intersection.
class IntersectionObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver = IntersectionObserverStub;

// jsdom also has no URL.createObjectURL/revokeObjectURL - used by
// SocialComposer local file preview.
if (typeof URL.createObjectURL !== "function") {
  URL.createObjectURL = () => "blob:mock-url";
}
if (typeof URL.revokeObjectURL !== "function") {
  URL.revokeObjectURL = () => {};
}

