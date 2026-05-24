import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink } from "@trpc/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import superjson from "superjson";
import type { AppRouter } from "../../api/router";
import type { ReactNode } from "react";

export const trpc = createTRPCReact<AppRouter>();

const queryClient = new QueryClient();
const TRPC_TIMEOUT_MS = 30000;

async function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), TRPC_TIMEOUT_MS);
  const abortFromParent = () => controller.abort();

  if (init?.signal) {
    if (init.signal.aborted) controller.abort();
    else init.signal.addEventListener("abort", abortFromParent, { once: true });
  }

  try {
    return await globalThis.fetch(input, {
      ...(init ?? {}),
      credentials: "include",
      signal: controller.signal,
    });
  } finally {
    window.clearTimeout(timeoutId);
    init?.signal?.removeEventListener("abort", abortFromParent);
  }
}

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      fetch(input, init) {
        return fetchWithTimeout(input, init);
      },
    }),
  ],
});

export function TRPCProvider({ children }: { children: ReactNode }) {
  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </trpc.Provider>
  );
}
