import { pick, type Rng } from './random';

export const KICKOFF = (home: string, away: string) =>
  `Свисток на матч! ${home} принимает ${away}.`;

export const HALFTIME = (homeScore: number, awayScore: number, home: string, away: string) =>
  `Перерыв. ${home} ${homeScore} : ${awayScore} ${away}.`;

export const FULLTIME = (homeScore: number, awayScore: number, home: string, away: string) =>
  `Финальный свисток. ${home} ${homeScore} : ${awayScore} ${away}.`;

export function chanceText(rand: Rng, attackerName: string): string {
  return pick(rand, [
    `${attackerName} прорывается к воротам`,
    `${attackerName} получает мяч в опасной зоне`,
    `${attackerName} обыгрывает защитника и выходит на удар`,
    `Острая атака — ${attackerName} в штрафной`,
    `${attackerName} замыкает прострел в штрафной`,
  ]);
}

export function goalText(rand: Rng, scorer: string, gk: string): string {
  return pick(rand, [
    `ГООООЛ! ${scorer} пробивает ${gk}!`,
    `${scorer} забивает! ${gk} бессилен.`,
    `Точный удар от ${scorer} — мяч в сетке!`,
    `${scorer} реализует момент! Гол.`,
  ]);
}

export function saveText(rand: Rng, attacker: string, gk: string): string {
  return pick(rand, [
    `${gk} тащит удар от ${attacker}!`,
    `${gk} в прыжке отражает мяч от ${attacker}.`,
    `${attacker} бьёт — но ${gk} уверенно ловит.`,
    `${attacker} промахивается мимо створки`,
  ]);
}

export function foulText(rand: Rng, fouler: string): string {
  return pick(rand, [
    `Фол. ${fouler} нарушает правила.`,
    `${fouler} жёстко вступает в борьбу.`,
    `Свисток арбитра — фол со стороны ${fouler}.`,
  ]);
}

export function yellowText(playerName: string): string {
  return `Жёлтая карточка — ${playerName}.`;
}

export function redText(playerName: string): string {
  return `Красная карточка! ${playerName} удалён с поля.`;
}

export function cornerText(rand: Rng, team: string): string {
  return pick(rand, [`Угловой у ворот ${team}.`, `${team} зарабатывает корнер.`]);
}

export function keyPassText(rand: Rng, passer: string, receiver: string): string {
  return pick(rand, [
    `${passer} отдаёт классную передачу на ${receiver}.`,
    `${passer} находит ${receiver} разрезающим пасом.`,
    `Игра в касание — ${passer} → ${receiver}.`,
  ]);
}

export function subText(out: string, inn: string): string {
  return `Замена: ${out} → ${inn}.`;
}

export function injuryText(rand: Rng, name: string): string {
  return pick(rand, [
    `${name} остаётся лежать на газоне.`,
    `${name} получает повреждение в стыке.`,
  ]);
}
