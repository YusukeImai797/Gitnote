import { toast } from "sonner";
import type { ApiError } from "@/types";

// Error code to user-friendly message mapping
const ERROR_MESSAGES: Record<string, string> = {
  // Repository errors
  'REPO_NOT_FOUND': 'リポジトリが見つかりません',
  'REPO_ACCESS_DENIED': 'リポジトリへのアクセス権限がありません',
  'REPO_NOT_CONNECTED': 'リポジトリが接続されていません',

  // GitHub API errors
  'GITHUB_API_ERROR': 'GitHub APIでエラーが発生しました',
  'GITHUB_RATE_LIMIT': 'GitHub APIのレート制限に達しました。しばらく待ってから再試行してください',
  'GITHUB_UNAUTHORIZED': 'GitHub認証が無効です。再度ログインしてください',

  // Note/File errors
  'NOTE_NOT_FOUND': 'ノートが見つかりません',
  'FILE_NOT_FOUND': 'ファイルが見つかりません',
  'CONFLICT': 'リモートでファイルが変更されています。競合を解決してください',

  // Validation errors
  'INVALID_INPUT': '入力値が不正です',
  'MISSING_REQUIRED_FIELD': '必須フィールドが入力されていません',

  // Network errors
  'NETWORK_ERROR': 'ネットワークエラーが発生しました',
  'TIMEOUT': 'リクエストがタイムアウトしました',

  // Server errors
  'INTERNAL_SERVER_ERROR': 'サーバーエラーが発生しました',
  'SERVICE_UNAVAILABLE': 'サービスが一時的に利用できません',
};

/**
 * Handle API errors and display appropriate toast messages
 */
export async function handleApiError(response: Response): Promise<never> {
  let errorData: ApiError;

  try {
    errorData = await response.json();
  } catch {
    // If response is not JSON, create a generic error
    errorData = {
      error: `HTTP ${response.status}: ${response.statusText}`,
      code: `HTTP_${response.status}`
    };
  }

  const message = errorData.code
    ? ERROR_MESSAGES[errorData.code] || errorData.error
    : errorData.error;

  toast.error(message);

  throw new Error(message);
}

/**
 * Wrapper for fetch with automatic error handling
 */
export async function fetchWithErrorHandling(
  url: string,
  options?: RequestInit
): Promise<Response> {
  try {
    const response = await fetch(url, options);

    if (!response.ok) {
      await handleApiError(response);
    }

    return response;
  } catch (error) {
    if (error instanceof TypeError) {
      // Network error
      toast.error(ERROR_MESSAGES.NETWORK_ERROR);
      throw new Error(ERROR_MESSAGES.NETWORK_ERROR);
    }
    throw error;
  }
}

/**
 * Check if error is a conflict error
 */
export function isConflictError(error: unknown): boolean {
  if (error instanceof Response) {
    return error.status === 409;
  }
  if (error && typeof error === 'object' && 'code' in error) {
    return (error as ApiError).code === 'CONFLICT';
  }
  return false;
}
