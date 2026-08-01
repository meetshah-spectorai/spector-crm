import { configureStore } from '@reduxjs/toolkit';
import authReducer, { sessionExpired } from '@/features/auth/authSlice';
import dealsReducer from '@/features/deals/dealsSlice';
import stagesReducer from '@/features/stages/stagesSlice';
import remindersReducer from '@/features/reminders/remindersSlice';
import notesReducer from '@/features/notes/notesSlice';
import usersReducer from '@/features/users/usersSlice';
import { setSessionExpiredHandler } from '@/api/client';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    deals: dealsReducer,
    stages: stagesReducer,
    reminders: remindersReducer,
    notes: notesReducer,
    users: usersReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      // Dates arrive as ISO strings, so state stays serialisable; this only
      // silences warnings for the Error objects RTK attaches to rejections.
      serializableCheck: { ignoredActionPaths: ['meta.arg', 'payload.error'] },
    }),
});

// Let the axios layer push the app back to the login screen when the refresh
// token is gone, without importing the store into the API module.
setSessionExpiredHandler(() => store.dispatch(sessionExpired()));

export default store;
