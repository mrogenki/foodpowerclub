// 活動分類（未來可能新增，DB 為 TEXT 欄位）
export type EventCategory = 'festival' | 'dining';

// ── 會員系統 ─────────────────────────────────────────────
export type MemberType = 'general' | 'creator' | 'business';

export interface Member {
  id: string;
  email: string | null;
  display_name: string | null;
  phone: string | null;
  member_type: MemberType;
  avatar_url: string | null;
  marketing_consent: boolean;
  line_user_id: string | null; // 預留第二期綁定官方 LINE
  created_at: string;
  updated_at: string;
}

export type ApplicationStatus = 'pending' | 'approved' | 'rejected';

export interface MemberRoleApplication {
  id: string;
  user_id: string;
  requested_type: Exclude<MemberType, 'general'>; // creator | business
  status: ApplicationStatus;
  real_name: string | null;
  contact_phone: string | null;
  platform_links: string | null; // 創作者（舊版自由文字，保留相容）
  follower_count: string | null; // 創作者（舊版自由文字，保留相容）
  social_accounts: Record<string, { account?: string; followers?: string }> | null; // 創作者：各平台帳號+粉絲數
  company_name: string | null;   // 企業
  tax_id: string | null;         // 企業
  employee_count: string | null; // 企業：員工數
  company_address: string | null;// 企業：公司地址
  note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  created_at: string;
  // join 用
  member?: Member;
}

export interface Event {
  id: string;
  title: string;
  description: string;
  long_description?: string;
  content: string;
  start_date: string;
  end_date: string;
  start_time?: string | null; // TIME 欄位，格式 HH:MM:SS，選填
  end_time?: string | null;
  type: 'current' | 'past';
  category: EventCategory;
  image_url: string;
  video_url?: string;
  created_at: string;
}

export interface Brand {
  id: string;
  /** 舊的單一活動欄位（保留向下相容）；活動關聯改由 brand_events 多對多維護 */
  event_id?: string;
  name: string;
  description: string;
  logo_url: string;
  promotion_info: string;
  category: string;
  content?: string;
  created_at: string;
}

export interface Partner {
  id: string;
  /** 主要活動（向下相容，等於所選活動的第一個）；夥伴可同時參與多個活動見 partner_events */
  event_id?: string;
  name: string;
  type: 'KOL' | 'Restaurant' | 'Sponsor';
  content: string;
  logo_url: string;
  sort_order: number;
  created_at: string;
}

/** 贊助夥伴 ↔ 活動 多對多關聯 */
export interface PartnerEvent {
  id: string;
  partner_id: string;
  event_id: string;
  created_at: string;
}

/** 品牌 ↔ 活動 多對多關聯（由活動編輯頁勾選要顯示的品牌） */
export interface BrandEvent {
  id: string;
  brand_id: string;
  event_id: string;
  created_at: string;
}

// ── 抽獎 ─────────────────────────────────────────────────
export type DrawPool = 'all_members' | 'line_bound' | 'event_signup';

export interface Draw {
  id: string;
  title: string;
  prize: string | null;
  pool: DrawPool;
  event_id: string | null;
  winner_count: number;
  status: 'open' | 'drawn';
  created_at: string;
  drawn_at: string | null;
}

export interface DrawWinner {
  id: string;
  draw_id: string;
  user_id: string | null;
  entry_id: string | null;
  name: string | null;
  contact: string | null;
  line_user_id: string | null;
  notified: boolean;
  created_at: string;
}

// ── 發送紀錄（LINE / Email） ──────────────────────────────
export interface MessageCampaign {
  id: string;
  channel: 'line' | 'email';
  status: 'scheduled' | 'sending' | 'sent' | 'failed' | 'canceled';
  member_type: string;
  title: string | null;
  payload: any;
  recipient_count: number;
  sent_count: number;
  failed_count: number;
  scheduled_at: string | null;
  sent_at: string | null;
  created_by: string | null;
  created_at: string;
}

export interface Location {
  id: string;
  name: string;
  category: 'BBQ' | 'Hotpot' | 'Bento' | 'Drink';
  city: string;
  district: string;
  region?: string;
  address: string;
  lat: number;
  lng: number;
  phone?: string;
  image_url?: string;
  description?: string;
  discount_info?: string;
  rating?: number;
  booking_url?: string;
  order_url?: string;
  business_hours?: string;
  avg_price?: string;
  created_at: string;
  location_events?: { event_id: string; events?: { id: string; title: string; type: string } }[];
  brand?: { id: string; name: string; logo_url: string };
}

// 管理員帳號（寫入一律透過 admin-accounts Edge Function，前端只讀）
export interface AdminUser {
  user_id: string;
  email: string;
  role: 'owner' | 'editor';
  created_at: string;
}

export interface Review {
  id: string;
  brand_id: string;
  user_name: string;
  content: string;
  rating: number;
  created_at: string;
}

export interface KOLReview {
  id: string;
  brand_id: string;
  kol_name: string;
  kol_avatar_url: string;
  title: string;
  content: string;
  media_type: 'image' | 'video';
  media_url: string;
  video_embed_url?: string;
  created_at: string;
}

export interface SignupSettings {
  event_id: string;
  capacity: number;
  registration_open: boolean;
  fee?: string;
  event_time?: string;
  event_location?: string;
  event_address?: string;
  created_at?: string;
}

export interface SignupEntry {
  id: string;
  event_id: string;
  name: string;
  industry: string;
  contact?: string; // 僅管理員（authenticated）讀得到，匿名查詢不可 select 此欄位
  status: 'confirmed' | 'waitlist';
  created_at: string;
}

export interface Promotion {
  id: string;
  brand_id: string;
  title: string;
  description: string;
  discount_code?: string;
  start_date: string;
  end_date: string;
  image_url: string;
  is_active: boolean;
  created_at: string;
  brand?: {
    name: string;
    logo_url: string;
  };
}
