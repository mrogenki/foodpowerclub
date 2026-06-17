# foodpowerclub — CLAUDE.md

> 給 Claude Code 的專案說明。每次開啟此專案請先讀這份文件。

## 專案定位

**食在力量俱樂部**（foodpowerclub）是一般消費者導向的美食俱樂部網站。
- 線上網址：https://www.foodpowerclub.com
- GitHub：mrogenki/foodpowerclub（public）
- 部署平台：Vercel（push to main → 自動部署，約 1-2 分鐘）
- Vercel Project ID：prj_tmryBZfQj7V5YtiigDN9CO3Cc0ov
- Vercel Team：jacks-projects-42fe82a9

## 技術架構

- **Frontend**：React 19 + TypeScript + Vite（單一頁面應用）
- **路由**：React Router v6（BrowserRouter，vercel.json 有 rewrite 設定）
- **UI**：TailwindCSS v4 + Framer Motion（motion） + Lucide Icons
- **後端**：Supabase（PostgreSQL + Storage + Auth + Edge Functions）
- **地圖**：@vis.gl/react-google-maps v1.7（APIProvider 需要 libraries={["places","marker"]}）
- **編輯器**：BlockNote（富文字區塊編輯器，內容以 JSON 字串存 DB）
- **快取**：@tanstack/react-query v5（staleTime 5 分鐘）

## 重要：所有程式碼在單一檔案

**src/App.tsx** 包含所有頁面、元件、路由、型別、常數。
修改時永遠讀取完整檔案再寫回，不要只看局部。

其他檔案：
- `src/main.tsx`：entry point
- `src/lib/supabase.ts`：Supabase client
- `src/types/index.ts`：型別定義
- `src/constants/taiwanDistricts.ts`：台灣縣市行政區資料
- `vercel.json`：rewrite 設定（所有路徑指向 index.html）

## 環境變數（.env.local）

> ⚠️ **請勿將實際金鑰值寫入此檔案**。Key 只放 `.env.local`（已被 `.gitignore` 排除）與 Vercel 專案環境變數。

需要的變數名稱：

```
VITE_SUPABASE_URL                 # Supabase Project URL
VITE_SUPABASE_ANON_KEY            # Supabase anon key（前端公開使用，但仍依 RLS 控制存取）
VITE_GOOGLE_MAPS_API_KEY          # Google Maps API Key（必須在 GCP Console 設 HTTP referrer 限制）
VITE_GOOGLE_MAPS_MAP_ID           # Google Maps Map ID
```

- 本機開發：複製 `.env.example` 為 `.env.local` 後填入實際值
- 正式環境：在 Vercel 專案 Settings → Environment Variables 設定
- Google Maps Key **必須在 Google Cloud Console 設 HTTP referrer 白名單**（限定 `localhost`、`*.foodpowerclub.com`、`*.vercel.app`），避免被盜用

## 開發指令

```bash
npm install
npm run dev       # 本地開發，http://localhost:3002
npm run build     # 建置（Vercel 自動執行，通常不需手動）
npm run lint      # tsc --noEmit 型別檢查
```

## 前端路由

| 路徑 | 頁面 |
|---|---|
| / | Home（輪播活動、優惠、開箱、地圖、夥伴） |
| /events | EventsPage（活動列表） |
| /event/:id | EventDetail（活動詳情） |
| /brand/:id | BrandDetail（品牌詳情） |
| /partner/:id | PartnerDetail（贊助夥伴詳情） |
| /promotions | PromotionsPage（優惠資訊） |
| /reviews | KOLReviewsPage（開箱分享） |
| /map | MapPage（美食地圖） |
| /partners | PartnersPage（贊助夥伴列表） |
| /login | Login（管理員登入） |
| /admin | AdminDashboard（管理後台） |

## Supabase 資料庫

**Project ID**：spueuuoihhrejuehgfsl（region: ap-southeast-1，新加坡）

