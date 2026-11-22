import { useEffect } from 'react';
import { FOOTER_TEXT } from './config';
import { dataErrors, framework } from './data';
import { paths, useRoute, type AssessmentScreen } from './router';
import { useStore } from './store';
import { NAV, STRINGS } from './strings';
import { HatchDefs } from './components/HatchDefs';
import { Home } from './screens/Home';
import { FrameworkScreen } from './screens/Framework';
import { Placeholder } from './screens/Placeholder';
import { Workspace } from './screens/Workspace/Workspace';
import styles from './App.module.css';

const SCREEN_ORDER: AssessmentScreen[] = ['workspace', 'profile', 'strategy', 'reconcile', 'report'];

export default function App() {
  const route = useRoute();
  const hydrate = useStore((s) => s.hydrate);
  const assessments = useStore((s) => s.assessments);
  const ready = useStore((s) => s.ready);
  const setCurrent = useStore((s) => s.setCurrentAssessmentId);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  const routeId = route.name === 'assessment' ? route.id : null;
  useEffect(() => {
    setCurrent(routeId);
  }, [routeId, setCurrent]);

  const current = routeId ? assessments[routeId] : undefined;
  const link = (href: string, label: string, active: boolean) => (
    <a key={href} href={href} className={active ? styles.active : undefined} aria-current={active ? 'page' : undefined}>
      {label}
    </a>
  );

  let page;
  if (dataErrors.length > 0 && framework.domains.length === 0) {
    page = null;
  } else if (route.name === 'home') page = <Home />;
  else if (route.name === 'framework') page = <FrameworkScreen />;
  else if (route.name === 'compare') page = <Placeholder title={NAV.compare} />;
  else if (route.name === 'assessment') {
    if (!current) page = ready ? <p>Assessment not found. <a href={paths.home()}>Back to Home</a>.</p> : null;
    else if (route.screen === 'workspace') page = <Workspace key={current.id} assessmentId={current.id} />;
    else page = <Placeholder title={`${NAV[route.screen]}: ${current.country}`} />;
  } else page = <p>Page not found. <a href={paths.home()}>Back to Home</a>.</p>;

  const routeKey = route.name === 'assessment' ? `${route.id}/${route.screen}` : route.name;

  return (
    <div className={styles.shell}>
      <HatchDefs />
      <a className={styles.skip} href="#main">Skip to content</a>
      <nav className={styles.rail} aria-label="Main">
        <div className={styles.brand}>{STRINGS.appName}</div>
        <div className={styles.links}>
          {link(paths.home(), NAV.home, route.name === 'home')}
          {link(paths.framework(), NAV.framework, route.name === 'framework')}
          {link(paths.compare(), NAV.compare, route.name === 'compare')}
        </div>
        {current && route.name === 'assessment' && (
          <div className={styles.group} role="group" aria-label={`${current.country} ${current.asOf}`}>
            <div className={styles.groupTitle}>
              {current.country} <span>{current.asOf}</span>
            </div>
            <div className={styles.links}>
              {SCREEN_ORDER.map((s) => link(paths.assessment(current.id, s), NAV[s], route.screen === s))}
            </div>
          </div>
        )}
      </nav>
      <main id="main" className={styles.main} tabIndex={-1}>
        {dataErrors.length > 0 && (
          <div className={styles.errors} role="alert">
            <strong>Some bundled data files could not be loaded.</strong>
            <ul>{dataErrors.map((e, i) => <li key={i}>{e}</li>)}</ul>
          </div>
        )}
        <div key={routeKey} className={styles.fade}>{page}</div>
      </main>
      <footer className={styles.footer}>
        <div>{FOOTER_TEXT}</div>
        <div>Framework {framework.version}: {framework.status}</div>
      </footer>
    </div>
  );
}
