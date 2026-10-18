import { BadRequestException, NotFoundException } from "@nestjs/common";
import { referenceInputSchema, certificateInputSchema } from "@iwtr/shared-types";
import { MemberCvService } from "../member-cv.service";

const USER = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const REF_ID = "33333333-3333-4333-8333-333333333333";

function makePrisma(overrides: Record<string, unknown> = {}) {
  return {
    user: {
      findUniqueOrThrow: jest.fn().mockResolvedValue({ status: "ACTIVE", cvPhotoUrl: null }),
      update: jest.fn().mockResolvedValue({}),
    },
    memberReference: {
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: REF_ID, createdAt: new Date(), ...data })),
      findUnique: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    memberCertificate: {
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: REF_ID, createdAt: new Date(), ...data })),
      findUnique: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    ...overrides,
  };
}

const reference = {
  firstName: "Ayşe",
  lastName: "Demir",
  position: "MIDDLE_MANAGER" as const,
  email: "ayse.demir@example.com",
  phoneNumber: "",
};

describe("referenceInputSchema", () => {
  it("needs an email or a phone number", () => {
    expect(referenceInputSchema.safeParse({ ...reference, email: "", phoneNumber: "" }).success).toBe(false);
    expect(referenceInputSchema.safeParse({ ...reference, email: "", phoneNumber: "+905321234567" }).success).toBe(true);
    expect(referenceInputSchema.safeParse(reference).success).toBe(true);
  });

  it("only takes a position from the fixed list", () => {
    expect(referenceInputSchema.safeParse({ ...reference, position: "CEO" }).success).toBe(false);
  });
});

describe("certificateInputSchema", () => {
  it("takes a month as YYYY-MM only", () => {
    const base = { name: "PMP", issuer: "PMI", description: "" };
    expect(certificateInputSchema.safeParse({ ...base, issuedMonth: "2024-03" }).success).toBe(true);
    expect(certificateInputSchema.safeParse({ ...base, issuedMonth: "2024-13" }).success).toBe(false);
    expect(certificateInputSchema.safeParse({ ...base, issuedMonth: "2024-" }).success).toBe(false);
  });
});

describe("MemberCvService", () => {
  it("adds a reference with an empty phone stored as null and markup stripped", async () => {
    const prisma = makePrisma();
    const service = new MemberCvService(prisma as never);
    const saved = await service.addReference(USER, { ...reference, firstName: "<b>Ayşe</b>" });
    expect(prisma.memberReference.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: USER, firstName: "Ayşe", phoneNumber: null }),
    });
    expect(saved.firstName).toBe("Ayşe");
  });

  it("stops at five references", async () => {
    const prisma = makePrisma();
    prisma.memberReference.count.mockResolvedValue(5);
    const service = new MemberCvService(prisma as never);
    await expect(service.addReference(USER, reference)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.memberReference.create).not.toHaveBeenCalled();
  });

  it("never edits someone else's reference", async () => {
    const prisma = makePrisma();
    prisma.memberReference.findUnique.mockResolvedValue({ userId: OTHER });
    const service = new MemberCvService(prisma as never);
    await expect(service.updateReference(USER, REF_ID, reference)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.memberReference.update).not.toHaveBeenCalled();
  });

  it("deletes only the caller's own certificate", async () => {
    const prisma = makePrisma();
    prisma.memberCertificate.deleteMany.mockResolvedValue({ count: 0 });
    const service = new MemberCvService(prisma as never);
    await expect(service.deleteCertificate(USER, REF_ID)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.memberCertificate.deleteMany).toHaveBeenCalledWith({ where: { id: REF_ID, userId: USER } });
  });

  it("refuses a CV photo upload with no file", async () => {
    const service = new MemberCvService(makePrisma() as never);
    await expect(service.uploadCvPhoto(USER, undefined)).rejects.toBeInstanceOf(BadRequestException);
  });

  it("refuses everything before onboarding is finished", async () => {
    const prisma = makePrisma();
    prisma.user.findUniqueOrThrow.mockResolvedValue({ status: "PENDING_HISTORY" });
    const service = new MemberCvService(prisma as never);
    await expect(service.addCertificate(USER, { name: "PMP", issuer: "PMI", issuedMonth: "2024-03" })).rejects.toThrow(
      "Complete onboarding",
    );
  });
});
