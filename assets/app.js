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
        <div class="meta-val" style="color:${inWarranty ? "var(--ok)" : "var(--red)"}">
          ${inWarranty ? "Active In-Warranty" : "Expired Warranty"}
        </div>
      </div>
    </div>

    <div class="step" style="background:#faf6f1">
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

function openReviewsModal(starFilter = "all", searchQuery = "") {
  const cr = CUSTOMER_REVIEWS;
  const q = searchQuery.toLowerCase().trim();

  const filtered = cr.reviews.filter((r) => {
    let matchStar = true;
    if (starFilter === "5") matchStar = r.rating === 5;
    else if (starFilter === "4") matchStar = r.rating === 4;
    else if (starFilter === "3") matchStar = r.rating === 3;
    else if (starFilter === "2") matchStar = r.rating === 2;
    else if (starFilter === "1") matchStar = r.rating === 1;
    else if (starFilter === "issue") matchStar = r.tag === "Left Earbud Issue";

    const matchQuery = !q || 
      r.author.toLowerCase().includes(q) || 
      r.title.toLowerCase().includes(q) || 
      r.content.toLowerCase().includes(q) || 
      r.tag.toLowerCase().includes(q) ||
      (r.batch && r.batch.toLowerCase().includes(q));

    return matchStar && matchQuery;
  });

  $("modal-claim-id").textContent = "CUSTOMER SENTIMENT & REVIEWS";
  $("modal-claim-badge").className = "badge ok";
  $("modal-claim-badge").textContent = `${cr.total} Verified Reviews`;
  $("modal-claim-title").textContent = "PulseBuds Pro · Customer Ratings & Fleet Feedback";

  const renderStars = (n) => "★".repeat(n) + "☆".repeat(5 - n);

  $("modal-body").innerHTML = `
    <div class="reviews-summary-grid">
      <div class="score-box">
        <div class="big-score">${cr.average}</div>
        <div class="stars-row">${renderStars(4)}</div>
        <div class="score-subtitle">100 Verified Customers</div>
        <div style="margin-top:8px">
          <span class="badge alert" style="font-size:10px;padding:2px 6px">⚠️ ${cr.leftIssueCount}% reported dead left bud</span>
        </div>
      </div>
      <div class="star-bars">
        ${[5, 4, 3, 2, 1].map((s) => `
          <div class="star-bar-row">
            <span>${s} ★</span>
            <div class="star-bar">
              <div class="star-bar-fill" style="width:${(cr.counts[s] / cr.total) * 100}%"></div>
            </div>
            <span style="text-align:right">${cr.counts[s]}</span>
          </div>
        `).join("")}
      </div>
    </div>

    <div class="reviews-filter-bar">
      <input id="review-search-input" value="${searchQuery}" placeholder="Search 100 customer reviews (e.g. 'left earbud', 'bass', 'A47', 'battery')..." style="background:#ffffff;border:1px solid rgba(200,145,95,0.28);border-radius:10px;padding:10px 14px;color:var(--text);outline:none;font-size:13px" />
      <div class="review-filter-chips">
        <button class="review-filter-chip ${starFilter === "all" ? "active" : ""}" data-filter="all">All (${cr.total})</button>
        <button class="review-filter-chip ${starFilter === "5" ? "active" : ""}" data-filter="5">5 ★ (${cr.counts[5]})</button>
        <button class="review-filter-chip ${starFilter === "4" ? "active" : ""}" data-filter="4">4 ★ (${cr.counts[4]})</button>
        <button class="review-filter-chip ${starFilter === "3" ? "active" : ""}" data-filter="3">3 ★ (${cr.counts[3]})</button>
        <button class="review-filter-chip ${starFilter === "2" ? "active" : ""}" data-filter="2">2 ★ (${cr.counts[2]})</button>
        <button class="review-filter-chip ${starFilter === "1" ? "active" : ""}" data-filter="1">1 ★ (${cr.counts[1]})</button>
        <button class="review-filter-chip ${starFilter === "issue" ? "active" : ""}" data-filter="issue" style="color:#ea580c;border-color:rgba(255,102,0,0.3)">⚠️ Left Earbud Defect (${cr.leftIssueCount})</button>
      </div>
    </div>

    <div class="reviews-list">
      ${filtered.length === 0 ? `
        <div style="text-align:center;padding:32px;color:var(--muted)">No customer reviews found matching your search.</div>
      ` : filtered.map((r) => `
        <div class="review-card">
          <div class="review-header">
            <div class="review-author-info">
              <div class="review-avatar">${r.author.charAt(0)}</div>
              <span class="review-author-name">${r.author}</span>
              <span class="verified-tag">✓ Verified</span>
            </div>
            <div class="review-meta-right">
              <span class="review-stars">${renderStars(r.rating)}</span>
              <span class="review-date">${r.date}</span>
              ${r.batch ? `<span class="badge replace" style="font-size:10px;padding:1px 6px">Lot #${r.batch}</span>` : ""}
            </div>
          </div>
          <div class="review-title">${r.title}</div>
          <div class="review-body">${r.content}</div>
          <div class="review-footer">
            <span class="review-tag ${r.tag === "Left Earbud Issue" ? "issue" : ""}">${r.tag}</span>
            <button class="review-helpful-btn" onclick="this.textContent = '👍 Helpful (' + (${r.helpful} + 1) + ')'; this.disabled = true;">👍 Helpful (${r.helpful})</button>
          </div>
        </div>
      `).join("")}
    </div>
  `;

  $("modal-actions").innerHTML = `
    <button class="btn primary" id="btn-review-load-arbiter">🔍 Cross-Reference Left Earbud Defect in Arbiter</button>
    <button class="btn" id="btn-review-close">Close</button>
  `;

  // Attach Filter Listeners
  $("modal-body").querySelectorAll(".review-filter-chip").forEach((btn) => {
    btn.addEventListener("click", () => {
      openReviewsModal(btn.dataset.filter, $("review-search-input").value);
    });
  });

  const searchInput = $("review-search-input");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      openReviewsModal(starFilter, e.target.value);
    });
  }

  const loadArbiterBtn = $("btn-review-load-arbiter");
  if (loadArbiterBtn) {
    loadArbiterBtn.addEventListener("click", () => {
      closeClaimModal();
      playDemo("a47");
    });
  }

  const closeBtn = $("btn-review-close");
  if (closeBtn) {
    closeBtn.addEventListener("click", closeClaimModal);
  }

  $("claim-modal").classList.remove("hidden");
}

