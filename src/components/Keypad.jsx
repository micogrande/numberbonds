import React from 'react';
import styles from './Keypad.module.css';
import { Check, X } from 'lucide-react';

const Keypad = ({ onKeyPress }) => {
    const nums = [1, 2, 3, 4, 5, 6, 7, 8, 9];

    return (
        <div className={styles.keypad}>
            {nums.map(n => (
                <button key={n} className={styles.key} onClick={() => onKeyPress(n.toString())}>
                    {n}
                </button>
            ))}

            {/* Submit / Check - Left of 0 */}
            <button className={`${styles.key} ${styles.enter}`} onClick={() => onKeyPress('ENTER')}>
                <Check size={32} />
            </button>

            {/* 0 Button - Center */}
            <button className={styles.key} onClick={() => onKeyPress('0')}>
                0
            </button>

            {/* Delete / Backspace - Right of 0 */}
            <button className={`${styles.key} ${styles.delete}`} onClick={() => onKeyPress('DEL')}>
                <X size={32} />
            </button>
        </div>
    );
};

export default Keypad;
