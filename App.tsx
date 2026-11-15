import React, { useEffect, useState, useRef } from 'react';
import { SafeAreaView, View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet, StatusBar } from 'react-native';

import { initDatabase, saveDailyMetrics, getRecentMetrics, getWeighInHistory, DailyMetrics } from './src/database/localDb';
import { seedDatabaseIfEmpty } from './src/database/seedDatabase';
import { SyncManager } from './src/services/syncManager';
import { ReadinessCalculator, ReadinessResult } from './src/algorithms/readinessCalculator';
import { EwmaCalculator, CompositionVelocityReport } from './src/utils/ewmaCalculator';

type ActiveTab = 'READINESS' | 'TRENDS' | 'SLEEP_ALARM';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('READINESS');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [statusBanner, setStatusBanner] = useState<string>('Inizializzazione sistema...');

  const [todayMetrics, setTodayMetrics] = useState<DailyMetrics | null>(null);
  const [readiness, setReadiness] = useState<ReadinessResult | null>(null);
  const [velocityReport, setVelocityReport] = useState<CompositionVelocityReport | null>(null);
  const [isScanningPicooc, setIsScanningPicooc] = useState<boolean>(false);

  const syncManagerRef = useRef(new SyncManager());
  const readinessCalcRef = useRef(new ReadinessCalculator());
  const ewmaCalcRef = useRef(new EwmaCalculator());

  useEffect(() => {
    bootstrapApp();
  }, []);

  const bootstrapApp = async () => {
    try {
      setIsLoading(true);
      // Inizializzazione e seed protetti nel blocco try/catch
      initDatabase();
      seedDatabaseIfEmpty();

      const synced = await syncManagerRef.current.syncAllForToday();
      const evaluated = readinessCalcRef.current.evaluateToday(synced);
      synced.readinessScore = evaluated.score;
      saveDailyMetrics(synced);
      setTodayMetrics(synced);
      setReadiness(evaluated);
      refreshTrendsAndReminders();
      setStatusBanner('Sincronizzato con Apple Health, PICOOC e SQLite locale');
    } catch (err) {
      setStatusBanner(`Errore: ${String(err)}`);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshTrendsAndReminders = () => {
    const weighIns = getWeighInHistory(30);
    const recentMetrics = getRecentMetrics(30);
    setVelocityReport(ewmaCalcRef.current.computeSmoothedTrend(weighIns, recentMetrics));
  };

  const handleScanPicoocBle = async () => {
    if (isScanningPicooc) return;
    try {
      setIsScanningPicooc(true);
      setStatusBanner('Scansione BLE in corso... Sali sulla bilancia.');
      const reading = await syncManagerRef.current.triggerLivePicoocWeighIn();
      if (todayMetrics) {
        const updated = { 
          ...todayMetrics, 
          weight: reading.weight, 
          bodyFatPercentage: reading.bodyFatPercentage, 
          waterPercentage: reading.waterPercentage, 
          muscleMass: reading.muscleMass, 
          visceralFat: reading.visceralFat, 
          bmr: reading.bmr 
        };
        const reEvaluated = readinessCalcRef.current.evaluateToday(updated);
        updated.readinessScore = reEvaluated.score;
        saveDailyMetrics(updated);
        setTodayMetrics(updated);
        setReadiness(reEvaluated);
      }
      refreshTrendsAndReminders();
      setStatusBanner(`Pesata PICOOC salvata: ${reading.weight} kg`);
    } catch (err) {
      setStatusBanner(String(err));
    } finally {
      setIsScanningPicooc(false);
    }
  };

  const getSemaphoreColor = (status?: 'GREEN' | 'YELLOW' | 'RED') => {
    if (status === 'RED') return '#EF4444';
    if (status === 'YELLOW') return '#F59E0B';
    return '#10B981';
  };

  const renderReadinessTab = () => {
    if (!todayMetrics || !readiness) return null;
    const themeColor = getSemaphoreColor(readiness.status);
    return (
      <View>
        <View style={styles.heroCard}>
          <View style={[styles.scoreCircle, { borderColor: themeColor }]}>
            <Text style={[styles.scoreValue, { color: themeColor }]}>{readiness.score}</Text>
            <Text style={styles.scoreSubLabel}>READINESS</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: themeColor + '22' }]}>
            <View style={[styles.statusDot, { backgroundColor: themeColor }]} />
            <Text style={[styles.statusBadgeText, { color: themeColor }]}>
              SEMAFORO {readiness.status === 'GREEN' ? 'VERDE' : readiness.status === 'YELLOW' ? 'GIALLO' : 'ROSSO'}
            </Text>
          </View>
          <Text style={styles.recommendationText}>{readiness.workoutRecommendation}</Text>
        </View>

        <Text style={styles.sectionHeader}>PARAMETRI BIOMETRICI OGGI</Text>
        <View style={styles.metricsGrid}>
          <View style={styles.metricTile}><Text style={styles.metricLabel}>HRV Notturna</Text><Text style={styles.metricValue}>{todayMetrics.hrvNightly} ms</Text></View>
          <View style={styles.metricTile}><Text style={styles.metricLabel}>FC Riposo</Text><Text style={styles.metricValue}>{todayMetrics.restingHeartRate} bpm</Text></View>
          <View style={styles.metricTile}><Text style={styles.metricLabel}>Body Battery</Text><Text style={styles.metricValue}>{todayMetrics.bodyBattery}%</Text></View>
          <View style={styles.metricTile}><Text style={styles.metricLabel}>Movimento</Text><Text style={styles.metricValue}>{todayMetrics.stepCount} passi</Text></View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />
      <View style={styles.topHeader}>
        <View style={{ flex: 1 }}><Text style={styles.appTitle}>READINESS & HEALTH</Text><Text style={styles.statusSub} numberOfLines={1}>{statusBanner}</Text></View>
        <TouchableOpacity style={styles.syncButton} onPress={bootstrapApp}><Text style={styles.syncButtonText}>Sync</Text></TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.loaderContainer}><ActivityIndicator size="large" color="#38BDF8" /><Text style={styles.loaderText}>Caricamento...</Text></View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {activeTab === 'READINESS' && renderReadinessTab()}
          {activeTab === 'TRENDS' && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Composizione Corporea</Text>
              <Text style={styles.cardSubtitle}>{velocityReport?.statusLabel}</Text>
              <TouchableOpacity style={styles.primaryButton} onPress={handleScanPicoocBle} disabled={isScanningPicooc}>
                <Text style={styles.primaryButtonText}>{isScanningPicooc ? 'Scansione in corso...' : 'Pesata PICOOC Live'}</Text>
              </TouchableOpacity>
            </View>
          )}
          {activeTab === 'SLEEP_ALARM' && <View style={styles.card}><Text style={styles.cardTitle}>Sveglia & Sonno</Text><Text style={styles.cardSubtitle}>Monitoraggio attivo.</Text></View>}
        </ScrollView>
      )}

      <View style={styles.bottomTabBar}>
        <TouchableOpacity style={[styles.tabButton, activeTab === 'READINESS' && styles.tabButtonActive]} onPress={() => setActiveTab('READINESS')}><Text style={[styles.tabText, activeTab === 'READINESS' && styles.tabTextActive]}>Readiness</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.tabButton, activeTab === 'TRENDS' && styles.tabButtonActive]} onPress={() => setActiveTab('TRENDS')}><Text style={[styles.tabText, activeTab === 'TRENDS' && styles.tabTextActive]}>Trend PICOOC</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.tabButton, activeTab === 'SLEEP_ALARM' && styles.tabButtonActive]} onPress={() => setActiveTab('SLEEP_ALARM')}><Text style={[styles.tabText, activeTab === 'SLEEP_ALARM' && styles.tabTextActive]}>Sveglia</Text></TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0B0F19' },
  topHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1E293B' },
  appTitle: { color: '#F8FAFC', fontSize: 16, fontWeight: '800' },
  statusSub: { color: '#94A3B8', fontSize: 11, marginTop: 2 },
  syncButton: { backgroundColor: '#1E293B', paddingHorizontal: 13, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: '#38BDF8' },
  syncButtonText: { color: '#38BDF8', fontSize: 12, fontWeight: '700' },
  loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loaderText: { color: '#94A3B8', marginTop: 12, fontSize: 13 },
  scrollContent: { padding: 16 },
  heroCard: { backgroundColor: '#111827', borderRadius: 16, padding: 20, alignItems: 'center', borderWidth: 1, borderColor: '#1E293B', marginBottom: 14 },
  scoreCircle: { width: 128, height: 128, borderRadius: 64, borderWidth: 8, justifyContent: 'center', alignItems: 'center', marginBottom: 14 },
  scoreValue: { fontSize: 42, fontWeight: '900' },
  scoreSubLabel: { color: '#94A3B8', fontSize: 10, fontWeight: '700', letterSpacing: 1.2 },
  statusBadge: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, marginBottom: 10 },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6, marginTop: 3 },
  statusBadgeText: { fontSize: 12, fontWeight: '800' },
  recommendationText: { color: '#E2E8F0', fontSize: 14, textAlign: 'center' },
  sectionHeader: { color: '#94A3B8', fontSize: 11, fontWeight: '800', marginBottom: 10, marginTop: 4 },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  metricTile: { width: '48.5%', backgroundColor: '#111827', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#1E293B', marginBottom: 10 },
  metricLabel: { color: '#94A3B8', fontSize: 11, fontWeight: '600' },
  metricValue: { color: '#F8FAFC', fontSize: 17, fontWeight: '800', marginVertical: 4 },
  card: { backgroundColor: '#111827', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#1E293B', marginBottom: 14 },
  cardTitle: { color: '#F8FAFC', fontSize: 15, fontWeight: '800' },
  cardSubtitle: { color: '#94A3B8', fontSize: 12, marginTop: 4 },
  primaryButton: { backgroundColor: '#2563EB', paddingVertical: 12, borderRadius: 10, alignItems: 'center', marginTop: 14 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  bottomTabBar: { flexDirection: 'row', backgroundColor: '#111827', borderTopWidth: 1, borderTopColor: '#1E293B', paddingVertical: 10, paddingHorizontal: 12 },
  tabButton: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  tabButtonActive: { backgroundColor: '#1E293B' },
  tabText: { color: '#64748B', fontSize: 12, fontWeight: '700' },
  tabTextActive: { color: '#38BDF8' }
});