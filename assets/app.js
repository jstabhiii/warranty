const state = {
  file: null,
  preview: null
};

const authState = {
  isLoggedIn: true,
  user: {
    name: "Suyash Sharma",
    email: "suyash@indi-arbiter.io",
    role: "Operations Admin",
    avatar: "SS",
    token: "ARB-AUTH-88421"
  }
};

function $(id) { return document.getElementById(id); }

function pct(n) { return `${(n * 100).toFixed(0)}%`; }

function setView(name) {
  document.querySelectorAll(".nav-btn").forEach((b) => b.classList.toggle("active", b.dataset.view === name));
  $("view-intel").classList.toggle("hidden", name !== "intel");
  $("view-intake").classList.toggle("hidden", name !== "intake");
  $("view-history").classList.toggle("hidden", name !== "history");
  
  const viewReviews = $("view-reviews");
  if (viewReviews) {
    viewReviews.classList.toggle("hidden", name !== "reviews");
    if (name === "reviews") renderFullReviewsView();
  }

  const viewLots = $("view-lots");
  if (viewLots) {
    viewLots.classList.toggle("hidden", name !== "lots");
    if (name === "lots") renderLotsView();
  }

  const viewPolicy = $("view-policy");
  if (viewPolicy) {
    viewPolicy.classList.toggle("hidden", name !== "policy");
    if (name === "policy") renderPolicyView();
  }

  window.scrollTo({ top: 0, behavior: "smooth" });
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

function openComponentModal(componentId, searchQuery = "") {
  const comp = FLEET.componentsCatalog.find((c) => c.id === componentId) || FLEET.componentsCatalog[0];
  const compAnalytics = ANALYTICS.byComponent.find((c) => c.id === comp.id) || { count: 0, rate: 0 };
  const q = searchQuery.toLowerCase().trim();
  const claimsForComp = FLEET.claims.filter((c) => c.component === comp.id && (!q || `${c.id} ${c.serial} ${c.batch} ${c.reason} ${c.decision}`.toLowerCase().includes(q))).slice(0, 30);

  $("modal-claim-id").textContent = "COMPONENT TELEMETRY & RETURNS";
  $("modal-claim-badge").className = comp.id === "left earbud" ? "badge alert" : "badge replace";
  $("modal-claim-badge").textContent = `${compAnalytics.count} Returns (${pct(compAnalytics.rate)})`;
  $("modal-claim-title").textContent = `${comp.name} · Subsystem Reliability Breakdown`;

  $("modal-body").innerHTML = `
    <div class="meta-grid">
      <div class="meta-item">
        <div class="meta-label">Total Returned Units</div>
        <div class="meta-val" style="color:var(--orange)">${compAnalytics.count.toLocaleString()} units</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">Share of All Returns</div>
        <div class="meta-val">${pct(compAnalytics.rate)} of return volume</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">Primary Failure Symptom</div>
        <div class="meta-val">${comp.defaultReason}</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">Manufacturing Status</div>
        <div class="meta-val" style="color:${comp.id === "left earbud" ? "var(--red)" : "var(--ok)"}">
          ${comp.id === "left earbud" ? "⚠️ Stop-Ship Recall Cluster" : "✓ In-Control Process"}
        </div>
      </div>
    </div>

    <div class="step" style="background:#faf6f1">
      <h4>Engineering Teardown & Root Cause:</h4>
      <p style="margin-top:6px;line-height:1.5">
        ${comp.rootCause}
      </p>
    </div>

    <div class="reviews-filter-bar">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <span style="font-weight:700;font-size:13px">Return Claims for ${comp.name}</span>
        <span class="muted" style="font-size:12px">${compAnalytics.count} recorded</span>
      </div>
      <input id="comp-claim-search" value="${searchQuery}" placeholder="Filter claims for ${comp.name} by ID, serial, or batch..." style="background:#ffffff;border:1px solid rgba(200,145,95,0.28);border-radius:10px;padding:10px 14px;color:var(--text);outline:none;font-size:13px;width:100%" />
    </div>

    <div style="max-height:36vh;overflow-y:auto">
      <table>
        <thead>
          <tr><th>Claim</th><th>Date</th><th>Serial</th><th>Batch</th><th>Reason</th><th>Decision</th></tr>
        </thead>
        <tbody>
          ${claimsForComp.length === 0 ? `
            <tr><td colspan="6" style="text-align:center;padding:24px;color:var(--muted)">No claims found matching search.</td></tr>
          ` : claimsForComp.map((c) => `
            <tr class="clickable-row" data-comp-claim-id="${c.id}">
              <td class="mono">${c.id}</td>
              <td>${c.createdAt}</td>
              <td class="mono">${c.serial}</td>
              <td><span class="badge ${c.batch === "A47" ? "alert" : "replace"}">${c.batch}</span></td>
              <td>${c.reason}</td>
              <td><button class="badge ${c.decision.toLowerCase()}">${c.decision}</button></td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;

  $("modal-actions").innerHTML = `
    <button class="btn primary" id="btn-comp-test-arbiter">⚡ Adjudicate a ${comp.name} Return</button>
    <button class="btn" id="btn-comp-close">Close</button>
  `;

  const searchInput = $("comp-claim-search");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      openComponentModal(componentId, e.target.value);
    });
  }

  $("modal-body").querySelectorAll("[data-comp-claim-id]").forEach((tr) => {
    tr.addEventListener("click", () => {
      openClaimModal(tr.dataset.compClaimId);
    });
  });

  $("btn-comp-test-arbiter").addEventListener("click", () => {
    closeClaimModal();
    if (comp.id === "left earbud") playDemo("a47");
    else playDemo("reject");
  });

  $("btn-comp-close").addEventListener("click", closeClaimModal);

  $("claim-modal").classList.remove("hidden");
}

