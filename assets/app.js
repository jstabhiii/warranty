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

function showToast(title, desc, type = "success") {
  const container = $("toast-container");
  if (!container) return;
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  
  const icon = type === "success" ? "✓" : type === "warn" ? "⚠️" : type === "danger" ? "✕" : "ℹ";
  toast.innerHTML = `
    <div class="toast-icon">${icon}</div>
    <div>
      <div class="toast-title">${title}</div>
      <div class="toast-desc">${desc}</div>
    </div>
  `;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(10px)";
    setTimeout(() => toast.remove(), 250);
  }, 4000);
}

function openClaimModal(claimId) {
  const c = FLEET.claims.find((x) => x.id === claimId);
  if (!c) return;
  const u = lookupUnit(c.serial);
  const product = u ? PRODUCTS[u.sku] : null;
  const age = u ? daysBetween(u.purchasedAt) : 0;
  const inWarranty = product ? age <= product.warrantyDays : false;

  $("modal-claim-id").textContent = c.id;
  $("modal-claim-badge").className = `badge ${c.decision.toLowerCase()}`;
  $("modal-claim-badge").textContent = c.decision;
  $("modal-claim-title").textContent = `${c.component} — ${c.reason}`;

  $("modal-body").innerHTML = `
    <div class="meta-grid">
      <div class="meta-item">
        <div class="meta-label">Serial Number</div>
        <div class="meta-val mono">${c.serial}</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">Production Batch</div>
        <div class="meta-val">${c.batch} · ${c.batch === "A47" ? "Cluster Alert" : "Normal"}</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">Purchase Date</div>
        <div class="meta-val">${u ? u.purchasedAt : "Unknown"} (${age}d ago)</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">Warranty Status</div>
        <div class="meta-val" style="color:${inWarranty ? "var(--cyan)" : "var(--red)"}">
          ${inWarranty ? "Active In-Warranty" : "Expired Warranty"}
        </div>
      </div>
    </div>

    <div class="step" style="background:#0b0f16">
      <h4>Adjudication Recommendation: <span class="badge ${c.decision.toLowerCase()}">${c.decision}</span></h4>
      <p style="margin-top:6px">
        ${c.decision === "Replace" 
          ? `Batch #${c.batch} defect signature matched. Entitled to automatic zero-cost unit replacement under standard coverage.`
          : c.decision === "Refund"
          ? `Claim filed within return window. Entitled to complete refund reversal.`
          : c.decision === "Repair"
          ? `In-warranty component failure. Unit routed to certified repair center.`
          : `Physical damage or out-of-warranty term. Paid service option only.`}
      </p>
    </div>
  `;

  let actionButtons = "";
  if (c.decision === "Replace") {
    actionButtons = `
      <button class="btn" id="modal-btn-intake">🔍 Open in Arbiter</button>
      <button class="btn" id="modal-btn-rma">🏷️ Print RMA Label</button>
      <button class="btn primary" id="modal-btn-fulfill">📦 Dispatch Replacement</button>
    `;
  } else if (c.decision === "Refund") {
    actionButtons = `
      <button class="btn" id="modal-btn-intake">🔍 Open in Arbiter</button>
      <button class="btn primary" id="modal-btn-fulfill">💳 Issue $129.00 Refund</button>
    `;
  } else if (c.decision === "Repair") {
    actionButtons = `
      <button class="btn" id="modal-btn-intake">🔍 Open in Arbiter</button>
      <button class="btn primary" id="modal-btn-fulfill">🛠️ Route to Repair Lab</button>
    `;
  } else {
    actionButtons = `
      <button class="btn" id="modal-btn-intake">🔍 Open in Arbiter</button>
      <button class="btn danger" id="modal-btn-fulfill">✉️ Send Rejection Letter</button>
    `;
  }

  $("modal-actions").innerHTML = actionButtons;

  const fulfillBtn = $("modal-btn-fulfill");
  if (fulfillBtn) {
    fulfillBtn.addEventListener("click", () => {
      const rmaNumber = `RMA-${Math.floor(10000 + Math.random() * 90000)}`;
      if (c.decision === "Replace") {
        showToast("Replacement Dispatched", `Issued ${rmaNumber} for ${c.serial}. New PulseBuds Pro dispatched.`);
      } else if (c.decision === "Refund") {
        showToast("Refund Processed", `Credit of $129.00 reversed to customer for ${c.serial}.`);
      } else if (c.decision === "Repair") {
        showToast("Repair Authorized", `Work order #${rmaNumber} created. Inbound shipping kit generated.`);
      } else {
        showToast("Rejection Sent", `Formal rejection notice dispatched for ${c.serial}.`, "warn");
      }
      closeClaimModal();
    });
  }

  const rmaBtn = $("modal-btn-rma");
  if (rmaBtn) {
    rmaBtn.addEventListener("click", () => {
      showToast("RMA Label Ready", `Prepaid return shipping label generated for serial ${c.serial}.`, "info");
      closeClaimModal();
    });
  }

  const intakeBtn = $("modal-btn-intake");
  if (intakeBtn) {
    intakeBtn.addEventListener("click", () => {
      closeClaimModal();
      loadClaimIntoIntake(c);
    });
  }

  $("claim-modal").classList.remove("hidden");
}

function closeClaimModal() {
  $("claim-modal").classList.add("hidden");
}

