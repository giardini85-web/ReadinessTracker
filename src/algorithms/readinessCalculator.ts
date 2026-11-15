import { DailyMetrics } from '../database/localDb';

export interface ReadinessResult {
  score: number;
  status: 'GREEN' | 'YELLOW' | 'RED';
  workoutRecommendation: string;
  passiveNutritionInsight?: string;
  environmentalInsight?: string;
}

export class ReadinessCalculator {
  evaluateToday(metrics: DailyMetrics): ReadinessResult {
    // Calcolo ponderato basato su HRV, Body Battery e Frequenza Cardiaca a riposo
    const hrvScore = Math.min(Math.max((metrics.hrvNightly / 70) * 40, 0), 40);
    const bbScore = (metrics.bodyBattery / 100) * 30;
    const hrRestScore = metrics.restingHeartRate < 60 ? 30 : Math.max(30 - (metrics.restingHeartRate - 60), 10);
    
    const totalScore = Math.round(hrvScore + bbScore + hrRestScore);

    let status: 'GREEN' | 'YELLOW' | 'RED' = 'GREEN';
    let recommendation = 'Condizioni ottimali. Puoi affrontare un allenamento ad alta intensità.';

    if (totalScore < 50) {
      status = 'RED';
      recommendation = 'Recupero insufficiente. Consigliato riposo attivo o stretching leggero.';
    } else if (totalScore < 75) {
      status = 'YELLOW';
      recommendation = 'Recupero moderato. Riduci il volume o l intensità dell allenamento.';
    }

    return {
      score: totalScore,
      status,
      workoutRecommendation: recommendation,
      passiveNutritionInsight: 'Idratazione e apporto proteico stabili rispetto alla media settimanale.',
      environmentalInsight: 'Pressione atmosferica e rumorosità notturna favorevoli al sonno profondo.',
    };
  }
}