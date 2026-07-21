import { electronsPerShell } from './scripts/electron-configuration.ts';
const cases = [
  ['Cr', '[Ar] 3d⁵ 4s¹', ['2','8','13','1']],
  ['Cu', '[Ar] 3d¹⁰ 4s¹', ['2','8','18','1']],
  ['Fe', '[Ar] 3d⁶ 4s²', ['2','8','14','2']],
  ['O',  '[He] 2s² 2p⁴', ['2','6']],
  ['H',  '1s¹', ['1']],
];
for (const [sym, input, expected] of cases) {
  const got = electronsPerShell(input);
  const ok = JSON.stringify(got) === JSON.stringify(expected);
  console.log(`${ok?'OK  ':'FAIL'} ${sym.padEnd(3)} ${input.padEnd(15)} -> [${got}]  expected [${expected}]`);
}
