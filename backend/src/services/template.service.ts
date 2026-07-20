/**
 * Template personalization service.
 * Replaces {{variable}} placeholders with actual lead data.
 */

export interface TemplateVariables {
  firstName?: string;
  lastName?: string;
  fullName?: string;
  company?: string;
  headline?: string;
  location?: string;
  [key: string]: string | undefined;
}

/**
 * Render a template body by substituting all {{variable}} placeholders.
 */
export function renderTemplate(body: string, vars: TemplateVariables): string {
  return body.replace(/{{(\w+)}}/g, (_, key) => vars[key] ?? `{{${key}}}`);
}

/**
 * Extract variable names used in a template body.
 */
export function extractVariables(body: string): string[] {
  const matches = body.match(/{{(\w+)}}/g) ?? [];
  return [...new Set(matches.map((m) => m.replace(/[{}]/g, '')))];
}

/**
 * Preview a template with sample data.
 */
export function previewTemplate(body: string): string {
  const sampleVars: TemplateVariables = {
    firstName: 'Alex',
    lastName: 'Johnson',
    fullName: 'Alex Johnson',
    company: 'Acme Corp',
    headline: 'Software Engineer at Acme Corp',
    location: 'San Francisco, CA',
  };
  return renderTemplate(body, sampleVars);
}
