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
      required: [true, 'Password is required'],
      minlength: 8,
      select: false, // never returned unless explicitly requested
    },
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
  this.password = await bcrypt.hash(this.password, 12);
  return next();
});

userSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.toJSON = function toJSON() {
  const obj = this.toObject({ virtuals: true });
  delete obj.password;
  delete obj.tokenVersion;
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
