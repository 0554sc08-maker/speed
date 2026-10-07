import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { GameRoomState, Submission, SupabaseConfig, GuessAttempt } from '../types/game';

const STORAGE_KEY_CONFIG = 'speedgame_supabase_config';
const STORAGE_KEY_ROOMS_PREFIX = 'speedgame_room_';

export const DEFAULT_SQL_SCHEMA = `-- [키워드 경험 스피드게임] Supabase 테이블 & 실시간 설정 SQL
-- Supabase 대시보드 -> SQL Editor에 붙여넣고 Run을 눌러주세요.

-- 1. 게임 방 테이블
create table if not exists game_rooms (
  code text primary key,
  title text not null default '우리 반 키워드 경험 공유 스피드 퀴즈',
  phase text not null default 'LOBBY',
  current_round_index int not null default 0,
  revealed_keyword_count int not null default 1,
  is_answer_revealed boolean not null default false,
  current_buzzer_user text,
  buzzer_timestamp bigint,
  round_timer int not null default 15,
  is_auto_reveal boolean not null default false,
  scores jsonb not null default '{}'::jsonb,
  recent_guesses jsonb not null default '[]'::jsonb,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. 학생 키워드 제출 테이블
create table if not exists submissions (
  id text primary key,
  room_code text references game_rooms(code) on delete cascade,
  student_name text not null,
  avatar text not null,
  keywords jsonb not null,
  story text not null default '',
  created_at bigint not null
);

-- 3. RLS(Row Level Security) 설정 - 교실 참여를 위해 모두 읽기/쓰기 허용
alter table game_rooms enable row level security;
alter table submissions enable row level security;

create policy "Public game_rooms access" on game_rooms for all using (true) with check (true);
create policy "Public submissions access" on submissions for all using (true) with check (true);

-- 4. 실시간(Realtime) 복제 활성화
alter publication supabase_realtime add table game_rooms;
alter publication supabase_realtime add table submissions;
`;

export const DEFAULT_SUPABASE_URL = 'https://kagmnaxrspmolgjckznz.supabase.co';
export const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_r27SvmmqbKLKynkE39B6Pg_7y30xeli';

export function getSupabaseConfig(): SupabaseConfig {
  if (typeof window === 'undefined') {
    return { url: DEFAULT_SUPABASE_URL, anonKey: DEFAULT_SUPABASE_ANON_KEY, isEnabled: true };
  }

  const stored = localStorage.getItem(STORAGE_KEY_CONFIG);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (parsed.url && parsed.anonKey) {
        return {
          url: parsed.url,
          anonKey: parsed.anonKey,
          isEnabled: parsed.isEnabled !== false,
          lastConnectedAt: parsed.lastConnectedAt,
        };
      }
    } catch {
      // fallback
    }
  }

  // Check env vars or default project credentials
  const envUrl = (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const envKey = (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;

  return {
    url: envUrl,
    anonKey: envKey,
    isEnabled: Boolean(envUrl && envKey),
  };
}

export function saveSupabaseConfig(url: string, anonKey: string): void {
  if (typeof window === 'undefined') return;
  const config: SupabaseConfig = {
    url: url.trim(),
    anonKey: anonKey.trim(),
    isEnabled: Boolean(url.trim() && anonKey.trim()),
    lastConnectedAt: Date.now(),
  };
  localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(config));
  // Reset cached client
  cachedClient = null;
}

let cachedClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (cachedClient) return cachedClient;

  const config = getSupabaseConfig();
  if (config.url && config.anonKey) {
    try {
      cachedClient = createClient(config.url, config.anonKey, {
        realtime: {
          params: {
            eventsPerSecond: 10,
          },
        },
      });
      return cachedClient;
    } catch (e) {
      console.error('Supabase init error:', e);
      return null;
    }
  }
  return null;
}

// Memory / LocalStorage fallbacks with BroadcastChannel
export function getLocalRoomState(code: string): GameRoomState | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(STORAGE_KEY_ROOMS_PREFIX + code);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveLocalRoomState(state: GameRoomState): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY_ROOMS_PREFIX + state.code, JSON.stringify(state));
  notifyBroadcast(state.code, { type: 'STATE_UPDATE', payload: state });
}

// BroadcastChannel for instant local & cross-tab sync
const channels: Map<string, BroadcastChannel> = new Map();

