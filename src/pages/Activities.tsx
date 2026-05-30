import { Link } from "react-router";
import { CalendarDays, ArrowLeft, Sparkles } from "lucide-react";

export default function Activities() {
  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
          <Link to="/" className="hover:text-primary">首页</Link>
          <span>/</span>
          <span className="text-foreground font-medium">组织活动</span>
        </div>

        <div className="mb-8 flex items-center gap-3">
          <Link to="/" className="p-2 rounded-full hover:bg-muted transition-colors">
            <ArrowLeft className="h-5 w-5 text-muted-foreground" />
          </Link>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <CalendarDays className="h-6 w-6 text-primary" />
            组织活动
          </h1>
        </div>

        <div className="text-center py-20 rounded-2xl border border-border/60 bg-card">
          <Sparkles className="h-16 w-16 mx-auto mb-4 text-muted-foreground/40" />
          <h2 className="text-lg font-medium text-foreground/80 mb-2">暂无内容</h2>
          <p className="text-muted-foreground">组织活动板块正在准备中。</p>
        </div>
      </div>
    </div>
  );
}
