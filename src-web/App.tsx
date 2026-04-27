import { useEffect, useMemo, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import {
  Link,
  Navigate,
  NavLink,
  Outlet,
  Route,
  Routes,
  useNavigate,
  useSearchParams,
} from 'react-router-dom';
import { db, exportBackupFile, mutate, restoreBackupFile, useDataSnapshot } from './data';
import type {
  BrainDumpItem,
  DailyTask,
  FocusExitReason,
  FocusSession,
  Goal,
  GoalPerformanceStatus,
  GoalStatus,
  GoalWriteInput,
  Habit,
  HabitCadenceType,
  HabitCueType,
  HabitTodayView,
  HabitWriteInput,
  Milestone,
  OnboardingDraft,
  Project,
  ResumeContext,
  TaskTier,
  WeeklyInspection,
} from '../src/types';
import { TIER_XP } from '../src/types';
import {
  formatDate,
  formatDisplayDate,
  formatDurationCompact,
  formatElapsed,
  formatShortDate,
  formatWeekRange,
  getPrevWeekStart,
  getWeekStart,
  todayString,
} from '../src/utils/dates';
import {
  BUILD_PHASES,
  calculateBuildPhaseIndex,
  calculateCalendarProgress,
  calculateForecastStatus,
  calculateXpProgress,
  getBuildDecayLevel,
  getBuildPhaseName,
  getDaysUntil,
  getNextUnlockRequirement,
} from '../src/utils/buildProgress';
import { generateAnchorLines } from '../src/utils/goalAnchors';
import { createDefaultGoalInput } from '../src/utils/goalTemplate';
import { STANDALONE_TASKS_GOAL_ID } from '../src/constants/standaloneTaskGoal';

const DAILY_CAP = 3;
const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTH_GRID_DAYS = 42;
const HEARTBEAT_INTERVAL_MS = 15000;
const WEB_CACHE_CLEANUP_KEY = 'focus-web-cache-cleanup-v2';
const PROJECT_COLORS = ['#3B5BDB', '#2F9E44', '#E8590C', '#D6336C', '#0C8599', '#7950F2'];
const GOAL_RATING_OPTIONS = [
  { value: 1, label: 'Low' },
  { value: 2, label: 'Medium' },
  { value: 3, label: 'High' },
] as const;
const GOAL_PLACEMENT_OPTIONS: Array<{ value: Exclude<GoalStatus, 'completed'>; label: string }> = [
  { value: 'active', label: 'Make active now' },
  { value: 'queued', label: 'Queue next' },
  { value: 'parked', label: 'Park for later' },
];

const EMPTY_ONBOARDING_DRAFT: OnboardingDraft = {
  goalTitle: '',
  targetOutcome: '',
  hasTargetDate: false,
  targetDate: '',
  metric: '',
  importance: 2,
  urgency: 1,
  payoff: 2,
  whyNow: '',
  practicalReason: '',
  emotionalReason: '',
  costOfDrift: '',
  anchorWhy: '',
  anchorDrift: '',
  weeklyFocus: '',
  draftSteps: ['', '', ''],
};

const EXIT_REASONS: Array<{ id: Exclude<FocusExitReason, 'switched_task'>; label: string }> = [
  { id: 'distraction', label: 'Distraction' },
  { id: 'task_unclear', label: 'Task unclear' },
  { id: 'too_tired', label: 'Too tired' },
  { id: 'interrupted', label: 'Interrupted' },
  { id: 'avoided_it', label: 'Avoided it' },
];

function parseDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function addDays(dateStr: string, days: number): string {
  const date = parseDate(dateStr);
  date.setDate(date.getDate() + days);
  return formatDate(date);
}

function addMonths(monthStart: string, months: number): string {
  const date = parseDate(monthStart);
  date.setMonth(date.getMonth() + months, 1);
  return formatDate(date);
}

function getMonthStart(dateStr: string): string {
  const date = parseDate(dateStr);
  date.setDate(1);
  return formatDate(date);
}

function getMonthGridDates(monthStart: string): string[] {
  const monthDate = parseDate(monthStart);
  const weekday = monthDate.getDay();
  const diffToMonday = weekday === 0 ? -6 : 1 - weekday;
  const gridStart = new Date(monthDate);
  gridStart.setDate(gridStart.getDate() + diffToMonday);

  return Array.from({ length: MONTH_GRID_DAYS }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    return formatDate(date);
  });
}

function formatMonthLabel(monthStart: string): string {
  return parseDate(monthStart).toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
  });
}

function isDateInMonth(dateStr: string, monthStart: string): boolean {
  return dateStr.slice(0, 7) === monthStart.slice(0, 7);
}

function getWhatBrokeValue(review: { whatDrifted: string; driftReasons: string[] }) {
  return [review.whatDrifted.trim(), ...review.driftReasons]
    .map((value) => value.trim())
    .filter((value, index, values) => value.length > 0 && values.indexOf(value) === index)
    .join(', ');
}

function getGoalPriorityScore(goal: Pick<Goal, 'importance' | 'urgency' | 'payoff'>): number {
  return goal.importance * 3 + goal.payoff * 2 + goal.urgency;
}

function getGoalPriorityLabel(goal: Pick<Goal, 'importance' | 'urgency' | 'payoff'>): string {
  const score = getGoalPriorityScore(goal);
  if (score >= 15) {
    return 'High value';
  }
  if (score >= 11) {
    return 'Strong candidate';
  }
  return 'Worth parking';
}

function getGoalStatusLabel(status: GoalStatus): string {
  if (status === 'active') {
    return 'Active';
  }
  if (status === 'queued') {
    return 'Queued';
  }
  if (status === 'parked') {
    return 'Parked';
  }
  return 'Completed';
}

function createGoalDraft(goal?: Goal | null): Omit<OnboardingDraft, 'weeklyFocus'> {
  return {
    goalTitle: goal?.title ?? '',
    targetOutcome: goal?.targetOutcome ?? '',
    hasTargetDate: !!goal?.targetDate,
    targetDate: goal?.targetDate ?? '',
    metric: goal?.metric ?? '',
    importance: goal?.importance ?? 2,
    urgency: goal?.urgency ?? 1,
    payoff: goal?.payoff ?? 2,
    whyNow: goal?.whyNow ?? '',
    practicalReason: goal?.practicalReason ?? '',
    emotionalReason: goal?.emotionalReason ?? '',
    costOfDrift: goal?.costOfDrift ?? '',
    anchorWhy: goal?.anchorWhy ?? '',
    anchorDrift: goal?.anchorDrift ?? '',
    draftSteps: ['', '', ''],
  };
}

function toGoalWriteInput(draft: Omit<OnboardingDraft, 'weeklyFocus'>): GoalWriteInput {
  const autoAnchors = generateAnchorLines({
    practicalReason: draft.practicalReason,
    emotionalReason: draft.emotionalReason,
    costOfDrift: draft.costOfDrift,
  });

  return {
    title: draft.goalTitle.trim(),
    targetOutcome: draft.targetOutcome.trim(),
    targetDate: draft.hasTargetDate ? draft.targetDate.trim() : null,
    metric: draft.metric.trim(),
    practicalReason: draft.practicalReason.trim(),
    emotionalReason: draft.emotionalReason.trim(),
    costOfDrift: draft.costOfDrift.trim(),
    anchorWhy: draft.anchorWhy.trim() || autoAnchors.anchorWhy,
    anchorDrift: draft.anchorDrift.trim() || autoAnchors.anchorDrift,
    importance: draft.importance,
    urgency: draft.urgency,
    payoff: draft.payoff,
    whyNow: draft.whyNow.trim(),
  };
}

function useLegacyWebCleanup() {
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const [hadRegistrations, hadCaches] = await Promise.all([
          (async () => {
            if (!('serviceWorker' in navigator)) {
              return false;
            }

            const registrations = await navigator.serviceWorker.getRegistrations();
            await Promise.all(registrations.map((registration) => registration.unregister()));
            return registrations.length > 0;
          })(),
          (async () => {
            if (typeof caches === 'undefined') {
              return false;
            }

            const cacheKeys = await caches.keys();
            const focusCacheKeys = cacheKeys.filter((key) => key.startsWith('focus-'));
            await Promise.all(focusCacheKeys.map((key) => caches.delete(key)));
            return focusCacheKeys.length > 0;
          })(),
        ]);

        if (cancelled) {
          return;
        }

        const needsReload = hadRegistrations || hadCaches;
        const hasReloaded = window.sessionStorage.getItem(WEB_CACHE_CLEANUP_KEY) === 'done';

        if (needsReload && !hasReloaded) {
          window.sessionStorage.setItem(WEB_CACHE_CLEANUP_KEY, 'done');
          window.location.reload();
        }
      } catch {
        // Ignore cleanup failures and continue booting the app.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);
}

function Modal({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div>
            <p className="eyebrow">Editor</p>
            <h3>{title}</h3>
          </div>
          <button className="icon-button" type="button" onClick={onClose}>
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── Goal wizard (4 steps) ────────────────────────────────────────────────────

const WIZARD_STEPS = [
  { label: 'Name it' },
  { label: 'Define success' },
  { label: 'Why it matters' },
  { label: 'First steps' },
] as const;

function WizardProgress({ step, total }: { step: number; total: number }) {
  return (
    <div className="wizard-progress">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className={`wizard-dot ${i + 1 === step ? 'is-active' : i + 1 < step ? 'is-done' : ''}`} />
      ))}
      <span className="wizard-step-label">{WIZARD_STEPS[step - 1].label}</span>
    </div>
  );
}

