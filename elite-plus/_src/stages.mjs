// Generates the hair-loss stage illustrations used in the assessment (top view of the head, face at the top).
// Norwood 1–7 for men, Ludwig I–III for women. Simplified, for self-assessment only; the doctor confirms the stage.
import fs from 'node:fs';
const dir = new URL('../assets/img/stages/', import.meta.url);
fs.mkdirSync(dir, { recursive: true });
const SKIN = '#F2D4BD', HAIR = '#6B4A34', LINE = '#073251';
const head = (inner, mask = '') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 140" role="img">
<defs><clipPath id="h"><ellipse cx="60" cy="74" rx="44" ry="58"/></clipPath>${mask}</defs>
<ellipse cx="60" cy="10" rx="10" ry="6" fill="${SKIN}" stroke="${LINE}" stroke-width="1.5"/>
<ellipse cx="15" cy="78" rx="5" ry="11" fill="${SKIN}" stroke="${LINE}" stroke-width="1.5"/><ellipse cx="105" cy="78" rx="5" ry="11" fill="${SKIN}" stroke="${LINE}" stroke-width="1.5"/>
<ellipse cx="60" cy="74" rx="44" ry="58" fill="${SKIN}"/>
<g clip-path="url(#h)">${inner}</g>
<ellipse cx="60" cy="74" rx="44" ry="58" fill="none" stroke="${LINE}" stroke-width="2"/></svg>\n`;
// Hair = the whole scalp minus bald shapes (drawn as a mask).
const norwood = (bald) => head(`<rect x="0" y="0" width="120" height="140" fill="${HAIR}" mask="url(#m)"/>`,
  `<mask id="m"><rect x="0" y="0" width="120" height="140" fill="#fff"/><rect x="0" y="0" width="120" height="20" fill="#000"/>${bald}</mask>`);
const B = (s) => s.replace(/<(ellipse|circle|path)/g, '<$1 fill="#000"');
const stagesM = {
  1: '',
  2: B('<ellipse cx="34" cy="24" rx="10" ry="9"/><ellipse cx="86" cy="24" rx="10" ry="9"/>'),
  3: B('<ellipse cx="32" cy="30" rx="15" ry="15"/><ellipse cx="88" cy="30" rx="15" ry="15"/><ellipse cx="60" cy="22" rx="30" ry="6"/>'),
  4: B('<ellipse cx="60" cy="30" rx="32" ry="17"/><circle cx="60" cy="96" r="13"/>'),
  5: B('<ellipse cx="60" cy="38" rx="36" ry="24"/><circle cx="60" cy="94" r="20"/>'),
  6: B('<ellipse cx="60" cy="62" rx="36" ry="48"/>'),
  7: B('<ellipse cx="60" cy="60" rx="41" ry="54"/>'),
};
for (const [n, bald] of Object.entries(stagesM)) fs.writeFileSync(new URL(`norwood-${n}.svg`, dir), norwood(bald));
// Ludwig: frontal hairline kept, thinning spreads from the parting across the crown.
const ludwig = (thin) => head(`<rect x="0" y="0" width="120" height="140" fill="${HAIR}"/><rect x="0" y="0" width="120" height="18" fill="${SKIN}"/>${thin}`);
const stagesF = {
  1: `<rect x="58" y="22" width="4" height="96" fill="${SKIN}"/><ellipse cx="60" cy="66" rx="10" ry="34" fill="${SKIN}" opacity=".35"/>`,
  2: `<rect x="57" y="22" width="6" height="96" fill="${SKIN}"/><ellipse cx="60" cy="66" rx="20" ry="42" fill="${SKIN}" opacity=".55"/>`,
  3: `<ellipse cx="60" cy="66" rx="32" ry="48" fill="${SKIN}" opacity=".85"/>`,
};
for (const [n, thin] of Object.entries(stagesF)) fs.writeFileSync(new URL(`ludwig-${n}.svg`, dir), ludwig(thin));
console.log('stage illustrations written');
