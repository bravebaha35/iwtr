import { OnboardingService } from "../onboarding.service";

// The header shows a verified company owner's real name, never their random
// anonymous username. OnboardingService.getStatus carries it as ownerName.
function makeService(opts: {
  approvedOwner: boolean;
  employerName?: { firstName: string; lastName: string } | null;
  identity?: { firstName: string; lastName: string; birthDate: string } | null;
}) {
  const prisma = {
    user: {
      findUniqueOrThrow: jest.fn().mockResolvedValue({
        status: "ACTIVE",
        country: "TR",
        city: "İzmir",
        district: "Buca",
        avatarKey: "office-1",
        avatarGradient: "g1",
        reviewUsername: "Chief Happiness Officer",
        displayName: null,
      }),
    },
    companyOwner: {
      findFirst: jest.fn().mockResolvedValue(opts.approvedOwner ? { id: "co-1" } : null),
    },
  };
  const piiVault = { getMyIdentity: jest.fn().mockResolvedValue(opts.identity ?? null) };
  const phoneVerification = {};
  const employerProfile = { getOwnName: jest.fn().mockResolvedValue(opts.employerName ?? null) };
  const service = new OnboardingService(
    prisma as never,
    piiVault as never,
    phoneVerification as never,
    employerProfile as never,
  );
  return { service, prisma, piiVault, employerProfile };
}

describe("OnboardingService.getStatus ownerName", () => {
  it("is null for someone who doesn't own an approved company, and never reads their PII", async () => {
    const { service, piiVault, employerProfile } = makeService({
      approvedOwner: false,
      identity: { firstName: "Ayşe", lastName: "Yılmaz", birthDate: "1990-01-01" },
    });
    const status = await service.getStatus("u1");
    expect(status.ownerName).toBeNull();
    expect(status.reviewUsername).toBe("Chief Happiness Officer");
    expect(piiVault.getMyIdentity).not.toHaveBeenCalled();
    expect(employerProfile.getOwnName).not.toHaveBeenCalled();
  });

  it("uses the owner's registered (verified) name", async () => {
    const { service } = makeService({
      approvedOwner: true,
      identity: { firstName: "Ayşe", lastName: "Yılmaz", birthDate: "1990-01-01" },
    });
    expect((await service.getStatus("u1")).ownerName).toBe("Ayşe Yılmaz");
  });

  it("prefers the name on the employer profile when the owner has set one", async () => {
    const { service } = makeService({
      approvedOwner: true,
      employerName: { firstName: "Ayşe", lastName: "Demir" },
      identity: { firstName: "Ayşe", lastName: "Yılmaz", birthDate: "1990-01-01" },
    });
    expect((await service.getStatus("u1")).ownerName).toBe("Ayşe Demir");
  });

  it("is null (never the random username) when an owner has no name on file at all", async () => {
    const { service } = makeService({ approvedOwner: true });
    expect((await service.getStatus("u1")).ownerName).toBeNull();
  });
});
