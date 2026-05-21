export type SubRuleCondition =
  | { type: 'losing_after_minute'; minute: number }
  | { type: 'drawing_after_minute'; minute: number }
  | { type: 'winning_after_minute'; minute: number };

export type SubRule = {
  condition: SubRuleCondition;
  playerOutId: string;
  playerInId: string;
  priority: number;
};

export const SUB_RULE_CONDITION_TYPES = [
  'losing_after_minute',
  'drawing_after_minute',
  'winning_after_minute',
] as const;

export const SUB_RULE_CONDITION_LABEL: Record<SubRuleCondition['type'], string> = {
  losing_after_minute: 'Если проигрываем после минуты',
  drawing_after_minute: 'Если ничья после минуты',
  winning_after_minute: 'Если ведём после минуты',
};

export const MAX_SUB_RULES = 3;

export function isValidConditionType(value: string): value is SubRuleCondition['type'] {
  return (SUB_RULE_CONDITION_TYPES as readonly string[]).includes(value);
}
