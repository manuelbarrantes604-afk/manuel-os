import { useState } from 'react';
import { WEATHER_LOCS } from '../hooks/useWeather';

function formatHour(hour) {
  if (hour === 0) return '12 AM';
  if (hour === 12) return '12 PM';
  if (hour < 12) return `${hour} AM`;
  return `${hour - 12} PM`;
}

export default function WeatherCard({
  locId,
  setLocId,
  data,
  status,
  errorMsg,
  morningBrief,
  refresh,
}) {
  const [expanded, setExpanded] = useState(false);

  const rainLine = data
    ? data.willRain
      ? `Yes · ${data.precipProb}%${data.precipKind ? ` ${data.precipKind}` : ''}`
      : data.precipKind === 'snow'
        ? `Snow · ${data.precipProb}%`
        : `No · ${data.precipProb}%`
    : null;

  return (
    <section className="period-card weather-card weather-ios" aria-label="Weather">
      <div className="weather-top">
        <div className="weather-top-left">
          <label className="weather-loc-label" htmlFor="weather-loc">
            <span className="sr-only">Location</span>
            <select
              id="weather-loc"
              className="weather-loc"
              value={locId}
              onChange={(e) => setLocId(e.target.value)}
              aria-label="Weather location"
            >
              {WEATHER_LOCS.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label}
                </option>
              ))}
            </select>
          </label>
          {morningBrief ? (
            <span className="now-badge morning-brief-badge">Morning brief</span>
          ) : null}
        </div>
        <button
          type="button"
          className="weather-refresh"
          onClick={refresh}
          disabled={status === 'loading'}
        >
          Refresh
        </button>
      </div>

      {!data && (status === 'loading' || status === 'idle') && (
        <p className="weather-body muted">Loading…</p>
      )}

      {!data && status === 'offline' && (
        <p className="weather-body muted">{errorMsg || 'Weather offline'}</p>
      )}

      {data && (
        <>
          <div className="weather-compact">
            <div className="weather-temp-block">
              <span className="weather-temp" aria-label={`${data.temp} degrees`}>
                {data.temp}°
              </span>
              <span className="weather-condition">
                {data.icon} {data.condition}
              </span>
            </div>
            <div className="weather-facts">
              <p className="weather-rain">
                <span className="weather-fact-label">Rain today?</span>{' '}
                <strong>{rainLine}</strong>
              </p>
              <p className="weather-hl">
                H {data.high}° · L {data.low}°
              </p>
              <p className="weather-dress">{data.dressLine}</p>
            </div>
          </div>

          {(status === 'stale' || errorMsg) && (
            <p className="weather-stale">
              {errorMsg || 'Stale — last cached brief'}
            </p>
          )}

          {Array.isArray(data.hourly) && data.hourly.length > 0 && (
            <div className="weather-hourly-wrap">
              <button
                type="button"
                className="weather-expand"
                aria-expanded={expanded}
                onClick={() => setExpanded((v) => !v)}
              >
                <span>{expanded ? 'Hide hourly' : 'Hourly forecast'}</span>
                <span className="weather-chevron" aria-hidden="true">
                  {expanded ? '▴' : '▾'}
                </span>
              </button>
              {expanded && (
                <ul className="weather-hourly" aria-label="Hourly forecast">
                  {data.hourly.map((h) => (
                    <li key={h.time} className="weather-hour-row">
                      <span className="wh-time">{formatHour(h.hour)}</span>
                      <span className="wh-icon" title={h.condition}>
                        {h.icon}
                      </span>
                      <span className="wh-temp mono">{h.temp}°</span>
                      <span className="wh-precip">
                        {h.precipProb}%
                        {h.snow > 0 ? ' snow' : h.rain > 0 || h.precipProb >= 40 ? ' rain' : ''}
                      </span>
                      <span className="wh-cond">{h.condition}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
