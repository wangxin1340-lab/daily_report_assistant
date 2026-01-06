import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Calendar, FileText, Target, Loader2, ExternalLink, CheckCircle2 } from "lucide-react";
import { format, startOfWeek, endOfWeek, subWeeks } from "date-fns";
import { zhCN } from "date-fns/locale";
import { Streamdown } from "streamdown";
import { useLocation } from "wouter";

export default function WeeklyReport() {
  const [, navigate] = useLocation();
  const [selectedPeriodId, setSelectedPeriodId] = useState<number | null>(null);
  const [weekStart, setWeekStart] = useState<Date>(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [weekEnd, setWeekEnd] = useState<Date>(endOfWeek(new Date(), { weekStartsOn: 1 }));
  const [selectedReportIds, setSelectedReportIds] = useState<number[]>([]);
  const [generatedReport, setGeneratedReport] = useState<any>(null);

  // 查询数据
  const { data: periods } = trpc.okr.listPeriods.useQuery();
  const { data: activePeriod } = trpc.okr.getActivePeriod.useQuery();
  const { data: dailyReports } = trpc.report.list.useQuery();


  // Mutations
  const generateReport = trpc.weeklyReport.generate.useMutation({
    onSuccess: (data) => {
      toast.success("周报生成成功");
      setGeneratedReport(data);
    },
    onError: (error) => {
      toast.error(`生成失败：${error.message}`);
    },
  });

  const syncToNotion = trpc.weeklyReport.syncToNotion.useMutation({
    onSuccess: () => {
      toast.success("周报已同步到 Notion");
    },
    onError: (error) => {
      toast.error(`同步失败：${error.message}`);
    },
  });

  // 筛选日期范围内的日报
  const filteredReports = dailyReports?.filter((report: any) => {
    const reportDate = new Date(report.reportDate);
    return reportDate >= weekStart && reportDate <= weekEnd;
  }) || [];

  // 处理生成周报
  const handleGenerate = () => {
    if (selectedReportIds.length === 0) {
      toast.error("请至少选择一份日报");
      return;
    }

    generateReport.mutate({
      weekStartDate: weekStart,
      weekEndDate: weekEnd,
      periodId: selectedPeriodId || undefined,
      dailyReportIds: selectedReportIds,
    });
  };

  // 快速选择日期范围
  const handleQuickSelect = (weeks: number) => {
    const end = endOfWeek(new Date(), { weekStartsOn: 1 });
    const start = startOfWeek(subWeeks(end, weeks - 1), { weekStartsOn: 1 });
    setWeekStart(start);
    setWeekEnd(end);
  };

  return (
    <div className="container py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold">生成周报</h1>
        <p className="text-muted-foreground mt-2">
          基于日报和 OKR 自动生成结构化周报
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左侧：配置区域 */}
        <div className="lg:col-span-1 space-y-6">
          {/* 日期范围选择 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                日期范围
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickSelect(1)}
                >
                  本周
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickSelect(2)}
                >
                  最近两周
                </Button>
              </div>
              <div>
                <Label>开始日期</Label>
                <Input
                  type="date"
                  value={format(weekStart, "yyyy-MM-dd")}
                  onChange={(e) => setWeekStart(new Date(e.target.value))}
                />
              </div>
              <div>
                <Label>结束日期</Label>
                <Input
                  type="date"
                  value={format(weekEnd, "yyyy-MM-dd")}
                  onChange={(e) => setWeekEnd(new Date(e.target.value))}
                />
              </div>
            </CardContent>
          </Card>

          {/* OKR 选择 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                关联 OKR
              </CardTitle>
              <CardDescription>
                选择要关联的 OKR 周期（可选）
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Select
                value={selectedPeriodId?.toString() || "none"}
                onValueChange={(value) =>
                  setSelectedPeriodId(value === "none" ? null : parseInt(value))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择 OKR 周期" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">不关联 OKR</SelectItem>
                  {periods?.map((period) => (
                    <SelectItem key={period.id} value={period.id.toString()}>
                      {period.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!periods || periods.length === 0 ? (
                <p className="text-sm text-muted-foreground mt-2">
                  还没有 OKR 周期，
                  <Button
                    variant="link"
                    className="p-0 h-auto"
                    onClick={() => navigate("/okr")}
                  >
                    去创建
                  </Button>
                </p>
              ) : null}
            </CardContent>
          </Card>

          {/* 生成按钮 */}
          <Button
            className="w-full"
            onClick={handleGenerate}
            disabled={generateReport.isPending || selectedReportIds.length === 0}
          >
            {generateReport.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                生成中...
              </>
            ) : (
              <>
                <FileText className="mr-2 h-4 w-4" />
                生成周报
              </>
            )}
          </Button>
        </div>

        {/* 右侧：内容区域 */}
        <div className="lg:col-span-2 space-y-6">
          {/* 日报选择 */}
          {!generatedReport && (
            <Card>
              <CardHeader>
                <CardTitle>选择日报</CardTitle>
                <CardDescription>
                  选择要包含在周报中的日报（{filteredReports.length} 份可用）
                </CardDescription>
              </CardHeader>
              <CardContent>
                {filteredReports.length > 0 ? (
                  <div className="space-y-3">
                    {filteredReports.map((report) => (
                      <div
                        key={report.id}
                        className="flex items-start gap-3 p-3 rounded-lg border hover:bg-accent/50 transition-colors"
                      >
                        <Checkbox
                          checked={selectedReportIds.includes(report.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedReportIds([...selectedReportIds, report.id]);
                            } else {
                              setSelectedReportIds(
                                selectedReportIds.filter((id) => id !== report.id)
                              );
                            }
                          }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium">
                            {format(new Date(report.reportDate), "yyyy年MM月dd日", {
                              locale: zhCN,
                            })}
                          </div>
                          <div className="text-sm text-muted-foreground line-clamp-2 mt-1">
                            {report.summary || report.workContent || "无摘要"}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>该日期范围内没有日报</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* 生成的周报 */}
          {generatedReport && (
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle>周报预览</CardTitle>
                    <CardDescription>
                      {format(weekStart, "yyyy年MM月dd日", { locale: zhCN })} -{" "}
                      {format(weekEnd, "yyyy年MM月dd日", { locale: zhCN })}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setGeneratedReport(null)}
                    >
                      重新生成
                    </Button>
                    <Button
                      onClick={() => {
                        if (generatedReport.reportId) {
                          syncToNotion.mutate({ id: generatedReport.reportId });
                        }
                      }}
                      disabled={syncToNotion.isPending}
                    >
                      {syncToNotion.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          同步中...
                        </>
                      ) : (
                        <>
                          <ExternalLink className="mr-2 h-4 w-4" />
                          同步到 Notion
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm max-w-none dark:prose-invert">
                  <Streamdown>{generatedReport.markdownContent}</Streamdown>
                </div>
              </CardContent>
            </Card>
          )}


        </div>
      </div>
    </div>
  );
}
