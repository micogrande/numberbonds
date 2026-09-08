# The world apps — settled decisions

Companion to PLAN.md and GOALS.md, covering the four apps in the flags,
geography, continents and oceans slots.

Section 1 is owner decisions and is not open for re-litigation.

---

## 1. Owner decisions

**Flags — artwork is vendored, not hand-drawn.** AGENTS.md's "everything is
hand-written inline SVG" rule was written for the garden motifs and does not bind
flags. A flag is *content*, not illustration: a hand-drawn Spanish coat of arms
in garden style would be both wrong and enormous. Source is
[lipis/flag-icons](https://github.com/lipis/flag-icons) v7.5.0, MIT — the same
Wikimedia Commons artwork, already normalised to one 4:3 ratio, optimised, and
covered by a single licence instead of ~50 per-file licence tags. Files are
committed into the repo; nothing is hotlinked.

**Europe is the widest common definition** — Russia, Turkey and Kosovo all
included, along with the Caucasus states and the micro-states. Kazakhstan is
excluded as overwhelmingly Asian.

**Formal country names, with England's flag as its own card.** The Union Jack is
"United Kingdom"; the St George's cross is "England" and sits alongside it, so
the two teach the distinction by existing together rather than by correcting her.
Czechia, Netherlands, Ireland elsewhere.

**Seven continents, the seventh called "Oceania."**

**Five oceans, plus a second level of major seas** — Mediterranean, North Sea,
Baltic, Caribbean, Red Sea. Four or five oceans alone is four or five facts, and
the oceans slot on the home screen is permanent, so it needs enough to be worth
opening twice.

**Geography is one app with two options: capitals, and find-on-map.** Not
tap-the-map — that needs a third input mode and is deferred, not cancelled.

---

## 2. Consequences worth writing down

**~50 flags is not one deck for a six-year-old.** Coverage becomes difficulty
tiers, the same shape as Roman numerals' up-to-10/50/100: a starter tier of the
most recognisable, a middle tier, and a top tier of every country. Full coverage
is the ceiling she climbs to, not the entry price.

**The map cannot show every country.** On a 375px phone, Monaco, San Marino,
Liechtenstein, Andorra, Malta and the Vatican are a pixel or two — a highlight she
physically cannot see. That is an engineering constraint, not a pedagogical
choice: the map tier restricts by land area or uses an inset, while the flags app
carries everything, because on a flag card size does not matter.

**Distractors must target real confusions**, to the standard the Roman numerals
ladder set — a pure, deterministic function of the answer, assertable against an
exact array. For flags that means the Nordic crosses; the tricolours that differ
only in colour order (Netherlands/Luxembourg, Ireland/Italy); Monaco/Indonesia/
Poland; Romania/Chad; Slovenia/Slovakia/Russia. Never a random country.

**Data is generated outside the repo and only the output is committed**, with a
provenance header naming source, licence, version and the exact command. No new
runtime dependency, no build-time dependency, no Vite plugin.

---

## 3. Still open

- **Which continents wording her school uses** was answered as "Oceania", but
  nobody has checked her books. If a book says Australia, change one string.
- **The reverse flags direction** (name in the question, four flags on the
  buttons) is deliberately later. It needs pictures on the answer buttons, and it
  is the more valuable drill *once she already knows the flags* — so its natural
  place is a level she grows into.
- **Tap-the-map** stays deferred until there is evidence she wants it. If she
  starts poking at the map unprompted, that is the evidence.

---

## 4. Regenerating the flag data

`src/activities/european-flags/flagData.js` is generated, not written. It carries
the country list, the capitals and the artwork.

The artwork comes from [lipis/flag-icons](https://github.com/lipis/flag-icons)
v7.5.0, MIT, `flags/4x3/<code>.svg`. Every file is fetched, its outer `<svg>` tag
stripped (the app renders its own, so it controls sizing and aria), comments
removed and whitespace collapsed, then emitted as one frozen object.

Run it outside the repo and commit only the output:

```bash
# for each ISO code in the list at the top of flagData.js
curl -s "https://raw.githubusercontent.com/lipis/flag-icons/main/flags/4x3/$CODE.svg"
```

Two properties were verified at generation time and are what make the app
possible; re-check both if the upstream version ever changes:

- **All 51 flags share the viewBox `0 0 640 480`.** Four choice buttons need
  identical boxes, and `FlagPrompt.module.css` relies on the SVG's own intrinsic
  ratio rather than enforcing one.
- **Every internal id is already country-prefixed** (`pt-a`, `hr-a`, root
  `flag-icons-<code>`), so four flags can share a page without colliding.

Measured weight: 51 flags gzip to ~150 KB, in the flags activity's own lazy chunk
— downloaded when she first opens the app, then cached. Six countries with
detailed coats of arms account for most of it; Serbia alone is 50 KB gzipped. A
twelve-flag starter tier measures 826 bytes, so splitting this file by tier is the
fix if that one-time cost ever matters.
