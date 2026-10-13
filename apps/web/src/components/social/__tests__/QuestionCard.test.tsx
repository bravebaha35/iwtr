import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import type { PublicSocialAnswer, PublicSocialQuestion } from "@iwtr/shared-types";
import { QuestionCard } from "../QuestionCard";
import { clearSocialCache } from "../socialFeedCache";
import * as apiClient from "@/lib/api-client";

const openAuthModal = jest.fn();
let mockAuth: { isAuthenticated: boolean; role: string | null; openAuthModal: jest.Mock };
jest.mock("@/lib/api-client");
jest.mock("@/lib/auth-context", () => ({ useAuth: () => mockAuth }));

const at = "2026-10-13T09:00:00.000Z";

function answer(over: Partial<PublicSocialAnswer> = {}): PublicSocialAnswer {
  return {
    id: "a1",
    questionId: "q1",
    body: "Yes, on the 5th of every month.",
    createdAt: at,
    fromCompany: false,
    workedThere: false,
    displayUsername: "BusyHeron",
    avatarKey: null,
    avatarGradient: null,
    avatarPhotoUrl: null,
    mine: false,
    helpfulCount: 0,
    helpfulByMe: false,
    ...over,
  };
}

function question(over: Partial<PublicSocialQuestion> = {}): PublicSocialQuestion {
  return {
    id: "q1",
    body: "Is overtime paid on time?",
    createdAt: at,
    target: { kind: "company", companyId: "c1", companySlug: "acme", companyName: "Acme", companyLogoUrl: null, companyBadgeTier: "FREE" },
    displayUsername: "QuietOtter",
    avatarKey: null,
    avatarGradient: null,
    mine: false,
    answerCount: 0,
    answers: [],
    canAnswer: false,
    answersAsCompany: false,
    visibility: "PUBLIC",
    canSetVisibility: false,
    companyAnswered: false,
    ...over,
  };
}

beforeEach(() => {
  clearSocialCache();
  jest.resetAllMocks();
  mockAuth = { isAuthenticated: true, role: "MEMBER", openAuthModal };
  jest.mocked(apiClient.apiGet).mockResolvedValue({ displayUsername: "QuietOtter", avatarKey: null, avatarGradient: null } as never);
});

it("shows who was asked, the company's answer and the Worked there mark, and links to the rest", () => {
  render(
    <QuestionCard
      question={question({
        answerCount: 4,
        answers: [
          answer({ id: "a-co", fromCompany: true, displayUsername: "Deniz Kara", body: "We pay on the 5th." }),
          answer({ id: "a1", workedThere: true, helpfulCount: 3 }),
        ],
      })}
    />,
  );
  expect(screen.getByText("QuietOtter")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /Acme/ })).toHaveAttribute("href", "/companies/acme?tab=social");
  expect(screen.getByText("Is overtime paid on time?")).toBeInTheDocument();

  const items = screen.getAllByRole("listitem");
  expect(within(items[0]).getByText("Deniz Kara")).toBeInTheDocument();
  // The company's answer carries the company's name as its mark.
  expect(within(items[0]).getByText("Acme")).toBeInTheDocument();
  expect(within(items[0]).queryByText("Worked there")).not.toBeInTheDocument();
  expect(within(items[1]).getByText("Worked there")).toBeInTheDocument();
  expect(within(items[1]).getByRole("button", { name: /Helpful/ })).toHaveTextContent("3");

  expect(screen.getByRole("link", { name: "See 2 more answers" })).toHaveAttribute("href", "/social/questions/q1");
  expect(screen.getByText("4 answers")).toBeInTheDocument();
  // Nothing to answer with: already answered, or not allowed.
  expect(screen.queryByRole("button", { name: /^Answer( as company)?$/ })).not.toBeInTheDocument();
});

it("a kind-of-work question says so instead of naming a company", () => {
  render(<QuestionCard question={question({ target: { kind: "workType", workType: "SERVICE" } })} />);
  expect(screen.getByText("Service")).toBeInTheDocument();
  expect(screen.getByText("No answers yet")).toBeInTheDocument();
});

