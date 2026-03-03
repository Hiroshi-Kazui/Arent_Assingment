import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

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

  // Floor を作成（B1F, 1F〜11F）
  const floors = [];

  // B1F（地下1階）
  const b1fFloor = await prisma.floor.upsert({
    where: { floor_id: '33333333-3333-3333-3333-333333333300' },
    update: {},
    create: {
      floor_id: '33333333-3333-3333-3333-333333333300',
      building_id: building.building_id,
      name: 'B1F',
      floor_number: -1,
    },
  });
  floors.push(b1fFloor);
  console.log(`✓ Floor created: ${b1fFloor.name}`);

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

  // Organization seeds
  const HQ_ORG_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const BRANCH_ORG_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

  const hqOrg = await prisma.organization.upsert({
    where: { organization_id: HQ_ORG_ID },
    update: {},
    create: {
      organization_id: HQ_ORG_ID,
      name: '本社',
      type: 'HEADQUARTERS',
    },
  });
  console.log(`✓ Organization created: ${hqOrg.name}`);

  const branchOrg = await prisma.organization.upsert({
    where: { organization_id: BRANCH_ORG_ID },
    update: {},
    create: {
      organization_id: BRANCH_ORG_ID,
      name: '東京支店',
      type: 'BRANCH',
      parent_id: HQ_ORG_ID,
    },
  });
  console.log(`✓ Organization created: ${branchOrg.name}`);

  // Users (password: "password123" for all)
  const passwordHash = await bcrypt.hash('password123', 10);

  const ADMIN_USER_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
  const SUPERVISOR_USER_ID = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
  const WORKER_USER_ID = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';

  await prisma.user.upsert({
    where: { user_id: ADMIN_USER_ID },
    update: {},
    create: {
      user_id: ADMIN_USER_ID,
      organization_id: HQ_ORG_ID,
      name: '管理者太郎',
      email: 'admin@example.com',
      password_hash: passwordHash,
      role: 'ADMIN',
    },
  });
  console.log('✓ User created: admin@example.com (ADMIN)');

  await prisma.user.upsert({
    where: { user_id: SUPERVISOR_USER_ID },
    update: {},
    create: {
      user_id: SUPERVISOR_USER_ID,
      organization_id: BRANCH_ORG_ID,
      name: '監督次郎',
      email: 'sup@example.com',
      password_hash: passwordHash,
      role: 'SUPERVISOR',
    },
  });
  console.log('✓ User created: sup@example.com (SUPERVISOR)');

  await prisma.user.upsert({
    where: { user_id: WORKER_USER_ID },
    update: {},
    create: {
      user_id: WORKER_USER_ID,
      organization_id: BRANCH_ORG_ID,
      name: '作業員三郎',
      email: 'worker@example.com',
      password_hash: passwordHash,
      role: 'WORKER',
    },
  });
  console.log('✓ User created: worker@example.com (WORKER)');

  // Update existing issues' reported_by to use the supervisor user
  await prisma.issue.updateMany({
    where: {},
    data: { reported_by: SUPERVISOR_USER_ID },
  });
  console.log('✓ Updated existing issues reported_by to supervisor user');

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
