import { describe, expect, it } from "vitest";

describe("Notion API Token Validation", () => {
  it("should have valid NOTION_API_TOKEN that can access Notion API", async () => {
    const token = process.env.NOTION_API_TOKEN;
    
    // 确保 token 存在
    expect(token).toBeDefined();
    expect(token).not.toBe("");
    
    // 调用 Notion API 验证 token
    const response = await fetch("https://api.notion.com/v1/users/me", {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Notion-Version": "2022-06-28",
      },
    });
    
    // 验证响应
    expect(response.ok).toBe(true);
    
    const data = await response.json();
    console.log("[Notion API] Bot user:", data.name || data.id);
    
    // 确保返回了有效的用户/bot 信息
    expect(data).toHaveProperty("id");
    expect(data).toHaveProperty("type");
  });
});
