import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { activitiesApi } from '@/api/endpoints';
import { errorMessage } from '@/api/client';

const initialState = {
  items: [],
  status: 'idle',
  error: null,
  page: 1,
  pages: 1,
  total: 0,
  filters: { type: '', actor: '' },
};

export const fetchActivities = createAsyncThunk(
  'activities/fetch',
  async (params = {}, { rejectWithValue }) => {
    try {
      const res = await activitiesApi.list(params);
      return { items: res.data, ...res.meta, append: (params.page || 1) > 1 };
    } catch (err) {
      return rejectWithValue(errorMessage(err));
    }
  }
);

const activitiesSlice = createSlice({
  name: 'activities',
  initialState,
  reducers: {
    setActivityFilters(state, action) {
      state.filters = { ...state.filters, ...action.payload };
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchActivities.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchActivities.fulfilled, (state, action) => {
        const { items, page, pages, total, append } = action.payload;
        state.items = append ? [...state.items, ...items] : items;
        state.page = page;
        state.pages = pages;
        state.total = total;
        state.status = 'succeeded';
      })
      .addCase(fetchActivities.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
      });
  },
});

export const { setActivityFilters } = activitiesSlice.actions;

export const selectActivities = (state) => state.activities.items;
export const selectActivitiesStatus = (state) => state.activities.status;
export const selectActivitiesError = (state) => state.activities.error;
export const selectActivitiesPaging = (state) => ({
  page: state.activities.page,
  pages: state.activities.pages,
  total: state.activities.total,
});
export const selectActivityFilters = (state) => state.activities.filters;

export default activitiesSlice.reducer;
