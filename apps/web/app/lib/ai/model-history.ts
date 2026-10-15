export interface DialogueMessage {
  role: "user" | "assistant";
  content: string;
}
export const HISTORY_LIMIT = 12;

export function boundedHistory(messages: DialogueMessage[] = []): DialogueMessage[] {
  return messages
    .filter(
      (m) =>
        m &&
        ["user", "assistant"].includes(m.role) &&
        typeof m.content === "string" &&
        m.content.trim(),
    )
    .slice(-HISTORY_LIMIT)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 2400) }));
}

/** Bedrock receives genuine role-separated turns, not a transcript inside one user message. */
export function modelMessages(prompt: string, history: DialogueMessage[] = []) {
  const turns = boundedHistory(history);
  const bytes = (value: string) => new TextEncoder().encode(value).length;
  const budget = 32000;
  // Keep the current structured request intact; shed oldest turns before crossing the budget.
  if (bytes(prompt) > budget) throw new Error("Current request exceeds context budget");
  while (
    turns.length &&
    bytes(prompt) + turns.reduce((sum, turn) => sum + bytes(turn.content), 0) > budget
  )
    turns.shift();
  while (turns.length && turns[0].role !== "user") turns.shift();
  const messages: Array<{ role: "user" | "assistant"; content: Array<{ text: string }> }> = [];
  for (const turn of [...turns, { role: "user" as const, content: prompt }]) {
    const previous = messages[messages.length - 1];
    if (previous?.role === turn.role) previous.content.push({ text: turn.content });
    else messages.push({ role: turn.role, content: [{ text: turn.content }] });
  }
  return messages;
}
