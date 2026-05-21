import { db } from '../src/db/client';
import { playerTemplates, type PlayerAttributes } from '../src/db/schema/players';

type SeedPlayer = {
  name: string;
  position: 'GK' | 'DEF' | 'MID' | 'FWD';
  baseOverall: number;
  age: number;
  peakAge: number;
  growthRate: number;
  declineRate: number;
  nationality: string;
  attributes: PlayerAttributes;
};

const seedPlayers: SeedPlayer[] = [
  // Goalkeepers
  {
    name: 'Marco Rossi',
    position: 'GK',
    baseOverall: 82,
    age: 27,
    peakAge: 28,
    growthRate: 0.5,
    declineRate: -1.2,
    nationality: 'IT',
    attributes: { attack: 20, defense: 70, speed: 55, goalkeeping: 86 },
  },
  {
    name: 'Lukas Berger',
    position: 'GK',
    baseOverall: 74,
    age: 21,
    peakAge: 27,
    growthRate: 2.1,
    declineRate: -1.0,
    nationality: 'DE',
    attributes: { attack: 15, defense: 65, speed: 60, goalkeeping: 78 },
  },

  // Defenders
  {
    name: 'James Whitfield',
    position: 'DEF',
    baseOverall: 80,
    age: 29,
    peakAge: 28,
    growthRate: 0.2,
    declineRate: -1.5,
    nationality: 'EN',
    attributes: { attack: 45, defense: 84, speed: 72, goalkeeping: 10 },
  },
  {
    name: 'Sofiane Bensaid',
    position: 'DEF',
    baseOverall: 71,
    age: 19,
    peakAge: 26,
    growthRate: 2.4,
    declineRate: -1.0,
    nationality: 'FR',
    attributes: { attack: 50, defense: 73, speed: 80, goalkeeping: 10 },
  },
  {
    name: 'Yusuf Kaya',
    position: 'DEF',
    baseOverall: 78,
    age: 25,
    peakAge: 27,
    growthRate: 1.0,
    declineRate: -1.3,
    nationality: 'TR',
    attributes: { attack: 55, defense: 80, speed: 68, goalkeeping: 10 },
  },

  // Midfielders
  {
    name: 'Andriy Kovalenko',
    position: 'MID',
    baseOverall: 85,
    age: 26,
    peakAge: 27,
    growthRate: 0.8,
    declineRate: -1.4,
    nationality: 'UA',
    attributes: { attack: 78, defense: 72, speed: 79, goalkeeping: 10 },
  },
  {
    name: 'Pablo Herrera',
    position: 'MID',
    baseOverall: 73,
    age: 20,
    peakAge: 25,
    growthRate: 2.2,
    declineRate: -1.1,
    nationality: 'ES',
    attributes: { attack: 75, defense: 65, speed: 76, goalkeeping: 10 },
  },
  {
    name: 'Hiroshi Tanaka',
    position: 'MID',
    baseOverall: 77,
    age: 31,
    peakAge: 28,
    growthRate: 0.0,
    declineRate: -1.8,
    nationality: 'JP',
    attributes: { attack: 72, defense: 75, speed: 70, goalkeeping: 10 },
  },

  // Forwards
  {
    name: 'Eric Almeida',
    position: 'FWD',
    baseOverall: 88,
    age: 28,
    peakAge: 28,
    growthRate: 0.3,
    declineRate: -1.6,
    nationality: 'BR',
    attributes: { attack: 90, defense: 35, speed: 88, goalkeeping: 10 },
  },
  {
    name: 'Oleh Tymoshenko',
    position: 'FWD',
    baseOverall: 70,
    age: 18,
    peakAge: 26,
    growthRate: 2.5,
    declineRate: -1.2,
    nationality: 'UA',
    attributes: { attack: 75, defense: 30, speed: 85, goalkeeping: 10 },
  },
];

async function main() {
  console.log(`Seeding ${seedPlayers.length} player templates...`);

  const inserted = await db
    .insert(playerTemplates)
    .values(
      seedPlayers.map((p) => ({
        name: p.name,
        position: p.position,
        baseOverall: p.baseOverall,
        age: p.age,
        peakAge: p.peakAge,
        growthRate: p.growthRate,
        declineRate: p.declineRate,
        nationality: p.nationality,
        attributes: p.attributes,
      })),
    )
    .returning({ id: playerTemplates.id, name: playerTemplates.name });

  console.log(`Inserted ${inserted.length} players:`);
  for (const p of inserted) {
    console.log(`  ${p.id}  ${p.name}`);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
