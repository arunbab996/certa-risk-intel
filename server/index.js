require('dotenv').config();
const express = require('express');
const OpenAI = require('openai');

const app = express();
const PORT = process.env.PORT || 8080;

// --- 1. NUCLEAR CORS MIDDLEWARE ---
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
    
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

app.use(express.json());

// --- 2. CONFIGURATION ---
const apiKey = process.env.OPENAI_API_KEY;
const openai = new OpenAI({ apiKey: apiKey || "dummy-key" }); 
const NEWS_API_KEY = process.env.NEWS_API_KEY;

// --- 3. HELPER FUNCTIONS ---

const getSourceType = (domain) => {
    if (domain.includes('gov') || domain.includes('europa') || domain.includes('sec')) return 'Regulatory';
    if (domain.includes('law') || domain.includes('court')) return 'Legal';
    return 'News';
};

const fetchEliteNews = async (userQuery) => {
    try {
        if (!NEWS_API_KEY) return [];

        // LIMIT TO 5 ITEMS (Critical for preventing Vercel Timeout)
        const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(userQuery)}&sortBy=publishedAt&pageSize=5&apiKey=${NEWS_API_KEY}`;
        
        // Add a 4-second timeout to the NewsAPI fetch itself
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);

        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);

        const data = await response.json();
        
        if (data.status !== 'ok' || !Array.isArray(data.articles)) return [];

        return data.articles.map(a => ({ 
            type: 'news', 
            url: a.url, 
            title: a.title, 
            content: a.description || a.title, 
            source: a.source.name, 
            domain: new URL(a.url).hostname.replace('www.', ''), 
            date: a.publishedAt,
            sourceType: getSourceType(new URL(a.url).hostname) 
        }));
    } catch (e) { 
        console.error("News Fetch Timeout/Error:", e.message);
        return []; 
    }
};

const analyzeBatch = async (items, query) => {
    if (!items || items.length === 0) return [];
    
    // If no API Key, return raw items immediately (0 latency)
    if (!apiKey) {
        return items.map(item => ({
            ...item,
            analysis: { isRelevant: true, isAdverse: false, riskTypes: [], severity: "None", riskScore: 0, summary: "Analysis unavailable (Missing Key)" }
        }));
    }

    const promises = items.map(async (item) => {
        try {
            // Quick Filter: Skip obviously safe stuff to save time
            const lowerTitle = (item.title || "").toLowerCase();
            if (lowerTitle.includes('stock') || lowerTitle.includes('market') || lowerTitle.includes('price')) {
                 return { ...item, analysis: { isRelevant: true, isAdverse: false, riskTypes: [], severity: "None", riskScore: 0, summary: "Market news." } };
            }

            const prompt = `
            Analyze Compliance Risk: "${query}".
            Article: "${item.title}"
            
            Return JSON:
            { 
                "isRelevant": boolean, 
                "isAdverse": boolean, 
                "riskTypes": ["string"], 
                "severity": "High"|"Medium"|"Low"|"None", 
                "riskScore": 0-100, 
                "summary": "string"
            }`;

            // TIMEOUT WRAPPER: If OpenAI takes > 3.5s, give up on this specific item
            const completionPromise = openai.chat.completions.create({
                messages: [{ role: "user", content: prompt }],
                model: "gpt-3.5-turbo",
                response_format: { type: "json_object" },
                temperature: 0,
                max_tokens: 120
            });

            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error("Timeout")), 3500)
            );

            const completion = await Promise.race([completionPromise, timeoutPromise]);
            const analysis = JSON.parse(completion.choices[0].message.content);
            return { ...item, analysis };

        } catch (e) {
            // If Timeout or Error, return the item ANYWAY so the user sees data
            return { 
                ...item, 
                analysis: { 
                    isRelevant: true, 
                    isAdverse: false, 
                    riskTypes: ["Pending"], 
                    severity: "Low", 
                    riskScore: 50, 
                    summary: "AI Analysis Timed Out - Manual Review Required" 
                } 
            };
        }
    });

    const results = await Promise.all(promises);
    return results;
};

// --- 4. ROUTES ---

app.get("/", (req, res) => {
  res.send("✅ Certa backend is alive (Timeout Protected)");
});

app.post("/api/scan", async (req, res) => {
  try {
    const { query } = req.body || {};
    console.log(`🔎 Scanning for: ${query}`);

    // Fetch News (Max 4 seconds)
    const rawArticles = await fetchEliteNews(query);
    
    // Analyze (Max 3.5 seconds per item parallel)
    const analyzedArticles = await analyzeBatch(rawArticles, query);
    
    // Deduplicate
    const uniqueArticles = analyzedArticles.filter((item, index, self) =>
        index === self.findIndex((t) => t.url === item.url)
    );

    const brief = uniqueArticles.length > 0 
        ? `Found ${uniqueArticles.filter(a => a.analysis.isAdverse).length} adverse items out of ${uniqueArticles.length} scanned.`
        : "No significant adverse media found.";

    res.json({
        message: "Scan complete",
        query,
        data: uniqueArticles,
        related: [],
        brief: brief,
        tweets: []
    });

  } catch (error) {
    console.error("Server Error:", error);
    // Even if everything explodes, send a valid JSON response so frontend doesn't crash
    res.json({ 
        error: "Scan partially failed", 
        data: [], 
        brief: "System experienced high load. Please retry." 
    });
  }
});

app.listen(PORT, () => {
  console.log("🚀 Server running on port", PORT);
});