function getBroadcastChannel(code: string): BroadcastChannel | null {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return null;
  if (!channels.has(code)) {
    const bc = new BroadcastChannel(`speed_quiz_bc_${code}`);
    channels.set(code, bc);
  }
  return channels.get(code)!;
}

function notifyBroadcast(code: string, message: unknown): void {
  const bc = getBroadcastChannel(code);
  if (bc) {
    try {
      bc.postMessage(message);
    } catch (e) {
      console.warn('Broadcast error:', e);
    }
  }
}

// Unified Service
export class GameService {
  private roomCode: string;
  private bc: BroadcastChannel | null = null;
  private supabaseChannel: ReturnType<SupabaseClient['channel']> | null = null;
  private onStateChangeCb: ((state: GameRoomState) => void) | null = null;

  constructor(roomCode: string) {
    this.roomCode = roomCode.toUpperCase().trim();
  }

  public async initRoom(title: string = '우리 반 키워드 경험 공유 스피드 퀴즈'): Promise<GameRoomState> {
    const existing = await this.getRoom();
    if (existing) return existing;

    const initialState: GameRoomState = {
      code: this.roomCode,
      title,
      phase: 'LOBBY',
      currentRoundIndex: 0,
      revealedKeywordCount: 1,
      isAnswerRevealed: false,
      currentBuzzerUser: null,
      buzzerTimestamp: null,
      roundTimer: 15,
      isAutoReveal: false,
      submissions: [],
      scores: {},
      recentGuesses: [],
      updatedAt: Date.now(),
    };

    const client = getSupabaseClient();
    if (client) {
      try {
        await client.from('game_rooms').upsert({
          code: this.roomCode,
          title,
          phase: 'LOBBY',
          current_round_index: 0,
          revealed_keyword_count: 1,
          is_answer_revealed: false,
          current_buzzer_user: null,
          buzzer_timestamp: null,
          round_timer: 15,
          is_auto_reveal: false,
          scores: {},
          recent_guesses: [],
          updated_at: new Date().toISOString(),
        });
      } catch (e) {
        console.warn('Supabase initRoom failed, using local fallback:', e);
      }
    }

    saveLocalRoomState(initialState);
    return initialState;
  }

  public async getRoom(): Promise<GameRoomState | null> {
    const client = getSupabaseClient();
    if (client) {
      try {
        const { data: roomData, error: roomErr } = await client
          .from('game_rooms')
          .select('*')
          .eq('code', this.roomCode)
          .maybeSingle();

        if (roomData && !roomErr) {
          // fetch submissions
          const { data: subsData } = await client
            .from('submissions')
            .select('*')
            .eq('room_code', this.roomCode)
            .order('created_at', { ascending: true });

          const submissions: Submission[] = (subsData || []).map((s: Record<string, unknown>) => ({
            id: String(s.id),
            roomId: this.roomCode,
            studentName: String(s.student_name),
            avatar: String(s.avatar),
            keywords: Array.isArray(s.keywords) ? (s.keywords as string[]) : [],
            story: String(s.story || ''),
            createdAt: Number(s.created_at || Date.now()),
          }));

          const roomState: GameRoomState = {
            code: roomData.code,
            title: roomData.title,
            phase: roomData.phase as GameRoomState['phase'],
            currentRoundIndex: roomData.current_round_index,
            revealedKeywordCount: roomData.revealed_keyword_count,
            isAnswerRevealed: roomData.is_answer_revealed,
            currentBuzzerUser: roomData.current_buzzer_user,
            buzzerTimestamp: roomData.buzzer_timestamp,
            roundTimer: roomData.round_timer,
            isAutoReveal: roomData.is_auto_reveal,
            scores: (roomData.scores as GameRoomState['scores']) || {},
            recentGuesses: (roomData.recent_guesses as GameRoomState['recentGuesses']) || [],
            submissions,
            updatedAt: Date.now(),
          };

          saveLocalRoomState(roomState);
          return roomState;
        }
      } catch (err) {
        console.warn('Supabase getRoom error, reading local storage:', err);
      }
    }

    return getLocalRoomState(this.roomCode);
  }

  private getOrInitSupabaseChannel(): ReturnType<SupabaseClient['channel']> | null {
    if (this.supabaseChannel) return this.supabaseChannel;
    const client = getSupabaseClient();
    if (!client) return null;
    try {
      this.supabaseChannel = client.channel(`speedquiz_${this.roomCode}`);
      this.supabaseChannel.subscribe();
      return this.supabaseChannel;
    } catch (e) {
      console.warn('Channel subscribe error:', e);
      return null;
    }
  }

