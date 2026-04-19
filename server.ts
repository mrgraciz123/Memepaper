import 'dotenv/config';
import express from 'express';
import Parser from 'rss-parser';
import path from 'path';
import { Resend } from 'resend';
import fs from 'fs';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

// Load variables from .env.example since that's where the key was placed
dotenv.config({ path: '.env.example' });

const app = express();
const PORT = 3000;

app.use(express.json());

// Set EJS as the view engine
app.set('view engine', 'ejs');
app.set('views', path.join(process.cwd(), 'views'));

// Initialize RSS Parser
const parser = new Parser({
  customFields: {
    item: ['description', 'pubDate'],
  }
});

const RSS_FEEDS = [
  {"url": "https://timesofindia.indiatimes.com/rssfeedstopstories.cms", "source": "Times of India"},
  {"url": "https://feeds.feedburner.com/ndtvnews-top-stories", "source": "NDTV"},
  {"url": "https://www.hindustantimes.com/feeds/rss/india-news/rssfeed.xml", "source": "Hindustan Times"},
  {"url": "https://www.thehindu.com/news/national/feeder/default.rss", "source": "The Hindu"},
  {"url": "https://www.indiatoday.in/rss/home", "source": "India Today"},
];

const MEME_TEMPLATES: Record<string, string[]> = {
  "education": [
    "JEE aspirant after reading this: 'Bhai yeh real hai ya trauma? 😭🔥'",
    "CBSE ne phir kuch announce kiya — students: 'Mummy, main hostel chhod raha hoon 💀'",
    "Syllabus change again = 1 aur reason to cry at 3 AM 🌙😭",
    "Coaching centre wale abhi WhatsApp blast bhej rahe honge: 'Naya batch! 🚀' 😂",
    "Padhai toh door ki baat, yeh news padh ke hi anxiety aa gayi 📚💀",
    "Every student right now: '4 saal mehnat, phir bhi yahi haal 😭'",
  ],
  "cricket": [
    "India jeetega toh roads pe tractor, harega toh Twitter pe BCCI ki class 🏏🔥",
    "Match ke din office attendance: 0. Boss bhi same room mein tha 😂🏏",
    "Har Indian ek expert ban jaata hai jab India lose karta hai 😂🏏",
    "IPL season = zero productive humans in India. HR: 'Where is everyone?' 😭🏏",
    "India vs anyone = families split, exams ignored, chai tripled ☕🏏",
    "Cricket match > koi bhi deadline. Always. Without exception. 🏏😂",
  ],
  "politics": [
    "Naya scheme! Naam: 5 saal. Implementation: 50 saal. Paperwork: abhi 😂📋",
    "Election se pehle: freebie mela 🎉 | After: 'Budget nahi hai bhai' 😂",
    "Political news + Indian Twitter = instant popcorn moment 🍿🔥",
    "Press conference mein aaj bhi koi seedha jawab nahi mila 😂🎤",
    "Breaking political news drop hua. WhatsApp groups: 🔥🔥🔥",
    "Announcement hua. Twitter reacts in 4 seconds. Implementation: TBD. 😂",
  ],
  "bollywood": [
    "Budget ₹200 Cr. Logic ₹0. Memes: priceless 😂🎬",
    "Box office dekh ke Netflix bola: 'Humara kya hoga Kaalicharan? 😭'",
    "3rd time same film dekh raha hoon — plot abhi bhi nahi samjha 😂🎬",
    "Bollywood controversy = aunties ka WhatsApp group instantly LIVE 📲🔥",
    "New release aa gayi. Sunday plans: cancelled. Popcorn: ready 🍿😂",
    "Only in India: film flop hogi toh bhi 4 sequels guarantee hain 😂🎬",
  ],
  "traffic": [
    "{city} traffic at 8 AM vs my will to live: both at zero 🚗💀",
    "Gadhhe itne bade hain: Google Maps ne unhe 'scenic route' tag kiya 🕳️😂",
    "{city} + monsoon + pothole = free chiropractor session 🏍️💀",
    "Auto: 'Bhaiya jam hai.' Also auto: *cuts 4 lanes at once* 🛺😂",
    "GPS: '5 minutes away.' {city} reality: '45 mins, best of luck' 🚗😭",
    "Roads ki halat dekh ke cycle wala khud ko king samajhne laga hai 🚲👑",
  ],
  "weather": [
    "{city} monsoon: umbrella uthao toh dhoop, rakho toh baarish ☔😂",
    "City flooded. Govt: 'Team on the way.' Team: *also underwater* 💀🌊",
    "Garmi itni: AC wala dukaan ka malik ab neighbourhood ka hero hai ❄️👑",
    "Forecast: 30% rain. Reality: 300%. Met dept: 'Approximately correct!' 🌧️😂",
    "Monsoon aaya toh roads = rivers. Swimming pool fee saved 🏊😂",
    "Weather app ne 'sunny' bola tha. Outside: Noah's ark situation 🌊😂",
  ],
  "economy": [
    "Petrol mehnga — cycle wale ab road pe full VIP feel kar rahe hain 🚲👑",
    "Inflation bada phir: ek samosa ke liye bhi UPI nikalna pad raha hai 😭💸",
    "Rupee vs Dollar: dollar winning, par chai ₹10 ki hai — India wins at heart ☕🇮🇳",
    "Budget sun ke har student, kisan, auto driver ek saath bola: 'Hain?' 😂",
    "Price hike again. Maggi bhi ab 'fine dining' category mein aa gayi 🍜👑",
    "Market crash hua. Mera portfolio already zero tha. No tension 😂📉",
  ],
  "tech": [
    "AI le lega naukri — par hostel WiFi pehle mujhe le legi 😂🤖",
    "5G launch hua India mein! Hostel mein abhi bhi 'E' signal. Classic. 📶😂",
    "Startup raised ₹100Cr to 'disrupt chai' ☕ | Chai wala: *unbothered* 👑",
    "UPI failed during bill split. 5 log cafe mein 1 ghante baithe. True story 😂💳",
    "Cyber fraud news again. Bhai, 'Amazon delivery agent' ka call aaya tha? 😂📞",
    "Tech company layoffs. Fresher: 'Abhi toh joined joined bhi nahi tha 💀'",
  ],
  "sports": [
    "India ne medal jeeta! 1.4 billion experts ek saath khush ho gaye 🥇🇮🇳",
    "Cricket budget vs other sports budget: ek infinitely bada hai. Guess karo. 😂",
    "Athlete ne record toda — trending #3. #1 & #2? Bollywood. As usual 🏅😂",
    "Kheloge toh nahi milega naukri — phir Olympics mein medal kaun laayega? 🤔😂",
    "Sports news aai. India: 'Hum toh cricket wale hain.' Other sports: 💔",
  ],
  "health": [
    "Health alert aaya — baad mein padhunga, pehle ye reel dekh leta hoon 😂📱",
    "Doctor: 'Stress mat lo.' Also life: *sends this news* 😭",
    "Government health scheme launch hua! Hospital beds: still unavailable 😂🏥",
    "Bhai seedha bolo: chai peena band karna hai toh nahi karunga main 😂☕",
    "Health news padh ke self-diagnosis start ho gayi — WebMD se dur raho 😂",
  ],
  "general": [
    "Breaking news! Indian Twitter already fighting in comments. Chai pi lo ☕🍿",
    "Ye sun ke mera dil bola: 'Ek aur reason to not be productive today 💀'",
    "Subah subah yeh news — neend gayi, chain gayi, bas memes bache hain 😂",
    "Har baar naya drama — {city} waale toh immune ho gaye hain bhai 😂🌶️",
    "News aai. Aunties ka WhatsApp group: already 47 forwards 📲😂",
    "{source} ne chhapa aur poora India ek saath 'arey yaar' bola 🤦😂",
    "Breaking: something happened. Indians: *immediately start arguing* 😂🍿",
    "Yeh news ka koi solution nahi — bas chai pi aur aage badh 🫖😌",
  ],
};

