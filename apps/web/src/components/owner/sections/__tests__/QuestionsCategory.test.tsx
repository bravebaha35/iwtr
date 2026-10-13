import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { CompanyQuestionPage, PublicSocialQuestion } from "@iwtr/shared-types";
import { QuestionsCategory } from "../QuestionsCategory";
import * as apiClient from "@/lib/api-client";

jest.mock("@/lib/api-client");
jest.mock("@/lib/auth-context", () => ({ useAuth: () => ({ isAuthenticated: true, role: "COMPANY_OWNER", openAuthModal: jest.fn() }) }));

function question(over: Partial<PublicSocialQuestion> = {}): PublicSocialQuestion {
  return {
    id: "q1",
    body: "Is overtime paid on time?",
    createdAt: "2026-10-13T09:00:00.000Z",
    target: { kind: "company", companyId: "c1", companySlug: "acme", companyName: "Acme", companyLogoUrl: null, companyBadgeTier: "FREE" },
    displayUsername: "QuietOtter",
    avatarKey: null,
    avatarGradient: null,
    mine: false,
    answerCount: 0,
    answers: [],
    canAnswer: true,
    answersAsCompany: true,
    visibility: "PENDING",
    canSetVisibility: true,
    companyAnswered: false,
    ...over,
  };
}

const page = (questions: PublicSocialQuestion[], counts: CompanyQuestionPage["counts"]): CompanyQuestionPage => ({ questions, nextCursor: null, counts });
const paths = () => jest.mocked(apiClient.apiGet).mock.calls.map(([path]) => path);

beforeEach(() => jest.mocked(apiClient.apiGet).mockReset());

it("opens on what is waiting for the owner, with the count of each state on its button", async () => {
  const onCounts = jest.fn();
  jest.mocked(apiClient.apiGet).mockResolvedValue(page([question()], { waiting: 1, hidden: 2, shown: 5 }) as never);
  render(<QuestionsCategory companyId="c1" companyName="Acme" onCounts={onCounts} />);

  expect(await screen.findByText("Is overtime paid on time?")).toBeInTheDocument();
  expect(paths()).toEqual(["/social/company-questions/c1?filter=waiting"]);
  expect(screen.getByRole("radio", { name: "Waiting for you 1" })).toHaveAttribute("aria-checked", "true");
  expect(screen.getByRole("radio", { name: "Hidden 2" })).toBeInTheDocument();
  expect(screen.getByRole("radio", { name: "Shown to everyone 5" })).toBeInTheDocument();
  // The side list's "N waiting for you" line is fed from here.
  expect(onCounts).toHaveBeenCalledWith({ waiting: 1, hidden: 2, shown: 5 });
  // The rules, in plain words: answer, choose, no messaging, report.
  expect(screen.getByText(/cannot be messaged/)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Report to admin" })).toBeInTheDocument();
});

it("with nothing waiting it shows every question instead of an empty list", async () => {
  jest.mocked(apiClient.apiGet).mockImplementation((path: string) =>
    Promise.resolve(
      path.includes("filter=waiting")
        ? page([], { waiting: 0, hidden: 0, shown: 1 })
        : page([question({ visibility: "PUBLIC", companyAnswered: true, canAnswer: false, answersAsCompany: false })], { waiting: 0, hidden: 0, shown: 1 }),
    ) as never,
  );
  render(<QuestionsCategory companyId="c1" companyName="Acme" />);

  expect(await screen.findByText("Is overtime paid on time?")).toBeInTheDocument();
  expect(paths()).toEqual(["/social/company-questions/c1?filter=waiting", "/social/company-questions/c1?filter=all"]);
  expect(screen.getByRole("radio", { name: "All" })).toHaveAttribute("aria-checked", "true");
  expect(screen.getByText("Shown to everyone.")).toBeInTheDocument();
});

it("picking another state reads that list", async () => {
  jest.mocked(apiClient.apiGet).mockImplementation((path: string) =>
    Promise.resolve(
      path.includes("filter=hidden")
        ? page([question({ id: "q2", body: "Why was the raise late?", visibility: "HIDDEN", companyAnswered: true })], { waiting: 1, hidden: 1, shown: 0 })
        : page([question()], { waiting: 1, hidden: 1, shown: 0 }),
    ) as never,
  );
  render(<QuestionsCategory companyId="c1" companyName="Acme" />);
  await screen.findByText("Is overtime paid on time?");

  fireEvent.click(screen.getByRole("radio", { name: "Hidden 1" }));
  expect(await screen.findByText("Why was the raise late?")).toBeInTheDocument();
  await waitFor(() => expect(screen.queryByText("Is overtime paid on time?")).not.toBeInTheDocument());
  expect(paths()).toContain("/social/company-questions/c1?filter=hidden");
});
