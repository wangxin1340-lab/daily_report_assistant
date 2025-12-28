import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(overrides: Partial<AuthenticatedUser> = {}): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user-123",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    notionDatabaseId: null,
    ...overrides,
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

describe("Daily Report Assistant API", () => {
  describe("auth.me", () => {
    it("returns the authenticated user", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.auth.me();

      expect(result).toBeDefined();
      expect(result?.openId).toBe("test-user-123");
      expect(result?.name).toBe("Test User");
    });

    it("returns null for unauthenticated user", async () => {
      const ctx: TrpcContext = {
        user: null,
        req: { protocol: "https", headers: {} } as TrpcContext["req"],
        res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
      };
      const caller = appRouter.createCaller(ctx);

      const result = await caller.auth.me();

      expect(result).toBeNull();
    });
  });

  describe("auth.logout", () => {
    it("clears the session cookie and returns success", async () => {
      const clearCookieMock = vi.fn();
      const ctx: TrpcContext = {
        user: createAuthContext().user,
        req: { protocol: "https", headers: {} } as TrpcContext["req"],
        res: { clearCookie: clearCookieMock } as unknown as TrpcContext["res"],
      };
      const caller = appRouter.createCaller(ctx);

      const result = await caller.auth.logout();

      expect(result).toEqual({ success: true });
      expect(clearCookieMock).toHaveBeenCalled();
    });
  });
});

describe("Notion Sync Data Preparation", () => {
  it("prepares sync data correctly", async () => {
    const { prepareNotionSyncData } = await import("./notion");
    
    const mockReport = {
      id: 1,
      userId: 1,
      sessionId: 1,
      reportDate: new Date("2024-12-28"),
      workContent: "完成了项目A的开发",
      completionStatus: "已完成80%",
      problems: "遇到了性能问题",
      tomorrowPlan: "继续优化性能",
      summary: "今日工作顺利",
      markdownContent: "# 日报内容",
      notionPageId: null,
      notionSyncedAt: null,
      notionSyncStatus: "pending" as const,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const syncData = prepareNotionSyncData(mockReport, "test-db-id");

    expect(syncData.databaseId).toBe("test-db-id");
    expect(syncData.title).toContain("工作日报");
    expect(syncData.workContent).toBe("完成了项目A的开发");
    expect(syncData.summary).toBe("今日工作顺利");
  });

  it("generates MCP params correctly", async () => {
    const { prepareNotionSyncData, generateNotionMCPParams } = await import("./notion");
    
    const mockReport = {
      id: 1,
      userId: 1,
      sessionId: 1,
      reportDate: new Date("2024-12-28"),
      workContent: "测试工作内容",
      completionStatus: "已完成",
      problems: "无",
      tomorrowPlan: "继续工作",
      summary: "测试总结",
      markdownContent: "# 测试",
      notionPageId: null,
      notionSyncedAt: null,
      notionSyncStatus: "pending" as const,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const syncData = prepareNotionSyncData(mockReport, "test-db-id");
    const mcpParams = generateNotionMCPParams(syncData);

    expect(mcpParams.toolName).toBe("notion-create-pages");
    expect(mcpParams.serverName).toBe("notion");
    expect(mcpParams.input).toContain("test-db-id");
  });
});
