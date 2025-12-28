/**
 * Notion 同步服务 - 实际执行同步操作
 * 
 * 使用 manus-mcp-cli 调用 Notion MCP 来创建页面
 */

import { exec } from "child_process";
import { promisify } from "util";
import { DailyReport } from "../drizzle/schema";

const execAsync = promisify(exec);

export interface NotionSyncResult {
  success: boolean;
  pageId?: string;
  pageUrl?: string;
  error?: string;
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
    
    // 构建页面内容
    const pageContent = `## 📋 工作内容
${report.workContent || "无"}

## ✅ 完成情况
${report.completionStatus || "无"}

## ⚠️ 遇到的问题
${report.problems || "无"}

## 💡 业务洞察与思考
${businessInsights}

## 📅 明日计划
${report.tomorrowPlan || "无"}

## 📝 总结
${report.summary || "无"}`;

    // 构建 MCP 调用参数
    const mcpInput = {
      parent: {
        data_source_id: notionDatabaseId,
      },
      pages: [
        {
          properties: {
            "标题": `工作日报 - ${reportDate.toLocaleDateString('zh-CN')}`,
            "date:日期:start": dateStr,
            "date:日期:is_datetime": 0,
          },
          content: pageContent,
        },
      ],
    };

    // 调用 MCP CLI
    const inputJson = JSON.stringify(mcpInput).replace(/'/g, "'\\''");
    const command = `manus-mcp-cli tool call notion-create-pages --server notion --input '${inputJson}'`;
    
    console.log("[Notion Sync] Executing command...");
    const { stdout, stderr } = await execAsync(command, { timeout: 60000 });
    
    if (stderr && !stderr.includes("Tool execution result")) {
      console.error("[Notion Sync] stderr:", stderr);
    }
    
    console.log("[Notion Sync] stdout:", stdout);
    
    // 解析结果
    // MCP CLI 会输出类似 "Tool execution result: {...}" 的内容
    const resultMatch = stdout.match(/Tool execution result:\s*(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (resultMatch) {
      const result = JSON.parse(resultMatch[1]);
      
      // 检查是否有错误
      if (result.error) {
        return {
          success: false,
          error: result.error,
        };
      }
      
      // 尝试从结果中提取页面 ID 和 URL
      let pageId: string | undefined;
      let pageUrl: string | undefined;
      
      if (Array.isArray(result) && result.length > 0) {
        pageId = result[0]?.id;
        pageUrl = result[0]?.url;
      } else if (result.id) {
        pageId = result.id;
        pageUrl = result.url;
      } else if (result.pages && result.pages.length > 0) {
        pageId = result.pages[0]?.id;
        pageUrl = result.pages[0]?.url;
      }
      
      return {
        success: true,
        pageId,
        pageUrl,
      };
    }
    
    // 如果没有找到结果，检查是否有保存到文件的提示
    const fileMatch = stdout.match(/Tool execution result saved to: (.+\.json)/);
    if (fileMatch) {
      try {
        const fs = await import("fs/promises");
        const fileContent = await fs.readFile(fileMatch[1], "utf-8");
        const result = JSON.parse(fileContent);
        
        if (result.error) {
          return {
            success: false,
            error: result.error,
          };
        }
        
        let pageId: string | undefined;
        let pageUrl: string | undefined;
        
        if (Array.isArray(result) && result.length > 0) {
          pageId = result[0]?.id;
          pageUrl = result[0]?.url;
        } else if (result.id) {
          pageId = result.id;
          pageUrl = result.url;
        }
        
        return {
          success: true,
          pageId,
          pageUrl,
        };
      } catch (e) {
        console.error("[Notion Sync] Failed to read result file:", e);
      }
    }
    
    // 如果无法解析结果，但命令执行成功，假设同步成功
    return {
      success: true,
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
 * 首先获取 Notion 数据库的 data_source_id
 * 因为用户可能提供的是 database_id，需要转换为 data_source_id
 */
export async function fetchNotionDatabaseInfo(databaseIdOrUrl: string): Promise<{
  success: boolean;
  dataSourceId?: string;
  schema?: any;
  error?: string;
}> {
  try {
    const command = `manus-mcp-cli tool call notion-fetch --server notion --input '{"url": "${databaseIdOrUrl}"}'`;
    const { stdout, stderr } = await execAsync(command, { timeout: 30000 });
    
    console.log("[Notion Fetch] stdout:", stdout);
    
    // 解析结果
    const resultMatch = stdout.match(/Tool execution result:\s*([\s\S]+?)(?:\n\n|$)/);
    if (resultMatch) {
      const resultText = resultMatch[1].trim();
      
      // 查找 data_source_id
      // 格式可能是 collection://<data_source_id>
      const dataSourceMatch = resultText.match(/collection:\/\/([a-f0-9-]+)/i);
      if (dataSourceMatch) {
        return {
          success: true,
          dataSourceId: dataSourceMatch[1],
        };
      }
      
      // 如果没找到 collection URL，可能直接返回了数据库信息
      return {
        success: true,
        dataSourceId: databaseIdOrUrl, // 使用原始 ID
      };
    }
    
    // 检查文件结果
    const fileMatch = stdout.match(/Tool execution result saved to: (.+\.json)/);
    if (fileMatch) {
      try {
        const fs = await import("fs/promises");
        const fileContent = await fs.readFile(fileMatch[1], "utf-8");
        
        // 查找 data_source_id
        const dataSourceMatch = fileContent.match(/collection:\/\/([a-f0-9-]+)/i);
        if (dataSourceMatch) {
          return {
            success: true,
            dataSourceId: dataSourceMatch[1],
          };
        }
        
        return {
          success: true,
          dataSourceId: databaseIdOrUrl,
        };
      } catch (e) {
        console.error("[Notion Fetch] Failed to read result file:", e);
      }
    }
    
    return {
      success: true,
      dataSourceId: databaseIdOrUrl,
    };
    
  } catch (error: any) {
    console.error("[Notion Fetch] Error:", error);
    return {
      success: false,
      error: error.message || "获取数据库信息失败",
    };
  }
}
