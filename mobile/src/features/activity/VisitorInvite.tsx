import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useTranslation } from '../../i18n';
import { Button, Card, Section, TextField, color, space, text } from '../../ui';

interface Props {
  firstName: string;
  onFirstNameChange: (value: string) => void;
  lastName: string;
  onLastNameChange: (value: string) => void;
  phone: string;
  onPhoneChange: (value: string) => void;
  email: string;
  onEmailChange: (value: string) => void;
  onInvite: () => void;
  submitting: boolean;
  message: string | null;
}

/**
 * Four fields for something a leader does occasionally, so it stays folded away — the screen's
 * job while an event runs is the roll call, not data entry.
 */
export function VisitorInvite(props: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Section label={t('visitor.section')}>
        <Pressable onPress={() => setOpen(true)} style={styles.opener}>
          <Text style={[text.body, { color: color.accentText }]}>{t('visitor.add')}</Text>
        </Pressable>
      </Section>
    );
  }

  return (
    <Section label={t('visitor.add')}>
      <Card>
        <TextField
          label={t('common.firstName')}
          value={props.firstName}
          onChangeText={props.onFirstNameChange}
        />
        <TextField label={t('common.lastName')} value={props.lastName} onChangeText={props.onLastNameChange} />
        <TextField
          label={t('common.phoneOptional')}
          keyboardType="phone-pad"
          value={props.phone}
          onChangeText={props.onPhoneChange}
        />
        <TextField
          label={t('common.email')}
          placeholder="visitor@example.com"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          value={props.email}
          onChangeText={props.onEmailChange}
        />
        <Button
          label={props.submitting ? t('visitor.sending') : t('visitor.invite')}
          onPress={props.onInvite}
          busy={props.submitting}
        />
        <Button label={t('common.close')} onPress={() => setOpen(false)} variant="quiet" />
        {props.message && <Text style={text.secondary}>{props.message}</Text>}
      </Card>
    </Section>
  );
}

const styles = StyleSheet.create({
  opener: { paddingVertical: space.md },
});
