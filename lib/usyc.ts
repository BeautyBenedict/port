// lib/usyc.ts
// On-chain interactions with USYC Teller — with safe previews and error handling

import { formatUnits, createPublicClient, http } from "viem";
import type { PublicClient, WalletClient } from "viem";
import { CONTRACTS, TOKENS, arcTestnet, RPC_URL } from "./arc-config";

// ─── ABIs ─────────────────────────────────────────────────────────────────────

export const ERC20_ABI = [
  { name: "balanceOf", type: "function", stateMutability: "view",
    inputs: [{ name: "account", type: "address" }], outputs: [{ name: "", type: "uint256" }] },
  { name: "approve", type: "function", stateMutability: "nonpayable",
    inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }],
    outputs: [{ name: "", type: "bool" }] },
  { name: "allowance", type: "function", stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }],
    outputs: [{ name: "", type: "uint256" }] },
] as const;

export const TELLER_ABI = [
  { name: "deposit", type: "function", stateMutability: "nonpayable",
    inputs: [
      { name: "depositAsset", type: "address" },
      { name: "depositAmount", type: "uint256" },
      { name: "minimumMint", type: "uint256" },
    ],
    outputs: [{ name: "shares", type: "uint256" }] },
  { name: "bulkWithdraw", type: "function", stateMutability: "nonpayable",
    inputs: [
      { name: "withdrawAsset", type: "address" },
      { name: "shareAmount", type: "uint256" },
      { name: "minimumAssets", type: "uint256" },
      { name: "to", type: "address" },
    ],
    outputs: [{ name: "assetsOut", type: "uint256" }] },
  { name: "previewDeposit", type: "function", stateMutability: "view",
    inputs: [{ name: "depositAsset", type: "address" }, { name: "depositAmount", type: "uint256" }],
    outputs: [{ name: "shares", type: "uint256" }] },
  { name: "previewRedeem", type: "function", stateMutability: "view",
    inputs: [{ name: "withdrawAsset", type: "address" }, { name: "shareAmount", type: "uint256" }],
    outputs: [{ name: "assets", type: "uint256" }] },
] as const;

// ─── Get a reliable public client ────────────────────────────────────────────

export function getPublicClient(): PublicClient {
  return createPublicClient({
    chain: arcTestnet,
    transport: http(RPC_URL, { retryCount: 3, retryDelay: 1000 }),
  }) as PublicClient;
}

// ─── Fetch balances ───────────────────────────────────────────────────────────

export interface Balances {
  usdc: bigint;
  usyc: bigint;
  usdcFormatted: string;
  usycFormatted: string;
  totalUsd: number;
  usdcPct: number;
  usycPct: number;
}

export async function fetchBalances(address: `0x${string}`): Promise<Balances> {
  const client = getPublicClient();

  const [usdc, usyc] = await Promise.all([
    client.readContract({ address: CONTRACTS.USDC, abi: ERC20_ABI, functionName: "balanceOf", args: [address] }),
    client.readContract({ address: CONTRACTS.USYC, abi: ERC20_ABI, functionName: "balanceOf", args: [address] }),
  ]);

  const usdcNum = parseFloat(formatUnits(usdc, TOKENS.USDC.decimals));
  const usycNum = parseFloat(formatUnits(usyc, TOKENS.USYC.decimals));
  const total = usdcNum + usycNum;

  return {
    usdc, usyc,
    usdcFormatted: usdcNum.toFixed(2),
    usycFormatted: usycNum.toFixed(2),
    totalUsd: total,
    usdcPct: total > 0 ? (usdcNum / total) * 100 : 100,
    usycPct: total > 0 ? (usycNum / total) * 100 : 0,
  };
}

// ─── Deposit USDC → USYC ─────────────────────────────────────────────────────

export async function depositUsdc(
  client: PublicClient,
  wallet: WalletClient,
  address: `0x${string}`,
  usdcAmount: bigint,
): Promise<`0x${string}`> {
  // 1. Safe preview — if it fails, throw early with a clear message
  let expectedShares: bigint;
  try {
    expectedShares = await client.readContract({
      address: CONTRACTS.TELLER, abi: TELLER_ABI,
      functionName: "previewDeposit",
      args: [CONTRACTS.USDC, usdcAmount],
    });
  } catch {
    throw new Error("Teller previewDeposit failed — contract may not support this asset or amount");
  }

  if (expectedShares === 0n) throw new Error("previewDeposit returned 0 shares — amount too small");

  const minimumMint = (expectedShares * 9950n) / 10000n; // 0.5% slippage

  // 2. Approve if needed
  const allowance = await client.readContract({
    address: CONTRACTS.USDC, abi: ERC20_ABI,
    functionName: "allowance", args: [address, CONTRACTS.TELLER],
  });
  if (allowance < usdcAmount) {
    const approveTx = await wallet.writeContract({
      address: CONTRACTS.USDC, abi: ERC20_ABI,
      functionName: "approve", args: [CONTRACTS.TELLER, usdcAmount],
      account: address,
    });
    await client.waitForTransactionReceipt({ hash: approveTx });
  }

  // 3. Deposit
  return wallet.writeContract({
    address: CONTRACTS.TELLER, abi: TELLER_ABI,
    functionName: "deposit",
    args: [CONTRACTS.USDC, usdcAmount, minimumMint],
    account: address,
  });
}

// ─── Redeem USYC → USDC ──────────────────────────────────────────────────────

export async function redeemUsyc(
  client: PublicClient,
  wallet: WalletClient,
  address: `0x${string}`,
  usycAmount: bigint,
): Promise<`0x${string}`> {
  // 1. Safe preview
  let expectedAssets: bigint;
  try {
    expectedAssets = await client.readContract({
      address: CONTRACTS.TELLER, abi: TELLER_ABI,
      functionName: "previewRedeem",
      args: [CONTRACTS.USDC, usycAmount],
    });
  } catch {
    throw new Error("Teller previewRedeem failed — contract may not support redemption at this time");
  }

  if (expectedAssets === 0n) throw new Error("previewRedeem returned 0 — amount too small");

  const minimumAssets = (expectedAssets * 9950n) / 10000n;

  return wallet.writeContract({
    address: CONTRACTS.TELLER, abi: TELLER_ABI,
    functionName: "bulkWithdraw",
    args: [CONTRACTS.USDC, usycAmount, minimumAssets, address],
    account: address,
  });
}