export type GamePhase = 'LOBBY' | 'QUIZ' | 'RESULT';

export interface Submission {
  id: string;
  roomId: string;
  studentName: string;
  avatar: string;
  keywords: string[]; // 3 to 6 keywords
  story: string;
  createdAt: number;
}

export interface GuessAttempt {
  id: string;
  guesserName: string;
  guessedPerson: string;
  isCorrect: boolean;
  awardedPoints: number;
  revealedKeywordCount: number;
  timestamp: number;
}

export interface ScoreRecord {
  studentName: string;
  avatar?: string;
  score: number;
  correctCount: number;
  buzzCount: number;
}

export interface GameRoomState {
  code: string;
  title: string;
  phase: GamePhase;
  currentRoundIndex: number;
  revealedKeywordCount: number;
  isAnswerRevealed: boolean;
  currentBuzzerUser: string | null;
  buzzerTimestamp: number | null;
  roundTimer: number; // e.g., countdown seconds
  isAutoReveal: boolean;
  submissions: Submission[];
  scores: Record<string, ScoreRecord>;
  recentGuesses: GuessAttempt[];
  updatedAt: number;
}

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  isEnabled: boolean;
  lastConnectedAt?: number;
}
