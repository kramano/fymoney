import { farcasterFrame } from "@farcaster/frame-wagmi-connector";
import { http } from "viem";
import { baseSepolia } from "viem/chains";
import { createConfig } from "wagmi";

export const config = createConfig({
  chains: [baseSepolia],
  connectors: [farcasterFrame()],
  multiInjectedProviderDiscovery: false,
  transports: {
    [baseSepolia.id]: http(),
  },
});

declare module "wagmi" {
  interface Register {
    config: typeof config;
  }
}
