import { useLayoutEffect, useRef } from "react";
import { useLocation } from "react-router";

const LIST_PAGE_PREFIXES = [
  "/",
  "/category/",
  "/region/",
  "/sky-events",
  "/sky-gallery",
  "/sky-explanation",
  "/featured",
  "/tag/",
  "/search",
];

function isListPage(path: string): boolean {
  if (path === "/") return true;
  return LIST_PAGE_PREFIXES.some((p) => p !== "/" && path.startsWith(p));
}

function isTopPage(path: string): boolean {
  if (path.startsWith("/post/")) return true;
  if (path.startsWith("/profile/")) return true;
  if (path === "/create") return true;
  if (path === "/login") return true;
  if (path === "/register") return true;
  if (path === "/weekly-sky") return true;
  if (path === "/about") return true;
  return false;
}

export default function ScrollManager() {
  const { pathname, search } = useLocation();
  const routeKey = `${pathname}${search}`;
  const prevPathRef = useRef(pathname);
  const prevRouteKeyRef = useRef(routeKey);
  const scrollYRef = useRef(0);

  // Track current scroll position continuously
  useLayoutEffect(() => {
    const handleScroll = () => {
      scrollYRef.current = window.scrollY;
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Handle route change scroll behavior synchronously before paint
  useLayoutEffect(() => {
    const prevPath = prevPathRef.current;
    const prevRouteKey = prevRouteKeyRef.current;
    prevPathRef.current = pathname;
    prevRouteKeyRef.current = routeKey;

    const wasListPage = isListPage(prevPath);
    const isListPageNow = isListPage(pathname);
    const isTopPageNow = isTopPage(pathname);

    // Disable smooth scrolling via CSS to guarantee instant jumps
    const html = document.documentElement;
    const originalBehavior = html.style.scrollBehavior;
    html.style.scrollBehavior = "auto";

    let targetY = 0;
    let shouldLock = false;

    if (wasListPage && isTopPageNow) {
      // List page -> detail/create/profile/auth: save list position
      sessionStorage.setItem(`scroll:${prevRouteKey}`, String(scrollYRef.current));
      targetY = 0;
      shouldLock = true;
    } else if (isTopPageNow) {
      // Any other -> top page: scroll to top
      targetY = 0;
      shouldLock = true;
    } else if (isListPageNow) {
      // Any page -> list page: restore saved position if available
      const saved = sessionStorage.getItem(`scroll:${routeKey}`);
      if (saved) {
        targetY = parseInt(saved, 10);
        sessionStorage.removeItem(`scroll:${routeKey}`);
      } else {
        targetY = 0;
      }
    }

    // Apply immediately
    window.scrollTo(0, targetY);

    // For top pages, aggressively lock scroll to top for a short period
    // to prevent any layout shift or browser default behavior from moving it
    let frameId = 0;
    let timeoutId: ReturnType<typeof setTimeout>;

    if (shouldLock) {
      const lockScroll = () => {
        if (window.scrollY !== 0) {
          window.scrollTo(0, 0);
        }
        frameId = requestAnimationFrame(lockScroll);
      };
      frameId = requestAnimationFrame(lockScroll);

      timeoutId = setTimeout(() => {
        cancelAnimationFrame(frameId);
        html.style.scrollBehavior = originalBehavior;
      }, 100);
    } else {
      // For list pages, also give a brief window to settle before restoring smooth
      timeoutId = setTimeout(() => {
        html.style.scrollBehavior = originalBehavior;
      }, 50);
    }

    return () => {
      cancelAnimationFrame(frameId);
      clearTimeout(timeoutId);
      html.style.scrollBehavior = originalBehavior;
    };
  }, [pathname, routeKey]);

  return null;
}
