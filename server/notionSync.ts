/**
 * Notion 同步服务 - 使用 Notion 官方 API
 */

import { DailyReport } from "../drizzle/schema";

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
 * 同步日报到 Notion 数据库
 */
export async function syncReportToNotion(
  report: DailyReport,
  notionDatabaseId: string
): Promise<NotionSyncResult> {
  try {
    const reportDate = new Date(report.reportDate);
    const dateStr = reportDate.toISOString().split('T')[0];
    
    // 获取业务洞察字段
    const businessInsights = (report as any).businessInsights || "无";
    
    // 构建页面属性
    const properties: Record<string, any> = {
      // 标题属性 - Notion 数据库必须有一个 title 类型的属性
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
    
    // 构建页面内容 (children blocks)
    const children = [
      // 工作内容
      {
        object: "block",
        type: "heading_2",
        heading_2: {
          rich_text: [{ type: "text", text: { content: "📋 工作内容" } }],
        },
      },
      {
        object: "block",
        type: "paragraph",
        paragraph: {
          rich_text: [{ type: "text", text: { content: report.workContent || "无" } }],
        },
      },
      // 完成情况
      {
        object: "block",
        type: "heading_2",
        heading_2: {
          rich_text: [{ type: "text", text: { content: "✅ 完成情况" } }],
        },
      },
      {
        object: "block",
        type: "paragraph",
        paragraph: {
          rich_text: [{ type: "text", text: { content: report.completionStatus || "无" } }],
        },
      },
      // 遇到的问题
      {
        object: "block",
        type: "heading_2",
        heading_2: {
          rich_text: [{ type: "text", text: { content: "⚠️ 遇到的问题" } }],
        },
      },
      {
        object: "block",
        type: "paragraph",
        paragraph: {
          rich_text: [{ type: "text", text: { content: report.problems || "无" } }],
        },
      },
      // 业务洞察与思考
      {
        object: "block",
        type: "heading_2",
        heading_2: {
          rich_text: [{ type: "text", text: { content: "💡 业务洞察与思考" } }],
        },
      },
      {
        object: "block",
        type: "paragraph",
        paragraph: {
          rich_text: [{ type: "text", text: { content: businessInsights } }],
        },
      },
      // 明日计划
      {
        object: "block",
        type: "heading_2",
        heading_2: {
          rich_text: [{ type: "text", text: { content: "📅 明日计划" } }],
        },
      },
      {
        object: "block",
        type: "paragraph",
        paragraph: {
          rich_text: [{ type: "text", text: { content: report.tomorrowPlan || "无" } }],
        },
      },
      // 总结
      {
        object: "block",
        type: "heading_2",
        heading_2: {
          rich_text: [{ type: "text", text: { content: "📝 总结" } }],
        },
      },
      {
        object: "block",
        type: "paragraph",
        paragraph: {
          rich_text: [{ type: "text", text: { content: report.summary || "无" } }],
        },
      },
    ];
    
    // 创建页面
    const pageData = await notionFetch("/pages", {
      method: "POST",
      body: JSON.stringify({
        parent: {
          database_id: notionDatabaseId,
        },
        properties,
        children,
      }),
    });
    
    console.log("[Notion Sync] Page created:", pageData.id);
    
    return {
      success: true,
      pageId: pageData.id,
      pageUrl: pageData.url,
    };
    
  } catch (error: any) {
    console.error("[Notion Sync] Error:", error);
    return {
      success: false,
      error: error.message || "同步失败",
    };
  }
}

/**
 * 获取 Notion 数据库信息
 */
export async function fetchNotionDatabaseInfo(databaseId: string): Promise<{
  success: boolean;
  dataSourceId?: string;
  title?: string;
  error?: string;
}> {
  try {
    // 清理 database ID（移除可能的 URL 前缀和连字符）
    let cleanId = databaseId;
    
    // 如果是完整 URL，提取 ID
    if (databaseId.includes("notion.so")) {
      const match = databaseId.match(/([a-f0-9]{32})/i);
      if (match) {
        cleanId = match[1];
      }
    }
    
    // 移除连字符
    cleanId = cleanId.replace(/-/g, "");
    
    // 格式化为标准 UUID 格式
    if (cleanId.length === 32) {
      cleanId = `${cleanId.slice(0, 8)}-${cleanId.slice(8, 12)}-${cleanId.slice(12, 16)}-${cleanId.slice(16, 20)}-${cleanId.slice(20)}`;
    }
    
    const data = await notionFetch(`/databases/${cleanId}`);
    
    // 获取数据库标题
    const title = data.title?.[0]?.plain_text || "未命名数据库";
    
    return {
      success: true,
      dataSourceId: cleanId,
      title,
    };
    
  } catch (error: any) {
    console.error("[Notion Fetch] Error:", error);
    return {
      success: false,
      error: error.message || "获取数据库信息失败",
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