it("a member answers under the name they pick, and the card then offers no second answer", async () => {
  const onChanged = jest.fn();
  const created = answer({ id: "a-new", mine: true, body: "It was always on time." });
  jest.mocked(apiClient.apiPost).mockResolvedValue(created as never);
  render(<QuestionCard question={question({ canAnswer: true })} onChanged={onChanged} />);

  fireEvent.click(screen.getByRole("button", { name: "Answer" }));
  fireEvent.click(await screen.findByRole("radio", { name: "A one-off name" }));
  fireEvent.change(screen.getByLabelText("Your answer"), { target: { value: " It was always on time. " } });
  fireEvent.click(screen.getByRole("button", { name: "Post answer" }));

  await waitFor(() =>
    expect(apiClient.apiPost).toHaveBeenCalledWith("/social/questions/q1/answers", { body: "It was always on time.", identityMode: "PERSONAL_RANDOM" }),
  );
  await waitFor(() => expect(onChanged).toHaveBeenCalledWith(expect.objectContaining({ answers: [created], answerCount: 1, canAnswer: false })));
});

it("the asked company's owner answers as the company: no name to pick, the answer leads the list, and the question is shown or kept hidden", async () => {
  mockAuth = { isAuthenticated: true, role: "COMPANY_OWNER", openAuthModal };
  const onChanged = jest.fn();
  const existing = answer();
  const created = answer({ id: "a-co", fromCompany: true, mine: true, displayUsername: "Deniz Kara" });
  jest.mocked(apiClient.apiPost).mockResolvedValue(created as never);
  render(
    <QuestionCard
      question={question({ canAnswer: true, answersAsCompany: true, canSetVisibility: true, answers: [existing], answerCount: 1 })}
      onChanged={onChanged}
    />,
  );

  // "Helpful" is the members' verdict: an owner only sees it.
  expect(screen.getByRole("button", { name: /Helpful/ })).toBeDisabled();

  fireEvent.click(screen.getByRole("button", { name: "Answer as company" }));
  expect(screen.queryByRole("radiogroup", { name: "Answer as" })).not.toBeInTheDocument();
  expect(screen.getByText(/You answer for Acme, under your own name\./)).toBeInTheDocument();
  expect(apiClient.apiGet).not.toHaveBeenCalled();

  fireEvent.change(screen.getByLabelText("Your answer"), { target: { value: "We pay on the 5th." } });
  // Two ways to send it instead of one "Post answer".
  expect(screen.queryByRole("button", { name: "Post answer" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Answer and show to everyone" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Answer and keep hidden" }));
  await waitFor(() =>
    expect(apiClient.apiPost).toHaveBeenCalledWith("/social/questions/q1/answers", { body: "We pay on the 5th.", visibility: "HIDDEN" }),
  );
  await waitFor(() =>
    expect(onChanged).toHaveBeenCalledWith(
      expect.objectContaining({ answers: [created, existing], answerCount: 2, visibility: "HIDDEN", companyAnswered: true }),
    ),
  );
});

it("the asker is told where a question to a company stands; nobody else sees that line", () => {
  const { rerender } = render(<QuestionCard question={question({ mine: true, visibility: "PENDING" })} />);
  expect(screen.getByText("Sent to Acme. Only you and the company can see it until the company answers.")).toBeInTheDocument();
  // Only two people can open it: no link to copy, and nothing to hide or show.
  expect(screen.queryByRole("button", { name: "Copy link" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Show to everyone" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Report to admin" })).not.toBeInTheDocument();

  rerender(<QuestionCard question={question({ mine: true, visibility: "HIDDEN", companyAnswered: true })} />);
  expect(screen.getByText("Acme keeps this question hidden. Only you and the company can see it.")).toBeInTheDocument();

  rerender(<QuestionCard question={question()} />);
  expect(screen.queryByText(/Only you and/)).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Copy link" })).toBeInTheDocument();
});