function openBatchDetailModal(batchId, searchQuery = "") {
  const batch = ANALYTICS.byBatch.find((b) => b.id === batchId) || ANALYTICS.byBatch[0];
  const q = searchQuery.toLowerCase().trim();
  const claimsForBatch = FLEET.claims.filter((c) => c.batch === batch.id && (!q || `${c.id} ${c.serial} ${c.component} ${c.reason} ${c.decision}`.toLowerCase().includes(q))).slice(0, 30);

  $("modal-claim-id").textContent = `FACTORY BATCH #${batch.id}`;
  $("modal-claim-badge").className = batch.id === "A47" || batch.id === "A48" ? "badge alert" : "badge ok";
  $("modal-claim-badge").textContent = batch.status;
  $("modal-claim-title").textContent = `Batch #${batch.id} · ${batch.factory} (${batch.lotDate})`;

  $("modal-body").innerHTML = `
    <div class="meta-grid">
      <div class="meta-item">
        <div class="meta-label">Manufacturing Facility</div>
        <div class="meta-val">${batch.factory}</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">Lot Production Run</div>
        <div class="meta-val mono">${batch.units.toLocaleString()} units produced</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">Lot Return Rate</div>
        <div class="meta-val" style="color:${batch.rate > 0.1 ? "var(--red)" : "var(--ok)"}">${pct(batch.rate)} (${batch.returns} returns)</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">Quality Status</div>
        <div class="meta-val" style="color:${batch.id === "A47" ? "var(--red)" : "var(--ok)"}">${batch.status}</div>
      </div>
    </div>

    <div class="step" style="background:#faf6f1">
      <h4>Lot Quality Telemetry & SMT Diagnostics:</h4>
      <p style="margin-top:6px;line-height:1.5">
        ${batch.note}. Factory line yield baseline is 4.5%–5.5%. Batch #${batch.id} represents a ${batch.rate > 0.1 ? "statistically significant failure cluster requiring immediate quarantine" : "standard nominal production run within 6-sigma tolerances"}.
      </p>
    </div>

    <div class="reviews-filter-bar">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <span style="font-weight:700;font-size:13px">Returns Recorded for Batch #${batch.id}</span>
        <span class="muted" style="font-size:12px">${batch.returns} total</span>
      </div>
      <input id="batch-claim-search" value="${searchQuery}" placeholder="Filter claims for Batch ${batch.id} by ID, serial, or component..." style="background:#ffffff;border:1px solid rgba(200,145,95,0.28);border-radius:10px;padding:10px 14px;color:var(--text);outline:none;font-size:13px;width:100%" />
    </div>

    <div style="max-height:36vh;overflow-y:auto">
      <table>
        <thead>
          <tr><th>Claim</th><th>Date</th><th>Serial</th><th>Component</th><th>Reason</th><th>Decision</th></tr>
        </thead>
        <tbody>
          ${claimsForBatch.length === 0 ? `
            <tr><td colspan="6" style="text-align:center;padding:24px;color:var(--muted)">No claims found matching search.</td></tr>
          ` : claimsForBatch.map((c) => `
            <tr class="clickable-row" data-batch-claim-id="${c.id}">
              <td class="mono">${c.id}</td>
              <td>${c.createdAt}</td>
              <td class="mono">${c.serial}</td>
              <td>${c.component}</td>
              <td>${c.reason}</td>
              <td><button class="badge ${c.decision.toLowerCase()}">${c.decision}</button></td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;

  $("modal-actions").innerHTML = `
    <button class="btn primary" id="btn-batch-units">🔍 Explore All ${batch.units.toLocaleString()} Units in Batch ${batch.id}</button>
    <button class="btn" id="btn-batch-close">Close</button>
  `;

  const searchInput = $("batch-claim-search");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      openBatchDetailModal(batchId, e.target.value);
    });
  }

  $("modal-body").querySelectorAll("[data-batch-claim-id]").forEach((tr) => {
    tr.addEventListener("click", () => {
      openClaimModal(tr.dataset.batchClaimId);
    });
  });

  $("btn-batch-units").addEventListener("click", () => {
    closeClaimModal();
    openUnitsModal(`PB-${batch.id}`);
  });

  $("btn-batch-close").addEventListener("click", closeClaimModal);

  $("claim-modal").classList.remove("hidden");
}

