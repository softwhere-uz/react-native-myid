import {
  identify,
  isMyIdError,
  setMockMode,
  type MyIdConfig,
  type MyIdError,
  type MyIdResult,
} from '@softwhere-uz/react-native-myid';
import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

// Real MyID credentials — only needed for the "Real device" mode. Set these in
// example/.env (git-ignored); see .env.example. The modern 3.1.x flow needs a
// server-minted sessionId (the legacy clientId flow no longer works).
const ENV = {
  sessionId: process.env.EXPO_PUBLIC_MYID_SESSION_ID ?? '',
  clientHash: process.env.EXPO_PUBLIC_MYID_CLIENT_HASH ?? '',
  clientHashId: process.env.EXPO_PUBLIC_MYID_CLIENT_HASH_ID ?? '',
};

type Mode = 'mock-success' | 'mock-cancel' | 'mock-error' | 'real';

const MODES: { id: Mode; label: string; hint: string }[] = [
  { id: 'mock-success', label: 'Mock · success', hint: 'Resolves a fake result — no credentials needed.' },
  { id: 'mock-cancel', label: 'Mock · cancel', hint: 'Rejects with kind "cancelled".' },
  { id: 'mock-error', label: 'Mock · error', hint: 'Rejects with kind "sdk".' },
  { id: 'real', label: 'Real device', hint: 'Runs the actual MyID flow using .env credentials (device only).' },
];

export default function App() {
  const [mode, setMode] = useState<Mode>('mock-success');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<MyIdResult | null>(null);
  const [error, setError] = useState<MyIdError | null>(null);

  const isReal = mode === 'real';
  const missingEnv = isReal && (!ENV.sessionId || !ENV.clientHash || !ENV.clientHashId);

  async function run() {
    setLoading(true);
    setResult(null);
    setError(null);

    // Toggle mock mode based on the selected scenario.
    setMockMode(
      mode === 'mock-success'
        ? { outcome: 'success', delayMs: 1200 }
        : mode === 'mock-cancel'
          ? { outcome: 'cancelled', delayMs: 900 }
          : mode === 'mock-error'
            ? { outcome: 'sdk', delayMs: 900, message: 'Mocked SDK failure (code 103).' }
            : null
    );

    const config: MyIdConfig = isReal
      ? { ...ENV, environment: 'SANDBOX' }
      : { sessionId: 'mock-session-0001', clientHash: 'mock', clientHashId: 'mock' };

    try {
      setResult(await identify(config));
    } catch (e) {
      setError(isMyIdError(e) ? e : null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>MyID</Text>
        <Text style={styles.subtitle}>@softwhere-uz/react-native-myid · unofficial demo</Text>

        <Text style={styles.sectionLabel}>Scenario</Text>
        <View style={styles.modes}>
          {MODES.map((m) => {
            const active = m.id === mode;
            return (
              <Pressable
                key={m.id}
                onPress={() => setMode(m.id)}
                style={[styles.mode, active && styles.modeActive]}>
                <Text style={[styles.modeLabel, active && styles.modeLabelActive]}>{m.label}</Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.hint}>{MODES.find((m) => m.id === mode)?.hint}</Text>

        {missingEnv && (
          <View style={styles.warn}>
            <Text style={styles.warnText}>
              Set EXPO_PUBLIC_MYID_SESSION_ID, EXPO_PUBLIC_MYID_CLIENT_HASH and
              EXPO_PUBLIC_MYID_CLIENT_HASH_ID in example/.env to run the real flow.
            </Text>
          </View>
        )}

        <Pressable
          onPress={run}
          disabled={loading || missingEnv}
          style={[styles.button, (loading || missingEnv) && styles.buttonDisabled]}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Verify with MyID</Text>
          )}
        </Pressable>

        {result && (
          <View style={[styles.card, styles.cardSuccess]}>
            <Text style={styles.cardTitle}>✓ Success</Text>
            {result.base64Image ? (
              <Image
                style={styles.face}
                resizeMode="cover"
                source={{ uri: `data:image/png;base64,${result.base64Image}` }}
              />
            ) : null}
            <Text style={styles.mono}>code: {result.code}</Text>
            {result.comparison != null && (
              <Text style={styles.mono}>comparison: {result.comparison}</Text>
            )}
            <Text style={styles.note}>Verify this code from your own backend.</Text>
          </View>
        )}

        {error && (
          <View style={[styles.card, error.kind === 'cancelled' ? styles.cardNeutral : styles.cardError]}>
            <Text style={styles.cardTitle}>
              {error.kind === 'cancelled' ? '↩ Cancelled' : '✕ Failed'}
            </Text>
            <Text style={styles.mono}>kind: {error.kind}</Text>
            {error.code != null && <Text style={styles.mono}>code: {error.code}</Text>}
            <Text style={styles.note}>{error.message}</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0B1220' },
  scroll: { padding: 24, paddingTop: 48 },
  title: { fontSize: 40, fontWeight: '800', color: '#fff', letterSpacing: -1 },
  subtitle: { fontSize: 13, color: '#7C8AA5', marginTop: 4, marginBottom: 28 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#7C8AA5',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
  },
  modes: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  mode: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: '#161F33',
    borderWidth: 1,
    borderColor: '#232F49',
  },
  modeActive: { backgroundColor: '#1E3A8A', borderColor: '#3B82F6' },
  modeLabel: { color: '#AEB9CE', fontWeight: '600', fontSize: 14 },
  modeLabelActive: { color: '#fff' },
  hint: { color: '#7C8AA5', fontSize: 13, marginTop: 12, marginBottom: 8, lineHeight: 18 },
  warn: {
    backgroundColor: '#3B2A08',
    borderColor: '#7A5A12',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginTop: 8,
  },
  warnText: { color: '#F5C86A', fontSize: 13, lineHeight: 19 },
  button: {
    marginTop: 20,
    backgroundColor: '#3B82F6',
    borderRadius: 14,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: { backgroundColor: '#2A3448', opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  card: { marginTop: 24, borderRadius: 16, padding: 20, borderWidth: 1 },
  cardSuccess: { backgroundColor: '#0C2A1A', borderColor: '#1C6B44' },
  cardError: { backgroundColor: '#2A0E12', borderColor: '#7A2530' },
  cardNeutral: { backgroundColor: '#161F33', borderColor: '#232F49' },
  cardTitle: { color: '#fff', fontSize: 18, fontWeight: '800', marginBottom: 12 },
  face: {
    width: 120,
    height: 120,
    borderRadius: 12,
    marginBottom: 12,
    backgroundColor: '#000',
  },
  mono: { color: '#DDE6F5', fontSize: 14, fontFamily: 'Courier', marginTop: 2 },
  note: { color: '#9AA7BF', fontSize: 13, marginTop: 10, lineHeight: 18 },
});
