import { useCallback, useEffect, useMemo, useState } from 'react';
import { dressBrief, precipLabel } from '../lib/dress';

const LOC_KEY = 'manuel-os-weather-loc';
const CACHE_KEY = 'manuel-os-weather-cache';
const CACHE_MS = 30 * 60 * 1000;

export const WEATHER_LOCS = [
  {
    id: 'bentonville',
    label: 'Bentonville',
    short: 'Bentonville, AR',
    lat: 36.3729,
    lon: -94.2088,
  },
  {
    id: 'springdale',
    label: 'Springdale',
    short: 'Springdale, AR',
    lat: 36.1867,
    lon: -94.1288,
  },
  {
    id: 'baltimore',
    label: 'Baltimore',
    short: 'Baltimore, MD',
    lat: 39.2904,
    lon: -76.6122,
  },
];

/** WMO weather code → short icon + label */
export function weatherIcon(code) {
  const c = Number(code) || 0;
  if (c === 0) return { icon: '☀', label: 'Clear' };
  if (c <= 3) return { icon: '🌤', label: 'Partly cloudy' };
  if (c <= 48) return { icon: '🌫', label: 'Fog' };
  if (c <= 57) return { icon: '🌦', label: 'Drizzle' };
  if (c <= 67) return { icon: '🌧', label: 'Rain' };
  if (c <= 77) return { icon: '❄', label: 'Snow' };
  if (c <= 82) return { icon: '🌦', label: 'Showers' };
  if (c <= 86) return { icon: '❄', label: 'Snow showers' };
  if (c <= 99) return { icon: '⛈', label: 'Thunder' };
  return { icon: '☁', label: 'Cloudy' };
}

function loadLocId() {
  try {
    const id = localStorage.getItem(LOC_KEY);
    if (WEATHER_LOCS.some((l) => l.id === id)) return id;
  } catch {
    /* ignore */
  }
  return 'bentonville';
}

function loadCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveCache(payload) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
  } catch {
    /* ignore */
  }
}

function buildUrl(loc) {
  const params = new URLSearchParams({
    latitude: String(loc.lat),
    longitude: String(loc.lon),
    current: [
      'temperature_2m',
      'apparent_temperature',
      'precipitation',
      'rain',
      'snowfall',
      'weather_code',
      'wind_speed_10m',
    ].join(','),
    hourly: [
      'temperature_2m',
      'precipitation_probability',
      'precipitation',
      'weather_code',
      'rain',
      'snowfall',
    ].join(','),
    daily: [
      'temperature_2m_max',
      'temperature_2m_min',
      'precipitation_probability_max',
      'precipitation_sum',
      'weather_code',
    ].join(','),
    temperature_unit: 'fahrenheit',
    wind_speed_unit: 'mph',
    timezone: 'America/New_York',
    forecast_days: '1',
  });
  return `https://api.open-meteo.com/v1/forecast?${params}`;
}

function parseHourly(json) {
  const h = json.hourly || {};
  const times = h.time || [];
  const out = [];
  for (let i = 0; i < times.length; i++) {
    const iso = times[i]; // "2026-09-23T14:00"
    const hour = Number(iso.slice(11, 13));
    const code = Number(h.weather_code?.[i] ?? 0);
    const meta = weatherIcon(code);
    const precipProb = Math.round(Number(h.precipitation_probability?.[i] ?? 0));
    const rain = Number(h.rain?.[i] ?? 0);
    const snow = Number(h.snowfall?.[i] ?? 0);
    out.push({
      time: iso,
      hour,
      temp: Math.round(Number(h.temperature_2m?.[i])),
      precipProb,
      precip: Number(h.precipitation?.[i] ?? 0),
      rain,
      snow,
      weatherCode: code,
      icon: meta.icon,
      condition: meta.label,
    });
  }
  return out;
}

function willRainToday(precipProb, weatherCode, rain, snow, hourly) {
  const snowy =
    snow > 0 ||
    (weatherCode >= 71 && weatherCode <= 77) ||
    (weatherCode >= 85 && weatherCode <= 86);
  const rainy =
    rain > 0 ||
    (weatherCode >= 51 && weatherCode <= 67) ||
    (weatherCode >= 80 && weatherCode <= 82) ||
    (weatherCode >= 95 && weatherCode <= 99);
  const hourlyRain = (hourly || []).some(
    (h) =>
      h.precipProb >= 40 ||
      h.rain > 0 ||
      (h.weatherCode >= 51 && h.weatherCode <= 67) ||
      (h.weatherCode >= 80 && h.weatherCode <= 82) ||
      (h.weatherCode >= 95 && h.weatherCode <= 99),
  );
  const yes = !snowy && (rainy || precipProb >= 40 || hourlyRain);
  const kind = snowy ? 'snow' : yes ? 'rain' : null;
  return { willRain: yes, kind, precipProb };
}