function openWhyThisMattersModal() {
  $("modal-claim-id").textContent = "WARRANTY ROI & QUALITY INTELLIGENCE";
  $("modal-claim-badge").className = "badge ok";
  $("modal-claim-badge").textContent = "$371,800 Reserves Protected";
  $("modal-claim-title").textContent = "Financial Impact · Precision Lot Isolation vs Broad Recall";

  $("modal-body").innerHTML = `
    <div class="meta-grid" style="grid-template-columns:repeat(3, 1fr)">
      <div class="meta-item">
        <div class="meta-label">Cost per Single RMA</div>
        <div class="meta-val" style="color:var(--ok)">$18.50 average</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">Broad 10k Market Recall</div>
        <div class="meta-val" style="color:var(--red)">$450,000+ brand cost</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">Supplier Chargeback</div>
        <div class="meta-val" style="color:var(--orange)">$78,200 recovered</div>
      </div>
    </div>

    <div class="step" style="background:#faf6f1">
      <h4>Why Lot-Level Return Telemetry Matters:</h4>
      <p style="margin-top:6px;line-height:1.5">
        Without precision warranty arbitration, brands face two costly extremes:
      </p>
      <ul style="margin:8px 0 0;padding-left:18px;font-size:12.5px;color:var(--muted);line-height:1.6">
        <li><strong>Blind Full-Fleet Recall:</strong> Recalling all 10,000 PulseBuds Pro would waste <strong>7,800 perfectly healthy units</strong> across lots B12, B14, and C03 ($371,800 wasted).</li>
        <li><strong>Ignoring the Defect:</strong> Treating Batch A47 returns as random one-off user errors causes customer churn and 1-star review floods (18+ negative reviews on retail channels).</li>
      </ul>
    </div>

    <div class="meta-grid">
      <div class="meta-item">
        <div class="meta-label">Protected Sound Inventory</div>
        <div class="meta-val">7,800 units saved from recall</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">Instant RMA Auto-Approval</div>
        <div class="meta-val" style="color:var(--orange)">Zero-friction for genuine A47 victims</div>
      </div>
    </div>
  `;

  $("modal-actions").innerHTML = `
    <button class="btn primary" id="btn-why-demo">⚡ Run Defect Decision Demo</button>
    <button class="btn" id="btn-why-close">Close</button>
  `;

  $("btn-why-demo").addEventListener("click", () => {
    closeClaimModal();
    playDemo("a47");
  });

  $("btn-why-close").addEventListener("click", closeClaimModal);

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

// Full Dedicated Reviews View
function renderFullReviewsView(starFilter = "all", searchQuery = "") {
  const container = $("reviews-full-container");
  if (!container) return;
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

  const renderStars = (n) => "★".repeat(n) + "☆".repeat(5 - n);

  container.innerHTML = `
    <div class="card" style="margin-bottom:16px">
      <div class="reviews-summary-grid" style="background:transparent;border:none;padding:0">
        <div class="score-box" style="border-right:1px solid var(--line-light)">
          <div class="big-score">${cr.average}</div>
          <div class="stars-row">${renderStars(4)}</div>
          <div class="score-subtitle">100 Verified Purchases</div>
          <div style="margin-top:8px">
            <span class="badge alert" style="font-size:10.5px;padding:3px 8px">⚠️ 18% reported left-driver failure (Lot A47)</span>
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
    </div>

    <div class="card">
      <div class="reviews-filter-bar" style="margin-bottom:14px">
        <input id="full-review-search" value="${searchQuery}" placeholder="Search 100 customer reviews by keyword, name, or lot (e.g. 'bass', 'A47', 'drop', 'battery')..." style="background:#ffffff;border:1px solid rgba(200,145,95,0.28);border-radius:10px;padding:10px 14px;color:var(--text);outline:none;font-size:13px;width:100%" />
        <div class="review-filter-chips">
          <button class="review-filter-chip ${starFilter === "all" ? "active" : ""}" data-full-filter="all">All (${cr.total})</button>
          <button class="review-filter-chip ${starFilter === "5" ? "active" : ""}" data-full-filter="5">5 ★ (${cr.counts[5]})</button>
          <button class="review-filter-chip ${starFilter === "4" ? "active" : ""}" data-full-filter="4">4 ★ (${cr.counts[4]})</button>
          <button class="review-filter-chip ${starFilter === "3" ? "active" : ""}" data-full-filter="3">3 ★ (${cr.counts[3]})</button>
          <button class="review-filter-chip ${starFilter === "2" ? "active" : ""}" data-full-filter="2">2 ★ (${cr.counts[2]})</button>
          <button class="review-filter-chip ${starFilter === "1" ? "active" : ""}" data-full-filter="1">1 ★ (${cr.counts[1]})</button>
          <button class="review-filter-chip ${starFilter === "issue" ? "active" : ""}" data-full-filter="issue" style="color:#ea580c;border-color:rgba(255,102,0,0.3)">⚠️ Left Earbud Defect (${cr.leftIssueCount})</button>
        </div>
      </div>

      <div class="reviews-list" style="max-height:60vh">
        ${filtered.length === 0 ? `
          <div style="text-align:center;padding:32px;color:var(--muted)">No customer reviews found matching your search.</div>
        ` : filtered.map((r) => `
          <div class="review-card">
            <div class="review-header">
              <div class="review-author-info">
                <div class="review-avatar">${r.author.charAt(0)}</div>
                <span class="review-author-name">${r.author}</span>
                <span class="verified-tag">✓ Verified Purchaser</span>
              </div>
              <div class="review-meta-right">
                <span class="review-stars">${renderStars(r.rating)}</span>
                <span class="review-date">${r.date}</span>
                ${r.batch ? `<span class="badge replace" style="font-size:10px;padding:2px 6px">Lot #${r.batch}</span>` : ""}
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
    </div>
  `;

  // Attach search & filter handlers
  const searchInput = $("full-review-search");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      renderFullReviewsView(starFilter, e.target.value);
    });
  }

  container.querySelectorAll("[data-full-filter]").forEach((btn) => {
    btn.addEventListener("click", () => {
      renderFullReviewsView(btn.dataset.fullFilter, searchInput ? searchInput.value : "");
    });
  });

  const a47DemoBtn = $("btn-reviews-a47-demo");
  if (a47DemoBtn) {
    a47DemoBtn.addEventListener("click", () => playDemo("a47"));
  }
}

// Dedicated Batch Lots & Inventory View
function renderLotsView(searchQuery = "") {
  const container = $("lots-cards-container");
  const tableBody = $("lots-unit-table");
  if (!container || !tableBody) return;

  const batches = ANALYTICS.byBatch;
  container.innerHTML = batches.map((b) => `
    <div class="card" style="display:flex;flex-direction:column;justify-content:space-between">
      <div>
        <div style="display:flex;justify-content:space-between;align-items:flex-start">
          <div>
            <div class="label muted">Batch #${b.id}</div>
            <h3 style="margin:4px 0 2px;font-size:18px">${b.factory}</h3>
            <div class="muted" style="font-size:12px">${b.lotDate}</div>
          </div>
          <span class="badge ${b.id === "A47" || b.id === "A48" ? "alert" : "ok"}">${b.status}</span>
        </div>
        <div class="meta-grid" style="margin-top:14px">
          <div class="meta-item">
            <div class="meta-label">Produced</div>
            <div class="meta-val mono">${b.units.toLocaleString()}</div>
          </div>
          <div class="meta-item">
            <div class="meta-label">Return Rate</div>
            <div class="meta-val" style="color:${b.rate > 0.1 ? "var(--red)" : "var(--ok)"}">${pct(b.rate)} (${b.returns})</div>
          </div>
        </div>
        <p class="muted" style="font-size:12px;margin:10px 0 0;line-height:1.4">${b.note}</p>
      </div>
      <div style="display:flex;gap:8px;margin-top:14px">
        <button class="btn primary" style="flex:1;font-size:12px;padding:7px" data-lot-inspect="${b.id}">🔍 Filter Serials</button>
        <button class="btn" style="font-size:12px;padding:7px" onclick="showToast('Stop-Ship Toggled', 'Quarantine policy updated for Lot #${b.id}.', 'info')">${b.id === 'A47' ? 'Quarantined' : 'Quarantine'}</button>
      </div>
    </div>
  `).join("");

  container.querySelectorAll("[data-lot-inspect]").forEach((btn) => {
    btn.addEventListener("click", () => {
      $("lots-unit-search").value = `PB-${btn.dataset.lotInspect}`;
      renderLotsView(`PB-${btn.dataset.lotInspect}`);
    });
  });

  const q = searchQuery.toLowerCase().trim();
  const filteredUnits = FLEET.units.filter((u) => !q || u.serial.toLowerCase().includes(q) || u.batch.toLowerCase().includes(q) || u.channel.toLowerCase().includes(q)).slice(0, 30);

  tableBody.innerHTML = filteredUnits.map((u) => {
    const batchObj = batches.find((b) => b.id === u.batch);
    return `
      <tr>
        <td class="mono" style="font-weight:700">${u.serial}</td>
        <td><span class="badge ${u.batch === 'A47' ? 'alert' : 'replace'}">${u.batch}</span></td>
        <td>${batchObj ? batchObj.factory : 'Facility 1'}</td>
        <td>${u.purchasedAt}</td>
        <td>${u.channel}</td>
        <td><span class="badge ${u.priorClaims > 0 ? 'refund' : 'ok'}">${u.priorClaims > 0 ? 'Returned' : 'In Field'}</span></td>
        <td><button class="badge replace" data-lot-unit="${u.serial}">Load Intake ↗</button></td>
      </tr>
    `;
  }).join("");

  tableBody.querySelectorAll("[data-lot-unit]").forEach((btn) => {
    btn.addEventListener("click", () => {
      setView("intake");
      $("serial").value = btn.dataset.lotUnit;
      onSerial();
      generate(btn.dataset.lotUnit.includes("A47") ? "mfg-left" : "physical");
    });
  });

  const searchInput = $("lots-unit-search");
  if (searchInput && !searchInput.dataset.bound) {
    searchInput.dataset.bound = "true";
    searchInput.addEventListener("input", (e) => {
      renderLotsView(e.target.value);
    });
  }
}

// Dedicated Policy View
function renderPolicyView() {
  const saveBtn = $("btn-save-policy");
  if (saveBtn && !saveBtn.dataset.bound) {
    saveBtn.dataset.bound = "true";
    saveBtn.addEventListener("click", () => {
      const a47Active = $("policy-toggle-a47").checked;
      const crackReject = $("policy-toggle-crack").checked;
      const doaActive = $("policy-toggle-doa").checked;
      const warrantyDays = $("policy-warranty-days").value;
      const doaDays = $("policy-doa-days").value;

      showToast("Policy Engine Configured", `Saved Active Rules: Warranty ${warrantyDays}d, DOA ${doaDays}d, A47 Auto-Replace ${a47Active ? 'Enabled' : 'Disabled'}, Crack Reject ${crackReject ? 'Active' : 'Bypassed'}.`, "success");
    });
  }
}

// User Authentication Logic
function renderAuthUI() {
  const avatarEl = $("sidebar-user-avatar");
  const nameEl = $("sidebar-user-name");
  const roleEl = $("sidebar-user-role");
  const authBtn = $("sidebar-auth-btn");
  const dotEl = $("sidebar-user-dot");

  if (!avatarEl || !nameEl || !roleEl || !authBtn) return;

  if (authState.isLoggedIn) {
    avatarEl.textContent = authState.user.avatar || "SS";
    avatarEl.classList.remove("guest");
    nameEl.textContent = authState.user.name;
    roleEl.textContent = authState.user.role;
    authBtn.textContent = "Log out";
    if (dotEl) dotEl.style.display = "block";
  } else {
    avatarEl.textContent = "GU";
    avatarEl.classList.add("guest");
    nameEl.textContent = "Guest User";
    roleEl.textContent = "Read-Only Access";
    authBtn.textContent = "Log in";
    if (dotEl) dotEl.style.display = "none";
  }
}

function openAuthModal() {
  const modal = $("auth-modal");
  const body = $("auth-modal-body");
  const actions = $("auth-modal-actions");
  const title = $("auth-modal-title");
  const badge = $("auth-modal-badge");
  if (!modal || !body || !actions) return;

  if (authState.isLoggedIn) {
    title.textContent = "Active Session & Profile";
    badge.className = "badge ok";
    badge.textContent = "Authenticated";

    body.innerHTML = `
      <div style="display:flex;align-items:center;gap:14px;padding:14px;background:#faf6f1;border-radius:14px;border:1px solid var(--line-light)">
        <div class="user-avatar" style="width:48px;height:48px;font-size:16px">${authState.user.avatar}</div>
        <div>
          <div style="font-weight:800;font-size:16px;color:var(--text)">${authState.user.name}</div>
          <div class="muted" style="font-size:13px">${authState.user.email}</div>
          <div style="margin-top:4px"><span class="badge replace">${authState.user.role}</span></div>
        </div>
      </div>

      <div class="meta-grid">
        <div class="meta-item">
          <div class="meta-label">Session ID</div>
          <div class="meta-val mono" style="font-size:12px">${authState.user.token}</div>
        </div>
        <div class="meta-item">
          <div class="meta-label">Authority Level</div>
          <div class="meta-val" style="color:var(--ok)">Full Policy Admin</div>
        </div>
      </div>

      <div class="step" style="background:#faf6f1">
        <h4>Assigned Permissions:</h4>
        <ul style="margin:6px 0 0;padding-left:18px;font-size:12.5px;color:var(--muted);line-height:1.5">
          <li>✓ Real-time on-device computer vision execution</li>
          <li>✓ Batch lot quarantine & stop-ship override</li>
          <li>✓ Zero-cost RMA replacement dispatch</li>
          <li>✓ Full claim history CSV export</li>
        </ul>
      </div>

      <div style="margin-top:6px">
        <label class="muted" style="font-size:12px;font-weight:600">Quick-Switch Operational Persona:</label>
        <div style="display:flex;gap:8px;margin-top:6px;flex-wrap:wrap">
          <button class="btn" style="font-size:11.5px;padding:6px 10px" id="auth-switch-analyst">🔍 Claims Analyst (Priya)</button>
          <button class="btn" style="font-size:11.5px;padding:6px 10px" id="auth-switch-quality">🛠️ Quality Lead (Marcus)</button>
        </div>
      </div>
    `;

    actions.innerHTML = `
      <button class="btn danger" id="auth-modal-logout-btn">🚪 Sign Out</button>
      <button class="btn" id="auth-modal-close-action">Close</button>
    `;

    $("auth-modal-logout-btn").addEventListener("click", () => {
      logoutUser();
      closeAuthModal();
    });
    $("auth-modal-close-action").addEventListener("click", closeAuthModal);

    $("auth-switch-analyst").addEventListener("click", () => {
      loginUser({
        name: "Priya Reddy",
        email: "priya.r@indi-arbiter.io",
        role: "RMA Claims Analyst",
        avatar: "PR",
        token: "ARB-AUTH-77192"
      });
      closeAuthModal();
    });

    $("auth-switch-quality").addEventListener("click", () => {
      loginUser({
        name: "Marcus Vance",
        email: "marcus.v@indi-arbiter.io",
        role: "Quality Lead Engineer",
        avatar: "MV",
        token: "ARB-AUTH-66014"
      });
      closeAuthModal();
    });
  } else {
    title.textContent = "Sign In to Indi Arbiter";
    badge.className = "badge alert";
    badge.textContent = "Guest Access";

    body.innerHTML = `
      <div class="field">
        <label>Work Email</label>
        <input id="auth-input-email" type="email" value="suyash@indi-arbiter.io" />
      </div>
      <div class="field">
        <label>Password</label>
        <input id="auth-input-pass" type="password" value="••••••••••••" />
      </div>

      <div style="margin:12px 0 6px">
        <label class="muted" style="font-size:12px;font-weight:600">Or Quick-Login with Demo Profile:</label>
        <div style="display:flex;flex-direction:column;gap:6px;margin-top:6px">
          <button class="btn" style="text-align:left;font-size:12px;display:flex;justify-content:space-between" id="auth-quick-admin">
            <span>👑 <strong>Suyash Sharma</strong> (Operations Admin)</span>
            <span class="badge ok">1-Click</span>
          </button>
          <button class="btn" style="text-align:left;font-size:12px;display:flex;justify-content:space-between" id="auth-quick-analyst">
            <span>🔍 <strong>Priya Reddy</strong> (Claims Analyst)</span>
            <span class="badge replace">1-Click</span>
          </button>
          <button class="btn" style="text-align:left;font-size:12px;display:flex;justify-content:space-between" id="auth-quick-quality">
            <span>🛠️ <strong>Marcus Vance</strong> (Quality Lead)</span>
            <span class="badge replace">1-Click</span>
          </button>
        </div>
      </div>
    `;

    actions.innerHTML = `
      <button class="btn primary" id="auth-modal-login-btn">🔑 Sign In</button>
      <button class="btn" id="auth-modal-close-action">Cancel</button>
    `;

    $("auth-modal-login-btn").addEventListener("click", () => {
      const email = $("auth-input-email").value || "suyash@indi-arbiter.io";
      loginUser({
        name: email.split("@")[0].charAt(0).toUpperCase() + email.split("@")[0].slice(1),
        email,
        role: "Operations Admin",
        avatar: "SA",
        token: `ARB-AUTH-${Math.floor(10000 + Math.random() * 90000)}`
      });
      closeAuthModal();
    });

    $("auth-quick-admin").addEventListener("click", () => {
      loginUser({
        name: "Suyash Sharma",
        email: "suyash@indi-arbiter.io",
        role: "Operations Admin",
        avatar: "SS",
        token: "ARB-AUTH-88421"
      });
      closeAuthModal();
    });

    $("auth-quick-analyst").addEventListener("click", () => {
      loginUser({
        name: "Priya Reddy",
        email: "priya.r@indi-arbiter.io",
        role: "RMA Claims Analyst",
        avatar: "PR",
        token: "ARB-AUTH-77192"
      });
      closeAuthModal();
    });

    $("auth-quick-quality").addEventListener("click", () => {
      loginUser({
        name: "Marcus Vance",
        email: "marcus.v@indi-arbiter.io",
        role: "Quality Lead Engineer",
        avatar: "MV",
        token: "ARB-AUTH-66014"
      });
      closeAuthModal();
    });

    $("auth-modal-close-action").addEventListener("click", closeAuthModal);
  }

  modal.classList.remove("hidden");
}

function closeAuthModal() {
  const modal = $("auth-modal");
  if (modal) modal.classList.add("hidden");
}

function loginUser(userObj) {
  authState.isLoggedIn = true;
  authState.user = userObj;
  renderAuthUI();
  showToast("Welcome Back!", `Signed in as ${userObj.name} (${userObj.role}).`, "success");
}

function logoutUser() {
  authState.isLoggedIn = false;
  renderAuthUI();
  showToast("Signed Out", "You are now in guest read-only mode.", "info");
}

// CSV Export Utility
function exportClaimsCSV() {
  const headers = ["Claim ID", "Created Date", "Serial Number", "Batch ID", "Component", "Customer Reason", "Decision", "Root Cause Analysis"];
  const rows = FLEET.claims.map((c) => [
    c.id,
    c.createdAt,
    c.serial,
    c.batch,
    `"${c.component}"`,
    `"${c.reason}"`,
    c.decision,
    `"${c.rootCause || 'Evaluated by Arbiter'}"`
  ]);

  const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `indi_arbiter_claims_10k_${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showToast("CSV Export Complete", `Downloaded ${FLEET.claims.length.toLocaleString()} claim records.`, "success");
}

// Global Event Listeners & Bindings
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

const authModalClose = $("auth-modal-close-btn");
if (authModalClose) authModalClose.addEventListener("click", closeAuthModal);
const authModalOverlay = $("auth-modal");
if (authModalOverlay) {
  authModalOverlay.addEventListener("click", (e) => {
    if (e.target === authModalOverlay) closeAuthModal();
  });
}

window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeClaimModal();
    closeAuthModal();
  }
});

