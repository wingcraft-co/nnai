"use client";

import { useCallback, useEffect, useState } from "react";
import { LocateFixed, MapPin, Search, Users, UserRound, X } from "lucide-react";
import cityScores from "@/data/city_scores.json";
import { buildGoogleLoginUrl } from "@/lib/legal-content.mjs";
import {
  buildJourneyCityOptions,
  filterJourneyCities,
  projectJourneyPoint,
  resolveJourneyLocation,
} from "@/lib/journey-map.mjs";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:7860";

type JourneyCityOption = {
  id: string;
  city: string;
  city_kr: string;
  country: string;
  country_code: string;
  lat: number;
  lng: number;
  search_index: string;
  gps_confirmed?: boolean;
  gps_distance_km?: number;
};

const CITY_OPTIONS = buildJourneyCityOptions(cityScores) as JourneyCityOption[];

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

function nearestCity(lat: number, lng: number) {
  return CITY_OPTIONS.reduce((best, city) => {
    const score = Math.hypot(city.lat - lat, city.lng - lng);
    return score < best.score ? { city, score } : best;
  }, { city: CITY_OPTIONS[0], score: Number.POSITIVE_INFINITY }).city;
}

function routePoints(stops: JourneyStop[]) {
  return stops
    .map((stop) => {
      const point = projectJourneyPoint(Number(stop.lat), Number(stop.lng));
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
  const [selectedCity, setSelectedCity] = useState<JourneyCityOption>(CITY_OPTIONS[0]);
  const [cityQuery, setCityQuery] = useState("");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [personaType, setPersonaType] = useState("");

  useEffect(() => {
    if (!open) return;
    setPersonaType(localStorage.getItem("persona_type") ?? "");
  }, [open]);

  const refresh = useCallback(async () => {
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
  }, [personaType]);

  useEffect(() => {
    if (!open) return;
    refresh();
  }, [open, refresh]);

  useEffect(() => {
    if (!open) return;

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose, open]);

  if (!open) return null;

  const visibleCommunity = showPersona && personaCommunity.length > 0 ? personaCommunity : community;
  const filteredCities = filterJourneyCities(CITY_OPTIONS, cityQuery, 7) as JourneyCityOption[];

  function requestLocation() {
    if (!navigator.geolocation) {
      setStatus("이 브라우저에서는 위치 인증을 사용할 수 없습니다.");
      return;
    }
    setStatus("현재 위치를 확인하는 중입니다.");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const city = resolveJourneyLocation(
          CITY_OPTIONS,
          position.coords.latitude,
          position.coords.longitude,
        ) as JourneyCityOption | null;

        if (!city) {
          const fallbackCity = nearestCity(position.coords.latitude, position.coords.longitude);
          setStatus(`${fallbackCity.city}와 거리가 있어 자동 등록하지 않았습니다. 도시를 검색해서 선택해주세요.`);
          return;
        }

        setSelectedCity(city);
        setCityQuery(city.city);
        setStatus(`${city.city} 근처의 현재 GPS 좌표로 확인했습니다. 그대로 깃발을 꽂을 수 있습니다.`);
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
    <div
      className="fixed inset-0 z-50 bg-background/82 p-3 text-[#fffaf2] backdrop-blur-sm sm:p-6 lg:p-8"
      onClick={onClose}
    >
      <div
        className="relative mx-auto h-full max-h-[860px] max-w-6xl overflow-hidden border border-white/20 bg-[#1a1a2e] shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(255,250,242,0.08),transparent_58%)]" />
      <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center px-3 py-20 lg:px-8 lg:py-10">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/world-map-low-resolution.svg"
          alt=""
          className="h-full max-h-full w-full max-w-[150vh] object-contain opacity-45"
        />
        <svg
          viewBox="0 0 950 620"
          className="pointer-events-none absolute h-[calc(100%-10rem)] max-h-full w-[calc(100%-1rem)] max-w-[150vh] lg:h-[calc(100%-5rem)] lg:w-[calc(100%-4rem)]"
          aria-label="Nomad journey world map"
        >
          {myStops.length > 1 && (
            <polyline
              points={routePoints(myStops)}
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-[#d1842c]"
              opacity="0.92"
            />
          )}

          {showCommunity &&
            visibleCommunity.map((stop) => {
              const point = projectJourneyPoint(Number(stop.lat), Number(stop.lng));
              return (
                <g key={`${stop.city}-${stop.country}`} transform={`translate(${point.x} ${point.y})`}>
                  <circle r={Math.min(13, 5 + stop.cnt * 1.2)} fill="currentColor" className="text-[#d1842c]" opacity={showPersona ? "0.34" : "0.22"} />
                  <circle r="3.2" fill="currentColor" className="text-[#d1842c]" opacity="0.88" />
                  <text y="-9" textAnchor="middle" fontSize="11" fontWeight="700" fill="currentColor" className="text-[#fffaf2]">
                    {stop.city} {stop.cnt}
                  </text>
                </g>
              );
            })}

          {myStops.map((stop) => {
            const point = projectJourneyPoint(Number(stop.lat), Number(stop.lng));
            return (
              <g key={stop.id} transform={`translate(${point.x} ${point.y})`}>
                <circle r="8" fill="currentColor" className="text-[#d1842c]" opacity="0.22" />
                <path d="M0 0 L0 -24 L19 -15 L0 -7 Z" fill="currentColor" stroke="#fffaf2" strokeWidth="2" className="text-[#d1842c]" />
                <circle r="4" fill="#fffaf2" />
              </g>
            );
          })}
        </svg>
      </div>

      <div className="absolute left-3 right-3 top-3 z-30 flex h-11 items-center justify-between border border-white/20 bg-[#fffaf2]/90 px-3 text-[#1D1D1F] shadow-xl backdrop-blur-md lg:left-6 lg:right-6 lg:top-5">
        <div className="flex items-center gap-2">
          <span className="size-2.5 rounded-full bg-[#d1842c]" />
          <span className="size-2.5 rounded-full bg-[#c8beb0]" />
          <span className="size-2.5 rounded-full bg-[#756c60]" />
        </div>
        <div className="text-center">
          <p className="text-[11px] font-semibold uppercase tracking-normal text-[#756c60]">Nomad Journey</p>
          <h2 className="font-serif text-sm font-semibold leading-none text-[#1D1D1F]">내 노마드 여정 지도</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex size-8 items-center justify-center border border-[#d8d0c4] bg-white text-[#1D1D1F] transition-colors hover:bg-[#f1eadf]"
          aria-label="지도 닫기"
        >
          <X className="size-4" />
        </button>
      </div>

      <aside className="absolute inset-x-3 bottom-3 z-30 max-h-[48vh] overflow-y-auto border border-white/20 bg-[#fffaf2]/94 p-3 text-[#1D1D1F] shadow-2xl backdrop-blur-md lg:inset-x-auto lg:bottom-6 lg:right-6 lg:top-20 lg:w-[370px] lg:max-h-none lg:p-4">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              aria-pressed={showCommunity}
              onClick={() => setShowCommunity((value) => !value)}
              className={`inline-flex h-10 items-center justify-center gap-2 border px-3 text-sm font-medium transition-colors ${showCommunity ? "border-[#d1842c] bg-[#d1842c] text-white" : "border-[#d8d0c4] bg-white text-[#1D1D1F] hover:bg-[#f1eadf]"}`}
            >
              <Users className="size-4" />
              전체 보기
            </button>
            <button
              type="button"
              aria-pressed={showPersona}
              onClick={() => setShowPersona((value) => !value)}
              disabled={!personaType}
              className={`inline-flex h-10 items-center justify-center gap-2 border px-3 text-sm font-medium transition-colors disabled:opacity-40 ${showPersona ? "border-[#d1842c] bg-[#d1842c] text-white" : "border-[#d8d0c4] bg-white text-[#1D1D1F] hover:bg-[#f1eadf]"}`}
            >
              <UserRound className="size-4" />
              내 타입
            </button>
          </div>

          <div className="border border-[#d8d0c4] bg-white p-3">
            <p className="mb-3 text-sm font-semibold text-[#1D1D1F]">깃발 꽂기</p>
            <button type="button" onClick={requestLocation} className="mb-3 inline-flex h-10 w-full items-center gap-2 border border-[#d8d0c4] bg-[#f7f1e8] px-3 text-left text-sm font-medium text-[#1D1D1F] transition-colors hover:bg-[#efe4d4]">
              <LocateFixed className="size-4" />
              현재 위치 인증
            </button>

            <div className="relative mb-2">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#756c60]" />
              <input
                value={cityQuery}
                onChange={(event) => setCityQuery(event.target.value)}
                placeholder="도시, 국가, ISO 코드 검색"
                className="h-11 w-full border border-[#d8d0c4] bg-[#fffaf2] py-3 pl-9 pr-3 text-sm font-medium text-[#1D1D1F] outline-none placeholder:text-[#756c60] focus:border-[#d1842c]"
              />
            </div>

            <div className="mb-3 max-h-44 overflow-y-auto border border-[#eadfd1]">
              {filteredCities.map((city) => (
                <button
                  type="button"
                  key={city.id}
                  onClick={() => {
                    setSelectedCity(city);
                    setCityQuery(city.city);
                  }}
                  className={`flex w-full items-center justify-between border-b border-[#eadfd1] px-3 py-2.5 text-left text-sm transition-colors last:border-b-0 hover:bg-[#f7f1e8] ${selectedCity.id === city.id ? "bg-[#f1e2cc] text-[#1D1D1F]" : "bg-white text-[#3d352d]"}`}
                >
                  <span>
                    <span className="font-semibold">{city.city}</span>
                    <span className="ml-1 text-xs text-[#756c60]">{city.country}</span>
                  </span>
                  <span className="text-xs font-semibold text-[#d1842c]">{city.country_code}</span>
                </button>
              ))}
            </div>

            <div className="mb-2 flex items-center gap-2 bg-[#f7f1e8] px-3 py-2 text-sm text-[#3d352d]">
              <MapPin className="size-4 text-[#d1842c]" />
              <span className="font-semibold">{selectedCity.city}</span>
              <span className="text-xs text-[#756c60]">{selectedCity.country}</span>
              {selectedCity.gps_confirmed && <span className="ml-auto text-xs font-semibold text-[#d1842c]">GPS</span>}
            </div>

            <input
              value={note}
              maxLength={10}
              onChange={(event) => setNote(event.target.value)}
              placeholder="방명록 10글자"
              className="mb-2 h-11 w-full border border-[#d8d0c4] bg-[#fffaf2] px-3 text-sm font-medium text-[#1D1D1F] outline-none placeholder:text-[#756c60] focus:border-[#d1842c]"
            />
            <button
              type="button"
              onClick={saveStop}
              disabled={loading || note.length > 10}
              className="h-11 w-full bg-[#d1842c] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#b96f20] disabled:opacity-45"
            >
              {auth.logged_in ? "깃발 꽂기" : "로그인하고 깃발 꽂기"}
            </button>
            {status && <p className="mt-3 text-xs leading-relaxed text-[#756c60]">{status}</p>}
          </div>

          <div className="border border-[#d8d0c4] bg-white p-3">
            <p className="mb-2 text-sm font-semibold text-[#1D1D1F]">내 여정</p>
            {myStops.length === 0 ? (
              <p className="text-xs leading-relaxed text-[#756c60]">{auth.logged_in ? "아직 인증한 도시가 없습니다." : "로그인하면 내 이동선이 저장됩니다."}</p>
            ) : (
              <div className="space-y-2">
                {myStops.map((stop, index) => (
                  <div key={stop.id} className="flex items-center justify-between bg-[#f7f1e8] px-3 py-2 text-sm">
                    <span>{index + 1}. {stop.city}</span>
                    <span className="font-semibold text-[#d1842c]">{stop.note}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </aside>

      </div>
    </div>
  );
}
