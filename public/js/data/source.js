// The one place the visuals get their data from.
//
// Today: SampleFeed (scripted activity). Later step: a LiveFeed that reads
// GET /api/state (status files, sessions, balance tracker) and sends actions
// with POST /api/act — same interface, so nothing in the 3D scene changes.
//
// Interface every feed implements:
//   get()                 -> current state (see sample.js for the shape)
//   subscribe(fn)         -> called with the state whenever it changes
//   tick(dt)              -> advance (sample) or no-op (live, which polls)
//   act(type, payload)    -> 'decide' {id, verdict}, 'readDoc' {id},
//                            'readChat' {agent}, 'sendChat' {agent, text},
//                            'topupOpened' {id}
import { SampleFeed } from './sample.js';

export function createSource() {
  return new SampleFeed();
}
