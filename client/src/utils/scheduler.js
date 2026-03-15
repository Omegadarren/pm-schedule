import { addDays, parseISO, differenceInCalendarDays, formatISO } from 'date-fns';
import { parseDeps } from '../components/Grid/DependencyEditor.jsx';

/** Parse a date string safely, return a Date or null */
function pd(str) {
  if (!str) return null;
  try { return parseISO(str); } catch { return null; }
}

/** Format a Date back to 'YYYY-MM-DD' */
function fmt(date) {
  return formatISO(date, { representation: 'date' });
}

/**
 * Given a single dependency link and the full task list, compute what the
 * successor's NEW start date should be.
 *
 * FS  → successor starts on: predecessor.end_date + lag + 1 day
 * SS  → successor starts on: predecessor.start_date + lag
 * FF  → successor ends on:   predecessor.end_date + lag
 *        → start = end - (duration - 1)
 * SF  → successor ends on:   predecessor.start_date + lag
 *        → start = end - (duration - 1)
 *
 * Returns { start_date, end_date } strings, or null if predecessor has no dates.
 */
function computeNewDatesFromDep(dep, successorTask, allTasks) {
  const pred = allTasks.find((t) => t.id === dep.id);
  if (!pred) return null;

  const lag = dep.lag || 0;
  const type = dep.type || 'FS';
  const duration = Math.max(1, successorTask.duration_days || 1);

  const predStart = pd(pred.start_date);
  const predEnd   = pd(pred.end_date);

  let newStart = null;
  let newEnd   = null;

  if (type === 'FS') {
    if (!predEnd) return null;
    newStart = addDays(predEnd, lag + 1);
    newEnd   = addDays(newStart, duration - 1);
  } else if (type === 'SS') {
    if (!predStart) return null;
    newStart = addDays(predStart, lag);
    newEnd   = addDays(newStart, duration - 1);
  } else if (type === 'FF') {
    if (!predEnd) return null;
    newEnd   = addDays(predEnd, lag);
    newStart = addDays(newEnd, -(duration - 1));
  } else if (type === 'SF') {
    if (!predStart) return null;
    newEnd   = addDays(predStart, lag);
    newStart = addDays(newEnd, -(duration - 1));
  }

  if (!newStart) return null;
  return { start_date: fmt(newStart), end_date: fmt(newEnd) };
}

/**
 * Compute the constrained start/end for a task driven by ALL its dependencies.
 * When multiple predecessors exist, take the LATEST driven start (most conservative).
 */
export function computeTaskDates(task, allTasks) {
  const deps = parseDeps(task.predecessor_ids).filter((d) => d.id);
  if (!deps.length) return null;

  let latestStart = null;
  let latestEnd   = null;

  for (const dep of deps) {
    const result = computeNewDatesFromDep(dep, task, allTasks);
    if (!result) continue;

    const s = pd(result.start_date);
    const e = pd(result.end_date);

    if (!latestStart || s > latestStart) { latestStart = s; latestEnd = e; }
  }

  if (!latestStart) return null;
  return { start_date: fmt(latestStart), end_date: fmt(latestEnd) };
}

/**
 * Given a changed task (e.g. its dates just changed), find all tasks in the
 * project that have it as a predecessor and return their updated dates.
 * Recurses to cascade through the full chain.
 * Returns an array of { id, start_date, end_date, duration_days } updates.
 */
export function cascadeSchedule(changedTaskId, allTasks) {
  const updates = [];
  const visited = new Set();

  function cascade(taskId) {
    if (visited.has(taskId)) return; // prevent infinite loops
    visited.add(taskId);

    // Find all tasks that have taskId as a predecessor
    const successors = allTasks.filter((t) => {
      const deps = parseDeps(t.predecessor_ids);
      return deps.some((d) => d.id === taskId);
    });

    for (const succ of successors) {
      // Re-compute using the latest state of allTasks (including any updates already made)
      const mergedTasks = allTasks.map((t) => {
        const existing = updates.find((u) => u.id === t.id);
        return existing ? { ...t, ...existing } : t;
      });

      const newDates = computeTaskDates(succ, mergedTasks);
      if (!newDates) continue;

      const duration = Math.max(1,
        differenceInCalendarDays(pd(newDates.end_date), pd(newDates.start_date)) + 1
      );

      // Only push if dates actually changed
      const existing = updates.find((u) => u.id === succ.id);
      if (!existing) {
        if (succ.start_date !== newDates.start_date || succ.end_date !== newDates.end_date) {
          updates.push({ id: succ.id, ...newDates, duration_days: duration });
          cascade(succ.id); // recurse for successors of this successor
        }
      }
    }
  }

  cascade(changedTaskId);
  return updates;
}
