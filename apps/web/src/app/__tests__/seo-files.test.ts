/**
 * @jest-environment node
 */
import robots from "../robots";
import sitemap from "../sitemap";

describe("robots.txt", () => {
  const rules = robots().rules as { allow?: string[]; disallow?: string[] };

  it("lets crawlers index public pages", () => {
    expect(rules.allow).toEqual(expect.arrayContaining(["/", "/companies/", "/jobs", "/social"]));
  });

  it("blocks private pages and internal routes", () => {
    expect(rules.disallow).toEqual(
      expect.arrayContaining(["/api/", "/admin", "/me", "/my/", "/onboarding"]),
    );
  });

  it("points crawlers at the sitemap", () => {
    expect(robots().sitemap).toBe("https://iworkedthere.com/sitemap.xml");
  });
});

describe("sitemap.xml", () => {
  afterEach(() => jest.restoreAllMocks());

  it("lists the public pages plus every public company page", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify([{ slug: "acme", lastModified: "2026-09-20T00:00:00.000Z" }]), { status: 200 }),
    );
    const urls = (await sitemap()).map((e) => e.url);
    expect(urls).toEqual(
      expect.arrayContaining([
        "https://iworkedthere.com",
        "https://iworkedthere.com/jobs",
        "https://iworkedthere.com/social",
        "https://iworkedthere.com/privacy",
        "https://iworkedthere.com/terms",
        "https://iworkedthere.com/companies/acme",
      ]),
    );
    expect(urls.some((u) => u.includes("/me") || u.includes("/admin"))).toBe(false);
  });

  it("still returns the static pages if the API is down", async () => {
    jest.spyOn(global, "fetch").mockRejectedValue(new Error("down"));
    const urls = (await sitemap()).map((e) => e.url);
    expect(urls).toContain("https://iworkedthere.com/jobs");
  });
});