  public async submitKeywords(studentName: string, avatar: string, keywords: string[], story: string = ''): Promise<Submission> {
    const submission: Submission = {
      id: 'sub_' + Math.random().toString(36).substring(2, 9),
      roomId: this.roomCode,
      studentName: studentName.trim(),
      avatar,
      keywords: keywords.map(k => k.trim()).filter(Boolean),
      story: story.trim(),
      createdAt: Date.now(),
    };

    const client = getSupabaseClient();
    if (client) {
      try {
        await client.from('submissions').insert({
          id: submission.id,
          room_code: this.roomCode,
          student_name: submission.studentName,
          avatar: submission.avatar,
          keywords: submission.keywords,
          story: submission.story,
          created_at: submission.createdAt,
        });
      } catch (e) {
        console.warn('Supabase submitKeywords insert error (table may need setup):', e);
      }

      // Always broadcast event via Supabase Realtime channel
      const ch = this.getOrInitSupabaseChannel();
      if (ch) {
        ch.send({
          type: 'broadcast',
          event: 'NEW_SUBMISSION',
          payload: submission,
        });
      }
    }

    // Update local state
    const current = (await this.getRoom()) || (await this.initRoom());
    const existingIdx = current.submissions.findIndex(s => s.studentName.toLowerCase() === studentName.toLowerCase().trim());
    if (existingIdx >= 0) {
      current.submissions[existingIdx] = submission;
    } else {
      current.submissions.push(submission);
    }
    current.updatedAt = Date.now();
    saveLocalRoomState(current);

    return submission;
  }

  public async updateState(patch: Partial<GameRoomState>): Promise<GameRoomState> {
    const current = (await this.getRoom()) || (await this.initRoom());
    const updated: GameRoomState = {
      ...current,
      ...patch,
      updatedAt: Date.now(),
    };

    saveLocalRoomState(updated);

    const client = getSupabaseClient();
    if (client) {
      try {
        await client.from('game_rooms').upsert({
          code: this.roomCode,
          title: updated.title,
          phase: updated.phase,
          current_round_index: updated.currentRoundIndex,
          revealed_keyword_count: updated.revealedKeywordCount,
          is_answer_revealed: updated.isAnswerRevealed,
          current_buzzer_user: updated.currentBuzzerUser,
          buzzer_timestamp: updated.buzzerTimestamp,
          round_timer: updated.roundTimer,
          is_auto_reveal: updated.isAutoReveal,
          scores: updated.scores,
          recent_guesses: updated.recentGuesses,
          updated_at: new Date().toISOString(),
        });
      } catch (e) {
        console.warn('Supabase updateState error (table may need setup):', e);
      }

      const ch = this.getOrInitSupabaseChannel();
      if (ch) {
        ch.send({
          type: 'broadcast',
          event: 'STATE_PATCH',
          payload: updated,
        });
      }
    }

    return updated;
  }

  public async buzz(studentName: string): Promise<boolean> {
    const current = await this.getRoom();
    if (!current || current.currentBuzzerUser) {
      return false; // already locked by someone else
    }

    const updated = await this.updateState({
      currentBuzzerUser: studentName,
      buzzerTimestamp: Date.now(),
    });

    const ch = this.getOrInitSupabaseChannel();
    if (ch) {
      ch.send({
        type: 'broadcast',
        event: 'BUZZ',
        payload: { studentName, timestamp: Date.now() },
      });
    }

    return updated.currentBuzzerUser === studentName;
  }

