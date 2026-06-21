import EquationSteps from '../components/EquationSteps';

/**
 * Each problem is just a *valid ordering of states* — exactly like the
 * presets in the original tool. Drop a new one in here (or pass your own
 * array to <EquationSteps states={...} />) and it becomes reproducible.
 */
const PROBLEMS = [
  {
    title: 'Nested brackets',
    states: [
      '2(2 + (x + 3)) = 10',
      '2(2 + x + 3) = 10',
      '2(x + 5) = 10',
      '2x + 10 = 10',
      '2x = 0',
      'x = 0',
    ],
  },
  {
    title: 'Brackets',
    states: [
      '2(x + 3) = 10',
      '2x + 6 = 10',
      '2x = 10 - 6',
      '2x = 4',
      'x = 2',
    ],
  },
  {
    title: 'Like terms',
    states: ['2x + 3x - 4 = 6', '5x - 4 = 6', '5x = 6 + 4', '5x = 10', 'x = 2'],
  },
  {
    title: 'Inequality',
    states: ['2x + 1 <= 7', '2x <= 7 - 1', '2x <= 6', 'x <= 3'],
  },
  {
    title: 'Negative flip',
    states: ['-2x < 6', 'x > -3'],
  },
  {
    title: 'Absolute value',
    states: ['|3 - 4| + 5', '|-1| + 5', '1 + 5', '6'],
  },
  {
    title: 'Difference of squares',
    states: [
      '49 - x^2',
      '7^2 - x^2',
      '(7 - x) * (7 + x)',
      '(7 + x) * (7 - x)',
    ],
  },
  {
    title: 'Add fractions',
    states: ['(7//13 + 2//13) + (1//13 + 8//13)', '9//13 + 9//13', '18//13'],
  },
  {
    title: 'Variable fractions',
    states: [
      '3n//4 + n//2 + n//4 + n = 1200',
      '3n//4 + 2n//4 + n//4 + 4n//4 = 1200',
      '(3n + 2n + n + 4n)//4 = 1200',
      '10n//4 = 1200',
      '5n//2 = 1200',
      'n = 480',
    ],
  },
  {
    title: 'Quadratic (zero product)',
    states: [
      'x^2 = 25x',
      'x^2 - 25x = 0',
      'x*(x - 25) = 0',
      'x = 0 | x - 25 = 0',
      'x = 0 | x = 25',
    ],
  },
];

export default function Home() {
  return (
    <main
      style={{
        maxWidth: 820,
        margin: '0 auto',
        padding: '32px 16px 80px',
        display: 'flex',
        flexDirection: 'column',
        gap: 48,
      }}
    >
      <header style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: '1.6rem' }}>Equation Step Engine</h1>
        <p style={{ fontSize: '.9rem', opacity: 0.65, marginTop: 4 }}>
          Give it the states — it infers and animates the steps in between.
          Each lesson below is one reproducible problem.
        </p>
      </header>

      {PROBLEMS.map((p) => (
        <section key={p.title}>
          <h2
            style={{
              fontSize: '1rem',
              marginBottom: 12,
              textAlign: 'center',
              opacity: 0.8,
            }}
          >
            {p.title}
          </h2>
          <EquationSteps states={p.states} />
        </section>
      ))}
    </main>
  );
}
