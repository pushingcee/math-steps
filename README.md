# Equation Step Engine

Give it the **states** of a problem — it infers and **animates the single steps in between**.
Now packaged as a reusable **Next.js component**.

The key idea: a problem is fully described by a *valid ordering of states*
(one per line, just like the original presets). You don't script the steps —
the engine figures out and animates the transition between each pair of states.
So every problem is **reproducible**: pass a new array, get a new animated lesson.

```jsx
import EquationSteps from '@/components/EquationSteps';

export default function Page() {
  return (
    <EquationSteps
      states={[
        '2(x + 3) = 10',
        '2x + 6 = 10',
        '2x = 10 - 6',
        '2x = 4',
        'x = 2',
      ]}
    />
  );
}
```

## Props

| Prop        | Type       | Description                                                        |
| ----------- | ---------- | ----------------------------------------------------------------- |
| `states`    | `string[]` | Ordered list of states. **Required.** Each item is one state.     |
| `className`  | `string`   | Optional extra class names on the wrapper.                         |

### Supported syntax in a state

- Relations: `=` `<` `>` `<=` `>=`
- Fractions: `1/2` (eager) and `1//2` (lazy / un-reduced)
- Absolute value: `|3 - 4|`
- Multiplication: `*`
- Powers: `x^2`
- Branches (e.g. after a split): `x = 0 | x - 25 = 0`

If two consecutive states aren't actually equivalent — or an inequality
doesn't flip when it should — the component shows a clear error instead of a
lesson, so a bad ordering is caught immediately.

## Running locally

```bash
npm install
npm run dev      # http://localhost:3000
```

`app/page.js` renders a gallery of example problems; each `<EquationSteps>`
is independent and can be driven by its own ordering.

## Project layout

```
app/                     Next.js App Router (demo page + layout)
components/
  EquationSteps.jsx      The React component ('use client')
  equation-steps.css     Component styles
lib/
  engine.js              Pure step-inference engine — exports plan(states)
  equationStepsRuntime.js  Imperative renderer/animator: mountEquationSteps(root, states)

index.html, engine.js, renderer.js, styles.css   The original standalone
                         (vanilla, no-build) version, kept at the root for reference.
```

## How it works

- `lib/engine.js` is the original engine, unchanged in behaviour, now exposed as
  an ES module. `plan(states)` parses each state, verifies consecutive states
  are equivalent, and returns `{ initial, steps }` describing every micro-step.
- `lib/equationStepsRuntime.js` builds the stage/controls inside a host element
  and plays those steps with the Web Animations API. It's framework-agnostic —
  `EquationSteps.jsx` just mounts it in a `useEffect` and tears it down on unmount.
