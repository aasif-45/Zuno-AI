import { createSlice } from "@reduxjs/toolkit";

const conversationSlice = createSlice({
  name: "conversation",
  initialState: {
    conversations: [],
    selectedConversation: null,
    isMobileSidebarOpen: false,
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
      state.selectedConversation = action.payload;
    },

    setMobileSidebarOpen: (state, action) => {
      state.isMobileSidebarOpen = action.payload;
    },

    toggleMobileSidebar: (state) => {
      state.isMobileSidebarOpen = !state.isMobileSidebarOpen;
    },
  },
});

export const {
  setConversation,
  addConversation,
  removeConversation,
  updateConversation,
  setSelectedConversation,
  setMobileSidebarOpen,
  toggleMobileSidebar,
} = conversationSlice.actions;

export default conversationSlice.reducer;
