import { Actor } from 'apify';
import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';
import { gotScraping } from 'got-scraping'; 
import yahooFinance from 'yahoo-finance2'; 
import TurndownService from 'turndown';
import dotenv from 'dotenv';

// AI SDKs
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';

dotenv.config();
await Actor.init();

process.on('uncaughtException', (err) => {
    if (err.code === 'ECONNRESET') {
        console.warn('⚠️ Ignored ECONNRESET during shutdown');
    } else {
        throw err;
    }
});

// --- 1. CONFIGURATION ---
const input = await Actor.getInput() || {};
const { 
    tickers = [], 
    useTrending = true,
    threshold = 3.0, 
    maxNewsPerTicker = 3, 
    discordWebhook,
    sendEmail,
    recipientEmail,
    proxyConfiguration,

    // AI Configuration
    openaiApiKey,
    openaiModel = "gpt-4o-mini",
    
    anthropicApiKey,
    anthropicModel = "claude-3-haiku-20240307",
    
    geminiApiKey,
    geminiModel = "gemini-2.5-flash-lite",
    
    openRouterKey = process.env.OPENROUTER_API_KEY, // Keep as fallback
    openRouterModel = "google/gemma-3-27b-it:free",
} = input;

// Validate at least one key exists
if (!openaiApiKey && !anthropicApiKey && !geminiApiKey && !openRouterKey) {
    console.error('❌ FAILURE: No AI API Key provided. Please set OpenAI, Anthropic, Gemini, or OpenRouter keys.');
    await Actor.exit();
}

try {
    if (yahooFinance.suppressNotices) yahooFinance.suppressNotices(['yahooSurvey', 'cookie']);
} catch (e) {}

// Proxy Setup
let proxyUrl;
try {
    const proxyConfig = await Actor.createProxyConfiguration(proxyConfiguration);
    if (proxyConfig) proxyUrl = await proxyConfig.newUrl();
} catch (e) {
    console.warn("⚠️ Proxy setup failed. Using Direct Connection.");
}

const turndownService = new TurndownService();
const dataset = await Actor.openDataset();
const finalResults = [];

// --- 2. TARGET IDENTIFICATION ---
let targetTickers = tickers;
if (targetTickers.length === 0 && useTrending) {
    console.log("🔍 Auto-discovering trending stocks...");
    try {
        const results = await yahooFinance.trending('US');
        if (results.quotes) targetTickers = results.quotes.slice(0, 5).map(q => q.symbol);
    } catch (e) {
        targetTickers = ['NVDA', 'TSLA', 'AAPL', 'AMD', 'INTC'];
    }
}

// --- 3. HELPER FUNCTIONS ---
// ... existing imports

// --- HELPER: Detect Region based on Ticker Suffix ---
function getRegionConfig(ticker) {
    const suffix = ticker.split('.').pop(); // Get text after last dot
    
    // Map suffixes to Google News Region params
    // gl = Geolocation, ceid = Country:Language
    const regionMap = {
        'NS': { gl: 'IN', hl: 'en-IN', ceid: 'IN:en' }, // NSE India
        'BO': { gl: 'IN', hl: 'en-IN', ceid: 'IN:en' }, // BSE India
        'L':  { gl: 'GB', hl: 'en-GB', ceid: 'GB:en' }, // London
        'TO': { gl: 'CA', hl: 'en-CA', ceid: 'CA:en' }, // Toronto
        'DE': { gl: 'DE', hl: 'en-DE', ceid: 'DE:en' }, // Frankfurt
        'HK': { gl: 'HK', hl: 'en-HK', ceid: 'HK:en' }, // Hong Kong
    };

    // Default to US if no suffix or unknown suffix (e.g. NVDA, AAPL)
    // Note: Some US stocks have no suffix, some might have other formats, 
    // but usually "No Suffix" = US in Yahoo Finance context.
    if (!ticker.includes('.') || !regionMap[suffix]) {
        return { gl: 'US', hl: 'en-US', ceid: 'US:en' };
    }

    return regionMap[suffix];
}

