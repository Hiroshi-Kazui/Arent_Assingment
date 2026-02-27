import { DomainError } from './domain-error';

/**
 * 不正な状態遷移を試みた時に発生するエラー
 */
export class InvalidStatusTransitionError extends DomainError {
  constructor(currentStatus: string, targetStatus: string) {
    super(
      `Invalid status transition: ${currentStatus} -> ${targetStatus}`
    );
    Object.setPrototypeOf(
      this,
      InvalidStatusTransitionError.prototype
    );
  }
}
