"use client";

import { useState } from "react";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RainbowKitProvider, getDefaultConfig, darkTheme } from "@rainbow-me/rainbowkit";
import { http } from "wagmi";
import { arcTestnet } from "@/lib/arc-config";
import "@rainbow-me/rainbowkit/styles.css";

const projectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ||
  "e1763b03c3b8a9e3d7e942aebf206b4d";

export function Providers({ children }: { children: React.ReactNode }) {
  // Both config and queryClient inside useState so they are created
  // exactly once per client session — this prevents the hydration warning
  // caused by wagmi internals running during SSR with different state
  const [config] = useState(() =>
    getDefaultConfig({
      chains: [arcTestnet],
      transports: {
        [arcTestnet.id]: http(arcTestnet.rpcUrls.default.http[0]),
      },
      projectId,
      appName: "Port",
      appDescription: "Your Personal AI Trade Copier on Arc Testnet",
      appIcon: "/logo.png",
    })
  );

  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: 2, staleTime: 10_000 },
        },
      })
  );

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={darkTheme({
            accentColor: "#3b82f6",
            accentColorForeground: "white",
            borderRadius: "medium",
          })}
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
