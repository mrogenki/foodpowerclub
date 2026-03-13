import React, { useState, useEffect, useMemo } from 'react';
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
  Video
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
import { cn } from './lib/utils';
import type { Event, Brand, Partner, Location, Review, KOLReview, Promotion } from './types';

// --- Utilities ---

const uploadImage = async (file: File) => {
  const fileExt = file.name.split('.').pop();
  const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
  const filePath = `uploads/${fileName}`;

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

const BlockEditor = ({ initialContent, onChange }: { initialContent?: string, onChange: (content: string) => void }) => {
  const editor: BlockNoteEditor = useCreateBlockNote({
    initialContent: initialContent ? JSON.parse(initialContent) as PartialBlock[] : undefined,
    uploadFile: uploadImage,
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

const ImageUpload = ({ value, onChange, label }: { value?: string, onChange: (url: string) => void, label: string }) => {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);
    try {
      const url = await uploadImage(file);
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
            <img src={value} alt="Preview" className="w-full h-full object-cover" />
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
            <span className="font-bold text-xl tracking-tight text-stone-900">食在力量美食祭</span>
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
  const [currentEvent, setCurrentEvent] = useState<Event | null>(null);
  const [pastEvents, setPastEvents] = useState<Event[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [reviews, setReviews] = useState<KOLReview[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);

  useEffect(() => {
    const fetchHomeData = async () => {
      // Fetch Events
      const { data: eventsData } = await supabase.from('events').select('*').order('start_date', { ascending: false });
      if (eventsData) {
        setCurrentEvent(eventsData.find(e => e.type === 'current') || eventsData[0]);
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
      const { data: partnersData } = await supabase.from('partners').select('*').limit(6);
      if (partnersData) setPartners(partnersData);
    };
    fetchHomeData();
  }, []);

  return (
    <div className="pt-16">
      {/* Hero Section */}
      <section className="relative h-[80vh] flex items-center justify-center overflow-hidden bg-stone-900">
        <img 
          src={currentEvent?.image_url || "https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?q=80&w=2070&auto=format&fit=crop"} 
          className="absolute inset-0 w-full h-full object-cover opacity-60"
          alt="Hero"
          referrerPolicy="no-referrer"
        />
        <div className="relative z-10 text-center px-4">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 tracking-tight">
              {currentEvent?.title || "食在力量美食祭"}
            </h1>
            <p className="text-xl text-stone-200 max-w-2xl mx-auto mb-8 font-light">
              {currentEvent?.description || "探索城市中最具力量的美食，連結品牌與味蕾的盛宴。"}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to={`/event/${currentEvent?.id}`} className="bg-orange-600 text-white px-8 py-4 rounded-full font-bold hover:bg-orange-500 transition-all transform hover:scale-105">
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
        </div>
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
            {/* Current Event if exists */}
            {currentEvent && (
              <motion.div 
                whileHover={{ y: -10 }}
                className="bg-white rounded-3xl overflow-hidden shadow-xl border-2 border-orange-100 relative"
              >
                <div className="absolute top-4 right-4 bg-orange-600 text-white px-3 py-1 rounded-full text-xs font-bold z-10">
                  進行中
                </div>
                <img src={currentEvent.image_url} className="w-full h-56 object-cover" alt={currentEvent.title} />
                <div className="p-8">
                  <h3 className="text-2xl font-bold mb-3">{currentEvent.title}</h3>
                  <p className="text-stone-500 text-sm mb-6 line-clamp-2">{currentEvent.description}</p>
                  <Link to={`/event/${currentEvent.id}`} className="inline-flex items-center gap-2 text-orange-600 font-bold">
                    立即參與 <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>
              </motion.div>
            )}
            
            {/* Past Events */}
            {pastEvents.slice(0, 2).map((event) => (
              <motion.div 
                key={event.id}
                whileHover={{ y: -10 }}
                className="bg-stone-50 rounded-3xl overflow-hidden border border-stone-100"
              >
                <img src={event.image_url} className="w-full h-56 object-cover opacity-80" alt={event.title} />
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
                  <img src={promo.brand?.logo_url} className="w-10 h-10 rounded-full object-cover" alt={promo.brand?.name} />
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
                  <img src={review.media_url} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt={review.title} />
                  {review.media_type === 'video' && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                      <Play className="w-12 h-12 text-white fill-current" />
                    </div>
                  )}
                </div>
                <h3 className="font-bold text-lg mb-2 group-hover:text-orange-600 transition-colors">{review.title}</h3>
                <div className="flex items-center gap-2 text-sm text-stone-400">
                  <img src={review.kol_avatar_url} className="w-6 h-6 rounded-full" alt={review.kol_name} />
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
                  <img 
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
          
          <div className="grid grid-cols-2 md:grid-cols-6 gap-12 items-center opacity-60">
            {partners.map((partner) => (
              <div key={partner.id} className="flex flex-col items-center group hover:opacity-100 transition-opacity">
                <img src={partner.logo_url} className="w-16 h-16 object-contain mb-4 grayscale group-hover:grayscale-0 transition-all" alt={partner.name} />
                <span className="text-[10px] uppercase tracking-widest font-bold text-stone-400">{partner.name}</span>
              </div>
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
      const { data } = await supabase.from('events').select('*').order('start_date', { ascending: false });
      if (data) setEvents(data);
    };
    fetchEvents();
  }, []);

  return (
    <div className="pt-24 min-h-screen bg-stone-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-12 text-center">
          <h1 className="text-4xl font-bold text-stone-900 mb-4">活動資訊</h1>
          <p className="text-stone-500 max-w-2xl mx-auto">探索「食在力量美食祭」的所有精彩活動，從過去的經典回顧到現在的熱門盛宴。</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {events.map((event) => (
            <motion.div 
              key={event.id}
              whileHover={{ y: -10 }}
              className="bg-white rounded-3xl overflow-hidden shadow-sm border border-stone-100 group"
            >
              <div className="relative h-64 overflow-hidden">
                <img src={event.image_url} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" alt={event.title} />
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
      const { data: partnersData } = await supabase.from('partners').select('*').eq('event_id', id);
      
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
        <img src={event.image_url} className="w-full h-full object-cover" alt={event.title} />
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
                  <div key={brand.id} className="group border border-stone-100 rounded-3xl p-6 hover:shadow-lg transition-all bg-white">
                    <div className="flex items-center gap-4 mb-4">
                      <img src={brand.logo_url} className="w-16 h-16 rounded-2xl object-cover bg-stone-50" alt={brand.name} />
                      <div>
                        <h3 className="font-bold text-lg">{brand.name}</h3>
                        <span className="text-[10px] uppercase tracking-wider text-orange-600 font-bold">{brand.category}</span>
                      </div>
                    </div>
                    <p className="text-stone-500 text-sm mb-6 line-clamp-2">{brand.description}</p>
                    <div className="bg-orange-50 p-4 rounded-2xl text-sm">
                      <p className="text-orange-800 font-bold mb-1">專屬優惠</p>
                      <p className="text-orange-600">{brand.promotion_info}</p>
                    </div>
                  </div>
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
                  <div key={partner.id} className="flex items-center gap-4 p-4 bg-stone-50 rounded-2xl hover:bg-stone-100 transition-colors">
                    <img src={partner.logo_url} className="w-12 h-12 rounded-xl object-cover shadow-sm" alt={partner.name} />
                    <div>
                      <h4 className="font-bold text-sm text-stone-800">{partner.name}</h4>
                      <p className="text-[10px] uppercase tracking-widest text-stone-400 font-bold">{partner.type}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="bg-orange-600 rounded-3xl p-8 text-white shadow-xl shadow-orange-200">
              <h3 className="text-xl font-bold mb-4">立即參與</h3>
              <p className="text-orange-100 text-sm mb-6">加入食在力量美食祭，探索更多美味驚喜！</p>
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

const MapPage = () => {
  return (
    <div className="pt-24 min-h-screen bg-stone-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-stone-900 mb-4">美食地圖</h1>
          <p className="text-stone-500">探索活動周邊的精選美食店家</p>
        </div>
        
        <div className="bg-white rounded-3xl p-4 shadow-sm border border-stone-200 h-[600px] flex items-center justify-center relative overflow-hidden">
          <div className="absolute inset-0 bg-stone-100 flex items-center justify-center">
            <div className="text-center">
              <MapPin className="w-12 h-12 text-stone-300 mx-auto mb-4" />
              <p className="text-stone-400 font-medium">地圖載入中...</p>
              <p className="text-stone-400 text-sm mt-2">（此處將整合 Google Maps 或 Leaflet）</p>
            </div>
          </div>
          
          {/* Mock Map Markers Overlay */}
          <div className="absolute top-1/4 left-1/3 bg-white p-2 rounded-lg shadow-lg border border-orange-100 flex items-center gap-2 animate-bounce">
            <Utensils className="w-4 h-4 text-orange-600" />
            <span className="text-xs font-bold">乾杯燒肉</span>
          </div>
          <div className="absolute bottom-1/3 right-1/4 bg-white p-2 rounded-lg shadow-lg border border-orange-100 flex items-center gap-2 animate-bounce [animation-delay:0.2s]">
            <Utensils className="w-4 h-4 text-orange-600" />
            <span className="text-xs font-bold">發肉燒肉</span>
          </div>
        </div>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-4 gap-6">
          {['燒肉', '火鍋', '便當', '手搖'].map((cat) => (
            <button key={cat} className="bg-white p-6 rounded-2xl border border-stone-100 hover:border-orange-200 hover:shadow-md transition-all text-center">
              <span className="block text-2xl mb-2">
                {cat === '燒肉' && '🔥'}
                {cat === '火鍋' && '🍲'}
                {cat === '便當' && '🍱'}
                {cat === '手搖' && '🧋'}
              </span>
              <span className="font-bold text-stone-700">{cat}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

const PartnersPage = () => {
  const [partners, setPartners] = useState<Partner[]>([]);

  useEffect(() => {
    const fetchPartners = async () => {
      const { data } = await supabase.from('partners').select('*');
      if (data) setPartners(data);
    };
    fetchPartners();
  }, []);

  return (
    <div className="pt-24 min-h-screen bg-stone-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-12 text-center">
          <h1 className="text-4xl font-bold text-stone-900 mb-4">贊助夥伴</h1>
          <p className="text-stone-500 max-w-2xl mx-auto">感謝所有支持「食在力量美食祭」的夥伴，因為有你們，美食的力量才能傳遞得更遠。</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {partners.length > 0 ? partners.map((partner) => (
            <div key={partner.id} className="bg-white p-8 rounded-3xl border border-stone-100 shadow-sm hover:shadow-md transition-all">
              <img src={partner.logo_url} className="w-20 h-20 rounded-2xl object-cover mb-6 bg-stone-50" alt={partner.name} />
              <h3 className="text-xl font-bold mb-2">{partner.name}</h3>
              <p className="text-orange-600 text-sm font-medium mb-4">{partner.type}</p>
              <p className="text-stone-500 text-sm leading-relaxed">{partner.content}</p>
            </div>
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

const KOLReviewsPage = () => {
  const [reviews, setReviews] = useState<KOLReview[]>([]);

  useEffect(() => {
    const fetchReviews = async () => {
      const { data } = await supabase.from('kol_reviews').select('*').order('created_at', { ascending: false });
      if (data) setReviews(data);
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
              <div className="relative aspect-video bg-stone-200">
                {review.media_type === 'video' ? (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <img src={review.media_url} className="w-full h-full object-cover opacity-80" alt={review.title} />
                    <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-all flex items-center justify-center">
                      <div className="w-16 h-16 bg-white/90 rounded-full flex items-center justify-center text-orange-600 shadow-xl transform group-hover:scale-110 transition-transform">
                        <Play className="w-8 h-8 fill-current" />
                      </div>
                    </div>
                  </div>
                ) : (
                  <img src={review.media_url} className="w-full h-full object-cover" alt={review.title} />
                )}
              </div>
              <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <img src={review.kol_avatar_url} className="w-10 h-10 rounded-full object-cover" alt={review.kol_name} />
                  <span className="font-bold text-stone-800">{review.kol_name}</span>
                </div>
                <h3 className="text-xl font-bold mb-2 group-hover:text-orange-600 transition-colors">{review.title}</h3>
                <p className="text-stone-500 text-sm line-clamp-3 mb-4">{review.content}</p>
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
                <img src={promo.image_url} className="w-full h-full object-cover" alt={promo.title} />
                <div className="absolute top-4 left-4 bg-orange-600 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 shadow-lg">
                  <Tag className="w-3 h-3" /> 限時優惠
                </div>
              </div>
              <div className="p-6 flex-grow flex flex-col">
                <div className="flex items-center gap-3 mb-4">
                  <img src={promo.brand?.logo_url} className="w-8 h-8 rounded-full object-cover bg-stone-50" alt={promo.brand?.name} />
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
                    <Calendar className="w-3 h-3" /> {promo.end_date} 截止
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

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState<'events' | 'brands' | 'partners' | 'locations' | 'kol_reviews' | 'promotions'>('events');
  const [events, setEvents] = useState<Event[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [kolReviews, setKolReviews] = useState<KOLReview[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  
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
  }, [activeTab]);

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
    } else {
      setEditorContent('');
      setImageUrl('');
      setAvatarUrl('');
      setLogoUrl('');
    }
  }, [editingEvent, editingBrand, editingPartner, editingKOL, editingPromotion]);

  const fetchData = async () => {
    if (activeTab === 'events') {
      const { data } = await supabase.from('events').select('*').order('created_at', { ascending: false });
      if (data) setEvents(data);
    } else if (activeTab === 'brands') {
      const { data } = await supabase.from('brands').select('*').order('created_at', { ascending: false });
      if (data) setBrands(data as any);
    } else if (activeTab === 'partners') {
      const { data } = await supabase.from('partners').select('*').order('created_at', { ascending: false });
      if (data) setPartners(data as any);
    } else if (activeTab === 'kol_reviews') {
      const { data } = await supabase.from('kol_reviews').select('*').order('created_at', { ascending: false });
      if (data) setKolReviews(data);
    } else if (activeTab === 'promotions') {
      const { data } = await supabase.from('promotions').select('*, brand:brands(name)').order('created_at', { ascending: false });
      if (data) setPromotions(data as any);
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
      kol_name: formData.get('kol_name') as string,
      kol_avatar_url: avatarUrl,
      media_type: formData.get('media_type') as string,
      media_url: imageUrl,
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
            <button className="w-full text-left px-4 py-3 rounded-xl text-stone-600 hover:bg-stone-200 font-medium">地圖管理</button>
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
                        <th className="pb-4 font-medium">類型</th>
                        <th className="pb-4 font-medium text-right">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-50">
                      {kolReviews.map(review => (
                        <tr key={review.id} className="group">
                          <td className="py-4 font-medium">{review.title}</td>
                          <td className="py-4 text-sm">{review.kol_name}</td>
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
                            <img src={brand.logo_url} className="w-8 h-8 rounded-full object-cover bg-stone-50" alt="" />
                            {brand.name}
                          </td>
                          <td className="py-4 text-right">
                            <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
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
                            <img src={partner.logo_url} className="w-8 h-8 rounded-full object-cover bg-stone-50" alt="" />
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
              onClick={() => setShowEventModal(false)}
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
                <button onClick={() => setShowEventModal(false)} className="text-stone-400 hover:text-stone-600">
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
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-stone-700 mb-2">影片網址 (YouTube 或 MP4)</label>
                    <input name="video_url" defaultValue={editingEvent?.video_url} className="w-full px-4 py-2 rounded-xl border border-stone-200 outline-none focus:ring-2 focus:ring-orange-600" placeholder="https://www.youtube.com/watch?v=..." />
                  </div>
                </div>
                <div className="pt-6 flex gap-4">
                  <button type="button" onClick={() => setShowEventModal(false)} className="flex-1 px-6 py-3 rounded-xl border border-stone-200 font-bold hover:bg-stone-50 transition-colors">取消</button>
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
              onClick={() => setShowBrandModal(false)}
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
                <button onClick={() => setShowBrandModal(false)} className="text-stone-400 hover:text-stone-600">
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
                    <ImageUpload 
                      label="品牌 Logo" 
                      value={logoUrl} 
                      onChange={setLogoUrl} 
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-stone-700 mb-2">品牌介紹 (區塊編輯器)</label>
                    <BlockEditor 
                      key={editingBrand?.id || 'new_brand'} 
                      initialContent={(editingBrand as any)?.content} 
                      onChange={setEditorContent} 
                    />
                  </div>
                </div>
                <div className="pt-6 flex gap-4">
                  <button type="button" onClick={() => setShowBrandModal(false)} className="flex-1 px-6 py-3 rounded-xl border border-stone-200 font-bold hover:bg-stone-50 transition-colors">取消</button>
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
              onClick={() => setShowPartnerModal(false)}
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
                <button onClick={() => setShowPartnerModal(false)} className="text-stone-400 hover:text-stone-600">
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
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-stone-700 mb-2">夥伴介紹 (區塊編輯器)</label>
                    <BlockEditor 
                      key={editingPartner?.id || 'new_partner'} 
                      initialContent={editingPartner?.content} 
                      onChange={setEditorContent} 
                    />
                  </div>
                </div>
                <div className="pt-6 flex gap-4">
                  <button type="button" onClick={() => setShowPartnerModal(false)} className="flex-1 px-6 py-3 rounded-xl border border-stone-200 font-bold hover:bg-stone-50 transition-colors">取消</button>
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
              onClick={() => setShowKOLModal(false)}
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
                <button onClick={() => setShowKOLModal(false)} className="text-stone-400 hover:text-stone-600">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <form onSubmit={handleSaveKOL} className="p-8 space-y-6 max-h-[70vh] overflow-y-auto">
                <div className="grid grid-cols-2 gap-6">
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
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-2">媒體類型</label>
                    <select name="media_type" defaultValue={editingKOL?.media_type} className="w-full px-4 py-2 rounded-xl border border-stone-200 outline-none focus:ring-2 focus:ring-orange-600">
                      <option value="image">圖文</option>
                      <option value="video">影片</option>
                    </select>
                  </div>
                  <div>
                    <ImageUpload 
                      label="媒體封面 / 圖片" 
                      value={imageUrl} 
                      onChange={setImageUrl} 
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-stone-700 mb-2">開箱內容 (區塊編輯器)</label>
                    <BlockEditor 
                      key={editingKOL?.id || 'new_kol'} 
                      initialContent={editingKOL?.content} 
                      onChange={setEditorContent} 
                    />
                  </div>
                </div>
                <div className="pt-6 flex gap-4">
                  <button type="button" onClick={() => setShowKOLModal(false)} className="flex-1 px-6 py-3 rounded-xl border border-stone-200 font-bold hover:bg-stone-50 transition-colors">取消</button>
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
              onClick={() => setShowPromotionModal(false)}
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
                <button onClick={() => setShowPromotionModal(false)} className="text-stone-400 hover:text-stone-600">
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
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-2">折扣碼</label>
                    <input name="discount_code" defaultValue={editingPromotion?.discount_code} className="w-full px-4 py-2 rounded-xl border border-stone-200 outline-none focus:ring-2 focus:ring-orange-600" />
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
                  <button type="button" onClick={() => setShowPromotionModal(false)} className="flex-1 px-6 py-3 rounded-xl border border-stone-200 font-bold hover:bg-stone-50 transition-colors">取消</button>
                  <button type="submit" className="flex-1 px-6 py-3 rounded-xl bg-orange-600 text-white font-bold hover:bg-orange-500 transition-colors">儲存優惠</button>
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
  return (
    <Router>
      <div className="min-h-screen bg-white font-sans text-stone-900">
        <Navbar />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/events" element={<EventsPage />} />
          <Route path="/event/:id" element={<EventDetail />} />
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
              <span className="font-bold text-lg">食在力量美食祭</span>
            </div>
            <p className="text-stone-500 text-sm mb-4">© 2026 Food Power Festival. All rights reserved.</p>
            <Link to="/login" className="text-stone-800 text-[10px] hover:text-stone-700 transition-colors opacity-20 hover:opacity-100">管理登入</Link>
          </div>
        </footer>
      </div>
    </Router>
  );
}