it("the company's owner shows an answered question to everyone and can hide it again; unanswered, there is nothing to show yet", async () => {
  mockAuth = { isAuthenticated: true, role: "COMPANY_OWNER", openAuthModal };
  const onChanged = jest.fn();
  const waiting = question({ visibility: "PENDING", canSetVisibility: true, canAnswer: true, answersAsCompany: true });
  const { rerender } = render(<QuestionCard question={waiting} onChanged={onChanged} />);
  expect(screen.getByText("Waiting for your answer. Only you and the person who asked can see it.")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Show to everyone" })).not.toBeInTheDocument();

  const hidden = question({ visibility: "HIDDEN", canSetVisibility: true, companyAnswered: true });
  jest.mocked(apiClient.apiPatch).mockResolvedValue({ ...hidden, visibility: "PUBLIC" } as never);
  rerender(<QuestionCard question={hidden} onChanged={onChanged} />);
  expect(screen.getByText("Hidden. Only you and the person who asked can see it.")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Show to everyone" }));
  await waitFor(() => expect(apiClient.apiPatch).toHaveBeenCalledWith("/social/questions/q1/visibility", { visibility: "PUBLIC" }));
  await waitFor(() => expect(onChanged).toHaveBeenCalledWith(expect.objectContaining({ visibility: "PUBLIC" })));

  jest.mocked(apiClient.apiPatch).mockResolvedValue({ ...hidden, visibility: "HIDDEN" } as never);
  rerender(<QuestionCard question={{ ...hidden, visibility: "PUBLIC" }} onChanged={onChanged} />);
  expect(screen.getByText("Shown to everyone.")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Hide" }));
  await waitFor(() => expect(apiClient.apiPatch).toHaveBeenLastCalledWith("/social/questions/q1/visibility", { visibility: "HIDDEN" }));
});

it("the company's owner reports a question to the admins from the card itself", async () => {
  mockAuth = { isAuthenticated: true, role: "COMPANY_OWNER", openAuthModal };
  jest.mocked(apiClient.apiPost).mockResolvedValue({ commentId: "q1", reportCount: 1 } as never);
  render(<QuestionCard question={question({ visibility: "PENDING", canSetVisibility: true })} />);

  fireEvent.click(screen.getByRole("button", { name: "Report to admin" }));
  const dialog = screen.getByRole("dialog", { name: "Report this question" });
  fireEvent.click(within(dialog).getByRole("radio", { name: "Threat and abuse." }));
  fireEvent.click(within(dialog).getByRole("button", { name: "Send report" }));
  await waitFor(() => expect(apiClient.apiPost).toHaveBeenCalledWith("/social/questions/q1/report", { reason: "THREAT_ABUSE" }));
  expect(await screen.findByText("Reported to admin")).toBeInTheDocument();
});

it("Helpful shows at once, then takes the API's count; your own answer can't be marked", async () => {
  const onChanged = jest.fn();
  jest.mocked(apiClient.apiPost).mockResolvedValue({ answerId: "a1", helpfulCount: 5, helpfulByMe: true } as never);
  render(<QuestionCard question={question({ answerCount: 2, answers: [answer({ helpfulCount: 1 }), answer({ id: "a-mine", mine: true })] })} onChanged={onChanged} />);

  const [theirs, mine] = screen.getAllByRole("button", { name: /Helpful/ });
  expect(mine).toBeDisabled();
  fireEvent.click(theirs);
  expect(onChanged.mock.calls[0][0].answers[0]).toMatchObject({ helpfulByMe: true, helpfulCount: 2 });
  await waitFor(() => expect(onChanged.mock.calls.at(-1)![0].answers[0]).toMatchObject({ helpfulByMe: true, helpfulCount: 5 }));
  expect(apiClient.apiPost).toHaveBeenCalledWith("/social/answers/a1/helpful", {});
});

it("your own question: Delete asks once, then removes it", async () => {
  const onDeleted = jest.fn();
  jest.mocked(apiClient.apiDelete).mockResolvedValue({ success: true } as never);
  render(<QuestionCard question={question({ mine: true })} onDeleted={onDeleted} />);

  fireEvent.click(screen.getByRole("button", { name: "Question options" }));
  expect(screen.queryByRole("menuitem", { name: "Report" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("menuitem", { name: "Delete" }));
  expect(apiClient.apiDelete).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Delete question" }));
  await waitFor(() => expect(apiClient.apiDelete).toHaveBeenCalledWith("/social/questions/q1"));
  await waitFor(() => expect(onDeleted).toHaveBeenCalledWith("q1"));
});

it("someone else's answer: Report needs a reason, sends it, and reads Reported afterwards", async () => {
  jest.mocked(apiClient.apiPost).mockResolvedValue({ commentId: "a1", reportCount: 1 } as never);
  render(<QuestionCard question={question({ answerCount: 1, answers: [answer()] })} />);

  fireEvent.click(screen.getByRole("button", { name: "Answer options" }));
  fireEvent.click(screen.getByRole("menuitem", { name: "Report" }));
  const dialog = screen.getByRole("dialog", { name: "Report this answer" });
  expect(within(dialog).getByRole("button", { name: "Send report" })).toBeDisabled();
  fireEvent.click(within(dialog).getByRole("radio", { name: "Threat and abuse." }));
  fireEvent.click(within(dialog).getByRole("button", { name: "Send report" }));

  await waitFor(() => expect(apiClient.apiPost).toHaveBeenCalledWith("/social/answers/a1/report", { reason: "THREAT_ABUSE" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  fireEvent.click(screen.getByRole("button", { name: "Answer options" }));
  expect(screen.getByText("Reported")).toBeInTheDocument();
});
