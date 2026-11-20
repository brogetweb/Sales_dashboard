
import mongoose from "mongoose";

const feedbackSchema = new mongoose.Schema(
  {
    remark: {
      type: String,
      required: true,
      trim: true,
    },

    otherRemark: {
      type: String,
      default: "",
      trim: true,
    },

    feedbackDate: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

const customerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
      default: "",
    },

    mobile: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    propertyName: {
      type: String,
      default: "",
      trim: true,
    },

    feedbackHistory: {
      type: [feedbackSchema],
      default: [],
    },

    status: {
      type: String,
      enum: [
        "Follow-up",
        "Interested",
        "Not Interested",
        "Converted",
      ],
      default: "Follow-up",
    },

    followUpAt: {
      type: Date,
      default: null,
    },

    followUpDone: {
      type: Boolean,
      default: false,
    },

    reminderSentAt: {
      type: Date,
      default: null,
    },

    reminderLastAttemptAt: {
      type: Date,
      default: null,
    },

    reminderError: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("Customer", customerSchema);
