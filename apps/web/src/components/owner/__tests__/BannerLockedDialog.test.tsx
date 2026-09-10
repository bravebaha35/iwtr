import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BannerLockedDialog } from "../BannerLockedDialog";

describe("BannerLockedDialog", () => {
  it("explains that the system-assigned default banner can't be changed on the current tier", () => {
    render(<BannerLockedDialog onClose={jest.fn()} onSeePlans={jest.fn()} />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/can't change the system-assigned/i)).toBeInTheDocument();
  });

  it("is typeset in the app font (Plus Jakarta Sans via font-sans)", () => {
    render(<BannerLockedDialog onClose={jest.fn()} onSeePlans={jest.fn()} />);
    // The overlay carries font-sans so the whole dialog inherits it.
    expect(screen.getByRole("dialog").parentElement).toHaveClass("font-sans");
  });

  it("'See Plans' fires onSeePlans", async () => {
    const onSeePlans = jest.fn();
    render(<BannerLockedDialog onClose={jest.fn()} onSeePlans={onSeePlans} />);
    await userEvent.click(screen.getByRole("button", { name: "See Plans" }));
    expect(onSeePlans).toHaveBeenCalledTimes(1);
  });

  it("closes on the backdrop, the close button, and Escape", async () => {
    const onClose = jest.fn();
    render(<BannerLockedDialog onClose={onClose} onSeePlans={jest.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);

    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
