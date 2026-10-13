import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SocialComposer } from "../SocialComposer";
import * as apiClient from "@/lib/api-client";

jest.mock("@/lib/api-client");

beforeEach(() => {
  jest.clearAllMocks();
});

const companies = [{ companyId: "c1", companyName: "Acme", companySlug: "acme", tier: "FREE", planStatus: "NONE", isVerifiedBadge: false }];

it("rejects a non-image file with the shared validator message", async () => {
  render(<SocialComposer companies={companies as never} onPosted={jest.fn()} onCancel={jest.fn()} />);
  const input = screen.getByLabelText(/add a photo/i);
  fireEvent.change(input, { target: { files: [new File(["x"], "a.pdf", { type: "application/pdf" })] } });
  expect(await screen.findByText(/must be a JPEG, PNG, or HEIC/i)).toBeInTheDocument();
});

it("uploads via apiUpload with companyId + caption + one file under 'files'", async () => {
  (apiClient.apiUpload as jest.Mock).mockResolvedValue({ id: "post-1" });
  const onPosted = jest.fn();
  render(<SocialComposer companies={companies as never} onPosted={onPosted} onCancel={jest.fn()} />);
  fireEvent.change(screen.getByLabelText(/add a photo/i), {
    target: { files: [new File(["img"], "a.jpg", { type: "image/jpeg" })] },
  });
  fireEvent.change(screen.getByPlaceholderText("Tell us what you think !"), { target: { value: "new gear" } });
  fireEvent.click(screen.getByRole("button", { name: /post/i }));
  await waitFor(() => expect(onPosted).toHaveBeenCalled());
  const fd = (apiClient.apiUpload as jest.Mock).mock.calls[0][1] as FormData;
  expect(fd.get("companyId")).toBe("c1");
  expect(fd.get("caption")).toBe("new gear");
  expect(fd.get("files")).toBeInstanceOf(File);
});

it("picking multiple photos appends every one under 'files', Instagram-style", async () => {
  (apiClient.apiUpload as jest.Mock).mockResolvedValue({ id: "post-1" });
  const onPosted = jest.fn();
  render(<SocialComposer companies={companies as never} onPosted={onPosted} onCancel={jest.fn()} />);
  fireEvent.change(screen.getByLabelText(/add a photo/i), {
    target: {
      files: [
        new File(["a"], "a.jpg", { type: "image/jpeg" }),
        new File(["b"], "b.jpg", { type: "image/jpeg" }),
        new File(["c"], "c.jpg", { type: "image/jpeg" }),
      ],
    },
  });
  fireEvent.click(screen.getByRole("button", { name: /post/i }));
  await waitFor(() => expect(onPosted).toHaveBeenCalled());
  const fd = (apiClient.apiUpload as jest.Mock).mock.calls[0][1] as FormData;
  expect(fd.getAll("files")).toHaveLength(3);
});

it("an update needs some text or a photo; text alone is enough", async () => {
  (apiClient.apiUpload as jest.Mock).mockResolvedValue({ id: "post-1" });
  const onPosted = jest.fn();
  render(<SocialComposer companies={companies as never} onPosted={onPosted} onCancel={jest.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "Post" }));
  expect(await screen.findByText("Write something or add a photo.")).toBeInTheDocument();
  expect(apiClient.apiUpload).not.toHaveBeenCalled();

  fireEvent.change(screen.getByLabelText("Your post"), { target: { value: "We moved offices." } });
  fireEvent.click(screen.getByRole("button", { name: "Post" }));
  await waitFor(() => expect(onPosted).toHaveBeenCalled());
  const fd = (apiClient.apiUpload as jest.Mock).mock.calls[0][1] as FormData;
  expect(fd.get("kind")).toBe("UPDATE");
  expect(fd.get("caption")).toBe("We moved offices.");
  expect(fd.getAll("files")).toHaveLength(0);
});

