# foodpowerclub 資料庫遷移紀錄：新加坡（ap-southeast-1）→ 東京（ap-northeast-1）

> 狀態：**✅ 切換完成（2026-07-12）**。正式環境已全面運行於東京 `ultsxvsujfjzxpxgzqwh`。
> 舊新加坡專案 `spueuuoihhrejuehgfsl` 保留至 2026-07-26（觀察期），屆時 pause、一個月後刪除。

## 結果
- DB 14MB／21 張表（含 auth 1 帳號）逐表筆數全一致
- Storage `images` 407 檔／127MB 全同步（0 失敗）
- 3 個 edge functions 部署（verify_jwt 對齊線上）；無自訂 secrets
- DB 內 336 筆舊 storage 絕對網址已改寫歸零
- 官網 foodpowerclub.com 實測：僅連東京、13 圖 0 破、0 console 錯誤
- 切換窗口內舊庫零新增（無資料遺失）

## 架構備忘
- 前端純 Vercel env（`VITE_SUPABASE_URL`／`VITE_SUPABASE_ANON_KEY`），無寫死連線
- 搬遷腳本：`scripts/migrate/01~03`（複用 foodpowerteam 模板，參數已對齊本專案）
- ⚠️ `fix-location-photos` 內有寫死的 Google API key，建議改 secrets ＋ 用量上限

## 待辦
- [ ] 2026-07-26 pause 舊專案（連同 foodpowerteam 舊孟買專案一起）
- [ ] 刪除專案根目錄 `.env.migration`
