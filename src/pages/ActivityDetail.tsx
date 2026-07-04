import { Link, useNavigate, useParams } from "react-router";
import { ArrowLeft, CalendarDays, Loader2, Trash2 } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import TagContent from "@/components/TagContent";

export default function ActivityDetail() {
  const { id } = useParams<{ id: string }>();
  const activityId = Number(id);
  const navigate = useNavigate();
  const { user } = useAuth();
  const canManage = !!user && user.level >= 99;
  const utils = trpc.useUtils();

  const { data: activity, isLoading } = trpc.activity.byId.useQuery(
    { id: activityId },
    { enabled: Number.isInteger(activityId) && activityId > 0 },
  );

  const deleteActivity = trpc.activity.delete.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.activity.list.invalidate(),
        utils.activity.archive.invalidate(),
      ]);
      navigate("/activities");
    },
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!activity) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="text-center">
          <CalendarDays className="mx-auto mb-3 h-12 w-12 text-muted-foreground/40" />
          <h1 className="mb-3 text-xl font-bold text-foreground">活动不存在</h1>
          <Button variant="outline" asChild>
            <Link to="/activities">
              <ArrowLeft className="h-4 w-4" />
              返回组织活动
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/activities">
              <ArrowLeft className="h-4 w-4" />
              组织活动
            </Link>
          </Button>
          {canManage && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-destructive/30 text-destructive hover:bg-destructive/5"
              disabled={deleteActivity.isPending}
              onClick={() => {
                if (confirm("确定删除这条组织活动吗？删除后不可恢复。")) {
                  deleteActivity.mutate({ id: activity.id });
                }
              }}
            >
              {deleteActivity.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              删除
            </Button>
          )}
        </div>

        <article>
          <h1 className="mb-8 text-2xl font-bold leading-tight text-foreground md:text-3xl">
            {activity.title}
          </h1>
          <TagContent html={activity.content} className="article-content max-w-none" />
        </article>
      </div>
    </div>
  );
}
