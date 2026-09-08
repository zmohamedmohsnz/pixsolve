import mongoose from 'mongoose';

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

const Job = mongoose.model('Job', jobSchema);

export default Job;