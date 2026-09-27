import { getContext } from '@microsoft/power-apps/app';
import type { IOperationResult } from '@microsoft/power-apps/data';
import {
  Kyc_caseactivitiesService,
  Kyc_casesService,
  Kyc_verificationchecksService,
  Kyc_caseactivitiesModel,
  Kyc_casesModel,
  Kyc_verificationchecksModel,
} from './generated';
import {
  FINAL_STATUSES,
  type ActivityEntry,
  type CaseDetail,
  type CaseStatus,
  type CheckResult,
  type DecisionAction,
  type QueueCase,
  type RiskLevel,
  type VerificationCheck,
} from './types';

type CaseRow = Kyc_casesModel.Kyc_cases;
type CheckRow = Kyc_verificationchecksModel.Kyc_verificationchecks;
type ActivityRow = Kyc_caseactivitiesModel.Kyc_caseactivities;

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly field?: string,
  ) {
    super(message);
  }
}

// Dataverse choice values (see dataverse/scripts/schema.ts) <-> the labels Part A uses.
const STATUS_VALUE: Record<CaseStatus, Kyc_casesModel.Kyc_caseskyc_status> = {
  pending: 100000000,
  info_requested: 100000001,
  approved: 100000002,
  escalated: 100000003,
};
const RISK_VALUE: Record<RiskLevel, Kyc_casesModel.Kyc_caseskyc_risklevel> = {
  low: 100000000,
  medium: 100000001,
  high: 100000002,
};
const CHECK_VALUE: Record<CheckResult, Kyc_verificationchecksModel.Kyc_verificationcheckskyc_result> = {
  pass: 100000000,
  warn: 100000001,
  fail: 100000002,
};
const ACTION_VALUE: Record<string, Kyc_caseactivitiesModel.Kyc_caseactivitieskyc_action> = {
  submitted: 100000000,
  assigned: 100000001,
  request_info: 100000002,
  info_received: 100000003,
  approve: 100000004,
  escalate: 100000005,
  note: 100000006,
  flagged: 100000007,
};
const DECISION_STATUS: Record<DecisionAction, CaseStatus> = {
  approve: 'approved',
  request_info: 'info_requested',
  escalate: 'escalated',
};

function invert<K extends string, V extends number>(map: Record<K, V>): Map<V, K> {
  return new Map(Object.entries(map).map(([k, v]) => [v as V, k as K]));
}
const STATUS_KEY = invert(STATUS_VALUE);
const RISK_KEY = invert(RISK_VALUE);
const CHECK_KEY = invert(CHECK_VALUE);
const ACTION_KEY = invert(ACTION_VALUE);

function unwrap<T>(result: IOperationResult<T>, what: string): T {
  if (!result.success) {
    const err = result.error;
    const status = err && 'status' in err && typeof err.status === 'number' ? err.status : 500;
    throw new ApiError(err?.message ?? `${what} failed`, status);
  }
  return result.data;
}

function odataString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

const CASE_COLUMNS = [
  'kyc_caseid',
  'kyc_name',
  'kyc_applicantname',
  'kyc_submittedat',
  'kyc_status',
  'kyc_assignedreviewer',
  'kyc_reviewreason',
  'kyc_risklevel',
  'kyc_flagged',
];
const DETAIL_COLUMNS = [
  ...CASE_COLUMNS,
  'kyc_email',
  'kyc_dateofbirth',
  'kyc_nationality',
  'kyc_countryofresidence',
  'kyc_address',
  'kyc_documenttype',
  'kyc_documentnumber',
  'kyc_product',
  'kyc_declaredoccupation',
  'kyc_expectedmonthlyvolume',
  'kyc_decidedat',
];

function toQueueCase(row: CaseRow): QueueCase {
  return {
    id: row.kyc_name,
    applicantName: row.kyc_applicantname,
    submittedAt: row.kyc_submittedat,
    status: STATUS_KEY.get(row.kyc_status) ?? 'pending',
    assignedReviewer: row.kyc_assignedreviewer ?? '',
    reviewReason: row.kyc_reviewreason ?? '',
    riskLevel: (row.kyc_risklevel !== undefined && RISK_KEY.get(row.kyc_risklevel)) || 'low',
    flagged: row.kyc_flagged ?? false,
  };
}

function toCheck(row: CheckRow): VerificationCheck {
  return { name: row.kyc_name, result: CHECK_KEY.get(row.kyc_result) ?? 'warn', detail: row.kyc_detail ?? '' };
}

function toActivity(row: ActivityRow): ActivityEntry {
  return {
    id: row.kyc_caseactivityid,
    action: ACTION_KEY.get(row.kyc_action) ?? 'note',
    reason: row.kyc_reason,
    reviewer: row.kyc_reviewer,
    createdAt: row.kyc_occurredat,
  };
}

async function findCaseRow(reference: string, select: string[]): Promise<CaseRow> {
  const rows = unwrap(
    await Kyc_casesService.getAll({ select, filter: `kyc_name eq ${odataString(reference)}`, top: 1 }),
    'Loading case',
  );
  const row = rows[0];
  if (!row) throw new ApiError(`Case ${reference} not found`, 404);
  return row;
}

