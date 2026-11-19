// Services shown on the Vault's balance wall. In the live step these come
// from the Agentium Balance Tracker; the sample values below are made up.
// payUrl opens in a new tab so the HQ view stays where it was.

export const SERVICES = [
  { id: 'openai', service: 'OpenAI', currency: 'USD', payUrl: 'https://platform.openai.com/settings/organization/billing/overview', sample: { balance: 21.4, perDay: 3.1 } },
  { id: 'vultr', service: 'Vultr', currency: 'USD', payUrl: 'https://my.vultr.com/billing/', sample: { balance: 96.2, perDay: 1.6 } },
  { id: 'zadarma', service: 'Zadarma', currency: 'EUR', payUrl: 'https://my.zadarma.com/', sample: { balance: 9.6, perDay: 2.4 } },
  { id: 'anthropic', service: 'Anthropic', currency: 'USD', payUrl: 'https://console.anthropic.com/settings/billing', sample: { balance: 148.0, perDay: 5.2 } },
];
