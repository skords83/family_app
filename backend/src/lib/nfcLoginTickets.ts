const TICKET_TTL_MS = 15_000;

interface Ticket {
  userId: string;
  expiresAt: number;
  claimed: boolean;
}

let currentTicket: Ticket | null = null;

export function createTicket(userId: string): void {
  currentTicket = { userId, expiresAt: Date.now() + TICKET_TTL_MS, claimed: false };
}

function isValid(ticket: Ticket | null): ticket is Ticket {
  return ticket !== null && !ticket.claimed && ticket.expiresAt > Date.now();
}

export function peekPending(): boolean {
  return isValid(currentTicket);
}

export function tryClaim(): { userId: string } | null {
  if (!isValid(currentTicket)) return null;
  currentTicket.claimed = true;
  return { userId: currentTicket.userId };
}
