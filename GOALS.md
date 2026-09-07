# Daily goals — the settled design

A companion to PLAN.md, covering one feature: the daily to-do list drawn as the
bunny's journey along the vine on the home screen.

Everything in section 1 is an owner decision and is not open for re-litigation by
a future agent. Section 4 lists what was deliberately rejected, so nobody
re-proposes it in three months.

---

## 1. Owner decisions

1. **The goal is a TO-DO LIST OF ACTIVITIES, not a quantity.** Her dad picks the
   day's tasks — e.g. *one Addition, one Roman numerals up to 10, one Bonds to 10*.
   The flowers on the vine **are** those tasks, one each.
2. **The list is STANDING.** It applies every day until he changes it. There is no
   per-day setup ritual and no "you forgot to set today's goals" state.
3. **Her dad sets it inside the app.** Not a code constant. A grown-ups screen.
4. **The bunny travels the full width** of the header, left to right, and his
   journey ends at the top-right corner he already occupies. Finishing the day
   reassembles the home screen composition rather than changing it.
5. **Three tasks by default.** Three is the largest number read at a glance
   without counting.

> **Superseded:** an earlier draft of this feature counted 30 cards answered as
> three flowers of ten. The to-do list replaces that entirely. Cards are no longer
> the unit; a finished session of a listed activity is.

---

## 2. Rules

**What blooms a flower.** She finishes a session of a listed activity at its
listed option. Finishing is the whole test.

**Completion-contingent, never performance-contingent.** A session scored 4/18
blooms its flower exactly as 18/18 does. The app already has three ways to measure
how well she did — the live score, the timer, and the personal best with its
trophy. A fourth would pile everything onto the axis she can fail on. This one is
an effort axis: it gives her a way to succeed on a day the maths is going badly,
which is the day she most needs one.

**A task names an activity AND an option.** "Bonds to 10" and "Bonds to 20" are
different practice, so the task is `{activityId, optionId}`. Dad picks from the
same pickers Amelia uses, so there is nothing new to learn.

**Playing something not on the list is never punished.** It records personal bests
and is otherwise entirely normal — it simply does not bloom a flower. There is no
ceiling either: a fourth or fifth session still counts for bests. A goal that caps
play would convert a floor into a ceiling.

**An abandoned session blooms nothing.** She did not finish it. Backing out of a
game is already unscored, and this is consistent.

**A duplicate task is honoured.** If he lists *Addition* twice, that is two flowers
and needs two finished sessions. It is a legitimate way to say "do this twice".

**The list may hold 1 to 4 tasks.** Default three. Four fits the vine; five does
not, and past four she has to count instead of see.

**No list set yet** falls back to one Bonds to 10, one Addition, one Roman numerals
up to 10 — never an empty vine.

**Past tense, always.** "You practised three times today", never "do three to get
X". The vine shows what she did, not what she owes.

**It is a record, never a currency.** It buys nothing — no coins, no unlocks, no
shop, no cosmetics. The moment progress can be spent it stops being feedback and
becomes a tangible reward, which is the category the research finds actually
undermines a child's interest in the thing being rewarded.

---

## 3. Behaviour

**A new day** clears the flowers and returns the bunny to the left. The day rolls
over at **04:00 local**, not midnight: a session at 23:55 and one at 00:05 are the
same evening to a six-year-old, and a bedtime game should not land in tomorrow.

**A missed day is invisible.** No history is stored — not a rolling window, not a
`lastPlayedDate`, not a days-since-last-played. Nothing is computed, so no screen
can render a reproach and no future agent can surface one "helpfully". This is a
structural fence, not a policy.

**The clock can move and progress survives.** A telling-the-time app is on the
roadmap and a six-year-old with a phone may well change the device clock, to play
or to game the goal. Whatever the clock does, the answer is never "her progress is
deleted". Store the day's identity alongside its records and treat an
unrecognisable jump as a new day rather than a reason to erase one.

**The completion moment must not blur into the per-session confetti.** Finishing a
session already fires confetti. Finishing the whole day is a different, rarer
event and needs its own beat — the bunny arriving home, not more of the same.

**The grown-ups screen** lives at a hash route he can type and she will not find.
It is written for an adult: plain words, no illustration budget, one clear list of
activities with checkboxes or a small picker, and a sentence explaining that this
is what she will see on the vine.

**Accessibility.** The vine has a text equivalent — the tasks and their state — for
a screen reader, and the whole thing degrades to something legible with
`prefers-reduced-motion` set. Motion is transform and opacity only.

---

## 4. Rejected, with reasons

- **Daily streak counters** in every form — a number, a flame, a chain, a calendar.
  A counter that resets to zero records a failure a six-year-old did not control;
  she cannot make her family less busy on a Tuesday.
- **Streak freezes.** Worse than the streak. They ask a child to understand
  insurance, and selling protection against a loss teaches her the loss is real.
- **Forgiving streaks** ("five of the last seven days"). She cannot compute the
  rule, so she cannot tell whether she is safe. The anxiety survives; only the
  legibility is lost.
- **Any stored history of days.** Fourteen days of history makes a fourteen-day
  streak computable — fourteen days more than zero.
- **Notifications, reminders, or a badge.** The reminder in this house is her
  father, or it is nothing.
- **A sad, disappointed or neglected bunny.** A character whose mood depends on her
  attendance is emotional leverage applied to a six-year-old.
- **A "welcome back" greeting after time away.** It requires computing a gap, which
  is the one quantity this design deliberately cannot compute.

> **Known consequence of storing no history:** a "look at your week" view can never
> be built retroactively. If it is ever wanted, it starts collecting from the day
> that decision is made. The owner has seen this trade and accepted it.
