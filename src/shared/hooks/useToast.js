import { useState, useCallback } from "react";

/**
 * Reusable toast hook.
 * @param {number} duration - How long the toast is visible in ms (default 3000).
 * @returns {{ msg: string|null, show: (message: string) => void }}
 */
export function useToast(duration = 3000) {
  const [msg, setMsg] = useState(null);

  const show = useCallback((message) => {
    setMsg(message);
    setTimeout(() => setMsg(null), duration);
  }, [duration]);

  return { msg, show };
}
