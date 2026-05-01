"use client";

import { useEffect, useMemo, useState } from "react";
import { buildGoogleLoginUrl } from "@/lib/legal-content.mjs";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:7860";

type AuthState = {
  logged_in: boolean;
  name?: string;
};

type JourneyStop = {
  id: number;
  city: string;
  country: string;
  country_code?: string | null;
  lat: number;
  lng: number;
  note: string;
  persona_type?: string | null;
  created_at: string;
};

type CommunityStop = {
  city: string;
  country: string;
  country_code?: string | null;
  lat: number;
  lng: number;
  cnt: number;
};

type CityOption = {
  city: string;
  country: string;
  country_code: string;
  lat: number;
  lng: number;
};

const CITY_OPTIONS: CityOption[] = [
  { city: "Kuala Lumpur", country: "Malaysia", country_code: "MY", lat: 3.139, lng: 101.6869 },
  { city: "Chiang Mai", country: "Thailand", country_code: "TH", lat: 18.7883, lng: 98.9853 },
  { city: "Bangkok", country: "Thailand", country_code: "TH", lat: 13.7563, lng: 100.5018 },
  { city: "Seoul", country: "South Korea", country_code: "KR", lat: 37.5665, lng: 126.978 },
  { city: "Tokyo", country: "Japan", country_code: "JP", lat: 35.6762, lng: 139.6503 },
  { city: "Lisbon", country: "Portugal", country_code: "PT", lat: 38.7223, lng: -9.1393 },
  { city: "Porto", country: "Portugal", country_code: "PT", lat: 41.1579, lng: -8.6291 },
  { city: "Barcelona", country: "Spain", country_code: "ES", lat: 41.3874, lng: 2.1686 },
  { city: "Mexico City", country: "Mexico", country_code: "MX", lat: 19.4326, lng: -99.1332 },
  { city: "Medellin", country: "Colombia", country_code: "CO", lat: 6.2442, lng: -75.5812 },
  { city: "Buenos Aires", country: "Argentina", country_code: "AR", lat: -34.6037, lng: -58.3816 },
  { city: "Cape Town", country: "South Africa", country_code: "ZA", lat: -33.9249, lng: 18.4241 },
  { city: "Dubai", country: "United Arab Emirates", country_code: "AE", lat: 25.2048, lng: 55.2708 },
  { city: "Canggu", country: "Indonesia", country_code: "ID", lat: -8.65, lng: 115.138 },
];

function project(lat: number, lng: number) {
  return {
    x: ((lng + 180) / 360) * 100,
    y: ((90 - lat) / 180) * 100,
  };
}

function nearestCity(lat: number, lng: number) {
  return CITY_OPTIONS.reduce((best, city) => {
    const score = Math.hypot(city.lat - lat, city.lng - lng);
    return score < best.score ? { city, score } : best;
  }, { city: CITY_OPTIONS[0], score: Number.POSITIVE_INFINITY }).city;
}

function routePoints(stops: JourneyStop[]) {
  return stops
    .map((stop) => {
      const point = project(Number(stop.lat), Number(stop.lng));
      return `${point.x},${point.y}`;
    })
    .join(" ");
}

