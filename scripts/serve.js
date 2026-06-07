import { createServer } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { fetchLivePharosProfile } from "../src/pharosLive.js";
import { scoreCounterparty, reviewActionWithCredit } from "../src/creditBureau.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const preferredPort = Number(process.env.PORT || 4173);

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

const server = createServer((req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host}`);

  if (url.pathname === "/api/live-report") {
    handleLiveReport(url, res);
    return;
  }

  const requestedPath = url.pathname === "/" ? "/index.html" : url.pathname;
  const filePath = normalize(join(root, requestedPath));

  if (!filePath.startsWith(root) || !existsSync(filePath) || statSync(filePath).isDirectory()) {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Not found");
    return;
  }

  res.writeHead(200, { "content-type": contentTypes[extname(filePath)] || "application/octet-stream" });
  createReadStream(filePath).pipe(res);
});

async function handleLiveReport(url, res) {
  try {
    const address = url.searchParams.get("address");
    const network = url.searchParams.get("network") || "pharos-mainnet";
    const amountUsd = Number(url.searchParams.get("amount") || 0);
    const knownContract = url.searchParams.get("knownContract") === "true";
    const missionAligned = url.searchParams.get("missionAligned") !== "false";

    const profile = await fetchLivePharosProfile({ address, network });
    const report = scoreCounterparty(profile, { requestedExposureUsd: amountUsd || 10000 });
    const sentinel = reviewActionWithCredit(
      {
        amountUsd,
        network: profile.network,
        knownContract,
        missionAligned
      },
      report
    );

    res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({
      decisionSummary: sentinel.decision,
      liveSignals: profile.rawLiveSignals,
      explorerUrl: profile.explorerUrl,
      creditBureauReport: report,
      sentinelDecision: sentinel,
      generatedAt: new Date().toISOString()
    }, null, 2));
  } catch (error) {
    res.writeHead(400, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ error: error.message }, null, 2));
  }
}

function listen(port, attempts = 0) {
  server.once("error", error => {
    if (error.code === "EADDRINUSE" && attempts < 10) {
      listen(port + 1, attempts + 1);
      return;
    }

    throw error;
  });

  server.listen(port, () => {
    console.log(`Pharos Credit Bureau running at http://localhost:${port}`);
    console.log(`Live report API: http://localhost:${port}/api/live-report?address=0x6b16be825b84d9a61b5ae370ea75dcd537555555&amount=5000`);
  });
}

listen(preferredPort);
