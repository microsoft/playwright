export class DocGraphError extends Error {
  constructor(message, details = undefined) {
    super(message);
    this.name = 'DocGraphError';
    if (details !== undefined)
      this.details = details;
  }
}
