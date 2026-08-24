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
    { id: "A47", units: 2200, defectRate: 0.34, laterality: "left", factory: "Shenzhen Line 2", lotDate: "Mar 2026", note: "Critical Left Driver Solder Fatigue", status: "Stop-Ship Active" },
    { id: "A48", units: 1800, defectRate: 0.16, laterality: "left", factory: "Shenzhen Line 2", lotDate: "Apr 2026", note: "Moderate Driver Solder Spillover", status: "Under Monitoring" },
    { id: "B12", units: 2400, defectRate: 0.058, laterality: "right", factory: "Dongguan Line 1", lotDate: "Jan 2025", note: "Nominal Baseline Performance", status: "Normal Yield" },
    { id: "B14", units: 1700, defectRate: 0.052, laterality: "both", factory: "Dongguan Line 1", lotDate: "Feb 2025", note: "Nominal Baseline Performance", status: "Normal Yield" },
    { id: "C03", units: 1900, defectRate: 0.042, laterality: "both", factory: "Hai Phong Line 4", lotDate: "Aug 2026", note: "Top Reliability / Golden Sample Lot", status: "Golden Lot" }
  ];

  const componentsCatalog = [
    { id: "left earbud", name: "Left earbud (driver)", defaultReason: "No audio / driver dead", rootCause: "Solder fatigue at voice coil lead termination under thermal cycle." },
    { id: "right earbud", name: "Right earbud (driver)", defaultReason: "Driver distortion / mute", rootCause: "Mechanical diaphragm misalignment from drop impact." },
    { id: "charging case", name: "Charging case (power)", defaultReason: "Case not charging / dead battery", rootCause: "PMIC over-discharge protection latch-up." },
    { id: "anc microphone", name: "ANC microphone array", defaultReason: "Hissing noise / ANC oscillation", rootCause: "Feedforward MEMS microphone membrane contamination." },
    { id: "touch sensor", name: "Touch sensor stem", defaultReason: "Unresponsive touch / phantom taps", rootCause: "Capacitive ITO flex trace micro-fracture." },
    { id: "pogo pin contacts", name: "Pogo pin contacts", defaultReason: "Earbud won't connect in cradle", rootCause: "Surface plating oxidation / spring fatigue." },
    { id: "bluetooth antenna", name: "Bluetooth 5.3 RF module", defaultReason: "Intermittent audio drops / range < 2m", rootCause: "Ceramic chip antenna impedance mismatch." },
    { id: "silicone seal", name: "IPX5 ingress seal", defaultReason: "Moisture ingress after sweat exposure", rootCause: "Acoustic mesh adhesive delamination." }
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
        let compObj;
        if (batch.id === "A47") {
          compObj = seeded(i + 3) < 0.88 ? componentsCatalog[0] : componentsCatalog[1 + Math.floor(seeded(i + 13) * 7)];
        } else if (batch.id === "A48") {
          compObj = seeded(i + 3) < 0.60 ? componentsCatalog[0] : componentsCatalog[1 + Math.floor(seeded(i + 13) * 7)];
        } else {
          compObj = componentsCatalog[Math.floor(seeded(i + 13) * componentsCatalog.length)];
        }

        const reason = compObj.defaultReason;
        const decision = (batch.id === "A47" || batch.id === "A48") && compObj.id === "left earbud"
          ? "Replace"
          : compObj.id === "charging case"
            ? "Replace"
            : compObj.id.includes("earbud")
              ? "Repair"
              : "Repair";

        claims.push({
          id: `CLM-${10000 + claims.length}`,
          serial: s,
          batch: batch.id,
          component: compObj.id,
          componentName: compObj.name,
          reason,
          decision,
          rootCause: compObj.rootCause,
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

  return { units, claims, batches, componentsCatalog };
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
      return {
        id: b.id,
        units: b.units,
        returns: count,
        rate: count / b.units,
        factory: b.factory,
        lotDate: b.lotDate,
        note: b.note,
        status: b.status
      };
    }),
    byComponent: FLEET.componentsCatalog.map((comp) => {
      const count = returns.filter((c) => c.component === comp.id).length;
      return {
        id: comp.id,
        name: comp.name,
        count,
        rate: count / returns.length,
        rootCause: comp.rootCause,
        defaultReason: comp.defaultReason
      };
    })
  };
}

const ANALYTICS = analyticsFromFleet();