async function getNewsData(ticker) {
    const { gl, hl, ceid } = getRegionConfig(ticker);
    
    // Query Google News with specific Region params
    const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(ticker + " stock news")}+when:1d&hl=${hl}&gl=${gl}&ceid=${ceid}`;
    
    console.log(`   🌍 Searching News in Region: ${gl} for ${ticker}`);

    try {
        const res = await gotScraping({ url: rssUrl, proxyUrl, responseType: 'text' });
        const dom = new JSDOM(res.body, { contentType: "text/xml" });
        const items = Array.from(dom.window.document.querySelectorAll("item")).slice(0, maxNewsPerTicker);
        return items.map(item => ({
            title: item.querySelector("title")?.textContent || "No Title",
            link: item.querySelector("link")?.textContent || "",
            snippet: new JSDOM(`<body>${item.querySelector("description")?.textContent || ""}</body>`).window.document.body.textContent.trim()
        }));
    } catch (e) { 
        console.warn(`   ⚠️ News fetch failed for ${ticker}: ${e.message}`);
        return []; 
    }
}

async function fetchArticleContent(url) {
    try {
        const response = await gotScraping({ 
            url, proxyUrl, timeout: { request: 8000 }, 
            headerGeneratorOptions: { browsers: ['chrome'], devices: ['desktop'], locales: ['en-US'] }
        });
        const dom = new JSDOM(response.body, { url });
        const article = new Readability(dom.window.document).parse();
        if (article && article.textContent.length > 500 && !article.title.includes("Access Denied")) {
            return { title: article.title, text: turndownService.turndown(article.content) };
        }
    } catch (e) {}
    return null; 
}

// --- 4. AI ADAPTER FUNCTION ---
function cleanAndParseJSON(text) {
    // 1. Try to extract strictly between the first '{' and last '}'
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const cleanText = jsonMatch ? jsonMatch[0] : text;

    try {
        return JSON.parse(cleanText);
    } catch (e) {
        // 2. Fallback: aggressive cleanup for markdown/newlines
        try {
            const aggressiveClean = cleanText
                .replace(/```json/g, '')
                .replace(/```/g, '')
                .trim();
            return JSON.parse(aggressiveClean);
        } catch (e2) {
            throw new Error(`JSON Parse Failed: ${text.substring(0, 50)}...`);
        }
    }
}

async function analyzeStockEvent(ticker, pctChange, context) {
    const systemPrompt = `You are a professional equity markets analyst.

Explain why ${ticker} moved ${pctChange.toFixed(2)}% today.

If no specific company news exists:
- Explain the move using market-wide factors
- Mention profit-taking, index movement, or normal volatility
- Do NOT invent events
- Keep it factual and readable

Return STRICT JSON:
{
  "reason_summary": "Clear 1–2 sentence explanation suitable for retail investors",
  "event_class": "EARNINGS|MERGER|MACRO|MARKET_DRIFT|VOLATILITY|UNKNOWN"
}
`;
    
    const userMessage = `CONTEXT:\n${context.substring(0, 12000)}`;

    let rawResponse = "";

    try {
        // A. OPENAI
        if (openaiApiKey) {
            const openai = new OpenAI({ apiKey: openaiApiKey });
            const completion = await openai.chat.completions.create({
                messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userMessage }],
                model: openaiModel,
                response_format: { type: "json_object" }
            });
            rawResponse = completion.choices[0].message.content;
        }

        // B. ANTHROPIC (CLAUDE)
        else if (anthropicApiKey) {
            const anthropic = new Anthropic({ apiKey: anthropicApiKey });
            const msg = await anthropic.messages.create({
                model: anthropicModel,
                max_tokens: 1000,
                system: systemPrompt,
                messages: [{ role: "user", content: userMessage }]
            });
            rawResponse = msg.content[0].text;
        }

        // C. GOOGLE GEMINI
        else if (geminiApiKey) {
            const genAI = new GoogleGenerativeAI(geminiApiKey);
            const model = genAI.getGenerativeModel({ 
                model: geminiModel,
                generationConfig: {
                    temperature: 0.2,
                    maxOutputTokens: 512
                }
            });
        
            const result = await model.generateContent(
                systemPrompt + "\n\n" + userMessage
            );
            rawResponse = result.response.text();
        }        

        // D. OPENROUTER (Fallback)
        else if (openRouterKey) {
            const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${openRouterKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    model: openRouterModel, 
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userMessage }
                    ] 
                })
            });
            const json = await res.json();
            rawResponse = json.choices?.[0]?.message?.content || "{}";
        }

        // Use the robust parser
        return cleanAndParseJSON(rawResponse);

    } catch (error) {
        console.error(`❌ AI Analysis Failed for ${ticker}:`, error.message);
        return { reason_summary: `AI Error: ${error.message}`, event_class: "ERROR" };
    }
}

// --- 5. MAIN LOOP ---
console.log(`🚀 Monitoring: ${targetTickers.join(', ')}`);
const volatileStocks = [];

for (const ticker of targetTickers) {
    try {
        const quote = await yahooFinance.quote(ticker);
        const change = quote.regularMarketChangePercent || 0;
        console.log(`📊 ${ticker}: ${change.toFixed(2)}%`);
        if (Math.abs(change) >= threshold) volatileStocks.push({ ticker, pctChange: change, price: quote.regularMarketPrice });
    } catch (e) { console.error(`Skipping ${ticker}: ${e.message}`); }
}

if (volatileStocks.length === 0) { console.log("✅ No significant moves."); await Actor.exit(); }

for (const stock of volatileStocks) {
    console.log(`\n🕵️ Analyzing: ${stock.ticker}`);
    const newsItems = await getNewsData(stock.ticker);
    let combinedContext = "";
    
    for (const item of newsItems) {
        let content = item.snippet;
        if (item.link) {
            const article = await fetchArticleContent(item.link);
            if (article) content = article.text;
        }
        if (content.length > 50) combinedContext += `\n\n--- NEWS: ${item.title} ---\n${content.substring(0, 1500)}`;
    }

    if (combinedContext.length < 50) { console.log("   ⚠️ No news found."); continue; }

    // CALL THE NEW AI FUNCTION HERE
    const analysis = await analyzeStockEvent(stock.ticker, stock.pctChange, combinedContext);

    console.log(`   ✅ Reason: ${analysis.reason_summary}`);
    
    const record = { ...stock, ...analysis, timestamp: new Date() };
    await dataset.pushData(record);
    finalResults.push(record);

    // FEATURE 1: Rich Visual Discord Webhook
    if (discordWebhook) {
        const color = stock.pctChange > 0 ? 5763719 : 15548997; // Green or Red
        await fetch(discordWebhook, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                embeds: [{
                    title: `${stock.ticker} ${stock.pctChange > 0 ? '🚀' : '🔻'} ${stock.pctChange.toFixed(2)}%`,
                    description: `**Price:** $${stock.price}\n**Reason:** ${analysis.reason_summary}`,
                    color: color,
                    footer: { text: `Event: ${analysis.event_class} • Apify Intelligence` },
                    timestamp: new Date().toISOString()
                }]
            })
        });
    }

    // FEATURE 3: Email Notification
    if (sendEmail) {
        if (recipientEmail) {
            try {
                console.log(`   📧 Sending email to ${recipientEmail}...`);
                await Actor.call('apify/send-mail', {
                    to: recipientEmail, // <--- Explicitly pass the user input
                    subject: `📢 ${stock.ticker} Moved ${stock.pctChange.toFixed(2)}%`,
                    html: `
                        <h2>${stock.ticker} (${stock.pctChange > 0 ? '+' : ''}${stock.pctChange.toFixed(2)}%)</h2>
                        <p><strong>Price:</strong> $${stock.price}</p>
                        <p><strong>Event Type:</strong> ${analysis.event_class}</p>
                        <hr/>
                        <h3>Why?</h3>
                        <p>${analysis.reason_summary}</p>
                        <br/>
                        <small>Generated by Market Reaction Intelligence</small>
                    `
                });
            } catch (e) {
                console.error(`   ❌ Failed to send email: ${e.message}`);
            }
        } else {
            console.warn("   ⚠️ Email enabled but 'recipientEmail' input is empty.");
        }
    }
}

// FEATURE 2: Generate HTML Dashboard
const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8"><title>Market Intelligence Brief</title>
    <style>
        body { font-family: -apple-system, system-ui, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; line-height: 1.6; }
        h1 { border-bottom: 2px solid #eee; padding-bottom: 10px; }
        .card { border: 1px solid #ddd; border-radius: 8px; padding: 20px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
        .green { border-left: 5px solid #2ecc71; }
        .red { border-left: 5px solid #e74c3c; }
        .ticker { font-weight: bold; font-size: 1.2em; }
        .meta { color: #666; font-size: 0.9em; margin-bottom: 10px; }
    </style>
</head>
<body>
    <h1>📉 Market Intelligence Brief</h1>
    <p>Generated: ${new Date().toLocaleString()}</p>
    ${finalResults.map(r => `
        <div class="card ${r.pctChange > 0 ? 'green' : 'red'}">
            <div class="ticker">${r.ticker} (${r.pctChange > 0 ? '+' : ''}${r.pctChange.toFixed(2)}%)</div>
            <div class="meta">Price: $${r.price} • Type: ${r.event_class}</div>
            <div class="reason">${r.reason_summary}</div>
        </div>
    `).join('')}
</body>
</html>`;

await Actor.setValue('OUTPUT', finalResults);
await Actor.setValue('dashboard', htmlContent, { contentType: 'text/html' });

const storeId = Actor.getEnv().defaultKeyValueStoreId;
const publicUrl = `https://api.apify.com/v2/key-value-stores/${storeId}/records/dashboard?disableRedirect=true`;

console.log(`\n✨ SUCCESS!`);
console.log(`📊 Dataset: Check the "Dataset" tab`);
console.log(`🌍 Dashboard: ${publicUrl}`);

await Actor.exit();