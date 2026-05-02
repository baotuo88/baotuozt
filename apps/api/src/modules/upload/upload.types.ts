export interface UploadImageInput {
  user_id: number;
  file_name?: string;
  mime_type?: string;
  content_base64?: string;
  data_url?: string;
  content_buffer?: Buffer;
}

export interface UploadImageOutput {
  image_url: string;
  key: string;
  size_bytes: number;
  mime_type: string;
}

export interface UploadStorage {
  upload(input: {
    key: string;
    body: Buffer;
    content_type: string;
  }): Promise<{ url: string }>;
}
