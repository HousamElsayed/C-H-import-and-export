import { describe, expect, it } from 'vitest'
import { renderTemplate } from './template-tokens'

describe('renderTemplate', () => {
  it('substitutes known tokens', () => {
    const result = renderTemplate('Hi {{client_first_name}}, see you on {{date}}.', {
      client_first_name: 'Elif',
      date: '13 September',
    })
    expect(result).toBe('Hi Elif, see you on 13 September.')
  })

  it('tolerates whitespace inside the braces', () => {
    expect(renderTemplate('{{ clinic_name }}', { clinic_name: 'Sala' })).toBe('Sala')
  })

  it('strips unknown tokens rather than leaking the placeholder', () => {
    expect(renderTemplate('Hello {{missing}}!', {})).toBe('Hello !')
  })

  it('leaves ordinary braces alone', () => {
    expect(renderTemplate('cost {not a token}', {})).toBe('cost {not a token}')
  })
})
