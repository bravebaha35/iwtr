import { useState } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SkillsPicker, matchSkills } from "../SkillsPicker";
import { apiGet } from "@/lib/api-client";

jest.mock("@/lib/api-client", () => ({ apiGet: jest.fn() }));

const SKILLS = ["Welding", "TIG / MIG Welding", "Web Design", "Barista Skills", "Forklift Operation"].map((name, i) => ({
  id: `s${i}`,
  name,
}));

function Harness({ initial = [] }: { initial?: string[] }) {
  const [ids, setIds] = useState(initial);
  return <SkillsPicker selectedIds={ids} onChange={setIds} />;
}

beforeEach(() => {
  (apiGet as jest.Mock).mockResolvedValue(SKILLS);
});

describe("matchSkills", () => {
  it("lists names starting with the search, then names with a word starting with it, then the rest", () => {
    expect(matchSkills(SKILLS, "we", []).map((s) => s.name)).toEqual(["Welding", "Web Design", "TIG / MIG Welding"]);
    expect(matchSkills(SKILLS, "lift", []).map((s) => s.name)).toEqual(["Forklift Operation"]);
  });

  it("leaves out skills already picked, and finds nothing for an empty search", () => {
    expect(matchSkills(SKILLS, "weld", ["s0"]).map((s) => s.name)).toEqual(["TIG / MIG Welding"]);
    expect(matchSkills(SKILLS, "  ", [])).toEqual([]);
  });
});

describe("SkillsPicker", () => {
  it("shows no skills until the member searches", async () => {
    render(<Harness />);
    await waitFor(() => expect(apiGet).toHaveBeenCalledWith("/skills"));
    expect(screen.queryByText("Welding")).not.toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Matching skills" })).not.toBeInTheDocument();
  });

  it("adds a searched skill as a chip and removes it again", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(screen.getByLabelText("Verified skills"), "bari");
    await user.click(await screen.findByRole("button", { name: /Barista Skills/ }));
    expect(screen.getByText("1 / 10")).toBeInTheDocument();
    expect(screen.getByLabelText("Verified skills")).toHaveValue("");
    await user.click(screen.getByRole("button", { name: "Remove Barista Skills" }));
    expect(screen.getByText("0 / 10")).toBeInTheDocument();
  });

  it("closes the search box once 10 are picked", async () => {
    (apiGet as jest.Mock).mockResolvedValue(Array.from({ length: 11 }, (_, i) => ({ id: `k${i}`, name: `Skill ${i}` })));
    render(<Harness initial={Array.from({ length: 10 }, (_, i) => `k${i}`)} />);
    expect(await screen.findByText("10 / 10")).toBeInTheDocument();
    expect(screen.getByLabelText("Verified skills")).toBeDisabled();
  });
});
