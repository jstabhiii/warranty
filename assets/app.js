const state = {
  file: null,
  preview: null
};

function $(id) { return document.getElementById(id); }

function pct(n) { return `${(n * 100).toFixed(0)}%`; }

function setView(name) {
  document.querySelectorAll(".nav-btn").forEach((b) => b.classList.toggle("active", b.dataset.view === name));
  $("view-intel").classList.toggle("hidden", name !== "intel");
  $("view-intake").classList.toggle("hidden", name !== "intake");
  $("view-history").classList.toggle("hidden", name !== "history");
}

function renderKpis() {
  const a = ANALYTICS;
  const a47 = a.byBatch.find((b) => b.id === "A47");
  $("kpis").innerHTML = `
    <div class="card kpi"><div class="label">Units produced</div><div class="value">${a.produced.toLocaleString()}</div><div class="delta ok">PulseBuds Pro · 3 lots</div></div>
    <div class="card kpi"><div class="label">Returns received</div><div class="value">${a.returns.toLocaleString()}</div><div class="delta up">${pct(a.returns / a.produced)} of production</div></div>
    <div class="card kpi"><div class="label">Left-earbud returns</div><div class="value">${pct(a.leftShare)}</div><div class="delta up">of all return tickets</div></div>
    <div class="card kpi"><div class="label">Of those, batch A47</div><div class="value">${pct(a.leftFromA47)}</div><div class="delta up">clustered manufacturing signal</div></div>
    <div class="card alert">
      <div class="pulse"></div>
      <div>
        <div class="badge alert">POTENTIAL MANUFACTURING DEFECT</div>
        <h3 style="margin:8px 0 6px">Batch #A47 left driver failure</h3>
        <p class="muted" style="margin:0;line-height:1.5">
          ${pct(a.leftShare)} of returns involve the left earbud.
          ${pct(a.leftFromA47)} of those left-earbud failures belong to batch A47
          (lot return rate ${pct(a47.rate)} vs ${pct(a.byBatch.find((b) => b.id === "B12").rate)} on B12).
          Recommendation: pause A47 fulfillment, open CAPA, auto-approve in-warranty replacements for silent-left + intact housing.
        </p>
      </div>
    </div>
  `;

  $("component-bars").innerHTML = a.byComponent.map((c) => `
    <div class="bar-row"><span>${c.name}</span><div class="bar"><span style="width:${(c.count / a.returns) * 100}%"></span></div><span>${c.count}</span></div>
  `).join("");

  $("batch-bars").innerHTML = a.byBatch.map((b) => `
    <div class="bar-row"><span>${b.id}</span><div class="bar"><span style="width:${Math.min(100, b.rate * 320)}%"></span></div><span>${pct(b.rate)}</span></div>
  `).join("");

  $("intel-table").innerHTML = FLEET.claims.slice(0, 8).map((c) => `
    <tr>
      <td class="mono">${c.id}</td>
      <td class="mono">${c.serial}</td>
      <td>${c.batch}</td>
      <td>${c.component}</td>
      <td><span class="badge ${c.decision.toLowerCase()}">${c.decision}</span></td>
    </tr>
  `).join("");
}

function renderHistory(filter = "") {
  const q = filter.toLowerCase();
  const rows = FLEET.claims.filter((c) =>
    !q || `${c.id} ${c.serial} ${c.batch} ${c.component} ${c.reason}`.toLowerCase().includes(q)
  ).slice(0, 40);
  $("hist-table").innerHTML = rows.map((c) => `
    <tr>
      <td class="mono">${c.id}</td>
      <td>${c.createdAt}</td>
      <td class="mono">${c.serial}</td>
      <td>${c.batch}</td>
      <td>${c.component}</td>
      <td>${c.reason}</td>
      <td><span class="badge ${c.decision.toLowerCase()}">${c.decision}</span></td>
    </tr>
  `).join("");
}

function renderChips() {
  const demos = [
    ["PB-A47-01041", "A47 · in warranty"],
    ["PB-B12-03210", "B12 · expired + crack"],
    ["PB-C03-07320", "C03 · DOA window"]
  ];
  $("serial-chips").innerHTML = demos.map(([s, l]) =>
    `<button class="chip" data-serial="${s}">${s}<span style="opacity:.6"> · ${l}</span></button>`
  ).join("");
  $("serial-chips").querySelectorAll(".chip").forEach((el) => {
    el.addEventListener("click", () => {
      $("serial").value = el.dataset.serial;
      onSerial();
    });
  });
}