export function NomadJourneyModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [auth, setAuth] = useState<AuthState>({ logged_in: false });
  const [myStops, setMyStops] = useState<JourneyStop[]>([]);
  const [community, setCommunity] = useState<CommunityStop[]>([]);
  const [personaCommunity, setPersonaCommunity] = useState<CommunityStop[]>([]);
  const [showCommunity, setShowCommunity] = useState(false);
  const [showPersona, setShowPersona] = useState(false);
  const [selectedCity, setSelectedCity] = useState<CityOption>(CITY_OPTIONS[0]);
  const [note, setNote] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const personaType = useMemo(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("persona_type") ?? "";
  }, [open]);

  async function refresh() {
    const me = await fetch(`${API_BASE}/auth/me`, { credentials: "include", cache: "no-store" })
      .then((r) => r.json())
      .catch(() => ({ logged_in: false }));
    setAuth(me);

    const communityRows = await fetch(`${API_BASE}/api/journey/community`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : []))
      .catch(() => []);
    setCommunity(communityRows);

    if (personaType) {
      const personaRows = await fetch(
        `${API_BASE}/api/journey/community?persona_type=${encodeURIComponent(personaType)}`,
        { cache: "no-store" },
      )
        .then((r) => (r.ok ? r.json() : []))
        .catch(() => []);
      setPersonaCommunity(personaRows);
    } else {
      setPersonaCommunity([]);
    }

    if (me.logged_in) {
      const stops = await fetch(`${API_BASE}/api/journey/me`, {
        credentials: "include",
        cache: "no-store",
      })
        .then((r) => (r.ok ? r.json() : []))
        .catch(() => []);
      setMyStops(stops);
    } else {
      setMyStops([]);
    }
  }

  useEffect(() => {
    if (!open) return;
    refresh();
  }, [open]);

  if (!open) return null;

  const visibleCommunity = showPersona && personaCommunity.length > 0 ? personaCommunity : community;

  function requestLocation() {
    if (!navigator.geolocation) {
      setStatus("이 브라우저에서는 위치 인증을 사용할 수 없습니다.");
      return;
    }
    setStatus("현재 위치를 확인하는 중입니다.");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const city = nearestCity(position.coords.latitude, position.coords.longitude);
        setSelectedCity(city);
        setStatus(`${city.city} 근처로 확인했습니다. 도시를 확인하고 깃발을 꽂아주세요.`);
      },
      () => setStatus("위치 권한을 확인하지 못했습니다. 도시를 직접 선택해주세요."),
      { enableHighAccuracy: false, timeout: 8000 },
    );
  }

  async function saveStop() {
    if (!auth.logged_in) {
      window.location.assign(buildGoogleLoginUrl(API_BASE, window.location.href));
      return;
    }
    setLoading(true);
    setStatus("");
    try {
      const response = await fetch(`${API_BASE}/api/journey/stops`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          city: selectedCity.city,
          country: selectedCity.country,
          country_code: selectedCity.country_code,
          lat: selectedCity.lat,
          lng: selectedCity.lng,
          note,
        }),
      });
      if (!response.ok) {
        const message = response.status === 422 ? "방명록은 10글자 이내로 입력해주세요." : "깃발을 저장하지 못했습니다.";
        throw new Error(message);
      }
      setNote("");
      setStatus("깃발을 꽂았습니다.");
      await refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "깃발을 저장하지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4 py-6 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto bg-[#111827] text-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-cyan-200/70">Nomad Journey</p>
            <h2 className="text-lg font-semibold">내 노마드 여정 지도</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="border border-white/15 px-3 py-1.5 text-sm text-white/75 hover:bg-white/10"
          >
            닫기
          </button>
        </div>

        <div className="grid gap-5 p-5 lg:grid-cols-[1.4fr_0.8fr]">
          <div className="relative min-h-[330px] overflow-hidden border border-white/10 bg-[#07111f]">
            <svg viewBox="0 0 100 52" className="h-full min-h-[330px] w-full">
              <rect width="100" height="52" fill="#07111f" />
              <path d="M9 16 L18 10 L29 12 L33 18 L28 24 L17 23 L10 28 L5 23 Z" fill="#1f6f5b" opacity="0.72" />
              <path d="M25 29 L31 32 L34 40 L31 49 L25 45 L22 36 Z" fill="#1f6f5b" opacity="0.62" />
              <path d="M43 13 L55 10 L67 13 L72 20 L66 27 L53 27 L44 23 Z" fill="#2c7a5f" opacity="0.76" />
              <path d="M50 29 L62 30 L66 39 L59 48 L49 43 L45 35 Z" fill="#2c7a5f" opacity="0.68" />
              <path d="M67 15 L82 12 L94 18 L91 29 L78 28 L68 23 Z" fill="#328668" opacity="0.72" />
              <path d="M79 35 L91 37 L96 45 L88 50 L79 46 Z" fill="#328668" opacity="0.66" />

              {myStops.length > 1 && (
                <polyline points={routePoints(myStops)} fill="none" stroke="#fbbf24" strokeWidth="0.45" strokeLinecap="round" />
              )}

              {showCommunity &&
                visibleCommunity.map((stop) => {
                  const point = project(Number(stop.lat), Number(stop.lng));
                  return (
                    <g key={`${stop.city}-${stop.country}`} transform={`translate(${point.x} ${point.y})`}>
                      <circle r={Math.min(2.8, 1 + stop.cnt * 0.25)} fill={showPersona ? "#a78bfa" : "#38bdf8"} opacity="0.75" />
                      <text y="-2.6" textAnchor="middle" fontSize="2.2" fill="#e0f2fe">
                        {stop.city} {stop.cnt}
                      </text>
                    </g>
                  );
                })}

              {myStops.map((stop) => {
                const point = project(Number(stop.lat), Number(stop.lng));
                return (
                  <g key={stop.id} transform={`translate(${point.x} ${point.y})`}>
                    <path d="M0 0 L0 -5 L4 -3 L0 -1 Z" fill="#facc15" stroke="#111827" strokeWidth="0.35" />
                    <circle r="0.8" fill="#facc15" />
                  </g>
                );
              })}
            </svg>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setShowCommunity((value) => !value)}
                className={`border px-3 py-2 text-sm ${showCommunity ? "border-cyan-300 bg-cyan-300/15" : "border-white/15"}`}
              >
                전체 보기
              </button>
              <button
                type="button"
                onClick={() => setShowPersona((value) => !value)}
                disabled={!personaType}
                className={`border px-3 py-2 text-sm disabled:opacity-35 ${showPersona ? "border-violet-300 bg-violet-300/15" : "border-white/15"}`}
              >
                내 타입
              </button>
            </div>

            <div className="border border-white/10 p-4">
              <p className="mb-3 text-sm font-semibold">깃발 꽂기</p>
              <button type="button" onClick={requestLocation} className="mb-3 w-full bg-white px-3 py-2 text-sm font-medium text-[#111827]">
                현재 위치 인증
              </button>
              <select
                value={`${selectedCity.city}|${selectedCity.country}`}
                onChange={(event) => {
                  const [city, country] = event.target.value.split("|");
                  setSelectedCity(CITY_OPTIONS.find((option) => option.city === city && option.country === country) ?? CITY_OPTIONS[0]);
                }}
                className="mb-2 w-full border border-white/15 bg-transparent px-3 py-2 text-sm"
              >
                {CITY_OPTIONS.map((city) => (
                  <option key={`${city.city}-${city.country}`} value={`${city.city}|${city.country}`} className="bg-[#111827]">
                    {city.city}, {city.country}
                  </option>
                ))}
              </select>
              <input
                value={note}
                maxLength={10}
                onChange={(event) => setNote(event.target.value)}
                placeholder="방명록 10글자"
                className="mb-2 w-full border border-white/15 bg-transparent px-3 py-2 text-sm placeholder:text-white/35"
              />
              <button
                type="button"
                onClick={saveStop}
                disabled={loading || note.length > 10}
                className="w-full bg-amber-300 px-3 py-2 text-sm font-semibold text-[#111827] disabled:opacity-45"
              >
                {auth.logged_in ? "깃발 꽂기" : "로그인하고 깃발 꽂기"}
              </button>
              {status && <p className="mt-3 text-xs text-cyan-100/80">{status}</p>}
            </div>

            <div className="border border-white/10 p-4">
              <p className="mb-2 text-sm font-semibold">내 여정</p>
              {myStops.length === 0 ? (
                <p className="text-xs text-white/50">{auth.logged_in ? "아직 인증한 도시가 없습니다." : "로그인하면 내 이동선이 저장됩니다."}</p>
              ) : (
                <div className="space-y-2">
                  {myStops.map((stop, index) => (
                    <div key={stop.id} className="flex items-center justify-between text-sm">
                      <span>{index + 1}. {stop.city}</span>
                      <span className="text-amber-200">{stop.note}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
