import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');
  const BUILDING_ID = '11111111-1111-1111-1111-111111111111';
  const PROJECT_ID = '22222222-2222-2222-2222-222222222222';

  // Building を作成
  const building = await prisma.building.upsert({
    where: { building_id: BUILDING_ID },
    update: {
      name: 'Aビル',
      address: 'Tokyo, Japan',
      latitude: '35.6762',
      longitude: '139.7674',
      model_urn: process.env.APS_MODEL_URN || 'default-model-urn',
    },
    create: {
      building_id: BUILDING_ID,
      name: 'Aビル',
      address: 'Tokyo, Japan',
      latitude: '35.6762',
      longitude: '139.7674',
      model_urn: process.env.APS_MODEL_URN || 'default-model-urn',
    },
  });

  console.log(`✓ Building created: ${building.name}`);

  // Floor を作成（1F〜11F）
  const floors = [];
  for (let i = 1; i <= 11; i++) {
    const floorId = `33333333-3333-3333-3333-3333333333${String(i).padStart(2, '0')}`;
    const floor = await prisma.floor.upsert({
      where: { floor_id: floorId },
      update: {},
      create: {
        floor_id: floorId,
        building_id: building.building_id,
        name: `${i}F`,
        floor_number: i,
      },
    });
    floors.push(floor);
    console.log(`✓ Floor created: ${floor.name}`);
  }

  // Project を作成
  const now = new Date();
  const dueDate = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000); // 90日後

  const project = await prisma.project.upsert({
    where: { project_id: PROJECT_ID },
    update: {},
    create: {
      project_id: PROJECT_ID,
      building_id: building.building_id,
      name: 'Aビル新築工事',
      start_date: now,
      due_date: dueDate,
      status: 'ACTIVE',
    },
  });

  console.log(`✓ Project created: ${project.name}`);

  console.log('✅ Seeding completed successfully!');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Seeding failed:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
