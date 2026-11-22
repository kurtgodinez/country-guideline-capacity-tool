import { FOOTER_TEXT } from './config';
import { STRINGS } from './strings';

export default function App() {
  return (
    <div className="app-shell">
      <main>
        <h1>{STRINGS.appName}</h1>
      </main>
      <footer className="app-footer">{FOOTER_TEXT}</footer>
    </div>
  );
}
