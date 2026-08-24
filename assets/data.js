const PRODUCTS = {
  "PULSE-BUDS-PRO": {
    name: "PulseBuds Pro",
    category: "True wireless earbuds",
    warrantyDays: 365,
    returnWindowDays: 14,
    msrp: 129,
    covered: ["manufacturing defect", "driver failure", "pairing failure", "battery capacity < 70%"],
    excluded: ["physical impact", "liquid ingress from user mishandling", "unauthorized repair"]
  }
};

function seeded(n) {
  let x = Math.sin(n) * 10000;
  return x - Math.floor(x);
}

function buildFleet() {
  const batches = [
    { id: "A47", units: 2200, defectRate: 0.32, laterality: "left" },
    { id: "B12", units: 4100, defectRate: 0.058, laterality: "right" },
    { id: "C03", units: 3700, defectRate: 0.048, laterality: "both" }
  ];
  const units = [];
  const claims = [];
  let serial = 1000;
  const now = Date.now();

  batches.forEach((batch, bi) => {
    for (let i = 0; i < batch.units; i++) {
      const s = `PB-${batch.id}-${String(serial++).padStart(5, "0")}`;
      const ageDays = Math.floor(20 + seeded(i + bi * 99) * 320);
      const purchased = new Date(now - ageDays * 86400000);
      const unit = {
        serial: s,
        sku: "PULSE-BUDS-PRO",
        batch: batch.id,
        purchasedAt: purchased.toISOString().slice(0, 10),
        channel: seeded(i) > 0.5 ? "Retail" : "Direct",
        priorClaims: 0
      };
      units.push(unit);

      const returned = seeded(i + 7) < batch.defectRate;
      if (returned) {
                const leftBias = batch.id === "A47" ? 0.91 : 0.12;
        const component = seeded(i + 3) < leftBias ? "left earbud" : (seeded(i + 11) < 0.5 ? "right earbud" : "charging case");
        const reason = component.includes("earbud") && batch.id === "A47"
          ? "No audio / driver dead"
          : component === "charging case"
            ? "Case not charging"
            : "Intermittent disconnect";
        claims.push({
          id: `CLM-${10000 + claims.length}`,
          serial: s,
          batch: batch.id,
          component,
          reason,
          decision: batch.id === "A47" ? "Replace" : "Repair",
          createdAt: new Date(purchased.getTime() + (10 + seeded(i) * 40) * 86400000).toISOString().slice(0, 10)
        });
        unit.priorClaims = 1;
      }
    }
  });

  const demoUnits = [
    {
      serial: "PB-A47-01041",
      sku: "PULSE-BUDS-PRO",
      batch: "A47",
      purchasedAt: "2026-03-12",
      channel: "Direct",
      priorClaims: 0,
      demo: "mfg-left"
    },
    {
      serial: "PB-B12-03210",
      sku: "PULSE-BUDS-PRO",
      batch: "B12",
      purchasedAt: "2025-01-08",
      channel: "Retail",
      priorClaims: 1,
      demo: "physical"
    },
    {
      serial: "PB-C03-07320",
      sku: "PULSE-BUDS-PRO",
      batch: "C03",
      purchasedAt: "2026-08-12",
      channel: "Direct",
      priorClaims: 0,
      demo: "doa"
    }
  ];
  demoUnits.forEach((u) => {
    const idx = units.findIndex((x) => x.serial === u.serial);
    if (idx >= 0) units[idx] = { ...units[idx], ...u };
    else units.push(u);
  });

  return { units, claims, batches };
}

const FLEET = buildFleet();

function analyticsFromFleet() {
  const returns = FLEET.claims;
  const left = returns.filter((c) => c.component === "left earbud");
  const leftA47 = left.filter((c) => c.batch === "A47");
  return {
    produced: FLEET.units.length,
    returns: returns.length,
    leftShare: left.length / returns.length,
    leftFromA47: leftA47.length / left.length,
    byBatch: FLEET.batches.map((b) => {
      const count = returns.filter((c) => c.batch === b.id).length;
      return { id: b.id, units: b.units, returns: count, rate: count / b.units };
    }),
    byComponent: ["left earbud", "right earbud", "charging case"].map((name) => ({
      name,
      count: returns.filter((c) => c.component === name).length
    }))
  };
}

const ANALYTICS = analyticsFromFleet();
