import { z } from 'zod';

export type JobStatus =
  | 'PENDING'
  | 'VALIDATING'
  | 'QUEUED'
  | 'INSPECTING'
  | 'EXTRACTING_EVIDENCE'
  | 'ANALYZING_AI'
  | 'GENERATING_BLUEPRINT'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

export type ViewportPreset = 'mobile' | 'tablet' | 'desktop';

export interface TypographyToken {
  role: string;
  fontFamily: string;
  fontSize: string;
  fontWeight: string;
  lineHeight: string;
  sampleText?: string;
}

export interface ColorSwatch {
  hex: string;
  rgb?: string;
  usage: string;
  frequencyPercent?: number;
}

export interface SpacingMetric {
  token: string;
  value: string;
  context: string;
}

export interface DomNodeSummary {
  tag: string;
  role?: string;
  label: string;
  childrenCount: number;
  depth: number;
}

export interface ScreenshotRecord {
  id: string;
  viewportType: 'MOBILE' | 'TABLET' | 'DESKTOP';
  width: number;
  height: number;
  storageKey: string;
  fileSizeBytes: number;
  capturedAt: string;
}

export interface ObservedEvidenceView {
  id: string;
  pageUrl: string;
  pageTitle: string;
  domNodeCount: number;
  extractedAt: string;
  metaTags: Record<string, string>;
  typography: TypographyToken[];
  colors: ColorSwatch[];
  spacing: SpacingMetric[];
  domOutline: DomNodeSummary[];
  detectedSections: string[];
  screenshots: ScreenshotRecord[];
}

export interface ComponentNode {
  name: string;
  purpose: string;
  observedSource: string;
  props: string[];
  children?: ComponentNode[];
}

export interface StateInteractionSpec {
  component: string;
  trigger: string;
  expectedState: string;
  accessibilityNote: string;
}

export interface RecommendedStackItem {
  layer: string;
  choice: string;
  rationale: string;
}

export interface PromptPhaseItem {
  phase: number;
  title: string;
  objective: string;
  prompt: string;
}

export interface BlueprintArtifactView {
  id: string;
  version: string;
  isEditedByUser: boolean;
  generatedAt: string;
  updatedAt: string;
  summary: string;
  designTokens: {
    colors: Array<{ name: string; hex: string; role: string }>;
    typography: Array<{ token: string; font: string; size: string; weight: string }>;
    spacingScale: string[];
    radii: string[];
  };
  components: ComponentNode[];
  interactions: StateInteractionSpec[];
  recommendedStack: RecommendedStackItem[];
  prompts: PromptPhaseItem[];
  rawAntigravityMarkdown: string;
}

export interface AuditLogEntry {
  id: string;
  stage: string;
  level: 'INFO' | 'WARN' | 'ERROR';
  message: string;
  timestamp: string;
}

export interface AnalysisJobSummary {
  id: string;
  targetUrl: string;
  normalizedDomain: string;
  status: JobStatus;
  progressPercent: number;
  crawlDepth: number;
  viewports: ViewportPreset[];
  errorCode: string | null;
  errorMessage: string | null;
  durationMs: number | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  pageCount: number;
  hasBlueprint: boolean;
  isPreviewFixture?: boolean;
}

export interface AnalysisJobDetail extends AnalysisJobSummary {
  evidence: ObservedEvidenceView[];
  blueprint: BlueprintArtifactView | null;
  auditLogs: AuditLogEntry[];
}

/**
 * Client-side URL & analysis creation form schema matching PRD Section 3.1.
 */
export const CreateAnalysisFormSchema = z.object({
  targetUrl: z
    .string()
    .trim()
    .min(1, 'Please enter a website URL to inspect')
    .max(2048, 'URL cannot exceed 2048 characters')
    .refine((val) => {
      try {
        const parsed = new URL(val);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
      } catch {
        return false;
      }
    }, 'Enter a valid HTTP or HTTPS URL (for example, https://example.com)'),
  crawlDepth: z.number().int().min(1).max(5).default(1),
  viewports: z
    .array(z.enum(['mobile', 'tablet', 'desktop']))
    .min(1, 'Select at least one viewport to capture'),
});

export type CreateAnalysisFormInput = z.infer<typeof CreateAnalysisFormSchema>;

/**
 * Synchronous client pre-flight guard for obvious private/loopback hosts
 * (Mirrors server-side SSRF Policy rules in docs/SECURITY_ARCHITECTURE.md).
 */
export function detectObviousPrivateHost(urlString: string): string | null {
  try {
    const parsed = new URL(urlString);
    const host = parsed.hostname.toLowerCase();

    if (
      host === 'localhost' ||
      host.endsWith('.localhost') ||
      host.endsWith('.local') ||
      host.endsWith('.internal') ||
      host === '127.0.0.1' ||
      host === '0.0.0.0' ||
      host === '::1' ||
      host === '[::1]' ||
      host === '169.254.169.254' ||
      host.startsWith('10.') ||
      host.startsWith('192.168.') ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
    ) {
      return `Host "${host}" targets a private, loopback, or metadata address and will be blocked by the SSRF firewall.`;
    }

    if (parsed.port && !['80', '443', '8080', '8443'].includes(parsed.port)) {
      return `Port :${parsed.port} is outside the permitted web ports (80, 443, 8080, 8443).`;
    }

    return null;
  } catch {
    return null;
  }
}

export function safeJsonParse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