function buildCustomerReviews() {
  const firstNames = [
    "Aarav", "Ananya", "Rohan", "Priya", "Vikram", "Neha", "Aditya", "Sneha", "Kunal", "Pooja",
    "Rahul", "Divya", "Siddharth", "Meera", "Kabir", "Tanvi", "Arjun", "Kavya", "Varun", "Isha",
    "Sarah", "Marcus", "Elena", "David", "Chloe", "Liam", "Maya", "Daniel", "Zoe", "James"
  ];
  const lastNames = [
    "Sharma", "Patel", "Verma", "Mehta", "Iyer", "Nair", "Reddy", "Gupta", "Kapoor", "Chopra",
    "Deshmukh", "Bhat", "Joshi", "Saxena", "Malhotra", "Jenkins", "Vance", "Chen", "Miller", "Taylor"
  ];

  const positiveTemplates = [
    { title: "Incredible soundstage and punchy deep bass!", body: "These earbuds completely exceeded my expectations. The acoustic clarity and low-end bass punch are on par with headphones twice the price. Active noise cancellation is top tier.", tag: "Sound Quality" },
    { title: "Great fit for gym and running workouts", body: "Stayed firmly in my ears during a 10k run. Sweat resistance works as advertised and the transparency mode is great for outdoor awareness.", tag: "Fit & Workout" },
    { title: "Battery life easily lasts through whole workdays", body: "Charging case is sleek and compact. I get around 7.5 hours on a single charge with ANC enabled. Fast USB-C charging is super convenient.", tag: "Battery Life" },
    { title: "Seamless multipoint Bluetooth pairing", body: "Switches effortlessly between my MacBook and iPhone. Call microphone quality is crisp even in noisy coffee shops.", tag: "Connectivity" },
    { title: "Premium look and feel, very comfortable", body: "The matte finish feels luxurious. Ear tips don't cause ear fatigue even after 4 hours of continuous meetings.", tag: "Design & Comfort" },
    { title: "Good ANC, crisp mids and highs", body: "Sound quality is 9/10 and the noise cancellation blocks train noise effectively. App controls are fast and intuitive.", tag: "Sound Quality" },
    { title: "Solid everyday wireless earbuds", body: "Purchased these for daily commute. Case charges quickly, connectivity is instantaneous, and audio profile is rich.", tag: "General" }
  ];

  const neutralTemplates = [
    { title: "Decent earbuds, occasional Bluetooth reconnect", body: "Audio quality is good and battery is fine, but had to re-pair once after a firmware update.", tag: "Connectivity" },
    { title: "Good sound but case hinge feels a bit light", body: "Sound reproduction is balanced and punchy. Case lid could feel a bit sturdier for the price tag.", tag: "Build Quality" },
    { title: "Average microphone in windy outdoor conditions", body: "Indoor voice calls are crystal clear, but outside in wind the background noise suppression can sound slightly robotic.", tag: "Mic & Calls" }
  ];

  const issueTemplates = [
    { title: "Left earbud stopped playing audio after 3 weeks!", body: "Loved the sound initially, but out of nowhere the left earbud went completely silent. Housing is pristine and never dropped. Seems like a batch issue.", tag: "Left Earbud Issue", batch: "A47" },
    { title: "Dead left driver — zero sound output", body: "Right earbud works fine, but left earbud has zero volume. Resetting didn't fix it. Filing a warranty return now.", tag: "Left Earbud Issue", batch: "A47" },
    { title: "Left side died suddenly without any drop or damage", body: "Bought Batch A47. Sound cut out on the left channel yesterday. App shows it connected but driver is dead.", tag: "Left Earbud Issue", batch: "A47" },
    { title: "Audio imbalance developed, then left went completely mute", body: "Started with low volume on left earbud and now totally silent. Right side still works. Hoping customer support replaces it quickly.", tag: "Left Earbud Issue", batch: "A47" },
    { title: "Case wouldn't hold charge after two months", body: "Earbuds are great but the charging case led started blinking amber and won't charge overnight.", tag: "Charging Case", batch: "B12" },
    { title: "Left driver failed after 18 days of gentle use", body: "No drops or water exposure. Left earbud driver hardware just stopped vibrating. Definite manufacturing defect.", tag: "Left Earbud Issue", batch: "A47" }
  ];

  const reviews = [];
  for (let i = 0; i < 100; i++) {
    const fn = firstNames[(i * 7 + 3) % firstNames.length];
    const ln = lastNames[(i * 11 + 5) % lastNames.length];
    const author = `${fn} ${ln.charAt(0)}.`;
    const daysAgo = Math.floor(2 + (i * 1.7));
    const d = new Date(Date.now() - daysAgo * 86400000);
    const dateStr = d.toISOString().slice(0, 10);
    const helpful = Math.floor(seeded(i * 31) * 24) + 1;

    let item;
    let rating;
    // Distribution: 48 5-stars, 26 4-stars, 8 3-stars, 6 2-stars, 12 1-stars (Total = 100)
    if (i < 48) {
      rating = 5;
      const t = positiveTemplates[i % 4];
      item = { ...t, batch: i % 2 === 0 ? "C03" : "B12" };
    } else if (i < 74) {
      rating = 4;
      const t = positiveTemplates[4 + ((i - 48) % 3)];
      item = { ...t, batch: i % 2 === 0 ? "B12" : "C03" };
    } else if (i < 82) {
      rating = 3;
      const t = neutralTemplates[(i - 74) % neutralTemplates.length];
      item = { ...t, batch: "B12" };
    } else if (i < 88) {
      rating = 2;
      const t = issueTemplates[3 + ((i - 82) % 2)];
      item = { ...t, batch: t.batch || "A47" };
    } else {
      rating = 1;
      const t = issueTemplates[(i - 88) % issueTemplates.length];
      item = { ...t, batch: t.batch || "A47" };
    }

    reviews.push({
      id: `REV-${1000 + i}`,
      author,
      rating,
      title: item.title,
      content: item.body,
      tag: item.tag,
      batch: item.batch,
      date: dateStr,
      verified: true,
      helpful
    });
  }

  const counts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  let totalRating = 0;
  reviews.forEach((r) => {
    counts[r.rating]++;
    totalRating += r.rating;
  });

  const avg = (totalRating / reviews.length).toFixed(1);

  return {
    reviews,
    total: reviews.length,
    average: avg,
    counts,
    leftIssueCount: reviews.filter((r) => r.tag === "Left Earbud Issue").length
  };
}

const CUSTOMER_REVIEWS = buildCustomerReviews();

