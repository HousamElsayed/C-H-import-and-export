import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/auth'
import { can } from '@/lib/rbac'
import { Card, CardBody, CardHeader, PageHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TemplateEditor } from '@/components/marketing/template-editor'
import { saveTemplate } from '../actions'

export const metadata: Metadata = { title: 'Message templates' }
export const dynamic = 'force-dynamic'

export default async function TemplatesPage() {
  const user = await requirePermission('marketing:read')
  const editable = can(user.role, 'marketing:write')

  const templates = await prisma.messageTemplate.findMany({ orderBy: { name: 'asc' } })

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/marketing" className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" />
        Campaigns
      </Link>

      <PageHeader
        title="Message templates"
        description="Reusable wording for reminders, confirmations and offers"
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          {templates.map((template) => (
            <Card key={template.id}>
              <CardHeader
                title={template.name}
                description={`${template.channel.toLowerCase()} · ${template.purpose.toLowerCase().replace(/_/g, ' ')}`}
                action={template.isActive ? <Badge tone="success">active</Badge> : <Badge>off</Badge>}
              />
              <CardBody>
                {template.subject ? (
                  <p className="mb-1 text-sm font-medium text-ink">{template.subject}</p>
                ) : null}
                <p className="whitespace-pre-wrap text-sm text-ink-muted">{template.body}</p>
              </CardBody>
            </Card>
          ))}
        </div>

        {editable ? (
          <Card className="h-fit">
            <CardHeader title="Add a template" />
            <CardBody>
              <TemplateEditor action={saveTemplate} />
            </CardBody>
          </Card>
        ) : null}
      </div>
    </div>
  )
}
