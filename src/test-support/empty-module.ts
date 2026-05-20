// Vitest aliases `server-only` to this file. The real `server-only`
// package throws when imported outside a React Server context, which
// breaks any unit test that imports a server module. This empty
// stand-in lets those modules load under test.
export {};
