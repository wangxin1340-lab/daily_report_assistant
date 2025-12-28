/**
 * Notion 同步服务
 * 
 * 注意：由于 Notion API 需要通过 MCP 调用，此模块提供数据准备功能。
 * 实际的 Notion 同步需要在具有 MCP 访问权限的环境中执行。
 * 
 * 在 Manus 平台上，用户可以通过配置 Notion MCP 来实现自动同步。
 */

import { DailyReport } from "../drizzle/schema";

export interface NotionSyncData {
  databaseId: string;
  title: string;
  reportDate: string;
  workContent: string;
  completionStatus: string;
  problems: string;
  tomorrowPlan: string;
  summary: string;
  markdownContent: string;
}

/**
 * 准备要同步到 Notion 的数据
 */
export function prepareNotionSyncData(
  report: DailyReport,
  notionDatabaseId: string
): NotionSyncData {
  const reportDate = new Date(report.reportDate);
  
  return {
    databaseId: notionDatabaseId,
    title: `工作日报 - ${reportDate.toLocaleDateString('zh-CN')}`,
    reportDate: reportDate.toISOString().split('T')[0],
    workContent: report.workContent || "",
    completionStatus: report.completionStatus || "",
    problems: report.problems || "无",
    tomorrowPlan: report.tomorrowPlan || "",
    summary: report.summary || "",
    markdownContent: report.markdownContent || "",
  };
}

/**
 * 生成 Notion MCP 调用参数
 * 
 * 这个函数生成可以直接用于 manus-mcp-cli 的参数
 */
export function generateNotionMCPParams(data: NotionSyncData): {
  toolName: string;
  serverName: string;
  input: string;
} {
  const pageContent = `## 📋 工作内容
${data.workContent}

## ✅ 完成情况
${data.completionStatus}

## ⚠️ 遇到的问题
${data.problems}

## 📅 明日计划
${data.tomorrowPlan}

## 💡 总结
${data.summary}`;

  const input = {
    parent: {
      data_source_id: data.databaseId,
    },
    pages: [
      {
        properties: {
          "标题": data.title,
          "date:日期:start": data.reportDate,
          "date:日期:is_datetime": 0,
          "工作内容": data.workContent,
          "完成情况": data.completionStatus,
          "遇到问题": data.problems,
          "明日计划": data.tomorrowPlan,
          "总结": data.summary,
        },
        content: pageContent,
      },
    ],
  };

  return {
    toolName: "notion-create-pages",
    serverName: "notion",
    input: JSON.stringify(input),
  };
}

/**
 * 生成用于手动同步的说明
 */
export function generateSyncInstructions(data: NotionSyncData): string {
  return `
要将此日报同步到 Notion，请确保：

1. 您的 Notion 数据库包含以下字段：
   - 标题 (Title)
   - 日期 (Date)
   - 工作内容 (Text)
   - 完成情况 (Text)
   - 遇到问题 (Text)
   - 明日计划 (Text)
   - 总结 (Text)

2. 数据库 ID: ${data.databaseId}

3. 日报内容：
   - 标题: ${data.title}
   - 日期: ${data.reportDate}
   - 工作内容: ${data.workContent.slice(0, 100)}...
   - 总结: ${data.summary}
`;
}
