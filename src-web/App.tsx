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
  Vision,
  VisionWriteInput,
} from '../src/types';
import {
  formatDate,
  formatDisplayDate,
  formatDurationCompact,
  formatElapsed,
  formatShortDate,
  formatWeekRange,
  getPrevWeekStart,
  todayString,
} from '../src/utils/dates';
import { generateAnchorLines } from '../src/utils/goalAnchors';
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
  onSubmit: (title: string, nextStep: string, projectId: string | null) => void;
}) {
  const [taskTitle, setTaskTitle] = useState(initialTitle ?? '');
  const [nextStep, setNextStep] = useState('');
  const [projectId, setProjectId] = useState<string | null>(selectedProjectId);

  useEffect(() => {
    if (!open) {
      return;
    }

    setTaskTitle(initialTitle ?? '');
    setNextStep('');
    setProjectId(selectedProjectId);
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

          onSubmit(taskTitle.trim(), nextStep.trim(), projectId);
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
    <div className={`task-row ${task.status === 'done' ? 'is-done' : ''}`}>
      <button className={`check-button ${task.status === 'done' ? 'is-done' : ''}`} onClick={onToggle} type="button">
        {task.status === 'done' ? '✓' : ''}
      </button>
      <div className="task-copy">
        <div className="task-title-row">
          <h4>{task.title}</h4>
          {project ? (
            <span className="project-pill">
              <span className="project-dot" style={{ backgroundColor: project.color }} />
              {project.name}
            </span>
          ) : null}
        </div>
        {task.nextStep ? <p>{task.nextStep}</p> : null}
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
  visions,
  onClose,
  onSubmit,
  onDelete,
}: {
  open: boolean;
  initial: Habit | null;
  goals: Goal[];
  visions: Vision[];
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
  const [visionId, setVisionId] = useState<string | null>(null);

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
    setVisionId(initial?.visionId ?? null);
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
      visionId,
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

        {visions.length > 0 ? (
          <label className="field">
            <span>Ladder to vision (optional)</span>
            <select value={visionId ?? ''} onChange={(e) => setVisionId(e.target.value || null)}>
              <option value="">Standalone</option>
              {visions.map((v) => (
                <option key={v.id} value={v.id}>{v.title}</option>
              ))}
            </select>
          </label>
        ) : null}

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
  visions,
}: {
  habitsToday: HabitTodayView[];
  goals: Goal[];
  visions: Vision[];
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
        visions={visions}
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

// ─── Visions UI ───────────────────────────────────────────────────────────────

function VisionModal({
  open,
  initial,
  onClose,
  onSubmit,
  onArchive,
}: {
  open: boolean;
  initial: Vision | null;
  onClose: () => void;
  onSubmit: (input: VisionWriteInput) => void;
  onArchive?: () => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [identity, setIdentity] = useState('');

  useEffect(() => {
    if (!open) return;
    setTitle(initial?.title ?? '');
    setDescription(initial?.description ?? '');
    setIdentity(initial?.identityStatement ?? '');
  }, [open, initial]);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    onSubmit({ title: title.trim(), description: description.trim(), identityStatement: identity.trim() });
    onClose();
  }

  return (
    <Modal open={open} title={initial ? 'Edit vision' : 'New vision'} onClose={onClose}>
      <form onSubmit={submit} className="stack">
        <label className="field">
          <span>Vision (1–5 years out)</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Financial independence"
            autoFocus
          />
        </label>
        <label className="field">
          <span>Why it matters</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="The life this unlocks..."
            rows={3}
          />
        </label>
        <label className="field">
          <span>I am someone who... (identity)</span>
          <input
            value={identity}
            onChange={(e) => setIdentity(e.target.value)}
            placeholder="...builds wealth patiently"
          />
        </label>
        <div className="modal-actions">
          {initial && onArchive ? (
            <button
              type="button"
              className="ghost-button danger-text"
              onClick={() => {
                if (window.confirm(`Archive vision "${initial.title}"? Linked goals and habits will be unlinked.`)) {
                  onArchive();
                  onClose();
                }
              }}
            >
              Archive
            </button>
          ) : null}
          <button type="button" className="ghost-button" onClick={onClose}>Cancel</button>
          <button type="submit" className="primary-button" disabled={!title.trim()}>
            {initial ? 'Save' : 'Create vision'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function VisionsSection({
  visions,
  activeGoal,
}: {
  visions: Vision[];
  activeGoal: Goal | null;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Vision | null>(null);

  const activeVision = activeGoal?.visionId ? visions.find((v) => v.id === activeGoal.visionId) ?? null : null;

  return (
    <section className="card vision-card">
      <div className="section-header">
        <div>
          <p className="eyebrow">Vision</p>
          <h3>{visions.length === 0 ? 'Give your goal somewhere to ladder to' : 'Long-term direction'}</h3>
        </div>
        <button
          className="secondary-button"
          type="button"
          onClick={() => {
            setEditing(null);
            setModalOpen(true);
          }}
        >
          Add vision
        </button>
      </div>

      {visions.length === 0 ? (
        <p className="muted-copy">
          A vision is the 1–5 year direction your active goal serves. Without one, goals feel arbitrary.
        </p>
      ) : (
        <div className="stack">
          {visions.map((v) => {
            const isActive = activeVision?.id === v.id;
            return (
              <div key={v.id} className={`vision-row ${isActive ? 'is-active' : ''}`}>
                <div className="vision-row-body">
                  <div className="vision-title-row">
                    <span className="vision-title">{v.title}</span>
                    {isActive ? <span className="metric-chip">Current ladder</span> : null}
                  </div>
                  {v.identityStatement ? <p className="vision-identity">I am someone who {v.identityStatement}</p> : null}
                  {v.description ? <p className="muted-copy">{v.description}</p> : null}
                </div>
                <div className="inline-actions">
                  {activeGoal && !isActive ? (
                    <button
                      className="ghost-button"
                      type="button"
                      onClick={() =>
                        mutate(() =>
                          db.dbUpdateGoal(activeGoal.id, {
                            title: activeGoal.title,
                            targetOutcome: activeGoal.targetOutcome,
                            targetDate: activeGoal.targetDate,
                            metric: activeGoal.metric,
                            why: activeGoal.why,
                            practicalReason: activeGoal.practicalReason,
                            emotionalReason: activeGoal.emotionalReason,
                            costOfDrift: activeGoal.costOfDrift,
                            anchorWhy: activeGoal.anchorWhy,
                            anchorDrift: activeGoal.anchorDrift,
                            importance: activeGoal.importance,
                            urgency: activeGoal.urgency,
                            payoff: activeGoal.payoff,
                            whyNow: activeGoal.whyNow,
                            visionId: v.id,
                          })
                        )
                      }
                    >
                      Ladder goal here
                    </button>
                  ) : null}
                  <button
                    className="ghost-button"
                    type="button"
                    onClick={() => {
                      setEditing(v);
                      setModalOpen(true);
                    }}
                  >
                    Edit
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <VisionModal
        open={modalOpen}
        initial={editing}
        onClose={() => setModalOpen(false)}
        onSubmit={(input) => {
          if (editing) {
            mutate(() => db.dbUpdateVision(editing.id, input));
          } else {
            mutate(() => db.dbCreateVision(input));
          }
        }}
        onArchive={editing ? () => mutate(() => db.dbArchiveVision(editing.id)) : undefined}
      />
    </section>
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

function TodayPage() {
  const navigate = useNavigate();
  const {
    activeGoalId,
    tasks,
    projects,
    brainDumpItems,
    resumeContext,
    habitsToday,
    visions,
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
      visions: db.dbGetVisions(),
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

      <HabitsSection habitsToday={habitsToday} goals={goals} visions={visions} />

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
        onSubmit={(title, nextStep, projectId) => {
          const result = mutate(() =>
            activeGoal
              ? db.dbCreateTask(title, activeGoal.id, weeklyFocus?.id, {
                  date: selectedDate,
                  nextStep,
                  projectId,
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
  const { goals, activeGoal, visions, treeNodes } = useDataSnapshot(() => {
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
      visions: db.dbGetVisions(),
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

      <VisionsSection visions={visions} activeGoal={activeGoal} />

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
          <Route path="/goals" element={<GoalsPage />} />
          <Route path="/review" element={<ReviewPage />} />
        </Route>
        <Route path="/focus" element={<FocusPage />} />
      </Route>
      <Route path="*" element={<Navigate replace to={onboardingComplete ? '/today' : '/onboarding'} />} />
    </Routes>
  );
}