const ACCENTS = [
  {"bg": "#FFF3E0", "border": "#FF9800", "tag_bg": "#FF9800", "emoji": "🔥"},
  {"bg": "#E8F5E9", "border": "#4CAF50", "tag_bg": "#4CAF50", "emoji": "😂"},
  {"bg": "#E3F2FD", "border": "#2196F3", "tag_bg": "#2196F3", "emoji": "💀"},
  {"bg": "#FCE4EC", "border": "#E91E63", "tag_bg": "#E91E63", "emoji": "🤯"},
  {"bg": "#EDE7F6", "border": "#673AB7", "tag_bg": "#673AB7", "emoji": "😭"},
];

const CATEGORY_ICONS: Record<string, string> = {
  cricket: '🏏', education: '📚', politics: '🏛️',
  bollywood: '🎬', traffic: '🚗', weather: '🌧️',
  economy: '💸', tech: '💻', sports: '🏅',
  health: '🏥', general: '📰'
};

const FALLBACK_HEADLINES = [
  {
    title: "Internet speed slower than normal during peak hours",
    link: "https://example.com",
    description: "Many users are reporting slow internet speeds right now as usage peaks during evening hours.",
    pubDate: "19 Apr, 9:30 AM",
    source: "Fallback News",
    category: "tech"
  },
  {
    title: "New traffic rules implementation delayed again",
    link: "https://example.com",
    description: "The city's new strict traffic guidelines have been placed on hold untill further notice.",
    pubDate: "19 Apr, 8:45 AM",
    source: "Traffic Today",
    category: "traffic"
  },
  {
    title: "Weekend weather: Expect heavy rains in multiple spots",
    link: "https://example.com",
    description: "Meteorological department warns citizens to carry their umbrellas as heavy rain continues.",
    pubDate: "19 Apr, 8:00 AM",
    source: "Weather Daily",
    category: "weather"
  },
  {
    title: "Markets down slightly due to global concerns",
    link: "https://example.com",
    description: "Investors reacted to early morning global cues, pulling the local stock market slightly lower today.",
    pubDate: "19 Apr, 7:15 AM",
    source: "Economy India",
    category: "economy"
  },
  {
    title: "Cricket squad announced for upcoming T20 series",
    link: "https://example.com",
    description: "The highly anticipated T20 series squad has been finalized following the selection committee meeting.",
    pubDate: "19 Apr, 6:30 AM",
    source: "Sports Buzz",
    category: "cricket"
  }
];