function onSerial() {
  const unit = lookupUnit($("serial").value);
  if (!unit) {
    $("unit-meta").textContent = "Unknown serial — arbiter will not run without a catalog match.";
    return;
  }
  const product = PRODUCTS[unit.sku];
  const age = daysBetween(unit.purchasedAt);
  $("unit-meta").innerHTML = `
    <strong>${product.name}</strong> · purchased ${unit.purchasedAt} (${age}d ago) ·
    warranty ${age <= product.warrantyDays ? "active" : "expired"} ·
    batch <span class="mono">${unit.batch}</span> · prior claims ${unit.priorClaims}
  `;
}

function showPreview(url) {
  $("drop").innerHTML = `<img alt="Evidence" src="${url}" />`;
}

async function generate(kind) {
  const { file, url } = await makeDemoImage(kind);
  state.file = file;
  state.preview = url;
  showPreview(url);
  if (kind === "physical") $("symptom").value = "cracked";
  if (kind === "mfg-left") $("symptom").value = "left-silent";
  if (kind === "doa") $("symptom").value = "doa";
}

function renderDecision(unit, vision, decision) {
  const cls = decision.action.toLowerCase();
  $("result-panel").innerHTML = `
    <div class="decision ${cls}">
      <div class="badge ${cls}">${decision.action.toUpperCase()}</div>
      <h3>${decision.title}</h3>
      <p>${decision.detail}</p>
      <p class="muted" style="margin-top:8px">Policy: ${decision.policy} · confidence ${Math.round(decision.confidence * 100)}%</p>
    </div>
    <div class="step">
      <h4>1 · Computer vision</h4>
      <p>${vision.notes}<br />Laterality: ${vision.laterality} · class: ${vision.damageClass} · source: ${vision.source}</p>
    </div>
    <div class="step">
      <h4>2 · Entitlement</h4>
      <p>Serial ${unit.serial} · batch ${unit.batch} · ${decision.age} days since purchase ·
      warranty ${decision.inWarranty ? "in force" : "lapsed"} · return window ${decision.inReturnWindow ? "open" : "closed"}.</p>
    </div>
    <div class="step">
      <h4>3 · Fleet correlation</h4>
      <p>${decision.fleetAlert
        ? "This ticket matches the A47 left-driver cluster. Escalate from “one unhappy customer” to “stop-ship candidate”."
        : "No active stop-ship pattern for this batch/component pair."}</p>
    </div>
    <div class="step">
      <h4>Evidence chain</h4>
      <p>${decision.reasons.map((r) => `• ${r}`).join("<br>")}</p>
    </div>
  `;
}

async function runArbiter() {
  const unit = lookupUnit($("serial").value);
  if (!unit) {
    $("result-panel").innerHTML = `<div class="decision reject"><h3>Serial not found</h3><p>Use a catalog serial so purchase history and batch can be joined.</p></div>`;
    return;
  }
  $("result-panel").innerHTML = `<div class="step"><h4>Analyzing</h4><p>Running on-device vision and policy engine…</p></div>`;
  const vision = await analyzeEvidence(state.file, $("symptom").value);
  const decision = decideClaim({
    unit,
    vision,
    symptom: $("symptom").value,
    customerAsk: $("ask").value
  });
  renderDecision(unit, vision, decision);
}

async function playDemo(which) {
  setView("intake");
  if (which === "a47") {
    $("serial").value = "PB-A47-01041";
    $("ask").value = "replace";
    $("notes").value = "Left bud died. I didn't drop them.";
    onSerial();
    await generate("mfg-left");
  } else {
    $("serial").value = "PB-B12-03210";
    $("ask").value = "refund";
    $("notes").value = "I sat on them. The left side is cracked.";
    onSerial();
    await generate("physical");
  }
  await runArbiter();
}

document.querySelectorAll(".nav-btn").forEach((btn) => {
  btn.addEventListener("click", () => setView(btn.dataset.view));
});

$("serial").addEventListener("input", onSerial);
$("btn-run").addEventListener("click", runArbiter);
$("btn-judge-demo").addEventListener("click", () => playDemo("a47"));
$("btn-reject-demo").addEventListener("click", () => playDemo("reject"));
$("btn-gen-mfg").addEventListener("click", () => generate("mfg-left"));
$("btn-gen-phys").addEventListener("click", () => generate("physical"));
$("btn-upload").addEventListener("click", () => $("file").click());
$("file").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  state.file = file;
  state.preview = URL.createObjectURL(file);
  showPreview(state.preview);
});
$("drop").addEventListener("dragover", (e) => e.preventDefault());
$("drop").addEventListener("drop", (e) => {
  e.preventDefault();
  const file = e.dataTransfer.files[0];
  if (!file) return;
  state.file = file;
  state.preview = URL.createObjectURL(file);
  showPreview(state.preview);
});
$("hist-search").addEventListener("input", (e) => renderHistory(e.target.value));

renderKpis();
renderChips();
renderHistory();
$("serial").value = "PB-A47-01041";
onSerial();
