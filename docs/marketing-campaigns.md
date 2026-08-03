# 行銷發送與排程（LINE / Email）

> 後台「會員管理」的行銷發送工具：LINE 推播（文字／圖文卡片）、Email 群發、發送紀錄、排程寄送。

## 功能總覽

| 功能 | 說明 |
|---|---|
| LINE 推播 | 純文字 or 圖文卡片（Buttons Template：圖片＋標題＋按鈕連結） |
| Email 群發 | 主旨＋內容＋頂部圖片；信末自動附退訂連結 |
| 分眾 | 全部 / 一般會員 / 創作者 / 企業，且只發「同意行銷」者 |
| 發送紀錄 | 每次群發寫入 `message_campaigns`，後台可查（最近 30 筆） |
| 排程 | 指定時間寄送，由 pg_cron 到期自動執行；可取消 |

## 相關資源

| 項目 | 值 |
|---|---|
| Supabase 專案（東京） | `ultsxvsujfjzxpxgzqwh` |
| 資料表 | `message_campaigns`（含 `status` / `scheduled_at`） |
| Edge Functions | `line-push`、`email-send`、`campaign-run`（排程執行器） |
| 排程 | `pg_cron` 每分鐘 → `pg_net` 呼叫 `campaign-run` |

## Edge Function Secrets（東京專案）

[Edge Functions → Secrets](https://supabase.com/dashboard/project/ultsxvsujfjzxpxgzqwh/settings/functions)：

| Name | 用途 |
|---|---|
| `LINE_MESSAGING_ACCESS_TOKEN` | LINE 推播 |
| `RESEND_API_KEY` / `RESEND_FROM` | Email 群發 |
| `CRON_SECRET` | 排程執行器驗證（值同時存於 DB Vault 的 `cron_secret`） |

> ⚠️ 未設 `CRON_SECRET` → `campaign-run` 一律回 401，排程不會執行。

## 排程運作原理

1. 後台選「排程」→ 前端把整包送信參數寫入 `message_campaigns`（`status='scheduled'`, `scheduled_at`）。
2. `pg_cron` 每分鐘執行一次排程工作 `campaign-run-every-minute`，透過 `pg_net.http_post` 呼叫
   `.../functions/v1/campaign-run`，帶 `x-cron-secret`（讀自 Vault）。
3. `campaign-run` 驗證密鑰 → 撈 `scheduled_at <= now()` 的排程 →
   **原子認領**（`scheduled`→`sending`，防重複）→ 依 channel 寄出 → 更新 `sent`／`failed` 與 `sent_at`。
4. 收件對象在**寄出當下**才重算（排程期間新加入的會員也會收到）。

## 疑難排解

**看 cron 是否有在跑 / 回應**
```sql
-- 最近的 cron 執行紀錄
select jobid, status, return_message, start_time, end_time
from cron.job_run_details order by start_time desc limit 10;

-- 排程工作定義
select jobid, schedule, command, active from cron.job;

-- pg_net 呼叫 campaign-run 的回應（401 = CRON_SECRET 未設或不符）
select id, status_code, content from net._http_response order by id desc limit 5;
```

**看排程/發送狀態**
```sql
select id, channel, status, member_type, title, scheduled_at, sent_at, sent_count, failed_count
from message_campaigns order by created_at desc limit 20;
```

| 症狀 | 原因 / 解法 |
|---|---|
| 排程到時間沒寄出 | `CRON_SECRET` 未設（`net._http_response` 會是 401）；設好即可 |
| 卡在 `sending` | 寄送中途失敗；查 `campaign-run` 日誌，必要時手動改回 `scheduled` 或 `failed` |
| 全部失敗 | 對應管道的金鑰（LINE token / Resend key）未設或失效 |

## 維運備忘

- 更換 cron 密鑰：`select vault.update_secret((select id from vault.secrets where name='cron_secret'), '<新值>');` 並同步更新 Edge secret `CRON_SECRET`。
- 停用排程：`select cron.unschedule('campaign-run-every-minute');`
- 重新排程（若函式 URL 變動）：先 `cron.unschedule` 再重新 `cron.schedule`。

## 相關檔案
- `supabase/functions/line-push/index.ts`、`email-send/index.ts`、`campaign-run/index.ts`
- `src/App.tsx`：會員管理的 LINE／Email 面板、發送紀錄、排程控制、`scheduleCampaign` / `cancelCampaign`
