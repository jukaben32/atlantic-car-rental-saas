/**
 * WhatsApp click-to-chat links.
 *
 * No API, no credentials, no provider: a `wa.me` link opens WhatsApp on the
 * employee's own device with the message already written, and the employee
 * presses send. Nothing is sent by this product, so nothing here can claim a
 * message was delivered.
 */

/**
 * International calling codes for the countries an agency is likely to run in.
 * A national number is only completed when the agency's country is listed;
 * otherwise the number must already carry its own country code.
 */
const CALLING_CODES: Readonly<Record<string, string>> = {
  AR: '54',
  BR: '55',
  CA: '1',
  CL: '56',
  CO: '57',
  CR: '506',
  DO: '1',
  EC: '593',
  ES: '34',
  GT: '502',
  HN: '504',
  MX: '52',
  PA: '507',
  PE: '51',
  PR: '1',
  US: '1',
  UY: '598',
  VE: '58',
}

/** E.164 allows at most 15 digits; fewer than 8 cannot be a full number. */
const MIN_DIGITS = 8
const MAX_DIGITS = 15

/**
 * The digits WhatsApp wants (country code first, no `+`), or null when the
 * number cannot be completed with confidence.
 */
export function normalizeWhatsAppNumber(
  raw: string | null | undefined,
  countryCode: string | null | undefined,
): string | null {
  if (!raw) return null
  const trimmed = raw.trim()
  const digits = trimmed.replace(/\D/g, '')
  if (digits === '') return null

  let full: string
  if (trimmed.startsWith('+')) {
    full = digits
  } else if (digits.startsWith('00')) {
    full = digits.slice(2)
  } else {
    const calling = countryCode ? CALLING_CODES[countryCode.toUpperCase()] : undefined
    if (!calling) return null
    const national = digits.replace(/^0+/, '')
    // A number that already starts with the country code and has the length of
    // a full international number is left alone.
    full =
      national.startsWith(calling) && national.length >= calling.length + 9
        ? national
        : `${calling}${national}`
  }

  return full.length >= MIN_DIGITS && full.length <= MAX_DIGITS ? full : null
}

/**
 * The link. A null number gives a link that lets the employee choose the
 * recipient in WhatsApp, which is what an invitation needs: the invitee's phone
 * is not known to this product.
 */
export function whatsAppUrl(number: string | null, text: string): string {
  const query = `text=${encodeURIComponent(text)}`
  return number ? `https://wa.me/${number}?${query}` : `https://wa.me/?${query}`
}

export type MessageLanguage = 'es' | 'en'

export function messageLanguage(locale: string | null | undefined): MessageLanguage {
  return locale?.toLowerCase().startsWith('es') ? 'es' : 'en'
}

export interface RentalMessageContext {
  readonly language: MessageLanguage
  readonly agencyName: string
  readonly customerName: string
  readonly reference: string
  /** Already formatted for the agency's locale and time zone. */
  readonly startsAt: string
  readonly endsAt: string
  /** Already formatted with the currency. */
  readonly total: string
  readonly balanceDue: string
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name
}

export function returnReminderMessage(c: RentalMessageContext): string {
  return c.language === 'es'
    ? `Hola ${firstName(c.customerName)}, le escribe ${c.agencyName}. Le recordamos que su alquiler ${c.reference} termina el ${c.endsAt}. Si necesita extenderlo, avísenos con tiempo. ¡Gracias!`
    : `Hi ${firstName(c.customerName)}, this is ${c.agencyName}. A reminder that your rental ${c.reference} ends on ${c.endsAt}. If you need to extend it, let us know in advance. Thank you!`
}

export function contractSummaryMessage(c: RentalMessageContext): string {
  return c.language === 'es'
    ? `Hola ${firstName(c.customerName)}, le escribe ${c.agencyName}. Resumen de su alquiler ${c.reference}: del ${c.startsAt} al ${c.endsAt}. Total: ${c.total}. Saldo pendiente: ${c.balanceDue}. ¡Gracias por elegirnos!`
    : `Hi ${firstName(c.customerName)}, this is ${c.agencyName}. Summary of your rental ${c.reference}: ${c.startsAt} to ${c.endsAt}. Total: ${c.total}. Balance due: ${c.balanceDue}. Thank you for choosing us!`
}

export function balanceDueMessage(c: RentalMessageContext): string {
  return c.language === 'es'
    ? `Hola ${firstName(c.customerName)}, le escribe ${c.agencyName}. Su alquiler ${c.reference} tiene un saldo pendiente de ${c.balanceDue}. Por favor comuníquese con nosotros para coordinar el pago. ¡Gracias!`
    : `Hi ${firstName(c.customerName)}, this is ${c.agencyName}. Your rental ${c.reference} has an outstanding balance of ${c.balanceDue}. Please get in touch to arrange payment. Thank you!`
}

export function invitationMessage(
  language: MessageLanguage,
  agencyName: string,
  roleLabel: string,
  link: string,
): string {
  return language === 'es'
    ? `Te invito a unirte al equipo de ${agencyName} como ${roleLabel}. Abre este enlace personal para aceptar (no lo compartas): ${link}`
    : `You are invited to join the ${agencyName} team as ${roleLabel}. Open this personal link to accept (do not share it): ${link}`
}
