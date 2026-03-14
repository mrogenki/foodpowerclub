import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import Database from "better-sqlite3";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("database.sqlite");

// Initialize database schema
db.exec(`
  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    long_description TEXT,
    content TEXT,
    start_date TEXT,
    end_date TEXT,
    type TEXT DEFAULT 'current',
    image_url TEXT,
    video_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS brands (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER,
    name TEXT NOT NULL,
    description TEXT,
    logo_url TEXT,
    promotion_info TEXT,
    category TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(event_id) REFERENCES events(id)
  );

  CREATE TABLE IF NOT EXISTS partners (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER,
    name TEXT NOT NULL,
    type TEXT,
    content TEXT,
    logo_url TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(event_id) REFERENCES events(id)
  );

  CREATE TABLE IF NOT EXISTS kol_reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER,
    kol_name TEXT,
    kol_avatar_url TEXT,
    title TEXT,
    content TEXT,
    media_type TEXT,
    media_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(event_id) REFERENCES events(id)
  );

  CREATE TABLE IF NOT EXISTS promotions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    brand_id INTEGER,
    title TEXT,
    description TEXT,
    discount_code TEXT,
    start_date TEXT,
    end_date TEXT,
    image_url TEXT,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(brand_id) REFERENCES brands(id)
  );
`);

// Seed initial data if empty
const eventCount = db.prepare("SELECT COUNT(*) as count FROM events").get() as { count: number };
if (eventCount.count === 0) {
  const insertEvent = db.prepare(`
    INSERT INTO events (title, description, long_description, content, start_date, end_date, type, image_url, video_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertEvent.run(
    "2026 春季美食祭",
    "探索城市中最具力量的美食，連結品牌與味蕾的盛宴。",
    "這是一場集結了全台最頂尖餐飲品牌的盛會，我們不僅提供美食，更提供一種生活態度。",
    "# 歡迎來到 2026 春季美食祭\n\n這是一個充滿驚喜的春天！我們邀請了超過 50 家知名品牌參與。\n\n## 活動亮點\n- **現場烹飪秀**：看主廚如何化腐朽為神奇。\n- **限量聯名商品**：只有在這裡才買得到。\n- **音樂表演**：美食配音樂，享受雙重饗宴。\n\n![美食祭](https://images.unsplash.com/photo-1555939594-58d7cb561ad1?q=80&w=1974&auto=format&fit=crop)\n\n> \"美食是連結人與人之間最好的橋樑。\"\n\n我們期待在現場見到你！",
    "2026-03-01",
    "2026-03-31",
    "current",
    "https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?q=80&w=2070&auto=format&fit=crop",
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
  );
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // API Routes
  app.get("/api/events", (req, res) => {
    const events = db.prepare("SELECT * FROM events ORDER BY start_date DESC").all();
    res.json(events);
  });

  app.get("/api/events/:id", (req, res) => {
    const event = db.prepare("SELECT * FROM events WHERE id = ?").get(req.params.id);
    if (!event) return res.status(404).json({ error: "Event not found" });
    res.json(event);
  });

  app.post("/api/events", (req, res) => {
    const { title, description, long_description, content, start_date, end_date, type, image_url, video_url } = req.body;
    const result = db.prepare(`
      INSERT INTO events (title, description, long_description, content, start_date, end_date, type, image_url, video_url)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(title, description, long_description, content, start_date, end_date, type, image_url, video_url);
    res.json({ id: result.lastInsertRowid });
  });

  app.put("/api/events/:id", (req, res) => {
    const { title, description, long_description, content, start_date, end_date, type, image_url, video_url } = req.body;
    db.prepare(`
      UPDATE events SET 
        title = ?, description = ?, long_description = ?, content = ?, 
        start_date = ?, end_date = ?, type = ?, image_url = ?, video_url = ?
      WHERE id = ?
    `).run(title, description, long_description, content, start_date, end_date, type, image_url, video_url, req.params.id);
    res.json({ success: true });
  });

  app.delete("/api/events/:id", (req, res) => {
    db.prepare("DELETE FROM events WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  // Other API routes (brands, partners, etc.)
  app.get("/api/brands", (req, res) => {
    const eventId = req.query.event_id;
    let brands;
    if (eventId) {
      brands = db.prepare("SELECT * FROM brands WHERE event_id = ?").all(eventId);
    } else {
      brands = db.prepare("SELECT * FROM brands").all();
    }
    res.json(brands);
  });

  app.get("/api/partners", (req, res) => {
    const eventId = req.query.event_id;
    let partners;
    if (eventId) {
      partners = db.prepare("SELECT * FROM partners WHERE event_id = ? ORDER BY sort_order ASC").all(eventId);
    } else {
      partners = db.prepare("SELECT * FROM partners ORDER BY sort_order ASC").all();
    }
    res.json(partners);
  });

  app.get("/api/kol_reviews", (req, res) => {
    const reviews = db.prepare("SELECT * FROM kol_reviews ORDER BY created_at DESC").all();
    res.json(reviews);
  });

  app.get("/api/promotions", (req, res) => {
    const promotions = db.prepare(`
      SELECT p.*, b.name as brand_name, b.logo_url as brand_logo
      FROM promotions p
      JOIN brands b ON p.brand_id = b.id
      WHERE p.is_active = 1
      ORDER BY p.created_at DESC
    `).all();
    res.json(promotions.map((p: any) => ({
      ...p,
      brand: { name: p.brand_name, logo_url: p.brand_logo }
    })));
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