function openUnitsModal(searchQuery = "") {
  const q = searchQuery.toLowerCase().trim();
  const filteredUnits = FLEET.units.filter((u) => !q || u.serial.toLowerCase().includes(q) || u.batch.toLowerCase().includes(q) || u.channel.toLowerCase().includes(q)).slice(0, 30);

  $("modal-claim-id").textContent = "FLEET PRODUCTION CATALOG";
  $("modal-claim-badge").className = "badge ok";
  $("modal-claim-badge").textContent = "10,000 Units Produced";
  $("modal-claim-title").textContent = "PulseBuds Pro · Production Lots & Inventory Explorer";

  $("modal-body").innerHTML = `
    <div class="meta-grid" style="grid-template-columns:repeat(3, 1fr)">
      <div class="meta-item">
        <div class="meta-label">Batch A47 (Cluster)</div>
        <div class="meta-val" style="color:var(--orange)">2,200 units · 32% return</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">Batch B12 (Normal)</div>
        <div class="meta-val">4,100 units · 5.8% return</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">Batch C03 (Top Yield)</div>
        <div class="meta-val" style="color:var(--ok)">3,700 units · 4.8% return</div>
      </div>
    </div>

    <input id="unit-search-input" value="${searchQuery}" placeholder="Search 10,000 serials (e.g. 'PB-A47', 'PB-B12', 'Direct')..." style="background:#ffffff;border:1px solid rgba(200,145,95,0.28);border-radius:10px;padding:10px 14px;color:var(--text);outline:none;font-size:13px;width:100%" />

    <div style="max-height:42vh;overflow-y:auto">
      <table>
        <thead>
          <tr><th>Serial</th><th>Batch</th><th>Purchased</th><th>Channel</th><th>Action</th></tr>
        </thead>
        <tbody>
          ${filteredUnits.map((u) => `
            <tr>
              <td class="mono" style="font-weight:600">${u.serial}</td>
              <td><span class="badge ${u.batch === "A47" ? "alert" : "replace"}">${u.batch}</span></td>
              <td>${u.purchasedAt}</td>
              <td>${u.channel}</td>
              <td><button class="badge replace" data-unit-serial="${u.serial}">Adjudicate ↗</button></td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;

  $("modal-actions").innerHTML = `
    <button class="btn" id="btn-unit-close">Close</button>
  `;

  const searchInput = $("unit-search-input");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      openUnitsModal(e.target.value);
    });
  }

  $("modal-body").querySelectorAll("[data-unit-serial]").forEach((btn) => {
    btn.addEventListener("click", () => {
      closeClaimModal();
      setView("intake");
      $("serial").value = btn.dataset.unitSerial;
      onSerial();
      generate(btn.dataset.unitSerial.includes("A47") ? "mfg-left" : "physical");
    });
  });

  const closeBtn = $("btn-unit-close");
  if (closeBtn) closeBtn.addEventListener("click", closeClaimModal);

  $("claim-modal").classList.remove("hidden");
}

