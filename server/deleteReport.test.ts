import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock the database functions
vi.mock("./db", () => ({
  deleteDailyReport: vi.fn(),
  getDailyReportById: vi.fn(),
  getUserDailyReports: vi.fn(),
  createDailyReport: vi.fn(),
  updateDailyReport: vi.fn(),
  updateDailyReportNotionSync: vi.fn(),
  createSession: vi.fn(),
  getSessionById: vi.fn(),
  getUserSessions: vi.fn(),
  updateSessionStatus: vi.fn(),
  updateSessionTitle: vi.fn(),
  createMessage: vi.fn(),
  getSessionMessages: vi.fn(),
  createAudioFile: vi.fn(),
  updateAudioTranscription: vi.fn(),
  updateUserNotionConfig: vi.fn(),
}));

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(userId: number = 1): TrpcContext {
  const user: AuthenticatedUser = {
    id: userId,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

describe("report.delete", () => {
  it("should call deleteDailyReport with correct parameters", async () => {
    const { deleteDailyReport } = await import("./db");
    const mockDelete = deleteDailyReport as ReturnType<typeof vi.fn>;
    mockDelete.mockResolvedValue(true);

    const ctx = createAuthContext(1);
    const caller = appRouter.createCaller(ctx);

    const result = await caller.report.delete({ id: 123 });

    expect(result).toEqual({ success: true });
    expect(mockDelete).toHaveBeenCalledWith(123, 1);
  });

  it("should throw error when report not found or unauthorized", async () => {
    const { deleteDailyReport } = await import("./db");
    const mockDelete = deleteDailyReport as ReturnType<typeof vi.fn>;
    mockDelete.mockResolvedValue(false);

    const ctx = createAuthContext(1);
    const caller = appRouter.createCaller(ctx);

    await expect(caller.report.delete({ id: 999 })).rejects.toThrow(
      "日报不存在或无权删除"
    );
  });
});
