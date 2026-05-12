import { Link } from "react-router";
import { trpc } from "@/providers/trpc";
import PostCard from "@/components/PostCard";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ImageIcon, Loader2, ArrowLeft, StickyNote, FileText } from "lucide-react";

export default function SkyExplanation() {
  const { data: posts, isLoading } = trpc.post.list.useQuery({
    isSkyExplanation: true,
    limit: 24,
    offset: 0,
  });

  const articles = posts?.filter((p) => p.isArticle) || [];
  const regularPosts = posts?.filter((p) => !p.isArticle) || [];

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-4">
          <Link to="/" className="hover:text-sky-600">首页</Link>
          <span>/</span>
          <span className="text-slate-900 font-medium">天象解说图</span>
        </div>

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Link to="/" className="p-2 rounded-full hover:bg-slate-100 transition-colors">
              <ArrowLeft className="h-5 w-5 text-slate-600" />
            </Link>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <ImageIcon className="h-6 w-6 text-sky-600" />
              天象解说图
            </h1>
          </div>
          <p className="text-slate-600 ml-11">
            浏览所有天象记录与解说文章
          </p>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-sky-600" />
          </div>
        ) : posts && posts.length > 0 ? (
          <Tabs defaultValue="all" className="w-full">
            <TabsList className="mb-6">
              <TabsTrigger value="all">全部 ({posts?.length || 0})</TabsTrigger>
              <TabsTrigger value="articles">
                <FileText className="h-3.5 w-3.5 mr-1" />
                文章 ({articles.length})
              </TabsTrigger>
              <TabsTrigger value="posts">
                <StickyNote className="h-3.5 w-3.5 mr-1" />
                帖子 ({regularPosts.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="all">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {posts.map((post) => (
                  <PostCard key={post.id} post={post} />
                ))}
              </div>
            </TabsContent>

            <TabsContent value="articles">
              {articles.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {articles.map((post) => (
                    <PostCard key={post.id} post={post} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-20">
                  <FileText className="h-16 w-16 mx-auto mb-4 text-slate-300" />
                  <h3 className="text-lg font-medium text-slate-700 mb-2">暂无文章</h3>
                  <p className="text-slate-500">还没有发布任何解说文章</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="posts">
              {regularPosts.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {regularPosts.map((post) => (
                    <PostCard key={post.id} post={post} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-20">
                  <StickyNote className="h-16 w-16 mx-auto mb-4 text-slate-300" />
                  <h3 className="text-lg font-medium text-slate-700 mb-2">暂无帖子</h3>
                  <p className="text-slate-500">还没有发布任何帖子</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        ) : (
          <div className="text-center py-20">
            <ImageIcon className="h-16 w-16 mx-auto mb-4 text-slate-300" />
            <h3 className="text-lg font-medium text-slate-700 mb-2">暂无内容</h3>
            <p className="text-slate-500">还没有天象记录，快来发布第一条吧！</p>
          </div>
        )}
      </div>
    </div>
  );
}
