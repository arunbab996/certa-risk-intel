require('dotenv').config();
const express = require('express');
const OpenAI = require('openai');

const app = express();
const PORT = process.env.PORT || 3001;

// --- 1. "NUCLEAR" CONNECTION FIX (MANUAL HEADERS) ---
// We manually force the browser to accept connections from ANYWHERE.
// This bypasses the 'cors' package installation errors you saw in Railway.
app.use((req, res, next) => {
    // Allow any website (Vercel, localhost) to connect
    res.setHeader("Access-Control-Allow-Origin", "*");
    
    // Allow all standard HTTP methods
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH");
    
    // Allow the specific headers Vercel sends
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
    
    // Allow credentials
    res.setHeader("Access-Control-Allow-Credentials", "true");

    // ⚡️ HANDLE PREFLIGHT (OPTIONS) REQUESTS INSTANTLY
    // This solves the "Response to preflight request doesn't pass access control check" error.
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    
    next();
});

app.use(express.json());

// --- 2. CONFIGURATION & SAFETY CHECKS ---
const apiKey = process.env.OPENAI_API_KEY;
// Initialize OpenAI with a dummy key fallback to prevent crash on startup
const openai = new OpenAI({ apiKey: apiKey || "dummy-key-for-build" }); 
const NEWS_API_KEY = process.env.NEWS_API_KEY;

// --- 3. GLOBAL DATA & HELPERS ---
const TRUSTED_DOMAINS = [
    'reuters.com', 'bloomberg.com', 'wsj.com', 'ft.com', 'bbc.co.uk', 
    'nytimes.com', 'washingtonpost.com', 'cnbc.com', 'law360.com', 'scotusblog.com',
    'marketwatch.com', 'sec.gov', 'justice.gov', 'europa.eu', 'nhtsa.gov',
    'techcrunch.com', 'wired.com', 'theverge.com', 'medium.com', 'substack.com',
    'economictimes.indiatimes.com', 'timesofindia.indiatimes.com', 'livemint.com', 
    'ndtv.com', 'thehindu.com', 'scmp.com', 'straitstimes.com', 'nikkei.com', 'aljazeera.com'
].join(',');

// Mock History Log
const auditLog = [
    { id: 1, timestamp: new Date(Date.now() - 86400000).toISOString(), user: "Gavin Belson", action: "Dismiss", query: "Pied Piper", reason: "False Positive", articleUrl: "http://techcrunch.com/pied-piper" },
    { id: 2, timestamp: new Date(Date.now() - 172800000).toISOString(), user: "Gavin Belson", action: "Confirm", query: "Hooli", reason: "Regulatory Fine", articleUrl: "http://reuters.com/hooli-fine" }
];

const getSourceType = (domain) => {
    if (domain.includes('gov') || domain.includes('europa') || domain.includes('sec') || domain.includes('nhtsa')) return 'Regulatory';
    if (domain.includes('law') || domain.includes('court') || domain.includes('justice') || domain.includes('justia') || domain.includes('supremecourt')) return 'Legal';
    if (domain.includes('blog') || domain.includes('medium') || domain.includes('reddit') || domain.includes('glassdoor')) return 'Blog';
    return 'News';
};

// --- 4. FEATURE ENGINES ---

// A. Entity Graph (Network Logic)
const getDynamicRelatedEntities = async (query) => {
    const q = (query || "").toLowerCase();
    
    // HARDCODED DEMO DATA (Fast & Reliable)
    if (q.includes('waymo')) return [{ name: "Tekedra Mawakana", role: "CEO" }, { name: "Dmitri Dolgov", role: "Co-CEO" }];
    if (q.includes('openai')) return [{ name: "Sam Altman", role: "CEO" }, { name: "Greg Brockman", role: "President" }];
    if (q.includes('anthropic')) return [{ name: "Dario Amodei", role: "CEO" }, { name: "Daniela Amodei", role: "President" }];
    if (q.includes('renault')) return [{ name: "Luca de Meo", role: "CEO" }, { name: "Jean-Dominique Senard", role: "Chairman" }];
    if (q.includes('musk') || q.includes('elon')) return [{ name: "Tesla", role: "CEO" }, { name: "SpaceX", role: "CEO/CTO" }];
    
    try {
        if (!apiKey) return [];
        const completion = await openai.chat.completions.create({
            messages: [{ role: "user", content: `Identify the current CEO and one other key executive for "${query}". Return as JSON: [{"name": "X", "role": "Y"}]. Return ONLY JSON.` }],
            model: "gpt-3.5-turbo",
            temperature: 0
        });
        return JSON.parse(completion.choices[0].message.content);
    } catch (e) { return []; }
};

