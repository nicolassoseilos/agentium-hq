// The one place the visuals get their data from.
//
// LIVE (since 19 Nov 2026): the login gate loads live/hq-live.js before this bundle starts; it sets
// window.AHQ_LIVE, and createSource() then returns its feed -- real data only (the six agents' live notes,
// test counts, team chat, CEO desk, planning, project files, Claude usage and real balances, read from the
// database with Nicolas's balance-page login). The live module is owned by the team-build session; the
// looks stay with the design session.
// SAMPLE: the local preview server (npm run dev) does not load the live module, so it keeps the scripted
// SampleFeed for working on the looks.
//
// Interface every feed implements:
//   get()                 -> current state (see sample.js for the shape; the live feed adds testsByDept,
//                            claudeUsage, files and agents[id].note/task/step/of/dept/rank)
//   subscribe(fn)         -> called with the state whenever it changes
//   tick(dt)              -> advance (sample) or no-op (live, which polls)
//   act(type, payload)    -> 'decide' {id, verdict}, 'readDoc' {id},
//                            'readChat' {agent}, 'sendChat' {agent, text},
//                            'topupOpened' {id}
//   isTyping(agent)       -> true while an agent is writing a reply
//   replyHandler(agent, text, deliver, inPerson) -> set by the scene so the
//                            agent visibly uses their phone before `deliver()`
import { SampleFeed } from './sample.js';
import { derive } from './derive.js';

export function createSource() {
  const live = typeof window !== 'undefined' ? window.AHQ_LIVE : null;
  if (live && typeof live.createFeed === 'function') {
    try {
      return live.createFeed({ derive });
    } catch (e) {
      console.error('HQ live data failed to start:', e);
    }
  }
  return new SampleFeed();
}
