"use client";

import { useCallback, useEffect, useState } from "react";
import { LocateFixed, MapPin, Users, UserRound, X } from "lucide-react";
import cityScores from "@/data/city_scores.json";
import {
  type JourneyContinent,
  trackJourneyCitySelect,
  trackJourneyContinentSelect,
  trackJourneyCountrySelect,
  trackJourneyMapOpen,
  trackJourneySaveClick,
  trackJourneySaveSuccess,
} from "@/lib/analytics/events";
import { buildGoogleLoginUrl } from "@/lib/legal-content.mjs";
import {
  buildJourneyCityOptions,
  buildJourneyCountryOptions,
  filterJourneyCitiesByCountry,
  filterJourneyCountriesByContinent,
  projectJourneyPoint,
  resolveJourneyLocation,
} from "@/lib/journey-map.mjs";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:7860";

type JourneyContinentValue = JourneyContinent;

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

type JourneyCountryOption = {
  country: string;
  country_code: string;
  continent: JourneyContinentValue;
  city_count: number;
  city_ids: string[];
  lat: number;
  lng: number;
};

const COUNTRY_OPTIONS = buildJourneyCountryOptions(CITY_OPTIONS) as JourneyCountryOption[];
const CONTINENT_MARKERS: Array<{
  id: JourneyContinentValue;
  label: string;
  x: number;
  y: number;
  size: number;
}> = [
  { id: "Americas", label: "아메리카", x: 230, y: 310, size: 104 },
  { id: "Europe", label: "유럽", x: 493, y: 230, size: 92 },
  { id: "Africa", label: "아프리카", x: 514, y: 382, size: 86 },
  { id: "Middle East", label: "중동", x: 590, y: 330, size: 78 },
  { id: "Asia", label: "아시아", x: 710, y: 300, size: 112 },
];

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

