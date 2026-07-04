import { Link } from "react-router";
import { CalendarDays } from "lucide-react";

interface ActivityCardProps {
  activity: {
    id: number;
    title: string;
    coverImage: string | null;
    activityYear: number;
    activityMonth: number;
  };
}

export function formatActivityMonth(year: number, month: number) {
  return `${year}年${month}月`;
}

export default function ActivityCard({ activity }: ActivityCardProps) {
  return (
    <Link
      to={`/activities/detail/${activity.id}`}
      className="group block focus-visible:rounded-xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <article className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-card transition-all duration-300 ease-out-quart hover:-translate-y-0.5 hover:shadow-card-hover">
        {activity.coverImage ? (
          <div className="overflow-hidden bg-muted">
            <img
              src={activity.coverImage}
              alt={activity.title || "活动封面"}
              loading="lazy"
              width={640}
              className="h-auto w-full object-cover transition-transform duration-500 ease-out-quart group-hover:scale-[1.015]"
            />
          </div>
        ) : (
          <div className="flex aspect-[4/3] items-center justify-center bg-gradient-to-br from-primary/10 via-primary/5 to-background">
            <CalendarDays className="h-12 w-12 text-primary/25" />
          </div>
        )}
        <div className="p-3.5">
          <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-card-foreground transition-colors duration-200 group-hover:text-primary">
            {activity.title}
          </h3>
          <div className="mt-2 flex items-center gap-1 text-xs tabular-nums text-muted-foreground">
            <CalendarDays className="h-3.5 w-3.5" />
            {formatActivityMonth(activity.activityYear, activity.activityMonth)}
          </div>
        </div>
      </article>
    </Link>
  );
}