| 資料表 | 說明 |
|---|---|
| events | 活動（id, title, description, content, image_url, video_url, start_date, end_date, type） |
| brands | 品牌（id, event_id, name, category, description, promotion_info, logo_url, content） |
| partners | 贊助夥伴（id, event_id, name, type, sort_order, logo_url, content） |
| kol_reviews | 開箱分享（id, brand_id, title, kol_name, kol_avatar_url, media_type, media_url, video_embed_url, content） |
| promotions | 優惠（id, brand_id, title, description, discount_code, start_date, end_date, image_url, is_active） |
| locations | 美食地圖店家（id, name, category, city, district, address, lat, lng, phone, image_url, description, discount_info, rating, booking_url, order_url, business_hours, avg_price, **brand_id**） |
| location_events | 店家↔活動關聯（id, location_id, event_id）— 多對多 |

**關聯架構**：
```
活動（events）
  ├── brands.event_id → 品牌
  │     └── locations.brand_id → 分店（地圖上顯示品牌名）
  ├── partners.event_id → 贊助夥伴
  └── location_events → 參與活動的地圖店家（地圖上金色外框標示）
```

**Storage Bucket**：`images`（小寫，public）
- 圖片路徑：`locations/gplace_{timestamp}.jpg`
- 圖片最佳化：使用 `/storage/v1/render/image/public/` 路徑 + `?width=N&quality=80`
- Image Transformation 已開啟（Settings > Storage > Enable image transformation = ON）

## Supabase Edge Functions

| Function | 說明 |
|---|---|
| proxy-place-photo (v2) | 下載 Google Places 照片並存入 images bucket，回傳永久 Storage URL |

呼叫方式：
```js
fetch(`${SUPABASE_URL}/functions/v1/proxy-place-photo`, {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ photoUrl: '...', filename: 'gplace_xxx.jpg' })
})
```

## 後台管理功能（/admin）

| Tab | 功能 |
|---|---|
| 活動管理 | 新增/編輯/刪除活動；**📍 店家按鈕** → 管理活動參與店家（location_events） |
| 品牌管理 | 管理品牌；**📍 分店按鈕** → 管理品牌分店（locations.brand_id） |
| 地圖管理 | 新增/編輯店家；支援 Google Places Autocomplete 自動帶入；**批次匯入**（textSearch 模糊搜尋） |
| 開箱管理 | 支援圖片/影片（YouTube、TikTok、Reels 自動轉 embed URL） |
| 優惠管理 | 含折扣碼、有效期 |
| 贊助管理 | 含排序權重 |

### 批次匯入注意事項
- 使用 Google Maps `PlacesService.textSearch` 模糊搜尋
- **APIProvider 必須有 `libraries={["places","marker"]}`**，否則 PlacesService 會是 undefined
- 每行一個店名，加地區更精確（例：`屋馬燒肉 崇德店`）

## 常見開發模式

### 修改 UI 元件
1. 讀取 `src/App.tsx`
2. 找到對應元件（通常用 function name 或頁面 component name 搜尋）
3. 修改後存檔
4. `npm run lint` 確認沒有 TypeScript 錯誤
5. git commit & push → Vercel 自動部署

### 新增 DB 欄位
1. 在 Supabase Dashboard 執行 SQL migration
2. 更新 `src/types/index.ts` 的 TypeScript 型別
3. 更新 `src/App.tsx` 的相關 query 和 UI

### 新增 DB 資料表
```sql
CREATE TABLE table_name (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  -- 欄位...
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Read" ON table_name FOR SELECT USING (true);
CREATE POLICY "Authenticated Write" ON table_name FOR ALL TO authenticated USING (true) WITH CHECK (true);
```

## 已知問題 / 注意事項

- **MarkerClusterer**：@googlemaps/markerclusterer 與 @vis.gl/react-google-maps 有執行時衝突（TypeError: r4 is not a constructor），已移除，暫不使用
- **Supabase Image Transformation**：URL 格式為 `/storage/v1/render/image/public/{bucket}/{path}?width=N&quality=80`（注意 render/image 在 v1 之後）
- **BlockNote 內容**：以 JSON 字串格式存在 DB，顯示時需用 BlockNote viewer 渲染
- **影片支援**：YouTube、Shorts、TikTok、Instagram Reels，有自動轉 embed URL 的 helper function

## Git Commit 規範

```
feat: 新功能
fix: 修正 bug
perf: 效能優化
chore: 環境、套件調整
refactor: 重構（不影響功能）
```
