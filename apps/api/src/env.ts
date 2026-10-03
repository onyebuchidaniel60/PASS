import { ApiEnvSchema, type ApiEnv } from "@pass/contracts";

let cached: ApiEnv | null = null;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): ApiEnv {
  const parsed = ApiEnvSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return parsed.data;
}

export function env(): ApiEnv {
  if (cached === null) cached = loadEnv();
  return cached;
}

export function resetEnv(): void {
  cached = null;
}