import { createSlice } from "@reduxjs/toolkit";

const messageSlice = createSlice({
  name: "message",
  initialState: {
    messages: [],
    artifacts: [],
    activeArtifact: null, // { open: boolean, artifact: object|null, selectedFile: string|null }
    loading: false,
    isFetchingMessages: false,
  },
  reducers: {
    setIsFetchingMessages: (state, action) => {
      state.isFetchingMessages = action.payload;
    },

    setMessage: (state, action) => {
      state.messages = Array.isArray(action.payload) ? action.payload : [];
      state.isFetchingMessages = false;
      
      // Auto-extract all artifacts from conversation messages into state.artifacts
      const extracted = [];
      state.messages.forEach((msg) => {
        if (Array.isArray(msg?.artifacts) && msg.artifacts.length > 0) {
          extracted.push(...msg.artifacts);
        }
      });
      state.artifacts = extracted;
    },

    addMessage: (state, action) => {
      if (!action.payload) return;
      state.messages.push(action.payload);

      // Store any new artifacts in Redux
      if (Array.isArray(action.payload.artifacts) && action.payload.artifacts.length > 0) {
        state.artifacts.push(...action.payload.artifacts);
        // Automatically open the newly generated artifact in Redux state
        const firstArt = action.payload.artifacts[0];
        state.activeArtifact = {
          open: true,
          artifact: firstArt,
          selectedFile: firstArt?.files?.[0]?.name || null,
        };
      }
    },

    setActiveArtifact: (state, action) => {
      // payload = { open: boolean, artifact: object, selectedFile: string }
      state.activeArtifact = action.payload;
    },

    openArtifact: (state, action) => {
      const art = action.payload;
      if (!art) return;
      state.activeArtifact = {
        open: true,
        artifact: art,
        selectedFile: art.files?.[0]?.name || null,
      };
    },

    setSelectedFile: (state, action) => {
      if (state.activeArtifact) {
        state.activeArtifact.selectedFile = action.payload;
      }
    },

    closeArtifact: (state) => {
      if (state.activeArtifact) {
        state.activeArtifact.open = false;
      }
    },

    setLoading: (state, action) => {
      state.loading = action.payload;
    },

    clearMessages: (state) => {
      state.messages = [];
      state.artifacts = [];
      state.activeArtifact = null;
      state.loading = false;
    },

    setArtifacts: (state, action) => {
      state.artifacts = Array.isArray(action.payload) ? action.payload : [];
    },
  },
});

export const {
  setMessage,
  setIsFetchingMessages,
  addMessage,
  setLoading,
  clearMessages,
  setArtifacts,
  setActiveArtifact,
  openArtifact,
  setSelectedFile,
  closeArtifact,
} = messageSlice.actions;

export default messageSlice.reducer;