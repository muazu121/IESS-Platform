const BRANDS = [
  "Felicity",
  "Deye",
  "Growatt",
  "Victron",
  "Luminous",
  "Jinko",
  "Canadian Solar",
  "JA Solar",
  "LONGi",
  "Trina Solar",
  "Pylontech",
  "BYD",
  "BlueCarbon",
];

const FALLBACK = {
  ok: true,
  live: false,
  mode: "benchmark",
  currency: "NGN",
  updatedAt: "2026-10-26T00:00:00.000Z",
  source: "IESS Nigerian market benchmark",
  sourceUrl: "https://iess-platform.vercel.app/portal",
  brands: BRANDS,
  items: [],
  message:
    "No official retailer price-feed URL is configured. The calculator is using the saved IESS benchmark prices until a trusted feed is connected.",
};

function normalizeFeed(feed) {
  if (!feed || !Array.isArray(feed.items)) {
    throw new Error("Price feed must include an items array.");
  }

  const allowedCategories = new Set(["inverter", "battery", "panel"]);
  const items = feed.items
    .slice(0, 500)
    .map((item) => {
      const category = String(item.category || "").toLowerCase();
      const price = Number(item.price);
      if (!allowedCategories.has(category) || !Number.isFinite(price) || price <= 0) {
        return null;
      }
      return {
        category,
        brand: String(item.brand || "").trim(),
        model: String(item.model || "").trim(),
        type: String(item.type || "").trim(),
        voltage: Number(item.voltage) || null,
        capacityAh: Number(item.capacityAh) || null,
        watts: Number(item.watts) || null,
        price: Math.round(price),
        retailer: String(item.retailer || "").trim(),
        url: String(item.url || "").trim(),
        observedAt: String(item.observedAt || feed.updatedAt || "").trim(),
      };
    })
    .filter(Boolean);

  return {
    ok: true,
    live: true,
    mode: "live",
    currency: String(feed.currency || "NGN"),
    updatedAt: String(feed.updatedAt || new Date().toISOString()),
    source: String(feed.source || "External Nigerian market feed"),
    sourceUrl: String(feed.sourceUrl || ""),
    brands: Array.isArray(feed.brands) && feed.brands.length ? feed.brands.map(String) : BRANDS,
    items,
    message: "Current prices received from the configured market feed.",
  };
}

module.exports = async function handler(request, response) {
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "private, no-store, max-age=0");

  const feedUrl = process.env.SOLAR_PRICE_FEED_URL;
  if (!feedUrl) {
    response.status(200).send(JSON.stringify(FALLBACK));
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const headers = { Accept: "application/json", "User-Agent": "IESS-Market-Price-Service/1.0" };
    if (process.env.SOLAR_PRICE_FEED_TOKEN) {
      headers.Authorization = `Bearer ${process.env.SOLAR_PRICE_FEED_TOKEN}`;
    }

    const upstream = await fetch(feedUrl, {
      headers,
      signal: controller.signal,
    });

    if (!upstream.ok) {
      throw new Error(`Price feed returned HTTP ${upstream.status}.`);
    }

    const feed = await upstream.json();
    response.status(200).send(JSON.stringify(normalizeFeed(feed)));
  } catch (error) {
    response.status(200).send(
      JSON.stringify({
        ...FALLBACK,
        message:
          "The live market feed is temporarily unavailable. The calculator is using the saved IESS benchmark prices.",
        error: error instanceof Error ? error.message : "Unknown price-feed error",
      })
    );
  } finally {
    clearTimeout(timeout);
  }
};
