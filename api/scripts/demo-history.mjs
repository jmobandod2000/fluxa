// Historial de demostración: turnos de los últimos días con horas pico, para ver reportes con datos.
// Uso (desde api/): node scripts/demo-history.mjs [días=14]
// Solo agrega datos ficticios; no modifica ni borra turnos existentes.
import { randomBytes } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';

const prisma = new PrismaClient();
const DAYS = Number(process.argv[2] ?? 14);
// Llegadas por hora (8:00–18:00) con picos al mediodía y al final de la tarde
const ARRIVALS = { 8: 3, 9: 5, 10: 8, 11: 12, 12: 10, 13: 6, 14: 5, 15: 6, 16: 9, 17: 11, 18: 4 };
const STAFF = ['Pedro Ruiz', 'Luisa Gómez'];

const random = (min, max) => min + Math.random() * (max - min);
const pick = (items, weights) => {
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = Math.random() * total;
  return items.find((_, index) => (roll -= weights[index]) < 0) ?? items[0];
};

const main = async () => {
  const sections = await prisma.section.findMany({ where: { isDeleted: false, isActive: true }, orderBy: { sortOrder: 'asc' } });
  const counters = await prisma.counter.findMany({ where: { isDeleted: false, isActive: true } });
  if (!sections.length || !counters.length) throw new Error('Primero configura secciones y puestos con el asistente.');

  const password = await argon2.hash(randomBytes(16).toString('hex'));
  const staff = [];
  for (const name of STAFF) {
    const email = `${name.split(' ')[0].toLowerCase()}@demo.fluxa`;
    staff.push(await prisma.user.upsert({ where: { email }, update: {}, create: { name, email, password } }));
  }

  let created = 0;
  for (let back = DAYS; back >= 1; back--) {
    const day = new Date();
    day.setDate(day.getDate() - back);
    const serviceDate = day.toLocaleDateString('en-CA');
    const numbers = new Map();
    const busy = day.getDay() === 6 ? 1.4 : day.getDay() === 0 ? 0.5 : 1;
    for (const [hour, base] of Object.entries(ARRIVALS)) {
      const count = Math.round(base * busy * random(0.7, 1.3));
      const peak = base >= 9;
      for (let i = 0; i < count; i++) {
        const section = pick(sections, sections.map((_, index) => [6, 3, 2][index] ?? 1));
        const number = (numbers.get(section.id) ?? 0) + 1;
        numbers.set(section.id, number);
        const createdAt = new Date(day.getFullYear(), day.getMonth(), day.getDate(), Number(hour), Math.floor(random(0, 60)));
        const status = pick(['DONE', 'NO_SHOW', 'CANCELLED'], [88, 7, 5]);
        const calledAt = status === 'CANCELLED' ? null : new Date(createdAt.getTime() + random(peak ? 8 : 2, peak ? 28 : 12) * 60_000);
        const finishedAt = calledAt ? new Date(calledAt.getTime() + random(3, 12) * 60_000) : new Date(createdAt.getTime() + random(5, 20) * 60_000);
        await prisma.turn.create({
          data: {
            number: 500 + number,
            code: `${section.prefix}-${String(500 + number).padStart(3, '0')}`,
            serviceDate,
            status,
            sectionId: section.id,
            counterId: calledAt ? counters[i % counters.length].id : null,
            calledById: calledAt ? staff[i % staff.length].id : null,
            publicToken: randomBytes(32).toString('base64url'),
            createdAt,
            calledAt,
            finishedAt,
          },
        });
        created++;
      }
    }
  }
  console.log(`Historial de demostración: ${created} turnos en ${DAYS} días.`);
};

main()
  .catch((error) => {
    console.error(error.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
