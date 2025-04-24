export type MinioConfig = {
  endpoint: string;
  api_port: number;
  webui_port: number;
  ssl: string;
  accessKey: string;
  secret: string;
  bucket: string;
};
