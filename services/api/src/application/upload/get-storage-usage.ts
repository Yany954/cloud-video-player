import type { StorageUsage } from '../../domain/quota';
import type { StorageAccountRepository } from '../ports';

export class GetStorageUsage {
  constructor(private readonly accounts: StorageAccountRepository) {}

  execute(input: { userId: string }): Promise<StorageUsage> {
    return this.accounts.getUsage(input.userId);
  }
}
