import { render, screen } from "@testing-library/react";
import { EmployerAdSlot } from "../EmployerAdSlot";
import { apiGet } from "@/lib/api-client";

jest.mock("@/lib/api-client", () => ({ apiGet: jest.fn() }));
const get = apiGet as jest.Mock;

it("shows the sample employer ad while nobody has bought the space", async () => {
  // The API answers "none running" with an empty body (undefined here).
  get.mockResolvedValue(undefined);
  render(<EmployerAdSlot />);
  expect(await screen.findByAltText(/Test ad: Örnek Lojistik/)).toBeInTheDocument();
});

it("shows the buying company's job, linking to its jobs", async () => {
  get.mockResolvedValue({
    company: { id: "c1", slug: "acme", name: "Acme Lojistik", city: "İzmir", mainPhotoUrl: null },
    posting: { id: "p1", jobTitle: "Forklift Operatörü", description: "Full-time", workType: "MANUAL_LABOUR" },
  });
  render(<EmployerAdSlot />);
  expect(await screen.findByText("Forklift Operatörü")).toBeInTheDocument();
  expect(screen.getByRole("link")).toHaveAttribute("href", "/companies/acme?tab=jobs");
});
