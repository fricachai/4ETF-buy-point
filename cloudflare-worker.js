export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsJsonHeaders(),
      });
    }

    if (url.pathname === "/api/twse-stock-day") {
      return handleTwseStockDay(url);
    }

    if (url.pathname === "/api/twse-quote") {
      return handleTwseQuote(url);
    }

    if (url.pathname === "/api/taiex-chart") {
      return handleTaiexChart(url);
    }

    return new Response("Not Found", { status: 404 });
  },
};

async function handleTwseStockDay(url) {
  const date = url.searchParams.get("date");
  const stockNo = url.searchParams.get("stockNo");

  if (!date || !stockNo) {
    return json({ stat: "ERROR", message: "Missing date or stockNo" }, 400);
  }

  const upstream = new URL("https://www.twse.com.tw/exchangeReport/STOCK_DAY");
  upstream.searchParams.set("response", "json");
  upstream.searchParams.set("date", date);
  upstream.searchParams.set("stockNo", stockNo);

  return proxyJson(upstream, {
    accept: "application/json,text/plain,*/*",
    "user-agent": "Mozilla/5.0",
    referer: "https://www.twse.com.tw/",
    origin: "https://www.twse.com.tw",
  });
}

async function handleTwseQuote(url) {
  const exCh = url.searchParams.get("ex_ch");

  if (!exCh) {
    return json({ rtcode: "9999", rtmessage: "Missing ex_ch", msgArray: [] }, 400);
  }

  const upstream = new URL("https://mis.twse.com.tw/stock/api/getStockInfo.jsp");
  upstream.searchParams.set("json", "1");
  upstream.searchParams.set("delay", "0");
  upstream.searchParams.set("ex_ch", exCh);
  upstream.searchParams.set("_", url.searchParams.get("_") || String(Date.now()));

  return proxyJson(upstream, {
    accept: "application/json,text/plain,*/*",
    "user-agent": "Mozilla/5.0",
    referer: "https://mis.twse.com.tw/stock/index.jsp",
    origin: "https://mis.twse.com.tw",
    pragma: "no-cache",
    "cache-control": "no-cache",
  }, 0);

  if (response.ok) return response;
  return handleYahooTwQuoteFallback(exCh);
}

async function handleYahooTwQuoteFallback(exCh) {
  const symbols = getYahooSymbolsFromExCh(exCh);
  if (!symbols.length) {
    return json({ rtcode: "9999", rtmessage: "No supported quote symbols", msgArray: [] }, 502);
  }

  const upstream = new URL("https://tw.stock.yahoo.com/_td-stock/api/resource/StockServices.stockList;symbols=" + symbols.join(","));
  try {
    const response = await fetch(upstream.toString(), {
      headers: {
        accept: "application/json,text/plain,*/*",
        "user-agent": "Mozilla/5.0",
        referer: "https://tw.stock.yahoo.com/",
        origin: "https://tw.stock.yahoo.com",
        pragma: "no-cache",
        "cache-control": "no-cache",
      },
      cf: {
        cacheTtl: 0,
        cacheEverything: false,
      },
    });
    if (!response.ok) {
      return json({ rtcode: "9999", rtmessage: `Yahoo fallback HTTP ${response.status}`, msgArray: [] }, 502);
    }
    const rows = await response.json();
    const msgArray = Array.isArray(rows) ? rows.map(normalizeYahooQuote).filter(Boolean) : [];
    return json({
      msgArray,
      referer: "https://tw.stock.yahoo.com/",
      userDelay: 5000,
      rtcode: "0000",
      rtmessage: "OK",
      source: "yahoo-tw-fallback",
      queryTime: {
        sysDate: formatTaipeiDateKey(new Date()),
        sysTime: formatTaipeiTime(new Date()),
      },
    });
  } catch (error) {
    return json(
      {
        rtcode: "9999",
        rtmessage: error instanceof Error ? error.message : "Yahoo fallback fetch failed",
        msgArray: [],
      },
      502,
    );
  }
}

function getYahooSymbolsFromExCh(exCh) {
  return exCh
    .split("|")
    .map((part) => {
      const channel = part.trim();
      if (!channel) return "";
      if (channel === "tse_t00.tw" || channel === "t00.tw") return "^TWII";
      const match = channel.match(/^tse_([0-9A-Z]+)\.tw$/i);
      if (!match) return "";
      return `${match[1].toUpperCase()}.TW`;
    })
    .filter(Boolean);
}

