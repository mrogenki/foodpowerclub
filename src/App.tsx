/// <reference types="@types/google.maps" />
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate, useParams } from 'react-router-dom';
import { 
  Utensils, 
  Calendar, 
  MapPin, 
  Users, 
  LayoutDashboard, 
  ChevronRight, 
  Star, 
  Info,
  Menu,
  X,
  Plus,
  Trash2,
  Edit,
  LogOut,
  LogIn,
  Play,
  Image as ImageIcon,
  Box,
  Tag,
  Ticket,
  FileText,
  Video,
  Search,
  RefreshCw,
  Clock,
  AlertCircle,
  DollarSign,
  CalendarCheck,
  ShoppingBag
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { BlockNoteEditor, PartialBlock } from "@blocknote/core";
import { BlockNoteView } from "@blocknote/mantine";
import { useCreateBlockNote } from "@blocknote/react";
import "@blocknote/mantine/style.css";
import { MantineProvider } from "@mantine/core";
import "@mantine/core/styles.css";
import { supabase } from './lib/supabase';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 分鐘內不重複 fetch
      gcTime: 10 * 60 * 1000,   // 10 分鐘後清除快取
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});
import { cn } from './lib/utils';
import type { Event, Brand, Partner, Location, Review, KOLReview, Promotion } from './types';

import { APIProvider, Map, AdvancedMarker, Pin, InfoWindow, useMapsLibrary } from '@vis.gl/react-google-maps';

// --- Skeleton Loading 元件 ---
const SkeletonCard = () => (
  <div className="bg-white rounded-3xl border border-stone-100 overflow-hidden animate-pulse">
    <div className="h-48 bg-stone-200" />
    <div className="p-6 space-y-3">
      <div className="h-5 bg-stone-200 rounded-full w-3/4" />
      <div className="h-4 bg-stone-100 rounded-full w-full" />
      <div className="h-4 bg-stone-100 rounded-full w-2/3" />
    </div>
  </div>
);

// --- Constants ---
const DEFAULT_EVENT_IMAGE = "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?q=80&w=1974&auto=format&fit=crop";
const DEFAULT_LOGO = "https://placehold.co/400x400/orange/white?text=Logo";
const DEFAULT_AVATAR = "https://placehold.co/100x100/stone/white?text=KOL";

// --- Utilities ---

// Supabase Storage 圖片轉換（自動縮圖 + WebP）
const optimizeImageUrl = (url: string, width: number = 800): string => {
  if (!url || !url.includes('supabase.co/storage/v1/object/public/')) return url;
  // Supabase Image Transformation: /object/public/ → /render/image/public/
  // resize=contain 保持原始比例不裁切
  return url.replace(
    '/storage/v1/object/public/',
    '/storage/v1/render/image/public/'
  ) + `?width=${width}&quality=80&resize=contain`;
};

const uploadImage = async (file: File, folder: string = 'uploads') => {
  const fileExt = file.name.split('.').pop();
  const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
  const filePath = `${folder}/${fileName}`;

  const { data, error } = await supabase.storage
    .from('images')
    .upload(filePath, file);

  if (error) {
    if (error.message.includes('bucket not found')) {
      throw new Error('Supabase Storage Bucket "images" 未找到。請在 Supabase Console 建立一個名為 "images" 的 Public Bucket。');
    }
    throw error;
  }

  const { data: { publicUrl } } = supabase.storage
    .from('images')
    .getPublicUrl(filePath);

  return publicUrl;
};

// --- Block Editor Components ---

const BlockEditor = ({ initialContent, onChange, folder = 'editor' }: { initialContent?: string, onChange: (content: string) => void, folder?: string }) => {
  const editor = useCreateBlockNote({
    initialContent: initialContent ? JSON.parse(initialContent) as PartialBlock[] : undefined,
    uploadFile: (file) => uploadImage(file, folder),
  });

  return (
    <MantineProvider>
      <div className="border border-stone-200 rounded-xl overflow-hidden min-h-[300px] bg-white">
        <BlockNoteView 
          editor={editor} 
          onChange={() => {
            onChange(JSON.stringify(editor.document));
          }}
          theme="light"
        />
      </div>
    </MantineProvider>
  );
};

