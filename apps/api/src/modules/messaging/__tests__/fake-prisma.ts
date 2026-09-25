import { Prisma } from "@prisma/client";

/**
 * Small in-memory stand-in for the handful of Prisma calls MessagingService
 * makes, so the tests assert on resulting state (what a user would see)
 * rather than on which mock got called with what.
 */
export interface FakeReview {
  id: string;
  userId: string;
  companyId: string;
  status: string;
  isRandomizedIdentity: boolean;
  displayUsername: string | null;
  generalThoughts: string | null;
  hasReply: boolean;
}

interface Conv {
  id: string;
  reviewId: string;
  companyId: string;
  reviewerUserId: string;
  endedAt: Date | null;
  endedBy: "REVIEWER" | "COMPANY" | null;
  reviewerLastReadSeq: number;
  companyLastReadSeq: number;
  createdAt: Date;
}

interface Msg {
  id: string;
  seq: number;
  conversationId: string;
  side: "REVIEWER" | "COMPANY";
  authorUserId: string | null;
  content: string;
  createdAt: Date;
}

let idCounter = 0;
const uuid = () => `00000000-0000-4000-8000-${String(++idCounter).padStart(12, "0")}`;
const DAY = new Date("2026-09-25T00:00:00.000Z");

export function createFakePrisma(opts: {
  reviews: FakeReview[];
  users: { id: string; reviewUsername: string | null }[];
  companies: { id: string; name: string; slug: string }[];
  owners: { userId: string; companyId: string; claimStatus: string }[];
}) {
  const conversations: Conv[] = [];
  const messages: Msg[] = [];
  let seq = 0;

  const assemble = (c: Conv, include: any) => {
    const out: any = { ...c };
    if (include?.review) {
      const r = opts.reviews.find((x) => x.id === c.reviewId)!;
      const u = opts.users.find((x) => x.id === r.userId) ?? null;
      out.review = { ...r, user: u ? { reviewUsername: u.reviewUsername } : null };
    }
    if (include?.company) out.company = opts.companies.find((x) => x.id === c.companyId);
    if (include?.messages) {
      let list = messages.filter((m) => m.conversationId === c.id).sort((a, b) => a.seq - b.seq);
      if (include.messages.orderBy?.seq === "desc") list = list.reverse();
      if (include.messages.take) list = list.slice(0, include.messages.take);
      out.messages = list.map((m) => ({ ...m }));
    }
    return out;
  };

  const prisma: any = {
    review: {
      findUnique: async ({ where }: any) => {
        const r = opts.reviews.find((x) => x.id === where.id);
        if (!r) return null;
        return { ...r, companyReply: r.hasReply ? { id: `reply-${r.id}` } : null };
      },
    },
    companyOwner: {
      findUnique: async ({ where }: any) =>
        opts.owners.find(
          (o) => o.userId === where.userId_companyId.userId && o.companyId === where.userId_companyId.companyId,
        ) ?? null,
    },
    reviewConversation: {
      create: async ({ data, include }: any) => {
        if (conversations.some((c) => c.reviewId === data.reviewId)) {
          throw new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
            code: "P2002",
            clientVersion: "5.22.0",
          });
        }
        const c: Conv = {
          id: uuid(),
          reviewId: data.reviewId,
          companyId: data.companyId,
          reviewerUserId: data.reviewerUserId,
          endedAt: null,
          endedBy: null,
          reviewerLastReadSeq: 0,
          companyLastReadSeq: 0,
          createdAt: DAY,
        };
        conversations.push(c);
        if (data.messages?.create) {
          const m = data.messages.create;
          messages.push({ id: uuid(), seq: ++seq, conversationId: c.id, createdAt: DAY, authorUserId: null, ...m });
        }
        return assemble(c, include);
      },
      findUnique: async ({ where, include }: any) => {
        const c = conversations.find((x) => x.id === where.id);
        return c ? assemble(c, include) : null;
      },
      findMany: async ({ where, include }: any) =>
        conversations
          .filter((c) => Object.entries(where).every(([k, v]) => (c as any)[k] === v))
          .map((c) => assemble(c, include)),
      update: async ({ where, data }: any) => {
        const c = conversations.find((x) => x.id === where.id)!;
        Object.assign(c, data);
        return { ...c };
      },
    },
    reviewConversationMessage: {
      create: async ({ data }: any) => {
        const m: Msg = { id: uuid(), seq: ++seq, createdAt: DAY, authorUserId: null, ...data };
        messages.push(m);
        return { ...m };
      },
    },
  };
  prisma.$transaction = async (cb: (tx: unknown) => unknown) => cb(prisma);
  // Handy for assertions on stored state.
  prisma._state = { conversations, messages };
  return prisma;
}
