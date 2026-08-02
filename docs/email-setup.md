# Email 行銷群發設定教學（Resend）

> 會員系統：從後台對「有 Email 且同意行銷」的會員群發行銷信。
> 寄信服務用 **Resend**，寄件網域 `foodpowerclub.com`。

## 架構總覽

```
後台（/admin → 會員管理 → 發送 Email 行銷信）
  → Edge Function email-send（僅管理員）
    → 撈 members（有 email + marketing_consent，可再依身分別）
    → Resend batch API（每批 100 封）寄出
```

- 只寄給 **`marketing_consent = true`** 的會員（合規）。
- 信末自動附「到會員中心關閉行銷資訊」的退訂連結，並帶 `List-Unsubscribe` 標頭（deliverability）。

## 相關資源

| 項目 | 值 |
|---|---|
| Supabase 專案（東京） | `ultsxvsujfjzxpxgzqwh` |
| Edge Function | `email-send` |
| 寄信服務 | Resend（<https://resend.com>） |
| 寄件網域 | `foodpowerclub.com`（Resend 已 Verified） |

## 一、Supabase Secrets（務必在「東京」專案）

[東京專案 → Edge Functions → Secrets](https://supabase.com/dashboard/project/ultsxvsujfjzxpxgzqwh/settings/functions)：

| Name | 值 |
|---|---|
| `RESEND_API_KEY` | Resend → API keys 產生的金鑰 |
| `RESEND_FROM` | `食在俱樂部 <noreply@foodpowerclub.com>` |

> 未設 `RESEND_FROM` 時，程式預設也是 `食在俱樂部 <noreply@foodpowerclub.com>`。
> 更新 secret 後若 function 讀不到，重新部署一次即可。

## 二、Resend 網域驗證（一次性）

`foodpowerclub.com` 的 DNS 代管在 **GoDaddy**（NS = `domaincontrol.com`），且 root 已有 **Mailgun** 收發信設定。

- Resend 的記錄會放在 **`send.` 子網域**（MX/SPF）與 **`resend._domainkey`**（DKIM），
  **與現有 Mailgun root 設定不衝突、可並存**。**請勿更動** root 的 `v=spf1 include:mailgun.org` 與 root MX。
- 加網域步驟：Resend → Domains → Add Domain → `foodpowerclub.com` →
  用 **Auto configure**（登入 GoDaddy 自動加記錄）或 **Manual setup**（手動照抄）→ 等變 Verified。

## 三、後台使用

`/admin` → 會員管理 → **發送 Email 行銷信**：
- 對象：全部 / 一般會員 / 創作者 / 企業（都只含「有 Email 且同意行銷」者）
- 主旨 + 內容（純文字，換行保留；純網址在多數信箱會自動變連結）
- 顯示預估寄送人數 → 送出

## 疑難排解

| 症狀 | 原因 / 解法 |
|---|---|
| `伺服器尚未設定 Resend 金鑰` | `RESEND_API_KEY` 未設或設在錯的專案（要東京 `ultsxvsujfjzxpxgzqwh`） |
| Resend 回 403 / domain not verified | `RESEND_FROM` 的網域未在 Resend Verified；或用了未驗證網域 |
| 寄 0 封 | 沒有「有 Email 且同意行銷」的會員符合所選身分別 |
| 登入過期（401） | 先登出再重新登入（session 1 小時到期） |

## 注意事項

- Resend 依方案有寄送量 / 速率限制，大量群發前留意用量。
- 行銷信務必保留退訂機制（已內建於信末與 `List-Unsubscribe`）。

## 相關檔案
- `supabase/functions/email-send/index.ts`
- `src/App.tsx`：會員管理「發送 Email 行銷信」面板、`handleSendEmail`
