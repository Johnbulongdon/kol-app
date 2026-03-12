require("dotenv").config();
const express = require("express");
const cors = require("cors");
const axios = require("axios");
const rateLimit = require("express-rate-limit");

const app = express();
const PORT = process.env.PORT || 3001;
const YT_KEY = process.env.YOUTUBE_API_KEY;
const BASE = "https://www.googleapis.com/youtube/v3";

const LANG_NAMES = {
  en:"English", es:"Spanish", pt:"Portuguese", fr:"French", de:"German",
  ja:"Japanese", ko:"Korean", zh:"Chinese", ar:"Arabic", hi:"Hindi",
  id:"Indonesian", th:"Thai", ru:"Russian", tr:"Turkish", it:"Italian"
};

app.use(cors({ origin: process.env.FRONTEND_URL || "*" }));
app.use(express.json());

const limiter = rateLimit({ windowMs: 60 * 1000, max: 30, message: { error: "Too many requests" } });
app.use("/api/", limiter);

app.get("/", (req, res) => res.json({ status: "KOL Source API running" }));

app.get("/api/search", async (req, res) => {
  const { keyword = "", maxResults = 25, pageToken, language = "" } = req.query;

  if (!YT_KEY) return res.status(500).json({ error: "YouTube API key not configured" });
  if (!keyword.trim()) return res.status(400).json({ error: "keyword is required" });

  try {
    // Appending the language name to the query gives much better language-filtered results
    const searchQuery = language && LANG_NAMES[language]
      ? `${keyword} ${LANG_NAMES[language]}`
      : keyword;

    const searchParams = {
      part: "snippet",
      q: searchQuery,
      type: "channel",
      maxResults: Math.min(Number(maxResults), 50),
      key: YT_KEY,
    };
    if (pageToken) searchParams.pageToken = pageToken;
    if (language) searchParams.relevanceLanguage = language;

    const searchRes = await axios.get(`${BASE}/search`, { params: searchParams });
    const items = searchRes.data.items || [];
    const nextPageToken = searchRes.data.nextPageToken || null;

    if (items.length === 0) return res.json({ channels: [], nextPageToken: null });

    const channelIds = items.map(i => i.snippet.channelId).join(",");
    const statsRes = await axios.get(`${BASE}/channels`, {
      params: { part: "snippet,statistics,brandingSettings", id: channelIds, key: YT_KEY },
    });

    const channels = (statsRes.data.items || []).map(ch => {
      const stats = ch.statistics || {};
      const subs = parseInt(stats.subscriberCount || 0);
      const views = parseInt(stats.viewCount || 0);
      const videos = parseInt(stats.videoCount || 0);
      const engRate = views > 0 && videos > 0 && subs > 0
        ? Math.min(((views / videos / subs) * 100).toFixed(2), 99)
        : 0;

      // Use the searched language as fallback if channel doesn't declare one
      const detectedLang = ch.snippet.defaultLanguage || ch.snippet.defaultAudioLanguage || language || "N/A";

      return {
        id: ch.id,
        name: ch.snippet.title,
        handle: ch.snippet.customUrl ? `@${ch.snippet.customUrl.replace("@", "")}` : `@${ch.id}`,
        description: ch.snippet.description?.slice(0, 120) || "",
        avatar: ch.snippet.thumbnails?.default?.url || "",
        country: ch.snippet.country || "N/A",
        language: detectedLang,
        subscribers: subs,
        views,
        videos,
        engagementRate: parseFloat(engRate),
        verified: subs > 100000,
        youtubeUrl: `https://youtube.com/channel/${ch.id}`,
      };
    });

    res.json({ channels, nextPageToken });
  } catch (err) {
    console.error("YouTube API error:", err.response?.data || err.message);
    const ytErr = err.response?.data?.error;
    if (ytErr?.code === 403) return res.status(403).json({ error: "YouTube API quota exceeded. Try again tomorrow." });
    res.status(500).json({ error: "Failed to fetch from YouTube API" });
  }
});

app.get("/api/channel/:id", async (req, res) => {
  const { id } = req.params;
  if (!YT_KEY) return res.status(500).json({ error: "API key not configured" });
  try {
    const r = await axios.get(`${BASE}/channels`, {
      params: { part: "snippet,statistics,brandingSettings,topicDetails", id, key: YT_KEY },
    });
    const ch = r.data.items?.[0];
    if (!ch) return res.status(404).json({ error: "Channel not found" });
    const stats = ch.statistics || {};
    res.json({
      id: ch.id,
      name: ch.snippet.title,
      description: ch.snippet.description,
      avatar: ch.snippet.thumbnails?.high?.url,
      country: ch.snippet.country || "N/A",
      subscribers: parseInt(stats.subscriberCount || 0),
      views: parseInt(stats.viewCount || 0),
      videos: parseInt(stats.videoCount || 0),
      youtubeUrl: `https://youtube.com/channel/${ch.id}`,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch channel" });
  }
});

app.get("/api/quota-info", (req, res) => {
  res.json({
    info: "YouTube Data API v3 free quota: 10,000 units/day",
    costs: { search: "100 units per call", channelStats: "1 unit per batch" },
  });
});

app.listen(PORT, () => console.log(`KOL API server running on port ${PORT}`));