const BlockRenderer = ({ content }: { content: string }) => {
  const isJson = useMemo(() => {
    try {
      JSON.parse(content);
      return true;
    } catch (e) {
      return false;
    }
  }, [content]);

  if (isJson) {
    return <BlockNoteRenderer content={content} />;
  }

  return (
    <div className="prose prose-stone max-w-none prose-img:rounded-3xl prose-headings:text-stone-900 prose-p:text-stone-600 prose-p:leading-relaxed prose-a:text-orange-600">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
};

const SafeImage = ({ src, alt, className, fallback = DEFAULT_EVENT_IMAGE, optimize = true, width = 800, ...props }: any) => {
  const optimized = optimize ? optimizeImageUrl(src || '', width) : (src || '');
  const [imgSrc, setImgSrc] = useState(optimized || fallback);

  useEffect(() => {
    setImgSrc((optimize ? optimizeImageUrl(src || '', width) : (src || '')) || fallback);
  }, [src, fallback, optimize, width]);

  return (
    <img
      {...props}
      src={imgSrc}
      alt={alt}
      className={className}
      onError={() => {
        if (imgSrc !== fallback) {
          setImgSrc(fallback);
        }
      }}
      referrerPolicy="no-referrer"
    />
  );
};

const BlockNoteRenderer = ({ content }: { content: string }) => {
  const blocks = useMemo(() => JSON.parse(content) as PartialBlock[], [content]);
  const editor = useCreateBlockNote({ initialContent: blocks });

  return (
    <MantineProvider>
      <div className="blocknote-renderer prose-none">
        <BlockNoteView editor={editor} editable={false} theme="light" />
      </div>
    </MantineProvider>
  );
};

// --- Components ---

const ImageUpload = ({ value, onChange, label, folder = 'uploads' }: { value?: string, onChange: (url: string) => void, label: string, folder?: string }) => {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);
    try {
      const url = await uploadImage(file, folder);
      onChange(url);
    } catch (err: any) {
      setError(err.message || '上傳失敗');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-stone-700">{label}</label>
      <div className="flex items-center gap-4">
        {value && (
          <div className="relative w-20 h-20 rounded-xl overflow-hidden border border-stone-200">
            <SafeImage src={value} alt="Preview" className="w-full h-full object-cover" />
            <button 
              type="button"
              onClick={() => onChange('')}
              className="absolute top-1 right-1 p-1 bg-white/80 rounded-full text-stone-600 hover:text-red-600"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}
        <div className="flex-1">
          <div className="relative">
            <input 
              type="file" 
              accept="image/*" 
              onChange={handleFileChange}
              className="hidden" 
              id={`file-upload-${label}`}
              disabled={uploading}
            />
            <label 
              htmlFor={`file-upload-${label}`}
              className={cn(
                "flex items-center justify-center gap-2 px-4 py-2 rounded-xl border-2 border-dashed border-stone-200 text-stone-500 cursor-pointer hover:border-orange-600 hover:text-orange-600 transition-all",
                uploading && "opacity-50 cursor-not-allowed"
              )}
            >
              {uploading ? '上傳中...' : (
                <>
                  <ImageIcon className="w-4 h-4" />
                  點擊上傳圖片
                </>
              )}
            </label>
          </div>
          <input 
            type="text" 
            value={value || ''} 
            onChange={(e) => onChange(e.target.value)}
            placeholder="或輸入圖片網址"
            className="mt-2 w-full px-4 py-2 rounded-xl border border-stone-200 outline-none focus:ring-2 focus:ring-orange-600 text-sm"
          />
        </div>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
};

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    window.location.href = '/';
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-stone-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <Link to="/" className="flex items-center gap-2">
            <Utensils className="w-8 h-8 text-orange-600" />
            <span className="font-bold text-xl tracking-tight text-stone-900">食在力量俱樂部</span>
          </Link>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center gap-8">
            <Link to="/events" className="text-stone-600 hover:text-orange-600 transition-colors font-medium">活動資訊</Link>
            <Link to="/promotions" className="text-stone-600 hover:text-orange-600 transition-colors font-medium">優惠資訊</Link>
            <Link to="/reviews" className="text-stone-600 hover:text-orange-600 transition-colors font-medium">開箱分享</Link>
            <Link to="/map" className="text-stone-600 hover:text-orange-600 transition-colors font-medium">美食地圖</Link>
            <Link to="/partners" className="text-stone-600 hover:text-orange-600 transition-colors font-medium">贊助夥伴</Link>
            {session ? (
              <Link to="/admin" className="flex items-center gap-2 bg-stone-900 text-white px-4 py-2 rounded-full text-sm font-medium hover:bg-stone-800 transition-colors">
                <LayoutDashboard className="w-4 h-4" />
                管理中心
              </Link>
            ) : null}
          </div>

          {/* Mobile Menu Button */}
          <button onClick={() => setIsOpen(!isOpen)} className="md:hidden p-2 text-stone-600">
            {isOpen ? <X /> : <Menu />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="md:hidden bg-white border-b border-stone-200"
          >
            <div className="px-4 pt-2 pb-6 space-y-1">
              <Link to="/events" onClick={() => setIsOpen(false)} className="block px-3 py-4 text-base font-medium text-stone-600 border-b border-stone-100">活動資訊</Link>
              <Link to="/promotions" onClick={() => setIsOpen(false)} className="block px-3 py-4 text-base font-medium text-stone-600 border-b border-stone-100">優惠資訊</Link>
              <Link to="/reviews" onClick={() => setIsOpen(false)} className="block px-3 py-4 text-base font-medium text-stone-600 border-b border-stone-100">開箱分享</Link>
              <Link to="/map" onClick={() => setIsOpen(false)} className="block px-3 py-4 text-base font-medium text-stone-600 border-b border-stone-100">美食地圖</Link>
              <Link to="/partners" onClick={() => setIsOpen(false)} className="block px-3 py-4 text-base font-medium text-stone-600 border-b border-stone-100">贊助夥伴</Link>
              {session ? (
                <Link to="/admin" onClick={() => setIsOpen(false)} className="block px-3 py-4 text-base font-medium text-orange-600">管理中心</Link>
              ) : null}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

// --- Pages ---

const Home = () => {
  const [currentEvents, setCurrentEvents] = useState<Event[]>([]);
  const [pastEvents, setPastEvents] = useState<Event[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [reviews, setReviews] = useState<KOLReview[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [heroIndex, setHeroIndex] = useState(0);

  useEffect(() => {
    const fetchHomeData = async () => {
      // Fetch Events - Order by start_date ascending to get the ones starting earlier first
      const { data: eventsData } = await supabase.from('events').select('*').order('start_date', { ascending: true });
      if (eventsData) {
        setCurrentEvents(eventsData.filter(e => e.type === 'current'));
        setPastEvents(eventsData.filter(e => e.type === 'past'));
      }

      // Fetch Promotions
      const { data: promoData } = await supabase
        .from('promotions')
        .select('*, brand:brands(name, logo_url)')
        .eq('is_active', true)
        .limit(3)
        .order('created_at', { ascending: false });
      if (promoData) setPromotions(promoData as any);

      // Fetch Reviews
      const { data: reviewsData } = await supabase.from('kol_reviews').select('*').limit(3).order('created_at', { ascending: false });
      if (reviewsData) setReviews(reviewsData);

      // Fetch Partners
      const { data: partnersData } = await supabase.from('partners').select('*').order('sort_order', { ascending: true }).limit(6);
      if (partnersData) setPartners(partnersData);
    };
    fetchHomeData();
  }, []);

  // Hero Carousel Timer
  useEffect(() => {
    if (currentEvents.length <= 1) return;
    
    const timer = setInterval(() => {
      setHeroIndex((prev) => (prev + 1) % currentEvents.length);
    }, 5000);
    
    return () => clearInterval(timer);
  }, [currentEvents.length]);

  const activeHeroEvent = currentEvents[heroIndex] || currentEvents[0];

  return (
    <div className="pt-16">
      {/* Hero Section */}
      <section className="relative h-[80vh] flex items-center justify-center overflow-hidden bg-stone-900">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeHeroEvent?.id || 'default'}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1 }}
            className="absolute inset-0"
          >
            <SafeImage 
              src={activeHeroEvent?.image_url} 
              fallback="https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?q=80&w=2070&auto=format&fit=crop"
              className="absolute inset-0 w-full h-full object-cover opacity-60"
              alt="Hero"
            />
          </motion.div>
        </AnimatePresence>

        <div className="relative z-10 text-center px-4 w-full max-w-4xl">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeHeroEvent?.id || 'default-text'}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -30 }}
              transition={{ duration: 0.8 }}
            >
              <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 tracking-tight">
                {activeHeroEvent?.title || "食在力量俱樂部"}
              </h1>
              <p className="text-xl text-stone-200 max-w-2xl mx-auto mb-8 font-light">
                {activeHeroEvent?.description || "探索城市中最具力量的美食，連結品牌與味蕾的盛宴。"}
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link to={`/event/${activeHeroEvent?.id}`} className="bg-orange-600 text-white px-8 py-4 rounded-full font-bold hover:bg-orange-500 transition-all transform hover:scale-105">
                  立即探索
                </Link>
                <Link to="/promotions" className="bg-white text-orange-600 px-8 py-4 rounded-full font-bold hover:bg-stone-50 transition-all transform hover:scale-105 shadow-xl">
                  優惠資訊
                </Link>
                <Link to="/map" className="bg-white/10 backdrop-blur-md text-white border border-white/20 px-8 py-4 rounded-full font-bold hover:bg-white/20 transition-all">
                  查看地圖
                </Link>
              </div>
            </motion.div>
          </AnimatePresence>
          
        </div>

        {/* Carousel Indicators */}
        {currentEvents.length > 1 && (
          <div className="absolute bottom-12 left-1/2 transform -translate-x-1/2 flex gap-2 z-20">
            {currentEvents.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setHeroIndex(idx)}
                className={cn(
                  "w-2 h-2 rounded-full transition-all cursor-pointer",
                  idx === heroIndex ? "bg-orange-600 w-8" : "bg-white/40 hover:bg-white/60"
                )}
              />
            ))}
          </div>
        )}
      </section>

      {/* 1. 近期活動 (Recent Events) */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-end mb-12">
            <div>
              <h2 className="text-3xl font-bold text-stone-900 mb-2">近期活動</h2>
              <p className="text-stone-500">探索最新與過往的精彩美食祭典</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Current Events */}
            {currentEvents.map((event) => (
              <motion.div 
                key={event.id}
                whileHover={{ y: -10 }}
                className="bg-white rounded-3xl overflow-hidden shadow-xl border-2 border-orange-100 relative"
              >
                <div className="absolute top-4 right-4 bg-orange-600 text-white px-3 py-1 rounded-full text-xs font-bold z-10">
                  進行中
                </div>
                <SafeImage src={event.image_url} className="w-full h-56 object-cover object-center" alt={event.title} />
                <div className="p-8">
                  <h3 className="text-2xl font-bold mb-3">{event.title}</h3>
                  <p className="text-stone-500 text-sm mb-6 line-clamp-2">{event.description}</p>
                  <Link to={`/event/${event.id}`} className="inline-flex items-center gap-2 text-orange-600 font-bold">
                    立即參與 <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>
              </motion.div>
            ))}
            
            {/* Past Events */}
            {pastEvents.slice(0, Math.max(0, 3 - currentEvents.length)).map((event) => (
              <motion.div 
                key={event.id}
                whileHover={{ y: -10 }}
                className="bg-stone-50 rounded-3xl overflow-hidden border border-stone-100"
              >
                <SafeImage src={event.image_url} className="w-full h-56 object-cover object-center opacity-80" alt={event.title} />
                <div className="p-8">
                  <h3 className="text-xl font-bold mb-3">{event.title}</h3>
                  <p className="text-stone-500 text-sm mb-6 line-clamp-2">{event.description}</p>
                  <Link to={`/event/${event.id}`} className="text-stone-400 font-semibold text-sm hover:text-orange-600 transition-colors">回顧活動</Link>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* 2. 優惠資訊 (Promotions) */}
      <section className="py-24 bg-stone-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-end mb-12">
            <div>
              <h2 className="text-3xl font-bold text-stone-900 mb-2">優惠資訊</h2>
              <p className="text-stone-500">限時品牌優惠，不容錯過</p>
            </div>
            <Link to="/promotions" className="text-orange-600 font-bold flex items-center gap-1">
              更多優惠 <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {promotions.map((promo) => (
              <div key={promo.id} className="bg-white p-6 rounded-3xl border border-stone-100 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <SafeImage src={promo.brand?.logo_url} fallback={DEFAULT_LOGO} className="w-10 h-10 rounded-full object-cover" alt={promo.brand?.name} />
                  <span className="font-bold text-stone-800">{promo.brand?.name}</span>
                </div>
                <h3 className="text-lg font-bold mb-2">{promo.title}</h3>
                <p className="text-stone-500 text-sm mb-6 line-clamp-2">{promo.description}</p>
                <div className="bg-orange-50 text-orange-600 p-3 rounded-xl font-mono text-center font-bold">
                  {promo.discount_code || "現場領取"}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 3. 開箱分享 (KOL Reviews) */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-end mb-12">
            <div>
              <h2 className="text-3xl font-bold text-stone-900 mb-2">開箱分享</h2>
              <p className="text-stone-500">跟著 KOL 探索美食祭亮點</p>
            </div>
            <Link to="/reviews" className="text-orange-600 font-bold flex items-center gap-1">
              看更多分享 <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {reviews.map((review) => (
              <div key={review.id} className="group cursor-pointer">
                <div className="relative aspect-video rounded-3xl overflow-hidden mb-4">
                  <SafeImage src={review.media_url} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt={review.title} />
                  {review.media_type === 'video' && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                      <Play className="w-12 h-12 text-white fill-current" />
                    </div>
                  )}
                </div>
                <h3 className="font-bold text-lg mb-2 group-hover:text-orange-600 transition-colors">{review.title}</h3>
                <div className="flex items-center gap-2 text-sm text-stone-400">
                  <SafeImage src={review.kol_avatar_url} fallback={DEFAULT_AVATAR} className="w-6 h-6 rounded-full" alt={review.kol_name} />
                  <span>{review.kol_name}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. 美食地圖 (Food Map) */}
      <section className="py-24 bg-stone-900 text-white overflow-hidden relative">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-orange-600 rounded-full blur-[120px]"></div>
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-orange-800 rounded-full blur-[150px]"></div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-4xl font-bold mb-6">美食地圖</h2>
              <p className="text-stone-400 text-lg mb-8 leading-relaxed">
                不想錯過任何一個美味據點？使用我們的互動式美食地圖，輕鬆規劃你的美食祭攻略路線。
              </p>
              <Link to="/map" className="inline-flex items-center gap-3 bg-orange-600 text-white px-8 py-4 rounded-full font-bold hover:bg-orange-500 transition-all">
                立即開啟地圖 <MapPin className="w-5 h-5" />
              </Link>
            </div>
            <div className="relative">
              <div className="bg-stone-800 aspect-square rounded-[40px] border border-stone-700 p-4 shadow-2xl transform rotate-3">
                <div className="w-full h-full rounded-[32px] bg-stone-700 flex items-center justify-center overflow-hidden relative">
                  <SafeImage 
                    src="https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1?q=80&w=2066&auto=format&fit=crop" 
                    className="w-full h-full object-cover opacity-50 grayscale" 
                    alt="Map Preview" 
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="bg-white p-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-bounce">
                      <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                        <Utensils className="w-5 h-5 text-orange-600" />
                      </div>
                      <div className="pr-2">
                        <p className="text-stone-900 font-bold text-sm">你在這裡</p>
                        <p className="text-stone-400 text-[10px]">附近有 5 家燒肉店</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. 贊助夥伴 (Partners) */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-stone-900 mb-4">贊助夥伴</h2>
            <p className="text-stone-500">感謝所有支持美食祭的合作夥伴</p>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-6 gap-12 items-center">
            {partners.map((partner) => (
              <Link 
                key={partner.id} 
                to={`/partner/${partner.id}`}
                className="flex flex-col items-center group transition-opacity"
              >
                <SafeImage src={partner.logo_url} fallback={DEFAULT_LOGO} className="h-20 w-auto max-w-[140px] object-contain mb-4 transition-all" alt={partner.name} />
                <span className="text-[10px] uppercase tracking-widest font-bold text-stone-600 group-hover:text-orange-600 transition-colors">{partner.name}</span>
              </Link>
            ))}
          </div>
          
          <div className="mt-16 text-center">
            <Link to="/partners" className="text-stone-400 hover:text-orange-600 transition-colors text-sm font-medium">
              查看所有合作夥伴
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

const EventsPage = () => {
  const [events, setEvents] = useState<Event[]>([]);

  useEffect(() => {
    const fetchEvents = async () => {
      const { data } = await supabase.from('events').select('*').order('start_date', { ascending: true });
      if (data) setEvents(data);
    };
    fetchEvents();
  }, []);

  return (
    <div className="pt-24 min-h-screen bg-stone-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-12 text-center">
          <h1 className="text-4xl font-bold text-stone-900 mb-4">活動資訊</h1>
          <p className="text-stone-500 max-w-2xl mx-auto">探索「食在力量俱樂部」的所有精彩活動，從過去的經典回顧到現在的熱門盛宴。</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {events.map((event) => (
            <motion.div 
              key={event.id}
              whileHover={{ y: -10 }}
              className="bg-white rounded-3xl overflow-hidden shadow-sm border border-stone-100 group"
            >
              <div className="relative h-64 overflow-hidden">
                <SafeImage src={event.image_url} className="w-full h-full object-cover object-center group-hover:scale-110 transition-transform duration-500" alt={event.title} />
                <div className="absolute top-4 right-4">
                  <span className={cn(
                    "px-3 py-1 rounded-full text-xs font-bold text-white shadow-lg",
                    event.type === 'current' ? "bg-orange-600" : "bg-stone-400"
                  )}>
                    {event.type === 'current' ? "進行中" : "已結束"}
                  </span>
                </div>
              </div>
              <div className="p-8">
                <div className="flex items-center gap-2 text-stone-400 text-xs mb-3">
                  <Calendar className="w-4 h-4" />
                  <span>{event.start_date} ~ {event.end_date}</span>
                </div>
                <h3 className="text-2xl font-bold mb-3 group-hover:text-orange-600 transition-colors">{event.title}</h3>
                <p className="text-stone-500 text-sm mb-6 line-clamp-2">{event.description}</p>
                <Link 
                  to={`/event/${event.id}`} 
                  className="inline-flex items-center gap-2 text-orange-600 font-bold hover:gap-3 transition-all"
                >
                  查看詳情 <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};

const EventDetail = () => {
  const { id } = useParams();
  const [event, setEvent] = useState<Event | null>(null);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      const { data: eventData } = await supabase.from('events').select('*').eq('id', id).single();
      const { data: brandsData } = await supabase.from('brands').select('*').eq('event_id', id);
      const { data: partnersData } = await supabase.from('partners').select('*').eq('event_id', id).order('sort_order', { ascending: true });
      
      if (eventData) setEvent(eventData);
      if (brandsData) setBrands(brandsData);
      if (partnersData) setPartners(partnersData);
    };
    fetchData();
  }, [id]);

  if (!event) return <div className="pt-32 text-center">載入中...</div>;

  return (
    <div className="pt-16 bg-white min-h-screen">
      {/* Hero Section */}
      <div className="h-[60vh] relative overflow-hidden">
        <SafeImage src={event.image_url} className="w-full h-full object-cover" alt={event.title} />
        <div className="absolute inset-0 bg-gradient-to-t from-stone-900 via-stone-900/40 to-transparent flex items-end p-8">
          <div className="max-w-7xl mx-auto w-full">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Link to="/events" className="inline-flex items-center gap-2 text-white/80 hover:text-white mb-6 transition-colors">
                <ChevronRight className="w-4 h-4 rotate-180" /> 返回活動列表
              </Link>
              <div className="flex items-center gap-3 mb-4">
                <span className={cn(
                  "px-3 py-1 rounded-full text-xs font-bold text-white",
                  event.type === 'current' ? "bg-orange-600" : "bg-stone-500"
                )}>
                  {event.type === 'current' ? "進行中" : "已結束"}
                </span>
                <span className="text-stone-300 text-sm flex items-center gap-1">
                  <Calendar className="w-4 h-4" /> {event.start_date} ~ {event.end_date}
                </span>
              </div>
              <h1 className="text-4xl md:text-6xl font-bold text-white mb-4">{event.title}</h1>
            </motion.div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-16">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-16">
          <div className="lg:col-span-2 space-y-16">
            {/* Blog Content Section */}
            <section className="bg-white rounded-3xl">
              <h2 className="text-2xl font-bold mb-8 border-l-4 border-orange-600 pl-4">活動詳情</h2>
              <BlockRenderer content={event.content || event.long_description || event.description} />
            </section>

            {/* Video Section */}
            {event.video_url && (
              <section>
                <h2 className="text-2xl font-bold mb-6 border-l-4 border-orange-600 pl-4 text-stone-900">活動影音</h2>
                <div className="aspect-video rounded-[40px] overflow-hidden bg-stone-100 shadow-2xl border-8 border-white">
                  {event.video_url.includes('youtube.com') || event.video_url.includes('youtu.be') ? (
                    <iframe 
                      src={event.video_url.replace('watch?v=', 'embed/').replace('youtu.be/', 'youtube.com/embed/')} 
                      className="w-full h-full"
                      allowFullScreen
                      title="Event Video"
                    />
                  ) : (
                    <video src={event.video_url} controls className="w-full h-full object-cover" />
                  )}
                </div>
              </section>
            )}

            {/* Brands Section */}
            <section>
              <h2 className="text-2xl font-bold mb-8 border-l-4 border-orange-600 pl-4">參與品牌</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                {brands.map(brand => (
                  <Link 
                    key={brand.id} 
                    to={`/brand/${brand.id}`}
                    className="group border border-stone-100 rounded-3xl p-6 hover:shadow-lg transition-all bg-white block"
                  >
                    <div className="flex items-center gap-4 mb-4">
                      <SafeImage src={brand.logo_url} className="w-16 h-16 rounded-2xl object-cover bg-stone-50" alt={brand.name} fallback={DEFAULT_LOGO} />
                      <div>
                        <h3 className="font-bold text-lg group-hover:text-orange-600 transition-colors">{brand.name}</h3>
                        <span className="text-[10px] uppercase tracking-wider text-orange-600 font-bold">{brand.category}</span>
                      </div>
                    </div>
                    <p className="text-stone-500 text-sm mb-6 line-clamp-2">{brand.description}</p>
                    <div className="bg-orange-50 p-4 rounded-2xl text-sm">
                      <p className="text-orange-800 font-bold mb-1">專屬優惠</p>
                      <p className="text-orange-600">{brand.promotion_info}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          </div>

          {/* Sidebar */}
          <div className="space-y-12">
            <section>
              <h2 className="text-2xl font-bold mb-8 border-l-4 border-orange-600 pl-4">贊助夥伴</h2>
              <div className="space-y-4">
                {partners.map(partner => (
                  <Link 
                    key={partner.id} 
                    to={`/partner/${partner.id}`}
                    className="flex items-center gap-4 p-4 bg-stone-50 rounded-2xl hover:bg-stone-100 transition-colors group"
                  >
                    <SafeImage src={partner.logo_url} fallback={DEFAULT_LOGO} className="w-12 h-12 rounded-xl object-contain shadow-sm" alt={partner.name} />
                    <div>
                      <h4 className="font-bold text-sm text-stone-800 group-hover:text-orange-600 transition-colors">{partner.name}</h4>
                      <p className="text-[10px] uppercase tracking-widest text-stone-400 font-bold">{partner.type}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </section>

            <section className="bg-orange-600 rounded-3xl p-8 text-white shadow-xl shadow-orange-200">
              <h3 className="text-xl font-bold mb-4">立即參與</h3>
              <p className="text-orange-100 text-sm mb-6">加入食在力量俱樂部，探索更多美味驚喜！</p>
              <Link to="/promotions" className="block w-full bg-white text-orange-600 text-center py-3 rounded-xl font-bold hover:bg-stone-50 transition-colors">
                領取優惠券
              </Link>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

const BrandDetail = () => {
  const { id } = useParams();
  const [brand, setBrand] = useState<Brand | null>(null);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [kolReviews, setKolReviews] = useState<KOLReview[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<KOLReview | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      const { data: brandData } = await supabase.from('brands').select('*').eq('id', id).single();
      const { data: promoData } = await supabase.from('promotions').select('*').eq('brand_id', id).eq('is_active', true);
      const { data: kolData } = await supabase.from('kol_reviews').select('*').eq('brand_id', id).order('created_at', { ascending: false });
      
      if (brandData) setBrand(brandData);
      if (promoData) setPromotions(promoData);
      if (kolData) setKolReviews(kolData);
    };
    fetchData();
    window.scrollTo(0, 0);
  }, [id]);

  if (!brand) return <div className="pt-32 text-center">載入中...</div>;

  return (
    <div className="pt-24 bg-stone-50 min-h-screen">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-[40px] shadow-sm border border-stone-100 overflow-hidden"
        >
          {/* Brand Header */}
          <div className="p-8 md:p-12 border-b border-stone-50 bg-gradient-to-br from-white to-stone-50">
            <div className="flex flex-col md:flex-row items-center gap-8">
              <SafeImage src={brand.logo_url} fallback={DEFAULT_LOGO} className="w-32 h-32 rounded-3xl object-cover shadow-xl border-4 border-white" alt={brand.name} />
              <div className="text-center md:text-left">
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mb-4">
                  <span className="px-4 py-1 bg-orange-100 text-orange-600 rounded-full text-xs font-bold uppercase tracking-widest">
                    {brand.category}
                  </span>
                </div>
                <h1 className="text-4xl font-bold text-stone-900 mb-4">{brand.name}</h1>
                <p className="text-stone-500 text-lg leading-relaxed max-w-2xl">
                  {brand.description}
                </p>
              </div>
            </div>
          </div>

          {/* Brand Content */}
          <div className="p-8 md:p-12">
            <div className="prose prose-stone max-w-none">
              <h2 className="text-2xl font-bold mb-8 border-l-4 border-orange-600 pl-4">品牌介紹</h2>
              <div className="bg-white rounded-2xl">
                <BlockRenderer content={brand.content || brand.description} />
              </div>
            </div>

            {/* Promotions */}
            {promotions.length > 0 && (
              <div className="mt-16">
                <h2 className="text-2xl font-bold mb-8 border-l-4 border-orange-600 pl-4">專屬優惠</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {promotions.map(promo => (
                    <div key={promo.id} className="bg-orange-50 p-6 rounded-3xl border border-orange-100">
                      <h3 className="font-bold text-orange-900 mb-2">{promo.title}</h3>
                      <p className="text-orange-700 text-sm mb-4">{promo.description}</p>
                      {promo.discount_code && (
                        <div className="bg-white px-4 py-2 rounded-xl font-mono text-center font-bold text-orange-600 border border-orange-200">
                          CODE: {promo.discount_code}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* KOL Reviews */}
            {kolReviews.length > 0 && (
              <div className="mt-16">
                <h2 className="text-2xl font-bold mb-8 border-l-4 border-orange-600 pl-4">開箱分享</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {kolReviews.map(review => (
                    <div 
                      key={review.id} 
                      className="bg-white rounded-3xl overflow-hidden shadow-sm border border-stone-100 group cursor-pointer"
                      onClick={() => review.media_type === 'video' && setSelectedVideo(review)}
                    >
                      <div className="relative aspect-video bg-stone-200 overflow-hidden">
                        {review.media_type === 'video' ? (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <SafeImage src={review.media_url} className="w-full h-full object-cover opacity-80 group-hover:scale-105 transition-transform duration-500" alt={review.title} />
                            <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-all flex items-center justify-center">
                              <div className="w-12 h-12 bg-white/90 rounded-full flex items-center justify-center text-orange-600 shadow-xl">
                                <Play className="w-6 h-6 fill-current" />
                              </div>
                            </div>
                          </div>
                        ) : (
                          <SafeImage src={review.media_url} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt={review.title} />
                        )}
                      </div>
                      <div className="p-6">
                        <div className="flex items-center gap-3 mb-4">
                          <SafeImage src={review.kol_avatar_url} className="w-8 h-8 rounded-full object-cover" alt={review.kol_name} fallback={DEFAULT_AVATAR} />
                          <span className="font-bold text-stone-800 text-sm">{review.kol_name}</span>
                        </div>
                        <h3 className="font-bold mb-2 group-hover:text-orange-600 transition-colors">{review.title}</h3>
                        <div className="text-stone-500 text-xs line-clamp-2">
                          <BlockRenderer content={review.content} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </motion.div>

        {/* Video Modal */}
        <AnimatePresence>
          {selectedVideo && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSelectedVideo(null)}
                className="absolute inset-0 bg-stone-900/90 backdrop-blur-md"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className={cn(
                  "relative w-full max-w-5xl bg-black rounded-3xl overflow-hidden shadow-2xl",
                  selectedVideo.video_embed_url?.includes('tiktok') || 
                  selectedVideo.video_embed_url?.includes('shorts') || 
                  selectedVideo.video_embed_url?.includes('reels') 
                    ? "max-w-sm aspect-[9/16]" 
                    : "aspect-video"
                )}
              >
                <button 
                  onClick={() => setSelectedVideo(null)}
                  className="absolute top-4 right-4 z-10 p-2 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
                
                {selectedVideo.video_embed_url ? (
                  <iframe 
                    src={getEmbedUrl(selectedVideo.video_embed_url) || ''}
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white">
                    <p>未提供影片連結</p>
                  </div>
                )}
              </motion.div>
            </div>
          )}
        </AnimatePresence>
        
        <div className="mt-12 text-center">
          <button 
            onClick={() => window.history.back()}
            className="text-stone-400 hover:text-orange-600 font-bold transition-colors flex items-center gap-2 mx-auto"
          >
            <ChevronRight className="w-4 h-4 rotate-180" /> 返回上一頁
          </button>
        </div>
      </div>
    </div>
  );
};

const PartnerDetail = () => {
  const { id } = useParams();
  const [partner, setPartner] = useState<Partner | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      const { data: partnerData } = await supabase.from('partners').select('*').eq('id', id).single();
      if (partnerData) setPartner(partnerData);
    };
    fetchData();
    window.scrollTo(0, 0);
  }, [id]);

  if (!partner) return <div className="pt-32 text-center">載入中...</div>;

  return (
    <div className="pt-24 bg-stone-50 min-h-screen">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-[40px] shadow-sm border border-stone-100 overflow-hidden"
        >
          {/* Partner Header */}
          <div className="p-8 md:p-12 border-b border-stone-50 bg-gradient-to-br from-white to-stone-50">
            <div className="flex flex-col md:flex-row items-center gap-8">
              <SafeImage src={partner.logo_url} fallback={DEFAULT_LOGO} className="w-32 h-32 rounded-3xl object-contain shadow-xl border-4 border-white" alt={partner.name} />
              <div className="text-center md:text-left">
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mb-4">
                  <span className="px-4 py-1 bg-stone-100 text-stone-600 rounded-full text-xs font-bold uppercase tracking-widest">
                    {partner.type}
                  </span>
                </div>
                <h1 className="text-4xl font-bold text-stone-900 mb-4">{partner.name}</h1>
              </div>
            </div>
          </div>

          {/* Partner Content */}
          <div className="p-8 md:p-12">
            <div className="prose prose-stone max-w-none">
              <h2 className="text-2xl font-bold mb-8 border-l-4 border-orange-600 pl-4">合作夥伴介紹</h2>
              <div className="bg-white rounded-2xl">
                <BlockRenderer content={partner.content || "暫無詳細介紹"} />
              </div>
            </div>
          </div>
        </motion.div>
        
        <div className="mt-12 text-center">
          <button 
            onClick={() => window.history.back()}
            className="text-stone-400 hover:text-orange-600 font-bold transition-colors flex items-center gap-2 mx-auto"
          >
            <ChevronRight className="w-4 h-4 rotate-180" /> 返回上一頁
          </button>
        </div>
      </div>
    </div>
  );
};

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const isConfigured = import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConfigured) {
      setError('Supabase 未設定。請在環境變數中設定 VITE_SUPABASE_URL 與 VITE_SUPABASE_ANON_KEY。');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) {
        if (authError.message === 'Failed to fetch') {
          setError('連線失敗：請檢查您的 Supabase URL 是否正確，以及網路連線是否正常。');
        } else {
          setError(authError.message);
        }
      } else {
        navigate('/admin');
      }
    } catch (err: any) {
      setError(err.message || '登入時發生未知錯誤');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50 px-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 border border-stone-100">
        <div className="text-center mb-8">
          <Utensils className="w-12 h-12 text-orange-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-stone-900">管理中心登入</h2>
          <p className="text-stone-500">請輸入您的帳號密碼</p>
        </div>

        {!isConfigured && (
          <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm">
            <p className="font-bold mb-1">⚠️ 系統設定未完成</p>
            <p>偵測到缺少 Supabase 環境變數。如果您是在 Vercel 部署，請務必在 Vercel Dashboard 設定環境變數。</p>
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">電子郵件</label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-orange-600 focus:border-transparent outline-none transition-all"
              placeholder="admin@example.com"
              required
            />
          </div>
          <div>
            <div className="flex justify-between mb-2">
              <label className="block text-sm font-medium text-stone-700">密碼</label>
            </div>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-orange-600 focus:border-transparent outline-none transition-all"
              placeholder="••••••••"
              required
            />
          </div>
          <button 
            type="submit" 
            disabled={loading || !isConfigured}
            className="w-full bg-orange-600 text-white py-3 rounded-xl font-bold hover:bg-orange-500 transition-all disabled:opacity-50"
          >
            {loading ? '登入中...' : '立即登入'}
          </button>
        </form>
      </div>
    </div>
  );
};

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
const GOOGLE_MAPS_MAP_ID = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID || 'DEMO_MAP_ID';

import { TAIWAN_DISTRICTS } from './constants/taiwanDistricts';


const MapPage = () => {
  const [selectedShop, setSelectedShop] = useState<Location | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('全部');
  const [activeCity, setActiveCity] = useState<string>('全部');
  const [activeDistrict, setActiveDistrict] = useState<string>('全部');
  const [locations, setLocations] = useState<Location[]>([]);
  const [loadingLocations, setLoadingLocations] = useState(true);
  const [filterEventOnly, setFilterEventOnly] = useState(false);

  useEffect(() => {
    const fetchLocations = async () => {
      try {
        setLoadingLocations(true);
        const { data, error } = await supabase
          .from('locations')
          .select('*, location_events(event_id, events(id, title, type)), brand:brands(id, name, logo_url)');
        if (error) throw error;
        if (data) setLocations(data);
      } catch (error: any) {
        console.error('Fetch locations error:', error);
      } finally {
        setLoadingLocations(false);
      }
    };
    fetchLocations();
  }, []);

  const handleRefresh = async () => {
    const { data } = await supabase.from('locations').select('*');
    if (data) setLocations(data);
  };

  const categoryMap: Record<string, string> = {
    '全部': '全部',
    '燒肉': 'BBQ',
    '火鍋': 'Hotpot',
    '便當': 'Bento',
    '手搖': 'Drink'
  };

  const cities = ['全部', ...Object.keys(TAIWAN_DISTRICTS)];
  const districts = activeCity === '全部' ? [] : ['全部', ...(TAIWAN_DISTRICTS[activeCity] || [])];

  const filteredLocations = locations.filter(loc => {
    const matchCategory = activeCategory === '全部' || loc.category === categoryMap[activeCategory];
    
    // Robust city matching (handling 台/臺 and transition from region)
    const normalize = (s: string | undefined) => s?.replace(/台/g, '臺') || '';
    const targetCity = normalize(activeCity);
    const locCity = normalize(loc.city);
    const locRegion = normalize(loc.region);
    
    const matchCity = activeCity === '全部' || 
                     locCity === targetCity || 
                     (locCity === '' && locRegion.includes(targetCity.replace('市', '').replace('縣', '')));

    // District matching
    const matchDistrict = activeDistrict === '全部' || loc.district === activeDistrict;
    
    const matchEvent = !filterEventOnly || (loc.location_events && loc.location_events.length > 0);
    return matchCategory && matchCity && matchDistrict && matchEvent;
  });

  useEffect(() => {
    console.log('Filter changed:', { activeCategory, activeCity, activeDistrict });
    console.log('Filtered count:', filteredLocations.length);
  }, [activeCategory, activeCity, activeDistrict, filteredLocations.length]);

  const categories = ['全部', '燒肉', '火鍋', '便當', '手搖'];

  return (
    <div className="pt-24 min-h-screen bg-stone-50 pb-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-12 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div>
            <h1 className="text-4xl font-bold text-stone-900 mb-4">美食地圖</h1>
            <p className="text-stone-500">探索活動周邊的精選美食店家（點擊分類與行政區進行篩選）</p>
          </div>
          <button 
            onClick={handleRefresh}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-stone-200 rounded-xl text-stone-600 hover:text-orange-600 hover:border-orange-600 transition-all text-sm font-medium"
          >
            <RefreshCw className="w-4 h-4" /> 重新整理
          </button>
        </div>
        
        <div className="relative h-[600px] bg-white rounded-3xl shadow-sm border border-stone-200 overflow-hidden mb-8">
          {/* Full Background Map */}
          <div className="absolute inset-0 z-0">
            <Map
              defaultCenter={{ lat: 25.0422, lng: 121.5435 }}
              defaultZoom={14}
              gestureHandling={'greedy'}
              disableDefaultUI={false}
              mapId={GOOGLE_MAPS_MAP_ID}
            >
              {filteredLocations.map((loc) => {
                const isEventParticipant = loc.location_events && loc.location_events.length > 0;
                const brand = (loc as any).brand;
                const pinColor = loc.category === 'BBQ' ? '#ef4444' : loc.category === 'Hotpot' ? '#f97316' : loc.category === 'Drink' ? '#06b6d4' : '#ea580c';
                return (
                  <AdvancedMarker
                    key={loc.id}
                    position={{ lat: loc.lat, lng: loc.lng }}
                    onClick={() => setSelectedShop(loc)}
                    zIndex={brand ? 15 : isEventParticipant ? 10 : 1}
                  >
                    {brand && brand.logo_url ? (
                      <div className="flex flex-col items-center">
                        <div className="w-10 h-10 rounded-full bg-white shadow-lg border-2 border-orange-500 overflow-hidden flex items-center justify-center">
                          <img src={brand.logo_url} alt={brand.name} className="w-8 h-8 rounded-full object-contain" referrerPolicy="no-referrer" />
                        </div>
                        <div className="w-0 h-0 border-l-[6px] border-r-[6px] border-t-[8px] border-l-transparent border-r-transparent border-t-orange-500 -mt-[1px]" />
                      </div>
                    ) : (
                      <Pin
                        background={pinColor}
                        glyphColor={'#fff'}
                        borderColor={isEventParticipant ? '#FFD700' : '#fff'}
                        scale={isEventParticipant ? 1.4 : 1.0}
                      />
                    )}
                  </AdvancedMarker>
                );
              })}
            </Map>
          </div>

          {/* Floating Info Panel */}
          <AnimatePresence>
            {selectedShop && (
              <motion.div
                initial={{ x: -400, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -400, opacity: 0 }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="absolute top-4 bottom-4 left-4 w-[calc(100%-32px)] sm:w-96 bg-white rounded-2xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col z-10"
              >
                <div className="relative h-48 bg-stone-100 shrink-0">
                  {selectedShop.image_url ? (
                  <SafeImage 
                    src={selectedShop.image_url} 
                    alt={selectedShop.name}
                    className="w-full h-full object-cover"
                  />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-stone-300">
                      <ImageIcon className="w-12 h-12" />
                    </div>
                  )}
                  <button 
                    onClick={() => setSelectedShop(null)}
                    className="absolute top-3 right-3 p-2 bg-white/90 backdrop-blur-md rounded-full text-stone-600 hover:text-stone-900 shadow-sm z-20"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <div className="absolute bottom-3 left-3 flex gap-2">
                    <span className={cn(
                      "px-3 py-1 rounded-full text-xs font-bold text-white shadow-sm",
                      selectedShop.category === 'BBQ' ? "bg-orange-600" : 
                      selectedShop.category === 'Hotpot' ? "bg-red-600" : 
                      selectedShop.category === 'Bento' ? "bg-emerald-600" : "bg-blue-600"
                    )}>
                      {selectedShop.category === 'BBQ' ? '燒肉' : 
                       selectedShop.category === 'Hotpot' ? '火鍋' : 
                       selectedShop.category === 'Bento' ? '便當' : 
                       selectedShop.category === 'Drink' ? '手搖' : selectedShop.category}
                    </span>
                    <span className="px-3 py-1 bg-white/90 backdrop-blur-md rounded-full text-xs font-bold text-stone-600 shadow-sm">
                      {selectedShop.city}{selectedShop.district}
                    </span>
                  </div>
                </div>

                <div className="p-6 flex-1 overflow-y-auto space-y-6 scrollbar-hide">
                  <div>
                    <h2 className="text-xl font-bold text-stone-900 mb-1 leading-tight">{selectedShop.name}</h2>
                    <div className="flex items-center gap-1 text-orange-500">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className={cn("w-3.5 h-3.5 fill-current", i >= (selectedShop.rating || 5) && "text-stone-200 fill-none")} />
                      ))}
                      <span className="text-xs font-medium ml-1 text-stone-500">{(selectedShop.rating || 5).toFixed(1)}</span>
                      {selectedShop.avg_price && (
                        <>
                          <span className="text-stone-300 mx-2">•</span>
                          <span className="text-xs font-medium text-stone-500">{selectedShop.avg_price}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-stone-50 rounded-lg shrink-0">
                        <MapPin className="w-4 h-4 text-stone-500" />
                      </div>
                      <div>
                        <p className="text-sm text-stone-600 leading-relaxed">{selectedShop.address}</p>
                        <a 
                          href={`https://www.google.com/maps/dir/?api=1&destination=${selectedShop.lat},${selectedShop.lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-orange-600 text-xs font-bold mt-2 inline-flex items-center gap-1 hover:underline"
                        >
                          開啟導航 <ChevronRight className="w-3 h-3" />
                        </a>
                      </div>
                    </div>

                    {selectedShop.phone && (
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-stone-50 rounded-lg shrink-0">
                          <Play className="w-4 h-4 text-stone-500 rotate-90" />
                        </div>
                        <a href={`tel:${selectedShop.phone}`} className="text-sm text-stone-600 hover:text-orange-600 transition-colors font-medium">
                          {selectedShop.phone}
                        </a>
                      </div>
                    )}

                    {selectedShop.business_hours && (
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-stone-50 rounded-lg shrink-0">
                          <Clock className="w-4 h-4 text-stone-500" />
                        </div>
                        <p className="text-sm text-stone-600 font-medium">
                          {selectedShop.business_hours}
                        </p>
                      </div>
                    )}
                  </div>

                  {selectedShop.description && (
                    <div className="pt-5 border-t border-stone-100">
                      <h4 className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-2">店家簡介</h4>
                      <p className="text-sm text-stone-600 leading-relaxed italic">
                        "{selectedShop.description}"
                      </p>
                    </div>
                  )}

                  {selectedShop.discount_info && (
                    <div className="pt-5 border-t border-stone-100">
                      <div className="bg-gradient-to-br from-orange-50 to-orange-100/50 rounded-2xl p-4 border border-orange-100">
                        <div className="flex items-center gap-2 text-orange-700 font-bold text-sm mb-1">
                          <Tag className="w-4 h-4" /> 祭典專屬折扣
                         </div>
                        <p className="text-xs text-orange-600 leading-relaxed">{selectedShop.discount_info}</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="p-4 bg-stone-50 border-t border-stone-100 shrink-0 space-y-3">
                  <div className="flex gap-3">
                    {selectedShop.booking_url && (
                      <button 
                        onClick={() => window.open(selectedShop.booking_url, '_blank')}
                        className="flex-1 py-3 bg-white border border-stone-200 text-stone-900 rounded-xl font-bold hover:bg-stone-50 transition-all flex items-center justify-center gap-2 text-sm"
                      >
                        <CalendarCheck className="w-4 h-4 text-orange-600" /> 訂位
                      </button>
                    )}
                    {selectedShop.order_url && (
                      <button 
                        onClick={() => window.open(selectedShop.order_url, '_blank')}
                        className="flex-1 py-3 bg-white border border-stone-200 text-stone-900 rounded-xl font-bold hover:bg-stone-50 transition-all flex items-center justify-center gap-2 text-sm"
                      >
                        <ShoppingBag className="w-4 h-4 text-orange-600" /> 線上點餐
                      </button>
                    )}
                  </div>
                  <button 
                    onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedShop.name + ' ' + selectedShop.address)}`, '_blank')}
                    className="w-full py-3 bg-stone-900 text-white rounded-xl font-bold hover:bg-stone-800 transition-all shadow-lg shadow-stone-200 flex items-center justify-center gap-2 text-sm"
                  >
                    <MapPin className="w-4 h-4" /> 查看 Google 評論
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Filters */}
        <div className="space-y-6 mb-12">
          {/* Event Filter Toggle */}
          <div className="flex items-center justify-between bg-orange-50 border border-orange-200 rounded-2xl px-5 py-4">
            <div>
              <h4 className="text-sm font-bold text-orange-900">只看活動參與店家</h4>
              <p className="text-xs text-orange-600 mt-0.5">顯示有參加燒肉祭、火鍋祭等活動的店家</p>
            </div>
            <button
              onClick={() => setFilterEventOnly(!filterEventOnly)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${filterEventOnly ? 'bg-orange-600' : 'bg-stone-300'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${filterEventOnly ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          {/* Category Filter */}
          <div>
            <h4 className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-4">種類篩選</h4>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {categories.map((cat) => (
                <button 
                  key={cat} 
                  onClick={() => setActiveCategory(cat)}
                  className={cn(
                    "p-4 rounded-2xl border transition-all text-center flex flex-col items-center justify-center gap-2",
                    activeCategory === cat 
                      ? "bg-orange-600 border-orange-600 text-white shadow-lg scale-105" 
                      : "bg-white border-stone-100 text-stone-700 hover:border-orange-200 hover:shadow-md"
                  )}
                >
                  <span className="text-2xl">
                    {cat === '全部' && '🍴'}
                    {cat === '燒肉' && '🔥'}
                    {cat === '火鍋' && '🍲'}
                    {cat === '便當' && '🍱'}
                    {cat === '手搖' && '🧋'}
                  </span>
                  <span className="font-bold text-sm">{cat}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Region Filter */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h4 className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-4">縣市篩選</h4>
              <div className="flex flex-wrap gap-2">
                {cities.map((city) => (
                  <button
                    key={city}
                    onClick={() => {
                      setActiveCity(city);
                      setActiveDistrict('全部');
                    }}
                    className={cn(
                      "px-4 py-1.5 rounded-full border text-xs font-bold transition-all",
                      activeCity === city
                        ? "bg-stone-900 border-stone-900 text-white shadow-md"
                        : "bg-white border-stone-200 text-stone-600 hover:border-stone-400"
                    )}
                  >
                    {city}
                  </button>
                ))}
              </div>
            </div>

            {activeCity !== '全部' && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
              >
                <h4 className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-4">{activeCity} 行政區</h4>
                <div className="flex flex-wrap gap-2">
                  {districts.map((dist) => (
                    <button
                      key={dist}
                      onClick={() => setActiveDistrict(dist)}
                      className={cn(
                        "px-4 py-1.5 rounded-full border text-xs font-bold transition-all",
                        activeDistrict === dist
                          ? "bg-orange-600 border-orange-600 text-white shadow-md"
                          : "bg-white border-stone-200 text-stone-600 hover:border-orange-400"
                      )}
                    >
                      {dist}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </div>
        </div>

        {/* Shop List */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-2xl font-bold text-stone-900">店家清單 ({filteredLocations.length})</h3>
            <div className="text-sm text-stone-500">
              顯示：{activeCategory} • {activeCity}{activeDistrict !== '全部' ? ` • ${activeDistrict}` : ''}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {loadingLocations ? (
              Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
            ) : filteredLocations.map((loc) => (
              <motion.div
                key={loc.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-3xl border border-stone-100 overflow-hidden shadow-sm hover:shadow-md transition-all group cursor-pointer"
                onClick={() => {
                  setSelectedShop(loc);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              >
                <div className="relative h-48 overflow-hidden">
                  {loc.image_url ? (
                  <SafeImage
                    src={loc.image_url}
                    alt={loc.name}
                    width={400}
                    className="w-full h-full object-cover object-center group-hover:scale-110 transition-transform duration-500"
                  />
                  ) : (
                    <div className="w-full h-full bg-stone-50 flex items-center justify-center text-stone-200">
                      <ImageIcon className="w-12 h-12" />
                    </div>
                  )}
                  <div className="absolute top-4 left-4 flex flex-col gap-1">
                    <span className={cn(
                      "px-3 py-1 rounded-full text-[10px] font-bold text-white shadow-lg",
                      loc.category === 'BBQ' ? "bg-orange-600" : 
                      loc.category === 'Hotpot' ? "bg-red-600" : 
                      loc.category === 'Bento' ? "bg-emerald-600" : "bg-blue-600"
                    )}>
                      {loc.category === 'BBQ' ? '燒肉' : 
                       loc.category === 'Hotpot' ? '火鍋' : 
                       loc.category === 'Bento' ? '便當' : 
                       loc.category === 'Drink' ? '手搖' : loc.category}
                    </span>
                    {loc.location_events?.map((le: any) => le.events).filter(Boolean).map((ev: any) => (
                      <span key={ev.id} className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-yellow-400 text-yellow-900 shadow-lg flex items-center gap-1">
                        ⭐ {ev.title}
                      </span>
                    ))}
                  </div>
                  <div className="absolute top-4 right-4">
                    <span className="px-3 py-1 bg-white/90 backdrop-blur-md rounded-full text-[10px] font-bold text-stone-600 shadow-sm">
                      {loc.city}{loc.district}
                    </span>
                  </div>
                </div>
                <div className="p-6">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="text-lg font-bold text-stone-900 group-hover:text-orange-600 transition-colors">{loc.name}</h4>
                    <div className="flex items-center gap-1 text-orange-500">
                      <Star className="w-3 h-3 fill-current" />
                      <span className="text-xs font-bold">{(loc.rating || 5).toFixed(1)}</span>
                    </div>
                  </div>
                  {(loc as any).brand && (
                    <div className="flex items-center gap-1.5 mb-2">
                      {(loc as any).brand.logo_url && (
                        <SafeImage src={(loc as any).brand.logo_url} alt={(loc as any).brand.name}
                          className="w-4 h-4 rounded-full object-cover" fallback={DEFAULT_LOGO} />
                      )}
                      <span className="text-xs font-bold text-orange-600">{(loc as any).brand.name}</span>
                    </div>
                  )}
                  <p className="text-xs text-stone-500 flex items-center gap-1 mb-4">
                    <MapPin className="w-3 h-3" /> {loc.address}
                  </p>
                  <div className="flex items-center justify-between pt-4 border-t border-stone-50">
                    <span className="text-xs font-medium text-stone-400">{loc.avg_price || '價格未提供'}</span>
                    <span className="text-orange-600 text-xs font-bold inline-flex items-center gap-1">
                      查看詳情 <ChevronRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {filteredLocations.length === 0 && (
            <div className="py-20 text-center bg-white rounded-3xl border border-dashed border-stone-200">
              <div className="text-4xl mb-4">🔍</div>
              <h4 className="text-lg font-bold text-stone-900 mb-2">找不到符合條件的店家</h4>
              <p className="text-stone-500 text-sm mb-1">試試看其他的分類或區域組合吧！</p>
              <p className="text-stone-400 text-xs">提示：若您是管理員，請確保已在後台更新店家的「縣市」與「行政區」資訊。</p>
              <button 
                onClick={() => { setActiveCategory('全部'); setActiveCity('全部'); setActiveDistrict('全部'); }}
                className="mt-6 px-6 py-2 bg-stone-900 text-white rounded-xl text-sm font-bold hover:bg-stone-800 transition-all"
              >
                重設所有篩選
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const PartnersPage = () => {
  const [partners, setPartners] = useState<Partner[]>([]);

  useEffect(() => {
    const fetchPartners = async () => {
      const { data } = await supabase.from('partners').select('*').order('sort_order', { ascending: true });
      if (data) setPartners(data);
    };
    fetchPartners();
  }, []);

  return (
    <div className="pt-24 min-h-screen bg-stone-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-12 text-center">
          <h1 className="text-4xl font-bold text-stone-900 mb-4">贊助夥伴</h1>
          <p className="text-stone-500 max-w-2xl mx-auto">感謝所有支持「食在力量俱樂部」的夥伴，因為有你們，美食的力量才能傳遞得更遠。</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {partners.length > 0 ? partners.map((partner) => (
            <Link 
              key={partner.id} 
              to={`/partner/${partner.id}`}
              className="bg-white p-8 rounded-3xl border border-stone-100 shadow-sm hover:shadow-md transition-all group block"
            >
              <SafeImage src={partner.logo_url} fallback={DEFAULT_LOGO} className="w-20 h-20 rounded-2xl object-contain mb-6 bg-stone-50" alt={partner.name} />
              <h3 className="text-xl font-bold mb-2 group-hover:text-orange-600 transition-colors">{partner.name}</h3>
              <p className="text-orange-600 text-sm font-medium mb-4">{partner.type}</p>
              <div className="text-stone-500 text-sm leading-relaxed line-clamp-3">
                <BlockRenderer content={partner.content} />
              </div>
              <div className="mt-6 pt-6 border-t border-stone-50 flex items-center justify-between">
                <span className="text-stone-400 text-xs font-medium">查看完整介紹</span>
                <ChevronRight className="w-4 h-4 text-orange-600 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>
          )) : (
            <div className="col-span-3 text-center py-20 text-stone-400">
              目前尚無贊助夥伴資料
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const getEmbedUrl = (url: string) => {
  if (!url) return null;
  
  // YouTube
  const ytMatch = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`;
  
  // YouTube Shorts
  const shortsMatch = url.match(/youtube\.com\/shorts\/([^"&?\/\s]{11})/);
  if (shortsMatch) return `https://www.youtube.com/embed/${shortsMatch[1]}`;
  
  // TikTok
  const tiktokMatch = url.match(/tiktok\.com\/.*\/video\/(\d+)/);
  if (tiktokMatch) return `https://www.tiktok.com/embed/v2/${tiktokMatch[1]}`;
  
  // Instagram Reels
  const reelsMatch = url.match(/instagram\.com\/(?:reels|reel)\/([^\/?#&]+)/);
  if (reelsMatch) return `https://www.instagram.com/reels/${reelsMatch[1]}/embed`;
  
  return url;
};

const KOLReviewsPage = () => {
  const [reviews, setReviews] = useState<KOLReview[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<KOLReview | null>(null);

  useEffect(() => {
    const fetchReviews = async () => {
      const { data } = await supabase
        .from('kol_reviews')
        .select('*, brand:brands(name, logo_url)')
        .order('created_at', { ascending: false });
      if (data) setReviews(data as any);
    };
    fetchReviews();
  }, []);

  return (
    <div className="pt-24 min-h-screen bg-stone-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-12 text-center">
          <h1 className="text-4xl font-bold text-stone-900 mb-4">開箱分享</h1>
          <p className="text-stone-500 max-w-2xl mx-auto">跟著 KOL 的腳步，探索美食祭中最值得一試的美味亮點。</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {reviews.map((review) => (
            <motion.div 
              key={review.id}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-3xl overflow-hidden shadow-sm border border-stone-100 group"
            >
              <div 
                className="relative aspect-video bg-stone-200 cursor-pointer overflow-hidden"
                onClick={() => review.media_type === 'video' && setSelectedVideo(review)}
              >
                {review.media_type === 'video' ? (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <SafeImage src={review.media_url} className="w-full h-full object-cover opacity-80 group-hover:scale-105 transition-transform duration-500" alt={review.title} />
                    <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-all flex items-center justify-center">
                      <div className="w-16 h-16 bg-white/90 rounded-full flex items-center justify-center text-orange-600 shadow-xl transform group-hover:scale-110 transition-transform">
                        <Play className="w-8 h-8 fill-current" />
                      </div>
                    </div>
                  </div>
                ) : (
                  <SafeImage src={review.media_url} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt={review.title} />
                )}
              </div>
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <SafeImage src={review.kol_avatar_url} fallback={DEFAULT_AVATAR} className="w-10 h-10 rounded-full object-cover" alt={review.kol_name} />
                    <span className="font-bold text-stone-800">{review.kol_name}</span>
                  </div>
                  {(review as any).brand && (
                    <div className="flex items-center gap-2 px-3 py-1 bg-stone-50 rounded-full">
                      <SafeImage src={(review as any).brand.logo_url} fallback={DEFAULT_LOGO} className="w-4 h-4 rounded-sm object-cover" alt={(review as any).brand.name} />
                      <span className="text-[10px] font-bold text-stone-500">{(review as any).brand.name}</span>
                    </div>
                  )}
                </div>
                <h3 className="text-xl font-bold mb-2 group-hover:text-orange-600 transition-colors">{review.title}</h3>
                <div className="text-stone-500 text-sm line-clamp-3 mb-4">
                  <BlockRenderer content={review.content} />
                </div>
                <div className="flex items-center justify-between text-xs text-stone-400">
                  <span className="flex items-center gap-1">
                    {review.media_type === 'video' ? <Play className="w-3 h-3" /> : <ImageIcon className="w-3 h-3" />}
                    {review.media_type === 'video' ? '影片分享' : '圖文分享'}
                  </span>
                  <span>{new Date(review.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Video Modal */}
      <AnimatePresence>
        {selectedVideo && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedVideo(null)}
              className="absolute inset-0 bg-stone-900/90 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className={cn(
                "relative w-full max-w-5xl bg-black rounded-3xl overflow-hidden shadow-2xl",
                selectedVideo.video_embed_url?.includes('tiktok') || 
                selectedVideo.video_embed_url?.includes('shorts') || 
                selectedVideo.video_embed_url?.includes('reels') 
                  ? "max-w-sm aspect-[9/16]" 
                  : "aspect-video"
              )}
            >
              <button 
                onClick={() => setSelectedVideo(null)}
                className="absolute top-4 right-4 z-10 p-2 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
              
              {selectedVideo.video_embed_url ? (
                <iframe 
                  src={getEmbedUrl(selectedVideo.video_embed_url) || ''}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white">
                  <p>未提供影片連結</p>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const PromotionsPage = () => {
  const [promotions, setPromotions] = useState<Promotion[]>([]);

  useEffect(() => {
    const fetchPromotions = async () => {
      const { data } = await supabase
        .from('promotions')
        .select('*, brand:brands(name, logo_url)')
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      if (data) setPromotions(data as any);
    };
    fetchPromotions();
  }, []);

  return (
    <div className="pt-24 min-h-screen bg-stone-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-12 text-center">
          <h1 className="text-4xl font-bold text-stone-900 mb-4">優惠資訊</h1>
          <p className="text-stone-500 max-w-2xl mx-auto">蒐羅各大品牌最殺優惠，美食祭讓你吃得開心又省荷包。</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {promotions.map((promo) => (
            <motion.div 
              key={promo.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              className="bg-white rounded-3xl overflow-hidden shadow-sm border border-stone-100 flex flex-col"
            >
              <div className="relative h-48">
                <SafeImage src={promo.image_url} className="w-full h-full object-contain bg-stone-50" alt={promo.title} />
                <div className="absolute top-4 left-4 bg-orange-600 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 shadow-lg">
                  <Tag className="w-3 h-3" /> 限時優惠
                </div>
              </div>
              <div className="p-6 flex-grow flex flex-col">
                <div className="flex items-center gap-3 mb-4">
                  <SafeImage src={promo.brand?.logo_url} fallback={DEFAULT_LOGO} className="w-8 h-8 rounded-full object-cover bg-stone-50" alt={promo.brand?.name} />
                  <span className="text-sm font-bold text-stone-600">{promo.brand?.name}</span>
                </div>
                <h3 className="text-xl font-bold mb-2 text-stone-900">{promo.title}</h3>
                <p className="text-stone-500 text-sm mb-6 flex-grow">{promo.description}</p>
                
                {promo.discount_code && (
                  <div className="bg-orange-50 border border-orange-100 rounded-2xl p-4 mb-6 flex items-center justify-between group cursor-pointer hover:bg-orange-100 transition-colors">
                    <div>
                      <p className="text-[10px] text-orange-600 font-bold uppercase tracking-wider mb-1">折扣碼</p>
                      <p className="font-mono font-bold text-lg text-stone-800">{promo.discount_code}</p>
                    </div>
                    <button className="bg-white text-orange-600 p-2 rounded-xl shadow-sm group-hover:scale-110 transition-transform">
                      <Ticket className="w-5 h-5" />
                    </button>
                  </div>
                )}

                <div className="flex items-center justify-between text-xs text-stone-400 mt-auto pt-4 border-t border-stone-50">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> {promo.start_date} ~ {promo.end_date}
                  </span>
                  <button className="text-orange-600 font-bold hover:underline">立即領取</button>
                </div>
              </div>
            </motion.div>
          ))}
          {promotions.length === 0 && (
            <div className="col-span-3 py-20 text-center text-stone-400">
              目前尚無優惠資訊
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// --- Place Autocomplete Component ---

interface PlaceAutocompleteProps {
  onPlaceSelect: (place: google.maps.places.PlaceResult) => void;
}

const PlaceAutocomplete = ({ onPlaceSelect }: PlaceAutocompleteProps) => {
  const [placeAutocomplete, setPlaceAutocomplete] = useState<google.maps.places.Autocomplete | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const places = useMapsLibrary('places');

  useEffect(() => {
    if (!places || !inputRef.current) return;

    const options = {
      fields: ['geometry', 'name', 'formatted_address', 'address_components', 'international_phone_number', 'rating', 'photos', 'editorial_summary', 'opening_hours', 'price_level', 'website', 'url'],
    };

    setPlaceAutocomplete(new places.Autocomplete(inputRef.current, options));
  }, [places]);

  useEffect(() => {
    if (!placeAutocomplete) return;

    placeAutocomplete.addListener('place_changed', () => {
      onPlaceSelect(placeAutocomplete.getPlace());
    });
  }, [onPlaceSelect, placeAutocomplete]);

  return (
    <div className="relative">
      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
      <input
        ref={inputRef}
        placeholder="搜尋 Google 地圖上的店家..."
        className="w-full pl-10 pr-4 py-3 rounded-xl border border-stone-200 outline-none focus:ring-2 focus:ring-orange-600"
      />
    </div>
  );
};

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState<'events' | 'brands' | 'partners' | 'locations' | 'kol_reviews' | 'promotions'>('events');
  const [events, setEvents] = useState<Event[]>([]);
  const [allEvents, setAllEvents] = useState<Event[]>([]);
  const [allBrands, setAllBrands] = useState<Brand[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [kolReviews, setKolReviews] = useState<KOLReview[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  
  const [showEventModal, setShowEventModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  
  const [showBrandModal, setShowBrandModal] = useState(false);
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null);
  
  const [showPartnerModal, setShowPartnerModal] = useState(false);
  const [editingPartner, setEditingPartner] = useState<Partner | null>(null);
  
  const [showKOLModal, setShowKOLModal] = useState(false);
  const [editingKOL, setEditingKOL] = useState<KOLReview | null>(null);
  
  const [showPromotionModal, setShowPromotionModal] = useState(false);
  const [editingPromotion, setEditingPromotion] = useState<Promotion | null>(null);

  const [showLocationModal, setShowLocationModal] = useState(false);
  // 品牌分店管理 modal
  const [showBrandLocationsModal, setShowBrandLocationsModal] = useState(false);
  const [managingBrand, setManagingBrand] = useState<Brand | null>(null);
  const [brandLinkedLocationIds, setBrandLinkedLocationIds] = useState<string[]>([]);
  const [brandLocationSearch, setBrandLocationSearch] = useState('');
  const [savingBrandLocations, setSavingBrandLocations] = useState(false);

  // 活動店家管理 modal
  const [showEventLocationsModal, setShowEventLocationsModal] = useState(false);
  const [managingEvent, setManagingEvent] = useState<Event | null>(null);
  const [eventLinkedLocationIds, setEventLinkedLocationIds] = useState<string[]>([]);
  const [locationModalSearch, setLocationModalSearch] = useState('');
  const [savingEventLocations, setSavingEventLocations] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [bulkImportText, setBulkImportText] = useState('');
  const [bulkImportProgress, setBulkImportProgress] = useState<{ done: number; total: number; status: string; results: { name: string; ok: boolean; msg: string }[] } | null>(null);
  const [bulkImportRunning, setBulkImportRunning] = useState(false);
  const [locationSearchQuery, setLocationSearchQuery] = useState('');
  const [locationSortOrder, setLocationSortOrder] = useState<'name' | 'category' | 'city'>('name');

  const filteredAndSortedLocations = useMemo(() => {
    return locations
      .filter(loc => 
        loc.name.toLowerCase().includes(locationSearchQuery.toLowerCase()) ||
        loc.address.toLowerCase().includes(locationSearchQuery.toLowerCase()) ||
        (loc.city + (loc.district || '')).toLowerCase().includes(locationSearchQuery.toLowerCase())
      )
      .sort((a, b) => {
        if (locationSortOrder === 'name') {
          return a.name.localeCompare(b.name, 'zh-Hant');
        } else if (locationSortOrder === 'category') {
          return a.category.localeCompare(b.category);
        } else if (locationSortOrder === 'city') {
          const cityA = (a.city || '') + (a.district || '');
          const cityB = (b.city || '') + (b.district || '');
          return cityA.localeCompare(cityB, 'zh-Hant');
        }
        return 0;
      });
  }, [locations, locationSearchQuery, locationSortOrder]);

  const [locationName, setLocationName] = useState('');
  const [locationAddress, setLocationAddress] = useState('');
  const [locationLat, setLocationLat] = useState<number | string>('');
  const [locationLng, setLocationLng] = useState<number | string>('');
  const [locationCategory, setLocationCategory] = useState<'BBQ' | 'Hotpot' | 'Bento' | 'Drink'>('BBQ');
  const [locationCity, setLocationCity] = useState('');
  const [locationDistrict, setLocationDistrict] = useState('');
  const [locationPhone, setLocationPhone] = useState('');
  const [locationImageUrl, setLocationImageUrl] = useState('');
  const [locationDescription, setLocationDescription] = useState('');
  const [locationDiscount, setLocationDiscount] = useState('');
  const [locationRating, setLocationRating] = useState(5);
  const [locationBookingUrl, setLocationBookingUrl] = useState('');
  const [locationOrderUrl, setLocationOrderUrl] = useState('');
  const [locationBusinessHours, setLocationBusinessHours] = useState('');
  const [locationAvgPrice, setLocationAvgPrice] = useState('');
  const [locationImageLoading, setLocationImageLoading] = useState(false);
  const [locationEventIds, setLocationEventIds] = useState<string[]>([]);

  const [imageUrl, setImageUrl] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  
  const navigate = useNavigate();

  const [editorContent, setEditorContent] = useState('');

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) navigate('/login');
    };
    checkAuth();
    fetchData();
    fetchAllEvents();
    fetchAllBrands();
  }, [activeTab]);

  const fetchAllEvents = async () => {
    const { data } = await supabase.from('events').select('id, title').order('created_at', { ascending: false });
    if (data) setAllEvents(data as any);
  };

  const fetchAllBrands = async () => {
    const { data } = await supabase.from('brands').select('id, name').order('name', { ascending: true });
    if (data) setAllBrands(data as any);
  };

  useEffect(() => {
    if (editingEvent) {
      setEditorContent(editingEvent.content || '');
      setImageUrl(editingEvent.image_url || '');
    } else if (editingBrand) {
      setEditorContent((editingBrand as any).content || '');
      setLogoUrl(editingBrand.logo_url || '');
    } else if (editingPartner) {
      setEditorContent(editingPartner.content || '');
      setLogoUrl(editingPartner.logo_url || '');
    } else if (editingKOL) {
      setEditorContent(editingKOL.content || '');
      setImageUrl(editingKOL.media_url || '');
      setAvatarUrl(editingKOL.kol_avatar_url || '');
    } else if (editingPromotion) {
      setImageUrl(editingPromotion.image_url || '');
    } else if (editingLocation) {
      setLocationName(editingLocation.name);
      setLocationAddress(editingLocation.address);
      setLocationLat(editingLocation.lat);
      setLocationLng(editingLocation.lng);
      setLocationCategory(editingLocation.category);
      setLocationCity(editingLocation.city || '');
      setLocationDistrict(editingLocation.district || '');
      setLocationPhone(editingLocation.phone || '');
      setLocationImageUrl(editingLocation.image_url || '');
      setLocationDescription(editingLocation.description || '');
      setLocationDiscount(editingLocation.discount_info || '');
      setLocationRating(editingLocation.rating || 5);
      setLocationBookingUrl(editingLocation.booking_url || '');
      setLocationOrderUrl(editingLocation.order_url || '');
      setLocationBusinessHours(editingLocation.business_hours || '');
      setLocationAvgPrice(editingLocation.avg_price || '');
      supabase.from('location_events').select('event_id').eq('location_id', editingLocation.id)
        .then(({ data }) => { setLocationEventIds(data?.map(r => r.event_id) || []); });
    } else {
      setEditorContent('');
      setImageUrl('');
      setAvatarUrl('');
      setLogoUrl('');
      setLocationName('');
      setLocationAddress('');
      setLocationLat('');
      setLocationLng('');
      setLocationCategory('BBQ');
      setLocationCity('');
      setLocationDistrict('');
      setLocationPhone('');
      setLocationImageUrl('');
      setLocationDescription('');
      setLocationDiscount('');
      setLocationRating(5);
      setLocationBookingUrl('');
      setLocationOrderUrl('');
      setLocationBusinessHours('');
      setLocationAvgPrice('');
    }
  }, [editingEvent, editingBrand, editingPartner, editingKOL, editingPromotion, editingLocation]);

  const fetchData = async () => {
    try {
      if (activeTab === 'events') {
        const { data, error } = await supabase.from('events').select('*');
        if (error) throw error;
        if (data) setEvents(data);
      } else if (activeTab === 'brands') {
        const { data, error } = await supabase.from('brands').select('*');
        if (error) throw error;
        if (data) setBrands(data as any);
      } else if (activeTab === 'partners') {
        const { data, error } = await supabase.from('partners').select('*').order('sort_order', { ascending: true });
        if (error) throw error;
        if (data) setPartners(data as any);
      } else if (activeTab === 'kol_reviews') {
        const { data, error } = await supabase.from('kol_reviews').select('*, brand:brands(name)');
        if (error) throw error;
        if (data) setKolReviews(data);

        const { data: brandsData } = await supabase.from('brands').select('id, name');
        if (brandsData) setBrands(brandsData as any);
      } else if (activeTab === 'promotions') {
        const { data, error } = await supabase.from('promotions').select('*, brand:brands(name)');
        if (error) throw error;
        if (data) setPromotions(data as any);
        
        // Also fetch brands for the selection dropdown
        const { data: brandsData } = await supabase.from('brands').select('id, name');
        if (brandsData) setBrands(brandsData as any);
      } else if (activeTab === 'locations') {
        console.log('Fetching locations...');
        const { data, error } = await supabase.from('locations').select('*');
        if (error) throw error;
        console.log('Fetched locations:', data);
        if (data) setLocations(data as any);
      }
    } catch (error: any) {
      console.error(`讀取 ${activeTab} 資料失敗:`, error);
      alert(`讀取資料失敗: ${error.message || '未知錯誤'}`);
    }
  };

  const handleSaveEvent = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const eventData = {
      title: formData.get('title') as string,
      description: formData.get('description') as string,
      long_description: formData.get('long_description') as string,
      content: editorContent,
      start_date: formData.get('start_date') as string,
      end_date: formData.get('end_date') as string,
      type: formData.get('type') as 'current' | 'past',
      image_url: imageUrl,
      video_url: formData.get('video_url') as string,
    };

    let error;
    if (editingEvent) {
      const result = await supabase.from('events').update(eventData).eq('id', editingEvent.id);
      error = result.error;
    } else {
      const result = await supabase.from('events').insert([eventData]);
      error = result.error;
    }
    
    if (error) {
      alert(`儲存失敗: ${error.message}`);
      return;
    }
    
    setShowEventModal(false);
    setEditingEvent(null);
    setEditorContent('');
    setImageUrl('');
    fetchData();
  };

  const handleSaveBrand = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const brandData = {
      name: formData.get('name') as string,
      event_id: formData.get('event_id') as string,
      category: formData.get('category') as string,
      description: formData.get('description') as string,
      promotion_info: formData.get('promotion_info') as string,
      logo_url: logoUrl,
      content: editorContent,
    };

    let error;
    if (editingBrand) {
      const result = await supabase.from('brands').update(brandData).eq('id', editingBrand.id);
      error = result.error;
    } else {
      const result = await supabase.from('brands').insert([brandData]);
      error = result.error;
    }
    
    if (error) {
      alert(`儲存失敗: ${error.message}`);
      return;
    }
    
    setShowBrandModal(false);
    setEditingBrand(null);
    setEditorContent('');
    setLogoUrl('');
    fetchData();
  };

  const handleSavePartner = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const partnerData = {
      name: formData.get('name') as string,
      event_id: formData.get('event_id') as string,
      type: formData.get('type') as string,
      sort_order: parseInt(formData.get('sort_order') as string) || 0,
      logo_url: logoUrl,
      content: editorContent,
    };

    let error;
    if (editingPartner) {
      const result = await supabase.from('partners').update(partnerData).eq('id', editingPartner.id);
      error = result.error;
    } else {
      const result = await supabase.from('partners').insert([partnerData]);
      error = result.error;
    }
    
    if (error) {
      alert(`儲存失敗: ${error.message}`);
      return;
    }
    
    setShowPartnerModal(false);
    setEditingPartner(null);
    setEditorContent('');
    setLogoUrl('');
    fetchData();
  };

  const handleSaveKOL = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const kolData = {
      title: formData.get('title') as string,
      brand_id: formData.get('brand_id') as string,
      kol_name: formData.get('kol_name') as string,
      kol_avatar_url: avatarUrl,
      media_type: formData.get('media_type') as string,
      media_url: imageUrl,
      video_embed_url: formData.get('video_embed_url') as string,
      content: editorContent,
    };

    let error;
    if (editingKOL) {
      const result = await supabase.from('kol_reviews').update(kolData).eq('id', editingKOL.id);
      error = result.error;
    } else {
      const result = await supabase.from('kol_reviews').insert([kolData]);
      error = result.error;
    }
    
    if (error) {
      alert(`儲存失敗: ${error.message}`);
      return;
    }
    
    setShowKOLModal(false);
    setEditingKOL(null);
    setEditorContent('');
    setImageUrl('');
    setAvatarUrl('');
    fetchData();
  };

  const handleSavePromotion = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const promoData = {
      title: formData.get('title') as string,
      brand_id: formData.get('brand_id') as string,
      description: formData.get('description') as string,
      discount_code: formData.get('discount_code') as string,
      start_date: formData.get('start_date') as string,
      end_date: formData.get('end_date') as string,
      image_url: imageUrl,
      is_active: formData.get('is_active') === 'true',
    };

    let error;
    if (editingPromotion) {
      const result = await supabase.from('promotions').update(promoData).eq('id', editingPromotion.id);
      error = result.error;
    } else {
      const result = await supabase.from('promotions').insert([promoData]);
      error = result.error;
    }
    
    if (error) {
      alert(`儲存失敗: ${error.message}`);
      return;
    }
    
    setShowPromotionModal(false);
    setEditingPromotion(null);
    setImageUrl('');
    fetchData();
  };

  const handleDeleteEvent = async (id: string) => {
    if (window.confirm('確定要刪除此活動嗎？')) {
      const { error } = await supabase.from('events').delete().eq('id', id);
      if (error) {
        alert(`刪除失敗: ${error.message}`);
      } else {
        fetchData();
      }
    }
  };

  const handleDeleteBrand = async (id: string) => {
    if (window.confirm('確定要刪除此品牌嗎？')) {
      const { error } = await supabase.from('brands').delete().eq('id', id);
      if (error) alert(`刪除失敗: ${error.message}`);
      else fetchData();
    }
  };

  const handleDeletePartner = async (id: string) => {
    if (window.confirm('確定要刪除此贊助夥伴嗎？')) {
      const { error } = await supabase.from('partners').delete().eq('id', id);
      if (error) alert(`刪除失敗: ${error.message}`);
      else fetchData();
    }
  };

  const handleDeleteKOL = async (id: string) => {
    if (window.confirm('確定要刪除此開箱分享嗎？')) {
      const { error } = await supabase.from('kol_reviews').delete().eq('id', id);
      if (error) alert(`刪除失敗: ${error.message}`);
      else fetchData();
    }
  };

  const handleDeletePromotion = async (id: string) => {
    if (window.confirm('確定要刪除此優惠資訊嗎？')) {
      const { error } = await supabase.from('promotions').delete().eq('id', id);
      if (error) alert(`刪除失敗: ${error.message}`);
      else fetchData();
    }
  };

  const handleOpenBrandLocations = async (brand: Brand) => {
    setManagingBrand(brand);
    setBrandLocationSearch('');
    // 載入這個品牌已有的分店
    const { data } = await supabase.from('locations').select('id').eq('brand_id', brand.id);
    setBrandLinkedLocationIds(data?.map(r => r.id) || []);
    // 確保 locations 已載入
    if (locations.length === 0) {
      const { data: locs } = await supabase.from('locations').select('id, name, category, city, district, brand_id');
      if (locs) setLocations(locs as any);
    }
    setShowBrandLocationsModal(true);
  };

  const handleSaveBrandLocations = async () => {
    if (!managingBrand) return;
    setSavingBrandLocations(true);
    try {
      // 先把之前此品牌的所有分店清除綁定
      await supabase.from('locations').update({ brand_id: null }).eq('brand_id', managingBrand.id);
      // 重新綁定選取的分店
      if (brandLinkedLocationIds.length > 0) {
        await supabase.from('locations').update({ brand_id: managingBrand.id }).in('id', brandLinkedLocationIds);
      }
      setShowBrandLocationsModal(false);
      setManagingBrand(null);
    } catch (e) {
      alert('儲存失敗');
    } finally {
      setSavingBrandLocations(false);
    }
  };

  const handleOpenEventLocations = async (event: Event) => {
    setManagingEvent(event);
    setLocationModalSearch('');
    // 載入這個活動已綁定的店家
    const { data } = await supabase.from('location_events').select('location_id').eq('event_id', event.id);
    setEventLinkedLocationIds(data?.map(r => r.location_id) || []);
    // 確保 locations 已載入
    if (locations.length === 0) {
      const { data: locs } = await supabase.from('locations').select('id, name, category, city, district');
      if (locs) setLocations(locs as any);
    }
    setShowEventLocationsModal(true);
  };

  const handleSaveEventLocations = async () => {
    if (!managingEvent) return;
    setSavingEventLocations(true);
    try {
      // 刪掉舊的，重新建立
      await supabase.from('location_events').delete().eq('event_id', managingEvent.id);
      if (eventLinkedLocationIds.length > 0) {
        await supabase.from('location_events').insert(
          eventLinkedLocationIds.map(lid => ({ location_id: lid, event_id: managingEvent.id }))
        );
      }
      setShowEventLocationsModal(false);
      setManagingEvent(null);
    } catch (e) {
      alert('儲存失敗');
    } finally {
      setSavingEventLocations(false);
    }
  };

  const handleBulkImport = async () => {
    const lines = bulkImportText.split(/\r?\n/).map((l: string) => l.trim()).filter(Boolean);
    if (!lines.length) return;
    setBulkImportRunning(true);
    setBulkImportProgress({ done: 0, total: lines.length, status: '準備中...', results: [] });

    let _r=0;
    while(!window.google?.maps?.places?.PlacesService&&_r<20){await new Promise(x=>setTimeout(x,500));_r++;}
    if(!window.google?.maps?.places?.PlacesService){alert('請重新整理頁面後再試');setBulkImportRunning(false);return;}
    const mapDiv = document.createElement('div');
    document.body.appendChild(mapDiv);
    const map = new google.maps.Map(mapDiv, { center: { lat: 25.04, lng: 121.54 }, zoom: 14 });
    const svc = new google.maps.places.PlacesService(map);

    const results: { name: string; ok: boolean; msg: string }[] = [];
    // 追蹤本次批次已匯入的店家（避免同批次重複）
    const batchImported: { name: string; lat: number; lng: number }[] = [];

    for (let i = 0; i < lines.length; i++) {
      const query = lines[i];
      setBulkImportProgress({ done: i, total: lines.length, status: `搜尋中：${query}`, results: [...results] });

      try {
        const placeResult = await new Promise<google.maps.places.PlaceResult | null>((resolve) => {
          svc.textSearch({ query, language: 'zh-TW' }, (res, status) => {
            resolve(status === 'OK' && res?.length ? res[0] : null);
          });
        });

        if (!placeResult) {
          results.push({ name: query, ok: false, msg: '找不到地點' });
          continue;
        }

        const placeName = placeResult.name || query;
        const placeLat = placeResult.geometry?.location?.lat() || 0;
        const placeLng = placeResult.geometry?.location?.lng() || 0;

        // 檢查是否與現有店家重複（名稱相同 或 經緯度 < 10 公尺）
        const existingDup = locations.find(loc => {
          if (loc.name === placeName) return true;
          const latDiff = Math.abs(loc.lat - placeLat);
          const lngDiff = Math.abs(loc.lng - placeLng);
          return latDiff < 0.0001 && lngDiff < 0.0001;
        });

        if (existingDup) {
          results.push({ name: placeName, ok: false, msg: `⚠️ 已存在：「${existingDup.name}」，跳過` });
          continue;
        }

        // 檢查是否與本次批次內已匯入的重複
        const batchDup = batchImported.find(b => {
          if (b.name === placeName) return true;
          const latDiff = Math.abs(b.lat - placeLat);
          const lngDiff = Math.abs(b.lng - placeLng);
          return latDiff < 0.0001 && lngDiff < 0.0001;
        });

        if (batchDup) {
          results.push({ name: placeName, ok: false, msg: `⚠️ 本次批次已匯入「${batchDup.name}」，跳過` });
          continue;
        }

        // 取得照片
        let imageUrl = '';
        if (placeResult.photos?.length) {
          const photoUrl = placeResult.photos[0].getUrl({ maxWidth: 1000 });
          try {
            const pr = await fetch(`https://${import.meta.env.VITE_SUPABASE_URL?.replace('https://', '')}/functions/v1/proxy-place-photo`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ photo_url: photoUrl })
            });
            const pd = await pr.json();
            if (pd.url) imageUrl = pd.url;
          } catch { imageUrl = ''; }
        }

        // 解析縣市
        let city = '', district = '';
        const addr = placeResult.formatted_address || '';
        const comps = placeResult.address_components || [];
        const cityComp = comps.find((c: any) => c.types.includes('administrative_area_level_1'));
        const distComp = comps.find((c: any) => c.types.includes('sublocality_level_1') || c.types.includes('locality'));
        if (cityComp) city = cityComp.long_name.replace(/台/g, '臺');
        if (distComp && distComp.long_name !== cityComp?.long_name) district = distComp.long_name.replace(/台/g, '臺');

        const matchedCity = Object.keys(TAIWAN_DISTRICTS).find(k => city.includes(k.replace(/[市縣]/g, '')) || addr.includes(k)) || '';
        const matchedDist = matchedCity ? (TAIWAN_DISTRICTS[matchedCity].find(d => district.includes(d.replace(/[區鄉鎮市]/g, '')) || addr.includes(d)) || '') : '';

        const locData = {
          name: placeName,
          category: locationCategory,
          city: matchedCity,
          district: matchedDist,
          address: addr,
          lat: placeLat,
          lng: placeLng,
          phone: (placeResult as any).international_phone_number || '',
          image_url: imageUrl,
          description: (placeResult as any).editorial_summary?.overview || '',
          rating: placeResult.rating || 5,
          avg_price: '',
          booking_url: (placeResult as any).website || '',
          order_url: '',
          business_hours: '',
          discount_info: '',
        };

        const { error } = await supabase.from('locations').insert([locData]);
        if (error) { results.push({ name: locData.name, ok: false, msg: `❌ ${error.message}` }); }
        else {
          results.push({ name: locData.name, ok: true, msg: '✅ 已新增' });
          batchImported.push({ name: locData.name, lat: locData.lat, lng: locData.lng });
        }

      } catch (e: any) {
        results.push({ name: query, ok: false, msg: `❌ ${e.message}` });
      }

      await new Promise(r => setTimeout(r, 600));
    }

    document.body.removeChild(mapDiv);
    setBulkImportProgress({ done: lines.length, total: lines.length, status: '完成！', results });
    setBulkImportRunning(false);
    fetchData();
  };

  const handleSaveLocation = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    const lat = typeof locationLat === 'string' ? parseFloat(locationLat) : locationLat;
    const lng = typeof locationLng === 'string' ? parseFloat(locationLng) : locationLng;

    if (!locationName.trim()) {
      alert('請輸入店名');
      return;
    }

    if (isNaN(lat as number) || isNaN(lng as number)) {
      alert('請選擇有效的地點或輸入正確的經緯度');
      return;
    }

    const locationData = {
      name: locationName,
      category: locationCategory,
      city: locationCity,
      district: locationDistrict,
      address: locationAddress,
      lat: lat,
      lng: lng,
      phone: locationPhone,
      image_url: locationImageUrl,
      description: locationDescription,
      discount_info: locationDiscount,
      rating: locationRating,
      booking_url: locationBookingUrl,
      order_url: locationOrderUrl,
      business_hours: locationBusinessHours,
      avg_price: locationAvgPrice,
    };

    // Check for duplicates (name+address or nearby coordinates)
    const duplicateLoc = locations.find(loc => {
      if (loc.id === editingLocation?.id) return false;
      // 名稱 + 地址完全相同
      if (loc.name === locationName && loc.address === locationAddress) return true;
      // 經緯度差距 < 0.0001（約 10 公尺內）視為同一地點
      const latDiff = Math.abs(loc.lat - locationData.lat);
      const lngDiff = Math.abs(loc.lng - locationData.lng);
      if (latDiff < 0.0001 && lngDiff < 0.0001) return true;
      return false;
    });

    if (duplicateLoc) {
      alert(`該店家可能已存在：「${duplicateLoc.name}」(${duplicateLoc.address})\n\n請確認是否為同一間店。`);
      return;
    }

    console.log('Saving location data:', locationData);

    let error;
    if (editingLocation) {
      const result = await supabase.from('locations').update(locationData).eq('id', editingLocation.id);
      error = result.error;
    } else {
      const result = await supabase.from('locations').insert([locationData]);
      error = result.error;
    }
    
    if (error) {
      console.error('Save location error:', error);
      if (error.message.includes('column') || error.message.includes('schema cache')) {
        alert(`儲存失敗：資料庫缺少必要欄位。\n\n請至 Supabase SQL Editor 執行以下指令：\n\nALTER TABLE locations \nADD COLUMN IF NOT EXISTS avg_price TEXT, \nADD COLUMN IF NOT EXISTS booking_url TEXT, \nADD COLUMN IF NOT EXISTS order_url TEXT, \nADD COLUMN IF NOT EXISTS business_hours TEXT;`);
      } else {
        alert(`儲存失敗: ${error.message}`);
      }
      return;
    }
    
    console.log('Location saved successfully');
    const savedId = editingLocation?.id;
    if (savedId) {
      await supabase.from('location_events').delete().eq('location_id', savedId);
      if (locationEventIds.length > 0) {
        await supabase.from('location_events').insert(
          locationEventIds.map(eid => ({ location_id: savedId, event_id: eid }))
        );
      }
    }
    setShowLocationModal(false);
    setEditingLocation(null);
    setLocationEventIds([]);
    fetchData();
  };

  const handleDeleteLocation = async (id: string) => {
    if (window.confirm('確定要刪除此地點嗎？')) {
      const { error } = await supabase.from('locations').delete().eq('id', id);
      if (error) alert(`刪除失敗: ${error.message}`);
      else fetchData();
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  return (
    <div className="pt-24 min-h-screen bg-stone-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-stone-900">管理中心</h1>
            <p className="text-stone-500">管理您的美食祭活動與資料</p>
          </div>
          <button onClick={handleLogout} className="flex items-center gap-2 text-stone-600 hover:text-red-600 font-medium">
            <LogOut className="w-4 h-4" /> 登出
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="md:col-span-1 space-y-2">
            <button 
              onClick={() => setActiveTab('events')}
              className={cn(
                "w-full text-left px-4 py-3 rounded-xl font-medium transition-all",
                activeTab === 'events' ? "bg-orange-600 text-white shadow-lg" : "text-stone-600 hover:bg-stone-200"
              )}
            >
              活動管理
            </button>
            <button 
              onClick={() => setActiveTab('kol_reviews')}
              className={cn(
                "w-full text-left px-4 py-3 rounded-xl font-medium transition-all",
                activeTab === 'kol_reviews' ? "bg-orange-600 text-white shadow-lg" : "text-stone-600 hover:bg-stone-200"
              )}
            >
              開箱管理
            </button>
            <button 
              onClick={() => setActiveTab('promotions')}
              className={cn(
                "w-full text-left px-4 py-3 rounded-xl font-medium transition-all",
                activeTab === 'promotions' ? "bg-orange-600 text-white shadow-lg" : "text-stone-600 hover:bg-stone-200"
              )}
            >
              優惠管理
            </button>
            <button 
              onClick={() => setActiveTab('brands')}
              className={cn(
                "w-full text-left px-4 py-3 rounded-xl font-medium transition-all",
                activeTab === 'brands' ? "bg-orange-600 text-white shadow-lg" : "text-stone-600 hover:bg-stone-200"
              )}
            >
              品牌管理
            </button>
            <button 
              onClick={() => setActiveTab('partners')}
              className={cn(
                "w-full text-left px-4 py-3 rounded-xl font-medium transition-all",
                activeTab === 'partners' ? "bg-orange-600 text-white shadow-lg" : "text-stone-600 hover:bg-stone-200"
              )}
            >
              贊助管理
            </button>
            <button 
              onClick={() => setActiveTab('locations')}
              className={cn(
                "w-full text-left px-4 py-3 rounded-xl font-medium transition-all",
                activeTab === 'locations' ? "bg-orange-600 text-white shadow-lg" : "text-stone-600 hover:bg-stone-200"
              )}
            >
              地圖管理
            </button>
          </div>

          <div className="md:col-span-3 bg-white rounded-3xl p-8 border border-stone-200">
            {activeTab === 'events' && (
              <>
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold">活動列表</h2>
                  <button 
                    onClick={() => { setEditingEvent(null); setShowEventModal(true); }}
                    className="bg-stone-900 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" /> 新增活動
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-stone-100 text-stone-400 text-sm">
                        <th className="pb-4 font-medium">活動名稱</th>
                        <th className="pb-4 font-medium">類型</th>
                        <th className="pb-4 font-medium">日期</th>
                        <th className="pb-4 font-medium text-right">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-50">
                      {events.map(event => (
                        <tr key={event.id} className="group">
                          <td className="py-4 font-medium">{event.title}</td>
                          <td className="py-4">
                            <span className={cn(
                              "text-xs px-2 py-1 rounded-full",
                              event.type === 'current' ? "bg-green-50 text-green-600" : "bg-stone-100 text-stone-500"
                            )}>
                              {event.type === 'current' ? '進行中' : '已結束'}
                            </span>
                          </td>
                          <td className="py-4 text-sm text-stone-500">{event.start_date}</td>
                          <td className="py-4 text-right">
                            <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => handleOpenEventLocations(event)}
                                className="px-2 py-1 text-xs font-bold text-orange-600 hover:bg-orange-50 rounded-lg flex items-center gap-1 transition-colors"
                                title="管理活動店家"
                              >
                                <MapPin className="w-3 h-3" /> 店家
                              </button>
                              <button 
                                onClick={() => { setEditingEvent(event); setShowEventModal(true); }}
                                className="p-2 text-stone-400 hover:text-orange-600"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => handleDeleteEvent(event.id)}
                                className="p-2 text-stone-400 hover:text-red-600"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {activeTab === 'kol_reviews' && (
              <>
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold">開箱分享列表</h2>
                  <button 
                    onClick={() => { setEditingKOL(null); setShowKOLModal(true); }}
                    className="bg-stone-900 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" /> 新增開箱
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-stone-100 text-stone-400 text-sm">
                        <th className="pb-4 font-medium">標題</th>
                        <th className="pb-4 font-medium">KOL</th>
                        <th className="pb-4 font-medium">品牌</th>
                        <th className="pb-4 font-medium">類型</th>
                        <th className="pb-4 font-medium text-right">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-50">
                      {kolReviews.map(review => (
                        <tr key={review.id} className="group">
                          <td className="py-4 font-medium">{review.title}</td>
                          <td className="py-4 text-sm">{review.kol_name}</td>
                          <td className="py-4 text-sm">{(review as any).brand?.name || '-'}</td>
                          <td className="py-4">
                            <span className={cn(
                              "text-xs px-2 py-1 rounded-full flex items-center gap-1 w-fit",
                              review.media_type === 'video' ? "bg-purple-50 text-purple-600" : "bg-blue-50 text-blue-600"
                            )}>
                              {review.media_type === 'video' ? <Play className="w-3 h-3" /> : <ImageIcon className="w-3 h-3" />}
                              {review.media_type === 'video' ? '影片' : '圖文'}
                            </span>
                          </td>
                          <td className="py-4 text-right">
                            <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button 
                                onClick={() => { setEditingKOL(review); setShowKOLModal(true); }}
                                className="p-2 text-stone-400 hover:text-orange-600"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => handleDeleteKOL(review.id)}
                                className="p-2 text-stone-400 hover:text-red-600"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {kolReviews.length === 0 && (
                        <tr>
                          <td colSpan={4} className="py-12 text-center text-stone-400">目前尚無開箱資料</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {activeTab === 'brands' && (
              <>
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold">品牌列表</h2>
                  <button 
                    onClick={() => { setEditingBrand(null); setShowBrandModal(true); }}
                    className="bg-stone-900 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" /> 新增品牌
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-stone-100 text-stone-400 text-sm">
                        <th className="pb-4 font-medium">品牌名稱</th>
                        <th className="pb-4 font-medium text-right">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-50">
                      {brands.map(brand => (
                        <tr key={brand.id} className="group">
                          <td className="py-4 font-medium flex items-center gap-3">
                            <SafeImage src={brand.logo_url} className="w-8 h-8 rounded-full object-cover bg-stone-50" alt="" />
                            {brand.name}
                          </td>
                          <td className="py-4 text-right">
                            <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => handleOpenBrandLocations(brand)}
                                className="px-2 py-1 text-xs font-bold text-orange-600 hover:bg-orange-50 rounded-lg flex items-center gap-1 transition-colors"
                                title="管理品牌分店"
                              >
                                <MapPin className="w-3 h-3" /> 分店
                              </button>
                              <button 
                                onClick={() => { setEditingBrand(brand); setShowBrandModal(true); }}
                                className="p-2 text-stone-400 hover:text-orange-600"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => handleDeleteBrand(brand.id)}
                                className="p-2 text-stone-400 hover:text-red-600"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {brands.length === 0 && (
                        <tr>
                          <td colSpan={2} className="py-12 text-center text-stone-400">目前尚無品牌資料</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {activeTab === 'partners' && (
              <>
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold">贊助夥伴列表</h2>
                  <button 
                    onClick={() => { setEditingPartner(null); setShowPartnerModal(true); }}
                    className="bg-stone-900 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" /> 新增贊助
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-stone-100 text-stone-400 text-sm">
                        <th className="pb-4 font-medium">夥伴名稱</th>
                        <th className="pb-4 font-medium">類型</th>
                        <th className="pb-4 font-medium text-right">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-50">
                      {partners.map(partner => (
                        <tr key={partner.id} className="group">
                          <td className="py-4 font-medium flex items-center gap-3">
                            <SafeImage src={partner.logo_url} className="w-8 h-8 rounded-full object-contain bg-stone-50" alt="" />
                            {partner.name}
                          </td>
                          <td className="py-4 text-sm">{partner.type}</td>
                          <td className="py-4 text-right">
                            <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button 
                                onClick={() => { setEditingPartner(partner); setShowPartnerModal(true); }}
                                className="p-2 text-stone-400 hover:text-orange-600"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => handleDeletePartner(partner.id)}
                                className="p-2 text-stone-400 hover:text-red-600"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {partners.length === 0 && (
                        <tr>
                          <td colSpan={3} className="py-12 text-center text-stone-400">目前尚無贊助資料</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {activeTab === 'promotions' && (
              <>
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold">優惠資訊列表</h2>
                  <button 
                    onClick={() => { setEditingPromotion(null); setShowPromotionModal(true); }}
                    className="bg-stone-900 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" /> 新增優惠
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-stone-100 text-stone-400 text-sm">
                        <th className="pb-4 font-medium">標題</th>
                        <th className="pb-4 font-medium">品牌</th>
                        <th className="pb-4 font-medium">狀態</th>
                        <th className="pb-4 font-medium text-right">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-50">
                      {promotions.map(promo => (
                        <tr key={promo.id} className="group">
                          <td className="py-4 font-medium">{promo.title}</td>
                          <td className="py-4 text-sm">{promo.brand?.name}</td>
                          <td className="py-4">
                            <span className={cn(
                              "text-xs px-2 py-1 rounded-full",
                              promo.is_active ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"
                            )}>
                              {promo.is_active ? '啟用中' : '已停用'}
                            </span>
                          </td>
                          <td className="py-4 text-right">
                            <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button 
                                onClick={() => { setEditingPromotion(promo); setShowPromotionModal(true); }}
                                className="p-2 text-stone-400 hover:text-orange-600"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => handleDeletePromotion(promo.id)}
                                className="p-2 text-stone-400 hover:text-red-600"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {promotions.length === 0 && (
                        <tr>
                          <td colSpan={4} className="py-12 text-center text-stone-400">目前尚無優惠資料</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {activeTab === 'locations' && (
              <>
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                  <div className="flex items-center gap-4">
                    <h2 className="text-xl font-bold">美食地圖管理</h2>
                    <button 
                      onClick={fetchData}
                      className="p-2 text-stone-400 hover:text-orange-600 transition-colors"
                      title="重新整理"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                      <input 
                        type="text"
                        placeholder="搜尋店名、地址或區域..."
                        value={locationSearchQuery}
                        onChange={(e) => setLocationSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-stone-50 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                      />
                    </div>
                    <select
                      value={locationSortOrder}
                      onChange={(e) => setLocationSortOrder(e.target.value as any)}
                      className="bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                    >
                      <option value="name">依店名排序</option>
                      <option value="category">依類型排序</option>
                      <option value="city">依縣市排序</option>
                    </select>
                    <button 
                      onClick={() => { setEditingLocation(null); setShowLocationModal(true); }}
                      className="bg-stone-900 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 whitespace-nowrap"
                    >
                      <Plus className="w-4 h-4" /> 新增地點
                    </button>
                    <button 
                      onClick={() => { setShowBulkImport(true); setBulkImportText(''); setBulkImportProgress(null); }}
                      className="bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 whitespace-nowrap"
                    >
                      <FileText className="w-4 h-4" /> 批次匯入
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-stone-100 text-stone-400 text-sm">
                        <th className="pb-4 font-medium">店名</th>
                        <th className="pb-4 font-medium">類型</th>
                        <th className="pb-4 font-medium">縣市/行政區</th>
                        <th className="pb-4 font-medium">地址</th>
                        <th className="pb-4 font-medium text-right">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-50">
                      {filteredAndSortedLocations.map(loc => (
                        <tr key={loc.id} className="group">
                          <td className="py-4 font-medium">{loc.name}</td>
                          <td className="py-4 text-sm">
                            <span className="bg-stone-100 px-2 py-1 rounded-md text-stone-600">
                              {loc.category === 'BBQ' ? '燒肉' : 
                               loc.category === 'Hotpot' ? '火鍋' : 
                               loc.category === 'Bento' ? '便當' : 
                               loc.category === 'Drink' ? '手搖' : loc.category}
                            </span>
                          </td>
                          <td className="py-4 text-sm">
                            {loc.city ? (
                              <span className="text-stone-700">{loc.city}{loc.district}</span>
                            ) : (
                              <span className="text-red-500 font-medium flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" /> 待更新
                              </span>
                            )}
                          </td>
                          <td className="py-4 text-sm text-stone-500">{loc.address}</td>
                          <td className="py-4 text-right">
                            <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button 
                                onClick={() => { setEditingLocation(loc); setShowLocationModal(true); }}
                                className="p-2 text-stone-400 hover:text-orange-600"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => handleDeleteLocation(loc.id)}
                                className="p-2 text-stone-400 hover:text-red-600"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {locations.length === 0 && (
                        <tr>
                          <td colSpan={4} className="py-12 text-center text-stone-400">目前尚無地點資料</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Event Modal */}
      <AnimatePresence>
        {showEventModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setShowEventModal(false); setEditingEvent(null); }}
              className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-stone-100 flex justify-between items-center">
                <h3 className="text-xl font-bold">{editingEvent ? '編輯活動' : '新增活動'}</h3>
                <button onClick={() => { setShowEventModal(false); setEditingEvent(null); }} className="text-stone-400 hover:text-stone-600">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <form onSubmit={handleSaveEvent} className="p-8 space-y-6 max-h-[70vh] overflow-y-auto">
                <div className="grid grid-cols-2 gap-6">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-stone-700 mb-2">活動標題</label>
                    <input name="title" defaultValue={editingEvent?.title} className="w-full px-4 py-2 rounded-xl border border-stone-200 outline-none focus:ring-2 focus:ring-orange-600" required />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-stone-700 mb-2">簡短描述</label>
                    <textarea name="description" defaultValue={editingEvent?.description} className="w-full px-4 py-2 rounded-xl border border-stone-200 outline-none focus:ring-2 focus:ring-orange-600 h-20" required />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-stone-700 mb-2">活動部落格內容 (區塊編輯器)</label>
                    <BlockEditor 
                      key={editingEvent?.id || 'new_event'} 
                      initialContent={editingEvent?.content} 
                      onChange={setEditorContent} 
                      folder="events"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-2">開始日期</label>
                    <input type="date" name="start_date" defaultValue={editingEvent?.start_date} className="w-full px-4 py-2 rounded-xl border border-stone-200 outline-none focus:ring-2 focus:ring-orange-600" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-2">結束日期</label>
                    <input type="date" name="end_date" defaultValue={editingEvent?.end_date} className="w-full px-4 py-2 rounded-xl border border-stone-200 outline-none focus:ring-2 focus:ring-orange-600" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-2">活動狀態</label>
                    <select name="type" defaultValue={editingEvent?.type || 'current'} className="w-full px-4 py-2 rounded-xl border border-stone-200 outline-none focus:ring-2 focus:ring-orange-600">
                      <option value="current">進行中</option>
                      <option value="past">已結束</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <ImageUpload 
                      label="封面圖片" 
                      value={imageUrl} 
                      onChange={setImageUrl} 
                      folder="events"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-stone-700 mb-2">影片網址 (YouTube 或 MP4)</label>
                    <input name="video_url" defaultValue={editingEvent?.video_url} className="w-full px-4 py-2 rounded-xl border border-stone-200 outline-none focus:ring-2 focus:ring-orange-600" placeholder="https://www.youtube.com/watch?v=..." />
                  </div>
                </div>
                <div className="pt-6 flex gap-4">
                  <button type="button" onClick={() => { setShowEventModal(false); setEditingEvent(null); }} className="flex-1 px-6 py-3 rounded-xl border border-stone-200 font-bold hover:bg-stone-50 transition-colors">取消</button>
                  <button type="submit" className="flex-1 px-6 py-3 rounded-xl bg-orange-600 text-white font-bold hover:bg-orange-500 transition-colors">儲存活動</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Brand Modal */}
      <AnimatePresence>
        {showBrandModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setShowBrandModal(false); setEditingBrand(null); }}
              className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-stone-100 flex justify-between items-center">
                <h3 className="text-xl font-bold">{editingBrand ? '編輯品牌' : '新增品牌'}</h3>
                <button onClick={() => { setShowBrandModal(false); setEditingBrand(null); }} className="text-stone-400 hover:text-stone-600">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <form onSubmit={handleSaveBrand} className="p-8 space-y-6 max-h-[70vh] overflow-y-auto">
                <div className="grid grid-cols-2 gap-6">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-stone-700 mb-2">所屬活動</label>
                    <select name="event_id" defaultValue={editingBrand?.event_id} className="w-full px-4 py-2 rounded-xl border border-stone-200 outline-none focus:ring-2 focus:ring-orange-600" required>
                      <option value="">請選擇活動</option>
                      {allEvents.map(event => (
                        <option key={event.id} value={event.id}>{event.title}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-stone-700 mb-2">品牌名稱</label>
                    <input name="name" defaultValue={editingBrand?.name} className="w-full px-4 py-2 rounded-xl border border-stone-200 outline-none focus:ring-2 focus:ring-orange-600" required />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-stone-700 mb-2">品牌類別 (例如: 燒烤、火鍋)</label>
                    <input name="category" defaultValue={editingBrand?.category} className="w-full px-4 py-2 rounded-xl border border-stone-200 outline-none focus:ring-2 focus:ring-orange-600" required />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-stone-700 mb-2">簡短描述</label>
                    <textarea name="description" defaultValue={editingBrand?.description} className="w-full px-4 py-2 rounded-xl border border-stone-200 outline-none focus:ring-2 focus:ring-orange-600 h-20" required />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-stone-700 mb-2">優惠資訊</label>
                    <input name="promotion_info" defaultValue={editingBrand?.promotion_info} className="w-full px-4 py-2 rounded-xl border border-stone-200 outline-none focus:ring-2 focus:ring-orange-600" placeholder="例如: 憑券享 9 折優惠" />
                  </div>
                  <div className="col-span-2">
                    <ImageUpload 
                      label="品牌 Logo" 
                      value={logoUrl} 
                      onChange={setLogoUrl} 
                      folder="brands"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-stone-700 mb-2">品牌介紹 (區塊編輯器)</label>
                    <BlockEditor 
                      key={editingBrand?.id || 'new_brand'} 
                      initialContent={(editingBrand as any)?.content} 
                      onChange={setEditorContent} 
                      folder="brands"
                    />
                  </div>
                </div>
                <div className="pt-6 flex gap-4">
                  <button type="button" onClick={() => { setShowBrandModal(false); setEditingBrand(null); }} className="flex-1 px-6 py-3 rounded-xl border border-stone-200 font-bold hover:bg-stone-50 transition-colors">取消</button>
                  <button type="submit" className="flex-1 px-6 py-3 rounded-xl bg-orange-600 text-white font-bold hover:bg-orange-500 transition-colors">儲存品牌</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Partner Modal */}
      <AnimatePresence>
        {showPartnerModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setShowPartnerModal(false); setEditingPartner(null); }}
              className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-stone-100 flex justify-between items-center">
                <h3 className="text-xl font-bold">{editingPartner ? '編輯贊助' : '新增贊助'}</h3>
                <button onClick={() => { setShowPartnerModal(false); setEditingPartner(null); }} className="text-stone-400 hover:text-stone-600">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <form onSubmit={handleSavePartner} className="p-8 space-y-6 max-h-[70vh] overflow-y-auto">
                <div className="grid grid-cols-2 gap-6">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-stone-700 mb-2">所屬活動</label>
                    <select name="event_id" defaultValue={editingPartner?.event_id} className="w-full px-4 py-2 rounded-xl border border-stone-200 outline-none focus:ring-2 focus:ring-orange-600" required>
                      <option value="">請選擇活動</option>
                      {allEvents.map(event => (
                        <option key={event.id} value={event.id}>{event.title}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-stone-700 mb-2">夥伴名稱</label>
                    <input name="name" defaultValue={editingPartner?.name} className="w-full px-4 py-2 rounded-xl border border-stone-200 outline-none focus:ring-2 focus:ring-orange-600" required />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-stone-700 mb-2">夥伴類型</label>
                    <select name="type" defaultValue={editingPartner?.type} className="w-full px-4 py-2 rounded-xl border border-stone-200 outline-none focus:ring-2 focus:ring-orange-600">
                      <option value="KOL">KOL</option>
                      <option value="Restaurant">餐廳</option>
                      <option value="Sponsor">贊助商</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <ImageUpload 
                      label="夥伴 Logo / 封面" 
                      value={logoUrl} 
                      onChange={setLogoUrl} 
                      folder="partners"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-stone-700 mb-2">排序權重 (數字越小越前面)</label>
                    <input type="number" name="sort_order" defaultValue={editingPartner?.sort_order || 0} className="w-full px-4 py-2 rounded-xl border border-stone-200 outline-none focus:ring-2 focus:ring-orange-600" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-stone-700 mb-2">夥伴介紹 (區塊編輯器)</label>
                    <BlockEditor 
                      key={editingPartner?.id || 'new_partner'} 
                      initialContent={editingPartner?.content} 
                      onChange={setEditorContent} 
                      folder="partners"
                    />
                  </div>
                </div>
                <div className="pt-6 flex gap-4">
                  <button type="button" onClick={() => { setShowPartnerModal(false); setEditingPartner(null); }} className="flex-1 px-6 py-3 rounded-xl border border-stone-200 font-bold hover:bg-stone-50 transition-colors">取消</button>
                  <button type="submit" className="flex-1 px-6 py-3 rounded-xl bg-orange-600 text-white font-bold hover:bg-orange-500 transition-colors">儲存贊助</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* KOL Review Modal */}
      <AnimatePresence>
        {showKOLModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setShowKOLModal(false); setEditingKOL(null); }}
              className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-stone-100 flex justify-between items-center">
                <h3 className="text-xl font-bold">{editingKOL ? '編輯開箱' : '新增開箱'}</h3>
                <button onClick={() => { setShowKOLModal(false); setEditingKOL(null); }} className="text-stone-400 hover:text-stone-600">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <form onSubmit={handleSaveKOL} className="p-8 space-y-6 max-h-[70vh] overflow-y-auto">
                <div className="grid grid-cols-2 gap-6">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-stone-700 mb-2">所屬品牌</label>
                    <select name="brand_id" defaultValue={editingKOL?.brand_id} className="w-full px-4 py-2 rounded-xl border border-stone-200 outline-none focus:ring-2 focus:ring-orange-600" required>
                      <option value="">請選擇品牌</option>
                      {allBrands.map(brand => (
                        <option key={brand.id} value={brand.id}>{brand.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-stone-700 mb-2">開箱標題</label>
                    <input name="title" defaultValue={editingKOL?.title} className="w-full px-4 py-2 rounded-xl border border-stone-200 outline-none focus:ring-2 focus:ring-orange-600" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-2">KOL 名稱</label>
                    <input name="kol_name" defaultValue={editingKOL?.kol_name} className="w-full px-4 py-2 rounded-xl border border-stone-200 outline-none focus:ring-2 focus:ring-orange-600" required />
                  </div>
                  <div>
                    <ImageUpload 
                      label="KOL 頭像" 
                      value={avatarUrl} 
                      onChange={setAvatarUrl} 
                      folder="kol_avatars"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-2">媒體類型</label>
                    <select name="media_type" defaultValue={editingKOL?.media_type} className="w-full px-4 py-2 rounded-xl border border-stone-200 outline-none focus:ring-2 focus:ring-orange-600">
                      <option value="image">圖文</option>
                      <option value="video">影片</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-stone-700 mb-2">影片連結 (YouTube, TikTok, Reels 等)</label>
                    <input 
                      name="video_embed_url" 
                      placeholder="請輸入影片網址..."
                      defaultValue={editingKOL?.video_embed_url} 
                      className="w-full px-4 py-2 rounded-xl border border-stone-200 outline-none focus:ring-2 focus:ring-orange-600" 
                    />
                    <p className="mt-1 text-xs text-stone-400">支援 YouTube, Shorts, TikTok, Instagram Reels 連結</p>
                  </div>
                  <div>
                    <ImageUpload 
                      label="媒體封面 / 圖片" 
                      value={imageUrl} 
                      onChange={setImageUrl} 
                      folder="kol_reviews"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-stone-700 mb-2">開箱內容 (區塊編輯器)</label>
                    <BlockEditor 
                      key={editingKOL?.id || 'new_kol'} 
                      initialContent={editingKOL?.content} 
                      onChange={setEditorContent} 
                      folder="kol_reviews"
                    />
                  </div>
                </div>
                <div className="pt-6 flex gap-4">
                  <button type="button" onClick={() => { setShowKOLModal(false); setEditingKOL(null); }} className="flex-1 px-6 py-3 rounded-xl border border-stone-200 font-bold hover:bg-stone-50 transition-colors">取消</button>
                  <button type="submit" className="flex-1 px-6 py-3 rounded-xl bg-orange-600 text-white font-bold hover:bg-orange-500 transition-colors">儲存開箱</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Promotion Modal */}
      <AnimatePresence>
        {showPromotionModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setShowPromotionModal(false); setEditingPromotion(null); }}
              className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-stone-100 flex justify-between items-center">
                <h3 className="text-xl font-bold">{editingPromotion ? '編輯優惠' : '新增優惠'}</h3>
                <button onClick={() => { setShowPromotionModal(false); setEditingPromotion(null); }} className="text-stone-400 hover:text-stone-600">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <form onSubmit={handleSavePromotion} className="p-8 space-y-6 max-h-[70vh] overflow-y-auto">
                <div className="grid grid-cols-2 gap-6">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-stone-700 mb-2">優惠標題</label>
                    <input name="title" defaultValue={editingPromotion?.title} className="w-full px-4 py-2 rounded-xl border border-stone-200 outline-none focus:ring-2 focus:ring-orange-600" required />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-stone-700 mb-2">所屬品牌</label>
                    <select name="brand_id" defaultValue={editingPromotion?.brand_id} className="w-full px-4 py-2 rounded-xl border border-stone-200 outline-none focus:ring-2 focus:ring-orange-600" required>
                      <option value="">請選擇品牌</option>
                      {brands.map(brand => (
                        <option key={brand.id} value={brand.id}>{brand.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-stone-700 mb-2">簡短描述</label>
                    <textarea name="description" defaultValue={editingPromotion?.description} className="w-full px-4 py-2 rounded-xl border border-stone-200 outline-none focus:ring-2 focus:ring-orange-600 h-20" required />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-stone-700 mb-2">折扣碼</label>
                    <input name="discount_code" defaultValue={editingPromotion?.discount_code} className="w-full px-4 py-2 rounded-xl border border-stone-200 outline-none focus:ring-2 focus:ring-orange-600" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-2">開始日期</label>
                    <input type="date" name="start_date" defaultValue={editingPromotion?.start_date} className="w-full px-4 py-2 rounded-xl border border-stone-200 outline-none focus:ring-2 focus:ring-orange-600" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-2">截止日期</label>
                    <input type="date" name="end_date" defaultValue={editingPromotion?.end_date} className="w-full px-4 py-2 rounded-xl border border-stone-200 outline-none focus:ring-2 focus:ring-orange-600" required />
                  </div>
                  <div className="col-span-2">
                    <ImageUpload 
                      label="優惠封面圖" 
                      value={imageUrl} 
                      onChange={setImageUrl} 
                      folder="promotions"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-stone-700 mb-2">狀態</label>
                    <select name="is_active" defaultValue={editingPromotion?.is_active ? 'true' : 'false'} className="w-full px-4 py-2 rounded-xl border border-stone-200 outline-none focus:ring-2 focus:ring-orange-600">
                      <option value="true">啟用中</option>
                      <option value="false">已停用</option>
                    </select>
                  </div>
                </div>
                <div className="pt-6 flex gap-4">
                  <button type="button" onClick={() => { setShowPromotionModal(false); setEditingPromotion(null); }} className="flex-1 px-6 py-3 rounded-xl border border-stone-200 font-bold hover:bg-stone-50 transition-colors">取消</button>
                  <button type="submit" className="flex-1 px-6 py-3 rounded-xl bg-orange-600 text-white font-bold hover:bg-orange-500 transition-colors">儲存優惠</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Brand Locations Modal */}
      <AnimatePresence>
        {showBrandLocationsModal && managingBrand && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => !savingBrandLocations && setShowBrandLocationsModal(false)}
              className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">

              {/* Header */}
              <div className="p-6 border-b border-stone-100 flex justify-between items-start shrink-0">
                <div className="flex items-center gap-3">
                  {managingBrand.logo_url && (
                    <SafeImage src={managingBrand.logo_url} alt={managingBrand.name}
                      className="w-10 h-10 rounded-xl object-cover border border-stone-100" fallback={DEFAULT_LOGO} />
                  )}
                  <div>
                    <h3 className="text-xl font-bold text-stone-900">{managingBrand.name}</h3>
                    <p className="text-sm text-stone-400 mt-0.5">勾選此品牌的分店，地圖上會顯示品牌名稱</p>
                  </div>
                </div>
                <button onClick={() => setShowBrandLocationsModal(false)} className="text-stone-400 hover:text-stone-600">
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* 統計 */}
              <div className="px-6 py-3 bg-orange-50 border-b border-orange-100 shrink-0 flex items-center justify-between">
                <span className="text-sm text-orange-700">
                  已選 <strong>{brandLinkedLocationIds.length}</strong> 家分店
                </span>
                <button onClick={() => setBrandLinkedLocationIds([])} className="text-xs text-stone-400 hover:text-red-500 transition-colors">
                  清除全部
                </button>
              </div>

              {/* 搜尋 */}
              <div className="px-6 py-3 border-b border-stone-100 shrink-0">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                  <input type="text" placeholder="搜尋店家名稱或地區..."
                    value={brandLocationSearch} onChange={e => setBrandLocationSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-stone-50 rounded-xl border border-stone-200 text-sm outline-none focus:ring-2 focus:ring-orange-500/20" />
                </div>
              </div>

              {/* 店家列表 */}
              <div className="flex-1 overflow-y-auto p-4 space-y-1">
                {locations
                  .filter(loc => !brandLocationSearch ||
                    loc.name.toLowerCase().includes(brandLocationSearch.toLowerCase()) ||
                    (loc.city + loc.district).includes(brandLocationSearch))
                  .map(loc => {
                    const isLinked = brandLinkedLocationIds.includes(loc.id);
                    const otherBrand = (loc as any).brand && (loc as any).brand.id !== managingBrand.id ? (loc as any).brand.name : null;
                    return (
                      <label key={loc.id} className={cn(
                        'flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors border',
                        isLinked ? 'bg-orange-50 border-orange-200' : 'hover:bg-stone-50 border-transparent'
                      )}>
                        <input type="checkbox" checked={isLinked}
                          onChange={e => {
                            if (e.target.checked) setBrandLinkedLocationIds([...brandLinkedLocationIds, loc.id]);
                            else setBrandLinkedLocationIds(brandLinkedLocationIds.filter(id => id !== loc.id));
                          }}
                          className="w-4 h-4 accent-orange-600 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-bold text-stone-800 truncate">{loc.name}</p>
                            {otherBrand && (
                              <span className="text-[10px] text-stone-400 bg-stone-100 px-1.5 py-0.5 rounded-full shrink-0">
                                已屬於 {otherBrand}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-stone-400">{loc.city}{loc.district}</p>
                        </div>
                        <span className={cn(
                          'px-2 py-0.5 rounded-full text-[10px] font-bold text-white shrink-0',
                          loc.category === 'BBQ' ? 'bg-orange-600' : loc.category === 'Hotpot' ? 'bg-red-600' : loc.category === 'Bento' ? 'bg-emerald-600' : 'bg-blue-600'
                        )}>
                          {loc.category === 'BBQ' ? '燒肉' : loc.category === 'Hotpot' ? '火鍋' : loc.category === 'Bento' ? '便當' : '手搖'}
                        </span>
                      </label>
                    );
                  })}
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-stone-100 flex gap-3 shrink-0 bg-white">
                <button onClick={() => setShowBrandLocationsModal(false)}
                  className="flex-1 py-3 rounded-xl border border-stone-200 font-bold text-stone-600 hover:bg-stone-50">
                  取消
                </button>
                <button onClick={handleSaveBrandLocations} disabled={savingBrandLocations}
                  className="flex-1 py-3 rounded-xl bg-orange-600 text-white font-bold hover:bg-orange-500 disabled:opacity-50">
                  {savingBrandLocations ? '儲存中...' : `儲存（${brandLinkedLocationIds.length} 家分店）`}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Event Locations Modal */}
      <AnimatePresence>
        {showEventLocationsModal && managingEvent && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => !savingEventLocations && setShowEventLocationsModal(false)}
              className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">
              
              {/* Header */}
              <div className="p-6 border-b border-stone-100 flex justify-between items-start shrink-0">
                <div>
                  <h3 className="text-xl font-bold text-stone-900">{managingEvent.title}</h3>
                  <p className="text-sm text-stone-400 mt-1">勾選參加此活動的地圖店家，地圖上會顯示活動標示</p>
                </div>
                <button onClick={() => setShowEventLocationsModal(false)} className="text-stone-400 hover:text-stone-600 mt-1">
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* 統計 */}
              <div className="px-6 py-3 bg-orange-50 border-b border-orange-100 shrink-0 flex items-center justify-between">
                <span className="text-sm text-orange-700">
                  已選 <strong>{eventLinkedLocationIds.length}</strong> 家店參加此活動
                </span>
                <button onClick={() => setEventLinkedLocationIds([])} className="text-xs text-stone-400 hover:text-red-500 transition-colors">
                  清除全部
                </button>
              </div>

              {/* 搜尋 */}
              <div className="px-6 py-3 border-b border-stone-100 shrink-0">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                  <input
                    type="text"
                    placeholder="搜尋店家名稱或地區..."
                    value={locationModalSearch}
                    onChange={e => setLocationModalSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-stone-50 rounded-xl border border-stone-200 text-sm outline-none focus:ring-2 focus:ring-orange-500/20"
                  />
                </div>
              </div>

              {/* 店家列表 */}
              <div className="flex-1 overflow-y-auto p-4 space-y-1">
                {locations
                  .filter(loc => !locationModalSearch || 
                    loc.name.toLowerCase().includes(locationModalSearch.toLowerCase()) ||
                    (loc.city + loc.district).includes(locationModalSearch))
                  .map(loc => {
                    const isLinked = eventLinkedLocationIds.includes(loc.id);
                    const catLabel = loc.category === 'BBQ' ? '燒肉' : loc.category === 'Hotpot' ? '火鍋' : loc.category === 'Bento' ? '便當' : '手搖';
                    return (
                      <label key={loc.id} className={cn(
                        'flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors',
                        isLinked ? 'bg-orange-50 border border-orange-200' : 'hover:bg-stone-50 border border-transparent'
                      )}>
                        <input
                          type="checkbox"
                          checked={isLinked}
                          onChange={e => {
                            if (e.target.checked) {
                              setEventLinkedLocationIds([...eventLinkedLocationIds, loc.id]);
                            } else {
                              setEventLinkedLocationIds(eventLinkedLocationIds.filter(id => id !== loc.id));
                            }
                          }}
                          className="w-4 h-4 accent-orange-600 shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-stone-800 truncate">{loc.name}</p>
                          <p className="text-xs text-stone-400">{loc.city}{loc.district}</p>
                        </div>
                        <span className={cn(
                          'px-2 py-0.5 rounded-full text-[10px] font-bold text-white shrink-0',
                          loc.category === 'BBQ' ? 'bg-orange-600' : loc.category === 'Hotpot' ? 'bg-red-600' : loc.category === 'Bento' ? 'bg-emerald-600' : 'bg-blue-600'
                        )}>
                          {catLabel}
                        </span>
                      </label>
                    );
                  })}
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-stone-100 flex gap-3 shrink-0 bg-white">
                <button onClick={() => setShowEventLocationsModal(false)} className="flex-1 py-3 rounded-xl border border-stone-200 font-bold text-stone-600 hover:bg-stone-50">
                  取消
                </button>
                <button onClick={handleSaveEventLocations} disabled={savingEventLocations}
                  className="flex-1 py-3 rounded-xl bg-orange-600 text-white font-bold hover:bg-orange-500 disabled:opacity-50 flex items-center justify-center gap-2">
                  {savingEventLocations ? '儲存中...' : `儲存（${eventLinkedLocationIds.length} 家）`}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Bulk Import Modal */}
      <AnimatePresence>
        {showBulkImport && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => !bulkImportRunning && setShowBulkImport(false)}
              className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden">
              <div className="p-8 border-b border-stone-100 flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-bold">批次匯入店家</h3>
                  <p className="text-sm text-stone-400 mt-1">每行一個店名或 Google 地圖搜尋詞</p>
                </div>
                {!bulkImportRunning && (
                  <button onClick={() => setShowBulkImport(false)} className="text-stone-400 hover:text-stone-600"><X className="w-6 h-6" /></button>
                )}
              </div>
              <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto">
                {!bulkImportProgress ? (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-stone-700 mb-2">預設類型</label>
                      <select value={locationCategory} onChange={(e) => setLocationCategory(e.target.value as any)}
                        className="w-full px-4 py-2 rounded-xl border border-stone-200 outline-none focus:ring-2 focus:ring-orange-600">
                        <option value="BBQ">燒肉</option>
                        <option value="Hotpot">火鍋</option>
                        <option value="Bento">便當</option>
                        <option value="Drink">手搖</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-stone-700 mb-2">店家清單（每行一筆）</label>
                      <textarea
                        value={bulkImportText}
                        onChange={(e) => setBulkImportText(e.target.value)}
                        rows={10}
                        placeholder={`雞湯大叔 敦北店\n草原風蒙古火鍋 永康店\n燒肉眾 台北西門店`}
                        className="w-full px-4 py-3 rounded-xl border border-stone-200 outline-none focus:ring-2 focus:ring-orange-600 font-mono text-sm"
                      />
                      <p className="text-xs text-stone-400 mt-1">目前 {bulkImportText.split('\n').filter(Boolean).length} 筆，系統會自動搜尋 Google Maps 並下載照片</p>
                    </div>
                    <div className="flex gap-4">
                      <button onClick={() => setShowBulkImport(false)} className="flex-1 px-6 py-3 rounded-xl border border-stone-200 font-bold">取消</button>
                      <button onClick={handleBulkImport} disabled={!bulkImportText.trim()}
                        className="flex-1 px-6 py-3 rounded-xl bg-orange-600 text-white font-bold hover:bg-orange-500 disabled:opacity-50">
                        開始匯入
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="space-y-6">
                    <div>
                      <div className="flex justify-between text-sm font-medium text-stone-700 mb-2">
                        <span>{bulkImportProgress.status}</span>
                        <span>{bulkImportProgress.done} / {bulkImportProgress.total}</span>
                      </div>
                      <div className="h-3 bg-stone-100 rounded-full overflow-hidden">
                        <div className="h-full bg-orange-600 rounded-full transition-all duration-500"
                          style={{ width: `${(bulkImportProgress.done / bulkImportProgress.total) * 100}%` }} />
                      </div>
                    </div>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {bulkImportProgress.results.map((r, i) => (
                        <div key={i} className={`flex items-center gap-3 p-3 rounded-xl ${r.ok ? 'bg-green-50' : 'bg-red-50'}`}>
                          <span className={`text-lg ${r.ok ? '' : ''}`}>{r.ok ? '✅' : '❌'}</span>
                          <div>
                            <p className="text-sm font-bold text-stone-800">{r.name}</p>
                            <p className={`text-xs ${r.ok ? 'text-green-600' : 'text-red-500'}`}>{r.msg}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    {!bulkImportRunning && (
                      <button onClick={() => setShowBulkImport(false)} className="w-full px-6 py-3 rounded-xl bg-stone-900 text-white font-bold">
                        完成，關閉
                      </button>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Location Modal */}
      <AnimatePresence>
        {showLocationModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setShowLocationModal(false); setEditingLocation(null); }}
              className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-stone-100 flex justify-between items-center">
                <h3 className="text-xl font-bold">{editingLocation ? '編輯地點' : '新增地點'}</h3>
                <button onClick={() => { setShowLocationModal(false); setEditingLocation(null); }} className="text-stone-400 hover:text-stone-600">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <form onSubmit={handleSaveLocation} className="p-8 space-y-6 max-h-[70vh] overflow-y-auto">
                <div className="space-y-4">
                  <label className="block text-sm font-medium text-stone-700">從 Google 地圖搜尋</label>
                  <PlaceAutocomplete 
                    onPlaceSelect={(place) => {
                      if (place.name) setLocationName(place.name);
                      if (place.formatted_address) setLocationAddress(place.formatted_address);
                      if (place.geometry?.location) {
                        setLocationLat(place.geometry.location.lat());
                        setLocationLng(place.geometry.location.lng());
                      }
                      // 自動帶入 Google 資訊
                      if (place.international_phone_number) setLocationPhone(place.international_phone_number);
                      if (place.rating) setLocationRating(place.rating);
                      
                      // 解析縣市與行政區 (直接從 Google 資料截取)
                      if (place.address_components || place.formatted_address) {
                        const address = place.formatted_address || '';
                        let city = '';
                        let district = '';
                        
                        // 1. 優先從結構化組件中抓取
                        if (place.address_components) {
                          const components = place.address_components;
                          const cityComp = components.find(c => c.types.includes('administrative_area_level_1'));
                          const distComp = components.find(c => c.types.includes('sublocality_level_1') || c.types.includes('locality'));
                          
                          if (cityComp) city = cityComp.long_name;
                          if (distComp && distComp.long_name !== city) district = distComp.long_name;
                        }

                        // 2. 備案：從完整地址字串截取 (正則匹配)
                        if (!city || !district) {
                          const match = address.match(/(?:台灣)?(.*?市|.*?縣)(.*?區|.*?鄉|.*?鎮|.*?市)/);
                          if (match) {
                            if (!city) city = match[1];
                            if (!district) district = match[2];
                          }
                        }
                        
                        // 統一格式 (台 -> 臺)
                        city = city.replace(/台/g, '臺');
                        district = district.replace(/台/g, '臺');
                        
                        // 匹配資料庫中的縣市
                        const matchedCityKey = Object.keys(TAIWAN_DISTRICTS).find(k => 
                          city.includes(k.replace(/[市縣]/g, '')) || address.includes(k)
                        );

                        if (matchedCityKey) {
                          setLocationCity(matchedCityKey);
                          
                          // 匹配資料庫中的行政區
                          const matchedDist = TAIWAN_DISTRICTS[matchedCityKey].find(d => 
                            district.includes(d.replace(/[區鄉鎮市]/g, '')) || address.includes(d)
                          );
                          
                          setLocationDistrict(matchedDist || '全部');
                        } else {
                          console.log('無法匹配縣市:', city);
                        }
                      }

                      // 營業時間
                      if (place.opening_hours?.weekday_text) {
                        // 取得今天的營業時間，或者顯示全部
                        const today = new Date().getDay();
                        // Google 的 weekday_text 是從週一開始 [0] 是週一
                        const dayIndex = today === 0 ? 6 : today - 1;
                        const todayHours = place.opening_hours.weekday_text[dayIndex];
                        if (todayHours) {
                          const hoursOnly = todayHours.split(': ')[1];
                          setLocationBusinessHours(hoursOnly || todayHours);
                        }
                      }

                      // 價格等級轉換為消費金額
                      if (place.price_level !== undefined) {
                        const priceMap: { [key: number]: string } = {
                          0: '免費',
                          1: '$100 - $300',
                          2: '$300 - $600',
                          3: '$600 - $1200',
                          4: '$1200+'
                        };
                        setLocationAvgPrice(priceMap[place.price_level] || '');
                      }

                      // 連結智慧識別 (優先使用 Google 提供的連結，若無則分析官網網址)
                      const website = place.website || '';
                      const mapsUrl = place.url || '';
                      
                      const isBookingSite = (url: string) => 
                        /inline|opentable|inline\.app|inline\.me|booking|reserve|tablecheck|eztable/i.test(url);
                      
                      const isOrderSite = (url: string) => 
                        /ubereats|foodpanda|oddle|inline\.app\/order|ordering|takeout|delivery/i.test(url);

                      // 處理訂位連結
                      if (isBookingSite(website)) {
                        setLocationBookingUrl(website);
                      } else if (website) {
                        setLocationBookingUrl(website); // 預設將官網放入訂位
                      } else {
                        setLocationBookingUrl(mapsUrl); // 最後備案使用 Google Maps 連結
                      }

                      // 處理線上點餐連結
                      if (isOrderSite(website)) {
                        setLocationOrderUrl(website);
                      } else if (website.includes('order') || website.includes('menu')) {
                        setLocationOrderUrl(website);
                      }

                      const summary = (place as any).editorial_summary;
                      if (summary && summary.overview) setLocationDescription(summary.overview);
                      if (place.photos && place.photos.length > 0) {
                        const photoUrl = place.photos[0].getUrl({ maxWidth: 1000 });
                        setLocationImageLoading(true);
                        setLocationImageUrl('');
                        (async () => {
                          try {
                            const { data: fnData, error: fnError } = await supabase.functions.invoke('proxy-place-photo', {
                              body: { photo_url: photoUrl }
                            });
                            if (fnData?.url) {
                              setLocationImageUrl(fnData.url);
                            } else {
                              setLocationImageUrl(photoUrl);
                            }
                          } catch (err) {
                            setLocationImageUrl(photoUrl);
                          } finally {
                            setLocationImageLoading(false);
                          }
                        })();
                      }
                    }} 
                  />
                  <div className="flex items-center gap-2 text-xs text-stone-400">
                    <Info className="w-3 h-3" />
                    <span>搜尋後會自動帶入店名、地址與座標</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-stone-700 mb-2">店名</label>
                    <input 
                      value={locationName} 
                      onChange={(e) => setLocationName(e.target.value)}
                      className="w-full px-4 py-2 rounded-xl border border-stone-200 outline-none focus:ring-2 focus:ring-orange-600" 
                      required 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-2">類型</label>
                    <select 
                      value={locationCategory} 
                      onChange={(e) => setLocationCategory(e.target.value as any)}
                      className="w-full px-4 py-2 rounded-xl border border-stone-200 outline-none focus:ring-2 focus:ring-orange-600" 
                      required
                    >
                      <option value="BBQ">燒肉</option>
                      <option value="Hotpot">火鍋</option>
                      <option value="Bento">便當</option>
                      <option value="Drink">手搖</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-2">縣市</label>
                    <select 
                      value={locationCity} 
                      onChange={(e) => {
                        setLocationCity(e.target.value);
                        setLocationDistrict('');
                      }}
                      className="w-full px-4 py-2 rounded-xl border border-stone-200 outline-none focus:ring-2 focus:ring-orange-600" 
                      required
                    >
                      <option value="">請選擇縣市</option>
                      {Object.keys(TAIWAN_DISTRICTS).map(city => (
                        <option key={city} value={city}>{city}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-2">行政區</label>
                    <select 
                      value={locationDistrict} 
                      onChange={(e) => setLocationDistrict(e.target.value)}
                      className="w-full px-4 py-2 rounded-xl border border-stone-200 outline-none focus:ring-2 focus:ring-orange-600" 
                      required
                      disabled={!locationCity}
                    >
                      <option value="">請選擇行政區</option>
                      {locationCity && TAIWAN_DISTRICTS[locationCity]?.map(dist => (
                        <option key={dist} value={dist}>{dist}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-stone-700 mb-2">地址</label>
                    <input 
                      value={locationAddress} 
                      onChange={(e) => setLocationAddress(e.target.value)}
                      className="w-full px-4 py-2 rounded-xl border border-stone-200 outline-none focus:ring-2 focus:ring-orange-600" 
                      required 
                    />
                  </div>

                  <div className="col-span-2 grid grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-stone-700 mb-2">電話</label>
                      <input 
                        value={locationPhone} 
                        onChange={(e) => setLocationPhone(e.target.value)}
                        placeholder="02-1234-5678"
                        className="w-full px-4 py-2 rounded-xl border border-stone-200 outline-none focus:ring-2 focus:ring-orange-600" 
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-stone-700 mb-2">評分 (1-5)</label>
                      <input 
                        type="number"
                        min="1"
                        max="5"
                        step="0.1"
                        value={locationRating} 
                        onChange={(e) => setLocationRating(parseFloat(e.target.value))}
                        className="w-full px-4 py-2 rounded-xl border border-stone-200 outline-none focus:ring-2 focus:ring-orange-600" 
                      />
                    </div>
                  </div>

                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-stone-700 mb-2">店家照片 URL</label>
                    <div className="flex gap-2">
                      <input 
                        value={locationImageLoading ? '照片下載中，請稍候...' : locationImageUrl} 
                        onChange={(e) => !locationImageLoading && setLocationImageUrl(e.target.value)}
                        placeholder="https://images.unsplash.com/..."
                        disabled={locationImageLoading}
                        className="flex-1 px-4 py-2 rounded-xl border border-stone-200 outline-none focus:ring-2 focus:ring-orange-600 disabled:bg-stone-50 disabled:text-stone-400" 
                      />
                      <input 
                        type="file" 
                        id="location-image-upload" 
                        className="hidden" 
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const url = await uploadImage(file, 'locations');
                            setLocationImageUrl(url);
                          }
                        }}
                      />
                      <button 
                        type="button"
                        onClick={() => document.getElementById('location-image-upload')?.click()}
                        className="px-4 py-2 bg-stone-100 text-stone-600 rounded-xl hover:bg-stone-200 transition-colors"
                      >
                        <ImageIcon className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  <div className="col-span-2 grid grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-stone-700 mb-2">營業時間</label>
                      <input 
                        value={locationBusinessHours} 
                        onChange={(e) => setLocationBusinessHours(e.target.value)}
                        placeholder="例如：11:00 - 21:00"
                        className="w-full px-4 py-2 rounded-xl border border-stone-200 outline-none focus:ring-2 focus:ring-orange-600" 
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-stone-700 mb-2">平均消費</label>
                      <input 
                        value={locationAvgPrice} 
                        onChange={(e) => setLocationAvgPrice(e.target.value)}
                        placeholder="例如：$600 - $800"
                        className="w-full px-4 py-2 rounded-xl border border-stone-200 outline-none focus:ring-2 focus:ring-orange-600" 
                      />
                    </div>
                  </div>

                  <div className="col-span-2 grid grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-stone-700 mb-2">訂位連結</label>
                      <input 
                        value={locationBookingUrl} 
                        onChange={(e) => setLocationBookingUrl(e.target.value)}
                        placeholder="https://inline.app/..."
                        className="w-full px-4 py-2 rounded-xl border border-stone-200 outline-none focus:ring-2 focus:ring-orange-600" 
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-stone-700 mb-2">線上點餐連結</label>
                      <input 
                        value={locationOrderUrl} 
                        onChange={(e) => setLocationOrderUrl(e.target.value)}
                        placeholder="https://ubereats.com/..."
                        className="w-full px-4 py-2 rounded-xl border border-stone-200 outline-none focus:ring-2 focus:ring-orange-600" 
                      />
                    </div>
                  </div>

                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-stone-700 mb-2">
                      祭典優惠內容 <span className="text-stone-400 font-normal">(選填，留空則不顯示)</span>
                    </label>
                    <input 
                      value={locationDiscount} 
                      onChange={(e) => setLocationDiscount(e.target.value)}
                      placeholder="例如：出示畫面享 9 折。非祭典期間請留空。"
                      className="w-full px-4 py-2 rounded-xl border border-stone-200 outline-none focus:ring-2 focus:ring-orange-600" 
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-stone-700 mb-2">店家簡介</label>
                    <textarea 
                      value={locationDescription} 
                      onChange={(e) => setLocationDescription(e.target.value)}
                      rows={3}
                      className="w-full px-4 py-2 rounded-xl border border-stone-200 outline-none focus:ring-2 focus:ring-orange-600" 
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-stone-700 mb-3">
                      參加活動 <span className="text-stone-400 font-normal text-xs">（勾選後在地圖上會特別標示）</span>
                    </label>
                    <div className="space-y-2">
                      {allEvents.map(event => (
                        <label key={event.id} className="flex items-center gap-3 p-3 rounded-xl border border-stone-100 hover:bg-orange-50 cursor-pointer transition-colors">
                          <input
                            type="checkbox"
                            checked={locationEventIds.includes(event.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setLocationEventIds([...locationEventIds, event.id]);
                              } else {
                                setLocationEventIds(locationEventIds.filter(id => id !== event.id));
                              }
                            }}
                            className="w-4 h-4 accent-orange-600"
                          />
                          <span className="text-sm font-medium text-stone-700">{event.title}</span>
                        </label>
                      ))}
                      {allEvents.length === 0 && (
                        <p className="text-sm text-stone-400">尚無活動可選擇</p>
                      )}
                    </div>
                  </div>
                </div>
                <div className="pt-6 flex gap-4">
                  <button type="button" onClick={() => { setShowLocationModal(false); setEditingLocation(null); }} className="flex-1 px-6 py-3 rounded-xl border border-stone-200 font-bold hover:bg-stone-50 transition-colors">取消</button>
                  <button type="submit" className="flex-1 px-6 py-3 rounded-xl bg-orange-600 text-white font-bold hover:bg-orange-500 transition-colors">儲存地點</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const isVercel = window.location.hostname.includes('vercel.app');
  
  if (!import.meta.env.VITE_GOOGLE_MAPS_API_KEY && !GOOGLE_MAPS_API_KEY) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50 p-4">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 shadow-xl border border-stone-200 text-center">
          <div className="w-16 h-16 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <Info className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-stone-900 mb-4">尚未設定 Google 地圖 API</h2>
          
          {isVercel ? (
            <div className="text-left mb-8">
              <p className="text-stone-600 mb-4 leading-relaxed">
                偵測到您正在使用 <b>Vercel</b> 部署。請在 Vercel 控制台設定環境變數：
              </p>
              <ol className="list-decimal list-inside text-sm text-stone-500 space-y-2 bg-stone-50 p-4 rounded-xl">
                <li>前往 Vercel Project Settings</li>
                <li>選擇 Environment Variables</li>
                <li>新增 <code>VITE_GOOGLE_MAPS_API_KEY</code></li>
                <li>重新部署 (Redeploy) 專案</li>
              </ol>
            </div>
          ) : (
            <p className="text-stone-600 mb-8 leading-relaxed">
              請在 AI Studio 的 <b>Secrets</b> 中新增環境變數 <code>VITE_GOOGLE_MAPS_API_KEY</code>，並點擊 <b>Apply changes</b>。
            </p>
          )}
          
          <a 
            href="https://console.cloud.google.com/google/maps-apis/credentials" 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-block w-full py-3 bg-stone-900 text-white rounded-xl font-bold hover:bg-stone-800 transition-colors"
          >
            前往 Google Cloud 取得金鑰
          </a>
        </div>
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
    <APIProvider apiKey={GOOGLE_MAPS_API_KEY} language="zh-TW" libraries={["places","marker"]}>
      <Router>
        <div className="min-h-screen bg-white font-sans text-stone-900">
          <Navbar />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/events" element={<EventsPage />} />
            <Route path="/event/:id" element={<EventDetail />} />
            <Route path="/brand/:id" element={<BrandDetail />} />
            <Route path="/partner/:id" element={<PartnerDetail />} />
            <Route path="/promotions" element={<PromotionsPage />} />
            <Route path="/reviews" element={<KOLReviewsPage />} />
            <Route path="/map" element={<MapPage />} />
            <Route path="/partners" element={<PartnersPage />} />
            <Route path="/login" element={<Login />} />
            <Route path="/admin" element={<AdminDashboard />} />
          </Routes>
          
          <footer className="bg-stone-900 text-white py-12 mt-24">
            <div className="max-w-7xl mx-auto px-4 text-center">
              <div className="flex items-center justify-center gap-2 mb-6">
                <Utensils className="w-6 h-6 text-orange-600" />
                <span className="font-bold text-lg">食在力量俱樂部</span>
              </div>
              <p className="text-stone-500 text-sm mb-4">© 2026 Food Power Club. All rights reserved.</p>
              <Link to="/login" className="text-stone-800 text-[10px] hover:text-stone-700 transition-colors opacity-20 hover:opacity-100">管理登入</Link>
            </div>
          </footer>
        </div>
      </Router>
    </APIProvider>
    </QueryClientProvider>
  );
}
