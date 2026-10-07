import React, { useState, useEffect } from 'react';
import { Database, CheckCircle2, AlertCircle, Copy, ExternalLink, X, ShieldCheck } from 'lucide-react';
import { getSupabaseConfig, saveSupabaseConfig, DEFAULT_SQL_SCHEMA, getSupabaseClient } from '../lib/supabase';
import { SupabaseConfig } from '../types/game';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfigSaved: () => void;
}

export const SupabaseModal: React.FC<Props> = ({ isOpen, onClose, onConfigSaved }) => {
  const [config, setConfig] = useState<SupabaseConfig>({ url: '', anonKey: '', isEnabled: false });
  const [url, setUrl] = useState('');
  const [anonKey, setAnonKey] = useState('');
  const [copied, setCopied] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'failed'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (isOpen) {
      const current = getSupabaseConfig();
      setConfig(current);
      setUrl(current.url);
      setAnonKey(current.anonKey);
      setTestStatus('idle');
      setErrorMessage('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCopySql = () => {
    navigator.clipboard.writeText(DEFAULT_SQL_SCHEMA);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveAndTest = async () => {
    if (!url.trim() || !anonKey.trim()) {
      setErrorMessage('Supabase URL과 Anon Key를 모두 입력해주세요.');
      setTestStatus('failed');
      return;
    }

    setTestStatus('testing');
    setErrorMessage('');

    try {
      saveSupabaseConfig(url, anonKey);
      const client = getSupabaseClient();
      if (!client) {
        throw new Error('Supabase 클라이언트 생성 실패');
      }

      // Test simple ping query
      const { error } = await client.from('game_rooms').select('code').limit(1);
      if (error && error.code !== 'PGRST116') {
        // Table might not exist yet, but credentials could be valid
        if (error.message.includes('relation "public.game_rooms" does not exist')) {
          setTestStatus('success');
          onConfigSaved();
          return;
        }
        throw error;
      }

      setTestStatus('success');
      onConfigSaved();
    } catch (err: unknown) {
      console.error(err);
      setTestStatus('failed');
      setErrorMessage((err as Error)?.message || '연결에 실패했습니다. URL과 키를 확인하세요.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Supabase 백엔드 실시간 연동 설정</h2>
              <p className="text-xs text-slate-400">교실 내 모든 학생의 기기(스마트폰, 태블릿, 크롬북)와 실시간 동기화</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm">
          {/* Status Alert */}
          <div className={`p-4 rounded-xl border flex items-start gap-3 ${
            config.isEnabled
              ? 'bg-emerald-950/30 border-emerald-800/60 text-emerald-300'
              : 'bg-amber-950/30 border-amber-800/60 text-amber-200'
          }`}>
            {config.isEnabled ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            )}
            <div className="text-xs space-y-1">
              <div className="font-semibold text-sm">
                {config.isEnabled ? 'Supabase 클라우드 실시간 모드 활성화됨' : '현재 로컬 브로드캐스트 모드 (미연동 상태)'}
              </div>
              <p className="text-slate-300">
                {config.isEnabled
                  ? '다른 기기에서도 동일한 방 코드를 입력하면 실시간으로 즉시 접속됩니다.'
                  : 'Supabase 정보를 입력하지 않아도 동일 컴퓨터의 여러 탭이나 창에서 완벽하게 실시간 테스트가 가능합니다. 서로 다른 기기(학생 스마트폰)와 연결하려면 아래 정보를 입력하세요.'}
              </p>
            </div>
          </div>

          {/* Form */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Supabase Project URL
              </label>
              <input
                type="text"
                placeholder="https://xyzcompany.supabase.co"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-750 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-mono text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Supabase Anon (Public) Key
              </label>
              <input
                type="password"
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                value={anonKey}
                onChange={(e) => setAnonKey(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-750 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-mono text-xs"
              />
            </div>

            {testStatus === 'failed' && (
              <div className="p-3 rounded-lg bg-red-950/40 border border-red-800 text-red-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage || '연결 확인에 실패했습니다.'}</span>
              </div>
            )}

            {testStatus === 'success' && (
              <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-800 text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Supabase 연결에 성공했습니다! 실시간 데이터베이스가 활성화되었습니다.</span>
              </div>
            )}
          </div>

          {/* SQL Setup Snippet */}
          <div className="border border-slate-800 rounded-xl bg-slate-950 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                <ShieldCheck className="w-4 h-4 text-indigo-400" />
                <span>Supabase 1회용 테이블 생성 SQL 스크립트</span>
              </div>
              <button
                onClick={handleCopySql}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>{copied ? '복사 완료!' : 'SQL 복사'}</span>
              </button>
            </div>
            <p className="text-xs text-slate-400">
              Supabase 대시보드 &gt; <strong>SQL Editor</strong> &gt; <strong>New Query</strong>에 붙여넣고 <strong>Run</strong> 버튼을 누르면 1초 만에 방 및 제출 테이블이 생성됩니다.
            </p>
            <div className="max-h-32 overflow-y-auto rounded-lg bg-slate-900/90 p-3 font-mono text-[11px] text-slate-300 border border-slate-800/80">
              <pre className="whitespace-pre-wrap">{DEFAULT_SQL_SCHEMA}</pre>
            </div>
            <div className="flex items-center justify-end">
              <a
                href="https://supabase.com/dashboard"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                <span>Supabase 콘솔 바로가기</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-950/80">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white transition-colors"
          >
            닫기
          </button>
          <div className="flex items-center gap-3">
            <button
              onClick={handleSaveAndTest}
              disabled={testStatus === 'testing'}
              className="px-5 py-2.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-50"
            >
              {testStatus === 'testing' ? '연결 테스트 중...' : '연결 저장 및 적용'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
