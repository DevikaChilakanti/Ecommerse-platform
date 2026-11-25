import { CustomerMutationQueue } from "./customer-mutation-queue.service";

describe("CustomerMutationQueue", () => {
  let queue: CustomerMutationQueue;

  beforeEach(() => {
    queue = new CustomerMutationQueue();
  });

  it("runs operations sequentially for one customer", async () => {
    let releaseFirst!: () => void;
    const firstBlocked = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const events: string[] = [];

    const first = queue.run("customer-one", async () => {
      events.push("first-start");
      await firstBlocked;
      events.push("first-end");
    });
    const second = queue.run("customer-one", async () => {
      events.push("second-start");
    });

    await Promise.resolve();
    expect(events).toEqual(["first-start"]);
    releaseFirst();
    await Promise.all([first, second]);
    expect(events).toEqual(["first-start", "first-end", "second-start"]);
  });

  it("runs operations for different customers independently", async () => {
    let releaseOperations!: () => void;
    const operationsBlocked = new Promise<void>((resolve) => {
      releaseOperations = resolve;
    });
    const started: string[] = [];

    const first = queue.run("customer-one", async () => {
      started.push("customer-one");
      await operationsBlocked;
    });
    const second = queue.run("customer-two", async () => {
      started.push("customer-two");
      await operationsBlocked;
    });

    await Promise.resolve();
    expect(started).toEqual(["customer-one", "customer-two"]);
    releaseOperations();
    await Promise.all([first, second]);
  });

  it("continues after failures and removes completed queue entries", async () => {
    const queues = Reflect.get(queue, "queues") as Map<string, Promise<void>>;
    const failed = queue.run("customer-one", async () => {
      throw new Error("Mutation failed.");
    });
    const next = queue.run("customer-one", async () => "completed");

    await expect(failed).rejects.toThrow("Mutation failed.");
    await expect(next).resolves.toBe("completed");
    expect(queues.has("customer-one")).toBe(false);

    await expect(
      queue.run("customer-two", async () => {
        throw new Error("Final mutation failed.");
      }),
    ).rejects.toThrow("Final mutation failed.");
    expect(queues.has("customer-two")).toBe(false);
  });
});
