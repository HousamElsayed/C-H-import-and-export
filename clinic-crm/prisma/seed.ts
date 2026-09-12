import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../src/generated/prisma/client'
import type { PackageModel, ServiceModel, UserModel } from '../src/generated/prisma/models'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

/** Deterministic PRNG so repeated seeds produce the same demo clinic. */
let seedState = 20260912
function rnd() {
  seedState = (seedState * 1664525 + 1013904223) % 4294967296
  return seedState / 4294967296
}
function pick<T>(items: readonly T[]): T {
  return items[Math.floor(rnd() * items.length)]!
}
function int(min: number, max: number) {
  return Math.floor(rnd() * (max - min + 1)) + min
}
function chance(probability: number) {
  return rnd() < probability
}

const DAY = 24 * 60 * 60 * 1000

function round3(value: number) {
  return Math.round(value * 1000) / 1000
}

/**
 * Mirrors nextDocumentNumber() so seeded records share the app's numbering,
 * and so DocumentSequence can be primed to continue from where the seed left
 * off instead of colliding with it.
 */
const sequences = new Map<string, number>()
function nextCode(prefix: string, date: Date) {
  const year = date.getFullYear()
  const key = `${prefix}:${year}`
  const value = (sequences.get(key) ?? 0) + 1
  sequences.set(key, value)
  return `${prefix}-${year}-${String(value).padStart(6, '0')}`
}

function dayAt(offsetDays: number, hour: number, minute = 0) {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() + offsetDays)
  date.setHours(hour, minute, 0, 0)
  return date
}

const FIRST_NAMES = [
  'Elif', 'Zeynep', 'Ayşe', 'Fatma', 'Merve', 'Selin', 'Deniz', 'Ece', 'Buse', 'İrem',
  'Melis', 'Naz', 'Ceren', 'Esra', 'Gizem', 'Pınar', 'Sema', 'Tuğçe', 'Yasemin', 'Aslı',
  'Burak', 'Emre', 'Kerem', 'Mert', 'Onur', 'Sinan', 'Tolga', 'Umut',
]
const LAST_NAMES = [
  'Yılmaz', 'Kaya', 'Demir', 'Şahin', 'Çelik', 'Yıldız', 'Yıldırım', 'Öztürk', 'Aydın',
  'Özdemir', 'Arslan', 'Doğan', 'Kılıç', 'Aslan', 'Çetin', 'Kara', 'Koç', 'Kurt',
]

