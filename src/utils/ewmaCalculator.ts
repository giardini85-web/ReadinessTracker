export interface WeighInRecord {
  date: string;
  weight: number;
}

export interface SmoothedWeightPoint {
  date: string;
  rawWeight: number;
  smoothedWeight: number;
}

export interface CompositionVelocityReport {
  statusLabel: string;
  points: SmoothedWeightPoint[];
}

export class EwmaCalculator {
  /**
   * Calcola il trend EWMA ricorsivo (Alpha = 0.2 di default per filtrare i fluttuamenti idrici)
   */
  computeSmoothedTrend(weighIns: WeighInRecord[], recentMetrics: any[]): CompositionVelocityReport {
    if (!weighIns || weighIns.length === 0) {
      return {
        statusLabel: 'Nessun dato storico sufficiente per il trend EWMA',
        points: [],
      };
    }

    // Ordina i dati cronologicamente dal più vecchio al più recente
    const sorted = [...weighIns].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const alpha = 0.2;
    let previousEvma = sorted[0].weight;
    const points: SmoothedWeightPoint[] = [];

    sorted.forEach((item, index) => {
      const raw = item.weight;
      let smoothed = 0;

      if (index === 0) {
        smoothed = raw;
      } else {
        smoothed = alpha * raw + (1 - alpha) * previousEvma;
      }

      previousEvma = smoothed;

      points.push({
        date: item.date,
        rawWeight: Math.round(raw * 10) / 10,
        smoothedWeight: Math.round(smoothed * 10) / 10,
      });
    });

    const lastPoint = points[points.length - 1];
    const firstPoint = points[0];
    const diff = Math.round((lastPoint.smoothedWeight - firstPoint.smoothedWeight) * 10) / 10;
    
    let statusLabel = `Trend stabile (${lastPoint.smoothedWeight} kg)`;
    if (diff < -0.5) statusLabel = `In calo di ${Math.abs(diff)} kg nel periodo`;
    if (diff > 0.5) statusLabel = `In aumento di ${diff} kg nel periodo`;

    return {
      statusLabel,
      points,
    };
  }
}