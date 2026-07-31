import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { usersApi } from '@/api/endpoints';
import { errorMessage } from '@/api/client';

/**
 * The team roster, used to populate owner and assignee pickers. Read-only:
 * everyone is a peer, so there is nothing here to administer.
 */
const initialState = {
  items: [],
  status: 'idle',
  error: null,
};

export const fetchUsers = createAsyncThunk('users/fetch', async (_, { rejectWithValue }) => {
  try {
    return await usersApi.list();
  } catch (err) {
    return rejectWithValue(errorMessage(err));
  }
});

const usersSlice = createSlice({
  name: 'users',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchUsers.pending, (state) => {
        state.status = state.items.length ? 'succeeded' : 'loading';
      })
      .addCase(fetchUsers.fulfilled, (state, action) => {
        state.items = action.payload;
        state.status = 'succeeded';
      })
      .addCase(fetchUsers.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
      });
  },
});

export const selectUsers = (state) => state.users.items;
export const selectUsersStatus = (state) => state.users.status;

export default usersSlice.reducer;