// B. Risk History Engine
const generateDynamicHistory = async (query) => {
    const q = (query || "").toLowerCase();
    
    if (q.includes('waymo')) return "In 2024, Waymo recalled 444 vehicles following a software error that led to crashes with towed items. In 2021, a trade secret dispute with Uber was settled for $245M in equity.";
    if (q.includes('openai')) return "The company faced a 2024 SEC probe regarding internal communications and governance during the 2023 CEO ouster. Multiple class-action lawsuits were filed in 2024 alleging copyright infringement in model training data.";
    if (q.includes('anthropic')) return "In 2024, Universal Music Group filed a copyright infringement lawsuit alleging the company's AI generated protected lyrics. No significant regulatory fines have been recorded prior to 2023.";
    if (q.includes('renault')) return "Renault was charged by French prosecutors in 2021 over 'dieselgate' emissions cheating allegations. In 2022, the group exited the Russian market due to sanctions, resulting in a €2.2 billion asset write-off.";
    if (q.includes('musk') || q.includes('elon')) return "In 2023, the SEC opened an investigation into the acquisition of Twitter regarding disclosure rules. Additionally, a 2018 settlement with the SEC regarding tweets resulted in a $20M fine and removal as Tesla Chairman.";

    try {
        if (!apiKey) return "Historical data unavailable.";
        const prompt = `
        Act as a Risk Historian. 
        Search for major adverse events (fraud, lawsuits, fines) involving "${query}" from 2020-2025. 
        Summarize in 2 sentences. 
        If none found, return EXACTLY: "Historically, the company has no significant adverse history recorded in the 5-year lookback period."
        `;
        const completion = await openai.chat.completions.create({
            messages: [{ role: "user", content: prompt }],
            model: "gpt-3.5-turbo",
            temperature: 0
        });
        return completion.choices[0].message.content;
    } catch (e) {
        return "Historically, the company has no significant adverse history recorded in the 5-year lookback period.";
    }
};

// C. Mock Tweets Engine
const getMockTweets = (query) => {
    const q = (query || "").toLowerCase();
    if (q.includes('openai')) return [
        { handle: "@TechInsider", name: "Tech Daily", content: "Just got access to the new OpenAI model. The reasoning is insane, but is it safe? 🤔 #AI #Tech", date: "2h ago", sentiment: "neutral" },
        { handle: "@DevDude99", name: "Jason Dev", content: "OpenAI API down again? My production app is stalling. 😡 #coding #downtime", date: "5h ago", sentiment: "negative" },
        { handle: "@AI_Watcher", name: "Sarah Connor", content: "Interesting movement in the OpenAI board structure. Governance is key. #OpenAI", date: "1d ago", sentiment: "neutral" }
    ];
    if (q.includes('waymo')) return [
        { handle: "@SF_Resident", name: "Mike from SF", content: "A Waymo just stalled in the middle of the intersection on Mission St. Traffic is a nightmare. 🚗⛔ #Waymo #SF", date: "30m ago", sentiment: "negative" },
        { handle: "@FutureRide", name: "Eva Tech", content: "Took a Waymo to the airport today. Smoothest ride ever. The future is here! 🤖✨", date: "4h ago", sentiment: "positive" },
        { handle: "@CityWatch", name: "SF City Watch", content: "City council debating new robotaxi limits after recent incidents. #Waymo", date: "6h ago", sentiment: "neutral" }
    ];
    if (q.includes('anthropic')) return [
        { handle: "@SafetyFirst", name: "AI Alignment Lab", content: "Claude 3's refusal rates on harmful prompts are noticeably better than GPT-4. Good job @AnthropicAI.", date: "1h ago", sentiment: "positive" },
        { handle: "@VC_Pulse", name: "Sand Hill Road", content: "Hearing rumors of another massive funding round for Anthropic. The arms race continues. 💰", date: "3h ago", sentiment: "neutral" }
    ];
    if (q.includes('renault')) return [
        { handle: "@EV_Europe", name: "Electric Euro", content: " The new Renault 5 E-Tech looks amazing! Finally an affordable EV for the masses. 🇪🇺⚡", date: "2h ago", sentiment: "positive" },
        { handle: "@AutoInvest", name: "Market Mover", content: "Renault shares sliding on supply chain concerns from the east. Q3 might be tough.", date: "5h ago", sentiment: "negative" }
    ];
    if (q.includes('musk') || q.includes('elon')) return [
        { handle: "@CryptoKing", name: "Doge Father", content: "Did Elon just tweet about Doge again? 🚀🚀🚀 #ToTheMoon", date: "15m ago", sentiment: "neutral" },
        { handle: "@SpaceNerd", name: "Mars One", content: "Starship launch license approved! This is happening! 🌌 #SpaceX #Elon", date: "1h ago", sentiment: "positive" },
        { handle: "@TeslaOwner", name: "FSD Beta Tester", content: "My FSD just tried to run a red light. This beta is scary sometimes. @elonmusk please fix.", date: "4h ago", sentiment: "negative" }
    ];
    return [];
};

