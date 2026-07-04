import { useState, useCallback, useEffect, useRef } from "react";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import PostCard from "@/components/PostCard";
import MasonryGrid from "@/components/MasonryGrid";
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
  const isAdmin = !!user && user.level >= 99;
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
  const [activeCategory, setActiveCategory] = useState("");

  const { data: posts, isLoading } = trpc.post.list.useQuery({
    skyGalleryCategory: activeCategory,
    limit: 50,
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
        } fixed md:sticky top-16 md:top-16 left-0 z-40 h-[calc(100vh-4rem)] w-52 bg-background border-r border-border/60 shrink-0 transition-transform duration-200 overflow-y-auto md:translate-x-0`}
      >
        <div className="p-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground mb-3 pb-2 border-b border-border/40">
            <Library className="h-4 w-4 text-purple-600" />
            天空图鉴
          </h2>

          <div className="space-y-0.5">
            <button
              className={`flex items-center w-full px-2 py-2 text-sm rounded-md transition-colors text-left ${
                activeCategory === ""
                  ? "bg-purple-500/10 text-purple-700 dark:text-purple-400 font-medium"
                  : "text-muted-foreground hover:bg-muted"
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
                    ? "bg-purple-500/10 text-purple-700 dark:text-purple-400 font-medium"
                    : "text-muted-foreground hover:bg-muted"
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
                className="p-2 rounded-md hover:bg-muted transition-colors"
                onClick={() => setSidebarOpen(!sidebarOpen)}
              >
                {sidebarOpen ? (
                  <PanelLeftClose className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <PanelLeft className="h-5 w-5 text-muted-foreground" />
                )}
              </button>
            )}
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Library className="h-6 w-6 text-purple-600" />
              天空图鉴
            </h1>
            <span className="text-sm text-muted-foreground/50">
              {activeCategory || allLabel} · {posts?.length || 0} 条记录
            </span>
          </div>

          {/* 帖子列表 */}
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
            </div>
          ) : posts && posts.length > 0 ? (
            <MasonryGrid>
              {posts.map((post, index) => (
                <div
                  key={post.id}
                  draggable={isAdmin}
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragEnd={handleDragEnd}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, index)}
                  className={`relative group mb-4 break-inside-avoid transition-all ${
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
                      <GripVertical className="h-5 w-5 text-muted-foreground/50 bg-background/80 rounded" />
                    </div>
                  )}
                  <PostCard post={post} hideMeta />
                </div>
              ))}
            </MasonryGrid>
          ) : (
            <div className="text-center py-20">
              <Library className="h-16 w-16 mx-auto mb-4 text-muted-foreground/40" />
              <h3 className="text-lg font-medium text-foreground/80 mb-2">暂无内容</h3>
              <p className="text-muted-foreground">该分类下还没有内容。</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
