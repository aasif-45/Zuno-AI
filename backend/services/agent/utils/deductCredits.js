/**
 * Per-agent credit deduction helper.
 *
 * NOTE: The authoritative credit deduction happens centrally in
 * agent.controller.js (post-execution call to the auth service's
 * /deduct-credits endpoint based on the actually executed agent).
 *
 * This helper exists so individual agents (pdfRag, imageAnalyzer) can call
 * deductCredits(userId, type) without crashing. It is a safe no-op by default
 * to avoid double-charging. If you want agents to deduct independently,
 * replace the body with a call to your auth service.
 *
 * @param {string} userId - The requesting user's id.
 * @param {string} agentType - e.g. 'pdf', 'vision'.
 */
export const deductCredits = async (userId, agentType) => {
  if (!userId) return { deducted: 0 };

  // Central deduction in the controller already handles the charge.
  console.log(`[Credits] (agent-level no-op) Would deduct for user "${userId}" on "${agentType}". Handled centrally in controller.`);
  return { deducted: 0, agent: agentType };
};

export default deductCredits;
