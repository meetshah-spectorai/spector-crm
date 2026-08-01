'use strict';

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

/**
 * A teammate. Everyone on the account is a peer: there are no roles and no
 * per-user permissions — the whole pipeline is shared.
 */
const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: 80,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please provide a valid email address'],
    },
    password: {
      type: String,
      // Not required for accounts created by signing in with Google — those have
      // no password until the owner sets one from Settings.
      required: [
        function passwordRequired() {
          return !this.googleId;
        },
        'Password is required',
      ],
      minlength: 8,
      select: false, // never returned unless explicitly requested
    },
    /**
     * Google's stable subject id (`sub`) for this person, set when they first
     * sign in with Google. Sparse: password-only accounts simply have no value.
     * Selected by default so `toJSON` and the password-required check below can
     * both see it; `toJSON` swaps it for a plain `googleLinked` flag.
     */
    googleId: {
      type: String,
      unique: true,
      sparse: true,
    },
    /**
     * Whether a password is set at all — `password` is `select: false`, so this
     * is what the client reads to decide between "change" and "set" a password.
     * Written only by the pre-save hook and the Google sign-in path.
     */
    hasPassword: { type: Boolean, default: true },
    notificationPrefs: {
      emailReminders: { type: Boolean, default: true },
      dailyDigest: { type: Boolean, default: true },
    },
    /**
     * Bumped on password change. Access tokens carry this value, so changing a
     * password immediately retires every token issued before it.
     */
    tokenVersion: {
      type: Number,
      default: 0,
    },
    lastLoginAt: Date,
  },
  { timestamps: true }
);

userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) return next();
  if (!this.password) {
    this.hasPassword = false;
    return next();
  }
  this.password = await bcrypt.hash(this.password, 12);
  this.hasPassword = true;
  return next();
});

/** False rather than a thrown error when the account has no password at all. */
userSchema.methods.comparePassword = function comparePassword(candidate) {
  if (!this.password) return Promise.resolve(false);
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.toJSON = function toJSON() {
  const obj = this.toObject({ virtuals: true });
  delete obj.password;
  delete obj.tokenVersion;
  delete obj.__v;
  // The Google subject id is an account-linking detail, not something the client
  // needs; `googleLinked` is the flag the UI actually reads.
  obj.googleLinked = Boolean(this.googleId);
  delete obj.googleId;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
