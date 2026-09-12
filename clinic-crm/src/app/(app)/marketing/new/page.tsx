import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/auth'
import { PageHeader } from '@/components/ui/card'
import { CampaignForm } from '@/components/marketing/campaign-form'
import { createCampaign, previewAudience } from '../actions'

export const metadata: Metadata = { title: 'New campaign' }
export const dynamic = 'force-dynamic'

export default async function NewCampaignPage() {
  await requirePermission('marketing:write')

  const [templates, tags] = await Promise.all([
    prisma.messageTemplate.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, channel: true, body: true, subject: true },
    }),
    prisma.tag.findMany({ orderBy: { name: 'asc' } }),
  ])

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="New campaign" description="Pick an audience, write the message, send it." />
      <CampaignForm
        action={createCampaign}
        previewAction={previewAudience}
        templates={templates}
        tags={tags}
      />
    </div>
  )
}
