import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { MIN_TOUCH, radius, useColors } from '@/theme';

export function Title({ children }: { children: React.ReactNode }) {
  const c = useColors();
  return (
    <Text accessibilityRole="header" style={[styles.title, { color: c.foreground }]}>
      {children}
    </Text>
  );
}

export function Body({ children, muted }: { children: React.ReactNode; muted?: boolean }) {
  const c = useColors();
  return (
    <Text style={[styles.body, { color: muted ? c.mutedForeground : c.foreground }]}>
      {children}
    </Text>
  );
}

/** An error the person must notice: announced by screen readers as soon as it appears. */
export function ErrorText({ children }: { children: React.ReactNode }) {
  const c = useColors();
  if (!children) return null;
  return (
    <Text
      accessibilityRole="alert"
      accessibilityLiveRegion="assertive"
      style={[styles.body, { color: c.destructive }]}
    >
      {children}
    </Text>
  );
}

interface ButtonProps {
  label: string;
  onPress(): void;
  variant?: 'primary' | 'outline';
  /** Shows a spinner and ignores presses. */
  busy?: boolean;
  disabled?: boolean;
  testID?: string;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  busy,
  disabled,
  testID,
}: ButtonProps) {
  const c = useColors();
  const primary = variant === 'primary';
  const off = busy || disabled;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off, busy: !!busy }}
      disabled={off}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        primary
          ? { backgroundColor: c.primary }
          : { borderWidth: 1, borderColor: c.border, backgroundColor: c.card },
        (pressed || off) && { opacity: 0.6 },
      ]}
    >
      {busy && <ActivityIndicator color={primary ? c.primaryForeground : c.foreground} />}
      <Text style={[styles.buttonText, { color: primary ? c.primaryForeground : c.foreground }]}>
        {label}
      </Text>
    </Pressable>
  );
}

/** A text link inside a sentence or on its own line. */
export function LinkButton({
  label,
  onPress,
  hint,
}: {
  label: string;
  onPress(): void;
  hint?: string;
}) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityHint={hint}
      onPress={onPress}
      hitSlop={10}
      style={({ pressed }) => pressed && { opacity: 0.6 }}
    >
      <Text style={[styles.body, styles.link, { color: c.foreground }]}>{label}</Text>
    </Pressable>
  );
}

interface FieldProps extends Omit<TextInputProps, 'style'> {
  label: string;
  hint?: string;
  /** Adds a show/hide control, for passwords. */
  secret?: { show: string; hide: string };
}

export function Field({ label, hint, secret, ...input }: FieldProps) {
  const c = useColors();
  const [visible, setVisible] = useState(false);
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: c.foreground }]}>{label}</Text>
      <View style={[styles.inputRow, { borderColor: c.input, backgroundColor: c.card }]}>
        <TextInput
          accessibilityLabel={label}
          accessibilityHint={hint}
          placeholderTextColor={c.mutedForeground}
          autoCapitalize="none"
          autoCorrect={false}
          {...input}
          secureTextEntry={secret ? !visible : input.secureTextEntry}
          style={[styles.input, { color: c.foreground }]}
        />
        {secret && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={visible ? secret.hide : secret.show}
            onPress={() => setVisible((now) => !now)}
            hitSlop={8}
            style={styles.reveal}
          >
            <Text style={[styles.revealText, { color: c.mutedForeground }]}>
              {visible ? secret.hide : secret.show}
            </Text>
          </Pressable>
        )}
      </View>
      {hint && <Text style={[styles.hint, { color: c.mutedForeground }]}>{hint}</Text>}
    </View>
  );
}

/** A tick box with its sentence; pressing the box toggles it, links inside stay links. */
export function Checkbox(props: {
  checked: boolean;
  onChange(checked: boolean): void;
  label: string;
  children: React.ReactNode;
}) {
  const c = useColors();
  return (
    <View style={styles.checkRow}>
      <Pressable
        testID="consent"
        accessibilityRole="checkbox"
        accessibilityLabel={props.label}
        accessibilityState={{ checked: props.checked }}
        onPress={() => props.onChange(!props.checked)}
        hitSlop={12}
        style={[
          styles.box,
          { borderColor: props.checked ? c.primary : c.input },
          props.checked && { backgroundColor: c.primary },
        ]}
      >
        {props.checked && <Text style={[styles.tick, { color: c.primaryForeground }]}>✓</Text>}
      </Pressable>
      <View style={styles.checkText}>{props.children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 26, fontWeight: '600', letterSpacing: -0.4 },
  body: { fontSize: 16, lineHeight: 23 },
  link: { textDecorationLine: 'underline' },
  button: {
    minHeight: MIN_TOUCH + 4,
    borderRadius: radius.control,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  buttonText: { fontSize: 16, fontWeight: '600' },
  field: { gap: 6 },
  label: { fontSize: 15, fontWeight: '500' },
  hint: { fontSize: 14, lineHeight: 20 },
  inputRow: {
    minHeight: MIN_TOUCH + 4,
    borderWidth: 1,
    borderRadius: radius.control,
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: { flex: 1, fontSize: 16, paddingHorizontal: 14, paddingVertical: 12 },
  reveal: { minHeight: MIN_TOUCH, justifyContent: 'center', paddingHorizontal: 12 },
  revealText: { fontSize: 14, fontWeight: '500' },
  checkRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  box: {
    width: 24,
    height: 24,
    borderWidth: 1.5,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  tick: { fontSize: 15, fontWeight: '700', lineHeight: 18 },
  checkText: { flex: 1 },
});
