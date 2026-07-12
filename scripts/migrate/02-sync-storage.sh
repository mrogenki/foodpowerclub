#!/usr/bin/env bash
# Storage 檔案同步：新加坡 → 東京（activity-images、receipts，兩者皆 public bucket）
# 下載走 public URL（免金鑰）；上傳用新專案 service_role key。
# 可重複執行：已存在且大小相同的檔案會跳過（增量同步，切換窗口再跑一次即可）。
set -euo pipefail
cd "$(dirname "$0")/../.."
source .env.migration
export PATH="/opt/homebrew/opt/libpq/bin:$PATH"

OLD_REF=spueuuoihhrejuehgfsl
NEW_REF=ultsxvsujfjzxpxgzqwh
OLD_URL="https://${OLD_REF}.supabase.co"
NEW_URL="https://${NEW_REF}.supabase.co"

resolve_conn() {
  local ref=$1 region=$2 pw=$3
  for cand in "db.${ref}.supabase.co|postgres" \
              "aws-1-${region}.pooler.supabase.com|postgres.${ref}" \
              "aws-0-${region}.pooler.supabase.com|postgres.${ref}"; do
    IFS='|' read -r h u <<<"$cand"
    if PGPASSWORD="$pw" PGCONNECT_TIMEOUT=8 psql -h "$h" -p 5432 -U "$u" -d postgres -Atc "select 1" >/dev/null 2>&1; then
      H=$h; U=$u; return 0
    fi
  done
  echo "無法連線 $ref" >&2; exit 1
}

resolve_conn "$OLD_REF" ap-southeast-1 "$OLD_DB_PASSWORD"

# 從舊庫列出所有 objects：bucket|path|mimetype|size
LIST=$(PGPASSWORD="$OLD_DB_PASSWORD" psql -h "$H" -p 5432 -U "$U" -d postgres -Atc \
  "select bucket_id || '|' || name || '|' || coalesce(metadata->>'mimetype','application/octet-stream') || '|' || coalesce(metadata->>'size','0')
   from storage.objects where bucket_id in ('images') order by bucket_id, name")

TOTAL=$(echo "$LIST" | grep -c . || true)
echo "▶ 共 $TOTAL 個檔案"
OK=0; SKIP=0; FAIL=0; N=0

while IFS='|' read -r bucket path mime size; do
  [ -z "$bucket" ] && continue
  N=$((N+1))
  # 已存在且大小相同 → 跳過（HEAD 新專案 public URL）
  EXIST_SIZE=$(curl -s -o /dev/null -w '%{size_download}' -X GET "$NEW_URL/storage/v1/object/public/$bucket/$path" -r 0-0 -D - 2>/dev/null | grep -i '^content-range' | sed 's|.*/||' | tr -d '\r' || true)
  if [ -n "$EXIST_SIZE" ] && [ "$EXIST_SIZE" = "$size" ]; then
    SKIP=$((SKIP+1)); continue
  fi
  TMP=$(mktemp)
  if curl -sf "$OLD_URL/storage/v1/object/public/$bucket/$path" -o "$TMP"; then
    CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST \
      "$NEW_URL/storage/v1/object/$bucket/$path" \
      -H "Authorization: Bearer $NEW_SERVICE_ROLE_KEY" \
      -H "Content-Type: $mime" \
      -H "x-upsert: true" \
      --data-binary @"$TMP")
    if [ "$CODE" = "200" ]; then OK=$((OK+1)); else FAIL=$((FAIL+1)); echo "  ✗ upload $bucket/$path ($CODE)"; fi
  else
    FAIL=$((FAIL+1)); echo "  ✗ download $bucket/$path"
  fi
  rm -f "$TMP"
  [ $((N % 25)) = 0 ] && echo "  …進度 $N/$TOTAL（成功 $OK、跳過 $SKIP、失敗 $FAIL）"
done <<< "$LIST"

echo "✅ 完成：成功 $OK、跳過 $SKIP、失敗 $FAIL / 共 $TOTAL"
[ "$FAIL" = "0" ] || exit 1