it("a poll names what is missing, then sends its question, answers and length - and never photos", async () => {
  (apiClient.apiUpload as jest.Mock).mockResolvedValue({ id: "post-1" });
  const onPosted = jest.fn();
  render(<SocialComposer companies={companies as never} onPosted={onPosted} onCancel={jest.fn()} />);
  fireEvent.click(screen.getByRole("tab", { name: "Poll" }));
  expect(screen.queryByLabelText(/add a photo/i)).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Post" }));
  expect(await screen.findByText("Write the question.")).toBeInTheDocument();
  expect(screen.getByText("Give at least 2 answers.")).toBeInTheDocument();

  fireEvent.change(screen.getByLabelText("Question"), { target: { value: "Which shift do you prefer?" } });
  fireEvent.change(screen.getByLabelText("Answer 1"), { target: { value: "Morning" } });
  fireEvent.change(screen.getByLabelText("Answer 2"), { target: { value: "morning" } });
  expect(screen.getByText("Each answer can appear once.")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Answer 2"), { target: { value: "Night" } });
  fireEvent.click(screen.getByRole("button", { name: "+ Add an answer" }));
  fireEvent.change(screen.getByLabelText("Answer 3"), { target: { value: "  " } });
  fireEvent.change(screen.getByLabelText("Open for"), { target: { value: "7" } });
  fireEvent.click(screen.getByRole("button", { name: "Post" }));

  await waitFor(() => expect(onPosted).toHaveBeenCalled());
  const fd = (apiClient.apiUpload as jest.Mock).mock.calls[0][1] as FormData;
  expect(fd.get("kind")).toBe("POLL");
  expect(fd.get("caption")).toBe("Which shift do you prefer?");
  expect(JSON.parse(fd.get("pollOptions") as string)).toEqual(["Morning", "Night"]);
  expect(fd.get("pollDays")).toBe("7");
});

it("an event needs a name and a time that is still ahead", async () => {
  (apiClient.apiUpload as jest.Mock).mockResolvedValue({ id: "post-1" });
  const onPosted = jest.fn();
  render(<SocialComposer companies={companies as never} onPosted={onPosted} onCancel={jest.fn()} />);
  fireEvent.click(screen.getByRole("tab", { name: "Event" }));
  fireEvent.click(screen.getByRole("button", { name: "Post" }));
  expect(await screen.findByText("Give the event a name.")).toBeInTheDocument();
  expect(screen.getByText("Pick the date and time.")).toBeInTheDocument();

  fireEvent.change(screen.getByLabelText("Event name"), { target: { value: "Open day" } });
  fireEvent.change(screen.getByLabelText("Date and time"), { target: { value: "2020-01-01T10:00" } });
  expect(screen.getByText("Pick a date and time that is still ahead.")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Date and time"), { target: { value: "2031-05-18T14:00" } });
  fireEvent.change(screen.getByLabelText("Place (optional)"), { target: { value: "Manisa plant" } });
  fireEvent.click(screen.getByRole("button", { name: "Post" }));

  await waitFor(() => expect(onPosted).toHaveBeenCalled());
  const fd = (apiClient.apiUpload as jest.Mock).mock.calls[0][1] as FormData;
  expect(fd.get("kind")).toBe("EVENT");
  expect(fd.get("title")).toBe("Open day");
  expect(fd.get("eventStartsAt")).toBe(new Date("2031-05-18T14:00").toISOString());
  expect(fd.get("eventLocation")).toBe("Manisa plant");
});

it("a hiring post offers only the company's live job postings", async () => {
  (apiClient.apiGet as jest.Mock).mockResolvedValue([
    { id: "j1", jobTitle: "Forklift Operator", status: "PUBLISHED", daysRemaining: 12 },
    { id: "j2", jobTitle: "Filled role", status: "FILLED", daysRemaining: 0 },
    { id: "j3", jobTitle: "Expired role", status: "PUBLISHED", daysRemaining: 0 },
  ]);
  (apiClient.apiUpload as jest.Mock).mockResolvedValue({ id: "post-1" });
  const onPosted = jest.fn();
  render(<SocialComposer companies={companies as never} onPosted={onPosted} onCancel={jest.fn()} />);
  fireEvent.click(screen.getByRole("tab", { name: "Hiring" }));
  const select = await screen.findByLabelText("Job posting");
  expect(apiClient.apiGet).toHaveBeenCalledWith("/my-companies/c1/job-postings");
  expect(Array.from(select.querySelectorAll("option")).map((o) => o.textContent)).toEqual(["Choose a job posting", "Forklift Operator"]);

  fireEvent.click(screen.getByRole("button", { name: "Post" }));
  expect(await screen.findByText("Pick the job posting.")).toBeInTheDocument();
  fireEvent.change(select, { target: { value: "j1" } });
  fireEvent.click(screen.getByRole("button", { name: "Post" }));
  await waitFor(() => expect(onPosted).toHaveBeenCalled());
  const fd = (apiClient.apiUpload as jest.Mock).mock.calls[0][1] as FormData;
  expect(fd.get("kind")).toBe("HIRING");
  expect(fd.get("jobPostingId")).toBe("j1");
});

const paidCompanies = [{ companyId: "c1", companyName: "Acme", companySlug: "acme", tier: "STARTER", planStatus: "ACTIVE", isVerifiedBadge: true }];

it("Later sends the post to be scheduled, with the chosen moment, instead of publishing it", async () => {
  const scheduled = { id: "s1", companyId: "c1", publishAt: "2026-10-20T07:30:00.000Z" };
  (apiClient.apiUpload as jest.Mock).mockResolvedValue(scheduled);
  const onPosted = jest.fn();
  const onScheduled = jest.fn();
  render(<SocialComposer companies={paidCompanies as never} onPosted={onPosted} onScheduled={onScheduled} onCancel={jest.fn()} />);

  // Now is the default: no date field until Later is picked.
  expect(screen.getByRole("radio", { name: "Now" })).toHaveAttribute("aria-checked", "true");
  expect(screen.queryByLabelText("Date and time to post")).not.toBeInTheDocument();

  fireEvent.change(screen.getByPlaceholderText("Tell us what you think !"), { target: { value: "new gear" } });
  fireEvent.click(screen.getByRole("radio", { name: "Later" }));
  const inAWeek = new Date(Date.now() + 7 * 86_400_000);
  inAWeek.setSeconds(0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  const value = `${inAWeek.getFullYear()}-${pad(inAWeek.getMonth() + 1)}-${pad(inAWeek.getDate())}T${pad(inAWeek.getHours())}:${pad(inAWeek.getMinutes())}`;
  fireEvent.change(screen.getByLabelText("Date and time to post"), { target: { value } });
  fireEvent.click(screen.getByRole("button", { name: "Schedule" }));

  await waitFor(() => expect(onScheduled).toHaveBeenCalledWith(scheduled));
  expect(onPosted).not.toHaveBeenCalled();
  const [path, fd] = (apiClient.apiUpload as jest.Mock).mock.calls[0] as [string, FormData];
  expect(path).toBe("/social/scheduled-posts");
  expect(fd.get("caption")).toBe("new gear");
  expect(fd.get("publishAt")).toBe(inAWeek.toISOString());
});

it("Later wants a time that is still ahead", async () => {
  render(<SocialComposer companies={paidCompanies as never} onPosted={jest.fn()} onCancel={jest.fn()} />);
  fireEvent.change(screen.getByPlaceholderText("Tell us what you think !"), { target: { value: "new gear" } });
  fireEvent.click(screen.getByRole("radio", { name: "Later" }));
  fireEvent.change(screen.getByLabelText("Date and time to post"), { target: { value: "2020-01-01T09:00" } });
  fireEvent.click(screen.getByRole("button", { name: "Schedule" }));
  expect(await screen.findByText("Pick a time at least 5 minutes from now.")).toBeInTheDocument();
  expect(apiClient.apiUpload).not.toHaveBeenCalled();
});

it("on the Free plan, Later explains which plans have it and cannot be sent", () => {
  render(<SocialComposer companies={companies as never} onPosted={jest.fn()} onCancel={jest.fn()} />);
  fireEvent.click(screen.getByRole("radio", { name: "Later" }));
  expect(screen.getByText(/part of the Starter plan and above/)).toBeInTheDocument();
  expect(screen.queryByLabelText("Date and time to post")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Schedule" })).toBeDisabled();
});

it("the dashboard's form is always for later: no Now choice", () => {
  render(<SocialComposer companies={paidCompanies as never} alwaysLater onPosted={jest.fn()} onCancel={jest.fn()} />);
  expect(screen.queryByRole("radio", { name: "Now" })).not.toBeInTheDocument();
  expect(screen.getByLabelText("Date and time to post")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Schedule" })).toBeEnabled();
});
