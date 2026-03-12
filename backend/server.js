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
  // Lifestyle
  fitness:        { ja:"フィットネス", ko:"피트니스", zh:"健身", ar:"لياقة بدنية", hi:"फिटनेस", th:"ฟิตเนส", ru:"фитнес", tr:"fitness", id:"kebugaran" },
  food:           { ja:"料理", ko:"음식", zh:"美食", ar:"طبخ", hi:"खाना", th:"อาหาร", ru:"еда", tr:"yemek", id:"makanan" },
  cooking:        { ja:"料理レシピ", ko:"요리", zh:"烹饪", ar:"وصفات طبخ", hi:"खाना बनाना", th:"ทำอาหาร", ru:"кулинария", tr:"yemek tarifi", id:"memasak" },
  tech:           { ja:"テクノロジー", ko:"기술", zh:"科技", ar:"تقنية", hi:"तकनीक", th:"เทคโนโลยี", ru:"технологии", tr:"teknoloji", id:"teknologi" },
  gaming:         { ja:"ゲーム実況", ko:"게임", zh:"游戏", ar:"العاب", hi:"गेमिंग", th:"เกม", ru:"игры", tr:"oyun", id:"gaming" },
  beauty:         { ja:"美容", ko:"뷰티", zh:"美妆教程", ar:"مكياج", hi:"सौंदर्य", th:"ความงาม", ru:"красота", tr:"güzellik", id:"kecantikan" },
  fashion:        { ja:"ファッション", ko:"패션", zh:"时尚穿搭", ar:"موضة", hi:"फैशन", th:"แฟชั่น", ru:"мода", tr:"moda", id:"fashion" },
  travel:         { ja:"旅行vlog", ko:"여행", zh:"旅行", ar:"سفر", hi:"यात्रा", th:"ท่องเที่ยว", ru:"путешествия", tr:"seyahat", id:"traveling" },
  music:          { ja:"音楽", ko:"음악", zh:"音乐", ar:"موسيقى", hi:"संगीत", th:"ดนตรี", ru:"музыка", tr:"müzik", id:"musik" },
  education:      { ja:"教育", ko:"교육", zh:"教育学习", ar:"تعليم", hi:"शिक्षा", th:"การศึกษา", ru:"образование", tr:"eğitim", id:"edukasi" },
  lifestyle:      { ja:"ライフスタイル", ko:"일상", zh:"生活vlog", ar:"روتين يومي", hi:"जीवन शैली", th:"ไลฟ์สไตล์", ru:"образ жизни", tr:"yaşam tarzı", id:"lifestyle" },
  sports:         { ja:"スポーツ", ko:"스포츠", zh:"体育运动", ar:"رياضة", hi:"खेल", th:"กีฬา", ru:"спорт", tr:"spor", id:"olahraga" },
  makeup:         { ja:"メイクアップ", ko:"메이크업", zh:"化妆教程", ar:"مكياج تعليمي", hi:"मेकअप टिप्स", th:"สอนแต่งหน้า", ru:"макияж", tr:"makyaj", id:"makeup" },
  skincare:       { ja:"スキンケア", ko:"스킨케어", zh:"护肤品", ar:"العناية بالبشرة", hi:"स्किन केयर", th:"สกินแคร์", ru:"уход за кожей", tr:"cilt bakımı", id:"skincare" },
  vlog:           { ja:"日常vlog", ko:"일상브이로그", zh:"日常vlog", ar:"يوميات", hi:"व्लॉग", th:"วีล็อก", ru:"влог", tr:"günlük vlog", id:"vlog harian" },
  comedy:         { ja:"お笑い", ko:"개그", zh:"搞笑视频", ar:"فيديو مضحك", hi:"कॉमेडी", th:"ตลก", ru:"юмор", tr:"komedi", id:"komedi" },
  yoga:           { ja:"ヨガ", ko:"요가", zh:"瑜伽", ar:"يوغا", hi:"योग", th:"โยคะ", ru:"йога", tr:"yoga", id:"yoga" },
  review:         { ja:"レビュー", ko:"리뷰", zh:"测评", ar:"مراجعة منتجات", hi:"रिव्यू", th:"รีวิว", ru:"обзор", tr:"inceleme", id:"review" },
  health:         { ja:"健康", ko:"건강", zh:"健康养生", ar:"صحة", hi:"स्वास्थ्य", th:"สุขภาพ", ru:"здоровье", tr:"sağlık", id:"kesehatan" },
  diet:           { ja:"ダイエット", ko:"다이어트", zh:"减肥瘦身", ar:"حمية", hi:"डाइट", th:"ลดน้ำหนัก", ru:"диета", tr:"diyet", id:"diet" },
  workout:        { ja:"筋トレ", ko:"운동", zh:"健身训练", ar:"تمرين", hi:"वर्कआउट", th:"ออกกำลังกาย", ru:"тренировка", tr:"egzersiz", id:"olahraga" },
  news:           { ja:"ニュース", ko:"뉴스", zh:"新闻", ar:"أخبار", hi:"समाचार", th:"ข่าว", ru:"новости", tr:"haberler", id:"berita" },
  business:       { ja:"ビジネス", ko:"비즈니스", zh:"商业", ar:"أعمال", hi:"व्यापार", th:"ธุรกิจ", ru:"бизнес", tr:"iş", id:"bisnis" },
  car:            { ja:"車", ko:"자동차", zh:"汽车", ar:"سيارات", hi:"कार", th:"รถยนต์", ru:"автомобиль", tr:"araba", id:"mobil" },
  anime:          { ja:"アニメ", ko:"애니메이션", zh:"动漫", ar:"انمي", hi:"एनीमे", th:"อนิเมะ", ru:"аниме", tr:"anime", id:"anime" },
  pets:           { ja:"ペット", ko:"반려동물", zh:"宠物", ar:"حيوانات أليفة", hi:"पालतू जानवर", th:"สัตว์เลี้ยง", ru:"домашние животные", tr:"evcil hayvan", id:"hewan peliharaan" },
  // Crypto / Finance
  crypto:         { ja:"仮想通貨", ko:"암호화폐", zh:"加密货币", ar:"عملات مشفرة", hi:"क्रिप्टो", th:"คริปโต", ru:"крипто", tr:"kripto", id:"kripto" },
  cryptocurrency: { ja:"仮想通貨", ko:"암호화폐", zh:"加密货币", ar:"عملات رقمية", hi:"क्रिप्टोकरेंसी", th:"คริปโตเคอร์เรนซี", ru:"криптовалюта", tr:"kripto para", id:"cryptocurrency" },
  bitcoin:        { ja:"ビットコイン", ko:"비트코인", zh:"比特币", ar:"بيتكوين", hi:"बिटकॉइन", th:"บิตคอยน์", ru:"биткоин", tr:"bitcoin", id:"bitcoin" },
  ethereum:       { ja:"イーサリアム", ko:"이더리움", zh:"以太坊", ar:"إيثريوم", hi:"एथेरियम", th:"อีเธอเรียม", ru:"эфириум", tr:"ethereum", id:"ethereum" },
  nft:            { ja:"NFT", ko:"NFT", zh:"NFT数字藏品", ar:"رمز غير قابل للاستبدال", hi:"एनएफटी", th:"NFT", ru:"НФТ", tr:"NFT", id:"NFT" },
  defi:           { ja:"DeFi分散型金融", ko:"디파이", zh:"去中心化金融DeFi", ar:"تمويل لامركزي", hi:"डीफाई", th:"DeFi", ru:"децентрализованные финансы", tr:"DeFi", id:"DeFi" },
  blockchain:     { ja:"ブロックチェーン", ko:"블록체인", zh:"区块链", ar:"بلوكشين", hi:"ब्लॉकचेन", th:"บล็อกเชน", ru:"блокчейн", tr:"blokzinciri", id:"blockchain" },
  trading:        { ja:"トレード", ko:"트레이딩", zh:"交易", ar:"تداول", hi:"ट्रेडिंग", th:"เทรด", ru:"трейдинг", tr:"trading", id:"trading" },
  investment:     { ja:"投資", ko:"투자", zh:"投资理财", ar:"استثمار", hi:"निवेश", th:"การลงทุน", ru:"инвестиции", tr:"yatırım", id:"investasi" },
  finance:        { ja:"投資", ko:"재테크", zh:"理财", ar:"استثمار", hi:"निवेश", th:"การเงิน", ru:"финансы", tr:"yatırım", id:"investasi" },
  stock:          { ja:"株式投資", ko:"주식", zh:"股票", ar:"أسهم", hi:"शेयर बाजार", th:"หุ้น", ru:"акции", tr:"borsa", id:"saham" },
  wallet:         { ja:"暗号資産ウォレット", ko:"암호화폐 지갑", zh:"加密钱包", ar:"محفظة رقمية", hi:"क्रिप्टो वॉलेट", th:"กระเป๋าคริปโต", ru:"крипто кошелёк", tr:"kripto cüzdan", id:"dompet kripto" },
  card:           { ja:"カード", ko:"카드", zh:"卡", ar:"بطاقة", hi:"कार्ड", th:"บัตร", ru:"карта", tr:"kart", id:"kartu" },
  // Common multi-word phrases
  "crypto card":  { ja:"仮想通貨カード", ko:"암호화폐 카드", zh:"加密货币卡", ar:"بطاقة عملات مشفرة", hi:"क्रिप्टो कार्ड", th:"บัตรคริปโต", ru:"крипто карта", tr:"kripto kart", id:"kartu kripto" },
  "debit card":   { ja:"デビットカード", ko:"직불카드", zh:"借记卡", ar:"بطاقة خصم", hi:"डेबिट कार्ड", th:"บัตรเดบิต", ru:"дебетовая карта", tr:"banka kartı", id:"kartu debit" },
  "credit card":  { ja:"クレジットカード", ko:"신용카드", zh:"信用卡", ar:"بطاقة ائتمان", hi:"क्रेडिट कार्ड", th:"บัตรเครดิต", ru:"кредитная карта", tr:"kredi kartı", id:"kartu kredit" },
  "stock market": { ja:"株式市場", ko:"주식시장", zh:"股票市场", ar:"سوق الأسهم", hi:"शेयर बाजार", th:"ตลาดหุ้น", ru:"фондовый рынок", tr:"borsa", id:"pasar saham" },
  "passive income":{ ja:"不労所得", ko:"수동 소득", zh:"被动收入", ar:"دخل سلبي", hi:"निष्क्रिय आय", th:"รายได้เสริม", ru:"пассивный доход", tr:"pasif gelir", id:"penghasilan pasif" },
};

