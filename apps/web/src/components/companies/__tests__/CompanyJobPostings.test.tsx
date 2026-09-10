import { render, screen, waitFor } from "@testing-library/react";
import { CompanyJobPostings } from "../CompanyJobPostings";
import * as apiClient from "@/lib/api-client";

jest.mock("@/lib/api-client");

describe("CompanyJobPostings", () => {
  it("fetches the per-company job-postings stream by slug", async () => {
    (apiClient.apiGet as jest.Mock).mockResolvedValue({ jobPostings: [], jobTitles: [] });
    render(<CompanyJobPostings slug="acme" />);
    await waitFor(() => expect(apiClient.apiGet).toHaveBeenCalledWith("/companies/acme/job-postings"));
  });

  it("renders owner-authored postings and the classified job-title fallback separately", async () => {
    (apiClient.apiGet as jest.Mock).mockResolvedValue({
      jobPostings: [{ jobTitle: "Forklift Operator", description: "Day shift, warehouse." }],
      jobTitles: ["Accountant", "Recruiter"],
    });
    render(<CompanyJobPostings slug="acme" />);

    expect(await screen.findByText("Forklift Operator")).toBeInTheDocument();
    expect(screen.getByText("Day shift, warehouse.")).toBeInTheDocument();
    expect(screen.getByText("Accountant")).toBeInTheDocument();
    expect(screen.getByText(/roles seen here/i)).toBeInTheDocument();
  });

  it("shows a no-open-roles message when both arrays are empty", async () => {
    (apiClient.apiGet as jest.Mock).mockResolvedValue({ jobPostings: [], jobTitles: [] });
    render(<CompanyJobPostings slug="acme" />);
    expect(await screen.findByText(/no open roles listed/i)).toBeInTheDocument();
  });

  it("surfaces a load error instead of a silent empty state", async () => {
    (apiClient.apiGet as jest.Mock).mockRejectedValue(new Error("network"));
    render(<CompanyJobPostings slug="acme" />);
    expect(await screen.findByText(/couldn't load job postings/i)).toBeInTheDocument();
  });
});
