#!/usr/bin/env node
// Temporary investigation script for Group → Tag migration
// Usage: DATABASE_URL=postgres://... node investigateGroupToTagMigration.js

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function investigate() {
  try {
    // Find Fortnoto project
    const fortnoto = await prisma.project.findFirst({
      where: { title: 'Fortnoto' },
      include: {
        groups: { include: { tasks: true } },
        tags: { include: { tasks: { include: { task: { select: { id: true } } } } } },
        tasks: { select: { id: true, groupId: true, title: true } }
      }
    });

    if (!fortnoto) {
      console.log('❌ Fortnoto project not found');
      process.exit(1);
    }

    console.log('\n=== FORTNOTO GROUP → TAG MIGRATION INVESTIGATION ===\n');
    console.log(`Project: ${fortnoto.title} (${fortnoto.id})`);
    console.log(`Owner: ${fortnoto.ownerId}`);

    // Report groups
    console.log(`\n📋 GROUPS (${fortnoto.groups.length} total):`);
    fortnoto.groups.forEach(group => {
      const taskCount = group.tasks.length;
      console.log(`  • "${group.title}" (${group.id}): ${taskCount} tasks${group.deletedAt ? ' [SOFT-DELETED]' : ''}`);
    });

    // Report tasks with no group
    const tasksWithNoGroup = fortnoto.tasks.filter(t => !t.groupId);
    if (tasksWithNoGroup.length > 0) {
      console.log(`\n⚠️  UNGROUPED TASKS (${tasksWithNoGroup.length}):`);
      console.log(`  ${tasksWithNoGroup.length} tasks have no group assignment`);
    }

    // Report existing tags
    console.log(`\n🏷️  EXISTING TAGS (${fortnoto.tags.length} total):`);
    fortnoto.tags.forEach(tag => {
      const taskCount = tag.tasks.length;
      console.log(`  • "${tag.name}" (${tag.id}): ${taskCount} tasks${tag.deletedAt ? ' [SOFT-DELETED]' : ''}`);
    });

    // Propose mapping
    console.log(`\n📍 PROPOSED GROUP → TAG MAPPING:`);
    const groupToTagMap = {};
    const tagNameSet = new Set(fortnoto.tags.map(t => t.name));

    fortnoto.groups.forEach(group => {
      const tagName = group.title;
      const tagExists = tagNameSet.has(tagName);
      groupToTagMap[group.title] = {
        groupId: group.id,
        taskCount: group.tasks.length,
        tagExists,
        tagName
      };

      const status = tagExists ? '(EXISTS)' : '(will create)';
      console.log(`  Group "${group.title}" → Tag "${tagName}" ${status}`);
    });

    // Check for collisions
    console.log(`\n🔍 COLLISION ANALYSIS:`);
    let hasCollisions = false;
    fortnoto.groups.forEach(group => {
      const existingTag = fortnoto.tags.find(t => t.name === group.title && !t.deletedAt);
      if (existingTag) {
        hasCollisions = true;
        const tagTaskIds = existingTag.tasks.map(tt => tt.task.id);
        const groupTaskIds = group.tasks.map(t => t.id);
        const overlap = groupTaskIds.filter(id => tagTaskIds.includes(id));
        console.log(`  "${group.title}": Tag exists with ${existingTag.tasks.length} tasks`);
        console.log(`    - Group has ${groupTaskIds.length} tasks`);
        console.log(`    - Overlap: ${overlap.length} tasks already have both`);
      }
    });
    if (!hasCollisions) {
      console.log('  ✅ No collisions detected; group names don\'t match existing tags');
    }

    // Summary stats
    console.log(`\n📊 SUMMARY:`);
    console.log(`  Total groups: ${fortnoto.groups.length}`);
    console.log(`  Total grouped tasks: ${fortnoto.groups.reduce((sum, g) => sum + g.tasks.length, 0)}`);
    console.log(`  Ungrouped tasks: ${tasksWithNoGroup.length}`);
    console.log(`  Existing tags: ${fortnoto.tags.length}`);
    console.log(`  New tags to create: ${fortnoto.groups.filter(g => !tagNameSet.has(g.title)).length}`);

    console.log('\n✅ Investigation complete\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

investigate();
