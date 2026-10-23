import { useState, type ReactElement } from 'react'
import { asset } from './assets'
import { DesignIcon, Workspace } from './Workspace'
import type { ApiClient } from './api'

// Development design fixtures ONLY. Transcribed from the round-5 Figma
// references r5-102..r5-112 ("Ahmed care plan — insertion point"): a numbered
// behavioural-activation stage list, the dashed "Target gap" callout that
// previews where a library item would land, and the patient contact card.
// None of this is API data.
type StageStatus = 'completed' | 'current' | 'locked'
type Stage = { title: string; status: StageStatus; line: string; identity: string }

const stages: Stage[] = [
  { title: 'تقييم الحالة', status: 'completed', line: 'Completed · responses preserved', identity: 'ba-assess' },
  { title: 'ماذا فقدت من حياتك؟', status: 'completed', line: 'Completed · responses preserved', identity: 'ba-loss' },
  { title: 'نشاط صغير يوميًا', status: 'current', line: 'Current · in progress', identity: 'ba-small' },
  { title: 'سلّم النشاط', status: 'locked', line: 'Locked · completes after stage 3', identity: 'ba-ladder' },
  { title: 'جدولة الأنشطة الأسبوعية', status: 'locked', line: 'Locked · completes after stage 4', identity: 'ba-week' },
  { title: 'مواجهة الانسحاب الاجتماعي', status: 'locked', line: 'Locked · completes after stage 5', identity: 'ba-social' },
  { title: 'التعامل مع النكسات', status: 'locked', line: 'Locked · completes after stage 6', identity: 'ba-relapse' },
  { title: 'بناء روتين طويل المدى', status: 'locked', line: 'Locked · completes after stage 7', identity: 'ba-routine' },
  { title: 'مراجعة الخطة والاستمرار', status: 'locked', line: 'Locked · completes after stage 8', identity: 'ba-review' },
]

const currentStage = 3
const proposal = {
  title: 'Thought record · سجل الأفكار',
  meta: 'Published v2 · 4 long-text fields · Not inserted yet',
}

export function CarePlanInsertion({ navigate, api }: { navigate: (path: string) => void; api?: ApiClient }) {
  if (import.meta.env.DEV && import.meta.env.VITE_DEMO_MODE === 'true' && !api) {
    return <DemoCarePlanInsertion navigate={navigate} />
  }
  return <LiveCarePlanInsertion navigate={navigate} api={api} />
}

// The nav-wire unit owns the shell contract: /homework/* pages highlight
// "Additional Content" in the sidebar via the Workspace active union.
const homeworkNav = 'Additional Content' as const
const homeworkTitle = 'Assign Homework'

function LiveCarePlanInsertion({ navigate, api }: { navigate: (path: string) => void; api?: ApiClient }) {
  const [notice, setNotice] = useState('')
  return (
    <div className="care-plan-insertion">
      <Workspace active={homeworkNav} title={homeworkTitle} mobileTitle={homeworkTitle} navigate={navigate} api={api}>
        {notice && (
          <div className="cpi-notice" role="status">
            <p>{notice}</p>
            <button type="button" onClick={() => setNotice('')}>
              Dismiss
            </button>
          </div>
        )}
        <div className="cpi-layout">
          <section className="cpi-card cpi-empty" aria-label="Care plan unavailable">
            <h2>Care-plan editing is not connected</h2>
            <p>
              The therapist API does not expose care-plan stages or a homework library, so no stages
              are shown and nothing can be inserted, published, assigned, repositioned, or deleted here.
            </p>
            <button type="button" className="cpi-action" onClick={() => setNotice('Care-plan editing is not available in the therapist API.')}>
              Why is this empty?
            </button>
          </section>
        </div>
      </Workspace>
    </div>
  )
}

