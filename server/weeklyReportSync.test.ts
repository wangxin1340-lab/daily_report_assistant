import { describe, expect, it } from "vitest";
import { syncWeeklyReportToNotion } from "./notionSync";
import type { WeeklyReport } from "../drizzle/schema";

describe("syncWeeklyReportToNotion", () => {
  it("should have correct function signature", () => {
    expect(typeof syncWeeklyReportToNotion).toBe("function");
  });

  it("should handle missing Notion ID gracefully", async () => {
    const mockReport: WeeklyReport = {
      id: 1,
      userId: 1,
      periodId: 1,
      weekStartDate: new Date("2025-01-06"),
      weekEndDate: new Date("2025-01-12"),
      title: "2025年第1周工作周报",
      summary: "本周完成了重要功能开发",
      okrProgress: null,
      achievements: "完成了周报同步功能",
      problems: "无",
      nextWeekPlan: "继续优化功能",
      markdownContent: null,
      dailyReportIds: null,
      notionPageId: null,
      notionSyncedAt: null,
      notionSyncStatus: "pending",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // 测试函数能够处理无效的 Notion ID
    const result = await syncWeeklyReportToNotion(mockReport, "invalid-id");
    
    // 应该返回失败结果而不是抛出异常
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});
