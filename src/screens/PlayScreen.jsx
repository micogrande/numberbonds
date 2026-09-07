import React, { useEffect, useState } from 'react';
import styles from '../styles/Screens.module.css';
import ScreenHeader from '../components/ScreenHeader';
import { assertQuestion } from '../activities/manifestSchema';
import { resolveInput } from '../input/inputRegistry';

/**
 * The play host. Was `GameScreen.jsx`. (PLAN 2.4, PLAN 7 step 7)
 *
 * Three things, composed: the header, whatever renderer draws this card, and
 * whatever adapter takes an answer for it. **There is not one activity-specific
 * import in this file, no activity is named anywhere in it, and neither may ever
 * change.** The screen it replaced imported one activity's renderer directly and
 * admitted as much in a comment; that import is a prop now, and at step 8 the
 * registry fills it in. Nothing else here changes when the other activities land.
 *
 * ── THE PROMPT RENDERER CONTRACT ────────────────────────────────────────────
 *
 * A renderer is mounted with exactly these four props and may read no others:
 *
 *     question    the card. It reads `question.prompt`; `id` and `kind` are for
 *                 keys, tests and aria (PLAN 2.1)
 *     userInput   what belongs in the answer box RIGHT NOW, as a string: her
 *                 draft, or the correct answer during a reveal. Always a string —
 *                 an answer of 0 renders as an empty box otherwise
 *     feedback    'idle' | 'error' | 'success' | 'correction'
 *     nudge       a counter of empty ENTERs, for the answer box to wobble at
 *
 * A renderer with no answer box (a multiple-choice glyph) ignores the last
 * three. It never receives the score, the timer, the deck or storage.
 *
 * ── THE INPUT ADAPTER CONTRACT ──────────────────────────────────────────────
 *
 * The full prop list is the `InputAdapterProps` typedef in
 * `input/inputRegistry.js`. Two of them are worth naming here because this file
 * is the only thing that can supply them, and for three steps it did not:
 *
 *     feedback    the same phase string the renderer gets
 *     revealed    the correct answer, non-null ONLY during the reveal
 *
 * A keypad ignores both — the prompt's answer box draws the grading. But an
 * adapter whose buttons ARE the answers has to draw it itself: PLAN 4.4 wants
 * the tapped wrong button to shake for 500ms and then dim while the correct one
 * lights green and stays lit to 2500ms, and none of that is expressible without
 * knowing the phase and the answer. Withholding them meant no choice adapter
 * could be written from inside an activity folder, which is the one thing this
 * architecture promises.
 *
 * ── WHAT IS NOT HERE ────────────────────────────────────────────────────────
 *
 * No timers. The one `setTimeout` in the app belongs to `session/useSession.js`
 * (PLAN 2.3), and every phase this screen renders is handed to it as a prop.
 */

/**
 * One card, and everything that belongs to that card.
 *
 * The draft answer lives here rather than in the adapter or the session, and the
 * component is **keyed on `question.id`** by its parent, which is the entire
 * mechanism for clearing it: a new card is a new component, so the previous
 * card's half-typed answer cannot survive into it. There is no effect to forget
 * and no "clear the box" message to lose — which is exactly how the previous
 * implementation managed to stamp one session's answer into the next one's box.
 *
 * The adapter is inside the keyed boundary for the same reason: whatever state a
 * future adapter keeps (which choice is lit, say) is per-card too.
 */
const PlayCard = ({
    question,
    Prompt,
    Input,
    inputMode,
    inputConfig,
    feedback,
    revealed,
    nudge,
    busy,
    onSubmit
}) => {
    const [draft, setDraft] = useState('');

    // Dev only, once per card, because the component is keyed on `question.id`.
    //
    // The play host already asserts that an engine dealt as many cards as its
    // manifest advertises, which is what keeps a personal best honest — but a
    // count says nothing about whether the cards are answerable. A card with no
    // `id` breaks the entrance animation for the whole deck; a multiple-choice
    // card whose right answer is on none of its buttons cannot be answered at
    // all, and a six-year-old taps all four and concludes she is wrong four
    // times. This is the last moment anything can look at a card before she
    // does. `registry.test.js` runs the same check over every card of every deck
    // long before that (PLAN 2.1).
    useEffect(() => {
        assertQuestion(question, inputMode);
    }, [question, inputMode]);

    // During a reveal the box shows the right answer instead of her attempt. It
    // is read off the session and never written into the draft: writing it there
    // is what let a stale timer leave the previous answer in a fresh box.
    // `String()` because an answer of 0 is legitimate and renders as empty.
    const shown = revealed === null || revealed === undefined ? draft : String(revealed);

    return (
        <>
            <div className={styles.gameArea}>
                <Prompt
                    question={question}
                    userInput={shown}
                    feedback={feedback}
                    nudge={nudge}
                />
            </div>

            <Input
                question={question}
                value={draft}
                onChange={setDraft}
                onSubmit={onSubmit}
                config={inputConfig}
                disabled={busy}
                // The grading, handed to whoever composed the answer. A keypad
                // ignores both; an adapter whose buttons are the answers cannot
                // draw a wrong tap or a revealed right one without them.
                feedback={feedback}
                revealed={revealed}
            />
        </>
    );
};

const PlayScreen = ({
    question,
    prompt: Prompt,
    inputMode,
    inputConfig,
    feedback = 'idle',
    revealed = null,
    nudge = 0,
    onSubmit,
    onBack,
    currentIndex,
    total,
    startTime,
    score
}) => {
    const { mode, Component: Input, config } = resolveInput(inputMode, inputConfig);

    // Every phase except `answering` maps to a non-idle feedback state, so this
    // is the same fact the session uses to refuse input — read once, here, rather
    // than sent down as a second prop that could disagree with the first.
    const busy = feedback !== 'idle';

    return (
        <div className={`${styles.screen} ${styles.gameContainer}`}>
            <ScreenHeader
                onBack={onBack}
                currentIndex={currentIndex}
                total={total}
                startTime={startTime}
                score={score}
            />

            <div className={styles.mainContent}>
                {question && (
                    <PlayCard
                        key={question.id}
                        question={question}
                        Prompt={Prompt}
                        Input={Input}
                        // The mode as the registry resolved it, not as the
                        // manifest spelled it: it is the one fact needed to
                        // check that a card carries choices iff it should.
                        inputMode={mode}
                        inputConfig={config}
                        feedback={feedback}
                        revealed={revealed}
                        nudge={nudge}
                        busy={busy}
                        onSubmit={onSubmit}
                    />
                )}
            </div>
        </div>
    );
};

export default PlayScreen;
