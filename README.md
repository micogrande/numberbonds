# Amelia

A small hub of learning apps for one six-year-old, on a phone or tablet, in
portrait. It started life as a single Number Bonds game and is now a home screen
with six category slots, of which *numbers* is awake and five are asleep until
they are built.

- **`PLAN.md` is the specification.** It is the authority on every decision:
  architecture, palette, deck recipes, storage keys, build order. Never edit it.
- **`AGENTS.md`** is the working guide — house rules, stack, and where to look.

```
npm run dev      # vite dev server
npm run build    # must pass before you hand work back
npm run lint     # must exit 0 — it is clean, keep it clean
npm test         # vitest run
```

## Routing is hash routing, and that is load-bearing

```
#/                                Home
#/c/:categorySlug                 Category
#/a/:activitySlug                 Activity option picker
#/play/:activitySlug/:optionId    Session
#/summary/:activitySlug/:optionId Result
```

**This is why there is no `vercel.json`. If someone "tidies" the routes into
paths, every refresh 404s in production.**

The fragment never reaches the server, so `numberbonds-ten.vercel.app/#/play/…`
is served by the same `index.html` that is already cached, on every screen, on
every refresh. Path routing needs a rewrite rule in `vercel.json` and buys two
production failure modes that do not otherwise exist: a deep-link 404 if the
rewrite is wrong, and a stale-chunk 404 for any tab left open across a deploy.
react-router would buy deep-linkable URLs, which are worth nothing to a child who
cannot type one. See PLAN.md §2.5.

The router is `src/app/routes.js` (pure, tested), `src/app/useHashRoute.js` (a
`hashchange`/`popstate` listener) and `src/app/Shell.jsx` (the only switch in the
app). Its behaviour is specified in PLAN.md §2.5 and summarised here because it
is easy to break by accident:

- play → summary **replaces**, so Back from a result lands on the option picker,
  never back inside a game that is already over
- Back mid-game abandons the session and it is never scored. There is no confirm
  modal, deliberately
- Back on Home is not trapped — leaving the app is correct behaviour
- an unknown activity or option in the URL redirects to `#/`
- a refresh mid-session drops the session and lands on the option picker

## Deployment

The repo is `micogrande/numberbonds` and the app deploys to
`numberbonds-ten.vercel.app`. Repo and deployment plumbing are untouched by the
rewrite (PLAN.md §9.3) — only the local `package.json` name is `amelia`. Do not
touch git remotes or Vercel configuration.
