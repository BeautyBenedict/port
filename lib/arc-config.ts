// lib/arc-config.ts
import { defineChain } from "viem";

export const RPC_URL = "https://rpc.testnet.arc.network";

export const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: [RPC_URL] },
    public:  { http: [RPC_URL] },
  },
  blockExplorers: {
    default: {
      name: "Arc Explorer",
      url: "https://explorer.testnet.arc.thecanteenapp.com",
    },
  },
  testnet: true,
});

export const CONTRACTS = {
  USDC:   "0x3600000000000000000000000000000000000000" as `0x${string}`,
  USYC:   "0xe9185F0c5F296Ed1797AaE4238D26CCaBEadb86C" as `0x${string}`,
  TELLER: "0x9fdF14c5B14173D74C08Af27AebFf39240dC105A" as `0x${string}`,
  // Port Registry — deployed on Arc Testnet by Beauty Benedict
  // Records every wallet analysis on-chain, proves Arc integration
  PORT_REGISTRY: "0xdF9F8686a989b407E8ce20eFa123F54Dc6E03547" as `0x${string}`,
} as const;

// Port Registry ABI — minimal interface
export const PORT_REGISTRY_ABI = [
  {
    name: "recordAnalysis",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  {
    name: "lastAnalyzed",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "wallet", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "analysisCount",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "wallet", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "WalletAnalyzed",
    type: "event",
    inputs: [
      { name: "wallet", type: "address", indexed: true },
      { name: "timestamp", type: "uint256", indexed: false },
    ],
  },
] as const;

export const NETWORK_DETAILS = {
  networkName: "Arc Testnet",
  chainId: "5042002",
  rpcUrl: RPC_URL,
  symbol: "ETH",
  explorer: "https://explorer.testnet.arc.thecanteenapp.com",
} as const;

export const TOKENS = {
  USDC: { symbol: "USDC", decimals: 6, address: CONTRACTS.USDC },
  USYC: { symbol: "USYC", decimals: 6, address: CONTRACTS.USYC },
} as const;
