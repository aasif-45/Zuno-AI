import { model, Schema } from "mongoose";

const UserSchema = new Schema(
  {
    firebaseUID: {
      type: String,
      unique: true,
    },
    name: String,
    email: String,
    avatar: String,
    // Billing
    plan: {
      type: String,
      enum: ["free", "starter", "pro"],
      default: "free",
    },
    credits: {
      type: Number,
      default: 100,
    },
    totalCredits: {
      type: Number,
      default: 100,
    },
    planStartedAt: {
      type: Date,
      default: Date.now,
    },
    planExpiresAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

const User = model("User", UserSchema);

export default User;