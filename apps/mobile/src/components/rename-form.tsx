import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, ErrorText, Field } from '@/components/ui';
import { useI18n } from '@/i18n/i18n';

interface RenameFormProps {
  label: string;
  saveLabel: string;
  failedText: string;
  initial: string;
  maxLength: number;
  /** Saves the trimmed name; rejecting shows `failedText`. */
  onSave(name: string): Promise<void>;
  onCancel(): void;
  testID?: string;
}

/** Edits one name in place: a video's title or an event's name. */
export function RenameForm(props: RenameFormProps) {
  const { t } = useI18n();
  const [name, setName] = useState(props.initial);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const trimmed = name.trim();

  function save() {
    if (trimmed.length === 0) return;
    if (trimmed === props.initial) return props.onCancel();
    setBusy(true);
    setFailed(false);
    props.onSave(trimmed).catch(() => {
      setFailed(true);
      setBusy(false);
    });
  }

  return (
    <View style={styles.form}>
      <Field
        testID={props.testID ?? 'rename-input'}
        label={props.label}
        value={name}
        onChangeText={setName}
        maxLength={props.maxLength}
        autoCapitalize="sentences"
        autoCorrect
        autoFocus
        selectTextOnFocus
        returnKeyType="done"
        onSubmitEditing={save}
      />
      {failed && (
        <ErrorText>
          {props.failedText} {t.common.tryAgain}
        </ErrorText>
      )}
      <View style={styles.buttons}>
        <View style={styles.grow}>
          <Button
            testID="rename-save"
            label={busy ? t.common.saving : props.saveLabel}
            busy={busy}
            disabled={trimmed.length === 0}
            onPress={save}
          />
        </View>
        <View style={styles.grow}>
          <Button
            variant="outline"
            label={t.common.cancel}
            disabled={busy}
            onPress={props.onCancel}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: 12 },
  buttons: { flexDirection: 'row', gap: 10 },
  grow: { flex: 1 },
});
