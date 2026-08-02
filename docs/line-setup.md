# LINE 整合設定教學（會員綁定 + 推播）

> 會員系統第二期：讓會員綁定官方 LINE、並可從後台對會員推播優惠／抽獎通知。
> 與現有 **Mobile Cards** 機器人**並存，不動它的 webhook**。

## 架構總覽

```
provider：食在力量美食季（LINE Developers）
  ├── LINE Login channel「食在俱樂部 會員登入」  ← 綁定會員用
  │     Channel ID: 2010936799
  └── Messaging API channel「食在俱樂部」          ← 推播用（webhook 給 Mobile Cards）
        Channel ID: 2009483789 / OA @470inyra
```

- **同一 provider + Login 連動 OA** → LINE Login 拿到的 `userId` 與 Messaging 的一致，才能推播。
- 綁定 / 推播都**不需要 webhook**，Mobile Cards 的 webhook 維持不變。

## 相關資源

| 項目 | 值 |
|---|---|
| Supabase 專案（東京） | `ultsxvsujfjzxpxgzqwh` |
| Edge Function（綁定） | `line-bind` |
| Edge Function（推播） | `line-push` |
| 會員資料表欄位 | `members.line_user_id` |

## 一、需要設定的 Supabase Secrets（務必在「東京」專案）

[東京專案 → Edge Functions → Secrets](https://supabase.com/dashboard/project/ultsxvsujfjzxpxgzqwh/settings/functions)（確認網址 ref 是 `ultsxvsujfjzxpxgzqwh`，不是舊的新加坡 `spueuuoihhrejuehgfsl`）：

| Name | 來源 |
|---|---|
| `LINE_LOGIN_CHANNEL_ID` | LINE Login channel → Basic settings → Channel ID（`2010936799`） |
| `LINE_LOGIN_CHANNEL_SECRET` | LINE Login channel → Basic settings → Channel secret |
| `LINE_MESSAGING_ACCESS_TOKEN` | Messaging API channel → Messaging API 分頁 → **Channel access token (long-lived)** → Issue |

> `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` 平台自動注入，不用設。
> 更新 secret 後，若 function 仍讀不到，重新部署一次即可（強制冷啟動）。

## 二、LINE Login channel 設定（綁定用）

在 [LINE Developers](https://developers.line.biz/console/) → provider「食在力量美食季」→ Login channel：

1. **LINE Login 分頁 → Callback URL**（三條都加）：
   ```
   https://www.foodpowerclub.com/member/line-callback
   https://foodpowerclub.com/member/line-callback
   http://localhost:3002/member/line-callback
   ```
2. **Basic settings → Linked LINE Official Account**：連動「食在俱樂部（@470inyra）」→ 綁定時才會引導加好友、userId 才一致。
3. **正式對外前，把 channel 從「Developing」改為「Published」**（否則只有 Admin/Tester 能綁定）。
4. （選用）「Require two-factor authentication」建議關閉，消費者登入較順。

## 三、前端行為

- 會員（已用 Google/Email 登入）→ 會員中心 → 「綁定 LINE」
- 導向 LINE 授權（`bot_prompt=aggressive` 會引導加官方帳號好友）
- 回呼 `/member/line-callback` → 呼叫 `line-bind` → 存 `line_user_id`
- 綁定狀態顯示在會員中心；後台會員管理有「LINE 已綁定」欄

## 四、推播（後台）

- `/admin` → 會員管理 → 「發送 LINE 行銷通知」面板
- 對象：**已綁定 LINE 且 `marketing_consent = true`** 的會員，可再依身分別（一般／創作者／企業）分眾
- 走 Messaging API `multicast`，每批 500 人自動分批
- **會消耗 OA 推播額度**（輕用量免費方案每月則數有限，大量群發前評估升級）

## 疑難排解（實際踩過的坑）

| 症狀 | 原因 / 解法 |
|---|---|
| `client_id is required` | `LINE_LOGIN_CHANNEL_ID` 沒設，或**設在錯的專案**（要設在東京 `ultsxvsujfjzxpxgzqwh`） |
| `invalid_client` | `LINE_LOGIN_CHANNEL_SECRET` 錯誤 |
| 綁定跳 401 / 未登入 | 登入 session 過期（1 小時）→ 先登出再重新登入 |
| 只有自己能綁定 | Login channel 還在 Developing → 改為 Published |
| redirect 相關錯誤 | Callback URL 沒涵蓋當下網域（apex vs www）→ 三條都加 |
| 推播 401/403 | `LINE_MESSAGING_ACCESS_TOKEN` 未設或非管理員呼叫 |

## 相關檔案
- `supabase/functions/line-bind/index.ts`
- `supabase/functions/line-push/index.ts`
- `src/App.tsx`：`MemberCenter`（綁定）、`LineCallback`（回呼）、會員管理推播面板
