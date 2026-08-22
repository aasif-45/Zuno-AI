import mongoose from "mongoose";
import { Schema, model } from "mongoose";

const conversationSchema = new Schema({
    title:{
        type:String,
        default:"New Chat"
    },
    userId:{
        type:String,
    },
},{
    timestamps:true
})

const Conversation = model("Conversation", conversationSchema);
export default Conversation;