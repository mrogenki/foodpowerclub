#!/usr/bin/env bash
# 逐表比對舊庫（新加坡）與新庫（東京）public 表筆數，全部一致才算搬完
set -euo pipefail
cd "$(dirname "$0")/../.."
source .env.migration
export PATH="/opt/homebrew/opt/libpq/bin:$PATH"

OLD_REF=spueuuoihhrejuehgfsl
NEW_REF=ultsxvsujfjzxpxgzqwh

resolve_conn() {
  local ref=$1 region=$2 pw=$3
  for cand in "db.${ref}.supabase.co|5432|postgres" \
              "aws-1-${region}.pooler.supabase.com|5432|postgres.${ref}" \
              "aws-0-${region}.pooler.supabase.com|5432|postgres.${ref}"; do
    IFS='|' read -r h p u <<<"$cand"
    if PGPASSWORD="$pw" PGCONNECT_TIMEOUT=8 psql -h "$h" -p "$p" -U "$u" -d postgres -Atc "select 1" >/dev/null 2>&1; then
      H=$h; P=$p; U=$u; return 0
    fi
  done
  echo "無法連線 $ref" >&2; exit 1
}

resolve_conn "$OLD_REF" ap-southeast-1     "$OLD_DB_PASSWORD"; OH=$H; OU=$U
resolve_conn "$NEW_REF" ap-northeast-1 "$NEW_DB_PASSWORD"; NH=$H; NU=$U

# 動態產生逐表 count SQL（兩邊都跑同一份，公平比對）
COUNT_SQL=$(PGPASSWORD="$OLD_DB_PASSWORD" psql -h "$OH" -p 5432 -U "$OU" -d postgres -Atc \
  "select string_agg(format('select %L as tbl, count(*)::text as n from %I.%I', tablename, schemaname, tablename), ' union all ' order by tablename)
   from pg_tables where schemaname='public'")
COUNT_SQL="$COUNT_SQL union all select 'auth.users', count(*)::text from auth.users"

PGPASSWORD="$OLD_DB_PASSWORD" psql -h "$OH" -p 5432 -U "$OU" -d postgres -Atc "$COUNT_SQL" | sort > /tmp/counts-old.txt
PGPASSWORD="$NEW_DB_PASSWORD" psql -h "$NH" -p 5432 -U "$NU" -d postgres -Atc "$COUNT_SQL" | sort > /tmp/counts-new.txt

if diff /tmp/counts-old.txt /tmp/counts-new.txt; then
  echo "✅ 全部一致（$(wc -l < /tmp/counts-old.txt | tr -d ' ') 張表）"
else
  echo "❌ 有差異（左=舊新加坡、右=新東京），請檢查上方輸出"
  exit 1
fi
