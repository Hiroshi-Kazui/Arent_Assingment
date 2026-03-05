import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { existsSync, readFileSync } from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');
  const BUILDING_ID = '11111111-1111-1111-1111-111111111111';
  const PROJECT_ID = '22222222-2222-2222-2222-222222222222';
  const HQ_ORG_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const BRANCH_ORG_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

  // Organization seeds (must come before Building/Project due to FK)
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

  // Building を作成
  const building = await prisma.building.upsert({
    where: { building_id: BUILDING_ID },
    update: {
      name: 'Aビル',
      address: 'Tokyo, Japan',
      latitude: '35.6762',
      longitude: '139.7674',
      model_urn: process.env.APS_MODEL_URN || 'default-model-urn',
      branch_id: BRANCH_ORG_ID,
    },
    create: {
      building_id: BUILDING_ID,
      name: 'Aビル',
      address: 'Tokyo, Japan',
      latitude: '35.6762',
      longitude: '139.7674',
      model_urn: process.env.APS_MODEL_URN || 'default-model-urn',
      branch_id: BRANCH_ORG_ID,
    },
  });

  console.log(`✓ Building created: ${building.name}`);

  // Floor は Viewer 起動時に APS Model Derivative API から自動同期される
  // seed では作成しない（sync-levels API で正確な Level 名と elevation が投入される）
  console.log('ℹ Floors: skipped (auto-synced from APS metadata on first viewer load)');

  // Project を作成
  const now = new Date();
  const dueDate = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000); // 90日後

  const project = await prisma.project.upsert({
    where: { project_id: PROJECT_ID },
    update: {
      branch_id: BRANCH_ORG_ID,
      plan: '新築工事計画',
    },
    create: {
      project_id: PROJECT_ID,
      building_id: building.building_id,
      name: 'Aビル新築工事',
      start_date: now,
      due_date: dueDate,
      status: 'ACTIVE',
      branch_id: BRANCH_ORG_ID,
      plan: '新築工事計画',
    },
  });

  console.log(`✓ Project created: ${project.name}`);

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

  // floors.csv が存在する場合はインポート
  const floorsCsvPath = path.join(process.cwd(), 'prisma', 'seeds', 'floors.csv');
  if (existsSync(floorsCsvPath)) {
    const rows = parseCSV(readFileSync(floorsCsvPath, 'utf-8'));
    for (const row of rows) {
      if (!row.floor_id) continue;
      await prisma.floor.upsert({
        where: { floor_id: row.floor_id },
        update: {
          name: row.name,
          floor_number: parseInt(row.floor_number),
          elevation: row.elevation ? parseFloat(row.elevation) : null,
        },
        create: {
          floor_id: row.floor_id,
          building_id: row.building_id,
          name: row.name,
          floor_number: parseInt(row.floor_number),
          elevation: row.elevation ? parseFloat(row.elevation) : null,
        },
      });
    }
    console.log(`✓ Floors imported from CSV: ${rows.length} rows`);
  } else {
    console.log('ℹ floors.csv not found, skipping floor seed (auto-synced from APS on first viewer load)');
  }

  // element_floor_mapping.csv が存在する場合はインポート
  const mappingCsvPath = path.join(process.cwd(), 'prisma', 'seeds', 'element_floor_mapping.csv');
  if (existsSync(mappingCsvPath)) {
    const rows = parseCSV(readFileSync(mappingCsvPath, 'utf-8'));
    for (const row of rows) {
      if (!row.building_id || !row.db_id || !row.floor_id) continue;
      await prisma.elementFloorMapping.upsert({
        where: { building_id_db_id: { building_id: row.building_id, db_id: parseInt(row.db_id) } },
        update: {
          floor_id: row.floor_id,
          bounding_box_min_z: row.bounding_box_min_z ? parseFloat(row.bounding_box_min_z) : null,
        },
        create: {
          building_id: row.building_id,
          db_id: parseInt(row.db_id),
          floor_id: row.floor_id,
          bounding_box_min_z: row.bounding_box_min_z ? parseFloat(row.bounding_box_min_z) : null,
        },
      });
    }
    console.log(`✓ ElementFloorMappings imported from CSV: ${rows.length} rows`);
  } else {
    console.log('ℹ element_floor_mapping.csv not found, skipping mapping seed (auto-generated on first viewer load)');
  }

  console.log('✅ Seeding completed successfully!');
}

function parseCSV(content: string): Record<string, string>[] {
  const [headerLine, ...lines] = content.trim().split('\n');
  const headers = headerLine.split(',').map((h) => h.trim());
  return lines
    .filter((l) => l.trim())
    .map((line) => {
      const values = line.split(',');
      return Object.fromEntries(headers.map((h, i) => [h, (values[i] ?? '').trim()]));
    });
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
