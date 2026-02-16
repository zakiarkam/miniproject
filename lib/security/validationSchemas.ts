import { z } from "zod";

export const eventCreationSchema = z.object({
  eventName: z
    .string()
    .min(1, "Event name is required")
    .max(200, "Event name too long")
    .refine((val) => !/<script/i.test(val), "Invalid characters detected"),

  selectedTab: z.string().min(1, "Event type is required"),

  eventLocation: z
    .string()
    .min(1, "Event location is required")
    .max(500, "Location too long")
    .refine((val) => !/<script/i.test(val), "Invalid characters detected"),

  eventStartDate: z.string().min(1, "Start date is required"),

  eventEndDate: z.string().min(1, "End date is required"),

  startTime: z.string().min(1, "Start time is required"),

  endTime: z.string().min(1, "End time is required"),

  description: z
    .string()
    .max(5000, "Description too long")
    .optional()
    .refine(
      (val) => !val || !/<script/i.test(val),
      "Invalid characters detected",
    ),

  coverImage: z
    .string()
    .url("Invalid image URL")
    .refine(
      (val) => !val.toLowerCase().startsWith("javascript:"),
      "Invalid URL protocol",
    )
    .refine(
      (val) => !val.toLowerCase().startsWith("data:"),
      "Data URLs not allowed",
    ),

  dashboardImage: z
    .string()
    .url("Invalid image URL")
    .refine(
      (val) => !val.toLowerCase().startsWith("javascript:"),
      "Invalid URL protocol",
    )
    .refine(
      (val) => !val.toLowerCase().startsWith("data:"),
      "Data URLs not allowed",
    ),

  organizationId: z.string().min(1, "Organization ID is required"),

  hostPageType: z.enum(["template", "pageBuilder", "uploadPage"]).optional(),

  pageBuilder: z.string().optional(),

  uploadPage: z.string().optional(),
});

/**
 * Post Creation Schema
 * Validates community post inputs
 */
export const postCreationSchema = z.object({
  userName: z
    .string()
    .min(1, "Username is required")
    .max(100, "Username too long")
    .refine((val) => !/<script/i.test(val), "Invalid characters detected"),

  userImage: z
    .string()
    .url("Invalid image URL")
    .refine(
      (val) => !val.toLowerCase().startsWith("javascript:"),
      "Invalid URL protocol",
    ),

  eventId: z.string().min(1, "Event ID is required"),

  description: z
    .string()
    .min(1, "Description is required")
    .max(2000, "Description too long")
    .refine((val) => !/<script/i.test(val), "Invalid characters detected")
    .refine((val) => !/on\w+\s*=/i.test(val), "Event handlers not allowed"),

  image: z
    .string()
    .url("Invalid image URL")
    .refine(
      (val) => !val.toLowerCase().startsWith("javascript:"),
      "Invalid URL protocol",
    ),
});

/**
 * Comment Creation Schema
 * Validates comment inputs
 */
export const commentCreationSchema = z.object({
  userId: z.string().min(1, "User ID is required"),

  userName: z
    .string()
    .min(1, "Username is required")
    .max(100, "Username too long")
    .refine((val) => !/<script/i.test(val), "Invalid characters detected"),

  userImage: z
    .string()
    .url("Invalid image URL")
    .refine(
      (val) => !val.toLowerCase().startsWith("javascript:"),
      "Invalid URL protocol",
    ),

  postId: z.string().min(1, "Post ID is required"),

  description: z
    .string()
    .min(1, "Comment is required")
    .max(1000, "Comment too long")
    .refine((val) => !/<script/i.test(val), "Invalid characters detected")
    .refine((val) => !/on\w+\s*=/i.test(val), "Event handlers not allowed"),
});

/**
 * HTML Upload Schema
 * Validates HTML file uploads
 */
export const htmlUploadSchema = z.object({
  fileName: z
    .string()
    .min(1, "Filename is required")
    .max(255, "Filename too long")
    .refine(
      (val) => val.endsWith(".html") || val.endsWith(".htm"),
      "Must be HTML file",
    ),

  fileSize: z.number().max(5 * 1024 * 1024, "File too large (max 5MB)"),

  content: z
    .string()
    .min(1, "HTML content is required")
    .refine(
      (val) => !/<script/i.test(val) || false,
      "Scripts not allowed in user uploads",
    ),
});

/**
 * Organization Creation Schema
 */
export const organizationCreationSchema = z.object({
  name: z
    .string()
    .min(1, "Organization name is required")
    .max(200, "Organization name too long")
    .refine((val) => !/<script/i.test(val), "Invalid characters detected"),

  email: z.string().email("Invalid email address"),

  description: z
    .string()
    .max(2000, "Description too long")
    .optional()
    .refine(
      (val) => !val || !/<script/i.test(val),
      "Invalid characters detected",
    ),
});

export function validateInput<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
): { success: true; data: T } | { success: false; errors: string[] } {
  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  const errors = result.error.errors.map(
    (err) => `${err.path.join(".")}: ${err.message}`,
  );

  return { success: false, errors };
}
