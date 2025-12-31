# Market Reaction Intelligence 📈

> **Real-time stock volatility tracking with Multi-Model AI analysis.**

![License](https://img.shields.io/badge/license-MIT-blue) ![Node.js](https://img.shields.io/badge/node.js-v20-green) ![Platform](https://img.shields.io/badge/platform-Apify-orange)

## 📖 Table of Contents
- [About the Project](#about-the-project)
- [New Features (v2.2)](#new-features-v22)
- [How It Works](#how-it-works)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Configuration](#configuration)
- [Output Examples](#output-examples)

---

## 🧐 About the Project
**Market Reaction Intelligence** is an automated financial intelligence tool designed to answer the question: *"Why is this stock moving right now?"*

Instead of manually refreshing news feeds, this actor monitors tickers across global markets (US, India, UK, etc.). When a stock breaches a volatility threshold (e.g., >3%), it scrapes local news sources and uses your choice of LLM (GPT-4o, Claude 3.5, Gemini 1.5) to generate a factual 1-sentence summary of the movement.

## 🚀 New Features (v2.2)
* **🌍 Multi-Region Support:** Automatically routes news searches based on ticker suffix:
    * `NVDA` → US News
    * `RVNL.NS` / `RELIANCE.BO` → India News
    * `RR.L` → UK News
* **🧠 Multi-Model AI:** Choose your preferred intelligence provider:
    * **OpenAI** (GPT-4o, GPT-3.5)
    * **Anthropic** (Claude 3.5 Sonnet/Haiku)
    * **Google** (Gemini 1.5 Pro/Flash)
    * **OpenRouter** (Fallback)
* **🛡️ Robust JSON Parsing:** New fail-safe parser prevents "Unexpected token" errors from chatty AI responses.

## ⚙️ How It Works
1.  **Target Identification:** Monitors user list OR auto-discovers trending stocks via Yahoo Finance.
2.  **Volatility Detection:** Filters stocks based on % change threshold.
3.  **Smart Context Retrieval:** * Detects region from ticker (e.g., `.NS` = India).
    * Scrapes Google News (Local Edition) using `got-scraping`.
4.  **AI Analysis:** Feeds context to the selected LLM to classify the event (Earnings, Macro, Merger) and summarize the reason.
5.  **Reporting:** Sends color-coded Discord alerts and builds an HTML dashboard.

## 🛠️ Tech Stack
* **Runtime:** Node.js (ES Modules)
* **Platform:** Apify SDK
* **AI SDKs:** `openai`, `@anthropic-ai/sdk`, `@google/generative-ai`
* **Scraping:** `cheerio`, `got-scraping`, `jsdom`, `@mozilla/readability`

---

## 🚀 Getting Started

### Prerequisites
* Node.js 18+ installed.
* Apify CLI (`npm install -g apify-cli`).
* At least one API Key (OpenAI, Anthropic, Gemini, or OpenRouter).

### Installation
1.  **Clone the repo**
    ```bash
    git clone [https://github.com/yourusername/market-reaction-intelligence.git](https://github.com/yourusername/market-reaction-intelligence.git)
    cd market-reaction-intelligence
    ```
2.  **Install dependencies**
    ```bash
    npm install
    ```
3.  **Local Configuration**
    Create a `.env` file for local testing:
    ```env
    OPENAI_API_KEY=sk-...
    # or
    GEMINI_API_KEY=...
    ```

### Deployment to Apify
This project uses the `.actor` folder structure for schema definitions.

1.  **Login to Apify**
    ```bash
    apify login
    ```
2.  **Push to Cloud**
    ```bash
    apify push
    ```
3.  **Configure Inputs**
    Go to the Apify Console -> Actor -> Input tab and paste your API keys there.

---

## 💻 Configuration (`INPUT.json`)

You can mix and match tickers from different countries.

| Parameter | Description | Example |
| :--- | :--- | :--- |
| `tickers` | List of stocks. Use suffixes for non-US. | `["NVDA", "RVNL.NS", "RR.L"]` |
| `threshold` | Minimum % change to trigger analysis. | `3.0` |
| `openaiApiKey` | Key for GPT models. | `sk-...` |
| `geminiApiKey` | Key for Google Gemini. | `AIza...` |
| `anthropicApiKey`| Key for Claude. | `sk-ant...` |
| `discordWebhook` | URL for Discord alerts. | `https://discord.com...` |

**Example Input:**
```json
{
    "tickers": ["TSLA", "TATAMOTORS.NS"],
    "threshold": 2.5,
    "geminiApiKey": "AIzaSyD...",
    "geminiModel": "gemini-1.5-flash",
    "discordWebhook": "[https://discord.com/api/webhooks/](https://discord.com/api/webhooks/)..."
}

```

---

## 📊 Output Examples

### Discord Alert

> **RVNL.NS 🚀 +5.20%**
> **Price:** ₹450.00
> **Reason:** Rail Vikas Nigam Ltd shares surged after winning a ₹500 Cr order from South Central Railway.
> *Event: CONTRACT • Apify Intelligence*

### JSON Dataset Item

```json
{
  "ticker": "TSLA",
  "pctChange": -2.1,
  "reason_summary": "Tesla recalls 2 million vehicles due to autopilot safety concerns.",
  "event_class": "PRODUCT",
  "timestamp": "2025-12-31T10:00:00.000Z"
}

```

---

## 🤝 Contributing

Contributions are welcome!

1. Fork the Project
2. Create your Feature Branch
3. Commit your Changes
4. Push to the Branch
5. Open a Pull Request

## 📜 License

Distributed under the MIT License.

```

```