async function loadClaimIntoIntake(claim) {
  setView("intake");
  $("serial").value = claim.serial;
  onSerial();
  
  if (claim.reason.toLowerCase().includes("crack") || claim.reason.toLowerCase().includes("drop")) {
    $("symptom").value = "cracked";
    $("ask").value = "refund";
    $("notes").value = claim.reason;
    await generate("physical");
  } else if (claim.component.includes("left") || claim.reason.toLowerCase().includes("driver") || claim.reason.toLowerCase().includes("audio")) {
    $("symptom").value = "left-silent";
    $("ask").value = "replace";
    $("notes").value = `${claim.component}: ${claim.reason}. Customer requesting resolution.`;
    await generate("mfg-left");
  } else if (claim.reason.toLowerCase().includes("charging") || claim.reason.toLowerCase().includes("power")) {
    $("symptom").value = "doa";
    $("ask").value = "replace";
    $("notes").value = claim.reason;
    await generate("doa");
  } else {
    $("symptom").value = "other";
    $("ask").value = "repair";
    $("notes").value = claim.reason;
    await generate("mfg-left");
  }

  await runArbiter();
  showToast("Claim Loaded into Arbiter", `Evaluated ${claim.id} (${claim.serial}) through live policy engine.`, "info");
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
    <tr class="clickable-row" data-claim-id="${c.id}">
      <td class="mono">${c.id}</td>
      <td class="mono">${c.serial}</td>
      <td>${c.batch}</td>
      <td>${c.component}</td>
      <td><button class="badge ${c.decision.toLowerCase()}" data-claim-id="${c.id}" title="Click to inspect ${c.decision}">${c.decision}</button></td>
    </tr>
  `).join("");

  $("intel-table").querySelectorAll("[data-claim-id]").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      openClaimModal(el.dataset.claimId);
    });
  });
}

function renderHistory(filter = "") {
  const q = filter.toLowerCase();
  const rows = FLEET.claims.filter((c) =>
    !q || `${c.id} ${c.serial} ${c.batch} ${c.component} ${c.reason}`.toLowerCase().includes(q)
  ).slice(0, 40);
  $("hist-table").innerHTML = rows.map((c) => `
    <tr class="clickable-row" data-claim-id="${c.id}">
      <td class="mono">${c.id}</td>
      <td>${c.createdAt}</td>
      <td class="mono">${c.serial}</td>
      <td>${c.batch}</td>
      <td>${c.component}</td>
      <td>${c.reason}</td>
      <td><button class="badge ${c.decision.toLowerCase()}" data-claim-id="${c.id}" title="Click to inspect and process ${c.decision}">${c.decision}</button></td>
    </tr>
  `).join("");

  $("hist-table").querySelectorAll("tr.clickable-row").forEach((tr) => {
    tr.addEventListener("click", () => {
      openClaimModal(tr.dataset.claimId);
    });
  });

  $("hist-table").querySelectorAll("button.badge").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      openClaimModal(btn.dataset.claimId);
    });
  });
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
  
  let actionButtons = "";
  if (decision.action === "Replace") {
    actionButtons = `
      <div class="decision-actions">
        <button class="btn primary" id="btn-arb-fulfill">📦 Approve & Dispatch Replacement</button>
        <button class="btn" id="btn-arb-rma">🏷️ Generate RMA Shipping Label</button>
      </div>
    `;
  } else if (decision.action === "Refund") {
    actionButtons = `
      <div class="decision-actions">
        <button class="btn primary" id="btn-arb-fulfill">💳 Issue Full Refund ($129.00)</button>
        <button class="btn" id="btn-arb-rma">🏷️ Generate Return Label</button>
      </div>
    `;
  } else if (decision.action === "Repair") {
    actionButtons = `
      <div class="decision-actions">
        <button class="btn primary" id="btn-arb-fulfill">🛠️ Route to Repair Lab</button>
        <button class="btn" id="btn-arb-rma">🏷️ Issue Inbound Box</button>
      </div>
    `;
  } else {
    actionButtons = `
      <div class="decision-actions">
        <button class="btn danger" id="btn-arb-fulfill">✉️ Send Rejection Letter</button>
        <button class="btn ghost" id="btn-arb-rma">📄 Download PDF Report</button>
      </div>
    `;
  }

  $("result-panel").innerHTML = `
    <div class="decision ${cls}">
      <div class="badge ${cls}">${decision.action.toUpperCase()}</div>
      <h3>${decision.title}</h3>
      <p>${decision.detail}</p>
      <p class="muted" style="margin-top:8px">Policy: ${decision.policy} · confidence ${Math.round(decision.confidence * 100)}%</p>
      ${actionButtons}
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

  const fulfillBtn = $("btn-arb-fulfill");
  if (fulfillBtn) {
    fulfillBtn.addEventListener("click", () => {
      const rmaNumber = `RMA-${Math.floor(10000 + Math.random() * 90000)}`;
      if (decision.action === "Replace") {
        showToast("Replacement Dispatched", `Order #${rmaNumber} created. Brand new PulseBuds Pro assigned for ${unit.serial}.`);
      } else if (decision.action === "Refund") {
        showToast("Refund Dispatched", `$129.00 processed to original payment method for ${unit.serial}.`);
      } else if (decision.action === "Repair") {
        showToast("Repair Ticket Created", `Service order #${rmaNumber} assigned to technician queue.`);
      } else {
        showToast("Notice Dispatched", `Rejection reason breakdown emailed to customer.`, "warn");
      }
    });
  }

  const rmaBtn = $("btn-arb-rma");
  if (rmaBtn) {
    rmaBtn.addEventListener("click", () => {
      showToast("Label Generated", `Prepaid return tracking slip generated for serial ${unit.serial}.`, "info");
    });
  }
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

// Event Listeners
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

$("modal-close-btn").addEventListener("click", closeClaimModal);
$("claim-modal").addEventListener("click", (e) => {
  if (e.target === $("claim-modal")) closeClaimModal();
});
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeClaimModal();
});

// Initialization
renderKpis();
renderChips();
renderHistory();
$("serial").value = "PB-A47-01041";
onSerial();

