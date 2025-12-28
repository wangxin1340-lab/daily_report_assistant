import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { trpc } from "@/lib/trpc";
import {
  Settings as SettingsIcon,
  Database,
  Loader2,
  Save,
  ExternalLink,
  CheckCircle,
  User,
} from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";

export default function Settings() {
  const { user } = useAuth();
  const [notionDatabaseId, setNotionDatabaseId] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const updateNotionConfigMutation = trpc.settings.updateNotionConfig.useMutation({
    onSuccess: () => {
      toast.success("Notion 配置已保存");
      setIsSaving(false);
    },
    onError: () => {
      toast.error("保存失败，请重试");
      setIsSaving(false);
    },
  });

  useEffect(() => {
    if (user?.notionDatabaseId) {
      setNotionDatabaseId(user.notionDatabaseId);
    }
  }, [user]);

  const handleSaveNotion = () => {
    if (!notionDatabaseId.trim()) {
      toast.error("请输入 Notion 数据库 ID");
      return;
    }
    setIsSaving(true);
    updateNotionConfigMutation.mutate({ notionDatabaseId: notionDatabaseId.trim() });
  };

  return (
    <div className="space-y-6 max-w-2xl">
      {/* 头部 */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <SettingsIcon className="h-6 w-6" />
          设置
        </h1>
        <p className="text-muted-foreground mt-1">管理您的账户和集成配置</p>
      </div>

      {/* 用户信息 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <User className="h-5 w-5" />
            账户信息
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label className="text-muted-foreground">用户名</Label>
              <p className="mt-1 font-medium">{user?.name || "-"}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">邮箱</Label>
              <p className="mt-1 font-medium">{user?.email || "-"}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notion 集成 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Database className="h-5 w-5" />
            Notion 集成
          </CardTitle>
          <CardDescription>
            配置 Notion 数据库以自动同步您的日报
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="notion-db-id">Notion 数据库 ID</Label>
            <div className="flex gap-2">
              <Input
                id="notion-db-id"
                placeholder="输入您的 Notion 数据库 ID"
                value={notionDatabaseId}
                onChange={(e) => setNotionDatabaseId(e.target.value)}
              />
              <Button
                onClick={handleSaveNotion}
                disabled={isSaving || updateNotionConfigMutation.isPending}
              >
                {isSaving || updateNotionConfigMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              数据库 ID 可以从 Notion 数据库页面的 URL 中获取
            </p>
          </div>

          <Separator />

          <div className="space-y-3">
            <p className="text-sm font-medium">如何获取数据库 ID？</p>
            <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
              <li>在 Notion 中打开您要同步日报的数据库页面</li>
              <li>复制页面 URL，格式类似：<code className="bg-muted px-1 rounded">https://notion.so/xxx?v=yyy</code></li>
              <li>URL 中 <code className="bg-muted px-1 rounded">notion.so/</code> 后面、<code className="bg-muted px-1 rounded">?</code> 前面的部分就是数据库 ID</li>
            </ol>
          </div>

          <div className="bg-muted/50 rounded-lg p-4">
            <p className="text-sm font-medium mb-2">数据库字段要求</p>
            <p className="text-xs text-muted-foreground mb-3">
              请确保您的 Notion 数据库包含以下字段：
            </p>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li className="flex items-center gap-2">
                <CheckCircle className="h-3 w-3 text-green-500" />
                <span><strong>标题</strong> (Title) - 日报标题</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-3 w-3 text-green-500" />
                <span><strong>日期</strong> (Date) - 日报日期</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-3 w-3 text-green-500" />
                <span><strong>工作内容</strong> (Text) - 今日工作内容</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-3 w-3 text-green-500" />
                <span><strong>完成情况</strong> (Text) - 完成情况说明</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-3 w-3 text-green-500" />
                <span><strong>遇到问题</strong> (Text) - 遇到的问题</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-3 w-3 text-green-500" />
                <span><strong>明日计划</strong> (Text) - 明日工作计划</span>
              </li>
            </ul>
          </div>

          <Button variant="outline" className="w-full gap-2" asChild>
            <a
              href="https://www.notion.so/my-integrations"
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="h-4 w-4" />
              管理 Notion 集成
            </a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
