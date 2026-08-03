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
  ShoppingBag,
  ClipboardList,
  Copy,
  Download,
  User,
  Sparkles,
  Building2,
  Mail,
  CheckCircle2,
  ShieldCheck,
  MessageCircle,
  Unlink
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
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';

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
import type { Event, EventCategory, Brand, Partner, Location, Review, KOLReview, Promotion, SignupSettings, SignupEntry, AdminUser, Member, MemberType, MemberRoleApplication, Draw, DrawWinner, DrawPool, MessageCampaign } from './types';

import { APIProvider, Map, AdvancedMarker, Pin, InfoWindow, useMapsLibrary, useMap } from '@vis.gl/react-google-maps';

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

// 活動分類（新增分類時在此加一筆即可，DB category 欄位為 TEXT）
const EVENT_CATEGORIES: { value: EventCategory; label: string; emoji: string; description: string }[] = [
  { value: 'festival', label: '美食祭', emoji: '🎪', description: '區間限定的大型行銷活動，募集多家餐廳一起參與。' },
  { value: 'dining', label: '美食探店', emoji: '🍽️', description: '針對特定餐廳發起的聚餐活動，名額有限，歡迎接龍報名。' },
];
const eventCategoryLabel = (category: string) =>
  EVENT_CATEGORIES.find((c) => c.value === category)?.label || category;

// 會員身分別
const MEMBER_TYPES: { value: MemberType; label: string; emoji: string; badge: string }[] = [
  { value: 'general', label: '一般會員', emoji: '👤', badge: 'bg-stone-100 text-stone-600' },
  { value: 'creator', label: '創作者 KOC/KOL', emoji: '✨', badge: 'bg-purple-100 text-purple-700' },
  { value: 'business', label: '企業團體', emoji: '🏢', badge: 'bg-blue-100 text-blue-700' },
];
const memberTypeLabel = (t: string) => MEMBER_TYPES.find((m) => m.value === t)?.label || t;
const memberTypeBadge = (t: string) => MEMBER_TYPES.find((m) => m.value === t)?.badge || 'bg-stone-100 text-stone-600';

// 創作者社群平台
const SOCIAL_PLATFORMS: { key: string; label: string }[] = [
  { key: 'instagram', label: 'Instagram' },
  { key: 'facebook', label: 'Facebook' },
  { key: 'tiktok', label: 'TikTok' },
  { key: 'youtube', label: 'YouTube' },
  { key: 'threads', label: 'Threads' },
];
const emptySocial = () => Object.fromEntries(SOCIAL_PLATFORMS.map((p) => [p.key, { account: '', followers: '' }]));

// LINE Login channel ID（非機密，可放前端；可用環境變數覆寫）
const LINE_LOGIN_CHANNEL_ID = import.meta.env.VITE_LINE_LOGIN_CHANNEL_ID || '2010936799';

// 活動期間顯示：時間為選填（TIME 欄位存 HH:MM:SS，取 HH:MM）
// 同一天：2026-07-10 18:30 ~ 21:00；跨日：2026-07-01 ~ 2026-07-31
const formatEventPeriod = (event: Event) => {
  const startTime = event.start_time?.slice(0, 5) || '';
  const endTime = event.end_time?.slice(0, 5) || '';
  const start = startTime ? `${event.start_date} ${startTime}` : event.start_date;
  if (event.end_date === event.start_date) {
    if (endTime) return `${start} ~ ${endTime}`;
    return start;
  }
  const end = endTime ? `${event.end_date} ${endTime}` : event.end_date;
  return `${start} ~ ${end}`;
};

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

