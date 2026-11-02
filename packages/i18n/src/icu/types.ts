export type IcuDialect = "plain" | "mf1" | "mf2";

export interface IcuError {
  type: string;
  message: string;
  source?: string;
}

export type MessagePart =
  | { type: "literal"; value: string }
  | { type: "expression"; source: string; value: string; locale?: string }
  | {
      type: "markup";
      kind: "open" | "close" | "standalone";
      name: string;
      source: string;
    };

export interface IcuFormatResult {
  text: string;
  errors: IcuError[];
}

export interface IcuPartsResult {
  parts: MessagePart[];
  errors: IcuError[];
}

export interface IcuAnalysis {
  dialect: IcuDialect;
  arguments: string[];
  errors: IcuError[];
}

export interface IcuFormatOptions {
  currency?: string;
  timeZone?: string;
}

export interface IcuRuntime {
  format(
    message: string,
    locale: string,
    values: Record<string, unknown>,
    options?: IcuFormatOptions,
  ): IcuFormatResult;
  formatToParts(
    message: string,
    locale: string,
    values: Record<string, unknown>,
    options?: IcuFormatOptions,
  ): IcuPartsResult;
  analyze(message: string): IcuAnalysis;
}