  public async submitGuess(guesserName: string, guessedPerson: string): Promise<GuessAttempt> {
    const room = await this.getRoom();
    if (!room) throw new Error('Room not found');

    const currentSub = room.submissions[room.currentRoundIndex];
    const isCorrect = currentSub ? currentSub.studentName.trim().toLowerCase() === guessedPerson.trim().toLowerCase() : false;

    // Scoring formula: Max 500 pts. Reveal 1 = 500, Reveal 2 = 400, Reveal 3 = 300, etc.
    const awardedPoints = isCorrect ? Math.max(100, 600 - room.revealedKeywordCount * 100) : 0;

    const guessAttempt: GuessAttempt = {
      id: 'guess_' + Math.random().toString(36).substring(2, 9),
      guesserName,
      guessedPerson,
      isCorrect,
      awardedPoints,
      revealedKeywordCount: room.revealedKeywordCount,
      timestamp: Date.now(),
    };

    const newScores = { ...room.scores };
    const currentRecord = newScores[guesserName] || {
      studentName: guesserName,
      score: 0,
      correctCount: 0,
      buzzCount: 0,
    };

    newScores[guesserName] = {
      ...currentRecord,
      score: currentRecord.score + awardedPoints,
      correctCount: currentRecord.correctCount + (isCorrect ? 1 : 0),
      buzzCount: currentRecord.buzzCount + 1,
    };

    const recentGuesses = [guessAttempt, ...(room.recentGuesses || [])].slice(0, 10);

    await this.updateState({
      scores: newScores,
      recentGuesses,
      currentBuzzerUser: isCorrect ? guesserName : null, // release if wrong so others can buzz
      isAnswerRevealed: isCorrect ? true : room.isAnswerRevealed,
    });

    if (this.supabaseChannel) {
      this.supabaseChannel.send({
        type: 'broadcast',
        event: 'GUESS',
        payload: guessAttempt,
      });
    }

    return guessAttempt;
  }

  public subscribe(callback: (state: GameRoomState) => void): () => void {
    this.onStateChangeCb = callback;

    // 1. Setup BroadcastChannel listener for local/cross-tab instant sync
    this.bc = getBroadcastChannel(this.roomCode);
    const onBroadcastMessage = (e: MessageEvent) => {
      if (e.data && e.data.type === 'STATE_UPDATE') {
        callback(e.data.payload);
      } else {
        // re-fetch latest
        this.getRoom().then(st => {
          if (st) callback(st);
        });
      }
    };
    if (this.bc) {
      this.bc.addEventListener('message', onBroadcastMessage);
    }

    // 2. Setup Supabase Realtime Channel
    const client = getSupabaseClient();
    if (client) {
      try {
        this.supabaseChannel = client.channel(`speedquiz_${this.roomCode}`);

        this.supabaseChannel
          .on('broadcast', { event: 'STATE_PATCH' }, payload => {
            if (payload && payload.payload) {
              const patched = payload.payload as GameRoomState;
              saveLocalRoomState(patched);
              callback(patched);
            }
          })
          .on('broadcast', { event: 'NEW_SUBMISSION' }, evt => {
            if (evt && evt.payload) {
              const sub = evt.payload as Submission;
              const current = getLocalRoomState(this.roomCode);
              if (current) {
                const idx = current.submissions.findIndex(s => s.studentName.toLowerCase() === sub.studentName.toLowerCase());
                if (idx >= 0) {
                  current.submissions[idx] = sub;
                } else {
                  current.submissions.push(sub);
                }
                current.updatedAt = Date.now();
                saveLocalRoomState(current);
                callback(current);
              }
            }
            this.getRoom().then(st => {
              if (st) callback(st);
            });
          })
          .on('broadcast', { event: 'BUZZ' }, evt => {
            if (evt && evt.payload) {
              const { studentName, timestamp } = evt.payload as { studentName: string; timestamp: number };
              const current = getLocalRoomState(this.roomCode);
              if (current && !current.currentBuzzerUser) {
                current.currentBuzzerUser = studentName;
                current.buzzerTimestamp = timestamp;
                current.updatedAt = Date.now();
                saveLocalRoomState(current);
                callback(current);
              }
            }
            this.getRoom().then(st => {
              if (st) callback(st);
            });
          })
          .on('postgres_changes', { event: '*', schema: 'public', table: 'game_rooms', filter: `code=eq.${this.roomCode}` }, () => {
            this.getRoom().then(st => {
              if (st) callback(st);
            });
          })
          .on('postgres_changes', { event: '*', schema: 'public', table: 'submissions', filter: `room_code=eq.${this.roomCode}` }, () => {
            this.getRoom().then(st => {
              if (st) callback(st);
            });
          })
          .subscribe();
      } catch (e) {
        console.warn('Supabase subscribe channel error:', e);
      }
    }

    // 3. Fallback polling every 2s to ensure perfect sync across devices if WebSocket momentarily hiccups
    const intervalId = setInterval(() => {
      this.getRoom().then(st => {
        if (st) callback(st);
      });
    }, 2000);

    return () => {
      clearInterval(intervalId);
      if (this.bc) {
        this.bc.removeEventListener('message', onBroadcastMessage);
      }
      if (this.supabaseChannel && client) {
        client.removeChannel(this.supabaseChannel);
      }
    };
  }
}
