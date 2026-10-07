import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { 
  Sparkles, CheckCircle2, AlertCircle, Plus, X, 
  HelpCircle, UserCheck, Flame, ArrowLeft
} from 'lucide-react';
import { GameRoomState, Submission } from '../types/game';
import { GameService } from '../lib/supabase';
import { sound } from '../lib/sound';

interface Props {
  initialRoomCode?: string;
  onSwitchToTeacher: () => void;
}

const AVATAR_OPTIONS = ['🐱', '🏕️', '🚴', '🚀', '🎨', '🧁', '🎸', '⚽', '🌟', '🎧', '🍕', '🦄'];
const INSPIRATION_TAGS = ['수학여행', '길고양이', '자전거', '첫요리', '당황했던기억', '생일파티', '비밀취미', '인생최고의날'];

export const StudentView: React.FC<Props> = ({ initialRoomCode = '', onSwitchToTeacher }) => {
  const [roomCode, setRoomCode] = useState(initialRoomCode.toUpperCase());
  const [studentName, setStudentName] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState(AVATAR_OPTIONS[0]);
  const [isJoined, setIsJoined] = useState(false);
  
  // Submission form state
  const [keywordInput, setKeywordInput] = useState('');
  const [keywords, setKeywords] = useState<string[]>([]);
  const [story, setStory] = useState('');
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState('');

  // Game sync state
  const [roomState, setRoomState] = useState<GameRoomState | null>(null);
  const [gameService, setGameService] = useState<GameService | null>(null);
  const [guessTarget, setGuessTarget] = useState('');

  // Initialize service when room code is confirmed
  useEffect(() => {
    if (isJoined && roomCode) {
      const service = new GameService(roomCode);
      setGameService(service);

      // fetch current state
      service.getRoom().then((room) => {
        if (room) {
          setRoomState(room);
          // Check if student already submitted in this room
          const existing = room.submissions.find(
            s => s.studentName.toLowerCase() === studentName.toLowerCase()
          );
          if (existing) {
            setKeywords(existing.keywords);
            setStory(existing.story);
            setHasSubmitted(true);
          }
        }
      });

      const unsubscribe = service.subscribe((updated) => {
        setRoomState(updated);
      });

      return () => {
        unsubscribe();
      };
    }
  }, [isJoined, roomCode, studentName]);

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomCode.trim() || !studentName.trim()) {
      setValidationError('방 코드와 이름을 모두 입력해주세요.');
      return;
    }
    setValidationError('');
    setIsJoined(true);
  };

  const handleAddKeyword = () => {
    const trimmed = keywordInput.trim().replace(/^#/, '');
    if (!trimmed) return;
    if (keywords.length >= 6) {
      setValidationError('키워드는 최대 6개까지만 등록할 수 있습니다.');
      return;
    }
    if (keywords.includes(trimmed)) {
      setValidationError('이미 추가된 키워드입니다.');
      return;
    }
    setKeywords([...keywords, trimmed]);
    setKeywordInput('');
    setValidationError('');
  };

  const handleRemoveKeyword = (index: number) => {
    setKeywords(keywords.filter((_, i) => i !== index));
    setValidationError('');
  };

  const handleAddInspiration = (tag: string) => {
    if (keywords.length >= 6) return;
    if (!keywords.includes(tag)) {
      setKeywords([...keywords, tag]);
    }
  };

  const handleSubmitExperience = async (e: React.FormEvent) => {
    e.preventDefault();
    if (keywords.length < 3) {
      setValidationError('키워드를 최소 3개 이상 입력해주세요!');
      return;
    }
    if (keywords.length > 6) {
      setValidationError('키워드는 최대 6개까지만 입력 가능합니다.');
      return;
    }

    if (!gameService) return;

    setIsSubmitting(true);
    setValidationError('');

    try {
      sound.playSubmission();
      await gameService.submitKeywords(studentName, selectedAvatar, keywords, story);
      setHasSubmitted(true);
    } catch (err) {
      console.error(err);
      setValidationError('제출 중 문제가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBuzz = async () => {
    if (!gameService || !roomState) return;
    sound.playBuzzer();
    const success = await gameService.buzz(studentName);
    if (success) {
      confetti({ particleCount: 40, spread: 40, origin: { y: 0.8 } });
    }
  };

  const handleSubmitGuess = async () => {
    if (!gameService || !guessTarget.trim()) return;
    await gameService.submitGuess(studentName, guessTarget.trim());
    setGuessTarget('');
  };

  // If not yet joined room
  if (!isJoined) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4 selection:bg-indigo-500 selection:text-white">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 flex items-center justify-center mx-auto">
              <Sparkles className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-black text-white">키워드 스피드 퀴즈 참여</h1>
            <p className="text-xs text-slate-400">교사 화면에 표시된 방 코드와 이름을 입력하세요</p>
          </div>

          <form onSubmit={handleJoin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                방 코드 (4~8자리)
              </label>
              <input
                type="text"
                placeholder="예: CLASS-702"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-750 text-white font-mono text-center text-lg tracking-widest placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                내 이름 (또는 닉네임)
              </label>
              <input
                type="text"
                placeholder="홍길동"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-750 text-white text-base placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                내 프로필 아이콘 선택
              </label>
              <div className="grid grid-cols-6 gap-2 pt-1">
                {AVATAR_OPTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setSelectedAvatar(emoji)}
                    className={`h-11 rounded-xl text-xl flex items-center justify-center transition-all ${
                      selectedAvatar === emoji
                        ? 'bg-indigo-600 border-2 border-indigo-400 scale-105'
                        : 'bg-slate-950 border border-slate-800 hover:bg-slate-800'
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            {validationError && (
              <div className="p-3 rounded-xl bg-red-950/40 border border-red-800 text-red-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{validationError}</span>
              </div>
            )}

            <button
              type="submit"
              className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm shadow-lg shadow-indigo-600/25 transition-all"
            >
              입장하기
            </button>
          </form>

          <div className="text-center pt-2 border-t border-slate-800">
            <button
              onClick={onSwitchToTeacher}
              className="text-xs text-slate-400 hover:text-white transition-colors"
            >
              교사 진행자 화면으로 이동하기 &rarr;
            </button>
          </div>
        </div>
      </div>
    );
  }

  const currentSubmission = roomState?.submissions[roomState.currentRoundIndex];
  const isMyTurn = currentSubmission?.studentName.toLowerCase() === studentName.toLowerCase();
  const amIBuzzerUser = roomState?.currentBuzzerUser === studentName;
  const isBuzzerLocked = Boolean(roomState?.currentBuzzerUser);

  // Other students list for guessing
  const otherStudents = (roomState?.submissions || [])
    .map(s => s.studentName)
    .filter(name => name.toLowerCase() !== studentName.toLowerCase());

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Top Header */}
      <header className="flex items-center justify-between px-5 py-3.5 border-b border-slate-850 bg-slate-900/90 backdrop-blur-md sticky top-0 z-20">
        <div className="flex items-center gap-2.5">
          <span className="text-2xl">{selectedAvatar}</span>
          <div>
            <div className="font-bold text-sm text-white">{studentName}</div>
            <div className="text-[11px] text-slate-400 font-mono">방 #{roomCode}</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {roomState?.scores[studentName] && (
            <div className="px-3 py-1 bg-slate-950 border border-slate-800 rounded-lg text-xs font-bold text-amber-400 tabular-nums">
              내 점수: {roomState.scores[studentName].score}점
            </div>
          )}
          <button
            onClick={() => setIsJoined(false)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="나가기"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-xl w-full mx-auto p-4 sm:p-6 flex flex-col justify-center">
        {/* ============================================================ */}
        {/* PHASE 1: SUBMISSION FORM (키워드 작성 및 제출) */}
        {/* ============================================================ */}
        {(!roomState || roomState.phase === 'LOBBY' || !hasSubmitted) ? (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="space-y-1">
              <span className="text-xs font-bold text-indigo-400 tracking-wider uppercase">
                나만의 경험 공유하기
              </span>
              <h2 className="text-2xl font-black text-white">
                키워드로 나를 표현해주세요
              </h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                나에게 있었던 재미있거나 특별한 경험을 <strong>3개~6개의 키워드</strong>로 요약해주세요. 친구들이 키워드를 보고 누구의 경험인지 맞히게 됩니다!
              </p>
            </div>

            {hasSubmitted ? (
              <div className="space-y-6 text-center py-4">
                <div className="w-16 h-16 rounded-full bg-emerald-950/60 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto animate-in zoom-in-95">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-white">제출이 완료되었습니다!</h3>
                  <p className="text-xs text-slate-400">
                    선생님 화면에 실시간으로 정상 등록되었습니다.<br />
                    선생님이 게임을 시작할 때까지 잠시 기다려주세요!
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-left space-y-2">
                  <div className="text-xs font-semibold text-slate-400">내가 제출한 키워드:</div>
                  <div className="flex flex-wrap gap-1.5">
                    {keywords.map((k, i) => (
                      <span key={i} className="px-2.5 py-1 rounded-lg bg-indigo-950 text-indigo-300 border border-indigo-800 text-xs font-bold">
                        #{k}
                      </span>
                    ))}
                  </div>
                  {story && (
                    <div className="text-xs text-slate-400 pt-2 border-t border-slate-850 italic">
                      &ldquo;{story}&rdquo;
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setHasSubmitted(false)}
                  className="text-xs text-slate-400 hover:text-white underline"
                >
                  수정하기
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmitExperience} className="space-y-5">
                {/* Keywords input */}
                <div>
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-300 mb-1.5">
                    <label>경험 키워드 (3~6개 등록)</label>
                    <span className={`font-mono ${keywords.length >= 3 && keywords.length <= 6 ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {keywords.length} / 6개 {keywords.length < 3 && '(최소 3개 필요)'}
                    </span>
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="예: 한라산, 폭우, 라면"
                      value={keywordInput}
                      onChange={(e) => setKeywordInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddKeyword();
                        }
                      }}
                      className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-750 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={handleAddKeyword}
                      disabled={keywords.length >= 6 || !keywordInput.trim()}
                      className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold flex items-center gap-1 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      <span>추가</span>
                    </button>
                  </div>

                  {/* Registered chips */}
                  <div className="flex flex-wrap gap-2 mt-3 min-h-[38px] p-2 rounded-xl bg-slate-950/70 border border-slate-850">
                    {keywords.length === 0 ? (
                      <span className="text-xs text-slate-500 self-center px-1">
                        위 입력창에 키워드를 입력하고 추가를 누르세요.
                      </span>
                    ) : (
                      keywords.map((kw, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-indigo-600/20 border border-indigo-500/40 text-indigo-300 text-xs font-semibold animate-in zoom-in-95"
                        >
                          #{kw}
                          <button
                            type="button"
                            onClick={() => handleRemoveKeyword(idx)}
                            className="hover:text-white"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))
                    )}
                  </div>

                  {/* Suggestion tags */}
                  <div className="mt-2.5 space-y-1">
                    <div className="text-[11px] text-slate-500">추천 키워드 아이디어:</div>
                    <div className="flex flex-wrap gap-1.5">
                      {INSPIRATION_TAGS.map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => handleAddInspiration(tag)}
                          className="text-[11px] px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-750 transition-colors"
                        >
                          +{tag}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Experience Detail/Story */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    비하인드 스토리나 힌트 (정답 공개 시 함께 읽혀요!)
                  </label>
                  <textarea
                    rows={3}
                    placeholder="예: 수학여행 때 비를 쫄딱 맞고 대피소에서 컵라면을 먹었는데 인생에서 가장 맛있었던 기억이에요."
                    value={story}
                    onChange={(e) => setStory(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-750 text-white text-xs placeholder-slate-600 focus:outline-none focus:border-indigo-500 resize-none leading-relaxed"
                  />
                </div>

                {validationError && (
                  <div className="p-3 rounded-xl bg-red-950/40 border border-red-800 text-red-300 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{validationError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting || keywords.length < 3 || keywords.length > 6}
                  className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2"
                >
                  <UserCheck className="w-4 h-4" />
                  <span>{isSubmitting ? '선생님 화면으로 전송 중...' : '선생님 화면으로 제출하기'}</span>
                </button>
              </form>
            )}
          </div>
        ) : null}

        {/* ============================================================ */}
        {/* PHASE 2: LIVE SPEED QUIZ (스피드 퀴즈 실시간 참여) */}
        {/* ============================================================ */}
        {roomState && roomState.phase === 'QUIZ' && hasSubmitted && (
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* Round Indicator */}
            <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
              <span className="px-3 py-1 bg-slate-900 border border-slate-800 rounded-lg">
                문제 {roomState.currentRoundIndex + 1} / {roomState.submissions.length}
              </span>
              <span className="text-amber-400 font-bold">
                최대 {Math.max(100, 600 - roomState.revealedKeywordCount * 100)}점
              </span>
            </div>

            {/* Revealed Keywords Display */}
            {currentSubmission && (
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-center space-y-4 shadow-xl">
                <span className="text-xs font-bold text-indigo-400 uppercase tracking-widest">
                  누구의 경험일까요?
                </span>

                {isMyTurn ? (
                  <div className="p-3 rounded-xl bg-indigo-950/40 border border-indigo-700/50 text-indigo-300 text-xs font-bold animate-pulse">
                    🤫 내 경험이 출제되었습니다! 친구들이 맞히는 것을 지켜보세요.
                  </div>
                ) : null}

                {/* Progressive Keywords */}
                <div className="grid grid-cols-2 gap-2.5 pt-2">
                  {currentSubmission.keywords.map((kw, i) => {
                    const isRevealed = i < roomState.revealedKeywordCount;
                    return (
                      <div
                        key={i}
                        className={`h-20 rounded-xl flex items-center justify-center p-3 text-center transition-all ${
                          isRevealed
                            ? 'bg-indigo-950/60 border border-indigo-500/60 text-white font-extrabold text-base'
                            : 'bg-slate-950/60 border border-slate-800/80 text-slate-600 text-xs'
                        }`}
                      >
                        {isRevealed ? (
                          <span>#{kw}</span>
                        ) : (
                          <div className="flex items-center gap-1">
                            <HelpCircle className="w-3.5 h-3.5" />
                            <span>비공개</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* If answer is revealed */}
                {roomState.isAnswerRevealed && (
                  <div className="pt-4 border-t border-slate-800 space-y-2 animate-in zoom-in-95">
                    <span className="text-3xl">{currentSubmission.avatar}</span>
                    <h3 className="text-xl font-black text-white">
                      정답은 {currentSubmission.studentName} 학생!
                    </h3>
                    {currentSubmission.story && (
                      <p className="text-xs text-slate-300 bg-slate-950 p-3 rounded-xl border border-slate-850 italic">
                        &ldquo;{currentSubmission.story}&rdquo;
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Giant Speed Buzz Button */}
            {!roomState.isAnswerRevealed && !isMyTurn && (
              <div className="space-y-4">
                {amIBuzzerUser ? (
                  <div className="p-5 rounded-2xl bg-emerald-950/60 border-2 border-emerald-500 text-center space-y-4 shadow-xl animate-in zoom-in-95">
                    <div className="text-emerald-300 font-bold text-sm">
                      🎉 내가 가장 먼저 버저를 눌렀습니다!
                    </div>
                    <p className="text-xs text-slate-300">
                      선생님께 큰 소리로 정답을 말하거나 아래에서 친구를 선택하세요:
                    </p>
                    <div className="flex gap-2">
                      <select
                        value={guessTarget}
                        onChange={(e) => setGuessTarget(e.target.value)}
                        className="flex-1 px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-750 text-white text-xs"
                      >
                        <option value="">친구 이름 선택</option>
                        {otherStudents.map((st) => (
                          <option key={st} value={st}>
                            {st}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={handleSubmitGuess}
                        disabled={!guessTarget}
                        className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold text-xs"
                      >
                        정답 제출
                      </button>
                    </div>
                  </div>
                ) : isBuzzerLocked ? (
                  <div className="p-4 rounded-2xl bg-red-950/30 border border-red-800/50 text-center text-xs text-red-300">
                    🚨 <strong>{roomState.currentBuzzerUser}</strong> 학생이 버저를 눌렀습니다!
                  </div>
                ) : (
                  <button
                    onClick={handleBuzz}
                    className="w-full h-32 rounded-3xl bg-gradient-to-r from-red-600 via-rose-600 to-red-600 hover:from-red-500 hover:to-rose-500 active:scale-95 text-white font-black text-2xl shadow-2xl shadow-red-600/40 flex flex-col items-center justify-center gap-1 transition-all"
                  >
                    <Flame className="w-8 h-8 fill-white" />
                    <span>저요! 정답 알겠어요!</span>
                    <span className="text-xs font-normal opacity-90">버저를 눌러 정답 기회를 얻으세요</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* ============================================================ */}
        {/* PHASE 3: RESULT VIEW (결과) */}
        {/* ============================================================ */}
        {roomState && roomState.phase === 'RESULT' && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 text-center space-y-5">
            <span className="text-4xl">🏆</span>
            <h2 className="text-2xl font-black text-white">게임이 종료되었습니다!</h2>
            <p className="text-xs text-slate-400">
              교사 화면의 대형 스크린에서 최종 순위와 우리 반 친구들의 경험 갤러리를 확인해보세요!
            </p>
            {roomState.scores[studentName] && (
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                <span className="text-xs text-slate-400">내 최종 성적</span>
                <div className="text-2xl font-black text-amber-400">
                  {roomState.scores[studentName].score}점
                </div>
                <div className="text-xs text-slate-500">
                  정답 {roomState.scores[studentName].correctCount}회 맞힘
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};
