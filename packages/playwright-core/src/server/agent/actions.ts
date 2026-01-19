/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { z as zod } from '../../mcpBundle';
import type * as z from 'zod';

const modifiersSchema = zod.array(
    zod.enum(['Alt', 'Control', 'ControlOrMeta', 'Meta', 'Shift'])
);

const navigateActionSchema = zod.object({
  method: zod.literal('navigate'),
  url: zod.string(),
});
export type NavigateAction = z.infer<typeof navigateActionSchema>;

const clickActionSchema = zod.object({
  method: zod.literal('click'),
  selector: zod.string(),
  button: zod.enum(['left', 'right', 'middle']).optional(),
  clickCount: zod.number().optional(),
  modifiers: modifiersSchema.optional(),
});
export type ClickAction = z.infer<typeof clickActionSchema>;

const dragActionSchema = zod.object({
  method: zod.literal('drag'),
  sourceSelector: zod.string(),
  targetSelector: zod.string(),
});
export type DragAction = z.infer<typeof dragActionSchema>;

const hoverActionSchema = zod.object({
  method: zod.literal('hover'),
  selector: zod.string(),
  modifiers: modifiersSchema.optional(),
});
export type HoverAction = z.infer<typeof hoverActionSchema>;

const selectOptionActionSchema = zod.object({
  method: zod.literal('selectOption'),
  selector: zod.string(),
  labels: zod.array(zod.string()),
});
export type SelectOptionAction = z.infer<typeof selectOptionActionSchema>;

const pressActionSchema = zod.object({
  method: zod.literal('pressKey'),
  key: zod.string(),
});
export type PressAction = z.infer<typeof pressActionSchema>;

const pressSequentiallyActionSchema = zod.object({
  method: zod.literal('pressSequentially'),
  selector: zod.string(),
  text: zod.string(),
  submit: zod.boolean().optional(),
});
export type PressSequentiallyAction = z.infer<typeof pressSequentiallyActionSchema>;

const fillActionSchema = zod.object({
  method: zod.literal('fill'),
  selector: zod.string(),
  text: zod.string(),
  submit: zod.boolean().optional(),
});
export type FillAction = z.infer<typeof fillActionSchema>;

const setCheckedSchema = zod.object({
  method: zod.literal('setChecked'),
  selector: zod.string(),
  checked: zod.boolean(),
});
export type SetChecked = z.infer<typeof setCheckedSchema>;

const expectVisibleSchema = zod.object({
  method: zod.literal('expectVisible'),
  selector: zod.string(),
  isNot: zod.boolean().optional(),
});
export type ExpectVisible = z.infer<typeof expectVisibleSchema>;

const expectValueSchema = zod.object({
  method: zod.literal('expectValue'),
  selector: zod.string(),
  type: zod.enum(['textbox', 'checkbox', 'radio', 'combobox', 'slider']),
  value: zod.string(),
  isNot: zod.boolean().optional(),
});
export type ExpectValue = z.infer<typeof expectValueSchema>;

const expectAriaSchema = zod.object({
  method: zod.literal('expectAria'),
  template: zod.string(),
  isNot: zod.boolean().optional(),
});
export type ExpectAria = z.infer<typeof expectAriaSchema>;

const expectURLSchema = zod.object({
  method: zod.literal('expectURL'),
  value: zod.string().optional(),
  regex: zod.string().optional(),
  isNot: zod.boolean().optional(),
});
export type ExpectURL = z.infer<typeof expectURLSchema>;

const expectTitleSchema = zod.object({
  method: zod.literal('expectTitle'),
  value: zod.string(),
  isNot: zod.boolean().optional(),
});
export type ExpectTitle = z.infer<typeof expectTitleSchema>;

const actionSchema = zod.discriminatedUnion('method', [
  navigateActionSchema,
  clickActionSchema,
  dragActionSchema,
  hoverActionSchema,
  selectOptionActionSchema,
  pressActionSchema,
  pressSequentiallyActionSchema,
  fillActionSchema,
  setCheckedSchema,
  expectVisibleSchema,
  expectValueSchema,
  expectAriaSchema,
  expectURLSchema,
  expectTitleSchema,
]);
export type Action = z.infer<typeof actionSchema>;

const actionWithCodeSchema = actionSchema.and(zod.object({
  code: zod.string(),
}));
export type ActionWithCode = z.infer<typeof actionWithCodeSchema>;

export const cachedActionsSchema = zod.record(zod.string(), zod.object({
  actions: zod.array(actionWithCodeSchema),
}));
export type CachedActions = z.infer<typeof cachedActionsSchema>;
