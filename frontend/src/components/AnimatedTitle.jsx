import React, { useState, useEffect, useRef } from "react";

/**
 * AnimatedTitle renders text word-by-word dynamically like ChatGPT's title reveal effect.
 */
export default function AnimatedTitle({ text = "", className = "" }) {
  const [displayedText, setDisplayedText] = useState(text);
  const prevTextRef = useRef(text);

  useEffect(() => {
    if (!text) {
      setDisplayedText("");
      prevTextRef.current = text;
      return;
    }

    // If text hasn't changed meaningfully, keep current display
    if (prevTextRef.current === text) {
      setDisplayedText(text);
      return;
    }

    prevTextRef.current = text;

    const words = text.trim().split(/\s+/);
    if (words.length <= 1) {
      setDisplayedText(text);
      return;
    }

    let index = 0;
    setDisplayedText(words[0]);

    // Spread word reveals evenly over 3.0 seconds total (3000ms)
    const totalDurationMs = 5000;
    const stepDelay = Math.max(80, Math.floor(totalDurationMs / words.length));

    const timer = setInterval(() => {
      index++;
      if (index < words.length) {
        setDisplayedText(words.slice(0, index + 1).join(" "));
      } else {
        clearInterval(timer);
      }
    }, stepDelay);

    return () => clearInterval(timer);
  }, [text]);

  return <span className={className}>{displayedText}</span>;
}
