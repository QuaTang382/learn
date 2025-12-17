
import React, { useState, useEffect, useRef } from 'react';
import { QuizSet } from '../types';

interface QuizPlayerProps {
  quiz: QuizSet;
  onClose: () => void;
}

const QuizPlayer: React.FC<QuizPlayerProps> = ({ quiz, onClose }) => {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [finished, setFinished] = useState(false);
  const [streak, setStreak] = useState(0);
  
  const correctSfx = useRef(new Audio('https://actions.google.com/sounds/v1/cartoon/clink_clack.ogg'));
  const wrongSfx = useRef(new Audio('https://actions.google.com/sounds/v1/cartoon/boing.ogg'));
  const winSfx = useRef(new Audio('https://actions.google.com/sounds/v1/foley/wind_chime_fast.ogg'));

  const currentQuestion = quiz.questions[currentIdx];

  const handleOptionSelect = (idx: number) => {
    if (isAnswered) return;
    setSelectedOption(idx);
    setIsAnswered(true);
    
    if (idx === currentQuestion.correctAnswer) {
      setScore(prev => prev + 1);
      setStreak(prev => prev + 1);
      correctSfx.current.play().catch(() => {});
    } else {
      setStreak(0);
      wrongSfx.current.play().catch(() => {});
    }
  };

  const nextQuestion = () => {
    if (currentIdx + 1 < quiz.questions.length) {
      setCurrentIdx(prev => prev + 1);
      setSelectedOption(null);
      setIsAnswered(false);
    } else {
      setFinished(true);
      winSfx.current.play().catch(() => {});
    }
  };

  if (finished) {
    return (
      <div className="fixed inset-0 bg-[#0f172a] z-50 flex flex-col items-center justify-center p-6 text-center animate__animated animate__fadeIn">
        <div className="mb-10 relative">
          <div className="w-48 h-48 bg-yellow-400/20 rounded-full flex items-center justify-center mx-auto mb-4 animate__animated animate__bounceIn">
             <span className="text-8xl floating">🏆</span>
          </div>
          <div className="absolute -top-4 -right-4 bg-indigo-600 text-white px-4 py-2 rounded-full font-bold shadow-xl animate__animated animate__jackInTheBox">
            SIÊU CẤP!
          </div>
        </div>
        
        <h2 className="text-5xl font-black text-white mb-2">Hoàn thành!</h2>
        <p className="text-2xl text-indigo-300 mb-8">Bạn đã chinh phục được {score}/{quiz.questions.length} kiến thức</p>
        
        <div className="flex gap-4">
          <button 
            onClick={onClose}
            className="px-10 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-2xl font-bold hover:scale-105 transition-all shadow-2xl shadow-indigo-500/40"
          >
            Về bảng tin
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-[#0f172a] z-50 flex flex-col p-4 md:p-8 animate__animated animate__slideInUp overflow-y-auto">
      <div className="max-w-4xl mx-auto w-full flex flex-col min-h-full">
        {/* Header */}
        <div className="flex justify-between items-center mb-8 bg-white/5 p-4 rounded-2xl backdrop-blur-md">
          <div className="flex flex-col">
            <span className="text-indigo-400 text-xs font-bold uppercase tracking-widest">Đang trả lời</span>
            <div className="text-white font-black text-xl">
              Câu {currentIdx + 1} <span className="text-slate-500 font-normal">/ {quiz.questions.length}</span>
            </div>
          </div>
          
          <div className="flex-1 mx-8 h-3 bg-slate-800 rounded-full overflow-hidden shadow-inner">
            <div 
              className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-1000 ease-out" 
              style={{ width: `${((currentIdx + 1) / quiz.questions.length) * 100}%` }}
            />
          </div>

          <div className="flex items-center gap-4">
             {streak > 1 && (
               <div className="hidden md:flex items-center gap-1 bg-orange-500 text-white px-3 py-1 rounded-full font-bold animate__animated animate__pulse animate__infinite">
                 🔥 {streak}x
               </div>
             )}
             <button onClick={onClose} className="text-white/40 hover:text-white text-3xl transition-colors">×</button>
          </div>
        </div>

        {/* Question Area */}
        <div className="flex-1 flex flex-col justify-center items-center text-center space-y-10 py-6">
          <div className={`transition-all duration-500 ${isAnswered ? 'scale-95 opacity-80' : 'scale-100'}`}>
             <h1 className="text-3xl md:text-5xl font-black text-white px-4 leading-tight drop-shadow-2xl">
              {currentQuestion.question}
            </h1>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 w-full">
            {currentQuestion.options.map((option, idx) => {
              let btnClass = "relative p-6 md:p-8 text-lg font-bold rounded-3xl transition-all text-left flex items-center border-4 group ";
              
              if (!isAnswered) {
                btnClass += "bg-white/5 hover:bg-white/10 text-white border-white/10 hover:border-indigo-500/50 hover:-translate-y-1 active:scale-95";
              } else {
                if (idx === currentQuestion.correctAnswer) {
                  btnClass += "bg-emerald-500 border-emerald-400 text-white scale-105 shadow-[0_0_40px_rgba(16,185,129,0.4)] animate__animated animate__heartBeat";
                } else if (idx === selectedOption) {
                  btnClass += "bg-rose-500 border-rose-400 text-white animate__animated animate__shakeX";
                } else {
                  btnClass += "bg-white/5 border-transparent text-white/30 scale-95 opacity-40";
                }
              }

              return (
                <button 
                  key={idx} 
                  onClick={() => handleOptionSelect(idx)}
                  disabled={isAnswered}
                  className={btnClass}
                >
                  <span className={`w-10 h-10 rounded-xl flex items-center justify-center mr-4 text-sm transition-colors ${!isAnswered ? 'bg-white/10 group-hover:bg-indigo-500' : 'bg-black/20'}`}>
                    {String.fromCharCode(65 + idx)}
                  </span>
                  <span className="flex-1">{option}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Feedback Area */}
        <div className="h-40 flex flex-col justify-center items-center mt-6">
          {isAnswered && (
            <div className="w-full flex flex-col items-center animate__animated animate__fadeInUp">
              <div className="bg-white/5 backdrop-blur-xl p-4 rounded-2xl border border-white/10 mb-6 max-w-2xl w-full">
                <p className="text-indigo-200 text-center text-sm">
                   <span className="font-bold text-white block mb-1 uppercase tracking-tighter">💡 Giải thích:</span>
                   {currentQuestion.explanation}
                </p>
              </div>
              <button 
                onClick={nextQuestion}
                className="px-20 py-5 bg-white text-indigo-900 rounded-2xl font-black text-xl hover:bg-indigo-50 transition-all shadow-[0_20px_50px_rgba(255,255,255,0.2)] active:scale-95"
              >
                CÂU TIẾP THEO ➔
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default QuizPlayer;
