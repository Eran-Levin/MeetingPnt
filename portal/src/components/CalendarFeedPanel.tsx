import { calendarSubscribeLinks } from '@meetingpnt/shared';
import { useState } from 'react';
import { usersApi } from '../api/usersApi.js';
import { useTranslation } from '../i18n/index.js';
import { Button } from './ui/Button.js';
import { Card } from './ui/Card.js';

const LINK_CLASSES =
  'inline-flex items-center justify-center rounded-lg border border-line-strong bg-surface px-3 py-1.5 text-sm font-medium text-ink transition-colors hover:bg-surface-sunken';

/**
 * Puts the leader's schedule in the calendar they already live in. A subscription rather than the
 * one-event file it replaced: added once, it follows every reschedule and every newly published event.
 *
 * Closed until asked for — the link is a secret, so it isn't fetched or put on screen for someone
 * who only came to read the list.
 */
export function CalendarFeedPanel() {
  const { t } = useTranslation();
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);

  async function load(fetchUrl: () => Promise<{ url: string }>) {
    setBusy(true);
    setError(false);
    setCopied(false);
    try {
      setUrl((await fetchUrl()).url);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  function handleReset() {
    if (!window.confirm(`${t('calendarFeed.confirmResetTitle')} ${t('calendarFeed.confirmReset')}`)) {
      return;
    }
    void load(usersApi.resetCalendarFeed);
  }

  async function handleCopy() {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
  }

  if (!url) {
    return (
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button
          variant="secondary"
          size="sm"
          disabled={busy}
          onClick={() => load(usersApi.calendarFeed)}
        >
          {t('calendarFeed.open')}
        </Button>
        {error && <p className="text-sm text-tone-danger-fg">{t('calendarFeed.failed')}</p>}
      </div>
    );
  }

  const links = calendarSubscribeLinks(url);

  return (
    <Card className="mt-4">
      <h2 className="font-medium text-ink">{t('calendarFeed.title')}</h2>
      <p className="mt-1 text-sm text-ink-secondary">{t('calendarFeed.blurb')}</p>

      <div className="mt-4 flex flex-wrap gap-2">
        <a className={LINK_CLASSES} href={links.google} target="_blank" rel="noreferrer">
          {t('calendarFeed.addGoogle')}
        </a>
        <a className={LINK_CLASSES} href={links.webcal}>
          {t('calendarFeed.addOther')}
        </a>
        <Button variant="secondary" size="sm" onClick={handleCopy}>
          {copied ? t('calendarFeed.copied') : t('calendarFeed.copy')}
        </Button>
      </div>

      {/* An address is left-to-right whatever the page's language. */}
      <p dir="ltr" className="mt-3 truncate rounded-lg bg-surface-sunken px-3 py-2 text-xs text-ink-secondary">
        {url}
      </p>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-muted">{t('calendarFeed.privateNote')}</p>
        <Button variant="ghost" size="sm" disabled={busy} onClick={handleReset}>
          {t('calendarFeed.reset')}
        </Button>
      </div>
      {error && <p className="mt-2 text-sm text-tone-danger-fg">{t('calendarFeed.failed')}</p>}
    </Card>
  );
}
