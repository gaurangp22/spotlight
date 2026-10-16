import { createContext, useContext } from 'react';
import { Keyboard, Platform } from 'react-native';

type Measurable = { measureInWindow: (callback: (x: number, y: number, width: number, height: number) => void) => void };
type Scroller = Measurable & { scrollTo: (options: { y: number; animated?: boolean }) => void };

/** Lets a focused field ask the screen around it to scroll it into view above the keyboard. */
export const RevealContext = createContext<(field: Measurable | null) => void>(() => {});
export const useReveal = () => useContext(RevealContext);

/**
 * Builds the screen's reveal function. Once the keyboard has opened (and the screen has shrunk to make room),
 * it measures the field against the visible scroll area and scrolls just enough to show it with some room.
 */
export function makeReveal(scroller: () => Scroller | null, offset: () => number, margin = 32) {
  return (field: Measurable | null) => {
    if (!field || Platform.OS === 'web') return;
    const run = () => {
      const view = scroller();
      if (!view) return;
      field.measureInWindow((_fx, fy, _fw, fh) => view.measureInWindow((_sx, sy, _sw, sh) => {
        const top = sy + margin, bottom = sy + sh - margin;
        if (fy + fh > bottom) view.scrollTo({ y: offset() + (fy + fh - bottom), animated: true });
        else if (fy < top) view.scrollTo({ y: Math.max(0, offset() - (top - fy)), animated: true });
      }));
    };
    // The keyboard may already be open (moving between fields) or about to open.
    const shown = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setTimeout(run, Platform.OS === 'ios' ? 280 : 60));
    setTimeout(() => { shown.remove(); run(); }, 450);
  };
}
