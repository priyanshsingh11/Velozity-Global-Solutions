import { PrismaClient, Role, TaskStatus, TaskPriority, NotificationType } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Clean up existing records in reverse relation order
  await prisma.notification.deleteMany();
  await prisma.activityLog.deleteMany();
  await prisma.task.deleteMany();
  await prisma.project.deleteMany();
  await prisma.client.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();

  const salt = await bcrypt.genSalt(10);
  const commonPasswordHash = await bcrypt.hash('Password123!', salt);

  // 1. Seed Users (1 Admin, 2 PMs, 4 Developers = 7 Users)
  console.log('👤 Seeding 7 users...');
  const admin = await prisma.user.create({
    data: {
      name: 'Elena Rostova (Admin)',
      email: 'admin@velozity.com',
      passwordHash: commonPasswordHash,
      role: Role.ADMIN,
    },
  });

  const pm1 = await prisma.user.create({
    data: {
      name: 'Marcus Vance (PM 1)',
      email: 'pm1@velozity.com',
      passwordHash: commonPasswordHash,
      role: Role.PM,
    },
  });

  const pm2 = await prisma.user.create({
    data: {
      name: 'Sarah Lin (PM 2)',
      email: 'pm2@velozity.com',
      passwordHash: commonPasswordHash,
      role: Role.PM,
    },
  });

  const dev1 = await prisma.user.create({
    data: {
      name: 'Ravi Kumar (Dev 1)',
      email: 'dev1@velozity.com',
      passwordHash: commonPasswordHash,
      role: Role.DEVELOPER,
    },
  });

  const dev2 = await prisma.user.create({
    data: {
      name: 'Aisha Patel (Dev 2)',
      email: 'dev2@velozity.com',
      passwordHash: commonPasswordHash,
      role: Role.DEVELOPER,
    },
  });

  const dev3 = await prisma.user.create({
    data: {
      name: 'Liam O’Connor (Dev 3)',
      email: 'dev3@velozity.com',
      passwordHash: commonPasswordHash,
      role: Role.DEVELOPER,
    },
  });

  const dev4 = await prisma.user.create({
    data: {
      name: 'Sofia Chen (Dev 4)',
      email: 'dev4@velozity.com',
      passwordHash: commonPasswordHash,
      role: Role.DEVELOPER,
    },
  });

  // 2. Seed Clients
  console.log('🏢 Seeding clients...');
  const clientAcme = await prisma.client.create({
    data: {
      name: 'Acme Global Corp',
      email: 'contact@acmecorp.com',
      company: 'Acme Corporation',
    },
  });

  const clientFintech = await prisma.client.create({
    data: {
      name: 'Apex Financial Services',
      email: 'tech@apexfintech.io',
      company: 'Apex Holdings',
    },
  });

  const clientHealth = await prisma.client.create({
    data: {
      name: 'Nova Healthtech',
      email: 'partners@novahealth.org',
      company: 'Nova Health Systems',
    },
  });

  // 3. Seed Projects (3+ projects)
  console.log('📁 Seeding projects...');
  const projectAlpha = await prisma.project.create({
    data: {
      name: 'Project Alpha - Enterprise Portal',
      description: 'Modern customer-facing web portal with real-time analytics for Acme Corp.',
      clientId: clientAcme.id,
      createdById: pm1.id, // Owned by PM 1
    },
  });

  const projectBeta = await prisma.project.create({
    data: {
      name: 'Project Beta - Payment Gateway V2',
      description: 'Ultra-low latency payment orchestration engine for Apex Financial.',
      clientId: clientFintech.id,
      createdById: pm2.id, // Owned by PM 2
    },
  });

  const projectGamma = await prisma.project.create({
    data: {
      name: 'Project Gamma - Health Records Sync',
      description: 'HIPAA-compliant distributed sync pipeline for Nova Health systems.',
      clientId: clientHealth.id,
      createdById: admin.id, // Created by Admin
    },
  });

  // Dates for overdue testing:
  const pastDate1 = new Date();
  pastDate1.setDate(pastDate1.getDate() - 4);

  const pastDate2 = new Date();
  pastDate2.setDate(pastDate2.getDate() - 2);

  const futureDate1 = new Date();
  futureDate1.setDate(futureDate1.getDate() + 3);

  const futureDate2 = new Date();
  futureDate2.setDate(futureDate2.getDate() + 6);

  const futureDate3 = new Date();
  futureDate3.setDate(futureDate3.getDate() + 14);

  // 4. Seed Tasks (16 tasks across 3 projects, including at least 2 overdue tasks)
  console.log('📝 Seeding tasks...');

  // Project Alpha Tasks (PM 1)
  const task1 = await prisma.task.create({
    data: {
      title: 'Design high-conversion auth flow and wireframes',
      description: 'Revamp login, signup, and reset password with modern UX aesthetics.',
      projectId: projectAlpha.id,
      assignedDeveloperId: dev1.id,
      status: TaskStatus.DONE,
      priority: TaskPriority.MEDIUM,
      dueDate: futureDate1,
      isOverdue: false,
    },
  });

  const task2 = await prisma.task.create({
    data: {
      title: 'Integrate OAuth2 SSO with Google & Microsoft',
      description: 'Implement enterprise SSO support via OpenID Connect.',
      projectId: projectAlpha.id,
      assignedDeveloperId: dev1.id,
      status: TaskStatus.IN_REVIEW,
      priority: TaskPriority.HIGH,
      dueDate: futureDate1,
      isOverdue: false,
    },
  });

  const task3 = await prisma.task.create({
    data: {
      title: 'Legacy database migration schema script',
      description: 'Migrate legacy customer records to PostgreSQL with verified integrity.',
      projectId: projectAlpha.id,
      assignedDeveloperId: dev2.id,
      status: TaskStatus.IN_PROGRESS,
      priority: TaskPriority.CRITICAL,
      dueDate: pastDate1, // OVERDUE
      isOverdue: true,
    },
  });

  const task4 = await prisma.task.create({
    data: {
      title: 'Set up CDN asset delivery & edge caching',
      description: 'Configure Cloudflare edge rules and image resizing pipelines.',
      projectId: projectAlpha.id,
      assignedDeveloperId: dev2.id,
      status: TaskStatus.TODO,
      priority: TaskPriority.LOW,
      dueDate: futureDate2,
      isOverdue: false,
    },
  });

  const task5 = await prisma.task.create({
    data: {
      title: 'Fix mobile responsiveness in table dashboard',
      description: 'Resolve horizontal overflow and sticky header bugs on iOS Safari.',
      projectId: projectAlpha.id,
      assignedDeveloperId: dev3.id,
      status: TaskStatus.IN_PROGRESS,
      priority: TaskPriority.MEDIUM,
      dueDate: futureDate1,
      isOverdue: false,
    },
  });

  // Project Beta Tasks (PM 2)
  const task6 = await prisma.task.create({
    data: {
      title: 'Stripe webhook idempotent event dispatcher',
      description: 'Ensure duplicate webhook payloads do not trigger double ledger entries.',
      projectId: projectBeta.id,
      assignedDeveloperId: dev3.id,
      status: TaskStatus.DONE,
      priority: TaskPriority.CRITICAL,
      dueDate: futureDate1,
      isOverdue: false,
    },
  });

  const task7 = await prisma.task.create({
    data: {
      title: 'PCI-DSS Compliance security audit remediation',
      description: 'Mask cardholder metadata in all application logs and error reporting.',
      projectId: projectBeta.id,
      assignedDeveloperId: dev4.id,
      status: TaskStatus.IN_REVIEW,
      priority: TaskPriority.CRITICAL,
      dueDate: pastDate2, // OVERDUE
      isOverdue: true,
    },
  });

  const task8 = await prisma.task.create({
    data: {
      title: 'Develop automated reconciliation batch engine',
      description: 'Nightly reconciliation balancing bank settlement vs local transactions.',
      projectId: projectBeta.id,
      assignedDeveloperId: dev4.id,
      status: TaskStatus.IN_PROGRESS,
      priority: TaskPriority.HIGH,
      dueDate: futureDate2,
      isOverdue: false,
    },
  });

  const task9 = await prisma.task.create({
    data: {
      title: 'Export transactions to Excel & CSV with signed S3 URLs',
      description: 'Generate asynchronous CSV exports streamed directly to AWS S3 buckets.',
      projectId: projectBeta.id,
      assignedDeveloperId: dev1.id,
      status: TaskStatus.TODO,
      priority: TaskPriority.LOW,
      dueDate: futureDate3,
      isOverdue: false,
    },
  });

  const task10 = await prisma.task.create({
    data: {
      title: 'Implement biometric WebAuthn for payout confirmations',
      description: 'Require Passkey / TouchID confirmation on wire disbursements > $10,000.',
      projectId: projectBeta.id,
      assignedDeveloperId: dev3.id,
      status: TaskStatus.TODO,
      priority: TaskPriority.MEDIUM,
      dueDate: futureDate2,
      isOverdue: false,
    },
  });

  // Project Gamma Tasks (Admin created)
  const task11 = await prisma.task.create({
    data: {
      title: 'HL7 / FHIR data transformation parser',
      description: 'Parse standard FHIR JSON payloads and normalize patient history.',
      projectId: projectGamma.id,
      assignedDeveloperId: dev2.id,
      status: TaskStatus.DONE,
      priority: TaskPriority.HIGH,
      dueDate: futureDate1,
      isOverdue: false,
    },
  });

  const task12 = await prisma.task.create({
    data: {
      title: 'End-to-End asymmetric payload encryption module',
      description: 'Client-side public key encryption prior to transport to storage layer.',
      projectId: projectGamma.id,
      assignedDeveloperId: dev4.id,
      status: TaskStatus.IN_PROGRESS,
      priority: TaskPriority.CRITICAL,
      dueDate: futureDate2,
      isOverdue: false,
    },
  });

  const task13 = await prisma.task.create({
    data: {
      title: 'Audit trail immutable log sink with SHA-256 chaining',
      description: 'HIPAA compliance audit ledger recording every medical record inspection.',
      projectId: projectGamma.id,
      assignedDeveloperId: dev1.id,
      status: TaskStatus.TODO,
      priority: TaskPriority.HIGH,
      dueDate: futureDate3,
      isOverdue: false,
    },
  });

  const task14 = await prisma.task.create({
    data: {
      title: 'Implement WebRTC real-time patient telehealth signaling',
      description: 'Signaling server using WebSockets for encrypted peer video exchange.',
      projectId: projectGamma.id,
      assignedDeveloperId: dev3.id,
      status: TaskStatus.IN_REVIEW,
      priority: TaskPriority.MEDIUM,
      dueDate: futureDate1,
      isOverdue: false,
    },
  });

  const task15 = await prisma.task.create({
    data: {
      title: 'Doctor prescription PDF generation with digital signature',
      description: 'Generate standardized Rx PDFs featuring cryptographic provider signature.',
      projectId: projectGamma.id,
      assignedDeveloperId: dev2.id,
      status: TaskStatus.TODO,
      priority: TaskPriority.LOW,
      dueDate: futureDate3,
      isOverdue: false,
    },
  });

  // 5. Seed Historical Activity Logs
  console.log('📜 Seeding activity logs...');
  const now = new Date();
  const minutesAgo = (m: number) => new Date(now.getTime() - m * 60 * 1000);

  await prisma.activityLog.createMany({
    data: [
      {
        taskId: task1.id,
        projectId: projectAlpha.id,
        userId: dev1.id,
        action: 'STATUS_CHANGE',
        oldStatus: TaskStatus.IN_REVIEW,
        newStatus: TaskStatus.DONE,
        details: 'Ravi Kumar moved Task from In Review to Done',
        createdAt: minutesAgo(120),
      },
      {
        taskId: task2.id,
        projectId: projectAlpha.id,
        userId: dev1.id,
        action: 'STATUS_CHANGE',
        oldStatus: TaskStatus.IN_PROGRESS,
        newStatus: TaskStatus.IN_REVIEW,
        details: 'Ravi Kumar moved Task from In Progress to In Review',
        createdAt: minutesAgo(45),
      },
      {
        taskId: task3.id,
        projectId: projectAlpha.id,
        userId: dev2.id,
        action: 'STATUS_CHANGE',
        oldStatus: TaskStatus.TODO,
        newStatus: TaskStatus.IN_PROGRESS,
        details: 'Aisha Patel moved Task from To Do to In Progress',
        createdAt: minutesAgo(300),
      },
      {
        taskId: task6.id,
        projectId: projectBeta.id,
        userId: dev3.id,
        action: 'STATUS_CHANGE',
        oldStatus: TaskStatus.IN_REVIEW,
        newStatus: TaskStatus.DONE,
        details: 'Liam O’Connor moved Task from In Review to Done',
        createdAt: minutesAgo(180),
      },
      {
        taskId: task7.id,
        projectId: projectBeta.id,
        userId: dev4.id,
        action: 'STATUS_CHANGE',
        oldStatus: TaskStatus.IN_PROGRESS,
        newStatus: TaskStatus.IN_REVIEW,
        details: 'Sofia Chen moved Task from In Progress to In Review',
        createdAt: minutesAgo(25),
      },
      {
        taskId: task11.id,
        projectId: projectGamma.id,
        userId: dev2.id,
        action: 'STATUS_CHANGE',
        oldStatus: TaskStatus.IN_REVIEW,
        newStatus: TaskStatus.DONE,
        details: 'Aisha Patel moved Task from In Review to Done',
        createdAt: minutesAgo(90),
      },
      {
        taskId: task14.id,
        projectId: projectGamma.id,
        userId: dev3.id,
        action: 'STATUS_CHANGE',
        oldStatus: TaskStatus.IN_PROGRESS,
        newStatus: TaskStatus.IN_REVIEW,
        details: 'Liam O’Connor moved Task from In Progress to In Review',
        createdAt: minutesAgo(15),
      },
    ],
  });

  // 6. Seed In-App Notifications
  console.log('🔔 Seeding initial notifications...');
  await prisma.notification.createMany({
    data: [
      {
        userId: dev1.id,
        taskId: task2.id,
        type: NotificationType.TASK_ASSIGNED,
        title: 'New Task Assigned',
        message: 'Marcus Vance assigned "Integrate OAuth2 SSO with Google & Microsoft" to you.',
        isRead: false,
        createdAt: minutesAgo(60),
      },
      {
        userId: pm1.id,
        taskId: task2.id,
        type: NotificationType.TASK_IN_REVIEW,
        title: 'Task Moved to In Review',
        message: 'Ravi Kumar moved "Integrate OAuth2 SSO with Google & Microsoft" to In Review.',
        isRead: false,
        createdAt: minutesAgo(45),
      },
      {
        userId: pm2.id,
        taskId: task7.id,
        type: NotificationType.TASK_IN_REVIEW,
        title: 'Task Moved to In Review',
        message: 'Sofia Chen moved "PCI-DSS Compliance security audit remediation" to In Review.',
        isRead: false,
        createdAt: minutesAgo(25),
      },
      {
        userId: dev4.id,
        taskId: task7.id,
        type: NotificationType.TASK_OVERDUE,
        title: 'Task Overdue Alert',
        message: 'Task "PCI-DSS Compliance security audit remediation" is past its due date.',
        isRead: true,
        createdAt: minutesAgo(500),
      },
    ],
  });

  console.log('✅ Database seeded successfully!');
  console.log(`
  Credentials for testing:
  =========================================
  Default Password for ALL users: Password123!
  
  Admin:
    - Elena Rostova: admin@velozity.com
    
  Project Managers:
    - Marcus Vance: pm1@velozity.com (Owns Project Alpha)
    - Sarah Lin:    pm2@velozity.com (Owns Project Beta)
    
  Developers:
    - Ravi Kumar:   dev1@velozity.com
    - Aisha Patel:  dev2@velozity.com
    - Liam O’Connor: dev3@velozity.com
    - Sofia Chen:   dev4@velozity.com
  =========================================
  `);
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
