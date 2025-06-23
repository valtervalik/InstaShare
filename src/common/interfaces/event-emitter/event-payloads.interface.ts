export interface EventPayloads {
  // User Events
  'user.welcome': { email: string };

  // Files Events
  'files.compressed': { message: string; clientId: string };
  'files.uploaded': { message: string; clientId: string };
}
