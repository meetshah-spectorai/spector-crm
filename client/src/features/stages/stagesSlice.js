import { createAsyncThunk, createSelector, createSlice } from '@reduxjs/toolkit';
import { stagesApi } from '@/api/endpoints';
import { errorMessage } from '@/api/client';

/**
 * The configurable Kanban columns. The board itself renders from the columns
 * returned by /deals/board; this slice backs the column-management UI and the
 * stage pickers on the deal form and detail page.
 */
const initialState = {
  items: [],
  status: 'idle',
  error: null,
  saving: false,
};

export const fetchStages = createAsyncThunk('stages/fetch', async (_, { rejectWithValue }) => {
  try {
    return await stagesApi.list();
  } catch (err) {
    return rejectWithValue(errorMessage(err));
  }
});

export const createStage = createAsyncThunk(
  'stages/create',
  async (payload, { rejectWithValue }) => {
    try {
      return await stagesApi.create(payload);
    } catch (err) {
      return rejectWithValue(errorMessage(err));
    }
  }
);

export const updateStage = createAsyncThunk(
  'stages/update',
  async ({ id, ...payload }, { rejectWithValue }) => {
    try {
      return await stagesApi.update(id, payload);
    } catch (err) {
      return rejectWithValue(errorMessage(err));
    }
  }
);

const stagesSlice = createSlice({
  name: 'stages',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchStages.pending, (state) => {
        state.status = state.items.length ? 'succeeded' : 'loading';
        state.error = null;
      })
      .addCase(fetchStages.fulfilled, (state, action) => {
        state.items = action.payload;
        state.status = 'succeeded';
      })
      .addCase(fetchStages.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
      })

      .addCase(createStage.fulfilled, (state, action) => {
        state.items.push(action.payload);
        state.items.sort((a, b) => a.order - b.order);
      })
      .addCase(updateStage.fulfilled, (state, action) => {
        const i = state.items.findIndex((s) => s._id === action.payload._id);
        if (i !== -1) state.items[i] = action.payload;
      })

      .addMatcher(
        (action) =>
          action.type.startsWith('stages/') &&
          ['create', 'update'].some((op) => action.type.includes(`stages/${op}/`)),
        (state, action) => {
          state.saving = action.type.endsWith('/pending');
        }
      );
  },
});

export const selectStages = (state) => state.stages.items;
export const selectStagesStatus = (state) => state.stages.status;
export const selectStagesError = (state) => state.stages.error;
export const selectStagesSaving = (state) => state.stages.saving;

/** key → stage, for looking up a label or colour from a deal's stage key. */
export const selectStageByKey = createSelector([selectStages], (stages) =>
  Object.fromEntries(stages.map((s) => [s.key, s]))
);

export default stagesSlice.reducer;
