import { Link } from "react-router";
import { trpc } from "@/providers/trpc";
import PostCard from "@/components/PostCard";
import { SKY_CATEGORIES, REGIONS } from "@contracts/constants";
import {
  Cloud,
  MapPin,
  Clock,
  Flame,
  Loader2,
  ChevronDown,
  ChevronUp,
  PanelLeftClose,
  PanelLeft,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";

export default function SkyEventsPage() {
  const isMobile = useIsMobile();
  const autoOpenRef = useRef(false);
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window !== "undefined" && sessionStorage.getItem("sidebar_auto_open") === "1") {
      sessionStorage.removeItem("sidebar_auto_open");
      autoOpenRef.current = true;
      return true;
    }
    return typeof window !== "undefined" ? window.innerWidth >= 768 : true;
  });
  const [categoryOpen, setCategoryOpen] = useState(true);
  const [regionOpen, setRegionOpen] = useState(false);
  const [sort, setSort] = useState<"time" | "hot">("time");

  const { data: posts, isLoading } = trpc.post.list.useQuery({
    isArticle: false,
    isSkyExplanation: false,
    sort,
    limit: 24,
    offset: 0,
  });

  useEffect(() => {
    const mobile = typeof window !== "undefined" ? window.innerWidth < 768 : isMobile;
    if (!mobile) {
      setSidebarOpen(true);
    } else if (!autoOpenRef.current) {
      setSidebarOpen(false);
    }
    autoOpenRef.current = false;
  }, [isMobile]);

  return (
    <div className="min-h-screen flex">
      {/* 左侧分类栏 */}
      <aside
        className={`${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } fixed md:sticky top-16 md:top-16 left-0 z-40 h-[calc(100dvh-4rem)] w-52 bg-background border-r border-border/60 shrink-0 transition-transform duration-200 md:translate-x-0 flex flex-col`}
      >
        <div className="flex-1 overflow-y-auto p-3 scrollbar-thin">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground mb-3 pb-2 border-b border-border/40">
            <Clock className="h-4 w-4 text-primary" />
            实时天象
          </h2>

          {/* 按天象分类 */}
          <div className="mb-1">
            <button
              className="flex items-center justify-between w-full py-2 text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
              onClick={() => { setCategoryOpen(!categoryOpen); setRegionOpen(false); }}
            >
              <span className="flex items-center gap-2">
                <Cloud className="h-4 w-4 text-primary/70" />
                按天象分类
              </span>
              {categoryOpen ? (
                <ChevronUp className="h-3 w-3 text-muted-foreground/50" />
              ) : (
                <ChevronDown className="h-3 w-3 text-muted-foreground/50" />
              )}
            </button>
            {categoryOpen && (
              <div className="pb-1 space-y-0.5">
                {SKY_CATEGORIES.map((cat) => (
                  <Link
                    key={cat.id}
                    to={`/category/${cat.id}`}
                    className="flex items-center justify-between py-2 px-2 text-sm text-muted-foreground rounded-md hover:bg-primary/5 hover:text-primary transition-colors"
                  >
                    <span>{cat.label}</span>
                    <span className="text-xs text-muted-foreground/50">{cat.description.slice(0, 8)}…</span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* 按地区分类 */}
          <div>
            <button
              className="flex items-center justify-between w-full py-2 text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
              onClick={() => { setRegionOpen(!regionOpen); setCategoryOpen(false); }}
            >
              <span className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-emerald-500" />
                按地区分类
              </span>
              {regionOpen ? (
                <ChevronUp className="h-3 w-3 text-muted-foreground/50" />
              ) : (
                <ChevronDown className="h-3 w-3 text-muted-foreground/50" />
              )}
            </button>
            {regionOpen && (
              <div className="pb-1">
                <div className="grid grid-cols-2 gap-0.5">
                  {REGIONS.map((region) => (
                    <Link
                      key={region}
                      to={`/region/${region}`}
                      className="py-1.5 text-xs text-muted-foreground text-center rounded-md hover:bg-primary/5 hover:text-primary transition-colors"
                    >
                      {region}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* 移动端侧栏遮罩 */}
      {sidebarOpen && isMobile && (
        <div
          className="fixed inset-0 z-30 bg-black/30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* 主内容区 */}
      <div className="flex-1 min-w-0">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8">
          {/* 页面标题 + 移动端侧栏切换按钮 */}
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              {isMobile && (
                <button
                  className="p-2 rounded-md hover:bg-muted transition-colors"
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                >
                  {sidebarOpen ? (
                    <PanelLeftClose className="h-5 w-5 text-slate-600" />
                  ) : (
                    <PanelLeft className="h-5 w-5 text-slate-600" />
                  )}
                </button>
              )}
              <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <Clock className="h-6 w-6 text-primary" />
                实时天象
              </h1>
              <span className="text-sm text-muted-foreground/50">
                {posts?.length || 0} 条记录
              </span>
            </div>
            <div className="inline-flex w-fit rounded-lg border border-border bg-background p-1 shadow-sm">
              <button
                type="button"
                onClick={() => setSort("time")}
                className={`inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors ${
                  sort === "time" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Clock className="h-3.5 w-3.5" />
                按时间
              </button>
              <button
                type="button"
                onClick={() => setSort("hot")}
                className={`inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors ${
                  sort === "hot" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Flame className="h-3.5 w-3.5" />
                按热度
              </button>
            </div>
          </div>

          {/* 帖子列表 */}
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : posts && posts.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {posts.map((post) => (
                <PostCard key={post.id} post={post} showLikeButton />
              ))}
            </div>
          ) : (
            <div className="text-center py-20">
              <Clock className="h-16 w-16 mx-auto mb-4 text-muted-foreground/40" />
              <h3 className="text-lg font-medium text-foreground/80 mb-2">暂无内容</h3>
              <p className="text-muted-foreground">还没有天象记录，快来发布第一条吧！</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