function openReturnsModal(searchQuery = "") {
  const q = searchQuery.toLowerCase().trim();
  const filteredClaims = FLEET.claims.filter((c) => !q || `${c.id} ${c.serial} ${c.batch} ${c.component} ${c.reason} ${c.decision}`.toLowerCase().includes(q)).slice(0, 35);

  $("modal-claim-id").textContent = "RETURNS RECEIVED EXPLORER";
  $("modal-claim-badge").className = "badge alert";
  $("modal-claim-badge").textContent = `${FLEET.claims.length} Return Tickets`;
  $("modal-claim-title").textContent = "PulseBuds Pro · Live Inbound Return Claims";

  $("modal-body").innerHTML = `
    <div class="meta-grid" style="grid-template-columns:repeat(3, 1fr)">
      <div class="meta-item">
        <div class="meta-label">Left Earbud</div>
        <div class="meta-val" style="color:var(--orange)">730 claims (64%)</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">Right Earbud</div>
        <div class="meta-val">245 claims (21%)</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">Charging Case</div>
        <div class="meta-val">168 claims (15%)</div>
      </div>
    </div>

    <input id="return-search-input" value="${searchQuery}" placeholder="Filter 1,143 claims by ID, serial, reason, or batch..." style="background:#ffffff;border:1px solid rgba(200,145,95,0.28);border-radius:10px;padding:10px 14px;color:var(--text);outline:none;font-size:13px;width:100%" />

    <div style="max-height:42vh;overflow-y:auto">
      <table>
        <thead>
          <tr><th>Claim</th><th>Date</th><th>Serial</th><th>Batch</th><th>Component</th><th>Decision</th></tr>
        </thead>
        <tbody>
          ${filteredClaims.map((c) => `
            <tr class="clickable-row" data-modal-claim-id="${c.id}">
              <td class="mono">${c.id}</td>
              <td>${c.createdAt}</td>
              <td class="mono">${c.serial}</td>
              <td>${c.batch}</td>
              <td>${c.component}</td>
              <td><button class="badge ${c.decision.toLowerCase()}">${c.decision}</button></td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;

  $("modal-actions").innerHTML = `
    <button class="btn" id="btn-return-close">Close</button>
  `;

  const searchInput = $("return-search-input");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      openReturnsModal(e.target.value);
    });
  }

  $("modal-body").querySelectorAll("[data-modal-claim-id]").forEach((tr) => {
    tr.addEventListener("click", () => {
      openClaimModal(tr.dataset.modalClaimId);
    });
  });

  const closeBtn = $("btn-return-close");
  if (closeBtn) closeBtn.addEventListener("click", closeClaimModal);

  $("claim-modal").classList.remove("hidden");
}

