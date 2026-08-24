import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useSelector, useDispatch } from "react-redux";
import { closeArtifact, setSelectedFile } from "../redux/messageSlice.js";
import {
  X,
  FileCode2,
  FileText,
  Download,
  Copy,
  Check,
  Play,
  Code2,
  Maximize2,
  Minimize2,
  Archive,
  RefreshCw,
} from "lucide-react";
import Editor from "@monaco-editor/react";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { getLanguage, getFileBadgeStyle, generateSrcDoc } from "../utils/fileHelpers.js";

export default function Artifact(props) {
  const dispatch = useDispatch();
  const reduxActiveArtifact = useSelector((state) => state.message?.activeArtifact);

  const [viewMode, setViewMode] = useState("preview"); // 'code' | 'preview'
  const [isExpanded, setIsExpanded] = useState(false);
  const [previewKey, setPreviewKey] = useState(Date.now());

  // Support both Redux store state and explicit component props
  const isOpen = props.open !== undefined ? props.open : Boolean(reduxActiveArtifact?.open);
  const artifact = props.artifact || reduxActiveArtifact?.artifact;
  const activeSelectedFile = props.selectedFile || reduxActiveArtifact?.selectedFile;

  const rawFiles = Array.isArray(artifact?.files) ? artifact.files : [];
  const [localFiles, setLocalFiles] = useState([]);

  React.useEffect(() => {
    if (rawFiles.length > 0) {
      setLocalFiles(rawFiles);
      const isPreviewable = rawFiles.some((f) => /\.(html|htm|css|js|jsx|svg)$/i.test(f.name));
      if (isPreviewable) {
        setViewMode("preview");
        setPreviewKey(Date.now());
      }
    }
  }, [artifact]);

  const files = localFiles.length > 0 ? localFiles : rawFiles;
  const activeFileName = activeSelectedFile || files[0]?.name;
  const currentFile = files.find((f) => f.name === activeFileName) || files[0];

  const handleCodeChange = (newContent) => {
    if (!currentFile) return;
    const updatedContent = newContent ?? "";
    setLocalFiles((prev) =>
      prev.map((f) => (f.name === currentFile.name ? { ...f, content: updatedContent } : f))
    );
  };

  // Check if project has runnable preview files (HTML / CSS / JS)
  const hasPreviewableFiles = useMemo(() => {
    return files.some((f) => /\.(html|htm|css|js|jsx|svg)$/i.test(f.name));
  }, [files]);

  const handleClose = () => {
    if (props.onClose) props.onClose();
    dispatch(closeArtifact());
  };

  const handleSelectFile = (fileName) => {
    if (props.setSelectedFile) props.setSelectedFile(fileName);
    dispatch(setSelectedFile(fileName));
  };

  const handleCopyCode = () => {
    if (!currentFile?.content) return;
    navigator.clipboard.writeText(currentFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadSingleFile = () => {
    if (!currentFile) return;
    const blob = new Blob([currentFile.content || ""], { type: "text/plain;charset=utf-8" });
    saveAs(blob, currentFile.name || "file.txt");
  };

  const handleDownloadZip = async () => {
    if (!files.length) return;
    const zip = new JSZip();
    files.forEach((f) => {
      zip.file(f.name, f.content || "");
    });
    const zipBlob = await zip.generateAsync({ type: "blob" });
    const zipName = `${(artifact?.title || "project").toLowerCase().replace(/[^a-z0-9]/g, "_")}.zip`;
    saveAs(zipBlob, zipName);
  };

  // Generate live execution iframe document combining HTML, CSS, and JS
  const srcDoc = useMemo(() => {
    return generateSrcDoc(files, previewKey);
  }, [files, previewKey]);

  return (
    <AnimatePresence>
      {isOpen && artifact && (
        <>
          {/* Animated Dimmed Backdrop */}
          <motion.div
            key="artifact-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            onClick={handleClose}
            className="fixed inset-0 z-40 bg-black/70 backdrop-blur-xs"
          />

          {/* Animated Slide-Over Side Panel */}
          <motion.div
            key="artifact-panel"
            initial={{ x: "100%", opacity: 0.85 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0.85 }}
            transition={{ type: "spring", damping: 34, stiffness: 320, mass: 0.8 }}
            className={`fixed inset-y-0 right-0 z-50 flex flex-col border-l border-white/10 bg-[#16171d] shadow-2xl transition-[width] duration-300 ease-out ${isExpanded ? "w-full sm:w-[92vw] lg:w-[85vw]" : "w-full sm:max-w-[680px]"
              }`}
          >
            {/* Top Header */}
            <div className="flex items-center justify-between border-b border-white/10 px-3 sm:px-5 py-2.5 sm:py-3 bg-[#1e2029]">
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                  <FileCode2 size={20} />
                </div>
                <div className="truncate">
                  <h2 className="truncate font-semibold text-sm text-white tracking-tight">
                    {artifact.title || "Generated Project"}
                  </h2>
                  <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                    <span>{files.length} {files.length === 1 ? "file" : "files"}</span>
                    <span>•</span>
                    <span className="text-emerald-400 uppercase font-mono font-medium text-[11px]">
                      {artifact.type || "Code"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Header Action Buttons */}
              <div className="flex items-center gap-1.5">
                {/* Code / Live Preview Mode Switcher */}
                {hasPreviewableFiles && (
                  <div className="flex items-center p-0.5 rounded-xl bg-black/40 border border-white/10 mr-2">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => setViewMode("code")}
                      className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-lg transition-all cursor-pointer ${viewMode === "code"
                          ? "bg-emerald-500 text-black shadow-md font-semibold"
                          : "text-slate-400 hover:text-white"
                        }`}
                    >
                      <Code2 size={13} />
                      <span>Code</span>
                    </motion.button>

                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => {
                        setViewMode("preview");
                        setPreviewKey(Date.now());
                      }}
                      className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-lg transition-all cursor-pointer ${viewMode === "preview"
                          ? "bg-emerald-500 text-black shadow-md font-semibold"
                          : "text-slate-400 hover:text-white"
                        }`}
                    >
                      <Play size={13} />
                      <span>Live Preview</span>
                    </motion.button>
                  </div>
                )}

                {/* Expand / Minimize Width Toggle */}
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
                  title={isExpanded ? "Collapse width" : "Expand width"}
                >
                  {isExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                </motion.button>

                {/* Close Button */}
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleClose}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
                  title="Close panel"
                >
                  <X size={18} />
                </motion.button>
              </div>
            </div>

            {/* Main Body */}
            <div className="flex flex-1 flex-col overflow-hidden bg-[#111217]">
              {viewMode === "code" ? (
                <>
                  {/* Top Horizontal File Tabs Bar */}
                  <div className="flex items-center justify-between border-b border-white/10 bg-[#16171d] px-2 pt-1.5 select-none overflow-hidden shrink-0">
                    {/* Horizontal File Tabs */}
                    <div
                      className="flex items-center gap-1 overflow-x-auto overflow-y-hidden no-scrollbar py-0.5"
                      style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
                    >
                      {files.map((file) => {
                        const isActive = activeFileName === file.name;
                        return (
                          <button
                            key={file.name}
                            onClick={() => handleSelectFile(file.name)}
                            className={`relative flex items-center gap-2 px-4 py-2 text-xs font-mono transition-colors duration-150 cursor-pointer rounded-t-md ${
                              isActive
                                ? "bg-[#1e1e1e] text-indigo-400 font-semibold shadow-xs"
                                : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]"
                            }`}
                          >
                            <span>{file.name}</span>
                            {isActive && (
                              <motion.div
                                layoutId="activeTabUnderline"
                                transition={{ type: "spring", stiffness: 450, damping: 32 }}
                                className="absolute bottom-0 left-0 right-0 h-[2px] bg-indigo-500 rounded-full"
                              />
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {/* Right-side Action Buttons */}
                    <div className="flex items-center gap-1.5 pb-1.5 pl-3 border-l border-white/5 shrink-0">
                      {/* Copy Code */}
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={handleCopyCode}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-slate-300 bg-white/5 border border-white/10 hover:text-white hover:bg-white/10 text-xs transition-colors cursor-pointer"
                        title="Copy file code"
                      >
                        {copied ? (
                          <>
                            <Check size={13} className="text-emerald-400" />
                            <span className="text-emerald-400 font-medium">Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy size={13} />
                            <span>Copy</span>
                          </>
                        )}
                      </motion.button>

                      {/* Download Single File */}
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={handleDownloadSingleFile}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-slate-300 bg-white/5 border border-white/10 hover:text-white hover:bg-white/10 text-xs transition-colors cursor-pointer"
                        title="Download current file"
                      >
                        <Download size={13} />
                        <span>File</span>
                      </motion.button>

                      {/* Download Zip Archive */}
                      {files.length > 1 && (
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={handleDownloadZip}
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500 hover:text-white text-xs font-medium transition-colors cursor-pointer"
                          title="Download full project as ZIP"
                        >
                          <Archive size={13} />
                          <span>Zip</span>
                        </motion.button>
                      )}
                    </div>
                  </div>

                  {/* Monaco Code Editor Output */}
                  <motion.div
                    key={currentFile?.name || "code-view"}
                    initial={{ opacity: 0, y: 2 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.12 }}
                    className="flex-1 overflow-hidden relative min-h-0 bg-[#1e1e1e]"
                  >
                    {currentFile ? (
                      <Editor
                        height="100%"
                        width="100%"
                        language={getLanguage(currentFile.name)}
                        theme="vs-dark"
                        value={currentFile.content || ""}
                        onChange={handleCodeChange}
                        options={{
                          fontSize: 13.5,
                          minimap: { enabled: false },
                          glyphMargin: false,
                          folding: false,
                          lineNumbersMinChars: 4,
                          lineDecorationsWidth: 15,
                          scrollbar: {
                            vertical: "visible",
                            horizontal: "visible",
                            verticalScrollbarSize: 3,
                            horizontalScrollbarSize: 3,
                            arrowSize: 0,
                            useShadows: false,
                          },
                          scrollBeyondLastLine: false,
                          automaticLayout: true,
                          tabSize: 2,
                          wordWrap: "on",
                          smoothScrolling: true,
                          cursorSmoothCaretAnimation: "on",
                          cursorBlinking: "smooth",
                          lineNumbers: "on",
                          renderLineHighlight: "line",
                          padding: { top: 12, bottom: 12 },
                          fontFamily: "Menlo, Monaco, Consolas, 'Courier New', monospace",
                        }}
                        loading={
                          <div className="flex h-full items-center justify-center text-xs text-slate-400">
                            Loading Monaco Code Editor...
                          </div>
                        }
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-slate-500">
                        No code content available
                      </div>
                    )}
                  </motion.div>
                </>
              ) : (
                /* Live Execution Iframe View */
                <div className="flex flex-1 flex-col overflow-hidden bg-[#0d0f14]">
                  {/* Live Preview Toolbar */}
                  <div className="flex items-center justify-between border-b border-white/10 bg-[#181921] px-4 py-2 text-xs select-none">
                    <div className="flex items-center gap-2 text-slate-300 font-mono">
                      <Play size={13} className="text-emerald-400" />
                      <span>Interactive Live Preview</span>
                    </div>

                    <button
                      onClick={() => setPreviewKey(Date.now())}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                      title="Reload live preview"
                    >
                      <RefreshCw size={13} />
                      <span>Reload</span>
                    </button>
                  </div>

                  {/* Interactive Frame */}
                  <iframe
                    key={previewKey}
                    srcDoc={srcDoc}
                    title="Live Preview"
                    sandbox="allow-scripts allow-modals allow-forms allow-same-origin"
                    className="w-full h-full border-0 bg-[#0d0f14]"
                  />
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}