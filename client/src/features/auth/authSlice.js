import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { authApi } from '@/api/endpoints';
import { bootstrapSession, errorMessage, setAccessToken } from '@/api/client';

const initialState = {
  user: null,
  status: 'idle', // idle | loading | authenticated | unauthenticated
  bootstrapped: false,
  error: null,
};

/**
 * On a full page load there is no access token in memory, only the refresh
 * cookie. Exchange it for a token; a failure just means "not signed in".
 */
export const restoreSession = createAsyncThunk('auth/restore', async (_, { rejectWithValue }) => {
  try {
    const token = await bootstrapSession();
    if (!token) return rejectWithValue(null);
    const user = await authApi.me();
    return user;
  } catch {
    return rejectWithValue(null);
  }
});

export const login = createAsyncThunk('auth/login', async (payload, { rejectWithValue }) => {
  try {
    const { user, accessToken } = await authApi.login(payload);
    setAccessToken(accessToken);
    return user;
  } catch (err) {
    return rejectWithValue(errorMessage(err));
  }
});

export const register = createAsyncThunk('auth/register', async (payload, { rejectWithValue }) => {
  try {
    const { user, accessToken } = await authApi.register(payload);
    setAccessToken(accessToken);
    return user;
  } catch (err) {
    return rejectWithValue(errorMessage(err));
  }
});

export const logout = createAsyncThunk('auth/logout', async () => {
  try {
    await authApi.logout();
  } finally {
    setAccessToken(null);
  }
});

/** Deletes the signed-in account and ends the session. */
export const deleteMyAccount = createAsyncThunk(
  'auth/deleteMyAccount',
  async (payload, { rejectWithValue }) => {
    try {
      const res = await authApi.deleteAccount(payload);
      setAccessToken(null);
      return res.message || 'Account deleted';
    } catch (err) {
      return rejectWithValue(errorMessage(err));
    }
  }
);

export const updateProfile = createAsyncThunk(
  'auth/updateProfile',
  async (payload, { rejectWithValue }) => {
    try {
      return await authApi.updateProfile(payload);
    } catch (err) {
      return rejectWithValue(errorMessage(err));
    }
  }
);

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    sessionExpired(state) {
      state.user = null;
      state.status = 'unauthenticated';
      state.error = 'Your session expired. Please sign in again.';
    },
    clearAuthError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(restoreSession.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(restoreSession.fulfilled, (state, action) => {
        state.user = action.payload;
        state.status = 'authenticated';
        state.bootstrapped = true;
      })
      .addCase(restoreSession.rejected, (state) => {
        state.user = null;
        state.status = 'unauthenticated';
        state.bootstrapped = true;
      })
      .addCase(updateProfile.fulfilled, (state, action) => {
        state.user = action.payload;
      })
      .addCase(logout.fulfilled, (state) => {
        state.user = null;
        state.status = 'unauthenticated';
        state.error = null;
      })
      .addCase(deleteMyAccount.fulfilled, (state) => {
        // Same end state as signing out — ProtectedRoute sends them to /login.
        state.user = null;
        state.status = 'unauthenticated';
        state.error = null;
      });

    // login and register share their success/failure handling.
    [login, register].forEach((thunk) => {
      builder
        .addCase(thunk.pending, (state) => {
          state.status = 'loading';
          state.error = null;
        })
        .addCase(thunk.fulfilled, (state, action) => {
          state.user = action.payload;
          state.status = 'authenticated';
          state.bootstrapped = true;
          state.error = null;
        })
        .addCase(thunk.rejected, (state, action) => {
          state.status = 'unauthenticated';
          state.error = action.payload || 'Authentication failed';
        });
    });
  },
});

export const { sessionExpired, clearAuthError } = authSlice.actions;

export const selectUser = (state) => state.auth.user;
export const selectIsAuthenticated = (state) => Boolean(state.auth.user);
export const selectAuthStatus = (state) => state.auth.status;
export const selectAuthError = (state) => state.auth.error;
export const selectBootstrapped = (state) => state.auth.bootstrapped;

export default authSlice.reducer;
