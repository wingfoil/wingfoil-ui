/**
 * In-memory fake of the process runner port (adr-002): records every request and answers with
 * scripted results, so the domain is unit-tested without starting processes.
 */
import type { ProcessRequest, ProcessResult, ProcessRunner } from '../../../server/src/process/runner.js';

/** A scripted answer: the fields of the result that matter to the test. */
export type FakeAnswer = Partial<ProcessResult> | ((request: ProcessRequest) => Partial<ProcessResult>);

/** The fake runner. */
export class FakeProcessRunner implements ProcessRunner {
  /** Every request received, in order. */
  readonly requests: ProcessRequest[] = [];
  private readonly answers: FakeAnswer[] = [];

  /** Queue the answer of the next request (the last one is repeated when the queue runs out). */
  answer(answer: FakeAnswer): this {
    this.answers.push(answer);
    return this;
  }

  async run(request: ProcessRequest): Promise<ProcessResult> {
    this.requests.push(request);
    const next = this.answers.length > 1 ? this.answers.shift() : this.answers[0];
    const partial = typeof next === 'function' ? next(request) : (next ?? {});
    return {
      exitCode: 0,
      signal: null,
      stdout: '',
      stderr: '',
      ended: 'exit',
      durationMs: 0,
      ...partial,
    };
  }
}
