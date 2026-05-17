import { useEffect, useCallback, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, X, ZoomIn, ZoomOut, Maximize } from "lucide-react";

interface LightboxProps {
  images: string[];
  currentIndex: number;
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (index: number) => void;
}

export default function Lightbox({
  images,
  currentIndex,
  isOpen,
  onClose,
  onNavigate,
}: LightboxProps) {
  const [scale, setScale] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      setScale(1);
      setPanX(0);
      setPanY(0);
      onNavigate(currentIndex - 1);
    }
  }, [currentIndex, onNavigate]);

  const handleNext = useCallback(() => {
    if (currentIndex < images.length - 1) {
      setScale(1);
      setPanX(0);
      setPanY(0);
      onNavigate(currentIndex + 1);
    }
  }, [currentIndex, images.length, onNavigate]);

  const handleZoomIn = useCallback(() => {
    setScale((s) => Math.min(s + 0.5, 4));
  }, []);

  const handleZoomOut = useCallback(() => {
    setScale((s) => {
      const next = Math.max(s - 0.5, 0.5);
      if (next === 1) {
        setPanX(0);
        setPanY(0);
      }
      return next;
    });
  }, []);

  const handleResetZoom = useCallback(() => {
    setScale(1);
    setPanX(0);
    setPanY(0);
  }, []);

  // Swipe / drag state
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartX = useRef(0);
  const dragStartY = useRef(0);
  const dragCurrentX = useRef(0);
  const dragCurrentY = useRef(0);
  const SWIPE_THRESHOLD = 50;

  // Reset zoom when opening
  useEffect(() => {
    if (isOpen) {
      setScale(1);
      setPanX(0);
      setPanY(0);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") handlePrev();
      if (e.key === "ArrowRight") handleNext();
      if (e.key === "+" || e.key === "=") handleZoomIn();
      if (e.key === "-") handleZoomOut();
      if (e.key === "0") handleResetZoom();
    };

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose, handlePrev, handleNext, handleZoomIn, handleZoomOut, handleResetZoom]);

  // Touch handlers
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    dragStartX.current = e.touches[0].clientX;
    dragStartY.current = e.touches[0].clientY;
    dragCurrentX.current = e.touches[0].clientX;
    dragCurrentY.current = e.touches[0].clientY;
    setIsDragging(true);
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging) return;
    const x = e.touches[0].clientX;
    const y = e.touches[0].clientY;
    dragCurrentX.current = x;
    dragCurrentY.current = y;

    if (scale > 1) {
      // Pan mode
      setPanX((prev) => prev + (x - dragStartX.current) * 0.1);
      setPanY((prev) => prev + (y - dragStartY.current) * 0.1);
      dragStartX.current = x;
      dragStartY.current = y;
    }
  }, [isDragging, scale]);

  const onTouchEnd = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);

    if (scale <= 1) {
      const offset = dragCurrentX.current - dragStartX.current;
      if (Math.abs(offset) > SWIPE_THRESHOLD) {
        if (offset > 0 && currentIndex > 0) {
          handlePrev();
        } else if (offset < 0 && currentIndex < images.length - 1) {
          handleNext();
        }
      }
    }
  }, [isDragging, scale, currentIndex, images.length, handlePrev, handleNext]);

  // Mouse handlers (for desktop drag)
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    dragStartX.current = e.clientX;
    dragStartY.current = e.clientY;
    dragCurrentX.current = e.clientX;
    dragCurrentY.current = e.clientY;
    setIsDragging(true);
  }, []);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    const x = e.clientX;
    const y = e.clientY;
    dragCurrentX.current = x;
    dragCurrentY.current = y;

    if (scale > 1) {
      setPanX((prev) => prev + (x - dragStartX.current) * 0.1);
      setPanY((prev) => prev + (y - dragStartY.current) * 0.1);
      dragStartX.current = x;
      dragStartY.current = y;
    }
  }, [isDragging, scale]);

  const onMouseUp = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);

    if (scale <= 1) {
      const offset = dragCurrentX.current - dragStartX.current;
      if (Math.abs(offset) > SWIPE_THRESHOLD) {
        if (offset > 0 && currentIndex > 0) {
          handlePrev();
        } else if (offset < 0 && currentIndex < images.length - 1) {
          handleNext();
        }
      }
    }
  }, [isDragging, scale, currentIndex, images.length, handlePrev, handleNext]);

  // Global mouse up (in case user releases outside the image)
  useEffect(() => {
    if (!isDragging) return;
    const handleGlobalMouseUp = () => onMouseUp();
    document.addEventListener("mouseup", handleGlobalMouseUp);
    return () => document.removeEventListener("mouseup", handleGlobalMouseUp);
  }, [isDragging, onMouseUp]);

  // Wheel zoom
  useEffect(() => {
    if (!isOpen) return;
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        if (e.deltaY < 0) {
          setScale((s) => Math.min(s + 0.2, 4));
        } else {
          setScale((s) => {
            const next = Math.max(s - 0.2, 0.5);
            if (next <= 1) {
              setPanX(0);
              setPanY(0);
            }
            return next;
          });
        }
      }
    };
    document.addEventListener("wheel", handleWheel, { passive: false });
    return () => document.removeEventListener("wheel", handleWheel);
  }, [isOpen]);

  if (!isOpen) return null;

  const canZoomIn = scale < 4;
  const canZoomOut = scale > 0.5;
  const isZoomed = scale !== 1 || panX !== 0 || panY !== 0;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-md animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 p-2.5 rounded-full bg-white/10 text-white hover:bg-white/20 transition-all duration-200 hover:scale-110 focus-visible:ring-2 focus-visible:ring-white/50"
        aria-label="关闭"
      >
        <X className="h-5 w-5" />
      </button>

      {/* Prev button */}
      {currentIndex > 0 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handlePrev();
          }}
          className="absolute left-4 top-1/2 -translate-y-1/2 z-10 p-2.5 rounded-full bg-white/10 text-white hover:bg-white/20 transition-all duration-200 hover:scale-110 focus-visible:ring-2 focus-visible:ring-white/50"
          aria-label="上一张"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
      )}

      {/* Next button */}
      {currentIndex < images.length - 1 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleNext();
          }}
          className="absolute right-4 top-1/2 -translate-y-1/2 z-10 p-2.5 rounded-full bg-white/10 text-white hover:bg-white/20 transition-all duration-200 hover:scale-110 focus-visible:ring-2 focus-visible:ring-white/50"
          aria-label="下一张"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      )}

      {/* Image container with swipe/drag/zoom support */}
      <div
        ref={containerRef}
        className="relative max-w-[90vw] max-h-[85vh] w-auto h-auto select-none"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        style={{ cursor: isDragging ? "grabbing" : scale > 1 ? "grab" : "default" }}
      >
        <img
          src={images[currentIndex]}
          alt={`图片 ${currentIndex + 1}`}
          className="max-w-[90vw] max-h-[85vh] w-auto h-auto object-contain rounded-lg shadow-elevated"
          style={{
            transform: `translate(${panX}px, ${panY}px) scale(${scale})`,
            transition: isDragging ? "none" : "transform 0.2s ease-out",
          }}
          draggable={false}
        />
      </div>

      {/* Zoom Controls */}
      <div className="absolute bottom-14 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleZoomOut();
          }}
          disabled={!canZoomOut}
          className="p-2.5 rounded-full bg-white/10 text-white hover:bg-white/20 transition-all duration-200 hover:scale-110 focus-visible:ring-2 focus-visible:ring-white/50 disabled:opacity-30 disabled:hover:scale-100 disabled:cursor-not-allowed"
          aria-label="缩小"
          title="缩小"
        >
          <ZoomOut className="h-5 w-5" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleResetZoom();
          }}
          disabled={!isZoomed}
          className="px-3 py-2 rounded-full bg-white/10 text-white text-xs font-medium hover:bg-white/20 transition-all duration-200 focus-visible:ring-2 focus-visible:ring-white/50 disabled:opacity-30 disabled:hover:scale-100 disabled:cursor-not-allowed"
          aria-label="适应界面"
          title="适应界面"
        >
          <Maximize className="h-4 w-4 inline mr-1" />
          {Math.round(scale * 100)}%
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleZoomIn();
          }}
          disabled={!canZoomIn}
          className="p-2.5 rounded-full bg-white/10 text-white hover:bg-white/20 transition-all duration-200 hover:scale-110 focus-visible:ring-2 focus-visible:ring-white/50 disabled:opacity-30 disabled:hover:scale-100 disabled:cursor-not-allowed"
          aria-label="放大"
          title="放大"
        >
          <ZoomIn className="h-5 w-5" />
        </button>
      </div>

      {/* Dots indicator */}
      {images.length > 1 && (
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-2">
          {images.map((_, idx) => (
            <button
              key={idx}
              onClick={(e) => {
                e.stopPropagation();
                setScale(1);
                setPanX(0);
                setPanY(0);
                onNavigate(idx);
              }}
              className={`h-2 rounded-full transition-all duration-300 ${
                idx === currentIndex
                  ? "w-6 bg-white"
                  : "w-2 bg-white/40 hover:bg-white/60"
              }`}
              aria-label={`切换到第 ${idx + 1} 张`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
