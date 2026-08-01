import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { notesApi } from '@/api/endpoints';
import { errorMessage } from '@/api/client';

const initialState = {
  items: [],
  dealId: null, // whose notes `items` holds, so one deal never shows another's
  total: 0,
  status: 'idle',
  error: null,
  saving: false,
  search: '',
};

/** Pinned first, then newest — the server already sorts, so keep its order. */
const sortNotes = (items) =>
  items.sort(
    (a, b) => Number(b.pinned) - Number(a.pinned) || new Date(b.createdAt) - new Date(a.createdAt)
  );

export const fetchDealNotes = createAsyncThunk(
  'notes/fetchForDeal',
  async ({ dealId, search = '' }, { rejectWithValue }) => {
    try {
      const res = await notesApi.list({ deal: dealId, ...(search ? { search } : {}) });
      return { dealId, items: res.data, total: res.meta.total };
    } catch (err) {
      return rejectWithValue(errorMessage(err));
    }
  }
);

export const createNote = createAsyncThunk(
  'notes/create',
  async ({ dealId, body }, { rejectWithValue }) => {
    try {
      return await notesApi.create({ deal: dealId, body });
    } catch (err) {
      return rejectWithValue(errorMessage(err));
    }
  }
);

export const updateNote = createAsyncThunk(
  'notes/update',
  async ({ id, ...payload }, { rejectWithValue }) => {
    try {
      return await notesApi.update(id, payload);
    } catch (err) {
      return rejectWithValue(errorMessage(err));
    }
  }
);

export const deleteNote = createAsyncThunk('notes/delete', async (id, { rejectWithValue }) => {
  try {
    await notesApi.remove(id);
    return id;
  } catch (err) {
    return rejectWithValue(errorMessage(err));
  }
});

const notesSlice = createSlice({
  name: 'notes',
  initialState,
  reducers: {
    setNoteSearch(state, action) {
      state.search = action.payload;
    },
    resetNotes() {
      return initialState;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchDealNotes.pending, (state, action) => {
        // Keep the list visible while re-filtering the same deal.
        const sameDeal = state.dealId === action.meta.arg.dealId;
        state.status = sameDeal && state.items.length ? 'succeeded' : 'loading';
        state.error = null;
      })
      .addCase(fetchDealNotes.fulfilled, (state, action) => {
        state.items = action.payload.items;
        state.dealId = action.payload.dealId;
        state.total = action.payload.total;
        state.status = 'succeeded';
      })
      .addCase(fetchDealNotes.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
      })

      .addCase(createNote.fulfilled, (state, action) => {
        state.items = sortNotes([action.payload, ...state.items]);
        state.total += 1;
      })

      .addCase(updateNote.fulfilled, (state, action) => {
        const i = state.items.findIndex((n) => n._id === action.payload._id);
        if (i !== -1) state.items[i] = action.payload;
        state.items = sortNotes(state.items);
      })

      .addCase(deleteNote.fulfilled, (state, action) => {
        state.items = state.items.filter((n) => n._id !== action.payload);
        state.total = Math.max(0, state.total - 1);
      })

      .addMatcher(
        (action) =>
          ['create', 'update', 'delete'].some((op) => action.type.startsWith(`notes/${op}/`)),
        (state, action) => {
          state.saving = action.type.endsWith('/pending');
        }
      );
  },
});

export const { setNoteSearch, resetNotes } = notesSlice.actions;

export const selectNotes = (state) => state.notes.items;
export const selectNotesStatus = (state) => state.notes.status;
export const selectNotesError = (state) => state.notes.error;
export const selectNotesTotal = (state) => state.notes.total;
export const selectNotesSaving = (state) => state.notes.saving;
export const selectNoteSearch = (state) => state.notes.search;

export default notesSlice.reducer;