const SafeImage = ({ src, alt, className, fallback = DEFAULT_EVENT_IMAGE, optimize = true, width = 800, loading = 'lazy', ...props }: any) => {
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
      loading={loading}
      decoding="async"
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
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const checkAdmin = async (s: any) => {
      if (!s) { setIsAdmin(false); return; }
      const { data } = await supabase.from('admin_users').select('user_id').eq('user_id', s.user.id).maybeSingle();
      setIsAdmin(!!data);
    };
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      checkAdmin(session);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      checkAdmin(session);
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
          <Link to="/" className="flex items-center">
            <img src="/logo-mark.png" alt="食在俱樂部 Food Power Club" className="h-9 w-auto" />
          </Link>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center gap-8">
            <Link to="/events" className="text-stone-600 hover:text-orange-600 transition-colors font-medium">活動資訊</Link>
            <Link to="/promotions" className="text-stone-600 hover:text-orange-600 transition-colors font-medium">優惠資訊</Link>
            <Link to="/reviews" className="text-stone-600 hover:text-orange-600 transition-colors font-medium">開箱分享</Link>
            <Link to="/map" className="text-stone-600 hover:text-orange-600 transition-colors font-medium">美食地圖</Link>
            <Link to="/partners" className="text-stone-600 hover:text-orange-600 transition-colors font-medium">贊助夥伴</Link>
            {isAdmin && (
              <Link to="/admin" className="flex items-center gap-2 bg-stone-900 text-white px-4 py-2 rounded-full text-sm font-medium hover:bg-stone-800 transition-colors">
                <LayoutDashboard className="w-4 h-4" />
                管理中心
              </Link>
            )}
            {session ? (
              <Link to="/member" className="flex items-center gap-2 bg-orange-600 text-white px-4 py-2 rounded-full text-sm font-medium hover:bg-orange-500 transition-colors">
                <User className="w-4 h-4" />
                會員中心
              </Link>
            ) : (
              <Link to="/member/login" className="flex items-center gap-2 border border-stone-300 text-stone-700 px-4 py-2 rounded-full text-sm font-medium hover:border-orange-500 hover:text-orange-600 transition-colors">
                <LogIn className="w-4 h-4" />
                登入 / 註冊
              </Link>
            )}
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
              {isAdmin && (
                <Link to="/admin" onClick={() => setIsOpen(false)} className="block px-3 py-4 text-base font-medium text-stone-800 border-b border-stone-100">管理中心</Link>
              )}
              {session ? (
                <Link to="/member" onClick={() => setIsOpen(false)} className="block px-3 py-4 text-base font-medium text-orange-600">會員中心</Link>
              ) : (
                <Link to="/member/login" onClick={() => setIsOpen(false)} className="block px-3 py-4 text-base font-medium text-orange-600">登入 / 註冊</Link>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

// --- Pages ---

const Home = () => {
  const [heroIndex, setHeroIndex] = useState(0);

  const { data: homeData } = useQuery({
    queryKey: ['home'],
    queryFn: async () => {
      const [eventsRes, promoRes, reviewsRes, partnersRes] = await Promise.all([
        supabase.from('events').select('*').order('start_date', { ascending: true }),
        supabase.from('promotions').select('*, brand:brands(name, logo_url)').eq('is_active', true).limit(3).order('created_at', { ascending: false }),
        supabase.from('kol_reviews').select('*').limit(3).order('created_at', { ascending: false }),
        supabase.from('partners').select('*').order('sort_order', { ascending: true }),
      ]);
      const eventsData = (eventsRes.data as Event[]) || [];
      return {
        currentEvents: eventsData.filter(e => e.type === 'current'),
        pastEvents: eventsData.filter(e => e.type === 'past'),
        promotions: (promoRes.data as Promotion[]) || [],
        reviews: (reviewsRes.data as KOLReview[]) || [],
        partners: (partnersRes.data as Partner[]) || [],
      };
    },
  });
  const currentEvents = homeData?.currentEvents || [];
  const pastEvents = homeData?.pastEvents || [];
  const promotions = homeData?.promotions || [];
  const reviews = homeData?.reviews || [];
  const partners = homeData?.partners || [];

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
                {activeHeroEvent?.title || "食在俱樂部"}
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
        </div>
      </section>
    </div>
  );
};

const EventsPage = () => {
  const { data: events = [] } = useQuery({
    queryKey: ['events'],
    queryFn: async () => {
      const { data } = await supabase.from('events').select('*').order('start_date', { ascending: true });
      return (data as Event[]) || [];
    },
  });

  return (
    <div className="pt-24 min-h-screen bg-stone-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-12 text-center">
          <h1 className="text-4xl font-bold text-stone-900 mb-4">活動資訊</h1>
          <p className="text-stone-500 max-w-2xl mx-auto">探索「食在俱樂部」的所有精彩活動，從過去的經典回顧到現在的熱門盛宴。</p>
        </div>

        {EVENT_CATEGORIES.map((cat) => {
          // 未收錄在 EVENT_CATEGORIES 的分類值，一併歸入最後一區避免漏顯示
          const isLastCategory = cat.value === EVENT_CATEGORIES[EVENT_CATEGORIES.length - 1].value;
          const knownValues = EVENT_CATEGORIES.map((c) => c.value as string);
          const sectionEvents = events.filter((event) =>
            event.category === cat.value || (isLastCategory && !knownValues.includes(event.category))
          );
          if (sectionEvents.length === 0) return null;
          return (
            <section key={cat.value} className="mb-16">
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-stone-900 flex items-center gap-2">
                  <span>{cat.emoji}</span> {cat.label}
                </h2>
                <p className="text-stone-500 text-sm mt-2">{cat.description}</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {sectionEvents.map((event) => (
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
                        <span>{formatEventPeriod(event)}</span>
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
            </section>
          );
        })}
      </div>
    </div>
  );
};

const EventDetail = () => {
  const { id } = useParams();
  const [event, setEvent] = useState<Event | null>(null);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [signupSettings, setSignupSettings] = useState<SignupSettings | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      const { data: eventData } = await supabase.from('events').select('*').eq('id', id).single();
      const { data: brandsData } = await supabase.from('brands')
        .select('*, brand_events!inner(event_id)')
        .eq('brand_events.event_id', id);
      const { data: partnersData } = await supabase.from('partners')
        .select('*, partner_events!inner(event_id)')
        .eq('partner_events.event_id', id)
        .order('sort_order', { ascending: true });
      const { data: signupData } = await supabase.from('signup_settings')
        .select('event_id, capacity, registration_open, fee, event_time, event_location, event_address')
        .eq('event_id', id).maybeSingle();

      if (eventData) setEvent(eventData);
      if (brandsData) setBrands(brandsData);
      if (partnersData) setPartners(partnersData);
      setSignupSettings(signupData || null);
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
                <span className="px-3 py-1 rounded-full text-xs font-bold text-white bg-white/20 backdrop-blur-sm">
                  {eventCategoryLabel(event.category)}
                </span>
                <span className={cn(
                  "px-3 py-1 rounded-full text-xs font-bold text-white",
                  event.type === 'current' ? "bg-orange-600" : "bg-stone-500"
                )}>
                  {event.type === 'current' ? "進行中" : "已結束"}
                </span>
                <span className="text-stone-300 text-sm flex items-center gap-1">
                  <Calendar className="w-4 h-4" /> {formatEventPeriod(event)}
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
            {signupSettings && (
              <section className="bg-gradient-to-br from-orange-600 to-rose-500 rounded-3xl p-8 text-white shadow-xl shadow-orange-200">
                <h3 className="text-xl font-bold mb-2">🍢 報名接龍</h3>
                <p className="text-orange-100 text-sm mb-6">
                  {signupSettings.registration_open
                    ? '填三個欄位，名字馬上出現在公開名單！額滿自動排候補。'
                    : '報名目前已關閉，仍可查看目前名單。'}
                </p>
                <Link
                  to={`/event/${id}/signup`}
                  className="block w-full bg-white text-orange-600 text-center py-3 rounded-xl font-bold hover:bg-stone-50 transition-colors"
                >
                  {signupSettings.registration_open ? '立即報名' : '查看名單'}
                </Link>
              </section>
            )}
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
              <p className="text-orange-100 text-sm mb-6">加入食在俱樂部，探索更多美味驚喜！</p>
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

// --- 接龍報名（Event Signup） ---

interface MySignup { id: string; cancel_token: string; name: string; }

const signupStorageKey = (eventId: string) => `foodpower_signup_${eventId}`;

const readMySignups = (eventId: string): MySignup[] => {
  try { return JSON.parse(localStorage.getItem(signupStorageKey(eventId)) || '[]'); } catch { return []; }
};

const saveMySignups = (eventId: string, list: MySignup[]) => {
  localStorage.setItem(signupStorageKey(eventId), JSON.stringify(list));
};

const EventSignupPage = () => {
  const { id } = useParams();
  const [event, setEvent] = useState<Event | null>(null);
  const [settings, setSettings] = useState<SignupSettings | null>(null);
  const [entries, setEntries] = useState<SignupEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [mySignups, setMySignups] = useState<MySignup[]>([]);
  const [name, setName] = useState('');
  const [industry, setIndustry] = useState('');
  const [contact, setContact] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ msg: string; err?: boolean } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (msg: string, err = false) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ msg, err });
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  };

  const fetchList = async (eventId: string) => {
    // 匿名權限只開放非敏感欄位，不可 select contact
    const [{ data: settingsData }, { data: entriesData, error: entriesError }] = await Promise.all([
      supabase.from('signup_settings')
        .select('event_id, capacity, registration_open, fee, event_time, event_location, event_address')
        .eq('event_id', eventId).maybeSingle(),
      supabase.from('signup_entries')
        .select('id, event_id, name, industry, status, created_at')
        .eq('event_id', eventId).order('created_at', { ascending: true }),
    ]);
    setSettings(settingsData || null);
    if (!entriesError && entriesData) {
      setEntries(entriesData as SignupEntry[]);
      // 伺服器上已不存在的本機報名紀錄（被取消/刪除）順手清掉
      const serverIds = new Set(entriesData.map(e => e.id));
      const local = readMySignups(eventId);
      const alive = local.filter(m => serverIds.has(m.id));
      if (alive.length !== local.length) saveMySignups(eventId, alive);
      setMySignups(alive);
    }
  };

  useEffect(() => {
    if (!id) return;
    setMySignups(readMySignups(id));
    const init = async () => {
      setLoading(true);
      const { data: eventData } = await supabase.from('events').select('*').eq('id', id).single();
      if (eventData) setEvent(eventData);
      await fetchList(id);
      setLoading(false);
    };
    init();
    window.scrollTo(0, 0);

    const timer = setInterval(() => fetchList(id), 20000);
    const onVisible = () => { if (!document.hidden) fetchList(id); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [id]);

  const confirmed = entries.filter(e => e.status === 'confirmed');
  const waitlist = entries.filter(e => e.status === 'waitlist');
  const capacity = settings?.capacity ?? 0;
  const remain = Math.max(0, capacity - confirmed.length);
  const isFull = remain <= 0;
  const myIds = new Set(mySignups.map(m => m.id));

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    if (!name.trim()) { showToast('請填寫姓名', true); return; }
    if (!industry.trim()) { showToast('請填寫產業／品牌', true); return; }
    if (!contact.trim()) { showToast('請填寫聯絡方式', true); return; }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.rpc('signup_register', {
        p_event_id: id, p_name: name, p_industry: industry, p_contact: contact,
      });
      if (error) throw error;
      const next = [...readMySignups(id), { id: data.id, cancel_token: data.cancel_token, name: name.trim() }];
      saveMySignups(id, next);
      setMySignups(next);
      setName(''); setIndustry(''); setContact('');
      showToast(data.status === 'confirmed' ? '報名成功！你在正取名單 🎉' : '已加入候補，有人取消會自動遞補 ⏳');
      await fetchList(id);
    } catch (err: any) {
      showToast(err.message || '報名失敗，請稍後再試', true);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (entryId: string, token: string) => {
    if (!id || !window.confirm('確定要取消這筆報名嗎？')) return;
    try {
      const { error } = await supabase.rpc('signup_cancel', { p_id: entryId, p_token: token });
      if (error) throw error;
      const next = readMySignups(id).filter(m => m.id !== entryId);
      saveMySignups(id, next);
      setMySignups(next);
      showToast('已取消報名');
      await fetchList(id);
    } catch (err: any) {
      showToast(err.message || '取消失敗', true);
    }
  };

  if (loading) return <div className="pt-32 text-center text-stone-400">載入中...</div>;

  if (!event || !settings) {
    return (
      <div className="pt-32 min-h-screen bg-stone-50 text-center px-4">
        <div className="text-4xl mb-4">🍽️</div>
        <h1 className="text-2xl font-bold text-stone-900 mb-2">此活動尚未開放報名</h1>
        <p className="text-stone-500 mb-8">主辦方還沒有為這場活動建立報名接龍。</p>
        <Link to={event ? `/event/${event.id}` : '/events'} className="inline-block bg-orange-600 text-white px-8 py-3 rounded-full font-bold hover:bg-orange-500 transition-colors">
          {event ? '返回活動頁' : '查看所有活動'}
        </Link>
      </div>
    );
  }

  const entryRow = (entry: SignupEntry, index: number, isWaitlist: boolean) => (
    <li
      key={entry.id}
      className={cn(
        'flex items-center gap-4 px-4 py-3 border-b border-stone-50 last:border-b-0',
        myIds.has(entry.id) && 'bg-amber-50 rounded-xl'
      )}
    >
      <span className={cn(
        'w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold shrink-0',
        isWaitlist ? 'bg-amber-100 text-amber-600' : 'bg-orange-50 text-orange-600'
      )}>
        {isWaitlist ? `候${index + 1}` : index + 1}
      </span>
      <div className="flex-1 min-w-0">
        <span className="font-bold text-stone-800">
          {entry.name}
          {myIds.has(entry.id) && (
            <span className="ml-2 text-[10px] bg-orange-600 text-white px-2 py-0.5 rounded-full align-middle">我</span>
          )}
        </span>
        {entry.industry && (
          <p className="text-xs text-stone-400 truncate">{entry.industry}</p>
        )}
      </div>
    </li>
  );

  return (
    <div className="pt-24 min-h-screen bg-stone-50 pb-20">
      <div className="max-w-2xl mx-auto px-4 sm:px-6">
        <Link to={`/event/${event.id}`} className="inline-flex items-center gap-2 text-stone-400 hover:text-orange-600 mb-6 text-sm font-medium transition-colors">
          <ChevronRight className="w-4 h-4 rotate-180" /> 返回活動頁
        </Link>

        {/* 活動資訊卡 */}
        <div className="bg-gradient-to-br from-orange-600 via-rose-500 to-orange-500 rounded-3xl p-8 text-white shadow-xl shadow-orange-200 relative overflow-hidden">
          <div className="absolute -right-2 -top-4 text-7xl opacity-15 rotate-[-8deg] select-none">🍢🍻</div>
          <h1 className="text-2xl md:text-3xl font-bold mb-1">{event.title}</h1>
          <p className="text-orange-100 text-sm mb-6">報名接龍・名單即時公開</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <div className="flex items-center gap-2"><Calendar className="w-4 h-4 shrink-0 opacity-80" />{formatEventPeriod(event)}</div>
            {settings.event_time && <div className="flex items-center gap-2"><Clock className="w-4 h-4 shrink-0 opacity-80" />{settings.event_time}</div>}
            {settings.event_location && <div className="flex items-center gap-2"><MapPin className="w-4 h-4 shrink-0 opacity-80" />{settings.event_location}</div>}
            {settings.fee && <div className="flex items-center gap-2"><DollarSign className="w-4 h-4 shrink-0 opacity-80" />{settings.fee}</div>}
            {settings.event_address && <div className="flex items-center gap-2 sm:col-span-2"><MapPin className="w-4 h-4 shrink-0 opacity-80" />{settings.event_address}</div>}
          </div>
        </div>

        {/* 統計列 */}
        <div className="grid grid-cols-3 gap-3 mt-6">
          <div className="bg-white rounded-2xl border border-stone-100 p-4 text-center shadow-sm">
            <p className="text-2xl font-bold text-emerald-500">{confirmed.length}</p>
            <p className="text-xs text-stone-400 mt-1">正取</p>
          </div>
          <div className="bg-white rounded-2xl border border-stone-100 p-4 text-center shadow-sm">
            <p className={cn('text-2xl font-bold', isFull ? 'text-orange-500' : 'text-emerald-500')}>{isFull ? '滿' : remain}</p>
            <p className="text-xs text-stone-400 mt-1">{isFull ? '已額滿' : '剩餘名額'}</p>
          </div>
          <div className="bg-white rounded-2xl border border-stone-100 p-4 text-center shadow-sm">
            <p className="text-2xl font-bold text-amber-500">{waitlist.length}</p>
            <p className="text-xs text-stone-400 mt-1">候補</p>
          </div>
        </div>
        <div className="h-2.5 bg-orange-100 rounded-full overflow-hidden mt-3">
          <div
            className="h-full bg-gradient-to-r from-emerald-400 to-orange-500 rounded-full transition-all duration-500"
            style={{ width: `${capacity > 0 ? Math.min(100, (confirmed.length / capacity) * 100) : 0}%` }}
          />
        </div>

        {/* 報名表單 */}
        <div className="bg-white rounded-3xl border border-stone-100 shadow-sm p-6 md:p-8 mt-6">
          <h2 className="text-lg font-bold text-stone-900 mb-4">📝 我要報名</h2>
          {!settings.registration_open ? (
            <div className="bg-red-50 border border-red-100 text-red-500 rounded-2xl px-5 py-4 text-center text-sm font-medium">
              報名目前已關閉
            </div>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">姓名 <span className="text-orange-600">*</span></label>
                <input
                  value={name} onChange={e => setName(e.target.value)} maxLength={40} autoComplete="name"
                  placeholder="您的稱呼"
                  className="w-full px-4 py-3 rounded-xl border border-stone-200 outline-none focus:ring-2 focus:ring-orange-600 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">產業 / 品牌 <span className="text-orange-600">*</span></label>
                <input
                  value={industry} onChange={e => setIndustry(e.target.value)} maxLength={60}
                  placeholder="例如：西式外燴、室內設計…"
                  className="w-full px-4 py-3 rounded-xl border border-stone-200 outline-none focus:ring-2 focus:ring-orange-600 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">聯絡方式（電話或 Email）<span className="text-orange-600">*</span></label>
                <input
                  value={contact} onChange={e => setContact(e.target.value)} maxLength={80}
                  placeholder="僅主辦看得到，不會顯示在名單上"
                  className="w-full px-4 py-3 rounded-xl border border-stone-200 outline-none focus:ring-2 focus:ring-orange-600 focus:border-transparent"
                  required
                />
                <p className="text-xs text-stone-400 mt-2">🔒 聯絡方式不會公開，只有主辦匯出名單時看得到。</p>
              </div>
              {isFull && (
                <div className="bg-amber-50 border border-amber-100 text-amber-600 rounded-2xl px-4 py-3 text-xs">
                  ⚠️ 正取名額已滿，送出後將排入候補，若有人取消會自動遞補。
                </div>
              )}
              <button
                type="submit" disabled={submitting}
                className="w-full py-4 rounded-xl bg-gradient-to-r from-orange-600 to-rose-500 text-white font-bold text-lg shadow-lg shadow-orange-200 hover:opacity-90 transition-all disabled:opacity-50"
              >
                {submitting ? '送出中...' : isFull ? '排候補報名 ⏳' : '送出報名 🍢'}
              </button>
            </form>
          )}
        </div>

        {/* 我的報名 */}
        {mySignups.length > 0 && (
          <div className="bg-orange-50 border border-dashed border-orange-200 rounded-3xl p-6 mt-6">
            <h3 className="font-bold text-stone-800 mb-3">✅ 我的報名</h3>
            <div className="space-y-2">
              {mySignups.map(m => {
                const entry = entries.find(e => e.id === m.id);
                if (!entry) return null;
                return (
                  <div key={m.id} className="flex items-center gap-3">
                    <span className="flex-1 text-sm font-medium text-stone-700">
                      {entry.name}
                      <span className={cn(
                        'ml-2 text-[10px] px-2 py-0.5 rounded-full text-white',
                        entry.status === 'confirmed' ? 'bg-emerald-500' : 'bg-amber-500'
                      )}>
                        {entry.status === 'confirmed' ? '正取' : '候補'}
                      </span>
                    </span>
                    <button
                      onClick={() => handleCancel(m.id, m.cancel_token)}
                      className="text-xs font-bold text-red-500 border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
                    >
                      取消報名
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 正取名單 */}
        <div className="mt-8">
          <div className="flex items-center gap-2 mb-3 px-1">
            <h2 className="text-lg font-bold text-stone-900">🍻 報名接龍</h2>
            <span className="text-xs bg-white border border-stone-200 text-stone-500 px-2.5 py-0.5 rounded-full">{confirmed.length} 人</span>
          </div>
          <div className="bg-white rounded-3xl border border-stone-100 shadow-sm px-3 py-2">
            {confirmed.length > 0 ? (
              <ol>{confirmed.map((entry, i) => entryRow(entry, i, false))}</ol>
            ) : (
              <p className="text-center text-stone-400 text-sm py-10">還沒有人報名，搶頭香吧！</p>
            )}
          </div>
        </div>

        {/* 候補名單 */}
        {waitlist.length > 0 && (
          <div className="mt-8">
            <div className="flex items-center gap-2 mb-3 px-1">
              <h2 className="text-lg font-bold text-stone-900">⏳ 候補名單</h2>
              <span className="text-xs bg-white border border-stone-200 text-stone-500 px-2.5 py-0.5 rounded-full">{waitlist.length} 人</span>
            </div>
            <div className="bg-white rounded-3xl border border-stone-100 shadow-sm px-3 py-2">
              <ol>{waitlist.map((entry, i) => entryRow(entry, i, true))}</ol>
            </div>
          </div>
        )}

        <p className="text-center text-xs text-stone-400 mt-10">名單每 20 秒自動更新・食在俱樂部</p>
      </div>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            className={cn(
              'fixed bottom-8 left-1/2 -translate-x-1/2 z-[80] px-6 py-3 rounded-full text-white text-sm font-medium shadow-2xl max-w-[90vw]',
              toast.err ? 'bg-red-600' : 'bg-stone-900'
            )}
          >
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>
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

// ── 會員登入 ─────────────────────────────────────────────
const MemberLogin = () => {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate('/member');
    });
  }, []);

  const loginGoogle = async () => {
    setError('');
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/member` },
    });
    if (error) setError(error.message);
  };

  const loginEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/member` },
    });
    setLoading(false);
    if (error) setError(error.message);
    else setSent(true);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50 px-4 pt-16">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 border border-stone-100">
        <div className="text-center mb-8">
          <img src="/logo-mark.png" alt="食在俱樂部" className="h-10 w-auto mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-stone-900">會員登入 / 註冊</h2>
          <p className="text-stone-500 text-sm mt-1">加入食在俱樂部，搶先收到優惠與抽獎資訊</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm">{error}</div>
        )}

        {sent ? (
          <div className="p-6 bg-emerald-50 border border-emerald-100 rounded-xl text-center">
            <Mail className="w-10 h-10 text-emerald-600 mx-auto mb-3" />
            <p className="font-bold text-stone-800 mb-1">登入連結已寄出</p>
            <p className="text-sm text-stone-500">請到 <span className="font-medium">{email}</span> 收信，點擊信中連結即可登入。</p>
          </div>
        ) : (
          <>
            <button
              onClick={loginGoogle}
              className="w-full flex items-center justify-center gap-3 border border-stone-200 rounded-xl py-3 font-medium text-stone-700 hover:bg-stone-50 transition-colors mb-4"
            >
              <svg className="w-5 h-5" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.6 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C41.4 34.9 44 30 44 24c0-1.3-.1-2.3-.4-3.5z"/></svg>
              使用 Google 登入
            </button>

            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 h-px bg-stone-100" />
              <span className="text-xs text-stone-400">或用 Email</span>
              <div className="flex-1 h-px bg-stone-100" />
            </div>

            <form onSubmit={loginEmail} className="space-y-4">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-orange-600 outline-none"
                placeholder="you@example.com"
                required
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-orange-600 text-white py-3 rounded-xl font-bold hover:bg-orange-500 transition-all disabled:opacity-50"
              >
                {loading ? '寄送中...' : '寄送登入連結'}
              </button>
            </form>
            <p className="text-xs text-stone-400 mt-4 text-center">首次登入會自動建立會員帳號</p>
          </>
        )}
      </div>
    </div>
  );
};

// ── 會員中心 ─────────────────────────────────────────────
const MemberCenter = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [member, setMember] = useState<Member | null>(null);
  const [application, setApplication] = useState<MemberRoleApplication | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');

  // 個人資料表單
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [consent, setConsent] = useState(false);

  // 升級申請表單
  const [showApplyForm, setShowApplyForm] = useState(false);
  const [applyType, setApplyType] = useState<'creator' | 'business'>('creator');
  const [applyForm, setApplyForm] = useState({ real_name: '', contact_phone: '', company_name: '', tax_id: '', employee_count: '', company_address: '', note: '' });
  const [socialForm, setSocialForm] = useState<Record<string, { account: string; followers: string }>>(emptySocial() as any);
  const [applying, setApplying] = useState(false);

  const [lineMsg, setLineMsg] = useState('');

  const load = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { navigate('/member/login'); return; }
    const { data: m } = await supabase.from('members').select('*').eq('id', session.user.id).maybeSingle();
    if (m) {
      setMember(m as Member);
      setDisplayName(m.display_name || '');
      setPhone(m.phone || '');
      setConsent(!!m.marketing_consent);
    }
    const { data: apps } = await supabase.from('member_role_applications')
      .select('*').eq('user_id', session.user.id).order('created_at', { ascending: false }).limit(1);
    setApplication((apps && apps[0]) as MemberRoleApplication || null);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const p = new URLSearchParams(window.location.search);
    if (p.get('line') === 'ok') {
      setLineMsg('LINE 綁定成功！之後即可透過官方帳號收到通知。');
      window.history.replaceState({}, '', '/member');
    }
    // 登入過期 / 登出 → 自動導回會員登入頁
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || (event === 'INITIAL_SESSION' && !session)) {
        navigate('/member/login');
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const bindLine = () => {
    const redirectUri = `${window.location.origin}/member/line-callback`;
    const state = Math.random().toString(36).slice(2) + Date.now().toString(36);
    sessionStorage.setItem('line_bind_state', state);
    const url = `https://access.line.me/oauth2/v2.1/authorize?response_type=code`
      + `&client_id=${LINE_LOGIN_CHANNEL_ID}`
      + `&redirect_uri=${encodeURIComponent(redirectUri)}`
      + `&state=${state}`
      + `&scope=${encodeURIComponent('profile openid')}`
      + `&bot_prompt=aggressive`;
    window.location.href = url;
  };

  const unbindLine = async () => {
    if (!window.confirm('確定要解除 LINE 綁定嗎？解除後將無法透過官方帳號收到專屬通知。')) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { navigate('/member/login'); return; }
    const { error } = await supabase.functions.invoke('line-bind', { body: { action: 'unbind' } });
    if (error) { alert('解除失敗，請稍後再試'); return; }
    setLineMsg('');
    load();
  };

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!member) return;
    setSaving(true);
    setSavedMsg('');
    const { error } = await supabase.from('members')
      .update({ display_name: displayName, phone, marketing_consent: consent })
      .eq('id', member.id);
    setSaving(false);
    if (error) alert(`儲存失敗: ${error.message}`);
    else { setSavedMsg('已儲存'); setTimeout(() => setSavedMsg(''), 2000); }
  };

  const submitApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!member) return;
    // 只保留有填帳號的平台
    const social = Object.fromEntries(
      SOCIAL_PLATFORMS
        .map((p) => [p.key, socialForm[p.key]])
        .filter(([, v]: any) => (v.account || '').trim() || (v.followers || '').trim())
        .map(([k, v]: any) => [k, { account: (v.account || '').trim(), followers: (v.followers || '').trim() }])
    );
    if (applyType === 'creator' && Object.keys(social).length === 0) {
      alert('請至少填寫一個社群平台帳號');
      return;
    }
    setApplying(true);
    const payload = {
      user_id: member.id,
      requested_type: applyType,
      status: 'pending' as const,
      real_name: applyForm.real_name || null,
      contact_phone: applyForm.contact_phone || null,
      social_accounts: applyType === 'creator' ? social : null,
      company_name: applyType === 'business' ? (applyForm.company_name || null) : null,
      tax_id: applyType === 'business' ? (applyForm.tax_id || null) : null,
      employee_count: applyType === 'business' ? (applyForm.employee_count || null) : null,
      company_address: applyType === 'business' ? (applyForm.company_address || null) : null,
      note: applyForm.note || null,
    };
    const { error } = await supabase.from('member_role_applications').insert([payload]);
    setApplying(false);
    if (error) { alert(`送出失敗: ${error.message}`); return; }
    setShowApplyForm(false);
    setSocialForm(emptySocial() as any);
    load();
  };

  const logout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  if (loading) return <div className="pt-32 text-center text-stone-400">載入中...</div>;
  if (!member) return <div className="pt-32 text-center text-stone-400">找不到會員資料</div>;

  const statusText: Record<string, string> = { pending: '審核中', approved: '已通過', rejected: '未通過' };
  const statusColor: Record<string, string> = { pending: 'bg-amber-100 text-amber-700', approved: 'bg-emerald-100 text-emerald-700', rejected: 'bg-red-100 text-red-600' };

  return (
    <div className="pt-24 pb-20 bg-stone-50 min-h-screen">
      <div className="max-w-2xl mx-auto px-4">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-stone-900">會員中心</h1>
          <button onClick={logout} className="flex items-center gap-1.5 text-sm text-stone-500 hover:text-red-600 transition-colors">
            <LogOut className="w-4 h-4" /> 登出
          </button>
        </div>

        {lineMsg && (
          <div className="mb-6 p-4 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-700 text-sm flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 shrink-0" /> {lineMsg}
          </div>
        )}

        {/* 身分卡 */}
        <div className="bg-white rounded-3xl shadow-sm border border-stone-100 p-6 mb-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-orange-100 flex items-center justify-center">
              <User className="w-7 h-7 text-orange-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-stone-900 truncate">{member.display_name || '會員'}</p>
              <p className="text-sm text-stone-400 truncate">{member.email}</p>
            </div>
            <span className={cn('px-3 py-1 rounded-full text-xs font-bold shrink-0', memberTypeBadge(member.member_type))}>
              {memberTypeLabel(member.member_type)}
            </span>
          </div>
        </div>

        {/* LINE 綁定 */}
        <div className="bg-white rounded-3xl shadow-sm border border-stone-100 p-6 mb-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 rounded-full bg-[#06C755] flex items-center justify-center shrink-0">
                <MessageCircle className="w-6 h-6 text-white" />
              </div>
              <div className="min-w-0">
                <p className="font-bold text-stone-800">綁定官方 LINE</p>
                <p className="text-sm text-stone-400">
                  {member.line_user_id ? '已綁定，可收到專屬優惠與抽獎通知' : '綁定後即可收到食在俱樂部的專屬通知'}
                </p>
              </div>
            </div>
            {member.line_user_id ? (
              <div className="flex items-center gap-3 shrink-0">
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> 已綁定
                </span>
                <button onClick={unbindLine} className="text-sm text-stone-400 hover:text-red-600 flex items-center gap-1 transition-colors">
                  <Unlink className="w-4 h-4" /> 解除
                </button>
              </div>
            ) : (
              <button onClick={bindLine} className="bg-[#06C755] text-white px-5 py-2.5 rounded-xl font-bold hover:brightness-95 transition-all flex items-center gap-2 shrink-0">
                <MessageCircle className="w-4 h-4" /> 綁定 LINE
              </button>
            )}
          </div>
        </div>

        {/* 個人資料 */}
        <form onSubmit={saveProfile} className="bg-white rounded-3xl shadow-sm border border-stone-100 p-6 mb-6 space-y-5">
          <h2 className="font-bold text-stone-800">個人資料</h2>
          <div>
            <label className="block text-sm font-medium text-stone-600 mb-2">暱稱 / 姓名</label>
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-stone-200 outline-none focus:ring-2 focus:ring-orange-600" />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-600 mb-2">聯絡電話</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-stone-200 outline-none focus:ring-2 focus:ring-orange-600" placeholder="0912-345-678" />
          </div>
          <label className="flex items-start gap-3 p-3 rounded-xl bg-stone-50 cursor-pointer">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="w-4 h-4 accent-orange-600 mt-0.5" />
            <span className="text-sm text-stone-600">我願意收到食在俱樂部的優惠、活動與抽獎資訊</span>
          </label>
          <div className="flex items-center gap-3">
            <button type="submit" disabled={saving} className="bg-orange-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-orange-500 transition-colors disabled:opacity-50">
              {saving ? '儲存中...' : '儲存'}
            </button>
            {savedMsg && <span className="text-emerald-600 text-sm flex items-center gap-1"><CheckCircle2 className="w-4 h-4" />{savedMsg}</span>}
          </div>
        </form>

        {/* 會員身分升級 */}
        <div className="bg-white rounded-3xl shadow-sm border border-stone-100 p-6">
          <h2 className="font-bold text-stone-800 mb-1">會員身分</h2>
          <p className="text-sm text-stone-400 mb-4">升級為創作者或企業團體，享有專屬合作與活動機會（需審核）</p>

          {member.member_type !== 'general' ? (
            <div className="p-4 rounded-xl bg-emerald-50 text-emerald-700 text-sm flex items-center gap-2">
              <ShieldCheck className="w-5 h-5" /> 您目前為「{memberTypeLabel(member.member_type)}」身分
            </div>
          ) : application && application.status === 'pending' ? (
            <div className="p-4 rounded-xl bg-amber-50 text-amber-700 text-sm">
              您的「{memberTypeLabel(application.requested_type)}」申請審核中，我們會盡快處理。
            </div>
          ) : (
            <>
              {application && (
                <div className={cn('p-3 rounded-xl text-sm mb-4', statusColor[application.status])}>
                  上次「{memberTypeLabel(application.requested_type)}」申請：{statusText[application.status]}
                  {application.review_note ? `（${application.review_note}）` : ''}
                </div>
              )}
              {!showApplyForm ? (
                <button onClick={() => setShowApplyForm(true)} className="border border-orange-200 text-orange-600 px-5 py-2.5 rounded-xl font-bold hover:bg-orange-50 transition-colors">
                  申請升級身分
                </button>
              ) : (
                <form onSubmit={submitApplication} className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    {(['creator', 'business'] as const).map((t) => (
                      <button
                        type="button"
                        key={t}
                        onClick={() => setApplyType(t)}
                        className={cn('px-4 py-3 rounded-xl border text-sm font-bold transition-colors flex items-center justify-center gap-2',
                          applyType === t ? 'border-orange-600 bg-orange-50 text-orange-700' : 'border-stone-200 text-stone-500 hover:bg-stone-50')}
                      >
                        {t === 'creator' ? <Sparkles className="w-4 h-4" /> : <Building2 className="w-4 h-4" />}
                        {memberTypeLabel(t)}
                      </button>
                    ))}
                  </div>
                  <input value={applyForm.real_name} onChange={(e) => setApplyForm({ ...applyForm, real_name: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border border-stone-200 outline-none focus:ring-2 focus:ring-orange-600" placeholder="真實姓名 / 聯絡人" required />
                  <input value={applyForm.contact_phone} onChange={(e) => setApplyForm({ ...applyForm, contact_phone: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border border-stone-200 outline-none focus:ring-2 focus:ring-orange-600" placeholder="聯絡電話" required />
                  {applyType === 'creator' ? (
                    <div className="space-y-2">
                      <p className="text-xs text-stone-400">社群平台（有經營的填寫即可，至少一項）</p>
                      {SOCIAL_PLATFORMS.map((p) => (
                        <div key={p.key} className="grid grid-cols-2 gap-2">
                          <input value={socialForm[p.key].account} onChange={(e) => setSocialForm({ ...socialForm, [p.key]: { ...socialForm[p.key], account: e.target.value } })} className="px-3 py-2 rounded-xl border border-stone-200 outline-none focus:ring-2 focus:ring-orange-600 text-sm" placeholder={`${p.label} 帳號`} />
                          <input value={socialForm[p.key].followers} onChange={(e) => setSocialForm({ ...socialForm, [p.key]: { ...socialForm[p.key], followers: e.target.value } })} className="px-3 py-2 rounded-xl border border-stone-200 outline-none focus:ring-2 focus:ring-orange-600 text-sm" placeholder={`${p.label} 粉絲數`} />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <>
                      <input value={applyForm.company_name} onChange={(e) => setApplyForm({ ...applyForm, company_name: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border border-stone-200 outline-none focus:ring-2 focus:ring-orange-600" placeholder="公司 / 團體名稱" required />
                      <input value={applyForm.tax_id} onChange={(e) => setApplyForm({ ...applyForm, tax_id: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border border-stone-200 outline-none focus:ring-2 focus:ring-orange-600" placeholder="統一編號（選填）" />
                      <input value={applyForm.employee_count} onChange={(e) => setApplyForm({ ...applyForm, employee_count: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border border-stone-200 outline-none focus:ring-2 focus:ring-orange-600" placeholder="員工數（例：50 人 / 50-100 人）" />
                      <input value={applyForm.company_address} onChange={(e) => setApplyForm({ ...applyForm, company_address: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border border-stone-200 outline-none focus:ring-2 focus:ring-orange-600" placeholder="公司地址" />
                    </>
                  )}
                  <textarea value={applyForm.note} onChange={(e) => setApplyForm({ ...applyForm, note: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border border-stone-200 outline-none focus:ring-2 focus:ring-orange-600 h-20" placeholder="補充說明（選填）" />
                  <div className="flex gap-3">
                    <button type="button" onClick={() => setShowApplyForm(false)} className="flex-1 px-4 py-2.5 rounded-xl border border-stone-200 font-bold hover:bg-stone-50">取消</button>
                    <button type="submit" disabled={applying} className="flex-1 px-4 py-2.5 rounded-xl bg-orange-600 text-white font-bold hover:bg-orange-500 disabled:opacity-50">{applying ? '送出中...' : '送出申請'}</button>
                  </div>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// ── LINE 綁定回呼 ─────────────────────────────────────────
const LineCallback = () => {
  const navigate = useNavigate();
  const [err, setErr] = useState('');

  useEffect(() => {
    (async () => {
      const p = new URLSearchParams(window.location.search);
      const code = p.get('code');
      const state = p.get('state');
      if (p.get('error')) { setErr(`已取消或被拒絕：${p.get('error_description') || p.get('error')}`); return; }
      const saved = sessionStorage.getItem('line_bind_state');
      if (!code || !state || !saved || state !== saved) { setErr('驗證失敗，請重新綁定'); return; }
      sessionStorage.removeItem('line_bind_state');

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate('/member/login'); return; }

      const redirect_uri = `${window.location.origin}/member/line-callback`;
      const { data, error } = await supabase.functions.invoke('line-bind', { body: { code, redirect_uri } });
      if (error) {
        let m = '綁定失敗，請稍後再試';
        try { const b = await (error as any).context.json(); if (b?.error) m = b.error; } catch { /* ignore */ }
        setErr(m);
        return;
      }
      if (data?.error) { setErr(data.error); return; }
      navigate('/member?line=ok');
    })();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50 px-4 pt-16">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 border border-stone-100 text-center">
        {err ? (
          <>
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
              <X className="w-6 h-6 text-red-500" />
            </div>
            <p className="font-bold text-stone-800 mb-2">綁定未完成</p>
            <p className="text-sm text-stone-500 mb-6">{err}</p>
            <button onClick={() => navigate('/member')} className="bg-orange-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-orange-500 transition-colors">
              返回會員中心
            </button>
          </>
        ) : (
          <>
            <div className="w-12 h-12 rounded-full bg-[#06C755]/10 flex items-center justify-center mx-auto mb-4 animate-pulse">
              <MessageCircle className="w-6 h-6 text-[#06C755]" />
            </div>
            <p className="font-bold text-stone-800">LINE 綁定處理中...</p>
            <p className="text-sm text-stone-400 mt-1">請稍候，不要關閉此頁</p>
          </>
        )}
      </div>
    </div>
  );
};

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
const GOOGLE_MAPS_MAP_ID = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID || 'DEMO_MAP_ID';

import { TAIWAN_DISTRICTS } from './constants/taiwanDistricts';


// 單一店家標記（品牌 logo pin / 一般 Pin）
const LocationMarker = ({ loc, onSelect }: { loc: Location; onSelect: (loc: Location) => void }) => {
  const isEventParticipant = loc.location_events && loc.location_events.length > 0;
  const brand = loc.brand;
  const pinColor = loc.category === 'BBQ' ? '#ef4444' : loc.category === 'Hotpot' ? '#f97316' : loc.category === 'Drink' ? '#06b6d4' : '#ea580c';
  return (
    <AdvancedMarker
      position={{ lat: loc.lat, lng: loc.lng }}
      onClick={() => onSelect(loc)}
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
};

// 地圖標記層：只渲染目前視窗內的店家，低縮放時做網格聚合
// （純前端計算，不依賴 MarkerClusterer — 該套件與 @vis.gl 有執行時衝突）
const CLUSTER_MAX_ZOOM = 13; // 縮放 >= 此值時顯示個別標記
const MapMarkers = ({ locations, onSelect }: { locations: Location[]; onSelect: (loc: Location) => void }) => {
  const map = useMap();
  const [view, setView] = useState<{ zoom: number; bounds: google.maps.LatLngBounds | null }>({ zoom: 14, bounds: null });

  useEffect(() => {
    if (!map) return;
    const update = () => setView({ zoom: map.getZoom() ?? 14, bounds: map.getBounds() ?? null });
    update();
    const listener = map.addListener('idle', update);
    return () => listener.remove();
  }, [map]);

  const visible = useMemo(
    () => (view.bounds ? locations.filter((l) => view.bounds!.contains({ lat: l.lat, lng: l.lng })) : locations),
    [locations, view]
  );

  const clusters = useMemo(() => {
    if (view.zoom >= CLUSTER_MAX_ZOOM) return null;
    const cell = 360 / Math.pow(2, view.zoom + 3); // 網格隨縮放變細
    const groups = new globalThis.Map<string, Location[]>();
    visible.forEach((l) => {
      const key = `${Math.round(l.lat / cell)}_${Math.round(l.lng / cell)}`;
      const g = groups.get(key);
      if (g) g.push(l); else groups.set(key, [l]);
    });
    return [...groups.values()];
  }, [visible, view.zoom]);

  if (!clusters) {
    return <>{visible.map((loc) => <LocationMarker key={loc.id} loc={loc} onSelect={onSelect} />)}</>;
  }
  return (
    <>
      {clusters.map((group) => {
        if (group.length === 1) return <LocationMarker key={group[0].id} loc={group[0]} onSelect={onSelect} />;
        const lat = group.reduce((s, l) => s + l.lat, 0) / group.length;
        const lng = group.reduce((s, l) => s + l.lng, 0) / group.length;
        return (
          <AdvancedMarker
            key={`cluster_${group[0].id}`}
            position={{ lat, lng }}
            zIndex={20}
            onClick={() => {
              map?.panTo({ lat, lng });
              map?.setZoom(Math.min(view.zoom + 2, CLUSTER_MAX_ZOOM));
            }}
          >
            <div className="w-10 h-10 rounded-full bg-orange-600 text-white font-bold text-sm flex items-center justify-center shadow-lg border-2 border-white cursor-pointer">
              {group.length}
            </div>
          </AdvancedMarker>
        );
      })}
    </>
  );
};

const MapPage = () => {
  const [selectedShop, setSelectedShop] = useState<Location | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('全部');
  const [activeCity, setActiveCity] = useState<string>('全部');
  const [activeDistrict, setActiveDistrict] = useState<string>('全部');
  const [filterEventOnly, setFilterEventOnly] = useState(false);
  const LIST_PAGE_SIZE = 24;
  const [listLimit, setListLimit] = useState(LIST_PAGE_SIZE);

  const { data: locations = [], isLoading: loadingLocations, refetch } = useQuery({
    queryKey: ['map-locations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('locations')
        .select('*, location_events(event_id, events(id, title, type)), brand:brands(id, name, logo_url)');
      if (error) throw error;
      return (data as Location[]) || [];
    },
  });

  const handleRefresh = () => refetch();

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
    setListLimit(LIST_PAGE_SIZE); // 篩選變更時重設清單顯示數量
  }, [activeCategory, activeCity, activeDistrict, filterEventOnly]);

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
              <MapMarkers locations={filteredLocations} onSelect={setSelectedShop} />
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
            ) : filteredLocations.slice(0, listLimit).map((loc) => (
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
                    {loc.location_events?.map((le) => le.events).filter((ev) => !!ev).map((ev) => (
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
                  {loc.brand && (
                    <div className="flex items-center gap-1.5 mb-2">
                      {loc.brand.logo_url && (
                        <SafeImage src={loc.brand.logo_url} alt={loc.brand.name}
                          className="w-4 h-4 rounded-full object-cover" fallback={DEFAULT_LOGO} />
                      )}
                      <span className="text-xs font-bold text-orange-600">{loc.brand.name}</span>
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

          {filteredLocations.length > listLimit && (
            <div className="text-center">
              <button
                onClick={() => setListLimit(listLimit + LIST_PAGE_SIZE)}
                className="px-8 py-3 bg-white border border-stone-200 rounded-xl text-stone-700 font-bold text-sm hover:border-orange-600 hover:text-orange-600 transition-all"
              >
                載入更多（還有 {filteredLocations.length - listLimit} 家）
              </button>
            </div>
          )}

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
  const { data: partners = [] } = useQuery({
    queryKey: ['partners'],
    queryFn: async () => {
      const { data } = await supabase.from('partners').select('*').order('sort_order', { ascending: true });
      return (data as Partner[]) || [];
    },
  });

  return (
    <div className="pt-24 min-h-screen bg-stone-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-12 text-center">
          <h1 className="text-4xl font-bold text-stone-900 mb-4">贊助夥伴</h1>
          <p className="text-stone-500 max-w-2xl mx-auto">感謝所有支持「食在俱樂部」的夥伴，因為有你們，美食的力量才能傳遞得更遠。</p>
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

const REVIEWS_PAGE_SIZE = 12;

const KOLReviewsPage = () => {
  const [reviews, setReviews] = useState<KOLReview[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<KOLReview | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchPage = async (offset: number) => {
    const { data } = await supabase
      .from('kol_reviews')
      .select('*, brand:brands(name, logo_url)')
      .order('created_at', { ascending: false })
      .range(offset, offset + REVIEWS_PAGE_SIZE - 1);
    const page = (data as KOLReview[]) || [];
    setReviews((prev) => (offset === 0 ? page : [...prev, ...page]));
    setHasMore(page.length === REVIEWS_PAGE_SIZE);
  };

  useEffect(() => {
    fetchPage(0);
  }, []);

  const handleLoadMore = async () => {
    setLoadingMore(true);
    await fetchPage(reviews.length);
    setLoadingMore(false);
  };

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
                  <span>{new Date(review.created_at).toLocaleDateString('zh-TW', { timeZone: 'Asia/Taipei' })}</span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {hasMore && (
          <div className="text-center mt-12">
            <button
              onClick={handleLoadMore}
              disabled={loadingMore}
              className="px-8 py-3 bg-white border border-stone-200 rounded-xl text-stone-700 font-bold text-sm hover:border-orange-600 hover:text-orange-600 transition-all disabled:opacity-50"
            >
              {loadingMore ? '載入中...' : '載入更多'}
            </button>
          </div>
        )}
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
  const { data: promotions = [] } = useQuery({
    queryKey: ['promotions'],
    queryFn: async () => {
      const { data } = await supabase
        .from('promotions')
        .select('*, brand:brands(name, logo_url)')
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      return (data as Promotion[]) || [];
    },
  });

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
  const [activeTab, setActiveTab] = useState<'events' | 'brands' | 'partners' | 'locations' | 'kol_reviews' | 'promotions' | 'members' | 'draws' | 'accounts'>('events');
  const [draws, setDraws] = useState<Draw[]>([]);
  const [drawWinners, setDrawWinners] = useState<Record<string, DrawWinner[]>>({});
  const [drawForm, setDrawForm] = useState<{ title: string; prize: string; pool: DrawPool; event_id: string; winner_count: string }>({ title: '', prize: '', pool: 'all_members', event_id: '', winner_count: '1' });
  const [drawBusy, setDrawBusy] = useState(false);
  const [adminMembers, setAdminMembers] = useState<Member[]>([]);
  const [memberApplications, setMemberApplications] = useState<MemberRoleApplication[]>([]);
  const [memberTypeFilter, setMemberTypeFilter] = useState<'all' | MemberType>('all');
  const [viewingMember, setViewingMember] = useState<Member | null>(null);
  const [pushMessage, setPushMessage] = useState('');
  const [pushTarget, setPushTarget] = useState<'all' | MemberType>('all');
  const [pushSending, setPushSending] = useState(false);
  const [pushMode, setPushMode] = useState<'text' | 'card'>('text');
  const [pushCard, setPushCard] = useState({ imageUrl: '', title: '', text: '', buttonLabel: '', buttonUrl: '' });
  const [pushWhen, setPushWhen] = useState<'now' | 'schedule'>('now');
  const [pushScheduleAt, setPushScheduleAt] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [emailImage, setEmailImage] = useState('');
  const [emailTarget, setEmailTarget] = useState<'all' | MemberType>('all');
  const [emailSending, setEmailSending] = useState(false);
  const [emailWhen, setEmailWhen] = useState<'now' | 'schedule'>('now');
  const [emailScheduleAt, setEmailScheduleAt] = useState('');
  const [campaigns, setCampaigns] = useState<MessageCampaign[]>([]);
  const [adminRole, setAdminRole] = useState<'owner' | 'editor' | null>(null);
  const [myUserId, setMyUserId] = useState<string>('');
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [allEvents, setAllEvents] = useState<Event[]>([]);
  const [allBrands, setAllBrands] = useState<Brand[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [brandCategoryTab, setBrandCategoryTab] = useState('');
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

  // 報名接龍管理 modal
  const [showSignupAdminModal, setShowSignupAdminModal] = useState(false);
  const [signupAdminEvent, setSignupAdminEvent] = useState<Event | null>(null);
  const [signupAdminSettings, setSignupAdminSettings] = useState<SignupSettings | null>(null);
  const [signupAdminEntries, setSignupAdminEntries] = useState<SignupEntry[]>([]);
  const [signupAdminForm, setSignupAdminForm] = useState({ capacity: '40', fee: '', event_time: '', event_location: '', event_address: '' });
  const [savingSignupAdmin, setSavingSignupAdmin] = useState(false);
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
  // 活動 modal 內勾選要顯示的品牌與贊助夥伴（多對多）
  const [allPartners, setAllPartners] = useState<Partner[]>([]);
  const [eventBrandIds, setEventBrandIds] = useState<string[]>([]);
  const [eventPartnerIds, setEventPartnerIds] = useState<string[]>([]);

  const [imageUrl, setImageUrl] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  
  const navigate = useNavigate();

  const [editorContent, setEditorContent] = useState('');

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate('/login'); return; }
      setMyUserId(session.user.id);
      const { data: me } = await supabase.from('admin_users').select('role').eq('user_id', session.user.id).maybeSingle();
      if (!me) {
        alert('此帳號沒有管理權限，請聯絡管理員。');
        await supabase.auth.signOut();
        navigate('/login');
        return;
      }
      setAdminRole(me.role as 'owner' | 'editor');
    };
    checkAuth();
    fetchData();
    fetchAllEvents();
    fetchAllBrands();
    fetchAllPartners();
  }, [activeTab]);

  // 登入過期 / 登出 → 自動導回登入頁（避免停在後台卻無法操作）
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || (event === 'INITIAL_SESSION' && !session)) {
        navigate('/login');
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const fetchAllEvents = async () => {
    const { data } = await supabase.from('events').select('id, title').order('created_at', { ascending: false });
    if (data) setAllEvents(data as any);
  };

  const fetchAllBrands = async () => {
    const { data } = await supabase.from('brands').select('id, name, category').order('category', { ascending: true }).order('name', { ascending: true });
    if (data) setAllBrands(data as any);
  };

  const fetchAllPartners = async () => {
    const { data } = await supabase.from('partners').select('id, name').order('sort_order', { ascending: true }).order('name', { ascending: true });
    if (data) setAllPartners(data as any);
  };

  useEffect(() => {
    if (editingEvent) {
      setEditorContent(editingEvent.content || '');
      setImageUrl(editingEvent.image_url || '');
      supabase.from('brand_events').select('brand_id').eq('event_id', editingEvent.id)
        .then(({ data }) => { setEventBrandIds(data?.map(r => r.brand_id) || []); });
      supabase.from('partner_events').select('partner_id').eq('event_id', editingEvent.id)
        .then(({ data }) => { setEventPartnerIds(data?.map(r => r.partner_id) || []); });
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
      setEventBrandIds([]);
      setEventPartnerIds([]);
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
        const { data, error } = await supabase.from('brands').select('*').order('category', { ascending: true }).order('name', { ascending: true });
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
      } else if (activeTab === 'members') {
        const { data: membersData, error } = await supabase.from('members').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        if (membersData) setAdminMembers(membersData as any);
        const { data: appsData } = await supabase.from('member_role_applications')
          .select('*').order('created_at', { ascending: false });
        if (appsData) setMemberApplications(appsData as any);
        const { data: campData } = await supabase.from('message_campaigns')
          .select('*').order('created_at', { ascending: false }).limit(30);
        if (campData) setCampaigns(campData as any);
      } else if (activeTab === 'draws') {
        const { data: drawsData, error } = await supabase.from('draws').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        if (drawsData) setDraws(drawsData as any);
        const { data: winnersData } = await supabase.from('draw_winners').select('*').order('created_at', { ascending: true });
        const grouped: Record<string, DrawWinner[]> = {};
        (winnersData || []).forEach((w: any) => { (grouped[w.draw_id] = grouped[w.draw_id] || []).push(w); });
        setDrawWinners(grouped);
      }
    } catch (error: any) {
      console.error(`讀取 ${activeTab} 資料失敗:`, error);
      alert(`讀取資料失敗: ${error.message || '未知錯誤'}`);
    }
  };

  const handleReviewApplication = async (appId: string, approve: boolean) => {
    const note = approve ? undefined : (window.prompt('未通過原因（會顯示給會員，可留空）：') ?? undefined);
    const { error } = await supabase.rpc('member_review_application', { app_id: appId, approve, p_review_note: note || null });
    if (error) { alert(`審核失敗: ${error.message}`); return; }
    fetchData();
  };

  const pushRecipientCount = adminMembers.filter(m =>
    m.line_user_id && m.marketing_consent && (pushTarget === 'all' || m.member_type === pushTarget)
  ).length;

  // 排程：寫入 message_campaigns（status=scheduled），由 campaign-run 到期執行
  const scheduleCampaign = async (channel: 'line' | 'email', member_type: string, title: string, payload: any, recipientCount: number, whenStr: string) => {
    if (!whenStr) { alert('請選擇排程時間'); return false; }
    const at = new Date(whenStr);
    if (isNaN(at.getTime()) || at.getTime() < Date.now() + 30_000) { alert('排程時間需在未來（至少 1 分鐘後）'); return false; }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { alert('登入已過期，請重新登入'); navigate('/login'); return false; }
    const { error } = await supabase.from('message_campaigns').insert({
      channel, status: 'scheduled', member_type, title, payload,
      recipient_count: recipientCount, scheduled_at: at.toISOString(), created_by: session.user.id,
    });
    if (error) { alert(`排程失敗: ${error.message}`); return false; }
    alert(`已排程於 ${at.toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })} 寄送`);
    return true;
  };

  const cancelCampaign = async (id: string) => {
    if (!window.confirm('確定取消此排程？')) return;
    const { error } = await supabase.from('message_campaigns').update({ status: 'canceled' }).eq('id', id).eq('status', 'scheduled');
    if (error) { alert(`取消失敗: ${error.message}`); return; }
    fetchData();
  };

  const handleSendLinePush = async () => {
    let cPayload: any; let title: string;
    if (pushMode === 'card') {
      if (!pushCard.title.trim()) { alert('請輸入卡片標題'); return; }
      if (!pushCard.buttonLabel.trim() || !pushCard.buttonUrl.trim()) { alert('請填寫按鈕文字與連結'); return; }
      cPayload = { mode: 'card', card: pushCard };
      title = pushCard.title.trim();
    } else {
      if (!pushMessage.trim()) { alert('請輸入訊息內容'); return; }
      cPayload = { mode: 'text', message: pushMessage.trim() };
      title = pushMessage.trim().slice(0, 60);
    }
    if (pushRecipientCount === 0) { alert('目前沒有符合條件的收件對象（需已綁定 LINE 且同意行銷）'); return; }

    if (pushWhen === 'schedule') {
      const ok = await scheduleCampaign('line', pushTarget, title, cPayload, pushRecipientCount, pushScheduleAt);
      if (!ok) return;
      setPushMessage('');
      setPushCard({ imageUrl: '', title: '', text: '', buttonLabel: '', buttonUrl: '' });
      setPushScheduleAt(''); setPushWhen('now');
      fetchData();
      return;
    }

    if (!window.confirm(`確定發送給 ${pushRecipientCount} 位「已綁定 LINE 且同意行銷」的會員嗎？\n此動作會消耗官方帳號的推播訊息額度，且無法收回。`)) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { alert('登入已過期，請重新登入'); navigate('/login'); return; }
    setPushSending(true);
    const { data, error } = await supabase.functions.invoke('line-push', { body: { ...cPayload, member_type: pushTarget } });
    setPushSending(false);
    if (error) {
      let m = '發送失敗，請稍後再試';
      try { const b = await (error as any).context.json(); if (b?.error) m = b.error; } catch { /* ignore */ }
      alert(m);
      return;
    }
    if (data?.error) { alert(data.error); return; }
    alert(`已送出：成功 ${data.sent} 位${data.failed ? `，失敗 ${data.failed} 位` : ''}`);
    setPushMessage('');
    setPushCard({ imageUrl: '', title: '', text: '', buttonLabel: '', buttonUrl: '' });
    fetchData();
  };

  const emailRecipientCount = adminMembers.filter(m =>
    m.email && m.marketing_consent && (emailTarget === 'all' || m.member_type === emailTarget)
  ).length;

  const handleSendEmail = async () => {
    if (!emailSubject.trim()) { alert('請輸入主旨'); return; }
    if (!emailBody.trim()) { alert('請輸入內容'); return; }
    if (emailRecipientCount === 0) { alert('目前沒有符合條件的收件對象（需有 Email 且同意行銷）'); return; }

    if (emailWhen === 'schedule') {
      const ok = await scheduleCampaign('email', emailTarget, emailSubject.trim(),
        { subject: emailSubject.trim(), body: emailBody, image_url: emailImage }, emailRecipientCount, emailScheduleAt);
      if (!ok) return;
      setEmailSubject(''); setEmailBody(''); setEmailImage(''); setEmailScheduleAt(''); setEmailWhen('now');
      fetchData();
      return;
    }

    if (!window.confirm(`確定寄送給 ${emailRecipientCount} 位「有 Email 且同意行銷」的會員嗎？`)) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { alert('登入已過期，請重新登入'); navigate('/login'); return; }
    setEmailSending(true);
    const { data, error } = await supabase.functions.invoke('email-send', { body: { subject: emailSubject.trim(), body: emailBody, image_url: emailImage, member_type: emailTarget } });
    setEmailSending(false);
    if (error) {
      let m = '寄送失敗，請稍後再試';
      try { const b = await (error as any).context.json(); if (b?.error) m = b.error; } catch { /* ignore */ }
      alert(m);
      return;
    }
    if (data?.error) { alert(data.error); return; }
    alert(`已寄送：成功 ${data.sent} 封${data.failed ? `，失敗 ${data.failed} 封` : ''}`);
    setEmailSubject('');
    setEmailBody('');
    setEmailImage('');
    fetchData();
  };

  const exportMembersCsv = () => {
    const rows = adminMembers
      .filter(m => memberTypeFilter === 'all' || m.member_type === memberTypeFilter)
      .map(m => [m.display_name || '', m.email || '', m.phone || '', memberTypeLabel(m.member_type), m.marketing_consent ? '是' : '否', new Date(m.created_at).toLocaleDateString('zh-TW', { timeZone: 'Asia/Taipei' })]);
    const header = ['暱稱', 'Email', '電話', '身分', '行銷同意', '註冊日'];
    const csv = [header, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `members_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── 抽獎 ──
  const createDraw = async () => {
    if (!drawForm.title.trim()) { alert('請輸入抽獎標題'); return; }
    if (drawForm.pool === 'event_signup' && !drawForm.event_id) { alert('請選擇活動（報名者抽獎）'); return; }
    const n = parseInt(drawForm.winner_count) || 1;
    setDrawBusy(true);
    const { error } = await supabase.from('draws').insert([{
      title: drawForm.title.trim(),
      prize: drawForm.prize.trim() || null,
      pool: drawForm.pool,
      event_id: drawForm.pool === 'event_signup' ? drawForm.event_id : null,
      winner_count: Math.min(Math.max(n, 1), 1000),
    }]);
    setDrawBusy(false);
    if (error) { alert(`建立失敗: ${error.message}`); return; }
    setDrawForm({ title: '', prize: '', pool: 'all_members', event_id: '', winner_count: '1' });
    fetchData();
  };

  const runDraw = async (d: Draw) => {
    if (!window.confirm(`確定要開獎「${d.title}」嗎？將隨機抽出 ${d.winner_count} 位。`)) return;
    setDrawBusy(true);
    const { data, error } = await supabase.rpc('draw_run', { p_draw_id: d.id });
    setDrawBusy(false);
    if (error) { alert(`開獎失敗: ${error.message}`); return; }
    alert(`已抽出 ${data} 位中獎者${data < d.winner_count ? '（抽獎池人數不足，已全部抽出）' : ''}`);
    fetchData();
  };

  const resetDraw = async (d: Draw) => {
    if (!window.confirm(`確定要「重抽」嗎？將清除「${d.title}」目前的中獎名單並回到未開獎。`)) return;
    const { error } = await supabase.rpc('draw_reset', { p_draw_id: d.id });
    if (error) { alert(`重抽失敗: ${error.message}`); return; }
    fetchData();
  };

  const deleteDraw = async (d: Draw) => {
    if (!window.confirm(`確定刪除抽獎「${d.title}」？名單也會一併刪除。`)) return;
    const { error } = await supabase.from('draws').delete().eq('id', d.id);
    if (error) { alert(`刪除失敗: ${error.message}`); return; }
    fetchData();
  };

  const notifyDrawWinners = async (d: Draw) => {
    const winners = drawWinners[d.id] || [];
    const ids = winners.map(w => w.line_user_id).filter(Boolean) as string[];
    if (ids.length === 0) { alert('本次沒有「已綁定 LINE」的中獎者，無法用 LINE 通知（可用名單另行聯絡）'); return; }
    const defaultMsg = `🎉 恭喜您抽中「${d.prize || d.title}」！\n我們將盡快與您聯繫，感謝參與食在俱樂部的活動。`;
    const msg = window.prompt(`要發送給 ${ids.length} 位已綁定 LINE 的中獎者的訊息：`, defaultMsg);
    if (msg === null) return;
    if (!msg.trim()) { alert('訊息不可空白'); return; }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { navigate('/login'); return; }
    setDrawBusy(true);
    const { data, error } = await supabase.functions.invoke('line-push', { body: { message: msg.trim(), line_user_ids: ids } });
    setDrawBusy(false);
    if (error) { let m = '通知失敗'; try { const b = await (error as any).context.json(); if (b?.error) m = b.error; } catch { /* ignore */ } alert(m); return; }
    await supabase.from('draw_winners').update({ notified: true }).eq('draw_id', d.id).not('line_user_id', 'is', null);
    alert(`已通知：成功 ${data.sent} 位${data.failed ? `，失敗 ${data.failed} 位` : ''}`);
    fetchData();
  };

  const copyWinners = (d: Draw) => {
    const winners = drawWinners[d.id] || [];
    const text = winners.map((w, i) => `${i + 1}. ${w.name || '—'}${w.contact ? ` / ${w.contact}` : ''}${w.line_user_id ? ' / LINE已綁' : ''}`).join('\n');
    navigator.clipboard.writeText(text);
    alert('已複製中獎名單');
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
      start_time: (formData.get('start_time') as string) || null,
      end_time: (formData.get('end_time') as string) || null,
      type: formData.get('type') as 'current' | 'past',
      category: formData.get('category') as EventCategory,
      image_url: imageUrl,
      video_url: formData.get('video_url') as string,
    };

    let error;
    let savedId = editingEvent?.id;
    if (editingEvent) {
      const result = await supabase.from('events').update(eventData).eq('id', editingEvent.id);
      error = result.error;
    } else {
      const result = await supabase.from('events').insert([eventData]).select('id').single();
      error = result.error;
      savedId = result.data?.id;
    }

    if (error) {
      alert(`儲存失敗: ${error.message}`);
      return;
    }

    // 同步此活動要顯示的品牌與贊助夥伴（先清空再寫入）
    if (savedId) {
      await supabase.from('brand_events').delete().eq('event_id', savedId);
      if (eventBrandIds.length > 0) {
        const { error: beError } = await supabase.from('brand_events').insert(
          eventBrandIds.map(bid => ({ brand_id: bid, event_id: savedId }))
        );
        if (beError) { alert(`品牌關聯儲存失敗: ${beError.message}`); return; }
      }
      await supabase.from('partner_events').delete().eq('event_id', savedId);
      if (eventPartnerIds.length > 0) {
        const { error: peError } = await supabase.from('partner_events').insert(
          eventPartnerIds.map(pid => ({ partner_id: pid, event_id: savedId }))
        );
        if (peError) { alert(`贊助夥伴關聯儲存失敗: ${peError.message}`); return; }
      }
    }

    setShowEventModal(false);
    setEditingEvent(null);
    setEditorContent('');
    setImageUrl('');
    setEventBrandIds([]);
    setEventPartnerIds([]);
    fetchData();
  };

  const handleSaveBrand = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const brandData = {
      name: formData.get('name') as string,
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

  const fetchSignupAdminData = async (eventId: string) => {
    // 管理員（authenticated）有完整欄位權限，含 contact
    const { data: settingsData } = await supabase.from('signup_settings').select('*').eq('event_id', eventId).maybeSingle();
    const { data: entriesData } = await supabase.from('signup_entries').select('*').eq('event_id', eventId).order('created_at', { ascending: true });
    setSignupAdminSettings((settingsData as SignupSettings) || null);
    setSignupAdminEntries((entriesData as SignupEntry[]) || []);
    return settingsData as SignupSettings | null;
  };

  const handleOpenSignupAdmin = async (event: Event) => {
    setSignupAdminEvent(event);
    const settingsData = await fetchSignupAdminData(event.id);
    setSignupAdminForm({
      capacity: String(settingsData?.capacity ?? 40),
      fee: settingsData?.fee || '',
      event_time: settingsData?.event_time || '',
      event_location: settingsData?.event_location || '',
      event_address: settingsData?.event_address || '',
    });
    setShowSignupAdminModal(true);
  };

  const handleSaveSignupSettings = async () => {
    if (!signupAdminEvent) return;
    const cap = parseInt(signupAdminForm.capacity, 10);
    if (isNaN(cap) || cap < 0) { alert('名額需為 0 以上的數字'); return; }
    setSavingSignupAdmin(true);
    try {
      const isNew = !signupAdminSettings;
      const { error } = await supabase.from('signup_settings').upsert({
        event_id: signupAdminEvent.id,
        capacity: cap,
        registration_open: signupAdminSettings?.registration_open ?? true,
        fee: signupAdminForm.fee || null,
        event_time: signupAdminForm.event_time || null,
        event_location: signupAdminForm.event_location || null,
        event_address: signupAdminForm.event_address || null,
      });
      if (error) throw error;
      if (!isNew) {
        // 名額調整走 RPC，調高名額時會自動遞補候補
        const { error: rpcError } = await supabase.rpc('signup_admin_update', {
          p_event_id: signupAdminEvent.id, p_capacity: cap, p_open: signupAdminSettings!.registration_open,
        });
        if (rpcError) throw rpcError;
      }
      await fetchSignupAdminData(signupAdminEvent.id);
      alert(isNew ? '已開啟報名接龍！' : '已更新報名設定');
    } catch (e: any) {
      alert(`儲存失敗: ${e.message}`);
    } finally {
      setSavingSignupAdmin(false);
    }
  };

  const handleToggleSignupOpen = async () => {
    if (!signupAdminEvent || !signupAdminSettings) return;
    const { error } = await supabase.rpc('signup_admin_update', {
      p_event_id: signupAdminEvent.id,
      p_capacity: signupAdminSettings.capacity,
      p_open: !signupAdminSettings.registration_open,
    });
    if (error) { alert(`切換失敗: ${error.message}`); return; }
    await fetchSignupAdminData(signupAdminEvent.id);
  };

  const handleRemoveSignupEntry = async (entry: SignupEntry) => {
    if (!signupAdminEvent) return;
    if (!window.confirm(`確定要移除「${entry.name}」的報名嗎？\n若移除的是正取，最早的候補會自動遞補。`)) return;
    const { error } = await supabase.rpc('signup_admin_remove', { p_id: entry.id });
    if (error) { alert(`移除失敗: ${error.message}`); return; }
    await fetchSignupAdminData(signupAdminEvent.id);
  };

  const formatSignupTime = (ts: string) =>
    new Date(ts).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });

  const handleDownloadSignupCsv = () => {
    const head = ['編號', '姓名', '產業/品牌', '聯絡方式', '狀態', '報名時間'];
    const lines = signupAdminEntries.map((r, i) => [
      i + 1, r.name, r.industry || '', r.contact || '',
      r.status === 'confirmed' ? '正取' : '候補', formatSignupTime(r.created_at),
    ]);
    const csv = '\ufeff' + [head, ...lines].map(a => a.map(x => `"${String(x).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${signupAdminEvent?.title || '活動'}_報名名單.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopySignupText = () => {
    const conf = signupAdminEntries.filter(r => r.status === 'confirmed');
    const wl = signupAdminEntries.filter(r => r.status === 'waitlist');
    let text = conf.map((r, i) => `${i + 1}.${r.name}${r.industry ? '/' + r.industry : ''}`).join('\n');
    if (wl.length) text += '\n額滿————\n' + wl.map((r, i) => `候補${i + 1} ${r.name}${r.industry ? '/' + r.industry : ''}`).join('\n');
    navigator.clipboard.writeText(text).then(() => alert('已複製接龍文字')).catch(() => alert('複製失敗'));
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

  // --- 帳號管理（僅 owner）：寫入操作透過 admin-accounts Edge Function（service role） ---
  const fetchAdminUsers = async () => {
    const { data } = await supabase.from('admin_users').select('*').order('created_at', { ascending: true });
    setAdminUsers((data as AdminUser[]) || []);
  };

  useEffect(() => {
    if (activeTab === 'accounts') fetchAdminUsers();
  }, [activeTab]);

  const callAdminAccounts = async (payload: Record<string, unknown>) => {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-accounts`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${session?.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || '操作失敗');
    return body;
  };

  const handleCreateAdmin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    try {
      await callAdminAccounts({ action: 'create', email: fd.get('email'), password: fd.get('password'), role: fd.get('role') });
      form.reset();
      await fetchAdminUsers();
      alert('管理員帳號已建立！');
    } catch (err) {
      alert(`建立失敗：${err instanceof Error ? err.message : '未知錯誤'}`);
    }
  };

  const handleChangeAdminRole = async (target: AdminUser, role: string) => {
    if (role === target.role) return;
    try {
      await callAdminAccounts({ action: 'update_role', user_id: target.user_id, role });
      await fetchAdminUsers();
    } catch (err) {
      alert(`更新失敗：${err instanceof Error ? err.message : '未知錯誤'}`);
      await fetchAdminUsers();
    }
  };

  const handleResetAdminPassword = async (target: AdminUser) => {
    const password = prompt(`為 ${target.email} 設定新密碼（至少 8 碼）：`);
    if (!password) return;
    try {
      await callAdminAccounts({ action: 'reset_password', user_id: target.user_id, password });
      alert('密碼已更新');
    } catch (err) {
      alert(`更新失敗：${err instanceof Error ? err.message : '未知錯誤'}`);
    }
  };

  const handleDeleteAdmin = async (target: AdminUser) => {
    if (!confirm(`確定刪除管理員「${target.email}」？此帳號將無法再登入管理中心。`)) return;
    try {
      await callAdminAccounts({ action: 'delete', user_id: target.user_id });
      await fetchAdminUsers();
    } catch (err) {
      alert(`刪除失敗：${err instanceof Error ? err.message : '未知錯誤'}`);
    }
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
            <button
              onClick={() => setActiveTab('members')}
              className={cn(
                "w-full text-left px-4 py-3 rounded-xl font-medium transition-all",
                activeTab === 'members' ? "bg-orange-600 text-white shadow-lg" : "text-stone-600 hover:bg-stone-200"
              )}
            >
              會員管理
            </button>
            <button
              onClick={() => setActiveTab('draws')}
              className={cn(
                "w-full text-left px-4 py-3 rounded-xl font-medium transition-all",
                activeTab === 'draws' ? "bg-orange-600 text-white shadow-lg" : "text-stone-600 hover:bg-stone-200"
              )}
            >
              抽獎管理
            </button>
            {adminRole === 'owner' && (
              <button
                onClick={() => setActiveTab('accounts')}
                className={cn(
                  "w-full text-left px-4 py-3 rounded-xl font-medium transition-all",
                  activeTab === 'accounts' ? "bg-orange-600 text-white shadow-lg" : "text-stone-600 hover:bg-stone-200"
                )}
              >
                帳號管理
              </button>
            )}
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
                        <th className="pb-4 font-medium">分類</th>
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
                            <span className="text-xs px-2 py-1 rounded-full bg-orange-50 text-orange-600">
                              {eventCategoryLabel(event.category)}
                            </span>
                          </td>
                          <td className="py-4">
                            <span className={cn(
                              "text-xs px-2 py-1 rounded-full",
                              event.type === 'current' ? "bg-green-50 text-green-600" : "bg-stone-100 text-stone-500"
                            )}>
                              {event.type === 'current' ? '進行中' : '已結束'}
                            </span>
                          </td>
                          <td className="py-4 text-sm text-stone-500">{event.start_date}{event.start_time ? ` ${event.start_time.slice(0, 5)}` : ''}</td>
                          <td className="py-4 text-right">
                            <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => handleOpenSignupAdmin(event)}
                                className="px-2 py-1 text-xs font-bold text-orange-600 hover:bg-orange-50 rounded-lg flex items-center gap-1 transition-colors"
                                title="報名接龍管理"
                              >
                                <ClipboardList className="w-3 h-3" /> 報名
                              </button>
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

                {brands.length === 0 ? (
                  <div className="py-12 text-center text-stone-400">目前尚無品牌資料</div>
                ) : (() => {
                  const groups = Object.entries(
                    brands.reduce((acc, b) => {
                      const key = (b.category || '').trim() || '未分類';
                      (acc[key] = acc[key] || []).push(b);
                      return acc;
                    }, {} as Record<string, Brand[]>)
                  ).sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0], 'zh-Hant'));
                  const cats = groups.map(g => g[0]);
                  const activeCat = cats.includes(brandCategoryTab) ? brandCategoryTab : cats[0];
                  const list = (groups.find(g => g[0] === activeCat) || groups[0])[1];
                  return (
                    <div>
                      <div className="flex flex-wrap gap-2 mb-4 border-b border-stone-100 pb-4">
                        {groups.map(([cat, l]) => (
                          <button
                            key={cat}
                            onClick={() => setBrandCategoryTab(cat)}
                            className={cn(
                              "px-4 py-1.5 rounded-full text-sm font-medium transition-colors flex items-center gap-1.5",
                              activeCat === cat ? "bg-orange-600 text-white" : "text-stone-600 hover:bg-stone-100"
                            )}
                          >
                            {cat}
                            <span className={cn("text-xs", activeCat === cat ? "text-orange-100" : "text-stone-400")}>{l.length}</span>
                          </button>
                        ))}
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left">
                          <tbody className="divide-y divide-stone-50">
                            {list.map(brand => (
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
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })()}
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

            {activeTab === 'members' && (() => {
              const memberById = Object.fromEntries(adminMembers.map(m => [m.id, m]));
              const pendingApps = memberApplications.filter(a => a.status === 'pending');
              const filteredMembers = adminMembers.filter(m => memberTypeFilter === 'all' || m.member_type === memberTypeFilter);
              return (
                <>
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold">會員管理</h2>
                    <button onClick={exportMembersCsv} className="flex items-center gap-2 border border-stone-200 text-stone-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-stone-50">
                      <Download className="w-4 h-4" /> 匯出 CSV
                    </button>
                  </div>

                  {/* LINE 推播 */}
                  <div className="mb-8 border border-stone-100 rounded-2xl p-5 bg-stone-50/50">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-7 h-7 rounded-full bg-[#06C755] flex items-center justify-center">
                        <MessageCircle className="w-4 h-4 text-white" />
                      </div>
                      <h3 className="font-bold text-stone-800">發送 LINE 行銷通知</h3>
                    </div>
                    <p className="text-xs text-stone-400 mb-4">只會發給「已綁定 LINE 且同意行銷」的會員，會消耗官方帳號推播額度。</p>

                    <div className="flex flex-wrap gap-2 mb-3">
                      {([['all', '全部'], ...MEMBER_TYPES.map(t => [t.value, t.label] as [string, string])] as [string, string][]).map(([val, label]) => (
                        <button
                          key={val}
                          onClick={() => setPushTarget(val as any)}
                          className={cn('px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
                            pushTarget === val ? 'bg-orange-600 text-white' : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-50')}
                        >
                          {label}
                        </button>
                      ))}
                    </div>

                    {/* 訊息格式切換 */}
                    <div className="inline-flex rounded-xl border border-stone-200 bg-white p-1 mb-3">
                      {([['text', '純文字'], ['card', '圖文卡片']] as [string, string][]).map(([val, label]) => (
                        <button
                          key={val}
                          onClick={() => setPushMode(val as any)}
                          className={cn('px-4 py-1.5 rounded-lg text-sm font-medium transition-colors',
                            pushMode === val ? 'bg-orange-600 text-white' : 'text-stone-500 hover:bg-stone-50')}
                        >
                          {label}
                        </button>
                      ))}
                    </div>

                    {pushMode === 'text' ? (
                      <textarea
                        value={pushMessage}
                        onChange={(e) => setPushMessage(e.target.value)}
                        rows={3}
                        maxLength={5000}
                        placeholder="輸入要推播的訊息內容…"
                        className="w-full px-4 py-2.5 rounded-xl border border-stone-200 outline-none focus:ring-2 focus:ring-orange-600 bg-white"
                      />
                    ) : (
                      <div className="space-y-3 bg-white border border-stone-200 rounded-xl p-3">
                        <ImageUpload
                          label="卡片圖片（選填，建議橫幅比例 1.51:1）"
                          value={pushCard.imageUrl}
                          onChange={(url) => setPushCard({ ...pushCard, imageUrl: url })}
                          folder="line-push"
                        />
                        <input value={pushCard.title} onChange={(e) => setPushCard({ ...pushCard, title: e.target.value })} maxLength={40} placeholder="標題（必填，上限 40 字）" className="w-full px-3 py-2 rounded-lg border border-stone-200 outline-none focus:ring-2 focus:ring-orange-600 text-sm" />
                        <input value={pushCard.text} onChange={(e) => setPushCard({ ...pushCard, text: e.target.value })} maxLength={60} placeholder="說明文字（有圖上限 60 字）" className="w-full px-3 py-2 rounded-lg border border-stone-200 outline-none focus:ring-2 focus:ring-orange-600 text-sm" />
                        <div className="grid grid-cols-2 gap-2">
                          <input value={pushCard.buttonLabel} onChange={(e) => setPushCard({ ...pushCard, buttonLabel: e.target.value })} maxLength={20} placeholder="按鈕文字（必填）" className="px-3 py-2 rounded-lg border border-stone-200 outline-none focus:ring-2 focus:ring-orange-600 text-sm" />
                          <input value={pushCard.buttonUrl} onChange={(e) => setPushCard({ ...pushCard, buttonUrl: e.target.value })} placeholder="按鈕連結（必填，https://）" className="px-3 py-2 rounded-lg border border-stone-200 outline-none focus:ring-2 focus:ring-orange-600 text-sm" />
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between mt-3 flex-wrap gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm text-stone-500">
                          預計送達 <span className="font-bold text-stone-800">{pushRecipientCount}</span> 位會員
                          {pushMode === 'text' && <span className="text-stone-400 text-xs">（{pushMessage.length}/5000 字）</span>}
                        </p>
                        <div className="inline-flex rounded-lg border border-stone-200 bg-white p-0.5">
                          {([['now', '立即'], ['schedule', '排程']] as [string, string][]).map(([v, l]) => (
                            <button key={v} onClick={() => setPushWhen(v as any)} className={cn('px-3 py-1 rounded-md text-xs font-medium', pushWhen === v ? 'bg-orange-600 text-white' : 'text-stone-500')}>{l}</button>
                          ))}
                        </div>
                        {pushWhen === 'schedule' && (
                          <input type="datetime-local" value={pushScheduleAt} onChange={(e) => setPushScheduleAt(e.target.value)} className="px-3 py-1.5 rounded-lg border border-stone-200 text-sm outline-none focus:ring-2 focus:ring-orange-600" />
                        )}
                      </div>
                      <button
                        onClick={handleSendLinePush}
                        disabled={pushSending || pushRecipientCount === 0 || (pushMode === 'text' ? !pushMessage.trim() : (!pushCard.title.trim() || !pushCard.buttonUrl.trim()))}
                        className="bg-[#06C755] text-white px-5 py-2.5 rounded-xl font-bold hover:brightness-95 transition-all flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <MessageCircle className="w-4 h-4" /> {pushSending ? '發送中…' : (pushWhen === 'schedule' ? '排程推播' : '發送推播')}
                      </button>
                    </div>
                  </div>

                  {/* Email 行銷群發 */}
                  <div className="mb-8 border border-stone-100 rounded-2xl p-5 bg-stone-50/50">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-7 h-7 rounded-full bg-orange-600 flex items-center justify-center">
                        <Mail className="w-4 h-4 text-white" />
                      </div>
                      <h3 className="font-bold text-stone-800">發送 Email 行銷信</h3>
                    </div>
                    <p className="text-xs text-stone-400 mb-4">只會寄給「有 Email 且同意行銷」的會員，信末自動附退訂（會員中心關閉）連結。</p>

                    <div className="flex flex-wrap gap-2 mb-3">
                      {([['all', '全部'], ...MEMBER_TYPES.map(t => [t.value, t.label] as [string, string])] as [string, string][]).map(([val, label]) => (
                        <button
                          key={val}
                          onClick={() => setEmailTarget(val as any)}
                          className={cn('px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
                            emailTarget === val ? 'bg-orange-600 text-white' : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-50')}
                        >
                          {label}
                        </button>
                      ))}
                    </div>

                    <input
                      value={emailSubject}
                      onChange={(e) => setEmailSubject(e.target.value)}
                      placeholder="信件主旨"
                      className="w-full px-4 py-2.5 rounded-xl border border-stone-200 outline-none focus:ring-2 focus:ring-orange-600 bg-white mb-2"
                    />
                    <div className="bg-white border border-stone-200 rounded-xl p-3 mb-2">
                      <ImageUpload
                        label="頂部圖片（選填，會顯示在信件最上方）"
                        value={emailImage}
                        onChange={setEmailImage}
                        folder="email"
                      />
                    </div>
                    <textarea
                      value={emailBody}
                      onChange={(e) => setEmailBody(e.target.value)}
                      rows={5}
                      placeholder="信件內容（純文字，換行會保留；網址會自動變連結）"
                      className="w-full px-4 py-2.5 rounded-xl border border-stone-200 outline-none focus:ring-2 focus:ring-orange-600 bg-white"
                    />

                    <div className="flex items-center justify-between mt-3 flex-wrap gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm text-stone-500">預計寄送 <span className="font-bold text-stone-800">{emailRecipientCount}</span> 位會員</p>
                        <div className="inline-flex rounded-lg border border-stone-200 bg-white p-0.5">
                          {([['now', '立即'], ['schedule', '排程']] as [string, string][]).map(([v, l]) => (
                            <button key={v} onClick={() => setEmailWhen(v as any)} className={cn('px-3 py-1 rounded-md text-xs font-medium', emailWhen === v ? 'bg-orange-600 text-white' : 'text-stone-500')}>{l}</button>
                          ))}
                        </div>
                        {emailWhen === 'schedule' && (
                          <input type="datetime-local" value={emailScheduleAt} onChange={(e) => setEmailScheduleAt(e.target.value)} className="px-3 py-1.5 rounded-lg border border-stone-200 text-sm outline-none focus:ring-2 focus:ring-orange-600" />
                        )}
                      </div>
                      <button
                        onClick={handleSendEmail}
                        disabled={emailSending || emailRecipientCount === 0 || !emailSubject.trim() || !emailBody.trim()}
                        className="bg-orange-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-orange-500 transition-all flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Mail className="w-4 h-4" /> {emailSending ? '寄送中…' : (emailWhen === 'schedule' ? '排程寄送' : '寄送 Email')}
                      </button>
                    </div>
                  </div>

                  {/* 升級申請審核 */}
                  {pendingApps.length > 0 && (
                    <div className="mb-8">
                      <h3 className="text-sm font-bold text-stone-800 mb-3 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-amber-500" /> 待審核申請 <span className="text-stone-400 font-normal">{pendingApps.length}</span>
                      </h3>
                      <div className="space-y-3">
                        {pendingApps.map(app => {
                          const m = memberById[app.user_id];
                          return (
                            <div key={app.id} className="border border-amber-100 bg-amber-50/50 rounded-2xl p-4">
                              <div className="flex items-start justify-between gap-4 flex-wrap">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className={cn('px-2 py-0.5 rounded-full text-xs font-bold', memberTypeBadge(app.requested_type))}>申請：{memberTypeLabel(app.requested_type)}</span>
                                    <span className="text-sm font-bold text-stone-800">{app.real_name || m?.display_name || '—'}</span>
                                  </div>
                                  <p className="text-xs text-stone-500">{m?.email} · {app.contact_phone}</p>
                                  {app.requested_type === 'creator' ? (
                                    <p className="text-sm text-stone-600 mt-1">平台：{app.platform_links || '—'}　粉絲：{app.follower_count || '—'}</p>
                                  ) : (
                                    <p className="text-sm text-stone-600 mt-1">公司：{app.company_name || '—'}　統編：{app.tax_id || '—'}</p>
                                  )}
                                  {app.note && <p className="text-sm text-stone-500 mt-1">備註：{app.note}</p>}
                                </div>
                                <div className="flex gap-2 shrink-0">
                                  <button onClick={() => handleReviewApplication(app.id, true)} className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-500">通過</button>
                                  <button onClick={() => handleReviewApplication(app.id, false)} className="px-3 py-1.5 rounded-lg border border-stone-200 text-stone-600 text-sm font-bold hover:bg-white">婉拒</button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* 發送紀錄 */}
                  {campaigns.length > 0 && (
                    <div className="mb-8">
                      <h3 className="text-sm font-bold text-stone-800 mb-3">發送紀錄 <span className="text-stone-400 font-normal text-xs">（最近 30 筆）</span></h3>
                      <div className="border border-stone-100 rounded-2xl divide-y divide-stone-50 overflow-hidden">
                        {campaigns.map(c => {
                          const st: Record<string, [string, string]> = {
                            scheduled: ['已排程', 'bg-amber-100 text-amber-700'],
                            sending: ['寄送中', 'bg-blue-100 text-blue-700'],
                            sent: ['已寄送', 'bg-emerald-100 text-emerald-700'],
                            failed: ['失敗', 'bg-red-100 text-red-600'],
                            canceled: ['已取消', 'bg-stone-100 text-stone-400'],
                          };
                          const fmt = (t: string) => new Date(t).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
                          return (
                            <div key={c.id} className="flex items-center gap-3 px-4 py-3 flex-wrap">
                              <span className={cn('px-2 py-0.5 rounded-full text-xs font-bold shrink-0', c.channel === 'line' ? 'bg-[#06C755]/10 text-[#06C755]' : 'bg-orange-100 text-orange-700')}>
                                {c.channel === 'line' ? 'LINE' : 'Email'}
                              </span>
                              <span className={cn('px-2 py-0.5 rounded-full text-xs font-bold shrink-0', st[c.status]?.[1])}>{st[c.status]?.[0] || c.status}</span>
                              <span className="font-medium text-stone-800 truncate flex-1 min-w-[120px]">{c.title || '(無標題)'}</span>
                              <span className="text-xs text-stone-400 shrink-0">{c.member_type === 'all' ? '全部' : memberTypeLabel(c.member_type)}</span>
                              {c.status === 'scheduled' ? (
                                <>
                                  <span className="text-xs text-amber-600 shrink-0">排程 {c.scheduled_at ? fmt(c.scheduled_at) : ''}</span>
                                  <button onClick={() => cancelCampaign(c.id)} className="text-xs font-bold text-stone-400 hover:text-red-600 shrink-0">取消</button>
                                </>
                              ) : (
                                <>
                                  <span className="text-xs text-stone-500 shrink-0">成功 {c.sent_count}{c.failed_count ? ` · 失敗 ${c.failed_count}` : ''} / {c.recipient_count}</span>
                                  <span className="text-xs text-stone-400 shrink-0">{fmt(c.sent_at || c.created_at)}</span>
                                </>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* 身分篩選 */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    {([['all', '全部'], ...MEMBER_TYPES.map(t => [t.value, t.label] as [string, string])] as [string, string][]).map(([val, label]) => {
                      const count = val === 'all' ? adminMembers.length : adminMembers.filter(m => m.member_type === val).length;
                      return (
                        <button key={val} onClick={() => setMemberTypeFilter(val as any)}
                          className={cn('px-4 py-1.5 rounded-full text-sm font-medium transition-colors flex items-center gap-1.5',
                            memberTypeFilter === val ? 'bg-orange-600 text-white' : 'text-stone-600 hover:bg-stone-100')}>
                          {label}<span className={cn('text-xs', memberTypeFilter === val ? 'text-orange-100' : 'text-stone-400')}>{count}</span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-stone-100 text-stone-400 text-sm">
                          <th className="pb-3 font-medium">會員</th>
                          <th className="pb-3 font-medium">身分</th>
                          <th className="pb-3 font-medium">LINE</th>
                          <th className="pb-3 font-medium">行銷同意</th>
                          <th className="pb-3 font-medium">註冊日</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-50">
                        {filteredMembers.map(m => (
                          <tr key={m.id} onClick={() => setViewingMember(m)} className="cursor-pointer hover:bg-orange-50/50 transition-colors">
                            <td className="py-3">
                              <p className="font-medium text-stone-800">{m.display_name || '—'}</p>
                              <p className="text-xs text-stone-400">{m.email}{m.phone ? ` · ${m.phone}` : ''}</p>
                            </td>
                            <td className="py-3">
                              <span className={cn('px-2 py-0.5 rounded-full text-xs font-bold', memberTypeBadge(m.member_type))}>{memberTypeLabel(m.member_type)}</span>
                            </td>
                            <td className="py-3 text-sm">{m.line_user_id ? <span className="text-[#06C755] font-medium">✓ 已綁</span> : <span className="text-stone-300">—</span>}</td>
                            <td className="py-3 text-sm">{m.marketing_consent ? <span className="text-emerald-600">✓ 同意</span> : <span className="text-stone-300">—</span>}</td>
                            <td className="py-3 text-sm text-stone-500">{new Date(m.created_at).toLocaleDateString('zh-TW', { timeZone: 'Asia/Taipei' })}</td>
                          </tr>
                        ))}
                        {filteredMembers.length === 0 && (
                          <tr><td colSpan={5} className="py-12 text-center text-stone-400">目前尚無會員資料</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              );
            })()}

            {activeTab === 'draws' && (() => {
              const poolLabel: Record<string, string> = { all_members: '全部會員', line_bound: '已綁定 LINE 會員', event_signup: '活動報名者' };
              return (
                <>
                  <h2 className="text-xl font-bold mb-6">抽獎管理</h2>

                  {/* 建立抽獎 */}
                  <div className="border border-stone-100 rounded-2xl p-5 mb-8 bg-stone-50/50">
                    <h3 className="font-bold text-stone-800 mb-4">建立新抽獎</h3>
                    <div className="grid md:grid-cols-2 gap-3">
                      <input value={drawForm.title} onChange={(e) => setDrawForm({ ...drawForm, title: e.target.value })} placeholder="抽獎標題（例：週年慶抽獎）" className="px-4 py-2.5 rounded-xl border border-stone-200 outline-none focus:ring-2 focus:ring-orange-600 bg-white" />
                      <input value={drawForm.prize} onChange={(e) => setDrawForm({ ...drawForm, prize: e.target.value })} placeholder="獎項（例：火鍋雙人套餐）" className="px-4 py-2.5 rounded-xl border border-stone-200 outline-none focus:ring-2 focus:ring-orange-600 bg-white" />
                      <select value={drawForm.pool} onChange={(e) => setDrawForm({ ...drawForm, pool: e.target.value as DrawPool })} className="px-4 py-2.5 rounded-xl border border-stone-200 outline-none focus:ring-2 focus:ring-orange-600 bg-white">
                        <option value="all_members">抽獎池：全部會員</option>
                        <option value="line_bound">抽獎池：已綁定 LINE 會員</option>
                        <option value="event_signup">抽獎池：活動報名者</option>
                      </select>
                      {drawForm.pool === 'event_signup' ? (
                        <select value={drawForm.event_id} onChange={(e) => setDrawForm({ ...drawForm, event_id: e.target.value })} className="px-4 py-2.5 rounded-xl border border-stone-200 outline-none focus:ring-2 focus:ring-orange-600 bg-white">
                          <option value="">選擇活動</option>
                          {allEvents.map(ev => <option key={ev.id} value={ev.id}>{ev.title}</option>)}
                        </select>
                      ) : (
                        <input type="number" min={1} value={drawForm.winner_count} onChange={(e) => setDrawForm({ ...drawForm, winner_count: e.target.value })} placeholder="中獎人數" className="px-4 py-2.5 rounded-xl border border-stone-200 outline-none focus:ring-2 focus:ring-orange-600 bg-white" />
                      )}
                      {drawForm.pool === 'event_signup' && (
                        <input type="number" min={1} value={drawForm.winner_count} onChange={(e) => setDrawForm({ ...drawForm, winner_count: e.target.value })} placeholder="中獎人數" className="px-4 py-2.5 rounded-xl border border-stone-200 outline-none focus:ring-2 focus:ring-orange-600 bg-white" />
                      )}
                    </div>
                    <div className="mt-4">
                      <button onClick={createDraw} disabled={drawBusy} className="bg-stone-900 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-stone-800 disabled:opacity-50 flex items-center gap-2">
                        <Plus className="w-4 h-4" /> 建立抽獎
                      </button>
                    </div>
                  </div>

                  {/* 抽獎列表 */}
                  <div className="space-y-4">
                    {draws.map(d => {
                      const winners = drawWinners[d.id] || [];
                      const boundCount = winners.filter(w => w.line_user_id).length;
                      return (
                        <div key={d.id} className="border border-stone-100 rounded-2xl p-5">
                          <div className="flex items-start justify-between gap-4 flex-wrap">
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-bold text-stone-900">{d.title}</h3>
                                <span className={cn('px-2 py-0.5 rounded-full text-xs font-bold', d.status === 'drawn' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700')}>
                                  {d.status === 'drawn' ? '已開獎' : '未開獎'}
                                </span>
                              </div>
                              <p className="text-sm text-stone-500 mt-1">
                                獎項：{d.prize || '—'}　·　{poolLabel[d.pool]}{d.pool === 'event_signup' && d.event_id ? `（${allEvents.find(e => e.id === d.event_id)?.title || '活動'}）` : ''}　·　名額 {d.winner_count}
                              </p>
                            </div>
                            <div className="flex gap-2 shrink-0">
                              {d.status === 'open' ? (
                                <button onClick={() => runDraw(d)} disabled={drawBusy} className="px-4 py-2 rounded-lg bg-orange-600 text-white text-sm font-bold hover:bg-orange-500 disabled:opacity-50">🎲 開獎</button>
                              ) : (
                                <button onClick={() => resetDraw(d)} className="px-3 py-2 rounded-lg border border-stone-200 text-stone-600 text-sm font-medium hover:bg-stone-50">重抽</button>
                              )}
                              <button onClick={() => deleteDraw(d)} className="p-2 text-stone-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                            </div>
                          </div>

                          {d.status === 'drawn' && (
                            <div className="mt-4 border-t border-stone-50 pt-4">
                              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                                <p className="text-sm font-bold text-stone-700">中獎名單（{winners.length}）<span className="text-stone-400 font-normal text-xs">· 已綁定 LINE {boundCount} 位</span></p>
                                <div className="flex gap-2">
                                  <button onClick={() => copyWinners(d)} className="text-xs font-bold text-stone-500 hover:text-stone-800 flex items-center gap-1"><Copy className="w-3.5 h-3.5" /> 複製名單</button>
                                  <button onClick={() => notifyDrawWinners(d)} disabled={drawBusy || boundCount === 0} className="text-xs font-bold text-[#06C755] hover:brightness-90 flex items-center gap-1 disabled:opacity-40"><MessageCircle className="w-3.5 h-3.5" /> LINE 通知中獎者</button>
                                </div>
                              </div>
                              {winners.length === 0 ? (
                                <p className="text-sm text-stone-400">抽獎池沒有符合的對象。</p>
                              ) : (
                                <div className="grid sm:grid-cols-2 gap-1.5">
                                  {winners.map((w, i) => (
                                    <div key={w.id} className="flex items-center gap-2 text-sm bg-stone-50 rounded-lg px-3 py-2">
                                      <span className="text-stone-400 w-5">{i + 1}.</span>
                                      <span className="font-medium text-stone-800 truncate">{w.name || '—'}</span>
                                      {w.contact && <span className="text-stone-400 text-xs truncate">{w.contact}</span>}
                                      {w.line_user_id && <span className="text-[#06C755] text-xs shrink-0">LINE{w.notified ? '·已通知' : ''}</span>}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {draws.length === 0 && (
                      <div className="py-12 text-center text-stone-400">目前尚無抽獎，請於上方建立。</div>
                    )}
                  </div>
                </>
              );
            })()}

            {activeTab === 'accounts' && adminRole === 'owner' && (
              <>
                <div className="mb-6">
                  <h2 className="text-xl font-bold">帳號管理</h2>
                  <p className="text-sm text-stone-500 mt-1">owner 可管理帳號與所有內容；editor 只能管理內容。</p>
                </div>

                <form onSubmit={handleCreateAdmin} className="bg-stone-50 rounded-2xl p-6 mb-8 grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-2">Email</label>
                    <input type="email" name="email" className="w-full px-4 py-2 rounded-xl border border-stone-200 outline-none focus:ring-2 focus:ring-orange-600" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-2">密碼（至少 8 碼）</label>
                    <input type="password" name="password" minLength={8} className="w-full px-4 py-2 rounded-xl border border-stone-200 outline-none focus:ring-2 focus:ring-orange-600" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-2">角色</label>
                    <select name="role" defaultValue="editor" className="w-full px-4 py-2 rounded-xl border border-stone-200 outline-none focus:ring-2 focus:ring-orange-600">
                      <option value="editor">editor（內容管理）</option>
                      <option value="owner">owner（帳號＋內容）</option>
                    </select>
                  </div>
                  <button type="submit" className="bg-stone-900 text-white px-4 py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2">
                    <Plus className="w-4 h-4" /> 新增帳號
                  </button>
                </form>

                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-stone-100 text-stone-400 text-sm">
                        <th className="pb-4 font-medium">Email</th>
                        <th className="pb-4 font-medium">角色</th>
                        <th className="pb-4 font-medium">建立時間</th>
                        <th className="pb-4 font-medium text-right">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-50">
                      {adminUsers.map((u) => (
                        <tr key={u.user_id} className="group">
                          <td className="py-4 font-medium">
                            {u.email}
                            {u.user_id === myUserId && <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-orange-50 text-orange-600">我</span>}
                          </td>
                          <td className="py-4">
                            {u.user_id === myUserId ? (
                              <span className="text-sm text-stone-600">{u.role}</span>
                            ) : (
                              <select
                                value={u.role}
                                onChange={(e) => handleChangeAdminRole(u, e.target.value)}
                                className="px-3 py-1.5 rounded-lg border border-stone-200 text-sm outline-none focus:ring-2 focus:ring-orange-600"
                              >
                                <option value="editor">editor</option>
                                <option value="owner">owner</option>
                              </select>
                            )}
                          </td>
                          <td className="py-4 text-sm text-stone-500">
                            {new Date(u.created_at).toLocaleDateString('zh-TW', { timeZone: 'Asia/Taipei' })}
                          </td>
                          <td className="py-4 text-right">
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => handleResetAdminPassword(u)}
                                className="px-2 py-1 text-xs font-bold text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                              >
                                重設密碼
                              </button>
                              {u.user_id !== myUserId && (
                                <button
                                  onClick={() => handleDeleteAdmin(u)}
                                  className="p-2 text-stone-400 hover:text-red-600"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                      {adminUsers.length === 0 && (
                        <tr>
                          <td colSpan={4} className="py-12 text-center text-stone-400">載入中...</td>
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

      {/* 會員詳細資料 Modal */}
      <AnimatePresence>
        {viewingMember && (() => {
          const apps = memberApplications.filter(a => a.user_id === viewingMember.id);
          const statusText: Record<string, string> = { pending: '審核中', approved: '已通過', rejected: '未通過' };
          const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
            <div className="flex gap-3 py-2 border-b border-stone-50 last:border-0">
              <span className="w-24 shrink-0 text-sm text-stone-400">{label}</span>
              <span className="text-sm text-stone-800 break-all">{value || <span className="text-stone-300">—</span>}</span>
            </div>
          );
          return (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setViewingMember(null)} className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm" />
              <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden">
                <div className="p-6 border-b border-stone-100 flex justify-between items-center">
                  <h3 className="text-lg font-bold">會員資料</h3>
                  <button onClick={() => setViewingMember(null)} className="text-stone-400 hover:text-stone-600"><X className="w-6 h-6" /></button>
                </div>
                <div className="p-6 max-h-[70vh] overflow-y-auto">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center shrink-0"><User className="w-6 h-6 text-orange-600" /></div>
                    <div className="min-w-0">
                      <p className="font-bold text-stone-900 truncate">{viewingMember.display_name || '—'}</p>
                      <span className={cn('px-2 py-0.5 rounded-full text-xs font-bold', memberTypeBadge(viewingMember.member_type))}>{memberTypeLabel(viewingMember.member_type)}</span>
                    </div>
                  </div>

                  <Row label="Email" value={viewingMember.email} />
                  <Row label="電話" value={viewingMember.phone} />
                  <Row label="LINE 綁定" value={viewingMember.line_user_id ? <span className="text-[#06C755]">✓ 已綁定</span> : '未綁定'} />
                  <Row label="行銷同意" value={viewingMember.marketing_consent ? <span className="text-emerald-600">✓ 同意</span> : '未同意'} />
                  <Row label="註冊日" value={new Date(viewingMember.created_at).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })} />

                  {apps.length > 0 && (
                    <div className="mt-5">
                      <p className="text-sm font-bold text-stone-700 mb-2">身分申請紀錄</p>
                      <div className="space-y-3">
                        {apps.map(a => (
                          <div key={a.id} className="border border-stone-100 rounded-xl p-3">
                            <div className="flex items-center gap-2 mb-2">
                              <span className={cn('px-2 py-0.5 rounded-full text-xs font-bold', memberTypeBadge(a.requested_type))}>{memberTypeLabel(a.requested_type)}</span>
                              <span className="text-xs text-stone-400">{statusText[a.status] || a.status}</span>
                              <span className="text-xs text-stone-300 ml-auto">{new Date(a.created_at).toLocaleDateString('zh-TW', { timeZone: 'Asia/Taipei' })}</span>
                            </div>
                            <Row label="真實姓名" value={a.real_name} />
                            <Row label="聯絡電話" value={a.contact_phone} />
                            {a.requested_type === 'creator' ? (
                              <>
                                {SOCIAL_PLATFORMS.filter(p => a.social_accounts?.[p.key]?.account || a.social_accounts?.[p.key]?.followers).map(p => (
                                  <Row key={p.key} label={p.label} value={`${a.social_accounts?.[p.key]?.account || '—'}${a.social_accounts?.[p.key]?.followers ? `　粉絲 ${a.social_accounts[p.key].followers}` : ''}`} />
                                ))}
                                {/* 舊版自由文字（相容） */}
                                {a.platform_links && <Row label="平台/作品" value={a.platform_links} />}
                                {a.follower_count && <Row label="粉絲數" value={a.follower_count} />}
                              </>
                            ) : (
                              <>
                                <Row label="公司/團體" value={a.company_name} />
                                <Row label="統一編號" value={a.tax_id} />
                                <Row label="員工數" value={a.employee_count} />
                                <Row label="公司地址" value={a.company_address} />
                              </>
                            )}
                            <Row label="備註" value={a.note} />
                            {a.review_note && <Row label="審核備註" value={a.review_note} />}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>

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
                    <label className="block text-sm font-medium text-stone-700 mb-2">開始時間（選填）</label>
                    <input type="time" name="start_time" defaultValue={editingEvent?.start_time?.slice(0, 5) || ''} className="w-full px-4 py-2 rounded-xl border border-stone-200 outline-none focus:ring-2 focus:ring-orange-600" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-2">結束時間（選填）</label>
                    <input type="time" name="end_time" defaultValue={editingEvent?.end_time?.slice(0, 5) || ''} className="w-full px-4 py-2 rounded-xl border border-stone-200 outline-none focus:ring-2 focus:ring-orange-600" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-2">活動狀態</label>
                    <select name="type" defaultValue={editingEvent?.type || 'current'} className="w-full px-4 py-2 rounded-xl border border-stone-200 outline-none focus:ring-2 focus:ring-orange-600">
                      <option value="current">進行中</option>
                      <option value="past">已結束</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-2">活動分類</label>
                    <select name="category" defaultValue={editingEvent?.category || 'festival'} className="w-full px-4 py-2 rounded-xl border border-stone-200 outline-none focus:ring-2 focus:ring-orange-600">
                      {EVENT_CATEGORIES.map((c) => (
                        <option key={c.value} value={c.value}>{c.emoji} {c.label}</option>
                      ))}
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

                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-stone-700 mb-3">
                      參與餐飲品牌 <span className="text-stone-400 font-normal text-xs">（勾選的品牌會顯示在此活動頁）已選 {eventBrandIds.length}</span>
                    </label>
                    {allBrands.length === 0 ? (
                      <p className="text-sm text-stone-400">尚無品牌可選擇，請先到品牌管理新增</p>
                    ) : (
                      <div className="max-h-56 overflow-y-auto space-y-3 border border-stone-100 rounded-xl p-3">
                        {Object.entries(
                          allBrands.reduce((acc, b) => {
                            const key = ((b as any).category || '').trim() || '未分類';
                            (acc[key] = acc[key] || []).push(b);
                            return acc;
                          }, {} as Record<string, Brand[]>)
                        )
                          .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0], 'zh-Hant'))
                          .map(([category, list]) => (
                            <div key={category}>
                              <p className="text-xs font-bold text-stone-500 mb-1 px-1">{category}</p>
                              <div className="grid grid-cols-2 gap-1.5">
                                {list.map(brand => (
                                  <label key={brand.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-orange-50 cursor-pointer transition-colors">
                                    <input
                                      type="checkbox"
                                      checked={eventBrandIds.includes(brand.id)}
                                      onChange={(e) => {
                                        if (e.target.checked) setEventBrandIds([...eventBrandIds, brand.id]);
                                        else setEventBrandIds(eventBrandIds.filter(id => id !== brand.id));
                                      }}
                                      className="w-4 h-4 accent-orange-600 shrink-0"
                                    />
                                    <span className="text-sm text-stone-700 truncate">{brand.name}</span>
                                  </label>
                                ))}
                              </div>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>

                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-stone-700 mb-3">
                      贊助夥伴 <span className="text-stone-400 font-normal text-xs">（勾選的贊助夥伴會顯示在此活動頁）已選 {eventPartnerIds.length}</span>
                    </label>
                    {allPartners.length === 0 ? (
                      <p className="text-sm text-stone-400">尚無贊助夥伴可選擇，請先到贊助管理新增</p>
                    ) : (
                      <div className="max-h-48 overflow-y-auto grid grid-cols-2 gap-1.5 border border-stone-100 rounded-xl p-3">
                        {allPartners.map(partner => (
                          <label key={partner.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-orange-50 cursor-pointer transition-colors">
                            <input
                              type="checkbox"
                              checked={eventPartnerIds.includes(partner.id)}
                              onChange={(e) => {
                                if (e.target.checked) setEventPartnerIds([...eventPartnerIds, partner.id]);
                                else setEventPartnerIds(eventPartnerIds.filter(id => id !== partner.id));
                              }}
                              className="w-4 h-4 accent-orange-600 shrink-0"
                            />
                            <span className="text-sm text-stone-700 truncate">{partner.name}</span>
                          </label>
                        ))}
                      </div>
                    )}
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
                    <label className="block text-sm font-medium text-stone-700 mb-2">品牌名稱</label>
                    <input name="name" defaultValue={editingBrand?.name} className="w-full px-4 py-2 rounded-xl border border-stone-200 outline-none focus:ring-2 focus:ring-orange-600" required />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-stone-700 mb-2">品牌類別 (可選擇現有類別或輸入新類別)</label>
                    <input
                      name="category"
                      list="brand-category-options"
                      defaultValue={editingBrand?.category}
                      placeholder="例如: 燒烤、火鍋"
                      autoComplete="off"
                      className="w-full px-4 py-2 rounded-xl border border-stone-200 outline-none focus:ring-2 focus:ring-orange-600"
                      required
                    />
                    <datalist id="brand-category-options">
                      {Array.from(new Set(brands.map(b => (b.category || '').trim()).filter(Boolean)))
                        .sort((a, b) => a.localeCompare(b, 'zh-Hant'))
                        .map(c => (
                          <option key={c} value={c} />
                        ))}
                    </datalist>
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
                    const otherBrand = loc.brand && loc.brand.id !== managingBrand.id ? loc.brand.name : null;
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

      {/* Signup Admin Modal */}
      <AnimatePresence>
        {showSignupAdminModal && signupAdminEvent && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => !savingSignupAdmin && setShowSignupAdminModal(false)}
              className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-3xl bg-white rounded-3xl shadow-2xl overflow-hidden max-h-[88vh] flex flex-col">

              {/* Header */}
              <div className="p-6 border-b border-stone-100 flex justify-between items-start shrink-0">
                <div>
                  <h3 className="text-xl font-bold text-stone-900">🍢 報名接龍管理</h3>
                  <p className="text-sm text-stone-400 mt-1">{signupAdminEvent.title}</p>
                  {signupAdminSettings && (
                    <a href={`/event/${signupAdminEvent.id}/signup`} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-orange-600 font-bold hover:underline mt-1 inline-block">
                      開啟公開報名頁 ↗
                    </a>
                  )}
                </div>
                <button onClick={() => setShowSignupAdminModal(false)} className="text-stone-400 hover:text-stone-600">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-8">
                {/* 報名設定 */}
                <section>
                  <h4 className="text-sm font-bold text-stone-400 uppercase tracking-widest mb-4">
                    {signupAdminSettings ? '報名設定' : '尚未開啟報名，填寫設定後儲存即可開放'}
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-stone-700 mb-2">名額上限</label>
                      <input type="number" min="0" value={signupAdminForm.capacity}
                        onChange={e => setSignupAdminForm({ ...signupAdminForm, capacity: e.target.value })}
                        className="w-full px-4 py-2 rounded-xl border border-stone-200 outline-none focus:ring-2 focus:ring-orange-600" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-stone-700 mb-2">費用（選填）</label>
                      <input value={signupAdminForm.fee} placeholder="例：1,500 元／人"
                        onChange={e => setSignupAdminForm({ ...signupAdminForm, fee: e.target.value })}
                        className="w-full px-4 py-2 rounded-xl border border-stone-200 outline-none focus:ring-2 focus:ring-orange-600" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-stone-700 mb-2">活動時間（選填）</label>
                      <input value={signupAdminForm.event_time} placeholder="例：18:00"
                        onChange={e => setSignupAdminForm({ ...signupAdminForm, event_time: e.target.value })}
                        className="w-full px-4 py-2 rounded-xl border border-stone-200 outline-none focus:ring-2 focus:ring-orange-600" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-stone-700 mb-2">地點（選填）</label>
                      <input value={signupAdminForm.event_location} placeholder="例：松江本店"
                        onChange={e => setSignupAdminForm({ ...signupAdminForm, event_location: e.target.value })}
                        className="w-full px-4 py-2 rounded-xl border border-stone-200 outline-none focus:ring-2 focus:ring-orange-600" />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-stone-700 mb-2">地址（選填）</label>
                      <input value={signupAdminForm.event_address} placeholder="例：臺北市中山區民權東路二段152巷1號"
                        onChange={e => setSignupAdminForm({ ...signupAdminForm, event_address: e.target.value })}
                        className="w-full px-4 py-2 rounded-xl border border-stone-200 outline-none focus:ring-2 focus:ring-orange-600" />
                    </div>
                  </div>
                  <div className="flex gap-3 mt-4">
                    <button onClick={handleSaveSignupSettings} disabled={savingSignupAdmin}
                      className="flex-1 py-3 rounded-xl bg-orange-600 text-white font-bold hover:bg-orange-500 disabled:opacity-50 transition-colors">
                      {savingSignupAdmin ? '儲存中...' : signupAdminSettings ? '更新設定' : '開啟報名接龍'}
                    </button>
                    {signupAdminSettings && (
                      <button onClick={handleToggleSignupOpen}
                        className={cn(
                          'flex-1 py-3 rounded-xl font-bold border transition-colors',
                          signupAdminSettings.registration_open
                            ? 'border-red-200 text-red-500 hover:bg-red-50'
                            : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'
                        )}>
                        {signupAdminSettings.registration_open ? '🔒 關閉報名' : '🔓 開放報名'}
                      </button>
                    )}
                  </div>
                </section>

                {/* 名單 */}
                {signupAdminSettings && (
                  <section>
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                      <h4 className="text-sm font-bold text-stone-400 uppercase tracking-widest">
                        報名名單
                        <span className="ml-2 text-orange-600">
                          正取 {signupAdminEntries.filter(r => r.status === 'confirmed').length} / {signupAdminSettings.capacity}
                          ・候補 {signupAdminEntries.filter(r => r.status === 'waitlist').length}
                        </span>
                      </h4>
                      <div className="flex gap-2">
                        <button onClick={handleDownloadSignupCsv} disabled={signupAdminEntries.length === 0}
                          className="px-3 py-2 rounded-lg bg-emerald-50 text-emerald-600 text-xs font-bold flex items-center gap-1 hover:bg-emerald-100 disabled:opacity-40 transition-colors">
                          <Download className="w-3.5 h-3.5" /> 下載 CSV
                        </button>
                        <button onClick={handleCopySignupText} disabled={signupAdminEntries.length === 0}
                          className="px-3 py-2 rounded-lg bg-stone-100 text-stone-600 text-xs font-bold flex items-center gap-1 hover:bg-stone-200 disabled:opacity-40 transition-colors">
                          <Copy className="w-3.5 h-3.5" /> 複製接龍文字
                        </button>
                        <button onClick={() => fetchSignupAdminData(signupAdminEvent.id)}
                          className="p-2 rounded-lg text-stone-400 hover:text-orange-600 transition-colors" title="重新整理">
                          <RefreshCw className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div className="overflow-x-auto border border-stone-100 rounded-2xl">
                      <table className="w-full text-left text-sm">
                        <thead>
                          <tr className="border-b border-stone-100 text-stone-400 text-xs bg-stone-50">
                            <th className="py-3 px-4 font-medium">#</th>
                            <th className="py-3 px-4 font-medium">姓名</th>
                            <th className="py-3 px-4 font-medium">產業/品牌</th>
                            <th className="py-3 px-4 font-medium">聯絡方式</th>
                            <th className="py-3 px-4 font-medium">狀態</th>
                            <th className="py-3 px-4 font-medium">報名時間</th>
                            <th className="py-3 px-4 font-medium text-right">操作</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-50">
                          {signupAdminEntries.map((entry, i) => (
                            <tr key={entry.id}>
                              <td className="py-3 px-4 text-stone-400">{i + 1}</td>
                              <td className="py-3 px-4 font-medium">{entry.name}</td>
                              <td className="py-3 px-4 text-stone-500">{entry.industry}</td>
                              <td className="py-3 px-4 text-stone-500">{entry.contact}</td>
                              <td className="py-3 px-4">
                                <span className={cn(
                                  'text-xs px-2 py-1 rounded-full',
                                  entry.status === 'confirmed' ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600'
                                )}>
                                  {entry.status === 'confirmed' ? '正取' : '候補'}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-stone-400 text-xs whitespace-nowrap">{formatSignupTime(entry.created_at)}</td>
                              <td className="py-3 px-4 text-right">
                                <button
                                  onClick={() => handleRemoveSignupEntry(entry)}
                                  className="p-1.5 text-stone-300 hover:text-red-600 transition-colors"
                                  title="移除此筆報名（正取移除後自動遞補）"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          ))}
                          {signupAdminEntries.length === 0 && (
                            <tr><td colSpan={7} className="py-10 text-center text-stone-400">目前尚無報名</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </section>
                )}
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
            <Route path="/event/:id/signup" element={<EventSignupPage />} />
            <Route path="/brand/:id" element={<BrandDetail />} />
            <Route path="/partner/:id" element={<PartnerDetail />} />
            <Route path="/promotions" element={<PromotionsPage />} />
            <Route path="/reviews" element={<KOLReviewsPage />} />
            <Route path="/map" element={<MapPage />} />
            <Route path="/partners" element={<PartnersPage />} />
            <Route path="/login" element={<Login />} />
            <Route path="/member/login" element={<MemberLogin />} />
            <Route path="/member/line-callback" element={<LineCallback />} />
            <Route path="/member" element={<MemberCenter />} />
            <Route path="/admin" element={<AdminDashboard />} />
          </Routes>
          
          <footer className="bg-stone-900 text-white py-12 mt-24">
            <div className="max-w-7xl mx-auto px-4 text-center">
              <div className="flex items-center justify-center mb-6">
                <img src="/logo-mark-white.png" alt="食在俱樂部 Food Power Club" className="h-10 w-auto" />
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
