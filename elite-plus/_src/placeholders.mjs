// Generates brand-coloured placeholder artwork (replaced by real photography before launch) and the favicon.
import fs from 'node:fs';
const dir = new URL('../assets/img/', import.meta.url);
fs.mkdirSync(dir, { recursive: true });
function star(R = 48, r = 25, inner = 9.5) {
  const p = [];
  for (let k = 0; k < 8; k++) {
    const a = ((-90 + 45 * k) * Math.PI) / 180, rr = k % 2 ? r : R;
    p.push([rr * Math.cos(a), rr * Math.sin(a)]);
    const b = ((-90 + 45 * k + 22.5) * Math.PI) / 180;
    p.push([inner * Math.cos(b), inner * Math.sin(b)]);
  }
  return 'M' + p.map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`).join('L') + 'Z';
}
const S = star(), IN = 'M0 -20L5 -5L20 0L5 5L0 20L-5 5L-20 0L-5 -5Z';
const palettes = [['#FBE7D3', '#F7F1EB', '#E9EEF2'], ['#E8EEF3', '#F7F3EE', '#FCE3C4'], ['#F9EBDD', '#FFFFFF', '#F2E2CF'], ['#EDF1F4', '#FBF4EC', '#F5D9B8']];
palettes.forEach(([a, b, c], i) => {
  fs.writeFileSync(new URL(`ph-service-${i + 1}.svg`, dir), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset=".55" stop-color="${b}"/><stop offset="1" stop-color="${c}"/></linearGradient></defs><rect width="800" height="600" fill="url(#g)"/><path d="M0 0L${260 + i * 60} 0L0 ${420 - i * 30}Z" fill="#fff" opacity=".35"/><g transform="translate(${560 - i * 40} ${330 + i * 10}) rotate(${i * 11}) scale(${3.2 + i * .3})" opacity=".22"><path d="${S}" fill="none" stroke="#F59345" stroke-width="2" stroke-linejoin="round"/></g></svg>\n`);
});
const person = (fill) => `<circle cx="400" cy="230" r="80" fill="${fill}"/><path d="M230 600c0-110 76-190 170-190s170 80 170 190z" fill="${fill}"/>`;
fs.writeFileSync(new URL('ph-before.svg', dir), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600"><rect width="800" height="600" fill="#E3E8EC"/>${person('#C9D2DA')}</svg>\n`);
fs.writeFileSync(new URL('ph-after.svg', dir), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600"><rect width="800" height="600" fill="#FBEBDB"/>${person('#F2CFA8')}</svg>\n`);
fs.writeFileSync(new URL('ph-doctor.svg', dir), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 750" preserveAspectRatio="xMidYMid slice"><rect width="600" height="750" fill="#EEF1F4"/><circle cx="300" cy="290" r="110" fill="#D5DDE4"/><path d="M90 750c0-150 94-250 210-250s210 100 210 250z" fill="#D5DDE4"/><path d="M250 520l50 70 50-70" fill="none" stroke="#fff" stroke-width="10"/></svg>\n`);
console.log('placeholders written');