async function main() {
  console.log('Resetting demo data…')
  await prisma.$transaction([
    prisma.stockMovement.deleteMany(),
    prisma.consumptionBillItem.deleteMany(),
    prisma.consumptionBill.deleteMany(),
    prisma.stockCountItem.deleteMany(),
    prisma.stockCount.deleteMany(),
    prisma.packageRedemption.deleteMany(),
    prisma.clientPackageItem.deleteMany(),
    prisma.clientPackage.deleteMany(),
    prisma.payment.deleteMany(),
    prisma.commission.deleteMany(),
    prisma.invoiceItem.deleteMany(),
    prisma.invoice.deleteMany(),
    prisma.appointmentService.deleteMany(),
    prisma.messageLog.deleteMany(),
    prisma.campaignRecipient.deleteMany(),
    prisma.campaign.deleteMany(),
    prisma.consentRecord.deleteMany(),
    prisma.clientDocument.deleteMany(),
    prisma.clientNote.deleteMany(),
    prisma.appointment.deleteMany(),
    prisma.loyaltyEntry.deleteMany(),
    prisma.giftCard.deleteMany(),
    prisma.clientTag.deleteMany(),
    prisma.client.deleteMany(),
    prisma.tag.deleteMany(),
    prisma.serviceProductUsage.deleteMany(),
    prisma.serviceStaff.deleteMany(),
    prisma.serviceRoom.deleteMany(),
    prisma.packageItem.deleteMany(),
    prisma.package.deleteMany(),
    prisma.service.deleteMany(),
    prisma.serviceCategory.deleteMany(),
    prisma.consentTemplate.deleteMany(),
    prisma.messageTemplate.deleteMany(),
    prisma.product.deleteMany(),
    prisma.productCategory.deleteMany(),
    prisma.supplier.deleteMany(),
    prisma.workingHour.deleteMany(),
    prisma.timeOff.deleteMany(),
    prisma.session.deleteMany(),
    prisma.auditLog.deleteMany(),
    prisma.room.deleteMany(),
    prisma.user.deleteMany(),
    prisma.documentSequence.deleteMany(),
  ])

  await prisma.clinicSetting.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      name: 'Sala Beauty Clinic',
      legalName: 'Sala Güzellik Merkezi Ltd. Şti.',
      phone: '+90 212 000 00 00',
      email: 'hello@salaclinic.com',
      address: 'Nispetiye Cd. No:12, Beşiktaş, İstanbul',
      currency: 'TRY',
      currencySymbol: '₺',
      locale: 'tr-TR',
      timeZone: 'Europe/Istanbul',
      defaultTaxBps: 2000,
      openMin: 9 * 60,
      closeMin: 20 * 60,
    },
  })

  // ---------------------------------------------------------------- staff ---
  const password = await bcrypt.hash('Password123!', 12)

  const staffSpec = [
    { email: 'owner@salaclinic.com', firstName: 'Sala', lastName: 'Yılmaz', role: 'OWNER' as const, title: 'Clinic owner', bookable: true, color: '#8b5b9e', commissionBps: 0 },
    { email: 'manager@salaclinic.com', firstName: 'Derya', lastName: 'Kaya', role: 'MANAGER' as const, title: 'Clinic manager', bookable: false, color: '#3b6fb5', commissionBps: 0 },
    { email: 'reception@salaclinic.com', firstName: 'Nihan', lastName: 'Demir', role: 'RECEPTIONIST' as const, title: 'Front desk', bookable: false, color: '#2f8f6b', commissionBps: 0 },
    { email: 'ayse@salaclinic.com', firstName: 'Ayşe', lastName: 'Çelik', role: 'THERAPIST' as const, title: 'Senior aesthetician', bookable: true, color: '#c1748f', commissionBps: 1000 },
    { email: 'melis@salaclinic.com', firstName: 'Melis', lastName: 'Arslan', role: 'THERAPIST' as const, title: 'Laser specialist', bookable: true, color: '#b5811f', commissionBps: 1200 },
    { email: 'dr.kaan@salaclinic.com', firstName: 'Kaan', lastName: 'Şahin', role: 'THERAPIST' as const, title: 'Aesthetic doctor', bookable: true, color: '#c0433f', commissionBps: 2000 },
    { email: 'accounts@salaclinic.com', firstName: 'Burcu', lastName: 'Kara', role: 'ACCOUNTANT' as const, title: 'Accountant', bookable: false, color: '#6b6780', commissionBps: 0 },
  ]

  const users: UserModel[] = []
  for (const spec of staffSpec) {
    const user = await prisma.user.create({
      data: {
        email: spec.email,
        passwordHash: password,
        firstName: spec.firstName,
        lastName: spec.lastName,
        role: spec.role,
        title: spec.title,
        isBookable: spec.bookable,
        colorHex: spec.color,
        commissionBps: spec.commissionBps,
        phone: `+90 5${int(30, 55)} ${int(100, 999)} ${int(10, 99)} ${int(10, 99)}`,
      },
    })
    users.push(user)

    // Tuesday–Saturday, 09:00–20:00.
    for (const weekday of [2, 3, 4, 5, 6]) {
      await prisma.workingHour.create({
        data: { userId: user.id, weekday, startMin: 9 * 60, endMin: 20 * 60 },
      })
    }
  }

  const bookableStaff = users.filter((u) => u.isBookable)

  // ---------------------------------------------------------------- rooms ---
  const rooms = await Promise.all(
    [
      { name: 'Treatment Room 1', capacity: 1 },
      { name: 'Treatment Room 2', capacity: 1 },
      { name: 'Laser Suite', capacity: 1 },
      { name: 'Consultation Room', capacity: 2 },
    ].map((room) => prisma.room.create({ data: room })),
  )

  // ------------------------------------------------------------ suppliers ---
  const suppliers = await Promise.all(
    [
      { name: 'Dermaline Türkiye', contact: 'Okan Bey', phone: '+90 212 111 11 11' },
      { name: 'Aesthetica Supply', contact: 'Lale Hanım', phone: '+90 216 222 22 22' },
      { name: 'PureSkin Distribution', contact: 'Cem Bey', phone: '+90 232 333 33 33' },
    ].map((supplier) => prisma.supplier.create({ data: supplier })),
  )

  const productCategories = await Promise.all(
    ['Skincare', 'Injectables', 'Laser consumables', 'Disposables', 'Retail'].map((name, index) =>
      prisma.productCategory.create({ data: { name, sortOrder: index } }),
    ),
  )

  // ------------------------------------------------------------- products ---
  const productSpec = [
    { sku: 'SKN-001', name: 'Glycolic Peel Solution 30%', brand: 'Dermaline', cat: 0, type: 'PROFESSIONAL' as const, unit: 'ml', cost: 180000, retail: 0, stock: 480, reorder: 200 },
    { sku: 'SKN-002', name: 'Hyaluronic Mask Sheet', brand: 'PureSkin', cat: 0, type: 'BOTH' as const, unit: 'pcs', cost: 4500, retail: 12000, stock: 140, reorder: 40 },
    { sku: 'SKN-003', name: 'Vitamin C Serum 20ml', brand: 'PureSkin', cat: 4, type: 'RETAIL' as const, unit: 'pcs', cost: 38000, retail: 89000, stock: 26, reorder: 10 },
    { sku: 'SKN-004', name: 'SPF50 Mineral Sunscreen', brand: 'PureSkin', cat: 4, type: 'RETAIL' as const, unit: 'pcs', cost: 26000, retail: 65000, stock: 8, reorder: 12 },
    { sku: 'SKN-005', name: 'Cleansing Gel 500ml', brand: 'Dermaline', cat: 0, type: 'BOTH' as const, unit: 'pcs', cost: 21000, retail: 48000, stock: 34, reorder: 12 },
    { sku: 'SKN-006', name: 'Enzyme Exfoliant Powder', brand: 'Aesthetica', cat: 0, type: 'PROFESSIONAL' as const, unit: 'g', cost: 95000, retail: 0, stock: 320, reorder: 150 },
    { sku: 'INJ-001', name: 'Hyaluronic Filler 1ml', brand: 'Aesthetica', cat: 1, type: 'PROFESSIONAL' as const, unit: 'syringe', cost: 320000, retail: 0, stock: 22, reorder: 8 },
    { sku: 'INJ-002', name: 'Botulinum Toxin 100U', brand: 'Aesthetica', cat: 1, type: 'PROFESSIONAL' as const, unit: 'vial', cost: 480000, retail: 0, stock: 6, reorder: 4 },
    { sku: 'INJ-003', name: 'Mesotherapy Cocktail 5ml', brand: 'Dermaline', cat: 1, type: 'PROFESSIONAL' as const, unit: 'vial', cost: 145000, retail: 0, stock: 18, reorder: 10 },
    { sku: 'INJ-004', name: 'Lidocaine Numbing Cream 30g', brand: 'Dermaline', cat: 1, type: 'PROFESSIONAL' as const, unit: 'tube', cost: 42000, retail: 0, stock: 11, reorder: 6 },
    { sku: 'LSR-001', name: 'Laser Cooling Gel 1L', brand: 'Aesthetica', cat: 2, type: 'PROFESSIONAL' as const, unit: 'ml', cost: 68000, retail: 0, stock: 2400, reorder: 1000 },
    { sku: 'LSR-002', name: 'Laser Handpiece Filter', brand: 'Aesthetica', cat: 2, type: 'PROFESSIONAL' as const, unit: 'pcs', cost: 55000, retail: 0, stock: 3, reorder: 5 },
    { sku: 'DIS-001', name: 'Nitrile Gloves (box of 100)', brand: 'MedLine', cat: 3, type: 'PROFESSIONAL' as const, unit: 'box', cost: 18000, retail: 0, stock: 24, reorder: 10 },
    { sku: 'DIS-002', name: 'Disposable Bed Sheet Roll', brand: 'MedLine', cat: 3, type: 'PROFESSIONAL' as const, unit: 'roll', cost: 12000, retail: 0, stock: 16, reorder: 8 },
    { sku: 'DIS-003', name: 'Cotton Pads (pack of 200)', brand: 'MedLine', cat: 3, type: 'PROFESSIONAL' as const, unit: 'pack', cost: 6000, retail: 0, stock: 42, reorder: 15 },
    { sku: 'DIS-004', name: 'Sterile Needle 30G', brand: 'MedLine', cat: 3, type: 'PROFESSIONAL' as const, unit: 'pcs', cost: 900, retail: 0, stock: 260, reorder: 100 },
    { sku: 'RTL-001', name: 'Retinol Night Cream 50ml', brand: 'PureSkin', cat: 4, type: 'RETAIL' as const, unit: 'pcs', cost: 42000, retail: 98000, stock: 19, reorder: 8 },
    { sku: 'RTL-002', name: 'Lash Growth Serum', brand: 'PureSkin', cat: 4, type: 'RETAIL' as const, unit: 'pcs', cost: 34000, retail: 79000, stock: 4, reorder: 10 },
  ]

  const products = []
  for (const spec of productSpec) {
    const product = await prisma.product.create({
      data: {
        sku: spec.sku,
        name: spec.name,
        brand: spec.brand,
        categoryId: productCategories[spec.cat]!.id,
        supplierId: pick(suppliers).id,
        type: spec.type,
        unit: spec.unit,
        costMinor: spec.cost,
        retailMinor: spec.retail,
        stockQty: spec.stock,
        reorderLevel: spec.reorder,
        reorderQty: spec.reorder * 2,
        location: pick(['Store room shelf A', 'Store room shelf B', 'Treatment trolley', 'Fridge']),
        expiresAt: spec.cat === 1 ? new Date(Date.now() + int(60, 400) * DAY) : null,
      },
    })
    products.push(product)

    await prisma.stockMovement.create({
      data: {
        productId: product.id,
        type: 'PURCHASE',
        quantity: spec.stock,
        balanceAfter: spec.stock,
        unitCostMinor: spec.cost,
        totalCostMinor: Math.round(spec.cost * spec.stock),
        reference: 'Opening balance',
        note: 'Initial stock load',
        userId: users[1]!.id,
        createdAt: new Date(Date.now() - 75 * DAY),
      },
    })
  }

  const productBySku = new Map(products.map((product) => [product.sku, product]))

  // ------------------------------------------------------ consent + comms ---
  const consentFacial = await prisma.consentTemplate.create({
    data: {
      name: 'Chemical peel consent',
      body: 'I confirm I have disclosed my medical history, current medication and allergies. I understand that redness, peeling and temporary pigment change are expected after a chemical peel, and I agree to follow the aftercare instructions provided.',
    },
  })
  const consentInjectable = await prisma.consentTemplate.create({
    data: {
      name: 'Injectable treatment consent',
      body: 'I consent to the injectable treatment discussed during my consultation. Risks including bruising, swelling, asymmetry and, rarely, vascular complications have been explained to me. I confirm I am not pregnant or breastfeeding.',
    },
  })

  await prisma.messageTemplate.createMany({
    data: [
      {
        name: 'Appointment reminder (SMS)',
        channel: 'SMS',
        purpose: 'APPOINTMENT_REMINDER',
        body: 'Hi {{client_first_name}}, a reminder of your {{service_name}} appointment at {{clinic_name}} on {{date}} at {{time}}. Reply C to confirm or call {{clinic_phone}} to change it.',
      },
      {
        name: 'Booking confirmation (WhatsApp)',
        channel: 'WHATSAPP',
        purpose: 'APPOINTMENT_CONFIRMATION',
        body: 'Your booking is confirmed 💜 {{service_name}} with {{staff_name}} on {{date}} at {{time}}. See you at {{clinic_name}}.',
      },
      {
        name: 'Birthday offer (SMS)',
        channel: 'SMS',
        purpose: 'BIRTHDAY',
        body: 'Happy birthday {{client_first_name}}! Enjoy 20% off any treatment at {{clinic_name}} this month. Book on {{clinic_phone}}.',
      },
      {
        name: 'We miss you (SMS)',
        channel: 'SMS',
        purpose: 'WIN_BACK',
        body: '{{client_first_name}}, it has been a while since your last visit to {{clinic_name}}. Book this month and your next facial is 15% off.',
      },
      {
        name: 'Aftercare (Email)',
        channel: 'EMAIL',
        purpose: 'AFTERCARE',
        subject: 'Your aftercare instructions',
        body: 'Dear {{client_first_name}},\n\nThank you for visiting {{clinic_name}} today. Please avoid direct sun, hot showers and make-up for 24 hours, and use SPF50 daily.\n\nWith care,\n{{clinic_name}}',
      },
    ],
  })

  // ------------------------------------------------------------- services ---
  const categorySpec = [
    { name: 'Facials', color: '#8b5b9e' },
    { name: 'Laser & IPL', color: '#3b6fb5' },
    { name: 'Injectables', color: '#c0433f' },
    { name: 'Body', color: '#2f8f6b' },
    { name: 'Lashes & Brows', color: '#c1748f' },
  ]
  const categories = []
  for (const [index, spec] of categorySpec.entries()) {
    categories.push(
      await prisma.serviceCategory.create({
        data: { name: spec.name, colorHex: spec.color, sortOrder: index },
      }),
    )
  }

  const serviceSpec = [
    { cat: 0, name: 'Signature Hydrating Facial', duration: 60, price: 250000, cost: 45000, uses: [['SKN-002', 1], ['SKN-005', 0.05], ['DIS-003', 0.1]] },
    { cat: 0, name: 'Glycolic Peel', duration: 45, price: 320000, cost: 60000, consent: consentFacial.id, patch: true, uses: [['SKN-001', 8], ['SKN-005', 0.05], ['DIS-003', 0.1]] },
    { cat: 0, name: 'Deep Cleansing Facial', duration: 75, price: 280000, cost: 50000, uses: [['SKN-006', 6], ['SKN-005', 0.08], ['DIS-003', 0.15]] },
    { cat: 0, name: 'Microneedling', duration: 60, price: 450000, cost: 120000, consent: consentFacial.id, uses: [['INJ-003', 0.5], ['INJ-004', 0.1], ['DIS-001', 0.02]] },
    { cat: 1, name: 'Laser Hair Removal — Underarm', duration: 20, price: 90000, cost: 18000, uses: [['LSR-001', 20], ['DIS-002', 0.05]] },
    { cat: 1, name: 'Laser Hair Removal — Full Legs', duration: 60, price: 380000, cost: 55000, uses: [['LSR-001', 80], ['DIS-002', 0.1]] },
    { cat: 1, name: 'Laser Hair Removal — Full Body', duration: 120, price: 950000, cost: 120000, uses: [['LSR-001', 180], ['DIS-002', 0.25]] },
    { cat: 1, name: 'IPL Photofacial', duration: 45, price: 420000, cost: 70000, patch: true, uses: [['LSR-001', 40], ['DIS-003', 0.1]] },
    { cat: 2, name: 'Botulinum Toxin — Upper Face', duration: 30, price: 1200000, cost: 320000, consent: consentInjectable.id, uses: [['INJ-002', 0.25], ['DIS-004', 4], ['INJ-004', 0.15], ['DIS-001', 0.02]] },
    { cat: 2, name: 'Dermal Filler — Lips 1ml', duration: 45, price: 1450000, cost: 380000, consent: consentInjectable.id, uses: [['INJ-001', 1], ['INJ-004', 0.2], ['DIS-001', 0.02]] },
    { cat: 2, name: 'Mesotherapy — Face', duration: 40, price: 600000, cost: 160000, consent: consentInjectable.id, uses: [['INJ-003', 1], ['DIS-004', 6], ['DIS-001', 0.02]] },
    { cat: 3, name: 'Lymphatic Drainage Massage', duration: 60, price: 220000, cost: 25000, uses: [['DIS-002', 0.1]] },
    { cat: 3, name: 'Cellulite Radiofrequency', duration: 45, price: 300000, cost: 35000, uses: [['LSR-001', 30], ['DIS-002', 0.1]] },
    { cat: 4, name: 'Lash Lift & Tint', duration: 60, price: 180000, cost: 30000, uses: [['DIS-003', 0.1]] },
    { cat: 4, name: 'Brow Shaping & Tint', duration: 30, price: 120000, cost: 15000, uses: [['DIS-003', 0.05]] },
    { cat: 0, name: 'Skin Consultation', duration: 30, price: 0, cost: 0, uses: [] },
  ]

  const services: ServiceModel[] = []
  for (const [index, spec] of serviceSpec.entries()) {
    const service = await prisma.service.create({
      data: {
        categoryId: categories[spec.cat]!.id,
        name: spec.name,
        durationMin: spec.duration,
        bufferMin: spec.duration >= 60 ? 10 : 5,
        priceMinor: spec.price,
        costMinor: spec.cost,
        colorHex: categorySpec[spec.cat]!.color,
        requiresConsent: Boolean(spec.consent),
        consentTemplateId: spec.consent ?? null,
        requiresPatchTest: Boolean(spec.patch),
        patchTestDays: spec.patch ? 2 : 0,
        sortOrder: index,
        aftercareNote:
          spec.cat === 2
            ? 'No exercise, alcohol or lying down for 4 hours. Avoid pressure on the treated area for 48 hours.'
            : 'Avoid direct sun and hot water for 24 hours. Use SPF50 daily.',
      },
    })
    services.push(service)

    for (const staff of bookableStaff) {
      // Only the doctor performs injectables.
      const injectable = spec.cat === 2
      const isDoctor = staff.email === 'dr.kaan@salaclinic.com'
      if (injectable && !isDoctor) continue
      if (!injectable && isDoctor && chance(0.5)) continue
      await prisma.serviceStaff.create({ data: { serviceId: service.id, userId: staff.id } })
    }

    const roomFor = spec.cat === 1 ? rooms[2]! : spec.cat === 2 ? rooms[3]! : pick([rooms[0]!, rooms[1]!])
    await prisma.serviceRoom.create({ data: { serviceId: service.id, roomId: roomFor.id } })

    for (const [sku, qty] of spec.uses as [string, number][]) {
      const product = productBySku.get(sku)
      if (!product) continue
      await prisma.serviceProductUsage.create({
        data: { serviceId: service.id, productId: product.id, quantity: qty },
      })
    }
  }

  // ------------------------------------------------------------- packages ---
  const packageSpec = [
    { name: 'Laser Hair Removal — 6 Session Legs', price: 1900000, items: [[5, 6]] },
    { name: 'Glow Facial Course — 5 Sessions', price: 1100000, items: [[0, 5]] },
    { name: 'Bridal Package', price: 2400000, items: [[0, 3], [13, 1], [14, 2], [7, 1]] },
  ]
  const packages: PackageModel[] = []
  for (const spec of packageSpec) {
    const pkg = await prisma.package.create({
      data: {
        name: spec.name,
        priceMinor: spec.price,
        validityDays: 365,
        description: 'Prepaid course. Sessions are drawn down automatically at checkout.',
        items: {
          create: (spec.items as [number, number][]).map(([serviceIndex, qty]) => ({
            serviceId: services[serviceIndex]!.id,
            quantity: qty,
          })),
        },
      },
    })
    packages.push(pkg)
  }

  // ----------------------------------------------------------------- tags ---
  const tags = await Promise.all(
    [
      { name: 'VIP', colorHex: '#8b5b9e' },
      { name: 'Sensitive skin', colorHex: '#c0433f' },
      { name: 'Bride', colorHex: '#c1748f' },
      { name: 'Referral source', colorHex: '#2f8f6b' },
      { name: 'Package holder', colorHex: '#3b6fb5' },
    ].map((tag) => prisma.tag.create({ data: tag })),
  )

  // -------------------------------------------------------------- clients ---
  const clients = []
  for (let i = 0; i < 48; i += 1) {
    const firstName = pick(FIRST_NAMES)
    const lastName = pick(LAST_NAMES)
    const created = new Date(Date.now() - int(5, 400) * DAY)
    const client = await prisma.client.create({
      data: {
        code: nextCode('C', created),
        firstName,
        lastName,
        phone: `+9053${int(10, 99)}${String(int(1000000, 9999999))}`,
        email: chance(0.75)
          ? `${firstName.toLowerCase().replace(/[^a-z]/g, '')}.${lastName.toLowerCase().replace(/[^a-z]/g, '')}${i}@example.com`
          : null,
        birthDate: new Date(int(1970, 2004), int(0, 11), int(1, 28)),
        gender: chance(0.85) ? 'FEMALE' : 'MALE',
        status: chance(0.9) ? 'ACTIVE' : 'DORMANT',
        city: 'İstanbul',
        source: pick(['INSTAGRAM', 'REFERRAL', 'WALK_IN', 'PHONE', 'WEBSITE'] as const),
        skinType: pick(['Normal', 'Dry', 'Oily', 'Combination', 'Sensitive']),
        allergies: chance(0.2) ? pick(['Lidocaine', 'Nickel', 'Fragrance', 'Latex']) : null,
        medicalNotes: chance(0.15) ? pick(['Hypothyroidism, controlled', 'Migraine, occasional', 'Pregnancy 2023 — no treatments during']) : null,
        marketingSms: chance(0.8),
        marketingEmail: chance(0.6),
        marketingWhatsapp: chance(0.7),
        kvkkConsentAt: created,
        createdAt: created,
      },
    })
    clients.push(client)

    if (chance(0.35)) {
      await prisma.clientTag.create({ data: { clientId: client.id, tagId: pick(tags).id } })
    }
  }

  // --------------------------------------------------------- appointments ---
  const chargeableServices = services.filter((service) => service.priceMinor > 0)
  let appointmentCount = 0
  let invoiceCount = 0

  for (let offset = -70; offset <= 21; offset += 1) {
    const date = dayAt(offset, 9)
    const weekday = date.getDay()
    if (weekday === 0 || weekday === 1) continue // closed Sunday and Monday

    const bookings = offset <= 0 ? int(4, 9) : int(2, 7)
    const used: { staffId: string; start: number; end: number }[] = []

    for (let b = 0; b < bookings; b += 1) {
      const service = pick(chargeableServices)
      const eligible = await prisma.serviceStaff.findMany({
        where: { serviceId: service.id },
        select: { userId: true },
      })
      if (eligible.length === 0) continue
      const staffId = pick(eligible).userId

      const startMin = int(18, 38) * 30 // 09:00 to 19:00 in half-hour steps
      const endMin = startMin + service.durationMin
      if (endMin > 20 * 60) continue
      if (used.some((slot) => slot.staffId === staffId && startMin < slot.end && slot.start < endMin)) continue
      used.push({ staffId, start: startMin, end: endMin })

      const startAt = dayAt(offset, Math.floor(startMin / 60), startMin % 60)
      const endAt = new Date(startAt.getTime() + service.durationMin * 60 * 1000)
      const client = pick(clients)

      let status: 'COMPLETED' | 'NO_SHOW' | 'CANCELLED' | 'CONFIRMED' | 'SCHEDULED'
      if (offset < 0) status = chance(0.88) ? 'COMPLETED' : chance(0.5) ? 'NO_SHOW' : 'CANCELLED'
      else if (offset === 0) status = chance(0.5) ? 'COMPLETED' : 'CONFIRMED'
      else status = chance(0.6) ? 'CONFIRMED' : 'SCHEDULED'

      appointmentCount += 1
      const appointment = await prisma.appointment.create({
        data: {
          code: nextCode('A', startAt),
          clientId: client.id,
          staffId,
          roomId: pick(rooms).id,
          startAt,
          endAt,
          status,
          source: pick(['PHONE', 'WHATSAPP', 'INSTAGRAM', 'WALK_IN'] as const),
          totalMinor: service.priceMinor,
          createdById: users[2]!.id,
          arrivedAt: status === 'COMPLETED' ? startAt : null,
          completedAt: status === 'COMPLETED' ? endAt : null,
          cancelledAt: status === 'CANCELLED' ? new Date(startAt.getTime() - DAY) : null,
          cancelReason: status === 'CANCELLED' ? pick(['Client rescheduled', 'Illness', 'Travel']) : null,
          confirmedAt: status === 'CONFIRMED' ? new Date(startAt.getTime() - DAY) : null,
          services: {
            create: {
              serviceId: service.id,
              staffId,
              durationMin: service.durationMin,
              priceMinor: service.priceMinor,
            },
          },
        },
      })

      if (status === 'NO_SHOW') {
        await prisma.client.update({
          where: { id: client.id },
          data: { noShowCount: { increment: 1 } },
        })
      }

      if (status !== 'COMPLETED') continue

      // ---- checkout: invoice, payment, stock deduction, loyalty, commission
      const subtotal = service.priceMinor
      const discountMinor = chance(0.2) ? Math.round(subtotal * 0.1) : 0
      const net = subtotal - discountMinor
      const taxMinor = Math.round((net * 2000) / 10000)
      const total = net + taxMinor
      invoiceCount += 1

      const invoice = await prisma.invoice.create({
        data: {
          number: nextCode('INV', endAt),
          clientId: client.id,
          appointmentId: appointment.id,
          cashierId: users[2]!.id,
          status: 'PAID',
          issuedAt: endAt,
          subtotalMinor: subtotal,
          discountType: discountMinor ? 'PERCENT' : 'NONE',
          discountValue: discountMinor ? 1000 : 0,
          discountMinor,
          taxBps: 2000,
          taxMinor,
          totalMinor: total,
          paidMinor: total,
          createdAt: endAt,
          items: {
            create: {
              kind: 'SERVICE',
              description: service.name,
              serviceId: service.id,
              staffId,
              quantity: 1,
              unitPriceMinor: subtotal,
              discountMinor,
              totalMinor: net,
              costMinor: service.costMinor,
            },
          },
          payments: {
            create: {
              method: pick(['CARD', 'CARD', 'CASH', 'BANK_TRANSFER'] as const),
              amountMinor: total,
              receivedById: users[2]!.id,
              createdAt: endAt,
            },
          },
        },
      })

      const staffMember = users.find((user) => user.id === staffId)
      if (staffMember && staffMember.commissionBps > 0) {
        await prisma.commission.create({
          data: {
            userId: staffId,
            invoiceId: invoice.id,
            baseMinor: net,
            rateBps: staffMember.commissionBps,
            amountMinor: Math.round((net * staffMember.commissionBps) / 10000),
            createdAt: endAt,
          },
        })
      }

      const usages = await prisma.serviceProductUsage.findMany({
        where: { serviceId: service.id },
        include: { product: true },
      })
      for (const usage of usages) {
        const current = await prisma.product.findUnique({
          where: { id: usage.productId },
          select: { stockQty: true, costMinor: true, reorderQty: true },
        })
        if (!current) continue

        // Restock before the stock would go negative, so the movement history
        // reads like a real clinic rather than producing impossible balances.
        if (current.stockQty < usage.quantity) {
          const topUp = Math.max(current.reorderQty, usage.quantity * 20)
          const restocked = round3(current.stockQty + topUp)
          await prisma.product.update({
            where: { id: usage.productId },
            data: { stockQty: restocked },
          })
          await prisma.stockMovement.create({
            data: {
              productId: usage.productId,
              type: 'PURCHASE',
              quantity: topUp,
              balanceAfter: restocked,
              unitCostMinor: current.costMinor,
              totalCostMinor: Math.round(current.costMinor * topUp),
              reference: 'Replenishment order',
              userId: users[1]!.id,
              createdAt: new Date(endAt.getTime() - 60 * 60 * 1000),
            },
          })
          current.stockQty = restocked
        }

        const balanceAfter = round3(current.stockQty - usage.quantity)
        await prisma.product.update({
          where: { id: usage.productId },
          data: { stockQty: balanceAfter },
        })
        await prisma.stockMovement.create({
          data: {
            productId: usage.productId,
            type: 'TREATMENT_USE',
            quantity: -usage.quantity,
            balanceAfter,
            unitCostMinor: current.costMinor,
            totalCostMinor: Math.round(current.costMinor * usage.quantity),
            reference: appointment.code,
            appointmentId: appointment.id,
            invoiceId: invoice.id,
            userId: staffId,
            createdAt: endAt,
          },
        })
      }

      const points = Math.floor(total / 10000)
      if (points > 0) {
        await prisma.loyaltyEntry.create({
          data: {
            clientId: client.id,
            invoiceId: invoice.id,
            points,
            reason: 'EARNED_PURCHASE',
            createdAt: endAt,
          },
        })
      }

      await prisma.client.update({
        where: { id: client.id },
        data: {
          visitCount: { increment: 1 },
          totalSpentMinor: { increment: total },
          loyaltyPoints: { increment: points },
          lastVisitAt: endAt,
          firstVisitAt: client.firstVisitAt ?? endAt,
        },
      })
    }
  }

  // ------------------------------------------------- purchased packages ----
  for (let i = 0; i < 8; i += 1) {
    const pkg = pick(packages)
    const client = pick(clients)
    const items = await prisma.packageItem.findMany({ where: { packageId: pkg.id } })
    await prisma.clientPackage.create({
      data: {
        clientId: client.id,
        packageId: pkg.id,
        pricePaidMinor: pkg.priceMinor,
        purchasedAt: new Date(Date.now() - int(10, 200) * DAY),
        expiresAt: new Date(Date.now() + int(60, 300) * DAY),
        items: {
          create: items.map((item) => ({
            serviceId: item.serviceId,
            totalQty: item.quantity,
            usedQty: int(0, Math.max(0, item.quantity - 1)),
          })),
        },
      },
    })
  }

  // --------------------------------------------- internal consumption -----
  const consumptionSpec = [
    {
      reason: 'Monthly back-bar restock of treatment trolleys',
      costCenter: 'Treatment rooms',
      items: [['DIS-001', 2], ['DIS-003', 3], ['SKN-005', 1]] as [string, number][],
      offset: -30,
    },
    {
      reason: 'Staff training session — new microneedling protocol',
      costCenter: 'Training',
      items: [['INJ-003', 2], ['DIS-004', 20], ['DIS-001', 1]] as [string, number][],
      offset: -12,
    },
    {
      reason: 'Expired product written off',
      costCenter: 'Wastage',
      items: [['INJ-004', 1]] as [string, number][],
      offset: -4,
    },
  ]

  for (const [index, spec] of consumptionSpec.entries()) {
    const billDate = dayAt(spec.offset, 18)
    let totalCost = 0
    const itemData = []
    for (const [sku, qty] of spec.items) {
      const product = productBySku.get(sku)
      if (!product) continue
      const lineCost = Math.round(product.costMinor * qty)
      totalCost += lineCost
      itemData.push({
        productId: product.id,
        quantity: qty,
        unitCostMinor: product.costMinor,
        totalCostMinor: lineCost,
      })
    }

    const bill = await prisma.consumptionBill.create({
      data: {
        number: nextCode('USE', billDate),
        status: 'ISSUED',
        billDate,
        issuedAt: billDate,
        costCenter: spec.costCenter,
        reason: spec.reason,
        staffId: pick(bookableStaff).id,
        createdById: users[1]!.id,
        totalCostMinor: totalCost,
        createdAt: billDate,
        items: { create: itemData },
      },
    })

    for (const item of itemData) {
      const current = await prisma.product.findUnique({
        where: { id: item.productId },
        select: { stockQty: true },
      })
      if (!current) continue
      const balanceAfter = round3(current.stockQty - item.quantity)
      await prisma.product.update({ where: { id: item.productId }, data: { stockQty: balanceAfter } })
      await prisma.stockMovement.create({
        data: {
          productId: item.productId,
          type: 'INTERNAL_USE',
          quantity: -item.quantity,
          balanceAfter,
          unitCostMinor: item.unitCostMinor,
          totalCostMinor: item.totalCostMinor,
          reference: bill.number,
          consumptionBillId: bill.id,
          userId: users[1]!.id,
          createdAt: billDate,
        },
      })
    }
  }

  // Prime the app's numbering so the next document continues the seeded run.
  for (const [key, value] of sequences) {
    const [prefix, year] = key.split(':')
    await prisma.documentSequence.create({
      data: { prefix: prefix!, year: Number.parseInt(year!, 10), value },
    })
  }

  const counts = await Promise.all([
    prisma.client.count(),
    prisma.appointment.count(),
    prisma.invoice.count(),
    prisma.product.count(),
  ])

  console.log('Seed complete.')
  console.log(`  clients: ${counts[0]}, appointments: ${counts[1]}, invoices: ${counts[2]}, products: ${counts[3]}`)
  console.log('  Sign in with owner@salaclinic.com / Password123!')
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
