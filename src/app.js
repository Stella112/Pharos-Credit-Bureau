import { scoreCounterparty, reviewActionWithCredit, DEFAULT_POLICY } from "./creditBureau.js";

const formatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0
});

const state = {
  profiles: [],
  selectedIndex: 0,
  report: null,
  action: {
    amountUsd: 2500,
    network: "pharos-mainnet",
    knownContract: true,
    missionAligned: true
  }
};

const els = {
  profileSelect: document.querySelector("#profileSelect"),
  score: document.querySelector("#score"),
  scoreRing: document.querySelector("#scoreRing"),
  riskBand: document.querySelector("#riskBand"),
  recommendation: document.querySelector("#recommendation"),
  rationale: document.querySelector("#rationale"),
  confidence: document.querySelector("#confidence"),
  exposureCap: document.querySelector("#exposureCap"),
  walletAge: document.querySelector("#walletAge"),
  txCount: document.querySelector("#txCount"),
  factors: document.querySelector("#factors"),
  flags: document.querySelector("#flags"),
  profileMeta: document.querySelector("#profileMeta"),
  amount: document.querySelector("#amount"),
  network: document.querySelector("#network"),
  knownContract: document.querySelector("#knownContract"),
  missionAligned: document.querySelector("#missionAligned"),
  runSentinel: document.querySelector("#runSentinel"),
  sentinelDecision: document.querySelector("#sentinelDecision"),
  sentinelReasons: document.querySelector("#sentinelReasons"),
  checks: document.querySelector("#checks"),
  graph: document.querySelector("#riskGraph")
};

function severityRank(severity) {
  return { critical: 3, high: 2, medium: 1 }[severity] || 0;
}

function bandClass(value) {
  if (value >= 85) return "good";
  if (value >= 70) return "low";
  if (value >= 55) return "medium";
  if (value >= 40) return "watch";
  return "bad";
}

function drawGraph(report) {
  const canvas = els.graph;
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);

  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(0, 0, width, height);

  const nodes = report.factors.map((factor, index) => {
    const angle = (Math.PI * 2 * index) / report.factors.length - Math.PI / 2;
    const radius = 90 + factor.score * 0.55;
    return {
      x: width / 2 + Math.cos(angle) * radius,
      y: height / 2 + Math.sin(angle) * radius,
      factor
    };
  });

  ctx.strokeStyle = "#cbd5e1";
  ctx.lineWidth = 1;
  ctx.beginPath();
  nodes.forEach((node, index) => {
    if (index === 0) ctx.moveTo(node.x, node.y);
    else ctx.lineTo(node.x, node.y);
  });
  ctx.closePath();
  ctx.stroke();

  nodes.forEach(node => {
    const tone = bandClass(node.factor.score);
    const colors = {
      good: "#0f766e",
      low: "#2f855a",
      medium: "#b7791f",
      watch: "#c2410c",
      bad: "#b91c1c"
    };

    ctx.beginPath();
    ctx.arc(node.x, node.y, 12, 0, Math.PI * 2);
    ctx.fillStyle = colors[tone];
    ctx.fill();

    ctx.fillStyle = "#0f172a";
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = node.x > width / 2 ? "left" : "right";
    ctx.fillText(node.factor.name, node.x + (node.x > width / 2 ? 18 : -18), node.y + 4);
  });

  ctx.beginPath();
  ctx.arc(width / 2, height / 2, 42, 0, Math.PI * 2);
  ctx.fillStyle = "#0f172a";
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.font = "700 22px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(String(Math.round(report.score)), width / 2, height / 2 + 8);
}

function renderReport() {
  const profile = state.profiles[state.selectedIndex];
  state.report = scoreCounterparty(profile, { requestedExposureUsd: Number(els.amount.value) || 10000 });
  const report = state.report;

  els.score.textContent = Math.round(report.score);
  els.scoreRing.style.setProperty("--score", `${report.score * 3.6}deg`);
  els.riskBand.textContent = report.riskBand;
  els.riskBand.className = `pill ${bandClass(report.score)}`;
  els.recommendation.textContent = report.recommendation.label;
  els.rationale.textContent = report.recommendation.rationale;
  els.confidence.textContent = `${report.confidence}%`;
  els.exposureCap.textContent = formatter.format(report.exposureCapUsd);
  els.walletAge.textContent = `${profile.walletAgeDays} days`;
  els.txCount.textContent = profile.transactionCount.toLocaleString();
  els.profileMeta.textContent = `${profile.label} / ${profile.type} / ${profile.network}`;

  els.factors.innerHTML = report.factors.map(factor => `
    <li>
      <span>${factor.name}</span>
      <div class="bar" aria-label="${factor.name} score ${factor.score}">
        <i style="width: ${factor.score}%"></i>
      </div>
      <strong>${factor.score}</strong>
    </li>
  `).join("");

  const sortedFlags = [...report.flags].sort((a, b) => severityRank(b.severity) - severityRank(a.severity));
  els.flags.innerHTML = sortedFlags.length
    ? sortedFlags.map(flag => `
      <li class="${flag.severity}">
        <strong>${flag.code}</strong>
        <span>${flag.message}</span>
      </li>
    `).join("")
    : `<li class="clear"><strong>CLEAR</strong><span>No active risk flags for this profile.</span></li>`;

  drawGraph(report);
  renderSentinel();
}

function renderSentinel() {
  const action = {
    amountUsd: Number(els.amount.value || 0),
    network: els.network.value,
    knownContract: els.knownContract.checked,
    missionAligned: els.missionAligned.checked
  };

  state.action = action;
  const review = reviewActionWithCredit(action, state.report, DEFAULT_POLICY);
  const decisionClass = review.decision === "approve" ? "approve" : review.decision === "block" ? "block" : "confirm";

  els.sentinelDecision.className = `decision ${decisionClass}`;
  els.sentinelDecision.textContent = review.decision.replaceAll("_", " ");
  els.sentinelReasons.innerHTML = review.reasons.length
    ? review.reasons.map(reason => `<li>${reason}</li>`).join("")
    : `<li>${review.finalInstruction}</li>`;
  els.checks.innerHTML = review.checks.map(check => `
    <li class="${check.passed ? "pass" : "fail"}">
      <span>${check.name}</span>
      <strong>${check.passed ? "pass" : "fail"}</strong>
    </li>
  `).join("");
}

async function init() {
  const response = await fetch("./data/sample-profiles.json");
  state.profiles = await response.json();
  els.profileSelect.innerHTML = state.profiles
    .map((profile, index) => `<option value="${index}">${profile.label}</option>`)
    .join("");

  els.amount.value = state.action.amountUsd;
  els.network.value = state.action.network;
  els.knownContract.checked = state.action.knownContract;
  els.missionAligned.checked = state.action.missionAligned;

  els.profileSelect.addEventListener("change", event => {
    state.selectedIndex = Number(event.target.value);
    renderReport();
  });

  [els.amount, els.network, els.knownContract, els.missionAligned].forEach(input => {
    input.addEventListener("input", renderReport);
    input.addEventListener("change", renderReport);
  });

  els.runSentinel.addEventListener("click", renderSentinel);
  renderReport();
}

init().catch(error => {
  document.querySelector("#app").innerHTML = `<main class="fatal">Failed to load demo: ${error.message}</main>`;
});

