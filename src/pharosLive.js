const NETWORKS = {
  "pharos-mainnet": {
    name: "pharos-mainnet",
    aliases: ["mainnet", "pharos"],
    rpcUrl: "https://rpc.pharos.xyz",
    chainId: 1672,
    explorerUrl: "https://www.pharosscan.xyz",
    nativeToken: "PROS"
  },
  "pharos-atlantic-testnet": {
    name: "pharos-atlantic-testnet",
    aliases: ["atlantic-testnet", "testnet", "atlantic"],
    rpcUrl: "https://atlantic.dplabs-internal.com",
    chainId: 688689,
    explorerUrl: "https://atlantic.pharosscan.xyz",
    nativeToken: "PHRS"
  }
};

function normalizeNetwork(input = "pharos-mainnet") {
  const value = String(input).toLowerCase();
  const direct = NETWORKS[value];
  if (direct) return direct;

  const match = Object.values(NETWORKS).find(network => network.aliases.includes(value));
  if (!match) {
    throw new Error(`Unsupported network "${input}". Use pharos-mainnet or pharos-atlantic-testnet.`);
  }

  return match;
}

function assertAddress(address) {
  if (!/^0x[a-fA-F0-9]{40}$/.test(address || "")) {
    throw new Error(`Invalid EVM address: ${address}`);
  }
}

function hexToNumber(hex) {
  return Number.parseInt(hex || "0x0", 16);
}

function formatEther(hexWei) {
  const wei = BigInt(hexWei || "0x0");
  const scale = 10n ** 18n;
  const whole = wei / scale;
  const fraction = wei % scale;
  const fractionText = fraction.toString().padStart(18, "0").slice(0, 6).replace(/0+$/, "");
  return fractionText ? `${whole}.${fractionText}` : whole.toString();
}

async function rpc(network, method, params = []) {
  const response = await fetch(network.rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: Date.now(),
      method,
      params
    })
  });

  if (!response.ok) {
    throw new Error(`RPC ${method} failed with HTTP ${response.status}`);
  }

  const payload = await response.json();
  if (payload.error) {
    throw new Error(`RPC ${method} failed: ${payload.error.message || JSON.stringify(payload.error)}`);
  }

  return payload.result;
}

export async function fetchLivePharosProfile({ address, network = "pharos-mainnet", label }) {
  assertAddress(address);
  const chain = normalizeNetwork(network);
  const [chainIdHex, latestBlockHex, balanceHex, nonceHex, code] = await Promise.all([
    rpc(chain, "eth_chainId"),
    rpc(chain, "eth_blockNumber"),
    rpc(chain, "eth_getBalance", [address, "latest"]),
    rpc(chain, "eth_getTransactionCount", [address, "latest"]),
    rpc(chain, "eth_getCode", [address, "latest"])
  ]);

  const observedChainId = hexToNumber(chainIdHex);
  if (observedChainId !== chain.chainId) {
    throw new Error(`RPC chain ID mismatch: expected ${chain.chainId}, got ${observedChainId}`);
  }

  const transactionCount = hexToNumber(nonceHex);
  const nativeBalance = formatEther(balanceHex);
  const nativeBalanceNumber = Number(nativeBalance);
  const contractCodePresent = Boolean(code && code !== "0x");

  return {
    address,
    label: label || `Live ${chain.name} address`,
    type: contractCodePresent ? "protocol" : "wallet",
    network: chain.name,
    liveDataMode: true,
    walletAgeDays: undefined,
    transactionCount,
    pharosInteractions: transactionCount,
    stablecoinBalanceUsd: 0,
    averageBalanceUsd90d: 0,
    escrowsCompleted: 0,
    escrowsDisputed: 0,
    repaymentsOnTime: 0,
    repaymentsLate: 0,
    defaults: 0,
    rwaProtocolInteractions: 0,
    complianceAttestations: 0,
    mixerInteractions: 0,
    sanctionsHit: false,
    contractCodePresent,
    nativeBalance,
    nativeToken: chain.nativeToken,
    latestBlock: hexToNumber(latestBlockHex),
    explorerUrl: `${chain.explorerUrl}/address/${address}`,
    dataSources: ["pharos-json-rpc-live"],
    lastUpdatedHoursAgo: 0,
    observedSignals: {
      scope: "public-rpc",
      nativeBalance: true,
      transactionCount: true,
      contractCode: true,
      txOutcomes: false,
      escrowHistory: false,
      deliveryHistory: false,
      repaymentHistory: false,
      rwaHistory: false,
      contractRisk: false,
      protocolRisk: false,
      bridgeRisk: false,
      compliance: false
    },
    rawLiveSignals: {
      rpcUrl: chain.rpcUrl,
      chainId: observedChainId,
      latestBlock: hexToNumber(latestBlockHex),
      nonce: transactionCount,
      nativeBalance,
      nativeToken: chain.nativeToken,
      nativeBalancePositive: nativeBalanceNumber > 0,
      contractCodePresent
    }
  };
}

export { NETWORKS };

