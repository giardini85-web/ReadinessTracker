import { DailyMetrics } from '../database/localDb';

export class SyncManager {
  async syncAllForToday(acousticReport?: { peakDecibelSpl: number }): Promise<DailyMetrics> {
    const todayStr = new Date().toISOString().split('T')[0];
    
    // Ritorna metriche sincronizzate dai sensori simulati o nativi di test
    return {
      date: todayStr,
      readinessScore: 85,
      hrvNightly: 68,
      restingHeartRate: 51,
      bodyBattery: 88,
      stepCount: 4200,
      weight: 73.8,
      bodyFatPercentage: 16.0,
      waterPercentage: 58.5,
      muscleMass: 59.4,
      visceralFat: 6,
      bmr: 1760,
      neuromuscularJumpScore: 85,
    };
  }

  async triggerLivePicoocWeighIn() {
    // Simula lettura BLE PICOOC Mini
    return {
      weight: 73.7,
      bodyFatPercentage: 15.9,
      waterPercentage: 58.6,
      muscleMass: 59.5,
      visceralFat: 6,
      bmr: 1765,
    };
  }
}