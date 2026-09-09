import "@testing-library/jest-dom";


// jsdom has no IntersectionObserver — used by SocialFeed's infinite scroll.
// No-op stub: tests exercise pagination via explicit apiGet mocks, not by
// simulating a real scroll intersection.
class IntersectionObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver = IntersectionObserverStub;
