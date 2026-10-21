import type { WeatherData, ForecastDay, TravelRisk } from '@/types';

export async function getWeather(lat: number, lon: number): Promise<WeatherData> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,precipitation,precipitation_probability,weather_code,wind_speed_10m,is_day&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code&timezone=auto&forecast_days=5`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`Weather API returned ${res.status}`);
    const json = await res.json();

    const current = json.current;
    const daily = json.daily;

    const forecast: ForecastDay[] = [];
    if (daily && Array.isArray(daily.time)) {
      for (let i = 0; i < daily.time.length; i++) {
        forecast.push({
          date: daily.time[i],
          tempMax: daily.temperature_2m_max[i],
          tempMin: daily.temperature_2m_min[i],
          precipitationMax: daily.precipitation_sum[i],
          weatherCode: daily.weather_code[i],
        });
      }
    }

    return {
      temperature: current.temperature_2m,
      windspeed: current.wind_speed_10m,
      precipitation: current.precipitation,
      precipitation_probability: current.precipitation_probability ?? 0,
      weatherCode: current.weather_code,
      isDay: current.is_day === 1,
      timestamp: new Date().toISOString(),
      source: 'Open-Meteo',
      forecast,
    };
  } finally {
    clearTimeout(timeout);
  }
}

export function computeTravelRisk(
  weather: WeatherData | null,
  nearbyOpenCount: number
): TravelRisk {
  const factors: string[] = [];
  let score = 0;

  if (weather) {
    if (weather.precipitation > 5 || weather.precipitation_probability > 70) {
      score += 30;
      factors.push(
        `Heavy precipitation (${weather.precipitation.toFixed(1)}mm, ${weather.precipitation_probability}% probability)`
      );
    } else if (weather.precipitation > 1 || weather.precipitation_probability > 40) {
      score += 15;
      factors.push(
        `Light precipitation (${weather.precipitation.toFixed(1)}mm, ${weather.precipitation_probability}% probability)`
      );
    }
    if ([95, 96, 99].includes(weather.weatherCode)) {
      score += 25;
      factors.push('Thunderstorm conditions detected');
    }
    if (weather.windspeed > 35) {
      score += 15;
      factors.push(`High winds (${weather.windspeed.toFixed(0)} km/h)`);
    }
    if ([45, 48].includes(weather.weatherCode)) {
      score += 10;
      factors.push('Fog conditions — reduced visibility');
    }
  }

  if (nearbyOpenCount >= 3) {
    score += 25;
    factors.push(`${nearbyOpenCount} open hazards reported nearby`);
  } else if (nearbyOpenCount >= 1) {
    score += 10;
    factors.push(`${nearbyOpenCount} open hazard(s) reported nearby`);
  }

  const level: TravelRisk['level'] =
    score >= 55 ? 'Severe' : score >= 35 ? 'High' : score >= 15 ? 'Moderate' : 'Low';

  if (factors.length === 0) factors.push('No significant risk factors detected');

  return { level, score: Math.min(score, 100), factors };
}

export function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
