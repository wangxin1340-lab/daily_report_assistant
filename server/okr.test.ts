import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };

  return { ctx };
}

describe("OKR Management", () => {
  it("should create OKR period", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.okr.createPeriod({
      title: "2025 Q1-Q2 OKR",
      startDate: new Date("2025-01-01"),
      endDate: new Date("2025-06-30"),
    });

    expect(result).toHaveProperty("periodId");
    expect(typeof result.periodId).toBe("number");
  });

  it("should list OKR periods", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const periods = await caller.okr.listPeriods();
    expect(Array.isArray(periods)).toBe(true);
  });

  it("should create objective", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // 先创建周期
    const periodResult = await caller.okr.createPeriod({
      title: "Test Period",
      startDate: new Date("2025-01-01"),
      endDate: new Date("2025-06-30"),
    });

    // 创建 Objective
    const objResult = await caller.okr.createObjective({
      periodId: periodResult.periodId,
      title: "提升用户体验",
      description: "优化产品交互流程",
    });

    expect(objResult).toHaveProperty("objectiveId");
    expect(typeof objResult.objectiveId).toBe("number");
  });

  it("should create key result", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // 创建周期和 Objective
    const periodResult = await caller.okr.createPeriod({
      title: "Test Period",
      startDate: new Date("2025-01-01"),
      endDate: new Date("2025-06-30"),
    });

    const objResult = await caller.okr.createObjective({
      periodId: periodResult.periodId,
      title: "提升用户体验",
    });

    // 创建 Key Result
    const krResult = await caller.okr.createKeyResult({
      objectiveId: objResult.objectiveId,
      title: "用户满意度达到 90%",
      targetValue: "90",
      currentValue: "0",
      unit: "%",
    });

    expect(krResult).toHaveProperty("keyResultId");
    expect(typeof krResult.keyResultId).toBe("number");
  });

  it("should get full OKR structure", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // 创建完整的 OKR 结构
    const periodResult = await caller.okr.createPeriod({
      title: "Test Period",
      startDate: new Date("2025-01-01"),
      endDate: new Date("2025-06-30"),
    });

    const objResult = await caller.okr.createObjective({
      periodId: periodResult.periodId,
      title: "Test Objective",
    });

    await caller.okr.createKeyResult({
      objectiveId: objResult.objectiveId,
      title: "Test KR",
      targetValue: "100",
      unit: "%",
    });

    // 获取完整结构
    const fullOkr = await caller.okr.getFullOkr({
      periodId: periodResult.periodId,
    });

    expect(Array.isArray(fullOkr)).toBe(true);
    expect(fullOkr.length).toBeGreaterThan(0);
    expect(fullOkr[0]).toHaveProperty("keyResults");
    expect(Array.isArray(fullOkr[0]?.keyResults)).toBe(true);
  });
});

describe("Weekly Report Generation", () => {
  it("should list weekly reports", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const reports = await caller.weeklyReport.list();
    expect(Array.isArray(reports)).toBe(true);
  });

});
