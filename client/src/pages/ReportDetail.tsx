import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { trpc } from "@/lib/trpc";
import {
  ArrowLeft,
  Calendar,
  CheckCircle,
  AlertCircle,
  Target,
  FileText,
  Loader2,
  Save,
  Upload,
  Edit,
  Eye,
} from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useLocation, useParams } from "wouter";
import { Streamdown } from "streamdown";

export default function ReportDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const [isEditing, setIsEditing] = useState(false);
  const [editedReport, setEditedReport] = useState({
    workContent: "",
    completionStatus: "",
    problems: "",
    tomorrowPlan: "",
    summary: "",
  });

  const reportId = parseInt(id || "0");

  const { data: report, isLoading, refetch } = trpc.report.get.useQuery(
    { id: reportId },
    { enabled: reportId > 0 }
  );

  const updateMutation = trpc.report.update.useMutation({
    onSuccess: () => {
      toast.success("日报更新成功");
      setIsEditing(false);
      refetch();
    },
    onError: () => {
      toast.error("更新失败，请重试");
    },
  });

  const syncToNotionMutation = trpc.report.syncToNotion.useMutation({
    onSuccess: (data) => {
      toast.success("日报数据已准备好同步到 Notion");
      // 这里可以进一步处理 Notion 同步
    },
    onError: (error) => {
      toast.error(error.message || "同步失败");
    },
  });

  useEffect(() => {
    if (report) {
      setEditedReport({
        workContent: report.workContent || "",
        completionStatus: report.completionStatus || "",
        problems: report.problems || "",
        tomorrowPlan: report.tomorrowPlan || "",
        summary: report.summary || "",
      });
    }
  }, [report]);

  const handleSave = () => {
    updateMutation.mutate({
      id: reportId,
      ...editedReport,
    });
  };

  const handleSyncToNotion = () => {
    syncToNotionMutation.mutate({ reportId });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!report) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <AlertCircle className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">日报不存在</p>
        <Button variant="outline" onClick={() => setLocation("/")}>
          返回首页
        </Button>
      </div>
    );
  }

  const reportDate = new Date(report.reportDate);

  return (
    <div className="space-y-6">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/history")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">工作日报</h1>
            <div className="flex items-center gap-2 mt-1 text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>{reportDate.toLocaleDateString("zh-CN", {
                year: "numeric",
                month: "long",
                day: "numeric",
                weekday: "long",
              })}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Notion 同步状态 */}
          {report.notionSyncStatus === "synced" ? (
            <Badge variant="secondary" className="gap-1">
              <CheckCircle className="h-3 w-3" />
              已同步到 Notion
            </Badge>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={handleSyncToNotion}
              disabled={syncToNotionMutation.isPending}
              className="gap-2"
            >
              {syncToNotionMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              同步到 Notion
            </Button>
          )}

          {/* 编辑/预览切换 */}
          <Button
            variant={isEditing ? "default" : "outline"}
            size="sm"
            onClick={() => setIsEditing(!isEditing)}
            className="gap-2"
          >
            {isEditing ? (
              <>
                <Eye className="h-4 w-4" />
                预览
              </>
            ) : (
              <>
                <Edit className="h-4 w-4" />
                编辑
              </>
            )}
          </Button>

          {isEditing && (
            <Button
              size="sm"
              onClick={handleSave}
              disabled={updateMutation.isPending}
              className="gap-2"
            >
              {updateMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              保存
            </Button>
          )}
        </div>
      </div>

      {/* 总结卡片 */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <FileText className="h-5 w-5 text-primary mt-0.5" />
            <div className="flex-1">
              <p className="font-medium text-primary mb-1">今日总结</p>
              {isEditing ? (
                <Textarea
                  value={editedReport.summary}
                  onChange={(e) =>
                    setEditedReport((prev) => ({ ...prev, summary: e.target.value }))
                  }
                  className="mt-2"
                  rows={2}
                />
              ) : (
                <p className="text-foreground">{report.summary}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 详细内容 */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* 工作内容 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              工作内容
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isEditing ? (
              <Textarea
                value={editedReport.workContent}
                onChange={(e) =>
                  setEditedReport((prev) => ({ ...prev, workContent: e.target.value }))
                }
                rows={6}
              />
            ) : (
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <Streamdown>{report.workContent || "无"}</Streamdown>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 完成情况 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="h-4 w-4 text-blue-500" />
              完成情况
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isEditing ? (
              <Textarea
                value={editedReport.completionStatus}
                onChange={(e) =>
                  setEditedReport((prev) => ({
                    ...prev,
                    completionStatus: e.target.value,
                  }))
                }
                rows={6}
              />
            ) : (
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <Streamdown>{report.completionStatus || "无"}</Streamdown>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 遇到的问题 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-500" />
              遇到的问题
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isEditing ? (
              <Textarea
                value={editedReport.problems}
                onChange={(e) =>
                  setEditedReport((prev) => ({ ...prev, problems: e.target.value }))
                }
                rows={6}
              />
            ) : (
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <Streamdown>{report.problems || "无"}</Streamdown>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 明日计划 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4 text-purple-500" />
              明日计划
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isEditing ? (
              <Textarea
                value={editedReport.tomorrowPlan}
                onChange={(e) =>
                  setEditedReport((prev) => ({ ...prev, tomorrowPlan: e.target.value }))
                }
                rows={6}
              />
            ) : (
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <Streamdown>{report.tomorrowPlan || "无"}</Streamdown>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