function openBatchA47Modal() {
  $("modal-claim-id").textContent = "CAPA QUALITY DEFECT BULLETIN";
  $("modal-claim-badge").className = "badge alert";
  $("modal-claim-badge").textContent = "Manufacturing Stop-Ship Alert";
  $("modal-claim-title").textContent = "Batch #A47 · Left Driver Solder Fatigue Cluster";

  $("modal-body").innerHTML = `
    <div class="meta-grid">
      <div class="meta-item">
        <div class="meta-label">Affected Production Lot</div>
        <div class="meta-val mono">Batch A47 (2,200 units)</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">Lot Return Rate</div>
        <div class="meta-val" style="color:var(--orange)">32.0% (5.5x normal baseline)</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">Component Concentration</div>
        <div class="meta-val">93% Left Earbud silence</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">Customer Reviews Signal</div>
        <div class="meta-val" style="color:var(--orange)">18 Reviews cite silent left driver</div>
      </div>
    </div>

    <div class="step" style="background:#faf6f1">
      <h4>Root Cause Analysis & Policy Action:</h4>
      <p style="margin-top:6px;line-height:1.5">
        Automated on-device computer vision confirms no external housing impact fractures on silent left units from lot A47. 
        Telemetry identifies cold solder joint degradation on the left transducer driver during assembly.
      </p>
      <div style="margin-top:10px;padding:10px;background:#ffffff;border-radius:8px;border:1px solid var(--line-light)">
        <strong>Active Policy Directives:</strong>
        <ul style="margin:6px 0 0;padding-left:18px;font-size:12.5px;color:var(--muted)">
          <li>Auto-approve zero-cost <strong>Replacement</strong> for any in-warranty A47 left-silent claim with intact housing.</li>
          <li>Pause warehouse shipments of remaining 340 inventory units from Batch A47.</li>
          <li>Supplier CAPA ticket #CAPA-2026-088 opened with manufacturing line #2.</li>
        </ul>
      </div>
    </div>
  `;

  $("modal-actions").innerHTML = `
    <button class="btn primary" id="btn-a47-run-demo">⚡ Run A47 Arbiter Demo Claim</button>
    <button class="btn" id="btn-a47-view-reviews">⭐ View Customer Reviews</button>
    <button class="btn" id="btn-a47-close">Close</button>
  `;

  $("btn-a47-run-demo").addEventListener("click", () => {
    closeClaimModal();
    playDemo("a47");
  });

  $("btn-a47-view-reviews").addEventListener("click", () => {
    openReviewsModal("issue");
  });

  $("btn-a47-close").addEventListener("click", closeClaimModal);

  $("claim-modal").classList.remove("hidden");
}

function renderKpis() {
  const a = ANALYTICS;
  const cr = CUSTOMER_REVIEWS;
  const a47 = a.byBatch.find((b) => b.id === "A47");

  $("kpis").innerHTML = `
    <div class="card kpi clickable" id="kpi-units" title="Click to explore 10,000 produced units & lot catalog">
      <div class="label">Units produced</div>
      <div class="value">${a.produced.toLocaleString()}</div>
      <div class="delta ok">PulseBuds Pro · 3 lots <span class="kpi-hint">↗</span></div>
    </div>
    <div class="card kpi clickable" id="kpi-returns" title="Click to view all 1,143 return tickets">
      <div class="label">Returns received</div>
      <div class="value">${a.returns.toLocaleString()}</div>
      <div class="delta up">${pct(a.returns / a.produced)} of production <span class="kpi-hint">↗</span></div>
    </div>
    <div class="card kpi clickable" id="kpi-reviews" title="Click to view 100+ customer reviews & ratings">
      <div class="label">Customer reviews</div>
      <div class="value">${cr.average} ★</div>
      <div class="delta ok">${cr.total} verified ratings <span class="kpi-hint">↗</span></div>
    </div>
    <div class="card kpi clickable" id="kpi-batch" title="Click to inspect Batch A47 defect telemetry">
      <div class="label">Of those, batch A47</div>
      <div class="value">${pct(a.leftFromA47)}</div>
      <div class="delta up">clustered manufacturing signal <span class="kpi-hint">↗</span></div>
    </div>
    <div class="card alert clickable" id="alert-a47-banner" title="Click to inspect CAPA Quality Bulletin">
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

  // Attach KPI Click Listeners
  $("kpi-units").addEventListener("click", () => openUnitsModal());
  $("kpi-returns").addEventListener("click", () => openReturnsModal());
  $("kpi-reviews").addEventListener("click", () => openReviewsModal());
  $("kpi-batch").addEventListener("click", () => openBatchA47Modal());
  $("alert-a47-banner").addEventListener("click", () => openBatchA47Modal());

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

