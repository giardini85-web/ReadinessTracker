import { DailyMetrics } from '../database/localDb';

export class SyncManager {
  async syncAllForToday(): Promise<DailyMetrics> {
    const todayStr = new Date().toISOString().split('T')[0];

    // Durante la fase di trial/debug, se non ci sono dati reali, 
    // forniamo un fallback iniziale coerente per testare la Readiness (es. 73.5 kg, HRV 55)
    return {
      date: todayStr,
      readinessScore: 78,
      hrvNightly: 55,
      restingHeartRate: 54,
      bodyBattery: 70,
      stepCount: 2400,
      weight: 73.5,
      bodyFatPercentage: 15.2,
      waterPercentage: 60.1,
      muscleMass: 59.5,
      visceralFat: 5,
      bmr: 1750,
    };
  }

  async triggerLivePicoocWeighIn(): Promise<{
    weight: number;
    bodyFatPercentage: number;
    waterPercentage: number;
    muscleMass: number;
    visceralFat: number;
    bmr: number;
  }> {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          weight: 73.2, // Simuliamo un leggero calo di peso reale
          bodyFatPercentage: 15.0,
          waterPercentage: 60.5,
          muscleMass: 60.0,
          visceralFat: 5,
          bmr: 1760,
        });
      }, 1000);
    });
  }
}