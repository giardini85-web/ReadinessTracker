import { openDatabaseSync } from 'expo-sqlite';

const db = openDatabaseSync('readiness_tracker.db');

export interface DailyMetrics {
  date: string;
  readinessScore: number;
  hrvNightly: number;
  restingHeartRate: number;
  bodyBattery: number;
  stepCount: number;
  weight: number | null;
  bodyFatPercentage: number | null;
  waterPercentage: number | null;
  muscleMass: number | null;
  visceralFat: number | null;
  bmr: number | null;
  neuromuscularJumpScore?: number;
}
export interface UserBioProfile { heightCm: number; age: number; sex: 'MALE' | 'FEMALE'; }
export interface UserFeedbackLog { triggerType: string; userResponse: 'YES' | 'NO' | 'MAYBE'; }

export function initDatabase() {
  db.execSync(`
    CREATE TABLE IF NOT EXISTS daily_metrics (
      date TEXT PRIMARY KEY,
      readinessScore INTEGER,
      hrvNightly REAL,
      restingHeartRate REAL,
      bodyBattery INTEGER,
      stepCount INTEGER,
      weight REAL,
      bodyFatPercentage REAL,
      waterPercentage REAL,
      muscleMass REAL,
      visceralFat REAL,
      bmr REAL,
      neuromuscularJumpScore REAL
    );
    CREATE TABLE IF NOT EXISTS user_profile (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      heightCm REAL,
      age INTEGER,
      sex TEXT
    );
  `);
}

export function saveDailyMetrics(m: DailyMetrics) {
  db.runSync(
    `INSERT OR REPLACE INTO daily_metrics (
      date, readinessScore, hrvNightly, restingHeartRate, bodyBattery, stepCount,
      weight, bodyFatPercentage, waterPercentage, muscleMass, visceralFat, bmr, neuromuscularJumpScore
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      m.date, m.readinessScore, m.hrvNightly, m.restingHeartRate, m.bodyBattery, m.stepCount,
      m.weight, m.bodyFatPercentage, m.waterPercentage, m.muscleMass, m.visceralFat, m.bmr,
      m.neuromuscularJumpScore ?? null
    ]
  );
}

export function getRecentMetrics(limit: number = 30): DailyMetrics[] {
  return db.getAllSync(
    `SELECT * FROM daily_metrics ORDER BY date DESC LIMIT ?`,
    [limit]
  ) as DailyMetrics[];
}

export function getWeighInHistory(limit: number = 30) {
  return getRecentMetrics(limit).filter(m => m.weight !== null);
}

export function getUserProfile(): UserBioProfile {
  const res = db.getFirstSync(`SELECT * FROM user_profile WHERE id = 1`) as any;
  if (!res) return { heightCm: 178, age: 34, sex: 'MALE' };
  return { heightCm: res.heightCm, age: res.age, sex: res.sex };
}

export function saveUserProfile(p: UserBioProfile) {
  db.runSync(
    `INSERT OR REPLACE INTO user_profile (id, heightCm, age, sex) VALUES (1, ?, ?, ?)`,
    [p.heightCm, p.age, p.sex]
  );
}

export function clearAllDatabaseData() {
  db.execSync(`DELETE FROM daily_metrics;`);
}