# Market Reaction Intelligence 📈

> **Real-time stock volatility tracking with Multi-Model AI analysis.**

![License](https://img.shields.io/badge/license-MIT-blue) ![Node.js](https://img.shields.io/badge/node.js-v20-green) ![Platform](https://img.shields.io/badge/platform-Apify-orange)

## 📖 Table of Contents
- [About the Project](#about-the-project)
- [New Features (v2.2)](#new-features-v22)
- [How It Works](#how-it-works)
- [Tech Stack](#tech-stack)
- [Configuration](#configuration)
- [Output Examples](#output-examples)

---

## 🧐 About the Project
**Market Reaction Intelligence** is an automated financial intelligence tool designed to answer the question: *"Why is this stock moving right now?"*

Instead of manually refreshing news feeds, this actor monitors tickers across global markets (US, India, UK, etc.). When a stock breaches a volatility threshold (e.g., >3%), it scrapes local news sources and uses your choice of LLM (GPT-4o, Claude 3.5, Gemini 1.5) to generate a factual 1-sentence summary of the movement.

## 🚀 New Features (v2.2)
* **🌍 Multi-Region Support:** Automatically routes news searches based on ticker suffix:
    * `NVDA` → US News
    * `RVNL.NS` → India News
    * `RR.L` → UK News
* **🧠 Multi-Model AI:** Choose your preferred intelligence provider:
    * **OpenAI** (GPT-4o, GPT-3.5)
    * **Anthropic** (Claude 3.5 Sonnet/Haiku)
    * **Google** (Gemini 1.5 Pro/Flash)
* **📧 Email & Discord Alerts:** Get notified instantly via a rich HTML email or a Discord webhook.
* **📊 HTML Dashboard:** Generates a visual report of all daily moves (accessible via Public URL).

---

## ⚙️ How It Works
1.  **Target Identification:** Monitors user list OR auto-discovers trending stocks via Yahoo Finance.
2.  **Volatility Detection:** Filters stocks based on your % change threshold.
3.  **Smart Context Retrieval:** Detects the region from the ticker (e.g., `.NS` = India) and scrapes relevant local news.
4.  **AI Analysis:** Feeds context to the selected LLM to classify the event (Earnings, Macro, Merger) and summarize the reason.
5.  **Reporting:** Sends alerts and builds a public dashboard.

---

## 💻 Configuration (`INPUT.json`)

You can mix and match tickers from different countries and choose your alert methods.

| Parameter | Type | Description |
| :--- | :--- | :--- |
| `tickers` | Array | List of stocks. Use suffixes for non-US (e.g., `["RVNL.NS", "TSLA"]`). |
| `threshold` | Number | Minimum % change to trigger analysis (Default: `3.0`). |
| `openaiApiKey` | String | Key for GPT models. |
| `geminiApiKey` | String | Key for Google Gemini. |
| `anthropicApiKey`| String | Key for Claude. |
| `discordWebhook` | String | URL for Discord channel alerts. |
| `sendEmail` | Boolean | Set to `true` to receive email reports. |
| `recipientEmail` | String | (Optional) Email address. Defaults to your Apify account email. |

**Example Input:**
```json
{
    "tickers": ["TSLA", "TATAMOTORS.NS"],
    "threshold": 2.5,
    "geminiApiKey": "AIzaSyD...",
    "geminiModel": "gemini-1.5-flash",
    "sendEmail": true,
    "discordWebhook": "[https://discord.com/api/webhooks/](https://discord.com/api/webhooks/)..."
}

```

---

## 📊 Output Examples

### 1. Email Alert

> **Subject:** 📢 RVNL.NS Moved +5.20%
> **RVNL.NS (+5.20%)**
> **Price:** ₹450.00 • **Event Type:** CONTRACT
> **Why?**
> Rail Vikas Nigam Ltd shares surged after winning a ₹500 Cr order from South Central Railway.

### 2. JSON Dataset Item

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