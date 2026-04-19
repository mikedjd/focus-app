import { useEffect, useMemo, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import {
  Navigate,
  NavLink,
  Outlet,
  Route,
  Routes,
  useNavigate,
  useSearchParams,
} from 'react-router-dom';
import { db, mutate, useDataSnapshot } from './data';
import type {
  BrainDumpItem,
  DailyTask,
  FocusExitReason,
  FocusSession,
  Goal,
  GoalStatus,
  GoalWriteInput,
  OnboardingDraft,
  Project,
  ResumeContext,
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

function GoalFields({
  draft,
  setDraft,
  showWeeklyFocus = false,
}: {
  draft: OnboardingDraft;
  setDraft: (next: OnboardingDraft) => void;
  showWeeklyFocus?: boolean;
}) {
  const autoAnchors = generateAnchorLines({
    practicalReason: draft.practicalReason,
    emotionalReason: draft.emotionalReason,
    costOfDrift: draft.costOfDrift,
  });

  return (
    <div className="form-grid">
      <label className="field">
        <span>Goal title</span>
        <input
          value={draft.goalTitle}
          onChange={(event) => setDraft({ ...draft, goalTitle: event.target.value })}
          placeholder="What are you moving?"
        />
      </label>

      <label className="field">
        <span>Target outcome</span>
        <input
          value={draft.targetOutcome}
          onChange={(event) => setDraft({ ...draft, targetOutcome: event.target.value })}
          placeholder="What does success look like?"
        />
      </label>

      <label className="field">
        <span>Metric</span>
        <input
          value={draft.metric}
          onChange={(event) => setDraft({ ...draft, metric: event.target.value })}
          placeholder="Optional measure"
        />
      </label>

      <label className="field">
        <span>Importance</span>
        <select
          value={draft.importance}
          onChange={(event) => setDraft({ ...draft, importance: Number(event.target.value) })}
        >
          {GOAL_RATING_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>Urgency</span>
        <select
          value={draft.urgency}
          onChange={(event) => setDraft({ ...draft, urgency: Number(event.target.value) })}
        >
          {GOAL_RATING_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>Payoff</span>
        <select
          value={draft.payoff}
          onChange={(event) => setDraft({ ...draft, payoff: Number(event.target.value) })}
        >
          {GOAL_RATING_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="toggle-field">
        <input
          checked={draft.hasTargetDate}
          onChange={(event) =>
            setDraft({
              ...draft,
              hasTargetDate: event.target.checked,
              targetDate: event.target.checked ? draft.targetDate : '',
            })
          }
          type="checkbox"
        />
        <span>Use a target date</span>
      </label>

      {draft.hasTargetDate ? (
        <label className="field">
          <span>Target date</span>
          <input
            type="date"
            value={draft.targetDate}
            onChange={(event) => setDraft({ ...draft, targetDate: event.target.value })}
          />
        </label>
      ) : null}

      <label className="field field-wide">
        <span>Why this matters now</span>
        <textarea
          value={draft.whyNow}
          onChange={(event) => setDraft({ ...draft, whyNow: event.target.value })}
          placeholder="Why should this goal compete for the active slot right now?"
          rows={2}
        />
      </label>

      <label className="field field-wide">
        <span>Practical reason</span>
        <textarea
          value={draft.practicalReason}
          onChange={(event) => setDraft({ ...draft, practicalReason: event.target.value })}
          placeholder="Why is this useful in real life?"
          rows={3}
        />
      </label>

      <label className="field field-wide">
        <span>Emotional reason</span>
        <textarea
          value={draft.emotionalReason}
          onChange={(event) => setDraft({ ...draft, emotionalReason: event.target.value })}
          placeholder="Why does it matter to you personally?"
          rows={3}
        />
      </label>

      <label className="field field-wide">
        <span>Cost of drift</span>
        <textarea
          value={draft.costOfDrift}
          onChange={(event) => setDraft({ ...draft, costOfDrift: event.target.value })}
          placeholder="What gets worse if this keeps slipping?"
          rows={3}
        />
      </label>

      <div className="preview-card field-wide">
        <p className="eyebrow">Anchor preview</p>
        <p>{autoAnchors.anchorWhy || 'Your why anchor will appear here.'}</p>
        <p>{autoAnchors.anchorDrift || 'Your drift anchor will appear here.'}</p>
      </div>

      <label className="field field-wide">
        <span>Editable why anchor</span>
        <textarea
          value={draft.anchorWhy}
          onChange={(event) => setDraft({ ...draft, anchorWhy: event.target.value })}
          placeholder={autoAnchors.anchorWhy || 'Leave blank to use the auto preview'}
          rows={3}
        />
      </label>

      <label className="field field-wide">
        <span>Editable drift anchor</span>
        <textarea
          value={draft.anchorDrift}
          onChange={(event) => setDraft({ ...draft, anchorDrift: event.target.value })}
          placeholder={autoAnchors.anchorDrift || 'Leave blank to use the auto preview'}
          rows={3}
        />
      </label>

      {showWeeklyFocus ? (
        <label className="field field-wide">
          <span>This week&apos;s focus</span>
          <textarea
            value={draft.weeklyFocus}
            onChange={(event) => setDraft({ ...draft, weeklyFocus: event.target.value })}
            placeholder="What is the one move for this week?"
            rows={2}
          />
        </label>
      ) : null}
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
  onSubmit: (input: GoalWriteInput, status: Exclude<GoalStatus, 'completed'>) => void;
}) {
  const [draft, setDraft] = useState<OnboardingDraft>({
    ...EMPTY_ONBOARDING_DRAFT,
    ...createGoalDraft(initialGoal),
  });
  const [status, setStatus] = useState<Exclude<GoalStatus, 'completed'>>(
    initialGoal?.status === 'completed' ? defaultStatus : initialGoal?.status ?? defaultStatus
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    setDraft({
      ...EMPTY_ONBOARDING_DRAFT,
      ...createGoalDraft(initialGoal),
    });
    setStatus(initialGoal?.status === 'completed' ? defaultStatus : initialGoal?.status ?? defaultStatus);
  }, [defaultStatus, initialGoal, open]);

  const canSubmit = draft.goalTitle.trim().length > 0 && draft.targetOutcome.trim().length > 0;

  return (
    <Modal open={open} title={title} onClose={onClose}>
      <form
        className="stack"
        onSubmit={(event) => {
          event.preventDefault();
          if (!canSubmit) {
            return;
          }

          onSubmit(toGoalWriteInput(draft), status);
          onClose();
        }}
      >
        <GoalFields draft={draft} setDraft={setDraft} />
        <label className="field">
          <span>Place this goal</span>
          <select value={status} onChange={(event) => setStatus(event.target.value as Exclude<GoalStatus, 'completed'>)}>
            {GOAL_PLACEMENT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <div className="form-actions">
          <button className="secondary-button" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary-button" type="submit" disabled={!canSubmit}>
            Save goal
          </button>
        </div>
      </form>
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
  onFocus: () => void;
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
        {task.status !== 'done' ? (
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
    activeGoal,
    weeklyFocus,
    tasks,
    projects,
    brainDumpItems,
    resumeContext,
  } = useDataSnapshot(() => {
    const activeGoal = db.dbGetActiveGoal();
    return {
      activeGoal,
      weeklyFocus: activeGoal ? db.dbGetCurrentWeeklyFocus(activeGoal.id) : null,
      tasks: db.dbGetTodayTasks(),
      projects: activeGoal ? db.dbGetProjects(activeGoal.id) : [],
      brainDumpItems: db.dbGetBrainDumpItems(),
      resumeContext: db.dbGetResumeContext(),
    };
  });

  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [ideasOpen, setIdeasOpen] = useState(false);
  const [projectFilter, setProjectFilter] = useState<string | null>(null);
  const [promotedTitle, setPromotedTitle] = useState<string | undefined>(undefined);
  const [brainDumpDraft, setBrainDumpDraft] = useState('');

  const visibleTasks = projectFilter ? tasks.filter((task) => task.projectId === projectFilter) : tasks;
  const doneCount = tasks.filter((task) => task.status === 'done').length;
  const firstPending = visibleTasks.find((task) => task.status === 'pending') ?? null;
  const canAddTask = tasks.length < DAILY_CAP;
  const groupedTasks = visibleTasks.reduce<Record<string, DailyTask[]>>((groups, task) => {
    const key = task.projectId ?? 'none';
    groups[key] = groups[key] ?? [];
    groups[key].push(task);
    return groups;
  }, {});

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
            disabled={!activeGoal || !canAddTask}
            onClick={() => setTaskModalOpen(true)}
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

      <section className="card">
        <div className="section-header">
          <div>
            <p className="eyebrow">Anchor</p>
            <h3>{activeGoal ? activeGoal.title : 'Set your goal first'}</h3>
          </div>
          <span className="metric-chip">{doneCount}/{tasks.length} done</span>
        </div>
        {activeGoal ? (
          <>
            <p className="muted-copy">{activeGoal.targetOutcome}</p>
            {weeklyFocus ? <p className="focus-line">This week: {weeklyFocus.focus}</p> : null}
          </>
        ) : (
          <button className="primary-button" type="button" onClick={() => navigate('/goals')}>
            Create goal
          </button>
        )}
      </section>

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
            <p className="eyebrow">Tasks</p>
            <h3>{visibleTasks.length === 0 ? 'Nothing queued' : 'Today’s lane'}</h3>
          </div>
          <span className="metric-chip">{tasks.length}/{DAILY_CAP} slots</span>
        </div>

        {!activeGoal ? (
          <p className="muted-copy">Set a goal to start capturing daily tasks.</p>
        ) : visibleTasks.length === 0 ? (
          <button className="primary-button" type="button" disabled={!canAddTask} onClick={() => setTaskModalOpen(true)}>
            Add your first task
          </button>
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
            <p className="eyebrow">Brain dump</p>
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
                          setPromotedTitle(item.text);
                          mutate(() => db.dbDeleteBrainDumpItem(item.id));
                          setTaskModalOpen(true);
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

      <TaskModal
        open={taskModalOpen}
        title="Add task"
        initialTitle={promotedTitle}
        projects={projects}
        selectedProjectId={projectFilter}
        onClose={() => {
          setTaskModalOpen(false);
          setPromotedTitle(undefined);
        }}
        onSubmit={(title, nextStep, projectId) => {
          const result = mutate(() =>
            activeGoal
              ? db.dbCreateTask(title, activeGoal.id, weeklyFocus?.id, {
                  nextStep,
                  projectId,
                })
              : { ok: false as const, reason: 'missing_goal' as const }
          );

          if (!result.ok) {
            window.alert("Today's task lane is full or no goal is set.");
          }
        }}
      />

      <ProjectManagerModal
        open={projectModalOpen}
        projects={projects}
        goalId={activeGoal?.id ?? null}
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

function GoalCard({
  goal,
  weeklyFocus,
  onEdit,
  onMakeActive,
  onQueue,
  onPark,
  onComplete,
}: {
  goal: Goal;
  weeklyFocus?: string | null;
  onEdit: () => void;
  onMakeActive: () => void;
  onQueue: () => void;
  onPark: () => void;
  onComplete: () => void;
}) {
  const priorityLabel = getGoalPriorityLabel(goal);

  return (
    <section className={`card goal-card ${goal.status === 'active' ? 'is-active' : ''}`}>
      <div className="section-header">
        <div>
          <p className="eyebrow">{getGoalStatusLabel(goal.status)}</p>
          <h3>{goal.title}</h3>
        </div>
        <span className="metric-chip">{priorityLabel}</span>
      </div>

      <p>{goal.targetOutcome}</p>

      <div className="chips">
        <span className="chip">Importance {GOAL_RATING_OPTIONS[goal.importance - 1].label}</span>
        <span className="chip">Urgency {GOAL_RATING_OPTIONS[goal.urgency - 1].label}</span>
        <span className="chip">Payoff {GOAL_RATING_OPTIONS[goal.payoff - 1].label}</span>
        {goal.targetDate ? <span className="chip">Target {formatShortDate(goal.targetDate)}</span> : null}
        {goal.metric ? <span className="chip">{goal.metric}</span> : null}
      </div>

      {goal.whyNow ? (
        <div className="goal-copy-block">
          <p className="eyebrow">Why now</p>
          <p>{goal.whyNow}</p>
        </div>
      ) : null}

      {goal.status === 'active' && weeklyFocus ? (
        <div className="goal-copy-block">
          <p className="eyebrow">Weekly focus</p>
          <p>{weeklyFocus}</p>
        </div>
      ) : null}

      <div className="goal-copy-block">
        <p className="eyebrow">Anchor</p>
        <p>{goal.anchorWhy || 'No why anchor set yet.'}</p>
        <p>{goal.anchorDrift || 'No drift anchor set yet.'}</p>
      </div>

      <div className="task-actions">
        {goal.status !== 'active' ? (
          <button className="primary-button" type="button" onClick={onMakeActive}>
            Make active
          </button>
        ) : null}
        {goal.status !== 'queued' && goal.status !== 'completed' ? (
          <button className="secondary-button" type="button" onClick={onQueue}>
            Move to queue
          </button>
        ) : null}
        {goal.status !== 'parked' && goal.status !== 'completed' ? (
          <button className="ghost-button" type="button" onClick={onPark}>
            Park it
          </button>
        ) : null}
        <button className="ghost-button" type="button" onClick={onEdit}>
          Edit
        </button>
        <button className="ghost-button danger-text" type="button" onClick={onComplete}>
          Complete
        </button>
      </div>
    </section>
  );
}

function GoalsPage() {
  const { goals, activeGoal, weeklyFocus } = useDataSnapshot(() => {
    const goals = db.dbGetGoals();
    const activeGoal = goals.find((goal) => goal.status === 'active') ?? null;
    return {
      goals,
      activeGoal,
      weeklyFocus: activeGoal ? db.dbGetCurrentWeeklyFocus(activeGoal.id) : null,
    };
  });

  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null);
  const [focusText, setFocusText] = useState(weeklyFocus?.focus ?? '');

  useEffect(() => {
    setFocusText(weeklyFocus?.focus ?? '');
  }, [weeklyFocus?.focus]);

  const queuedGoals = goals.filter((goal) => goal.status === 'queued');
  const parkedGoals = goals.filter((goal) => goal.status === 'parked');
  const completedGoals = goals.filter((goal) => goal.status === 'completed');
  const recommendedGoal = [...queuedGoals, ...parkedGoals].sort(
    (a, b) => getGoalPriorityScore(b) - getGoalPriorityScore(a)
  )[0] ?? null;
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
          <p className="eyebrow">Goal vault</p>
          <h2>{activeGoal ? activeGoal.title : 'Capture all goals, run one at a time'}</h2>
        </div>
        <div className="header-actions">
          <button className="primary-button" type="button" onClick={openCreateGoal}>
            Add goal
          </button>
        </div>
      </section>

      {recommendedGoal ? (
        <section className="card banner-card">
          <div>
            <p className="eyebrow">Recommended next</p>
            <h3>{recommendedGoal.title}</h3>
            <p className="muted-copy">
              {getGoalPriorityLabel(recommendedGoal)} with strong importance/payoff signals.
            </p>
          </div>
          <div className="inline-actions">
            <button
              className="primary-button"
              type="button"
              onClick={() => mutate(() => db.dbSetGoalStatus(recommendedGoal.id, 'active'))}
            >
              Make active
            </button>
            <button className="ghost-button" type="button" onClick={() => openEditGoal(recommendedGoal)}>
              Review goal
            </button>
          </div>
        </section>
      ) : null}

      {activeGoal ? (
        <>
          <GoalCard
            goal={activeGoal}
            weeklyFocus={weeklyFocus?.focus ?? null}
            onEdit={() => openEditGoal(activeGoal)}
            onMakeActive={() => {}}
            onQueue={() => mutate(() => db.dbSetGoalStatus(activeGoal.id, 'queued'))}
            onPark={() => mutate(() => db.dbSetGoalStatus(activeGoal.id, 'parked'))}
            onComplete={() => {
              if (window.confirm('Complete this goal and move it out of the active slot?')) {
                mutate(() => db.dbCompleteGoal(activeGoal.id));
              }
            }}
          />

          <section className="card">
            <div className="section-header">
              <div>
                <p className="eyebrow">This week</p>
                <h3>Weekly focus</h3>
              </div>
            </div>
            <form
              className="stack"
              onSubmit={(event) => {
                event.preventDefault();
                mutate(() => db.dbUpsertWeeklyFocus(activeGoal.id, focusText.trim()));
              }}
            >
              <textarea
                rows={3}
                value={focusText}
                onChange={(event) => setFocusText(event.target.value)}
                placeholder="What is the one move for this week?"
              />
              <button className="primary-button" type="submit" disabled={!focusText.trim()}>
                Save weekly focus
              </button>
            </form>
          </section>
        </>
      ) : (
        <section className="card empty-card">
          <h3>No active goal yet</h3>
          <p className="muted-copy">
            Keep many goals in the vault, but choose one to drive Today, Calendar, and Focus.
          </p>
        </section>
      )}

      <section className="goal-section">
        <div className="section-header">
          <div>
            <p className="eyebrow">Queued</p>
            <h3>Likely next</h3>
          </div>
          <span className="metric-chip">{queuedGoals.length}</span>
        </div>
        {queuedGoals.length === 0 ? (
          <section className="card empty-card">
            <p className="muted-copy">Queue the goals that are close enough to matter, but not steering execution today.</p>
          </section>
        ) : (
          <div className="goal-grid">
            {queuedGoals.map((goal) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                onEdit={() => openEditGoal(goal)}
                onMakeActive={() => mutate(() => db.dbSetGoalStatus(goal.id, 'active'))}
                onQueue={() => mutate(() => db.dbSetGoalStatus(goal.id, 'queued'))}
                onPark={() => mutate(() => db.dbSetGoalStatus(goal.id, 'parked'))}
                onComplete={() => mutate(() => db.dbCompleteGoal(goal.id))}
              />
            ))}
          </div>
        )}
      </section>

      <section className="goal-section">
        <div className="section-header">
          <div>
            <p className="eyebrow">Parked</p>
            <h3>Captured without distraction</h3>
          </div>
          <span className="metric-chip">{parkedGoals.length}</span>
        </div>
        {parkedGoals.length === 0 ? (
          <section className="card empty-card">
            <p className="muted-copy">Park goals that matter, but should not compete for attention yet.</p>
          </section>
        ) : (
          <div className="goal-grid">
            {parkedGoals.map((goal) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                onEdit={() => openEditGoal(goal)}
                onMakeActive={() => mutate(() => db.dbSetGoalStatus(goal.id, 'active'))}
                onQueue={() => mutate(() => db.dbSetGoalStatus(goal.id, 'queued'))}
                onPark={() => mutate(() => db.dbSetGoalStatus(goal.id, 'parked'))}
                onComplete={() => mutate(() => db.dbCompleteGoal(goal.id))}
              />
            ))}
          </div>
        )}
      </section>

      {completedGoals.length > 0 ? (
        <section className="goal-section">
          <div className="section-header">
            <div>
              <p className="eyebrow">Completed</p>
              <h3>Finished goals</h3>
            </div>
            <span className="metric-chip">{completedGoals.length}</span>
          </div>
          <div className="goal-grid">
            {completedGoals.map((goal) => (
              <section className="card goal-card" key={goal.id}>
                <p className="eyebrow">Completed</p>
                <h3>{goal.title}</h3>
                <p>{goal.targetOutcome}</p>
                <div className="chips">
                  <span className="chip">{getGoalPriorityLabel(goal)}</span>
                  {goal.targetDate ? <span className="chip">Target {formatShortDate(goal.targetDate)}</span> : null}
                </div>
              </section>
            ))}
          </div>
        </section>
      ) : null}

      <GoalModal
        open={goalModalOpen}
        title={selectedGoal ? 'Edit goal' : 'Add goal'}
        initialGoal={selectedGoal}
        defaultStatus={defaultGoalStatus}
        onClose={() => setGoalModalOpen(false)}
        onSubmit={(input, status) => {
          if (selectedGoal) {
            mutate(() => db.dbUpdateGoal(selectedGoal.id, input));
            mutate(() => db.dbSetGoalStatus(selectedGoal.id, status));
            return;
          }

          mutate(() => db.dbCreateGoal(input, { status }));
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
  }));

  useEffect(() => {
    db.dbSaveOnboardingDraft(draft);
  }, [draft]);

  const canSubmit =
    draft.goalTitle.trim().length > 0 &&
    draft.targetOutcome.trim().length > 0 &&
    draft.weeklyFocus.trim().length > 0;

  return (
    <div className="onboarding-shell">
      <section className="hero-card">
        <div>
          <p className="eyebrow">Simple web build</p>
          <h1>Set one goal. Anchor it. Start moving.</h1>
          <p className="hero-copy">
            This version drops the Expo web layer and runs as a straightforward React app over HTTPS.
          </p>
        </div>
      </section>

      <section className="card">
        <form
          className="stack"
          onSubmit={(event) => {
            event.preventDefault();
            if (!canSubmit) {
              return;
            }

            mutate(() => db.dbCompleteOnboarding(draft));
            navigate('/today', { replace: true });
          }}
        >
          <GoalFields draft={draft} setDraft={setDraft} showWeeklyFocus />
          <button className="primary-button" type="submit" disabled={!canSubmit}>
            Finish setup
          </button>
        </form>
      </section>
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
