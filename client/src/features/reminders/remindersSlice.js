import { createAsyncThunk, createSelector, createSlice } from '@reduxjs/toolkit';
import { remindersApi } from '@/api/endpoints';
import { errorMessage } from '@/api/client';

const emptyCounts = { overdue: 0, today: 0, thisWeek: 0, later: 0, pending: 0 };

const initialState = {
  items: [],
  counts: { ...emptyCounts }, // counts for whatever the current view asked for
  myCounts: { ...emptyCounts }, // always "my pending tasks" — drives the nav badge
  status: 'idle',
  error: null,
  saving: false,
  filters: { status: 'pending', due: 'all', assignedTo: 'me', sort: 'dueAt' },
};

export const fetchReminders = createAsyncThunk(
  'reminders/fetch',
  async (params, { rejectWithValue }) => {
    try {
      const res = await remindersApi.list(params);
      return { items: res.data, counts: res.meta.counts, total: res.meta.total };
    } catch (err) {
      return rejectWithValue(errorMessage(err));
    }
  }
);

/**
 * Badge-only count. Kept in its own state slot so filtering the to-do list (or
 * the dashboard asking for a narrower window) can never change the nav badge.
 * `limit: 1` is enough — the server counts the whole set, not just the page.
 */
export const fetchMyTaskCounts = createAsyncThunk(
  'reminders/fetchMyCounts',
  async (_, { rejectWithValue }) => {
    try {
      const res = await remindersApi.list({ status: 'pending', assignedTo: 'me', limit: 1 });
      return res.meta.counts;
    } catch (err) {
      return rejectWithValue(errorMessage(err));
    }
  }
);

export const createReminder = createAsyncThunk(
  'reminders/create',
  async (payload, { rejectWithValue }) => {
    try {
      return await remindersApi.create(payload);
    } catch (err) {
      return rejectWithValue(errorMessage(err));
    }
  }
);

export const updateReminder = createAsyncThunk(
  'reminders/update',
  async ({ id, ...payload }, { rejectWithValue }) => {
    try {
      return await remindersApi.update(id, payload);
    } catch (err) {
      return rejectWithValue(errorMessage(err));
    }
  }
);

export const completeReminder = createAsyncThunk(
  'reminders/complete',
  async (id, { rejectWithValue }) => {
    try {
      return await remindersApi.complete(id);
    } catch (err) {
      return rejectWithValue(errorMessage(err));
    }
  }
);

export const deleteReminder = createAsyncThunk(
  'reminders/delete',
  async (id, { rejectWithValue }) => {
    try {
      await remindersApi.remove(id);
      return id;
    } catch (err) {
      return rejectWithValue(errorMessage(err));
    }
  }
);

const remindersSlice = createSlice({
  name: 'reminders',
  initialState,
  reducers: {
    setReminderFilters(state, action) {
      state.filters = { ...state.filters, ...action.payload };
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchReminders.pending, (state) => {
        state.status = state.items.length ? 'succeeded' : 'loading';
        state.error = null;
      })
      .addCase(fetchReminders.fulfilled, (state, action) => {
        state.items = action.payload.items;
        state.counts = action.payload.counts;
        state.status = 'succeeded';
      })
      .addCase(fetchReminders.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
      })

      .addCase(fetchMyTaskCounts.fulfilled, (state, action) => {
        state.myCounts = action.payload;
      })

      .addCase(createReminder.fulfilled, (state, action) => {
        state.items.push(action.payload);
        state.items.sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt));
      })

      .addCase(deleteReminder.fulfilled, (state, action) => {
        state.items = state.items.filter((r) => r._id !== action.payload);
      })

      // Completing or cancelling a task removes it from a "pending" view.
      .addMatcher(
        (action) =>
          action.type === updateReminder.fulfilled.type ||
          action.type === completeReminder.fulfilled.type,
        (state, action) => {
          const updated = action.payload;
          const i = state.items.findIndex((r) => r._id === updated._id);
          if (i === -1) return;
          if (state.filters.status === 'pending' && updated.status !== 'pending') {
            state.items.splice(i, 1);
          } else {
            state.items[i] = updated;
          }
        }
      )

      .addMatcher(
        (action) =>
          action.type.startsWith('reminders/') &&
          ['create', 'update', 'complete', 'delete'].some((op) =>
            action.type.includes(`reminders/${op}/`)
          ),
        (state, action) => {
          state.saving = action.type.endsWith('/pending');
        }
      );
  },
});

export const { setReminderFilters } = remindersSlice.actions;

export const selectReminders = (state) => state.reminders.items;
export const selectReminderCounts = (state) => state.reminders.counts;
export const selectMyTaskCounts = (state) => state.reminders.myCounts;
export const selectRemindersStatus = (state) => state.reminders.status;
export const selectRemindersError = (state) => state.reminders.error;
export const selectReminderFilters = (state) => state.reminders.filters;
export const selectRemindersSaving = (state) => state.reminders.saving;

const endOfToday = () => {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
};

/** Groups the flat list into the buckets the to-do page renders. */
export const selectGroupedReminders = createSelector([selectReminders], (items) => {
  const now = new Date();
  const todayEnd = endOfToday();
  const weekEnd = new Date(todayEnd.getTime() + 6 * 24 * 60 * 60 * 1000);

  const groups = { overdue: [], today: [], thisWeek: [], later: [], done: [] };

  items.forEach((r) => {
    if (r.status !== 'pending') {
      groups.done.push(r);
      return;
    }
    const due = new Date(r.dueAt);
    if (due < now) groups.overdue.push(r);
    else if (due <= todayEnd) groups.today.push(r);
    else if (due <= weekEnd) groups.thisWeek.push(r);
    else groups.later.push(r);
  });

  return groups;
});

export default remindersSlice.reducer;