function markerStyle(point: { x: number; y: number }) {
  return {
    left: `${(point.x / 950) * 100}%`,
    top: `${(point.y / 620) * 100}%`,
  };
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
  const [activeContinent, setActiveContinent] = useState<JourneyContinentValue | null>(null);
  const [activeCountryCode, setActiveCountryCode] = useState<string | null>(null);
  const [selectedCityId, setSelectedCityId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [personaType, setPersonaType] = useState("");
  const [previewAnimationKey, setPreviewAnimationKey] = useState(0);

  useEffect(() => {
    if (!open) return;
    setPersonaType(localStorage.getItem("persona_type") ?? "");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    trackJourneyMapOpen();
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
  const selectedCity = CITY_OPTIONS.find((city) => city.id === selectedCityId) ?? null;
  const activeCountries = activeContinent
    ? filterJourneyCountriesByContinent(COUNTRY_OPTIONS, activeContinent) as JourneyCountryOption[]
    : [];
  const activeCities = activeCountryCode
    ? filterJourneyCitiesByCountry(CITY_OPTIONS, activeCountryCode) as JourneyCityOption[]
    : [];
  const activeCountry = activeCountryCode
    ? COUNTRY_OPTIONS.find((country) => country.country_code === activeCountryCode) ?? null
    : null;
  const selectedPoint = selectedCity ? projectJourneyPoint(selectedCity.lat, selectedCity.lng) : null;

  function selectContinent(continent: JourneyContinentValue) {
    setActiveContinent(continent);
    setActiveCountryCode(null);
    setSelectedCityId(null);
    setStatus("");
    trackJourneyContinentSelect(continent);
  }

  function selectCountry(country: JourneyCountryOption) {
    setActiveCountryCode(country.country_code);
    setSelectedCityId(null);
    setStatus("");
    trackJourneyCountrySelect(country.country_code);
  }

  function selectCity(city: JourneyCityOption) {
    const next = selectedCityId === city.id ? null : city.id;
    setSelectedCityId(next);
    if (next) {
      trackJourneyCitySelect(city.id);
      setPreviewAnimationKey((key) => key + 1);
    }
    setStatus("");
  }

  function resetContinent() {
    setActiveContinent(null);
    setActiveCountryCode(null);
    setSelectedCityId(null);
    setStatus("");
  }

  function resetCountry() {
    setActiveCountryCode(null);
    setSelectedCityId(null);
    setStatus("");
  }

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
          setStatus(`${fallbackCity.city}와 거리가 있어 자동 등록하지 않았습니다. 지도에서 도시를 선택해주세요.`);
          return;
        }

        const country = COUNTRY_OPTIONS.find((option) => option.country_code === city.country_code);
        setActiveContinent(country?.continent ?? null);
        setActiveCountryCode(city.country_code);
        setSelectedCityId(city.id);
        setPreviewAnimationKey((key) => key + 1);
        trackJourneyCitySelect(city.id);
        setStatus(`${city.city} 근처의 현재 GPS 좌표로 확인했습니다. 그대로 깃발을 꽂을 수 있습니다.`);
      },
      () => setStatus("위치 권한을 확인하지 못했습니다. 지도에서 도시를 선택해주세요."),
      { enableHighAccuracy: false, timeout: 8000 },
    );
  }

  async function saveStop() {
    if (!selectedCity) {
      setStatus("도시를 먼저 선택해주세요.");
      return;
    }
    trackJourneySaveClick(auth.logged_in);
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
      trackJourneySaveSuccess(selectedCity.id);
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
          <style>
            {`
              @keyframes journeyFlagDrop {
                0% { opacity: 0; transform: translateY(-38px) scale(0.72); }
                62% { opacity: 1; transform: translateY(4px) scale(1.04); }
                100% { opacity: 1; transform: translateY(0) scale(1); }
              }
              @keyframes journeyFlagPulse {
                0% { opacity: 0.38; transform: scale(0.65); }
                100% { opacity: 0; transform: scale(2.4); }
              }
              .journey-preview-flag { animation: journeyFlagDrop 520ms cubic-bezier(.2,.9,.2,1) both; transform-box: fill-box; transform-origin: center bottom; }
              .journey-preview-pulse { animation: journeyFlagPulse 900ms ease-out both; transform-box: fill-box; transform-origin: center; }
            `}
          </style>
          {!activeContinent && CONTINENT_MARKERS.map((marker) => (
            <g key={marker.id} transform={`translate(${marker.x} ${marker.y})`}>
              <circle r={marker.size / 2} fill="currentColor" className="text-[#d1842c]" opacity="0.18" />
              <circle r={marker.size / 2 - 3} fill="none" stroke="currentColor" strokeWidth="2" className="text-[#fffaf2]" opacity="0.55" />
              <text textAnchor="middle" y="4" fontSize="13" fontWeight="800" fill="currentColor" className="text-[#fffaf2]">
                {marker.label}
              </text>
            </g>
          ))}

          {activeCountries.map((country) => {
            const point = projectJourneyPoint(country.lat, country.lng);
            const selected = activeCountryCode === country.country_code;
            return (
              <g key={country.country_code} transform={`translate(${point.x} ${point.y})`}>
                <circle r={selected ? "13" : "10"} fill="currentColor" className="text-[#d1842c]" opacity={selected ? "0.9" : "0.58"} />
                <circle r={selected ? "18" : "14"} fill="none" stroke="currentColor" strokeWidth="2" className="text-[#fffaf2]" opacity="0.72" />
                <text textAnchor="middle" y="-20" fontSize="10" fontWeight="800" fill="currentColor" className="text-[#fffaf2]">
                  {country.country_code}
                </text>
              </g>
            );
          })}

          {activeCities.map((city) => {
            const point = projectJourneyPoint(city.lat, city.lng);
            const selected = selectedCityId === city.id;
            return (
              <g key={city.id} transform={`translate(${point.x} ${point.y})`}>
                <circle r={selected ? "7" : "4.5"} fill="currentColor" className={selected ? "text-[#fffaf2]" : "text-[#d1842c]"} opacity={selected ? "0.95" : "0.72"} />
              </g>
            );
          })}

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

          {selectedCity && selectedPoint && (
            <g key={`preview-${selectedCity.id}-${previewAnimationKey}`} transform={`translate(${selectedPoint.x} ${selectedPoint.y})`}>
              <circle r="12" fill="currentColor" className="journey-preview-pulse text-[#d1842c]" />
              <g className="journey-preview-flag">
                <path d="M0 0 L0 -30 L23 -19 L0 -9 Z" fill="currentColor" stroke="#fffaf2" strokeWidth="2.3" className="text-[#d1842c]" />
                <circle r="4.5" fill="#fffaf2" />
              </g>
            </g>
          )}
        </svg>
        <div className="pointer-events-auto absolute h-[calc(100%-10rem)] max-h-full w-[calc(100%-1rem)] max-w-[150vh] lg:h-[calc(100%-5rem)] lg:w-[calc(100%-4rem)]">
          {!activeContinent && CONTINENT_MARKERS.map((marker) => (
            <button
              key={marker.id}
              type="button"
              aria-label={`${marker.label} 선택`}
              onClick={() => selectContinent(marker.id)}
              className="absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-[#fffaf2]/65 bg-[#d1842c]/22 text-xs font-extrabold text-[#fffaf2] shadow-[0_0_28px_rgba(209,132,44,0.26)] transition hover:bg-[#d1842c]/42 focus:outline-none focus:ring-2 focus:ring-[#fffaf2]"
              style={{
                ...markerStyle(marker),
                width: marker.size,
                height: marker.size,
              }}
            >
              {marker.label}
            </button>
          ))}

          {activeCountries.map((country) => {
            const point = projectJourneyPoint(country.lat, country.lng);
            return (
              <button
                key={country.country_code}
                type="button"
                aria-label={`${country.country} 선택, 지원 도시 ${country.city_count}개`}
                onClick={() => selectCountry(country)}
                className={`absolute flex size-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border text-xs font-extrabold shadow-lg transition focus:outline-none focus:ring-2 focus:ring-[#fffaf2] ${
                  activeCountryCode === country.country_code
                    ? "border-[#fffaf2] bg-[#d1842c] text-white"
                    : "border-[#fffaf2]/70 bg-[#fffaf2]/90 text-[#1D1D1F] hover:bg-white"
                }`}
                style={markerStyle(point)}
              >
                {country.country_code}
              </button>
            );
          })}

          {activeCities.map((city) => {
            const point = projectJourneyPoint(city.lat, city.lng);
            const selected = selectedCityId === city.id;
            return (
              <button
                key={city.id}
                type="button"
                aria-label={selected ? `${city.city} 선택 해제` : `${city.city} 선택`}
                onClick={() => selectCity(city)}
                className={`absolute size-6 -translate-x-1/2 -translate-y-1/2 rounded-full border shadow-lg transition focus:outline-none focus:ring-2 focus:ring-[#fffaf2] ${
                  selected
                    ? "border-[#fffaf2] bg-[#d1842c]"
                    : "border-[#fffaf2]/80 bg-[#d1842c]/70 hover:bg-[#d1842c]"
                }`}
                style={markerStyle(point)}
              />
            );
          })}
        </div>
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
            <p className="mb-1 text-sm font-semibold text-[#1D1D1F]">내 발자취 남기기</p>
            <p className="mb-3 text-xs leading-relaxed text-[#756c60]">
              내 발자취를 남기고 저장해서 나만의 디지털노마드 log를 완성해보세요.
            </p>
            <button
              type="button"
              onClick={requestLocation}
              className="mb-3 inline-flex h-10 w-full items-center gap-2 border border-[#d8d0c4] bg-[#f7f1e8] px-3 text-left text-sm font-medium text-[#1D1D1F] transition-colors hover:bg-[#efe4d4]"
            >
              <LocateFixed className="size-4" />
              현재 위치로 도시 찾기
            </button>

            {activeContinent && (
              <button
                type="button"
                onClick={resetContinent}
                className="mb-2 text-xs font-semibold text-[#756c60] transition-colors hover:text-[#1D1D1F]"
              >
                ← 대륙 다시 선택
              </button>
            )}

            {activeCountry && (
              <button
                type="button"
                onClick={resetCountry}
                className="mb-2 ml-3 text-xs font-semibold text-[#756c60] transition-colors hover:text-[#1D1D1F]"
              >
                ← 국가 다시 선택
              </button>
            )}

            {!activeContinent && (
              <p className="text-xs leading-relaxed text-[#756c60]">지도에서 대륙을 먼저 선택하세요.</p>
            )}

            {activeContinent && !activeCountry && (
              <div className="grid grid-cols-2 gap-2">
                {activeCountries.map((country) => (
                  <button
                    key={country.country_code}
                    type="button"
                    onClick={() => selectCountry(country)}
                    className="border border-[#eadfd1] bg-[#fffaf2] px-3 py-2 text-left text-sm transition-colors hover:bg-[#f7f1e8] focus:outline-none focus:ring-2 focus:ring-[#d1842c]"
                    aria-label={`${country.country} 선택, 지원 도시 ${country.city_count}개`}
                  >
                    <span className="block font-semibold">{country.country}</span>
                    <span className="text-xs text-[#756c60]">지원 도시 {country.city_count}개</span>
                  </button>
                ))}
              </div>
            )}

            {activeCountry && (
              <div className="space-y-2">
                <div className="bg-[#f7f1e8] px-3 py-2 text-sm font-semibold text-[#1D1D1F]">
                  {activeCountry.country} · 지원 도시 {activeCountry.city_count}개
                </div>
                {activeCities.map((city) => (
                  <button
                    key={city.id}
                    type="button"
                    onClick={() => selectCity(city)}
                    className={`flex w-full items-center justify-between border px-3 py-2.5 text-left text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[#d1842c] ${
                      selectedCityId === city.id
                        ? "border-[#d1842c] bg-[#f1e2cc]"
                        : "border-[#eadfd1] bg-white hover:bg-[#f7f1e8]"
                    }`}
                    aria-label={selectedCityId === city.id ? `${city.city} 선택 해제` : `${city.city} 선택`}
                  >
                    <span>
                      <span className="font-semibold">{city.city_kr}</span>
                      <span className="ml-1 text-xs text-[#756c60]">{city.city}</span>
                    </span>
                    <span className="text-xs font-semibold text-[#d1842c]">{city.country_code}</span>
                  </button>
                ))}
              </div>
            )}

            {selectedCity && (
              <div className="mt-3 border-t border-[#eadfd1] pt-3">
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
                  {auth.logged_in ? "깃발 꽂기" : "로그인하고 내 log 저장하기"}
                </button>
              </div>
            )}

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
