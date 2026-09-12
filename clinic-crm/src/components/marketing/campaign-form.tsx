'use client'

import { useActionState, useState } from 'react'
import Link from 'next/link'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Checkbox, Field, FormError, FormSuccess, Input, Select, Textarea } from '@/components/ui/field'
import { SubmitButton } from '@/components/ui/submit-button'
import { buttonClass } from '@/components/ui/button'
import { TEMPLATE_TOKENS } from '@/lib/template-tokens'
import { emptyState, type ActionState } from '@/lib/forms'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export function CampaignForm({
  action,
  previewAction,
  templates,
  tags,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>
  previewAction: (state: ActionState, formData: FormData) => Promise<ActionState>
  templates: { id: string; name: string; channel: string; body: string; subject: string | null }[]
  tags: { id: string; name: string; colorHex: string }[]
}) {
  const [state, formAction] = useActionState(action, emptyState)
  const [preview, previewFormAction] = useActionState(previewAction, emptyState)
  const [channel, setChannel] = useState('SMS')
  const [templateId, setTemplateId] = useState('')
  const [body, setBody] = useState('')

  const template = templates.find((item) => item.id === templateId)
  const effectiveBody = body || template?.body || ''

  return (
    <form action={formAction} className="space-y-6">
      <FormError message={state.error} />

      <Card>
        <CardHeader title="Campaign" />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" htmlFor="name" required>
            <Input id="name" name="name" required placeholder="September facial offer" />
          </Field>
          <Field label="Channel" htmlFor="channel">
            <Select
              id="channel"
              name="channel"
              value={channel}
              onChange={(event) => setChannel(event.target.value)}
            >
              <option value="SMS">SMS</option>
              <option value="WHATSAPP">WhatsApp</option>
              <option value="EMAIL">Email</option>
            </Select>
          </Field>
          <Field label="Template" htmlFor="templateId" className="sm:col-span-2">
            <Select
              id="templateId"
              name="templateId"
              value={templateId}
              onChange={(event) => {
                setTemplateId(event.target.value)
                setBody('')
              }}
            >
              <option value="">Write a one-off message</option>
              {templates
                .filter((item) => item.channel === channel)
                .map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
            </Select>
          </Field>
          {channel === 'EMAIL' ? (
            <Field label="Subject" htmlFor="subject" className="sm:col-span-2">
              <Input id="subject" name="subject" defaultValue={template?.subject ?? ''} />
            </Field>
          ) : null}
          <Field
            label="Message"
            htmlFor="body"
            className="sm:col-span-2"
            hint={`Tokens: ${TEMPLATE_TOKENS.map((token) => `{{${token}}}`).join(' ')}`}
          >
            <Textarea
              id="body"
              name="body"
              rows={4}
              value={effectiveBody}
              onChange={(event) => setBody(event.target.value)}
              required
            />
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Audience"
          description="Only clients who opted in to this channel are included."
        />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label="Status" htmlFor="status">
            <Select id="status" name="status" defaultValue="">
              <option value="">Any status</option>
              <option value="ACTIVE">Active</option>
              <option value="LEAD">Lead</option>
              <option value="DORMANT">Dormant</option>
            </Select>
          </Field>
          <Field label="Not visited for (days)" htmlFor="notVisitedForDays" hint="Win-back audiences.">
            <Input id="notVisitedForDays" name="notVisitedForDays" type="number" min={0} />
          </Field>
          <Field label="Minimum lifetime spend" htmlFor="minSpend">
            <Input id="minSpend" name="minSpend" inputMode="decimal" placeholder="0,00" />
          </Field>
          <Field label="Birthday month" htmlFor="birthdayMonth">
            <Select id="birthdayMonth" name="birthdayMonth" defaultValue="">
              <option value="">Any month</option>
              {MONTHS.map((month, index) => (
                <option key={month} value={index + 1}>{month}</option>
              ))}
            </Select>
          </Field>

          {tags.length > 0 ? (
            <div className="sm:col-span-2">
              <p className="label">Tags</p>
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <label
                    key={tag.id}
                    className="flex cursor-pointer items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-sm text-ink-muted transition has-[:checked]:border-brand-ring has-[:checked]:bg-brand-soft has-[:checked]:text-brand-strong"
                  >
                    <Checkbox name="tagIds" value={tag.id} />
                    <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: tag.colorHex }} />
                    {tag.name}
                  </label>
                ))}
              </div>
            </div>
          ) : null}

          <div className="sm:col-span-2">
            <FormSuccess message={preview.ok ? preview.message : undefined} />
            <FormError message={preview.error} />
            <button
              type="submit"
              formAction={previewFormAction}
              className={buttonClass('outline', 'sm', 'mt-2')}
            >
              Count the audience
            </button>
          </div>
        </CardBody>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm text-ink">
          <Checkbox name="sendNow" defaultChecked />
          Send immediately
        </label>
        <div className="flex items-center gap-2">
          <Link href="/marketing" className={buttonClass('outline', 'md')}>Cancel</Link>
          <SubmitButton pendingLabel="Sending…">Create campaign</SubmitButton>
        </div>
      </div>
    </form>
  )
}
