import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { dealsApi } from '@/api/endpoints';
import { errorMessage } from '@/api/client';

const initialState = {
  columns: [],
  boardStatus: 'idle', // idle | loading | succeeded | failed
  boardError: null,
  filters: { owner: '', search: '' },

  stats: null,
  statsStatus: 'idle',

  current: null, // { deal, activities, reminders }
  currentStatus: 'idle',
  currentError: null,

  saving: false,
};

const withError = (fn) => async (arg, { rejectWithValue }) => {
  try {
    return await fn(arg);
  } catch (err) {
    return rejectWithValue(errorMessage(err));
  }
};

export const fetchBoard = createAsyncThunk(
  'deals/fetchBoard',
  withError((params) => dealsApi.board(params))
);

export const fetchStats = createAsyncThunk(
  'deals/fetchStats',
  withError(() => dealsApi.stats())
);

export const fetchDeal = createAsyncThunk(
  'deals/fetchDeal',
  withError((id) => dealsApi.get(id))
);

export const createDeal = createAsyncThunk(
  'deals/create',
  withError((payload) => dealsApi.create(payload))
);

export const updateDeal = createAsyncThunk(
  'deals/update',
  withError(({ id, ...payload }) => dealsApi.update(id, payload))
);

/**
 * Persists a drag. The reducer has already moved the card optimistically, so on
 * failure we reload the board to fall back to server truth.
 */
export const moveDeal = createAsyncThunk(
  'deals/move',
  async ({ id, stage, index }, { dispatch, getState, rejectWithValue }) => {
    try {
      return await dealsApi.move(id, { stage, index });
    } catch (err) {
      dispatch(fetchBoard(getState().deals.filters));
      return rejectWithValue(errorMessage(err));
    }
  }
);

export const addDealNote = createAsyncThunk(
  'deals/addNote',
  withError(({ id, note }) => dealsApi.addNote(id, note))
);

export const archiveDeal = createAsyncThunk(
  'deals/archive',
  withError((id) => dealsApi.archive(id))
);

export const restoreDeal = createAsyncThunk(
  'deals/restore',
  withError((id) => dealsApi.restore(id))
);

export const deleteDeal = createAsyncThunk(
  'deals/delete',
  async (id, { rejectWithValue }) => {
    try {
      await dealsApi.remove(id);
      return id;
    } catch (err) {
      return rejectWithValue(errorMessage(err));
    }
  }
);

const recalcColumn = (column) => {
  column.count = column.deals.length;
  column.totalValue = column.deals.reduce((sum, d) => sum + (d.value || 0), 0);
  column.weightedValue = column.deals.reduce((sum, d) => sum + (d.weightedValue || 0), 0);
};

