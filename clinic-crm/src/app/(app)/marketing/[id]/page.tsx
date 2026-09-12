import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { ArrowLeft } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/auth'
import { formatDateTime } from '@/lib/dates'
import { Card, CardBody, CardHeader, PageHeader } from '@/components/ui/card'
import { StatTile } from '@/components/ui/stat'
import { Table, Tr } from '@/components/ui/table'
import { MessageStatusBadge } from '@/components/domain/status'

export const dynamic = 'force-dynamic'

export async function generateMetadata(props: PageProps<'/marketing/[id]'>): Promise<Metadata> {
  const { id } = await props.params
  const campaign = await prisma.campaign.findUnique({ where: { id }, select: { name: true } })
  return { title: campaign?.name ?? 'Campaign' }
}

export default async function CampaignPage(props: PageProps<'/marketing/[id]'>) {
  await requirePermission('marketing:read')
  const { id } = await props.params

  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: {
      template: { select: { name: true, body: true } },
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 100,
        include: { client: { select: { id: true, firstName: true, lastName: true } } },
      },
      _count: { select: { recipients: true } },
    },
  })

  if (!campaign) notFound()

  const delivered = campaign.messages.filter((message) =>
    ['SENT', 'DELIVERED'].includes(message.status),
  ).length
  const failed = campaign.messages.filter((message) => message.status === 'FAILED').length

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/marketing" className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" />
        All campaigns
      </Link>

      <PageHeader
        title={campaign.name}
        description={`${campaign.channel.toLowerCase()} · created ${formatDateTime(campaign.createdAt)}`}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatTile label="Audience" value={campaign._count.recipients} />
        <StatTile label="Delivered" value={delivered} tone="success" />
        <StatTile label="Failed" value={failed} tone={failed > 0 ? 'danger' : 'neutral'} />
      </div>

      {campaign.messages[0] ? (
        <Card className="mb-6">
          <CardHeader title="Message sent" />
          <CardBody>
            <p className="whitespace-pre-wrap text-sm text-ink">{campaign.messages[0].body}</p>
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardHeader title="Recipients" description={`Showing ${campaign.messages.length}`} />
        {campaign.messages.length === 0 ? (
          <CardBody className="text-sm text-ink-muted">Nothing sent yet.</CardBody>
        ) : (
          <Table>
            <thead>
              <tr>
                <th>Client</th>
                <th>To</th>
                <th>Queued</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {campaign.messages.map((message) => (
                <Tr key={message.id}>
                  <td>
                    {message.client ? (
                      <Link href={`/clients/${message.client.id}`} className="text-ink hover:text-brand">
                        {message.client.firstName} {message.client.lastName}
                      </Link>
                    ) : (
                      <span className="text-ink-subtle">—</span>
                    )}
                  </td>
                  <td className="text-ink-muted">{message.toAddress}</td>
                  <td className="text-ink-muted">{formatDateTime(message.createdAt)}</td>
                  <td><MessageStatusBadge status={message.status} /></td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  )
}
