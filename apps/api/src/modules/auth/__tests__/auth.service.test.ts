import { ConflictException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { AuthService } from "../auth.service";

function prismaError(code: string) {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code,
    clientVersion: "5.20.0",
  });
}

describe("AuthService.registerWithEmail", () => {
  it("throws a friendly ConflictException when two concurrent registrations race past the existing-email check", async () => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockRejectedValue(prismaError("P2002")),
      },
    };
    const service = new AuthService(prisma as any, {} as any);

    await expect(
      service.registerWithEmail({ email: "real@gmail.com", password: "Password123!" }),
    ).rejects.toThrow(new ConflictException("An account with this email already exists"));
  });
});
