import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { useI18n } from '@/i18n/i18n';
import { useColors } from '@/theme';

/** The mark: a rounded tile with a play triangle, as on the website. */
export function BrandMark({ size = 36, onDark = false }: { size?: number; onDark?: boolean }) {
  const c = useColors();
  const tile = onDark ? '#FFFFFF' : c.foreground;
  const cut = onDark ? '#0B0D12' : c.background;
  return (
    <View
      accessible={false}
      style={[
        styles.mark,
        { width: size, height: size, borderRadius: size * 0.28, backgroundColor: tile },
      ]}
    >
      <Ionicons name="play" size={size * 0.52} color={cut} style={{ marginLeft: size * 0.06 }} />
    </View>
  );
}

/** Mark and name together, read as one thing. */
export function Brand({ onDark = false }: { onDark?: boolean }) {
  const { t } = useI18n();
  const c = useColors();
  return (
    <View
      style={styles.brand}
      accessible
      accessibilityRole="header"
      accessibilityLabel={t.common.appName}
    >
      <BrandMark size={32} onDark={onDark} />
      <Text style={[styles.name, { color: onDark ? '#FFFFFF' : c.foreground }]}>
        {t.common.appName}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  mark: { alignItems: 'center', justifyContent: 'center' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  name: { fontSize: 17, fontWeight: '700', letterSpacing: -0.2 },
});
