import { useParams } from "react-router";
import { trpc } from "@/providers/trpc";
import PostCard from "@/components/PostCard";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { CATEGORY_LABEL_MAP, SKY_CATEGORIES } from "@contracts/constants";
import { Cloud, MapPin, Loader2, ArrowLeft } from "lucide-react";
import { Link } from "react-router";

export default function CategoryPage() {
  const { categoryId, regionId } = useParams<{ categoryId?: string; regionId?: string }>();
  
  const isRegion = !!regionId;
  
  const { data: posts, isLoading } = trpc.post.list.useQuery({
    category: categoryId,
    region: regionId,
    limit: 24,
    offset: 0,
  });

  const title = categoryId
    ? CATEGORY_LABEL_MAP[categoryId as keyof typeof CATEGORY_LABEL_MAP] || categoryId
    : regionId || "";

  const description = categoryId
    ? SKY_CATEGORIES.find((cat) => cat.id === categoryId)?.description
    : `${regionId}地区的天象记录`;

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
          <Link to="/" className="hover:text-primary">首页</Link>
          <span>/</span>
          <Link to="/sky-events" className="hover:text-primary">{isRegion ? "按地区分类" : "按天象分类"}</Link>
          <span>/</span>
          <span className="text-foreground font-medium">{title}</span>
        </div>

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Link to="/" className="p-2 rounded-full hover:bg-muted transition-colors">
              <ArrowLeft className="h-5 w-5 text-muted-foreground" />
            </Link>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              {isRegion ? <MapPin className="h-6 w-6 text-emerald-600" /> : <Cloud className="h-6 w-6 text-primary" />}
              {title}
            </h1>
            <Badge variant="secondary" className="ml-2">
              {posts?.length || 0} 条记录
            </Badge>
          </div>
          <p className="text-muted-foreground ml-11">{description}</p>
        </div>

        {/* Filter Tabs */}
        <Tabs defaultValue="latest" className="mb-6">
          <TabsList>
            <TabsTrigger value="latest">最新</TabsTrigger>
            <TabsTrigger value="hottest">最热</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Posts Grid */}
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
            <Cloud className="h-16 w-16 mx-auto mb-4 text-muted-foreground/40" />
            <h3 className="text-lg font-medium text-foreground/80 mb-2">暂无内容</h3>
            <p className="text-muted-foreground">该分类下还没有天象记录，快来发布第一条吧！</p>
          </div>
        )}
      </div>
    </div>
  );
}
