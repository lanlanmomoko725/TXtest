import { Link } from "react-router";
import { trpc } from "@/providers/trpc";
import PostCard from "@/components/PostCard";
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
import { useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";

export default function SkyEventsPage() {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window !== "undefined" && sessionStorage.getItem("sidebar_auto_open") === "1") {
      sessionStorage.removeItem("sidebar_auto_open");
      return true;
    }
    return typeof window !== "undefined" ? window.innerWidth >= 768 : true;
  });
  const [categoryOpen, setCategoryOpen] = useState(true);
  const [regionOpen, setRegionOpen] = useState(false);

  const { data: posts, isLoading } = trpc.post.list.useQuery({
    limit: 24,
    offset: 0,
  });

  return (
    <div className="min-h-screen flex">
      {/* 左侧分类栏 */}
      <aside
        className={`${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } fixed md:sticky top-16 md:top-16 left-0 z-40 h-[calc(100vh-4rem)] w-52 bg-white border-r shrink-0 transition-transform duration-200 overflow-y-auto md:translate-x-0`}
      >
        <div className="p-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800 mb-3 pb-2 border-b">
            <Clock className="h-4 w-4 text-sky-600" />
            实时天象
          </h2>

          {/* 按天象分类 */}
          <div className="mb-1">
            <button
              className="flex items-center justify-between w-full py-2 text-sm font-medium text-slate-700 hover:text-sky-600 transition-colors"
              onClick={() => { setCategoryOpen(!categoryOpen); setRegionOpen(false); }}
            >
              <span className="flex items-center gap-2">
                <Cloud className="h-4 w-4 text-sky-500" />
                按天象分类
              </span>
              {categoryOpen ? (
                <ChevronUp className="h-3 w-3 text-slate-400" />
              ) : (
                <ChevronDown className="h-3 w-3 text-slate-400" />
              )}
            </button>
            {categoryOpen && (
              <div className="pb-1 space-y-0.5">
                {SKY_CATEGORIES.map((cat) => (
                  <Link
                    key={cat.id}
                    to={`/category/${cat.id}`}
                    className="flex items-center justify-between py-2 px-2 text-sm text-slate-600 rounded-md hover:bg-sky-50 hover:text-sky-600 transition-colors"
                  >
                    <span>{cat.label}</span>
                    <span className="text-xs text-slate-400">{cat.description.slice(0, 8)}...</span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* 按地区分类 */}
          <div>
            <button
              className="flex items-center justify-between w-full py-2 text-sm font-medium text-slate-700 hover:text-sky-600 transition-colors"
              onClick={() => { setRegionOpen(!regionOpen); setCategoryOpen(false); }}
            >
              <span className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-emerald-500" />
                按地区分类
              </span>
              {regionOpen ? (
                <ChevronUp className="h-3 w-3 text-slate-400" />
              ) : (
                <ChevronDown className="h-3 w-3 text-slate-400" />
              )}
            </button>
            {regionOpen && (
              <div className="pb-1">
                <div className="grid grid-cols-2 gap-0.5">
                  {REGIONS.map((region) => (
                    <Link
                      key={region}
                      to={`/region/${region}`}
                      className="py-1.5 text-xs text-slate-600 text-center rounded-md hover:bg-sky-50 hover:text-sky-600 transition-colors"
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
          <div className="flex items-center gap-3 mb-8">
            {isMobile && (
              <button
                className="p-2 rounded-md hover:bg-slate-100 transition-colors"
                onClick={() => setSidebarOpen(!sidebarOpen)}
              >
                {sidebarOpen ? (
                  <PanelLeftClose className="h-5 w-5 text-slate-600" />
                ) : (
                  <PanelLeft className="h-5 w-5 text-slate-600" />
                )}
              </button>
            )}
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Clock className="h-6 w-6 text-sky-600" />
              实时天象
            </h1>
            <span className="text-sm text-slate-400">
              {posts?.length || 0} 条记录
            </span>
          </div>

          {/* 帖子列表 */}
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-sky-600" />
            </div>
          ) : posts && posts.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {posts.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
            </div>
          ) : (
            <div className="text-center py-20">
              <Clock className="h-16 w-16 mx-auto mb-4 text-slate-300" />
              <h3 className="text-lg font-medium text-slate-700 mb-2">暂无内容</h3>
              <p className="text-slate-500">还没有天象记录，快来发布第一条吧！</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