function detectCategory(title: string): string {
  const lowerTitle = title.toLowerCase();
  const categoryKeywords: Record<string, string[]> = {
    "cricket": ["cricket", "ipl", "bcci", "t20", "odi", "virat", "rohit", "india vs", "world cup", "test match"],
    "education": ["cbse", "jee", "neet", "exam", "syllabus", "board", "college", "university", "ugc", "scholarship"],
    "politics": ["modi", "bjp", "congress", "election", "parliament", "minister", "yogi", "government", "lok sabha", "policy"],
    "bollywood": ["bollywood", "box office", "film", "movie", "actor", "actress", "ott", "netflix", "cinema", "release"],
    "traffic": ["traffic", "road", "pothole", "highway", "accident", "metro", "transport", "commute", "flyover"],
    "weather": ["rain", "monsoon", "flood", "cyclone", "heatwave", "drought", "weather", "temperature", "storm"],
    "economy": ["inflation", "petrol", "price", "rupee", "gdp", "budget", "rbi", "tax", "startup", "market", "sensex"],
    "tech": ["ai", "5g", "internet", "upi", "app", "cyber", "digital", "smartphone", "elon", "google", "apple"],
    "sports": ["football", "hockey", "olympics", "athlete", "medal", "tennis", "badminton", "fifa", "cwg"],
    "health": ["covid", "vaccine", "hospital", "disease", "health", "medicine", "virus", "outbreak", "who"]
  };

  for (const [cat, keywords] of Object.entries(categoryKeywords)) {
    if (keywords.some(kw => lowerTitle.includes(kw))) {
      return cat;
    }
  }
  return "general";
}

