'use strict';

/**
 * Mailbox provider presets.
 *
 * Gmail, Outlook and generic servers are all reached over IMAP, so one sync
 * engine serves all three — only the host and the name of the Sent folder
 * differ. The shape below is what `imapSync` consumes, so adding a provider that
 * speaks a different protocol (the Gmail API or Microsoft Graph, both of which
 * need a registered OAuth app) means adding a module with the same interface
 * rather than changing the engine.
 */
const PROVIDERS = {
  gmail: {
    key: 'gmail',
    label: 'Gmail / Google Workspace',
    host: 'imap.gmail.com',
    port: 993,
    secure: true,
    /** Checked in order; the engine prefers the \Sent special-use flag anyway. */
    sentFolders: ['[Gmail]/Sent Mail', 'Sent Mail', 'Sent'],
    /**
     * Gmail rejects the account password over IMAP. With 2-Step Verification on,
     * an App Password works — the same one the SMTP settings use.
     */
    credentialHint:
      'Use a Google App Password (Account → Security → 2-Step Verification → App passwords), not your Google password.',
    setupUrl: 'https://myaccount.google.com/apppasswords',
  },

  outlook: {
    key: 'outlook',
    label: 'Outlook / Microsoft 365',
    host: 'outlook.office365.com',
    port: 993,
    secure: true,
    sentFolders: ['Sent Items', 'Sent'],
    credentialHint:
      'Many Microsoft 365 tenants now block IMAP password sign-in. If it fails, ask your admin to enable IMAP for the mailbox, or connect it as a generic IMAP account with an app password.',
    setupUrl: 'https://support.microsoft.com/office/pop-imap-and-smtp-settings-8361e398-8af4-4e97-b147-6c6c4ac95353',
  },

  imap: {
    key: 'imap',
    label: 'Other (IMAP)',
    host: '', // supplied by the user
    port: 993,
    secure: true,
    sentFolders: ['Sent', 'INBOX.Sent', 'Sent Items', 'Sent Messages'],
    credentialHint: 'Your mail provider will list its IMAP host and port.',
    setupUrl: null,
  },
};

const PROVIDER_KEYS = Object.keys(PROVIDERS);

/** Resolves the connection settings for an account, letting stored values win. */
function resolveConnection(account) {
  const preset = PROVIDERS[account.provider] || PROVIDERS.imap;
  return {
    host: account.host || preset.host,
    port: account.port || preset.port,
    secure: account.secure ?? preset.secure,
    sentFolders: preset.sentFolders,
  };
}

/** Public, credential-free description for the connect dialog. */
const publicProviders = () =>
  PROVIDER_KEYS.map((k) => {
    const p = PROVIDERS[k];
    return {
      key: p.key,
      label: p.label,
      host: p.host,
      port: p.port,
      secure: p.secure,
      credentialHint: p.credentialHint,
      setupUrl: p.setupUrl,
      needsHost: p.key === 'imap',
    };
  });

module.exports = { PROVIDERS, PROVIDER_KEYS, resolveConnection, publicProviders };
