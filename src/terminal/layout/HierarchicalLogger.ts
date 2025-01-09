import { DebugLogger } from "../DebugLogger.js";

export class HierarchicalLogger {
  private static depth: number = 0;
  private static currentTrace: string[] = [];
  private static isNewTrace: boolean = true;
  private static traceInProgress: boolean = false;
  private static traceStack: string[] = [];
  private static traceDepth: number = 0;
  private static groupStack: string[] = []; // Track group context
  static shouldLog: boolean = true;

  static startTrace(name: string): void {
    if (this.traceDepth === 0) {
      this.traceInProgress = true;
      this.currentTrace = [];
      this.depth = 0;
      this.isNewTrace = false; // Changed to false to ensure first operation gets arrow
      if (HierarchicalLogger.shouldLog) {
        DebugLogger.log("\n=== Component Lifecycle Trace ===");
      }
    }
    this.traceDepth++;
    this.traceStack.push(name);
  }

  static endTrace(): void {
    if (!this.traceInProgress) return;

    this.traceDepth--;
    this.traceStack.pop();

    if (this.traceDepth === 0) {
      this.currentTrace.forEach((line) => DebugLogger.log(line));
      if (HierarchicalLogger.shouldLog)
        DebugLogger.log("===============================\n");
      this.traceInProgress = false;
      this.currentTrace = [];
      this.depth = 0;
      this.groupStack = [];
    }
  }

  static log(action: string, details?: string | Record<string, any>): void {
    if (!this.traceInProgress || !HierarchicalLogger.shouldLog) return;

    const indent = "  ".repeat(this.depth);
    const isMethodCall = action.includes(".");
    const isSystemOperation = !isMethodCall && !this.isNewTrace;
    const arrow = isMethodCall || isSystemOperation ? "↳ " : "";

    let detailsStr = "";
    if (details) {
      if (typeof details === "string") {
        detailsStr = details;
      } else {
        detailsStr = Object.entries(details)
          .map(([key, value]) => {
            if (typeof value === "object" && value !== null) {
              return `${key}: ${JSON.stringify(value)}`;
            }
            return `${key}: ${value}`;
          })
          .join(", ");
      }
    }

    const line = detailsStr
      ? `${indent}${arrow}${action} (${detailsStr})`
      : `${indent}${arrow}${action}`;

    DebugLogger.log(line);
    // console.log(line);
    this.isNewTrace = false;
  }

  static startGroup(context?: string): void {
    this.depth++;
    if (context) {
      this.groupStack.push(context);
    }
  }

  static endGroup(): void {
    this.depth = Math.max(0, this.depth - 1);
    if (this.groupStack.length > 0) {
      this.groupStack.pop();
    }
  }

  static getCurrentTraceDepth(): number {
    return this.traceDepth;
  }

  static getCurrentGroupContext(): string | undefined {
    return this.groupStack[this.groupStack.length - 1];
  }
}
