// Global kø for onboarding-modals/-prompts: iOS kan kun præsentere ÉN
// modal ad gangen, og to samtidige (eller præsentation midt i en andens
// dismiss) efterlader en usynlig, touch-ædende modal-window. Set live på
// frisk iOS-installation: login overlever i keychain men AsyncStorage
// ryddes, så lokations-disclosuren (MapHome) og notifikations-disclosuren
// (App.tsx) fyrede samtidig → frossen app indtil force-quit.
//
// Brug: pak hele sekvensen (disclosure-modal + efterfølgende native
// permission-prompt) i ét enqueueModal-kald. Opgaverne kører i
// ankomst-rækkefølge med en pause imellem, så iOS' dismiss-animation
// er helt færdig før næste præsentation.
const PRESENTATION_GAP_MS = 350;

let chain: Promise<void> = Promise.resolve();

export function enqueueModal<T>(task: () => Promise<T>): Promise<T> {
  const run = chain.then(task);
  // Kæden fortsætter uanset om opgaven fejler — en fejlet opgave må
  // aldrig blokere alle fremtidige modals
  chain = run.then(
    () => new Promise<void>(resolve => setTimeout(resolve, PRESENTATION_GAP_MS)),
    () => new Promise<void>(resolve => setTimeout(resolve, PRESENTATION_GAP_MS)),
  );
  return run;
}
