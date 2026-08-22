import { Schema, model } from "mongoose";

const artifactFileSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
  },
  { _id: false }
);

const artifactSchema = new Schema(
  {
    id: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ["project", "code", "html", "react", "text"],
      default: "project",
    },
    title: {
      type: String,
      required: true,
    },
    files: {
      type: [artifactFileSchema],
      default: [],
    },
  },
  { _id: false }
);

const messageSchema = new Schema(
  {
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
    },
    role: {
      type: String,
      enum: ["user", "assistant"],
      required: true,
    },
    content: {
      type: String,
      default: "",
    },
    images: {
      type: [String],
      default: [],
    },
    artifacts: {
      type: [artifactSchema],
      default: [],
    },
    fileName: {
      type: String,
    },
    fileType: {
      type: String,
    },
    fileUrl: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

const Message = model("Message", messageSchema);

export default Message;