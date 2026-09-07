import React from 'react';
import styles from './Keypad.module.css';
import { Check, X } from 'lucide-react';
import { KEYPAD_KEYS } from '../input/keypadRules';

/**
 * The keypad, as buttons. Look and feel only — it reports which key was pressed
 * and knows nothing about drafts, digit caps or answers. The meaning of a press
 * lives in `input/KeypadInput.jsx` (PLAN 2.4).
 *
 * The layout, the sizes and the colours are unchanged: this is the keypad she
 * already uses. Three things were added, all of them things it was missing.
 *
 *   - **Names for the two icon keys.** Check and X are drawings; every other key
 *     announces itself by its own digit, and these two announced nothing at all.
 *   - **A disabled state.** Between a graded answer and the next card the session
 *     refuses input, and the keypad used to sit there looking live while every
 *     tap did nothing. A dead tap reads to a six-year-old as "the device is
 *     broken", so the keypad now visibly steps back for that second and a half.
 *   - **`type="button"`.** There is no form here today, but the default type is
 *     `submit`, and that is a trap left lying about for whoever adds one.
 */

const NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

const Keypad = ({ onKeyPress, disabled = false }) => (
    <div className={styles.keypad} data-disabled={disabled ? 'true' : 'false'}>
        {NUMBERS.map(n => (
            <button
                key={n}
                type="button"
                className={styles.key}
                disabled={disabled}
                onClick={() => onKeyPress(String(n))}
            >
                {n}
            </button>
        ))}

        {/* Submit / Check - Left of 0 */}
        <button
            type="button"
            className={`${styles.key} ${styles.enter}`}
            disabled={disabled}
            aria-label="Check answer"
            onClick={() => onKeyPress(KEYPAD_KEYS.SUBMIT)}
        >
            <Check size={32} aria-hidden="true" />
        </button>

        {/* 0 Button - Center */}
        <button
            type="button"
            className={styles.key}
            disabled={disabled}
            onClick={() => onKeyPress('0')}
        >
            0
        </button>

        {/* Delete / Backspace - Right of 0 */}
        <button
            type="button"
            className={`${styles.key} ${styles.delete}`}
            disabled={disabled}
            aria-label="Delete last digit"
            onClick={() => onKeyPress(KEYPAD_KEYS.DELETE)}
        >
            <X size={32} aria-hidden="true" />
        </button>
    </div>
);

export default Keypad;
