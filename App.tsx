import React, { useEffect, useState, useRef } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  StatusBar,
  Modal,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';

import {
  initDatabase,
  saveDailyMetrics,
  getRecentMetrics,
  getWeighInHistory,
  getUserProfile,
  saveUserProfile,
  clearAllDatabaseData,
  DailyMetrics,
  UserBioProfile,
} from './src/database/localDb';
import { seedDatabaseIfEmpty } from './src/database/seedDatabase';
import { SyncManager } from './src/services/syncManager';
import { ReadinessCalculator, ReadinessResult } from './src/algorithms/readinessCalculator';
import { EwmaCalculator, CompositionVelocityReport, SmoothedWeightPoint } from './src/utils/ewmaCalculator';

type ActiveTab = 'READINESS' | 'TRENDS' | 'SLEEP_ALARM';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('READINESS');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [statusBanner, setStatusBanner] = useState<string>('Pronto per la sincronizzazione');

  const [todayMetrics, setTodayMetrics] = useState<DailyMetrics | null>(null);
  const [readiness, setReadiness] = useState<ReadinessResult | null>(null);
  const [velocityReport, setVelocityReport] = useState<CompositionVelocityReport | null>(null);
  const [selectedChartPoint, setSelectedChartPoint] = useState<SmoothedWeightPoint | null>(null);

  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [heightInput, setHeightInput] = useState<string>('178');
  const [ageInput, setAgeInput] = useState<string>('34');
  const [sexInput, setSexInput] = useState<'MALE' | 'FEMALE'>('MALE');

  const [isScanningPicooc, setIsScanningPicooc] = useState<boolean>(false);
  const [isNightMonitoring, setIsNightMonitoring] = useState<boolean>(false);

  const syncManagerRef = useRef(new SyncManager());
  const readinessCalcRef = useRef(new ReadinessCalculator());
  const ewmaCalcRef = useRef(new EwmaCalculator());

  useEffect(() => {
    initDatabase();
    seedDatabaseIfEmpty();
    loadUserProfileIntoForm();
    bootstrapApp();
  }, []);

  const loadUserProfileIntoForm = () => {
    const profile = getUserProfile();
    setHeightInput(String(profile.heightCm));
    setAgeInput(String(profile.age));
    setSexInput(profile.sex);
  };

  const bootstrapApp = async () => {
    try {
      setIsLoading(true);
      const synced = await syncManagerRef.current.syncAllForToday();
      const evaluated = readinessCalcRef.current.evaluateToday(synced);
      
      saveDailyMetrics(synced);
      setTodayMetrics(synced);
      setReadiness(evaluated);
      refreshTrends();
      setStatusBanner('Sincronizzazione completata (Apple Salute / Locale)');
    } catch (err) {
      setStatusBanner(`Errore Sync: ${String(err)}`);
      refreshTrends();
    } finally {
      setIsLoading(false);
    }
  };

  const refreshTrends = () => {
    const weighIns = getWeighInHistory(30);
    const recentMetrics = getRecentMetrics(30);
    const report = ewmaCalcRef.current.computeSmoothedTrend(weighIns, recentMetrics);
    setVelocityReport(report);
    if (report.points.length > 0) {
      setSelectedChartPoint(report.points[report.points.length - 1]);
    }
  };

  const handleSaveBioProfile = () => {
    const parsedHeight = parseFloat(heightInput.replace(',', '.'));
    const parsedAge = parseInt(ageInput, 10);

    if (isNaN(parsedHeight) || parsedHeight < 100 || parsedHeight > 240) {
      Alert.alert('Valore non valido', 'Altezza tra 100 e 240 cm.');
      return;
    }
    if (isNaN(parsedAge) || parsedAge < 12 || parsedAge > 110) {
      Alert.alert('Valore non valido', 'Età tra 12 e 110 anni.');
      return;
    }

    const updatedProfile: UserBioProfile = {
      heightCm: Math.round(parsedHeight * 10) / 10,
      age: parsedAge,
      sex: sexInput,
    };

    saveUserProfile(updatedProfile);
    setIsSettingsOpen(false);
    setStatusBanner(`Profilo aggiornato: ${updatedProfile.heightCm}cm`);
  };

  const handleReseedDemoData = async () => {
    clearAllDatabaseData();
    seedDatabaseIfEmpty();
    setIsSettingsOpen(false);
    await bootstrapApp();
    setStatusBanner('Dati storici demo ripristinati.');
  };

  const handleConfirmResetDatabase = () => {
    Alert.alert('Svuota Database', 'Cancellare tutti i dati storici?', [
      { text: 'Annulla', style: 'cancel' },
      {
        text: 'Svuota',
        style: 'destructive',
        onPress: async () => {
          clearAllDatabaseData();
          setIsSettingsOpen(false);
          await bootstrapApp();
          setStatusBanner('Database azzerato.');
        },
      },
    ]);
  };

  const handleScanPicoocBle = async () => {
    if (isScanningPicooc) return;
    try {
      setIsScanningPicooc(true);
      setStatusBanner('Lettura dati PICOOC / Apple Salute in corso...');
      const reading = await syncManagerRef.current.triggerLivePicoocWeighIn();

      if (todayMetrics) {
        const updated: DailyMetrics = {
          ...todayMetrics,
          weight: reading.weight,
          bodyFatPercentage: reading.bodyFatPercentage,
          waterPercentage: reading.waterPercentage,
          muscleMass: reading.muscleMass,
          visceralFat: reading.visceralFat,
          bmr: reading.bmr,
        };
        const reEvaluated = readinessCalcRef.current.evaluateToday(updated);
        updated.readinessScore = reEvaluated.score;
        saveDailyMetrics(updated);
        setTodayMetrics(updated);
        setReadiness(reEvaluated);
      }

      refreshTrends();
      setStatusBanner(`Pesata registrata: ${reading.weight} kg`);
    } catch (err) {
      setStatusBanner(String(err));
    } finally {
      setIsScanningPicooc(false);
    }
  };

  const renderSettingsModal = () => (
    <Modal visible={isSettingsOpen} animationType="slide" transparent={true} onRequestClose={() => setIsSettingsOpen(false)}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <View style={styles.rowBetween}>
            <Text style={styles.modalTitle}>Impostazioni & Profilo</Text>
            <TouchableOpacity onPress={() => setIsSettingsOpen(false)}>
              <Text style={styles.closeModalText}>Chiudi</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Altezza (cm)</Text>
            <TextInput style={styles.textInput} value={heightInput} onChangeText={setHeightInput} keyboardType="numeric" placeholderTextColor="#64748B" />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Età (anni)</Text>
            <TextInput style={styles.textInput} value={ageInput} onChangeText={setAgeInput} keyboardType="number-pad" placeholderTextColor="#64748B" />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Sesso Biologico</Text>
            <View style={styles.sexToggleRow}>
              <TouchableOpacity style={[styles.sexChip, sexInput === 'MALE' && styles.sexChipActive]} onPress={() => setSexInput('MALE')}>
                <Text style={[styles.sexChipText, sexInput === 'MALE' && styles.sexChipTextActive]}>Uomo</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.sexChip, sexInput === 'FEMALE' && styles.sexChipActive]} onPress={() => setSexInput('FEMALE')}>
                <Text style={[styles.sexChipText, sexInput === 'FEMALE' && styles.sexChipTextActive]}>Donna</Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity style={styles.primaryButton} onPress={handleSaveBioProfile}>
            <Text style={styles.primaryButtonText}>Salva Profilo</Text>
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity style={styles.secondaryButton} onPress={handleReseedDemoData}>
            <Text style={styles.secondaryButtonText}>Ricarica Dati Storici Demo</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.dangerButton} onPress={handleConfirmResetDatabase}>
            <Text style={styles.dangerButtonText}>Svuota Database SQLite</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );

  const getSemaphoreColor = (status?: 'GREEN' | 'YELLOW' | 'RED') => {
    if (status === 'RED') return '#EF4444';
    if (status === 'YELLOW') return '#F59E0B';
    return '#10B981';
  };

  const renderReadinessTab = () => {
    if (!todayMetrics || !readiness) return null;
    const themeColor = getSemaphoreColor(readiness.status);
    const hasRealData = todayMetrics.hrvNightly > 0;

    return (
      <View>
        <View style={styles.heroCard}>
          <View style={[styles.scoreCircle, { borderColor: themeColor }]}>
            <Text style={[styles.scoreValue, { color: themeColor }]}>{hasRealData ? readiness.score : '--'}</Text>
            <Text style={styles.scoreSubLabel}>READINESS</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: themeColor + '22' }]}>
            <View style={[styles.statusDot, { backgroundColor: themeColor }]} />
            <Text style={[styles.statusBadgeText, { color: themeColor }]}>
              {hasRealData ? `SEMAFORO ${readiness.status}` : 'IN ATTESA DI DATI ODIERNI'}
            </Text>
          </View>
          <Text style={styles.recommendationText}>
            {hasRealData ? readiness.workoutRecommendation : 'Nessun dato registrato oggi. Premi "Sync" o simula una pesata per calcolare la readiness.'}
          </Text>
        </View>

        <Text style={styles.sectionHeader}>PARAMETRI ODIERNI (APPLE SALUTE / GARMIN)</Text>
        <View style={styles.metricsGrid}>
          <View style={styles.metricTile}>
            <Text style={styles.metricLabel}>HRV Notturna</Text>
            <Text style={styles.metricValue}>{todayMetrics.hrvNightly > 0 ? `${todayMetrics.hrvNightly} ms` : '--'}</Text>
          </View>
          <View style={styles.metricTile}>
            <Text style={styles.metricLabel}>FC Riposo</Text>
            <Text style={styles.metricValue}>{todayMetrics.restingHeartRate > 0 ? `${todayMetrics.restingHeartRate} bpm` : '--'}</Text>
          </View>
          <View style={styles.metricTile}>
            <Text style={styles.metricLabel}>Body Battery</Text>
            <Text style={styles.metricValue}>{todayMetrics.bodyBattery > 0 ? `${todayMetrics.bodyBattery}%` : '--'}</Text>
          </View>
          <View style={styles.metricTile}>
            <Text style={styles.metricLabel}>Peso Odierno</Text>
            <Text style={styles.metricValue}>{todayMetrics.weight ? `${todayMetrics.weight} kg` : '--'}</Text>
          </View>
        </View>
      </View>
    );
  };

  const renderTrendsTab = () => {
    const historyPoints = velocityReport?.points || [];
    return (
      <View>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Trend PICOOC & EWMA (Storico)</Text>
          <Text style={styles.cardSubtitle}>{velocityReport?.statusLabel || 'Analisi trend in corso...'}</Text>

          <TouchableOpacity style={styles.primaryButton} onPress={handleScanPicoocBle} disabled={isScanningPicooc}>
            <Text style={styles.primaryButtonText}>
              {isScanningPicooc ? 'Sincronizzazione...' : 'Sincronizza / Simula PICOOC Live'}
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionHeader}>STORICO PESO E SMUSSAMENTO EWMA</Text>
        {historyPoints.map((pt, idx) => (
          <View key={idx} style={[styles.card, { padding: 12, marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
            <View>
              <Text style={{ color: '#38BDF8', fontSize: 13, fontWeight: '700' }}>{pt.date}</Text>
              <Text style={{ color: '#94A3B8', fontSize: 11, marginTop: 2 }}>Reale: {pt.rawWeight} kg</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ color: '#F8FAFC', fontSize: 15, fontWeight: '800' }}>{pt.smoothedWeight} kg</Text>
              <Text style={{ color: '#10B981', fontSize: 10, fontWeight: '600' }}>EWMA</Text>
            </View>
          </View>
        ))}
      </View>
    );
  };

  const renderSleepAlarmTab = () => (
    <View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Sveglia Intelligente & Sonno</Text>
        <Text style={styles.cardSubtitle}>
          Monitoraggio passivo tramite Apple Salute (Garmin / Apple Watch). Nessun consumo notturno di batteria sullo schermo.
        </Text>

        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: isNightMonitoring ? '#991B1B' : '#047857' }]}
          onPress={() => setIsNightMonitoring(!isNightMonitoring)}
        >
          <Text style={styles.primaryButtonText}>
            {isNightMonitoring ? 'Disattiva Monitoraggio Passivo' : 'Attiva Monitoraggio Passivo Notturno'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />
      {renderSettingsModal()}

      <View style={styles.topHeader}>
        <View style={{ flex: 1, paddingRight: 8 }}>
          <Text style={styles.appTitle}>READINESS TRACKER</Text>
          <Text style={styles.statusSub} numberOfLines={1}>{statusBanner}</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.settingsButton} onPress={() => setIsSettingsOpen(true)}>
            <Text style={styles.settingsButtonText}>Profilo</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.syncButton} onPress={bootstrapApp}>
            <Text style={styles.syncButtonText}>Sync</Text>
          </TouchableOpacity>
        </View>
      </View>

      {isLoading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#38BDF8" />
          <Text style={styles.loaderText}>Caricamento dati...</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {activeTab === 'READINESS' && renderReadinessTab()}
          {activeTab === 'TRENDS' && renderTrendsTab()}
          {activeTab === 'SLEEP_ALARM' && renderSleepAlarmTab()}
        </ScrollView>
      )}

      <View style={styles.bottomTabBar}>
        <TouchableOpacity style={[styles.tabButton, activeTab === 'READINESS' && styles.tabButtonActive]} onPress={() => setActiveTab('READINESS')}>
          <Text style={[styles.tabText, activeTab === 'READINESS' && styles.tabTextActive]}>Readiness</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tabButton, activeTab === 'TRENDS' && styles.tabButtonActive]} onPress={() => setActiveTab('TRENDS')}>
          <Text style={[styles.tabText, activeTab === 'TRENDS' && styles.tabTextActive]}>Trend PICOOC</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tabButton, activeTab === 'SLEEP_ALARM' && styles.tabButtonActive]} onPress={() => setActiveTab('SLEEP_ALARM')}>
          <Text style={[styles.tabText, activeTab === 'SLEEP_ALARM' && styles.tabTextActive]}>Sveglia</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0B0F19' },
  topHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1E293B' },
  appTitle: { color: '#F8FAFC', fontSize: 16, fontWeight: '800' },
  statusSub: { color: '#94A3B8', fontSize: 11, marginTop: 2 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  settingsButton: { backgroundColor: '#1E293B', paddingHorizontal: 11, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: '#334155' },
  settingsButtonText: { color: '#E2E8F0', fontSize: 12, fontWeight: '600' },
  syncButton: { backgroundColor: '#1E293B', paddingHorizontal: 13, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: '#38BDF8' },
  syncButtonText: { color: '#38BDF8', fontSize: 12, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.75)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#111827', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, borderTopWidth: 1, borderColor: '#334155' },
  modalTitle: { color: '#F8FAFC', fontSize: 17, fontWeight: '800' },
  closeModalText: { color: '#38BDF8', fontSize: 14, fontWeight: '700' },
  inputGroup: { marginBottom: 12 },
  inputLabel: { color: '#CBD5E1', fontSize: 12, fontWeight: '600', marginBottom: 6 },
  textInput: { backgroundColor: '#1E293B', color: '#F8FAFC', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, borderWidth: 1, borderColor: '#334155' },
  sexToggleRow: { flexDirection: 'row', gap: 10 },
  sexChip: { flex: 1, backgroundColor: '#1E293B', paddingVertical: 10, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: '#334155' },
  sexChipActive: { backgroundColor: '#1D4ED8', borderColor: '#60A5FA' },
  sexChipText: { color: '#94A3B8', fontSize: 13, fontWeight: '700' },
  sexChipTextActive: { color: '#FFFFFF' },
  divider: { height: 1, backgroundColor: '#1E293B', marginVertical: 16 },
  dangerButton: { backgroundColor: '#450A0A', paddingVertical: 12, borderRadius: 10, alignItems: 'center', marginTop: 10, borderWidth: 1, borderColor: '#EF4444' },
  dangerButtonText: { color: '#FCA5A5', fontSize: 13, fontWeight: '700' },
  loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loaderText: { color: '#94A3B8', marginTop: 12, fontSize: 13 },
  scrollContent: { padding: 16, paddingBottom: 36 },
  heroCard: { backgroundColor: '#111827', borderRadius: 16, padding: 20, alignItems: 'center', borderWidth: 1, borderColor: '#1E293B', marginBottom: 14 },
  scoreCircle: { width: 128, height: 128, borderRadius: 64, borderWidth: 8, justifyContent: 'center', alignItems: 'center', marginBottom: 14 },
  scoreValue: { fontSize: 42, fontWeight: '900' },
  scoreSubLabel: { color: '#94A3B8', fontSize: 10, fontWeight: '700', letterSpacing: 1.2 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, marginBottom: 10 },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  statusBadgeText: { fontSize: 12, fontWeight: '800' },
  recommendationText: { color: '#E2E8F0', fontSize: 14, textAlign: 'center', lineHeight: 20 },
  sectionHeader: { color: '#94A3B8', fontSize: 11, fontWeight: '800', marginBottom: 10, marginTop: 4 },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 10 },
  metricTile: { width: '48.5%', backgroundColor: '#111827', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#1E293B', marginBottom: 10 },
  metricLabel: { color: '#94A3B8', fontSize: 11, fontWeight: '600' },
  metricValue: { color: '#F8FAFC', fontSize: 17, fontWeight: '800', marginVertical: 4 },
  card: { backgroundColor: '#111827', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#1E293B', marginBottom: 14 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { color: '#F8FAFC', fontSize: 15, fontWeight: '800', marginBottom: 4 },
  cardSubtitle: { color: '#94A3B8', fontSize: 12, lineHeight: 18 },
  primaryButton: { backgroundColor: '#2563EB', paddingVertical: 12, borderRadius: 10, alignItems: 'center', marginTop: 14 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  secondaryButton: { backgroundColor: '#1E293B', paddingVertical: 11, borderRadius: 10, alignItems: 'center', marginTop: 8, borderWidth: 1, borderColor: '#38BDF8' },
  secondaryButtonText: { color: '#38BDF8', fontSize: 13, fontWeight: '700' },
  bottomTabBar: { flexDirection: 'row', backgroundColor: '#111827', borderTopWidth: 1, borderTopColor: '#1E293B', paddingVertical: 10, paddingHorizontal: 12 },
  tabButton: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  tabButtonActive: { backgroundColor: '#1E293B' },
  tabText: { color: '#64748B', fontSize: 12, fontWeight: '700' },
  tabTextActive: { color: '#38BDF8' },
});