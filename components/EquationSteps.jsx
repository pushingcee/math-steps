'use client';

import { useEffect, useRef } from 'react';
import { mountEquationSteps } from '../lib/equationStepsRuntime';
import './equation-steps.css';

/**
 * EquationSteps
 * Renders an animated, step-by-step walkthrough of an equation/expression
 * being solved. You supply a *valid ordering* of states (one string per
 * state, exactly like the presets) and the engine infers and animates the
 * single steps in between — so any problem is reproducible just by passing
 * a new array.
 *
 * @param {string[]} states  Ordered list of states, e.g.
 *   ["2(x + 3) = 10", "2x + 6 = 10", "2x = 10 - 6", "2x = 4", "x = 2"]
 *   Supports = < > <= >=, fractions 1/2, lazy fractions 1//2, |abs|,
 *   multiplication *, and powers x^2.
 * @param {string} [className] Extra class names for the wrapper.
 */
export default function EquationSteps({ states, className }) {
  const rootRef = useRef(null);
  // Re-mount whenever the ordering changes. Stringify so callers can pass a
  // fresh array literal each render without forcing a needless rebuild.
  const key = JSON.stringify(states);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || !Array.isArray(states) || states.length === 0) return undefined;
    const controller = mountEquationSteps(root, states);
    return () => controller.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return (
    <div
      ref={rootRef}
      tabIndex={0}
      className={`equation-steps${className ? ` ${className}` : ''}`}
    />
  );
}
