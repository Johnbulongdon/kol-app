require("dotenv").config();
const express = require("express");
const cors = require("cors");
const axios = require("axios");
const rateLimit = require("express-rate-limit");

const app = express();
const PORT = process.env.PORT || 3001;
const YT_KEY = process.env.YOUTUBE_API_KEY;
const BASE = "https://www.googleapis.com/youtube/v3";

// Native language search terms — YouTube responds to native script searches
// Format: { keyword: { langCode: "native translation" } }
const KEYWORD_TRANSLATIONS = {
  // Common KOL/influencer niches
  fitness:    { ja:"フィットネス", ko:"피트니스", zh:"健身", ar:"لياقة", hi:"फिटनेस", th:"ฟิตเนส", ru:"фитнес", tr:"fitness" },
  food:       { ja:"料理", ko:"요리", zh:"美食", ar:"طبخ", hi:"खाना", th:"อาหาร", ru:"еда", tr:"yemek" },
  cooking:    { ja:"料理", ko:"요리", zh:"烹饪", ar:"طبخ", hi:"खाना बनाना", th:"การทำอาหาร", ru:"кулинария", tr:"yemek tarifi" },
  tech:       { ja:"テクノロジー", ko:"기술", zh:"科技", ar:"تقنية", hi:"तकनीक", th:"เทคโนโลยี", ru:"технологии", tr:"teknoloji" },
  gaming:     { ja:"ゲーム", ko:"게임", zh:"游戏", ar:"ألعاب", hi:"गेमिंग", th:"เกม", ru:"игры", tr:"oyun" },
  beauty:     { ja:"美容", ko:"뷰티", zh:"美妆", ar:"جمال", hi:"सौंदर्य", th:"ความงาม", ru:"красота", tr:"güzellik" },
  fashion:    { ja:"ファッション", ko:"패션", zh:"时尚", ar:"موضة", hi:"फैशन", th:"แฟชั่น", ru:"мода", tr:"moda" },
  travel:     { ja:"旅行", ko:"여행", zh:"旅行", ar:"سفر", hi:"यात्रा", th:"การเดินทาง", ru:"путешествия", tr:"seyahat" },
  music:      { ja:"音楽", ko:"음악", zh:"音乐", ar:"موسيقى", hi:"संगीत", th:"ดนตรี", ru:"музыка", tr:"müzik" },
  education:  { ja:"教育", ko:"교육", zh:"教育", ar:"تعليم", hi:"शिक्षा", th:"การศึกษา", ru:"образование", tr:"eğitim" },
  finance:    { ja:"金融", ko:"금융", zh:"金融", ar:"مال", hi:"वित्त", th:"การเงิน", ru:"финансы", tr:"finans" },
  lifestyle:  { ja:"ライフスタイル", ko:"라이프스타일", zh:"生活方式", ar:"أسلوب حياة", hi:"जीवन शैली", th:"ไลฟ์สไตล์", ru:"образ жизни", tr:"yaşam tarzı" },
  sports:     { ja:"スポーツ", ko:"스포츠", zh:"体育", ar:"رياضة", hi:"खेल", th:"กีฬา", ru:"спорт", tr:"spor" },
  health:     { ja:"健康", ko:"건강", zh:"健康", ar:"صحة", hi:"स्वास्थ्य", th:"สุขภาพ", ru:"здоровье", tr:"sağlık" },
  yoga:       { ja:"ヨガ", ko:"요가", zh:"瑜伽", ar:"يوغا", hi:"योग", th:"โยคะ", ru:"йога", tr:"yoga" },
  comedy:     { ja:"コメディ", ko:"코미디", zh:"喜剧", ar:"كوميديا", hi:"कॉमेडी", th:"ตลก", ru:"комедия", tr:"komedi" },
  vlog:       { ja:"ブログ", ko:"브이로그", zh:"视频博客", ar:"مدونة فيديو", hi:"व्लॉग", th:"วีล็อก", ru:"влог", tr:"vlog" },
  makeup:     { ja:"メイク", ko:"메이크업", zh:"化妆", ar:"مكياج", hi:"मेकअप", th:"เมคอัพ", ru:"макияж", tr:"makyaj" },
  skincare:   { ja:"スキンケア", ko:"스킨케어", zh:"护肤", ar:"العناية بالبشرة", hi:"स्किनकेयर", th:"สกินแคร์", ru:"уход за кожей", tr:"cilt bakımı" },
  review:     { ja:"レビュー", ko:"리뷰", zh:"评测", ar:"مراجعة", hi:"समीक्षा", th:"รีวิว", ru:"обзор", tr:"inceleme" },
};

// Native language labels appended to search to bias results
const LANG_NATIVE = {
  en: "", es: "español", pt: "português", fr: "français", de: "deutsch",
  ja: "日本語", ko: "한국어", zh: "中文", ar: "عربي", hi: "हिंदी",
  id: "bahasa indonesia", th: "ภาษาไทย", ru: "русский", tr: "türkçe", it: "italiano"
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
    let searchQuery = keyword.trim();

    if (language && language !== "en") {
      const keywordLower = keyword.toLowerCase().trim();
      // Check if we have a native translation for this keyword
      const translation = KEYWORD_TRANSLATIONS[keywordLower]?.[language];
      if (translation) {
        // Use native script translation — most effective
        searchQuery = translation;
      } else {
        // Fallback: append native language label to original keyword
        const nativeLabel = LANG_NATIVE[language] || "";
        searchQuery = nativeLabel ? `${keyword} ${nativeLabel}` : keyword;
      }
    }

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
