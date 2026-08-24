import React, { useEffect, useState } from "react";
import MessageList from "./MessageList.jsx";
import Nav from "./Nav.jsx";
import ChatInput from "./ChatInput.jsx";
import Artifact from "./Artifact.jsx";
import { useDispatch, useSelector } from "react-redux";
import getMessage from "../features/getMessage.js";
import { setMessage, clearMessages, setIsFetchingMessages } from "../redux/messageSlice.js";

export default function ChatArea() {
  const dispatch = useDispatch();
  const { selectedConversation } = useSelector((state) => state.conversation);
  const { messages, activeArtifact: reduxActiveArtifact } = useSelector((state) => state.message);
  const { userData } = useSelector((state) => state.user);

  const [activeArtifact, setActiveArtifact] = useState({
    open: false,
    artifact: null,
    selectedFile: null,
  });

  // Sync Redux activeArtifact changes (e.g. from new message responses or card clicks) to local state
  useEffect(() => {
    if (reduxActiveArtifact && reduxActiveArtifact.open) {
      setActiveArtifact(reduxActiveArtifact);
    }
  }, [reduxActiveArtifact]);

  useEffect(() => {
    const convId = selectedConversation?._id;

    if (!convId || !userData) {
      if (!convId) {
        dispatch(clearMessages());
        setActiveArtifact({ open: false, artifact: null, selectedFile: null });
      }
      return;
    }

    // Check if Redux already contains messages for this conversation (e.g. optimistic user prompt)
    const hasMessagesForCurrentConv =
      Array.isArray(messages) &&
      messages.length > 0 &&
      messages.some((m) => m.conversationId === convId || !m.conversationId);

    if (!hasMessagesForCurrentConv) {
      let isCurrent = true;
      const getMess = async () => {
        dispatch(setIsFetchingMessages(true));
        try {
          const data = await getMessage(convId);
          if (isCurrent) {
            dispatch(setMessage(Array.isArray(data) ? data : []));
          }
        } catch (err) {
          if (isCurrent) {
            dispatch(setMessage([]));
          }
        }
      };
      getMess();

      return () => {
        isCurrent = false;
      };
    }
  }, [selectedConversation?._id, userData, dispatch]);

  const handleOpenArtifact = (artifact) => {
    if (!artifact) return;
    setActiveArtifact({
      open: true,
      artifact: artifact,
      selectedFile: artifact.files?.[0]?.name || null,
    });
  };

  const handleCloseArtifact = () => {
    setActiveArtifact({
      open: false,
      artifact: null,
      selectedFile: null,
    });
  };

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-[#171717] text-white transition-all duration-300 ease-in-out relative">
      <Nav />
      <MessageList onOpenArtifact={handleOpenArtifact} />
      <ChatInput />

      {/* Slide-Over Artifact Code Viewer Panel */}
      <Artifact
        open={activeArtifact.open}
        artifact={activeArtifact.artifact}
        selectedFile={activeArtifact.selectedFile}
        setSelectedFile={(file) =>
          setActiveArtifact((prev) => ({ ...prev, selectedFile: file }))
        }
        onClose={handleCloseArtifact}
      />
    </div>
  );
}
