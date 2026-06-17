const NETWORKS = {
  "pharos-mainnet": {
    name: "pharos-mainnet",
    aliases: ["mainnet", "pharos"],
    rpcUrl: "https://rpc.pharos.xyz",
    rpcUrls: [
      "https://rpc.pharos.xyz",
      "https://pharos-mainnet.g.alchemy.com/v2/docs-demo"
    ],
    chainId: 1672,
    explorerUrl: "https://www.pharosscan.xyz",
    nativeToken: "PROS"
  },
  "pharos-atlantic-testnet": {
    name: "pharos-atlantic-testnet",
    aliases: ["atlantic-testnet", "testnet", "atlantic"],
    rpcUrl: "https://atlantic.dplabs-internal.com",
    rpcUrls: ["https://atlantic.dplabs-internal.com"],
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

async function rpcUrl(url, method, params = []) {
  const response = await fetch(url, {
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

async function rpc(network, method, params = []) {
  const urls = network.rpcUrls || [network.rpcUrl];
  const errors = [];

  for (const url of urls) {
    try {
      const result = await rpcUrl(url, method, params);
      return { result, rpcUrl: url };
    } catch (error) {
      errors.push(`${url}: ${error.message}`);
    }
  }

  throw new Error(`All RPC endpoints failed for ${method}. ${errors.join(" | ")}`);
}

// Clearing House escrow deployments — lets the bureau read a counterparty's real
// settlement track record (cross-skill, on-chain) as a reliability signal.
// `fromBlock` is the deploy block so the windowed log scan starts there.
const CLEARING_HOUSE = {
  "pharos-atlantic-testnet": { address: "0xdE52Ac56708C05FE1f8F69D8074A543FAcB1Faab", fromBlock: 24395700 }
};
const SETTLEMENT_TOPICS = {
  funded: "0xc9fda89aca7290e340d170bc48c9c40e615fbfb0e662ef8986e1637827bfb2ab",
  released: "0x6244ed823ca6be0f11bc890c3fafcf3c29cb23420c14243642e930b5e07e6d0a",
  refunded: "0xeac97bc1917fcedc984e3d0671d4e83b359890323d5d1c2de32b28d17c356ced"
};
const LOG_WINDOW = 1000;     // most Pharos RPCs cap eth_getLogs at 1000 blocks
const MAX_LOOKBACK = 25000;  // bound the scan for a responsive credit lookup
const addressFromTopic = topic => `0x${String(topic).slice(-40)}`.toLowerCase();

// Tally how many escrows this address completed vs had refunded after a timeout,
// straight from Clearing House on-chain events, paging in block windows.
async function fetchSettlementHistory(chain, address, escrow) {
  const a = address.toLowerCase();
  const latest = hexToNumber((await rpc(chain, "eth_blockNumber")).result);
  const from = Math.max(escrow.fromBlock || 0, latest - MAX_LOOKBACK);
  const funded = [], released = [], refunded = [];

  for (let start = from; start <= latest; start += LOG_WINDOW) {
    const win = { address: escrow.address, fromBlock: `0x${start.toString(16)}`, toBlock: `0x${Math.min(start + LOG_WINDOW - 1, latest).toString(16)}` };
    const [f, r, x] = await Promise.all([
      rpc(chain, "eth_getLogs", [{ ...win, topics: [SETTLEMENT_TOPICS.funded] }]).catch(() => ({ result: [] })),
      rpc(chain, "eth_getLogs", [{ ...win, topics: [SETTLEMENT_TOPICS.released] }]).catch(() => ({ result: [] })),
      rpc(chain, "eth_getLogs", [{ ...win, topics: [SETTLEMENT_TOPICS.refunded] }]).catch(() => ({ result: [] }))
    ]);
    funded.push(...(f.result || []));
    released.push(...(r.result || []));
    refunded.push(...(x.result || []));
  }

  const parties = new Map();
  for (const log of funded) {
    parties.set(log.topics[1], { payer: addressFromTopic(log.topics[2]), payee: addressFromTopic(log.topics[3]) });
  }
  const involvesAddress = id => {
    const p = parties.get(id);
    return Boolean(p) && (p.payer === a || p.payee === a);
  };

  const completed = released.map(l => l.topics[1]).filter(involvesAddress).length;
  const disputed = refunded.map(l => l.topics[1]).filter(involvesAddress).length;
  const participations = [...parties.values()].filter(p => p.payer === a || p.payee === a).length;
  return { escrowAddress: escrow.address, completed, disputed, participations, scannedFromBlock: from, scannedToBlock: latest };
}

export async function fetchLivePharosProfile({ address, network = "pharos-mainnet", label, rpcUrl, escrowAddress }) {
  assertAddress(address);
  const baseChain = normalizeNetwork(network);
  const chain = rpcUrl
    ? {
        ...baseChain,
        rpcUrl,
        rpcUrls: [rpcUrl, ...(baseChain.rpcUrls || []).filter(url => url !== rpcUrl)]
      }
    : baseChain;
  const [chainIdHex, latestBlockHex, balanceHex, nonceHex, code] = await Promise.all([
    rpc(chain, "eth_chainId"),
    rpc(chain, "eth_blockNumber"),
    rpc(chain, "eth_getBalance", [address, "latest"]),
    rpc(chain, "eth_getTransactionCount", [address, "latest"]),
    rpc(chain, "eth_getCode", [address, "latest"])
  ]);

  const observedChainId = hexToNumber(chainIdHex.result);
  if (observedChainId !== chain.chainId) {
    throw new Error(`RPC chain ID mismatch: expected ${chain.chainId}, got ${observedChainId}`);
  }

  const transactionCount = hexToNumber(nonceHex.result);
  const nativeBalance = formatEther(balanceHex.result);
  const nativeBalanceNumber = Number(nativeBalance);
  const contractCodePresent = Boolean(code.result && code.result !== "0x");
  const usedRpcUrls = [...new Set([
    chainIdHex.rpcUrl,
    latestBlockHex.rpcUrl,
    balanceHex.rpcUrl,
    nonceHex.rpcUrl,
    code.rpcUrl
  ])];

  const profile = {
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
    latestBlock: hexToNumber(latestBlockHex.result),
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
      primaryRpcUrl: chain.rpcUrl,
      usedRpcUrls,
      fallbackUsed: usedRpcUrls.some(url => url !== chain.rpcUrl),
      chainId: observedChainId,
      latestBlock: hexToNumber(latestBlockHex.result),
      nonce: transactionCount,
      nativeBalance,
      nativeToken: chain.nativeToken,
      nativeBalancePositive: nativeBalanceNumber > 0,
      contractCodePresent
    }
  };

  // Cross-skill credit signal: pull this address's real settlement history from
  // the Clearing House escrow on the same network. Completed escrows raise the
  // reliability factor; timed-out refunds count against it.
  const clearingHouse = escrowAddress ? { address: escrowAddress } : CLEARING_HOUSE[chain.name];
  if (clearingHouse) {
    try {
      const settlement = await fetchSettlementHistory(chain, address, clearingHouse);
      if (settlement.participations > 0) {
        profile.escrowsCompleted = settlement.completed;
        profile.escrowsDisputed = settlement.disputed;
        profile.observedSignals.escrowHistory = true;
        profile.observedSignals.clearingHouseSettlements = true;
        profile.dataSources.push("clearing-house-settlements");
        profile.clearingHouseSettlements = settlement;
      }
    } catch (error) {
      // best-effort cross-skill signal — ignore RPC/log limitations
    }
  }
  return profile;
}

export { NETWORKS };
