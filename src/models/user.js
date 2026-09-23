// ─── Import Modules ─────────────────────────────────────────────────────────────

import mongoose from 'mongoose';
import argon2 from 'argon2';
import crypto from "node:crypto";
import config from '../config/env.js'

// ─── Helpers ────────────────────────────────────────────────────────────────────

const ARGON2_OPTIONS = Object.freeze({
  type: argon2.argon2id, // strongest type for password hashing.
  memoryCost: 65536, // RAM each hashing process needs. (65MB)
  timeCost: 3, // computation cycles each hashing process needs.
  parallelism: 4, // Argon2 divides its work across 4 lanes (multiple CPU cores).
  hashLength: 32  // the generated hash length in bytes.
});

const removeSecurityFields = (_document, returnedValue) => {
  delete returnedValue.password;
  delete returnedValue.emailVerificationToken;
  delete returnedValue.emailVerificationTokenExpiresAt;

  return returnedValue;
};

// ─── Schema ─────────────────────────────────────────────────────────────────────

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      set: v => v.trim().replace(/\s+/g, ' '),
      minLength: [2, 'Name must be greater than 1 character'],
      maxLength: [100, 'Name must be less than 101 characters'],
      required: [true, 'Name is required'],
    },

    email: {
      type: String,
      trim: true,
      lowercase: true,
      required: [true, 'Email is required']
    },

    emailVerifiedAt: {
      type: Date,
      default: null
    },

    emailVerificationToken: {
      type: String,
      select: false
    },

    emailVerificationTokenExpiresAt: {
      type: Date,
      select: false 
    },

    password: {
      type: String,
      trim: true,
      required: [true, 'Password is required'],
      select: false
    },

    lastLoginAt: {
      type: Date,
      default: null
    },

    isActive: {
      type: Boolean,
      default: true
    },
  },
  {
    // creates createdAt & updatedAt
    timestamps: true,

    // `select: false` excludes fields from the query results by default.
    // however, we may explicitly select them to do internal operations.
    // in this case, if the document is later returned to the client,
    // those fields would be exposed. these transforms ensure sensitive
    // fields are removed during this case.
    toJSON: { transform: removeSecurityFields },  // runs when Mongoose document → JSON
    toObject: { transform: removeSecurityFields } // runs when Mongoose document → plain JS object.
  }
);

// ─── Indexes ────────────────────────────────────────────────────────────────────

userSchema.index({ email: 1 }, { unique: true });

// ─── Middleware ─────────────────────────────────────────────────────────────────

// for async function, you don't need to invoke `next()` as Mongoose automatically
// moves to the next middleware when the promise is resolved or rejected.
userSchema.pre('save', async function() {
  // skip if password isn't modified
  if (!this.isModified('password')) return;

  // hash the password before storing it
  this.password = await argon2.hash(this.password, ARGON2_OPTIONS);
});

// ─── Instance Methods ───────────────────────────────────────────────────────────

userSchema.methods.comparePassword = async function (candidatePassword) {
  return argon2.verify(this.password, candidatePassword);
};

userSchema.methods.createEmailVerificationToken = function() {
  // 1) generate a token
  const rawToken = crypto.randomBytes(32).toString('base64url');

  // 2) store the hashed token version
  this.emailVerificationToken = crypto
    .createHash('sha256')
    .update(rawToken)
    .digest('hex');
  
  // 3) set expiration date for the token
  this.emailVerificationTokenExpiresAt = Date.now() +
    config.emailVerificationTokenLifeTimeMins * 60 * 1000;

  // 4) return the raw token version
  return rawToken;
};

// ─── Model ──────────────────────────────────────────────────────────────────────

const User = mongoose.model('User', userSchema);
export default User;