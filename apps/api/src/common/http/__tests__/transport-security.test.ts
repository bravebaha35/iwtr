import { transportSecurity } from "../transport-security";

function run(opts: { production: boolean; proto?: string; host?: string; url?: string }) {
  const headers: Record<string, string> = {};
  const res = {
    statusCode: 200,
    redirectedTo: null as string | null,
    setHeader: (k: string, v: string) => {
      headers[k.toLowerCase()] = v;
    },
    redirect(code: number, url: string) {
      this.statusCode = code;
      this.redirectedTo = url;
    },
  };
  const next = jest.fn();
  const req = {
    headers: { "x-forwarded-proto": opts.proto, host: opts.host ?? "api.iworkedthere.com" },
    originalUrl: opts.url ?? "/v1/companies",
  };
  transportSecurity({ production: opts.production })(req as any, res as any, next);
  return { headers, res, next };
}

describe("transportSecurity", () => {
  it("always tells browsers to use HTTPS for two years, subdomains included", () => {
    const { headers, next } = run({ production: false });
    expect(headers["strict-transport-security"]).toBe("max-age=63072000; includeSubDomains; preload");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(next).toHaveBeenCalled();
  });

  it("redirects plain-HTTP requests to HTTPS in production", () => {
    const { res, next } = run({ production: true, proto: "http", url: "/v1/companies?q=a" });
    expect(res.statusCode).toBe(308);
    expect(res.redirectedTo).toBe("https://api.iworkedthere.com/v1/companies?q=a");
    expect(next).not.toHaveBeenCalled();
  });

  it("lets HTTPS requests through in production", () => {
    const { next } = run({ production: true, proto: "https" });
    expect(next).toHaveBeenCalled();
  });

  it("never redirects in local development", () => {
    const { next } = run({ production: false, proto: "http" });
    expect(next).toHaveBeenCalled();
  });
});
