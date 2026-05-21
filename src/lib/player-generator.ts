import type { PlayerAttributes } from '@/db/schema/players';

type Position = 'GK' | 'DEF' | 'MID' | 'FWD';

export type GeneratedPlayer = {
  name: string;
  position: Position;
  baseOverall: number;
  age: number;
  peakAge: number;
  growthRate: number;
  declineRate: number;
  nationality: string;
  attributes: PlayerAttributes;
};

const FIRST_NAMES = [
  'Alex', 'Andriy', 'Carlos', 'Daniel', 'Diego', 'Eric', 'Felix', 'Hiroshi', 'Igor', 'James',
  'Jamal', 'Kai', 'Liam', 'Lukas', 'Marco', 'Mateo', 'Mehdi', 'Nikola', 'Oleh', 'Pablo',
  'Pavel', 'Pierre', 'Rafael', 'Sergio', 'Sofiane', 'Stefan', 'Takeshi', 'Thomas', 'Viktor', 'Yusuf',
  'Bruno', 'Henrik', 'Mateusz', 'Erik', 'Ousmane', 'Joaquin', 'Mohamed', 'Yannick', 'Petar', 'Adam',
];

const LAST_NAMES = [
  'Almeida', 'Bensaid', 'Berger', 'Costa', 'Dimitrov', 'Edwards', 'Fernandez', 'Garcia', 'Hansen',
  'Ivanov', 'Johansson', 'Kovalenko', 'Kaya', 'Larsen', 'Mendez', 'Moretti', 'Nakamura', 'Novak',
  'Petrov', 'Pereira', 'Romano', 'Rossi', 'Schmidt', 'Silva', 'Tanaka', 'Tymoshenko', 'Vasilenko',
  'Whitfield', 'Yamamoto', 'Zielinski', 'Bauer', 'Janssen', 'Lukic', 'Park', 'Diallo', 'Herrera',
  'Akhmetov', 'Vidic', 'Kessler', 'Sokolov',
];

const NATIONALITIES = ['UA', 'PL', 'DE', 'FR', 'ES', 'IT', 'EN', 'BR', 'AR', 'NL', 'PT', 'TR', 'JP', 'KR', 'MA', 'SN', 'BE', 'SE', 'NO', 'RS'];

const POSITION_WEIGHTS: { position: Position; weight: number }[] = [
  { position: 'GK', weight: 0.1 },
  { position: 'DEF', weight: 0.35 },
  { position: 'MID', weight: 0.35 },
  { position: 'FWD', weight: 0.2 },
];

function randomChoice<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

// Box-Muller for normal distribution
function randomNormal(mean: number, stdDev: number): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return z * stdDev + mean;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function pickPosition(): Position {
  const r = Math.random();
  let acc = 0;
  for (const { position, weight } of POSITION_WEIGHTS) {
    acc += weight;
    if (r < acc) return position;
  }
  return 'MID';
}

function attributesForPosition(position: Position, overall: number): PlayerAttributes {
  const noise = () => randomInt(-8, 8);
  switch (position) {
    case 'GK':
      return {
        attack: clamp(20 + noise(), 5, 40),
        defense: clamp(overall - 15 + noise(), 30, 90),
        speed: clamp(overall - 10 + noise(), 40, 80),
        goalkeeping: clamp(overall + noise(), 50, 99),
      };
    case 'DEF':
      return {
        attack: clamp(overall - 25 + noise(), 25, 75),
        defense: clamp(overall + noise(), 50, 99),
        speed: clamp(overall - 10 + noise(), 50, 95),
        goalkeeping: clamp(10 + noise(), 1, 20),
      };
    case 'MID':
      return {
        attack: clamp(overall - 5 + noise(), 45, 95),
        defense: clamp(overall - 5 + noise(), 45, 95),
        speed: clamp(overall + noise(), 50, 99),
        goalkeeping: clamp(10 + noise(), 1, 20),
      };
    case 'FWD':
      return {
        attack: clamp(overall + noise(), 55, 99),
        defense: clamp(overall - 30 + noise(), 15, 60),
        speed: clamp(overall + noise(), 55, 99),
        goalkeeping: clamp(10 + noise(), 1, 20),
      };
  }
}

export function generatePlayerTemplate(): GeneratedPlayer {
  const name = `${randomChoice(FIRST_NAMES)} ${randomChoice(LAST_NAMES)}`;
  const position = pickPosition();
  const nationality = randomChoice(NATIONALITIES);
  const age = clamp(Math.round(randomNormal(25, 4)), 18, 35);
  const peakAge = randomInt(24, 28);
  const baseOverall = clamp(Math.round(randomNormal(72, 7)), 55, 92);

  // Younger players get higher growth, older lower
  const youthFactor = (peakAge - age) / 6;
  const growthRate = clamp(randomFloat(0.0, 2.5) + youthFactor * 0.5, -0.5, 2.5);
  const declineRate = clamp(randomFloat(-2.0, -0.5), -2.0, -0.5);

  return {
    name,
    position,
    baseOverall,
    age,
    peakAge,
    growthRate: Math.round(growthRate * 10) / 10,
    declineRate: Math.round(declineRate * 10) / 10,
    nationality,
    attributes: attributesForPosition(position, baseOverall),
  };
}

export function generatePlayerTemplates(count: number): GeneratedPlayer[] {
  return Array.from({ length: count }, () => generatePlayerTemplate());
}