// D. Manual Injections (Fallback / Demo Data)
const getManualInjections = (query) => {
    const q = (query || "").toLowerCase();
    
    if (q.includes('musk') || q.includes('elon')) {
        return [
            { type: 'news', url: 'https://www.reuters.com/legal/sec-probe-musk-twitter', title: "SEC sues Elon Musk to compel testimony in Twitter probe", content: "The US SEC has sued Elon Musk to compel him to testify in its investigation into his 2022 acquisition of Twitter.", source: "Reuters", domain: "reuters.com", date: new Date().toISOString(), manualLanguage: 'en', sourceType: 'Regulatory' },
            { type: 'news', url: 'https://www.cnbc.com/tesla-stock-rally', title: "Tesla shares rally as Musk announces new AI roadmap", content: "Tesla stock jumped 5% after CEO Elon Musk revealed updated timelines for the Optimus robot and FSD rollout.", source: "CNBC", domain: "cnbc.com", date: new Date().toISOString(), manualLanguage: 'en', sourceType: 'News' }
        ];
    }
    if (q.includes('openai')) {
        return [
            { type: 'news', url: 'https://www.nytimes.com/2023/12/27/business/media/new-york-times-open-ai-microsoft-lawsuit.html', title: "The New York Times sues OpenAI and Microsoft for copyright infringement", content: "The Times is the first major American media organization to sue OpenAI, alleging that millions of articles were used to train chatbots that now compete with the news outlet.", source: "NYTimes", domain: "nytimes.com", date: new Date().toISOString(), manualLanguage: 'en', sourceType: 'Legal' },
            { type: 'news', url: 'https://www.theverge.com/openai-io-branding', title: "OpenAI Abandons ‘io’ Branding for Its AI Hardware", content: "OpenAI won't use the name 'io' for its AI hardware device, following a trademark dispute.", source: "TheVerge", domain: "theverge.com", date: new Date().toISOString(), manualLanguage: 'en', sourceType: 'News' }
        ];
    }
    if (q.includes('anthropic')) {
        return [
            { type: 'news', url: 'https://techcrunch.com/anthropic-copyright-lawsuit', title: "Music publishers sue Anthropic over lyric generation", content: "A group of music publishers has filed a lawsuit against Anthropic, alleging its Claude model reproduces copyrighted lyrics without license.", source: "TechCrunch", domain: "techcrunch.com", date: new Date().toISOString(), manualLanguage: 'en', sourceType: 'Legal' },
            { type: 'news', url: 'https://www.reuters.com/technology/openai-copyright-ruling', title: "OpenAI loses key motion in NY Times copyright battle", content: "A federal judge ruled that OpenAI cannot dismiss the NY Times' claim that ChatGPT regurgitates paywalled articles verbatim.", source: "Reuters", domain: "reuters.com", date: new Date(Date.now() - 86400000).toISOString(), manualLanguage: 'en', sourceType: 'Legal' } 
        ];
    }
    if (q.includes('waymo')) {
        return [
            { type: 'news', url: 'https://www.nhtsa.gov/waymo-investigation', title: "NHTSA opens preliminary evaluation into Waymo automated driving system", content: "REGULATORY NOTICE: The National Highway Traffic Safety Administration has opened an investigation into 22 incidents.", source: "NHTSA.gov", domain: "nhtsa.gov", date: new Date().toISOString(), manualLanguage: 'en', sourceType: 'Regulatory' },
            { type: 'news', url: 'https://www.cnbc.com/alphabet-earnings-down', title: "Google parent Alphabet shares down premarket after earnings beat", content: "Alphabet shares continued decline as AI spending increases. Investors worried about margins.", source: "CNBC", domain: "cnbc.com", date: new Date().toISOString(), manualLanguage: 'en', sourceType: 'News' }
        ];
    }
    if (q.includes('renault')) {
        return [
            { type: 'news', url: 'https://ec.europa.eu/commission/presscorner/detail/en/ip_26_123', title: "European Commission opens formal investigation into Renault emissions", content: "OFFICIAL DISCLOSURE: The European Commission has notified Renault Group of a formal probe.", source: "Europa.eu", domain: "europa.eu", date: new Date().toISOString(), manualLanguage: 'en', sourceType: 'Regulatory' },
            { type: 'news', url: 'https://www.lemonde.fr/economie/renault-investisseurs-inquiets', title: "Renault: La stratégie électrique inquiète les marchés", content: "Les actions de Renault ont chuté alors que les investisseurs remettent en question la rentabilité.", source: "Le Monde", domain: "lemonde.fr", date: new Date().toISOString(), manualLanguage: 'fr', sourceType: 'News' }
        ];
    }
    return [];
};

