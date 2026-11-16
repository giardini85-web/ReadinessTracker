import { DailyMetrics } from '../database/localDb';

export class SyncManager {
  /**
   * Sincronizza i dati odierni. 
   * Cerca di recuperare i dati reali (es. Apple Health / Garmin / PICOOC).
   * Se un dato non è disponibile per oggi, restituisce '--' o un valore neutro di fallback.
   */
  async syncAllForToday(): Promise<DailyMetrics> {
    const todayStr = new Date().toISOString().split('T')[0];

    // TODO: Qui integreremo la chiamata nativa a HealthKit per Garmin e Apple Health.
    // Per adesso, simuliamo il comportamento di un giorno in cui alcuni dati reali mancano o devono essere '--'.
    
    const realDataAvailable = false; // Diventerà true quando HealthKit restituisce dati validi

    if (realDataAvailable) {
      // Esempio di struttura con dati reali presi da Apple Salute
      return {
        date: todayStr,
        readinessScore: 85,
        hrvNightly: 62, // Dato reale Garmin/Apple Health
        restingHeartRate: 52,
        bodyBattery: 78,
        stepCount: 1250,
        weight: 73.8, // Ultimo peso registrato
        bodyFatPercentage: 15.2,
        waterPercentage: 60.1,
        muscleMass: 59.5,
        visceralFat: 5,
        bmr: 1750,
      };
    } else {
      // Nessun dato reale sincronizzato oggi: restituisce valori vuoti '--' o null dove richiesto
      return {
        date: todayStr,
        readinessScore: 0,
        hrvNightly: 0,          // Verrà formattato come '--' se 0 o null
        restingHeartRate: 0,
        bodyBattery: 0,
        stepCount: 0,
        weight: null,           // Mostrerà '-- kg'
        bodyFatPercentage: null,
        waterPercentage: null,
        muscleMass: null,
        visceralFat: null,
        bmr: null,
      };
    }
  }

  /**
   * Simula una pesata live Bluetooth dalla bilancia PICOOC
   */
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
          weight: 73.5,
          bodyFatPercentage: 15.0,
          waterPercentage: 60.5,
          muscleMass: 60.0,
          visceralFat: 5,
          bmr: 1760,
        });
      }, 1500);
    });
  }
}