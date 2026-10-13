import { useRef } from "react";
import { act, render } from "@testing-library/react";
import { SOCIAL_VIEW_BATCH_MAX } from "@iwtr/shared-types";
import { reportPostSeen, resetSocialViews, usePostSeen } from "../socialViews";

const fetchMock = jest.fn().mockResolvedValue({ ok: true });
const sentIds = () => fetchMock.mock.calls.map(([, init]) => JSON.parse(init.body).postIds as string[]);

beforeEach(() => {
  jest.useFakeTimers();
  fetchMock.mockClear();
  global.fetch = fetchMock as never;
  resetSocialViews();
});
afterEach(() => jest.useRealTimers());

describe("reportPostSeen", () => {
  it("sends seen posts together, each once", () => {
    reportPostSeen("p1");
    reportPostSeen("p2");
    reportPostSeen("p1");
    expect(fetchMock).not.toHaveBeenCalled();

    jest.advanceTimersByTime(2000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/proxy/social/views");
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: "POST", keepalive: true });
    expect(sentIds()).toEqual([["p1", "p2"]]);

    // Already reported this visit: nothing more goes out.
    reportPostSeen("p2");
    jest.advanceTimersByTime(5000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not wait once a full batch is ready", () => {
    for (let i = 0; i < SOCIAL_VIEW_BATCH_MAX; i++) reportPostSeen(`p${i}`);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(sentIds()[0]).toHaveLength(SOCIAL_VIEW_BATCH_MAX);
  });

  it("sends what is left when the page is being left", () => {
    reportPostSeen("p1");
    window.dispatchEvent(new Event("pagehide"));
    expect(sentIds()).toEqual([["p1"]]);
  });
});

describe("usePostSeen", () => {
  let callback: (entries: { isIntersecting: boolean }[]) => void = () => undefined;
  const observe = jest.fn();
  const disconnect = jest.fn();

  beforeEach(() => {
    observe.mockClear();
    disconnect.mockClear();
    (global as unknown as { IntersectionObserver: unknown }).IntersectionObserver = class {
      constructor(cb: typeof callback) {
        callback = cb;
      }
      observe = observe;
      disconnect = disconnect;
    };
  });
  afterEach(() => {
    delete (global as unknown as { IntersectionObserver?: unknown }).IntersectionObserver;
  });

  function Card({ enabled }: { enabled: boolean }) {
    const ref = useRef<HTMLDivElement>(null);
    usePostSeen(ref, "p9", enabled);
    return <div ref={ref} />;
  }

  it("counts a card that stays on screen, not one that is scrolled past", () => {
    render(<Card enabled />);
    expect(observe).toHaveBeenCalledTimes(1);

    // On screen, then gone before a second has passed.
    act(() => callback([{ isIntersecting: true }]));
    jest.advanceTimersByTime(400);
    act(() => callback([{ isIntersecting: false }]));
    jest.advanceTimersByTime(5000);
    expect(fetchMock).not.toHaveBeenCalled();

    // On screen and left there.
    act(() => callback([{ isIntersecting: true }]));
    jest.advanceTimersByTime(1000);
    expect(disconnect).toHaveBeenCalled();
    jest.advanceTimersByTime(2000);
    expect(sentIds()).toEqual([["p9"]]);
  });

  it("does not watch at all for someone whose look does not count", () => {
    render(<Card enabled={false} />);
    expect(observe).not.toHaveBeenCalled();
  });
});
