import { createAsyncThunk, createSelector, createSlice } from '@reduxjs/toolkit';
import { emailsApi, mailAccountsApi } from '@/api/endpoints';
import { errorMessage } from '@/api/client';

const PAGE_SIZE = 10;

const initialState = {
  /** Conversation summaries for the deal currently open. */
  threads: [],
  dealId: null,
  contacts: [],
  mailboxes: null,
  reason: null, // e.g. 'no-contact-email'

  page: 1,
  pages: 1,
  total: 0,
  status: 'idle',
  error: null,
  loadingMore: false,

  filters: { search: '', filter: 'all' },

  /** Expanded conversations: threadKey → { status, messages } */
  openThreads: {},

  accounts: [],
  accountsMeta: null,
  accountsStatus: 'idle',
  accountsSaving: false,
};

export const fetchDealEmails = createAsyncThunk(
  'emails/fetchDealEmails',
  async ({ dealId, page = 1, search = '', filter = 'all' }, { rejectWithValue }) => {
    try {
      const res = await emailsApi.forDeal(dealId, { page, limit: PAGE_SIZE, search, filter });
      return { dealId, page, threads: res.data.threads, meta: res.meta, append: page > 1 };
    } catch (err) {
      return rejectWithValue(errorMessage(err));
    }
  }
);

/** Lazily pulls a conversation's messages the first time it is expanded. */
export const fetchThread = createAsyncThunk(
  'emails/fetchThread',
  async ({ threadKey, dealId, filter = 'all', search = '' }, { rejectWithValue }) => {
    try {
      const res = await emailsApi.thread(threadKey, { deal: dealId, filter, search });
      return { threadKey, messages: res.data, meta: res.meta };
    } catch (err) {
      return rejectWithValue({ threadKey, message: errorMessage(err) });
    }
  }
);

export const fetchMailAccounts = createAsyncThunk(
  'emails/fetchAccounts',
  async (_, { rejectWithValue }) => {
    try {
      return await mailAccountsApi.list();
    } catch (err) {
      return rejectWithValue(errorMessage(err));
    }
  }
);

export const connectMailAccount = createAsyncThunk(
  'emails/connectAccount',
  async (payload, { rejectWithValue }) => {
    try {
      return await mailAccountsApi.create(payload);
    } catch (err) {
      return rejectWithValue(errorMessage(err));
    }
  }
);

export const syncMailAccount = createAsyncThunk(
  'emails/syncAccount',
  async (id, { rejectWithValue }) => {
    try {
      return await mailAccountsApi.sync(id);
    } catch (err) {
      return rejectWithValue(errorMessage(err));
    }
  }
);

export const setMailAccountActive = createAsyncThunk(
  'emails/setAccountActive',
  async ({ id, isActive }, { rejectWithValue }) => {
    try {
      return await mailAccountsApi.update(id, { isActive });
    } catch (err) {
      return rejectWithValue(errorMessage(err));
    }
  }
);

export const disconnectMailAccount = createAsyncThunk(
  'emails/disconnectAccount',
  async (id, { rejectWithValue }) => {
    try {
      await mailAccountsApi.remove(id);
      return id;
    } catch (err) {
      return rejectWithValue(errorMessage(err));
    }
  }
);

