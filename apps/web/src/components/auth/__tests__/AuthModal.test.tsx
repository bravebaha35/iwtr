import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthModal } from "../AuthModal";

const login = jest.fn();
const verifyAdminOtp = jest.fn();

jest.mock("@/lib/auth-context", () => ({
  useAuth: () => ({
    login,
    verifyAdminOtp,
    register: jest.fn(),
    authMode: "login",
    setAuthMode: jest.fn(),
    authModalOpen: true,
    closeAuthModal: jest.fn(),
  }),
}));

// This is the frontend half of "6-digit OTP is strictly required for the
// admin email": AuthContext.login resolving with otpRequired must show the
// code step instead of closing the modal, and the code must actually reach
// verifyAdminOtp — never treated as already logged in on password alone.
describe("AuthModal — admin OTP step", () => {
  beforeEach(() => {
    login.mockReset();
    verifyAdminOtp.mockReset();
  });

  it("shows the 6-digit code screen when login() reports otpRequired, and submits the code via verifyAdminOtp", async () => {
    const user = userEvent.setup();
    login.mockResolvedValue({ otpRequired: true });
    verifyAdminOtp.mockResolvedValue(undefined);

    render(<AuthModal />);

    await user.type(screen.getByPlaceholderText("Email"), "info@iworkedthere.com");
    await user.type(screen.getByPlaceholderText("Password"), "correct-horse-battery-staple");
    // Two elements share the accessible name "Log in" — the mode-tab toggle
    // and the actual submit button — so disambiguate by type.
    const submitButton = screen
      .getAllByRole("button", { name: "Log in" })
      .find((b) => b.getAttribute("type") === "submit")!;
    await user.click(submitButton);

    expect(login).toHaveBeenCalledWith("info@iworkedthere.com", "correct-horse-battery-staple");
    expect(await screen.findByText("Enter your login code")).toBeInTheDocument();

    // Six single-digit boxes (OtpInput) are the only textboxes on this screen.
    const digitBoxes = screen.getAllByRole("textbox");
    expect(digitBoxes).toHaveLength(6);
    for (const [i, digit] of ["1", "2", "3", "4", "5", "6"].entries()) {
      await user.type(digitBoxes[i], digit);
    }

    await waitFor(() => {
      expect(verifyAdminOtp).toHaveBeenCalledWith("info@iworkedthere.com", "123456");
    });
  });

  it("does NOT show the OTP screen for a non-admin login (no otpRequired)", async () => {
    const user = userEvent.setup();
    login.mockResolvedValue({ otpRequired: false });

    render(<AuthModal />);

    await user.type(screen.getByPlaceholderText("Email"), "member@gmail.com");
    await user.type(screen.getByPlaceholderText("Password"), "hunter2hunter2");
    // Two elements share the accessible name "Log in" — the mode-tab toggle
    // and the actual submit button — so disambiguate by type.
    const submitButton = screen
      .getAllByRole("button", { name: "Log in" })
      .find((b) => b.getAttribute("type") === "submit")!;
    await user.click(submitButton);

    await waitFor(() => expect(login).toHaveBeenCalled());
    expect(screen.queryByText("Enter your login code")).not.toBeInTheDocument();
    expect(verifyAdminOtp).not.toHaveBeenCalled();
  });
});
