require("dotenv").config();
const express = require("express");
const cors = require("cors");
const axios = require("axios");
const rateLimit = require("express-rate-limit");

const app = express();
const PORT = process.env.PORT || 3001;
const YT_KEY = process.env.YOUTUBE_API_KEY;
const BASE = "https://www.googleapis.com/youtube/v3";

// ── Middleware ──────────────────────────────────────────────────
app.use(cors({ origin: process.env.FRONTEND_URL || "*" }));
app.use(express.json());

const limiter = rateLimit({ windowMs: 60 * 1000, max: 30, message: { error: "Too many requests" } });
app.use("/api/", limiter);

// ── Health check ────────────────────────────────────────────────
app.get("/", (req, res) => res.json({ status: "KOL Source API running" }));

// ── Search channels ─────────────────────────────────────────────
// GET /api/search?keyword=python&maxResults=25&pageToken=xxx
app.get("/api/search", async (req, res) => {
  const { keyword = "", maxResults = 25, pageToken, language = "" } = req.query;

  if (!YT_KEY) return res.status(500).json({ error: "YouTube API key not configured" });
  if (!keyword.trim()) return res.status(400).json({ error: "keyword is required" });

  try {
    // Step 1: search for channels
    const searchParams = {
      part: "snippet",
      q: keyword,
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

    // Step 2: get full channel stats for each result
    const channelIds = items.map(i => i.snippet.channelId).join(",");
    const statsRes = await axios.get(`${BASE}/channels`, {
      params: { part: "snippet,statistics,brandingSettings", id: channelIds, key: YT_KEY },
    });

    const channels = (statsRes.data.items || []).map(ch => {
      const stats = ch.statistics || {};
      const subs = parseInt(stats.subscriberCount || 0);
      const views = parseInt(stats.viewCount || 0);
      const videos = parseInt(stats.videoCount || 0);
      const engRate = views > 0 && videos > 0
        ? Math.min(((views / videos / subs) * 100).toFixed(2), 99)
        : 0;

      return {
        id: ch.id,
        name: ch.snippet.title,
        handle: ch.snippet.customUrl ? `@${ch.snippet.customUrl.replace("@", "")}` : `@${ch.id}`,
        description: ch.snippet.description?.slice(0, 120) || "",
        avatar: ch.snippet.thumbnails?.default?.url || "",
        country: ch.snippet.country || "N/A",
        language: ch.snippet.defaultLanguage || ch.snippet.defaultAudioLanguage || "N/A",
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

// ── Get single channel detail ───────────────────────────────────
// GET /api/channel/:id
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
      banner: ch.brandingSettings?.image?.bannerExternalUrl,
      country: ch.snippet.country || "N/A",
      subscribers: parseInt(stats.subscriberCount || 0),
      views: parseInt(stats.viewCount || 0),
      videos: parseInt(stats.videoCount || 0),
      topics: ch.topicDetails?.topicCategories?.map(t => t.split("/").pop()) || [],
      youtubeUrl: `https://youtube.com/channel/${ch.id}`,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch channel" });
  }
});

// ── Quota check ─────────────────────────────────────────────────
app.get("/api/quota-info", (req, res) => {
  res.json({
    info: "YouTube Data API v3 free quota: 10,000 units/day",
    costs: { search: "100 units per search call", channelStats: "1 unit per channel batch" },
    tip: "Each /api/search call uses ~101 units. You get ~99 searches/day free.",
  });
});

app.listen(PORT, () => console.log(`KOL API server running on port ${PORT}`));
