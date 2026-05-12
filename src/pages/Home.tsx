import { Link, useNavigate } from "react-router";
import { trpc } from "@/providers/trpc";
import PostCard from "@/components/PostCard";
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
  Star,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Cloud,
  ArrowRight,
} from "lucide-react";

export default function Home() {
  const { data: featuredPosts, isLoading: featuredLoading } = trpc.post.featured.useQuery({ limit: 10 });
  const { data: latestPosts, isLoading: latestLoading } = trpc.post.list.useQuery({ limit: 8, offset: 0 });
  const navigate = useNavigate();

  // Filter featured posts that have images
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

  // Auto-play
  useEffect(() => {
    if (carouselPosts.length <= 1) return;
    const timer = setInterval(nextSlide, 5000);
    return () => clearInterval(timer);
  }, [carouselPosts.length, nextSlide]);

  const currentPost = carouselPosts[currentIndex];

  return (
    <div className="min-h-screen flex flex-col">
      {/* Hero Carousel */}
      <section className="relative w-full h-[420px] md:h-[520px] overflow-hidden bg-slate-900">
        {featuredLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-10 w-10 animate-spin text-white/70" />
          </div>
        ) : carouselPosts.length > 0 ? (
          <>
            {/* Slides */}
            {carouselPosts.map((post, idx) => {
              const imageUrl = post.images?.[0] || "";
              return (
                <div
                  key={post.id}
                  className={`absolute inset-0 transition-opacity duration-1000 ${
                    idx === currentIndex ? "opacity-100 z-10" : "opacity-0 z-0"
                  }`}
                >
                  <div
                    className="absolute inset-0 bg-cover bg-center cursor-pointer"
                    style={{ backgroundImage: `url(${imageUrl})` }}
                    onClick={() => navigate(`/post/${post.id}`)}
                  />
                  {/* Dark overlay */}
                  <div className="absolute inset-0 bg-black/40" />
                </div>
              );
            })}

            {/* Text overlay */}
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center text-center px-4 pointer-events-none">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/20 backdrop-blur px-4 py-1.5 text-sm font-medium text-white mb-5">
                <Sparkles className="h-4 w-4" />
                天象爱好者社区
              </div>
              <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-white mb-4">
                记录天空的每一种奇迹
              </h1>
              {currentPost && (
                <div className="mt-6 pointer-events-auto">
                  <Link
                    to={`/post/${currentPost.id}`}
                    className="inline-flex items-center gap-2 rounded-full bg-white/20 backdrop-blur px-5 py-2 text-sm font-medium text-white hover:bg-white/30 transition-colors"
                  >
                    查看精选：{currentPost.title.slice(0, 20)}
                    {currentPost.title.length > 20 ? "..." : ""}
                  </Link>
                </div>
              )}
            </div>

            {/* Navigation arrows */}
            {carouselPosts.length > 1 && (
              <>
                <button
                  onClick={prevSlide}
                  className="absolute bottom-16 left-4 md:top-1/2 md:-translate-y-1/2 md:bottom-auto z-30 p-2 rounded-full bg-black/30 text-white hover:bg-black/50 transition-colors"
                  aria-label="上一张"
                >
                  <ChevronLeft className="h-6 w-6" />
                </button>
                <button
                  onClick={nextSlide}
                  className="absolute bottom-16 right-4 md:top-1/2 md:-translate-y-1/2 md:bottom-auto z-30 p-2 rounded-full bg-black/30 text-white hover:bg-black/50 transition-colors"
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
                    className={`h-2 rounded-full transition-all ${
                      idx === currentIndex
                        ? "w-6 bg-white"
                        : "w-2 bg-white/50 hover:bg-white/70"
                    }`}
                    aria-label={`切换到第 ${idx + 1} 张`}
                  />
                ))}
              </div>
            )}
          </>
        ) : (
          /* Fallback when no featured posts with images */
          <div className="relative h-full bg-gradient-to-br from-sky-600 to-indigo-700">
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/20 backdrop-blur px-4 py-1.5 text-sm font-medium text-white mb-5">
                <Sparkles className="h-4 w-4" />
                天象爱好者社区
              </div>
              <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-white mb-4">
                记录天空的每一种奇迹
              </h1>
            </div>
          </div>
        )}
      </section>

      {/* Featured Posts */}
      <section className="w-full py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Star className="h-5 w-5 text-amber-500" />
              精选内容
            </h2>
            <Link to="/featured">
              <Button variant="ghost" className="text-sky-600 hover:text-sky-700 hover:bg-sky-50">
                查看更多
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </div>

          {featuredLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-sky-600" />
            </div>
          ) : featuredPosts && featuredPosts.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {featuredPosts.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-slate-400">
              <Star className="h-12 w-12 mx-auto mb-3 text-slate-300" />
              <p>暂无精选内容</p>
            </div>
          )}
        </div>
      </section>

      {/* Latest Posts */}
      <section className="w-full py-12 bg-slate-50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Cloud className="h-5 w-5 text-sky-600" />
              最新发布
            </h2>
          </div>

          {latestLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-sky-600" />
            </div>
          ) : latestPosts && latestPosts.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {latestPosts.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-slate-400">
              <Cloud className="h-12 w-12 mx-auto mb-3 text-slate-300" />
              <p>暂无内容，快来发布第一条天象记录吧！</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