async function buildDetail(row: CaseRow): Promise<CaseDetail> {
  const byCase = `_kyc_case_value eq ${row.kyc_caseid}`;
  const [checks, history] = await Promise.all([
    Kyc_verificationchecksService.getAll({
      select: ['kyc_verificationcheckid', 'kyc_name', 'kyc_result', 'kyc_detail', 'kyc_order'],
      filter: byCase,
      orderBy: ['kyc_order asc'],
    }),
    Kyc_caseactivitiesService.getAll({
      select: ['kyc_caseactivityid', 'kyc_action', 'kyc_reason', 'kyc_reviewer', 'kyc_occurredat'],
      filter: byCase,
      orderBy: ['kyc_occurredat asc'],
    }),
  ]);
  return {
    ...toQueueCase(row),
    applicant: {
      email: row.kyc_email ?? '',
      dateOfBirth: row.kyc_dateofbirth ?? '',
      nationality: row.kyc_nationality ?? '',
      countryOfResidence: row.kyc_countryofresidence ?? '',
      address: row.kyc_address ?? '',
      documentType: row.kyc_documenttype ?? '',
      documentNumber: row.kyc_documentnumber ?? '',
      product: row.kyc_product ?? '',
      declaredOccupation: row.kyc_declaredoccupation ?? '',
      expectedMonthlyVolume: row.kyc_expectedmonthlyvolume ?? '',
    },
    decidedAt: row.kyc_decidedat ?? null,
    checks: unwrap(checks, 'Loading checks').map(toCheck),
    history: unwrap(history, 'Loading history').map(toActivity),
  };
}

export const api = {
  /** The signed-in Power Apps user; replaces Part A's "Acting as" picker. */
  currentUser: async (): Promise<string> => {
    const ctx = await getContext();
    return ctx.user.fullName || ctx.user.userPrincipalName || 'Unknown reviewer';
  },

  listCases: async (params: { status?: string; q?: string }): Promise<QueueCase[]> => {
    const filters: string[] = [];
    if (params.status && params.status !== 'all') {
      const value = STATUS_VALUE[params.status as CaseStatus];
      if (value === undefined) throw new ApiError(`Unknown status '${params.status}'`, 400, 'status');
      filters.push(`kyc_status eq ${value}`);
    }
    const q = params.q?.trim();
    if (q) {
      const term = odataString(q);
      filters.push(`(contains(kyc_applicantname, ${term}) or contains(kyc_name, ${term}))`);
    }
    const rows = unwrap(
      await Kyc_casesService.getAll({
        select: CASE_COLUMNS,
        filter: filters.length ? filters.join(' and ') : undefined,
        orderBy: ['kyc_submittedat asc'],
        top: 200,
      }),
      'Loading queue',
    );
    return rows.map(toQueueCase);
  },

  getCase: async (reference: string): Promise<CaseDetail> => buildDetail(await findCaseRow(reference, DETAIL_COLUMNS)),

  /**
   * Records a decision as an activity row, then moves the case. These are two Dataverse
   * writes from the browser (no transaction), and the final-state check below runs
   * client-side — the same trade-off as Parts B and B′, unlike Part A's API.
   */
  submitDecision: async (
    reference: string,
    body: { action: DecisionAction; reason: string; reviewer: string },
  ): Promise<CaseDetail> => {
    const nextStatus = DECISION_STATUS[body.action];
    if (!nextStatus) throw new ApiError(`Unknown action '${body.action}'`, 400, 'action');
    const reason = body.reason.trim();
    if (reason.length < 10 || reason.length > 2000) {
      throw new ApiError('A written reason of 10–2000 characters is required.', 400, 'reason');
    }
    const current = await findCaseRow(reference, ['kyc_caseid', 'kyc_name', 'kyc_status']);
    const currentStatus = STATUS_KEY.get(current.kyc_status) ?? 'pending';
    if (FINAL_STATUSES.includes(currentStatus)) {
      throw new ApiError(`Case ${reference} is already ${currentStatus} and cannot be changed.`, 409);
    }

    const now = new Date().toISOString();
    const actionLabel = Kyc_caseactivitiesModel.Kyc_caseactivitieskyc_action[ACTION_VALUE[body.action]!];
    const activity = unwrap(
      await Kyc_caseactivitiesService.create({
        kyc_name: `${actionLabel} by ${body.reviewer}`,
        kyc_action: ACTION_VALUE[body.action]!,
        kyc_reason: reason,
        kyc_reviewer: body.reviewer,
        kyc_occurredat: now,
        'kyc_Case@odata.bind': `/kyc_cases(${current.kyc_caseid})`,
        statecode: 0,
      }),
      'Recording decision',
    );
    const updated = await Kyc_casesService.update(current.kyc_caseid, {
      kyc_status: STATUS_VALUE[nextStatus],
      ...(FINAL_STATUSES.includes(nextStatus) ? { kyc_decidedat: now } : {}),
    });
    if (!updated.success) {
      // best-effort compensation so a failed status change does not leave a phantom decision
      await Kyc_caseactivitiesService.delete(activity.kyc_caseactivityid).catch(() => undefined);
      unwrap(updated, 'Updating case');
    }
    return api.getCase(reference);
  },
};
