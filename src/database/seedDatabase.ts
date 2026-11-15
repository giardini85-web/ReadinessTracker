import { saveDailyMetrics, getRecentMetrics } from './localDb';

export function seedDatabaseIfEmpty() {
  const existing = getRecentMetrics(1);
  if (existing.length > 0) return;

  const today = new Date();
  for (let i = 13; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];

    saveDailyMetrics({
      date: dateStr,
      readinessScore: 70 + (i % 15),
      hrvNightly: 55 + (i % 10),
      restingHeartRate: 52 + (i % 5),
      bodyBattery: 75 + (i % 20),
      stepCount: 8000 + (i * 250),
      weight: 74.5 - (i * 0.05),
      bodyFatPercentage: 16.2,
      waterPercentage: 58.0,
      muscleMass: 59.1,
      visceralFat: 6,
      bmr: 1750,
      neuromuscularJumpScore: 82,
    });
  }
}