// Sidebar Interactive Controls
const sidebarInput = $("sidebar-serial-input");
if (sidebarInput) {
  sidebarInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && sidebarInput.value.trim()) {
      setView("intake");
      $("serial").value = sidebarInput.value.trim();
      onSerial();
      generate("mfg-left");
      showToast("Serial Loaded", `Loaded ${sidebarInput.value.trim()} into Intake Arbiter.`, "info");
      sidebarInput.value = "";
    }
  });
}

const sidebarA47 = $("sidebar-btn-a47");
if (sidebarA47) sidebarA47.addEventListener("click", () => playDemo("a47"));

const sidebarDamage = $("sidebar-btn-damage");
if (sidebarDamage) sidebarDamage.addEventListener("click", () => playDemo("reject"));

const sidebarExport = $("sidebar-btn-export");
if (sidebarExport) sidebarExport.addEventListener("click", exportClaimsCSV);

const histExport = $("btn-export-history");
if (histExport) histExport.addEventListener("click", exportClaimsCSV);

const userCard = $("sidebar-user-card");
if (userCard) {
  userCard.addEventListener("click", (e) => {
    if (e.target.id === "sidebar-auth-btn") {
      if (authState.isLoggedIn) logoutUser();
      else openAuthModal();
    } else {
      openAuthModal();
    }
  });
}

const brandLogo = $("brand-logo-btn");
if (brandLogo) brandLogo.addEventListener("click", () => setView("intel"));

// App Initialization
renderAuthUI();
renderKpis();
renderChips();
renderHistory();
$("serial").value = "PB-A47-01041";
onSerial();


