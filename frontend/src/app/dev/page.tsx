'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:7860';

// ── Gradio UI 상수 ─────────────────────────────────────────────
const NATIONALITIES = ['Korean', 'Japanese', 'Chinese', 'American', 'British', 'German', 'French', 'Australian', 'Other'];
const STAY_PURPOSES = [
  '💻 원격 근무 / 프리랜서 활동',
  '🌿 삶의 질 향상 (기후·생활비·환경)',
  '🗺️ 현재 노마드 — 다음 베이스 탐색',
  '🏖️ 은퇴 후 장기 거주',
  '💼 창업 / 사업 거점 이전',
];
const LIFESTYLE_OPTIONS = [
  '🏖️ 해변', '🏙️ 도심', '💰 저물가', '🔒 안전 우선',
  '🌐 영어권', '☀️ 따뜻한 기후', '❄️ 선선한 기후',
  '🤝 노마드 커뮤니티', '🍜 한국 음식',
];
const LANGUAGE_OPTIONS = ['영어 불가 / 한국어만', '영어 기본 소통 가능', '영어 업무 수준'];
const TIMELINE_OPTIONS = ['90일 이하 (비자 없이 탐색)', '1년 단기 체험', '3년 장기 체류', '5년 이상 초장기 체류'];
const CONTINENT_OPTIONS = ['아시아', '유럽', '중남미'];
const INCOME_TYPE_OPTIONS = [
  '한국 법인 재직 (재직증명서 + 급여명세서)',
  '해외 법인 재직',
  '프리랜서 (계약서·해외 송금 내역)',
  '1인 사업자 (종합소득세 신고 기반)',
  '무소득 / 은퇴',
];
const TRAVEL_TYPE_OPTIONS = [
  '혼자 (솔로)', '배우자·파트너 동반', '자녀 동반 (배우자 없이)', '가족 전체 동반 (배우자 + 자녀)',
];
const READINESS_OPTIONS = [
  '막연하게 고민 중 (6개월+ 후 실행 예상)',
  '구체적으로 준비 중 (3~6개월 내 출국 목표)',
  '이미 출국했거나 출국 임박',
];

// ── Types ─────────────────────────────────────────────────────
interface Step1Form {
  nationality: string;
  income_krw: number;
  immigration_purpose: string;
  lifestyle: string[];
  languages: string[];
  timeline: string;
  preferred_countries: string[];
  preferred_language: string;
  income_type: string;
  travel_type: string;
  readiness_stage: string;
  dual_nationality: boolean;
}

interface City {
  city: string;
  city_kr?: string;
  country_id: string;
  score?: number;
}

interface Step1Result {
  markdown: string;
  cities: City[];
  parsed: Record<string, unknown>;
}

interface AuthUser {
  logged_in: boolean;
  name?: string;
  picture?: string;
  uid?: string;
}

interface Pin {
  id?: number;
  city: string;
  display: string;
  note: string;
  lat: number;
  lng: number;
  created_at?: string;
}

// ── 공통 스타일 ───────────────────────────────────────────────
const inputCls =
  'bg-[#0d0f15] border border-[#1e2330] rounded-lg px-3 py-2 text-sm text-[#e2e8f0] font-mono focus:outline-none focus:border-amber-400/60 focus:ring-1 focus:ring-amber-400/15 transition-colors w-full placeholder:text-[#2e3848]';
const selectCls = inputCls + ' cursor-pointer';
const btnPrimary =
  'px-5 py-2.5 bg-amber-400 text-black font-mono font-bold text-sm rounded-lg hover:bg-amber-300 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100';
const btnSecondary =
  'px-4 py-2 border border-[#1e2330] text-[#9ca3af] font-mono text-xs rounded-lg hover:border-amber-400/40 hover:text-amber-400 transition-colors';

// ── 하위 컴포넌트 ─────────────────────────────────────────────

