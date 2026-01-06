/**
 * Notion 同步服务 - 使用 Notion 官方 API
 * 支持同步到数据库或页面
 */

import { DailyReport, WeeklyReport } from "../drizzle/schema";

const NOTION_API_BASE = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

export interface NotionSyncResult {
  success: boolean;
  pageId?: string;
  pageUrl?: string;
  error?: string;
}

/**
 * 获取 Notion API Token
 */
function getNotionToken(): string {
  const token = process.env.NOTION_API_TOKEN;
  if (!token) {
    throw new Error("NOTION_API_TOKEN 环境变量未配置");
  }
  return token;
}

/**
 * 调用 Notion API
 */
async function notionFetch(endpoint: string, options: RequestInit = {}): Promise<any> {
  const token = getNotionToken();
  
  const response = await fetch(`${NOTION_API_BASE}${endpoint}`, {
    ...options,
    headers: {
      "Authorization": `Bearer ${token}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  
  const data = await response.json();
  
  if (!response.ok) {
    console.error("[Notion API] Error:", data);
    throw new Error(data.message || `Notion API 错误: ${response.status}`);
  }
  
  return data;
}

/**
 * 清理和格式化 Notion ID
 */
function cleanNotionId(notionId: string): string {
  let cleanId = notionId.trim();
  
  // 如果是完整 URL，提取 ID
  if (cleanId.includes("notion.so")) {
    const match = cleanId.match(/([a-f0-9]{32})/i);
    if (match) {
      cleanId = match[1];
    }
  }
  
  // 如果包含斜杠（如 username/id 格式），取最后一部分
  if (cleanId.includes("/")) {
    const parts = cleanId.split("/");
    cleanId = parts[parts.length - 1];
  }
  
  // 移除连字符
  cleanId = cleanId.replace(/-/g, "");
  
  // 如果是32位十六进制字符，格式化为标准 UUID 格式
  if (/^[a-f0-9]{32}$/i.test(cleanId)) {
    cleanId = `${cleanId.slice(0, 8)}-${cleanId.slice(8, 12)}-${cleanId.slice(12, 16)}-${cleanId.slice(16, 20)}-${cleanId.slice(20)}`;
  }
  
  return cleanId;
}

/**
 * 检测 Notion ID 类型（页面或数据库）
 */
async function detectNotionIdType(notionId: string): Promise<{
  type: "page" | "database" | "unknown";
  id: string;
  title?: string;
  error?: string;
}> {
  const cleanId = cleanNotionId(notionId);
  console.log("[Notion] Detecting ID type for:", cleanId);
  
  // 先尝试作为数据库获取
  try {
    const dbData = await notionFetch(`/databases/${cleanId}`);
    const title = dbData.title?.[0]?.plain_text || "未命名数据库";
    console.log("[Notion] Detected as database:", title);
    return { type: "database", id: cleanId, title };
  } catch (dbError: any) {
    console.log("[Notion] Not a database, trying as page...");
  }
  
  // 再尝试作为页面获取
  try {
    const pageData = await notionFetch(`/pages/${cleanId}`);
    const title = pageData.properties?.title?.title?.[0]?.plain_text || 
                  pageData.properties?.Name?.title?.[0]?.plain_text ||
                  "未命名页面";
    console.log("[Notion] Detected as page:", title);
    return { type: "page", id: cleanId, title };
  } catch (pageError: any) {
    console.error("[Notion] Failed to detect ID type:", pageError.message);
    return { 
      type: "unknown", 
      id: cleanId, 
      error: "无法识别此 ID，请确保已将集成添加到对应的页面或数据库" 
    };
  }
}

/**
 * 构建日报内容块
 */
function buildReportBlocks(report: DailyReport): any[] {
  const reportDate = new Date(report.reportDate);
  const businessInsights = (report as any).businessInsights || "无";
  
  // 将长文本分割成多个段落（Notion 单个文本块有2000字符限制）
  const splitText = (text: string, maxLen: number = 1800): string[] => {
    if (!text || text.length <= maxLen) return [text || "无"];
    const parts: string[] = [];
    let remaining = text;
    while (remaining.length > 0) {
      parts.push(remaining.slice(0, maxLen));
      remaining = remaining.slice(maxLen);
    }
    return parts;
  };
  
  const createParagraphBlocks = (text: string) => {
    return splitText(text).map(part => ({
      object: "block",
      type: "paragraph",
      paragraph: {
        rich_text: [{ type: "text", text: { content: part } }],
      },
    }));
  };
  
  return [
    // 日报标题
    {
      object: "block",
      type: "heading_1",
      heading_1: {
        rich_text: [{ type: "text", text: { content: `📅 工作日报 - ${reportDate.toLocaleDateString('zh-CN')}` } }],
      },
    },
    // 今日总结
    {
      object: "block",
      type: "heading_2",
      heading_2: {
        rich_text: [{ type: "text", text: { content: "📋 今日总结" } }],
      },
    },
    ...createParagraphBlocks(report.summary || "无"),
    // 业务洞察与思考
    {
      object: "block",
      type: "heading_2",
      heading_2: {
        rich_text: [{ type: "text", text: { content: "💡 业务洞察与思考" } }],
      },
    },
    ...createParagraphBlocks(businessInsights),
    // 工作内容
    {
      object: "block",
      type: "heading_2",
      heading_2: {
        rich_text: [{ type: "text", text: { content: "✅ 工作内容" } }],
      },
    },
    ...createParagraphBlocks(report.workContent || "无"),
    // 完成情况
    {
      object: "block",
      type: "heading_2",
      heading_2: {
        rich_text: [{ type: "text", text: { content: "🎯 完成情况" } }],
      },
    },
    ...createParagraphBlocks(report.completionStatus || "无"),
    // 遇到的问题
    {
      object: "block",
      type: "heading_2",
      heading_2: {
        rich_text: [{ type: "text", text: { content: "⚠️ 遇到的问题" } }],
      },
    },
    ...createParagraphBlocks(report.problems || "无"),
    // 明日计划
    {
      object: "block",
      type: "heading_2",
      heading_2: {
        rich_text: [{ type: "text", text: { content: "📅 明日计划" } }],
      },
    },
    ...createParagraphBlocks(report.tomorrowPlan || "无"),
    // 分隔线
    {
      object: "block",
      type: "divider",
      divider: {},
    },
  ];
}

/**
 * 同步日报到 Notion 数据库（创建新条目）
 */
async function syncToDatabase(report: DailyReport, databaseId: string): Promise<NotionSyncResult> {
  const reportDate = new Date(report.reportDate);
  const businessInsights = (report as any).businessInsights || "无";
  
  // 构建页面属性
  const properties: Record<string, any> = {
    "Name": {
      title: [
        {
          text: {
            content: `工作日报 - ${reportDate.toLocaleDateString('zh-CN')}`,
          },
        },
      ],
    },
  };
  
  // 构建页面内容
  const children = buildReportBlocks(report);
  
  // 创建页面
  const pageData = await notionFetch("/pages", {
    method: "POST",
    body: JSON.stringify({
      parent: {
        database_id: databaseId,
      },
      properties,
      children,
    }),
  });
  
  console.log("[Notion Sync] Page created in database:", pageData.id);
  
  return {
    success: true,
    pageId: pageData.id,
    pageUrl: pageData.url,
  };
}

/**
 * 同步日报到 Notion 页面（追加内容块）
 */
async function syncToPage(report: DailyReport, pageId: string): Promise<NotionSyncResult> {
  // 构建内容块
  const children = buildReportBlocks(report);
  
  // 追加内容到页面
  const result = await notionFetch(`/blocks/${pageId}/children`, {
    method: "PATCH",
    body: JSON.stringify({
      children,
    }),
  });
  
  console.log("[Notion Sync] Content appended to page:", pageId);
  
  // 获取页面信息以返回 URL
  const pageData = await notionFetch(`/pages/${pageId}`);
  
  return {
    success: true,
    pageId: pageId,
    pageUrl: pageData.url,
  };
}

/**
 * 同步日报到 Notion（自动检测类型）
 */
export async function syncReportToNotion(
  report: DailyReport,
  notionId: string
): Promise<NotionSyncResult> {
  try {
    // 检测 ID 类型
    const detection = await detectNotionIdType(notionId);
    
    if (detection.type === "unknown") {
      return {
        success: false,
        error: detection.error || "无法识别 Notion ID 类型",
      };
    }
    
    // 根据类型选择同步方式
    if (detection.type === "database") {
      return await syncToDatabase(report, detection.id);
    } else {
      return await syncToPage(report, detection.id);
    }
    
  } catch (error: any) {
    console.error("[Notion Sync] Error:", error);
    return {
      success: false,
      error: error.message || "同步失败",
    };
  }
}

/**
 * 获取 Notion 数据库/页面信息
 */
export async function fetchNotionDatabaseInfo(notionId: string): Promise<{
  success: boolean;
  dataSourceId?: string;
  title?: string;
  type?: "page" | "database";
  error?: string;
}> {
  try {
    const detection = await detectNotionIdType(notionId);
    
    if (detection.type === "unknown") {
      return {
        success: false,
        error: detection.error,
      };
    }
    
    return {
      success: true,
      dataSourceId: detection.id,
      title: detection.title,
      type: detection.type,
    };
    
  } catch (error: any) {
    console.error("[Notion Fetch] Error:", error);
    return {
      success: false,
      error: error.message || "获取信息失败",
    };
  }
}

/**
 * 构建周报内容块
 */
function buildWeeklyReportBlocks(report: WeeklyReport): any[] {
  const weekStart = new Date(report.weekStartDate);
  const weekEnd = new Date(report.weekEndDate);
  
  // 将长文本分割成多个段落（Notion 单个文本块有2000字符限制）
  const splitText = (text: string, maxLen: number = 1800): string[] => {
    if (!text || text.length <= maxLen) return [text || "无"];
    const parts: string[] = [];
    let remaining = text;
    while (remaining.length > 0) {
      parts.push(remaining.slice(0, maxLen));
      remaining = remaining.slice(maxLen);
    }
    return parts;
  };
  
  const createParagraphBlocks = (text: string) => {
    return splitText(text).map(part => ({
      object: "block",
      type: "paragraph",
      paragraph: {
        rich_text: [{ type: "text", text: { content: part } }],
      },
    }));
  };
  
  const blocks: any[] = [
    // 周报标题
    {
      object: "block",
      type: "heading_1",
      heading_1: {
        rich_text: [{ type: "text", text: { content: `📅 ${report.title}` } }],
      },
    },
    // 周期
    {
      object: "block",
      type: "callout",
      callout: {
        rich_text: [{ 
          type: "text", 
          text: { 
            content: `周期：${weekStart.toLocaleDateString('zh-CN')} - ${weekEnd.toLocaleDateString('zh-CN')}` 
          } 
        }],
        icon: { emoji: "📆" },
      },
    },
    // 本周总结
    {
      object: "block",
      type: "heading_2",
      heading_2: {
        rich_text: [{ type: "text", text: { content: "📋 本周总结" } }],
      },
    },
    ...createParagraphBlocks(report.summary || "无"),
  ];
  
  // OKR 进展
  if (report.okrProgress) {
    blocks.push({
      object: "block",
      type: "heading_2",
      heading_2: {
        rich_text: [{ type: "text", text: { content: "🎯 OKR 进展" } }],
      },
    });
    
    try {
      const okrData = typeof report.okrProgress === 'string' 
        ? JSON.parse(report.okrProgress) 
        : report.okrProgress;
      
      if (Array.isArray(okrData)) {
        okrData.forEach((obj: any) => {
          // 支持两种数据结构：
          // 1. 新结构: { objectiveTitle, progress, relatedWork }
          // 2. 旧结构: { title, keyResults }
          const objectiveTitle = obj.objectiveTitle || obj.title || '未命名目标';
          
          // Objective 标题
          blocks.push({
            object: "block",
            type: "heading_3",
            heading_3: {
              rich_text: [{ type: "text", text: { content: `▶️ ${objectiveTitle}` } }],
            },
          });
          
          // 新结构：显示进展和相关工作
          if (obj.progress) {
            blocks.push({
              object: "block",
              type: "paragraph",
              paragraph: {
                rich_text: [{ 
                  type: "text", 
                  text: { content: `进展：${obj.progress}` },
                  annotations: { bold: true }
                }],
              },
            });
          }
          
          if (obj.relatedWork) {
            blocks.push({
              object: "block",
              type: "paragraph",
              paragraph: {
                rich_text: [{ 
                  type: "text", 
                  text: { content: `相关工作：${obj.relatedWork}` }
                }],
              },
            });
          }
          
          // 旧结构：Key Results
          if (obj.keyResults && Array.isArray(obj.keyResults)) {
            obj.keyResults.forEach((kr: any) => {
              blocks.push({
                object: "block",
                type: "bulleted_list_item",
                bulleted_list_item: {
                  rich_text: [{ 
                    type: "text", 
                    text: { content: `${kr.title || kr.name || ''}${kr.progress ? ` - ${kr.progress}` : ''}` } 
                  }],
                },
              });
            });
          }
        });
      } else {
        blocks.push(...createParagraphBlocks(JSON.stringify(okrData, null, 2)));
      }
    } catch (e) {
      console.error("[Notion Sync] Error parsing OKR progress:", e);
      blocks.push(...createParagraphBlocks(String(report.okrProgress)));
    }
  }
  
  // 主要成果
  blocks.push({
    object: "block",
    type: "heading_2",
    heading_2: {
      rich_text: [{ type: "text", text: { content: "✅ 主要成果" } }],
    },
  });
  blocks.push(...createParagraphBlocks(report.achievements || "无"));
  
  // 问题和挑战
  blocks.push({
    object: "block",
    type: "heading_2",
    heading_2: {
      rich_text: [{ type: "text", text: { content: "⚠️ 问题和挑战" } }],
    },
  });
  blocks.push(...createParagraphBlocks(report.problems || "无"));
  
  // 下周计划
  blocks.push({
    object: "block",
    type: "heading_2",
    heading_2: {
      rich_text: [{ type: "text", text: { content: "📅 下周计划" } }],
    },
  });
  blocks.push(...createParagraphBlocks(report.nextWeekPlan || "无"));
  
  // 分隔线
  blocks.push({
    object: "block",
    type: "divider",
    divider: {},
  });
  
  return blocks;
}

/**
 * 同步周报到 Notion 数据库（创建新条目）
 */
async function syncWeeklyReportToDatabase(report: WeeklyReport, databaseId: string): Promise<NotionSyncResult> {
  const weekStart = new Date(report.weekStartDate);
  const weekEnd = new Date(report.weekEndDate);
  
  // 构建页面属性
  const properties: Record<string, any> = {
    "Name": {
      title: [
        {
          text: {
            content: report.title,
          },
        },
      ],
    },
  };
  
  // 构建页面内容
  const children = buildWeeklyReportBlocks(report);
  
  // 创建页面
  const pageData = await notionFetch("/pages", {
    method: "POST",
    body: JSON.stringify({
      parent: {
        database_id: databaseId,
      },
      properties,
      children,
    }),
  });
  
  console.log("[Notion Sync] Weekly report page created in database:", pageData.id);
  
  return {
    success: true,
    pageId: pageData.id,
    pageUrl: pageData.url,
  };
}

/**
 * 同步周报到 Notion 页面（追加内容块）
 */
async function syncWeeklyReportToPage(report: WeeklyReport, pageId: string): Promise<NotionSyncResult> {
  // 构建内容块
  const children = buildWeeklyReportBlocks(report);
  
  // 追加内容到页面
  const result = await notionFetch(`/blocks/${pageId}/children`, {
    method: "PATCH",
    body: JSON.stringify({
      children,
    }),
  });
  
  console.log("[Notion Sync] Weekly report content appended to page:", pageId);
  
  // 获取页面信息以返回 URL
  const pageData = await notionFetch(`/pages/${pageId}`);
  
  return {
    success: true,
    pageId: pageId,
    pageUrl: pageData.url,
  };
}

/**
 * 同步周报到 Notion（自动检测类型）
 */
export async function syncWeeklyReportToNotion(
  report: WeeklyReport,
  notionId: string
): Promise<NotionSyncResult> {
  try {
    console.log("[Notion Sync] Starting weekly report sync...");
    console.log("[Notion Sync] Report ID:", report.id);
    console.log("[Notion Sync] Notion ID:", notionId);
    
    // 检测 ID 类型
    const detection = await detectNotionIdType(notionId);
    console.log("[Notion Sync] Detection result:", detection);
    
    if (detection.type === "unknown") {
      const errorMsg = detection.error || "无法识别 Notion ID 类型";
      console.error("[Notion Sync] Detection failed:", errorMsg);
      return {
        success: false,
        error: errorMsg,
      };
    }
    
    // 根据类型选择同步方式
    let result;
    if (detection.type === "database") {
      console.log("[Notion Sync] Syncing to database:", detection.id);
      result = await syncWeeklyReportToDatabase(report, detection.id);
    } else {
      console.log("[Notion Sync] Syncing to page:", detection.id);
      result = await syncWeeklyReportToPage(report, detection.id);
    }
    
    console.log("[Notion Sync] Sync result:", result);
    return result;
    
  } catch (error: any) {
    console.error("[Notion Sync] Weekly report error:", error);
    console.error("[Notion Sync] Error stack:", error.stack);
    return {
      success: false,
      error: error.message || "同步失败",
    };
  }
}

/**
 * 验证 Notion API Token 是否有效
 */
export async function validateNotionToken(): Promise<{
  valid: boolean;
  botName?: string;
  error?: string;
}> {
  try {
    const data = await notionFetch("/users/me");
    return {
      valid: true,
      botName: data.name || data.id,
    };
  } catch (error: any) {
    return {
      valid: false,
      error: error.message || "Token 无效",
    };
  }
}
