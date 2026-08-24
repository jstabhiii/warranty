function daysBetween(isoDate, now = new Date()) {
  const a = new Date(isoDate);
  return Math.floor((now - a) / 86400000);
}

function lookupUnit(serial) {
  return FLEET.units.find((u) => u.serial.toLowerCase() === String(serial || "").trim().toLowerCase());
}

function decideClaim({ unit, vision, symptom, customerAsk }) {
  const product = PRODUCTS[unit.sku];
  const age = daysBetween(unit.purchasedAt);
  const inReturnWindow = age <= product.returnWindowDays;
  const inWarranty = age <= product.warrantyDays;
  const batchStats = ANALYTICS.byBatch.find((b) => b.id === unit.batch);
  const batchFlagged = batchStats && batchStats.rate > 0.08;
  const leftCluster = ANALYTICS.leftShare > 0.5 && ANALYTICS.leftFromA47 > 0.8;
  const manufacturingSignal =
    (!vision.visibleDamage && (symptom === "left-silent" || vision.laterality === "left" && vision.damageClass === "no_visible_damage")) ||
    (batchFlagged && vision.laterality === "left" && unit.batch === "A47");

  const reasons = [];
  reasons.push(`Purchase ${unit.purchasedAt} · ${age} days ago · warranty ${product.warrantyDays}d (${inWarranty ? "active" : "expired"}).`);
  reasons.push(`Serial ${unit.serial} maps to manufacturing batch ${unit.batch} (batch return rate ${(batchStats.rate * 100).toFixed(1)}%).`);
  reasons.push(`Vision (${Math.round(vision.confidence * 100)}%): ${vision.notes}`);
  if (unit.priorClaims) reasons.push(`Prior claims on this serial: ${unit.priorClaims}.`);

  let action = "Reject";
  let title = "Warranty rejected";
  let detail = "";
  let policy = "";

  if (vision.damageClass === "physical_impact" || vision.damageClass === "liquid" || symptom === "cracked") {
    action = "Reject";
    title = "Warranty rejected";
    detail = inWarranty
      ? "Physical damage is excluded from covered defects. Paid repair can be offered."
      : "Physical damage outside warranty. Housing fracture plus a lapsed term — this is mishandling, not a manufacturing defect.";
    policy = "Exclusion: impact / mishandling";
  } else if (inReturnWindow && (symptom === "doa" || vision.damageClass === "no_visible_damage")) {
    action = "Refund";
    title = "Refund approved";
    detail = "Dead-on-arrival inside the 14-day return window. Fastest resolution is a full refund.";
    policy = "DOA / cooling-off policy";
  } else if (!inWarranty && !batchFlagged) {
    action = "Reject";
    title = "Warranty rejected";
    detail = "Coverage window has closed and there is no active latent-defect bulletin for this batch.";
    policy = "Standard warranty term";
  } else if (manufacturingSignal && inWarranty) {
    action = batchFlagged && leftCluster ? "Replace" : "Repair";
    title = action === "Replace" ? "Warranty approved · Replacement" : "Warranty approved · Repair";
    detail = batchFlagged
      ? `Fleet pattern: ${(ANALYTICS.leftShare * 100).toFixed(0)}% of returns cite the left earbud; ${(ANALYTICS.leftFromA47 * 100).toFixed(0)}% of those are batch ${unit.batch}. Treat as manufacturing defect, not user abuse.`
      : "In-warranty functional failure without visible trauma. Route to repair.";
    policy = "Covered manufacturing defect";
  } else if (inWarranty && customerAsk === "refund") {
    action = "Repair";
    title = "Repair offered";
    detail = "Refund is not automatic after the return window. Functional issue is eligible for repair.";
    policy = "Post-window remedy hierarchy";
  } else if (inWarranty) {
    action = "Repair";
    title = "Warranty approved · Repair";
    detail = "In-warranty functional complaint. No batch-level defect match.";
    policy = "Standard in-warranty repair";
  } else {
    action = "Reject";
    title = "Warranty rejected";
    detail = "No remaining coverage and evidence does not support a safety or latent-defect exception.";
    policy = "Coverage exhausted";
  }

  const fleetAlert = batchFlagged && unit.batch === "A47" && vision.laterality === "left";

  return {
    action,
    title,
    detail,
    policy,
    reasons,
    inWarranty,
    inReturnWindow,
    age,
    fleetAlert,
    confidence: Math.min(0.97, 0.62 + vision.confidence * 0.28 + (batchFlagged ? 0.08 : 0))
  };
}
