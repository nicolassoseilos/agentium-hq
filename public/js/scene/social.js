// In-person small talk with the people on the rooftop (guests, the barman,
// the DJ). Visual-only for now; the agents' replies come from the data feed.
import { DRINKS } from './drinks.js';

const pick = (a) => a[Math.floor(Math.random() * a.length)];

const GUEST = [
  'The view up here never gets old.',
  'This set is so good tonight.',
  'Cheers, Nicolas! Thank you for having us.',
  'Have you tried the rosé? It’s from Limassol.',
  'I could stay by this pool all day.',
  'Your HQ is stunning. Who designed it?',
  'The sunset from here is unreal.',
  'Marco makes the best martini in Cyprus.',
];
const BARMAN = [
  'Of course, Mr. Nicolas. What can I get you?',
  'We have a lovely XO cognac tonight.',
  'The champagne is ice cold, just say the word.',
  'Anything for the boss.',
];
const DJ = [
  'Glad you’re enjoying it! The next one is a deep one.',
  'I’ll keep it smooth for you all night.',
  'Requests are welcome, boss.',
];

export function replyTo(person, text, { atBar } = {}) {
  const t = text.toLowerCase();
  if (person.kind === 'staff' && person.role === 'Barman') {
    const drink = Object.entries(DRINKS).find(([k, d]) => t.includes(k) || t.includes(d.name.toLowerCase()) || (k === 'gintonic' && t.includes('gin')));
    if (drink) return { text: atBar ? `One ${drink[1].name}, coming right up.` : `Take a seat at the bar and I’ll bring you a ${drink[1].name}.`, order: atBar ? drink[0] : null };
    if (t.includes('menu')) return { text: atBar ? 'Here you are.' : 'Sit at the bar and I’ll bring you the menu.', menu: atBar };
    return { text: pick(BARMAN) };
  }
  if (person.role === 'DJ') return { text: pick(DJ) };
  if (/hi|hello|hey|γεια/.test(t)) return { text: pick(['Hi Nicolas! 😊', 'Hey! Great party.', 'Hello! Lovely to see you up here.']) };
  if (t.includes('drink')) return { text: person.hasDrink ? 'I’m good, thank you! Cheers 🥂' : 'I’d love one, I’ll go see Marco.' , goBar: !person.hasDrink };
  if (t.includes('name')) return { text: `I’m ${person.name}.` };
  if (t.includes('music') || t.includes('dj')) return { text: 'The DJ is amazing tonight.' };
  return { text: pick(GUEST) };
}
