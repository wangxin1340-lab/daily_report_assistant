import { describe, expect, it, vi } from "vitest";
import { DailyReport } from "../drizzle/schema";

// Mock the child_process exec function
vi.mock("child_process", () => ({
  exec: vi.fn(),
}));

vi.mock("util", () => ({
  promisify: vi.fn((fn) => fn),
}));

describe("Notion Sync", () => {
  const mockReport: DailyReport = {
    id: 1,
    userId: 1,
    sessionId: 1,
    reportDate: new Date("2024-12-28"),
    workContent: "完成了日报助手的开发",
    completionStatus: "已完成核心功能",
    problems: "无",
    tomorrowPlan: "继续优化",
    summary: "顺利完成开发任务",
    markdownContent: "# 工作日报",
    notionPageId: null,
    notionSyncedAt: null,
    notionSyncStatus: "pending",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it("should prepare correct sync data structure", async () => {
    // Import the function to test
    const { prepareNotionSyncData } = await import("./notion");
    
    const syncData = prepareNotionSyncData(mockReport, "test-database-id");
    
    expect(syncData).toHaveProperty("databaseId", "test-database-id");
    expect(syncData).toHaveProperty("title");
    expect(syncData.title).toContain("工作日报");
    expect(syncData).toHaveProperty("workContent", mockReport.workContent);
    expect(syncData).toHaveProperty("completionStatus", mockReport.completionStatus);
    expect(syncData).toHaveProperty("problems", mockReport.problems);
    expect(syncData).toHaveProperty("tomorrowPlan", mockReport.tomorrowPlan);
    expect(syncData).toHaveProperty("summary", mockReport.summary);
  });

  it("should generate correct MCP parameters", async () => {
    const { prepareNotionSyncData, generateNotionMCPParams } = await import("./notion");
    
    const syncData = prepareNotionSyncData(mockReport, "test-database-id");
    const mcpParams = generateNotionMCPParams(syncData);
    
    expect(mcpParams).toHaveProperty("toolName", "notion-create-pages");
    expect(mcpParams).toHaveProperty("serverName", "notion");
    expect(mcpParams).toHaveProperty("input");
    
    // Parse the input JSON to verify structure
    const inputObj = JSON.parse(mcpParams.input);
    expect(inputObj).toHaveProperty("parent");
    expect(inputObj.parent).toHaveProperty("data_source_id", "test-database-id");
    expect(inputObj).toHaveProperty("pages");
    expect(inputObj.pages).toHaveLength(1);
    expect(inputObj.pages[0]).toHaveProperty("properties");
    expect(inputObj.pages[0]).toHaveProperty("content");
  });

  it("should handle empty report fields gracefully", async () => {
    const { prepareNotionSyncData } = await import("./notion");
    
    const emptyReport: DailyReport = {
      ...mockReport,
      workContent: null,
      completionStatus: null,
      problems: null,
      tomorrowPlan: null,
      summary: null,
    };
    
    const syncData = prepareNotionSyncData(emptyReport, "test-database-id");
    
    expect(syncData.workContent).toBe("");
    expect(syncData.completionStatus).toBe("");
    expect(syncData.problems).toBe("无");
    expect(syncData.tomorrowPlan).toBe("");
    expect(syncData.summary).toBe("");
  });

  it("should generate sync instructions with database ID", async () => {
    const { prepareNotionSyncData, generateSyncInstructions } = await import("./notion");
    
    const syncData = prepareNotionSyncData(mockReport, "my-notion-db-123");
    const instructions = generateSyncInstructions(syncData);
    
    expect(instructions).toContain("my-notion-db-123");
    expect(instructions).toContain("Notion");
  });
});
