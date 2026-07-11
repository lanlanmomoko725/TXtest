import { ChevronLeft, ChevronRight, ChevronUp, Maximize2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import Lightbox from "./Lightbox";

interface ImageGalleryProps {
  images: string[];
  alt?: string;
  clickable?: boolean;
}

const GRID_PREVIEW_LIMIT = 9;

function getGridColumns(imageCount: number) {
  return imageCount === 2 || imageCount === 4 ? "grid-cols-2" : "grid-cols-3";
}

export default function ImageGallery({ images, alt = "图片", clickable = true }: ImageGalleryProps) {
  const validImages = useMemo(() => images.filter(Boolean), [images]);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const selectedThumbnailRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (currentIndex >= validImages.length) {
      setCurrentIndex(Math.max(validImages.length - 1, 0));
    }
  }, [currentIndex, validImages.length]);

  useEffect(() => {
    if (!expanded) return;
    selectedThumbnailRef.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [currentIndex, expanded]);

  if (validImages.length === 0) return null;

  const gridImages = validImages.slice(0, GRID_PREVIEW_LIMIT);
  const hiddenCount = Math.max(validImages.length - GRID_PREVIEW_LIMIT, 0);
  const currentImage = validImages[currentIndex] ?? validImages[0];

  const expandImage = (index: number) => {
    if (!clickable) return;
    setCurrentIndex(index);
    setExpanded(true);
  };

  return (
    <>
      <div className="space-y-3">
        {expanded ? (
          <section className="space-y-3 animate-fade-in" aria-label="图片展开查看">
            <div className="flex min-h-11 items-center justify-between gap-3 text-sm text-muted-foreground">
              <div className="flex items-center gap-1 sm:gap-2">
                <button
                  type="button"
                  onClick={() => setExpanded(false)}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-md px-2.5 transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring sm:px-3"
                >
                  <ChevronUp className="h-4 w-4" />
                  收起
                </button>
                <button
                  type="button"
                  onClick={() => setLightboxOpen(true)}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-md px-2.5 transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring sm:px-3"
                >
                  <Maximize2 className="h-4 w-4" />
                  查看大图
                </button>
              </div>
              <span className="shrink-0 tabular-nums" aria-live="polite">
                {currentIndex + 1} / {validImages.length}
              </span>
            </div>

            <div className="flex w-full justify-center">
              <div className="relative inline-flex max-w-full items-center justify-center">
                <img
                  src={currentImage}
                  alt={`${alt} 第 ${currentIndex + 1} 张`}
                  loading="lazy"
                  className="block h-auto max-h-[min(72dvh,720px)] w-auto max-w-full rounded-lg object-contain"
                />
                {currentIndex > 0 && (
                  <button
                    type="button"
                    onClick={() => setCurrentIndex((index) => index - 1)}
                    aria-label="上一张图片"
                    className="absolute left-2 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm transition-colors hover:bg-black/65 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2"
                  >
                    <ChevronLeft className="h-6 w-6" />
                  </button>
                )}
                {currentIndex < validImages.length - 1 && (
                  <button
                    type="button"
                    onClick={() => setCurrentIndex((index) => index + 1)}
                    aria-label="下一张图片"
                    className="absolute right-2 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm transition-colors hover:bg-black/65 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2"
                  >
                    <ChevronRight className="h-6 w-6" />
                  </button>
                )}
              </div>
            </div>

            {validImages.length > 1 && (
              <div className="flex max-w-full gap-2 overflow-x-auto pb-1 scrollbar-thin" aria-label="图片缩略图">
                {validImages.map((image, index) => {
                  const selected = index === currentIndex;
                  return (
                    <button
                      key={`${image}-${index}`}
                      ref={selected ? selectedThumbnailRef : null}
                      type="button"
                      onClick={() => setCurrentIndex(index)}
                      aria-label={`切换到第 ${index + 1} 张图片`}
                      aria-pressed={selected}
                      className={`relative h-16 w-16 flex-none overflow-hidden rounded-md border transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                        selected
                          ? "border-primary ring-2 ring-primary/20"
                          : "border-border/70 opacity-75 hover:border-primary/60 hover:opacity-100"
                      }`}
                    >
                      <img src={image} alt="" loading="lazy" className="h-full w-full object-cover" />
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        ) : validImages.length === 1 ? (
          <div className="max-w-[520px]">
            <button
              type="button"
              disabled={!clickable}
              onClick={() => expandImage(0)}
              aria-label="展开图片"
              className={`group relative inline-flex max-h-[420px] max-w-full overflow-hidden rounded-lg align-top focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                clickable ? "cursor-zoom-in" : "cursor-default"
              }`}
            >
              <img
                src={validImages[0]}
                alt={alt}
                loading="lazy"
                className="block h-auto max-h-[420px] w-auto max-w-full object-contain transition-transform duration-200 group-hover:scale-[1.01]"
              />
            </button>
          </div>
        ) : (
          <div
            className={`grid w-full max-w-[640px] gap-1 ${getGridColumns(validImages.length)}`}
            aria-label={`共 ${validImages.length} 张图片`}
          >
            {gridImages.map((image, index) => {
              const isOverflowTile = index === GRID_PREVIEW_LIMIT - 1 && hiddenCount > 0;
              const label = isOverflowTile
                ? `展开第 ${index + 1} 张图片，另有 ${hiddenCount} 张图片`
                : `展开第 ${index + 1} 张图片`;

              return (
                <button
                  key={`${image}-${index}`}
                  type="button"
                  disabled={!clickable}
                  onClick={() => expandImage(index)}
                  aria-label={label}
                  className={`group relative aspect-square min-w-0 overflow-hidden rounded-md bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                    clickable ? "cursor-zoom-in active:scale-[0.99]" : "cursor-default"
                  }`}
                >
                  <img
                    src={image}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
                  />
                  {isOverflowTile && (
                    <span className="absolute inset-0 flex items-center justify-center bg-black/45 text-2xl font-semibold text-white" aria-hidden="true">
                      +{hiddenCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <Lightbox
        images={validImages}
        currentIndex={currentIndex}
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        onNavigate={setCurrentIndex}
      />
    </>
  );
}
