import { Injectable } from "@nestjs/common";

@Injectable()
export class CustomerMutationQueue {
  private readonly queues = new Map<string, Promise<void>>();

  run<T>(userId: string, operation: () => Promise<T>): Promise<T> {
    const previous = this.queues.get(userId) ?? Promise.resolve();
    const result = previous.then(operation);
    let queueTail: Promise<void> = Promise.resolve();
    queueTail = result.then(
      () => {
        if (this.queues.get(userId) === queueTail) {
          this.queues.delete(userId);
        }
      },
      () => {
        if (this.queues.get(userId) === queueTail) {
          this.queues.delete(userId);
        }
      },
    );

    this.queues.set(userId, queueTail);
    return result;
  }
}
