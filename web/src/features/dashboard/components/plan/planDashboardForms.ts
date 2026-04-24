import { z } from 'zod';

const amountStringSchema = z
  .string()
  .trim()
  .min(1, 'Укажите сумму')
  .refine((value) => {
    const normalized = value.replace(',', '.');
    const parsed = Number(normalized);
    return Number.isFinite(parsed) && parsed >= 0;
  }, 'Введите корректную сумму');

export const rootPlanSchema = z.object({
  name: z.string().trim().min(1, 'Укажите название плана'),
  periodStart: z.string().trim().min(10, 'Укажите дату начала'),
  planAmount: amountStringSchema,
});

export const subplanSchema = z.object({
  name: z.string().trim().min(1, 'Укажите название подплана'),
  periodStart: z.string().trim().min(10, 'Укажите дату начала'),
  amount: amountStringSchema.refine((value) => Number(value.replace(',', '.')) > 0, 'Сумма должна быть больше нуля'),
});

export const delegateSchema = z.object({
  childUserId: z.string().trim().min(1, 'Выберите подчиненного'),
  childPeriodStart: z.string().trim().min(10, 'Укажите дату начала'),
  childPlanAmount: amountStringSchema.refine((value) => Number(value.replace(',', '.')) > 0, 'Сумма должна быть больше нуля'),
});

export const editSchema = z.object({
  name: z.string().trim().min(1, 'Укажите название плана'),
  planAmount: amountStringSchema,
});

export type RootPlanFormValues = z.infer<typeof rootPlanSchema>;
export type SubplanFormValues = z.infer<typeof subplanSchema>;
export type DelegateFormValues = z.infer<typeof delegateSchema>;
export type EditFormValues = z.infer<typeof editSchema>;

export const parseAmount = (value: string) => Number(value.replace(',', '.'));
