// Shared between the pre-paint inline script (layout.tsx) and the toggle, so
// the two can never drift onto different storage keys.
export const THEME_STORAGE_KEY = "overlapx-theme";

/**
 * Runs before first paint to replay the reader's stored choice onto <html>,
 * so a dark-theme reader never sees a white flash. Light is the default, so
 * this only has to act when dark was chosen. Kept tiny and dependency-free —
 * it is inlined into the document head as a string.
 */
export const THEME_INIT_SCRIPT = `try{if(localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY
)})==="dark"){document.documentElement.dataset.theme="dark"}}catch(e){}`;
