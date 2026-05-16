import { Link } from "react-router";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CATEGORY_LABEL_MAP } from "@contracts/constants";
import { Eye, MapPin, Calendar } from "lucide-react";
import ImageGallery from "./ImageGallery";
import type { Post } from "@db/schema";
import type { User } from "@db/schema";

function extractPlainText(html: string): string {
  return html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

interface PostCardProps {
  post: Post & { author: User | null };
  hideMeta?: boolean;
}

export default function PostCard({ post, hideMeta }: PostCardProps) {
  const categoryLabel = CATEGORY_LABEL_MAP[post.category as keyof typeof CATEGORY_LABEL_MAP] || post.category;
  const images = post.images && Array.isArray(post.images) ? post.images.filter(Boolean) : [];
  const plainContent = extractPlainText(post.content);
  const displayTitle = post.title && post.title !== plainContent.slice(0, 30) + (plainContent.length > 30 ? "..." : "")
    ? post.title
    : plainContent;

  return (
    <Link to={`/post/${post.id}`} className="group block focus-visible:rounded-xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
      <article className="bg-card border border-border/60 rounded-xl overflow-hidden shadow-card hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-300 ease-out-quart">
        {images.length > 0 ? (
          images.length === 1 ? (
            <div className="aspect-[16/10] overflow-hidden bg-muted">
              <img
                src={images[0]}
                alt={post.title || "文章配图"}
                loading="lazy"
                width={640}
                height={400}
                className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out-quart"
              />
            </div>
          ) : (
            <div className="bg-muted">
              <ImageGallery images={images} alt={post.title} clickable={false} maxImages={9} />
            </div>
          )
        ) : (
          <div className="aspect-[16/10] bg-gradient-to-br from-primary/10 via-primary/5 to-background flex items-center justify-center">
            <span className="text-4xl font-bold text-primary/20">{categoryLabel}</span>
          </div>
        )}
        <div className="p-4">
          {!hideMeta && (
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <Badge variant="secondary" className="bg-primary/8 text-primary hover:bg-primary/12 transition-colors">
                {categoryLabel}
              </Badge>
              {post.isArticle && (
                <Badge variant="outline" className="text-amber-600 border-amber-200/60 hover:bg-amber-50/50 transition-colors">
                  文章
                </Badge>
              )}
              {post.isSkyExplanation && (
                <Badge variant="outline" className="text-purple-600 border-purple-200/60 hover:bg-purple-50/50 transition-colors">
                  天象解说图
                </Badge>
              )}
              {post.hasLocation && post.region && (
                <Badge variant="outline" className="text-emerald-600 border-emerald-200/60 hover:bg-emerald-50/50 transition-colors flex items-center gap-0.5">
                  <MapPin className="h-3 w-3" />
                  {post.region}
                </Badge>
              )}
            </div>
          )}
          <h3 className="font-semibold text-card-foreground line-clamp-1 group-hover:text-primary transition-colors duration-200">
            {displayTitle}
          </h3>
          {!hideMeta && (
            <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
              <div className="flex items-center gap-2 min-w-0">
                <Avatar className="h-5 w-5 flex-shrink-0 border border-border/50">
                  <AvatarImage src={post.author?.avatar || undefined} />
                  <AvatarFallback className="bg-muted text-muted-foreground text-[10px]">
                    {(post.author?.name || "用户").slice(0, 1)}
                  </AvatarFallback>
                </Avatar>
                <span className="truncate max-w-[80px]">{post.author?.name || "匿名"}</span>
              </div>
              <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0 tabular-nums">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3 flex-shrink-0" />
                  <span className="hidden sm:inline">
                    {new Date(post.createdAt).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })}
                  </span>
                  <span className="sm:hidden">
                    {new Date(post.createdAt).toLocaleString("zh-CN", { month: "numeric", day: "numeric" })}
                  </span>
                </span>
                <span className="flex items-center gap-1">
                  <Eye className="h-3 w-3 flex-shrink-0" />
                  {post.viewCount}
                </span>
              </div>
            </div>
          )}
        </div>
      </article>
    </Link>
  );
}
