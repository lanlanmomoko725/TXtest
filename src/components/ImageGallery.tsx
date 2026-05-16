import { useState } from "react";
import Lightbox from "./Lightbox";

interface ImageGalleryProps {
  images: string[];
  alt?: string;
  clickable?: boolean;
  maxImages?: number;
}

export default function ImageGallery({ images, alt = "图片", clickable = true, maxImages }: ImageGalleryProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  const validImages = images.filter(Boolean);
  if (validImages.length === 0) return null;

  // Single image
  if (validImages.length === 1) {
    return (
      <div className="overflow-hidden rounded-lg">
        <img
          src={validImages[0]}
          alt={alt}
          loading="lazy"
          width={800}
          height={600}
          className={`w-full max-h-[50vh] sm:max-h-[70vh] object-contain transition-transform duration-300 ${clickable ? "cursor-pointer hover:scale-[1.01]" : ""}`}
          onClick={clickable ? (e) => {
            e.stopPropagation();
            e.preventDefault();
            setCurrentIndex(0);
            setLightboxOpen(true);
          } : undefined}
        />
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

  // Multi-image: card preview caps at maxImages with "+N"; detail shows all
  const capped = typeof maxImages === "number" && validImages.length > maxImages;
  const displayImages = capped ? validImages.slice(0, maxImages) : validImages;
  const remaining = capped ? validImages.length - maxImages! : 0;

  return (
    <>
      <div className="grid grid-cols-3 gap-1.5">
        {displayImages.map((img, idx) => {
          const isLastPreview = capped && idx === maxImages! - 1 && remaining > 0;
          return clickable ? (
          <button
            key={idx}
            className="relative aspect-square overflow-hidden rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              setCurrentIndex(idx);
              setLightboxOpen(true);
            }}
          >
            <img
              src={img}
              alt={`${alt} ${idx + 1}`}
              loading={idx < 3 ? "eager" : "lazy"}
              width={300}
              height={300}
              className="w-full h-full object-cover transition-transform duration-300 hover:scale-[1.03]"
            />
            {isLastPreview && (
              <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center text-white text-lg font-bold rounded-md">
                +{remaining}
              </div>
            )}
          </button>
          ) : (
          <div
            key={idx}
            className="relative aspect-square overflow-hidden rounded-md"
          >
            <img
              src={img}
              alt={`${alt} ${idx + 1}`}
              loading="lazy"
              width={300}
              height={300}
              className="w-full h-full object-cover"
            />
            {isLastPreview && (
              <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center text-white text-lg font-bold rounded-md">
                +{remaining}
              </div>
            )}
          </div>
          );
        })}
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
