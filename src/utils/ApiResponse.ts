export class ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  meta?: Record<string, unknown>;

  constructor(success: boolean, message: string, data?: T, meta?: Record<string, unknown>) {
    this.success = success;
    this.message = message;
    this.data = data;
    this.meta = meta;
  }

  static success<T>(data: T, message: string = 'Success', meta?: Record<string, unknown>) {
    return new ApiResponse(true, message, data, meta);
  }

  static created<T>(data: T, message: string = 'Created successfully') {
    return new ApiResponse(true, message, data);
  }

  static error(message: string) {
    return new ApiResponse(false, message);
  }
}
