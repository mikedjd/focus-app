import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import {
  completeTask,
  createTask,
  dropTask,
  getTasksForDate,
  subscribeToDataChanges,
  uncompleteTask,
} from '../../src/api/client';
import { AddTaskSheet } from '../../src/components/today/AddTaskSheet';
import { TaskCard } from '../../src/components/TaskCard';
import { C } from '../../src/constants/colors';
import { useGoals } from '../../src/hooks/useGoals';
import { useProjects } from '../../src/hooks/useProjects';
import { formatDate, formatDisplayDate, todayString } from '../../src/utils/dates';
import type { DailyTask, TaskPlanInput } from '../../src/types';

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAILY_CAP = 3;
const MONTH_GRID_DAYS = 42;

type PlannerView = 'month' | 'day';

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

function formatSelectedDateLabel(dateStr: string): string {
  return formatDisplayDate(new Date(`${dateStr}T12:00:00`));
}

function formatDayNumber(dateStr: string): string {
  return String(parseDate(dateStr).getDate());
}

function isDateInMonth(dateStr: string, monthStart: string): boolean {
  return dateStr.slice(0, 7) === monthStart.slice(0, 7);
}

export default function CalendarScreen() {
  const router = useRouter();
  const today = todayString();
  const { activeGoal, weeklyFocus } = useGoals();
  const { projects } = useProjects(activeGoal?.id ?? null);

  const [viewMode, setViewMode] = useState<PlannerView>('month');
  const [displayMonth, setDisplayMonth] = useState(getMonthStart(today));
  const [selectedDate, setSelectedDate] = useState(today);
  const [tasksByDate, setTasksByDate] = useState<Record<string, DailyTask[]>>({});
  const [showAddSheet, setShowAddSheet] = useState(false);

  const monthDates = useMemo(() => getMonthGridDates(displayMonth), [displayMonth]);
  const datesToLoad = useMemo(() => {
    const uniqueDates = new Set(monthDates);
    uniqueDates.add(selectedDate);
    return Array.from(uniqueDates);
  }, [monthDates, selectedDate]);

  const refreshCalendar = useCallback(async () => {
    const entries = await Promise.all(
      datesToLoad.map(async (date) => [date, await getTasksForDate(date)] as const)
    );
    setTasksByDate((current) => ({ ...current, ...Object.fromEntries(entries) }));
  }, [datesToLoad]);

  useEffect(() => {
    void refreshCalendar();
  }, [refreshCalendar]);

  useFocusEffect(
    useCallback(() => {
      void refreshCalendar();
    }, [refreshCalendar])
  );

  useEffect(() => subscribeToDataChanges(() => void refreshCalendar()), [refreshCalendar]);

  const selectedTasks = tasksByDate[selectedDate] ?? [];
  const isPast = selectedDate < today;
  const isSelectedToday = selectedDate === today;
  const activeCap = isSelectedToday ? DAILY_CAP : Infinity;
  const canAddMore = !isPast && selectedTasks.length < activeCap;
  const selectedDoneCount = selectedTasks.filter((task) => task.status === 'done').length;

  const handleToggle = useCallback(async (taskId: string) => {
    const task = selectedTasks.find((entry) => entry.id === taskId);
    if (!task) return;

    if (task.status === 'done') {
      await uncompleteTask(taskId);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await completeTask(taskId);
    }

    void refreshCalendar();
  }, [selectedTasks, refreshCalendar]);

  const handleDrop = useCallback(async (taskId: string) => {
    await dropTask(taskId);
    void refreshCalendar();
  }, [refreshCalendar]);

  const handleAddTask = useCallback(
    async (input: TaskPlanInput) => {
      if (!activeGoal) return { ok: false as const, reason: 'missing_goal' as const };

      const result = await createTask({
        title: input.title,
        goalId: activeGoal.id,
        weeklyFocusId: weeklyFocus?.id ?? null,
        nextStep: input.nextStep,
        projectId: input.projectId,
        options: {
          date: selectedDate,
          phaseId: input.phaseId,
          focusDurationMinutes: input.focusDurationMinutes,
          breakDurationMinutes: input.breakDurationMinutes,
        },
      });
      void refreshCalendar();
      return result;
    },
    [activeGoal, weeklyFocus, selectedDate, refreshCalendar]
  );

  const handleSelectDate = useCallback((date: string) => {
    setSelectedDate(date);
  }, []);

  const handleMonthShift = useCallback((direction: -1 | 1) => {
    const nextMonth = addMonths(displayMonth, direction);
    setDisplayMonth(nextMonth);
    setSelectedDate((current) => (isDateInMonth(current, nextMonth) ? current : nextMonth));
  }, [displayMonth]);

  const handleDayShift = useCallback((direction: -1 | 1) => {
    const nextDate = addDays(selectedDate, direction);
    setSelectedDate(nextDate);
    setDisplayMonth(getMonthStart(nextDate));
  }, [selectedDate]);

  const handleJumpToToday = useCallback(() => {
    setSelectedDate(today);
    setDisplayMonth(getMonthStart(today));
    setViewMode('day');
  }, [today]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View>
            <Text style={styles.screenTitle}>Plan</Text>
            <Text style={styles.screenSubtitle}>
              Switch between a monthly scan and a focused day plan.
            </Text>
          </View>
          <TouchableOpacity style={styles.todayButton} onPress={handleJumpToToday}>
            <Text style={styles.todayButtonText}>Today</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.viewSwitch}>
          {(['month', 'day'] as PlannerView[]).map((mode) => {
            const active = viewMode === mode;
            return (
              <TouchableOpacity
                key={mode}
                style={[styles.viewSwitchOption, active && styles.viewSwitchOptionActive]}
                onPress={() => setViewMode(mode)}
              >
                <Text style={[styles.viewSwitchText, active && styles.viewSwitchTextActive]}>
                  {mode === 'month' ? 'Month' : 'Day'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {viewMode === 'month' ? (
          <>
            <View style={styles.calendarCard}>
              <View style={styles.monthHeader}>
                <TouchableOpacity onPress={() => handleMonthShift(-1)} style={styles.navBtn}>
                  <Text style={styles.navArrow}>‹</Text>
                </TouchableOpacity>
                <Text style={styles.monthLabel}>{formatMonthLabel(displayMonth)}</Text>
                <TouchableOpacity onPress={() => handleMonthShift(1)} style={styles.navBtn}>
                  <Text style={styles.navArrow}>›</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.weekdayRow}>
                {WEEKDAY_LABELS.map((label) => (
                  <Text key={label} style={styles.weekdayLabel}>
                    {label}
                  </Text>
                ))}
              </View>

              <View style={styles.monthGrid}>
                {monthDates.map((date) => {
                  const tasks = tasksByDate[date] ?? [];
                  const doneCount = tasks.filter((task) => task.status === 'done').length;
                  const isCurrentMonth = isDateInMonth(date, displayMonth);
                  const isTodayCell = date === today;
                  const isSelected = date === selectedDate;

                  return (
                    <TouchableOpacity
                      key={date}
                      style={styles.monthCell}
                      onPress={() => {
                        handleSelectDate(date);
                        if (!isCurrentMonth) setDisplayMonth(getMonthStart(date));
                      }}
                      onLongPress={() => {
                        handleSelectDate(date);
                        setDisplayMonth(getMonthStart(date));
                        setViewMode('day');
                      }}
                    >
                      <View
                        style={[
                          styles.monthCellInner,
                          isSelected && styles.monthCellInnerSelected,
                          isTodayCell && !isSelected && styles.monthCellInnerToday,
                          !isCurrentMonth && styles.monthCellInnerMuted,
                        ]}
                      >
                        <Text
                          style={[
                            styles.monthCellNumber,
                            isSelected && styles.monthCellNumberSelected,
                            !isCurrentMonth && !isSelected && styles.monthCellNumberMuted,
                          ]}
                        >
                          {formatDayNumber(date)}
                        </Text>

                        {tasks.length > 0 ? (
                          <>
                            <View
                              style={[
                                styles.monthCountBadge,
                                isSelected && styles.monthCountBadgeSelected,
                              ]}
                            >
                              <Text
                                style={[
                                  styles.monthCountBadgeText,
                                  isSelected && styles.monthCountBadgeTextSelected,
                                ]}
                              >
                                {doneCount}/{tasks.length}
                              </Text>
                            </View>
                            <View style={styles.monthDotRow}>
                              {tasks.slice(0, 3).map((task) => (
                                <View
                                  key={task.id}
                                  style={[
                                    styles.monthDot,
                                    task.status === 'done'
                                      ? styles.monthDotDone
                                      : styles.monthDotPending,
                                  ]}
                                />
                              ))}
                            </View>
                          </>
                        ) : (
                          <Text style={[styles.monthCellHint, isSelected && styles.monthCellHintSelected]}>
                            free
                          </Text>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={styles.previewCard}>
              <View style={styles.previewHeader}>
                <View style={styles.previewTitleBlock}>
                  <Text style={styles.previewEyebrow}>Selected day</Text>
                  <Text style={styles.previewTitle}>
                    {isSelectedToday ? 'Today' : formatSelectedDateLabel(selectedDate)}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.previewButton}
                  onPress={() => {
                    setDisplayMonth(getMonthStart(selectedDate));
                    setViewMode('day');
                  }}
                >
                  <Text style={styles.previewButtonText}>Open day</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.previewSummary}>
                {selectedTasks.length === 0
                  ? isPast
                    ? 'Nothing was planned here.'
                    : 'No tasks planned yet.'
                  : `${selectedDoneCount}/${selectedTasks.length} tasks complete.`}
              </Text>

              {selectedTasks.length > 0 ? (
                <View style={styles.previewList}>
                  {selectedTasks.slice(0, 3).map((task) => (
                    <View key={task.id} style={styles.previewItem}>
                      <View
                        style={[
                          styles.previewItemDot,
                          task.status === 'done' ? styles.previewItemDotDone : styles.previewItemDotPending,
                        ]}
                      />
                      <Text
                        style={[styles.previewItemText, task.status === 'done' && styles.previewItemTextDone]}
                        numberOfLines={1}
                      >
                        {task.title}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          </>
        ) : (
          <>
            <View style={styles.dayNavigator}>
              <TouchableOpacity onPress={() => handleDayShift(-1)} style={styles.navBtn}>
                <Text style={styles.navArrow}>‹</Text>
              </TouchableOpacity>
              <View style={styles.dayNavigatorText}>
                <Text style={styles.dayNavigatorEyebrow}>{formatMonthLabel(getMonthStart(selectedDate))}</Text>
                <Text style={styles.dayTitle}>
                  {isSelectedToday ? `Today · ${formatSelectedDateLabel(selectedDate)}` : formatSelectedDateLabel(selectedDate)}
                </Text>
              </View>
              <TouchableOpacity onPress={() => handleDayShift(1)} style={styles.navBtn}>
                <Text style={styles.navArrow}>›</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.daySummaryCard}>
              <Text style={styles.daySummaryLabel}>Daily view</Text>
              <Text style={styles.daySummaryText}>
                {selectedTasks.length === 0
                  ? isPast
                    ? 'Nothing was planned for this day.'
                    : 'This day is clear so far.'
                  : `${selectedDoneCount}/${selectedTasks.length} tasks finished.`}
              </Text>
              {isSelectedToday ? (
                <Text style={styles.capLabel}>{selectedTasks.length}/{DAILY_CAP} tasks in today's lane</Text>
              ) : null}
            </View>

            {!activeGoal ? (
              <View style={styles.noGoal}>
                <Text style={styles.noGoalText}>Set a goal first to plan tasks.</Text>
                <TouchableOpacity onPress={() => router.push('/(tabs)/goals')}>
                  <Text style={styles.noGoalLink}>Set a Goal →</Text>
                </TouchableOpacity>
              </View>
            ) : selectedTasks.length === 0 ? (
              <View style={styles.emptyDay}>
                {isPast ? (
                  <Text style={styles.emptyText}>No tasks were planned for this day.</Text>
                ) : (
                  <TouchableOpacity style={styles.addFirstBtn} onPress={() => setShowAddSheet(true)}>
                    <Text style={styles.addFirstBtnText}>+ Plan a task for this day</Text>
                    {isSelectedToday ? <Text style={styles.addFirstHint}>up to 3 · concrete actions only</Text> : null}
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <>
                {selectedTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    isNextUp={false}
                    onToggle={(id) => void handleToggle(id)}
                    onFocus={(id) => router.push(`/focus?taskId=${id}`)}
                    onDrop={(id) => void handleDrop(id)}
                  />
                ))}
                {canAddMore ? (
                  <TouchableOpacity style={styles.addMoreBtn} onPress={() => setShowAddSheet(true)}>
                    <Text style={styles.addMoreBtnText}>+ Add task{isSelectedToday ? '' : ' for this day'}</Text>
                  </TouchableOpacity>
                ) : null}
              </>
            )}
          </>
        )}
      </ScrollView>

      <AddTaskSheet
        visible={showAddSheet}
        activeGoalTitle={activeGoal?.title}
        projects={projects}
        selectedProjectId={null}
        onClose={() => setShowAddSheet(false)}
        onSubmit={handleAddTask}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    gap: 12,
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: C.text,
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  screenSubtitle: {
    fontSize: 14,
    color: C.textSecondary,
    lineHeight: 20,
    maxWidth: 240,
  },
  todayButton: {
    backgroundColor: C.accentLight,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  todayButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: C.accent,
  },
  viewSwitch: {
    flexDirection: 'row',
    backgroundColor: C.surfaceSecondary,
    borderRadius: 14,
    padding: 4,
    marginBottom: 16,
  },
  viewSwitchOption: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 10,
  },
  viewSwitchOptionActive: {
    backgroundColor: C.surface,
  },
  viewSwitchText: {
    fontSize: 14,
    fontWeight: '600',
    color: C.textSecondary,
  },
  viewSwitchTextActive: {
    color: C.text,
  },
  calendarCard: {
    backgroundColor: C.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.border,
    padding: 16,
    marginBottom: 16,
  },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navArrow: {
    fontSize: 22,
    fontWeight: '600',
    color: C.accent,
    lineHeight: 24,
  },
  monthLabel: {
    fontSize: 17,
    fontWeight: '700',
    color: C.text,
  },
  weekdayRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  weekdayLabel: {
    flex: 1,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: C.textMuted,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -3,
    rowGap: 6,
  },
  monthCell: {
    width: '14.2857%',
    paddingHorizontal: 3,
  },
  monthCellInner: {
    minHeight: 74,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surfaceSecondary,
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  monthCellInnerSelected: {
    backgroundColor: C.accentLight,
    borderColor: C.accent,
  },
  monthCellInnerToday: {
    backgroundColor: C.surface,
    borderColor: C.accent,
  },
  monthCellInnerMuted: {
    opacity: 0.58,
  },
  monthCellNumber: {
    fontSize: 13,
    fontWeight: '700',
    color: C.text,
    marginBottom: 6,
  },
  monthCellNumberSelected: {
    color: C.accent,
  },
  monthCellNumberMuted: {
    color: C.textMuted,
  },
  monthCountBadge: {
    alignSelf: 'flex-start',
    backgroundColor: C.surface,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 3,
    marginBottom: 6,
  },
  monthCountBadgeSelected: {
    backgroundColor: C.accent,
  },
  monthCountBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: C.textSecondary,
  },
  monthCountBadgeTextSelected: {
    color: '#fff',
  },
  monthDotRow: {
    flexDirection: 'row',
    gap: 4,
  },
  monthDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  monthDotDone: {
    backgroundColor: C.success,
  },
  monthDotPending: {
    backgroundColor: C.accent,
  },
  monthCellHint: {
    fontSize: 10,
    color: C.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  monthCellHintSelected: {
    color: C.accent,
  },
  previewCard: {
    backgroundColor: C.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    padding: 16,
    marginBottom: 16,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 10,
  },
  previewTitleBlock: {
    flex: 1,
  },
  previewEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: C.textMuted,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  previewTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: C.text,
  },
  previewButton: {
    backgroundColor: C.accentLight,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  previewButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: C.accent,
  },
  previewSummary: {
    fontSize: 14,
    color: C.textSecondary,
    marginBottom: 12,
  },
  previewList: {
    gap: 8,
  },
  previewItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  previewItemDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
  },
  previewItemDotDone: {
    backgroundColor: C.success,
  },
  previewItemDotPending: {
    backgroundColor: C.accent,
  },
  previewItemText: {
    flex: 1,
    fontSize: 14,
    color: C.text,
  },
  previewItemTextDone: {
    color: C.textSecondary,
    textDecorationLine: 'line-through',
  },
  dayNavigator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    gap: 12,
  },
  dayNavigatorText: {
    flex: 1,
    alignItems: 'center',
  },
  dayNavigatorEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: C.textMuted,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  dayTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: C.text,
    textAlign: 'center',
  },
  daySummaryCard: {
    backgroundColor: C.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    padding: 16,
    marginBottom: 16,
  },
  daySummaryLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: C.textMuted,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  daySummaryText: {
    fontSize: 15,
    color: C.text,
    marginBottom: 6,
  },
  capLabel: {
    fontSize: 13,
    color: C.textSecondary,
    fontWeight: '500',
  },
  noGoal: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  noGoalText: { fontSize: 15, color: C.textSecondary },
  noGoalLink: { fontSize: 15, color: C.accent, fontWeight: '600' },
  emptyDay: { paddingVertical: 20 },
  emptyText: { fontSize: 14, color: C.textMuted, textAlign: 'center' },
  addFirstBtn: {
    backgroundColor: C.accent,
    borderRadius: 12,
    paddingVertical: 18,
    alignItems: 'center',
  },
  addFirstBtnText: { fontSize: 16, color: '#fff', fontWeight: '600' },
  addFirstHint: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 4 },
  addMoreBtn: {
    backgroundColor: C.surfaceSecondary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    borderStyle: 'dashed',
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 6,
  },
  addMoreBtnText: { fontSize: 15, color: C.accent, fontWeight: '600' },
});
