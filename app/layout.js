import './globals.css';

export const metadata = {
  title: 'Equation Step Engine',
  description:
    'Give it the states — it infers and animates the steps in between. Reusable Next.js component.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
