import { useEffect, useState } from 'react';
import AgendaView from './components/AgendaView';
import NotesView from './components/NotesView';
import { useAgenda } from './hooks/useAgenda';
import { useNotebook } from './hooks/useNotebook';
import { getNyParts } from './lib/time';
import './App.css';

/*
 * v30: Manuel OS = Agenda + Notes. Daily checklist, streaks and progress
 * tracking live in the separate Transform app.
 */
const NAV = [
  { id: 'agenda', label: 'Agenda', icon: '☰' },
  { id: 'notes', label: 'Notes', icon: '✎' },
];

/** New York date key, refreshed when the app comes back (it can sit in memory overnight). */
function useTodayKey() {
  const [key, setKey] = useState(() => getNyParts().dateKey);
  useEffect(() => {
    const tick = () => setKey((prev) => {
      const next = getNyParts().dateKey;
      return next === prev ? prev : next;
    });
    const id = setInterval(tick, 30000);
    const onVis = () => document.visibilityState === 'visible' && tick();
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', tick);
    window.addEventListener('pageshow', tick);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('focus', tick);
      window.removeEventListener('pageshow', tick);
    };
  }, []);
  return key;
}

export default function App() {
  const todayKey = useTodayKey();
  const notebook = useNotebook();
  const agenda = useAgenda(todayKey);
  const [tab, setTab] = useState('agenda');
  const [focusComposer, setFocusComposer] = useState(false);

  useEffect(() => {
    if (tab !== 'agenda') setFocusComposer(false);
  }, [tab]);

  return (
    <div className={`mos-shell tab-${tab}`}>
      <div className="mos-frame">
        <main className="mos-main">
          {tab === 'notes' && <NotesView notebook={notebook} />}
          {tab === 'agenda' && (
            <AgendaView
              todayKey={todayKey}
              overdue={agenda.overdue}
              counts={agenda.counts}
              itemsForDate={agenda.itemsForDate}
              itemsForWeekDay={agenda.itemsForWeekDay}
              monthQueue={agenda.monthQueue}
              add={agenda.add}
              toggle={agenda.toggle}
              remove={agenda.remove}
              restore={agenda.restore}
              getItem={agenda.getItem}
              rename={agenda.rename}
              setDue={agenda.setDue}
              setPeriod={agenda.setPeriod}
              setOrders={agenda.setOrders}
              focusComposer={focusComposer}
            />
          )}
        </main>
      </div>

      <nav className="bottom-nav tabs-2 tiimo-nav" aria-label="Main">
        {NAV.map((n) => (
          <button
            key={n.id}
            type="button"
            className={tab === n.id ? 'active' : ''}
            onClick={() => setTab(n.id)}
          >
            <span className="nav-icon" aria-hidden="true">
              {n.icon}
            </span>
            <span className="nav-label">
              {n.label}
              {n.id === 'agenda' && agenda.tended ? (
                <span className="nav-check" aria-label="completed">
                  {' '}
                  ✓
                </span>
              ) : null}
            </span>
          </button>
        ))}
      </nav>
    </div>
  );
}
