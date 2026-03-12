require("dotenv").config();
const express = require("express");
const cors = require("cors");
const axios = require("axios");
const rateLimit = require("express-rate-limit");

const app = express();
const PORT = process.env.PORT || 3001;
const YT_KEY = process.env.YOUTUBE_API_KEY;
const BASE = "https://www.googleapis.com/youtube/v3";

// Map language → region code (YouTube regionCode param locks results to that country)
const LANG_TO_REGION = {
  ja: "JP", ko: "KR", zh: "TW", ar: "SA", hi: "IN",
  th: "TH", ru: "RU", tr: "TR", id: "ID", de: "DE",
  fr: "FR", es: "MX", pt: "BR", it: "IT", en: "US"
};

// Native script translations for common keywords
const TRANSLATIONS = {
  fitness:   { ja:"フィットネス", ko:"피트니스", zh:"健身", ar:"لياقة بدنية", hi:"फिटनेस", th:"ฟิตเนส", ru:"фитнес", tr:"fitness", id:"kebugaran" },
  food:      { ja:"料理", ko:"음식", zh:"美食", ar:"طبخ", hi:"खाना", th:"อาหาร", ru:"еда", tr:"yemek", id:"makanan" },
  cooking:   { ja:"料理レシピ", ko:"요리", zh:"烹饪", ar:"وصفات طبخ", hi:"खाना बनाना", th:"ทำอาหาร", ru:"кулинария", tr:"yemek tarifi", id:"memasak" },
  tech:      { ja:"テクノロジー", ko:"기술", zh:"科技", ar:"تقنية", hi:"तकनीक", th:"เทคโนโลยี", ru:"технологии", tr:"teknoloji", id:"teknologi" },
  gaming:    { ja:"ゲーム実況", ko:"게임", zh:"游戏", ar:"العاب", hi:"गेमिंग", th:"เกม", ru:"игры", tr:"oyun", id:"gaming" },
  beauty:    { ja:"美容", ko:"뷰티", zh:"美妆教程", ar:"مكياج", hi:"सौंदर्य", th:"ความงาม", ru:"красота", tr:"güzellik", id:"kecantikan" },
  fashion:   { ja:"ファッション", ko:"패션", zh:"时尚穿搭", ar:"موضة", hi:"फैशन", th:"แฟชั่น", ru:"мода", tr:"moda", id:"fashion" },
  travel:    { ja:"旅行vlog", ko:"여행", zh:"旅行", ar:"سفر", hi:"यात्रा", th:"ท่องเที่ยว", ru:"путешествия", tr:"seyahat", id:"traveling" },
  music:     { ja:"音楽", ko:"음악", zh:"音乐", ar:"موسيقى", hi:"संगीत", th:"ดนตรี", ru:"музыка", tr:"müzik", id:"musik" },
  education: { ja:"教育", ko:"교육", zh:"教育学习", ar:"تعليم", hi:"शिक्षा", th:"การศึกษา", ru:"образование", tr:"eğitim", id:"edukasi" },
  finance:   { ja:"投資", ko:"재테크", zh:"理财", ar:"استثمار", hi:"निवेश", th:"การเงิน", ru:"финансы", tr:"yatırım", id:"investasi" },
  lifestyle: { ja:"ライフスタイル", ko:"일상", zh:"生活vlog", ar:"روتين يومي", hi:"जीवन शैली", th:"ไลฟ์สไตล์", ru:"образ жизни", tr:"yaşam tarzı", id:"lifestyle" },
  sports:    { ja:"スポーツ", ko:"스포츠", zh:"体育运动", ar:"رياضة", hi:"खेल", th:"กีฬา", ru:"спорт", tr:"spor", id:"olahraga" },
  makeup:    { ja:"メイクアップ", ko:"메이크업", zh:"化妆教程", ar:"مكياج تعليمي", hi:"मेकअप टिप्स", th:"สอนแต่งหน้า", ru:"макияж", tr:"makyaj", id:"makeup" },
  skincare:  { ja:"スキンケア", ko:"스킨케어", zh:"护肤品", ar:"العناية بالبشرة", hi:"स्किन केयर", th:"สกินแคร์", ru:"уход за кожей", tr:"cilt bakımı", id:"skincare" },
  vlog:      { ja:"日常vlog", ko:"일상브이로그", zh:"日常vlog", ar:"يوميات", hi:"व्लॉग", th:"วีล็อก", ru:"влог", tr:"günlük vlog", id:"vlog harian" },
  comedy:    { ja:"お笑い", ko:"개그", zh:"搞笑视频", ar:"فيديو مضحك", hi:"कॉमेडी", th:"ตลก", ru:"юмор", tr:"komedi", id:"komedi" },
  yoga:      { ja:"ヨガ", ko:"요가", zh:"瑜伽", ar:"يوغا", hi:"योग", th:"โยคะ", ru:"йога", tr:"yoga", id:"yoga" },
  review:    { ja:"レビュー", ko:"리뷰", zh:"测评", ar:"مراجعة منتجات", hi:"रिव्यू", th:"รีวิว", ru:"обзор", tr:"inceleme", id:"review" },
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
    // Build search query — translate to native script if possible
    let searchQuery = keyword.trim();
    if (language && language !== "en") {
      const keyLower = keyword.toLowerCase().trim();
      const translated = TRANSLATIONS[keyLower]?.[language];
      searchQuery = translated || keyword;
    }

    const searchParams = {
      part: "snippet",
      q: searchQuery,
      type: "channel",
      maxResults: Math.min(Number(maxResults), 50),
      key: YT_KEY,
    };
    if (pageToken) searchParams.pageToken = pageToken;

    // regionCode is the most reliable way to get local-language creators
    const regionCode = LANG_TO_REGION[language];
    if (regionCode) searchParams.regionCode = regionCode;
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
        ? Math.min(((views / videos / subs) * 100).toFixed(2), 99) : 0;

      return {
        id: ch.id,
        name: ch.snippet.title,
        handle: ch.snippet.customUrl ? `@${ch.snippet.customUrl.replace("@", "")}` : `@${ch.id}`,
        description: ch.snippet.description?.slice(0, 120) || "",
        avatar: ch.snippet.thumbnails?.default?.url || "",
        country: ch.snippet.country || LANG_TO_REGION[language] || "N/A",
        language: ch.snippet.defaultLanguage || ch.snippet.defaultAudioLanguage || language || "N/A",
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
      id: ch.id, name: ch.snippet.title,
      description: ch.snippet.description,
      avatar: ch.snippet.thumbnails?.high?.url,
      country: ch.snippet.country || "N/A",
      subscribers: parseInt(stats.subscriberCount || 0),
      views: parseInt(stats.viewCount || 0),
      videos: parseInt(stats.videoCount || 0),
      youtubeUrl: `https://youtube.com/channel/${ch.id}`,
    });
  } catch (err) { res.status(500).json({ error: "Failed to fetch channel" }); }
});

app.get("/api/quota-info", (req, res) => {
  res.json({ info: "10,000 units/day free", costs: { search: "100 units/call" } });
});

app.listen(PORT, () => console.log(`KOL API server running on port ${PORT}`));
