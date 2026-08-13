import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
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
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Section label="Visitors">
        <Pressable onPress={() => setOpen(true)} style={styles.opener}>
          <Text style={[text.body, { color: color.accentText }]}>Add a visitor</Text>
        </Pressable>
      </Section>
    );
  }

  return (
    <Section label="Add a visitor">
      <Card>
        <TextField
          label="First name"
          value={props.firstName}
          onChangeText={props.onFirstNameChange}
        />
        <TextField label="Last name" value={props.lastName} onChangeText={props.onLastNameChange} />
        <TextField
          label="Phone (optional)"
          keyboardType="phone-pad"
          value={props.phone}
          onChangeText={props.onPhoneChange}
        />
        <TextField
          label="Email"
          placeholder="visitor@example.com"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          value={props.email}
          onChangeText={props.onEmailChange}
        />
        <Button
          label={props.submitting ? 'Sending…' : 'Invite visitor'}
          onPress={props.onInvite}
          busy={props.submitting}
        />
        <Button label="Close" onPress={() => setOpen(false)} variant="quiet" />
        {props.message && <Text style={text.secondary}>{props.message}</Text>}
      </Card>
    </Section>
  );
}

const styles = StyleSheet.create({
  opener: { paddingVertical: space.md },
});
