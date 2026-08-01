'use strict';

/**
 * Development seed: three teammates, a spread of deals across the pipeline and
 * matching reminders.
 *
 *   npm run seed            # add demo data, keep anything already there
 *   npm run seed -- --wipe  # delete deals/reminders first
 */

const mongoose = require('mongoose');
const config = require('../config/env');
const logger = require('../utils/logger');
const { connectDB, disconnectDB } = require('../config/db');
const User = require('../models/User');
const Deal = require('../models/Deal');
const Reminder = require('../models/Reminder');
const stageService = require('../services/stage.service');

const hours = (n) => new Date(Date.now() + n * 60 * 60 * 1000);
const days = (n) => new Date(Date.now() + n * 24 * 60 * 60 * 1000);

async function upsertUser({ name, email, password }) {
  const existing = await User.findOne({ email });
  if (existing) {
    logger.info(`User already exists: ${email}`);
    return existing;
  }
  const user = await User.create({ name, email, password });
  logger.info(`Created teammate: ${name} <${email}>`);
  return user;
}

const DEALS = [
  {
    title: 'Acme Corp - Platform licence',
    company: 'Acme Corp',
    contactName: 'Dana Whitfield',
    contactDesignation: 'VP Engineering',
    contactEmail: 'dana@acme.test',
    contactPhone: '+1 415 555 0142',
    contacts: [
      {
        name: 'Luis Ortega',
        designation: 'Head of Procurement',
        email: 'luis@acme.test',
        phone: '+1 415 555 0188',
      },
    ],
    value: 48000,
    stage: 'negotiation',
    source: 'Referral',
    expectedCloseDate: days(12),
    description: 'Three-year platform licence for 240 seats. Legal review in progress.',
  },
  {
    title: 'Northwind - Analytics add-on',
    company: 'Northwind Traders',
    contactName: 'Samir Patel',
    contactDesignation: 'Head of Data',
    contactEmail: 'samir@northwind.test',
    value: 15500,
    stage: 'proposal',
    source: 'Inbound',
    expectedCloseDate: days(20),
    description: 'Proposal sent for the analytics module. Waiting on budget approval.',
  },
  {
    title: 'Globex - Pilot programme',
    company: 'Globex',
    contactName: 'Rae Lindqvist',
    contactDesignation: 'Operations Manager',
    contactEmail: 'rae@globex.test',
    value: 9000,
    stage: 'qualified',
    source: 'Conference',
    expectedCloseDate: days(35),
  },
  {
    title: 'Initech - Workflow automation',
    company: 'Initech',
    contactName: 'Peter Gibbons',
    contactDesignation: 'Programmer',
    contactEmail: 'peter@initech.test',
    value: 27000,
    stage: 'lead',
    source: 'Cold outreach',
    expectedCloseDate: days(60),
  },
  {
    title: 'Umbra Health - Compliance suite',
    company: 'Umbra Health',
    contactName: 'Nadia Rahman',
    contactDesignation: 'Chief Compliance Officer',
    contactEmail: 'nadia@umbra.test',
    value: 72000,
    stage: 'lead',
    source: 'Partner',
    expectedCloseDate: days(75),
  },
  {
    title: 'Stark Industries - Renewal',
    company: 'Stark Industries',
    contactName: 'Vic Moreau',
    contactDesignation: 'IT Director',
    contactEmail: 'vic@stark.test',
    value: 36000,
    stage: 'won',
    source: 'Renewal',
    expectedCloseDate: days(-3),
  },
  {
    title: 'Soylent - Data migration',
    company: 'Soylent Corp',
    contactName: 'Kim Vega',
    contactDesignation: 'Platform Lead',
    contactEmail: 'kim@soylent.test',
    value: 11000,
    stage: 'lost',
    source: 'Inbound',
    lostReason: 'Chose an in-house build.',
    expectedCloseDate: days(-10),
  },
];

