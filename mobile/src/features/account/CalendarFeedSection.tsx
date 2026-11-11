import { calendarSubscribeLinks } from '@meetingpnt/shared';
import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { Alert, Linking, Platform, StyleSheet, Text } from 'react-native';
import { usersApi } from '../../api/usersApi';
import { apiErrorMessage, useTranslation } from '../../i18n';
import { Button, ButtonRow, Card, Section, space, text } from '../../ui';

/**
 * Puts this person's events in the calendar they already live in. It's a subscription, not a
 * copy: added once, it follows every reschedule without them doing anything.
 *
 * The link is fetched on the tap rather than on mount — it's a secret, and most visits to Account
 * are for something else.
 */
export function CalendarFeedSection() {
  const { t } = useTranslation();
  const [busy, setBusy] = useState<'add' | 'copy' | 'reset' | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: 'add' | 'copy' | 'reset', work: () => Promise<void>) {
    setError(null);
    setCopied(false);
    setBusy(action);
    try {
      await work();
    } catch (err) {
      setError(apiErrorMessage(err, t('calendarFeed.failed')));
    } finally {
      setBusy(null);
    }
  }

  /** iOS owns `webcal:` and offers to subscribe. Android has no handler for it, and there the
   * calendar is almost always Google's, so it goes to Google's own add-by-URL page. */
  function handleAdd() {
    return run('add', async () => {
      const links = calendarSubscribeLinks((await usersApi.calendarFeed()).url);
      await Linking.openURL(Platform.OS === 'ios' ? links.webcal : links.google);
    });
  }

  /** For everything the button can't reach: Outlook, a desktop calendar, a work account. */
  function handleCopy() {
    return run('copy', async () => {
      await Clipboard.setStringAsync((await usersApi.calendarFeed()).url);
      setCopied(true);
    });
  }

  function handleReset() {
    Alert.alert(t('calendarFeed.confirmResetTitle'), t('calendarFeed.confirmReset'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('calendarFeed.reset'),
        style: 'destructive',
        onPress: () => run('reset', async () => void (await usersApi.resetCalendarFeed())),
      },
    ]);
  }

  return (
    <Section label={t('calendarFeed.title')}>
      <Card>
        <Text style={[text.secondary, styles.blurb]}>{t('calendarFeed.blurb')}</Text>
        <ButtonRow>
          <Button
            label={t('calendarFeed.add')}
            onPress={handleAdd}
            busy={busy === 'add'}
            grow
          />
          <Button
            label={copied ? t('calendarFeed.copied') : t('calendarFeed.copy')}
            variant="secondary"
            onPress={handleCopy}
            busy={busy === 'copy'}
            grow
          />
        </ButtonRow>
        <Text style={[text.secondary, styles.note]}>{t('calendarFeed.privateNote')}</Text>
        <Button
          label={t('calendarFeed.reset')}
          variant="secondary"
          onPress={handleReset}
          busy={busy === 'reset'}
          style={styles.reset}
        />
        {error && <Text style={[text.secondary, styles.note]}>{error}</Text>}
      </Card>
    </Section>
  );
}

const styles = StyleSheet.create({
  blurb: { marginBottom: space.md },
  note: { marginTop: space.md },
  reset: { marginTop: space.sm },
});
