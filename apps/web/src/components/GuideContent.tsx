import { copy } from '@/lib/copy';

/** S-04 guide steps (shared by /how-it-works and /get-my-file). */
export function GuideContent({ numbered = false }: { numbered?: boolean }) {
  return (
    <div className="stack-lg mt-4">
      {copy.guide.steps.map((s, i) => (
        <div key={s.title} className="card">
          <h3>
            <span className="muted">{numbered ? `${i + 1}. ` : ''}</span>
            {numbered ? s.title : copy.guide.stepLabel(i + 1, copy.guide.steps.length) + ' — ' + s.title}
          </h3>
          <p className="muted" style={{ margin: 0 }}>{s.body}</p>
          {i === 2 && (
            <>
              <p className="micro mt-2" style={{ margin: 0, color: 'var(--amber-400)' }}>{copy.guide.formatTip}</p>
              <p className="micro mt-2 muted">{copy.guide.dataMinTip}</p>
            </>
          )}
          {i === 3 && <p className="micro mt-2 muted">{copy.guide.fileNameHint}</p>}
        </div>
      ))}
    </div>
  );
}
