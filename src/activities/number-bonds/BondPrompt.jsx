import React from 'react';
import { motion } from 'framer-motion';
import styles from './BondPrompt.module.css';
import { circleVariants } from '../../feedback/motion';
import AnswerBox from '../../input/AnswerBox';
import { MISSING } from './bondEngine';

/**
 * Number Bonds — the prompt renderer. (PLAN 2.2, PLAN 4.1)
 *
 * Was `components/BondDiagram.jsx`. It reads `question.prompt` and `question.id`
 * and nothing else: no session state, no storage, no idea what a score is. That
 * is the whole renderer contract, and it is why a subtraction or roman-numeral
 * prompt can drop into the same play screen later without touching this file.
 *
 * Two bugs from PLAN 5 are fixed here rather than worked around.
 *
 * 1. **The circles are keyed on `question.id`.** They were keyed by array index,
 *    so React saw "the same three circles with different numbers in them" on
 *    every card: the spring entrance played on card 1 of a session and then the
 *    digits silently swapped for the remaining seventeen. A stable-per-card key
 *    makes each card a genuine remount, which is exactly what PLAN 2.1 says the
 *    id is for.
 *
 * 2. **The connector lines reach the circles.** `.linesSvg` was `top: 50%` on a
 *    container whose whole circle lives in the *top* half, with a `viewBox` the
 *    code comment admitted had never been matched to the layout — so two grey
 *    smudges floated across and below the parts and touched nothing. The core
 *    visual of a number bond, the thing that says *these two make that one*, has
 *    never worked.
 *
 *    The fix is not new coordinates; guessed coordinates are what broke it. The
 *    layout is now described **once**, in `GEOMETRY` below, and everything else
 *    is derived from it: the CSS sizes (handed over as custom properties, so the
 *    stylesheet cannot drift from the maths), the `viewBox`, and the line
 *    endpoints, which are the real circle centres pulled back to the real circle
 *    edges so a line never crosses a translucent empty slot.
 */

/**
 * The layout, in CSS pixels. THE source of truth: the stylesheet is driven from
 * these numbers and so is the SVG. Change one here and both follow.
 *
 * The values are today's, unchanged — the diagram must look exactly as it does
 * on her phone, minus the broken lines.
 */
const GEOMETRY = {
    wholeSize: 70,
    partSize: 68,
    /** Horizontal space between the two part circles. */
    partGap: 50,
    /** Vertical space between the whole circle and the parts row. */
    rowGap: 20,
};

/** The diagram's own box. `.container` is exactly this, so `inset: 0` is exact. */
const WIDTH = GEOMETRY.partSize * 2 + GEOMETRY.partGap;
const HEIGHT = GEOMETRY.wholeSize + GEOMETRY.rowGap + GEOMETRY.partSize;

const WHOLE = {
    x: WIDTH / 2,
    y: GEOMETRY.wholeSize / 2,
    r: GEOMETRY.wholeSize / 2,
};

/** Left and right part centres. Both sit on the same baseline. */
const PARTS = [0, 1].map((index) => ({
    x: index === 0 ? GEOMETRY.partSize / 2 : WIDTH - GEOMETRY.partSize / 2,
    y: HEIGHT - GEOMETRY.partSize / 2,
    r: GEOMETRY.partSize / 2,
}));

/**
 * A line from the edge of one circle to the edge of another.
 *
 * Centre-to-centre would run *under* both circles. They are opaque today, but a
 * missing slot is `rgba(255,255,255,.5)` and a stroke would show through it as a
 * bar across the answer box. Trimming by each radius is one line of trigonometry
 * and it removes the whole class of problem.
 */
function connector(from, to) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const length = Math.hypot(dx, dy);
    const ux = dx / length;
    const uy = dy / length;

    return {
        x1: from.x + ux * from.r,
        y1: from.y + uy * from.r,
        x2: to.x - ux * to.r,
        y2: to.y - uy * to.r,
    };
}

const CONNECTORS = PARTS.map((part) => connector(WHOLE, part));

/** Handed to CSS so the stylesheet and the geometry above cannot disagree. */
const CSS_GEOMETRY = {
    '--bond-width': `${WIDTH}px`,
    '--bond-height': `${HEIGHT}px`,
    '--bond-whole-size': `${GEOMETRY.wholeSize}px`,
    '--bond-part-size': `${GEOMETRY.partSize}px`,
    '--bond-part-gap': `${GEOMETRY.partGap}px`,
    '--bond-row-gap': `${GEOMETRY.rowGap}px`,
};

/**
 * One slot of the bond: a number, or the box she is filling in.
 *
 * The missing slot IS the answer box, so it is `input/AnswerBox.jsx` wearing this
 * activity's skin (PLAN 2.4). The box brings the `?`, the draft, the reveal, the
 * reaction to a graded answer and the wobble on an empty ENTER; this file brings
 * a circle. It reports its state back through `data-filled` / `data-feedback`,
 * which is what `.missing[data-…]` in the stylesheet dresses — the classes it
 * replaced (`.filled`, `.correction`, `.success`) said exactly the same things.
 *
 * `userInput` is a **string** on purpose, all the way from the play screen — a
 * bond answer of `0` is legitimate and a bare `0` would render as an empty box.
 */
const BondCircle = ({ value, isMissing, isWhole, userInput, feedback, nudge }) => {
    const className = [
        styles.circle,
        isWhole ? styles.whole : '',
        isMissing ? styles.missing : '',
    ]
        .filter(Boolean)
        .join(' ');

    if (isMissing) {
        return (
            <AnswerBox
                className={className}
                value={userInput}
                feedback={feedback}
                nudge={nudge}
            />
        );
    }

    return (
        <motion.div
            className={className}
            variants={circleVariants}
            initial="hidden"
            animate="visible"
        >
            {value}
        </motion.div>
    );
};

const BondPrompt = ({ question, userInput = '', feedback = 'idle', nudge = 0 }) => {
    if (!question) return null;

    const { whole, parts, missing, text } = question.prompt;

    return (
        // `role="group"` + the engine's own reading of the card, so the diagram
        // announces as "3 and what make 10?" rather than three loose numbers.
        // The live announcement of a graded answer belongs to step 13.
        <div className={styles.container} style={CSS_GEOMETRY} role="group" aria-label={text}>
            {/*
              The viewBox IS the container: same width, same height, same origin,
              so one unit here is one CSS pixel there and the endpoints below are
              the circle edges rather than an estimate of them.
            */}
            <svg
                className={styles.linesSvg}
                viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
                aria-hidden="true"
                focusable="false"
            >
                {CONNECTORS.map((line, index) => (
                    <line key={index} {...line} className={styles.connector} />
                ))}
            </svg>

            <div className={styles.wholePosition}>
                <BondCircle
                    // Keyed on the card, so every card is a genuine remount and
                    // replays its entrance — not just the first of the session.
                    key={`${question.id}-whole`}
                    value={whole}
                    isMissing={missing === MISSING.WHOLE}
                    isWhole
                    userInput={userInput}
                    feedback={feedback}
                    nudge={nudge}
                />
            </div>

            <div className={styles.partsContainer}>
                {parts.map((value, index) => (
                    <BondCircle
                        key={`${question.id}-part${index}`}
                        value={value}
                        isMissing={missing === (index === 0 ? MISSING.PART0 : MISSING.PART1)}
                        userInput={userInput}
                        feedback={feedback}
                        nudge={nudge}
                    />
                ))}
            </div>
        </div>
    );
};

export default BondPrompt;
