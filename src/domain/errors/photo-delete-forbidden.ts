import { DomainError } from './domain-error';

export class PhotoDeleteForbiddenError extends DomainError {
  constructor() {
    super('You do not have permission to delete this photo');
    Object.setPrototypeOf(this, PhotoDeleteForbiddenError.prototype);
  }
}
