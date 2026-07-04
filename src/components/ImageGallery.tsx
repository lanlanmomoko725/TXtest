import { useEffect, useMemo, useState } from "react";
import Lightbox from "./Lightbox";

interface ImageGalleryProps {
  images: string[];
  alt?: string;
  clickable?: boolean;
  maxImages?: number;
}

export default function ImageGallery({ images, alt = "图片", clickable = true, maxImages }: ImageGalleryProps) {
  const validImages = useMemo(() => images.filter(Boolean), [images]);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (currentIndex >= validImages.length) {
      setCurrentIndex(Math.max(validImages.length - 1, 0));
    }
  }, [currentIndex, validImages.length]);

  if (validImages.length === 0) return null;

  const previewImages = typeof maxImages === "number" ? validImages.slice(0, maxImages) : validImages;
  const remaining = validImages.length - previewImages.length;
  const currentImage = validImages[currentIndex] ?? validImages[0];

  const openLightbox = (index: number) => {
    if (!clickable) return;
    setCurrentIndex(index);
    setLightboxOpen(true);
  };

  return (
    <div className="space-y-3">
      <button
        type="button"
        disabled={!clickable}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          openLightbox(currentIndex);
        }}
        className={`relative block w-full overflow-hidden rounded-xl bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
          clickable ? "cursor-zoom-in" : "cursor-default"
        }`}
      >
        <img
          src={currentImage}
          alt={alt}
          loading="lazy"
          width={960}
          className="mx-auto max-h-[72vh] w-full object-contain"
        />
        {validImages.length > 1 && (
          <span className="absolute right-3 top-3 rounded-full bg-black/55 px-2.5 py-1 text-xs font-medium text-white backdrop-blur">
            {currentIndex + 1} / {validImages.length}
          </span>
        )}
      </button>

      {validImages.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin" aria-label="图片缩略图">
          {previewImages.map((image, index) => {
            const selected = index === currentIndex;
            const isLastPreview = remaining > 0 && index === previewImages.length - 1;
            return (
              <button
                key={`${image}-${index}`}
                type="button"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setCurrentIndex(index);
                }}
                onDoubleClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  openLightbox(index);
                }}
                aria-label={`查看第 ${index + 1} 张图片`}
                aria-pressed={selected}
                className={`relative h-16 w-16 flex-none overflow-hidden rounded-lg border transition-all duration-200 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                  selected ? "border-primary ring-2 ring-primary/20" : "border-border/70 hover:border-primary/50"
                }`}
              >
                <img src={image} alt="" loading="lazy" className="h-full w-full object-cover" />
                {isLastPreview && (
                  <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-sm font-semibold text-white">
                    +{remaining}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      <Lightbox
        images={validImages}
        currentIndex={currentIndex}
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        onNavigate={setCurrentIndex}
      />
    </div>
  );
}
