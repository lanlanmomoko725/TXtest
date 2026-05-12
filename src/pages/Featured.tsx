import { useState } from "react";
import { Link } from "react-router";
import { trpc } from "@/providers/trpc";
import PostCard from "@/components/PostCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Star, ArrowLeft, StickyNote, FileText, Loader2 } from "lucide-react";

export default function Featured() {
  const [tab, setTab] = useState<"posts" | "articles">("posts");

  const { data: featuredPosts, isLoading } = trpc.post.list.useQuery({
    featured: true,
    limit: 50,
    offset: 0,
  });

  const posts = featuredPosts?.filter((p) => !p.isArticle) || [];
  const articles = featuredPosts?.filter((p) => p.isArticle) || [];

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-4">
          <Link to="/" className="hover:text-sky-600">首页</Link>
          <span>/</span>
          <span className="text-slate-900 font-medium">精选频道</span>
        </div>

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Link to="/" className="p-2 rounded-full hover:bg-slate-100 transition-colors">
              <ArrowLeft className="h-5 w-5 text-slate-600" />
            </Link>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Star className="h-6 w-6 text-amber-500" />
              精选频道
            </h1>
          </div>
          <p className="text-slate-600 ml-11">
            管理员精选的优质天象内容
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-3 mb-8">
          <Button
            variant={tab === "posts" ? "default" : "outline"}
            onClick={() => setTab("posts")}
            className={`flex items-center gap-2 ${
              tab === "posts" ? "bg-sky-600 hover:bg-sky-700" : "border-slate-200"
            }`}
          >
            <StickyNote className="h-4 w-4" />
            精选帖子
            <Badge
              variant={tab === "posts" ? "secondary" : "outline"}
              className={`ml-1 text-xs ${
                tab === "posts" ? "bg-white/30 text-white" : ""
              }`}
            >
              {posts.length}
            </Badge>
          </Button>
          <Button
            variant={tab === "articles" ? "default" : "outline"}
            onClick={() => setTab("articles")}
            className={`flex items-center gap-2 ${
              tab === "articles" ? "bg-sky-600 hover:bg-sky-700" : "border-slate-200"
            }`}
          >
            <FileText className="h-4 w-4" />
            精选文章
            <Badge
              variant={tab === "articles" ? "secondary" : "outline"}
              className={`ml-1 text-xs ${
                tab === "articles" ? "bg-white/30 text-white" : ""
              }`}
            >
              {articles.length}
            </Badge>
          </Button>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-sky-600" />
          </div>
        ) : tab === "posts" ? (
          posts.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {posts.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
            </div>
          ) : (
            <div className="text-center py-20">
              <StickyNote className="h-16 w-16 mx-auto mb-4 text-slate-300" />
              <h3 className="text-lg font-medium text-slate-700 mb-2">暂无精选帖子</h3>
              <p className="text-slate-500">管理员尚未精选任何帖子</p>
            </div>
          )
        ) : (
          articles.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {articles.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
            </div>
          ) : (
            <div className="text-center py-20">
              <FileText className="h-16 w-16 mx-auto mb-4 text-slate-300" />
              <h3 className="text-lg font-medium text-slate-700 mb-2">暂无精选文章</h3>
              <p className="text-slate-500">管理员尚未精选任何文章</p>
            </div>
          )
        )}
      </div>
    </div>
  );
}