const REMINDERS = [
  {
    dealTitle: 'Acme Corp - Platform licence',
    title: 'Send redlined contract to legal',
    dueAt: hours(2),
    priority: 'high',
  },
  {
    dealTitle: 'Acme Corp - Platform licence',
    title: 'Follow-up call with Dana',
    dueAt: days(2),
    priority: 'high',
  },
  {
    dealTitle: 'Northwind - Analytics add-on',
    title: 'Chase proposal feedback',
    dueAt: hours(-20),
    priority: 'medium',
  },
  {
    dealTitle: 'Globex - Pilot programme',
    title: 'Schedule technical discovery',
    dueAt: days(1),
    priority: 'medium',
  },
  {
    dealTitle: 'Initech - Workflow automation',
    title: 'Qualify budget and timeline',
    dueAt: days(4),
    priority: 'low',
  },
  {
    dealTitle: 'Umbra Health - Compliance suite',
    title: 'Send compliance one-pager',
    dueAt: days(3),
    priority: 'high',
  },
];

async function seed() {
  const wipe = process.argv.includes('--wipe');
  await connectDB();

  if (wipe) {
    logger.warn('Wiping deals and reminders...');
    await Promise.all([Deal.deleteMany({}), Reminder.deleteMany({})]);
  }

  // The seed data references the default columns, so make sure they exist.
  await stageService.ensureDefaultStages();
  const stages = await stageService.stageMap();
  if (stages.size === 0) throw new Error('No pipeline stages found');

  const password = config.SEED_PASSWORD;

  const you = await upsertUser({ name: config.SEED_NAME, email: config.SEED_EMAIL, password });
  const alex = await upsertUser({ name: 'Alex Kim', email: 'alex@example.com', password });
  const jordan = await upsertUser({ name: 'Jordan Diaz', email: 'jordan@example.com', password });

  // Deals are shared; `owner` only records who is working each one.
  const owners = [you, alex, jordan, you, alex, jordan, you];
  const created = new Map();

  for (let i = 0; i < DEALS.length; i += 1) {
    const spec = DEALS[i];
    if (await Deal.exists({ title: spec.title })) {
      logger.info(`Deal already exists: ${spec.title}`);
      created.set(spec.title, await Deal.findOne({ title: spec.title }));
      continue;
    }

    const stage = stages.get(spec.stage);
    if (!stage) {
      logger.warn(`Skipping "${spec.title}": no "${spec.stage}" column on this board`);
      continue;
    }

    const owner = owners[i % owners.length];
    const deal = new Deal({
      ...spec,
      currency: 'USD',
      owner: owner._id,
      createdBy: you._id,
      order: stage.order + i,
    });
    stageService.applyStageToDeal(deal, stage);
    await deal.save();
    created.set(spec.title, deal);

    logger.info(`Created deal: ${deal.title} (${deal.stage}) -> ${owner.name}`);
  }

  for (const spec of REMINDERS) {
    const deal = created.get(spec.dealTitle);
    if (!deal) continue;
    if (await Reminder.exists({ deal: deal._id, title: spec.title })) continue;

    const reminder = await Reminder.create({
      title: spec.title,
      dueAt: spec.dueAt,
      priority: spec.priority,
      deal: deal._id,
      assignedTo: deal.owner,
      createdBy: you._id,
      notes: '',
      // Backdated demo tasks should not trigger a burst of emails on first boot.
      notifiedAt: spec.dueAt < new Date() ? new Date() : null,
    });

    logger.info(`Created reminder: ${reminder.title}`);
  }

  logger.info('');
  logger.info('Seed complete. Any of these can sign in:');
  logger.info(`  ${config.SEED_EMAIL} / ${password}`);
  logger.info(`  alex@example.com / ${password}`);
  logger.info(`  jordan@example.com / ${password}`);

  await disconnectDB();
}

seed()
  .then(() => process.exit(0))
  .catch(async (err) => {
    logger.error('Seed failed:', err.stack || err.message);
    await mongoose.connection.close().catch(() => {});
    process.exit(1);
  });
