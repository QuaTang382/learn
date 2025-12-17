
import React, { useState, useEffect, useRef } from 'react';
import { QuizSet } from './types';
import { extractTextFromFile } from './services/fileService';
import { generateQuizFromText } from './services/geminiService';
import QuizPlayer from './components/QuizPlayer';
import * as fflate from 'fflate';

const COLORS = [
  'bg-gradient-to-br from-pink-500/20 to-rose-500/20 border-pink-500/30 text-pink-100',
  'bg-gradient-to-br from-blue-500/20 to-indigo-500/20 border-blue-500/30 text-blue-100',
  'bg-gradient-to-br from-amber-500/20 to-orange-500/20 border-amber-500/30 text-amber-100',
  'bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border-emerald-500/30 text-emerald-100',
  'bg-gradient-to-br from-purple-500/20 to-violet-500/20 border-purple-500/30 text-purple-100',
];

/**
 * Nén dữ liệu: String -> UTF8 -> GZIP (fflate) -> Base64 (URL Safe)
 */
const compressAndEncode = (obj: any): string => {
  const str = JSON.stringify(obj);
  const buf = new TextEncoder().encode(str);
  const compressed = fflate.zlibSync(buf, { level: 9 });
  let binary = "";
  for (let i = 0; i < compressed.length; i++) {
    binary += String.fromCharCode(compressed[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

/**
 * Giải nén dữ liệu: Base64 -> GZIP Decompress -> UTF8 -> JSON
 */
const decodeAndDecompress = (encoded: string): any => {
  // Revert URL safe base64
  let base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) base64 += '=';
  
  const binary = atob(base64);
  const buf = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    buf[i] = binary.charCodeAt(i);
  }
  const decompressed = fflate.unzlibSync(buf);
  const str = new TextDecoder().decode(decompressed);
  return JSON.parse(str);
};

const App: React.FC = () => {
  const [quizzes, setQuizzes] = useState<QuizSet[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [activeQuiz, setActiveQuiz] = useState<QuizSet | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isMusicPlaying, setIsMusicPlaying] = useState(false);
  
  const bgMusic = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    bgMusic.current = new Audio('https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3');
    bgMusic.current.loop = true;
    bgMusic.current.volume = 0.2;
    
    const params = new URLSearchParams(window.location.search);
    const sharedData = params.get('share');
    if (sharedData) {
      try {
        const decoded = decodeAndDecompress(sharedData);
        if (decoded && decoded.id && decoded.questions) {
          setActiveQuiz(decoded);
          setQuizzes(prev => {
            if (prev.find(q => q.id === decoded.id)) return prev;
            return [decoded, ...prev];
          });
        }
      } catch (e) {
        console.error("Lỗi giải mã link chia sẻ:", e);
        setError("Link chia sẻ không hợp lệ, bị hỏng hoặc quá cũ.");
      } finally {
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }

    const saved = localStorage.getItem('edu_quizzes_v2');
    if (saved) {
      try {
        setQuizzes(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load local storage", e);
      }
    }

    return () => {
      if (bgMusic.current) {
        bgMusic.current.pause();
        bgMusic.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (quizzes.length > 0) {
      localStorage.setItem('edu_quizzes_v2', JSON.stringify(quizzes));
    }
  }, [quizzes]);

  const toggleMusic = () => {
    if (!bgMusic.current) return;
    if (isMusicPlaying) {
      bgMusic.current.pause();
    } else {
      bgMusic.current.play().catch(() => alert("Bấm vào trang web trước khi bật nhạc!"));
    }
    setIsMusicPlaying(!isMusicPlaying);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setError(null);

    try {
      const text = await extractTextFromFile(file);
      const title = file.name.replace(/\.[^/.]+$/, "");
      const questions = await generateQuizFromText(text, title);
      
      const newQuiz: QuizSet = {
        id: `quiz-${Date.now()}`,
        title,
        description: `Trích xuất từ: ${file.name}. AI đã ưu tiên giữ nguyên các câu hỏi gốc tìm thấy trong tài liệu.`,
        questions,
        createdAt: Date.now(),
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
      };

      setQuizzes(prev => [newQuiz, ...prev]);
    } catch (err: any) {
      setError(err.message || "Đã có lỗi xảy ra khi xử lý file.");
    } finally {
      setIsUploading(false);
      event.target.value = '';
    }
  };

  const shareQuiz = (quiz: QuizSet, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const compressedData = compressAndEncode(quiz);
      const url = `${window.location.origin}${window.location.pathname}?share=${compressedData}`;
      
      if (url.length > 8000) {
        alert("Bộ đề quá lớn (vượt giới hạn URL của trình duyệt). Hãy thử chia sẻ bộ đề ít câu hỏi hơn.");
        return;
      }

      navigator.clipboard.writeText(url);
      alert("Đã sao chép link chia sẻ đã nén! Gửi link này để bạn bè chơi ngay mà không cần tải file.");
    } catch (err) {
      console.error("Lỗi khi tạo link chia sẻ:", err);
      alert("Không thể tạo link chia sẻ. Có lỗi trong quá trình nén dữ liệu.");
    }
  };

  const deleteQuiz = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm("Xóa bộ câu hỏi này khỏi thư viện cá nhân?")) {
      const updated = quizzes.filter(q => q.id !== id);
      setQuizzes(updated);
      localStorage.setItem('edu_quizzes_v2', JSON.stringify(updated));
    }
  };

  return (
    <div className="min-h-screen pb-24 bg-[#0f172a] text-slate-100">
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none opacity-20 overflow-hidden z-0">
         <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600 rounded-full blur-[120px]"></div>
         <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600 rounded-full blur-[120px]"></div>
      </div>

      <nav className="sticky top-0 z-40 bg-slate-900/60 backdrop-blur-xl border-b border-white/5 px-4 md:px-12 py-5 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-tr from-indigo-600 to-purple-600 rounded-2xl flex items-center justify-center text-white font-black text-2xl shadow-[0_0_20px_rgba(79,70,229,0.5)]">
            E
          </div>
          <div className="hidden sm:block">
             <h1 className="text-2xl font-black tracking-tighter">EduAI <span className="text-indigo-400">Master</span></h1>
             <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Pro Learning Platform</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <button 
            onClick={toggleMusic}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${isMusicPlaying ? 'bg-indigo-600 text-white shadow-[0_0_15px_rgba(79,70,229,0.5)]' : 'bg-white/5 text-slate-400'}`}
          >
            {isMusicPlaying ? '🎵' : '🔇'}
          </button>
          
          <label className="cursor-pointer bg-white text-indigo-900 px-6 py-3 rounded-2xl font-black transition-all hover:scale-105 active:scale-95 flex items-center gap-2 shadow-xl shadow-white/10">
            <span>+ TẢI FILE LÊN</span>
            <input type="file" className="hidden" accept=".pdf,.docx,.txt" onChange={handleFileUpload} disabled={isUploading} />
          </label>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-12 relative z-10">
        <header className="mb-16 text-center md:text-left flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h2 className="text-5xl md:text-7xl font-black mb-6 leading-none">
              Học tập <br/><span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">Không giới hạn.</span>
            </h2>
            <p className="text-xl text-slate-400 max-w-xl font-medium">
              Sử dụng AI để biến tài liệu ôn tập khô khan thành trải nghiệm học tập tương tác đỉnh cao.
            </p>
          </div>
          <div className="flex gap-4 p-4 bg-white/5 rounded-3xl border border-white/10 backdrop-blur-sm">
             <div className="text-center px-4">
               <div className="text-2xl font-black text-white">{quizzes.length}</div>
               <div className="text-[10px] text-slate-500 font-bold uppercase">Thư viện</div>
             </div>
             <div className="w-px h-10 bg-white/10 my-auto"></div>
             <div className="text-center px-4">
               <div className="text-2xl font-black text-white">
                 {quizzes.reduce((acc, q) => acc + q.questions.length, 0)}
               </div>
               <div className="text-[10px] text-slate-500 font-bold uppercase">Câu hỏi</div>
             </div>
          </div>
        </header>

        {error && (
          <div className="mb-10 p-6 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-3xl flex items-center gap-4 animate__animated animate__headShake">
            <span className="text-2xl">⚠️</span>
            <span className="font-bold">{error}</span>
          </div>
        )}

        {isUploading && (
          <div className="mb-16 p-20 glass-panel rounded-[40px] flex flex-col items-center text-center animate__animated animate__fadeIn">
            <div className="relative mb-8">
              <div className="w-24 h-24 border-8 border-indigo-600/20 border-t-indigo-500 rounded-full animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center font-black text-indigo-400 animate-pulse">AI</div>
            </div>
            <h3 className="text-3xl font-black text-white">Đang phân tích tài liệu...</h3>
            <p className="text-slate-500 mt-4 max-w-md">Gemini đang trích xuất câu hỏi và tối ưu hóa bộ đề cho bạn.</p>
          </div>
        )}

        <div className="masonry-grid">
          {quizzes.map(quiz => (
            <div 
              key={quiz.id}
              onClick={() => setActiveQuiz(quiz)}
              className={`quiz-card group relative p-8 rounded-[32px] border-2 transition-all cursor-pointer ${quiz.color} shadow-2xl overflow-hidden`}
            >
              <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/5 rounded-full blur-2xl group-hover:bg-white/10 transition-colors"></div>
              
              <div className="flex justify-between items-start mb-6">
                <span className="bg-black/20 backdrop-blur-md px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest text-white/80">
                  {quiz.questions.length} CÂU HỎI
                </span>
                <div className="flex gap-2 relative z-20">
                   <button 
                    onClick={(e) => shareQuiz(quiz, e)}
                    className="p-3 bg-white/10 hover:bg-indigo-500 rounded-2xl transition-all text-white active:scale-90"
                    title="Chia sẻ link nén"
                  >
                    🔗
                  </button>
                  <button 
                    onClick={(e) => deleteQuiz(quiz.id, e)}
                    className="p-3 bg-rose-500/20 hover:bg-rose-600 rounded-2xl transition-all text-white active:scale-90"
                    title="Xóa bộ đề"
                  >
                    🗑️
                  </button>
                </div>
              </div>
              
              <h3 className="text-2xl font-black mb-3 leading-tight group-hover:text-white transition-colors">
                {quiz.title}
              </h3>
              <p className="text-white/60 text-sm line-clamp-2 mb-8 font-medium">
                {quiz.description}
              </p>
              
              <div className="flex items-center justify-between pt-4 border-t border-white/10">
                 <span className="text-[10px] font-bold opacity-40 uppercase tracking-widest">
                   Tạo ngày: {new Date(quiz.createdAt).toLocaleDateString('vi-VN')}
                 </span>
                 <div className="flex items-center gap-2 bg-white text-slate-900 px-4 py-2 rounded-xl font-black text-xs group-hover:scale-110 transition-transform">
                    CHƠI ➔
                 </div>
              </div>
            </div>
          ))}
        </div>

        {quizzes.length === 0 && !isUploading && (
          <div className="py-32 flex flex-col items-center justify-center opacity-30 grayscale">
            <div className="text-9xl mb-8 floating">📚</div>
            <p className="text-2xl font-black">THƯ VIỆN ĐANG TRỐNG</p>
            <p className="mt-2 font-bold italic">Kéo thả file PDF hoặc DOCX vào đây để bắt đầu!</p>
          </div>
        )}
      </div>

      {activeQuiz && (
        <QuizPlayer quiz={activeQuiz} onClose={() => setActiveQuiz(null)} />
      )}
    </div>
  );
};

export default App;
