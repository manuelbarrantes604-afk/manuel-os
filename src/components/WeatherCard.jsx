import { WEATHER_LOCS } from '../hooks/useWeather';

export default function WeatherCard({
  locId,
  setLocId,
  data,
  status,
  errorMsg,
  morningBrief,
  refresh,
}) {
  return (
    <section className="period-card weather-card" aria-label="Weather brief">
      <div className="period-head weather-head">
        <div>
          <h2>
            Weather
            {morningBrief ? (
              <span className="now-badge morning-brief-badge">Morning brief</span>
            ) : null}
          </h2>
          <p className="coach-line">Open-Meteo · local brief</p>
        </div>
        <div className="weather-actions">
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
          <button
            type="button"
            className="weather-refresh"
            onClick={refresh}
            disabled={status === 'loading'}
          >
            Refresh
          </button>
        </div>
      </div>

      {!data && (status === 'loading' || status === 'idle') && (
        <p className="weather-body muted">Loading brief…</p>
      )}

      {!data && status === 'offline' && (
        <p className="weather-body muted">{errorMsg || 'Weather offline'}</p>
      )}

      {data && (
        <div className="weather-body">
          <p className="weather-line">
            <strong>
              {data.locLabel} · {data.temp}°F
            </strong>
            <span>
              {' '}
              · feels {data.apparent}° / High {data.high} / Low {data.low}
            </span>
          </p>
          <p className="weather-line soft">
            {data.precip} · {data.wind} mph
          </p>
          <p className="weather-dress">{data.dressLine}</p>
          {(status === 'stale' || errorMsg) && (
            <p className="weather-stale">
              {errorMsg || 'Stale — last cached brief'}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
