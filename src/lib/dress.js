/** Dress brief from apparent °F + precip/wind. Short, actionable. */

export function precipLabel(code, precipProb, rain, snow) {
  const c = Number(code) || 0;
  const snowy =
    snow > 0 || (c >= 71 && c <= 77) || (c >= 85 && c <= 86);
  const rainy =
    rain > 0 ||
    (c >= 51 && c <= 67) ||
    (c >= 80 && c <= 82) ||
    (c >= 95 && c <= 99);
  const kind = snowy ? 'snow' : rainy ? 'rain' : precipProb >= 40 ? 'rain' : null;
  if (!kind) {
    if (precipProb > 0) return `${precipProb}% precip`;
    return '0% precip';
  }
  return `${precipProb ?? 0}% ${kind}`;
}

/**
 * @param {{ apparent: number, precipProb: number, weatherCode: number, windMph: number, rain?: number, snow?: number }} w
 * @returns {{ line: string, short: string }}
 */
export function dressBrief(w) {
  const feels = Number(w.apparent);
  const wind = Number(w.windMph) || 0;
  const prob = Number(w.precipProb) || 0;
  const code = Number(w.weatherCode) || 0;
  const rain = Number(w.rain) || 0;
  const snow = Number(w.snow) || 0;

  let base;
  let short;
  if (!Number.isFinite(feels)) {
    return { line: 'Dress: check conditions', short: '—' };
  }
  if (feels <= 25) {
    base = 'heavy coat, layers, gloves';
    short = 'heavy coat';
  } else if (feels <= 35) {
    base = 'winter coat + layers';
    short = 'winter coat';
  } else if (feels <= 45) {
    base = 'heavy jacket or hoodie + pants';
    short = 'heavy jacket';
  } else if (feels <= 55) {
    base = 'hoodie or light jacket';
    short = 'hoodie';
  } else if (feels <= 65) {
    base = 'light layer / long sleeve';
    short = 'light layer';
  } else if (feels <= 75) {
    base = 't-shirt is fine';
    short = 't-shirt';
  } else {
    base = 'light clothes; shorts OK';
    short = 'light';
  }

  const extras = [];
  const snowy =
    snow > 0 || (code >= 71 && code <= 77) || (code >= 85 && code <= 86);
  const rainy =
    rain > 0 ||
    (code >= 51 && code <= 67) ||
    (code >= 80 && code <= 82) ||
    (code >= 95 && code <= 99) ||
    (!snowy && prob >= 40);

  if (snowy) {
    extras.push('waterproof boots');
    if (feels <= 45) extras.push('warm hat');
  } else if (rainy || prob >= 50) {
    extras.push(prob >= 60 ? 'rain jacket + umbrella' : 'pack rain layer');
  }

  if (wind >= 20 && feels <= 55) {
    extras.push('windproof shell');
  } else if (wind >= 15 && feels <= 50) {
    extras.push('block the wind');
  }

  const line = extras.length
    ? `Dress: ${base}; ${extras.join('; ')}`
    : `Dress: ${base}`;
  return { line, short };
}
