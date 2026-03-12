/*
  Run this SQL in your Supabase SQL Editor to set up the database schema:

  -- Events Table
  CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    description TEXT,
    start_date DATE,
    end_date DATE,
    type TEXT CHECK (type IN ('current', 'past')),
    image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  );

  -- Brands Table
  CREATE TABLE brands (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    logo_url TEXT,
    promotion_info TEXT,
    category TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  );

  -- Partners Table
  CREATE TABLE partners (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT CHECK (type IN ('KOL', 'Restaurant', 'Sponsor')),
    content TEXT,
    logo_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  );

  -- Locations Table
  CREATE TABLE locations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    category TEXT CHECK (category IN ('BBQ', 'Hotpot', 'Bento', 'Drink')),
    address TEXT,
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  );

  -- Reviews Table
  CREATE TABLE reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    brand_id UUID REFERENCES brands(id) ON DELETE CASCADE,
    user_name TEXT NOT NULL,
    content TEXT,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  );

  -- KOL Reviews Table (Unboxing/Sharing)
  CREATE TABLE kol_reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    kol_name TEXT NOT NULL,
    kol_avatar_url TEXT,
    title TEXT NOT NULL,
    content TEXT,
    media_type TEXT CHECK (media_type IN ('image', 'video')),
    media_url TEXT,
    video_embed_url TEXT, -- For YouTube/Instagram embeds
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  );

  -- Enable Row Level Security (RLS)
  ALTER TABLE events ENABLE ROW LEVEL SECURITY;
  ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
  ALTER TABLE partners ENABLE ROW LEVEL SECURITY;
  ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
  ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
  ALTER TABLE kol_reviews ENABLE ROW LEVEL SECURITY;

  -- Create policies for public read access
  CREATE POLICY "Public read access for events" ON events FOR SELECT USING (true);
  CREATE POLICY "Public read access for brands" ON brands FOR SELECT USING (true);
  CREATE POLICY "Public read access for partners" ON partners FOR SELECT USING (true);
  CREATE POLICY "Public read access for locations" ON locations FOR SELECT USING (true);
  CREATE POLICY "Public read access for reviews" ON reviews FOR SELECT USING (true);
  CREATE POLICY "Public read access for kol_reviews" ON kol_reviews FOR SELECT USING (true);

  -- Create policies for authenticated write access (Admin)
  CREATE POLICY "Admin write access for events" ON events FOR ALL USING (auth.role() = 'authenticated');
  CREATE POLICY "Admin write access for brands" ON brands FOR ALL USING (auth.role() = 'authenticated');
  CREATE POLICY "Admin write access for partners" ON partners FOR ALL USING (auth.role() = 'authenticated');
  CREATE POLICY "Admin write access for locations" ON locations FOR ALL USING (auth.role() = 'authenticated');
  CREATE POLICY "Admin write access for reviews" ON reviews FOR ALL USING (auth.role() = 'authenticated');
  CREATE POLICY "Admin write access for kol_reviews" ON kol_reviews FOR ALL USING (auth.role() = 'authenticated');
*/
