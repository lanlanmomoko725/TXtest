import { Link } from "react-router";
import type { MouseEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { formatShortDate } from "@/lib/date-format";
import { CATEGORY_LABEL_MAP } from "@contracts/constants";
import { createPostSummary } from "@contracts/post-title";
import { Calendar, Eye, Heart, Loader2, MapPin } from "lucide-react";
import type { Post, User } from "@db/schema";

type PostCardData = Post & {
  author: Pick<User, "id" | "publicId" | "name" | "avatar" | "role" | "level" | "createdAt"> | null;
  weeklyLikeCount?: number;
  likeCount?: number;
  likedByMe?: boolean;
};

interface PostCardProps {
  post: PostCardData;
  hideMeta?: boolean;
}

export default function PostCard({ post, hideMeta }: PostCardProps) {
  const utils = trpc.useUtils();
  const { isAuthenticated } = useAuth();
  const categoryLabel = CATEGORY_LABEL_MAP[post.category as keyof typeof CATEGORY_LABEL_MAP] || post.category;
  const images = post.images && Array.isArray(post.images) ? post.images.filter(Boolean) : [];
  const coverImage = post.coverImage || images[0] || "";
  const displayTitle = post.title.trim() || createPostSummary(post.content);
  const weeklyLikeCount = post.weeklyLikeCount ?? post.likeCount ?? 0;
  const showLikeButton = isAuthenticated && !hideMeta && !post.skyGalleryCategory;
  const toggleLike = trpc.post.toggleLike.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.post.list.invalidate(),
        utils.post.byId.invalidate({ id: post.id }),
        utils.post.featured.invalidate(),
        utils.post.byTag.invalidate(),
        utils.post.search.invalidate(),
      ]);
    },
  });

  const handleLikeClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (post.likedByMe || toggleLike.isPending) return;
    toggleLike.mutate({ postId: post.id });
  };

  return (
    <Link
      to={`/post/${post.id}`}
      className="group block focus-visible:rounded-xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <article className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-card transition-all duration-300 ease-out-quart hover:-translate-y-0.5 hover:shadow-card-hover">
        {coverImage ? (
          <div className="overflow-hidden bg-muted">
            <img
              src={coverImage}
              alt={post.title || "内容封面"}
              loading="lazy"
              width={640}
              className="h-auto w-full object-cover transition-transform duration-500 ease-out-quart group-hover:scale-[1.015]"
            />
          </div>
        ) : (
          <div className="flex aspect-[4/3] items-center justify-center bg-gradient-to-br from-primary/10 via-primary/5 to-background">
            <span className="px-4 text-center text-2xl font-bold text-primary/20">{categoryLabel}</span>
          </div>
        )}

        <div className="p-3.5">
          {!hideMeta && (
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="bg-primary/8 text-primary transition-colors hover:bg-primary/12">
                {categoryLabel}
              </Badge>
              {post.isArticle && (
                <Badge variant="outline" className="border-amber-200/60 text-amber-600 transition-colors hover:bg-amber-50/50">
                  文章
                </Badge>
              )}
              {post.isSkyExplanation && (
                <Badge variant="outline" className="border-purple-200/60 text-purple-600 transition-colors hover:bg-purple-50/50">
                  天象解说图
                </Badge>
              )}
              {post.hasLocation && post.region && (
                <Badge variant="outline" className="flex items-center gap-0.5 border-emerald-200/60 text-emerald-600 transition-colors hover:bg-emerald-50/50">
                  <MapPin className="h-3 w-3" />
                  {post.region}
                </Badge>
              )}
            </div>
          )}

          <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-card-foreground transition-colors duration-200 group-hover:text-primary">
            {displayTitle}
          </h3>

          {!hideMeta && (
            <div className="mt-3 flex items-center justify-between gap-3 text-xs text-muted-foreground">
              <div className="flex min-w-0 items-center gap-2">
                <Avatar className="h-5 w-5 flex-shrink-0 border border-border/50">
                  <AvatarImage src={post.author?.avatar || undefined} />
                  <AvatarFallback className="bg-muted text-[10px] text-muted-foreground">
                    {(post.author?.name || "用户").slice(0, 1)}
                  </AvatarFallback>
                </Avatar>
                <span className="max-w-[88px] truncate">{post.author?.name || "匿名"}</span>
              </div>

              <div className="flex flex-shrink-0 items-center gap-2 tabular-nums sm:gap-3">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3 flex-shrink-0" />
                  {formatShortDate(post.createdAt)}
                </span>
                <span className="flex items-center gap-1">
                  <Eye className="h-3 w-3 flex-shrink-0" />
                  {post.viewCount}
                </span>
                {showLikeButton ? (
                  <button
                    type="button"
                    aria-label={post.likedByMe ? "已点赞" : "点赞"}
                    aria-pressed={Boolean(post.likedByMe)}
                    onClick={handleLikeClick}
                    disabled={post.likedByMe || toggleLike.isPending}
                    className={`inline-flex h-8 min-w-[4.5rem] items-center justify-center gap-1 rounded-full border px-2 text-xs font-medium transition-colors ${
                      post.likedByMe
                        ? "cursor-default border-red-200 bg-red-50 text-red-600"
                        : "border-border bg-background text-muted-foreground hover:border-red-200 hover:text-red-600"
                    }`}
                  >
                    {toggleLike.isPending ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Heart className={`h-3 w-3 ${post.likedByMe ? "fill-current" : ""}`} />
                    )}
                    {weeklyLikeCount}
                  </button>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </article>
    </Link>
  );
}
