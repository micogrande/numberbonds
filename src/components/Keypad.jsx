import React from 'react';
import styles from './Keypad.module.css';

const Keypad = ({ onKeyPress }) => {
    const nums = [1, 2, 3, 4, 5, 6, 7, 8, 9];

    return (
        <div className={styles.keypad}>
            {nums.map(n => (
                <button key={n} className={styles.key} onClick={() => onKeyPress(n.toString())}>
                    {n}
                </button>
            ))}

            {/* Empty Spacer */}
            <div />

            {/* 0 Button */}
            <button className={styles.key} onClick={() => onKeyPress('0')}>
                0
            </button>

            {/* Empty Spacer */}
            <div />
        </div>
    );
};

export default Keypad;
