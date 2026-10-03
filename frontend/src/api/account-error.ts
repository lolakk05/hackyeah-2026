/** Errors from the account backend, with a code the screens turn into a message. */
export type AccountErrorCode =
  | 'invalid_credentials'
  | 'email_not_verified'
  | 'check_email'
  | 'email_taken'
  | 'username_taken'
  | 'not_enough_coins'
  | 'unauthorized'
  | 'validation'
  | 'network'
  | 'generic';

export class AccountError extends Error {
  constructor(
    message: string,
    public code: AccountErrorCode,
    public status = 0,
  ) {
    super(message);
    this.name = 'AccountError';
  }
}
