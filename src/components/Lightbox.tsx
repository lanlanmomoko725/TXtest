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
  const [slideDir, setSlideDir] = useState<"left" | "right" | null>(null);
  const [isExiting, setIsExiting] = useState(false);
  const clickBlocked = useRef(false);

  // Internal close with exit animation
  const handleClose = useCallback(() => {
    setIsExiting(true);
    setTimeout(() => {
      setIsExiting(false);
      onClose();
    }, 250);
  }, [onClose]);

  // Reset exiting state when opened
  useEffect(() => {
    if (isOpen) {
      setIsExiting(false);
      setSlideDir(null);
      resetView();
    }
  }, [isOpen]);

  const resetView = useCallback(() => {
    setScale(1);
    setPanX(0);
    setPanY(0);
  }, []);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      setSlideDir("left");
      resetView();
      onNavigate(currentIndex - 1);
    }
  }, [currentIndex, onNavigate, resetView]);

  const handleNext = useCallback(() => {
    if (currentIndex < images.length - 1) {
      setSlideDir("right");
      resetView();
      onNavigate(currentIndex + 1);
    }
  }, [currentIndex, images.length, onNavigate, resetView]);

  const handleZoomIn = useCallback(() => {
    setScale((s) => Math.min(s + 0.5, 4));
  }, []);

  const handleZoomOut = useCallback(() => {
    setScale((s) => {
      const next = Math.max(s - 0.5, 0.5);
      if (next <= 1) {
        setPanX(0);
        setPanY(0);
      }
      return next;
    });
  }, []);

  // Keyboard support
  useEffect(() => {
    if (!isOpen || isExiting) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
      if (e.key === "ArrowLeft") handlePrev();
      if (e.key === "ArrowRight") handleNext();
      if (e.key === "+" || e.key === "=") handleZoomIn();
      if (e.key === "-") handleZoomOut();
      if (e.key === "0") resetView();
    };

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, isExiting, handleClose, handlePrev, handleNext, handleZoomIn, handleZoomOut, resetView]);

  // Wheel zoom with Ctrl/Cmd
  useEffect(() => {
    if (!isOpen || isExiting) return;
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
  }, [isOpen, isExiting]);

  // =====================
  // Touch handling (entire lightbox area)
  // =====================
  const touchState = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    lastX: number;
    lastY: number;
    startTime: number;
    isPanning: boolean;
    touchedImage: boolean;
  }>({
    active: false,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
    startTime: 0,
    isPanning: false,
    touchedImage: false,
  });

  const onTouchStartRoot = useCallback((e: React.TouchEvent) => {
    const t = e.touches[0];
    const target = e.target as HTMLElement;
    // Detect if touch started on the image itself
    const isImage = target.tagName === "IMG" || target.closest("img") !== null;
    touchState.current = {
      active: true,
      startX: t.clientX,
      startY: t.clientY,
      lastX: t.clientX,
      lastY: t.clientY,
      startTime: Date.now(),
      isPanning: false,
      touchedImage: isImage,
    };
  }, []);

  const onTouchMoveRoot = useCallback((e: React.TouchEvent) => {
    if (!touchState.current.active) return;
    const t = e.touches[0];
    const state = touchState.current;
    const dx = t.clientX - state.lastX;
    const dy = t.clientY - state.lastY;

    if (Math.abs(t.clientX - state.startX) > 5 || Math.abs(t.clientY - state.startY) > 5) {
      state.isPanning = true;
    }

    if (state.isPanning) {
      e.preventDefault();
    }

    if (scale > 1) {
      setPanX((prev) => prev + dx);
      setPanY((prev) => prev + dy);
    }

    state.lastX = t.clientX;
    state.lastY = t.clientY;
  }, [scale]);

  const onTouchEndRoot = useCallback((e: React.TouchEvent) => {
    const state = touchState.current;
    if (!state.active) return;
    state.active = false;

    const totalDx = state.lastX - state.startX;
    const totalDy = state.lastY - state.startY;
    const duration = Date.now() - state.startTime;
    const distance = Math.hypot(totalDx, totalDy);

    // Tap to close — only on background, not on image
    if (distance < 12 && duration < 300 && !state.isPanning) {
      if (!state.touchedImage) {
        e.preventDefault();
        // Block the subsequent ghost click
        clickBlocked.current = true;
        setTimeout(() => {
          clickBlocked.current = false;
        }, 500);
        handleClose();
      }
      return;
    }

    // Swipe to navigate (only when not zoomed)
    if (scale <= 1 && Math.abs(totalDx) > 40 && Math.abs(totalDx) > Math.abs(totalDy)) {
      if (totalDx > 0 && currentIndex > 0) {
        handlePrev();
      } else if (totalDx < 0 && currentIndex < images.length - 1) {
        handleNext();
      }
    }
  }, [scale, currentIndex, images.length, handlePrev, handleNext, handleClose]);

  // =====================
  // Mouse drag handling (image area only)
  // =====================
  const [isMouseDragging, setIsMouseDragging] = useState(false);
  const mouseState = useRef({ startX: 0, startY: 0, lastX: 0, lastY: 0 });

  const onMouseDownImg = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    mouseState.current = {
      startX: e.clientX,
      startY: e.clientY,
      lastX: e.clientX,
      lastY: e.clientY,
    };
    setIsMouseDragging(true);
  }, []);

  const onMouseMoveImg = useCallback((e: React.MouseEvent) => {
    if (!isMouseDragging) return;
    const dx = e.clientX - mouseState.current.lastX;
    const dy = e.clientY - mouseState.current.lastY;

    if (scale > 1) {
      setPanX((prev) => prev + dx);
      setPanY((prev) => prev + dy);
    }

    mouseState.current.lastX = e.clientX;
    mouseState.current.lastY = e.clientY;
  }, [isMouseDragging, scale]);

  const onMouseUpImg = useCallback(() => {
    if (!isMouseDragging) return;
    setIsMouseDragging(false);

    const dx = mouseState.current.lastX - mouseState.current.startX;
    if (scale <= 1 && Math.abs(dx) > 40) {
      if (dx > 0 && currentIndex > 0) {
        handlePrev();
      } else if (dx < 0 && currentIndex < images.length - 1) {
        handleNext();
      }
    }
  }, [isMouseDragging, scale, currentIndex, handlePrev, handleNext]);

  // Global mouse up
  useEffect(() => {
    if (!isMouseDragging) return;
    const handleGlobalMouseUp = () => onMouseUpImg();
    document.addEventListener("mouseup", handleGlobalMouseUp);
    return () => document.removeEventListener("mouseup", handleGlobalMouseUp);
  }, [isMouseDragging, onMouseUpImg]);

  if (!isOpen && !isExiting) return null;

  const canZoomIn = scale < 4;
  const canZoomOut = scale > 0.5;
  const isZoomed = scale !== 1 || panX !== 0 || panY !== 0;

  // Determine image entrance animation
  const imageAnimationClass = isExiting
    ? ""
    : slideDir === "left"
    ? "animate-lightbox-slide-left"
    : slideDir === "right"
    ? "animate-lightbox-slide-right"
    : "animate-scale-in";

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-md touch-none ${
        isExiting ? "animate-fade-out pointer-events-none" : "animate-fade-in"
      }`}
      onTouchStart={onTouchStartRoot}
      onTouchMove={onTouchMoveRoot}
      onTouchEnd={onTouchEndRoot}
      onClick={(e) => {
        if (clickBlocked.current) return;
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      {/* Close button */}
      <button
        onClick={handleClose}
        onTouchStart={(e) => e.stopPropagation()}
        className="absolute top-4 right-4 z-20 p-2.5 rounded-full bg-white/10 text-white hover:bg-white/20 transition-all duration-200 hover:scale-110 focus-visible:ring-2 focus-visible:ring-white/50"
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
          onTouchStart={(e) => e.stopPropagation()}
          className="absolute left-4 top-1/2 -translate-y-1/2 z-20 p-2.5 rounded-full bg-white/10 text-white hover:bg-white/20 transition-all duration-200 hover:scale-110 focus-visible:ring-2 focus-visible:ring-white/50"
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
          onTouchStart={(e) => e.stopPropagation()}
          className="absolute right-4 top-1/2 -translate-y-1/2 z-20 p-2.5 rounded-full bg-white/10 text-white hover:bg-white/20 transition-all duration-200 hover:scale-110 focus-visible:ring-2 focus-visible:ring-white/50"
          aria-label="下一张"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      )}

      {/* Image container with transition animation */}
      <div
        className="relative w-full h-full flex items-center justify-center select-none z-10"
        onMouseDown={onMouseDownImg}
        onMouseMove={onMouseMoveImg}
        onMouseUp={onMouseUpImg}
        onMouseLeave={onMouseUpImg}
        style={{ cursor: isMouseDragging ? "grabbing" : scale > 1 ? "grab" : "default" }}
      >
        <div key={currentIndex} className={`${imageAnimationClass} flex items-center justify-center`}>
          <img
            src={images[currentIndex]}
            alt={`图片 ${currentIndex + 1}`}
            className="max-w-[90vw] max-h-[85vh] w-auto h-auto object-contain rounded-lg shadow-elevated pointer-events-none"
            style={{
              transform: `translate(${panX}px, ${panY}px) scale(${scale})`,
              transition: isMouseDragging ? "none" : "transform 0.15s ease-out",
            }}
            draggable={false}
          />
        </div>
      </div>

      {/* Zoom Controls */}
      <div
        className="absolute bottom-14 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2"
        onTouchStart={(e) => e.stopPropagation()}
      >
        <button
          onClick={handleZoomOut}
          disabled={!canZoomOut}
          className="p-2.5 rounded-full bg-white/10 text-white hover:bg-white/20 transition-all duration-200 hover:scale-110 focus-visible:ring-2 focus-visible:ring-white/50 disabled:opacity-30 disabled:hover:scale-100 disabled:cursor-not-allowed"
          aria-label="缩小"
          title="缩小"
        >
          <ZoomOut className="h-5 w-5" />
        </button>
        <button
          onClick={resetView}
          disabled={!isZoomed}
          className="px-3 py-2 rounded-full bg-white/10 text-white text-xs font-medium hover:bg-white/20 transition-all duration-200 focus-visible:ring-2 focus-visible:ring-white/50 disabled:opacity-30 disabled:hover:scale-100 disabled:cursor-not-allowed"
          aria-label="适应界面"
          title="适应界面"
        >
          <Maximize className="h-4 w-4 inline mr-1" />
          {Math.round(scale * 100)}%
        </button>
        <button
          onClick={handleZoomIn}
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
        <div
          className="absolute bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-2 z-20"
          onTouchStart={(e) => e.stopPropagation()}
        >
          {images.map((_, idx) => (
            <button
              key={idx}
              onClick={(e) => {
                e.stopPropagation();
                resetView();
                if (idx > currentIndex) setSlideDir("right");
                else if (idx < currentIndex) setSlideDir("left");
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
