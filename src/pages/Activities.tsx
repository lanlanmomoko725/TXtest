import { Link, useParams } from "react-router";
import { Archive, CalendarDays, Loader2, Plus, Sparkles } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import MasonryGrid, { MasonryItem } from "@/components/MasonryGrid";
import ActivityCard, { formatActivityMonth } from "@/components/ActivityCard";

function parseYearMonth(year?: string, month?: string) {
  if (!year && !month) return { hasFilter: false, valid: true };
  const activityYear = Number(year);
  const activityMonth = Number(month);
  const valid =
    Number.isInteger(activityYear) &&
    Number.isInteger(activityMonth) &&
    activityYear >= 1900 &&
    activityYear <= 2200 &&
    activityMonth >= 1 &&
    activityMonth <= 12;
  return { hasFilter: true, valid, activityYear, activityMonth };
}

export default function Activities() {
  const { year, month } = useParams<{ year?: string; month?: string }>();
  const { user } = useAuth();
  const canManage = !!user && user.level >= 99;
  const filter = parseYearMonth(year, month);
  const activeYear = filter.hasFilter && filter.valid ? filter.activityYear : undefined;
  const activeMonth = filter.hasFilter && filter.valid ? filter.activityMonth : undefined;

  const { data: archive = [] } = trpc.activity.archive.useQuery();
  const { data: activities, isLoading } = trpc.activity.list.useQuery(
    activeYear && activeMonth
      ? { year: activeYear, month: activeMonth, limit: 100, offset: 0 }
      : { limit: 100, offset: 0 },
    { enabled: !filter.hasFilter || filter.valid },
  );

  const years = [...new Set(archive.map((item) => item.year))].sort((a, b) => b - a);
  const title = activeYear && activeMonth
    ? formatActivityMonth(activeYear, activeMonth)
    : "组织活动";

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Link to="/" className="hover:text-primary">首页</Link>
          <span>/</span>
          <span className="font-medium text-foreground">组织活动</span>
        </div>

        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
              <CalendarDays className="h-6 w-6 text-primary" />
              {title}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {filter.hasFilter && filter.valid ? "查看该月份的组织活动" : "浏览全部组织活动记录"}
            </p>
          </div>
          {canManage && (
            <Button asChild className="w-full sm:w-auto">
              <Link to="/activities/new">
                <Plus className="h-4 w-4" />
                发布活动
              </Link>
            </Button>
          )}
        </div>

        <div className="flex flex-col gap-6 md:flex-row">
          <aside className="w-full shrink-0 md:sticky md:top-20 md:w-56 md:self-start">
            <div className="rounded-xl border border-border/60 bg-card p-3 shadow-card">
              <div className="mb-3 flex items-center justify-between border-b border-border/50 pb-2">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Archive className="h-4 w-4 text-primary" />
                  时间归档
                </h2>
                <Badge variant="secondary">{archive.reduce((sum, item) => sum + item.count, 0)}</Badge>
              </div>
              <Link
                to="/activities"
                className={`mb-2 flex items-center justify-between rounded-lg px-2 py-2 text-sm transition-colors ${
                  !filter.hasFilter
                    ? "bg-primary/10 font-medium text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                全部活动
              </Link>
              {years.length > 0 ? (
                <div className="space-y-2">
                  {years.map((archiveYear) => {
                    const months = archive.filter((item) => item.year === archiveYear);
                    const yearActive = activeYear === archiveYear;
                    return (
                      <details key={archiveYear} open={yearActive || years[0] === archiveYear} className="group">
                        <summary className="flex cursor-pointer list-none items-center justify-between rounded-lg px-2 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted">
                          <span>{archiveYear}年</span>
                          <span className="text-xs text-muted-foreground">{months.reduce((sum, item) => sum + item.count, 0)}</span>
                        </summary>
                        <div className="mt-1 space-y-0.5 pl-2">
                          {months.map((item) => {
                            const active =
                              activeYear === item.year &&
                              activeMonth === item.month;
                            return (
                              <Link
                                key={`${item.year}-${item.month}`}
                                to={`/activities/${item.year}/${item.month}`}
                                className={`flex items-center justify-between rounded-md px-2 py-1.5 text-sm transition-colors ${
                                  active
                                    ? "bg-primary/10 font-medium text-primary"
                                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                }`}
                              >
                                <span>{item.month}月</span>
                                <span className="text-xs">{item.count}</span>
                              </Link>
                            );
                          })}
                        </div>
                      </details>
                    );
                  })}
                </div>
              ) : (
                <p className="px-2 py-3 text-sm text-muted-foreground">暂无归档</p>
              )}
            </div>
          </aside>

          <section className="min-w-0 flex-1">
            {!filter.valid ? (
              <EmptyState title="归档不存在" description="请选择有效的年份和月份。" />
            ) : isLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : activities && activities.length > 0 ? (
              <MasonryGrid>
                {activities.map((activity) => (
                  <MasonryItem key={activity.id}>
                    <ActivityCard activity={activity} />
                  </MasonryItem>
                ))}
              </MasonryGrid>
            ) : (
              <EmptyState title="暂无活动" description="该栏目还没有发布组织活动。" />
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card py-20 text-center">
      <Sparkles className="mx-auto mb-4 h-16 w-16 text-muted-foreground/40" />
      <h2 className="mb-2 text-lg font-medium text-foreground/80">{title}</h2>
      <p className="text-muted-foreground">{description}</p>
    </div>
  );
}