function sharesConsecutiveWords(title1: string, title2: string, count = 5): boolean {
  const w1 = title1.toLowerCase().replace(/[^a-z0-9 ]/g, '').split(/\s+/).filter(Boolean);
  const w2 = title2.toLowerCase().replace(/[^a-z0-9 ]/g, '').split(/\s+/).filter(Boolean);
  
  if (w1.length < count || w2.length < count) return false;

  for (let i = 0; i <= w1.length - count; i++) {
    const chunk = w1.slice(i, i + count).join(' ');
    if (w2.join(' ').includes(chunk)) {
      return true;
    }
  }
  return false;
}

function generateMemeCaption(article: any): string {
  const category = article.category || "general";
  const templates = MEME_TEMPLATES[category] || MEME_TEMPLATES["general"];
  const randomTemplate = templates[Math.floor(Math.random() * templates.length)];
  return randomTemplate
    .replace(/{city}/g, "Prayagraj")
    .replace(/{source}/g, article.source);
}

function formatDateFromStr(dateStr: string): string {
  if (!dateStr) return 'Just now';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "Recently";
    const day = d.getDate();
    const mo = d.toLocaleString('en-US', { month: 'short' });
    const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    return `${day} ${mo}, ${time}`;
  } catch (e) {
    return dateStr;
  }
}

let cachedNewsCache: any[] = [];
let lastNewsFetchTime: number = 0;
const CACHE_TTL = 15 * 60 * 1000; // 15 mins

async function fetchNews() {
  if (cachedNewsCache.length > 0 && (Date.now() - lastNewsFetchTime < CACHE_TTL)) {
    return cachedNewsCache;
  }
  const articles: any[] = [];
  
  for (const feed of RSS_FEEDS) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      
      const xmlDataFetch = await fetch(feed.url, {
        headers: { "User-Agent": "Mozilla/5.0" },
        signal: controller.signal
      });
      clearTimeout(timeout);

      const xmlText = await xmlDataFetch.text();
      const parsed = await parser.parseString(xmlText);

      // Fetch a maximum of 15 articles per feed to ensure a healthy backlog for infinite scrolling
      let count = 0;
      for (const item of parsed.items || []) {
        if (count >= 15) break;

        let title = (item.title || "").trim();
        if (!title) continue;
        
        const lowerTitle = title.toLowerCase();
        if (lowerTitle.includes("sponsored") || lowerTitle.includes("advertisement")) {
          continue;
        }

        const isDuplicate = articles.some(existing => sharesConsecutiveWords(existing.title, title));
        if (isDuplicate) continue;

        let description = (item.description || item.contentSnippet || "").trim();
        description = description.replace(/<[^>]+>/g, '').trim();
        if (description.length > 120) {
          description = description.substring(0, 120) + "...";
        }

        const pubDate = formatDateFromStr(item.pubDate as string);
        const category = detectCategory(title);

        articles.push({
          title,
          url: item.link || "#",
          description,
          pubDate,
          source: feed.source,
          category
        });
        count++;
      }
    } catch (e) {
      console.error(`Failed fetching feed from ${feed.source}`, e);
      continue;
    }
  }

  if (articles.length === 0) {
    return FALLBACK_HEADLINES;
  }

  // Shuffle array slightly so feeds mix
  articles.sort(() => Math.random() - 0.5);

  cachedNewsCache = articles;
  lastNewsFetchTime = Date.now();
  return articles;
}

async function generateMemesForArticles(articles: any[]) {
  const geminiApiKey = process.env.GEMINI_API_KEY;
  let captions: string[] = [];

  if (geminiApiKey && articles.length > 0) {
    try {
      const ai = new GoogleGenAI({ apiKey: geminiApiKey });

      const prompt = `You are a hilarious Indian meme generator. Generate a short, funny, sarcastic Hinglish (Hindi + English) meme caption for each of these news headlines. Return ONLY a valid JSON array of strings containing the captions in the exact same order. Do not include markdown formatting (\`\`\`json).\n\nHeadlines:\n${articles.map((a, i) => `${i+1}. ${a.title}`).join('\n')}`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          temperature: 0.8,
        }
      });

      const responseText = response.text || '[]';
      const jsonStr = responseText.replace(/^```(json)?\n?/, '').replace(/```$/, '').trim();
      captions = JSON.parse(jsonStr);
    } catch (err) {
      console.error("Gemini generation failed, falling back to templates", err);
    }
  }

  return articles.map((article, i) => {
    return {
      article,
      caption: captions[i] || generateMemeCaption(article),
      accent: ACCENTS[Math.floor(Math.random() * ACCENTS.length)], 
      categoryIcon: CATEGORY_ICONS[article.category] || CATEGORY_ICONS['general']
    };
  });
}

