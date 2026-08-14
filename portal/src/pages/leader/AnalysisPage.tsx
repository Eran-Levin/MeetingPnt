import { PageContainer } from '../../components/ui/PageContainer.js';
import { EmptyState } from '../../components/ui/Skeleton.js';

/**
 * Deliberately empty for now — the section exists so the shape of the portal is settled before
 * anything is built into it. What belongs here is the look back: attendance over a term, who has
 * drifted away, how a trip actually ran against its plan. See BACKLOG.md.
 */
export function AnalysisPage() {
  return (
    <PageContainer wide>
      <h1 className="text-2xl font-semibold text-ink">Analysis</h1>
      <p className="mt-1 text-sm text-ink-secondary">How your groups and activities are going.</p>

      <div className="mt-8">
        <EmptyState
          headline="Nothing to show yet"
          body="Attendance trends, who's drifted away, and how activities ran against their plan will appear here."
        />
      </div>
    </PageContainer>
  );
}