function parseWeather(json, loc) {
  const cur = json.current || {};
  const daily = json.daily || {};
  const hourly = parseHourly(json);
  const temp = Math.round(Number(cur.temperature_2m));
  const apparent = Math.round(Number(cur.apparent_temperature));
  const high = Math.round(Number(daily.temperature_2m_max?.[0]));
  const low = Math.round(Number(daily.temperature_2m_min?.[0]));
  const precipProb = Math.round(
    Number(daily.precipitation_probability_max?.[0] ?? 0),
  );
  const weatherCode = Number(cur.weather_code ?? daily.weather_code?.[0] ?? 0);
  const wind = Math.round(Number(cur.wind_speed_10m ?? 0));
  const rain = Number(cur.rain ?? 0);
  const snow = Number(cur.snowfall ?? 0);
  const precip = precipLabel(weatherCode, precipProb, rain, snow);
  const dress = dressBrief({
    apparent,
    precipProb,
    weatherCode,
    windMph: wind,
    rain,
    snow,
  });
  const rainToday = willRainToday(precipProb, weatherCode, rain, snow, hourly);
  const iconMeta = weatherIcon(weatherCode);
  return {
    locId: loc.id,
    locLabel: loc.label,
    temp,
    apparent,
    high,
    low,
    precipProb,
    precip,
    wind,
    weatherCode,
    icon: iconMeta.icon,
    condition: iconMeta.label,
    dressLine: dress.line,
    dressShort: dress.short,
    willRain: rainToday.willRain,
    precipKind: rainToday.kind,
    hourly,
    fetchedAt: Date.now(),
  };
}

export function useWeather(nyHour) {
  const [locId, setLocIdState] = useState(loadLocId);
  const [data, setData] = useState(() => {
    const cache = loadCache();
    if (cache?.data?.locId === loadLocId()) return cache.data;
    return null;
  });
  const [status, setStatus] = useState('idle'); // idle | loading | ok | stale | offline
  const [errorMsg, setErrorMsg] = useState(null);

  const loc = useMemo(
    () => WEATHER_LOCS.find((l) => l.id === locId) || WEATHER_LOCS[0],
    [locId],
  );

  const setLocId = useCallback((id) => {
    if (!WEATHER_LOCS.some((l) => l.id === id)) return;
    setLocIdState(id);
    try {
      localStorage.setItem(LOC_KEY, id);
    } catch {
      /* ignore */
    }
  }, []);

  const fetchWeather = useCallback(
    async ({ force = false } = {}) => {
      const cache = loadCache();
      const hasHourly = Array.isArray(cache?.data?.hourly);
      const freshEnough =
        !force &&
        hasHourly &&
        cache?.data?.locId === loc.id &&
        typeof cache.fetchedAt === 'number' &&
        Date.now() - cache.fetchedAt < CACHE_MS;

      if (freshEnough) {
        setData(cache.data);
        setStatus('ok');
        setErrorMsg(null);
        return;
      }

      if (cache?.data?.locId === loc.id) {
        setData(cache.data);
        setStatus('stale');
      } else {
        setStatus('loading');
      }

      try {
        const res = await fetch(buildUrl(loc));
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (json.error) throw new Error(json.reason || 'Weather API error');
        const parsed = parseWeather(json, loc);
        saveCache({ fetchedAt: parsed.fetchedAt, data: parsed });
        setData(parsed);
        setStatus('ok');
        setErrorMsg(null);
      } catch {
        if (cache?.data) {
          setData(cache.data);
          setStatus('stale');
          setErrorMsg('Offline — showing last brief');
        } else {
          setStatus('offline');
          setErrorMsg('Weather offline');
        }
      }
    },
    [loc],
  );

  useEffect(() => {
    fetchWeather({ force: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loc.id]);

  const morningBrief = typeof nyHour === 'number' && nyHour < 12;

  const metaLine = useMemo(() => {
    if (!data) return null;
    return `${data.locLabel} ${data.temp}° · ${data.dressShort}`;
  }, [data]);

  return {
    loc,
    locId,
    setLocId,
    locations: WEATHER_LOCS,
    data,
    status,
    errorMsg,
    morningBrief,
    metaLine,
    refresh: () => fetchWeather({ force: true }),
  };
}
