import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router";
import { trpc } from "@/providers/trpc";
import PostCard from "@/components/PostCard";
import MasonryGrid, { MasonryItem } from "@/components/MasonryGrid";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search,
  Flame,
  Clock,
  Target,
  Loader2,
  X,
} from "lucide-react";

const SORT_OPTIONS = [
  { value: "relevance" as const, label: "匹配度", icon: Target },
  { value: "time" as const, label: "最新", icon: Clock },
  { value: "hot" as const, label: "热度", icon: Flame },
];

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQ = searchParams.get("q") || "";
  const initialSort = (searchParams.get("sort") as "relevance" | "time" | "hot") || "relevance";

  const [query, setQuery] = useState(initialQ);
  const [inputValue, setInputValue] = useState(initialQ);
  const [sort, setSort] = useState<"relevance" | "time" | "hot">(initialSort);

  const { data, isLoading, isFetching } = trpc.post.search.useQuery(
    { keyword: query, sort, limit: 24, offset: 0 },
    { enabled: query.trim().length > 0 }
  );

  const handleSearch = useCallback(() => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    setQuery(trimmed);
    setSearchParams({ q: trimmed, sort });
  }, [inputValue, sort, setSearchParams]);

  const handleSortChange = useCallback(
    (newSort: "relevance" | "time" | "hot") => {
      setSort(newSort);
      if (query.trim()) {
        setSearchParams({ q: query, sort: newSort });
      }
    },
    [query, setSearchParams]
  );

  // Sync with URL changes
  useEffect(() => {
    const q = searchParams.get("q") || "";
    const s = (searchParams.get("sort") as "relevance" | "time" | "hot") || "relevance";
    if (q !== query) {
      setQuery(q);
      setInputValue(q);
    }
    if (s !== sort) {
      setSort(s);
    }
  }, [searchParams]);

  // Enter key to search
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  const hasSearched = query.trim().length > 0;

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground mb-5">搜索</h1>

          {/* Search Input */}
          <div className="flex gap-2 max-w-xl">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜索标题、正文、标签…"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                className="pl-9 pr-9 bg-background"
                spellCheck={false}
              />
              {inputValue && (
                <button
                  onClick={() => {
                    setInputValue("");
                    setQuery("");
                    setSearchParams({});
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <Button
              onClick={handleSearch}
              disabled={!inputValue.trim() || isFetching}
              className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-soft transition-all duration-200 active:scale-[0.98]"
            >
              {isFetching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Sort Options */}
        {hasSearched && (
          <div className="flex items-center gap-2 mb-6">
            <span className="text-sm text-muted-foreground mr-1">排序：</span>
            {SORT_OPTIONS.map((option) => {
              const Icon = option.icon;
              const isActive = sort === option.value;
              return (
                <button
                  key={option.value}
                  onClick={() => handleSortChange(option.value)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 focus-visible:ring-2 focus-visible:ring-ring ${
                    isActive
                      ? "bg-primary/10 text-primary shadow-soft"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {option.label}
                </button>
              );
            })}
            {data !== undefined && (
              <span className="text-sm text-muted-foreground ml-auto">
                共 {data.total} 条结果
              </span>
            )}
          </div>
        )}

        {/* Results */}
        {isLoading && hasSearched ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="aspect-[16/10] rounded-xl" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        ) : hasSearched ? (
          data && data.posts.length > 0 ? (
            <MasonryGrid className="stagger-children">
              {data.posts.map((post) => (
                <MasonryItem key={post.id}>
                  <PostCard post={post} />
                </MasonryItem>
              ))}
            </MasonryGrid>
          ) : (
            <div className="text-center py-16 text-muted-foreground">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
                <Search className="h-8 w-8 text-muted-foreground/40" />
              </div>
              <p className="text-lg font-medium mb-1">未找到相关内容</p>
              <p className="text-sm">尝试其他关键词，或检查输入是否正确</p>
            </div>
          )
        ) : (
          <div className="text-center py-16 text-muted-foreground">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
              <Search className="h-8 w-8 text-muted-foreground/40" />
            </div>
            <p className="text-lg font-medium mb-1">输入关键词开始搜索</p>
            <p className="text-sm">支持搜索标题、正文内容和标签</p>
          </div>
        )}
      </div>
    </div>
  );
}
