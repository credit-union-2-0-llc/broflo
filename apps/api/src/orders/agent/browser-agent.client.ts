import { Injectable, Logger } from '@nestjs/common';

export interface AgentExecuteParams {
  jobId: string;
  retailerUrl: string;
  searchTerms: string;
  maxBudgetCents: number;
  shippingAddress: {
    name: string;
    address1: string;
    address2?: string;
    city: string;
    state: string;
    zip: string;
  };
  mode: 'preview' | 'place';
  stripeVirtualCardId?: string;
  virtualCardNumber?: string;
  virtualCardExp?: string;
  virtualCardCvc?: string;
}

export interface AgentStepResult {
  step_number: number;
  action: string;
  status: string;
  screenshot_url?: string;
  page_url?: string;
  ai_model_used?: string;
  ai_confidence?: number;
  metadata?: Record<string, unknown>;
}

export interface AgentExecuteResult {
  job_id: string;
  status: string;
  found_product_title?: string;
  found_product_price?: number;
  found_product_url?: string;
  found_product_image?: string;
  match_confidence?: number;
  confirmation_number?: string;
  failure_reason?: string;
  steps: AgentStepResult[];
  browser_session_id?: string;
}

@Injectable()
export class BrowserAgentClient {
  private readonly log = new Logger(BrowserAgentClient.name);
  private readonly baseUrl: string;
  private readonly serviceKey: string;

  constructor() {
    this.baseUrl = process.env.BROWSER_AGENT_URL || 'http://localhost:8001';
    this.serviceKey = process.env.BROWSER_AGENT_SERVICE_KEY || 'dev-browser-agent-key';
  }

  async execute(params: AgentExecuteParams): Promise<AgentExecuteResult> {
    this.log.log(`Executing agent for job ${params.jobId}, mode: ${params.mode}`);

    const body = {
      job_id: params.jobId,
      retailer_url: params.retailerUrl,
      search_terms: params.searchTerms,
      max_budget_cents: params.maxBudgetCents,
      shipping_address: params.shippingAddress,
      mode: params.mode,
      stripe_virtual_card_id: params.stripeVirtualCardId,
      virtual_card_number: params.virtualCardNumber,
      virtual_card_exp: params.virtualCardExp,
      virtual_card_cvc: params.virtualCardCvc,
    };

    const response = await fetch(`${this.baseUrl}/agent/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Service-Key': this.serviceKey,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(200000), // 3m20s (agent has 3m, plus buffer)
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`Browser agent returned ${response.status}: ${text}`);
    }

    return response.json() as Promise<AgentExecuteResult>;
  }

  async health(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/health`, {
        signal: AbortSignal.timeout(5000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}