// Unicode script ranges for each language — used to filter out English-only channels
const SCRIPT_REGEX = {
  ja: /[\u3040-\u30FF\u4E00-\u9FFF]/,   // Hiragana, Katakana, Kanji
  ko: /[\uAC00-\uD7AF\u1100-\u11FF]/,    // Hangul
  zh: /[\u4E00-\u9FFF\u3400-\u4DBF]/,    // CJK characters
  ar: /[\u0600-\u06FF]/,                    // Arabic
  hi: /[\u0900-\u097F]/,                    // Devanagari
  th: /[\u0E00-\u0E7F]/,                    // Thai
  ru: /[\u0400-\u04FF]/,                    // Cyrillic
  tr: null,  // Latin-based, can't filter by script
  id: null,  // Latin-based
  de: null,  // Latin-based
  fr: null,  // Latin-based
  es: null,  // Latin-based
  pt: null,  // Latin-based
  it: null,  // Latin-based
};

const hasTargetScript = (channel, language) => {
  const regex = SCRIPT_REGEX[language];
  if (!regex) return true; // Latin-based languages — can't filter by script
  const text = (channel.name || "") + " " + (channel.description || "");
  return regex.test(text);
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
      const exactMatch = TRANSLATIONS[keyLower]?.[language];
      if (exactMatch) {
        searchQuery = exactMatch;
      } else {
        const words = keyLower.split(/\s+/);
        const translatedWords = words.map(w => TRANSLATIONS[w]?.[language] || w);
        const anyTranslated = translatedWords.some((t, i) => t !== words[i]);
        searchQuery = anyTranslated ? translatedWords.join(" ") : keyword;
      }
    }

    const regionCode = LANG_TO_REGION[language];
    const targetCount = Math.min(Number(maxResults), 25);
    const seenIds = new Set();
    let allChannels = [];
    let currentPageToken = pageToken || null;
    let lastNextPageToken = null;
    const maxPages = 4; // fetch up to 4 pages (400 quota units) to fill results

    for (let page = 0; page < maxPages; page++) {
      const searchParams = {
        part: "snippet",
        q: searchQuery,
        type: "channel",
        maxResults: 50, // always fetch max per page
        key: YT_KEY,
      };
      if (currentPageToken) searchParams.pageToken = currentPageToken;
      if (regionCode) searchParams.regionCode = regionCode;
      if (language) searchParams.relevanceLanguage = language;

      const searchRes = await axios.get(`${BASE}/search`, { params: searchParams });
      const items = searchRes.data.items || [];
      lastNextPageToken = searchRes.data.nextPageToken || null;

      if (items.length === 0) break;

      // Fetch stats for this page's channels
      const newIds = items.map(i => i.snippet.channelId).filter(id => !seenIds.has(id));
      if (newIds.length === 0) break;
      newIds.forEach(id => seenIds.add(id));

      const statsRes = await axios.get(`${BASE}/channels`, {
        params: { part: "snippet,statistics,brandingSettings", id: newIds.join(","), key: YT_KEY },
      });

      // Fetch latest video date for each channel (1 search call per channel is too expensive,
      // so we use the channels.contentDetails part to get uploads playlist, then get latest video)
      const uploadsMap = {};
      const contentRes = await axios.get(`${BASE}/channels`, {
        params: { part: "contentDetails", id: newIds.join(","), key: YT_KEY },
      });
      const uploadsPlaylistIds = (contentRes.data.items || []).map(ch => {
        uploadsMap[ch.id] = ch.contentDetails?.relatedPlaylists?.uploads;
        return ch.contentDetails?.relatedPlaylists?.uploads;
      }).filter(Boolean);

      // Build reverse map: playlistId → channelId
      const playlistToChannel = {};
      Object.entries(uploadsMap).forEach(([chId, plId]) => { if (plId) playlistToChannel[plId] = chId; });

      // Batch: fetch latest videos from each uploads playlist
      const latestVideoMap = {};
      await Promise.all(uploadsPlaylistIds.map(async (playlistId) => {
        try {
          const r = await axios.get(`${BASE}/playlistItems`, {
            params: { part: "snippet,contentDetails", playlistId, maxResults: 5, key: YT_KEY },
          });
          // Use reverse map to get channelId reliably
          const channelId = playlistToChannel[playlistId] || r.data.items?.[0]?.snippet?.channelId;
          if (!channelId) return;
          const dates = (r.data.items || [])
            .map(i => i.contentDetails?.videoPublishedAt || i.snippet?.publishedAt)
            .filter(Boolean)
            .map(d => new Date(d));
          if (dates.length > 0) {
            latestVideoMap[channelId] = {
              lastPostDate: dates[0].toISOString(),
              avgDaysBetweenPosts: dates.length >= 2
                ? Math.round((dates[0] - dates[dates.length - 1]) / (1000 * 60 * 60 * 24) / (dates.length - 1))
                : null,
            };
          }
        } catch (_) {}
      }));

      const pageChannels = (statsRes.data.items || []).map(ch => {
        const stats = ch.statistics || {};
        const subs = parseInt(stats.subscriberCount || 0);
        const views = parseInt(stats.viewCount || 0);
        const videos = parseInt(stats.videoCount || 0);
        const engRate = views > 0 && videos > 0 && subs > 0
          ? Math.min(((views / videos / subs) * 100).toFixed(2), 99) : 0;

        const activity = latestVideoMap[ch.id] || null;
        const daysSincePost = activity?.lastPostDate
          ? Math.floor((Date.now() - new Date(activity.lastPostDate)) / (1000 * 60 * 60 * 24))
          : null;

        return {
          id: ch.id,
          name: ch.snippet.title,
          handle: ch.snippet.customUrl ? `@${ch.snippet.customUrl.replace("@", "")}` : `@${ch.id}`,
          description: ch.snippet.description?.slice(0, 120) || "",
          avatar: ch.snippet.thumbnails?.default?.url || "",
          country: ch.snippet.country || regionCode || "N/A",
          language: ch.snippet.defaultLanguage || ch.snippet.defaultAudioLanguage || language || "N/A",
          subscribers: subs,
          views,
          videos,
          engagementRate: parseFloat(engRate),
          verified: subs > 100000,
          youtubeUrl: `https://youtube.com/channel/${ch.id}`,
          lastPostDate: activity?.lastPostDate || null,
          daysSincePost,
          avgDaysBetweenPosts: activity?.avgDaysBetweenPosts || null,
        };
      });

      // Filter by script
      const filtered = language
        ? pageChannels.filter(ch => hasTargetScript(ch, language))
        : pageChannels;

      allChannels = allChannels.concat(filtered);

      // Stop if we have enough results or no more pages
      if (allChannels.length >= targetCount || !lastNextPageToken) break;
      currentPageToken = lastNextPageToken;
    }

    res.json({ channels: allChannels.slice(0, targetCount), nextPageToken: lastNextPageToken });
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

