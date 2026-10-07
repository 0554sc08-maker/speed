import { useState, useEffect } from 'react';
import { 
  Users, Sparkles, Database, Laptop, Smartphone, 
  HelpCircle, CheckCircle2, ChevronRight 
} from 'lucide-react';
import { GameRoomState } from './types/game';
import { GameService, getSupabaseConfig } from './lib/supabase';
import { TeacherView } from './components/TeacherView';
import { StudentView } from './components/StudentView';
import { SupabaseModal } from './components/SupabaseModal';

export default function App() {
  const [role, setRole] = useState<'SELECT' | 'TEACHER' | 'STUDENT'>('SELECT');
  const [roomCode, setRoomCode] = useState<string>('ROOM-702');
  const [roomTitle, setRoomTitle] = useState<string>('우리 반 키워드 경험 공유 스피드 퀴즈');
  const [roomState, setRoomState] = useState<GameRoomState | null>(null);
  const [gameService, setGameService] = useState<GameService | null>(null);
  const [isSupabaseModalOpen, setIsSupabaseModalOpen] = useState(false);
  const [isSupabaseEnabled, setIsSupabaseEnabled] = useState(false);

  // Check URL params on initial load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlRole = params.get('role');
    const urlRoom = params.get('room');

    if (urlRoom) {
      setRoomCode(urlRoom.toUpperCase());
    }

    if (urlRole === 'student') {
      setRole('STUDENT');
    } else if (urlRole === 'teacher') {
      setRole('TEACHER');
    }

    const config = getSupabaseConfig();
    setIsSupabaseEnabled(config.isEnabled);
  }, []);

  // When teacher role is chosen and room code is set, initialize room
  useEffect(() => {
    if (role === 'TEACHER' && roomCode) {
      const service = new GameService(roomCode);
      setGameService(service);

      service.initRoom(roomTitle).then((initial) => {
        setRoomState(initial);
      });

      const unsubscribe = service.subscribe((updated) => {
        setRoomState(updated);
      });

      return () => {
        unsubscribe();
      };
    }
  }, [role, roomCode, roomTitle]);

  const handleConfigSaved = () => {
    const config = getSupabaseConfig();
    setIsSupabaseEnabled(config.isEnabled);
    // Reload room if in teacher view
    if (gameService) {
      gameService.getRoom().then((st) => {
        if (st) setRoomState(st);
      });
    }
  };

  const handleCreateRoom = (code: string, title: string) => {
    setRoomCode(code.toUpperCase());
    setRoomTitle(title);
    setRole('TEACHER');
  };

  // If in Teacher role
  if (role === 'TEACHER' && roomState && gameService) {
    return (
      <>
        <TeacherView
          roomState={roomState}
          gameService={gameService}
          onOpenSupabaseModal={() => setIsSupabaseModalOpen(true)}
          isSupabaseEnabled={isSupabaseEnabled}
        />
        <SupabaseModal
          isOpen={isSupabaseModalOpen}
          onClose={() => setIsSupabaseModalOpen(false)}
          onConfigSaved={handleConfigSaved}
        />
      </>
    );
  }

  // If in Student role
  if (role === 'STUDENT') {
    return (
      <>
        <StudentView
          initialRoomCode={roomCode}
          onSwitchToTeacher={() => setRole('TEACHER')}
        />
        <SupabaseModal
          isOpen={isSupabaseModalOpen}
          onClose={() => setIsSupabaseModalOpen(false)}
          onConfigSaved={handleConfigSaved}
        />
      </>
    );
  }

  // Initial Role Selection & Launch Screen
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Top Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-slate-850 bg-slate-900/60 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center font-black text-white text-base shadow-lg shadow-indigo-600/30">
            Q
          </div>
          <span className="font-bold text-white text-lg tracking-tight">
            키워드 경험 스피드게임
          </span>
        </div>

        <button
          onClick={() => setIsSupabaseModalOpen(true)}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
            isSupabaseEnabled
              ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300'
              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
          }`}
        >
          <Database className="w-3.5 h-3.5" />
          <span>{isSupabaseEnabled ? 'Supabase 실시간 연동됨' : 'Supabase 설정'}</span>
        </button>
      </header>

      {/* Hero Body */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-6 sm:p-10 flex flex-col justify-center items-center text-center space-y-12">
        {/* Title Tagline */}
        <div className="space-y-4 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-950/80 border border-indigo-800/60 text-indigo-300 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>실시간 다중 접속 &amp; 스피드 퀴즈 플랫폼</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight">
            3~6개의 키워드로 공유하는<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-cyan-400 to-emerald-400">
              우리 반 경험 스피드 퀴즈!
            </span>
          </h1>
          <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
            여러 학생들이 동시에 키워드로 자신만의 경험을 작성하면, 교사 화면에 실시간으로 취합됩니다.
            하나씩 공개되는 키워드를 보고 누구의 경험인지 가장 먼저 맞혀보세요!
          </p>
        </div>

        {/* Dual Role Selector Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-3xl">
          {/* Teacher Card */}
          <div className="p-8 rounded-3xl bg-slate-900/90 border border-slate-800 hover:border-indigo-500/60 transition-all text-left flex flex-col justify-between group shadow-xl hover:shadow-indigo-500/10">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 flex items-center justify-center">
                <Laptop className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">교사 / 진행자</span>
                <h3 className="text-xl font-bold text-white">대형 스크린 / 교사 모드</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  프로젝터나 전자칠판에 띄워두고 학생들의 제출 현황을 실시간으로 취합하고, 키워드 순차 공개 및 버저 판정을 진행합니다.
                </p>
              </div>

              {/* Quick room code setting */}
              <div className="pt-2 space-y-2">
                <label className="text-[11px] font-semibold text-slate-400">생성할 방 코드</label>
                <input
                  type="text"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono text-sm tracking-wider focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="pt-6">
              <button
                onClick={() => handleCreateRoom(roomCode, roomTitle)}
                className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm shadow-lg shadow-indigo-600/20 transition-all flex items-center justify-center gap-2 group-hover:gap-3"
              >
                <span>교사 화면으로 시작하기</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Student Card */}
          <div className="p-8 rounded-3xl bg-slate-900/90 border border-slate-800 hover:border-emerald-500/60 transition-all text-left flex flex-col justify-between group shadow-xl hover:shadow-emerald-500/10">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
                <Smartphone className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">학생 / 참여자</span>
                <h3 className="text-xl font-bold text-white">스마트폰 / 학생 모드</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  키워드 3~6개로 나의 경험을 공유하고 제출한 뒤, 실시간 스피드 퀴즈에서 버저를 누르고 친구들의 경험을 맞힙니다.
                </p>
              </div>

              <div className="pt-2 p-3 rounded-xl bg-slate-950 border border-slate-850 text-xs text-slate-400 space-y-1">
                <div className="flex items-center gap-1.5 text-slate-300 font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>한 컴퓨터에서도 다중 탭 테스트 가능</span>
                </div>
                <p className="text-[11px] text-slate-500">
                  교사 화면과 학생 화면을 각각 새 탭이나 창으로 열어두면 즉시 실시간 동기화됩니다.
                </p>
              </div>
            </div>

            <div className="pt-6">
              <button
                onClick={() => setRole('STUDENT')}
                className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 group-hover:gap-3"
              >
                <span>학생으로 퀴즈 참여하기</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Bottom Feature Highlights */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-left max-w-4xl w-full pt-4 border-t border-slate-900">
          <div className="space-y-1.5">
            <div className="text-xs font-bold text-indigo-400 flex items-center gap-1">
              <Users className="w-4 h-4" />
              <span>동시 다중 학생 실시간 취합</span>
            </div>
            <p className="text-xs text-slate-400">
              교실 내 모든 학생이 동시에 키워드를 전송해도 즉시 교사 화면에 실시간으로 집계됩니다.
            </p>
          </div>

          <div className="space-y-1.5">
            <div className="text-xs font-bold text-amber-400 flex items-center gap-1">
              <Sparkles className="w-4 h-4" />
              <span>스피드 버저 &amp; 점수 산정</span>
            </div>
            <p className="text-xs text-slate-400">
              키워드가 1개 공개되었을 때 맞히면 500점! 키워드가 늘어날수록 점수가 줄어들어 긴장감 넘칩니다.
            </p>
          </div>

          <div className="space-y-1.5">
            <div className="text-xs font-bold text-emerald-400 flex items-center gap-1">
              <Database className="w-4 h-4" />
              <span>Supabase 실시간 백엔드 지원</span>
            </div>
            <p className="text-xs text-slate-400">
              Supabase 클라우드 Realtime 채널 연동은 물론, 무설정 로컬 브로드캐스트 모드까지 완벽 지원합니다.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 py-4 px-6 text-center text-xs text-slate-600 flex items-center justify-between">
        <span>키워드 경험 스피드게임 &middot; 교실 인터랙티브 웹앱</span>
        <button
          onClick={() => setIsSupabaseModalOpen(true)}
          className="hover:text-slate-400 transition-colors flex items-center gap-1"
        >
          <HelpCircle className="w-3.5 h-3.5" />
          <span>Supabase SQL 테이블 설정 안내</span>
        </button>
      </footer>

      <SupabaseModal
        isOpen={isSupabaseModalOpen}
        onClose={() => setIsSupabaseModalOpen(false)}
        onConfigSaved={handleConfigSaved}
      />
    </div>
  );
}
