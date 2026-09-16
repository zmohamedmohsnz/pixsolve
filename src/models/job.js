import mongoose from 'mongoose';
import { randomBytes, createHash } from 'node:crypto';

export const JOB_OPERATIONS = Object.freeze(['resize', 'compress', 'convert']);
export const JOB_STATUSES = Object.freeze(['pending', 'processing', 'completed', 'failed']);

const fileMetadataSchema = new mongoose.Schema(
  {
    publicId: {
      type: String,
      required: true,
      trim: true
    },

    secureUrl: {
      type: String,
      required: true,
      trim: true
    }
  },
  {
    _id: false
  }
);

const jobSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },

    guestAccessTokenHash: {
      type: String,
      trim: true,
      select: false,
      match: /^[a-f0-9]{64}$/,

      // we use `==` intentionally to cover `null` and `undefined`
      required() { return this.user == null; },
    },

    operation: {
      type: String,
      enum: JOB_OPERATIONS,
      required: true
    },

    status: {
      type: String,
      enum: JOB_STATUSES,
      default: 'pending',
      required: true
    },

    options: {
      type: mongoose.Schema.Types.Mixed,
      required: true
    },

    inputFile: {
      type: fileMetadataSchema,
      required: true
    },

    outputFile: {
      type: fileMetadataSchema,
      required() {
        return this.status === 'completed';
      }
    },

    errorMessage: {
      type: String,
      trim: true,
      required() {
        return this.status === 'failed';
      }
    }
  },
  {
    timestamps: true
  }
);

// ─── Instance Methods ───────────────────────────────────────────────────────────

jobSchema.methods.createGuestAccessToken = function() {
  // generate a buffer of 32 random bytes, then export it as a string.
  // we choose base64 over hex just because it gives shorter token.
  // `base64url` is `base64` avoids characters such as +, /, =.
  const rawToken = randomBytes(32).toString('base64url');

  // keep its hashed version in the database
  this.guestAccessTokenHash = createHash('sha256')
    .update(rawToken)
    .digest('hex');

  return rawToken;
};

// ─── Model ──────────────────────────────────────────────────────────────────────

const Job = mongoose.model('Job', jobSchema);
export default Job;