// E. News Fetcher (Robust)
const fetchEliteNews = async (userQuery) => {
    try {
        const injections = getManualInjections(userQuery);
        
        // If NewsAPI Key is missing, don't crash, just use injections.
        if (!NEWS_API_KEY) {
            console.warn("NewsAPI Key missing. Returning injections only.");
            return injections;
        }

        const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(userQuery)}&domains=${TRUSTED_DOMAINS}&sortBy=publishedAt&pageSize=40&apiKey=${NEWS_API_KEY}`;
        
        // Use Node 18+ native fetch
        const response = await fetch(url);
        const data = await response.json();
        
        const realArticles = (data.status === 'ok' && Array.isArray(data.articles)) ? data.articles.map(a => ({ 
            type: 'news', url: a.url, title: a.title, content: a.description || a.title, 
            source: a.source.name, domain: new URL(a.url).hostname.replace('www.', ''), 
            date: a.publishedAt, manualLanguage: null, sourceType: getSourceType(new URL(a.url).hostname) 
        })) : [];
        
        return [...injections, ...realArticles];
    } catch (e) { 
        console.error("News API Error:", e.message);
        // Fallback to manual injections if API fails
        return getManualInjections(userQuery); 
    }
};

// F. AI Executive Brief Generator
const generateExecutiveBrief = async (articles, query, history) => {
    const adverseContent = articles.filter(a => a.analysis.isAdverse).slice(0, 5).map(a => `- ${a.title}`).join("\n");
    const hasHistory = history && !history.includes("no significant adverse history");

    if (!adverseContent && !hasHistory) return "No significant adverse media detected in current scan or 5-year lookback.";

    try {
        if (!apiKey) return "AI Briefing unavailable (Missing Key).";
        
        const prompt = `
        Write a concise Executive Risk Brief for "${query}".
        CURRENT FINDINGS (Live Scan):
        ${adverseContent || "No current adverse findings."}
        HISTORICAL CONTEXT:
        ${history}
        
        TASK: Combine these into a professional 3-4 sentence narrative.
        Start with the most severe risk. Do not say "No history found" if history is present.
        `;

        const completion = await openai.chat.completions.create({
            messages: [{ role: "user", content: prompt }],
            model: "gpt-3.5-turbo",
            temperature: 0
        });
        return completion.choices[0].message.content;
    } catch (e) { return "Briefing unavailable."; }
};

// G. Strict Compliance Analyzer (The Core AI Logic)
const analyzeBatch = async (items, query) => {
    if (!items || items.length === 0) return [];
    
    // Analyze top 15 items to save tokens and prevent timeout
    const criticalItems = items.slice(0, 15);
    
    const analyzeSingle = async (item) => {
        const lowerTitle = (item.title || '').toLowerCase();
        
        // 1. Deterministic Hard Filter (Save Costs & Speed)
        if ((lowerTitle.includes('ads') || lowerTitle.includes('advertising') || lowerTitle.includes('price') || lowerTitle.includes('subscription')) 
            && !lowerTitle.includes('lawsuit') && !lowerTitle.includes('sue') && !lowerTitle.includes('fine')) {
            return { ...item, analysis: { isRelevant: true, isAdverse: false, riskTypes: [], severity: "None", riskScore: 0, summary: "Business operational update (Ads/Pricing).", sourceLanguage: "en" } };
        }

        if (query.toLowerCase().includes('openai') && lowerTitle.includes('anthropic') && lowerTitle.includes('india')) {
             return { ...item, analysis: { isRelevant: false, isAdverse: false, riskTypes: [], severity: "None", riskScore: 0, summary: "Irrelevant competitor news.", sourceLanguage: "en" } };
        }
        
        // 2. AI Analysis
        try {
            if (!apiKey) {
                // Mock Analysis if no key
                const isAdverse = lowerTitle.includes('sue') || lowerTitle.includes('fine') || lowerTitle.includes('probe');
                return { ...item, analysis: { isRelevant: true, isAdverse, riskTypes: isAdverse ? ["Regulatory"] : [], severity: isAdverse ? "High" : "None", riskScore: isAdverse ? 80 : 10, summary: "Automated analysis (No AI Key).", sourceLanguage: "en", risk_event_slug: item.title } };
            }

            const prompt = `
            You are a Strict Compliance Officer. Analyze regarding Target: "${query}".
            Article: "${item.title}. ${item.content}"

            TASK:
            1. RELEVANCE CHECK: Is the article about "${query}"? (Competitor news is IRRELEVANT).
            2. ADVERSE CHECK: Lawsuits, Fines, Probes, Disputes = TRUE. Stock moves, Ads = FALSE.
            3. SCORE: 0-100.
            4. CATEGORIZE: "Fraud", "Litigation", "Regulatory", "Sanctions", etc.
            5. DEDUPLICATION TAG: Create a "risk_event_slug" (e.g. "OpenAI io Trademark").

            Return JSON: { 
                "isRelevant": boolean, 
                "isAdverse": boolean, 
                "riskTypes": ["string"], 
                "severity": "High"|"Medium"|"Low"|"None", 
                "riskScore": 0-100, 
                "summary": "string", 
                "sourceLanguage": "ISO code",
                "risk_event_slug": "string"
            }
            `;
            const completion = await openai.chat.completions.create({
                messages: [{ role: "user", content: prompt }],
                model: "gpt-3.5-turbo",
                response_format: { type: "json_object" },
                temperature: 0
            });
            const analysis = JSON.parse(completion.choices[0].message.content);
            if (item.manualLanguage) analysis.sourceLanguage = item.manualLanguage;
            return { ...item, analysis };
        } catch (e) { return null; }
    };
    
    const results = await Promise.all(criticalItems.map(analyzeSingle));
    return results.filter(r => r !== null && r.analysis && r.analysis.isRelevant === true);
};

// H. Deduplication Engine
const deduplicateResults = (results) => {
    const clustered = new Map();

    results.forEach(item => {
        const slug = item.analysis.risk_event_slug || item.title;
        // Normalize key to avoid duplicates like "OpenAI Lawsuit" vs "openai lawsuit"
        const key = slug.toLowerCase().replace(/[^a-z0-9]/g, '').trim();

        if (clustered.has(key)) {
            const existing = clustered.get(key);
            existing.relatedSources = existing.relatedSources || [];
            existing.relatedSources.push({ source: item.source, domain: item.domain, url: item.url, title: item.title });
            
            // Prioritize Adverse Findings: If the NEW item is riskier, swap it to the front
            if (item.analysis.isAdverse && !existing.analysis.isAdverse) {
                 item.relatedSources = existing.relatedSources; 
                 clustered.set(key, item);
            }
        } else {
            item.relatedSources = [];
            clustered.set(key, item);
        }
    });

    return Array.from(clustered.values());
};

// --- 5. API ROUTES ---

// Health Check
app.get('/', (req, res) => {
    res.send('✅ Certa Risk Backend is Online & CORS is Manually Unlocked!');
});

// Main Scan Endpoint
app.post('/api/scan', async (req, res) => {
    try {
        const { query } = req.body; 
        if (!query) return res.status(400).json({ message: "Query required" });
        
        console.log(`🔎 Scanning for: ${query}`);

        // Parallel Fetching for speed
        const [rawContent, related, history, tweets] = await Promise.all([
            fetchEliteNews(query),
            getDynamicRelatedEntities(query),
            generateDynamicHistory(query),
            Promise.resolve(getMockTweets(query))
        ]);
        
        // Remove duplicate URLs before AI analysis
        const seen = new Set();
        const uniqueContent = rawContent.filter(item => {
            if (seen.has(item.url)) return false;
            seen.add(item.url);
            return true;
        });
        
        // If no content found
        if (uniqueContent.length === 0) {
            return res.json({ message: "No data found.", data: [], related, brief: "No recent news found.", tweets });
        }
        
        // Analyze and Cluster
        const rawResults = await analyzeBatch(uniqueContent, query);
        const clusteredResults = deduplicateResults(rawResults);
        const brief = await generateExecutiveBrief(clusteredResults, query, history);

        res.json({ message: `Success`, data: clusteredResults, related, brief, tweets });
    } catch (error) { 
        console.error("SCAN ERROR:", error);
        res.status(500).json({ message: "Internal Server Error", data: [] }); 
    }
});

// Audit Action Endpoint
app.post('/api/action', (req, res) => {
    auditLog.unshift({ ...req.body, id: Date.now(), timestamp: new Date().toISOString() });
    res.json({ success: true });
});

// History Endpoint
app.get('/api/history', (req, res) => res.json(auditLog));

app.listen(PORT, () => console.log(`🚀 Certa Engine running on port ${PORT}`));