const emailsSlice = createSlice({
  name: 'emails',
  initialState,
  reducers: {
    setEmailFilters(state, action) {
      state.filters = { ...state.filters, ...action.payload };
      // Expanded threads were fetched under the previous filter; drop them so a
      // reopened conversation reflects the filter now in effect.
      state.openThreads = {};
    },
    toggleThread(state, action) {
      const key = action.payload;
      if (state.openThreads[key]) delete state.openThreads[key];
      else state.openThreads[key] = { status: 'idle', messages: [] };
    },
    resetEmails(state) {
      state.threads = [];
      state.openThreads = {};
      state.page = 1;
      state.pages = 1;
      state.total = 0;
      state.status = 'idle';
      state.error = null;
      state.filters = { search: '', filter: 'all' };
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchDealEmails.pending, (state, action) => {
        if (action.meta.arg.page > 1) state.loadingMore = true;
        else state.status = state.threads.length ? 'succeeded' : 'loading';
        state.error = null;
      })
      .addCase(fetchDealEmails.fulfilled, (state, action) => {
        const { dealId, page, threads, meta, append } = action.payload;
        state.dealId = dealId;
        // Key is (thread, contact), so the same conversation can legitimately
        // appear under two contacts on the same deal.
        state.threads = append ? [...state.threads, ...threads] : threads;
        state.page = meta.page;
        state.pages = meta.pages;
        state.total = meta.total;
        state.contacts = meta.contacts || [];
        state.mailboxes = meta.mailboxes || null;
        state.reason = meta.reason || null;
        state.status = 'succeeded';
        state.loadingMore = false;
      })
      .addCase(fetchDealEmails.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
        state.loadingMore = false;
      })

      .addCase(fetchThread.pending, (state, action) => {
        const key = action.meta.arg.threadKey;
        state.openThreads[key] = { status: 'loading', messages: [] };
      })
      .addCase(fetchThread.fulfilled, (state, action) => {
        state.openThreads[action.payload.threadKey] = {
          status: 'succeeded',
          messages: action.payload.messages,
          meta: action.payload.meta,
        };
      })
      .addCase(fetchThread.rejected, (state, action) => {
        const key = action.payload?.threadKey || action.meta.arg.threadKey;
        state.openThreads[key] = {
          status: 'failed',
          messages: [],
          error: action.payload?.message,
        };
      })

      .addCase(fetchMailAccounts.pending, (state) => {
        state.accountsStatus = state.accounts.length ? 'succeeded' : 'loading';
      })
      .addCase(fetchMailAccounts.fulfilled, (state, action) => {
        state.accounts = action.payload.data;
        state.accountsMeta = action.payload.meta;
        state.accountsStatus = 'succeeded';
      })
      .addCase(fetchMailAccounts.rejected, (state) => {
        state.accountsStatus = 'failed';
      })

      .addCase(connectMailAccount.fulfilled, (state, action) => {
        state.accounts.push(action.payload.data);
      })
      .addCase(syncMailAccount.fulfilled, (state, action) => {
        const i = state.accounts.findIndex((a) => a._id === action.payload.data._id);
        if (i !== -1) state.accounts[i] = action.payload.data;
      })
      .addCase(setMailAccountActive.fulfilled, (state, action) => {
        const i = state.accounts.findIndex((a) => a._id === action.payload._id);
        if (i !== -1) state.accounts[i] = action.payload;
      })
      .addCase(disconnectMailAccount.fulfilled, (state, action) => {
        state.accounts = state.accounts.filter((a) => a._id !== action.payload);
      })

      .addMatcher(
        (action) =>
          action.type.startsWith('emails/') &&
          ['connectAccount', 'syncAccount', 'setAccountActive', 'disconnectAccount'].some((op) =>
            action.type.includes(`emails/${op}/`)
          ),
        (state, action) => {
          state.accountsSaving = action.type.endsWith('/pending');
        }
      );
  },
});

export const { setEmailFilters, toggleThread, resetEmails } = emailsSlice.actions;

export const selectEmailThreads = (state) => state.emails.threads;
export const selectEmailsStatus = (state) => state.emails.status;
export const selectEmailsError = (state) => state.emails.error;
export const selectEmailFilters = (state) => state.emails.filters;
export const selectEmailPaging = (state) => ({
  page: state.emails.page,
  pages: state.emails.pages,
  total: state.emails.total,
  loadingMore: state.emails.loadingMore,
});
export const selectDealContacts = (state) => state.emails.contacts;
export const selectMailboxSummary = (state) => state.emails.mailboxes;
export const selectEmailsReason = (state) => state.emails.reason;
export const selectOpenThreads = (state) => state.emails.openThreads;

export const selectMailAccounts = (state) => state.emails.accounts;
export const selectMailAccountsMeta = (state) => state.emails.accountsMeta;
export const selectMailAccountsStatus = (state) => state.emails.accountsStatus;
export const selectMailAccountsSaving = (state) => state.emails.accountsSaving;

/**
 * Groups the flat thread list by contact, preserving the server's newest-first
 * ordering both between and within groups.
 */
export const selectThreadsByContact = createSelector([selectEmailThreads], (threads) => {
  const groups = [];
  const index = new Map();

  for (const thread of threads) {
    const key = thread.contactEmail;
    if (!index.has(key)) {
      const group = {
        contactEmail: key,
        contactName: thread.contactName || key,
        threads: [],
      };
      index.set(key, group);
      groups.push(group);
    }
    index.get(key).threads.push(thread);
  }

  return groups;
});

export default emailsSlice.reducer;
