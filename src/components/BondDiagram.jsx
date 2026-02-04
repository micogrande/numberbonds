import React from 'react';
import { motion } from 'framer-motion';
import styles from './BondDiagram.module.css';

const BondDiagram = ({ bond, userInput, feedback }) => {
    if (!bond) return null;

    const { whole, parts, missingIndex } = bond;

    // Animation variants
    const circleVariants = {
        hidden: { scale: 0, opacity: 0 },
        visible: { scale: 1, opacity: 1, transition: { type: 'spring', stiffness: 300, damping: 20 } }
    };

    const shakeVariants = {
        idle: { x: 0 },
        error: { x: [-10, 10, -10, 10, 0], transition: { duration: 0.4 } },
        success: { scale: [1, 1.2, 1], transition: { duration: 0.4 } },
        correction: { scale: 1, opacity: 1 }
    };

    return (
        <div className={styles.container}>
            {/* SVG Connectors - Simply drawn manually for now based on positions */}
            <svg className={styles.linesSvg} viewBox="0 0 400 300">
                {/* Adjust coordinates to match layout. Whole is roughly at 200, 50. Parts at 120, 180 and 280, 180 */}
                <line x1="200" y1="100" x2="130" y2="180" className={styles.connector} />
                <line x1="200" y1="100" x2="270" y2="180" className={styles.connector} />
            </svg>

            <div className={styles.wholePosition}>
                {(() => {
                    const isMissing = missingIndex === 'WHOLE';
                    const content = isMissing ? (userInput || '?') : whole;
                    const isFilled = isMissing && userInput.length > 0;
                    const isCorrection = isMissing && feedback === 'correction';
                    const isSuccess = isMissing && feedback === 'success';

                    return (
                        <motion.div
                            className={`${styles.circle} ${styles.whole} ${isMissing ? styles.missing : ''} ${isFilled ? styles.filled : ''} ${isCorrection ? styles.correction : ''} ${isSuccess ? styles.success : ''}`}
                            variants={isMissing ? shakeVariants : circleVariants}
                            initial={isMissing ? "idle" : "hidden"}
                            animate={isMissing ? feedback : "visible"}
                        >
                            {content}
                        </motion.div>
                    );
                })()}
            </div>

            <div className={styles.partsContainer}>
                {parts.map((val, idx) => {
                    // Standard logic: if missingIndex is a number, check it.
                    // If missingIndex is 'WHOLE', then parts are NEVER missing.
                    const isMissing = idx === missingIndex;
                    const content = isMissing ? (userInput || '?') : val;
                    const isFilled = isMissing && userInput.length > 0;
                    const isCorrection = isMissing && feedback === 'correction';
                    const isSuccess = isMissing && feedback === 'success';

                    return (
                        <motion.div
                            key={idx}
                            className={`${styles.circle} ${isMissing ? styles.missing : ''} ${isFilled ? styles.filled : ''} ${isCorrection ? styles.correction : ''} ${isSuccess ? styles.success : ''}`}
                            variants={isMissing ? shakeVariants : circleVariants}
                            initial={isMissing ? "idle" : "hidden"}
                            animate={isMissing ? feedback : "visible"}
                        >
                            {content}
                        </motion.div>
                    );
                })}
            </div>
        </div>
    );
};

export default BondDiagram;
