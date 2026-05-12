import { useState, useCallback, useRef } from "react";
import { Link } from "react-router";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import PostCard from "@/components/PostCard";
import { SKY_GALLERY_CATEGORIES } from "@contracts/constants";
import {
  Loader2,
  Library,
  PanelLeftClose,
  PanelLeft,
  GripVertical,
} from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

export default function SkyGalleryPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window !== "undefined" && sessionStorage.getItem("sidebar_auto_open") === "1") {
      sessionStorage.removeItem("sidebar_auto_open");
      return true;
    }
    return typeof window !== "undefined" ? window.innerWidth >= 768 : true;
  });
  const [activeCategory, setActiveCategory] = useState("");

  const { data: posts, isLoading } = trpc.post.list.useQuery({
    skyGalleryCategory: activeCategory,
    limit: 50,
    offset: 0,
  });

  const utils = trpc.useUtils();
  const reorderMutation = trpc.post.reorderSkyGallery.useMutation({
    onSuccess: () => {
      utils.post.list.invalidate();
    },
  });

  // Drag-and-drop state
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    setDragIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(index));
    // Make the dragged element slightly transparent
    const el = e.currentTarget as HTMLElement;
    requestAnimationFrame(() => {
      el.style.opacity = "0.5";
    });
  }, []);

  const handleDragEnd = useCallback((e: React.DragEvent) => {
    const el = e.currentTarget as HTMLElement;
    el.style.opacity = "1";
    setDragIndex(null);
    setDropIndex(null);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDropIndex(index);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDropIndex(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, dropIdx: number) => {
      e.preventDefault();
      if (dragIndex === null || dragIndex === dropIdx || !posts) return;

      const reordered = [...posts];
      const [movedItem] = reordered.splice(dragIndex, 1);
      reordered.splice(dropIdx, 0, movedItem);

      reorderMutation.mutate({
        orderedIds: reordered.map((p) => p.id),
      });

      setDragIndex(null);
      setDropIndex(null);
    },
    [dragIndex, posts, reorderMutation]
  );

  const allLabel = "全部";

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
            <Library className="h-4 w-4 text-purple-600" />
            天空图鉴
          </h2>

          <div className="space-y-0.5">
            <button
              className={`flex items-center w-full px-2 py-2 text-sm rounded-md transition-colors text-left ${
                activeCategory === ""
                  ? "bg-purple-50 text-purple-700 font-medium"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
              onClick={() => setActiveCategory("")}
            >
              {allLabel}
            </button>
            {SKY_GALLERY_CATEGORIES.map((cat) => (
              <button
                key={cat}
                className={`flex items-center w-full px-2 py-2 text-sm rounded-md transition-colors text-left ${
                  activeCategory === cat
                    ? "bg-purple-50 text-purple-700 font-medium"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
                onClick={() => setActiveCategory(cat)}
              >
                {cat}
              </button>
            ))}
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
          {/* 页面标题 */}
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
              <Library className="h-6 w-6 text-purple-600" />
              天空图鉴
            </h1>
            <span className="text-sm text-slate-400">
              {activeCategory || allLabel} · {posts?.length || 0} 条记录
            </span>
          </div>

          {/* 帖子列表 */}
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
            </div>
          ) : posts && posts.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {posts.map((post, index) => (
                <div
                  key={post.id}
                  draggable={isAdmin}
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragEnd={handleDragEnd}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, index)}
                  className={`relative group transition-all ${
                    dragIndex === index ? "opacity-50" : ""
                  } ${
                    dropIndex === index && dragIndex !== index
                      ? "border-t-2 border-purple-500"
                      : ""
                  }`}
                >
                  {/* 拖拽手柄 (仅管理员) */}
                  {isAdmin && (
                    <div className="absolute top-2 left-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing">
                      <GripVertical className="h-5 w-5 text-slate-400 bg-white/80 rounded" />
                    </div>
                  )}
                  <PostCard post={post} hideMeta />
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-20">
              <Library className="h-16 w-16 mx-auto mb-4 text-slate-300" />
              <h3 className="text-lg font-medium text-slate-700 mb-2">暂无内容</h3>
              <p className="text-slate-500">该分类下还没有内容。</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
