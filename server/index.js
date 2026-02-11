require("dotenv").config();
const express = require("express");
const OpenAI = require("openai");

const app = express();
const PORT = process.env.PORT || 8080;

/* -------------------- SAFE CORS (DO NOT TOUCH) -------------------- */
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Requested-With"
  );
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

app.use(express.json());

/* -------------------- HEALTH CHECK -------------------- */
app.get("/", (req, res) => {
  res.send("✅ Certa backend is alive");
});

/* -------------------- CONFIG -------------------- */
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "dummy-key"
});

const NEWS_API_KEY = process.env.NEWS_API_KEY;

const TRUSTED_DOMAINS = [
  "reuters.com",
  "bloomberg.com",
  "wsj.com",
  "ft.com",
  "bbc.co.uk",
  "nytimes.com",
  "washingtonpost.com",
  "cnbc.com",
  "law360.com",
  "sec.gov",
  "justice.gov",
  "europa.eu",
  "nhtsa.gov",
  "techcrunch.com",
  "theverge.com",
  "economictimes.indiatimes.com",
  "livemint.com",
  "thehindu.com"
].join(",");

/* -------------------- DEMO / MANUAL INJECTIONS -------------------- */
const getManualInjections = (query) => {
  const q = query.toLowerCase();

  if (q.includes("elon") || q.includes("musk")) {
    return [
      {
        title: "SEC probes Elon Musk over Twitter acquisition",
        url: "https://www.reuters.com/world/us/sec-probes-musk-twitter",
        source: "Reuters",
        domain: "reuters.com",
        content:
          "The SEC is investigating disclosures made during Elon Musk’s acquisition of Twitter.",
        date: new Date().toISOString()
      }
    ];
  }

  if (q.includes("openai")) {
    return [
      {
        title: "NYTimes sues OpenAI over copyright violations",
        url: "https://www.nytimes.com/openai-lawsuit",
        source: "NYTimes",
        domain: "nytimes.com",
        content:
          "The New York Times has sued OpenAI alleging unlawful use of copyrighted material.",
        date: new Date().toISOString()
      }
    ];
  }

  return [];
};

/* -------------------- NEWS FETCH -------------------- */
const fetchEliteNews = async (query) => {
  const injections = getManualInjections(query);

  if (!NEWS_API_KEY) return injections;

  try {
    const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(
      query
    )}&domains=${TRUSTED_DOMAINS}&pageSize=20&sortBy=publishedAt&apiKey=${NEWS_API_KEY}`;

    const res = await fetch(url);
    const json = await res.json();

    if (json.status !== "ok") return injections;

    const articles = json.articles.map((a) => ({
      title: a.title,
      url: a.url,
      source: a.source.name,
      domain: new URL(a.url).hostname.replace("www.", ""),
      content: a.description || a.title,
      date: a.publishedAt
    }));

    return [...injections, ...articles];
  } catch {
    return injections;
  }
};

/* -------------------- AI ANALYSIS (SINGLE CALL) -------------------- */
const analyzeBatch = async (articles, query) => {
  if (!articles.length || !process.env.OPENAI_API_KEY) {
    return articles.map((a) => ({
      ...a,
      analysis: {
        isRelevant: true,
        isAdverse: true,
        riskTypes: ["Regulatory"],
        severity: "Medium",
        riskScore: 60,
        summary: "Automated risk signal (demo fallback)",
        risk_event_slug: a.title
      }
    }));
  }

  const prompt = `
You are a compliance analyst.
Analyze the following articles for adverse risk related to "${query}".

Return a JSON array (same order) with:
{
  isRelevant,
  isAdverse,
  riskTypes,
  severity,
  riskScore,
  summary,
  risk_event_slug
}

Articles:
${articles.map((a, i) => `${i + 1}. ${a.title} — ${a.content}`).join("\n")}
`;

  const completion = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [{ role: "user", content: prompt }],
    temperature: 0
  });

  const analysis = JSON.parse(completion.choices[0].message.content);

  return articles.map((a, i) => ({
    ...a,
    analysis: analysis[i]
  }));
};

/* -------------------- DEDUPLICATION -------------------- */
const deduplicateResults = (results) => {
  const map = new Map();

  results.forEach((item) => {
    const key = (item.analysis.risk_event_slug || item.title)
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");

    if (!map.has(key)) {
      map.set(key, { ...item, relatedSources: [] });
    } else {
      map.get(key).relatedSources.push({
        source: item.source,
        url: item.url,
        title: item.title
      });
    }
  });

  return Array.from(map.values());
};

/* -------------------- EXECUTIVE BRIEF -------------------- */
const generateExecutiveBrief = async (events, query) => {
  if (!events.length) {
    return "No significant adverse media detected for this entity.";
  }

  if (!process.env.OPENAI_API_KEY) {
    return `Recent coverage related to ${query} includes regulatory and legal scrutiny. Continued monitoring is advised.`;
  }

  const prompt = `
Write a concise executive risk brief for "${query}" based on:
${events.map((e) => `- ${e.title}`).join("\n")}
`;

  const completion = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [{ role: "user", content: prompt }],
    temperature: 0
  });

  return completion.choices[0].message.content;
};

/* -------------------- MAIN SCAN ENDPOINT -------------------- */
app.post("/api/scan", async (req, res) => {
  try {
    const { query } = req.body;
    if (!query) return res.status(400).json({ message: "Query required" });

    const raw = await fetchEliteNews(query);
    const analyzed = await analyzeBatch(raw, query);
    const clustered = deduplicateResults(analyzed);
    const brief = await generateExecutiveBrief(clustered, query);

    res.json({
      message: "Success",
      data: clustered,
      related: [],
      brief,
      tweets: []
    });
  } catch (err) {
    console.error("SCAN ERROR:", err);
    res.status(500).json({ message: "Internal Server Error", data: [] });
  }
});

/* -------------------- START SERVER -------------------- */
app.listen(PORT, () => {
  console.log(`🚀 Certa backend running on port ${PORT}`);
});
