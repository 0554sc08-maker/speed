import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { 
  Play, Users, Eye, EyeOff, Sparkles, Trophy, 
  RotateCcw, Volume2, VolumeX, Database, 
  ArrowRight, Check, X as CloseIcon, Flame, Clock, 
  UserCheck, ExternalLink, HelpCircle, Shuffle
} from 'lucide-react';
import { GameRoomState, Submission } from '../types/game';
import { GameService } from '../lib/supabase';
import { sound } from '../lib/sound';
import { SAMPLE_STUDENTS } from '../lib/demoData';

interface Props {
  roomState: GameRoomState;
  gameService: GameService;
  onOpenSupabaseModal: () => void;
  isSupabaseEnabled: boolean;
}

export const TeacherView: React.FC<Props> = ({
  roomState,
  gameService,
  onOpenSupabaseModal,
  isSupabaseEnabled,
}) => {
  const [isProjectorMode, setIsProjectorMode] = useState<boolean>(true);
  const [isMuted, setIsMuted] = useState<boolean>(sound.getMuted());
  const [copyNotification, setCopyNotification] = useState<string | null>(null);
  const [autoTimerActive, setAutoTimerActive] = useState<boolean>(false);
  const autoTimerRef = useRef<NodeJS.Timeout | null>(null);

  const currentSubmission: Submission | undefined = 
    roomState.submissions[roomState.currentRoundIndex];

  // Auto reveal timer effect
  useEffect(() => {
    if (roomState.phase === 'QUIZ' && autoTimerActive && !roomState.isAnswerRevealed && !roomState.currentBuzzerUser) {
      autoTimerRef.current = setTimeout(async () => {
        if (!currentSubmission) return;
        if (roomState.revealedKeywordCount < currentSubmission.keywords.length) {
          sound.playCardFlip();
          await gameService.updateState({
            revealedKeywordCount: roomState.revealedKeywordCount + 1,
          });
        } else {
          setAutoTimerActive(false);
        }
      }, 4000);
    }
    return () => {
      if (autoTimerRef.current) clearTimeout(autoTimerRef.current);
    };
  }, [roomState, autoTimerActive, currentSubmission, gameService]);

  const handleToggleMute = () => {
    const muted = sound.toggleMute();
    setIsMuted(muted);
  };

  const handleCopyLink = () => {
    const url = `${window.location.origin}${window.location.pathname}?role=student&room=${roomState.code}`;
    navigator.clipboard.writeText(url);
    setCopyNotification('학생 접속 링크가 복사되었습니다!');
    setTimeout(() => setCopyNotification(null), 2500);
  };

  const handleOpenStudentTab = () => {
    const url = `${window.location.origin}${window.location.pathname}?role=student&room=${roomState.code}`;
    window.open(url, '_blank');
  };

  const handleAddSampleStudents = async () => {
    sound.playSubmission();
    for (const sample of SAMPLE_STUDENTS) {
      await gameService.submitKeywords(sample.name, sample.avatar, sample.keywords, sample.story);
    }
    setCopyNotification('샘플 학생 5명의 경험 키워드가 등록되었습니다!');
    setTimeout(() => setCopyNotification(null), 2500);
  };

  const handleStartGame = async () => {
    if (roomState.submissions.length === 0) return;
    sound.playSuccess();
    // Shuffle submissions for fairness
    const shuffled = [...roomState.submissions].sort(() => Math.random() - 0.5);
    await gameService.updateState({
      phase: 'QUIZ',
      submissions: shuffled,
      currentRoundIndex: 0,
      revealedKeywordCount: 1,
      isAnswerRevealed: false,
      currentBuzzerUser: null,
      buzzerTimestamp: null,
      roundTimer: 15,
      isAutoReveal: false,
    });
  };

  const handleRevealNextKeyword = async () => {
    if (!currentSubmission) return;
    if (roomState.revealedKeywordCount < currentSubmission.keywords.length) {
      sound.playCardFlip();
      await gameService.updateState({
        revealedKeywordCount: roomState.revealedKeywordCount + 1,
      });
    }
  };

  const handleRevealAnswer = async () => {
    sound.playFanfare();
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
    });
    await gameService.updateState({
      isAnswerRevealed: true,
      currentBuzzerUser: null,
    });
  };

  const handleAwardPoints = async (studentName: string, isCorrect: boolean) => {
    if (isCorrect) {
      sound.playSuccess();
      confetti({ particleCount: 60, spread: 50, origin: { y: 0.7 } });
      await gameService.submitGuess(studentName, currentSubmission?.studentName || '');
    } else {
      sound.playWrong();
      await gameService.updateState({
        currentBuzzerUser: null, // release buzzer
      });
    }
  };

  const handleNextRound = async () => {
    sound.playCardFlip();
    const nextIdx = roomState.currentRoundIndex + 1;
    if (nextIdx >= roomState.submissions.length) {
      // Game ended
      sound.playFanfare();
      confetti({ particleCount: 120, spread: 80, origin: { y: 0.5 } });
      await gameService.updateState({
        phase: 'RESULT',
      });
    } else {
      await gameService.updateState({
        currentRoundIndex: nextIdx,
        revealedKeywordCount: 1,
        isAnswerRevealed: false,
        currentBuzzerUser: null,
        buzzerTimestamp: null,
      });
    }
  };

  const handleRestartLobby = async () => {
    await gameService.updateState({
      phase: 'LOBBY',
      currentRoundIndex: 0,
      revealedKeywordCount: 1,
      isAnswerRevealed: false,
      currentBuzzerUser: null,
    });
  };

  // Current potential points calculation
  const currentPotentialPoints = Math.max(100, 600 - roomState.revealedKeywordCount * 100);

  // Ranked scores list
  const rankedScores = Object.values(roomState.scores).sort((a, b) => b.score - a.score);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Top Bar Contract (Brand - Nav Links/Info - Primary Actions) */}
      <header className="flex items-center justify-between px-6 py-3.5 border-b border-slate-850 bg-slate-950/80 backdrop-blur-md sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 inline-block animate-pulse" />
            키워드 스피드 퀴즈
          </span>
          <span className="text-xs text-slate-500 font-mono">교사 진행자 모드</span>
        </div>

        <div className="hidden md:flex items-center gap-4 text-xs font-mono text-slate-400">
          <div className="flex items-center gap-2 px-3 py-1 bg-slate-900 border border-slate-800 rounded-lg">
            <span className="text-slate-500">방 코드</span>
            <span className="text-indigo-400 font-bold tracking-wider text-sm">{roomState.code}</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1 bg-slate-900 border border-slate-800 rounded-lg">
            <Users className="w-3.5 h-3.5 text-emerald-400" />
            <span>제출 현황</span>
            <span className="text-white font-semibold tabular-nums">{roomState.submissions.length}명</span>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={onOpenSupabaseModal}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors border ${
              isSupabaseEnabled
                ? 'bg-emerald-950/40 border-emerald-800/80 text-emerald-300 hover:bg-emerald-900/50'
                : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-850'
            }`}
            title="Supabase 백엔드 실시간 설정"
          >
            <Database className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{isSupabaseEnabled ? 'Supabase 실시간 연동됨' : 'Supabase 설정'}</span>
          </button>

          <button
            onClick={handleToggleMute}
            className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors"
            title={isMuted ? '음소거 해제' : '음소거'}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          <button
            onClick={handleCopyLink}
            className="px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors whitespace-nowrap"
          >
            학생 초대 링크
          </button>
        </div>
      </header>

      {/* Toast alert */}
      {copyNotification && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-indigo-600 text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-xl animate-in fade-in slide-in-from-top-2">
          {copyNotification}
        </div>
      )}

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col">
        {/* ============================================================ */}
        {/* PHASE 1: LOBBY (취합 대기실) */}
        {/* ============================================================ */}
        {roomState.phase === 'LOBBY' && (
          <div className="space-y-8 animate-in fade-in duration-300">
            {/* Big Classroom Banner */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800/80 p-6 sm:p-10 shadow-2xl">
              <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-3 max-w-2xl">
                  <div className="flex items-center gap-2 text-xs font-medium text-indigo-400 tracking-wide uppercase">
                    <Sparkles className="w-4 h-4" />
                    <span>실시간 경험 공유 &amp; 스피드 퀴즈</span>
                  </div>
                  <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                    {roomState.title}
                  </h1>
                  <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
                    학생들은 스마트폰이나 기기에서 <strong>3개~6개의 키워드</strong>로 자신의 특별하거나 재미있는 경험을 작성해주세요.
                    제출 즉시 교사 화면에 실시간으로 취합됩니다!
                  </p>
                </div>

                {/* Big Room Code Box */}
                <div className="bg-slate-950/90 border border-indigo-500/30 rounded-2xl p-5 text-center min-w-[240px] shadow-xl backdrop-blur-md">
                  <span className="text-xs font-semibold text-slate-400 tracking-wider">접속 방 코드</span>
                  <div className="text-4xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400 font-mono my-1">
                    {roomState.code}
                  </div>
                  <div className="flex items-center justify-center gap-2 mt-3 pt-2 border-t border-slate-850">
                    <button
                      onClick={handleCopyLink}
                      className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors font-medium"
                    >
                      초대 링크 복사
                    </button>
                    <span className="text-slate-700">·</span>
                    <button
                      onClick={handleOpenStudentTab}
                      className="text-xs text-slate-400 hover:text-white transition-colors flex items-center gap-1"
                    >
                      <span>학생 화면 열기</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Controls Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-slate-900 border border-slate-800">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIsProjectorMode(!isProjectorMode)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium transition-colors border ${
                    isProjectorMode
                      ? 'bg-amber-950/40 border-amber-800/80 text-amber-300'
                      : 'bg-slate-800 border-slate-700 text-slate-300'
                  }`}
                  title="학생들에게 힌트가 미리 보이지 않도록 키워드와 이름을 블러 처리합니다"
                >
                  {isProjectorMode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  <span>프로젝터 가림 모드: {isProjectorMode ? '켜짐 (스포 방지)' : '꺼짐'}</span>
                </button>

                <button
                  onClick={handleAddSampleStudents}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-200 transition-colors"
                >
                  <Shuffle className="w-3.5 h-3.5 text-indigo-400" />
                  <span>샘플 학생 5명 자동 등록</span>
                </button>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-xs text-slate-400">
                  제출 완료 <strong className="text-white text-sm tabular-nums">{roomState.submissions.length}</strong>명
                </div>
                <button
                  onClick={handleStartGame}
                  disabled={roomState.submissions.length === 0}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-indigo-600/30"
                >
                  <Play className="w-4 h-4 fill-white" />
                  <span>스피드 퀴즈 시작 ({roomState.submissions.length}명)</span>
                </button>
              </div>
            </div>

            {/* Submissions Grid */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-400 px-1">
                <span>실시간 취합된 학생 제출 목록</span>
                <span>{roomState.submissions.length > 0 ? '실시간 연동 중' : '제출 대기 중'}</span>
              </div>

              {roomState.submissions.length === 0 ? (
                <div className="border border-dashed border-slate-800 rounded-2xl p-12 text-center space-y-4 bg-slate-900/30">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-950/60 border border-indigo-800/40 text-indigo-400 flex items-center justify-center mx-auto">
                    <Users className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">아직 제출한 학생이 없습니다</h3>
                    <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
                      학생들이 방 코드(<strong>{roomState.code}</strong>)로 접속하여 키워드를 3~6개 입력하면 이 화면에 즉시 나타납니다.
                    </p>
                  </div>
                  <div className="pt-2">
                    <button
                      onClick={handleAddSampleStudents}
                      className="px-4 py-2 text-xs font-semibold bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 rounded-xl transition-colors"
                    >
                      체험용 샘플 학생 5명 즉시 불러오기
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {roomState.submissions.map((sub, idx) => (
                    <div
                      key={sub.id}
                      className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800/90 hover:border-slate-700 transition-all shadow-sm space-y-3 relative overflow-hidden group"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{sub.avatar || '👤'}</span>
                          <div>
                            <div className={`font-bold text-sm ${isProjectorMode ? 'filter blur-sm select-none' : 'text-white'}`}>
                              {sub.studentName}
                            </div>
                            <div className="text-[11px] text-slate-500 font-mono">
                              {idx + 1}번째 참가자 · {new Date(sub.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-950/30 border border-emerald-800/40 px-2 py-0.5 rounded-md">
                          <UserCheck className="w-3 h-3" />
                          <span>제출완료</span>
                        </div>
                      </div>

                      {/* Keywords display */}
                      <div className="space-y-1.5 pt-1">
                        <div className="text-[11px] text-slate-400 font-medium">
                          등록된 키워드 ({sub.keywords.length}개)
                        </div>
                        <div className={`flex flex-wrap gap-1.5 ${isProjectorMode ? 'filter blur-sm select-none' : ''}`}>
                          {sub.keywords.map((kw, kIdx) => (
                            <span
                              key={kIdx}
                              className="text-xs px-2.5 py-1 rounded-lg bg-slate-800 text-indigo-200 border border-slate-750 font-medium"
                            >
                              #{kw}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Story preview if not projector */}
                      {sub.story && (
                        <div className={`text-xs text-slate-400 line-clamp-2 bg-slate-950/40 p-2.5 rounded-lg border border-slate-850 ${
                          isProjectorMode ? 'filter blur-sm select-none' : ''
                        }`}>
                          &ldquo;{sub.story}&rdquo;
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* PHASE 2: QUIZ ARENA (스피드 퀴즈 진행실) */}
        {/* ============================================================ */}
        {roomState.phase === 'QUIZ' && currentSubmission && (
          <div className="space-y-6 flex-1 flex flex-col animate-in fade-in duration-300">
            {/* Top Match HUD */}
            <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-slate-900 border border-slate-800">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold px-3 py-1 bg-indigo-600 text-white rounded-lg">
                  문제 {roomState.currentRoundIndex + 1} / {roomState.submissions.length}
                </span>
                <span className="text-xs text-slate-400">
                  현재 문제 획득 가능 점수: <strong className="text-amber-400 tabular-nums text-sm font-bold">{currentPotentialPoints}점</strong>
                </span>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setAutoTimerActive(!autoTimerActive)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border ${
                    autoTimerActive
                      ? 'bg-amber-950/50 border-amber-800 text-amber-300'
                      : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-750'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>자동 키워드 공개 (4초): {autoTimerActive ? '동작 중' : '일시정지'}</span>
                </button>

                <button
                  onClick={handleRestartLobby}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-800 transition-colors"
                >
                  대기실로 복귀
                </button>
              </div>
            </div>

            {/* Giant Speed Quiz Stage */}
            <div className="flex-1 rounded-3xl bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 p-6 sm:p-10 flex flex-col items-center justify-center text-center relative overflow-hidden shadow-2xl">
              {/* Background Glow */}
              <div className="absolute inset-0 bg-radial from-indigo-500/10 via-transparent to-transparent pointer-events-none" />

              {/* Buzzer Alert Banner if a student pressed buzz */}
              {roomState.currentBuzzerUser && !roomState.isAnswerRevealed && (
                <div className="mb-6 w-full max-w-xl p-4 rounded-2xl bg-red-950/70 border-2 border-red-500 text-red-200 animate-bounce flex items-center justify-between shadow-2xl">
                  <div className="flex items-center gap-3 text-left">
                    <div className="p-2.5 rounded-xl bg-red-500 text-white font-black text-lg">
                      🚨 BUZZ!
                    </div>
                    <div>
                      <div className="text-xs text-red-300 font-semibold uppercase tracking-wider">가장 먼저 버저를 눌렀습니다!</div>
                      <div className="text-xl font-black text-white">{roomState.currentBuzzerUser} 학생</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleAwardPoints(roomState.currentBuzzerUser!, true)}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs flex items-center gap-1 shadow-lg transition-colors"
                    >
                      <Check className="w-4 h-4" />
                      <span>정답 인정</span>
                    </button>
                    <button
                      onClick={() => handleAwardPoints(roomState.currentBuzzerUser!, false)}
                      className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold text-xs flex items-center gap-1 transition-colors"
                    >
                      <CloseIcon className="w-4 h-4" />
                      <span>오답</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Question Title */}
              <div className="space-y-2 mb-8">
                <span className="text-xs font-bold text-indigo-400 uppercase tracking-widest">
                  WHO AM I? · 경험의 주인공을 맞혀보세요
                </span>
                <h2 className="text-2xl sm:text-4xl font-extrabold text-white">
                  이 특별한 경험을 한 학생은 누구일까요?
                </h2>
              </div>

              {/* Progressive Keywords Cards Container */}
              <div className="w-full max-w-4xl mb-8">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
                  {currentSubmission.keywords.map((keyword, idx) => {
                    const isRevealed = idx < roomState.revealedKeywordCount;
                    return (
                      <div
                        key={idx}
                        className={`h-28 sm:h-32 rounded-2xl flex flex-col items-center justify-center p-4 transition-all duration-300 relative border ${
                          isRevealed
                            ? 'bg-indigo-950/40 border-indigo-500/60 shadow-lg shadow-indigo-950/50 scale-100'
                            : 'bg-slate-900/60 border-slate-800/80 scale-95 opacity-60'
                        }`}
                      >
                        <span className="text-[11px] font-mono font-semibold text-slate-500 absolute top-2.5 left-3">
                          키워드 #{idx + 1}
                        </span>

                        {isRevealed ? (
                          <div className="text-center animate-in zoom-in-95 duration-200">
                            <span className="text-xl sm:text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-indigo-200 to-indigo-400">
                              #{keyword}
                            </span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-1 text-slate-600">
                            <HelpCircle className="w-6 h-6" />
                            <span className="text-xs font-semibold">비공개</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Revealed Answer Card or Action Buttons */}
              {roomState.isAnswerRevealed ? (
                <div className="w-full max-w-xl p-6 sm:p-8 rounded-3xl bg-slate-900/90 border-2 border-emerald-500/80 shadow-2xl space-y-4 animate-in zoom-in-95 duration-300">
                  <div className="flex flex-col items-center gap-2">
                    <span className="text-5xl">{currentSubmission.avatar || '🎉'}</span>
                    <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest">
                      경험의 주인공 공개!
                    </span>
                    <h3 className="text-3xl font-black text-white">
                      {currentSubmission.studentName} 학생!
                    </h3>
                  </div>

                  {currentSubmission.story && (
                    <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 text-left text-sm text-slate-300 leading-relaxed">
                      <div className="text-[11px] font-bold text-indigo-400 mb-1 flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>비하인드 스토리 &amp; 코멘트</span>
                      </div>
                      &ldquo;{currentSubmission.story}&rdquo;
                    </div>
                  )}

                  <div className="pt-2 flex items-center justify-center gap-3">
                    <button
                      onClick={handleNextRound}
                      className="px-8 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm flex items-center gap-2 shadow-lg shadow-emerald-600/30 transition-all"
                    >
                      <span>
                        {roomState.currentRoundIndex + 1 >= roomState.submissions.length
                          ? '최종 결과 보기'
                          : '다음 문제로 이동'}
                      </span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <button
                    onClick={handleRevealNextKeyword}
                    disabled={roomState.revealedKeywordCount >= currentSubmission.keywords.length}
                    className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm flex items-center gap-2 shadow-lg shadow-indigo-600/20 transition-all"
                  >
                    <span>다음 키워드 공개</span>
                    <span className="text-xs opacity-80 font-mono">
                      ({roomState.revealedKeywordCount} / {currentSubmission.keywords.length})
                    </span>
                  </button>

                  <button
                    onClick={handleRevealAnswer}
                    className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm flex items-center gap-2 shadow-lg shadow-emerald-600/20 transition-all"
                  >
                    <Check className="w-4 h-4" />
                    <span>정답 주인공 공개하기</span>
                  </button>
                </div>
              )}
            </div>

            {/* Bottom Live Scoreboard Ribbon */}
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between overflow-x-auto gap-4">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-400 shrink-0">
                <Trophy className="w-4 h-4 text-amber-400" />
                <span>실시간 순위</span>
              </div>
              <div className="flex items-center gap-3 overflow-x-auto py-1">
                {rankedScores.length === 0 ? (
                  <span className="text-xs text-slate-500">아직 획득한 점수가 없습니다. 정답을 맞혀 점수를 획득하세요!</span>
                ) : (
                  rankedScores.map((sc, idx) => (
                    <div
                      key={sc.studentName}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 shrink-0 text-xs"
                    >
                      <span className="font-bold text-amber-400 font-mono">#{idx + 1}</span>
                      <span className="font-semibold text-white">{sc.studentName}</span>
                      <span className="text-indigo-400 font-bold tabular-nums">{sc.score}점</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* PHASE 3: RESULT (명예의 전당 & 경험 갤러리) */}
        {/* ============================================================ */}
        {roomState.phase === 'RESULT' && (
          <div className="space-y-8 animate-in fade-in duration-300">
            {/* Podium */}
            <div className="rounded-3xl bg-gradient-to-b from-slate-900 via-indigo-950/30 to-slate-900 border border-slate-800 p-8 sm:p-12 text-center space-y-6">
              <div className="inline-flex p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 mb-2">
                <Trophy className="w-8 h-8" />
              </div>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-white">
                스피드 퀴즈 최종 결과 발표!
              </h2>
              <p className="text-slate-400 text-sm max-w-lg mx-auto">
                친구들의 다양한 경험과 키워드를 가장 빠르게 맞춘 챔피언들입니다!
              </p>

              {/* Podium cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto pt-4">
                {rankedScores.slice(0, 3).map((scorer, idx) => (
                  <div
                    key={scorer.studentName}
                    className={`p-6 rounded-2xl border text-center flex flex-col items-center justify-between space-y-3 ${
                      idx === 0
                        ? 'bg-gradient-to-b from-amber-950/40 to-slate-900 border-amber-500/60 shadow-xl shadow-amber-950/30 sm:-translate-y-2'
                        : idx === 1
                        ? 'bg-slate-900 border-slate-700'
                        : 'bg-slate-900 border-slate-800'
                    }`}
                  >
                    <span className="text-3xl font-black font-mono text-amber-400">
                      {idx === 0 ? '🥇 1등' : idx === 1 ? '🥈 2등' : '🥉 3등'}
                    </span>
                    <div className="text-lg font-bold text-white">{scorer.studentName}</div>
                    <div className="text-2xl font-black text-indigo-400 tabular-nums">{scorer.score}점</div>
                    <div className="text-xs text-slate-400">정답 맞힘 {scorer.correctCount}회</div>
                  </div>
                ))}
              </div>

              <div className="pt-4 flex justify-center gap-4">
                <button
                  onClick={handleRestartLobby}
                  className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm flex items-center gap-2 shadow-lg transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>새로운 게임 시작 (대기실로 이동)</span>
                </button>
              </div>
            </div>

            {/* All Experience Gallery */}
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Flame className="w-5 h-5 text-indigo-400" />
                <span>우리 반 모든 친구들의 경험 &amp; 키워드 갤러리</span>
              </h3>
              <p className="text-xs text-slate-400">
                수업 마무리 시간 동안 서로의 흥미로운 경험에 대해 이야기를 나눠보세요!
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {roomState.submissions.map((sub) => (
                  <div
                    key={sub.id}
                    className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{sub.avatar}</span>
                      <div>
                        <div className="font-bold text-white text-base">{sub.studentName}</div>
                        <div className="text-xs text-slate-400">키워드 {sub.keywords.length}개</div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {sub.keywords.map((kw, i) => (
                        <span key={i} className="text-xs px-2.5 py-1 rounded-lg bg-slate-800 text-indigo-200 font-medium">
                          #{kw}
                        </span>
                      ))}
                    </div>
                    {sub.story && (
                      <p className="text-xs text-slate-300 bg-slate-950 p-3 rounded-xl border border-slate-850 leading-relaxed">
                        &ldquo;{sub.story}&rdquo;
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