function normalizeYahooQuote(row) {
  const symbol = String(row?.symbol || "");
  const isIndex = symbol === "^TWII";
  const code = isIndex ? "t00" : String(row?.systexId || symbol.replace(/\.TW$/i, "")).toUpperCase();
  if (!code || code === "#001" && !isIndex) return null;

  const tradeTime = row?.regularMarketTime ? new Date(row.regularMarketTime) : new Date();
  const orderbook = Array.isArray(row?.orderbook) ? row.orderbook : [];
  const askPrices = orderbook.map((level) => rawValue(level?.ask)).filter(Boolean);
  const bidPrices = orderbook.map((level) => rawValue(level?.bid)).filter(Boolean);
  const askVolumes = orderbook.map((level) => rawValue(level?.askVolK)).filter(Boolean);
  const bidVolumes = orderbook.map((level) => rawValue(level?.bidVolK)).filter(Boolean);
  const price = rawValue(row?.price);

  return {
    "@": isIndex ? "t00.tw" : `${code}.tw`,
    c: code,
    ch: isIndex ? "t00.tw" : `${code}.tw`,
    d: formatTaipeiDateKey(tradeTime),
    "%": formatTaipeiTime(tradeTime),
    t: formatTaipeiTime(tradeTime),
    tlong: String(tradeTime.getTime()),
    h: rawValue(row?.regularMarketDayHigh),
    l: rawValue(row?.regularMarketDayLow),
    n: isIndex ? "發行量加權股價指數" : String(row?.symbolName || code),
    nf: String(row?.symbolName || code),
    o: rawValue(row?.regularMarketOpen),
    y: rawValue(row?.regularMarketPreviousClose),
    z: price,
    pz: "-",
    a: joinQuoteLevels(askPrices),
    b: joinQuoteLevels(bidPrices),
    f: joinQuoteLevels(askVolumes),
    g: joinQuoteLevels(bidVolumes),
    v: rawValue(row?.volumeK) || rawValue(row?.volume) || "0",
    ex: "tse",
    s: rawValue(row?.singleVolumeK) || "-",
    tv: rawValue(row?.singleVolumeK) || "-",
    ts: "0",
    source: "yahoo-tw",
  };
}

function rawValue(value) {
  if (value == null) return "";
  if (typeof value === "object" && "raw" in value) return rawValue(value.raw);
  const text = String(value).replace(/,/g, "").trim();
  return text && text !== "-" ? text : "";
}

function joinQuoteLevels(values) {
  return values.length ? `${values.join("_")}_` : "";
}

function formatTaipeiDateKey(date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date).replaceAll("-", "");
}

function formatTaipeiTime(date) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Taipei",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

async function handleTaiexChart(url) {
  const period1 = url.searchParams.get("period1");
  const period2 = url.searchParams.get("period2");
  const interval = url.searchParams.get("interval") || "1d";

  if (!period1 || !period2) {
    return json({ chart: { error: { message: "Missing period1 or period2" }, result: null } }, 400);
  }

  const headers = {
    accept: "application/json,text/plain,*/*",
    "user-agent": "Mozilla/5.0",
    referer: "https://finance.yahoo.com/",
    origin: "https://finance.yahoo.com",
  };
  const upstreams = [
    "https://query1.finance.yahoo.com/v8/finance/chart/%5ETWII",
    "https://query2.finance.yahoo.com/v8/finance/chart/%5ETWII",
  ];

  let lastErrorResponse = null;
  for (const baseUrl of upstreams) {
    const upstream = new URL(baseUrl);
    upstream.searchParams.set("interval", interval);
    upstream.searchParams.set("period1", period1);
    upstream.searchParams.set("period2", period2);
    const response = await proxyJson(upstream, headers);
    if (response.ok) return response;
    lastErrorResponse = response;
  }

  return lastErrorResponse ?? json({ stat: "ERROR", message: "Proxy fetch failed" }, 502);
}

async function proxyJson(upstream, headers, cacheTtl = 300) {
  try {
    const response = await fetch(upstream.toString(), {
      headers,
      cf: {
        cacheTtl,
        cacheEverything: false,
      },
    });

    const text = await response.text();
    const trimmed = text.trim();
    if (!trimmed) {
      return json({ stat: "ERROR", message: "Empty upstream response" }, 502);
    }
    if (trimmed.startsWith("<!DOCTYPE") || trimmed.startsWith("<html")) {
      return json({ stat: "ERROR", message: "Upstream returned HTML instead of JSON" }, 502);
    }

    return new Response(trimmed, {
      status: response.status,
      headers: corsJsonHeaders(),
    });
  } catch (error) {
    return json(
      {
        stat: "ERROR",
        message: error instanceof Error ? error.message : "Proxy fetch failed",
      },
      502,
    );
  }
}

function corsJsonHeaders() {
  return {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, OPTIONS",
    "access-control-allow-headers": "*",
    "cache-control": "public, max-age=300",
  };
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: corsJsonHeaders(),
  });
}
