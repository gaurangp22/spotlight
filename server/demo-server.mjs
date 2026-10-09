// Explicit local demo entry point; the normal API never starts simulated responders.
process.env.MARGIN_DEMO_BOTS = '1';
await import('./index.mjs');
