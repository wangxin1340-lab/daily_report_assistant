import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { trpc } from "@/lib/trpc";
import {
  Calendar,
  CheckCircle,
  Clock,
  FileText,
  Loader2,
  Search,
  AlertCircle,
  ChevronRight,
  Filter,
  ArrowUpDown,
  X,
  CalendarDays,
  Trash2,
} from "lucide-react";
import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

type SyncStatus = "all" | "synced" | "pending" | "failed";
type SortBy = "date_desc" | "date_asc" | "created_desc" | "created_asc";

export default function History() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  
  // 筛选状态
  const [syncStatusFilter, setSyncStatusFilter] = useState<SyncStatus>("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  
  // 排序状态
  const [sortBy, setSortBy] = useState<SortBy>("date_desc");

  const { data: reports, isLoading, refetch } = trpc.report.list.useQuery();
  
  // 删除日报
  const deleteMutation = trpc.report.delete.useMutation({
    onSuccess: () => {
      toast.success("日报已删除");
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || "删除失败");
    },
  });

  // 计算是否有活跃的筛选条件
  const hasActiveFilters = syncStatusFilter !== "all" || startDate || endDate;

  // 清除所有筛选
  const clearFilters = () => {
    setSyncStatusFilter("all");
    setStartDate("");
    setEndDate("");
  };

  // 过滤和排序日报
  const filteredAndSortedReports = useMemo(() => {
    if (!reports) return [];

    let result = [...reports];

    // 搜索过滤
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (report) =>
          report.summary?.toLowerCase().includes(query) ||
          report.workContent?.toLowerCase().includes(query) ||
          report.problems?.toLowerCase().includes(query)
      );
    }

    // 同步状态过滤
    if (syncStatusFilter !== "all") {
      result = result.filter((report) => report.notionSyncStatus === syncStatusFilter);
    }

    // 日期范围过滤
    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      result = result.filter((report) => new Date(report.reportDate) >= start);
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      result = result.filter((report) => new Date(report.reportDate) <= end);
    }

    // 排序
    result.sort((a, b) => {
      switch (sortBy) {
        case "date_desc":
          return new Date(b.reportDate).getTime() - new Date(a.reportDate).getTime();
        case "date_asc":
          return new Date(a.reportDate).getTime() - new Date(b.reportDate).getTime();
        case "created_desc":
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case "created_asc":
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        default:
          return 0;
      }
    });

    return result;
  }, [reports, searchQuery, syncStatusFilter, startDate, endDate, sortBy]);

  // 按月份分组
  const groupedReports = useMemo(() => {
    const groups: Record<string, typeof filteredAndSortedReports> = {};
    filteredAndSortedReports.forEach((report) => {
      const date = new Date(report.reportDate);
      const monthKey = `${date.getFullYear()}年${date.getMonth() + 1}月`;
      if (!groups[monthKey]) {
        groups[monthKey] = [];
      }
      groups[monthKey].push(report);
    });
    return groups;
  }, [filteredAndSortedReports]);

  const getSyncStatusBadge = (status: string | null) => {
    switch (status) {
      case "synced":
        return (
          <Badge variant="default" className="bg-green-500/10 text-green-600 border-green-200 gap-1">
            <CheckCircle className="h-3 w-3" />
            已同步
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="destructive" className="gap-1">
            <AlertCircle className="h-3 w-3" />
            同步失败
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="gap-1">
            <Clock className="h-3 w-3" />
            待同步
          </Badge>
        );
    }
  };

  const handleDelete = (e: React.MouseEvent, reportId: number) => {
    e.stopPropagation(); // 阻止点击事件冒泡到卡片
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">历史日报</h1>
          <p className="text-muted-foreground mt-1">
            共 {reports?.length || 0} 份日报
            {filteredAndSortedReports.length !== reports?.length && (
              <span className="ml-1">
                （已筛选 {filteredAndSortedReports.length} 份）
              </span>
            )}
          </p>
        </div>
      </div>

      {/* 搜索和筛选栏 */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* 搜索框 */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索日报内容..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* 筛选按钮 */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="gap-2 shrink-0">
              <Filter className="h-4 w-4" />
              筛选
              {hasActiveFilters && (
                <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                  !
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80" align="end">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">筛选条件</h4>
                {hasActiveFilters && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearFilters}
                    className="h-auto p-1 text-xs text-muted-foreground"
                  >
                    <X className="h-3 w-3 mr-1" />
                    清除
                  </Button>
                )}
              </div>

              {/* 同步状态筛选 */}
              <div className="space-y-2">
                <Label className="text-sm">同步状态</Label>
                <Select
                  value={syncStatusFilter}
                  onValueChange={(value) => setSyncStatusFilter(value as SyncStatus)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择状态" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部</SelectItem>
                    <SelectItem value="synced">已同步</SelectItem>
                    <SelectItem value="pending">待同步</SelectItem>
                    <SelectItem value="failed">同步失败</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* 日期范围筛选 */}
              <div className="space-y-2">
                <Label className="text-sm">日期范围</Label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs text-muted-foreground">开始日期</Label>
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="h-9"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">结束日期</Label>
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="h-9"
                    />
                  </div>
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* 排序按钮 */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="gap-2 shrink-0">
              <ArrowUpDown className="h-4 w-4" />
              排序
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56" align="end">
            <div className="space-y-2">
              <h4 className="font-medium mb-3">排序方式</h4>
              <Select
                value={sortBy}
                onValueChange={(value) => setSortBy(value as SortBy)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date_desc">日期（最新优先）</SelectItem>
                  <SelectItem value="date_asc">日期（最早优先）</SelectItem>
                  <SelectItem value="created_desc">创建时间（最新优先）</SelectItem>
                  <SelectItem value="created_asc">创建时间（最早优先）</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* 活跃筛选条件标签 */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-2">
          {syncStatusFilter !== "all" && (
            <Badge variant="secondary" className="gap-1">
              状态: {syncStatusFilter === "synced" ? "已同步" : syncStatusFilter === "pending" ? "待同步" : "同步失败"}
              <button
                onClick={() => setSyncStatusFilter("all")}
                className="ml-1 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {startDate && (
            <Badge variant="secondary" className="gap-1">
              开始: {startDate}
              <button
                onClick={() => setStartDate("")}
                className="ml-1 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {endDate && (
            <Badge variant="secondary" className="gap-1">
              结束: {endDate}
              <button
                onClick={() => setEndDate("")}
                className="ml-1 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
        </div>
      )}

      {/* 日报列表 */}
      {filteredAndSortedReports.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">
              {searchQuery || hasActiveFilters ? "没有找到匹配的日报" : "暂无日报记录"}
            </p>
            {!searchQuery && !hasActiveFilters && (
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => setLocation("/")}
              >
                开始写日报
              </Button>
            )}
            {(searchQuery || hasActiveFilters) && (
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => {
                  setSearchQuery("");
                  clearFilters();
                }}
              >
                清除筛选条件
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {Object.entries(groupedReports).map(([month, monthReports]) => (
            <div key={month}>
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                {month}
                <Badge variant="outline" className="ml-2 font-normal">
                  {monthReports.length} 份
                </Badge>
              </h2>
              <div className="space-y-3">
                {monthReports.map((report) => {
                  const date = new Date(report.reportDate);
                  return (
                    <Card
                      key={report.id}
                      className="cursor-pointer hover:bg-accent/50 transition-colors"
                      onClick={() => setLocation(`/report/${report.id}`)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 mb-2 flex-wrap">
                              <span className="font-medium">
                                {date.toLocaleDateString("zh-CN", {
                                  month: "long",
                                  day: "numeric",
                                  weekday: "short",
                                })}
                              </span>
                              {getSyncStatusBadge(report.notionSyncStatus)}
                            </div>
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {report.summary || "暂无总结"}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {/* 删除按钮 */}
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>确认删除</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    确定要删除 {date.toLocaleDateString("zh-CN")} 的日报吗？此操作无法撤销。
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>取消</AlertDialogCancel>
                                  <AlertDialogAction
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    onClick={() => deleteMutation.mutate({ id: report.id })}
                                  >
                                    {deleteMutation.isPending ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      "删除"
                                    )}
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                            <ChevronRight className="h-5 w-5 text-muted-foreground" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