app.get('/api/memes', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = 6;
    const allArticles = await fetchNews();
    const startIndex = (page - 1) * limit;
    const pageArticles = allArticles.slice(startIndex, startIndex + limit);

    if (pageArticles.length === 0) {
      return res.json({ memes: [] });
    }

    const meme_cards = await generateMemesForArticles(pageArticles);
    res.json({ memes: meme_cards });
  } catch (err) {
    console.error('API /memes error', err);
    res.status(500).json({ error: "Failed to fetch memes" });
  }
});

app.get('/', async (req, res) => {
  try {
    const allArticles = await fetchNews();
    const pageArticles = allArticles.slice(0, 8); // Setup initial load batch
    const meme_cards = await generateMemesForArticles(pageArticles);

    const sources_used = Array.from(new Set(allArticles.map(a => a.source)));
    const now = new Date();
    const last_updated = `${now.getDate()} ${now.toLocaleString('en-US', {month: 'short'})} ${now.getFullYear()}, ${now.toLocaleTimeString('en-US', {hour: 'numeric', minute: '2-digit', hour12: true})}`;

    res.render('index', {
      meme_cards,
      sources_used,
      total: meme_cards.length,
      last_updated,
      city: "Prayagraj"
    });
  } catch (err) {
    res.status(500).send("Yaar, kuch toh gadbad hai 😭 Try refreshing. Chai bana lo tab tak.");
  }
});

app.get('/refresh', (req, res) => {
  res.redirect('/');
});

app.post('/share', async (req, res) => {
  try {
    const { email, meme } = req.body;
    if (!email || !meme) {
      return res.status(400).json({ error: 'Missing email or meme data' });
    }
    
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'RESEND_API_KEY is not configured in Secrets. Please add it to unlock email sharing.' });
    }
    
    const resend = new Resend(apiKey);
    
    const htmlEmail = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; background: #fdfdfd; border: 1px solid #ddd; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
        <div style="background: #FF6B35; padding: 24px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">📰 MemePaper Shared With You!</h1>
        </div>
        <div style="padding: 24px;">
          <h2 style="font-size: 22px; margin-top: 0; color: #1a1a2e;">${meme.caption}</h2>
          <hr style="border: 0; border-top: 2px dashed #ccc; margin: 20px 0;">
          <p style="text-transform: uppercase; font-size: 11px; font-weight: bold; color: #888; letter-spacing: 1.5px;">📰 ACTUAL NEWS (${meme.source}) - ${meme.pubDate}</p>
          <h3 style="margin: 8px 0; font-size: 16px; color: #444; font-style: italic;">${meme.headline}</h3>
          <p style="color: #555; line-height: 1.5; font-size: 14px;">${meme.description}</p>
          <div style="text-align: right; margin-top: 24px;">
            <a href="${meme.url}" style="display: inline-block; background: #1a1a2e; color: white; padding: 12px 24px; text-decoration: none; border-radius: 20px; font-weight: bold; font-size: 14px;">Read Full Story &rarr;</a>
          </div>
        </div>
        <div style="background: #1a1a2e; padding: 16px; text-align: center;">
          <p style="color: #6c757d; font-size: 12px; margin: 0;">Made with ☕ + 😂 in Prayagraj, India</p>
        </div>
      </div>
    `;
    
    const { data, error } = await resend.emails.send({
      from: 'MemePaper <onboarding@resend.dev>', // Resend trial domain
      to: [email],
      subject: '😂 ' + meme.caption.substring(0, 40) + '...',
      html: htmlEmail
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.status(200).json({ success: true, data });
  } catch (e: any) {
    console.error('Email error:', e);
    res.status(500).json({ error: e.message || 'Failed to send email' });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server started on http://0.0.0.0:${PORT}`);
});