const dealsSlice = createSlice({
  name: 'deals',
  initialState,
  reducers: {
    setFilters(state, action) {
      state.filters = { ...state.filters, ...action.payload };
    },
    clearCurrentDeal(state) {
      state.current = null;
      state.currentStatus = 'idle';
    },
    /**
     * Optimistic drag-and-drop. Moves the card between columns (or within one)
     * before the request lands, so the board never feels laggy.
     */
    applyLocalMove(state, action) {
      const { dealId, fromStage, toStage, toIndex } = action.payload;
      const from = state.columns.find((c) => c.key === fromStage);
      const to = state.columns.find((c) => c.key === toStage);
      if (!from || !to) return;

      const currentIndex = from.deals.findIndex((d) => d._id === dealId);
      if (currentIndex === -1) return;

      const [card] = from.deals.splice(currentIndex, 1);
      card.stage = toStage;

      // Mirror the server's stage→status rule locally so badges update instantly.
      // Driven by the column's configured outcome, not by a hardcoded key.
      if (to.outcome === 'won') {
        card.status = 'won';
        card.probability = 100;
      } else if (to.outcome === 'lost') {
        card.status = 'lost';
        card.probability = 0;
      } else {
        card.status = 'open';
        card.probability = to.probability ?? card.probability;
      }
      card.weightedValue = Math.round((card.value || 0) * ((card.probability || 0) / 100));

      to.deals.splice(Math.min(toIndex, to.deals.length), 0, card);

      recalcColumn(from);
      if (to !== from) recalcColumn(to);
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchBoard.pending, (state) => {
        state.boardStatus = state.columns.length ? 'succeeded' : 'loading';
        state.boardError = null;
      })
      .addCase(fetchBoard.fulfilled, (state, action) => {
        state.columns = action.payload;
        state.boardStatus = 'succeeded';
      })
      .addCase(fetchBoard.rejected, (state, action) => {
        state.boardStatus = 'failed';
        state.boardError = action.payload;
      })

      .addCase(fetchStats.pending, (state) => {
        state.statsStatus = 'loading';
      })
      .addCase(fetchStats.fulfilled, (state, action) => {
        state.stats = action.payload;
        state.statsStatus = 'succeeded';
      })
      .addCase(fetchStats.rejected, (state) => {
        state.statsStatus = 'failed';
      })

      .addCase(fetchDeal.pending, (state) => {
        state.currentStatus = 'loading';
        state.currentError = null;
      })
      .addCase(fetchDeal.fulfilled, (state, action) => {
        state.current = action.payload;
        state.currentStatus = 'succeeded';
      })
      .addCase(fetchDeal.rejected, (state, action) => {
        state.currentStatus = 'failed';
        state.currentError = action.payload;
      })

      .addCase(createDeal.fulfilled, (state, action) => {
        const column = state.columns.find((c) => c.key === action.payload.stage);
        if (column) {
          column.deals.unshift({ ...action.payload, pendingReminders: 0, nextAction: null });
          recalcColumn(column);
        }
      })

      .addCase(updateDeal.fulfilled, (state, action) => {
        const deal = action.payload;
        if (state.current?.deal?._id === deal._id) {
          state.current.deal = { ...state.current.deal, ...deal };
        }
        // The stage may have changed, so drop the old card and re-insert.
        state.columns.forEach((column) => {
          const i = column.deals.findIndex((d) => d._id === deal._id);
          if (i !== -1) {
            const existing = column.deals[i];
            if (column.key === deal.stage) column.deals[i] = { ...existing, ...deal };
            else column.deals.splice(i, 1);
            recalcColumn(column);
          }
        });
        if (!state.columns.some((c) => c.deals.some((d) => d._id === deal._id))) {
          const target = state.columns.find((c) => c.key === deal.stage);
          if (target) {
            target.deals.unshift({ ...deal, pendingReminders: 0, nextAction: null });
            recalcColumn(target);
          }
        }
      })

      .addCase(moveDeal.fulfilled, (state, action) => {
        const deal = action.payload;
        const column = state.columns.find((c) => c.key === deal.stage);
        const card = column?.deals.find((d) => d._id === deal._id);
        if (card) Object.assign(card, deal);
        if (column) recalcColumn(column);
      })

      .addCase(addDealNote.fulfilled, (state, action) => {
        if (state.current) state.current.activities.unshift(action.payload);
      })

      .addCase(deleteDeal.fulfilled, (state, action) => {
        state.columns.forEach((column) => {
          const i = column.deals.findIndex((d) => d._id === action.payload);
          if (i !== -1) {
            column.deals.splice(i, 1);
            recalcColumn(column);
          }
        });
        if (state.current?.deal?._id === action.payload) state.current = null;
      });

    // Archive/restore both remove the card from (or need a refetch for) the board.
    [archiveDeal, restoreDeal].forEach((thunk) => {
      builder.addCase(thunk.fulfilled, (state, action) => {
        const deal = action.payload;
        state.columns.forEach((column) => {
          const i = column.deals.findIndex((d) => d._id === deal._id);
          if (i !== -1 && deal.archived) {
            column.deals.splice(i, 1);
            recalcColumn(column);
          }
        });
        if (state.current?.deal?._id === deal._id) {
          state.current.deal = { ...state.current.deal, ...deal };
        }
      });
    });

    // A single `saving` flag drives every submit button's spinner.
    builder
      .addMatcher(
        (action) =>
          action.type.startsWith('deals/') &&
          ['create', 'update', 'archive', 'restore', 'delete', 'addNote'].some((op) =>
            action.type.includes(`deals/${op}/`)
          ),
        (state, action) => {
          state.saving = action.type.endsWith('/pending');
        }
      );
  },
});

export const { setFilters, clearCurrentDeal, applyLocalMove } = dealsSlice.actions;

export const selectColumns = (state) => state.deals.columns;
export const selectBoardStatus = (state) => state.deals.boardStatus;
export const selectBoardError = (state) => state.deals.boardError;
export const selectFilters = (state) => state.deals.filters;
export const selectStats = (state) => state.deals.stats;
export const selectCurrentDeal = (state) => state.deals.current;
export const selectCurrentStatus = (state) => state.deals.currentStatus;
export const selectSaving = (state) => state.deals.saving;

export default dealsSlice.reducer;
