import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mocks ---

const mockArn = 'arn:aws:sns:region:123456789012:topic';

class MockSnsTopic {
  arn = { apply: (fn: (v: string) => any) => fn(mockArn) };
  constructor(
    public name: string,
    public args: any
  ) {}
}

class MockBudget {
  constructor(
    public name: string,
    public args: any
  ) {}
}

const mockSnsTopic = vi.fn(function (name, args) {
  return new MockSnsTopic(name, args);
});
const mockBudget = vi.fn(function (name, args) {
  return new MockBudget(name, args);
});
const mockTopicPolicy = vi.fn(function (name, args) {
  return { name, args };
});

vi.stubGlobal('sst', {
  aws: {
    SnsTopic: mockSnsTopic,
  },
});

vi.stubGlobal('aws', {
  budgets: {
    Budget: mockBudget,
  },
  sns: {
    TopicPolicy: mockTopicPolicy,
  },
});

vi.stubGlobal('$app', {
  stage: 'prod',
});

// --- Imports ---
import { createBilling } from './billing';

describe('Billing Infrastructure', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('$app', { stage: 'prod' });
    process.env.BILLING_ALERT_EMAIL = 'test@example.com';
    process.env.BILLING_DAILY_LIMIT = '1';
    process.env.BILLING_SOURCE_ACCOUNT_ID = '123456789012';
  });

  it('should create a budget with the correct absolute thresholds even if limit is lower', () => {
    createBilling();

    expect(mockBudget).toHaveBeenCalled();
    const budgetArgs = mockBudget.mock.calls[0][1] as any;

    expect(budgetArgs.budgetType).toBe('COST');
    expect(budgetArgs.limitAmount).toBe('1');
    expect(budgetArgs.timeUnit).toBe('DAILY');

    const expectedThresholds = [1, 4, 16, 64, 256];
    expect(budgetArgs.notifications).toHaveLength(expectedThresholds.length);

    expectedThresholds.forEach((t, i) => {
      expect(budgetArgs.notifications[i].threshold).toBe(t);
      expect(budgetArgs.notifications[i].thresholdType).toBe('ABSOLUTE_VALUE');
    });
  });

  it('should not create billing resources if stage is not prod', () => {
    vi.stubGlobal('$app', { stage: 'dev' });
    const result = createBilling();
    expect(result).toEqual({});
    expect(mockBudget).not.toHaveBeenCalled();
  });

  it('should not include email subscribers when BILLING_ALERT_EMAIL is unset', () => {
    delete process.env.BILLING_ALERT_EMAIL;

    createBilling();

    expect(mockBudget).toHaveBeenCalled();
    const budgetArgs = mockBudget.mock.calls[0][1] as any;

    expect(budgetArgs.notifications[0].subscriberEmailAddresses).toEqual([]);
  });

  it('should default to $20 daily limit when BILLING_DAILY_LIMIT is unset', () => {
    delete process.env.BILLING_DAILY_LIMIT;

    createBilling();

    expect(mockBudget).toHaveBeenCalled();
    const budgetArgs = mockBudget.mock.calls[0][1] as any;

    expect(budgetArgs.limitAmount).toBe('20');
  });
});
