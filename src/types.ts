export interface Event {
  id: string;
  title: string;
  description: string;
  start_date: string;
  end_date: string;
  type: 'current' | 'past';
  image_url: string;
  created_at: string;
}

export interface Brand {
  id: string;
  event_id: string;
  name: string;
  description: string;
  logo_url: string;
  promotion_info: string;
  category: string;
  created_at: string;
}

export interface Partner {
  id: string;
  event_id: string;
  name: string;
  type: 'KOL' | 'Restaurant' | 'Sponsor';
  content: string;
  logo_url: string;
  created_at: string;
}

export interface Location {
  id: string;
  name: string;
  category: 'BBQ' | 'Hotpot' | 'Bento' | 'Drink';
  address: string;
  lat: number;
  lng: number;
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
  event_id: string;
  kol_name: string;
  kol_avatar_url: string;
  title: string;
  content: string;
  media_type: 'image' | 'video';
  media_url: string;
  video_embed_url?: string;
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
