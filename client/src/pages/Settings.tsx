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
  const [notionWeeklyReportDatabaseId, setNotionWeeklyReportDatabaseId] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingWeekly, setIsSavingWeekly] = useState(false);

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
    if (user?.notionWeeklyReportDatabaseId) {
      setNotionWeeklyReportDatabaseId(user.notionWeeklyReportDatabaseId);
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

  const handleSaveWeeklyNotion = () => {
    if (!notionWeeklyReportDatabaseId.trim()) {
      toast.error("请输入周报 Notion 数据库 ID");
      return;
    }
    setIsSavingWeekly(true);
    updateNotionConfigMutation.mutate({ notionWeeklyReportDatabaseId: notionWeeklyReportDatabaseId.trim() });
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

      {/* 周报 Notion 集成 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Database className="h-5 w-5" />
            周报 Notion 集成
          </CardTitle>
          <CardDescription>
            配置独立的 Notion 数据库以自动同步您的周报（与日报数据库分开）
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="notion-weekly-db-id">周报 Notion 数据库 ID</Label>
            <div className="flex gap-2">
              <Input
                id="notion-weekly-db-id"
                placeholder="输入您的周报 Notion 数据库 ID"
                value={notionWeeklyReportDatabaseId}
                onChange={(e) => setNotionWeeklyReportDatabaseId(e.target.value)}
              />
              <Button
                onClick={handleSaveWeeklyNotion}
                disabled={isSavingWeekly || updateNotionConfigMutation.isPending}
              >
                {isSavingWeekly || updateNotionConfigMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              请使用与日报数据库不同的 Notion 数据库，以便区分日报和周报
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
