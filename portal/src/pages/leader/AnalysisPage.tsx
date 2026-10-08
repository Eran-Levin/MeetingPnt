import { PageContainer } from '../../components/ui/PageContainer.js';
import { EmptyState } from '../../components/ui/Skeleton.js';
import { useTranslation } from '../../i18n/index.js';

/**
 * Deliberately empty for now — the section exists so the shape of the portal is settled before
 * anything is built into it. What belongs here is the look back: attendance over a term, who has
 * drifted away, how a trip actually ran against its plan. See BACKLOG.md.
 */
export function AnalysisPage() {
  const { t } = useTranslation();
  return (
    <PageContainer wide>
      <h1 className="text-2xl font-semibold text-ink">{t('portal.nav.analysis')}</h1>
      <p className="mt-1 text-sm text-ink-secondary">{t('analysisPage.subtitle')}</p>

      <div className="mt-8">
        <EmptyState
          headline={t('analysisPage.emptyHeadline')}
          body={t('analysisPage.emptyBody')}
        />
      </div>
    </PageContainer>
  );
}
