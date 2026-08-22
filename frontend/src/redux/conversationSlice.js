import { createSlice } from "@reduxjs/toolkit";

const conversationSlice = createSlice({
  name: "conversation",
  initialState: {
    conversations: [],
    selectedConversation:null
  },
  reducers: {
    setConversation: (state, action) => {
      state.conversations = action.payload;
    },

    addConversation: (state, action) => {
      state.conversations.unshift(action.payload);
    },

    removeConversation: (state, action) => {
      state.conversations = state.conversations.filter(
        (conversation) => conversation._id !== action.payload,
      );
    },

    updateConversation: (state, action) => {
      const index = state.conversations.findIndex(
        (conversation) => conversation._id === action.payload._id,
      );

      if (index !== -1) {
        state.conversations[index] = action.payload;
      }
    },

    setSelectedConversation: (state, action) => {
      state.selectedConversation=action.payload;
    }
  },
});

export const {
  setConversation,
  addConversation,
  removeConversation,
  updateConversation,
  setSelectedConversation
} = conversationSlice.actions;

export default conversationSlice.reducer;