function DemoCarePlanInsertion({ navigate }: { navigate: (path: string) => void }) {
  const [gap, setGap] = useState(currentStage)
  const [notice, setNotice] = useState('')

  function unavailable(action: string) {
    setNotice(`Demo only: ${action} is not connected. No change was made to the care plan.`)
  }

  function insertSlot(afterStage: number) {
    const next = stages[afterStage]
    return (
      <li key={`insert-${afterStage}`} className="cpi-insert">
        <button
          type="button"
          aria-label={
            next
              ? `Insert between stages: after ${stages[afterStage - 1].title}, before ${next.title}`
              : `Insert between stages: after ${stages[afterStage - 1].title}`
          }
          onClick={() => {
            setGap(afterStage)
            setNotice('')
          }}
        >
          <DesignIcon name="r5-insertion-add.svg" />
          <span>Insert between stages</span>
        </button>
      </li>
    )
  }

  function stageCard(stage: Stage, index: number) {
    const number = index + 1
    return (
      <li
        key={stage.identity}
        className={`cpi-stage cpi-stage-${stage.status}`}
        aria-label={`Stage ${number}: ${stage.title} — ${stage.line}`}
      >
        <span className={`cpi-chip cpi-chip-${stage.status}`} aria-hidden="true">
          {stage.status === 'completed' ? <img src={asset('r5-insertion-check.svg')} alt="" /> : number}
        </span>
        <div className="cpi-stage-copy">
          <h3 lang="ar">{stage.title}</h3>
          <p className="cpi-status">{stage.line}</p>
          <p className="cpi-meta">Stable identity · {stage.identity}</p>
        </div>
      </li>
    )
  }

  const nextStage = stages[gap]
  const gapHeading = gap === currentStage ? `Target gap · after current stage ${currentStage}` : `Target gap · after stage ${gap}`
  const gapSub = nextStage
    ? `Before “${nextStage.title}” · proposed new stage ${gap + 1} of ${stages.length + 1}`
    : `End of plan · proposed new stage ${gap + 1} of ${stages.length + 1}`

  return (
    <div className="care-plan-insertion">
      <Workspace active={homeworkNav} title={homeworkTitle} mobileTitle={homeworkTitle} navigate={navigate}>
        {notice && (
          <div className="cpi-notice" role="status">
            <p>{notice}</p>
            <button type="button" onClick={() => setNotice('')}>
              Dismiss
            </button>
          </div>
        )}
        <div className="cpi-layout">
          <aside className="cpi-card cpi-identity" aria-label="Design fixture patient contact">
            <div className="cpi-identity-actions">
              <button
                type="button"
                className="cpi-contact"
                title="Open demo chats, not a real patient conversation"
                onClick={() => navigate('/chats')}
              >
                <DesignIcon name="preview-client-profile-contact.svg" />
                Contact patient
              </button>
              <div className="cpi-two-actions">
                <button type="button" onClick={() => unavailable('Scheduling')}>
                  <DesignIcon name="preview-client-profile-schedule.svg" />
                  Schedule
                </button>
                <button type="button" onClick={() => unavailable('Calling')}>
                  <DesignIcon name="preview-client-profile-call.svg" />
                  Call
                </button>
              </div>
            </div>
            <section className="cpi-meta-block">
              <h3>Contact Information</h3>
              <dl>
                <div>
                  <dt>Mobile</dt>
                  <dd>+966 50 123 4567</dd>
                </div>
                <div>
                  <dt>Email</dt>
                  <dd>ahmed@example.com</dd>
                </div>
              </dl>
            </section>
            <section className="cpi-meta-block cpi-subscription">
              <h3>Subscription</h3>
              <dl>
                <div>
                  <dt>Package</dt>
                  <dd>8-Week Package</dd>
                </div>
                <div>
                  <dt>Start</dt>
                  <dd>2024-01-15</dd>
                </div>
                <div>
                  <dt>Next Session</dt>
                  <dd>Today 10:00 AM</dd>
                </div>
              </dl>
            </section>
          </aside>
          <ol className="cpi-stages" aria-label="Care plan stages">
            {stages.map((stage, index) => (
              <FragmentRow key={stage.identity} stage={stage} index={index} gap={gap} insertSlot={insertSlot} stageCard={stageCard} gapHeading={gapHeading} gapSub={gapSub} setNotice={setNotice} />
            ))}
          </ol>
        </div>
        <p className="cpi-demo-disclaimer">
          Development design reference only. The stage list and proposal are a Figma fixture, not a
          real care plan. No backend is connected; picking a slot only moves the preview.
        </p>
      </Workspace>
    </div>
  )
}

function FragmentRow({
  stage,
  index,
  gap,
  insertSlot,
  stageCard,
  gapHeading,
  gapSub,
  setNotice,
}: {
  stage: Stage
  index: number
  gap: number
  insertSlot: (afterStage: number) => ReactElement
  stageCard: (stage: Stage, index: number) => ReactElement
  gapHeading: string
  gapSub: string
  setNotice: (value: string) => void
}) {
  const afterStage = index + 1
  return (
    <>
      {stageCard(stage, index)}
      {gap === afterStage && (
        <li className="cpi-gap" aria-label={`${gapHeading}. ${gapSub}`}>
          <h2>{gapHeading}</h2>
          <p className="cpi-gap-sub">{gapSub}</p>
          <div className="cpi-proposal">
            <h3>{proposal.title}</h3>
            <p>{proposal.meta}</p>
          </div>
          <div className="cpi-gap-actions">
            <button
              type="button"
              className="cpi-action"
              onClick={() => setNotice('Demo only: the content picker is not connected. “Thought record · سجل الأفكار” stays the staged proposal.')}
            >
              <DesignIcon name="r5-insertion-plus.svg" />
              Choose content
            </button>
            <button
              type="button"
              className="cpi-action"
              onClick={() => setNotice('Demo only: pick any “Insert between stages” slot to move the proposed stage. Nothing is saved.')}
            >
              Reposition
            </button>
          </div>
        </li>
      )}
      {gap !== afterStage && insertSlot(afterStage)}
    </>
  )
}
