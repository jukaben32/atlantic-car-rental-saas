import { describe, expect, it } from 'vitest'

import {
  balanceDueMessage,
  invitationMessage,
  messageLanguage,
  normalizeWhatsAppNumber,
  returnReminderMessage,
  whatsAppUrl,
  type RentalMessageContext,
} from './whatsapp'

const context: RentalMessageContext = {
  language: 'es',
  agencyName: 'Atlantic Car Rental',
  customerName: 'María Pérez',
  reference: 'R-0042',
  startsAt: '01 nov 2026',
  endsAt: '05 nov 2026',
  total: 'US$400.00',
  balanceDue: 'US$150.00',
}

describe('normalizeWhatsAppNumber', () => {
  it('keeps an international number written with a plus', () => {
    expect(normalizeWhatsAppNumber('+1 (809) 555-0123', 'DO')).toBe('18095550123')
  })

  it('reads a 00 prefix as an international number', () => {
    expect(normalizeWhatsAppNumber('0034 600 123 456', null)).toBe('34600123456')
  })

  it('completes a national number from the agency country', () => {
    expect(normalizeWhatsAppNumber('809-555-0123', 'DO')).toBe('18095550123')
  })

  it('does not prefix a number that already has the country code', () => {
    expect(normalizeWhatsAppNumber('18095550123', 'DO')).toBe('18095550123')
  })

  it('refuses a national number when the country is unknown', () => {
    expect(normalizeWhatsAppNumber('809-555-0123', null)).toBeNull()
    expect(normalizeWhatsAppNumber('809-555-0123', 'ZZ')).toBeNull()
  })

  it('refuses empty, non-numeric and implausible numbers', () => {
    expect(normalizeWhatsAppNumber(null, 'DO')).toBeNull()
    expect(normalizeWhatsAppNumber('  ', 'DO')).toBeNull()
    expect(normalizeWhatsAppNumber('abc', 'DO')).toBeNull()
    expect(normalizeWhatsAppNumber('+123', 'DO')).toBeNull()
    expect(normalizeWhatsAppNumber('+1234567890123456', 'DO')).toBeNull()
  })
})

describe('whatsAppUrl', () => {
  it('encodes the message and addresses the number', () => {
    expect(whatsAppUrl('18095550123', 'Hola & adiós?')).toBe(
      'https://wa.me/18095550123?text=Hola%20%26%20adi%C3%B3s%3F',
    )
  })

  it('lets the sender choose the recipient when there is no number', () => {
    expect(whatsAppUrl(null, 'x')).toBe('https://wa.me/?text=x')
  })
})

describe('messages', () => {
  it('speaks Spanish for Spanish locales and English otherwise', () => {
    expect(messageLanguage('es-DO')).toBe('es')
    expect(messageLanguage('en-US')).toBe('en')
    expect(messageLanguage(null)).toBe('en')
  })

  it('greets by first name and names the agency and rental', () => {
    const text = returnReminderMessage(context)
    expect(text).toContain('Hola María')
    expect(text).toContain('Atlantic Car Rental')
    expect(text).toContain('R-0042')
    expect(text).toContain('05 nov 2026')
  })

  it('states the balance in the balance message', () => {
    expect(balanceDueMessage({ ...context, language: 'en' })).toContain('US$150.00')
  })

  it('puts the link in the invitation', () => {
    expect(invitationMessage('en', 'Atlantic', 'Manager', 'https://x.test/a?t=1')).toContain(
      'https://x.test/a?t=1',
    )
  })
})
