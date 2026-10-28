import { MessageCircle } from 'lucide-react'

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui'
import { useCustomer } from '@/features/customers/queries'
import { useOrganization } from '@/features/workspace/workspace-context'
import { formatDateTime } from '@/lib/datetime/format'
import { formatMoney } from '@/lib/money/money'
import {
  balanceDueMessage,
  contractSummaryMessage,
  messageLanguage,
  normalizeWhatsAppNumber,
  returnReminderMessage,
  whatsAppUrl,
  type RentalMessageContext,
} from '@/lib/whatsapp/whatsapp'

export interface RentalWhatsAppMenuProps {
  customerId: string
  customerName: string
  reference: string
  startsAt: string
  endsAt: string
  currency: string
  totalMinor: number
  balanceDueMinor: number
}

/**
 * Opens WhatsApp with the message already written, addressed to the renter.
 *
 * The employee presses send in WhatsApp; this product sends nothing and so
 * records nothing. The renter's phone is read from the customer record, and a
 * number that cannot be completed into an international one disables the menu
 * with the reason instead of opening a chat with the wrong person.
 */
export function RentalWhatsAppMenu({
  customerId,
  customerName,
  reference,
  startsAt,
  endsAt,
  currency,
  totalMinor,
  balanceDueMinor,
}: RentalWhatsAppMenuProps) {
  const organization = useOrganization()
  const customerQuery = useCustomer(customerId)
  const customer = customerQuery.data

  const number = normalizeWhatsAppNumber(
    customer?.phone ?? customer?.secondary_phone,
    organization.country_code,
  )
  const language = messageLanguage(customer?.preferred_locale ?? organization.locale)
  const formatLocale = language === 'es' ? 'es' : organization.locale
  const when = (iso: string) =>
    formatDateTime(new Date(iso), { locale: formatLocale, timeZone: organization.time_zone })

  const context: RentalMessageContext = {
    language,
    agencyName: organization.name,
    customerName,
    reference,
    startsAt: when(startsAt),
    endsAt: when(endsAt),
    total: formatMoney(totalMinor, currency, { locale: formatLocale }),
    balanceDue: formatMoney(balanceDueMinor, currency, { locale: formatLocale }),
  }

  const open = (text: string) => {
    if (!number) return
    window.open(whatsAppUrl(number, text), '_blank', 'noopener,noreferrer')
  }

  const reason = customerQuery.isLoading
    ? 'Loading the renter’s phone…'
    : !customer?.phone && !customer?.secondary_phone
      ? 'The renter has no phone number on file.'
      : 'The renter’s number needs its country code (for example +1 809 555 0123).'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary" leadingIcon={<MessageCircle />}>
          WhatsApp
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {number ? (
          <>
            <DropdownMenuLabel>Message {customerName}</DropdownMenuLabel>
            <DropdownMenuItem onSelect={() => open(returnReminderMessage(context))}>
              Return reminder
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => open(contractSummaryMessage(context))}>
              Contract and payment summary
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={balanceDueMinor <= 0}
              onSelect={() => open(balanceDueMessage(context))}
            >
              {balanceDueMinor > 0 ? 'Payment reminder' : 'Payment reminder (nothing owed)'}
            </DropdownMenuItem>
          </>
        ) : (
          <DropdownMenuItem disabled>{reason}</DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
