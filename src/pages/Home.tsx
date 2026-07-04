import { Link, useNavigate } from "react-router";
import { trpc } from "@/providers/trpc";
import PostCard from "@/components/PostCard";
import MasonryGrid, { MasonryItem } from "@/components/MasonryGrid";
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Star,
  ChevronLeft,
  ChevronRight,
  Cloud,
  ArrowRight,
} from "lucide-react";

export default function Home() {
  const { data: featuredPosts, isLoading: featuredLoading } = trpc.post.featured.useQuery({ limit: 10 });
  const { data: latestPosts, isLoading: latestLoading } = trpc.post.list.useQuery({ limit: 8, offset: 0 });
  const navigate = useNavigate();

  const carouselPosts = featuredPosts?.filter(
    (post) => post.images && Array.isArray(post.images) && post.images.length > 0
  ) || [];

  const [currentIndex, setCurrentIndex] = useState(0);

  const nextSlide = useCallback(() => {
    if (carouselPosts.length === 0) return;
    setCurrentIndex((prev) => (prev + 1) % carouselPosts.length);
  }, [carouselPosts.length]);

  const prevSlide = useCallback(() => {
    if (carouselPosts.length === 0) return;
    setCurrentIndex((prev) => (prev - 1 + carouselPosts.length) % carouselPosts.length);
  }, [carouselPosts.length]);

  useEffect(() => {
    if (carouselPosts.length <= 1) return;
    const timer = setInterval(nextSlide, 5000);
    return () => clearInterval(timer);
  }, [carouselPosts.length, nextSlide]);

  useEffect(() => {
    setCurrentIndex((index) => {
      if (carouselPosts.length === 0) return 0;
      return Math.min(index, carouselPosts.length - 1);
    });
  }, [carouselPosts.length]);

  const currentPost = carouselPosts[currentIndex];

  return (
    <div className="min-h-screen flex flex-col">
      {/* Hero Carousel */}
      <section className="relative w-full h-[420px] md:h-[600px] lg:h-[660px] overflow-hidden bg-slate-900">
        {featuredLoading ? (
          <div className="flex items-center justify-center h-full">
            <Skeleton className="h-full w-full absolute inset-0" />
            <div className="relative z-10 flex flex-col items-center gap-4">
              <Skeleton className="h-8 w-48 rounded-full" />
              <Skeleton className="h-12 w-72 md:w-96" />
            </div>
          </div>
        ) : carouselPosts.length > 0 ? (
          <>
            {/* Slides */}
            {carouselPosts.map((post, idx) => {
              const imageUrl = post.images?.[0] || "";
              return (
                <div
                  key={post.id}
                  className={`absolute inset-0 transition-opacity duration-1000 ease-out-quart ${
                    idx === currentIndex ? "opacity-100 z-10" : "opacity-0 z-0"
                  }`}
                >
                  <button
                    type="button"
                    className="group absolute inset-0 cursor-pointer overflow-hidden border-0 bg-transparent p-0 text-left"
                    onClick={() => navigate(`/post/${post.id}`)}
                    aria-label={`查看精选：${post.title}`}
                  >
                    <img
                      src={imageUrl}
                      alt=""
                      className="absolute inset-0 h-full w-full scale-110 object-cover blur-2xl opacity-70"
                      loading={idx === 0 ? "eager" : "lazy"}
                    />
                    <img
                      src={imageUrl}
                      alt={post.title}
                      className="relative z-10 h-full w-full object-contain transition-transform duration-1000 ease-out motion-safe:group-hover:scale-[1.01]"
                      loading={idx === 0 ? "eager" : "lazy"}
                    />
                  </button>
                  <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/25 to-black/45" />
                </div>
              );
            })}

            {currentPost && (
              <div className="absolute inset-x-0 bottom-14 z-20 flex justify-center px-4 pointer-events-none md:bottom-16">
                <Link
                  to={`/post/${currentPost.id}`}
                  className="pointer-events-auto inline-flex max-w-[min(92vw,520px)] items-center gap-2 rounded-full bg-white/15 backdrop-blur-md border border-white/10 px-5 py-2.5 text-sm font-medium text-white hover:bg-white/25 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
                >
                  <span className="truncate">
                    查看精选：{currentPost.title.slice(0, 24)}
                    {currentPost.title.length > 24 ? "…" : ""}
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0" />
                </Link>
              </div>
            )}

            {/* Navigation arrows */}
            {carouselPosts.length > 1 && (
              <>
                <button
                  onClick={prevSlide}
                  className="absolute left-4 top-1/2 z-30 -translate-y-1/2 p-2.5 rounded-full bg-black/30 text-white hover:bg-black/50 transition-all duration-200 hover:scale-110 focus-visible:ring-2 focus-visible:ring-white/50"
                  aria-label="上一张"
                >
                  <ChevronLeft className="h-6 w-6" />
                </button>
                <button
                  onClick={nextSlide}
                  className="absolute right-4 top-1/2 z-30 -translate-y-1/2 p-2.5 rounded-full bg-black/30 text-white hover:bg-black/50 transition-all duration-200 hover:scale-110 focus-visible:ring-2 focus-visible:ring-white/50"
                  aria-label="下一张"
                >
                  <ChevronRight className="h-6 w-6" />
                </button>
              </>
            )}

            {/* Dots indicator */}
            {carouselPosts.length > 1 && (
              <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2">
                {carouselPosts.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentIndex(idx)}
                    className={`h-2 rounded-full transition-all duration-300 ${
                      idx === currentIndex
                        ? "w-7 bg-white"
                        : "w-2 bg-white/40 hover:bg-white/60"
                    }`}
                    aria-label={`切换到第 ${idx + 1} 张`}
                  />
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="relative h-full bg-gradient-to-br from-sky-600 to-indigo-700" />
        )}
      </section>

      {/* Featured Posts */}
      <section className="w-full py-14 md:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-xl md:text-2xl font-bold text-foreground flex items-center gap-2">
              <Star className="h-5 w-5 text-amber-500 fill-amber-500" />
              精选内容
            </h2>
            <Link to="/featured">
              <Button variant="ghost" className="text-primary hover:text-primary hover:bg-primary/5">
                查看更多
                <ArrowRight className="h-4 w-4 ml-1 transition-transform group-hover:translate-x-0.5" />
              </Button>
            </Link>
          </div>

          {featuredLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="space-y-3">
                  <Skeleton className="aspect-[16/10] rounded-xl" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              ))}
            </div>
          ) : featuredPosts && featuredPosts.length > 0 ? (
            <MasonryGrid className="stagger-children">
              {featuredPosts.map((post) => (
                <MasonryItem key={post.id}>
                  <PostCard post={post} />
                </MasonryItem>
              ))}
            </MasonryGrid>
          ) : (
            <div className="text-center py-16 text-muted-foreground">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
                <Star className="h-8 w-8 text-muted-foreground/40" />
              </div>
              <p className="text-lg font-medium mb-1">暂无精选内容</p>
              <p className="text-sm">精彩的天象记录即将呈现</p>
            </div>
          )}
        </div>
      </section>

      {/* Latest Posts */}
      <section className="w-full py-14 md:py-20 bg-gradient-to-b from-muted/40 to-background">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-xl md:text-2xl font-bold text-foreground flex items-center gap-2">
              <Cloud className="h-5 w-5 text-primary" />
              最新发布
            </h2>
          </div>

          {latestLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="space-y-3">
                  <Skeleton className="aspect-[16/10] rounded-xl" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              ))}
            </div>
          ) : latestPosts && latestPosts.length > 0 ? (
            <MasonryGrid className="stagger-children">
              {latestPosts.map((post) => (
                <MasonryItem key={post.id}>
                  <PostCard post={post} />
                </MasonryItem>
              ))}
            </MasonryGrid>
          ) : (
            <div className="text-center py-16 text-muted-foreground">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
                <Cloud className="h-8 w-8 text-muted-foreground/40" />
              </div>
              <p className="text-lg font-medium mb-1">暂无内容</p>
              <p className="text-sm">快来发布第一条天象记录吧！</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
