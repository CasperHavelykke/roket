// Engangs-script: fjern alle AdMob-/annoncestøttet-påstande fra
// privatlivspolitik + vilkår (×6 sprog) og bump datoerne.
// Node-script frem for Edit-værktøj — texts.ts har literal •-escapes.
const fs = require('fs');
const p = 'src/features/legal/texts.ts';
let s = fs.readFileSync(p, 'utf8');

// 1. Fjern alle linjer der nævner AdMob (bullets i indsamling +
// tredjepartslister, både privacy og terms)
const linesBefore = s.split('\n');
const lines = linesBefore.filter(l => !l.includes('AdMob'));
console.log('AdMob-linjer fjernet:', linesBefore.length - lines.length);
s = lines.join('\n');

// 2. "Annoncestøttet tjeneste" -> "gratis tjeneste" (×6 sprog, privacy+terms)
const phrases = [
  ['som en annoncestøttet tjeneste', 'som en gratis tjeneste'],
  ['as an Ad Supported service', 'as a free service'],
  ['como un servicio con publicidad', 'como un servicio gratuito'],
  ['als werbefinanzierter Dienst', 'als kostenloser Dienst'],
  ['en tant que service financé par la publicité', 'en tant que service gratuit'],
  ['como um serviço suportado por publicidade', 'como um serviço gratuito'],
];
for (const [from, to] of phrases) {
  const count = s.split(from).length - 1;
  console.log(`"${from.slice(0, 34)}...": ${count} erstattet`);
  s = s.split(from).join(to);
}

// 3. Datoer: politik 2026-07-13 -> 2026-07-20, vilkår 2026-02-27 -> 2026-07-20
const dates = [
  ['2026-07-13', '2026-07-20'],
  ['13.07.2026', '20.07.2026'],
  ['13/07/2026', '20/07/2026'],
  ['2026-02-27', '2026-07-20'],
  ['27.02.2026', '20.07.2026'],
  ['27/02/2026', '20/07/2026'],
];
for (const [from, to] of dates) {
  const count = s.split(from).length - 1;
  console.log(`dato ${from}: ${count} erstattet`);
  s = s.split(from).join(to);
}

fs.writeFileSync(p, s, 'utf8');
console.log('OK');
