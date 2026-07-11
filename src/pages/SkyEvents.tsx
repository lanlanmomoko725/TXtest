import { Link, useSearchParams } from "react-router";
import { trpc } from "@/providers/trpc";
import PostCard from "@/components/PostCard";
import MasonryGrid, { MasonryItem } from "@/components/MasonryGrid";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SKY_CATEGORIES, REGIONS } from "@contracts/constants";
import {
  Cloud,
  MapPin,
  Clock,
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
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedCategory = searchParams.get("category");
  const requestedRegion = searchParams.get("region");
  const activeCategory = SKY_CATEGORIES.find((category) => category.id === requestedCategory);
  const activeRegion = REGIONS.find((region) => region === requestedRegion);
  const sort: "time" | "hot" = searchParams.get("sort") === "hot" ? "hot" : "time";
  const autoOpenRef = useRef(false);
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window !== "undefined" && sessionStorage.getItem("sidebar_auto_open") === "1") {
      sessionStorage.removeItem("sidebar_auto_open");
      autoOpenRef.current = true;
      return true;
    }
    return typeof window !== "undefined" ? window.innerWidth >= 768 : true;
  });
  const [categoryOpen, setCategoryOpen] = useState(!activeRegion);
  const [regionOpen, setRegionOpen] = useState(Boolean(activeRegion));

  const { data: posts, isLoading } = trpc.post.list.useQuery({
    category: activeCategory?.id,
    region: activeRegion,
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

  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    let changed = false;
    if (requestedCategory && !activeCategory) {
      next.delete("category");
      changed = true;
    }
    if ((requestedRegion && !activeRegion) || (activeCategory && requestedRegion)) {
      next.delete("region");
      changed = true;
    }
    const requestedSort = searchParams.get("sort");
    if (requestedSort && requestedSort !== "time" && requestedSort !== "hot") {
      next.delete("sort");
      changed = true;
    }
    if (changed) setSearchParams(next, { replace: true });
  }, [activeCategory, activeRegion, requestedCategory, requestedRegion, searchParams, setSearchParams]);

  useEffect(() => {
    if (activeCategory) {
      setCategoryOpen(true);
      setRegionOpen(false);
    } else if (activeRegion) {
      setCategoryOpen(false);
      setRegionOpen(true);
    }
  }, [activeCategory, activeRegion]);

  const filterHref = (type?: "category" | "region", value?: string) => {
    const next = new URLSearchParams();
    if (type && value) next.set(type, value);
    if (sort === "hot") next.set("sort", "hot");
    const query = next.toString();
    return query ? `/sky-events?${query}` : "/sky-events";
  };

  const handleSortChange = (value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value === "hot") next.set("sort", "hot");
    else next.delete("sort");
    setSearchParams(next);
  };

  const pageTitle = activeCategory?.label || activeRegion || "实时天象";

  return (
    <div className="min-h-screen flex">
      {/* 左侧分类栏 */}
      <aside
        className={`${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } fixed md:sticky top-16 md:top-16 left-0 z-40 h-[calc(100dvh-4rem)] w-52 bg-background border-r border-border/60 shrink-0 transition-transform duration-200 md:translate-x-0 flex flex-col`}
      >
        <div className="flex-1 overflow-y-auto p-3 scrollbar-thin">
          <Link
            to={filterHref()}
            onClick={() => isMobile && setSidebarOpen(false)}
            className={`mb-3 flex items-center gap-2 border-b border-border/40 pb-2 text-sm font-semibold transition-colors ${
              !activeCategory && !activeRegion ? "text-primary" : "text-foreground hover:text-primary"
            }`}
          >
            <Clock className="h-4 w-4 text-primary" />
            实时天象
          </Link>

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
                    to={filterHref("category", cat.id)}
                    onClick={() => isMobile && setSidebarOpen(false)}
                    aria-current={activeCategory?.id === cat.id ? "page" : undefined}
                    className={`flex items-center justify-between rounded-md px-2 py-2 text-sm transition-colors ${
                      activeCategory?.id === cat.id
                        ? "bg-primary/10 font-medium text-primary"
                        : "text-muted-foreground hover:bg-primary/5 hover:text-primary"
                    }`}
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
                      to={filterHref("region", region)}
                      onClick={() => isMobile && setSidebarOpen(false)}
                      aria-current={activeRegion === region ? "page" : undefined}
                      className={`rounded-md py-1.5 text-center text-xs transition-colors ${
                        activeRegion === region
                          ? "bg-primary/10 font-medium text-primary"
                          : "text-muted-foreground hover:bg-primary/5 hover:text-primary"
                      }`}
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
                {pageTitle}
              </h1>
              <span className="text-sm text-muted-foreground/50">
                {posts?.length || 0} 条记录
              </span>
            </div>
            <Tabs value={sort} onValueChange={handleSortChange}>
              <TabsList>
                <TabsTrigger value="time">最新</TabsTrigger>
                <TabsTrigger value="hot">最热</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* 帖子列表 */}
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : posts && posts.length > 0 ? (
            <MasonryGrid>
              {posts.map((post) => (
                <MasonryItem key={post.id}>
                  <PostCard post={post} />
                </MasonryItem>
              ))}
            </MasonryGrid>
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
