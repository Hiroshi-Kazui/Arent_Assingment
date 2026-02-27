/**
 * Domain layer の基底エラークラス
 * ビジネスロジックの違反時に発生
 */
export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, DomainError.prototype);
  }
}
