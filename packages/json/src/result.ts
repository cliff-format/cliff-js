export interface ConversionWarning {
  path: string;
  message: string;
  before?: string;
  after?: string;
}

export interface ConvertResult {
  document: import("@cliff-format/core").CliffDocument;
  warnings: ConversionWarning[];
}
