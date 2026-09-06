import { z } from 'zod';

export const uuidSchema = z
  .string()
  .trim()
  .regex(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/, 'Invalid UUID format');

// Auth Schemas
export const registerSchema = {
  body: z.object({
    email: z
      .string()
      .trim()
      .email('Invalid email format')
      .max(255, 'Email must not exceed 255 characters'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .max(128, 'Password must not exceed 128 characters'),
    name: z
      .string()
      .trim()
      .min(1, 'Name cannot be empty')
      .max(100, 'Name must not exceed 100 characters')
      .optional(),
  }),
};

export const loginSchema = {
  body: z.object({
    email: z
      .string()
      .trim()
      .email('Invalid email format')
      .max(255, 'Email must not exceed 255 characters'),
    password: z
      .string()
      .min(1, 'Password is required')
      .max(128, 'Password must not exceed 128 characters'),
  }),
};

// Dataset Schemas
export const createDatasetSchema = {
  body: z.object({
    name: z
      .string()
      .trim()
      .min(1, 'Dataset name is required and cannot be empty')
      .max(255, 'Dataset name must be at most 255 characters'),
    description: z
      .string()
      .trim()
      .max(1000, 'Description must not exceed 1000 characters')
      .nullable()
      .optional(),
    user_id: uuidSchema.optional(),
  }),
};

export const datasetIdParamSchema = {
  params: z.object({
    datasetId: uuidSchema,
  }),
};

export const idParamSchema = {
  params: z.object({
    id: uuidSchema,
  }),
};

export const comparisonParamSchema = {
  params: z.object({
    comparison_id: uuidSchema,
  }),
};

export const runComparisonSchema = {
  params: z.object({
    id: uuidSchema,
  }),
  body: z
    .object({
      base_version_id: uuidSchema,
      target_version_id: uuidSchema,
    })
    .refine((data) => data.base_version_id !== data.target_version_id, {
      message: 'Base version and target version cannot be identical',
      path: ['target_version_id'],
    }),
};

export const historyQuerySchema = {
  params: z.object({
    id: uuidSchema,
  }),
  query: z.object({
    limit: z
      .string()
      .regex(/^\d+$/, 'Limit must be a positive integer')
      .transform(Number)
      .pipe(z.number().int().min(1, 'Limit must be at least 1').max(100, 'Limit cannot exceed 100'))
      .optional(),
    offset: z
      .string()
      .regex(/^\d+$/, 'Offset must be a non-negative integer')
      .transform(Number)
      .pipe(z.number().int().min(0, 'Offset cannot be negative'))
      .optional(),
  }),
};

export const aiInterpretationSchema = {
  params: z.object({
    id: uuidSchema,
  }),
  body: z
    .object({
      version_id: uuidSchema.optional(),
    })
    .optional(),
};

// Analysis Schemas
export const runAnalysisSchema = {
  body: z.object({
    version_id: uuidSchema,
  }),
};

export const jobIdParamSchema = {
  params: z.object({
    job_id: uuidSchema,
  }),
};

export const versionIdParamSchema = {
  params: z.object({
    versionId: uuidSchema,
  }),
};
