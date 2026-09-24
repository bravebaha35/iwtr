const sendMail = jest.fn().mockResolvedValue({});
const createTransport = jest.fn(() => ({ sendMail }));
jest.mock("nodemailer", () => ({ __esModule: true, default: { createTransport } }));

import { SmtpAdminOtpNotifier, createAdminOtpNotifier } from "../smtp-admin-otp-notifier";
import { ConsoleAdminOtpNotifier } from "../console-admin-otp-notifier";

const ENV_KEYS = [
  "ADMIN_OTP_SMTP_HOST",
  "ADMIN_OTP_SMTP_PORT",
  "ADMIN_OTP_SMTP_USER",
  "ADMIN_OTP_SMTP_PASSWORD",
  "ADMIN_OTP_SENDER_EMAIL",
  "RIVAL_ANALYTICS_SMTP_HOST",
  "RIVAL_ANALYTICS_SMTP_PORT",
  "RIVAL_ANALYTICS_SMTP_USER",
  "RIVAL_ANALYTICS_SMTP_PASSWORD",
  "RIVAL_ANALYTICS_SENDER_EMAIL",
];
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of ENV_KEYS) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
  sendMail.mockClear();
  createTransport.mockClear();
});
afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe("createAdminOtpNotifier", () => {
  it("falls back to the console notifier when no SMTP account is configured", () => {
    expect(createAdminOtpNotifier()).toBeInstanceOf(ConsoleAdminOtpNotifier);
  });

  it("uses SMTP when its own ADMIN_OTP_SMTP_* account is configured", () => {
    process.env.ADMIN_OTP_SMTP_USER = "admin@example.com";
    process.env.ADMIN_OTP_SMTP_PASSWORD = "secret";
    expect(createAdminOtpNotifier()).toBeInstanceOf(SmtpAdminOtpNotifier);
  });

  it("reuses the Rival Analytics SMTP account when only that one is configured", () => {
    process.env.RIVAL_ANALYTICS_SMTP_USER = "reports@example.com";
    process.env.RIVAL_ANALYTICS_SMTP_PASSWORD = "secret";
    expect(createAdminOtpNotifier()).toBeInstanceOf(SmtpAdminOtpNotifier);
    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({ auth: { user: "reports@example.com", pass: "secret" } }),
    );
  });
});

describe("SmtpAdminOtpNotifier.sendOtp", () => {
  it("emails the code to the admin's address", async () => {
    process.env.ADMIN_OTP_SMTP_USER = "admin-mailer@example.com";
    process.env.ADMIN_OTP_SMTP_PASSWORD = "secret";
    process.env.ADMIN_OTP_SENDER_EMAIL = "no-reply@iworkedthere.com";

    await new SmtpAdminOtpNotifier().sendOtp("info@iworkedthere.com", "123456");

    expect(sendMail).toHaveBeenCalledTimes(1);
    const mail = sendMail.mock.calls[0][0];
    expect(mail.to).toBe("info@iworkedthere.com");
    expect(mail.from).toBe("no-reply@iworkedthere.com");
    expect(mail.text).toContain("123456");
  });
});