// Debug: test activity fetch for a single channel id
// GET /api/debug-activity?channelId=UCxxxxxx
app.get("/api/debug-activity", async (req, res) => {
  const { channelId } = req.query;
  if (!channelId) return res.status(400).json({ error: "channelId required" });
  try {
    const contentRes = await axios.get(`${BASE}/channels`, {
      params: { part: "contentDetails", id: channelId, key: YT_KEY },
    });
    const ch = contentRes.data.items?.[0];
    const uploadsPlaylistId = ch?.contentDetails?.relatedPlaylists?.uploads;
    if (!uploadsPlaylistId) return res.json({ error: "no uploads playlist", raw: contentRes.data });

    const playlistRes = await axios.get(`${BASE}/playlistItems`, {
      params: { part: "snippet,contentDetails", playlistId: uploadsPlaylistId, maxResults: 5, key: YT_KEY },
    });
    const dates = (playlistRes.data.items || []).map(i => ({
      title: i.snippet?.title,
      published: i.contentDetails?.videoPublishedAt || i.snippet?.publishedAt,
    }));
    res.json({ uploadsPlaylistId, channelId, dates, raw: playlistRes.data.items?.slice(0,2) });
  } catch (err) {
    res.status(500).json({ error: err.message, detail: err.response?.data });
  }
});

app.listen(PORT, () => console.log(`KOL API server running on port ${PORT}`));