function GoalWizard({
  draft,
  setDraft,
  status,
  setStatus,
  showWeeklyFocus = false,
  showPlacement = false,
  isEditing = false,
  onCancel,
  onSubmit,
}: {
  draft: OnboardingDraft;
  setDraft: (next: OnboardingDraft) => void;
  status: Exclude<GoalStatus, 'completed'>;
  setStatus: (s: Exclude<GoalStatus, 'completed'>) => void;
  showWeeklyFocus?: boolean;
  showPlacement?: boolean;
  isEditing?: boolean;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  const [step, setStep] = useState(1);
  const TOTAL = 4;

  // Reset to step 1 whenever the wizard is re-mounted for a new goal
  useEffect(() => {
    setStep(1);
  }, [isEditing]);

  const setStepVal = (idx: number, val: string) => {
    const next = [...draft.draftSteps];
    next[idx] = val;
    setDraft({ ...draft, draftSteps: next });
  };

  const canProceed1 = draft.goalTitle.trim().length > 0;
  const canProceed2 = draft.targetOutcome.trim().length > 0;
  const canFinish = canProceed1 && canProceed2;

  return (
    <div className="wizard-shell">
      <WizardProgress step={step} total={TOTAL} />

      {step === 1 && (
        <div className="wizard-step">
          <p className="wizard-question">What do you want to achieve?</p>
          <p className="wizard-hint">Be concrete — "Launch my portfolio" beats "be more productive".</p>
          <label className="field">
            <span>Goal title</span>
            <input
              autoFocus
              value={draft.goalTitle}
              onChange={(e) => setDraft({ ...draft, goalTitle: e.target.value })}
              placeholder="e.g. Ship my freelance portfolio site"
              onKeyDown={(e) => { if (e.key === 'Enter' && canProceed1) { e.preventDefault(); setStep(2); } }}
            />
          </label>
        </div>
      )}

      {step === 2 && (
        <div className="wizard-step">
          <p className="wizard-question">What does winning look like?</p>
          <p className="wizard-hint">Describe the end state clearly — future-you should be able to tick it off without debate.</p>
          <label className="field">
            <span>Target outcome</span>
            <textarea
              autoFocus
              rows={3}
              value={draft.targetOutcome}
              onChange={(e) => setDraft({ ...draft, targetOutcome: e.target.value })}
              placeholder="e.g. A live site with 3 case studies, contact form working, and shared with 10 people"
            />
          </label>
          <label className="field">
            <span>How will you measure it? <em className="optional-label">(optional)</em></span>
            <input
              value={draft.metric}
              onChange={(e) => setDraft({ ...draft, metric: e.target.value })}
              placeholder="e.g. 10 people have visited the site"
            />
          </label>
          <label className="toggle-field">
            <input
              type="checkbox"
              checked={draft.hasTargetDate}
              onChange={(e) => setDraft({ ...draft, hasTargetDate: e.target.checked, targetDate: e.target.checked ? draft.targetDate : '' })}
            />
            <span>Set a target date</span>
          </label>
          {draft.hasTargetDate && (
            <label className="field">
              <span>Target date</span>
              <input type="date" value={draft.targetDate} onChange={(e) => setDraft({ ...draft, targetDate: e.target.value })} />
            </label>
          )}
        </div>
      )}

      {step === 3 && (
        <div className="wizard-step">
          <p className="wizard-question">Why does this matter to you?</p>
          <p className="wizard-hint">Honest answers here become your anchors on hard days — they pull you back when motivation dips.</p>
          <label className="field">
            <span>Why now, not later?</span>
            <textarea
              autoFocus
              rows={2}
              value={draft.whyNow}
              onChange={(e) => setDraft({ ...draft, whyNow: e.target.value })}
              placeholder="e.g. I have a job interview in 6 weeks and I need proof of work"
            />
          </label>
          <label className="field">
            <span>What's the practical benefit?</span>
            <textarea
              rows={2}
              value={draft.practicalReason}
              onChange={(e) => setDraft({ ...draft, practicalReason: e.target.value })}
              placeholder="e.g. It unlocks freelance income and removes financial stress"
            />
          </label>
          <label className="field">
            <span>How will achieving this make you feel?</span>
            <textarea
              rows={2}
              value={draft.emotionalReason}
              onChange={(e) => setDraft({ ...draft, emotionalReason: e.target.value })}
              placeholder="e.g. Proud and confident — I'll finally have evidence I can point to"
            />
          </label>
          <label className="field">
            <span>What's the cost of letting this drift?</span>
            <textarea
              rows={2}
              value={draft.costOfDrift}
              onChange={(e) => setDraft({ ...draft, costOfDrift: e.target.value })}
              placeholder="e.g. Another year of second-guessing myself and turning down opportunities"
            />
          </label>
          <div className="wizard-ratings">
            <label className="field">
              <span>Importance</span>
              <select value={draft.importance} onChange={(e) => setDraft({ ...draft, importance: Number(e.target.value) })}>
                {GOAL_RATING_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Urgency</span>
              <select value={draft.urgency} onChange={(e) => setDraft({ ...draft, urgency: Number(e.target.value) })}>
                {GOAL_RATING_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Payoff</span>
              <select value={draft.payoff} onChange={(e) => setDraft({ ...draft, payoff: Number(e.target.value) })}>
                {GOAL_RATING_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="wizard-step">
          <p className="wizard-question">What are your first concrete steps?</p>
          <p className="wizard-hint">Each step should be small enough to finish in one focus session. These become your milestones.</p>
          <div className="wizard-steps-list">
            {[0, 1, 2, 3, 4].map((i) => (
              <label key={i} className="field wizard-step-input">
                <span>Step {i + 1}{i >= 3 ? <em className="optional-label"> (optional)</em> : ''}</span>
                <input
                  autoFocus={i === 0}
                  value={draft.draftSteps[i] ?? ''}
                  onChange={(e) => setStepVal(i, e.target.value)}
                  placeholder={i === 0 ? 'e.g. Sketch the site structure on paper' : i === 1 ? 'e.g. Set up the repo and pick a template' : ''}
                />
              </label>
            ))}
          </div>
          {showWeeklyFocus && (
            <label className="field">
              <span>This week&apos;s focus</span>
              <textarea
                rows={2}
                value={draft.weeklyFocus}
                onChange={(e) => setDraft({ ...draft, weeklyFocus: e.target.value })}
                placeholder="What is the one move for this week?"
              />
            </label>
          )}
          {showPlacement && (
            <label className="field">
              <span>Place this goal</span>
              <select value={status} onChange={(e) => setStatus(e.target.value as Exclude<GoalStatus, 'completed'>)}>
                {GOAL_PLACEMENT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>
          )}
        </div>
      )}

      <div className="wizard-nav">
        <button className="ghost-button" type="button" onClick={step === 1 ? onCancel : () => setStep(step - 1)}>
          {step === 1 ? 'Cancel' : '← Back'}
        </button>
        {step < TOTAL ? (
          <button
            className="primary-button"
            type="button"
            disabled={step === 1 ? !canProceed1 : step === 2 ? !canProceed2 : false}
            onClick={() => setStep(step + 1)}
          >
            Next →
          </button>
        ) : (
          <button className="primary-button" type="button" disabled={!canFinish} onClick={onSubmit}>
            {isEditing ? 'Save changes' : 'Create goal'}
          </button>
        )}
      </div>
    </div>
  );
}

function GoalModal({
  open,
  title,
  initialGoal,
  defaultStatus = 'parked',
  onClose,
  onSubmit,
}: {
  open: boolean;
  title: string;
  initialGoal?: Goal | null;
  onClose: () => void;
  defaultStatus?: Exclude<GoalStatus, 'completed'>;
  onSubmit: (input: GoalWriteInput, status: Exclude<GoalStatus, 'completed'>, steps: string[]) => void;
}) {
  const [draft, setDraft] = useState<OnboardingDraft>({
    ...EMPTY_ONBOARDING_DRAFT,
    ...createGoalDraft(initialGoal),
  });
  const [status, setStatus] = useState<Exclude<GoalStatus, 'completed'>>(
    initialGoal?.status === 'completed' ? defaultStatus : initialGoal?.status ?? defaultStatus
  );

  useEffect(() => {
    if (!open) return;
    setDraft({ ...EMPTY_ONBOARDING_DRAFT, ...createGoalDraft(initialGoal) });
    setStatus(initialGoal?.status === 'completed' ? defaultStatus : initialGoal?.status ?? defaultStatus);
  }, [defaultStatus, initialGoal, open]);

  return (
    <Modal open={open} title={title} onClose={onClose}>
      <GoalWizard
        draft={draft}
        setDraft={setDraft}
        status={status}
        setStatus={setStatus}
        showPlacement
        isEditing={!!initialGoal}
        onCancel={onClose}
        onSubmit={() => {
          onSubmit(toGoalWriteInput(draft), status, draft.draftSteps);
          onClose();
        }}
      />
    </Modal>
  );
}

const TIER_LABELS: { tier: TaskTier; label: string }[] = [
  { tier: 1, label: 'T1 · 5xp' },
  { tier: 2, label: 'T2 · 15xp' },
  { tier: 3, label: 'T3 · 40xp' },
  { tier: 4, label: 'T4 · 100xp' },
  { tier: 5, label: 'T5 · 300xp' },
];

function TaskModal({
  open,
  title,
  projects,
  selectedProjectId,
  initialTitle,
  onClose,
  onSubmit,
}: {
  open: boolean;
  title: string;
  projects: Project[];
  selectedProjectId: string | null;
  initialTitle?: string;
  onClose: () => void;
  onSubmit: (title: string, nextStep: string, projectId: string | null, tier: TaskTier) => void;
}) {
  const [taskTitle, setTaskTitle] = useState(initialTitle ?? '');
  const [nextStep, setNextStep] = useState('');
  const [projectId, setProjectId] = useState<string | null>(selectedProjectId);
  const [tier, setTier] = useState<TaskTier>(2);

  useEffect(() => {
    if (!open) {
      return;
    }

    setTaskTitle(initialTitle ?? '');
    setNextStep('');
    setProjectId(selectedProjectId);
    setTier(2);
  }, [initialTitle, open, selectedProjectId]);

  const canSubmit = taskTitle.trim().length > 0;

  return (
    <Modal open={open} title={title} onClose={onClose}>
      <form
        className="stack"
        onSubmit={(event) => {
          event.preventDefault();
          if (!canSubmit) {
            return;
          }

          onSubmit(taskTitle.trim(), nextStep.trim(), projectId, tier);
          onClose();
        }}
      >
        <label className="field">
          <span>Task title</span>
          <input
            value={taskTitle}
            onChange={(event) => setTaskTitle(event.target.value)}
            placeholder="One concrete action"
          />
        </label>

        <label className="field">
          <span>Next step</span>
          <input
            value={nextStep}
            onChange={(event) => setNextStep(event.target.value)}
            placeholder="Optional focus helper"
          />
        </label>

        <label className="field">
          <span>Project</span>
          <select value={projectId ?? ''} onChange={(event) => setProjectId(event.target.value || null)}>
            <option value="">No project</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </label>

        <div className="field">
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted, #888)' }}>Tier</span>
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.4rem' }}>
            {TIER_LABELS.map(({ tier: t, label }) => (
              <button
                key={t}
                type="button"
                onClick={() => setTier(t)}
                style={{
                  padding: '0.25rem 0.6rem',
                  borderRadius: '999px',
                  border: '1px solid',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  borderColor: tier === t ? 'var(--accent, #6c63ff)' : 'var(--border, #ccc)',
                  background: tier === t ? 'var(--accent, #6c63ff)' : 'transparent',
                  color: tier === t ? '#fff' : 'inherit',
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="form-actions">
          <button className="secondary-button" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary-button" type="submit" disabled={!canSubmit}>
            Save task
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ProjectManagerModal({
  open,
  projects,
  goalId,
  onClose,
}: {
  open: boolean;
  projects: Project[];
  goalId: string | null;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [color, setColor] = useState(PROJECT_COLORS[0]);

  useEffect(() => {
    if (open) {
      setName('');
      setColor(PROJECT_COLORS[0]);
    }
  }, [open]);

  return (
    <Modal open={open} title="Projects" onClose={onClose}>
      <div className="stack">
        <div className="chips">
          {projects.map((project) => (
            <div className="project-row" key={project.id}>
              <div className="project-pill">
                <span className="project-dot" style={{ backgroundColor: project.color }} />
                {project.name}
              </div>
              <button
                className="ghost-button danger-text"
                type="button"
                onClick={() => {
                  if (window.confirm(`Delete ${project.name}?`)) {
                    mutate(() => db.dbDeleteProject(project.id));
                  }
                }}
              >
                Delete
              </button>
            </div>
          ))}
        </div>

        {goalId ? (
          <form
            className="stack"
            onSubmit={(event) => {
              event.preventDefault();
              if (!name.trim()) {
                return;
              }
              mutate(() => db.dbCreateProject(goalId, name.trim(), color));
              setName('');
            }}
          >
            <label className="field">
              <span>New project</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Project name"
              />
            </label>
            <div className="chips">
              {PROJECT_COLORS.map((swatch) => (
                <button
                  key={swatch}
                  className={`swatch ${color === swatch ? 'is-active' : ''}`}
                  type="button"
                  style={{ backgroundColor: swatch }}
                  onClick={() => setColor(swatch)}
                />
              ))}
            </div>
            <button className="primary-button" type="submit" disabled={!name.trim()}>
              Add project
            </button>
          </form>
        ) : null}
      </div>
    </Modal>
  );
}

function TaskRow({
  task,
  project,
  onToggle,
  onFocus,
  onDrop,
}: {
  task: DailyTask;
  project?: Project | null;
  onToggle: () => void;
  onFocus?: () => void;
  onDrop: () => void;
}) {
  return (
    <div className={`task-row ${task.status === 'done' ? 'is-done' : ''} ${task.isRecoveryTask ? 'is-recovery' : ''}`}>
      <button className={`check-button ${task.status === 'done' ? 'is-done' : ''}`} onClick={onToggle} type="button">
        {task.status === 'done' ? '✓' : ''}
      </button>
      <div className="task-copy">
        <div className="task-title-row">
          <h4>{task.title}</h4>
          <div className="task-badges">
            <span className="tier-badge">T{task.tier ?? 2}</span>
            <span className="xp-badge">{TIER_XP[task.tier ?? 2]} XP</span>
            {task.isRecoveryTask ? (
              <span className={task.status === 'done' ? 'recovery-badge is-complete' : 'recovery-badge'}>
                {task.status === 'done' ? 'Recovery complete: +10 build health' : 'Recovery task assigned'}
              </span>
            ) : null}
            {project ? (
              <span className="project-pill">
                <span className="project-dot" style={{ backgroundColor: project.color }} />
                {project.name}
              </span>
            ) : null}
          </div>
        </div>
        {task.nextStep ? <p>{task.nextStep}</p> : null}
        {task.isRecoveryTask ? (
          <p className={task.status === 'done' ? 'recovery-copy is-complete' : 'recovery-copy'}>
            {task.status === 'done' ? 'Recovery complete: +10 build health' : 'Recovery task assigned'}
          </p>
        ) : null}
      </div>
      <div className="task-actions">
        {task.status !== 'done' && onFocus ? (
          <button className="ghost-button" onClick={onFocus} type="button">
            Focus
          </button>
        ) : null}
        <button className="ghost-button danger-text" onClick={onDrop} type="button">
          Drop
        </button>
      </div>
    </div>
  );
}

// ─── Habits UI ────────────────────────────────────────────────────────────────

const CADENCE_OPTIONS: Array<{ value: HabitCadenceType; label: string }> = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekdays', label: 'Weekdays' },
  { value: 'n_per_week', label: 'N per week' },
  { value: 'custom_days', label: 'Custom days' },
];

const CUE_OPTIONS: Array<{ value: HabitCueType; label: string; hint: string }> = [
  { value: 'stack', label: 'After...', hint: 'e.g. "after morning coffee"' },
  { value: 'time', label: 'At time', hint: 'e.g. "8:00"' },
  { value: 'location', label: 'At place', hint: 'e.g. "at desk"' },
  { value: 'free', label: 'None', hint: 'Anchor-free (hardest)' },
];

const DOT_CLASS: Record<'done' | 'miss' | 'skip' | 'off', string> = {
  done: 'habit-dot is-done',
  miss: 'habit-dot is-miss',
  skip: 'habit-dot is-skip',
  off: 'habit-dot is-off',
};

function HabitModal({
  open,
  initial,
  goals,
  onClose,
  onSubmit,
  onDelete,
}: {
  open: boolean;
  initial: Habit | null;
  goals: Goal[];
  onClose: () => void;
  onSubmit: (input: HabitWriteInput) => void;
  onDelete?: () => void;
}) {
  const [title, setTitle] = useState('');
  const [cue, setCue] = useState('');
  const [cueType, setCueType] = useState<HabitCueType>('stack');
  const [identity, setIdentity] = useState('');
  const [cadenceType, setCadenceType] = useState<HabitCadenceType>('daily');
  const [cadenceTarget, setCadenceTarget] = useState(3);
  const [cadenceDays, setCadenceDays] = useState<number[]>([]);
  const [goalId, setGoalId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTitle(initial?.title ?? '');
    setCue(initial?.cue ?? '');
    setCueType(initial?.cueType ?? 'stack');
    setIdentity(initial?.identityStatement ?? '');
    setCadenceType(initial?.cadenceType ?? 'daily');
    setCadenceTarget(initial?.cadenceTarget ?? 3);
    setCadenceDays(initial?.cadenceDays ?? []);
    setGoalId(initial?.goalId ?? null);
  }, [open, initial]);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    onSubmit({
      title: title.trim(),
      cue: cue.trim(),
      cueType,
      identityStatement: identity.trim(),
      cadenceType,
      cadenceTarget,
      cadenceDays,
      goalId,
    });
    onClose();
  }

  return (
    <Modal open={open} title={initial ? 'Edit habit' : 'New habit'} onClose={onClose}>
      <form onSubmit={submit} className="stack">
        <label className="field">
          <span>Habit (2-min version)</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Do 2 pushups"
            autoFocus
          />
          <small className="muted-copy">Start absurdly small. Scale later.</small>
        </label>

        <label className="field">
          <span>I am someone who... (optional)</span>
          <input
            value={identity}
            onChange={(e) => setIdentity(e.target.value)}
            placeholder="...moves their body every morning"
          />
        </label>

        <div className="field">
          <span>Cue</span>
          <div className="chips">
            {CUE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`chip ${cueType === opt.value ? 'is-active' : ''}`}
                onClick={() => setCueType(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {cueType !== 'free' ? (
            <input
              value={cue}
              onChange={(e) => setCue(e.target.value)}
              placeholder={CUE_OPTIONS.find((o) => o.value === cueType)?.hint ?? ''}
            />
          ) : null}
        </div>

        <div className="field">
          <span>Cadence</span>
          <div className="chips">
            {CADENCE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`chip ${cadenceType === opt.value ? 'is-active' : ''}`}
                onClick={() => setCadenceType(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {cadenceType === 'n_per_week' ? (
            <label className="field">
              <span>Target per week</span>
              <input
                type="number"
                min={1}
                max={7}
                value={cadenceTarget}
                onChange={(e) => setCadenceTarget(Math.max(1, Math.min(7, Number(e.target.value) || 1)))}
              />
            </label>
          ) : null}
          {cadenceType === 'custom_days' ? (
            <div className="chips">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d, i) => (
                <button
                  key={d}
                  type="button"
                  className={`chip ${cadenceDays.includes(i) ? 'is-active' : ''}`}
                  onClick={() =>
                    setCadenceDays((prev) =>
                      prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i].sort()
                    )
                  }
                >
                  {d}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {goals.length > 0 ? (
          <label className="field">
            <span>Link to goal (optional)</span>
            <select value={goalId ?? ''} onChange={(e) => setGoalId(e.target.value || null)}>
              <option value="">Standalone</option>
              {goals.filter((g) => g.id !== STANDALONE_TASKS_GOAL_ID).map((g) => (
                <option key={g.id} value={g.id}>{g.title}</option>
              ))}
            </select>
          </label>
        ) : null}

        <div className="modal-actions">
          {initial && onDelete ? (
            <button
              type="button"
              className="ghost-button danger-text"
              onClick={() => {
                if (window.confirm(`Delete habit "${initial.title}" and all its history?`)) {
                  onDelete();
                  onClose();
                }
              }}
            >
              Delete
            </button>
          ) : null}
          <button type="button" className="ghost-button" onClick={onClose}>Cancel</button>
          <button type="submit" className="primary-button" disabled={!title.trim()}>
            {initial ? 'Save' : 'Create habit'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function HabitsSection({
  habitsToday,
  goals,
}: {
  habitsToday: HabitTodayView[];
  goals: Goal[];
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Habit | null>(null);

  const scheduled = habitsToday.filter((h) => h.scheduledToday);
  const offToday = habitsToday.filter((h) => !h.scheduledToday);
  const doneCount = scheduled.filter((h) => h.todayStatus === 'done').length;

  function toggleDone(view: HabitTodayView) {
    if (view.todayStatus === 'done') {
      mutate(() => db.dbClearHabitCompletion(view.habit.id, todayString()));
    } else {
      mutate(() => db.dbLogHabitCompletion(view.habit.id, todayString(), 'done'));
    }
  }

  return (
    <section className="card">
      <div className="section-header">
        <div>
          <p className="eyebrow">Habits</p>
          <h3>{habitsToday.length === 0 ? 'Build something repeatable' : 'Small reps, compounding'}</h3>
        </div>
        <div className="inline-actions">
          {scheduled.length > 0 ? (
            <span className="metric-chip">{doneCount}/{scheduled.length}</span>
          ) : null}
          <button
            className="primary-button"
            type="button"
            onClick={() => {
              setEditing(null);
              setModalOpen(true);
            }}
          >
            Add habit
          </button>
        </div>
      </div>

      {habitsToday.length === 0 ? (
        <p className="muted-copy">
          Habits are repeated, cue-anchored actions. Start with one 2-minute habit. Science says automaticity averages ~66 days — not 21.
        </p>
      ) : (
        <div className="stack">
          {scheduled.map((view) => (
            <HabitRow key={view.habit.id} view={view} onToggle={() => toggleDone(view)} onEdit={() => { setEditing(view.habit); setModalOpen(true); }} />
          ))}
          {offToday.length > 0 ? (
            <details className="habit-off-details">
              <summary className="muted-copy">Not scheduled today ({offToday.length})</summary>
              <div className="stack">
                {offToday.map((view) => (
                  <HabitRow key={view.habit.id} view={view} onToggle={() => toggleDone(view)} onEdit={() => { setEditing(view.habit); setModalOpen(true); }} dimmed />
                ))}
              </div>
            </details>
          ) : null}
        </div>
      )}

      <HabitModal
        open={modalOpen}
        initial={editing}
        goals={goals}
        onClose={() => setModalOpen(false)}
        onSubmit={(input) => {
          if (editing) {
            mutate(() => db.dbUpdateHabit(editing.id, input));
          } else {
            mutate(() => db.dbCreateHabit(input));
          }
        }}
        onDelete={editing ? () => mutate(() => db.dbDeleteHabit(editing.id)) : undefined}
      />
    </section>
  );
}

function HabitRow({
  view,
  onToggle,
  onEdit,
  dimmed = false,
}: {
  view: HabitTodayView;
  onToggle: () => void;
  onEdit: () => void;
  dimmed?: boolean;
}) {
  const { habit, todayStatus, streak, recentDots } = view;
  const done = todayStatus === 'done';
  return (
    <div className={`habit-row ${dimmed ? 'is-dimmed' : ''} ${done ? 'is-done' : ''}`}>
      <button
        type="button"
        className={`habit-check ${done ? 'is-done' : ''}`}
        onClick={onToggle}
        aria-label={done ? 'Mark not done' : 'Mark done'}
      >
        {done ? '✓' : ''}
      </button>
      <button type="button" className="habit-body" onClick={onEdit}>
        <div className="habit-title-row">
          <span className="habit-title">{habit.title}</span>
          {streak > 0 ? <span className="habit-streak">🔥 {streak}</span> : null}
        </div>
        <div className="habit-meta">
          {habit.cue ? <span className="habit-cue">{habit.cueType === 'stack' ? 'after ' : ''}{habit.cue}</span> : null}
          <span className="habit-dots">
            {recentDots.map((kind, i) => (
              <span key={i} className={DOT_CLASS[kind]} />
            ))}
          </span>
        </div>
      </button>
    </div>
  );
}

function AppShell() {
  const reviewDue = useDataSnapshot(() => db.dbIsReviewDue());

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <div>
          <p className="eyebrow">Focus</p>
          <h1>One goal. Three tasks.</h1>
          <p className="shell-copy">
            Standard React app, plain browser storage, no Expo web layer.
          </p>
        </div>

        <nav className="nav-stack">
          <NavLink className="nav-link" to="/today">
            Today
          </NavLink>
          <NavLink className="nav-link" to="/calendar">
            Calendar
          </NavLink>
          <NavLink className="nav-link" to="/goals">
            Goals
          </NavLink>
          <NavLink className="nav-link" to="/review">
            Review
            {reviewDue ? <span className="badge">Due</span> : null}
          </NavLink>
          <NavLink className="nav-link" to="/inspection">
            Inspect
          </NavLink>
          <NavLink className="nav-link" to="/build">
            Build
          </NavLink>
          <NavLink className="nav-link" to="/backup">
            Backup
          </NavLink>
        </nav>
      </aside>

      <main className="page-shell">
        <Outlet />
      </main>
    </div>
  );
}

function LegacyTodayPage() {
  const navigate = useNavigate();
  const {
    activeGoalId,
    tasks,
    projects,
    brainDumpItems,
    resumeContext,
    habitsToday,
    goals,
  } = useDataSnapshot(() => {
    const activeGoal = db.dbGetActiveGoal();
    return {
      activeGoalId: activeGoal?.id ?? null,
      tasks: db.dbGetTodayTasks(),
      projects: activeGoal ? db.dbGetProjects(activeGoal.id) : [],
      brainDumpItems: db.dbGetBrainDumpItems(),
      resumeContext: db.dbGetResumeContext(),
      habitsToday: db.dbGetTodayHabits(),
      goals: db.dbGetGoals(),
    };
  });

  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [ideasOpen, setIdeasOpen] = useState(false);
  const [projectFilter, setProjectFilter] = useState<string | null>(null);
  const [secondaryAddOpen, setSecondaryAddOpen] = useState(false);
  const [secondaryTaskDraft, setSecondaryTaskDraft] = useState('');
  const [brainDumpDraft, setBrainDumpDraft] = useState('');

  const mainTasks = (projectFilter ? tasks.filter((task) => task.projectId === projectFilter) : tasks).filter(
    (task) => task.goalId !== STANDALONE_TASKS_GOAL_ID && task.taskType === 'goal'
  );
  const secondaryTasks = tasks.filter(
    (task) => task.goalId === STANDALONE_TASKS_GOAL_ID || task.taskType !== 'goal'
  );
  const firstPending = mainTasks.find((task) => task.status === 'pending') ?? null;
  const groupedTasks = mainTasks.reduce<Record<string, DailyTask[]>>((groups, task) => {
    const key = task.projectId ?? 'none';
    groups[key] = groups[key] ?? [];
    groups[key].push(task);
    return groups;
  }, {});
  const createSecondaryTask = (title: string) => {
    const trimmed = title.trim();
    if (!trimmed) {
      return;
    }

    const result = mutate(() =>
      db.dbCreateTask(trimmed, '', null, {
        taskType: 'admin',
      })
    );

    if (!result.ok) {
      window.alert("Today's task lane is full.");
      return;
    }

    setSecondaryTaskDraft('');
    setSecondaryAddOpen(false);
  };

  return (
    <>
      <section className="page-header">
        <div>
          <p className="eyebrow">Today</p>
          <h2>{formatDisplayDate()}</h2>
        </div>
        <div className="header-actions">
          <button className="secondary-button" type="button" onClick={() => setProjectModalOpen(true)}>
            Projects
          </button>
          <button
            className="primary-button"
            type="button"
            onClick={() => setSecondaryAddOpen(true)}
          >
            Add task
          </button>
        </div>
      </section>

      {resumeContext ? (
        <section className="card banner-card">
          <div>
            <p className="eyebrow">Resume</p>
            <h3>{resumeContext.taskTitle}</h3>
            <p className="muted-copy">
              {resumeContext.kind === 'focus-session'
                ? 'You have a focus session ready to resume.'
                : `Still pending from ${formatShortDate(resumeContext.fromDate)}.`}
            </p>
          </div>
          <div className="inline-actions">
            <button
              className="primary-button"
              type="button"
              onClick={() => {
                if (resumeContext.kind === 'focus-session') {
                  navigate(`/focus?taskId=${resumeContext.taskId}&sessionId=${resumeContext.focusSessionId}`);
                  return;
                }

                const result = mutate(() => db.dbCarryForwardTask(resumeContext.taskId));
                if (!result.ok) {
                  window.alert("Today's task lane is already full.");
                }
              }}
            >
              {resumeContext.kind === 'focus-session' ? 'Resume focus' : 'Carry forward'}
            </button>
            <button
              className="ghost-button"
              type="button"
              onClick={() => mutate(() => db.dbDismissResumeContext(resumeContext))}
            >
              Dismiss
            </button>
          </div>
        </section>
      ) : null}

      {projects.length > 0 ? (
        <section className="chips">
          <button
            className={`chip ${projectFilter === null ? 'is-active' : ''}`}
            type="button"
            onClick={() => setProjectFilter(null)}
          >
            All
          </button>
          {projects.map((project) => (
            <button
              key={project.id}
              className={`chip ${projectFilter === project.id ? 'is-active' : ''}`}
              type="button"
              onClick={() => setProjectFilter(project.id)}
            >
              <span className="project-dot" style={{ backgroundColor: project.color }} />
              {project.name}
            </button>
          ))}
        </section>
      ) : null}

      {firstPending ? (
        <section className="card next-up-card">
          <div>
            <p className="eyebrow">Next up</p>
            <h3>{firstPending.title}</h3>
          </div>
          <button
            className="primary-button"
            type="button"
            onClick={() => navigate(`/focus?taskId=${firstPending.id}`)}
          >
            Start focus
          </button>
        </section>
      ) : null}

      <section className="card">
        <div className="section-header">
          <div>
            <p className="eyebrow">Main tasks</p>
            <h3>{mainTasks.length === 0 ? 'Nothing queued' : 'Priority work'}</h3>
          </div>
          <span className="metric-chip">{mainTasks.filter((task) => task.status === 'done').length}/{mainTasks.length}</span>
        </div>

        {mainTasks.length === 0 ? (
          <p className="muted-copy">
            {projectFilter ? 'No main tasks in this project today.' : 'No main tasks queued for today.'}
          </p>
        ) : (
          <div className="stack">
            {Object.entries(groupedTasks).map(([key, grouped]) => {
              const project = projects.find((candidate) => candidate.id === key) ?? null;
              return (
                <div className="stack" key={key}>
                  {project ? (
                    <div className="group-heading">
                      <span className="project-dot" style={{ backgroundColor: project.color }} />
                      {project.name}
                    </div>
                  ) : null}
                  {grouped.map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      project={project}
                      onToggle={() =>
                        mutate(() =>
                          task.status === 'done'
                            ? db.dbUncompleteTask(task.id)
                            : db.dbCompleteTask(task.id)
                        )
                      }
                      onFocus={() => navigate(`/focus?taskId=${task.id}`)}
                      onDrop={() => {
                        if (window.confirm(`Drop "${task.title}"?`)) {
                          mutate(() => db.dbDropTask(task.id));
                        }
                      }}
                    />
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="card">
        <div className="section-header">
          <div>
            <p className="eyebrow">Secondary tasks</p>
            <h3>{secondaryTasks.length === 0 ? 'Life admin and loose ends' : 'Everything else'}</h3>
          </div>
          <div className="inline-actions">
            <span className="metric-chip">{secondaryTasks.filter((task) => task.status === 'done').length}/{secondaryTasks.length}</span>
            <button className="primary-button" type="button" onClick={() => setSecondaryAddOpen(true)}>
              {secondaryTasks.length === 0 ? 'Add your first task' : 'Add task'}
            </button>
          </div>
        </div>

        {secondaryAddOpen ? (
          <form
            className="inline-form"
            onSubmit={(event) => {
              event.preventDefault();
              createSecondaryTask(secondaryTaskDraft);
            }}
          >
            <input
              autoFocus
              value={secondaryTaskDraft}
              onChange={(event) => setSecondaryTaskDraft(event.target.value)}
              placeholder="Type a task"
            />
            <button className="primary-button" type="submit" disabled={!secondaryTaskDraft.trim()}>
              Add
            </button>
          </form>
        ) : null}

        {secondaryTasks.length === 0 ? (
          <p className="muted-copy">Life admin and other extra tasks land here.</p>
        ) : (
          <div className="stack">
            {secondaryTasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                onToggle={() =>
                  mutate(() =>
                    task.status === 'done'
                      ? db.dbUncompleteTask(task.id)
                      : db.dbCompleteTask(task.id)
                  )
                }
                onDrop={() => {
                  if (window.confirm(`Drop "${task.title}"?`)) {
                    mutate(() => db.dbDropTask(task.id));
                  }
                }}
              />
            ))}
          </div>
        )}
      </section>

      <HabitsSection habitsToday={habitsToday} goals={goals} />

      <section className="card">
        <div className="section-header">
          <div>
            <p className="eyebrow">Brain dump & future ideas</p>
            <h3>Capture it, then hide it</h3>
          </div>
        </div>

        <form
          className="inline-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (!brainDumpDraft.trim()) {
              return;
            }
            mutate(() => db.dbAddBrainDumpItem(brainDumpDraft.trim()));
            setBrainDumpDraft('');
            setIdeasOpen(false);
          }}
        >
          <input
            value={brainDumpDraft}
            onChange={(event) => setBrainDumpDraft(event.target.value)}
            placeholder="What needs parking?"
          />
          <button className="primary-button" type="submit" disabled={!brainDumpDraft.trim()}>
            Save
          </button>
        </form>

        {brainDumpItems.length > 0 ? (
          <div className="stack">
            <button className="ghost-button align-start" type="button" onClick={() => setIdeasOpen((value) => !value)}>
              {ideasOpen ? 'Hide parked ideas' : `Show parked ideas (${brainDumpItems.length})`}
            </button>
            {ideasOpen ? (
              <div className="stack">
                {brainDumpItems.map((item) => (
                  <div className="idea-card" key={item.id}>
                    <p>{item.text}</p>
                    <div className="inline-actions">
                      <button
                        className="ghost-button"
                        type="button"
                        onClick={() => {
                          mutate(() => db.dbDeleteBrainDumpItem(item.id));
                          setSecondaryTaskDraft(item.text);
                          setSecondaryAddOpen(true);
                        }}
                      >
                        Promote to task
                      </button>
                      <button className="ghost-button danger-text" type="button" onClick={() => mutate(() => db.dbDeleteBrainDumpItem(item.id))}>
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <p className="muted-copy">Ideas stay here until you deliberately promote them.</p>
        )}
      </section>

      <ProjectManagerModal
        open={projectModalOpen}
        projects={projects}
        goalId={activeGoalId}
        onClose={() => setProjectModalOpen(false)}
      />
    </>
  );
}

function TodayPage() {
  const navigate = useNavigate();
  const { activeGoal, tasks, projects, resumeContext, stats } = useDataSnapshot(() => {
    const currentGoal = db.dbGetActiveGoal();
    return {
      activeGoal: currentGoal,
      tasks: db.dbGetTodayTasks(),
      projects: currentGoal ? db.dbGetProjects(currentGoal.id) : [],
      resumeContext: db.dbGetResumeContext(),
      stats: currentGoal ? db.dbGetGameStats(currentGoal.id) : null,
    };
  });

  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [projectFilter, setProjectFilter] = useState<string | null>(null);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [feedback, setFeedback] = useState<string[]>([]);

  useEffect(() => {
    if (feedback.length === 0) return;
    const timeout = window.setTimeout(() => setFeedback([]), 2600);
    return () => window.clearTimeout(timeout);
  }, [feedback]);

  const visibleTasks = projectFilter
    ? tasks.filter((task) => task.projectId === projectFilter)
    : tasks;
  const doneTasks = tasks.filter((task) => task.status === 'done');
  const pendingTasks = tasks.filter((task) => task.status === 'pending');
  const xpAvailable = tasks.reduce((sum, task) => sum + TIER_XP[task.tier ?? 2], 0);
  const xpEarned = doneTasks.reduce((sum, task) => sum + TIER_XP[task.tier ?? 2], 0);
  const currentStats = stats ?? (activeGoal ? db.dbGetGameStats(activeGoal.id) : null);
  const requirement = currentStats?.dailyRequirement ?? (activeGoal ? db.getDailyRequirement(activeGoal) : null);
  const goalStatus = activeGoal?.performanceStatus ?? 'on_track';
  const formattedStatus = goalStatus.replace('_', ' ');
  const dailyComplete = activeGoal ? db.isValidDay(activeGoal, doneTasks) : false;
  const firstPending = pendingTasks[0] ?? null;

  const handleToggleTask = (task: DailyTask) => {
    if (!activeGoal) return;

    if (task.status === 'done') {
      mutate(() => db.dbUncompleteTask(task.id));
      setFeedback([]);
      return;
    }

    const wasValid = db.isValidDay(activeGoal, doneTasks);
    const result = mutate(() => {
      db.dbCompleteTask(task.id);
      const nextTasks = db.dbGetTodayTasks();
      const nextDone = nextTasks.filter((candidate) => candidate.status === 'done');
      return { valid: db.isValidDay(activeGoal, nextDone) };
    });

    const messages = [`+${TIER_XP[task.tier ?? 2]} XP`];
    if (result.valid && !wasValid) {
      messages.push('Daily requirement complete');
    }
    if (result.valid) {
      messages.push('Streak maintained');
    }
    setFeedback(messages);
  };

  return (
    <>
      <section className="page-header">
        <div>
          <p className="eyebrow">Today</p>
          <h2>Show up to work</h2>
          <p className="muted-copy">{formatDisplayDate()}</p>
        </div>
        <div className="header-actions">
          <button className="secondary-button" type="button" onClick={() => setProjectModalOpen(true)}>
            Projects
          </button>
          <button
            className="primary-button"
            type="button"
            disabled={!activeGoal || tasks.length >= DAILY_CAP}
            onClick={() => setTaskModalOpen(true)}
          >
            Add task
          </button>
        </div>
      </section>

      <section className="work-dashboard">
        <div className="work-dashboard-main">
          <p className="eyebrow">Active goal</p>
          <h3>{activeGoal?.title ?? 'No active goal'}</h3>
          <p className="work-phase">
            {requirement ? `Phase ${requirement.phase}: ${requirement.phaseName}` : 'Set a goal to begin'}
          </p>
          <p className="work-minimum">{requirement?.minimumCopy ?? 'Minimum required: 1 task.'}</p>
        </div>
        <div className="work-metrics">
          <div>
            <span>XP available</span>
            <strong>{xpAvailable}</strong>
          </div>
          <div>
            <span>XP earned</span>
            <strong>{xpEarned}</strong>
          </div>
          <div>
            <span>Streak</span>
            <strong>{currentStats?.currentStreak ?? activeGoal?.currentStreak ?? 0}</strong>
          </div>
          <div>
            <span>Build health</span>
            <strong>{currentStats?.buildHealth ?? activeGoal?.buildHealth ?? 100}</strong>
          </div>
          <div>
            <span>Status</span>
            <strong className={`status-text is-${goalStatus}`}>{formattedStatus}</strong>
          </div>
        </div>
      </section>

      {feedback.length > 0 ? (
        <section className="feedback-strip">
          {feedback.map((message) => (
            <span key={message}>{message}</span>
          ))}
        </section>
      ) : null}

      {resumeContext ? (
        <section className="card banner-card">
          <div>
            <p className="eyebrow">Resume</p>
            <h3>{resumeContext.taskTitle}</h3>
            <p className="muted-copy">
              {resumeContext.kind === 'focus-session'
                ? 'You have a focus session ready to resume.'
                : `Still pending from ${formatShortDate(resumeContext.fromDate)}.`}
            </p>
          </div>
          <div className="inline-actions">
            <button
              className="primary-button"
              type="button"
              onClick={() => {
                if (resumeContext.kind === 'focus-session') {
                  navigate(`/focus?taskId=${resumeContext.taskId}&sessionId=${resumeContext.focusSessionId}`);
                  return;
                }
                const result = mutate(() => db.dbCarryForwardTask(resumeContext.taskId));
                if (!result.ok) window.alert("Today's task lane is already full.");
              }}
            >
              {resumeContext.kind === 'focus-session' ? 'Resume focus' : 'Carry forward'}
            </button>
            <button
              className="ghost-button"
              type="button"
              onClick={() => mutate(() => db.dbDismissResumeContext(resumeContext))}
            >
              Dismiss
            </button>
          </div>
        </section>
      ) : null}

      {projects.length > 0 ? (
        <section className="chips">
          <button
            className={`chip ${projectFilter === null ? 'is-active' : ''}`}
            type="button"
            onClick={() => setProjectFilter(null)}
          >
            All
          </button>
          {projects.map((project) => (
            <button
              key={project.id}
              className={`chip ${projectFilter === project.id ? 'is-active' : ''}`}
              type="button"
              onClick={() => setProjectFilter(project.id)}
            >
              <span className="project-dot" style={{ backgroundColor: project.color }} />
              {project.name}
            </button>
          ))}
        </section>
      ) : null}

      {firstPending ? (
        <section className="card next-up-card">
          <div>
            <p className="eyebrow">Next up</p>
            <h3>{firstPending.title}</h3>
          </div>
          <button className="primary-button" type="button" onClick={() => navigate(`/focus?taskId=${firstPending.id}`)}>
            Start focus
          </button>
        </section>
      ) : null}

      <section className="card">
        <div className="section-header">
          <div>
            <p className="eyebrow">Today's tasks</p>
            <h3>{tasks.length === 0 ? 'Nothing queued' : `${doneTasks.length}/${tasks.length} complete`}</h3>
          </div>
          <span className="metric-chip">max 3</span>
        </div>

        {dailyComplete ? (
          <div className="daily-complete-line">Daily requirement complete</div>
        ) : requirement ? (
          <p className="muted-copy">{requirement.minimumCopy}</p>
        ) : null}

        {visibleTasks.length === 0 ? (
          <p className="muted-copy">
            {projectFilter ? 'No tasks in this project today.' : 'Add up to 3 tasks and choose a tier for each one.'}
          </p>
        ) : (
          <div className="stack">
            {visibleTasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                project={projects.find((candidate) => candidate.id === task.projectId) ?? null}
                onToggle={() => handleToggleTask(task)}
                onFocus={() => navigate(`/focus?taskId=${task.id}`)}
                onDrop={() => {
                  if (window.confirm(`Drop "${task.title}"?`)) {
                    mutate(() => db.dbDropTask(task.id));
                  }
                }}
              />
            ))}
          </div>
        )}

        {tasks.length < DAILY_CAP ? (
          <button className="secondary-button align-start" type="button" disabled={!activeGoal} onClick={() => setTaskModalOpen(true)}>
            Add task
          </button>
        ) : (
          <p className="muted-copy">Task cap reached for today.</p>
        )}
      </section>

      <ProjectManagerModal
        open={projectModalOpen}
        projects={projects}
        goalId={activeGoal?.id ?? null}
        onClose={() => setProjectModalOpen(false)}
      />
      <TaskModal
        open={taskModalOpen}
        title="Add today's task"
        projects={projects}
        selectedProjectId={projectFilter}
        onClose={() => setTaskModalOpen(false)}
        onSubmit={(title, nextStep, projectId, tier) => {
          const result = mutate(() =>
            activeGoal
              ? db.dbCreateTask(title, activeGoal.id, null, {
                  nextStep,
                  projectId,
                  tier,
                })
              : { ok: false as const, reason: 'missing_goal' as const }
          );

          if (!result.ok) {
            window.alert("Today's 3-task limit is already full.");
          }
        }}
      />
    </>
  );
}

function CalendarPage() {
  const navigate = useNavigate();
  const today = todayString();
  const [viewMode, setViewMode] = useState<'month' | 'day'>('month');
  const [displayMonth, setDisplayMonth] = useState(getMonthStart(today));
  const [selectedDate, setSelectedDate] = useState(today);
  const [taskModalOpen, setTaskModalOpen] = useState(false);

  const monthDates = useMemo(() => getMonthGridDates(displayMonth), [displayMonth]);
  const datesToLoad = useMemo(() => Array.from(new Set([...monthDates, selectedDate])), [monthDates, selectedDate]);

  const { activeGoal, weeklyFocus, projects, tasksByDate } = useDataSnapshot(() => {
    const activeGoal = db.dbGetActiveGoal();
    return {
      activeGoal,
      weeklyFocus: activeGoal ? db.dbGetCurrentWeeklyFocus(activeGoal.id) : null,
      projects: activeGoal ? db.dbGetProjects(activeGoal.id) : [],
      tasksByDate: Object.fromEntries(datesToLoad.map((date) => [date, db.dbGetTasksForDate(date)])),
    };
  });

  const selectedTasks = tasksByDate[selectedDate] ?? [];
  const isPast = selectedDate < today;
  const isSelectedToday = selectedDate === today;
  const canAddMore = !isPast && selectedTasks.length < (isSelectedToday ? DAILY_CAP : Infinity);
  const selectedDoneCount = selectedTasks.filter((task) => task.status === 'done').length;

  return (
    <>
      <section className="page-header">
        <div>
          <p className="eyebrow">Calendar</p>
          <h2>Month and day planning</h2>
        </div>
        <div className="header-actions">
          <button
            className="secondary-button"
            type="button"
            onClick={() => {
              setSelectedDate(today);
              setDisplayMonth(getMonthStart(today));
              setViewMode('day');
            }}
          >
            Today
          </button>
          <button
            className="primary-button"
            type="button"
            disabled={!activeGoal || !canAddMore}
            onClick={() => setTaskModalOpen(true)}
          >
            Add task
          </button>
        </div>
      </section>

      <section className="chip-bar">
        <button className={`chip ${viewMode === 'month' ? 'is-active' : ''}`} type="button" onClick={() => setViewMode('month')}>
          Month
        </button>
        <button className={`chip ${viewMode === 'day' ? 'is-active' : ''}`} type="button" onClick={() => setViewMode('day')}>
          Day
        </button>
      </section>

      {viewMode === 'month' ? (
        <>
          <section className="card calendar-card">
            <div className="section-header">
              <button className="icon-button" type="button" onClick={() => setDisplayMonth(addMonths(displayMonth, -1))}>
                ‹
              </button>
              <h3>{formatMonthLabel(displayMonth)}</h3>
              <button className="icon-button" type="button" onClick={() => setDisplayMonth(addMonths(displayMonth, 1))}>
                ›
              </button>
            </div>

            <div className="weekday-row">
              {WEEKDAY_LABELS.map((label) => (
                <span key={label}>{label}</span>
              ))}
            </div>

            <div className="month-grid">
              {monthDates.map((date) => {
                const tasks = tasksByDate[date] ?? [];
                const doneCount = tasks.filter((task) => task.status === 'done').length;
                const isCurrentMonth = isDateInMonth(date, displayMonth);
                const isSelected = selectedDate === date;
                const isTodayCell = date === today;

                return (
                  <button
                    className={`month-cell ${isSelected ? 'is-selected' : ''} ${!isCurrentMonth ? 'is-muted' : ''} ${isTodayCell ? 'is-today' : ''}`}
                    key={date}
                    type="button"
                    onClick={() => {
                      setSelectedDate(date);
                      if (!isCurrentMonth) {
                        setDisplayMonth(getMonthStart(date));
                      }
                    }}
                  >
                    <span className="month-day">{parseDate(date).getDate()}</span>
                    {tasks.length > 0 ? (
                      <>
                        <span className="mini-count">{doneCount}/{tasks.length}</span>
                        <span className="mini-dots">
                          {tasks.slice(0, 3).map((task) => (
                            <span className={`mini-dot ${task.status === 'done' ? 'is-done' : ''}`} key={task.id} />
                          ))}
                        </span>
                      </>
                    ) : (
                      <span className="mini-free">free</span>
                    )}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="card">
            <div className="section-header">
              <div>
                <p className="eyebrow">Selected day</p>
                <h3>{selectedDate === today ? 'Today' : formatDisplayDate(parseDate(selectedDate))}</h3>
              </div>
              <button className="ghost-button" type="button" onClick={() => setViewMode('day')}>
                Open day
              </button>
            </div>
            {selectedTasks.length === 0 ? (
              <p className="muted-copy">{isPast ? 'Nothing was planned here.' : 'No tasks planned yet.'}</p>
            ) : (
              <div className="stack">
                {selectedTasks.slice(0, 3).map((task) => (
                  <div className="mini-row" key={task.id}>
                    <span className={`mini-dot ${task.status === 'done' ? 'is-done' : ''}`} />
                    <span>{task.title}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      ) : (
        <>
          <section className="card">
            <div className="section-header">
              <button className="icon-button" type="button" onClick={() => setSelectedDate(addDays(selectedDate, -1))}>
                ‹
              </button>
              <div>
                <p className="eyebrow">{formatMonthLabel(getMonthStart(selectedDate))}</p>
                <h3>{selectedDate === today ? `Today · ${formatDisplayDate(parseDate(selectedDate))}` : formatDisplayDate(parseDate(selectedDate))}</h3>
              </div>
              <button className="icon-button" type="button" onClick={() => setSelectedDate(addDays(selectedDate, 1))}>
                ›
              </button>
            </div>
            <p className="muted-copy">
              {selectedTasks.length === 0
                ? isPast
                  ? 'Nothing was planned for this day.'
                  : 'This day is clear so far.'
                : `${selectedDoneCount}/${selectedTasks.length} tasks finished.`}
            </p>
          </section>

          <section className="card">
            {!activeGoal ? (
              <p className="muted-copy">Set a goal before planning tasks.</p>
            ) : selectedTasks.length === 0 ? (
              <button className="primary-button" type="button" disabled={!canAddMore} onClick={() => setTaskModalOpen(true)}>
                Plan a task for this day
              </button>
            ) : (
              <div className="stack">
                {selectedTasks.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    project={projects.find((project) => project.id === task.projectId) ?? null}
                    onToggle={() =>
                      mutate(() =>
                        task.status === 'done'
                          ? db.dbUncompleteTask(task.id)
                          : db.dbCompleteTask(task.id)
                      )
                    }
                    onFocus={() => navigate(`/focus?taskId=${task.id}`)}
                    onDrop={() => mutate(() => db.dbDropTask(task.id))}
                  />
                ))}
              </div>
            )}
          </section>
        </>
      )}

      <TaskModal
        open={taskModalOpen}
        title={`Task for ${selectedDate === today ? 'today' : formatShortDate(selectedDate)}`}
        projects={projects}
        selectedProjectId={null}
        onClose={() => setTaskModalOpen(false)}
        onSubmit={(title, nextStep, projectId, tier) => {
          const result = mutate(() =>
            activeGoal
              ? db.dbCreateTask(title, activeGoal.id, weeklyFocus?.id, {
                  date: selectedDate,
                  nextStep,
                  projectId,
                  tier,
                })
              : { ok: false as const, reason: 'missing_goal' as const }
          );

          if (!result.ok) {
            window.alert('Could not save that task.');
          }
        }}
      />
    </>
  );
}

type GoalTreeProject = Project & {
  tasks: DailyTask[];
};

type GoalTreeNode = {
  goal: Goal;
  projects: GoalTreeProject[];
  looseTasks: DailyTask[];
  milestones: Milestone[];
  taskCount: number;
  doneCount: number;
};

function GoalTree({
  nodes,
  selectedGoalId,
  onSelectGoal,
  onBack,
  onEditGoal,
  onSetGoalStatus,
  onCompleteGoal,
  onToggleMilestone,
}: {
  nodes: GoalTreeNode[];
  selectedGoalId: string | null;
  onSelectGoal: (goalId: string) => void;
  onBack: () => void;
  onEditGoal: (goal: Goal) => void;
  onSetGoalStatus: (goalId: string, status: Exclude<GoalStatus, 'completed'>) => void;
  onCompleteGoal: (goalId: string) => void;
  onToggleMilestone: (id: string) => void;
}) {
  const selectedNode = nodes.find((node) => node.goal.id === selectedGoalId) ?? null;

  if (!selectedNode) {
    return (
      <section className="goal-tree">
        <div className="goal-tile-grid">
          {nodes.map((node) => (
            <button
              className={`goal-tile ${node.goal.status === 'active' ? 'is-active' : ''}`}
              key={node.goal.id}
              type="button"
              onClick={() => onSelectGoal(node.goal.id)}
            >
              <span className="eyebrow">{getGoalStatusLabel(node.goal.status)}</span>
              <strong>{node.goal.title}</strong>
              <span>{node.goal.targetOutcome}</span>
              <span className="goal-tree-meta">
                {node.milestones.length > 0
                  ? `${node.milestones.filter((m) => m.completedAt).length}/${node.milestones.length} steps · `
                  : ''}
                {node.projects.length} projects / {node.doneCount}/{node.taskCount} tasks
              </span>
            </button>
          ))}
        </div>
      </section>
    );
  }

  const { goal, projects, looseTasks, milestones, taskCount, doneCount } = selectedNode;
  const progressLabel = taskCount === 0 ? 'No tasks yet' : `${doneCount}/${taskCount} tasks done`;

  return (
    <section className="goal-tree is-expanded">
      <div className="goal-tree-topbar">
        <button className="ghost-button" type="button" onClick={onBack}>
          All goals
        </button>
        <div className="inline-actions">
          <button className="ghost-button" type="button" onClick={() => onEditGoal(goal)}>
            Edit
          </button>
          {goal.status !== 'active' ? (
            <button className="primary-button" type="button" onClick={() => onSetGoalStatus(goal.id, 'active')}>
              Make active
            </button>
          ) : null}
          {goal.status !== 'queued' && goal.status !== 'completed' ? (
            <button className="secondary-button" type="button" onClick={() => onSetGoalStatus(goal.id, 'queued')}>
              Queue
            </button>
          ) : null}
          {goal.status !== 'parked' && goal.status !== 'completed' ? (
            <button className="ghost-button" type="button" onClick={() => onSetGoalStatus(goal.id, 'parked')}>
              Park
            </button>
          ) : null}
          {goal.status !== 'completed' ? (
            <button className="ghost-button danger-text" type="button" onClick={() => onCompleteGoal(goal.id)}>
              Complete
            </button>
          ) : null}
        </div>
      </div>

      <div className="goal-tree-focus">
        <div className="goal-tree-root">
          <span className="eyebrow">{getGoalStatusLabel(goal.status)} goal</span>
          <h3>{goal.title}</h3>
          <p>{goal.targetOutcome}</p>
          <div className="chips">
            <span className="chip">{getGoalPriorityLabel(goal)}</span>
            <span className="chip">{progressLabel}</span>
            {goal.metric ? <span className="chip">{goal.metric}</span> : null}
          </div>
          {milestones.length > 0 ? (
            <div className="goal-milestones">
              <div className="milestone-header">
                <p className="eyebrow">First steps</p>
                <span className="metric-chip">{milestones.filter((m) => m.completedAt).length}/{milestones.length}</span>
              </div>
              <ul className="milestone-list">
                {milestones.map((m) => (
                  <li key={m.id} className={`milestone-item ${m.completedAt ? 'is-done' : ''}`}>
                    <button
                      type="button"
                      className="milestone-check"
                      onClick={() => onToggleMilestone(m.id)}
                      aria-label={m.completedAt ? 'Mark incomplete' : 'Mark complete'}
                    >
                      {m.completedAt ? '✓' : ''}
                    </button>
                    <span className="milestone-title">{m.title}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <div className="goal-tree-branches">
          {projects.length === 0 && looseTasks.length === 0 ? (
            <div className="goal-tree-empty">
              <p className="eyebrow">Projects</p>
              <p>Add projects from Today to start building the path under this goal.</p>
            </div>
          ) : null}

          {projects.map((project) => {
            const projectDone = project.tasks.filter((task) => task.status === 'done').length;
            return (
              <div className="project-branch" key={project.id}>
                <div className="project-branch-header">
                  <span className="project-dot" style={{ backgroundColor: project.color }} />
                  <div>
                    <span>{project.name}</span>
                    <small>{projectDone}/{project.tasks.length} tasks</small>
                  </div>
                </div>
                {project.tasks.length === 0 ? (
                  <p className="muted-copy">No tasks allocated yet.</p>
                ) : (
                  <div className="tree-task-list">
                    {project.tasks.map((task) => (
                      <div className={`tree-task ${task.status === 'done' ? 'is-done' : ''}`} key={task.id}>
                        <span className="tree-task-check">{task.status === 'done' ? '✓' : ''}</span>
                        <span>{task.title}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {looseTasks.length > 0 ? (
            <div className="project-branch is-loose">
              <div className="project-branch-header">
                <span className="project-dot" />
                <div>
                  <span>Unallocated tasks</span>
                  <small>{looseTasks.filter((task) => task.status === 'done').length}/{looseTasks.length} tasks</small>
                </div>
              </div>
              <div className="tree-task-list">
                {looseTasks.map((task) => (
                  <div className={`tree-task ${task.status === 'done' ? 'is-done' : ''}`} key={task.id}>
                    <span className="tree-task-check">{task.status === 'done' ? '✓' : ''}</span>
                    <span>{task.title}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function GoalsPage() {
  const { goals, activeGoal, treeNodes } = useDataSnapshot(() => {
    const goals = db.dbGetGoals();
    const activeGoal = goals.find((goal) => goal.status === 'active') ?? null;
    const tasks = db.dbGetAllTasks();
    const treeNodes = goals.map<GoalTreeNode>((goal) => {
      const projects = db.dbGetProjects(goal.id).map<GoalTreeProject>((project) => ({
        ...project,
        tasks: tasks.filter((task) => task.projectId === project.id && task.status !== 'dropped'),
      }));
      const projectIds = new Set(projects.map((project) => project.id));
      const looseTasks = tasks.filter(
        (task) =>
          task.goalId === goal.id &&
          !projectIds.has(task.projectId ?? '') &&
          task.status !== 'dropped' &&
          task.taskType === 'goal'
      );
      const allTasks = [...projects.flatMap((project) => project.tasks), ...looseTasks];

      return {
        goal,
        projects,
        looseTasks,
        milestones: db.dbGetMilestones(goal.id),
        taskCount: allTasks.length,
        doneCount: allTasks.filter((task) => task.status === 'done').length,
      };
    });

    return {
      goals,
      activeGoal,
      treeNodes,
    };
  });

  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null);
  const [expandedGoalId, setExpandedGoalId] = useState<string | null>(null);

  useEffect(() => {
    if (expandedGoalId && !goals.some((goal) => goal.id === expandedGoalId)) {
      setExpandedGoalId(null);
    }
  }, [expandedGoalId, goals]);

  const defaultGoalStatus: Exclude<GoalStatus, 'completed'> = activeGoal ? 'queued' : 'active';

  function openCreateGoal() {
    setSelectedGoal(null);
    setGoalModalOpen(true);
  }

  function openEditGoal(goal: Goal) {
    setSelectedGoal(goal);
    setGoalModalOpen(true);
  }

  return (
    <>
      <section className="page-header">
        <div>
          <p className="eyebrow">Goal map</p>
          <h2>{expandedGoalId ? 'Goal / projects / tasks' : 'Choose a broad goal'}</h2>
        </div>
        <div className="header-actions">
          <button className="primary-button" type="button" onClick={openCreateGoal}>
            Add goal
          </button>
        </div>
      </section>

      {goals.length === 0 ? (
        <section className="card empty-card">
          <h3>No goals yet</h3>
          <p className="muted-copy">
            Add a broad goal first. Projects and tasks will sit underneath it as the path becomes clearer.
          </p>
        </section>
      ) : (
        <GoalTree
          nodes={treeNodes}
          selectedGoalId={expandedGoalId}
          onSelectGoal={setExpandedGoalId}
          onBack={() => setExpandedGoalId(null)}
          onEditGoal={openEditGoal}
          onSetGoalStatus={(goalId, status) => mutate(() => db.dbSetGoalStatus(goalId, status))}
          onCompleteGoal={(goalId) => {
            if (window.confirm('Complete this goal and collapse it out of the active map?')) {
              mutate(() => db.dbCompleteGoal(goalId));
            }
          }}
          onToggleMilestone={(id) => mutate(() => db.dbToggleMilestone(id))}
        />
      )}

      <GoalModal
        open={goalModalOpen}
        title={selectedGoal ? 'Edit goal' : 'Add goal'}
        initialGoal={selectedGoal}
        defaultStatus={defaultGoalStatus}
        onClose={() => setGoalModalOpen(false)}
        onSubmit={(input, status, steps) => {
          if (selectedGoal) {
            mutate(() => db.dbUpdateGoal(selectedGoal.id, input));
            mutate(() => db.dbSetGoalStatus(selectedGoal.id, status));
            return;
          }

          const created = mutate(() => db.dbCreateGoal(input, { status }));
          if (created && steps.some((s) => s.trim())) {
            mutate(() => db.dbSetMilestonesForGoal(created.id, steps));
          }
        }}
      />
    </>
  );
}

function ActiveGoalSettingsPage() {
  const activeGoal = useDataSnapshot(() => db.dbGetActiveGoal());
  const defaultInput = useMemo(() => createDefaultGoalInput(), []);
  const [title, setTitle] = useState(defaultInput.title);
  const [whyItMatters, setWhyItMatters] = useState(defaultInput.whyItMatters ?? '');
  const [startDate, setStartDate] = useState(defaultInput.startDate ?? todayString());
  const [endDate, setEndDate] = useState(defaultInput.targetDate ?? '');
  const [xpTarget, setXpTarget] = useState(String(defaultInput.xpTarget ?? 10000));
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!activeGoal) {
      setTitle(defaultInput.title);
      setWhyItMatters(defaultInput.whyItMatters ?? '');
      setStartDate(defaultInput.startDate ?? todayString());
      setEndDate(defaultInput.targetDate ?? '');
      setXpTarget(String(defaultInput.xpTarget ?? 10000));
      return;
    }
    setTitle(activeGoal.title);
    setWhyItMatters(activeGoal.whyItMatters || activeGoal.anchorWhy || '');
    setStartDate(activeGoal.startDate ?? todayString());
    setEndDate(activeGoal.endDate ?? activeGoal.targetDate ?? '');
    setXpTarget(String(activeGoal.xpTarget || 10000));
    setSaved(false);
  }, [activeGoal?.id, defaultInput]);

  const input: GoalWriteInput = {
    title: title.trim(),
    targetOutcome: title.trim(),
    targetDate: endDate || null,
    metric: 'XP earned',
    why: whyItMatters.trim(),
    practicalReason: whyItMatters.trim(),
    anchorWhy: whyItMatters.trim(),
    description: title.trim(),
    startDate,
    whyItMatters: whyItMatters.trim(),
    xpTarget: Number.parseInt(xpTarget, 10) || 0,
  };

  function saveGoal() {
    if (!input.title) return;
    if (activeGoal) {
      mutate(() => db.dbUpdateGoal(activeGoal.id, input));
    } else {
      mutate(() => db.dbCreateGoal(input, { status: 'active' }));
    }
    setSaved(true);
  }

  function resetDefaultGoal() {
    if (!window.confirm('Reset the active goal to the default template? The previous active goal will be completed, not deleted.')) {
      return;
    }
    const created = mutate(() => db.dbCreateDefaultGoal());
    if (created) setSaved(true);
  }

  return (
    <>
      <section className="page-header">
        <div>
          <p className="eyebrow">Goal</p>
          <h2>Active goal configuration</h2>
          <p className="muted-copy">One active goal drives the build, XP target, and inspections.</p>
        </div>
        <div className="header-actions">
          <button className="secondary-button" type="button" onClick={resetDefaultGoal}>
            Reset to default
          </button>
          <button className="primary-button" type="button" onClick={saveGoal} disabled={!title.trim()}>
            {activeGoal ? 'Save goal' : 'Create active goal'}
          </button>
        </div>
      </section>

      <section className="goal-settings">
        <div className="goal-settings-form">
          <label className="field">
            <span>Goal name</span>
            <input value={title} onChange={(event) => setTitle(event.target.value)} />
          </label>
          <label className="field">
            <span>Why it matters</span>
            <textarea value={whyItMatters} onChange={(event) => setWhyItMatters(event.target.value)} rows={4} />
          </label>
          <div className="two-column-fields">
            <label className="field">
              <span>Start date</span>
              <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
            </label>
            <label className="field">
              <span>End date</span>
              <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
            </label>
          </div>
          <label className="field">
            <span>XP target</span>
            <input type="number" min="1" value={xpTarget} onChange={(event) => setXpTarget(event.target.value)} />
          </label>
          {saved ? <span className="metric-chip">Saved</span> : null}
        </div>

        <aside className="goal-settings-summary">
          <p className="eyebrow">Starting template</p>
          <h3>Phase 1 - Show Up</h3>
          <div className="rule-list">
            <span>Goal length: 12 months</span>
            <span>XP target: 10,000 XP</span>
            <span>Starting build health: 100</span>
            <span>Starting difficulty: Phase 1</span>
          </div>
          {activeGoal ? (
            <div className="inspection-metric">
              <strong>{activeGoal.buildHealth}/100</strong>
              <span>Current build health</span>
            </div>
          ) : null}
        </aside>
      </section>
    </>
  );
}

function getInspectionResultColor(result?: WeeklyInspection['result']) {
  if (result === 'pass') return '#2f9e44';
  if (result === 'fail') return '#e03131';
  return '#e67700';
}

function WeeklyInspectionPage() {
  const weekStart = getWeekStart();
  const [inspection, setInspection] = useState<WeeklyInspection | null>(null);
  const { activeGoal, stats, weekTasks } = useDataSnapshot(() => {
    const activeGoal = db.dbGetActiveGoal();
    return {
      activeGoal,
      stats: activeGoal ? db.dbGetGameStats(activeGoal.id) : null,
      weekTasks: db.dbGetTasksForWeek(weekStart),
    };
  });
  const weekEnd = useMemo(() => {
    const [year, month, day] = weekStart.split('-').map(Number);
    return formatDate(new Date(year, month - 1, day + 6));
  }, [weekStart]);
  const weekRows = (stats?.last7Days ?? []).filter((row) => row.date >= weekStart && row.date <= weekEnd);
  const goalTasks = weekTasks.filter((task) => task.goalId === activeGoal?.id);
  const xpEarned = inspection?.xpEarned ?? weekRows.reduce((sum, row) => sum + row.xpEarned, 0);
  const tasksCompleted = inspection?.tasksCompleted ?? goalTasks.filter((task) => task.status === 'done').length;
  const hardTasksCompleted =
    inspection?.hardTasksCompleted ??
    goalTasks.filter((task) => task.status === 'done' && (task.tier ?? 1) >= 3).length;
  const validDays = inspection?.validDays ?? weekRows.filter((row) => row.met).length;
  const healthChange = inspection?.buildHealthChange ?? 0;
  const resultLabel = inspection?.result ? inspection.result.toUpperCase() : 'READY';
  const resultColor = getInspectionResultColor(inspection?.result);

  return (
    <>
      <section className="page-header">
        <div>
          <p className="eyebrow">Weekly inspection</p>
          <h2>Active goal accountability</h2>
          <p className="muted-copy">{formatShortDate(weekStart)} - {formatShortDate(weekEnd)}</p>
        </div>
        <div className="header-actions">
          <button
            className="primary-button"
            type="button"
            disabled={!activeGoal}
            onClick={() => setInspection(mutate(() => db.dbRunWeeklyInspection(weekStart)))}
          >
            Run weekly inspection
          </button>
        </div>
      </section>

      {!activeGoal ? (
        <section className="card empty-card">
          <h3>No active goal</h3>
          <p className="muted-copy">Configure one active goal before running an inspection.</p>
          <Link className="secondary-button align-start" to="/goals">
            Configure goal
          </Link>
        </section>
      ) : (
        <section className="inspection-layout">
          <div className="inspection-main">
            <p className="eyebrow">Result</p>
            <strong style={{ color: resultColor }}>{resultLabel}</strong>
            <p>{activeGoal.title}</p>
            <span className="chip">Phase {activeGoal.difficultyPhase} - {stats?.dailyRequirement.phaseName ?? 'Show Up'}</span>
          </div>

          <div className="inspection-metrics">
            <MetricBlock label="XP earned this week" value={String(xpEarned)} />
            <MetricBlock label="Tasks completed" value={String(tasksCompleted)} />
            <MetricBlock label="Hard tasks completed T3+" value={String(hardTasksCompleted)} />
            <MetricBlock label="Daily requirement met" value={`${validDays}/5 days`} />
            <MetricBlock label="Build health change" value={`${healthChange > 0 ? '+' : ''}${healthChange}`} />
            <MetricBlock label="Build health" value={`${activeGoal.buildHealth}/100`} />
          </div>

          <section className="card">
            <p className="eyebrow">Pass rules</p>
            <div className="rule-list">
              <span>Phase 1: at least 5 valid days</span>
              <span>Phase 2: at least 5 valid days</span>
              <span>Phase 3: at least 5 valid days and 1 T2+ task</span>
              <span>Phase 4: at least 5 valid days and 1 T3+ task</span>
            </div>
          </section>
        </section>
      )}
    </>
  );
}

function MetricBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="inspection-metric">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function ReviewPage() {
  const today = todayString();
  const prevWeek = getPrevWeekStart();
  const { activeGoal, review, dailyReview, weekTasks, focusSessions } = useDataSnapshot(() => {
    const activeGoal = db.dbGetActiveGoal();
    return {
      activeGoal,
      review: db.dbGetReviewForWeek(prevWeek),
      dailyReview: db.dbGetDailyReview(today),
      weekTasks: db.dbGetTasksForWeek(prevWeek),
      focusSessions: db.dbGetFocusSessionsForWeek(prevWeek),
    };
  });

  const [dailyWins, setDailyWins] = useState('');
  const [dailyDrift, setDailyDrift] = useState('');
  const [dailyTomorrow, setDailyTomorrow] = useState('');
  const [wins, setWins] = useState('');
  const [whatBroke, setWhatBroke] = useState('');
  const [adjustment, setAdjustment] = useState('');
  const [nextFocus, setNextFocus] = useState('');
  const [emailTaskDraft, setEmailTaskDraft] = useState('');

  useEffect(() => {
    setDailyWins(dailyReview?.wins ?? '');
    setDailyDrift(dailyReview?.drift ?? '');
    setDailyTomorrow(dailyReview?.tomorrowStep ?? '');
  }, [dailyReview?.id]);

  useEffect(() => {
    setWins(review?.wins ?? '');
    setWhatBroke(review ? getWhatBrokeValue(review) : '');
    setAdjustment(review?.nextWeekAdjustment ?? '');
    setNextFocus('');
  }, [review?.id]);

  const doneCount = weekTasks.filter((task) => task.status === 'done').length;
  const completionRate = weekTasks.length > 0 ? Math.round((doneCount / weekTasks.length) * 100) : null;
  const focusSeconds = focusSessions.reduce((sum, session) => sum + session.durationSeconds, 0);
  const completedFocusSessions = focusSessions.filter((session) => session.status === 'completed').length;
  const abandonedFocusSessions = focusSessions.filter((session) => session.status === 'abandoned').length;
  const createEmailTask = () => {
    const trimmed = emailTaskDraft.trim();
    if (!trimmed) {
      return;
    }

    const result = mutate(() =>
      db.dbCreateTask(trimmed, '', null, {
        taskType: 'admin',
      })
    );

    if (!result.ok) {
      window.alert("Today's task lane is full.");
      return;
    }

    setEmailTaskDraft('');
  };

  return (
    <>
      <section className="page-header">
        <div>
          <p className="eyebrow">Review</p>
          <h2>Daily close and weekly reset</h2>
        </div>
      </section>

      <section className="card">
        <div className="section-header">
          <div>
            <p className="eyebrow">Daily shutdown</p>
            <h3>Close today intentionally</h3>
          </div>
          {dailyReview ? <span className="metric-chip">Saved</span> : null}
        </div>

        <form
          className="stack"
          onSubmit={(event) => {
            event.preventDefault();
            mutate(() => db.dbSaveDailyReview(today, dailyWins.trim(), dailyDrift.trim(), dailyTomorrow.trim()));
          }}
        >
          <label className="field">
            <span>What did you actually get done?</span>
            <input value={dailyWins} onChange={(event) => setDailyWins(event.target.value)} />
          </label>
          <label className="field">
            <span>What pulled you off track?</span>
            <input value={dailyDrift} onChange={(event) => setDailyDrift(event.target.value)} />
          </label>
          <label className="field">
            <span>First concrete step tomorrow</span>
            <input value={dailyTomorrow} onChange={(event) => setDailyTomorrow(event.target.value)} />
          </label>

          <div className="preview-card">
            <p className="eyebrow">Email closeout</p>
            <div className="shutdown-checklist">
              <span>Go through emails</span>
              <span>Clear inbox</span>
              <span>Allocate tasks from emails</span>
            </div>
            <form
              className="inline-form"
              onSubmit={(event) => {
                event.preventDefault();
                createEmailTask();
              }}
            >
              <input
                value={emailTaskDraft}
                onChange={(event) => setEmailTaskDraft(event.target.value)}
                placeholder="Task from an email"
              />
              <button className="secondary-button" type="submit" disabled={!emailTaskDraft.trim()}>
                Add task
              </button>
            </form>
          </div>

          <button className="primary-button" type="submit" disabled={!dailyWins.trim()}>
            Save shutdown
          </button>
        </form>
      </section>

      <section className="card">
        <div className="section-header">
          <div>
            <p className="eyebrow">Weekly review</p>
            <h3>Week of {formatWeekRange(prevWeek)}</h3>
          </div>
          {review ? <span className="metric-chip">Saved</span> : null}
        </div>

        <div className="stats-grid">
          <div className="stat-card">
            <strong>{doneCount}/{weekTasks.length}</strong>
            <span>Tasks done</span>
          </div>
          <div className="stat-card">
            <strong>{completionRate === null ? '—' : `${completionRate}%`}</strong>
            <span>Completion</span>
          </div>
          <div className="stat-card">
            <strong>{formatDurationCompact(focusSeconds)}</strong>
            <span>Focus time</span>
          </div>
          <div className="stat-card">
            <strong>{completedFocusSessions}/{focusSessions.length}</strong>
            <span>Sessions completed</span>
          </div>
        </div>

        {focusSessions.length > 0 ? (
          <p className="muted-copy">
            {completedFocusSessions} completed, {abandonedFocusSessions} exited early.
          </p>
        ) : null}

        <form
          className="stack"
          onSubmit={(event) => {
            event.preventDefault();
            mutate(() => db.dbSaveReview(prevWeek, wins.trim(), whatBroke.trim(), [], adjustment.trim()));
            if (activeGoal && nextFocus.trim()) {
              mutate(() => db.dbUpsertWeeklyFocus(activeGoal.id, nextFocus.trim()));
            }
          }}
        >
          <label className="field">
            <span>What worked?</span>
            <input value={wins} onChange={(event) => setWins(event.target.value)} />
          </label>
          <label className="field">
            <span>What broke momentum?</span>
            <input value={whatBroke} onChange={(event) => setWhatBroke(event.target.value)} />
          </label>
          <label className="field">
            <span>One adjustment for next week</span>
            <input value={adjustment} onChange={(event) => setAdjustment(event.target.value)} />
          </label>
          <label className="field">
            <span>Next week&apos;s focus</span>
            <input value={nextFocus} onChange={(event) => setNextFocus(event.target.value)} />
          </label>
          <button
            className="primary-button"
            type="submit"
            disabled={!wins.trim() && !whatBroke.trim() && !adjustment.trim()}
          >
            Save weekly review
          </button>
        </form>
      </section>
    </>
  );
}

function OnboardingPage() {
  const navigate = useNavigate();
  const [draft, setDraft] = useState<OnboardingDraft>(() => ({
    ...EMPTY_ONBOARDING_DRAFT,
    ...(db.dbGetOnboardingDraft() ?? {}),
    draftSteps: (db.dbGetOnboardingDraft() as OnboardingDraft | null)?.draftSteps ?? ['', '', ''],
  }));
  const [status] = useState<Exclude<GoalStatus, 'completed'>>('active');

  useEffect(() => {
    db.dbSaveOnboardingDraft(draft);
  }, [draft]);

  return (
    <div className="onboarding-shell">
      <section className="hero-card">
        <div>
          <p className="eyebrow">Welcome</p>
          <h1>Set one goal. Anchor it. Start moving.</h1>
          <p className="hero-copy">
            Answer four quick questions and you'll have a clear goal with your first concrete steps ready to go.
          </p>
          <Link className="secondary-button align-start" to="/backup">
            Restore backup
          </Link>
        </div>
      </section>

      <section className="card">
        <GoalWizard
          draft={draft}
          setDraft={setDraft}
          status={status}
          setStatus={() => {}}
          showWeeklyFocus
          isEditing={false}
          onCancel={() => {}}
          onSubmit={() => {
            mutate(() => db.dbCompleteOnboarding(draft));
            navigate('/today', { replace: true });
          }}
        />
      </section>
    </div>
  );
}

function BackupPage() {
  const onboardingComplete = useDataSnapshot(() => db.dbIsOnboardingComplete());
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleRestore(file: File | undefined) {
    if (!file) {
      return;
    }

    if (!window.confirm('Restore this backup? Current app data on this device will be replaced.')) {
      return;
    }

    setBusy(true);
    setStatus('');
    try {
      const result = await restoreBackupFile(file);
      const exportedDate = new Date(result.exportedAt).toLocaleString('en-GB');
      setStatus(`Restored ${result.itemCount} saved item groups from ${exportedDate}.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not restore that backup file.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="backup-shell">
      <section className="page-header">
        <div>
          <p className="eyebrow">Backup</p>
          <h2>Manual safety copy</h2>
        </div>
        <Link className="ghost-button" to={onboardingComplete ? '/today' : '/onboarding'}>
          Back
        </Link>
      </section>

      <section className="card">
        <div className="section-header">
          <div>
            <p className="eyebrow">Export</p>
            <h3>Download your app data</h3>
          </div>
          <button
            className="primary-button"
            type="button"
            onClick={() => {
              try {
                const result = exportBackupFile();
                setStatus(`Downloaded ${result.fileName} with ${result.itemCount} saved item groups.`);
              } catch {
                setStatus('Could not create a backup in this browser.');
              }
            }}
          >
            Download backup
          </button>
        </div>
        <p className="muted-copy">
          The file includes the app data saved in this browser. Keep it somewhere you already back up.
        </p>
      </section>

      <section className="card">
        <div className="section-header">
          <div>
            <p className="eyebrow">Restore</p>
            <h3>Load a backup file</h3>
          </div>
          {onboardingComplete ? (
            <span className="metric-chip">App ready</span>
          ) : (
            <span className="metric-chip">Pre-setup</span>
          )}
        </div>

        <label className="field">
          <span>Backup file</span>
          <input
            accept="application/json,.json"
            disabled={busy}
            type="file"
            onChange={(event) => {
              void handleRestore(event.currentTarget.files?.[0]);
              event.currentTarget.value = '';
            }}
          />
        </label>
      </section>

      {status ? (
        <section className="card">
          <p className="muted-copy">{status}</p>
          {onboardingComplete ? (
            <Link className="primary-button align-start" to="/today">
              Open today
            </Link>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

function FocusPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const taskId = searchParams.get('taskId');
  const requestedSessionId = searchParams.get('sessionId');
  const [activeSessionId, setActiveSessionId] = useState<string | null>(requestedSessionId);
  const [elapsed, setElapsed] = useState(0);
  const [done, setDone] = useState(false);
  const [exitReason, setExitReason] = useState<Exclude<FocusExitReason, 'switched_task'> | null>(null);

  const task = useDataSnapshot(() => (taskId ? db.dbGetTaskById(taskId) : null));
  const goal = useDataSnapshot(() => db.dbGetActiveGoal());
  const session = useDataSnapshot(() => (activeSessionId ? db.dbGetFocusSessionById(activeSessionId) : null));

  useEffect(() => {
    if (!taskId || !task || task.status === 'done') {
      setDone(task?.status === 'done');
      return;
    }

    mutate(() => db.dbRemoveContext('dismissed_resume_task_id'));
    const requestedSession =
      requestedSessionId &&
      db.dbGetFocusSessionById(requestedSessionId)?.status === 'active'
        ? db.dbGetFocusSessionById(requestedSessionId)
        : null;
    const nextSession = requestedSession ?? mutate(() => db.dbStartFocusSession(taskId));
    setActiveSessionId(nextSession?.id ?? null);
    setElapsed(nextSession ? Math.floor((Date.now() - nextSession.startedAt) / 1000) : 0);
  }, [requestedSessionId, task, taskId]);

  useEffect(() => {
    if (!session || session.status !== 'active' || done) {
      return;
    }

    const tick = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - session.startedAt) / 1000));
    }, 1000);

    const heartbeat = window.setInterval(() => {
      mutate(() => db.dbTouchFocusSession(session.id));
    }, HEARTBEAT_INTERVAL_MS);

    return () => {
      window.clearInterval(tick);
      window.clearInterval(heartbeat);
    };
  }, [done, session]);

  if (!taskId || !task) {
    return (
      <div className="focus-shell">
        <section className="focus-card">
          <h2>Task not found.</h2>
          <button className="primary-button" type="button" onClick={() => navigate('/today')}>
            Back to today
          </button>
        </section>
      </div>
    );
  }

  const helperText =
    task.nextStep ||
    (task.sourceTaskId
      ? 'Return to the next concrete move on this task.'
      : 'Stay on this one task until you can finish it or exit intentionally.');

  return (
    <div className="focus-shell">
      <section className="focus-card">
        <div className="focus-topbar">
          <button className="ghost-button" type="button" onClick={() => navigate('/today')}>
            Back
          </button>
          <div className="focus-timer">{formatElapsed(elapsed)}</div>
        </div>

        {done ? (
          <div className="stack center-copy">
            <p className="eyebrow">Done</p>
            <h2>{task.title}</h2>
            <p className="muted-copy">{goal ? `One step closer to ${goal.title}` : 'Task completed.'}</p>
            <button className="primary-button" type="button" onClick={() => navigate('/today')}>
              Return to today
            </button>
          </div>
        ) : (
          <div className="stack">
            <p className="eyebrow">Focus</p>
            <h2>{task.title}</h2>
            <p className="muted-copy">{helperText}</p>
            {goal ? <p className="focus-line">Goal: {goal.title}</p> : null}

            <div className="inline-actions">
              <button
                className="primary-button"
                type="button"
                onClick={() => {
                  if (!session) {
                    return;
                  }

                  mutate(() => db.dbCompleteFocusSession(session.id));
                  mutate(() => db.dbCompleteTask(task.id));
                  setDone(true);
                }}
              >
                Complete task
              </button>
            </div>

            <div className="stack">
              <p className="eyebrow">Exit early</p>
              <div className="chips">
                {EXIT_REASONS.map((reason) => (
                  <button
                    key={reason.id}
                    className={`chip ${exitReason === reason.id ? 'is-active' : ''}`}
                    type="button"
                    onClick={() => setExitReason(reason.id)}
                  >
                    {reason.label}
                  </button>
                ))}
              </div>
              <button
                className="secondary-button"
                type="button"
                disabled={!session || !exitReason}
                onClick={() => {
                  if (session && exitReason) {
                    mutate(() => db.dbAbandonFocusSession(session.id, exitReason));
                    navigate('/today');
                  }
                }}
              >
                Exit and save reason
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

const BUILD_PHASE_MARKERS = ['.', '/', '=', 'A', '#', '^', '[]', '::', '~~', 'M', '*'] as const;

const BUILD_STATUS_LABELS: Record<GoalPerformanceStatus, string> = {
  ahead: 'Ahead',
  on_track: 'On track',
  behind: 'Behind',
  decaying: 'Decaying',
};

const BUILD_STATUS_COLORS: Record<GoalPerformanceStatus, string> = {
  ahead: '#2f9e44',
  on_track: '#3b5bdb',
  behind: '#e67700',
  decaying: '#e03131',
};

function BuildPage() {
  const { goal, allTasks, stats } = useDataSnapshot(() => {
    const activeGoal = db.dbGetActiveGoal();
    return {
      goal: activeGoal,
      allTasks: db.dbGetAllTasks(),
      stats: activeGoal ? db.dbGetGameStats(activeGoal.id) : null,
    };
  });

  const today = todayString();

  if (!goal) {
    return (
      <div className="page-content stack">
        <p className="eyebrow">Build</p>
        <p>Set an active goal to start building.</p>
      </div>
    );
  }

  const goalCreatedAt = goal.createdAt;
  const goalTasks = allTasks.filter((t) => t.goalId === goal.id && t.status === 'done');
  const totalXp = goal.xpTotal || stats?.totalXp || goalTasks.reduce((sum, t) => sum + TIER_XP[t.tier ?? 2], 0);
  const daysSinceCreation = Math.floor((Date.now() - goalCreatedAt) / (24 * 60 * 60 * 1000));
  const targetXp = goal.xpTarget || stats?.targetXp || Math.max(daysSinceCreation * TIER_XP[2], TIER_XP[2]);
  const dailyRequirement = stats?.dailyRequirement ?? db.getDailyRequirement(goal);
  const startDate = goal.startDate ?? new Date(goal.createdAt).toISOString().slice(0, 10);
  const endDate = goal.endDate ?? goal.targetDate;
  const calendarProgress = calculateCalendarProgress({ startDate, endDate });
  const xpProgress = calculateXpProgress(totalXp, targetXp);
  const buildHealth = goal.buildHealth ?? stats?.buildHealth ?? 100;
  const phaseIndex = calculateBuildPhaseIndex(calendarProgress, xpProgress);
  const phaseName = getBuildPhaseName(phaseIndex);
  const decayLevel = getBuildDecayLevel(buildHealth);
  const forecastStatus = calculateForecastStatus({
    calendarProgress,
    xpProgress,
    buildHealth,
    performanceStatus: goal.performanceStatus,
  });
  const nextUnlockRequirement = getNextUnlockRequirement({ phaseIndex, xpTotal: totalXp, xpTarget: targetXp });
  const daysUntilCompletion = getDaysUntil(endDate);
  const plannedCompletion = endDate ? formatShortDate(endDate) : 'No date set';
  const healthColor = decayLevel === 'healthy' ? '#2f9e44' : decayLevel === 'decay' ? '#e67700' : '#e03131';
  const buildCardStyle = {
    padding: '1.5rem',
    background: decayLevel === 'severe' ? '#fff5f5' : decayLevel === 'decay' ? '#fffbf2' : 'var(--surface, #f5f5f5)',
    border: `1px solid ${decayLevel === 'severe' ? '#e03131' : decayLevel === 'decay' ? '#f08c00' : 'var(--border, #e0e0e0)'}`,
    borderRadius: '0.75rem',
  };
  const forecastCopy =
    forecastStatus === 'ahead'
      ? 'Ahead of the build curve.'
      : forecastStatus === 'behind'
        ? 'Needs extra XP to catch the timeline.'
        : forecastStatus === 'decaying'
          ? 'Health is damaging the build.'
          : 'Pace and build progress are aligned.';
  const timelineCopy =
    daysUntilCompletion === null
      ? 'No completion date is set.'
      : daysUntilCompletion < 0
        ? `${Math.abs(daysUntilCompletion)} days past planned completion.`
        : `${daysUntilCompletion} days until planned completion.`;

  // Build last-7-days history
  const last7: Array<{ date: string; xpEarned: number; expectation: number; met: boolean }> = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = formatDate(d);
    const dayExp = dailyRequirement.tasksRequired;
    const dayXp = goalTasks
      .filter((t) => t.date === dateStr)
      .reduce((sum, t) => sum + TIER_XP[t.tier ?? 2], 0);
    const dayTasks = allTasks.filter((t) => t.goalId === goal.id && t.date === dateStr && t.status === 'done');
    last7.push({ date: dateStr, xpEarned: dayXp, expectation: dayExp, met: db.isValidDay(goal, dayTasks) });
  }

  // Compute streak and health from last-7-days (simple approximation for web)
  let streak = 0;
  for (let i = last7.length - 1; i >= 0; i--) {
    const day = last7[i];
    if (day.date === today && day.xpEarned === 0) continue; // don't break on today if not yet started
    if (day.met) streak++;
    else break;
  }
  return (
    <div className="page-content stack">
      <p className="eyebrow">Build</p>
      <div style={buildCardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start' }}>
          <div>
            <p className="eyebrow" style={{ marginBottom: '0.35rem' }}>Flagship build</p>
            <h2 style={{ margin: 0 }}>{goal.title}</h2>
          </div>
          <span style={{ color: BUILD_STATUS_COLORS[forecastStatus], border: `1px solid ${BUILD_STATUS_COLORS[forecastStatus]}`, borderRadius: '999px', padding: '0.35rem 0.7rem', fontSize: '0.8rem', fontWeight: 800, background: '#fff' }}>
            {BUILD_STATUS_LABELS[forecastStatus]}
          </span>
        </div>

        <div style={{ marginTop: '1rem', padding: '1rem', border: '1px solid var(--border, #e0e0e0)', borderRadius: '0.75rem', background: '#fff' }}>
          {decayLevel !== 'healthy' ? (
            <div style={{ color: decayLevel === 'severe' ? '#e03131' : '#c05621', border: `1px solid ${decayLevel === 'severe' ? '#ffc9c9' : '#ffd8a8'}`, background: decayLevel === 'severe' ? '#fff5f5' : '#fff4e6', borderRadius: '0.6rem', padding: '0.55rem 0.7rem', marginBottom: '0.75rem', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Build health damaged
            </div>
          ) : null}
          <p className="eyebrow" style={{ marginBottom: '0.35rem' }}>Current build phase</p>
          <div style={{ fontWeight: 800, fontSize: '1.25rem', marginBottom: '0.75rem' }}>Phase {phaseIndex}: {phaseName}</div>
          <pre style={{ margin: 0, minHeight: '7rem', display: 'grid', placeItems: 'center', fontSize: '1.1rem', lineHeight: 1.1, fontWeight: 800, background: 'var(--bg, #f8f7f4)', borderRadius: '0.6rem' }}>
{`${phaseIndex < 2 ? '          ' : '    /\\    '}
${phaseIndex < 3 ? '          ' : '   /  \\   '}
${phaseIndex < 4 ? '          ' : '  /____\\  '}
${phaseIndex < 5 ? '          ' : ' | [] [] | '}
${phaseIndex < 7 ? '          ' : ' |  __  | '}
${phaseIndex < 1 ? '__________' : '_|______|_'}`}
          </pre>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${BUILD_PHASES.length}, minmax(0, 1fr))`, gap: '0.35rem', marginTop: '0.8rem' }}>
            {BUILD_PHASES.map((phase, index) => (
              <span
                key={phase}
                title={`Phase ${index}: ${phase}`}
                style={{
                  display: 'grid',
                  placeItems: 'center',
                  height: '1.75rem',
                  borderRadius: '0.5rem',
                  border: `1px solid ${index === phaseIndex ? '#3b5bdb' : index <= phaseIndex ? '#c7d2fe' : 'var(--border, #e0e0e0)'}`,
                  color: index <= phaseIndex ? '#3b5bdb' : 'var(--text-muted, #888)',
                  background: index <= phaseIndex ? '#eef2ff' : '#fff',
                  fontSize: '0.7rem',
                  fontWeight: 800,
                }}
              >
                {BUILD_PHASE_MARKERS[index]}
              </span>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gap: '0.75rem', marginTop: '1rem' }}>
          {[
            ['Calendar progress', `${Math.round(calendarProgress * 100)}% complete`, calendarProgress, '#3b5bdb'],
            ['XP progress', `${totalXp} / ${targetXp} XP`, xpProgress, '#7950f2'],
            ['Build health', `${buildHealth}/100`, Math.max(0, Math.min(100, buildHealth)) / 100, healthColor],
          ].map(([label, value, progress, color]) => (
            <div key={label as string}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted, #888)', marginBottom: '0.25rem', fontWeight: 700 }}>
                <span>{label as string}</span>
                <span>{value as string}</span>
              </div>
              <div style={{ height: '8px', background: 'var(--border, #e0e0e0)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${(progress as number) * 100}%`, background: color as string, borderRadius: '4px' }} />
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(14rem, 1fr))', gap: '0.75rem', marginTop: '1rem' }}>
          <div style={{ padding: '0.85rem', background: 'var(--bg, #f8f7f4)', borderRadius: '0.65rem' }}>
            <p className="eyebrow" style={{ marginBottom: '0.35rem' }}>Next unlock</p>
            <strong>{nextUnlockRequirement}</strong>
          </div>
          <div style={{ padding: '0.85rem', background: 'var(--bg, #f8f7f4)', borderRadius: '0.65rem' }}>
            <p className="eyebrow" style={{ marginBottom: '0.35rem' }}>Planned completion</p>
            <strong>{plannedCompletion}</strong>
          </div>
          <div style={{ padding: '0.85rem', background: 'var(--bg, #f8f7f4)', borderRadius: '0.65rem' }}>
            <p className="eyebrow" style={{ marginBottom: '0.35rem' }}>Current forecast</p>
            <strong>{forecastCopy} {timelineCopy}</strong>
          </div>
          <div style={{ padding: '0.85rem', background: 'var(--bg, #f8f7f4)', borderRadius: '0.65rem', textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{streak}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted, #888)' }}>day streak</div>
          </div>
        </div>
      </div>

      <div>
        <p className="eyebrow">Last 7 days · {dailyRequirement.minimumCopy}</p>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {last7.map((day) => (
            <div key={day.date} style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: '1rem' }}>{day.met ? '●' : day.xpEarned > 0 ? '◐' : '○'}</div>
              <div style={{ fontSize: '0.6rem', color: 'var(--text-muted, #888)' }}>{day.date.slice(5)}</div>
              <div style={{ fontSize: '0.65rem', fontWeight: 600 }}>{day.xpEarned}xp</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: '1rem', background: 'var(--surface, #f5f5f5)', borderRadius: '0.75rem' }}>
        <p className="eyebrow" style={{ marginBottom: '0.5rem' }}>Tier guide</p>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {([1, 2, 3, 4, 5] as TaskTier[]).map((t) => (
            <span key={t} style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem', borderRadius: '999px', border: '1px solid var(--border, #ccc)' }}>
              T{t} · {TIER_XP[t]}xp
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function RequireOnboarding({ onboardingComplete }: { onboardingComplete: boolean }) {
  return onboardingComplete ? <Outlet /> : <Navigate to="/onboarding" replace />;
}

export default function App() {
  useLegacyWebCleanup();

  const onboardingComplete = useDataSnapshot(() => db.dbIsOnboardingComplete());

  return (
    <Routes>
      <Route path="/" element={<Navigate replace to={onboardingComplete ? '/today' : '/onboarding'} />} />
      <Route path="/backup" element={<BackupPage />} />
      <Route
        path="/onboarding"
        element={onboardingComplete ? <Navigate replace to="/today" /> : <OnboardingPage />}
      />
      <Route element={<RequireOnboarding onboardingComplete={onboardingComplete} />}>
        <Route element={<AppShell />}>
          <Route path="/today" element={<TodayPage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/goals" element={<ActiveGoalSettingsPage />} />
          <Route path="/review" element={<ReviewPage />} />
          <Route path="/inspection" element={<WeeklyInspectionPage />} />
          <Route path="/build" element={<BuildPage />} />
        </Route>
        <Route path="/focus" element={<FocusPage />} />
      </Route>
      <Route path="*" element={<Navigate replace to={onboardingComplete ? '/today' : '/onboarding'} />} />
    </Routes>
  );
}
