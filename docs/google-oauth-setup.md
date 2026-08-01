# Google OAuth 登入設定教學（會員系統）

> 目的：讓 `/member/login` 的「使用 Google 登入」可以運作。
> 做法：在 Google Cloud 申請 OAuth 憑證 → 填進 Supabase → 設定網址白名單。

## 專案專用值（可直接複製）

| 項目 | 值 |
|---|---|
| Supabase 專案 ref | `ultsxvsujfjzxpxgzqwh`（東京） |
| Supabase OAuth callback（Google redirect URI 用這條） | `https://ultsxvsujfjzxpxgzqwh.supabase.co/auth/v1/callback` |
| 正式網域 | `https://www.foodpowerclub.com` |
| 本機開發 | `http://localhost:3002` |

> 建議用**公司／專案專用的 Google 帳號**操作（同意畫面會顯示開發者聯絡信箱）。

---

## A. 建立 Google Cloud 專案
1. 進 <https://console.cloud.google.com/>
2. 左上專案下拉 →「新增專案」→ 名稱 `foodpowerclub` → 建立
3. 確認右上角已切到此專案

## B. 設定 OAuth 同意畫面
1. **APIs & Services → OAuth consent screen**（新版可能在 **Google Auth Platform → Branding / Audience**）
2. User Type 選 **External（外部）** → 建立
3. 填寫：
   - App name：`食在俱樂部`
   - User support email：聯絡信箱
   - App logo（選填）
   - **Authorized domains（授權網域）**：
     ```
     foodpowerclub.com
     supabase.co
     ```
   - Developer contact information：信箱
4. Scopes：**不用加敏感權限**，預設 `email`、`profile`、`openid` 即可
5. 儲存

## C. 建立 OAuth 用戶端 ID
1. **APIs & Services → Credentials（憑證）**
2. 「+ 建立憑證」→「OAuth 用戶端 ID」
3. Application type：**Web application（網頁應用程式）**
4. Name：`foodpowerclub-web`

## D. 填入 Redirect URI（⚠️ 最關鍵）
在「Authorized redirect URIs（已授權的重新導向 URI）」新增：

```
https://ultsxvsujfjzxpxgzqwh.supabase.co/auth/v1/callback
```

> 「Authorized JavaScript origins」此流程可不填。真正必要的只有上面這條 redirect URI。
> 結尾必須是 `/auth/v1/callback`，不能有多餘斜線。

按 **建立**。

## E. 取得金鑰並填進 Supabase
1. 複製跳出的 **Client ID** 與 **Client Secret**
2. 進 Supabase → Authentication → Providers → Google
   <https://supabase.com/dashboard/project/ultsxvsujfjzxpxgzqwh/auth/providers>
3. 開啟 **Enable Sign in with Google**
4. 貼上 **Client ID** / **Client Secret** → **Save**
   - 此頁上方顯示的 callback URL 應與 D 步驟一致

## F. 設定 Supabase 網址白名單
Authentication → URL Configuration
<https://supabase.com/dashboard/project/ultsxvsujfjzxpxgzqwh/auth/url-configuration>

- **Site URL**：
  ```
  https://www.foodpowerclub.com
  ```
- **Redirect URLs**：
  ```
  https://www.foodpowerclub.com/member
  http://localhost:3002/member
  https://*.vercel.app/member
  ```

## G. 發布 App（讓一般人都能登入）
剛建好時 App 為 **Testing（測試）**，只有測試帳號能登入。
- OAuth consent screen / Audience → **PUBLISH APP（發布應用程式）** → 確認
- 只用 `email`／`profile` 等**非敏感權限，不需送 Google 審核**，發布後任何 Google 帳號皆可登入。

---

## 測試
部署後開 `https://www.foodpowerclub.com/member/login` → 「使用 Google 登入」→ Google 授權 → 回到 `/member` 會員中心。

## 常見錯誤
| 錯誤 | 原因／解法 |
|---|---|
| `redirect_uri_mismatch` | D 步驟 redirect URI 沒填或與 Supabase callback 不一致（注意結尾與斜線） |
| `Access blocked: app not verified` / 只有你能登入 | App 還在 Testing → 執行 G「發布」 |
| 登入後回到首頁而非 `/member` | F 步驟 Redirect URLs 沒把 `/member` 加入白名單 |

---

## 備註
- **Email Magic Link**：Supabase 內建寄信有速率限制，正式量大時建議在 Authentication → Emails 設定自訂 SMTP（或改接 Resend）。
- **LINE 登入 / 官方帳號綁定**：屬第二期，需另建 LINE Login + Messaging API channel 並連動，另有文件。