function Section({
  num, title, badge, children, defaultOpen = true,
}: {
  num: string;
  title: string;
  badge?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="border border-[#1e2330] rounded-xl overflow-hidden"
    >
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-4 bg-[#0d1018] hover:bg-[#111520] transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <span className="text-[#2e3848] font-mono text-xs">{num}</span>
          <span className="font-mono text-sm text-[#e2e8f0] font-semibold tracking-wide">{title}</span>
          {badge && (
            <span className="text-[10px] bg-amber-400/10 text-amber-400/80 px-2 py-0.5 rounded font-mono border border-amber-400/20">
              {badge}
            </span>
          )}
        </div>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="text-[#3a4560] text-xs font-mono"
        >
          ▼
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="p-5 bg-[#08090e] border-t border-[#1e2330]">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="font-mono text-[10px] text-[#4a5568] uppercase tracking-[0.2em]">{label}</label>
      {children}
    </div>
  );
}

function TagButton({
  active, onClick, children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-xs font-mono border transition-all ${
        active
          ? 'bg-amber-400/15 border-amber-400/50 text-amber-400'
          : 'border-[#1e2330] text-[#4a5568] hover:border-[#2e3848] hover:text-[#9ca3af]'
      }`}
    >
      {children}
    </button>
  );
}

function Output({ content }: { content: string }) {
  return (
    <motion.pre
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-4 bg-[#0d0f15] border border-[#1e2330] rounded-xl p-4 text-xs text-[#8892a4] overflow-auto max-h-80 whitespace-pre-wrap leading-relaxed font-mono"
    >
      {content}
    </motion.pre>
  );
}

function ErrorBox({ msg }: { msg: string }) {
  return (
    <div className="mt-3 p-3 bg-red-500/8 border border-red-500/25 rounded-lg text-xs text-red-400 font-mono">
      ⚠ {msg}
    </div>
  );
}

// ── 방문자 카운터 애니메이션 ──────────────────────────────────
function AnimatedDigit({ digit, delay }: { digit: string; delay: number }) {
  return (
    <motion.span
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, type: 'spring', stiffness: 200, damping: 18 }}
      className="tabular-nums"
    >
      {digit}
    </motion.span>
  );
}

// ── 메인 페이지 ───────────────────────────────────────────────
export default function DevPage() {
  // ── 방문자 카운터 (DB 기반) ────────────────────────────────
  const [visitCount, setVisitCount] = useState(0);
  const [animCount, setAnimCount] = useState(0);

  useEffect(() => {
    // 방문 기록 + 최신 카운트 조회
    fetch(`${API_BASE}/api/visits/ping`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: '/dev' }),
    })
      .then((r) => r.json())
      .then((data) => setVisitCount(data.count))
      .catch(() => {
        // 백엔드 미연결 시 GET으로 폴백
        fetch(`${API_BASE}/api/visits?path=/dev`)
          .then((r) => r.json())
          .then((data) => setVisitCount(data.count))
          .catch(() => {});
      });
  }, []);

  useEffect(() => {
    if (visitCount === 0) return;
    const start = Math.max(0, visitCount - 30);
    let cur = start;
    const t = setInterval(() => {
      cur += 1;
      setAnimCount(cur);
      if (cur >= visitCount) clearInterval(t);
    }, 40);
    return () => clearInterval(t);
  }, [visitCount]);

  // ── Auth ───────────────────────────────────────────────────
  const [auth, setAuth] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  const fetchAuth = useCallback(async () => {
    setAuthLoading(true);
    try {
      const r = await fetch(`${API_BASE}/auth/me`, { credentials: 'include' });
      setAuth(await r.json());
    } catch {
      setAuth({ logged_in: false });
    } finally {
      setAuthLoading(false);
    }
  }, []);

  useEffect(() => { fetchAuth(); }, [fetchAuth]);

  // ── Step 1 Form ────────────────────────────────────────────
  const [form, setForm] = useState<Step1Form>({
    nationality: 'Korean',
    income_krw: 500,
    immigration_purpose: STAY_PURPOSES[0],
    lifestyle: [],
    languages: [],
    timeline: '1년 단기 체험',
    preferred_countries: [],
    preferred_language: '한국어',
    income_type: INCOME_TYPE_OPTIONS[0],
    travel_type: '혼자 (솔로)',
    readiness_stage: READINESS_OPTIONS[0],
    dual_nationality: false,
  });

  const [step1Loading, setStep1Loading] = useState(false);
  const [step1Result, setStep1Result] = useState<Step1Result | null>(null);
  const [step1Error, setStep1Error] = useState('');

  const runStep1 = async () => {
    setStep1Loading(true);
    setStep1Error('');
    setStep1Result(null);
    try {
      const r = await fetch(`${API_BASE}/api/recommend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(form),
      });
      if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
      setStep1Result(await r.json());
    } catch (e) {
      setStep1Error(String(e));
    } finally {
      setStep1Loading(false);
    }
  };

  // ── Step 2 ─────────────────────────────────────────────────
  const [cityIndex, setCityIndex] = useState(0);
  const [step2Loading, setStep2Loading] = useState(false);
  const [step2Result, setStep2Result] = useState('');
  const [step2Error, setStep2Error] = useState('');

  const runStep2 = async () => {
    if (!step1Result?.parsed) return;
    setStep2Loading(true);
    setStep2Error('');
    setStep2Result('');
    try {
      const r = await fetch(`${API_BASE}/api/detail`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ parsed_data: step1Result.parsed, city_index: cityIndex }),
      });
      if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
      const data = await r.json();
      setStep2Result(data.markdown);
    } catch (e) {
      setStep2Error(String(e));
    } finally {
      setStep2Loading(false);
    }
  };

  // ── Pins ───────────────────────────────────────────────────
  const [pins, setPins] = useState<Pin[]>([]);
  const [pinsLoading, setPinsLoading] = useState(false);
  const [newPin, setNewPin] = useState<Omit<Pin, 'id' | 'created_at'>>({
    city: '', display: '', note: '', lat: 0, lng: 0,
  });
  const [pinError, setPinError] = useState('');
  const [communityPins, setCommunityPins] = useState<Array<{ city: string; cnt: number }>>([]);

  const fetchPins = useCallback(async () => {
    setPinsLoading(true);
    try {
      const r = await fetch(`${API_BASE}/api/pins`, { credentials: 'include' });
      setPins(await r.json());
    } catch {
      setPins([]);
    } finally {
      setPinsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPins();
    fetch(`${API_BASE}/api/pins/community`, { credentials: 'include' })
      .then((r) => r.json())
      .then(setCommunityPins)
      .catch(() => {});
  }, [fetchPins]);

  const addPin = async () => {
    setPinError('');
    try {
      const r = await fetch(`${API_BASE}/api/pins`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ...newPin, lat: Number(newPin.lat), lng: Number(newPin.lng) }),
      });
      if (r.status === 401) { setPinError('로그인이 필요합니다'); return; }
      if (!r.ok) throw new Error(`${r.status}`);
      setNewPin({ city: '', display: '', note: '', lat: 0, lng: 0 });
      fetchPins();
    } catch (e) {
      setPinError(String(e));
    }
  };

  const deletePin = async (id: number) => {
    try {
      await fetch(`${API_BASE}/api/pins/${id}`, { method: 'DELETE', credentials: 'include' });
      fetchPins();
    } catch { /* ignore */ }
  };

  // ── helper ─────────────────────────────────────────────────
  const toggleMulti = (arr: string[], val: string) =>
    arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val];

  const formattedCount = animCount.toLocaleString('ko-KR');

  // ── Render ──────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#08090e] text-[#c8d0e0] font-mono">

      {/* 상단 내비 */}
      <header className="sticky top-0 z-20 border-b border-[#1e2330] bg-[#08090e]/95 backdrop-blur-md px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3 text-sm">
          <Link href="/" className="text-[#4a5568] hover:text-amber-400 transition-colors">←</Link>
          <span className="text-[#1e2330]">/</span>
          <span className="text-amber-400 font-bold tracking-wide">dev playground</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs text-[#3a4560]">{API_BASE}</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-5 py-10 space-y-5">

        {/* ── 방문자 카운터 ─────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="relative rounded-2xl overflow-hidden border border-amber-400/15"
          style={{ background: 'radial-gradient(ellipse at 50% 0%, #1a1200 0%, #08090e 70%)' }}
        >
          {/* 격자 배경 */}
          <div
            className="absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage:
                'linear-gradient(#f59e0b 1px, transparent 1px), linear-gradient(90deg, #f59e0b 1px, transparent 1px)',
              backgroundSize: '36px 36px',
            }}
          />
          {/* 상단 글로우 */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-24 bg-amber-400/8 blur-3xl" />

          <div className="relative px-8 py-12 text-center">
            <p className="text-[10px] text-amber-400/50 uppercase tracking-[0.35em] mb-5">
              TOTAL VISITS — THIS DEVICE
            </p>

            {/* 카운터 숫자 */}
            <div
              className="text-[72px] font-bold leading-none tabular-nums"
              style={{
                color: '#fbbf24',
                textShadow:
                  '0 0 20px rgba(251,191,36,0.4), 0 0 60px rgba(251,191,36,0.15)',
              }}
            >
              {formattedCount.split('').map((d, i) => (
                <AnimatedDigit key={i} digit={d} delay={i * 0.04} />
              ))}
            </div>

            <p className="text-xs text-[#3a4560] mt-3">전체 사용자 누적 방문 횟수</p>

            {/* 요약 통계 */}
            <div className="mt-8 flex items-center justify-center gap-8">
              {[
                { value: communityPins.length, label: '커뮤니티 핀 도시' },
                {
                  value: communityPins.reduce((s, p) => s + Number(p.cnt), 0),
                  label: '총 저장 핀',
                },
                {
                  value: auth?.logged_in ? '●' : '○',
                  label: '로그인',
                  color: auth?.logged_in ? 'text-green-400' : 'text-[#3a4560]',
                },
              ].map(({ value, label, color }, i) => (
                <div key={i} className="text-center">
                  <div className={`text-xl font-bold ${color ?? 'text-[#c8d0e0]'}`}>{value}</div>
                  <div className="text-[10px] text-[#3a4560] mt-1 uppercase tracking-widest">{label}</div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* ── 01 AUTH ─────────────────────────────────────────── */}
        <Section num="01" title="AUTH" badge="GET /auth/me">
          {authLoading ? (
            <p className="text-xs text-[#4a5568] animate-pulse">checking session...</p>
          ) : auth?.logged_in ? (
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                {auth.picture && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={auth.picture}
                    alt=""
                    className="w-9 h-9 rounded-full border border-[#1e2330]"
                  />
                )}
                <div>
                  <p className="text-sm text-green-400 font-semibold">{auth.name}</p>
                  <p className="text-[10px] text-[#4a5568]">uid: {auth.uid?.slice(0, 16)}…</p>
                </div>
              </div>
              <a
                href={`${API_BASE}/auth/logout`}
                className={btnSecondary}
              >
                logout →
              </a>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-4">
              <p className="text-xs text-[#4a5568]">로그인하면 핀 저장 및 상세 가이드 조회가 가능합니다.</p>
              <a href={`${API_BASE}/auth/google`} className={btnPrimary}>
                Google로 로그인
              </a>
            </div>
          )}
        </Section>

        {/* ── 02 STEP 1 ────────────────────────────────────────── */}
        <Section num="02" title="STEP 1  도시 추천" badge="POST /api/recommend">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

            <Field label="국적 nationality">
              <select className={selectCls} value={form.nationality}
                onChange={(e) => setForm((f) => ({ ...f, nationality: e.target.value }))}>
                {NATIONALITIES.map((n) => <option key={n}>{n}</option>)}
              </select>
            </Field>

            <Field label="월 소득 (만원) income_krw">
              <input
                type="number"
                className={inputCls}
                value={form.income_krw}
                onChange={(e) => setForm((f) => ({ ...f, income_krw: Number(e.target.value) }))}
              />
            </Field>

            <Field label="체류 목적 immigration_purpose">
              <select className={selectCls} value={form.immigration_purpose}
                onChange={(e) => setForm((f) => ({ ...f, immigration_purpose: e.target.value }))}>
                {STAY_PURPOSES.map((p) => <option key={p}>{p}</option>)}
              </select>
            </Field>

            <Field label="목표 체류 기간 timeline">
              <select className={selectCls} value={form.timeline}
                onChange={(e) => setForm((f) => ({ ...f, timeline: e.target.value }))}>
                {TIMELINE_OPTIONS.map((t) => <option key={t}>{t}</option>)}
              </select>
            </Field>

            <Field label="소득 형태 income_type">
              <select className={selectCls} value={form.income_type}
                onChange={(e) => setForm((f) => ({ ...f, income_type: e.target.value }))}>
                {INCOME_TYPE_OPTIONS.map((o) => <option key={o}>{o}</option>)}
              </select>
            </Field>

            <Field label="동반 여부 travel_type">
              <select className={selectCls} value={form.travel_type}
                onChange={(e) => setForm((f) => ({ ...f, travel_type: e.target.value }))}>
                {TRAVEL_TYPE_OPTIONS.map((o) => <option key={o}>{o}</option>)}
              </select>
            </Field>

            <Field label="준비 단계 readiness_stage">
              <select className={selectCls} value={form.readiness_stage}
                onChange={(e) => setForm((f) => ({ ...f, readiness_stage: e.target.value }))}>
                {READINESS_OPTIONS.map((o) => <option key={o}>{o}</option>)}
              </select>
            </Field>

            <Field label="응답 언어 preferred_language">
              <select className={selectCls} value={form.preferred_language}
                onChange={(e) => setForm((f) => ({ ...f, preferred_language: e.target.value }))}>
                <option>한국어</option>
                <option>English</option>
              </select>
            </Field>

            {/* 멀티 선택 필드 */}
            <div className="sm:col-span-2">
              <Field label="라이프스타일 lifestyle">
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {LIFESTYLE_OPTIONS.map((o) => (
                    <TagButton
                      key={o}
                      active={form.lifestyle.includes(o)}
                      onClick={() => setForm((f) => ({ ...f, lifestyle: toggleMulti(f.lifestyle, o) }))}
                    >
                      {o}
                    </TagButton>
                  ))}
                </div>
              </Field>
            </div>

            <div className="sm:col-span-2">
              <Field label="언어 수준 languages">
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {LANGUAGE_OPTIONS.map((o) => (
                    <TagButton
                      key={o}
                      active={form.languages.includes(o)}
                      onClick={() => setForm((f) => ({ ...f, languages: toggleMulti(f.languages, o) }))}
                    >
                      {o}
                    </TagButton>
                  ))}
                </div>
              </Field>
            </div>

            <div className="sm:col-span-2">
              <Field label="관심 대륙 preferred_countries">
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {CONTINENT_OPTIONS.map((o) => (
                    <TagButton
                      key={o}
                      active={form.preferred_countries.includes(o)}
                      onClick={() => setForm((f) => ({
                        ...f,
                        preferred_countries: toggleMulti(f.preferred_countries, o),
                      }))}
                    >
                      {o}
                    </TagButton>
                  ))}
                </div>
              </Field>
            </div>

            <div className="sm:col-span-2 flex items-center gap-2">
              <input
                type="checkbox"
                id="dual"
                checked={form.dual_nationality}
                onChange={(e) => setForm((f) => ({ ...f, dual_nationality: e.target.checked }))}
                className="accent-amber-400 w-3.5 h-3.5"
              />
              <label htmlFor="dual" className="text-xs text-[#4a5568] cursor-pointer select-none">
                복수 국적 dual_nationality
              </label>
            </div>
          </div>

          <div className="mt-5">
            <button onClick={runStep1} disabled={step1Loading} className={btnPrimary}>
              {step1Loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-3 h-3 border border-black/30 border-t-black rounded-full animate-spin" />
                  분석 중...
                </span>
              ) : '🚀  도시 추천 받기'}
            </button>
          </div>

          {step1Error && <ErrorBox msg={step1Error} />}

          {step1Result && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-5 space-y-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] text-green-400 uppercase tracking-widest">✓ cities</span>
                {step1Result.cities.map((c, i) => (
                  <span
                    key={i}
                    className="text-xs bg-green-400/8 text-green-400 px-2 py-0.5 rounded border border-green-400/20 font-mono"
                  >
                    [{i}] {c.city_kr ?? c.city} · {c.country_id}
                  </span>
                ))}
              </div>
              <Output content={step1Result.markdown} />
            </motion.div>
          )}
        </Section>

        {/* ── 03 STEP 2 ────────────────────────────────────────── */}
        <Section num="03" title="STEP 2  상세 가이드" badge="POST /api/detail" defaultOpen={false}>
          {!step1Result ? (
            <p className="text-xs text-[#3a4560]">
              ↑ Step 1을 먼저 실행해 도시를 추천받으세요.
            </p>
          ) : (
            <>
              <Field label="도시 선택 city_index">
                <div className="flex flex-wrap gap-2 mt-1">
                  {step1Result.cities.map((c, i) => (
                    <TagButton
                      key={i}
                      active={cityIndex === i}
                      onClick={() => setCityIndex(i)}
                    >
                      [{i}] {c.city_kr ?? c.city}
                    </TagButton>
                  ))}
                </div>
              </Field>

              <div className="mt-4">
                <button onClick={runStep2} disabled={step2Loading} className={btnPrimary}>
                  {step2Loading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-3 h-3 border border-black/30 border-t-black rounded-full animate-spin" />
                      로딩 중...
                    </span>
                  ) : '📋  상세 가이드 보기'}
                </button>
              </div>

              {step2Error && <ErrorBox msg={step2Error} />}
              {step2Result && <Output content={step2Result} />}
            </>
          )}
        </Section>

        {/* ── 04 PINS ─────────────────────────────────────────── */}
        <Section num="04" title="PINS  관심 도시" badge="/api/pins" defaultOpen={false}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">

            {/* 내 핀 목록 */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] text-[#4a5568] uppercase tracking-widest">내 핀 목록</span>
                <button onClick={fetchPins} className={btnSecondary}>
                  {pinsLoading ? '...' : '↻ 새로고침'}
                </button>
              </div>

              {pins.length === 0 ? (
                <p className="text-xs text-[#2e3848]">
                  {auth?.logged_in ? '저장된 핀이 없습니다.' : '로그인 후 확인 가능합니다.'}
                </p>
              ) : (
                <div className="space-y-2">
                  {pins.map((p, i) => (
                    <motion.div
                      key={i}
                      layout
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-center justify-between p-3 bg-[#0d0f15] rounded-lg border border-[#1e2330]"
                    >
                      <div>
                        <p className="text-sm text-[#c8d0e0]">{p.city}</p>
                        <p className="text-xs text-[#4a5568] mt-0.5">{p.note}</p>
                      </div>
                      {p.id && (
                        <button
                          onClick={() => deletePin(p.id!)}
                          className="text-xs text-[#3a4560] hover:text-red-400 transition-colors ml-3 shrink-0"
                        >
                          ✕
                        </button>
                      )}
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

            {/* 핀 추가 폼 */}
            <div>
              <p className="text-[10px] text-[#4a5568] uppercase tracking-widest mb-3">핀 추가</p>
              <div className="space-y-2">
                <input
                  placeholder="도시명 (예: 방콕)"
                  className={inputCls}
                  value={newPin.city}
                  onChange={(e) => setNewPin((p) => ({ ...p, city: e.target.value }))}
                />
                <input
                  placeholder="표시명 (예: Bangkok, Thailand)"
                  className={inputCls}
                  value={newPin.display}
                  onChange={(e) => setNewPin((p) => ({ ...p, display: e.target.value }))}
                />
                <input
                  placeholder="메모"
                  className={inputCls}
                  value={newPin.note}
                  onChange={(e) => setNewPin((p) => ({ ...p, note: e.target.value }))}
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    placeholder="위도 lat"
                    className={inputCls}
                    value={newPin.lat || ''}
                    onChange={(e) => setNewPin((p) => ({ ...p, lat: Number(e.target.value) }))}
                  />
                  <input
                    type="number"
                    placeholder="경도 lng"
                    className={inputCls}
                    value={newPin.lng || ''}
                    onChange={(e) => setNewPin((p) => ({ ...p, lng: Number(e.target.value) }))}
                  />
                </div>
                <button onClick={addPin} className={btnPrimary + ' w-full'}>
                  + 핀 추가
                </button>
                {pinError && <p className="text-xs text-red-400">{pinError}</p>}
              </div>
            </div>
          </div>

          {/* 커뮤니티 핀 */}
          {communityPins.length > 0 && (
            <div className="mt-6 pt-5 border-t border-[#1e2330]">
              <p className="text-[10px] text-[#4a5568] uppercase tracking-widest mb-3">
                커뮤니티 핀 TOP {Math.min(10, communityPins.length)}
              </p>
              <div className="flex flex-wrap gap-2">
                {communityPins.slice(0, 10).map((p, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0d0f15] rounded-lg border border-[#1e2330]"
                  >
                    <span className="text-xs text-[#8892a4]">{p.city}</span>
                    <span className="text-xs text-amber-400 font-bold">{p.cnt}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Section>

        <p className="text-center text-[10px] text-[#1e2330] pb-6 tracking-widest uppercase">
          nnai dev playground · {new Date().getFullYear()}
        </p>
      </main>
    </div>
  );
}
